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

test('language cycles zh → en → ms → zh and counts as chosen', () => {
  prefs.init(memStore());
  prefs.chooseLang('zh');
  assert.deepEqual([prefs.cycleLang(), prefs.cycleLang(), prefs.cycleLang()], ['en', 'ms', 'zh']);
  assert.equal(prefs.get().chosen, true);
});

test('theme cycles auto → light → dark → auto', () => {
  prefs.init(memStore());
  assert.deepEqual([prefs.cycleTheme(), prefs.cycleTheme(), prefs.cycleTheme()], ['light', 'dark', 'auto']);
});

test('font scale wraps from 1.5 back to 1', () => {
  prefs.init(memStore());
  assert.deepEqual([1, 2, 3, 4].map(() => prefs.cycleFontScale()), [1.15, 1.3, 1.5, 1]);
});

test('prefs works when localStorage throws', () => {
  prefs.init(throwing);
  prefs.chooseLang('ms');
  assert.equal(prefs.get().lang, 'ms');
  assert.equal(prefs.get().chosen, true);
});

test('state round-trips through storage', () => {
  const store = memStore();
  prefs.init(store);
  prefs.chooseLang('ms');
  prefs.markRead('ch05', true);
  prefs.setQuizBest(3, 9);
  prefs.setLastRoute('#/ch/ch05');
  prefs.setSeenVersion('1.0.0');
  prefs.init(store);
  const s = prefs.get();
  assert.equal(s.lang, 'ms');
  assert.equal(s.read.ch05, true);
  assert.equal(s.quiz[3], 9);
  assert.equal(s.lastRoute, '#/ch/ch05');
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
  prefs.init(memStore({ 'pphys.prefs.v1': '{"lang":"xx","chosen":true,"scale":9}' }));
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
