import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreQuiz, questionsFor, cardsFor } from '../js/quiz.js';

const quiz = JSON.parse(readFileSync(new URL('../data/quiz.json', import.meta.url), 'utf8'));
const terms = JSON.parse(readFileSync(new URL('../data/terms.json', import.meta.url), 'utf8'));
const stages = [{ n: 3, chapters: ['ch11', 'ch12', 'ch13', 'ch14', 'ch15'] }];

test('score counts right answers; unanswered is wrong', () => {
  const qs = [{ answer: 0 }, { answer: 2 }, { answer: 1 }];
  assert.deepEqual(scoreQuiz([0, 1, undefined], qs), { correct: 1, total: 3 });
});
test('questions for a stage come from that stage only', () => {
  const qs = questionsFor(quiz, 3);
  assert.ok(qs.length >= 2 && qs.every(q => q.stage === 3));
  assert.deepEqual(questionsFor(quiz, 10), []);
  assert.ok(questionsFor(quiz, 5).length >= 8);

});
test('every question has four options and a valid answer', () => {
  for (const q of quiz) { assert.equal(q.options.length, 4); assert.ok(q.answer >= 0 && q.answer <= 3); }
});
test('flashcards for a stage are the terms taught in its chapters', () => {
  const cards = cardsFor(terms, stages, 3);
  assert.ok(cards.length >= 9);
  assert.ok(cards.every(c => c.chapter >= 11 && c.chapter <= 15));
});
