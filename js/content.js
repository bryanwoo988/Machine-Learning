/* Loading modules and turning their blocks into DOM.

   Knows nothing about routing. Widgets are drawn by their own modules,
   passed in through `ctx`, so this file stays a plain renderer.

   Inline text arrives as a small whitelisted subset of HTML, built by
   tools/google/convert.py from Google's pages: b, i, code, sub, sup, br,
   lists, links, glossary-term buttons and KaTeX output. */

import { pick, t } from './i18n.js';

const cache = new Map();
// Resolved against this module, not the page, so it works from any route or test page.
const DATA = new URL('../data/', import.meta.url);

async function json(name) {
  const path = new URL(name, DATA).href;
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }).catch(e => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

export const loadIndex = () => json('index.json');
export const loadChapter = id => json(`${id}.json`);
export const loadData = name => json(`${name}.json`);

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null) n.append(k instanceof Node ? k : String(k));
  return n;
}

// One language of a bilingual HTML value, as a fragment-ready string.
export const html = (value, lang) => pick(value, lang);

const NOTE_LABEL = { note: 'noteNote', key: 'noteKey', caution: 'noteCaution', warning: 'noteCaution', objective: 'noteObjective' };

/* A block that Google has in one language only: hidden in the other
   language when it was Chinese-only; shown in English, marked, when it was
   English-only. */
function skip(b, lang) {
  return b.only === 'zh' && lang === 'en';
}
function enOnly(b, lang) {
  return b.only === 'en' && lang === 'zh';
}

function figure(b, ctx) {
  const src = typeof b.src === 'string' ? b.src : pick(b.src, ctx.lang);
  const img = el('img', { src, alt: pick(b.alt, ctx.lang), loading: 'lazy', decoding: 'async' });
  const cap = pick(b.caption, ctx.lang);
  const fig = el('figure', { class: 'figure' },
    el('button', { type: 'button', class: 'figure-zoom', 'aria-label': pick(b.alt, ctx.lang) || cap.replace(/<[^>]+>/g, ''), onclick: () => ctx.onZoom?.(src, cap) }, img),
    cap ? el('figcaption', { html: cap }) : null);
  return fig;
}

function table(b, ctx) {
  const L = ctx.lang;
  let headers, rows;
  if (b.by) ({ headers, rows } = b.by[L] || b.by.en);
  else { headers = b.headers.map(h => pick(h, L)); rows = b.rows.map(r => r.map(c => pick(c, L))); }
  const cap = pick(b.caption, L);
  return el('figure', { class: 'table-wrap' },
    cap ? el('figcaption', { html: cap }) : null,
    el('div', { class: 'table-scroll', tabindex: '0' },
      el('table', {},
        headers?.length ? el('thead', {}, el('tr', {}, headers.map(h => el('th', { scope: 'col', html: h })))) : null,
        el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', { html: c }))))))));
}

/* "Check your understanding": tap an option, see whether it was right and
   why; every option's explanation opens once one is chosen. The choice is
   remembered (prefs.answers) under a key that is the same in both languages. */
export function quiz(b, ctx, key) {
  const L = ctx.lang;
  const chosen = ctx.answers?.[key];
  const li = el('div', { class: 'quiz-q', 'data-quiz': key });
  li.append(el('p', { class: 'quiz-label' }, t('checkUnderstanding', null, L)));
  li.append(el('div', { class: 'quiz-text', html: pick(b.q, L) }));
  const opts = el('div', { class: 'quiz-opts', role: 'list' });
  const hasAnswer = b.options.some(o => o.correct);
  const paint = pickedIdx => {
    [...opts.children].forEach((row, k) => {
      const o = b.options[k];
      row.classList.toggle('is-picked', k === pickedIdx);
      if (pickedIdx == null) return;
      row.classList.toggle('is-right', !!o.correct && hasAnswer);
      row.classList.toggle('is-wrong', k === pickedIdx && hasAnswer && !o.correct);
      row.querySelector('.quiz-why').hidden = !pick(o.why, L);
    });
    verdict.hidden = pickedIdx == null || !hasAnswer;
    if (pickedIdx != null && hasAnswer) {
      const ok = !!b.options[pickedIdx].correct;
      verdict.textContent = t(ok ? 'correct' : 'notQuite', null, L);
      verdict.className = `quiz-verdict ${ok ? 'is-ok' : 'is-no'}`;
      retry.hidden = ok;
    }
  };
  b.options.forEach((o, k) => {
    const row = el('div', { class: 'quiz-row', role: 'listitem' },
      el('button', { type: 'button', class: 'quiz-opt', html: pick(o.html, L), onclick: () => {
        ctx.onAnswer?.(key, k, !!o.correct);
        paint(k);
      } }),
      el('div', { class: 'quiz-why', hidden: true, html: pick(o.why, L) }));
    opts.append(row);
  });
  const verdict = el('p', { class: 'quiz-verdict', role: 'status', hidden: true });
  const retry = el('button', { type: 'button', class: 'button button-quiet quiz-retry', hidden: true, onclick: () => {
    ctx.onAnswer?.(key, null);
    [...opts.children].forEach(r => { r.className = 'quiz-row'; r.querySelector('.quiz-why').hidden = true; });
    verdict.hidden = true; retry.hidden = true;
  } }, t('tryAgain', null, L));
  li.append(opts, verdict, retry);
  if (chosen != null && chosen < b.options.length) paint(chosen);
  return li;
}

function video(b, ctx) {
  const L = ctx.lang;
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(b.id)}`;
  const box = el('div', { class: 'video-card' });
  const play = el('button', { type: 'button', class: 'video-play', 'aria-label': t('video', null, L), onclick: () => {
    if (!navigator.onLine) { ctx.toast?.(t('videoHint', null, L)); return; }
    box.replaceChildren(el('div', { class: 'video-frame' },
      el('iframe', { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.id)}?autoplay=1&rel=0`, title: t('video', null, L),
        allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy' })));
  } }, el('span', { class: 'video-icon', 'aria-hidden': 'true' }, '▶'), el('span', {}, t('video', null, L)));
  box.append(play, el('p', { class: 'muted' }, t('videoHint', null, L), ' ', el('a', { href: url, target: '_blank', rel: 'noopener' }, 'YouTube ↗')));
  return box;
}

function linkCard(href, title, hint) {
  return el('a', { class: 'link-card', href, target: '_blank', rel: 'noopener' },
    el('span', { class: 'link-card-title', html: title }), hint ? el('span', { class: 'link-card-hint' }, hint) : null);
}

function block(b, ctx, key) {
  const L = ctx.lang;
  if (skip(b, L)) return null;
  let node;
  switch (b.type) {
    case 'p': node = el('p', { html: pick(b.html, L) }); break;
    case 'h': node = el(b.level === 2 ? 'h3' : 'h4', { class: 'sub-h', html: pick(b.html, L) }); break;
    case 'list': {
      const items = b.items ? b.items.map(i => pick(i, L)) : (b.itemsBy[L] || b.itemsBy.en);
      node = el(b.ordered ? 'ol' : 'ul', {}, items.map((i, j) => el('li', { html: i, 'data-rk': `${key}.${j}` })));
      break;
    }
    case 'table': node = table(b, ctx); node.querySelectorAll('tbody tr').forEach((r, j) => { r.dataset.rk = `${key}.${j}`; }); break;
    case 'note': {
      const label = NOTE_LABEL[b.kind];
      const body = pick(b.html, L);
      // Google's notes start with their own bold label ("Note:", "注意："); keep it.
      node = el('aside', { class: `note note-${b.kind}` }, label && !/^<b>/.test(body) ? el('p', { class: 'note-label' }, t(label, null, L)) : null, el('div', { html: body }));
      break;
    }
    case 'figure': node = figure(b, ctx); break;
    case 'quiz': node = quiz(b, ctx, key); break;
    case 'more':
      node = el('details', { class: 'more' }, el('summary', { html: pick(b.title, L) || '…' }),
        ...b.blocks.map((x, j) => block(x, ctx, `${key}.${j}`)).filter(Boolean));
      break;
    case 'code': node = el('pre', { class: 'code' }, el('code', {}, b.text)); break;
    case 'video': node = video(b, ctx); break;
    case 'frame': node = linkCard(pick(b.src, L), t('exercise', null, L), t(ctx.hasWidget ? 'exerciseHint' : 'exerciseOnly', null, L)); break;
    case 'link': node = linkCard(pick(b.href, L), pick(b.html, L), null); break;
    case 'gquiz': node = linkCard(pick(b.href, L), t('googleQuiz', null, L), t('googleQuizHint', null, L)); break;
    case 'widget': {
      node = el('div', { class: 'widget', 'data-widget': b.id });
      ctx.mountWidget?.(node, b.id, { lang: L, opts: b.opts ?? {} });
      break;
    }
    default:
      console.warn('[content] unknown block type', b.type);
      return null;
  }
  if (['p', 'note'].includes(b.type)) node.dataset.rk = key;
  if (enOnly(b, L)) { node.lang = 'en'; node.classList.add('en-only'); node.title = t('enOnlyBlock', null, L); }
  return node;
}

/* One lesson (a Google page): key takeaways, the page itself, key terms. */
export function renderSection(chapter, sec, ctx) {
  const L = ctx.lang;
  const key = i => `${chapter.id}/${sec.id}#${i}`;
  ctx.hasWidget = sec.blocks.some(b => b.type === 'widget');
  const frag = document.createDocumentFragment();
  if (sec.takeaways?.length) frag.append(takeawayBox(sec, ctx, `${chapter.id}/${sec.id}#k`));
  sec.blocks.forEach((b, i) => { const n = block(b, ctx, key(i)); if (n) frag.append(n); });
  if (sec.terms?.length) frag.append(termChips(sec.terms, ctx));
  return frag;
}

export function takeawayBox(sec, ctx, keyBase, { open = true } = {}) {
  const L = ctx.lang;
  const missing = L === 'zh' && sec.takeaways.some(x => !x.zh);
  return el('details', { class: 'takeaways', open },
    el('summary', {}, el('span', { class: 'takeaways-icon', 'aria-hidden': 'true' }, '★'), t('takeaways', null, L)),
    el('ul', {}, sec.takeaways.map((x, j) => el('li', { html: (L === 'zh' && x.zh) ? x.zh : x.en, lang: L === 'zh' && !x.zh ? 'en' : null, 'data-rk': `${keyBase}.${j}` }))),
    el('p', { class: 'takeaways-by' }, t('takeawaysBy', null, L), missing ? t('takeawaysEnOnly', null, L) : ''));
}

export function termChips(ids, ctx) {
  return el('aside', { class: 'key-terms' },
    el('p', { class: 'key-terms-label' }, t('keyTerms', null, ctx.lang)),
    el('div', { class: 'chips' }, ids.map(id => {
      const term = ctx.terms?.get(id);
      return el('button', { type: 'button', class: 'chip term', 'data-term': id }, term ? pick(term.name, ctx.lang) : id.replace(/-/g, ' '));
    })));
}

/* Every quiz in a module, with the key it is stored under. */
export function quizzesOf(chapter) {
  const out = [];
  for (const sec of chapter.sections) {
    const walk = (blocks, base) => blocks.forEach((b, i) => {
      const key = `${base}${i}`;
      if (b.type === 'quiz' && b.options.some(o => o.correct)) out.push({ sec, block: b, key });
      if (b.type === 'more') walk(b.blocks, `${key}.`);
    });
    walk(sec.blocks, `${chapter.id}/${sec.id}#`);
  }
  return out;
}
