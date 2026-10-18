import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xLabel } from '../js/charts.js';

test('date format shows day and month in each language', () => {
  assert.equal(xLabel('2026-09-18', 'date', 'en'), '18 Sep');
  assert.equal(xLabel('2026-09-18', 'date', 'ms'), '18 Sep');
  assert.equal(xLabel('2026-08-03', 'date', 'zh'), '8月3日');
});

test('existing formats are unchanged', () => {
  assert.equal(xLabel(7, 'hour', 'en'), '07:00');
  assert.equal(xLabel(3, 'month', 'ms'), 'Mac');
  assert.equal(xLabel('1997 NDJ', 'year', 'en'), '1997');
});
