/* Runs the real sw.js in a stubbed ServiceWorkerGlobalScope: its install,
   activate and fetch handlers against fake Cache Storage and a fake network,
   so the caching behaviour is tested rather than assumed. Ported from
   OilPalmWiki/tools/test-sw.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://bryanwoo988.github.io';
const BASE = '/Machine-Learning/';

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body; this.status = init.status ?? 200; this.url = init.url ?? '';
  }
  get ok() { return this.status >= 200 && this.status < 300; }
  clone() { return new FakeResponse(this.body, this); }
  static redirect(url, status = 302) { const r = new FakeResponse(null, { status }); r.location = url; return r; }
}
class FakeRequest {
  constructor(url, init = {}) {
    this.url = new URL(url, ORIGIN + BASE).href; this.method = init.method ?? 'GET'; this.mode = init.mode ?? 'no-cors';
  }
}
class FakeCache {
  constructor(net) { this.map = new Map(); this.net = net; }
  async add(req) {
    const r = typeof req === 'string' ? new FakeRequest(req) : req;
    const res = await this.net(r);
    if (!res.ok) throw new Error(`failed ${r.url}`);
    this.map.set(new URL(r.url).pathname, res);
  }
  async put(req, res) { this.map.set(new URL(typeof req === 'string' ? req : req.url, ORIGIN + BASE).pathname, res); }
  async match(req) { return this.map.get(new URL(typeof req === 'string' ? req : req.url, ORIGIN + BASE).pathname); }
  async keys() { return [...this.map.keys()].map(p => new FakeRequest(p)); }
}

function makeScope(network) {
  const caches = new Map(), listeners = new Map();
  const scope = {
    location: new URL(ORIGIN + BASE + 'sw.js'),
    caches: {
      async open(n) { if (!caches.has(n)) caches.set(n, new FakeCache(scope.fetch)); return caches.get(n); },
      async keys() { return [...caches.keys()]; },
      async delete(n) { return caches.delete(n); },
      async match(req) { for (const c of caches.values()) { const h = await c.match(req); if (h) return h; } },
    },
    fetch: network, Request: FakeRequest, Response: FakeResponse, URL, console,
    skips: 0, claims: 0,
    async skipWaiting() { scope.skips++; },
    clients: { async claim() { scope.claims++; } },
    addEventListener(t, fn) { (listeners.get(t) ?? listeners.set(t, []).get(t)).push(fn); },
    async dispatch(type, event) {
      const waits = [], responses = [];
      let handled = false;
      const ev = { ...event, waitUntil: p => waits.push(p), respondWith: p => { handled = true; responses.push(p); } };
      for (const fn of listeners.get(type) ?? []) fn(ev);
      await Promise.all(waits);
      return { handled, res: responses.length ? await responses[0] : undefined };
    },
  };
  scope.self = scope;
  return scope;
}

const missing = [];
const disk = async req => {
  const path = new URL(req.url).pathname.slice(BASE.length) || 'index.html';
  if (!existsSync(join(ROOT, decodeURIComponent(path)))) { missing.push(path); return new FakeResponse(null, { status: 404 }); }
  return new FakeResponse(`contents of ${path}`, { url: req.url });
};

const scope = makeScope(disk);
vm.createContext(scope);
vm.runInContext(readFileSync(join(ROOT, 'sw.js'), 'utf8'), scope, { filename: 'sw.js' });
await scope.dispatch('install', {});
const [cacheName] = await scope.caches.keys();

test('every precached asset exists on disk', () => assert.deepEqual(missing, []));
test('one cache, named by a content hash', () => assert.match(cacheName, /^ml-[0-9a-f]{10}$/));
test('install skips waiting', () => assert.ok(scope.skips > 0));

test('activate removes old versions of this app only', async () => {
  await (await scope.caches.open('ml-deadbeef00')).put('x.js', new FakeResponse('old'));
  // Other apps on the same github.io origin keep their caches.
  await (await scope.caches.open('opwiki-1234567890')).put('y.js', new FakeResponse('other'));
  await scope.dispatch('activate', {});
  assert.deepEqual((await scope.caches.keys()).sort(), [cacheName, 'opwiki-1234567890'].sort());
  assert.ok(scope.claims > 0);
});

test('offline: a precached file is served without the network', async () => {
  let calls = 0;
  scope.fetch = async () => { calls++; throw new Error('offline'); };
  const { res } = await scope.dispatch('fetch', { request: new FakeRequest('css/app.css', { mode: 'cors' }) });
  assert.ok(res?.ok); assert.equal(calls, 0);
});

test('offline: the scope root is served the cached shell', async () => {
  scope.fetch = async () => { throw new Error('offline'); };
  const { res } = await scope.dispatch('fetch', { request: new FakeRequest(BASE, { mode: 'navigate' }) });
  assert.ok(res?.ok);
});

test('offline: a nested navigation redirects to the scope root', async () => {
  scope.fetch = async () => { throw new Error('offline'); };
  const { res } = await scope.dispatch('fetch', { request: new FakeRequest(BASE + 'deep/link', { mode: 'navigate' }) });
  assert.equal(res?.status, 302); assert.equal(res.location, BASE);
});

test('other origins are not intercepted', async () => {
  const { handled } = await scope.dispatch('fetch', { request: new FakeRequest('https://api.open-meteo.com/v1/forecast', { mode: 'cors' }) });
  assert.equal(handled, false);
});

test('non-GET requests (the update check HEAD) are not intercepted', async () => {
  const { handled } = await scope.dispatch('fetch', { request: new FakeRequest('index.html', { method: 'HEAD' }) });
  assert.equal(handled, false);
});
