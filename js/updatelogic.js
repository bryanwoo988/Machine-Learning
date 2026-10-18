/* Getting a new build onto phones that already have the app open.

   Ported from CompareCast. A home-screen app on an iPhone is resumed far
   more often than relaunched, so it could run an old build for days. The
   page checks for a newer build when it opens, when it comes back to the
   screen, and every fifteen minutes in use; these functions decide what a
   check means. */

/* Is the index.html live on the server newer than the one running?
   Both stamps are index.html's Last-Modified, which GitHub Pages sets on
   every deploy: the running one from document.lastModified (local time),
   the live one from a HEAD request (an HTTP date). Nobody has to bump a
   version number. Only newer counts — a rollback is not pushed — and
   anything unreadable counts as no update. */
export function newerRevision(running, live) {
  const a = Date.parse(String(running || '')), b = Date.parse(String(live || ''));
  return Number.isFinite(a) && Number.isFinite(b) && b - a >= 1000;
}

/* apply  — reload now: just opened or brought back, or the reader asked
   banner — offer it: someone reading is never pulled out of the page
   defer  — in the background: decide when it comes back */
export const JUST_MS = 3000;
export function updateAction(s) {
  if (s.hidden) return 'defer';
  if (s.asked) return 'apply';
  if (!s.busy && s.sinceVisibleMs <= JUST_MS) return 'apply';
  return 'banner';
}

/* One automatic reload per version per ten minutes. Without a service
   worker in control, GitHub Pages' max-age=600 can serve the old files
   again; reloading again would loop. After one try the update is offered
   instead, and a tap on it always goes through. */
export const RETRY_MS = 10 * 60e3;
export function mayAutoReload(tried, v, now) {
  return !(tried && tried.v === v && now - tried.at < RETRY_MS);
}
