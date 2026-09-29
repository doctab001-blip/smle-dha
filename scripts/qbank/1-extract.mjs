// Phase 1a — ingest the reference PDFs and measure topic coverage.
//
// Reads every PDF in PDF_DIR (default: ../../../Books IM, i.e. ~/Desktop/SCFHS/Books IM
// when this repo is cloned into ~/Desktop/SCFHS/smle-dha), extracts the text with
// pdf-parse, and counts how often each blueprint concept appears.
//
// Output: out/topic_coverage.json — concept frequencies only. No book text is stored
// or sent anywhere: the source books are copyrighted question banks, so the generator
// uses them purely to decide WHICH concepts to emphasise, never as text to rewrite.
//
// Usage:  node 1-extract.mjs            (PDF_DIR=/path/to/pdfs node 1-extract.mjs)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import { BLUEPRINT, checkBlueprint } from './blueprint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = process.env.PDF_DIR || path.resolve(here, '../../../Books IM');
const OUT = path.join(here, 'out');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// tolerant matcher: case-insensitive, British/American spelling, hyphen/space variants
function conceptRegex(concept) {
  let p = escapeRe(concept.toLowerCase())
    .replace(/ae/g, 'a?e')          // haemoglobin/hemoglobin, anaemia/anemia
    .replace(/oe/g, 'o?e')          // oesophageal/esophageal
    .replace(/our\b/g, 'o?u?r')     // tumour/tumor
    .replace(/is(e|ing|ation)/g, 'i[sz]$1')
    .replace(/\\-| /g, '[\\s-]?');
  return new RegExp(`\\b${p}`, 'gi');
}

async function extractPdf(file) {
  const data = await fs.readFile(file);
  const parser = new PDFParse({ data });
  try {
    const res = await parser.getText();
    return res.text || '';
  } finally {
    await parser.destroy();
  }
}

async function main() {
  checkBlueprint();
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(PDF_DIR)).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  if (!files.length) throw new Error(`No PDFs found in ${PDF_DIR}`);

  const perBook = {};
  const totals = {};
  for (const f of files) {
    const t0 = Date.now();
    process.stdout.write(`Reading ${f} … `);
    let text = '';
    try {
      text = await extractPdf(path.join(PDF_DIR, f));
    } catch (e) {
      console.log(`skipped (${e.message})`);
      continue;
    }
    const counts = {};
    for (const s of BLUEPRINT) for (const t of s.topics) for (const c of t.concepts) {
      const n = (text.match(conceptRegex(c)) || []).length;
      if (n) { counts[c] = n; totals[c] = (totals[c] || 0) + n; }
    }
    perBook[f] = { characters: text.length, conceptsFound: Object.keys(counts).length };
    console.log(`${(text.length / 1e6).toFixed(1)}M chars, ${Object.keys(counts).length} concepts, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }

  // per-topic view: concepts ranked by frequency (unseen concepts keep weight 1 so they still appear)
  const topics = BLUEPRINT.flatMap((s) => s.topics.map((t) => ({
    subject: s.subject,
    chapter: t.chapter,
    count: t.count,
    concepts: t.concepts
      .map((c) => ({ concept: c, hits: totals[c] || 0 }))
      .sort((a, b) => b.hits - a.hits),
  })));

  const out = { generatedAt: new Date().toISOString(), pdfDir: PDF_DIR, books: perBook, topics };
  await fs.writeFile(path.join(OUT, 'topic_coverage.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote out/topic_coverage.json (${files.length} PDFs, ${Object.keys(totals).length} concepts found)`);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('Most-tested concepts:', top.map(([c, n]) => `${c} (${n})`).join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
