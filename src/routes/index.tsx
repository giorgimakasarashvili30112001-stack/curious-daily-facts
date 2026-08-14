import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { FactCard } from "@/components/FactCard";
import { DailyQuizCard } from "@/components/DailyQuizCard";
import { getTodayFact } from "@/lib/facts.functions";
import { getProfile, isFactSaved } from "@/lib/user.functions";
import { useSession } from "@/hooks/useSession";

const todayQuery = queryOptions({
  queryKey: ["today-fact"],
  queryFn: () => getTodayFact(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todayQuery),
  head: () => ({
    meta: [
      { title: "Daily Curiosity — one new explainer every day" },
      {
        name: "description",
        content:
          "A fresh how-it-works or what-it-means explainer every day. Build general knowledge in two minutes a morning.",
      },
      { property: "og:title", content: "Daily Curiosity — one new explainer every day" },
      {
        property: "og:description",
        content: "How things work, what things mean. One short explainer, every single day.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { data } = useSuspenseQuery(todayQuery);
  const { user } = useSession();
  const profileFn = useServerFn(getProfile);
  const savedFn = useServerFn(isFactSaved);

  const streak = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn({}),
    enabled: !!user,
  });

  const saved = useQuery({
    queryKey: ["fact-saved", data.fact?.id, user?.id],
    queryFn: () => savedFn({ data: { factId: data.fact!.id } }),
    enabled: !!user && !!data.fact,
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const dateLabel = new Date(`${data.date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <AppShell>
      <AppHeader eyebrow="Today's explainer" streak={streak.data?.streak ?? null} />

      {data.fact ? (
        <FactCard
          key={data.fact.id}
          fact={data.fact}
          dateLabel={dateLabel}
          isSignedIn={!!user}
          initiallySaved={saved.data?.saved ?? false}
        />
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Today's explainer is still being prepared. Check back in a moment.
        </p>
      )}

      <DailyQuizCard isSignedIn={!!user} />

      {!user ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to keep your streak and save explainers across devices.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : null}

      <Link
        to="/archive"
        className="mt-6 block text-center text-xs uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:underline"
      >
        Browse past days
      </Link>
    </AppShell>
  );
}
