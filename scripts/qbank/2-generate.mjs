// Phase 1b — generate original board-style MCQs with the Claude API → out/qbank_seed.json
//
// • Follows blueprint.mjs (200 questions per subject), weighting concepts by how often
//   they appear in your reference PDFs (out/topic_coverage.json from 1-extract.mjs).
// • Questions are written from scratch: only concept NAMES go into the prompt, never book text.
// • Resumable: progress is saved after every batch in out/progress.json — just re-run.
// • Every question is validated (4 options, 3 distractor rationales, lead-in, HY note…),
//   near-duplicates are dropped, and the answer key is rebalanced across A–D.
//
// Env:
//   ANTHROPIC_API_KEY   required (unless MOCK_RESPONSE_FILE is set)
//   QBANK_MODEL         default claude-sonnet-5-5
//   SUBJECTS            optional comma list, e.g. "Pediatrics,General Surgery"
//   BATCH_SIZE          questions per API call (default 8)
//   CONCURRENCY         parallel API calls (default 3)
//   DRY_RUN=1           print the first prompt and exit
//   MOCK_RESPONSE_FILE  testing: use a JSON array file instead of calling the API
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLUEPRINT, checkBlueprint } from './blueprint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
const PROGRESS = path.join(OUT, 'progress.json');
const SEED = path.join(OUT, 'qbank_seed.json');

const MODEL = process.env.QBANK_MODEL || 'claude-sonnet-5-5';
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 8);
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const ONLY = (process.env.SUBJECTS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const REGIONAL_TAGS = [
  'Sickle Cell Disease', 'Thalassaemia', 'G6PD Deficiency', 'Consanguinity', 'MERS-CoV',
  'Ramadan Management', 'Hajj / Heat Illness', 'Heat & Dehydration', 'Brucellosis',
  'Behçet Disease (Middle East)', 'Islamic Medical Ethics', 'None',
];
const KEYS = ['subject', 'topic', 'vignette', 'options', 'correct_option', 'explanation_correct', 'explanation_distractors', 'high_yield_note', 'regional_tag'];

// ---------------------------------------------------------------- prompt
const SYSTEM = `You are a senior medical educator who writes board-style questions for the Saudi Medical Licensing Exam (SMLE) and UAE licensing exams (DHA, DOH, MOHAP) at the level of a newly qualified MBBS general practitioner.
You write ORIGINAL questions from your own clinical knowledge and current guidelines. Never reproduce or paraphrase questions from any published question bank or textbook.
You are meticulous about clinical accuracy: every drug, dose, threshold and guideline statement must be correct and current. If a fact is contested between guidelines, say so in the explanation.`;

function buildPrompt({ subject, chapter, n, focus, covered }) {
  return `Write ${n} original single-best-answer MCQs.

Subject: ${subject}
Chapter: ${chapter}
Focus concepts for this batch (one question per line item, in order; repeated items need clearly different scenarios):
${focus.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${covered.length ? `Already covered in this chapter — do NOT repeat these scenarios:\n${covered.map((c) => `- ${c}`).join('\n')}\n` : ''}
Rules:
1. Vignette: authentic clinical case — age, sex, presenting complaint, relevant history, vitals, examination, and pertinent labs/imaging (SI units; add conventional units where Gulf labs commonly use them). The vignette ENDS with the question sentence (e.g. "What is the most appropriate next step in management?").
2. Test application: diagnosis, next best step, management, interpretation — not bare recall.
3. Exactly 4 options A, B, C, D — plausible, homogeneous, similar length. Never "all/none of the above".
4. explanation_correct: why the answer is right, citing the relevant current guideline (e.g. AHA/ACC, ESC, NICE, WHO, ADA, IDF-DAR, RCOG, ACOG, ATLS, Saudi MOH, Gulf Health Council).
5. explanation_distractors: an object with exactly the 3 wrong letters, each explaining specifically why that option is wrong in THIS patient.
6. high_yield_note: 2–3 sentences of core facts for rapid revision.
7. Where clinically natural, set the case in Saudi Arabia/UAE and include regional specifics (sickle cell, thalassaemia, G6PD, consanguinity, MERS-CoV, Hajj/heat illness, Ramadan fasting, brucellosis, Behçet, Islamic ethics). Do not force it.
8. regional_tag: one of ${REGIONAL_TAGS.map((t) => JSON.stringify(t)).join(', ')}.
9. topic: "${chapter} - <specific concept title>" (e.g. "${chapter} - ${focus[0]}").
10. Vary which letter is correct.
11. _meta: {"concept": "<focus concept used>", "scenario": "<one-line summary of the case, max 15 words>"}.

Return ONLY a JSON array, no prose, of objects with exactly these keys:
{"subject": "${subject}", "topic": "...", "vignette": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_option": "A|B|C|D", "explanation_correct": "...", "explanation_distractors": {"<wrong letter>": "...", "<wrong letter>": "...", "<wrong letter>": "..."}, "high_yield_note": "...", "regional_tag": "...", "_meta": {"concept": "...", "scenario": "..."}}`;
}

// ---------------------------------------------------------------- validation
export function validate(q, subject) {
  const errs = [];
  for (const k of KEYS) if (q[k] === undefined || q[k] === null || q[k] === '') errs.push(`missing ${k}`);
  if (errs.length) return errs;
  if (q.subject !== subject) errs.push('wrong subject');
  if (!/ - /.test(q.topic)) errs.push('topic must be "Chapter - Concept"');
  const opts = Object.keys(q.options || {}).sort().join('');
  if (opts !== 'ABCD') errs.push('options must be exactly A–D');
  if (!'ABCD'.includes(q.correct_option) || q.correct_option.length !== 1) errs.push('bad correct_option');
  const wrong = ['A', 'B', 'C', 'D'].filter((k) => k !== q.correct_option).join('');
  if (Object.keys(q.explanation_distractors || {}).sort().join('') !== wrong) errs.push('distractor rationales must cover exactly the 3 wrong options');
  if (!/\?\s*$/.test(q.vignette)) errs.push('vignette must end with the question');
  if (q.vignette.length < 250) errs.push('vignette too short');
  if (Object.values(q.options).some((o) => /\b(all|none) of the above\b/i.test(o))) errs.push('all/none of the above');
  if (new Set(Object.values(q.options).map((o) => o.trim().toLowerCase())).size !== 4) errs.push('duplicate options');
  if (q.explanation_correct.length < 150) errs.push('explanation too short');
  if (!REGIONAL_TAGS.includes(q.regional_tag)) errs.push(`unknown regional_tag ${q.regional_tag}`);
  return errs;
}

const wordCache = new Map();
const words = (s) => {
  if (!wordCache.has(s)) wordCache.set(s, new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)));
  return wordCache.get(s);
};
function similarity(a, b) {
  const A = words(a), B = words(b);
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

// ---------------------------------------------------------------- answer-key balancing
function mulberry32(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function rebalance(questions, seed = 42) {
  const rand = mulberry32(seed);
  const targets = questions.map((_, i) => 'ABCD'[i % 4]);
  for (let i = targets.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [targets[i], targets[j]] = [targets[j], targets[i]]; }
  return questions.map((q0, i) => {
    const q = structuredClone(q0);
    const numeric = Object.values(q.options).every((o) => /^[\d<>≤≥.]/.test(o.trim())); // keep ordered numeric options in place
    const c = q.correct_option, t = targets[i];
    if (numeric || c === t) return q;
    [q.options[c], q.options[t]] = [q.options[t], q.options[c]];
    q.explanation_distractors[c] = q.explanation_distractors[t];
    delete q.explanation_distractors[t];
    q.correct_option = t;
    q.options = Object.fromEntries(['A', 'B', 'C', 'D'].map((k) => [k, q.options[k]]));
    q.explanation_distractors = Object.fromEntries(['A', 'B', 'C', 'D'].filter((k) => k !== t).map((k) => [k, q.explanation_distractors[k]]));
    return q;
  });
}

// ---------------------------------------------------------------- focus selection
function pickFocus(topic, coverage, done, n) {
  const hits = Object.fromEntries((coverage?.concepts || []).map((c) => [c.concept, c.hits]));
  const used = {};
  for (const q of done) { const c = q._meta?.concept; if (c) used[c] = (used[c] || 0) + 1; }
  const out = [];
  for (let i = 0; i < n; i++) {
    // weight by sqrt(frequency in the reference books) so common topics dominate without drowning the rest
    const scored = topic.concepts.map((c) => ({ c, score: (used[c] || 0) / Math.sqrt((hits[c] || 0) + 1) }));
    scored.sort((a, b) => a.score - b.score || (hits[b.c] || 0) - (hits[a.c] || 0));
    const pick = scored[0].c;
    out.push(pick); used[pick] = (used[pick] || 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------- API
let client;
async function callModel(prompt) {
  if (process.env.MOCK_RESPONSE_FILE) return fs.readFile(process.env.MOCK_RESPONSE_FILE, 'utf8');
  if (!client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic({ maxRetries: 4 });
  }
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function parseArray(text) {
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('no JSON array in response');
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('response is not an array');
  return arr;
}

// ---------------------------------------------------------------- main
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
let saving = Promise.resolve();
function saveProgress(progress) {
  saving = saving.then(async () => {
    await fs.writeFile(PROGRESS + '.tmp', JSON.stringify(progress));
    await fs.rename(PROGRESS + '.tmp', PROGRESS);
  });
  return saving;
}

async function runTopic(subject, topic, coverage, progress, stats) {
  const key = `${subject} || ${topic.chapter}`;
  progress[key] ||= [];
  let failures = 0;
  while (progress[key].length < topic.count && failures < 5) {
    const done = progress[key];
    const n = Math.min(BATCH_SIZE, topic.count - done.length);
    const focus = pickFocus(topic, coverage, done, n);
    const covered = done.map((q) => `${q._meta?.concept}: ${q._meta?.scenario}`).slice(-40);
    const prompt = buildPrompt({ subject, chapter: topic.chapter, n, focus, covered });
    if (process.env.DRY_RUN) { console.log(`--- SYSTEM ---\n${SYSTEM}\n\n--- PROMPT ---\n${prompt}`); process.exit(0); }
    let arr;
    try {
      arr = parseArray(await callModel(prompt));
    } catch (e) {
      failures++; stats.apiErrors++;
      console.warn(`  ! ${topic.chapter}: ${e.message} (attempt ${failures}/5)`);
      continue;
    }
    let kept = 0;
    for (const q of arr) {
      if (done.length >= topic.count) break;
      const errs = validate(q, subject);
      if (errs.length) { stats.rejected++; continue; }
      // near-duplicate check across the whole subject, not just this chapter
      const sameSubject = Object.entries(progress).filter(([k]) => k.startsWith(`${subject} || `)).flatMap(([, v]) => v);
      if (sameSubject.some((d) => similarity(d.vignette, q.vignette) > 0.7)) { stats.duplicates++; continue; }
      done.push(q); kept++;
    }
    if (!kept) failures++;
    stats.kept += kept;
    await saveProgress(progress);
    console.log(`  ${subject} › ${topic.chapter}: ${done.length}/${topic.count}`);
    if (process.env.MOCK_RESPONSE_FILE && !kept) break;
  }
}

async function main() {
  checkBlueprint();
  if (!process.env.ANTHROPIC_API_KEY && !process.env.MOCK_RESPONSE_FILE && !process.env.DRY_RUN) {
    throw new Error('Set ANTHROPIC_API_KEY (see README).');
  }
  await fs.mkdir(OUT, { recursive: true });
  const coverage = await readJson(path.join(OUT, 'topic_coverage.json'), null);
  if (!coverage) console.warn('No out/topic_coverage.json — run 1-extract.mjs first for PDF-weighted concepts. Continuing with equal weights.');
  const progress = await readJson(PROGRESS, {});
  const stats = { kept: 0, rejected: 0, duplicates: 0, apiErrors: 0 };

  const jobs = [];
  for (const s of BLUEPRINT) {
    if (ONLY.length && !ONLY.includes(s.subject)) continue;
    for (const t of s.topics) {
      const cov = coverage?.topics.find((x) => x.subject === s.subject && x.chapter === t.chapter);
      jobs.push(() => runTopic(s.subject, t, cov, progress, stats));
    }
  }
  console.log(`Model ${MODEL} · ${jobs.length} chapters · batch ${BATCH_SIZE} · concurrency ${CONCURRENCY}`);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < jobs.length) await jobs[next++](); }));
  await saving;

  // assemble the seed: strip _meta, rebalance answer letters per subject, keep blueprint order
  const seed = [];
  for (const s of BLUEPRINT) {
    const qs = s.topics.flatMap((t) => progress[`${s.subject} || ${t.chapter}`] || []);
    const clean = qs.map(({ _meta, ...q }) => q);
    seed.push(...rebalance(clean, s.subject.length * 7919));
  }
  await fs.writeFile(SEED, JSON.stringify(seed, null, 2));

  console.log('\nSummary');
  for (const s of BLUEPRINT) {
    const n = seed.filter((q) => q.subject === s.subject).length;
    const dist = Object.fromEntries(['A', 'B', 'C', 'D'].map((k) => [k, seed.filter((q) => q.subject === s.subject && q.correct_option === k).length]));
    console.log(`  ${s.subject.padEnd(30)} ${String(n).padStart(4)}/200   key ${JSON.stringify(dist)}`);
  }
  console.log(`  kept ${stats.kept} · rejected ${stats.rejected} · duplicates ${stats.duplicates} · API/parse errors ${stats.apiErrors}`);
  console.log(`\nWrote ${path.relative(process.cwd(), SEED)} (${seed.length} questions). Review, then run: node 3-seed.mjs`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message || e); process.exit(1); });
