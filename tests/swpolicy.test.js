import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cacheStrategy, cacheKey } from '../js/swpolicy.js';

const SELF = 'https://bryanwoo988.github.io';

test('own files are served from the precache', () => {
  assert.equal(cacheStrategy(`${SELF}/plant-physiology/data/ch05.json`, SELF), 'precache');
});
test('other origins are never cached', () => {
  assert.equal(cacheStrategy('https://api.open-meteo.com/v1/forecast?x=1', SELF), 'never');
  assert.equal(cacheStrategy('https://www.ecmwf.int/', SELF), 'never');
});
test('garbage URLs are never cached', () => assert.equal(cacheStrategy('not a url', SELF), 'never'));
test('cache key drops the query', () => {
  assert.equal(cacheKey(`${SELF}/plant-physiology/js/app.js?r=123`), `${SELF}/plant-physiology/js/app.js`);
});
test('sw.js carries the same cacheStrategy as swpolicy.js', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../js/swpolicy.js', import.meta.url), 'utf8');
  const fn = src => src.match(/function cacheStrategy[\s\S]*?\n}/)[0];
  assert.equal(fn(sw), fn(lib));
});
