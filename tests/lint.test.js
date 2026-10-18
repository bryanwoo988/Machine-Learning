import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from '../tools/lint-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the shipped content passes', () => {
  const { errors } = lint(ROOT);
  assert.deepEqual(errors, []);
});

// A copy of data/ with one thing broken; images and widgets are linked in.
function broken(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'ml-lint-'));
  cpSync(join(ROOT, 'data'), join(dir, 'data'), { recursive: true });
  symlinkSync(join(ROOT, 'img'), join(dir, 'img'));
  symlinkSync(join(ROOT, 'js'), join(dir, 'js'));
  const f = join(dir, 'data', 'c02.json');
  const ch = JSON.parse(readFileSync(f, 'utf8'));
  mutate(ch);
  writeFileSync(f, JSON.stringify(ch));
  return lint(dir).errors;
}

test('a missing Chinese translation is caught', () => {
  const errs = broken(ch => { ch.sections[1].blocks.find(b => b.type === 'p').html.zh = ''; });
  assert.ok(errs.some(e => /empty zh/.test(e)), errs.join('\n'));
});
test('an untranslated key takeaway is caught', () => {
  const errs = broken(ch => { ch.sections.find(s => s.takeaways.length).takeaways[0].zh = null; });
  assert.ok(errs.some(e => /no Chinese translation/.test(e)), errs.join('\n'));
});
test('a tag outside the whitelist is caught', () => {
  const errs = broken(ch => { ch.sections[0].blocks.find(b => b.type === 'p').html.en += '<script>x</script>'; });
  assert.ok(errs.some(e => /<script> not allowed/.test(e)), errs.join('\n'));
});
test('a missing widget or image is caught', () => {
  const errs = broken(ch => {
    ch.sections[0].blocks.push({ type: 'widget', id: 'nope' }, { type: 'figure', src: 'img/none.png', alt: { en: '', zh: '' }, caption: { en: '', zh: '' } });
  });
  assert.ok(errs.some(e => /missing widget nope/.test(e)) && errs.some(e => /missing image/.test(e)), errs.join('\n'));
});
test('a link to a lesson that does not exist is caught', () => {
  const errs = broken(ch => { ch.sections[0].blocks.find(b => b.type === 'p').html.en += ' <a href="#/ch/c99/x">x</a>'; });
  assert.ok(errs.some(e => /missing lesson c99\/x/.test(e)), errs.join('\n'));
});
