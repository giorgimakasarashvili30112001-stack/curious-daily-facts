ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS question_index integer NOT NULL DEFAULT 0;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.quiz_questions'::regclass AND contype IN ('u','p') AND conname <> 'quiz_questions_pkey'
  LOOP
    EXECUTE format('ALTER TABLE public.quiz_questions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_questions_fact_index_key
  ON public.quiz_questions (fact_id, question_index);

ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS question_index integer NOT NULL DEFAULT 0;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.quiz_attempts'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.quiz_attempts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.quiz_attempts_user_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_user_date_question_key
  ON public.quiz_attempts (user_id, quiz_date, question_index);