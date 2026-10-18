import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_URL, AUTHOR } from '../js/config.js';

test('config names the published URL and author', () => {
  assert.equal(APP_URL, 'https://bryanwoo988.github.io/Machine-Learning/');
  assert.equal(AUTHOR, 'Bryan Woo');
});
