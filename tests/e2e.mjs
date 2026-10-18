/* End-to-end check in a real browser (Playwright + Chromium):

     python3 tools/serve.py &          # http://127.0.0.1:4210/
     node tests/e2e.mjs                # PLAYWRIGHT=/path/to/playwright if not found

   1. A user's path through the app: language picker, gradient-descent
      figure, a quiz, a highlight, the recap and "mastered", a glossary term,
      settings with the QR code, search across languages, every tool page.
   2. Every module, lesson and recap in English and Chinese at 375 px wide:
      no script error, no "could not load", no sideways scrolling.
   Not part of `node --test` (it needs a browser and the dev server). */
import { createRequire } from 'module';
import fs from 'fs';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT || `${execSync('npm root -g').toString().trim()}/playwright`;
const { chromium } = require(PW);
const BASE = process.env.BASE || 'http://127.0.0.1:4210/';
let failed = 0;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 760 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const ok = (c, msg) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
await p.goto(BASE);
await p.waitForTimeout(800);
ok(await p.isVisible('#picker'), 'first run shows language picker');
await p.click('#picker [data-lang="zh"]');
await p.waitForTimeout(600);
ok((await p.textContent('h1')).includes('机器学习'), 'chose Chinese, home in Chinese');
// gradient descent
await p.goto('http://127.0.0.1:4210/#/ch/c02/gradient-descent'); await p.waitForTimeout(1200);
const w = p.locator('.widget[data-widget="gradient"]');
await w.locator('.w-buttons .button').first().click();
await p.waitForTimeout(6000);
const st = await w.locator('.w-explain').textContent();
ok(/收敛/.test(st), 'gradient descent converges with the good rate: ' + st);
// quiz
await p.goto('http://127.0.0.1:4210/#/ch/c02/linear-regression'); await p.waitForTimeout(1000);
const q = p.locator('.quiz-q').first();
const key = await q.getAttribute('data-quiz');
await q.locator('.quiz-opt').first().click();
ok(await q.locator('.quiz-verdict').isVisible(), 'quiz shows a verdict');
const saved = await p.evaluate(k => JSON.parse(localStorage.getItem('ml.prefs.v1')).answers[k], key);
ok(saved === 0, 'quiz answer stored');
// highlight a paragraph
await p.locator('article p[data-rk]').nth(2).click();
await p.waitForTimeout(300);
ok(await p.isVisible('.rd-bar'), 'tapping a paragraph opens the marking bar');
ok(!(await p.locator('.rd-bar [data-act="read"]').count()), 'no read-aloud button');
await p.locator('.rd-bar [data-c="yellow"]').click();
await p.waitForTimeout(300);
const marks = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ml.reader') || '{}').marks || {}).length);
ok(marks === 1, 'highlight saved');
// recap and mastered
await p.goto('http://127.0.0.1:4210/#/ch/c02/recap'); await p.waitForTimeout(1000);
ok((await p.locator('.recap .takeaways').count()) >= 4, 'recap lists takeaways');
await p.locator('.recap-foot .button').first().click(); await p.waitForTimeout(500);
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ml.prefs.v1')).read.c02 === true), 'mastered saved');
// term sheet
await p.goto('http://127.0.0.1:4210/#/ch/c02/loss'); await p.waitForTimeout(1000);
await p.locator('.chip.term').first().click(); await p.waitForTimeout(300);
ok(await p.isVisible('.term-sheet'), 'key term opens the glossary sheet');
// language switch keeps place
await p.goto('http://127.0.0.1:4210/#/settings'); await p.waitForTimeout(800);
await p.locator('.setseg button', { hasText: 'English' }).click(); await p.waitForTimeout(600);
ok((await p.textContent('h1')).includes('Settings'), 'switched to English');
ok(await p.isVisible('.qr svg'), 'QR code in settings');
// search
await p.goto('http://127.0.0.1:4210/#/search'); await p.waitForTimeout(800);
await p.fill('#search-input', '梯度下降'); await p.waitForTimeout(800);
const hits = await p.locator('.search-results li a').count();
ok(hits > 0, `search in Chinese finds ${hits} results while UI is English`);
// tools
for (const r of ['#/tools', '#/tools/glossary', '#/tools/cards/c02', '#/tools/quiz', '#/tools/quiz/c04', '#/notes', '#/bookmarks', '#/stage/2', '#/ch/c10', '#/term/gradient-descent']) {
  await p.goto(BASE + r); await p.waitForTimeout(700);
  const bad = await p.evaluate(() => !!document.querySelector('.error') || document.documentElement.scrollWidth > innerWidth + 1);
  ok(!bad, 'renders without error/overflow: ' + r);
}
if (errs.length) failed++;
console.log(errs.join('\n') || 'no console errors');


/* ---------- every screen ---------- */
const idx = JSON.parse(fs.readFileSync(new URL('../data/index.json', import.meta.url)));
const routes = idx.chapters.flatMap(c => [`#/ch/${c.id}`, ...c.sections.map(s => `#/ch/${c.id}/${s.id}`), `#/ch/${c.id}/recap`]);
for (const lang of ['en', 'zh']) {
  const p = await b.newPage({ viewport: { width: 375, height: 760 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(l => localStorage.setItem('ml.prefs.v1', JSON.stringify({ lang: l, chosen: true, seenVersion: '1.0.0', scale: 1.15 })), lang);
  await p.goto(BASE); await p.waitForTimeout(600);
  let bad = 0;
  for (const r of routes) {
    await p.evaluate(h => { location.hash = h; }, r);
    await p.waitForTimeout(250);
    const res = await p.evaluate(() => {
      const over = document.documentElement.scrollWidth > innerWidth + 1;
      const who = over ? [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.table-scroll, pre, .katex-display')).slice(0, 2).map(e => e.tagName + '.' + String(e.className).slice(0, 30)) : [];
      return { over, who, error: !!document.querySelector('.error') };
    });
    if (res.over || res.error) { bad++; failed++; console.log(lang, r, JSON.stringify(res)); }
  }
  console.log(lang, routes.length, 'routes,', bad, 'problems;', errs.length, 'page errors', errs.slice(0, 3));
  await p.close();
}
await b.close();
process.exit(failed ? 1 : 0);
