# Daily Curiosity — a mobile-first daily facts app

A phone-shaped web app that serves one new "how it works / what it means" explainer every day. Topics rotate so users build broad general knowledge over time.

## The daily experience

- **Today card** — the day's topic (e.g. "How a car door window works", "What a credit score means"), shown as an explainer: a one-line hook, a short intro, then 3-4 numbered steps that break down the mechanism, plus a "wait, really?" surprising detail and a category tag.
- **Swipe/scroll flow** — full-screen card, tap to expand steps, save to favorites, share.
- **Archive** — browse past days; anything before today is unlocked, tomorrow stays sealed with a countdown.
- **Streak** — consecutive days opened, shown as a small flame counter on the header.
- **Favorites** — saved explainers in one list.
- **Categories** — Everyday Objects, Vehicles, Money, Space, Body, Technology, Nature, Society. The daily picker avoids repeating a category two days in a row.

## Content: curated seed + AI top-up

- I seed the library with ~60 handwritten explainers spanning all categories, inserted directly in the database migration so day one is fully stocked.
- A daily job picks one unused topic, marks it as that date's fact, and everyone sees the same one.
- When fewer than 15 unused explainers remain, Lovable AI generates a new batch in the same explainer format (hook, intro, steps, surprising detail, category), avoiding titles already in the library. Generated items are stored like curated ones.

## Accounts

Email/password plus Google sign-in. Signing in syncs streak, favorites, and read history across devices. Browsing today's fact and the archive works without an account; saving and streaks prompt sign-in.

## Look and feel

Mobile-first, dark editorial: deep ink background, warm amber accent, large serif headline for the topic and clean sans for the body. Cards feel like a page turn rather than a social feed. Full-width tap targets, bottom tab bar (Today / Archive / Saved / Profile).

## Technical notes

- Lovable Cloud for database, auth, and scheduled work.
- Tables: `facts` (title, question_type, category, hook, intro, steps JSONB, surprising_detail, source: curated|ai, used_on date), `daily_picks` (date -> fact), `profiles` (display name, streak count, last seen date), `favorites` (user + fact). RLS on all: facts and daily picks readable publicly; favorites and profiles scoped to the owner.
- Server functions handle the daily pick, streak update, favorite toggle. AI top-up runs through Lovable AI with structured output validated before insert.
- Routes: `/` (today), `/archive`, `/fact/$id`, `/saved`, `/profile`, `/auth` — each with its own SEO metadata so individual explainers are shareable.
- Native install (add to home screen) is not included unless you want it later.
