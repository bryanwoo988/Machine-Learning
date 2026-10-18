import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newerRevision, updateAction, mayAutoReload, JUST_MS, RETRY_MS } from '../js/updatelogic.js';

// Running page: document.lastModified, local time "MM/DD/YYYY hh:mm:ss".
// Live page: the Last-Modified header of a HEAD on index.html, an HTTP date.
const pad = n => String(n).padStart(2, '0');
const docStamp = ms => { const d = new Date(ms);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const httpStamp = ms => new Date(ms).toUTCString();
const DEPLOY = Date.UTC(2026, 9, 2, 1, 0, 0);

test('same revision in both notations is not newer', () => {
  assert.equal(newerRevision(docStamp(DEPLOY), httpStamp(DEPLOY)), false);
});
test('a revision one second newer is newer', () => {
  assert.equal(newerRevision(docStamp(DEPLOY), httpStamp(DEPLOY + 1000)), true);
});
test('an older live revision (rollback) is not pushed', () => {
  assert.equal(newerRevision(docStamp(DEPLOY), httpStamp(DEPLOY - 600e3)), false);
});
test('unreadable stamps never count as an update', () => {
  assert.equal(newerRevision(docStamp(DEPLOY), null), false);
  assert.equal(newerRevision('', httpStamp(DEPLOY)), false);
  assert.equal(newerRevision(docStamp(DEPLOY), 'garbage'), false);
});

test('just opened: apply', () => assert.equal(updateAction({ hidden: false, sinceVisibleMs: 800, busy: false }), 'apply'));
test('reading: banner, never a reload', () => assert.equal(updateAction({ hidden: false, sinceVisibleMs: 100, busy: true }), 'banner'));
test('open for a while: banner', () => assert.equal(updateAction({ hidden: false, sinceVisibleMs: 60000, busy: false }), 'banner'));
test('in the background: defer', () => assert.equal(updateAction({ hidden: true, sinceVisibleMs: 0, busy: false }), 'defer'));
test('asked for it: apply', () => assert.equal(updateAction({ hidden: false, sinceVisibleMs: 60000, busy: true, asked: true }), 'apply'));
test('just means three seconds', () => assert.equal(JUST_MS, 3000));

const T0 = 1790000000000;
test('first automatic reload is allowed', () => assert.equal(mayAutoReload(null, 'x', T0), true));
test('no second automatic reload of the same version within ten minutes', () => {
  assert.equal(mayAutoReload({ v: 'x', at: 0 }, 'x', 5 * 60e3), false);
});
test('allowed again after ten minutes, or for a newer version', () => {
  assert.equal(mayAutoReload({ v: 'x', at: T0 }, 'x', T0 + RETRY_MS + 1), true);
  assert.equal(mayAutoReload({ v: 'x', at: T0 }, 'y', T0 + 1), true);
});
