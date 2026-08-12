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
        };
      }
    }

    return {
      selectedIndex: data.selectedIndex,
      correctIndex: question.correct_index,
      isCorrect,
      explanation: question.explanation,
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
