import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export type ArchiveEntry = {
  pick_date: string;
  slug: string;
  title: string;
  category: string;
  hook: string;
};

export const getTodayFact = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ date: string; fact: Fact | null }> => {
    const { ensureDailyPick, todayUtc, topUpFacts, countUnusedFacts } = await import(
      "./facts.server"
    );
    const date = todayUtc();

    let fact = await ensureDailyPick(date);
    if (!fact) {
      // Library exhausted: generate before serving.
      await topUpFacts(15, 8);
      fact = await ensureDailyPick(date);
    } else if ((await countUnusedFacts()) < 15) {
      // Warm the library in the background; failures are non-fatal.
      void topUpFacts(15, 8).catch((error) => console.error("fact top-up failed", error));
    }

    return { date, fact };
  },
);

export const getArchive = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArchiveEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { todayUtc } = await import("./facts.server");

    const { data } = await supabaseAdmin
      .from("daily_picks")
      .select("pick_date, facts:fact_id (slug, title, category, hook)")
      .lte("pick_date", todayUtc())
      .order("pick_date", { ascending: false })
      .limit(120);

    return (data ?? [])
      .map((row) => {
        const fact = row.facts as
          | { slug: string; title: string; category: string; hook: string }
          | null;
        if (!fact) return null;
        return {
          pick_date: row.pick_date,
          slug: fact.slug,
          title: fact.title,
          category: fact.category,
          hook: fact.hook,
        };
      })
      .filter((row): row is ArchiveEntry => row !== null);
  },
);

export const getFactBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ fact: Fact; pickDate: string | null } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { FACT_COLUMNS, toFact, todayUtc } = await import("./facts.server");

    const { data: row } = await supabaseAdmin
      .from("facts")
      .select(FACT_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (!row) return null;

    const fact = toFact(row as Record<string, unknown>);

    const { data: pick } = await supabaseAdmin
      .from("daily_picks")
      .select("pick_date")
      .eq("fact_id", fact.id)
      .lte("pick_date", todayUtc())
      .maybeSingle();

    // Only explainers that have already been featured are publicly readable.
    if (!pick) return null;

    return { fact, pickDate: pick.pick_date };
  });
