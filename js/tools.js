/* The study tools: glossary, flashcards and the quiz collection.
   Each export builds one page; app.js routes to them. */

import { pick, t } from './i18n.js';
import { el, loadData, loadChapter, quiz, quizzesOf } from './content.js';
import { cardsFor, scoreAnswers } from './quiz.js';
import { glossaryUrl } from './terms.js';
import * as prefs from './prefs.js';

const page = (title, ...kids) => el('div', { class: 'page page-tool' }, el('p', { class: 'kicker' }, el('a', { href: '#/tools' }, t('tools'))), el('h1', {}, title), ...kids);

export function toolsIndex(lang) {
  const row = (href, key, hint) => el('li', {}, el('a', { href }, el('span', { class: 'tool-name' }, t(key, null, lang)), hint ? el('span', { class: 'tool-hint' }, t(hint, null, lang)) : null));
  return el('div', { class: 'page' }, el('h1', {}, t('tools', null, lang)),
    el('ul', { class: 'tool-list' },
      row('#/tools/glossary', 'glossary', 'glossaryHint'),
      row('#/tools/cards', 'flashcards', 'flashHint'),
      row('#/tools/quiz', 'quiz', 'quizHint'),
      row('#/notes', 'notes'),
      row('#/share', 'share', 'shareHint')));
}

/* ---------- Glossary ---------- */
export async function glossary(lang, { onTerm }) {
  const terms = await loadData('terms');
  const sorted = [...terms].sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'));
  const list = el('ul', { class: 'gloss-list' }, sorted.map(x => el('li', { class: 'gloss-item', id: `term-${x.id}` },
    el('button', { type: 'button', class: 'gloss-head', onclick: () => onTerm(x.id) },
      el('span', { class: 'gloss-name' }, pick(x.name, lang)),
      lang === 'zh' && x.name.zh !== x.name.en ? el('span', { class: 'muted' }, x.name.en) : null),
    el('p', { class: 'gloss-def', html: (x.def[lang] || x.def.en)[0] || '' }))));
  const filter = el('input', { type: 'search', class: 'field', placeholder: t('search', null, lang), 'aria-label': t('search', null, lang) });
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    for (const li of list.children) li.hidden = q && !li.textContent.toLowerCase().includes(q);
  });
  return page(t('glossary', null, lang), el('p', { class: 'lede' }, t('glossaryHint', null, lang), ' ',
    el('a', { href: glossaryUrl('', lang).replace(/#$/, ''), target: '_blank', rel: 'noopener' }, '↗')), filter, list);
}

/* ---------- Flashcards: a module's key terms ---------- */
export async function flashcards(lang, { chapter }) {
  const [terms, index] = await Promise.all([loadData('terms'), loadData('index')]);
  const byId = new Map(terms.map(x => [x.id, x]));
  const chs = index.chapters;
  const id = chapter || chs[0].id;
  const ch = await loadChapter(id);
  const cards = cardsFor(ch).map(k => byId.get(k)).filter(Boolean);
  let i = 0;
  const card = el('button', { type: 'button', class: 'flashcard' });
  const counter = el('p', { class: 'muted fc-count' });
  const show = () => {
    const x = cards[i];
    card.classList.remove('is-flipped');
    card.replaceChildren(el('span', { class: 'fc-front' }, pick(x.name, lang)), el('span', { class: 'fc-back', html: (x.def[lang] || x.def.en)[0] || '' }));
    counter.textContent = `${i + 1} / ${cards.length}`;
  };
  card.addEventListener('click', e => { if (!e.target.closest('a, .term')) card.classList.toggle('is-flipped'); });
  const nav = el('div', { class: 'fc-nav' },
    el('button', { type: 'button', class: 'button button-quiet', onclick: () => { i = (i - 1 + cards.length) % cards.length; show(); } }, t('prev', null, lang)),
    el('button', { type: 'button', class: 'button', onclick: () => { i = (i + 1) % cards.length; show(); } }, t('next', null, lang)));
  const pickCh = el('select', { class: 'field', 'aria-label': t('contents', null, lang), onchange: e => { location.hash = `#/tools/cards/${e.target.value}`; } },
    chs.map(c => el('option', { value: c.id, selected: c.id === id }, `${c.num}. ${pick(c.title, lang)}`)));
  if (cards.length) show();
  return page(t('flashcards', null, lang), el('p', { class: 'lede' }, t('flashHint', null, lang)), pickCh,
    cards.length ? el('div', { class: 'fc-wrap' }, card, counter, nav) : el('p', { class: 'muted' }, '—'));
}

/* ---------- Every "Check your understanding" question ---------- */
export async function quizPage(lang, { chapter, onAnswer, terms }) {
  const index = await loadData('index');
  const answers = prefs.get().answers;
  if (!chapter) {
    const rows = await Promise.all(index.chapters.map(async c => {
      const qs = quizzesOf(await loadChapter(c.id));
      if (!qs.length) return null;
      const { right } = scoreAnswers(qs, answers);
      return el('li', {}, el('a', { href: `#/tools/quiz/${c.id}` },
        el('span', { class: 'tool-name' }, `${c.num}. ${pick(c.title, lang)}`),
        el('span', { class: 'tool-hint' }, `${qs.length} · ${t('recapScore', { done: right, total: qs.length }, lang)}`)));
    }));
    return page(t('quiz', null, lang), el('p', { class: 'lede' }, t('quizHint', null, lang)), el('ul', { class: 'tool-list' }, rows));
  }
  const ch = await loadChapter(chapter);
  const qs = quizzesOf(ch);
  const ctx = { lang, answers, onAnswer, terms };
  return page(`${t('quiz', null, lang)} · ${pick(ch.title, lang)}`,
    el('div', { class: 'quiz-list' }, qs.map(q => el('div', { class: 'quiz-item' },
      el('p', { class: 'kicker' }, el('a', { href: `#/ch/${ch.id}/${q.sec.id}` }, pick(q.sec.heading, lang))),
      quiz(q.block, ctx, q.key)))));
}
