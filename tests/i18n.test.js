import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, t, UI, LANG_NATIVE } from '../js/i18n.js';

test('pick resolves the requested language and falls back to English', () => {
  assert.equal(pick({ en: 'A', zh: '甲' }, 'zh'), '甲');
  assert.equal(pick({ en: 'A' }, 'zh'), 'A');
});
test('pick passes plain strings and numbers through', () => {
  assert.equal(pick('MSE', 'zh'), 'MSE');
  assert.equal(pick(850, 'zh'), '850');
});
// Two notes only matter in Chinese (they explain English shown in the Chinese view).
const ZH_ONLY = new Set(['takeawaysEnOnly', 'enOnlyBlock']);
test('every UI string has English and Chinese', () => {
  for (const [k, v] of Object.entries(UI)) {
    assert.ok(v.zh, `${k}.zh`);
    if (!ZH_ONLY.has(k)) assert.ok(v.en, `${k}.en`);
    assert.equal(v.ms, undefined, `${k} has no Malay`);
  }
});
test('t interpolates', () => {
  assert.equal(t('chapterN', { n: 3 }, 'en'), 'Module 3');
  assert.equal(t('chapterN', { n: 3 }, 'zh'), '第 3 单元');
});
test('native names', () => assert.deepEqual(LANG_NATIVE, { en: 'English', zh: '中文' }));
