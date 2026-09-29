// Phase 2 — push out/qbank_seed.json into the EXISTING GulfMed Supabase schema
// (subjects → topics → high_yield_notes → questions → question_tags).
//
// Everything is inserted as a DRAFT (is_published = false): nothing reaches students
// until you review and publish. Re-running is safe — questions whose text already
// exists are skipped, and existing notes/topics are reused, never overwritten.
//
// Two ways to run:
//   A) Direct (recommended):
//        SUPABASE_SERVICE_ROLE_KEY=... node 3-seed.mjs
//      The service-role key bypasses RLS — keep it on your machine, never commit it.
//   B) No key: write SQL to paste into the Supabase SQL editor:
//        node 3-seed.mjs --sql            → out/seed.sql
//      (For large seeds, do one subject at a time: SUBJECTS="Pediatrics" node 3-seed.mjs --sql)
//
// Env: SUPABASE_URL (defaults to the GulfMed project), SEED_FILE (default out/qbank_seed.json),
//      SUBJECTS (optional comma list), DRY_RUN=1 (plan only, no writes).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBJECT_SLUGS } from './blueprint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = process.env.SEED_FILE || path.join(here, 'out', 'qbank_seed.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vviurciclwmhdrwqnlfq.supabase.co';
const ONLY = (process.env.SUBJECTS || '').split(',').map((s) => s.trim()).filter(Boolean);

const TAG_SLUGS = {
  'Sickle Cell Disease': ['sickle-cell-disease'],
  Thalassaemia: ['thalassaemia'],
  'G6PD Deficiency': ['g6pd-deficiency'],
  Consanguinity: ['consanguinity'],
  'MERS-CoV': ['mers-cov'],
  'Ramadan Management': ['ramadan-fasting'],
  'Hajj / Heat Illness': ['hajj-umrah', 'heat-illness'],
  'Heat & Dehydration': ['heat-illness'],
  Brucellosis: ['brucellosis'],
  'Behçet Disease (Middle East)': ['behcet-disease'],
  'Islamic Medical Ethics': ['islamic-medical-ethics'],
  None: [],
};
const NEW_TAGS = [
  { slug: 'heat-illness', label: 'Heat illness & dehydration (Gulf climate)' },
  { slug: 'behcet-disease', label: 'Behçet disease (Middle East / Silk Road)' },
];

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- pure planning step
export function planSeed(seed) {
  const topics = new Map(); // key subject|chapterSlug
  const notes = new Map();  // key noteSlug
  const questions = [];
  for (const q of seed) {
    const subject_slug = SUBJECT_SLUGS[q.subject];
    if (!subject_slug) throw new Error(`Unknown subject "${q.subject}"`);
    const [chapter, concept = chapter] = q.topic.split(/\s+-\s+/, 2).map((s) => s.trim());
    const topic_slug = slugify(chapter);
    topics.set(`${subject_slug}|${topic_slug}`, { subject_slug, slug: topic_slug, title: chapter });

    const note_slug = slugify(concept);
    const title = concept.charAt(0).toUpperCase() + concept.slice(1);
    if (!notes.has(note_slug)) notes.set(note_slug, { subject_slug, topic_slug, slug: note_slug, title, points: [] });
    const n = notes.get(note_slug);
    if (!n.points.includes(q.high_yield_note)) n.points.push(q.high_yield_note);

    const m = q.vignette.match(/^([\s\S]*[.)])\s+([^.]*\?)\s*$/);
    questions.push({
      subject_slug, topic_slug, note_slug,
      text: m ? m[1] : q.vignette,
      lead_in: m ? m[2] : null,
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: q.options[k] })),
      correct: q.correct_option,
      explanation: q.explanation_correct,
      option_expl: q.explanation_distractors,
      tags: TAG_SLUGS[q.regional_tag] ?? [],
    });
  }
  const noteRows = [...notes.values()].map(({ points, ...n }) => ({
    ...n,
    body: `## ${n.title}\n\n${points.length === 1 ? points[0] : points.map((p) => `- ${p}`).join('\n')}`,
  }));
  return { topics: [...topics.values()], notes: noteRows, questions };
}

// ---------------------------------------------------------------- mode B: SQL
function toSql(plan) {
  const data = JSON.stringify(plan);
  if (data.includes('$seed$')) throw new Error('data contains the SQL dollar-quote delimiter');
  return `-- GulfMed QBank seed — loads questions as DRAFTS (unpublished). Safe to re-run.
insert into public.tags (slug, label) values
${NEW_TAGS.map((t) => `  ('${t.slug}', '${t.label.replace(/'/g, "''")}')`).join(',\n')}
on conflict (slug) do nothing;

create temporary table _plan as select $seed$${data}$seed$::jsonb as j;

insert into public.topics (subject_id, slug, title, sort_order)
select s.id, t->>'slug', t->>'title', 50
from _plan, jsonb_array_elements(j->'topics') t join public.subjects s on s.slug = t->>'subject_slug'
on conflict (subject_id, slug) do nothing;

insert into public.high_yield_notes (topic_id, slug, title, body_md, is_published)
select tp.id, n->>'slug', n->>'title', n->>'body', false
from _plan, jsonb_array_elements(j->'notes') n
join public.subjects s on s.slug = n->>'subject_slug'
join public.topics tp on tp.subject_id = s.id and tp.slug = n->>'topic_slug'
on conflict (slug) do nothing;

insert into public.questions (subject_category, topic_id, note_id, text, lead_in, options, correct_answer,
  explanation, option_explanations, exam_targets, difficulty, is_published)
select q->>'subject_slug', tp.id, hn.id, q->>'text', q->>'lead_in', q->'options', q->>'correct',
  q->>'explanation', q->'option_expl', '{smle,dha,doh,mohap}'::public.exam_target[], 'medium', false
from _plan, jsonb_array_elements(j->'questions') q
join public.subjects s on s.slug = q->>'subject_slug'
join public.topics tp on tp.subject_id = s.id and tp.slug = q->>'topic_slug'
join public.high_yield_notes hn on hn.slug = q->>'note_slug'
where not exists (select 1 from public.questions x where x.text = q->>'text');

insert into public.question_tags (question_id, tag_id)
select x.id, tg.id
from _plan, jsonb_array_elements(j->'questions') q
join public.questions x on x.text = q->>'text'
cross join lateral jsonb_array_elements_text(q->'tags') ts
join public.tags tg on tg.slug = ts
on conflict do nothing;

drop table _plan;

select (select count(*) from public.questions where not is_published) as draft_questions,
       (select count(*) from public.questions) as total_questions;
`;
}

// ---------------------------------------------------------------- mode A: direct
async function pushDirect(plan) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY, or run with --sql to produce a SQL file instead.');
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
  const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };
  const selectAll = async (table, cols) => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await db.from(table).select(cols).range(from, from + 999), `read ${table}`);
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  };
  const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  must(await db.from('tags').upsert(NEW_TAGS, { onConflict: 'slug', ignoreDuplicates: true }), 'tags');
  const subjects = Object.fromEntries((await selectAll('subjects', 'id, slug')).map((s) => [s.slug, s.id]));

  must(await db.from('topics').upsert(
    plan.topics.map((t) => ({ subject_id: subjects[t.subject_slug], slug: t.slug, title: t.title, sort_order: 50 })),
    { onConflict: 'subject_id,slug', ignoreDuplicates: true }), 'topics');
  const topics = Object.fromEntries((await selectAll('topics', 'id, subject_id, slug')).map((t) => [`${t.subject_id}|${t.slug}`, t.id]));
  const topicId = (subj, slug) => topics[`${subjects[subj]}|${slug}`];

  for (const c of chunks(plan.notes, 200)) {
    must(await db.from('high_yield_notes').upsert(
      c.map((n) => ({ topic_id: topicId(n.subject_slug, n.topic_slug), slug: n.slug, title: n.title, body_md: n.body, is_published: false })),
      { onConflict: 'slug', ignoreDuplicates: true }), 'notes');
  }
  const notes = Object.fromEntries((await selectAll('high_yield_notes', 'id, slug')).map((n) => [n.slug, n.id]));
  const tags = Object.fromEntries((await selectAll('tags', 'id, slug')).map((t) => [t.slug, t.id]));
  const existing = new Set((await selectAll('questions', 'text')).map((q) => q.text));

  const fresh = plan.questions.filter((q) => !existing.has(q.text));
  let inserted = 0;
  for (const c of chunks(fresh, 100)) {
    const rows = must(await db.from('questions').insert(c.map((q) => ({
      subject_category: q.subject_slug, topic_id: topicId(q.subject_slug, q.topic_slug), note_id: notes[q.note_slug],
      text: q.text, lead_in: q.lead_in, options: q.options, correct_answer: q.correct, explanation: q.explanation,
      option_explanations: q.option_expl, exam_targets: ['smle', 'dha', 'doh', 'mohap'], difficulty: 'medium', is_published: false,
    }))).select('id, text'), 'questions');
    const byText = Object.fromEntries(rows.map((r) => [r.text, r.id]));
    const qt = c.flatMap((q) => q.tags.filter((t) => tags[t]).map((t) => ({ question_id: byText[q.text], tag_id: tags[t] })));
    if (qt.length) must(await db.from('question_tags').upsert(qt, { onConflict: 'question_id,tag_id', ignoreDuplicates: true }), 'question tags');
    inserted += rows.length;
    process.stdout.write(`\r  inserted ${inserted}/${fresh.length}`);
  }
  console.log(`\nDone: ${inserted} new draft questions (${plan.questions.length - fresh.length} already existed).`);
}

async function main() {
  let seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
  if (ONLY.length) seed = seed.filter((q) => ONLY.includes(q.subject));
  const plan = planSeed(seed);
  console.log(`Plan: ${plan.questions.length} questions · ${plan.notes.length} high-yield notes · ${plan.topics.length} topics`);
  if (process.env.DRY_RUN) return;
  if (process.argv.includes('--sql')) {
    const out = path.join(here, 'out', 'seed.sql');
    await fs.writeFile(out, toSql(plan));
    console.log(`Wrote ${path.relative(process.cwd(), out)} — paste into the Supabase SQL editor and run.`);
  } else {
    await pushDirect(plan);
  }
  console.log('Questions are drafts. After review, publish with the SQL in README.md.');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message || e); process.exit(1); });
