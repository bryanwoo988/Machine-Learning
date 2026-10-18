/* Regenerate the service worker's precache list and cache name.

     node tools/build-sw.mjs

   The name is a hash of every precached file's path and contents, so any
   change ships to installed copies with nothing to remember. CI runs this
   on every push. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['css', 'js', 'data', 'icons', 'img', 'vendor'];
const FILES = ['index.html', 'manifest.webmanifest', 'favicon.ico'];
const SKIP = /(^\.|\.DS_Store$|~$)/;

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    if (SKIP.test(name)) continue;
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const files = [
  ...FILES.filter(f => existsSync(join(ROOT, f))),
  ...DIRS.filter(d => existsSync(join(ROOT, d))).flatMap(d => walk(d)),
].sort();

const hash = createHash('sha256');
for (const f of files) { hash.update(f); hash.update(readFileSync(join(ROOT, f))); }
const cache = `ml-${hash.digest('hex').slice(0, 10)}`;

const block = [
  '/* --- generated:begin --- */',
  `const CACHE = '${cache}';`,
  'const ASSETS = [',
  "  './',",
  ...files.map(f => `  '${f}',`),
  '];',
  '/* --- generated:end --- */',
].join('\n');

const path = join(ROOT, 'sw.js');
const sw = readFileSync(path, 'utf8');
const re = /\/\* --- generated:begin --- \*\/[\s\S]*?\/\* --- generated:end --- \*\//;
if (!re.test(sw)) { console.error('sw.js has no generated block'); process.exit(1); }
writeFileSync(path, sw.replace(re, block));

const bytes = files.reduce((a, f) => a + statSync(join(ROOT, f)).size, 0);
console.log(`precache: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB`);
console.log(`cache:    ${cache}`);
