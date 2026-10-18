/* The glossary (Google's Machine Learning Glossary): lookups and the term
   sheet that opens when a term is tapped. */

import { pick, t } from './i18n.js';
import { el, loadData } from './content.js';

let byId = null;

export async function loadTerms() {
  if (!byId) byId = new Map((await loadData('terms')).map(x => [x.id, x]));
  return byId;
}

export const termById = id => byId?.get(id);

export const glossaryUrl = (id, lang) => `https://developers.google.com/machine-learning/glossary${lang === 'zh' ? '?hl=zh-cn' : ''}#${id}`;

// Bottom sheet with Google's definition. Terms inside the definition open
// their own sheet in place.
export function openTermSheet(id, { lang, openSheet }) {
  const term = termById(id);
  if (!term) return;
  const other = lang === 'zh' ? 'en' : 'zh';
  const alt = pick(term.name, other);
  openSheet(el('div', { class: 'term-sheet' },
    el('p', { class: 'term-sheet-kicker' }, t('glossary', null, lang)),
    el('h3', {}, pick(term.name, lang), alt && alt !== pick(term.name, lang) ? el('span', { class: 'abbr' }, ` · ${alt}`) : null),
    ...(term.def[lang] || term.def.en).map(p => el('p', { html: p })),
    el('p', { class: 'muted' }, el('a', { href: glossaryUrl(id, lang), target: '_blank', rel: 'noopener' }, `${t('source', null, lang)}: Google ML Glossary ↗`))));
}
