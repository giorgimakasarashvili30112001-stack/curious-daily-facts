import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getSavedFacts } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved explainers — Daily Curiosity" },
      { name: "description", content: "Every explainer you bookmarked, in one place." },
      { property: "og:title", content: "Saved explainers — Daily Curiosity" },
      { property: "og:description", content: "Your personal library of saved explainers." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const fetchSaved = useServerFn(getSavedFacts);
  const { data, isLoading } = useQuery({
    queryKey: ["saved-facts"],
    queryFn: () => fetchSaved({}),
  });

  return (
    <AppShell>
      <AppHeader eyebrow="Saved" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your library…</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing saved yet. Tap Save on an explainer to keep it here.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((fact) => (
            <li key={fact.slug}>
              <Link
                to="/fact/$slug"
                params={{ slug: fact.slug }}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {fact.category}
                </span>
                <h2 className="mt-2 text-display text-lg leading-snug text-foreground">
                  {fact.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{fact.hook}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
