import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectUrls } from '../tools/check-links.mjs';

test('collectUrls finds nested https URLs once each, with where they were found', () => {
  const root = mkdtempSync(join(tmpdir(), 'meteo-links-'));
  mkdirSync(join(root, 'data', 'series'), { recursive: true });
  writeFileSync(join(root, 'data', 'a.json'), JSON.stringify({ links: [{ url: 'https://www.ecmwf.int/' }, { url: 'https://www.ecmwf.int/' }], note: 'see https://www.met.gov.my/ for more' }));
  writeFileSync(join(root, 'data', 'series', 'b.json'), JSON.stringify({ url: 'https://archive-api.open-meteo.com/v1/archive?x=1', other: 'http://insecure.example/' }));
  const found = collectUrls(root);
  assert.deepEqual([...found.keys()].sort(), ['https://archive-api.open-meteo.com/v1/archive?x=1', 'https://www.ecmwf.int/', 'https://www.met.gov.my/']);
  assert.deepEqual(found.get('https://www.ecmwf.int/'), ['data/a.json']);
});

test('collectUrls keeps balanced parentheses (DOIs) and drops a closing one from prose', () => {
  const root = mkdtempSync(join(tmpdir(), 'meteo-links-'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data', 'a.json'), JSON.stringify({
    url: 'https://doi.org/10.1175/1520-0450(1996)035%3C0601:IMFAOS%3E2.0.CO;2',
    text: '(see https://www.ecmwf.int/en/forecasts)',
  }));
  assert.deepEqual([...collectUrls(root).keys()].sort(), [
    'https://doi.org/10.1175/1520-0450(1996)035%3C0601:IMFAOS%3E2.0.CO;2',
    'https://www.ecmwf.int/en/forecasts',
  ]);
});
