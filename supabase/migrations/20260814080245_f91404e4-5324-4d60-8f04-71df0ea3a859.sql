ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS quiz_streak,
  DROP COLUMN IF EXISTS longest_quiz_streak,
  DROP COLUMN IF EXISTS last_correct_quiz_date;