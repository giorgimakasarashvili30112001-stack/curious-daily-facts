CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL UNIQUE REFERENCES public.facts(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quiz_questions TO anon;
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quiz questions are readable by everyone"
ON public.quiz_questions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_date date NOT NULL,
  fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_date)
);

GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own quiz attempts"
ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_quiz_questions_updated_at
BEFORE UPDATE ON public.quiz_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();