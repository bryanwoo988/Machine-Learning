/* Which requests the service worker answers from its cache.

   The whole app is precached, and every other origin is something the
   reader opens on purpose (a data portal, a model's website) — never
   cached, so a link always shows the live page. The same function is
   inlined in sw.js; tests/swpolicy.test.js checks the two copies match. */

export function cacheStrategy(urlString, selfOrigin) {
  let u;
  try { u = new URL(urlString); } catch (e) { return 'never'; }
  return u.origin === selfOrigin ? 'precache' : 'never';
}

// Cache entries are keyed without the query string.
export function cacheKey(urlString) {
  const u = new URL(urlString);
  u.search = '';
  return u.href;
}
