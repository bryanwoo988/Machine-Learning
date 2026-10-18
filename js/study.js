/* The reader's own study layer: favourite modules and a free note per
   module. Highlights, underlines, notes on passages and bookmarks live in
   reader.js (shared with Plant Physiology, OPWiki and Oil Palm Basics).

   Owns its storage and nothing else — no DOM. Everything stays on this
   device (localStorage), so it works offline; if storage is unavailable it
   runs in memory and forgets on reload, like prefs.js. */

const KEY = 'ml.study.v1';
const ID = /^c\d\d$/;

const EMPTY = () => ({ fav: {}, notes: {} });
let state = EMPTY();
let store = null;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function sanitise(raw) {
  const d = EMPTY();
  if (!isObj(raw)) return d;
  if (isObj(raw.fav)) for (const [k, v] of Object.entries(raw.fav)) if (ID.test(k) && Number.isFinite(v)) d.fav[k] = v;
  if (isObj(raw.notes)) for (const [k, v] of Object.entries(raw.notes)) if (ID.test(k) && typeof v === 'string' && v.trim()) d.notes[k] = v.slice(0, 20000);
  return d;
}

function load() { try { return JSON.parse(store?.getItem(KEY) || '{}'); } catch { return {}; } }
function save() { try { store?.setItem(KEY, JSON.stringify(state)); } catch { /* not persisted */ } }

export function init(storage = globalThis.localStorage) {
  store = storage ?? null;
  state = sanitise(load());
  return get();
}
export const get = () => JSON.parse(JSON.stringify(state));

/* Favourites (whole modules) */
export const isFav = ch => ch in state.fav;
export function toggleFav(ch, now = Date.now()) {
  if (isFav(ch)) delete state.fav[ch]; else state.fav[ch] = now;
  save();
  return isFav(ch);
}

/* Module notes */
export const chapterNote = ch => state.notes[ch] ?? '';
export function setChapterNote(ch, text) {
  const t = String(text ?? '');
  if (t.trim()) state.notes[ch] = t.slice(0, 20000); else delete state.notes[ch];
  save();
}

/* Part of the notes backup (reader.js exports the rest). */
export function merge(raw) {
  const d = sanitise(raw);
  Object.assign(state.fav, d.fav);
  Object.assign(state.notes, d.notes);
  save();
}
