/* Search across both languages at once.

   A reader who types 梯度下降 or "gradient descent" finds the same lesson,
   and gets the result in the language they chose. Pure: built from module
   JSON and the glossary, no DOM. */

const LANGS = ['en', 'zh'];

export const normalise = str => String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function texts(value, lang, out = []) {
  if (Array.isArray(value)) value.forEach(v => texts(v, lang, out));
  else if (value && typeof value === 'object') {
    if (LANGS.some(l => typeof value[l] === 'string')) out.push(value[lang] ?? value.en ?? '');
    else for (const [k, v] of Object.entries(value)) if (!['src', 'href', 'alt'].includes(k)) texts(v, lang, out);
  }
  return out;
}

// For search, tags go and entities become characters (formulas keep their glyphs).
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
export const plain = str => String(str ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENT[e]).replace(/\s+/g, ' ').trim();

export function buildIndex(chapters, terms) {
  const entries = [];
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      const e = { route: `#/ch/${ch.id}/${sec.id}`, kind: 'section', title: {}, body: {} };
      for (const l of LANGS) {
        e.title[l] = `${ch.title[l]} · ${plain(sec.heading[l])}`;
        e.body[l] = plain([...sec.takeaways.map(x => x[l] ?? x.en), ...texts(sec.blocks, l)].join(' '));
      }
      entries.push(e);
    }
  }
  for (const t of terms) {
    const e = { route: `#/term/${t.id}`, kind: 'term', title: {}, body: {} };
    for (const l of LANGS) { e.title[l] = t.name[l]; e.body[l] = plain((t.def[l] || t.def.en)[0]); }
    entries.push(e);
  }
  for (const e of entries) e.hay = { title: normalise(LANGS.map(l => e.title[l]).join(' ')), body: normalise(LANGS.map(l => e.body[l]).join(' ')) };
  return entries;
}

function snippet(text, words, max = 120) {
  const low = text.toLowerCase();
  const at = Math.max(0, ...words.map(w => low.indexOf(w)).filter(i => i >= 0).slice(0, 1));
  const start = Math.max(0, at - 30);
  return (start ? '…' : '') + text.slice(start, start + max) + (start + max < text.length ? '…' : '');
}

export function search(index, query, lang, limit = 40) {
  const q = normalise(query);
  if (!q) return [];
  const words = q.split(' ');
  const hits = [];
  for (const e of index) {
    const inTitle = words.every(w => e.hay.title.includes(w));
    const inAll = words.every(w => e.hay.title.includes(w) || e.hay.body.includes(w));
    if (!inAll) continue;
    const score = (inTitle ? 10 : 0) + (e.kind === 'term' ? 2 : 0);
    hits.push({ route: e.route, kind: e.kind, title: e.title[lang], snippet: snippet(e.body[lang], words), score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
