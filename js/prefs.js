/* Reader preferences and progress.

   Owns storage. Knows nothing about content or routing; applying the
   preferences to the page is applyToDocument(), kept apart so the logic can
   be tested without a DOM. Storage may be missing or throw (private
   browsing, blocked site data): the app then runs on in-memory state and
   simply forgets on reload. */

const KEY = 'ml.prefs.v1';

export const LANGS = ['en', 'zh'];
export const THEMES = ['auto', 'light', 'dark'];
export const SCALES = [0.9, 1, 1.15, 1.3, 1.5, 1.75];

// English is the default so the first screen — shown before anyone has
// chosen — reads for the widest audience. `chosen` tells a first visit
// apart from someone who deliberately picked English.
const DEFAULTS = () => ({
  lang: 'en', theme: 'auto', scale: 1, chosen: false,
  read: {}, quiz: {}, answers: {}, lastRoute: '', seenVersion: '',
});

let state = DEFAULTS();
let store = null;
const listeners = new Set();

function load() {
  try { return JSON.parse(store?.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

function save() {
  try { store?.setItem(KEY, JSON.stringify(state)); } catch { /* not persisted this session */ }
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Stored values are checked, not trusted: a corrupted value falls back to the
// default, and an invalid language shows the picker again.
function sanitise(raw) {
  const d = DEFAULTS();
  const lang = LANGS.includes(raw.lang) ? raw.lang : d.lang;
  return {
    lang,
    theme: THEMES.includes(raw.theme) ? raw.theme : d.theme,
    scale: SCALES.includes(raw.scale) ? raw.scale : d.scale,
    chosen: raw.chosen === true && LANGS.includes(raw.lang),
    read: isObj(raw.read) ? Object.fromEntries(Object.entries(raw.read).filter(([, v]) => v === true)) : {},
    quiz: isObj(raw.quiz) ? Object.fromEntries(Object.entries(raw.quiz).filter(([, v]) => Number.isFinite(v))) : {},
    answers: isObj(raw.answers) ? Object.fromEntries(Object.entries(raw.answers).filter(([k, v]) => k.length < 80 && Number.isInteger(v) && v >= 0 && v < 20)) : {},
    lastRoute: typeof raw.lastRoute === 'string' ? raw.lastRoute : '',
    seenVersion: typeof raw.seenVersion === 'string' ? raw.seenVersion : '',
  };
}

function change(what) {
  save();
  for (const fn of listeners) fn(what, get());
}

const next = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];

export function init(storage = globalThis.localStorage) {
  store = storage ?? null;
  state = sanitise(load());
  return get();
}

export function get() {
  return { ...state, read: { ...state.read }, quiz: { ...state.quiz }, answers: { ...state.answers } };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function chooseLang(lang) {
  if (!LANGS.includes(lang)) throw new RangeError(`unknown language: ${lang}`);
  state.lang = lang;
  state.chosen = true;
  change('lang');
  return lang;
}

// Cycling is a choice too, so the picker does not come back.
export function cycleLang() {
  return chooseLang(next(LANGS, state.lang));
}

export function cycleTheme() {
  state.theme = next(THEMES, state.theme);
  change('theme');
  return state.theme;
}

export function cycleFontScale() {
  state.scale = next(SCALES, state.scale);
  change('scale');
  return state.scale;
}

// Settings screen: set directly.
export function setTheme(theme) {
  if (!THEMES.includes(theme)) return state.theme;
  state.theme = theme;
  change('theme');
  return state.theme;
}

export function setScale(scale) {
  if (!SCALES.includes(scale)) return state.scale;
  state.scale = scale;
  change('scale');
  return state.scale;
}

export function markRead(chId, on) {
  if (on) state.read[chId] = true;
  else delete state.read[chId];
  change('read');
}

export function setQuizBest(stage, score) {
  if (!(state.quiz[stage] >= score)) state.quiz[stage] = score;
  change('quiz');
}

// The option picked for one question ("c04/roc-and-auc#3"), so an answered
// question stays answered, and the recap can count what was right.
export function setAnswer(key, option) {
  state.answers[key] = option;
  change('answers');
}

export function resetProgress() {
  state.read = {};
  state.quiz = {};
  state.answers = {};
  change('read');
}

export function setLastRoute(route) {
  state.lastRoute = String(route);
  save();
}

export function setSeenVersion(v) {
  state.seenVersion = String(v);
  save();
}

/* The stylesheet reads these attributes. `auto` resolves against the OS
   setting here and again whenever it changes (app.js listens). */
export function applyToDocument(doc = document, prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) {
  const r = doc.documentElement;
  r.lang = state.lang === 'zh' ? 'zh-Hans' : state.lang;
  r.dataset.theme = state.theme === 'auto' ? (prefersDark ? 'dark' : 'light') : state.theme;
  r.dataset.themePref = state.theme;
  r.style.setProperty('--font-scale', String(state.scale));
  if (state.scale >= 1.3) r.dataset.single = '';
  else delete r.dataset.single;
}
