import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type DailyQuiz = {
  quizDate: string;
  factDate: string;
  factId: string;
  factSlug: string;
  factTitle: string;
  prompt: string;
  options: string[];
};

export type QuizResult = {
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
  quizStreak?: number;
  longestQuizStreak?: number;
  streakExtended?: boolean;
};


const answerInput = (input: unknown) =>
  z.object({ factId: z.string().uuid(), selectedIndex: z.number().int().min(0).max(3) }).parse(input);

/** Yesterday's explainer turned into one multiple-choice question. Public. */
export const getDailyQuiz = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyQuiz | null> => {
    const { todayUtc } = await import("./facts.server");
    const { quizFactDate, getQuestionForDate } = await import("./quiz.server");

    const quizDate = todayUtc();
    const factDate = quizFactDate(quizDate);
    const result = await getQuestionForDate(factDate);
    if (!result) return null;

    return {
      quizDate,
      factDate,
      factId: result.fact.id,
      factSlug: result.fact.slug,
      factTitle: result.fact.title,
      prompt: result.question.prompt,
      options: result.question.options,
    };
  },
);

/** Grades an answer without persisting it (signed-out play). */
export const gradeQuizAnswer = createServerFn({ method: "POST" })
  .inputValidator(answerInput)
  .handler(async ({ data }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const question = await loadQuestion(data.factId);
    if (!question) return null;
    return {
      selectedIndex: data.selectedIndex,
      correctIndex: question.correct_index,
      isCorrect: data.selectedIndex === question.correct_index,
      explanation: question.explanation,
    };
  });

/** Grades and records today's attempt for the signed-in user. */
export const submitQuizAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answerInput)
  .handler(async ({ data, context }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const { todayUtc } = await import("./facts.server");

    const question = await loadQuestion(data.factId);
    if (!question) return null;

    const isCorrect = data.selectedIndex === question.correct_index;
    const quizDate = todayUtc();

    const { error } = await context.supabase.from("quiz_attempts").insert({
      user_id: context.userId,
      quiz_date: quizDate,
      fact_id: data.factId,
      selected_index: data.selectedIndex,
      is_correct: isCorrect,
    });
    // A duplicate means they already answered today; keep the stored attempt.
    if (error && error.code !== "23505") throw error;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("quiz_streak, longest_quiz_streak, last_correct_quiz_date")
      .eq("id", context.userId)
      .maybeSingle();

    let quizStreak = profile?.quiz_streak ?? 0;
    let longestQuizStreak = profile?.longest_quiz_streak ?? 0;

    if (error) {
      const { data: existing } = await context.supabase
        .from("quiz_attempts")
        .select("selected_index, is_correct")
        .eq("quiz_date", quizDate)
        .maybeSingle();
      if (existing) {
        return {
          selectedIndex: existing.selected_index,
          correctIndex: question.correct_index,
          isCorrect: existing.is_correct,
          explanation: question.explanation,
          quizStreak,
          longestQuizStreak,
        };
      }
    }

    let streakExtended = false;
    if (isCorrect && profile?.last_correct_quiz_date !== quizDate) {
      const yesterday = new Date(`${quizDate}T00:00:00Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const continued = profile?.last_correct_quiz_date === yesterday.toISOString().slice(0, 10);
      quizStreak = continued ? quizStreak + 1 : 1;
      longestQuizStreak = Math.max(longestQuizStreak, quizStreak);
      streakExtended = true;

      await context.supabase.from("profiles").upsert(
        {
          id: context.userId,
          quiz_streak: quizStreak,
          longest_quiz_streak: longestQuizStreak,
          last_correct_quiz_date: quizDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } else if (!isCorrect && quizStreak > 0) {
      quizStreak = 0;
      await context.supabase
        .from("profiles")
        .update({ quiz_streak: 0, updated_at: new Date().toISOString() })
        .eq("id", context.userId);
    }

    return {
      selectedIndex: data.selectedIndex,
      correctIndex: question.correct_index,
      isCorrect,
      explanation: question.explanation,
      quizStreak,
      longestQuizStreak,
      streakExtended,
    };

  });

/** Today's recorded attempt, if the user already answered. */
export const getQuizAttempt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const { todayUtc } = await import("./facts.server");

    const { data: attempt } = await context.supabase
      .from("quiz_attempts")
      .select("selected_index, is_correct")
      .eq("quiz_date", todayUtc())
      .maybeSingle();
    if (!attempt) return null;

    const question = await loadQuestion(data.factId);
    if (!question) return null;

    return {
      selectedIndex: attempt.selected_index,
      correctIndex: question.correct_index,
      isCorrect: attempt.is_correct,
      explanation: question.explanation,
    };
  });

/** Lifetime quiz stats for the signed-in user. */
export const getQuizStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ answered: number; correct: number }> => {
    const { data } = await context.supabase.from("quiz_attempts").select("is_correct");
    const rows = data ?? [];
    return { answered: rows.length, correct: rows.filter((r) => r.is_correct).length };
  });
