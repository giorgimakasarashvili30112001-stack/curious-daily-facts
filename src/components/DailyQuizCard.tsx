import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flame, X } from "lucide-react";
import { toast } from "sonner";
import {
  gradeQuizAnswer,
  getDailyQuiz,
  getQuizAttempt,
  submitQuizAnswer,
  type QuizResult,
} from "@/lib/quiz.functions";

const storageKey = (date: string) => `daily-quiz-${date}`;

export function DailyQuizCard({ isSignedIn }: { isSignedIn: boolean }) {
  const fetchQuiz = useServerFn(getDailyQuiz);
  const fetchAttempt = useServerFn(getQuizAttempt);
  const grade = useServerFn(gradeQuizAnswer);
  const submit = useServerFn(submitQuizAnswer);
  const navigate = useNavigate();

  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: quiz } = useQuery({ queryKey: ["daily-quiz"], queryFn: () => fetchQuiz({}) });

  useEffect(() => {
    if (!quiz) return;
    if (isSignedIn) {
      void fetchAttempt({ data: { factId: quiz.factId } })
        .then((r) => setResult(r))
        .catch(() => undefined);
      return;
    }
    const stored = sessionStorage.getItem(storageKey(quiz.quizDate));
    if (stored) {
      try {
        setResult(JSON.parse(stored) as QuizResult);
      } catch {
        // ignore malformed cache
      }
    }
  }, [quiz, isSignedIn, fetchAttempt]);

  if (!quiz) return null;

  const onAnswer = async (index: number) => {
    if (result || busy) return;
    setBusy(true);
    try {
      const outcome = isSignedIn
        ? await submit({ data: { factId: quiz.factId, selectedIndex: index } })
        : await grade({ data: { factId: quiz.factId, selectedIndex: index } });
      if (!outcome) return;
      setResult(outcome);
      if (!isSignedIn) sessionStorage.setItem(storageKey(quiz.quizDate), JSON.stringify(outcome));
    } catch {
      toast.error("Could not submit your answer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-6 pt-5 pb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary">
          Yesterday&apos;s check
        </p>
        <h2 className="mt-2 text-display text-[19px] leading-snug text-foreground">
          {quiz.prompt}
        </h2>
      </div>

      <div className="space-y-2 px-6 py-5">
        {quiz.options.map((option, index) => {
          const isCorrect = result?.correctIndex === index;
          const isPicked = result?.selectedIndex === index;
          const tone = !result
            ? "border-border bg-secondary text-secondary-foreground hover:bg-muted"
            : isCorrect
              ? "border-primary/50 bg-primary/15 text-foreground"
              : isPicked
                ? "border-destructive/50 bg-destructive/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground";

          return (
            <button
              key={option}
              type="button"
              disabled={!!result || busy}
              onClick={() => void onAnswer(index)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] leading-snug transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
                {result && isCorrect ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : result && isPicked ? (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  String.fromCharCode(65 + index)
                )}
              </span>
              {option}
            </button>
          );
        })}

        {result ? (
          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-[13px] font-semibold text-foreground">
              {result.isCorrect ? "Correct" : "Not quite"}
            </p>
            {isSignedIn && typeof result.quizStreak === "number" ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                <Flame className="h-4 w-4" aria-hidden="true" />
                {result.quizStreak > 0
                  ? `${result.quizStreak}-day quiz streak${result.streakExtended ? " — kept alive!" : ""}`
                  : "Quiz streak reset — back tomorrow"}
              </p>
            ) : null}
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {result.explanation}
            </p>

            <Link
              to="/fact/$slug"
              params={{ slug: quiz.factSlug }}
              className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-primary underline-offset-4 hover:underline"
            >
              Revisit {quiz.factTitle}
            </Link>
            {!isSignedIn ? (
              <button
                type="button"
                onClick={() => void navigate({ to: "/auth" })}
                className="mt-3 block text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Sign in to track your score
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
