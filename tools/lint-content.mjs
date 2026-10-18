/* Content linter. CI fails on any error.

     node tools/lint-content.mjs

   Checks what tools/google/convert.py produced, and what was added by hand:
   every text has English and Chinese, every Key takeaway has its Chinese
   translation, inline HTML uses only the whitelisted tags, every figure,
   widget, lesson link and glossary term it points to exists. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = new Set(['p', 'h', 'list', 'table', 'note', 'figure', 'quiz', 'more', 'code', 'video', 'frame', 'link', 'gquiz', 'widget']);
// Tags convert.py may emit, plus what KaTeX's HTML output uses.
const TAGS = new Set(['b', 'i', 'code', 'sub', 'sup', 'br', 'a', 'button', 'ul', 'ol', 'li', 'img', 'span', 'svg', 'path', 'line']);
// Text that is legitimately empty in both languages (an image with no alt).
const MAY_BE_EMPTY = /(^|\.)(alt|caption|title|why)$|rows\[\d+\]\[\d+\]$|headers\[\d+\]$/;

const isBi = v => v && typeof v === 'object' && !Array.isArray(v) && ('en' in v || 'zh' in v) && Object.keys(v).every(k => k === 'en' || k === 'zh')
  && Object.values(v).every(x => typeof x === 'string' || x == null);

export function lint(root) {
  const errors = [], warnings = [];
  const read = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
  const index = read('index.json');
  const terms = new Set(read('terms.json').map(t => t.id));
  const lessons = new Set();
  const chapters = index.chapters.map(c => {
    const ch = read(`${c.id}.json`);
    for (const s of ch.sections) lessons.add(`${ch.id}/${s.id}`);
    return ch;
  });

  const checkHtml = (html, where) => {
    for (const m of String(html).matchAll(/<\/?([a-z0-9]+)/gi)) if (!TAGS.has(m[1].toLowerCase())) errors.push(`${where}: tag <${m[1]}> not allowed`);
    for (const m of String(html).matchAll(/href="#\/ch\/([^"]+)"/g)) if (!lessons.has(m[1].replace(/#.*/, ''))) errors.push(`${where}: link to missing lesson ${m[1]}`);
    for (const m of String(html).matchAll(/data-term="([^"]+)"/g)) if (!terms.has(m[1])) warnings.push(`${where}: term ${m[1]} not in the glossary`);
    if (/(^|[^\\\w])\$[^$\s][^$]*\$/.test(String(html).replace(/<[^>]+>/g, ''))) warnings.push(`${where}: possible unrendered maths`);
  };
  const walk = (v, where, path = '') => {
    if (isBi(v)) {
      for (const l of ['en', 'zh']) {
        if (typeof v[l] !== 'string') { errors.push(`${where} ${path}: missing ${l}`); continue; }
        if (!v[l].trim() && !MAY_BE_EMPTY.test(path)) errors.push(`${where} ${path}: empty ${l}`);
        checkHtml(v[l], `${where} ${path}`);
      }
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, where, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, where, path ? `${path}.${k}` : k);
  };

  walk(index, 'index');
  for (const ch of chapters) {
    walk(ch.title, ch.id, 'title');
    const ids = new Set();
    for (const s of ch.sections) {
      const where = `${ch.id}/${s.id}`;
      if (ids.has(s.id)) errors.push(`${where}: duplicate lesson id`);
      ids.add(s.id);
      walk(s.heading, where, 'heading');
      s.takeaways.forEach((t, i) => {
        if (!t.en) errors.push(`${where}: takeaway ${i} has no English`);
        if (!t.zh) errors.push(`${where}: takeaway ${i} has no Chinese translation (tools/google/takeaways-zh.json)`);
      });
      const blocks = (list, base) => list.forEach((b, i) => {
        const at = `${where} ${base}${i}`;
        if (!TYPES.has(b.type)) errors.push(`${at}: unknown block type ${b.type}`);
        if (b.type === 'figure') for (const src of typeof b.src === 'string' ? [b.src] : Object.values(b.src)) if (!existsSync(join(root, src))) errors.push(`${at}: missing image ${src}`);
        if (b.type === 'widget' && !existsSync(join(root, 'js', 'widgets', `${b.id}.js`))) errors.push(`${at}: missing widget ${b.id}`);
        if (b.type === 'quiz' && !b.open && b.options.filter(o => o.correct).length < 1) errors.push(`${at}: quiz without a correct option`);
        if (b.type === 'more') blocks(b.blocks, `${base}${i}.`);
        const { blocks: _, ...rest } = b;
        walk(rest, at);
      });
      blocks(s.blocks, '#');
    }
  }
  for (const r of read('releases.json')) for (const n of r.notes) for (const l of ['en', 'zh']) if (!n[l]) errors.push(`releases ${r.v}: missing ${l}`);
  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = lint(join(fileURLToPath(import.meta.url), '..', '..'));
  if (warnings.length) console.log(`${warnings.length} warning(s), e.g.\n  ${warnings.slice(0, 8).join('\n  ')}`);
  if (errors.length) { console.error(`${errors.length} error(s):\n  ${errors.slice(0, 40).join('\n  ')}`); process.exit(1); }
  console.log('content OK');
}
