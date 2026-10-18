import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, search, normalise, plain } from '../js/search.js';

const read = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8'));
const index = buildIndex([read('c02')], read('terms'));

test('a Chinese query finds the lesson, titled in the reading language', () => {
  const hits = search(index, '梯度下降', 'en');
  assert.ok(hits.some(h => h.route === '#/ch/c02/gradient-descent'));
  assert.ok(hits.every(h => !/[一-鿿]/.test(h.title)), hits.map(h => h.title).join(' | '));
});
test('Latin search ignores case and accents', () => {
  assert.ok(search(index, 'GRADIENT DESCENT', 'zh').length > 0);
  assert.equal(normalise('Évaluation'), 'evaluation');
});
test('all words must match', () => {
  assert.ok(search(index, 'learning rate', 'en').length > 0);
  assert.equal(search(index, 'learning zebra', 'en').length, 0);
});
test('glossary terms are found and open the term', () => {
  assert.ok(search(index, 'convex function', 'en').some(h => h.route === '#/term/convex-function'));
});
test('snippets contain no markup', () => {
  for (const h of search(index, 'loss', 'en')) assert.ok(!/[<>]/.test(h.snippet), h.snippet);
  assert.equal(plain('<b>a</b> &amp; b'), 'a & b');
});
test('empty query returns nothing', () => assert.deepEqual(search(index, '  ', 'en'), []));
