import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { FactCard } from "@/components/FactCard";
import { getFactBySlug } from "@/lib/facts.functions";
import { isFactSaved } from "@/lib/user.functions";
import { useSession } from "@/hooks/useSession";

const factQuery = (slug: string) =>
  queryOptions({
    queryKey: ["fact", slug],
    queryFn: () => getFactBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/fact/$slug")({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(factQuery(params.slug));
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Explainer not found — Daily Curiosity" }, { name: "robots", content: "noindex" }],
      };
    }
    const { fact } = loaderData;
    return {
      meta: [
        { title: `${fact.title} — Daily Curiosity` },
        { name: "description", content: fact.hook },
        { property: "og:title", content: `${fact.title} — Daily Curiosity` },
        { property: "og:description", content: fact.hook },
      ],
    };
  },
  notFoundComponent: FactNotFound,
  component: FactPage,
});

function FactNotFound() {
  return (
    <AppShell>
      <AppHeader eyebrow="Not found" />
      <p className="text-sm text-muted-foreground">
        That explainer either doesn&apos;t exist or hasn&apos;t been featured yet.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Read today&apos;s explainer
      </Link>
    </AppShell>
  );
}

function FactPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(factQuery(slug));
  const { user } = useSession();
  const savedFn = useServerFn(isFactSaved);

  const saved = useQuery({
    queryKey: ["fact-saved", data?.fact.id, user?.id],
    queryFn: () => savedFn({ data: { factId: data!.fact.id } }),
    enabled: !!user && !!data,
  });

  if (!data) return <FactNotFound />;

  const dateLabel = data.pickDate
    ? new Date(`${data.pickDate}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : undefined;

  return (
    <AppShell>
      <AppHeader eyebrow="Explainer" />
      <FactCard
        fact={data.fact}
        dateLabel={dateLabel}
        isSignedIn={!!user}
        initiallySaved={saved.data?.saved ?? false}
      />
    </AppShell>
  );
}
