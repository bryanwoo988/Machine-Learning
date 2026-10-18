import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as study from '../js/study.js';

function memory() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m }; }
let store;
beforeEach(() => { store = memory(); study.init(store); });

const oldMark = { id: 'm1', ch: 'ch01', lang: 'en', blk: 's1:0', start: 2, end: 10, text: 'abcdefgh', style: 'underline', note: 'n', at: 5 };

test('favourites toggle and persist', () => {
  assert.equal(study.toggleFav('ch03'), true);
  study.init(store);
  assert.equal(study.isFav('ch03'), true);
  assert.equal(study.toggleFav('ch03'), false);
  study.init(store);
  assert.equal(study.isFav('ch03'), false);
});

test('chapter notes: saved, blank removes', () => {
  study.setChapterNote('ch02', 'my note');
  study.init(store);
  assert.equal(study.chapterNote('ch02'), 'my note');
  study.setChapterNote('ch02', '   ');
  assert.equal(study.chapterNote('ch02'), '');
  assert.deepEqual(study.get().notes, {});
});

test('marks and section bookmarks from before 1.2.0 are handed over, then dropped', () => {
  store.setItem('pphys.study.v1', JSON.stringify({ fav: { ch01: 1 }, bm: { 'ch03/s2': 7, bad: 1 }, marks: [oldMark, { ch: 'ch01' }], notes: { ch04: 'x' } }));
  study.init(store);
  const old = study.legacy();
  assert.equal(old.marks.length, 1);
  assert.equal(old.marks[0].style, 'underline');
  assert.equal(old.marks[0].note, 'n');
  assert.deepEqual(old.bm, { 'ch03/s2': 7 });
  study.dropLegacy();
  study.init(store);
  assert.deepEqual(study.legacy(), { marks: [], bm: {} });
  // Favourites and chapter notes stay; the old marks are kept aside.
  assert.equal(study.isFav('ch01'), true);
  assert.equal(study.chapterNote('ch04'), 'x');
  assert.equal(JSON.parse(store.getItem('pphys.study.v1.before-1.2')).marks.length, 1);
});

test('corrupt storage is rejected', () => {
  store.setItem('pphys.study.v1', '{"fav":{"x":1},"marks":[{"ch":"ch01"}],"notes":{"ch02":"  "}}');
  study.init(store);
  assert.deepEqual(study.get(), { fav: {}, notes: {} });
  store.setItem('pphys.study.v1', 'not json');
  study.init(store);
  assert.deepEqual(study.legacy(), { marks: [], bm: {} });
});

test('works with no storage at all', () => {
  study.init(null);
  assert.equal(study.toggleFav('ch01'), true);
  study.dropLegacy();
});
