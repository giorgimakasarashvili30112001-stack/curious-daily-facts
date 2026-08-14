import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type QuizQuestionRow = {
  fact_id: string;
  question_index: number;
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

export async function loadQuestion(
  factId: string,
  questionIndex = 0,
): Promise<QuizQuestionRow | null> {
  const { data } = await supabaseAdmin
    .from("quiz_questions")
    .select("fact_id, question_index, prompt, options, correct_index, explanation")
    .eq("fact_id", factId)
    .eq("question_index", questionIndex)
    .maybeSingle();
  if (!data) return null;
  const options = normalizeOptions(data.options);
  if (options.length !== 4) return null;
  return {
    fact_id: data.fact_id,
    question_index: data.question_index,
    prompt: data.prompt,
    options,
    correct_index: data.correct_index,
    explanation: data.explanation,
  };
}

async function previousPrompts(factId: string, questionIndex: number): Promise<string[]> {
  if (questionIndex <= 0) return [];
  const { data } = await supabaseAdmin
    .from("quiz_questions")
    .select("prompt")
    .eq("fact_id", factId)
    .lt("question_index", questionIndex);
  return (data ?? []).map((r) => r.prompt);
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

/**
 * Generates and stores the quiz question at `questionIndex` for a fact.
 * Concurrency-safe: the unique (fact_id, question_index) index means only one
 * parallel generation wins, and every caller re-reads the stored winner so all
 * users always see the exact same question.
 */
export async function generateQuestion(
  fact: FactLike,
  questionIndex = 0,
): Promise<QuizQuestionRow | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const stepText = fact.steps.map((s) => `${s.heading}: ${s.body}`).join("\n");
  const asked = await previousPrompts(fact.id, questionIndex);
  const avoid = asked.length
    ? `\n\nThese questions were already asked about this explainer — write a clearly different one, in the same style, testing another part of the mechanism:\n${asked.map((p) => `- ${p}`).join("\n")}`
    : "";

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
          content: `Explainer title: ${fact.title}\nIntro: ${fact.intro}\nSteps:\n${stepText}\nSurprising detail: ${fact.surprising_detail}\n\nWrite one question with exactly 4 short options (under 80 characters each), one clearly correct, three plausible but wrong. correct_index is the 0-based index of the correct option. explanation is one sentence saying why it's right.${avoid}`,
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
    return loadQuestion(fact.id, questionIndex);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return loadQuestion(fact.id, questionIndex);

  let parsed: GeneratedQuiz;
  try {
    parsed = JSON.parse(content) as GeneratedQuiz;
  } catch {
    return loadQuestion(fact.id, questionIndex);
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
    return loadQuestion(fact.id, questionIndex);
  }

  const row: QuizQuestionRow = {
    fact_id: fact.id,
    question_index: questionIndex,
    prompt: parsed.prompt.trim(),
    options,
    correct_index: index,
    explanation: parsed.explanation.trim(),
  };

  // Ignore duplicates: a parallel request may have already stored this slot.
  await supabaseAdmin
    .from("quiz_questions")
    .upsert(row, { onConflict: "fact_id,question_index", ignoreDuplicates: true });

  // Always return the persisted row so every user gets the identical question.
  return loadQuestion(fact.id, questionIndex);
}

async function loadFact(factDate: string): Promise<{ fact: FactLike; slug: string } | null> {
  const { data: pick } = await supabaseAdmin
    .from("daily_picks")
    .select("fact_id, facts:fact_id (id, slug, title, intro, steps, surprising_detail)")
    .eq("pick_date", factDate)
    .maybeSingle();

  const raw = pick?.facts as Record<string, unknown> | null | undefined;
  if (!raw) return null;

  return {
    slug: String(raw["slug"]),
    fact: {
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
    },
  };
}

/** Question for yesterday's featured fact at a given index, generating it once if needed. */
export async function getQuestionForDate(
  factDate: string,
  questionIndex = 0,
): Promise<{ question: QuizQuestionRow; fact: { id: string; slug: string; title: string } } | null> {
  const loaded = await loadFact(factDate);
  if (!loaded) return null;
  const { fact, slug } = loaded;

  const question =
    (await loadQuestion(fact.id, questionIndex)) ??
    (await generateQuestion(fact, questionIndex));
  if (!question) return null;

  return { question, fact: { id: fact.id, slug, title: fact.title } };
}

/** Question for a fact by id at a given index, generating it once if needed. */
export async function getQuestionForFact(
  factId: string,
  questionIndex: number,
): Promise<QuizQuestionRow | null> {
  const existing = await loadQuestion(factId, questionIndex);
  if (existing) return existing;

  const { data: raw } = await supabaseAdmin
    .from("facts")
    .select("id, title, intro, steps, surprising_detail")
    .eq("id", factId)
    .maybeSingle();
  if (!raw) return null;

  const fact: FactLike = {
    id: raw.id,
    title: raw.title,
    intro: raw.intro,
    steps: Array.isArray(raw.steps)
      ? (raw.steps as Record<string, unknown>[]).map((s) => ({
          heading: String(s?.["heading"] ?? ""),
          body: String(s?.["body"] ?? ""),
        }))
      : [],
    surprising_detail: raw.surprising_detail,
  };

  return generateQuestion(fact, questionIndex);
}
