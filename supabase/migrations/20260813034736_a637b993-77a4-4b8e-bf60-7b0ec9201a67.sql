ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quiz_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_quiz_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_correct_quiz_date date;