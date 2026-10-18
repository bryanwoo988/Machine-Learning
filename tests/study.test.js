import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as study from '../js/study.js';

function memory() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m }; }
let store;
beforeEach(() => { store = memory(); study.init(store); });

test('favourites toggle and persist', () => {
  assert.equal(study.toggleFav('c03'), true);
  study.init(store);
  assert.equal(study.isFav('c03'), true);
  assert.equal(study.toggleFav('c03'), false);
  study.init(store);
  assert.equal(study.isFav('c03'), false);
});

test('module notes: saved, blank removes', () => {
  study.setChapterNote('c02', 'my note');
  study.init(store);
  assert.equal(study.chapterNote('c02'), 'my note');
  study.setChapterNote('c02', '   ');
  assert.equal(study.chapterNote('c02'), '');
  assert.deepEqual(study.get().notes, {});
});

test('a backup merges in and bad entries are dropped', () => {
  study.setChapterNote('c01', 'kept');
  study.merge({ fav: { c04: 9, bad: 1 }, notes: { c05: 'from backup', c06: '  ', x: 'y' } });
  assert.deepEqual(study.get(), { fav: { c04: 9 }, notes: { c01: 'kept', c05: 'from backup' } });
});

test('corrupt storage is rejected', () => {
  store.setItem('ml.study.v1', '{"fav":{"x":1},"notes":{"c02":"  "}}');
  study.init(store);
  assert.deepEqual(study.get(), { fav: {}, notes: {} });
  store.setItem('ml.study.v1', 'not json');
  assert.deepEqual(study.init(store), { fav: {}, notes: {} });
});

test('works with no storage at all', () => {
  study.init(null);
  assert.equal(study.toggleFav('c01'), true);
});
