/* Content linter. CI fails on any error.

     node tools/lint-content.mjs

   Beyond "every string has all three languages", it enforces the course's
   central promise: a chapter only uses terms that have already been
   taught — in an earlier chapter, or earlier in the same chapter. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { termIds, chapterIds } from '../js/markup.js';

const LANGS = ['zh', 'en', 'ms'];
const isTri = v => v && typeof v === 'object' && !Array.isArray(v) && LANGS.some(l => l in v);

function walkStrings(v, fn, path = '') {
  if (typeof v === 'string') return fn(v, path);
  if (Array.isArray(v)) return v.forEach((x, i) => walkStrings(x, fn, `${path}[${i}]`));
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkStrings(x, fn, path ? `${path}.${k}` : k);
}

function checkTri(v, where, errors, path = '') {
  if (isTri(v)) {
    for (const l of LANGS) if (typeof v[l] !== 'string' || !v[l].trim()) errors.push(`${where} ${path}: missing ${l}`);
    return;
  }
  if (Array.isArray(v)) v.forEach((x, i) => checkTri(x, where, errors, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) checkTri(x, where, errors, path ? `${path}.${k}` : k);
}

// Colour tokens the charts may use: every custom property in the app's stylesheets.
const CSS_DIR = fileURLToPath(new URL('../css/', import.meta.url));
const COLOUR_TOKENS = new Set(readdirSync(CSS_DIR).filter(f => f.endsWith('.css'))
  .flatMap(f => [...readFileSync(join(CSS_DIR, f), 'utf8').matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1])));

export function lint(root) {
  const errors = [];
  const read = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
  const opt = (f, d) => (existsSync(join(root, 'data', f)) ? read(f) : d);
  const index = read('index.json');
  const terms = opt('terms.json', []);
  const sources = new Set(opt('sources.json', []).map(s => s.id));
  const quiz = opt('quiz.json', []);
  const datasets = opt('datasets.json', []);
  const datasetIds = new Set(datasets.map(d => d.id));
  const termChapter = new Map(terms.map(t => [t.id, t.chapter]));
  const cid = n => `ch${String(n).padStart(2, '0')}`;
  const stats = { chapters: 0, blocks: 0, terms: terms.length, quiz: quiz.length };

  checkTri(index, 'index.json', errors);
  checkTri(terms, 'terms.json', errors);
  checkTri(quiz, 'quiz.json', errors);
  checkTri(datasets, 'datasets.json', errors);
  if (existsSync(join(root, 'data', 'releases.json'))) checkTri(read('releases.json'), 'releases.json', errors);
  for (const f of ['hormones.json', 'essays.json']) if (existsSync(join(root, 'data', f))) checkTri(read(f), f, errors);

  const defined = new Map();      // term → number of defining blocks
  const chapters = [];
  const chapterSet = new Set(index.chapters.map(m => m.id));   // links may point at chapters not yet written
  for (const meta of index.chapters.filter(m => m.ready !== false)) {
    const file = join(root, 'data', `${meta.id}.json`);
    if (!existsSync(file)) { errors.push(`${meta.id}: listed in index.json but ${meta.id}.json is missing`); continue; }
    chapters.push(JSON.parse(readFileSync(file, 'utf8')));
  }

  for (const ch of chapters) {
    stats.chapters++;
    checkTri(ch, ch.id, errors);
    for (const s of ch.sources ?? []) if (!sources.has(s)) errors.push(`${ch.id}: unknown source "${s}"`);
    const own = terms.filter(t => t.chapter === ch.num).map(t => t.id).sort();
    if (JSON.stringify([...(ch.newTerms ?? [])].sort()) !== JSON.stringify(own)) {
      errors.push(`${ch.id} newTerms ${JSON.stringify(ch.newTerms ?? [])} should be ${JSON.stringify(own)}`);
    }
    const seenHere = new Set();   // terms whose defining block has been passed in this chapter
    let bi = 0;
    for (const sec of ch.sections ?? []) for (const b of sec.blocks ?? []) {
      bi++; stats.blocks++;
      const at = `${ch.id} §${sec.id} block ${bi}`;
      for (const d of b.defines ?? []) {
        defined.set(d, (defined.get(d) ?? 0) + 1);
        if (termChapter.has(d) && termChapter.get(d) !== ch.num) errors.push(`${at}: defines "${d}" but terms.json puts it in ${cid(termChapter.get(d))}`);
      }
      const uses = new Set();
      walkStrings(b, s => termIds(s).forEach(id => uses.add(id)));
      walkStrings(b, s => chapterIds(s).forEach(id => { if (!chapterSet.has(id)) errors.push(`${at}: unknown chapter "${id}"`); }));
      for (const id of uses) {
        if (!termChapter.has(id)) { errors.push(`${at}: unknown term "${id}"`); continue; }
        const tc = termChapter.get(id);
        if (tc > ch.num) errors.push(`${ch.id} uses "${id}" defined in ${cid(tc)} (${at})`);
        else if (tc === ch.num && !seenHere.has(id) && !(b.defines ?? []).includes(id)) errors.push(`${ch.id} uses "${id}" before its defining paragraph (${at})`);
      }
      for (const d of b.defines ?? []) seenHere.add(d);

      for (const s of b.src ?? []) if (!sources.has(s.split(':')[0])) errors.push(`${at}: unknown source "${s}"`);
      // Every piece of teaching text says where it comes from.
      if (['p', 'list', 'table', 'note', 'keyval'].includes(b.type) && !(b.src ?? []).length) errors.push(`${at}: ${b.type} block has no src`);
      if (b.type === 'table') (b.rows ?? []).forEach((r, i) => {
        if (r.length !== b.headers.length) errors.push(`${ch.id} table row ${i + 1} has ${r.length} cells, header has ${b.headers.length} (${at})`);
      });
      if (b.type === 'chart' && b.chart?.series_file && !existsSync(join(root, 'data', 'series', `${b.chart.series_file}.json`))) errors.push(`${at}: chart series_file ${b.chart.series_file} not found`);
      if (b.type === 'chart') for (const s of b.chart?.series ?? []) if (s.color && !COLOUR_TOKENS.has(s.color)) errors.push(`${at}: chart colour "${s.color}" is not a CSS token`);
      if (b.type === 'chart') for (const s of b.chart?.series ?? []) if (s.values && s.values.length !== (b.chart.x?.categories ?? []).length) errors.push(`${at}: chart series length mismatch`);
      if (b.type === 'figure' && !existsSync(join(root, b.src))) errors.push(`${at}: figure ${b.src} not found`);
      if ((b.type === 'widget' || b.type === 'map') && !existsSync(join(root, 'js', 'widgets', `${String(b.id).toLowerCase()}.js`))) errors.push(`${at}: ${b.type} ${b.id} has no module`);
      if (b.type === 'dataset' && !datasetIds.has(b.id)) errors.push(`${at}: unknown dataset "${b.id}"`);
    }
  }
  for (const t of terms) {
    const n = defined.get(t.id) ?? 0;
    if (n === 0 && chapters.some(c => c.num === t.chapter)) errors.push(`"${t.id}" is never defined (expected in ${cid(t.chapter)})`);
    if (n > 1) errors.push(`"${t.id}" is defined ${n} times`);
  }

  quiz.forEach((q, i) => {
    if (q.options?.length !== 4) errors.push(`quiz ${i + 1} (${q.chapter}): needs exactly 4 options`);
    if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)) errors.push(`quiz ${i + 1} (${q.chapter}): answer must be 0–3`);
  });
  for (const ch of chapters) if (!quiz.some(q => q.chapter === ch.id)) errors.push(`${ch.id} has no quiz question`);

  const seriesDir = join(root, 'data', 'series');
  if (existsSync(seriesDir)) for (const f of readdirSync(seriesDir)) {
    const s = JSON.parse(readFileSync(join(seriesDir, f), 'utf8'));
    if (!s.source) errors.push(`data/series/${f}: no source`);
  }
  return { errors, stats };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, stats } = lint(join(fileURLToPath(new URL('..', import.meta.url))));
  for (const e of errors) console.error(`✗ ${e}`);
  console.log(`${stats.chapters} chapters, ${stats.blocks} blocks, ${stats.terms} terms, ${stats.quiz} questions — ${errors.length} error(s)`);
  process.exit(errors.length ? 1 : 0);
}
