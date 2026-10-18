/* Boot, hash router, views. The only module that wires the others together.

   Routes (all in the fragment, so the service worker only ever serves the root):
     #/                       home: the four courses
     #/stage/N                one course and its modules
     #/ch/cNN                 a module: its lessons, recap and progress
     #/ch/cNN/<lesson>        one lesson (one Google page)
     #/ch/cNN/recap           the module's recap card
     #/term/<id>              a glossary term
     #/notes  #/bookmarks  #/settings  #/share  #/search  #/tools/<name>[/cNN]

   Highlights, notes on passages and bookmarks are reader.js (window.Reader,
   shared with Plant Physiology, OPWiki and Oil Palm Basics); the bottom bar
   opens them. This app has no read-aloud. */

import * as prefs from './prefs.js';
import { t, pick, LANG_NATIVE } from './i18n.js';
import { loadIndex, loadChapter, loadData, renderSection, takeawayBox, termChips, quizzesOf, quiz, el } from './content.js';
import { loadTerms, openTermSheet } from './terms.js';
import { newerRevision, updateAction, mayAutoReload } from './updatelogic.js';
import { notesSince } from './releases.js';
import { APP_URL, AUTHOR } from './config.js';
import { renderShare } from './share.js';
import { mountWidget } from './widgets/index.js';
import { buildIndex, search } from './search.js';
import { scoreAnswers } from './quiz.js';
import * as tools from './tools.js';
import * as study from './study.js';

const $ = sel => document.querySelector(sel);
const main = $('#main');

/* ---------- Icons (24px stroke, currentColor) ---------- */
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  more: svg('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  star: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>'),
  starOn: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="currentColor"/>'),
};

/* ---------- State ---------- */
let index = null, terms = null, releases = [];
let current = { route: null };
let visibleSince = performance.now();
let asked = false;
let dismissed = false;

const lang = () => prefs.get().lang;
const tr = (k, v) => t(k, v, lang());
const chapterMeta = id => index.chapters.find(c => c.id === id);

/* ---------- Header ---------- */
function paintHeader() {
  const set = (sel, html, label) => { const b = $(sel); b.innerHTML = html; b.setAttribute('aria-label', label); b.title = label; };
  set('[data-action="search"]', ICON.search, tr('search'));
  set('[data-action="more"]', ICON.more, tr('more'));
  $('#bottomnav').setAttribute('aria-label', tr('menu'));
  $('.sheet-close').innerHTML = ICON.close;
  $('.sheet-close').setAttribute('aria-label', tr('close'));
  for (const n of document.querySelectorAll('[data-ui]')) n.textContent = tr(n.dataset.ui);
  document.title = `${tr('appName')} · ${lang() === 'zh' ? 'Machine Learning' : '机器学习'}`;
  markNav();
}

let toastTimer = 0;
function toast(message) {
  const n = $('#toast');
  n.textContent = message;
  n.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { n.hidden = true; }, 1900);
}

/* ---------- Sheet ---------- */
function openSheet(content) {
  $('.sheet-body').replaceChildren(content);
  $('#sheet').hidden = false;
  document.body.classList.add('sheet-open');
  $('.sheet-panel').focus?.();
}
function closeSheet() {
  $('#sheet').hidden = true;
  document.body.classList.remove('sheet-open');
}

/* ---------- Routing ---------- */
function parse(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (!a) return { view: 'home' };
  if (a === 'stage') return { view: 'stage', n: Number(b) };
  if (a === 'ch') return { view: 'chapter', id: b, section: c };
  if (a === 'term') return { view: 'term', id: b };
  if (a === 'tools') return { view: 'tools', name: b, arg: c };
  if (a === 'info' || a === 'settings') return { view: 'settings' };
  if (a === 'notes') return { view: 'notes' };
  if (['share', 'search', 'bookmarks'].includes(a)) return { view: a };
  return { view: 'home' };
}

const ctxFor = () => ({
  lang: lang(),
  terms,
  answers: prefs.get().answers,
  onAnswer: (key, option) => prefs.setAnswer(key, option),
  onZoom: zoom,
  toast,
  mountWidget: (host, id, c) => mountWidget(host, id, c),
});

// A render that is overtaken by a newer one (a quick second tap while a
// module loads) is dropped instead of replacing the newer page.
let renderSeq = 0;
let flushNote = null;

async function render({ keepAnchor = false } = {}) {
  const seq = ++renderSeq;
  const r = parse(location.hash);
  flushNote?.();
  flushNote = null;
  current = { route: r, after: null };
  closeSheet();
  const anchor = keepAnchor ? readingAnchor() : null;
  const y = window.scrollY;
  document.documentElement.dataset.view = r.view;
  try {
    const view = await VIEWS[r.view](r);
    if (seq !== renderSeq) return;
    main.replaceChildren(view);
    current.after?.();
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    main.replaceChildren(el('div', { class: 'page' }, el('p', { class: 'error' }, tr('loadError'))));
  }
  window.Reader.refresh();
  markNav();
  const reveal = r.view === 'chapter' ? pendingReveal : null;
  pendingReveal = null;
  if (anchor) restoreAnchor(anchor);
  else if (reveal) requestAnimationFrame(() => window.Reader.reveal(reveal));
  else window.scrollTo(0, keepAnchor ? y : 0);
  if (r.view === 'chapter' && r.section && r.section !== 'recap') prefs.setLastRoute(location.hash);
}

// The block the reader is looking at, and where it sits on screen, so a
// language switch or a text-size change can put it back in the same place.
function readingAnchor() {
  const top = $('.topbar').getBoundingClientRect().bottom;
  for (const s of main.querySelectorAll('[data-rk], h1, h3')) {
    const r = s.getBoundingClientRect();
    if (r.bottom > top + 8) return { key: s.dataset.rk, tag: s.tagName, offset: r.top };
  }
  return null;
}
function restoreAnchor({ key, offset }) {
  const s = key ? main.querySelector(`[data-rk="${CSS.escape(key)}"]`) : null;
  if (!s) return;
  window.scrollBy(0, s.getBoundingClientRect().top - offset);
}

/* ---------- Progress ---------- */
const isMastered = id => !!prefs.get().read[id];
function masteredIn(stage) {
  const chs = stage.chapters;
  return { done: chs.filter(isMastered).length, total: chs.length };
}

function progressBar(done, total) {
  const pct = total ? Math.round(100 * done / total) : 0;
  return el('span', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('span', { style: `width:${pct}%` }));
}

/* ---------- Views ---------- */
const VIEWS = {
  async home() {
    const p = prefs.get();
    const last = p.lastRoute && parse(p.lastRoute).view === 'chapter' ? p.lastRoute : null;
    const first = index.chapters[0];
    const all = index.chapters.length;
    const done = index.chapters.filter(c => isMastered(c.id)).length;
    const hero = el('section', { class: 'hero' },
      el('img', { class: 'hero-icon', src: 'icons/icon-192.png', alt: '', width: 72, height: 72 }),
      el('h1', {}, tr('appName')),
      el('p', { class: 'lede' }, tr('tagline')),
      el('div', { class: 'hero-actions' },
        last ? el('a', { class: 'button', href: last }, tr('continueReading'))
          : el('a', { class: 'button', href: `#/ch/${first.id}/${first.sections[0].id}` }, tr('startHere'))),
      el('div', { class: 'hero-progress' }, el('span', { class: 'muted' }, tr('progress', { done, total: all })), progressBar(done, all)));
    const stages = el('ol', { class: 'stage-list' }, index.stages.map(stageCard));
    return el('div', { class: 'page page-home' }, hero, stages,
      el('p', { class: 'licence muted' }, tr('licence')));
  },

  async stage({ n }) {
    const s = index.stages.find(x => x.n === n);
    if (!s) return VIEWS.home();
    const { done, total } = masteredIn(s);
    return el('div', { class: 'page' },
      el('p', { class: 'kicker' }, tr('courseN', { n })),
      el('h1', {}, pick(s.title, lang())),
      el('p', { class: 'lede' }, pick(s.blurb, lang())),
      el('div', { class: 'stage-progress' }, el('span', { class: 'muted' }, tr('progress', { done, total })), progressBar(done, total)),
      el('ol', { class: 'chapter-list' }, s.chapters.map(id => {
        const c = chapterMeta(id);
        const a = el('a', { href: `#/ch/${c.id}` },
          el('span', { class: 'ch-num' }, String(c.num)),
          el('span', { class: 'ch-text' },
            el('span', { class: 'ch-title' }, pick(c.title, lang())),
            el('span', { class: 'ch-meta' }, [tr('pagesCount', { n: c.sections.length }), c.minutes ? tr('minutes', { n: c.minutes }) : null].filter(Boolean).join(' · '))),
          isMastered(c.id) ? el('span', { class: 'ch-read', 'aria-label': tr('isMastered'), html: ICON.check }) : null);
        return el('li', {}, a);
      })),
      el('p', { class: 'muted' }, el('a', { href: s.url + (lang() === 'zh' ? '?hl=zh-cn' : ''), target: '_blank', rel: 'noopener' }, tr('readOriginal'))));
  },

  async chapter({ id, section }) {
    const meta = chapterMeta(id);
    if (!meta) return VIEWS.home();
    const ch = await loadChapter(id);
    if (section === 'recap') return recapView(ch);
    const sec = ch.sections.find(s => s.id === section);
    if (!sec) return moduleView(ch);
    return lessonView(ch, sec);
  },

  async term({ id }) {
    const view = await tools.glossary(lang(), { onTerm: showTerm });
    current.after = () => {
      document.getElementById(`term-${id}`)?.scrollIntoView({ block: 'center' });
      showTerm(id);
    };
    return view;
  },

  // Notes and highlights share a screen; bookmarks have their own. Under the
  // reader.js lists: the free module notes, and the favourite modules.
  async notes() {
    const list = el('div', { class: 'card lib-list' });
    const view = el('div', { class: 'page page-lib' },
      el('h1', {}, tr('notes')),
      segmented([['notes', tr('notes')], ['marks', tr('highlights')]], notesKind, k => { notesKind = k; render({ keepAnchor: true }); }),
      list);
    window.Reader.renderList(list, notesKind);
    if (notesKind === 'notes') {
      const chs = index.chapters.filter(c => study.chapterNote(c.id));
      if (chs.length) view.append(el('h2', { class: 'lib-h' }, tr('chapterNotes')), el('div', { class: 'card' }, chs.map(c =>
        el('a', { class: 'nb-note', href: `#/ch/${c.id}` },
          el('span', { class: 'nb-note-ch' }, `${tr('chapterN', { n: c.num })} · ${pick(c.title, lang())}`),
          el('span', { class: 'nb-note-text' }, study.chapterNote(c.id))))));
    }
    return view;
  },

  async bookmarks() {
    const list = el('div', { class: 'card lib-list' });
    const view = el('div', { class: 'page page-lib' }, el('h1', {}, tr('bookmarks')), list);
    window.Reader.renderList(list, 'bookmarks');
    const favs = index.chapters.filter(c => study.isFav(c.id));
    if (favs.length) view.append(el('h2', { class: 'lib-h' }, tr('favourites')), el('ul', { class: 'tool-list' }, favs.map(c =>
      el('li', {}, el('a', { href: `#/ch/${c.id}` }, '★ ', `${c.num}. ${pick(c.title, lang())}`)))));
    return view;
  },

  // Language, theme and text size, the notes backup, then the About part:
  // QR code, share link, version and update history (APP-STANDARDS §3).
  async settings() {
    const status = el('p', { class: 'status' }, '…');
    offlineStatus().then(ok => { status.textContent = tr(ok ? 'offlineReady' : 'offlineNotYet'); status.classList.add(ok ? 'is-ok' : 'is-pending'); });
    const p = prefs.get();
    const row = (title, control) => el('div', { class: 'setrow' }, el('h3', {}, title), control);
    const backup = el('div');
    window.Reader.renderSettings(backup);
    const share = el('div', { id: 'share-host' });
    renderShare(share, { url: APP_URL, lang: lang() });
    return el('div', { class: 'page page-info' },
      el('h1', {}, tr('settings')),
      el('div', { class: 'card setgroup' },
        row(tr('language'), segmented(prefs.LANGS.map(l => [l, LANG_NATIVE[l]]), p.lang, l => prefs.chooseLang(l))),
        row(tr('theme'), segmented([['auto', tr('themeAuto')], ['light', tr('themeLight')], ['dark', tr('themeDark')]], p.theme, th => prefs.setTheme(th))),
        row(tr('textSize'), el('div', {},
          segmented(prefs.SCALES.map(sc => [sc, `${Math.round(sc * 100)}%`]), p.scale, sc => prefs.setScale(sc)),
          el('p', { class: 'text-sample' }, tr('textSample'))))),
      el('div', { class: 'card setgroup' }, backup,
        el('h3', { class: 'rd-set-h' }, tr('progressTitle')),
        el('button', { type: 'button', class: 'rd-btn', onclick: () => { if (confirm(tr('resetConfirm'))) { prefs.resetProgress(); render({ keepAnchor: true }); } } }, tr('resetProgress'))),
      el('h2', { class: 'lib-h' }, tr('info')),
      el('div', { class: 'card about' },
        el('p', { class: 'lede' }, tr('tagline')),
        el('dl', { class: 'keyval' },
          el('dt', {}, tr('version')), el('dd', {}, releases[0] ? `v${releases[0].v} · ${builtAt() || releases[0].date} · ` : '',
            el('a', { href: '#', onclick: e => { e.preventDefault(); showAllReleases(); } }, tr('allUpdates'))),
          el('dt', {}, tr('offline')), el('dd', {}, status)),
        el('h3', {}, tr('share')),
        el('p', { class: 'muted' }, tr('shareHint')),
        share,
        el('p', { class: 'share-url' }, APP_URL),
        el('p', { class: 'credit' }, tr('createdBy'))),
      el('h2', {}, tr('allSources')),
      el('ul', { class: 'source-list' }, index.stages.map(s => el('li', {},
        el('a', { href: s.url + (lang() === 'zh' ? '?hl=zh-cn' : ''), target: '_blank', rel: 'noopener' }, pick(s.title, lang()), ' ↗'),
        el('span', { class: 'muted' }, ' — Google for Developers'))),
        el('li', {}, el('a', { href: 'https://developers.google.com/machine-learning/glossary', target: '_blank', rel: 'noopener' }, 'Machine Learning Glossary ↗'), el('span', { class: 'muted' }, ' — Google for Developers'))),
      el('p', { class: 'licence muted' }, tr('licence')));
  },

  async share() {
    const host = el('div', { id: 'share-host' });
    renderShare(host, { url: APP_URL, lang: lang() });
    return el('div', { class: 'page page-share' },
      el('h1', {}, tr('share')),
      el('p', { class: 'lede' }, tr('shareHint')),
      host,
      el('p', { class: 'share-url' }, APP_URL),
      el('p', { class: 'credit' }, tr('createdBy')));
  },

  async search() {
    const input = el('input', { id: 'search-input', type: 'search', class: 'field field-search', placeholder: tr('searchHint'), 'aria-label': tr('search'), autocomplete: 'off' });
    const results = el('ul', { class: 'search-results' });
    const idx = await searchIndex();
    const run = () => {
      const q = input.value;
      try { sessionStorage.setItem('ml.q', q); } catch { /* ignore */ }
      const hits = search(idx, q, lang());
      results.replaceChildren(...(q.trim() && !hits.length ? [el('li', { class: 'muted' }, tr('noResults'))] : hits.map(h =>
        el('li', {}, el('a', { href: h.route }, el('span', { class: 'hit-title' }, h.title), el('span', { class: 'hit-snippet' }, h.snippet))))));
    };
    input.addEventListener('input', run);
    try { input.value = sessionStorage.getItem('ml.q') || ''; } catch { /* ignore */ }
    run();
    setTimeout(() => input.focus(), 0);
    return el('div', { class: 'page' }, el('h1', {}, tr('search')), input, results);
  },

  async tools({ name, arg }) {
    const l = lang();
    switch (name) {
      case 'glossary': return tools.glossary(l, { onTerm: showTerm });
      case 'cards': return tools.flashcards(l, { chapter: arg });
      case 'quiz': return tools.quizPage(l, { chapter: arg, onAnswer: (k, o) => prefs.setAnswer(k, o), terms });
      default: return tools.toolsIndex(l);
    }
  },
};

/* ---------- Module, lesson and recap ---------- */
function favButton(id) {
  const b = el('button', { type: 'button', class: 'icon-btn fav-btn' });
  const paint = () => {
    const on = study.isFav(id);
    b.innerHTML = on ? ICON.starOn : ICON.star;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', tr(on ? 'unfavourite' : 'favourite')); b.title = b.getAttribute('aria-label');
  };
  b.addEventListener('click', () => { study.toggleFav(id); paint(); });
  paint();
  return b;
}

function masteredButton(id) {
  const on = isMastered(id);
  const b = el('button', { type: 'button', class: `button ${on ? 'is-on' : 'button-quiet'}`,
    onclick: () => { prefs.markRead(id, !isMastered(id)); render({ keepAnchor: true }); } }, on ? tr('isMastered') : tr('mastered'));
  if (on) b.insertAdjacentHTML('afterbegin', ICON.check);
  return b;
}

function crumbs(ch) {
  const stage = index.stages.find(s => s.n === ch.stage);
  return el('p', { class: 'kicker' }, el('a', { href: `#/stage/${ch.stage}` }, pick(stage.title, lang())), ' · ', el('a', { href: `#/ch/${ch.id}` }, tr('chapterN', { n: ch.num })));
}

// The lessons of a module as a list: a side panel on wide screens, the
// module page on phones.
function lessonList(ch, currentId) {
  const qs = quizzesOf(ch);
  return el('ol', { class: 'lesson-list' },
    ch.sections.map((s, i) => {
      const mine = qs.filter(q => q.sec === s);
      const sc = scoreAnswers(mine, prefs.get().answers);
      return el('li', { class: s.id === currentId ? 'is-current' : '' },
        el('a', { href: `#/ch/${ch.id}/${s.id}` },
          el('span', { class: 'ls-num' }, String(i + 1)),
          el('span', { class: 'ls-title' }, pick(s.heading, lang())),
          el('span', { class: 'ls-meta' }, [s.min ? tr('minutes', { n: s.min }) : null, mine.length ? `✓ ${sc.right}/${mine.length}` : null].filter(Boolean).join(' · '))));
    }),
    el('li', { class: `ls-recap${currentId === 'recap' ? ' is-current' : ''}` }, el('a', { href: `#/ch/${ch.id}/recap` },
      el('span', { class: 'ls-num' }, '★'), el('span', { class: 'ls-title' }, tr('recap')), el('span', { class: 'ls-meta' }, isMastered(ch.id) ? tr('isMastered') : ''))));
}

function moduleView(ch) {
  const L = lang();
  const intro = ch.sections[0];
  const firstTakeaways = intro?.takeaways?.length ? takeawayBox(intro, ctxFor(), `${ch.id}/${intro.id}#k`, { open: false }) : null;
  return el('div', { class: 'page page-module' },
    el('div', { class: 'chapter-head' }, crumbs(ch), favButton(ch.id)),
    el('h1', {}, pick(ch.title, L)),
    el('p', { class: 'muted' }, [tr('pagesCount', { n: ch.sections.length }), ch.minutes ? tr('minutes', { n: ch.minutes }) : null].filter(Boolean).join(' · ')),
    el('div', { class: 'hero-actions' },
      el('a', { class: 'button', href: `#/ch/${ch.id}/${intro.id}` }, tr('startHere')),
      el('a', { class: 'button button-quiet', href: `#/ch/${ch.id}/recap` }, tr('recap')),
      masteredButton(ch.id)),
    el('h2', { class: 'lib-h' }, tr('inThisModule')),
    lessonList(ch, null),
    firstTakeaways,
    noteBlock(ch.id));
}

function lessonView(ch, sec) {
  const L = lang();
  const i = ch.sections.indexOf(sec);
  const prev = ch.sections[i - 1];
  const next = ch.sections[i + 1];
  const ctx = ctxFor();
  const article = el('article', { class: 'chapter lesson', 'data-num': ch.num, 'data-ch': ch.id, 'data-sec': sec.id },
    el('div', { class: 'chapter-head' }, crumbs(ch), favButton(ch.id)),
    el('p', { class: 'lesson-n' }, tr('lessonN', { n: i + 1 }), sec.min ? ` · ${tr('minutes', { n: sec.min })}` : ''),
    el('h1', {}, pick(sec.heading, L)),
    el('p', { class: 'study-hint muted' }, tr('markHint')),
    renderSection(ch, sec, ctx),
    el('p', { class: 'original' }, el('a', { href: pick(sec.url, L), target: '_blank', rel: 'noopener' }, tr('readOriginal'))),
    el('footer', { class: 'chapter-foot' },
      el('div', { class: 'pager' },
        prev ? el('a', { class: 'pager-link', href: `#/ch/${ch.id}/${prev.id}` }, el('span', { class: 'pager-dir' }, tr('prev')), pick(prev.heading, L))
          : el('a', { class: 'pager-link', href: `#/ch/${ch.id}` }, el('span', { class: 'pager-dir' }, tr('chapterN', { n: ch.num })), pick(ch.title, L)),
        next ? el('a', { class: 'pager-link is-next', href: `#/ch/${ch.id}/${next.id}` }, el('span', { class: 'pager-dir' }, tr('next')), pick(next.heading, L))
          : el('a', { class: 'pager-link is-next is-recap', href: `#/ch/${ch.id}/recap` }, el('span', { class: 'pager-dir' }, tr('next')), `★ ${tr('recap')}`))));
  const toc = el('nav', { class: 'toc', 'aria-label': tr('contents') }, el('p', { class: 'toc-title' }, pick(ch.title, L)), lessonList(ch, sec.id));
  return el('div', { class: 'page page-chapter' }, toc, article);
}

/* The recap: every lesson's key takeaways and key terms on one card, the
   module's questions again, the free note, and "I've mastered this". */
function recapView(ch) {
  const L = lang();
  const ctx = ctxFor();
  const qs = quizzesOf(ch);
  const sc = scoreAnswers(qs, prefs.get().answers);
  const allTerms = [...new Set(ch.sections.flatMap(s => s.terms ?? []))];
  const next = index.chapters[index.chapters.findIndex(c => c.id === ch.id) + 1];
  const article = el('article', { class: 'chapter recap', 'data-num': ch.num, 'data-ch': ch.id, 'data-sec': 'recap' },
    el('div', { class: 'chapter-head' }, crumbs(ch), favButton(ch.id)),
    el('h1', {}, `★ ${tr('recap')} · ${pick(ch.title, L)}`),
    el('p', { class: 'lede' }, tr('recapHint')),
    ch.sections.filter(s => s.takeaways?.length).map(s => el('section', { class: 'recap-lesson' },
      el('h3', {}, el('a', { href: `#/ch/${ch.id}/${s.id}` }, pick(s.heading, L))),
      takeawayBox(s, ctx, `${ch.id}/${s.id}#k`))),
    allTerms.length ? termChips(allTerms, ctx) : null,
    qs.length ? el('section', { class: 'recap-quiz' },
      el('h2', {}, tr('recapQuiz')),
      el('p', { class: 'muted' }, tr('recapScore', { done: sc.right, total: qs.length })),
      qs.map(q => el('div', { class: 'quiz-item' },
        el('p', { class: 'kicker' }, el('a', { href: `#/ch/${ch.id}/${q.sec.id}` }, pick(q.sec.heading, L))),
        quiz(q.block, { ...ctx, onAnswer: (k, o) => prefs.setAnswer(k, o) }, q.key)))) : null,
    noteBlock(ch.id),
    el('footer', { class: 'chapter-foot recap-foot' },
      masteredButton(ch.id),
      el('div', { class: 'pager' },
        el('a', { class: 'pager-link', href: `#/ch/${ch.id}/${ch.sections.at(-1).id}` }, el('span', { class: 'pager-dir' }, tr('prev')), pick(ch.sections.at(-1).heading, L)),
        next ? el('a', { class: 'pager-link is-next', href: `#/ch/${next.id}` }, el('span', { class: 'pager-dir' }, tr('next')), pick(next.title, L)) : el('span'))));
  const toc = el('nav', { class: 'toc', 'aria-label': tr('contents') }, el('p', { class: 'toc-title' }, pick(ch.title, L)), lessonList(ch, 'recap'));
  return el('div', { class: 'page page-chapter' }, toc, article);
}

function noteBlock(id) {
  const noteBox = el('textarea', { class: 'field note-area', rows: '4', placeholder: tr('chapterNoteHint'), 'aria-label': tr('myNotes') });
  noteBox.value = study.chapterNote(id);
  const noteStatus = el('span', { class: 'share-status', role: 'status' });
  let noteTimer = 0;
  const saveNote = () => {
    if (!noteTimer) return;
    clearTimeout(noteTimer); noteTimer = 0;
    study.setChapterNote(id, noteBox.value);
    noteStatus.textContent = tr('saved');
    setTimeout(() => { noteStatus.textContent = ''; }, 1500);
  };
  noteBox.addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 400); });
  // Leaving the page, switching language or closing the app inside the
  // 400 ms wait must not lose the last words typed.
  noteBox.addEventListener('blur', saveNote);
  current.after = () => { flushNote = saveNote; };
  return el('section', { class: 'chapter-notes' }, el('h2', {}, tr('myNotes')), noteBox, noteStatus);
}

/* A row of buttons, one of them on: language, theme, text size, notes/highlights. */
function segmented(options, cur, onPick) {
  return el('div', { class: 'rd-seg setseg' }, options.map(([value, label]) =>
    el('button', { type: 'button', class: value === cur ? 'on' : null, 'aria-pressed': String(value === cur), onclick: () => onPick(value) }, label)));
}

function stageCard(s) {
  const { done, total } = masteredIn(s);
  const lessons = s.chapters.reduce((n, id) => n + chapterMeta(id).sections.length, 0);
  return el('li', { class: `stage-card stage-${s.n}` }, el('a', { href: `#/stage/${s.n}` },
    el('span', { class: 'stage-num' }, String(s.n)),
    el('span', { class: 'stage-text' },
      el('span', { class: 'stage-title' }, pick(s.title, lang())),
      el('span', { class: 'stage-blurb' }, pick(s.blurb, lang())),
      el('span', { class: 'stage-meta' }, [s.chapters.length > 1 ? tr('chaptersCount', { n: s.chapters.length }) : null, tr('pagesCount', { n: lessons }), tr('progress', { done, total })].filter(Boolean).join(' · ')),
      progressBar(done, total))));
}

let searchIdx = null;
async function searchIndex() {
  if (!searchIdx) searchIdx = buildIndex(await Promise.all(index.chapters.map(c => loadChapter(c.id))), terms ? [...terms.values()] : []);
  return searchIdx;
}

function showTerm(id) {
  openTermSheet(id, { lang: lang(), openSheet });
}

function zoom(src, caption) {
  openSheet(el('figure', { class: 'zoom' }, el('img', { src, alt: '' }), caption ? el('figcaption', { html: caption }) : null));
}

/* ---------- More menu ---------- */
function openMore() {
  const item = (href, key) => el('li', {}, el('a', { href, onclick: closeSheet }, tr(key)));
  openSheet(el('nav', { class: 'more-menu' },
    el('ul', {},
      item('#/tools/glossary', 'glossary'), item('#/tools/cards', 'flashcards'), item('#/tools/quiz', 'quiz'),
      item('#/share', 'share'), item('#/settings', 'settings'))));
}

/* ---------- Offline + updates ---------- */
async function offlineStatus() {
  try {
    if (!navigator.serviceWorker?.controller) return false;
    return (await caches.keys()).some(n => n.startsWith('ml-'));
  } catch { return false; }
}

async function liveRevision() {
  try {
    const r = await fetch('index.html', { method: 'HEAD', cache: 'no-store' });
    return r.ok ? r.headers.get('Last-Modified') : null;
  } catch { return null; }
}

const TRIED = 'ml.reload-tried';
async function checkForUpdate() {
  const live = await liveRevision();
  if (!newerRevision(document.lastModified, live)) return;
  const action = updateAction({
    hidden: document.hidden, asked,
    busy: !$('#sheet').hidden || window.scrollY > 200 || window.Reader.isBusy(),
    sinceVisibleMs: performance.now() - visibleSince,
  });
  if (action === 'defer') return;
  let tried = null;
  try { tried = JSON.parse(sessionStorage.getItem(TRIED) || 'null'); } catch { /* ignore */ }
  if (action === 'apply' && (asked || mayAutoReload(tried, live, Date.now()))) return applyUpdate(live);
  if (!dismissed) $('#update-banner').hidden = false;
}

async function applyUpdate(live) {
  try { sessionStorage.setItem(TRIED, JSON.stringify({ v: live, at: Date.now() })); } catch { /* ignore */ }
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) {
    await reg.update().catch(() => {});
    const waiting = reg.installing || reg.waiting;
    if (waiting) {
      await new Promise(r => {
        navigator.serviceWorker.addEventListener('controllerchange', r, { once: true });
        setTimeout(r, 8000);
      });
    }
  }
  location.reload();
}

/* When this build went live: index.html's Last-Modified (GitHub Pages sets
   it on every deploy), as local date and time. */
function builtAt() {
  const d = new Date(document.lastModified);
  if (!isFinite(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function releaseSheet(title, list) {
  openSheet(el('div', { class: 'release-notes' },
    el('h2', {}, title),
    list.map(r => el('section', {}, el('p', { class: 'kicker' }, `v${r.v} · ${r.date}`),
      el('ul', {}, r.notes.map(n => el('li', {}, pick(n, lang())))))),
    el('button', { type: 'button', class: 'button', onclick: closeSheet }, tr('ok'))));
}

function showAllReleases() {
  releaseSheet(tr('allUpdates'), releases);
}

function showReleaseNotes() {
  const latest = releases[0]?.v;
  if (!latest) return;
  const seen = prefs.get().seenVersion;
  prefs.setSeenVersion(latest);
  const list = notesSince(releases, seen).slice(0, 4);
  if (!list.length) return;
  releaseSheet(tr('updatedTo', { v: latest }), list);
}

/* ---------- Boot ---------- */
function wire() {
  document.addEventListener('click', e => {
    const term = e.target.closest('.term[data-term]');
    if (term && !term.closest('.rd-bar')) {
      // A term inside a markable paragraph opens its sheet without also
      // selecting the paragraph for marking (reader.js).
      e.preventDefault();
      e.stopPropagation();
      showTerm(term.dataset.term);
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'more': openMore(); break;
      case 'search': location.hash = '#/search'; break;
      case 'close-sheet': closeSheet(); break;
      case 'update': asked = true; $('#update-banner').hidden = true; checkForUpdate(); break;
      case 'update-later': dismissed = true; $('#update-banner').hidden = true; break;
      default: return;
    }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  window.addEventListener('hashchange', () => render());
  prefs.subscribe(what => {
    prefs.applyToDocument();
    paintHeader();
    if (what === 'lang' || what === 'scale' || what === 'read' || (what === 'theme' && current.route?.view === 'settings')) render({ keepAnchor: true });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => prefs.applyToDocument());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushNote?.();
    if (!document.hidden) { visibleSince = performance.now(); checkForUpdate(); }
  });
  setInterval(checkForUpdate, 15 * 60e3);
}

/* ---------- Bottom bar and reader.js ---------- */
let notesKind = 'notes';
let pendingReveal = null;

/* "Module 4 · Lesson title" — where a saved block lives. */
function whereOf(u) {
  const art = u.closest('[data-ch]');
  const num = art?.dataset.num;
  const head = art?.querySelector('h1');
  return [num ? tr('chapterN', { n: num }) : '', head ? head.textContent.trim() : ''].filter(Boolean).join(' · ');
}

/* Go to the lesson a saved block is in, then bring the block on screen. */
function openSaved(key) {
  const [chId, rest] = key.split('/');
  const secId = rest.split('#')[0];
  const r = parse(location.hash);
  if (r.view === 'chapter' && r.id === chId && r.section === secId && window.Reader.reveal(key)) return;
  pendingReveal = key;
  location.hash = `#/ch/${chId}/${secId}`;
}

function markNav() {
  if (!$('#bottomnav')) return;
  const view = parse(location.hash).view;
  const tab = { notes: 'notes', bookmarks: 'bookmarks', settings: 'settings', share: 'settings', tools: 'tools', term: 'tools' }[view] || 'home';
  for (const b of document.querySelectorAll('#bottomnav [data-nav]')) {
    const on = b.dataset.nav === tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
}

function wireBottomNav() {
  $('#bottomnav').addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    location.hash = { home: '#/', tools: '#/tools', notes: '#/notes', bookmarks: '#/bookmarks', settings: '#/settings' }[b.dataset.nav];
  });
}

function showPicker() {
  return new Promise(resolve => {
    const picker = $('#picker');
    picker.hidden = false;
    picker.querySelector('.is-default').focus();
    picker.addEventListener('click', e => {
      const b = e.target.closest('[data-lang]');
      if (!b) return;
      picker.hidden = true;
      resolve(b.dataset.lang);
    });
  });
}

async function boot() {
  prefs.init();
  study.init();
  prefs.applyToDocument();
  [index, terms, releases] = await Promise.all([loadIndex(), loadTerms(), loadData('releases').catch(() => [])]);
  window.Reader.init({
    app: 'ml',
    tts: false,
    root: () => main,
    units: '[data-rk]',
    lang,
    where: whereOf,
    open: openSaved,
    toast,
    topOffset: () => $('.topbar').getBoundingClientRect().bottom,
    // Module notes and favourites travel in the same backup file.
    extra: { get: () => study.get(), set: d => study.merge(d) },
  });
  // A note edited or deleted from a list: draw the list again.
  window.Reader.onChange(() => { if (['notes', 'bookmarks'].includes(parse(location.hash).view)) render({ keepAnchor: true }); });
  wireBottomNav();
  paintHeader();
  wire();
  $('#splash').classList.add('is-done');
  document.documentElement.dataset.ready = 'true';
  if (!prefs.get().chosen) {
    const chosen = await showPicker();
    prefs.chooseLang(chosen);   // subscribe() re-renders and repaints
    prefs.setSeenVersion(releases[0]?.v ?? '');
  } else {
    await render();
    showReleaseNotes();
  }
  // On the dev server a cache-first worker would pin stale files; ?sw=1 opts in.
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname) && !/[?&]sw=1/.test(location.search);
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !dev) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('[sw]', e));
  }
  checkForUpdate();
}

boot();

export { openSheet, closeSheet, AUTHOR };
