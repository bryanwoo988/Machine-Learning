import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as prefs from '../js/prefs.js';

const memStore = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('first visit defaults to English, not yet chosen', () => {
  prefs.init(memStore());
  const s = prefs.get();
  assert.equal(s.lang, 'en');
  assert.equal(s.chosen, false);
  assert.equal(s.theme, 'auto');
  assert.equal(s.scale, 1);
});

test('language cycles en → zh → en and counts as chosen', () => {
  prefs.init(memStore());
  assert.deepEqual([prefs.cycleLang(), prefs.cycleLang()], ['zh', 'en']);
  assert.equal(prefs.get().chosen, true);
  assert.throws(() => prefs.chooseLang('ms'), RangeError);
});

test('theme cycles auto → light → dark → auto', () => {
  prefs.init(memStore());
  assert.deepEqual([prefs.cycleTheme(), prefs.cycleTheme(), prefs.cycleTheme()], ['light', 'dark', 'auto']);
});

test('six text sizes; the scale wraps from 1.75 back to 0.9', () => {
  prefs.init(memStore());
  assert.deepEqual([1, 2, 3, 4, 5].map(() => prefs.cycleFontScale()), [1.15, 1.3, 1.5, 1.75, 0.9]);
  assert.equal(prefs.setScale(2), 0.9);
});

test('prefs works when localStorage throws', () => {
  prefs.init(throwing);
  prefs.chooseLang('zh');
  assert.equal(prefs.get().lang, 'zh');
  assert.equal(prefs.get().chosen, true);
});

test('state round-trips through storage', () => {
  const store = memStore();
  prefs.init(store);
  prefs.chooseLang('zh');
  prefs.markRead('c05', true);
  prefs.setQuizBest(3, 9);
  prefs.setAnswer('c05/loss#3', 2);
  prefs.setLastRoute('#/ch/c05/loss');
  prefs.setSeenVersion('1.0.0');
  prefs.init(store);
  const s = prefs.get();
  assert.equal(s.lang, 'zh');
  assert.equal(s.read.c05, true);
  assert.equal(s.quiz[3], 9);
  assert.equal(s.answers['c05/loss#3'], 2);
  assert.equal(s.lastRoute, '#/ch/c05/loss');
  assert.equal(s.seenVersion, '1.0.0');
});

test('quiz best only goes up; unread removes the mark', () => {
  prefs.init(memStore());
  prefs.setQuizBest(1, 7); prefs.setQuizBest(1, 5);
  assert.equal(prefs.get().quiz[1], 7);
  prefs.markRead('ch01', true); prefs.markRead('ch01', false);
  assert.equal(prefs.get().read.ch01, undefined);
});

test('corrupted storage falls back to defaults', () => {
  prefs.init(memStore({ 'ml.prefs.v1': '{"lang":"xx","chosen":true,"scale":9}' }));
  const s = prefs.get();
  assert.equal(s.lang, 'en'); assert.equal(s.chosen, false); assert.equal(s.scale, 1);
});

test('subscribers hear changes and can unsubscribe', () => {
  prefs.init(memStore());
  const seen = [];
  const off = prefs.subscribe(what => seen.push(what));
  prefs.cycleTheme(); off(); prefs.cycleTheme();
  assert.deepEqual(seen, ['theme']);
});

test('reset clears progress and answers but keeps settings', () => {
  prefs.init(memStore());
  prefs.chooseLang('zh'); prefs.markRead('c01', true); prefs.setAnswer('c01/x#1', 0);
  prefs.resetProgress();
  const s = prefs.get();
  assert.deepEqual([s.read, s.answers, s.lang], [{}, {}, 'zh']);
});

test('stored answers are checked, not trusted', () => {
  prefs.init(memStore({ 'ml.prefs.v1': JSON.stringify({ answers: { 'c01/a#1': 2, 'c01/b#2': -1, 'c01/c#3': 'x', 'c01/d#4': 1.5 } }) }));
  assert.deepEqual(prefs.get().answers, { 'c01/a#1': 2 });
});

test('light and dark looks default to classic and midnight; bad stored values fall back', () => {
  prefs.init(memStore({ 'ml.prefs.v1': JSON.stringify({ lightTheme: 'neon', darkTheme: 'oled' }) }));
  const s = prefs.get();
  assert.equal(s.lightTheme, 'classic');
  assert.equal(s.darkTheme, 'oled');
});

test('picking a look shows it: a fixed mode switches to that side, auto stays auto', () => {
  prefs.init(memStore());
  assert.equal(prefs.setDarkTheme('grape'), 'grape');
  assert.equal(prefs.get().theme, 'auto');
  prefs.setTheme('light');
  prefs.setDarkTheme('slate');
  assert.equal(prefs.get().theme, 'dark');
  prefs.setLightTheme('mint');
  assert.equal(prefs.get().theme, 'light');
  assert.equal(prefs.setLightTheme('neon'), 'mint');
});

test('applyToDocument sets the palette for the side in use', () => {
  prefs.init(memStore());
  prefs.setLightTheme('paper'); prefs.setDarkTheme('oled'); prefs.setTheme('auto');
  const doc = { documentElement: { dataset: {}, style: { setProperty() {} } } };
  prefs.applyToDocument(doc, true);
  assert.deepEqual([doc.documentElement.dataset.theme, doc.documentElement.dataset.palette], ['dark', 'oled']);
  prefs.applyToDocument(doc, false);
  assert.deepEqual([doc.documentElement.dataset.theme, doc.documentElement.dataset.palette], ['light', 'paper']);
});
