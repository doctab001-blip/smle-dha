# GulfMed QBank — SMLE & DHA exam preparation

Question bank, timed mock exams (SMLE 200 / DHA 150), high-yield notes, spaced-repetition revision and performance analytics for MBBS graduates preparing for Saudi (SCFHS) and UAE (DHA / DOH / MOHAP) licensing exams.

**Live:** https://smle-dha-qbank.vercel.app

## Stack
- Next.js 15 (App Router, JavaScript) on Vercel
- Supabase — Postgres, Auth, Row Level Security

## Local development
```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev
```

## Database
- `supabase/migrations/20260929000000_init.sql` — full schema, RLS and RPCs
- `supabase/seed.sql` — 4 demo questions + notes

Correct answers and explanations are never readable directly by the browser; they are returned only by
the `answer_question`, `submit_session` and `get_session_review` functions. Always list columns when
selecting from `questions` (`select('*')` is denied by design).

## Deploys
Pushes to `main` deploy to production on Vercel.
