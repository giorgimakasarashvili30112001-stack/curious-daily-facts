import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

export function AppHeader({
  eyebrow,
  streak,
}: {
  eyebrow: string;
  streak?: number | null;
}) {
  return (
    <header className="flex items-center justify-between pt-8 pb-6">
      <Link to="/" className="flex flex-col">
        <span className="text-display text-lg leading-none text-foreground">Daily Curiosity</span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
      </Link>
      {typeof streak === "number" && streak > 0 ? (
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-primary">
          <Flame className="h-4 w-4" aria-hidden="true" />
          {streak}
        </span>
      ) : null}
    </header>
  );
}
