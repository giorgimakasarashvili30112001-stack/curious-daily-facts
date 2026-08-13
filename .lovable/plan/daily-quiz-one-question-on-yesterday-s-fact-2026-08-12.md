# Daily Quiz — one question on yesterday's fact

A single multiple-choice question each day that checks whether yesterday's explainer stuck.

## The experience

- On the Today screen, above (or just under) today's card, a compact "Yesterday's check" panel appears once a previous day's fact exists.
- One question, 4 options, tap to answer. Instant feedback: correct answer highlighted, plus a one-line explanation and a link back to yesterday's explainer.
- One attempt per day. After answering, the panel shows the result for the rest of the day.
- Signed out: the quiz is playable, but the result isn't remembered across devices and a small "Sign in to track your score" line appears.
- Profile page gains two small stats: questions answered and correct rate.
- If there is no previous day yet (first day of use), the panel is hidden entirely.

## Where questions come from

Each explainer gets one question tied to its mechanism, not trivia phrasing. Questions are generated once per fact with Lovable AI in the same style as the existing top-up flow (question, four options, correct answer, short explanation) and stored alongside the fact, so every user sees the same question and it costs nothing to re-show.

Generation happens lazily: when the daily quiz is requested and yesterday's fact has no question yet, one is generated and saved on the spot. Existing seeded facts get questions this way as they roll through the archive.

## Technical notes

- New table `quiz_questions`: `fact_id` (unique, references facts), `prompt`, `options` (JSONB array of 4 strings), `correct_index`, `explanation`, timestamps. Public read for everyone; writes only through the privileged server path.
- New table `quiz_attempts`: `user_id`, `quiz_date`, `fact_id`, `selected_index`, `is_correct`, unique on (user_id, quiz_date). Row-level security scoped to the owner: users can read and insert only their own attempts, no updates (one attempt per day).
- Server functions in `src/lib/quiz.functions.ts`:
  - `getDailyQuiz` — public: resolves yesterday's daily pick, loads or generates its question, returns prompt/options (never the correct index) plus the fact slug/title.
  - `submitQuizAnswer` — authenticated (`requireSupabaseAuth`): grades server-side, records the attempt, returns correctness, correct index, and explanation.
  - `getQuizAttempt` — authenticated: today's attempt if one exists, so the answered state survives reloads.
  - Signed-out grading uses a public `gradeQuizAnswer` fn that returns the result without persisting; the client keeps it in `sessionStorage` for the day.
- Generation helper in `src/lib/quiz.server.ts`, mirroring `facts.server.ts`: Lovable AI Gateway, `openai/gpt-5.6-sol`, strict JSON schema, validated before insert (exactly 4 options, valid index).
- New `src/components/DailyQuizCard.tsx` using existing tokens (card, amber accent, serif prompt), rendered from `src/routes/index.tsx`; profile stats read from a small aggregate in `user.functions.ts`.
