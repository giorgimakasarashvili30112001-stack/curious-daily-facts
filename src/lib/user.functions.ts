import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ProfileState = {
  displayName: string | null;
  streak: number;
  longestStreak: number;
  lastSeenDate: string | null;
};

export type SavedFact = {
  slug: string;
  title: string;
  category: string;
  hook: string;
  savedAt: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Records a visit for the signed-in user and returns the refreshed streak. */
export const touchStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileState> => {
    const { supabase, userId } = context;
    const now = today();

    const { data: existing } = await supabase
      .from("profiles")
      .select("display_name, streak_count, longest_streak, last_seen_date")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase
        .from("profiles")
        .insert({ id: userId, streak_count: 1, longest_streak: 1, last_seen_date: now });
      return { displayName: null, streak: 1, longestStreak: 1, lastSeenDate: now };
    }

    if (existing.last_seen_date === now) {
      return {
        displayName: existing.display_name,
        streak: existing.streak_count,
        longestStreak: existing.longest_streak,
        lastSeenDate: existing.last_seen_date,
      };
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const wasYesterday = existing.last_seen_date === yesterday.toISOString().slice(0, 10);
    const streak = wasYesterday ? existing.streak_count + 1 : 1;
    const longest = Math.max(streak, existing.longest_streak);

    await supabase
      .from("profiles")
      .update({
        streak_count: streak,
        longest_streak: longest,
        last_seen_date: now,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return {
      displayName: existing.display_name,
      streak,
      longestStreak: longest,
      lastSeenDate: now,
    };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileState & { savedCount: number }> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, streak_count, longest_streak, last_seen_date")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("favorites").select("fact_id", { count: "exact", head: true }),
    ]);

    return {
      displayName: profile?.display_name ?? null,
      streak: profile?.streak_count ?? 0,
      longestStreak: profile?.longest_streak ?? 0,
      lastSeenDate: profile?.last_seen_date ?? null,
      savedCount: count ?? 0,
    };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ displayName: z.string().max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const name = data.displayName.trim();
    const { error } = await context.supabase
      .from("profiles")
      .upsert(
        { id: context.userId, display_name: name || null, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const getSavedFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedFact[]> => {
    const { data } = await context.supabase
      .from("favorites")
      .select("created_at, facts:fact_id (slug, title, category, hook)")
      .order("created_at", { ascending: false });

    return (data ?? [])
      .map((row) => {
        const fact = row.facts as
          | { slug: string; title: string; category: string; hook: string }
          | null;
        if (!fact) return null;
        return { ...fact, savedAt: row.created_at };
      })
      .filter((row): row is SavedFact => row !== null);
  });

export const isFactSaved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("favorites")
      .select("fact_id")
      .eq("fact_id", data.factId)
      .maybeSingle();
    return { saved: !!row };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("favorites")
      .select("fact_id")
      .eq("fact_id", data.factId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("favorites").delete().eq("fact_id", data.factId);
      if (error) throw error;
      return { saved: false };
    }

    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, fact_id: data.factId });
    if (error) throw error;
    return { saved: true };
  });
