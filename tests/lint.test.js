import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lint } from '../tools/lint-content.mjs';

const T = (en) => ({ zh: `中${en}`, en, ms: `M${en}` });

// A two-chapter course that passes every rule. Each test breaks one thing.
function base() {
  return {
    index: { app: T('App'), stages: [{ n: 1, title: T('S1'), blurb: T('b'), chapters: ['ch01'] }, { n: 6, title: T('S6'), blurb: T('b'), chapters: ['ch02'] }],
      chapters: [{ id: 'ch01', num: 1, stage: 1, title: T('One'), blurb: T('b') }, { id: 'ch02', num: 2, stage: 6, title: T('Two'), blurb: T('b') }] },
    terms: [
      { id: 'air', name: T('air'), short: T('gas'), chapter: 1 },
      { id: 'monsoon', name: T('monsoon'), short: T('seasonal wind'), chapter: 2 },
    ],
    sources: [{ id: 'PAM', title: 'Principles of Agricultural Meteorology', publisher: 'Scientific Publishers', url: '', accessed: '' },
      { id: 'met', title: 'MetMalaysia', publisher: 'MetMalaysia', url: 'https://www.met.gov.my/', accessed: '2026-10-02' }],
    quiz: [
      { stage: 1, chapter: 'ch01', q: T('q'), options: [T('a'), T('b'), T('c'), T('d')], answer: 0, why: T('w') },
      { stage: 6, chapter: 'ch02', q: T('q'), options: [T('a'), T('b'), T('c'), T('d')], answer: 3, why: T('w') },
    ],
    datasets: [],
    ch01: { id: 'ch01', num: 1, stage: 1, title: T('One'), newTerms: ['air'], sources: ['PAM'], sections: [
      { id: 's1', heading: T('h'), level: 'basic', blocks: [
        { type: 'p', src: ['PAM'], defines: ['air'], text: { zh: '{{t:air}} 是', en: '{{t:air}} is', ms: '{{t:air}} ialah' } },
        { type: 'table', src: ['PAM'], caption: T('c'), headers: [T('a'), T('b')], rows: [[T('1'), T('2')]] },
      ] }] },
    ch02: { id: 'ch02', num: 2, stage: 6, title: T('Two'), newTerms: ['monsoon'], sources: ['met'], sections: [
      { id: 's1', heading: T('h'), level: 'basic', blocks: [
        { type: 'p', src: ['met'], defines: ['monsoon'], text: { zh: '{{t:monsoon}} 和 {{t:air}}', en: '{{t:monsoon}} and {{t:air}}', ms: '{{t:monsoon}} dan {{t:air}}' } },
      ] }] },
  };
}

function write(c) {
  const root = mkdtempSync(join(tmpdir(), 'pphys-lint-'));
  mkdirSync(join(root, 'data'));
  const w = (f, v) => writeFileSync(join(root, 'data', f), JSON.stringify(v));
  w('index.json', c.index); w('terms.json', c.terms); w('sources.json', c.sources);
  w('quiz.json', c.quiz); w('datasets.json', c.datasets); w('ch01.json', c.ch01); w('ch02.json', c.ch02);
  return root;
}
const errorsOf = mutate => { const c = base(); mutate(c); return lint(write(c)).errors; };
const has = (errors, re) => assert.ok(errors.some(e => re.test(e)), `expected ${re} in:\n${errors.join('\n')}`);

test('a valid course has no errors', () => assert.deepEqual(lint(write(base())).errors, []));

test('missing Malay is an error', () => has(errorsOf(c => { delete c.ch01.title.ms; }), /ch01.*\bms\b/));

test('a term used before the chapter that defines it', () => has(errorsOf(c => {
  c.ch01.sections[0].blocks.push({ type: 'p', text: T('{{t:monsoon}}') });
}), /ch01 uses "monsoon" defined in ch02/));

test('a term used before its defining paragraph in the same chapter', () => has(errorsOf(c => {
  c.ch01.sections[0].blocks.unshift({ type: 'p', text: T('{{t:air}} early') });
}), /ch01 uses "air" before its defining paragraph/));

test('an unknown term', () => has(errorsOf(c => { c.ch01.sections[0].blocks.push({ type: 'p', text: T('{{t:nope}}') }); }), /unknown term "nope"/));

test('a term defined twice or never', () => {
  has(errorsOf(c => { c.ch02.sections[0].blocks[0].defines.push('air'); }), /"air" is defined 2 times/);
  has(errorsOf(c => { delete c.ch01.sections[0].blocks[0].defines; }), /"air" is never defined/);
});

test('newTerms must match the terms of that chapter', () => has(errorsOf(c => { c.ch01.newTerms = []; }), /ch01 newTerms/));

test('unknown source', () => has(errorsOf(c => { c.ch01.sources.push('ghost'); }), /unknown source "ghost"/));

test('a teaching block without a source', () => has(errorsOf(c => { delete c.ch02.sections[0].blocks[0].src; }), /ch02 .*p block has no src/));

test('table rows must match headers', () => has(errorsOf(c => { c.ch01.sections[0].blocks[1].rows[0].push(T('3')); }), /ch01 table row 1 has 3 cells/));

test('a widget without a module', () => has(errorsOf(c => { c.ch01.sections[0].blocks.push({ type: 'widget', id: 'W99' }); }), /widget W99 has no module/));

test('an unknown dataset', () => has(errorsOf(c => { c.ch01.sections[0].blocks.push({ type: 'dataset', id: 'ecmwf-ens' }); }), /unknown dataset "ecmwf-ens"/));

test('every chapter needs a quiz question; questions need four options', () => {
  has(errorsOf(c => { c.quiz.shift(); }), /ch01 has no quiz question/);
  has(errorsOf(c => { c.quiz[0].options.pop(); }), /quiz 1 .*4 options/);
  has(errorsOf(c => { c.quiz[0].answer = 4; }), /quiz 1 .*answer/);
});

test('a chapter not yet written (ready:false) is listed but not required', () => {
  assert.deepEqual(errorsOf(c => {
    c.index.chapters.push({ id: 'ch03', num: 3, stage: 6, title: T('Three'), blurb: T('b'), ready: false });
  }), []);
});

test('a chart series colour must be a colour token in the stylesheet', () => has(errorsOf(c => {
  c.ch01.sections[0].blocks.push({ type: 'chart', src: ['S1'], chart: { kind: 'line', series_file: 'x', series: [{ col: 'v', color: 'sea' }] } });
}), /chart colour "sea" is not a CSS token/));

test('a link to a chapter that does not exist', () => has(errorsOf(c => {
  c.ch01.sections[0].blocks.push({ type: 'p', text: T('{{ch:ch99|nowhere}}') });
}), /unknown chapter "ch99"/));
