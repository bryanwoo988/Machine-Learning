import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, t, UI, LANG_GLYPH, LANG_NATIVE } from '../js/i18n.js';

test('pick resolves the requested language', () => {
  assert.equal(pick({ zh: '甲', en: 'A', ms: 'B' }, 'ms'), 'B');
});
test('pick passes plain strings and numbers through', () => {
  assert.equal(pick('hPa', 'zh'), 'hPa');
  assert.equal(pick(850, 'zh'), '850');
});
test('every UI string has all three languages', () => {
  for (const [k, v] of Object.entries(UI)) for (const l of ['zh', 'en', 'ms']) assert.ok(v[l], `${k}.${l}`);
});
test('t interpolates', () => {
  assert.equal(t('stageN', { n: 3 }, 'en'), 'Stage 3');
});
test('glyphs and native names', () => {
  assert.deepEqual(LANG_GLYPH, { zh: '中', en: 'EN', ms: 'BM' });
  assert.equal(LANG_NATIVE.ms, 'Bahasa Melayu');
});
