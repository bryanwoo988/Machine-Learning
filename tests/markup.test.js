import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, termIds } from '../js/markup.js';

test('terms and labels are split out of text', () => {
  assert.deepEqual(parseInline('A {{t:dew-point}} and {{t:lcl|cloud base}}.'), [
    { text: 'A ' }, { term: 'dew-point' }, { text: ' and ' }, { term: 'lcl', label: 'cloud base' }, { text: '.' },
  ]);
});
test('an unclosed marker stays text', () => {
  assert.deepEqual(parseInline('see {{t:x'), [{ text: 'see {{t:x' }]);
});
test('plain text is one piece; empty is none', () => {
  assert.deepEqual(parseInline('just text'), [{ text: 'just text' }]);
  assert.deepEqual(parseInline(''), []);
});
test('termIds lists ids in order', () => {
  assert.deepEqual(termIds('{{t:a}} x {{t:b|B}} {{t:a}}'), ['a', 'b', 'a']);
});

test('chapter links are split out, with their label', () => {
  assert.deepEqual(parseInline('see {{ch:ch09|Chapter 9}} and {{t:lcl}}'), [
    { text: 'see ' }, { chapter: 'ch09', label: 'Chapter 9' }, { text: ' and ' }, { term: 'lcl' },
  ]);
  assert.deepEqual(termIds('{{ch:ch09|x}} {{t:a}}'), ['a']);
});
test('chapterIds lists linked chapters', async () => {
  const { chapterIds } = await import('../js/markup.js');
  assert.deepEqual(chapterIds('{{ch:ch09|a}} {{ch:ch23|b}}'), ['ch09', 'ch23']);
});
