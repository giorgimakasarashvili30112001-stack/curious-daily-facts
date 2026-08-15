import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { toggleFavorite } from "@/lib/user.functions";
import { ShareSheet } from "@/components/ShareSheet";
import type { Fact } from "@/lib/facts.functions";


export function FactCard({
  fact,
  dateLabel,
  isSignedIn,
  initiallySaved = false,
}: {
  fact: Fact;
  dateLabel?: string | undefined;
  isSignedIn: boolean;
  initiallySaved?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toggle = useServerFn(toggleFavorite);

  const mutation = useMutation({
    mutationFn: () => toggle({ data: { factId: fact.id } }),
    onSuccess: (result) => {
      setSaved(result.saved);
      void queryClient.invalidateQueries({ queryKey: ["saved-facts"] });
      toast.success(result.saved ? "Saved to your list" : "Removed from your list");
    },
    onError: () => toast.error("Could not update your saved list"),
  });

  const onSave = () => {
    if (!isSignedIn) {
      toast("Sign in to save explainers");
      void navigate({ to: "/auth" });
      return;
    }
    mutation.mutate();
  };




  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
            {fact.category}
          </span>
          {dateLabel ? <span>{dateLabel}</span> : null}
        </div>
        <h1 className="mt-4 text-display text-[28px] leading-[1.15] text-foreground">
          {fact.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-primary">{fact.hook}</p>
      </div>

      <div className="px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted-foreground">{fact.intro}</p>

        <ol className="mt-6 space-y-5">
          {fact.steps.map((step, index) => (
            <li key={`${fact.id}-${index}`} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{step.heading}</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-5">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-primary">Wait, really?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            {fact.surprising_detail}
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            {saved ? "Saved" : "Save"}
          </button>
          <ShareSheet
            title={fact.title}
            text={fact.hook}
            url={typeof window !== "undefined" ? `${window.location.origin}/fact/${fact.slug}` : `/fact/${fact.slug}`}
          />

        </div>

        <Link
          to="/fact/$slug"
          params={{ slug: fact.slug }}
          className="mt-4 block text-center text-xs uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:underline"
        >
          Open permanent link
        </Link>
      </div>
    </article>
  );
}
