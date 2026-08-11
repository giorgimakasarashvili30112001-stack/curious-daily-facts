import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getArchive } from "@/lib/facts.functions";

const archiveQuery = queryOptions({
  queryKey: ["archive"],
  queryFn: () => getArchive(),
});

export const Route = createFileRoute("/archive")({
  loader: ({ context }) => context.queryClient.ensureQueryData(archiveQuery),
  head: () => ({
    meta: [
      { title: "Archive — every past Daily Curiosity explainer" },
      {
        name: "description",
        content:
          "Catch up on every explainer that has been featured, from how a door key works to what a credit score means.",
      },
      { property: "og:title", content: "Archive — every past Daily Curiosity explainer" },
      {
        property: "og:description",
        content: "Browse past days and read the explainers you missed.",
      },
    ],
  }),
  component: ArchivePage,
});

function CountdownNote() {
  return (
    <div className="mb-5 rounded-2xl border border-dashed border-border p-5 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tomorrow</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Sealed until midnight UTC. A new topic, a different category.
      </p>
    </div>
  );
}

function ArchivePage() {
  const { data } = useSuspenseQuery(archiveQuery);

  return (
    <AppShell>
      <AppHeader eyebrow="Archive" />
      <CountdownNote />

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing archived yet — come back tomorrow.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((entry) => (
            <li key={entry.pick_date}>
              <Link
                to="/fact/$slug"
                params={{ slug: entry.slug }}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{entry.category}</span>
                  <time dateTime={entry.pick_date}>
                    {new Date(`${entry.pick_date}T00:00:00Z`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </time>
                </div>
                <h2 className="mt-2 text-display text-lg leading-snug text-foreground">
                  {entry.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{entry.hook}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
