/**
 * Emit every mask variant of every test payload, as JSON, for tools/verify-qr.py
 * to decode and score.
 *
 * The module's internals are re-exported here rather than duplicated, so the
 * code under test is exactly the code that ships.
 *
 *   node tools/verify-qr.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'js', 'qrcode.js'), 'utf8');

// Strip the `export` keywords so the module-private helpers become reachable,
// then re-export the pieces the harness needs.
const probeModule = await import(
  'data:text/javascript;base64,' + Buffer.from(
    source.replace(/^export /gm, '') + `
export function probe(text) {
  const { version, codewords } = buildCodewords(text);
  const size = version * 4 + 17;
  const masks = [];
  for (let mask = 0; mask < 8; mask++) {
    const m = newMatrix(size);
    placeFunctions(m, version);
    placeData(m, codewords);
    applyMask(m, mask);
    writeFormat(m, mask);
    let bits = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) bits += m.px[y][x] === 1 ? '1' : '0';
    }
    masks.push({ mask, score: penalty(m), bits });
  }
  const chosen = masks.reduce((a, b) => (b.score < a.score ? b : a)).mask;
  return { text, version, size, chosen, masks };
}
`).toString('base64')
);

const { APP_URL } = await import('../js/config.js');

// The app's own URL first: it is the payload the share sheet actually encodes.
const CASES = [
  APP_URL,
  'HELLO WORLD',
  'a',
  'https://example.com/a-fairly-long-path/that-pushes-into-a-higher-version?x=1&y=2',
  'x'.repeat(120),
  'x'.repeat(200),
  '植物生理学 Plant Physiology',
];

console.log(JSON.stringify(CASES.map(probeModule.probe)));
