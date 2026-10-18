/* Check that every outside link in the content still answers.

     node tools/check-links.mjs            report only
     node tools/check-links.mjs --strict   exit 1 on any failure

   Official sites get reorganised; a dead link in a dataset card makes the
   card useless. CI runs this weekly (.github/workflows/links.yml) and
   reports — it never blocks a deploy, because a site being down for an
   hour is not a reason to hold back a fix. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_RE = /https:\/\/[^\s"'<>\]]+/g;

// Trailing punctuation from prose is not part of the link; a ')' is, only if it closes a '(' inside the URL.
function trim(url) {
  let u = url.replace(/[.,;]+$/, '');
  while (u.endsWith(')') && (u.match(/\(/g) ?? []).length < (u.match(/\)/g) ?? []).length) u = u.slice(0, -1);
  return u;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// URL → files it appears in.
export function collectUrls(root) {
  const found = new Map();
  for (const file of walk(join(root, 'data'))) {
    const rel = relative(root, file).split('\\').join('/');
    for (const url of readFileSync(file, 'utf8').match(URL_RE) ?? []) {
      const clean = trim(url);
      const where = found.get(clean) ?? [];
      if (!where.includes(rel)) where.push(rel);
      found.set(clean, where);
    }
  }
  return found;
}

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'PlantPhysiology-PWA link check' } });
      if (r.ok) return { ok: true, status: r.status };
      // The server answered but refuses robots (journal publishers do this): the link itself is fine.
      if ([401, 403, 429].includes(r.status)) return { ok: true, status: r.status, blocked: true };
      if (method === 'GET') return { ok: false, status: r.status };
    } catch (e) {
      if (method === 'GET') return { ok: false, status: e.name };
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const urls = collectUrls(root);
  let bad = 0;
  for (const [url, where] of urls) {
    const r = await check(url);
    if (!r.ok) { bad++; console.log(`✗ ${r.status}  ${url}\n    in ${where.join(', ')}`); }
    else if (r.blocked) console.log(`· ${r.status}  ${url} (refuses automated checks; not counted)`);
  }
  console.log(`${urls.size} links checked, ${bad} failed`);
  if (bad && process.argv.includes('--strict')) process.exit(1);
}
