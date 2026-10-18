import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scale, clamp, valueAt, niceTicks, fmt } from '../js/widgets/kit.js';

test('scale maps a domain onto a range and back', () => {
  const s = scale(0, 40, 50, 450);
  assert.equal(s(0), 50); assert.equal(s(40), 450); assert.equal(s(10), 150);
  assert.equal(s.invert(150), 10);
});
test('scale works with an inverted range (SVG y grows downward)', () => {
  const s = scale(0, 100, 300, 20);
  assert.equal(s(100), 20); assert.equal(s.invert(300), 0);
});
test('clamp', () => { assert.equal(clamp(5, 0, 3), 3); assert.equal(clamp(-1, 0, 3), 0); assert.equal(clamp(2, 0, 3), 2); });
test('widget clamps pointer outside the plot', () => {
  // plot from x=40 to x=340, value 0–45 in steps of 0.5
  assert.equal(valueAt(1000, 40, 300, 0, 45, 0.5), 45);
  assert.equal(valueAt(-50, 40, 300, 0, 45, 0.5), 0);
  assert.equal(valueAt(190, 40, 300, 0, 45, 0.5), 22.5);
  assert.equal(valueAt(191, 40, 300, 0, 45, 0.5), 22.5);
});
test('niceTicks gives round steps that cover the domain', () => {
  assert.deepEqual(niceTicks(0, 45, 5), [0, 10, 20, 30, 40]);
  assert.deepEqual(niceTicks(22, 32, 5), [22, 24, 26, 28, 30, 32]);
});
test('fmt shows a dash for missing numbers', () => {
  assert.equal(fmt(null, 1), '—'); assert.equal(fmt(NaN, 1), '—'); assert.equal(fmt(12.345, 1), '12.3');
});
