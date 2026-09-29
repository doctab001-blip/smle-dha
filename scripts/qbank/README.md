# GulfMed QBank — question pipeline

Offline tools that grow the question bank. They run on your Mac, not on Vercel, and
write into the **existing** Supabase schema (`supabase/migrations/`). New questions always
arrive as **drafts** (`is_published = false`); students see nothing until you publish.

```
1-extract.mjs   PDFs in ~/Desktop/SCFHS/Books IM  →  out/topic_coverage.json
2-generate.mjs  blueprint + coverage + Claude API →  out/qbank_seed.json
3-seed.mjs      out/qbank_seed.json               →  Supabase (drafts)
```

## How the PDFs are used
The reference books are copyrighted, and most are question banks themselves. The pipeline
therefore uses them **only to measure how often each blueprint concept is tested**. No book
text is stored or sent to the model. Every question is written from scratch against current
guidelines, the same way Batch 01 was.

## Blueprint
`blueprint.mjs` sets 200 questions per subject (Internal Medicine, Pediatrics, OBGYN, General
Surgery, Preventive Medicine & Ethics, Psychiatry), split by chapter, with the concepts to
cover. Edit the counts or concepts freely; each subject must still add up to 200.

## Run it

```bash
cd ~/Desktop/SCFHS/smle-dha && git pull
cd scripts/qbank && npm install

# 1. topic coverage from your PDFs (about 1 minute)
npm run extract

# 2. generate — try one subject first and review it
export ANTHROPIC_API_KEY=sk-ant-...        # from console.anthropic.com
SUBJECTS="Pediatrics" npm run generate     # resumable: re-run to continue after any stop
npm run generate                           # then all subjects (about 1,200 questions)

# 3. load as drafts — either with your service-role key (Supabase → Settings → API keys)…
SUPABASE_SERVICE_ROLE_KEY=... npm run seed
# …or without it, as SQL to paste into the SQL editor (one subject at a time):
SUBJECTS="Pediatrics" npm run seed -- --sql     # → out/seed.sql
```

Useful switches: `DRY_RUN=1` (show the prompt or plan without doing anything),
`QBANK_MODEL` (default `claude-sonnet-5-5`), `BATCH_SIZE` (default 8), `CONCURRENCY` (default 3).

**Cost:** about 1,200 questions at roughly 1,500 output tokens each is around 2M output
tokens. Check current pricing at https://www.anthropic.com/pricing before a full run; a
one-subject pilot costs about a sixth of that.

## Quality gates built in
- Schema validation: exactly 4 options, rationales for exactly the 3 wrong options, a lead-in question, a minimum length, no "all/none of the above", and a known regional tag. Failing questions are discarded and regenerated.
- Near-duplicate vignettes are dropped across the whole subject.
- The answer key is rebalanced so each subject has about 25% each of A, B, C and D. Numeric option lists keep their order.
- Every question is loaded unpublished, **so a clinician must review before publishing**.

## Review and publish
Review in `out/qbank_seed.json` or in Supabase (Table editor → `questions`, filter
`is_published = false`). Delete anything you reject, then publish by subject:

```sql
-- publish a reviewed subject (and the high-yield notes its questions use)
update public.high_yield_notes n set is_published = true
where not n.is_published
  and exists (select 1 from public.questions q where q.note_id = n.id and q.subject_category = 'pediatrics');

update public.questions set is_published = true
where not is_published and subject_category = 'pediatrics';

-- reject one question
delete from public.questions where id = '<question id>';
```

Subject slugs: `internal-medicine`, `pediatrics`, `obgyn`, `general-surgery`, `preventive-ethics`, `psychiatry`.
