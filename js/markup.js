/* Inline markup inside content strings.

   {{t:dew-point}}         a tappable glossary term, shown by its name
   {{t:lcl|cloud base}}    the same, with different visible words
   {{ch:ch09|Chapter 9}}   a link to another chapter

   Pure: the renderer and the content linter both use it. */

const RE = /\{\{(t|ch):([a-z0-9-]+)(?:\|([^}]*))?\}\}/g;

export function parseInline(str) {
  const out = [];
  let last = 0;
  for (const m of String(str ?? '').matchAll(RE)) {
    if (m.index > last) out.push({ text: str.slice(last, m.index) });
    if (m[1] === 'ch') out.push({ chapter: m[2], label: m[3] ?? m[2] });
    else out.push(m[3] === undefined ? { term: m[2] } : { term: m[2], label: m[3] });
    last = m.index + m[0].length;
  }
  if (last < String(str ?? '').length) out.push({ text: str.slice(last) });
  return out;
}

export function termIds(str) {
  return [...String(str ?? '').matchAll(RE)].filter(m => m[1] === 't').map(m => m[2]);
}

export function chapterIds(str) {
  return [...String(str ?? '').matchAll(RE)].filter(m => m[1] === 'ch').map(m => m[2]);
}
