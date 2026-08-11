import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useSession";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Daily Curiosity" },
      {
        name: "description",
        content: "Sign in to keep your streak, save explainers, and sync across devices.",
      },
      { property: "og:title", content: "Sign in — Daily Curiosity" },
      {
        property: "og:description",
        content: "Keep your daily streak and saved explainers in sync.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      void navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <AppHeader eyebrow={mode === "signup" ? "Create account" : "Welcome back"} />

      {checkEmail ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-display text-xl text-foreground">Check your inbox</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Open it to finish creating your account.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-display text-xl text-foreground">
            {mode === "signup" ? "Start your streak" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your streak, saved explainers, and history follow you to every device.
          </p>

          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={busy}
            className="mt-5 w-full rounded-full border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
