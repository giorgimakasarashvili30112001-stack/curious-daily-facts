import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type QuizQuestionRow = {
  fact_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter((v) => v.length > 0);
}

/** The date the daily quiz refers to: yesterday (UTC). */
export function quizFactDate(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function loadQuestion(factId: string): Promise<QuizQuestionRow | null> {
  const { data } = await supabaseAdmin
    .from("quiz_questions")
    .select("fact_id, prompt, options, correct_index, explanation")
    .eq("fact_id", factId)
    .maybeSingle();
  if (!data) return null;
  const options = normalizeOptions(data.options);
  if (options.length !== 4) return null;
  return {
    fact_id: data.fact_id,
    prompt: data.prompt,
    options,
    correct_index: data.correct_index,
    explanation: data.explanation,
  };
}

type GeneratedQuiz = {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type FactLike = {
  id: string;
  title: string;
  intro: string;
  steps: { heading: string; body: string }[];
  surprising_detail: string;
};

/** Generates and stores the single quiz question for a fact. */
export async function generateQuestion(fact: FactLike): Promise<QuizQuestionRow | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const stepText = fact.steps.map((s) => `${s.heading}: ${s.body}`).join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        {
          role: "system",
          content:
            "You write one crisp multiple-choice comprehension question about a short explainer. Test understanding of the mechanism, not trivia recall. No emoji.",
        },
        {
          role: "user",
          content: `Explainer title: ${fact.title}\nIntro: ${fact.intro}\nSteps:\n${stepText}\nSurprising detail: ${fact.surprising_detail}\n\nWrite one question with exactly 4 short options (under 80 characters each), one clearly correct, three plausible but wrong. correct_index is the 0-based index of the correct option. explanation is one sentence saying why it's right.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "quiz_question",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correct_index: { type: "integer" },
              explanation: { type: "string" },
            },
            required: ["prompt", "options", "correct_index", "explanation"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("quiz generation failed", response.status, await response.text());
    return null;
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: GeneratedQuiz;
  try {
    parsed = JSON.parse(content) as GeneratedQuiz;
  } catch {
    return null;
  }

  const options = normalizeOptions(parsed.options);
  const index = Number(parsed.correct_index);
  if (
    options.length !== 4 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 3 ||
    !parsed.prompt ||
    !parsed.explanation
  ) {
    return null;
  }

  const row: QuizQuestionRow = {
    fact_id: fact.id,
    prompt: parsed.prompt.trim(),
    options,
    correct_index: index,
    explanation: parsed.explanation.trim(),
  };

  const { error } = await supabaseAdmin
    .from("quiz_questions")
    .upsert(row, { onConflict: "fact_id" });
  if (error) throw error;

  return row;
}

/** Question for yesterday's featured fact, generating it once if needed. */
export async function getQuestionForDate(
  factDate: string,
): Promise<{ question: QuizQuestionRow; fact: { id: string; slug: string; title: string } } | null> {
  const { data: pick } = await supabaseAdmin
    .from("daily_picks")
    .select("fact_id, facts:fact_id (id, slug, title, intro, steps, surprising_detail)")
    .eq("pick_date", factDate)
    .maybeSingle();

  const raw = pick?.facts as Record<string, unknown> | null | undefined;
  if (!raw) return null;

  const fact: FactLike = {
    id: String(raw["id"]),
    title: String(raw["title"]),
    intro: String(raw["intro"]),
    steps: Array.isArray(raw["steps"])
      ? (raw["steps"] as Record<string, unknown>[]).map((s) => ({
          heading: String(s?.["heading"] ?? ""),
          body: String(s?.["body"] ?? ""),
        }))
      : [],
    surprising_detail: String(raw["surprising_detail"]),
  };

  const question = (await loadQuestion(fact.id)) ?? (await generateQuestion(fact));
  if (!question) return null;

  return { question, fact: { id: fact.id, slug: String(raw["slug"]), title: fact.title } };
}
