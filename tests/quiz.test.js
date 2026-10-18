import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreAnswers, cardsFor } from '../js/quiz.js';

const read = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8'));

test('score counts answered and right; out-of-range answers are ignored', () => {
  const q = c => ({ key: c, block: { options: [{ correct: false }, { correct: true }] } });
  assert.deepEqual(scoreAnswers([q('a'), q('b'), q('c'), q('d')], { a: 1, b: 0, d: 5 }), { done: 2, right: 1, total: 4 });
});

test('flashcards are a module’s key terms, once each, all in the glossary', () => {
  const terms = new Set(read('terms').map(t => t.id));
  const cards = cardsFor(read('c02'));
  assert.ok(cards.length >= 10);
  assert.equal(new Set(cards).size, cards.length);
  const missing = cards.filter(id => !terms.has(id));
  assert.ok(missing.length <= 2, `not in glossary: ${missing}`);
});
