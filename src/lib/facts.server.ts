import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FactStep = { heading: string; body: string };

export type Fact = {
  id: string;
  title: string;
  slug: string;
  question_type: string;
  category: string;
  hook: string;
  intro: string;
  steps: FactStep[];
  surprising_detail: string;
};

export const FACT_COLUMNS =
  "id, title, slug, question_type, category, hook, intro, steps, surprising_detail";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSteps(value: unknown): FactStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ heading: String(s["heading"] ?? ""), body: String(s["body"] ?? "") }))
    .filter((s) => s.heading || s.body);
}

export function toFact(row: Record<string, unknown>): Fact {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    slug: String(row["slug"]),
    question_type: String(row["question_type"]),
    category: String(row["category"]),
    hook: String(row["hook"]),
    intro: String(row["intro"]),
    steps: normalizeSteps(row["steps"]),
    surprising_detail: String(row["surprising_detail"]),
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function usedFactIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("daily_picks").select("fact_id");
  return (data ?? []).map((r) => r.fact_id);
}

export async function countUnusedFacts(): Promise<number> {
  const used = await usedFactIds();
  let query = supabaseAdmin.from("facts").select("id", { count: "exact", head: true });
  if (used.length > 0) query = query.not("id", "in", `(${used.join(",")})`);
  const { count } = await query;
  return count ?? 0;
}

/** Returns the fact featured on `date`, creating the pick if it does not exist yet. */
export async function ensureDailyPick(date: string): Promise<Fact | null> {
  const existing = await supabaseAdmin
    .from("daily_picks")
    .select(`fact_id, facts:fact_id (${FACT_COLUMNS})`)
    .eq("pick_date", date)
    .maybeSingle();

  const existingFact = existing.data?.facts as Record<string, unknown> | null | undefined;
  if (existingFact) return toFact(existingFact);

  const used = await usedFactIds();

  // Avoid two days in a row from the same category.
  const yesterday = new Date(`${date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prev = await supabaseAdmin
    .from("daily_picks")
    .select("facts:fact_id (category)")
    .eq("pick_date", yesterday.toISOString().slice(0, 10))
    .maybeSingle();
  const prevCategory = (prev.data?.facts as { category?: string } | null)?.category ?? null;

  const pickCandidate = async (excludeCategory: string | null) => {
    let q = supabaseAdmin.from("facts").select(FACT_COLUMNS).limit(1);
    if (used.length > 0) q = q.not("id", "in", `(${used.join(",")})`);
    if (excludeCategory) q = q.neq("category", excludeCategory);
    // Rotate deterministically by date so the same fact is served to everyone.
    const seed = Number(date.replace(/-/g, "")) % 2 === 0;
    q = q.order("created_at", { ascending: seed }).order("id", { ascending: seed });
    const { data } = await q;
    return data?.[0] ?? null;
  };

  let candidate = await pickCandidate(prevCategory);
  if (!candidate) candidate = await pickCandidate(null);
  if (!candidate) return null;

  const row = candidate as Record<string, unknown>;
  await supabaseAdmin
    .from("daily_picks")
    .upsert({ pick_date: date, fact_id: String(row["id"]) }, { onConflict: "pick_date" });

  // Re-read so concurrent requests converge on the stored pick.
  const settled = await supabaseAdmin
    .from("daily_picks")
    .select(`facts:fact_id (${FACT_COLUMNS})`)
    .eq("pick_date", date)
    .maybeSingle();
  const settledFact = settled.data?.facts as Record<string, unknown> | null | undefined;
  return settledFact ? toFact(settledFact) : toFact(row);
}

type GeneratedFact = {
  title: string;
  question_type: string;
  category: string;
  hook: string;
  intro: string;
  steps: FactStep[];
  surprising_detail: string;
};

const CATEGORIES = [
  "Everyday Objects",
  "Vehicles",
  "Money",
  "Space",
  "Body",
  "Technology",
  "Nature",
  "Society",
];

/** Generates new explainers with Lovable AI when the unused library runs low. */
export async function topUpFacts(minUnused = 15, batchSize = 8): Promise<number> {
  const unused = await countUnusedFacts();
  if (unused >= minUnused) return 0;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { data: existing } = await supabaseAdmin.from("facts").select("title").limit(1000);
  const existingTitles = (existing ?? []).map((r) => r.title);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        {
          role: "system",
          content:
            "You write short, factually accurate general-knowledge explainers for a daily curiosity app. Voice: sharp, warm, concrete, no fluff, no emoji.",
        },
        {
          role: "user",
          content: `Write ${batchSize} new explainers. Each title is either "How X works" or "What X means" (question_type "how" or "what"). Categories must come from: ${CATEGORIES.join(", ")}. hook = one punchy sentence under 90 characters. intro = two sentences of plain-language setup. steps = exactly 4 items, heading under 6 words, body 1-2 sentences explaining the real mechanism. surprising_detail = one genuinely surprising true fact. Topics must be concrete everyday curiosities. Do NOT reuse any of these existing titles: ${existingTitles.join(" | ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "facts_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    question_type: { type: "string", enum: ["how", "what"] },
                    category: { type: "string", enum: CATEGORIES },
                    hook: { type: "string" },
                    intro: { type: "string" },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: { heading: { type: "string" }, body: { type: "string" } },
                        required: ["heading", "body"],
                      },
                    },
                    surprising_detail: { type: "string" },
                  },
                  required: [
                    "title",
                    "question_type",
                    "category",
                    "hook",
                    "intro",
                    "steps",
                    "surprising_detail",
                  ],
                },
              },
            },
            required: ["facts"],
          },
        },
      },
    }),
  });

  if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
  if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return 0;

  let parsed: { facts?: GeneratedFact[] };
  try {
    parsed = JSON.parse(content) as { facts?: GeneratedFact[] };
  } catch {
    return 0;
  }

  const rows = (parsed.facts ?? [])
    .filter(
      (f) =>
        f &&
        typeof f.title === "string" &&
        f.title.length > 3 &&
        Array.isArray(f.steps) &&
        f.steps.length > 0 &&
        CATEGORIES.includes(f.category) &&
        (f.question_type === "how" || f.question_type === "what"),
    )
    .map((f) => ({
      title: f.title.trim(),
      slug: slugify(f.title),
      question_type: f.question_type,
      category: f.category,
      hook: f.hook,
      intro: f.intro,
      steps: normalizeSteps(f.steps),
      surprising_detail: f.surprising_detail,
      source: "ai",
    }))
    .filter((f) => f.slug.length > 0);

  if (rows.length === 0) return 0;

  const { error } = await supabaseAdmin.from("facts").upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  return rows.length;
}
