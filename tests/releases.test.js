import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notesSince, compareVersions } from '../js/releases.js';

const list = [
  { v: '1.2.0', notes: [] }, { v: '1.10.0', notes: [] }, { v: '1.0.0', notes: [] }, { v: '1.1.0', notes: [] },
];
test('versions compare numerically', () => {
  assert.ok(compareVersions('1.10.0', '1.2.0') > 0);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
});
test('notes newer than the seen version, newest first', () => {
  assert.deepEqual(notesSince(list, '1.1.0').map(r => r.v), ['1.10.0', '1.2.0']);
});
test('nothing new after the latest', () => assert.deepEqual(notesSince(list, '1.10.0'), []));
test('unknown or garbage seen version yields nothing', () => {
  assert.deepEqual(notesSince(list, ''), []);
  assert.deepEqual(notesSince(list, 'abc'), []);
});
test('releases.json is trilingual and newest-first', () => {
  const rel = JSON.parse(readFileSync(new URL('../data/releases.json', import.meta.url), 'utf8'));
  assert.ok(rel.length >= 1);
  for (const r of rel) for (const n of r.notes) for (const l of ['zh', 'en', 'ms']) assert.ok(n[l], `${r.v} ${l}`);
  for (let i = 1; i < rel.length; i++) assert.ok(compareVersions(rel[i - 1].v, rel[i].v) > 0);
});
