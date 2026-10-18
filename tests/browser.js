/* Browser tests: each case opens the real app in an iframe at a given size
   with given saved preferences, then inspects it. Same origin, so storage
   written here is what the app reads. */

const KEY = 'pphys.prefs.v1';
const results = document.getElementById('results');
let passed = 0, failed = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function until(fn, ms = 4000) {
  const t0 = performance.now();
  for (;;) {
    try { const v = fn(); if (v) return v; } catch { /* not yet */ }
    if (performance.now() - t0 > ms) throw new Error(`timed out waiting for ${fn}`);
    await sleep(50);
  }
}

async function openApp({ hash = '', width = 375, height = 740, prefs = null }) {
  localStorage.removeItem(KEY);
  if (prefs) localStorage.setItem(KEY, JSON.stringify({ lang: 'en', theme: 'light', scale: 1, chosen: true, read: {}, quiz: {}, lastRoute: '', seenVersion: '1.0.0', ...prefs }));
  const f = document.createElement('iframe');
  f.width = width; f.height = height;
  f.src = `../index.html${hash}`;
  document.getElementById('frames').append(f);
  await new Promise(r => f.addEventListener('load', r, { once: true }));
  const w = f.contentWindow;
  await until(() => w.document.documentElement.dataset.ready === 'true');
  return { f, w, d: w.document, close: () => f.remove() };
}

async function test(name, fn) {
  const li = document.createElement('li');
  try { await fn(); li.className = 'pass'; li.textContent = `✓ ${name}`; passed++; }
  catch (e) { li.className = 'fail'; li.innerHTML = `✗ ${name}<pre>${e.stack || e}</pre>`; failed++; }
  results.append(li);
}

const assert = (c, msg) => { if (!c) throw new Error(msg); };
const type = (a, input, text) => { input.value = text; input.dispatchEvent(new a.w.Event('input', { bubbles: true })); };

await test('first visit shows the language picker with English as default', async () => {
  const a = await openApp({});
  const picker = await until(() => a.d.getElementById('picker'));
  assert(!picker.hidden, 'picker hidden');
  assert(a.d.querySelector('#picker [data-lang="en"]').classList.contains('is-default'), 'English not marked default');
  a.close();
});

await test('deep link survives the language picker', async () => {
  const a = await openApp({ hash: '#/ch/ch01/s4' });
  a.d.querySelector('#picker [data-lang="zh"]').click();
  await until(() => a.d.getElementById('s4'));
  assert(a.w.location.hash === '#/ch/ch01/s4', `hash is ${a.w.location.hash}`);
  assert(a.d.documentElement.lang.startsWith('zh'), 'language not applied');
  await sleep(200);
  const top = a.d.getElementById('s4').getBoundingClientRect().top;
  assert(top > -5 && top < 160, `section s4 at ${top}px`);
  a.close();
});

await test('Settings sets language, theme and text size', async () => {
  const a = await openApp({ hash: '#/settings', prefs: { lang: 'en' } });
  const segs = await until(() => a.d.querySelectorAll('.setseg').length >= 3 && a.d.querySelectorAll('.setseg'));
  [...segs[0].querySelectorAll('button')].find(b => b.textContent === 'Bahasa Melayu').click();
  await until(() => a.d.documentElement.lang === 'ms' && a.d.querySelector('[data-nav="settings"] span').textContent === 'Tetapan');
  [...a.d.querySelectorAll('.setseg')[1].querySelectorAll('button')][2].click();
  await until(() => a.d.documentElement.dataset.theme === 'dark');
  assert(a.d.querySelectorAll('.setseg')[1].querySelectorAll('button')[2].classList.contains('on'), 'dark not shown as chosen');
  [...a.d.querySelectorAll('.setseg')[2].querySelectorAll('button')].find(b => b.textContent === '130%').click();
  await until(() => 'single' in a.d.documentElement.dataset);
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert(saved.lang === 'ms' && saved.theme === 'dark' && saved.scale === 1.3, JSON.stringify(saved));
  assert(!a.d.querySelector('[data-action="lang"]'), 'old language button still in the top bar');
  a.close();
});

await test('theme is applied by an inline script before the stylesheet', async () => {
  const html = await (await fetch('../index.html', { cache: 'no-store' })).text();
  const pre = html.indexOf('id="prepaint"'), css = html.indexOf('css/app.css');
  assert(pre > 0 && pre < css, 'prepaint script missing or after the stylesheet');
  const a = await openApp({ prefs: { theme: 'dark' } });
  assert(a.d.documentElement.dataset.theme === 'dark', 'dark theme not applied');
  a.close();
});

await test('text size 1.3 switches the chapter to a single column', async () => {
  const cols = async scale => {
    const a = await openApp({ hash: '#/ch/ch01', width: 1200, prefs: { scale } });
    await until(() => a.d.getElementById('s1'));
    const n = a.w.getComputedStyle(a.d.querySelector('.page-chapter')).gridTemplateColumns.split(' ').length;
    const single = 'single' in a.d.documentElement.dataset;
    a.close();
    return [n, single];
  };
  const [normal] = await cols(1);
  const [big, single] = await cols(1.3);
  assert(normal === 2, `scale 1 has ${normal} columns`);
  assert(single && big === 1, `scale 1.3 has ${big} columns, data-single=${single}`);
});

for (const lang of ['ms', 'zh', 'en']) {
  await test(`no horizontal overflow at 375px × scale 1.5 in ${lang}`, async () => {
    for (const hash of ['#/', '#/ch/ch01', '#/stage/3', '#/settings', '#/notes', '#/bookmarks', '#/share', '#/search', '#/tools', '#/tools/glossary', '#/tools/beaufort', '#/tools/quiz/3', '#/tools/cards', '#/tools/map', '#/tools/convert', '#/tools/data']) {
      const a = await openApp({ hash, prefs: { lang, scale: 1.5 } });
      await sleep(250);
      const sw = a.d.scrollingElement.scrollWidth;
      a.close();
      assert(sw <= 375, `${hash}: scrollWidth ${sw}`);
    }
  });
}

await test('share page shows a QR code, a share button and copy link', async () => {
  const a = await openApp({ hash: '#/share', prefs: { lang: 'zh' } });
  const svg = await until(() => a.d.querySelector('#share-host svg'));
  assert(svg.querySelectorAll('rect, path').length > 0, 'QR svg is empty');
  assert(a.d.querySelector('[data-share="copy"]'), 'no copy button');
  assert(a.d.querySelector('[data-share="native"]'), 'no share button');
  assert(a.d.querySelector('.share-url').textContent.includes('bryanwoo988.github.io/plant-physiology/'), 'URL not shown');
  a.close();
});

await test('search finds a chapter from a query in another language', async () => {
  const a = await openApp({ hash: '#/search', prefs: { lang: 'ms' } });
  const input = await until(() => a.d.querySelector('#search-input'));
  type(a, input, '水势');
  const first = await until(() => a.d.querySelector('.search-results a'));
  assert(first.getAttribute('href').startsWith('#/ch/ch01'), first.getAttribute('href'));
  assert(!/[\u4e00-\u9fff]/.test(first.querySelector('.hit-title').textContent), 'title not in Malay');
  a.close();
});

await test('a stage quiz scores answers and remembers the best', async () => {
  const a = await openApp({ hash: '#/tools/quiz/3', prefs: { lang: 'en' } });
  await until(() => a.d.querySelector('.quiz-q'));
  const qs = a.d.querySelectorAll('.quiz-q');
  for (const q of qs) q.querySelectorAll('.quiz-opt')[Number(q.dataset.answer)].click();
  const score = await until(() => a.d.querySelector('.quiz-score'));
  assert(score.textContent.includes(`${qs.length}/${qs.length}`), score.textContent);
  const saved = JSON.parse(a.w.localStorage.getItem('pphys.prefs.v1'));
  assert(saved.quiz[3] === qs.length, `best not saved: ${JSON.stringify(saved.quiz)}`);
  a.close();
});

await test('glossary, abbreviations, hormone table, essays, flashcards and concept map open', async () => {
  for (const [hash, sel, min] of [['#/tools/glossary', '.gloss-item', 9], ['#/tools/hormones', '.hormone-table tbody tr', 6], ['#/tools/essays', '.essay', 10], ['#/tools/abbr', '.gloss-item', 5], ['#/tools/cards', '.flashcard', 1], ['#/tools/map', '.cmap svg', 1], ['#/tools', '.tool-list a', 8]]) {
    const a = await openApp({ hash, prefs: { lang: 'zh' } });
    await until(() => a.d.querySelectorAll(sel).length >= min);
    a.close();
  }
});

await test('every widget in every chapter survives its slider extremes', async () => {
  const index = await (await fetch('../data/index.json', { cache: 'no-store' })).json();
  for (const c of index.chapters.filter(x => x.ready !== false)) {
    const ch = await (await fetch(`../data/${c.id}.json`, { cache: 'no-store' })).json();
    const ids = ch.sections.flatMap(sct => sct.blocks).filter(b => b.type === 'widget' || b.type === 'map').map(b => b.id);
    if (!ids.length) continue;
    const a = await openApp({ hash: `#/ch/${c.id}`, prefs: { lang: 'ms', scale: 1.5 } });
    for (const id of ids) {
      const fig = await until(() => a.d.querySelector(`[data-widget="${id}"] .w-frame, [data-widget="${id}"] .map-wrap`), 6000);
      for (const input of fig.closest('[data-widget]').querySelectorAll('input[type=range]')) {
        for (const v of [input.min, input.max, input.min]) {
          input.value = v; input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
          const text = fig.closest('[data-widget]').textContent;
          assert(!/NaN|undefined|Infinity/.test(text), `${c.id} ${id} at ${v}: ${text.slice(0, 200)}`);
        }
      }
    }
    assert(a.d.scrollingElement.scrollWidth <= 375, `${c.id}: overflow ${a.d.scrollingElement.scrollWidth}`);
    a.close();
  }
});


await test('nested children render as elements, never as "[object HTMLElement]"', async () => {
  const { el } = await import('../js/content.js');
  const dl = el('dl', {}, [[el('dt', {}, 'k1'), el('dd', {}, 'v1')], [el('dt', {}, 'k2'), el('dd', {}, 'v2')]]);
  assert(!dl.textContent.includes('[object'), 'pairs were turned into text');
  assert(dl.querySelectorAll('dt').length === 2 && dl.querySelectorAll('dd').length === 2, 'dt/dd missing');
});

await test('no chapter shows "[object …]" text', async () => {
  const idx = await (await fetch('../data/index.json')).json();
  const { renderSections } = await import('../js/content.js');
  const bad = [];
  for (const meta of idx.chapters) {
    const ch = await (await fetch(`../data/${meta.id}.json`)).json();
    const host = document.createElement('div');
    host.append(renderSections(ch, { lang: 'en', terms: new Map() }));
    if (/\[object /.test(host.textContent)) bad.push(meta.id);
  }
  assert(!bad.length, 'broken text in ' + bad.join(', '));
});

/* ---------- Highlights, notes, bookmarks, read aloud (reader.js) ---------- */
const RKEY = 'pphys.reader';
const reader = () => JSON.parse(localStorage.getItem(RKEY) || '{}');
const bar = a => until(() => { const b = a.d.querySelector('.rd-bar'); return b && !b.hidden && b; });
const firstP = a => until(() => a.d.querySelector('#s2 > p[data-rk]'));

await test('tapping a paragraph and a colour marks it in every language, after a reload', async () => {
  localStorage.removeItem(RKEY);
  let a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'en' } });
  const p = await firstP(a);
  const key = p.dataset.rk;
  p.click();
  const b = await bar(a);
  const w = b.getBoundingClientRect();
  assert(w.left >= 0 && w.right <= a.w.innerWidth, `bar overflows: ${w.left}–${w.right}`);
  b.querySelector('[data-c="pink"]').click();
  await until(() => p.querySelector('.rd-ink[data-hl="pink"]'));
  assert(reader().marks[key].hl === 'pink', JSON.stringify(reader().marks));
  a.close();
  a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'zh' } });
  await until(() => a.d.querySelector(`[data-rk="${key}"] .rd-ink[data-hl="pink"]`));
  a.close();
  localStorage.removeItem(RKEY);
});

await test('long-press words: only those words are marked, in that language', async () => {
  localStorage.removeItem(RKEY);
  const a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'en' } });
  const p = await firstP(a);
  const tn = a.d.createTreeWalker(p, 4).nextNode();
  const r = a.d.createRange(); r.setStart(tn, 0); r.setEnd(tn, 12);
  a.w.getSelection().removeAllRanges(); a.w.getSelection().addRange(r);
  a.d.dispatchEvent(new a.w.Event('selectionchange'));
  (await bar(a)).querySelector('[data-c="green"]').click();
  const mk = await until(() => p.querySelector('.rd-r[data-hl="green"]'));
  assert(mk.textContent === tn.data.slice(0, 12), `marked "${mk.textContent}"`);
  const [range] = Object.values(reader().ranges);
  assert(range.lang === 'en' && range.s === 0 && range.e === 12, JSON.stringify(range));
  // Tapping the marked words opens their menu.
  a.w.getSelection().removeAllRanges();
  mk.click();
  await until(() => a.d.querySelector('.rd-sheet [data-do="remove"]'));
  a.d.querySelector('.rd-sheet [data-do="remove"]').click();
  await until(() => !p.querySelector('.rd-r') && !Object.keys(reader().ranges).length);
  a.close();
  localStorage.removeItem(RKEY);
});

await test('a note and a bookmark show in Notes and Bookmarks, and lead back', async () => {
  localStorage.removeItem(RKEY);
  const a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'en' } });
  let p = await firstP(a);
  const key = p.dataset.rk;
  p.click();
  (await bar(a)).querySelector('[data-act="bookmark"]').click();
  await until(() => p.querySelector('.rd-bm'));
  p.click();
  (await bar(a)).querySelector('[data-act="note"]').click();
  const ta = await until(() => a.d.querySelector('.rd-sheet textarea'));
  ta.value = 'turgor first';
  a.d.querySelector('.rd-sheet [data-do="save"]').click();
  await until(() => p.querySelector('.rd-nb'));
  a.d.querySelector('[data-nav="notes"]').click();
  const note = await until(() => a.d.querySelector('.page-lib .rd-item-note'));
  assert(note.textContent === 'turgor first', note.textContent);
  assert(a.d.querySelector('[data-nav="notes"]').classList.contains('on'), 'Notes tab not lit');
  a.d.querySelector('[data-nav="bookmarks"]').click();
  const item = await until(() => a.d.querySelector('.page-lib .rd-item'));
  assert(item.querySelector('.rd-item-where').textContent.startsWith('Chapter 1'), item.textContent);
  item.click();
  p = await until(() => a.d.querySelector(`[data-rk="${key}"]`));
  assert(a.w.location.hash === '#/ch/ch01', a.w.location.hash);
  a.close();
  localStorage.removeItem(RKEY);
});

await test('Read aloud asks for a chapter first, then plays and stops', async () => {
  const a = await openApp({ hash: '#/', prefs: { lang: 'en' } });
  a.d.querySelector('[data-nav="listen"]').click();
  await until(() => !a.d.getElementById('toast').hidden && a.d.getElementById('toast').textContent.includes('Open a chapter'));
  if (a.w.speechSynthesis) {
    a.w.location.hash = '#/ch/ch01';
    await firstP(a);
    a.d.querySelector('[data-nav="listen"]').click();
    const pl = await until(() => { const x = a.d.querySelector('.rd-player'); return x && !x.hidden && x; });
    assert(a.d.getElementById('nav-listen').textContent === 'Stop', 'nav label not Stop');
    pl.querySelector('[data-pl="stop"]').click();
    await until(() => pl.hidden);
  }
  a.close();
});

await test('marks, notes and section bookmarks from before 1.2.0 move over', async () => {
  localStorage.removeItem(RKEY);
  // Work out where the old (annotate.js) offsets fell, from the page itself.
  let a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'en' } });
  const p = await firstP(a);
  const pText = p.textContent;
  const ul = await until(() => a.d.querySelector('.section > ul[data-blk]'));
  const [li1, li2] = [...ul.children].map(li => li.textContent);
  const ulKeys = [...ul.children].slice(0, 2).map(li => li.dataset.rk);
  const pKey = p.dataset.rk, pBlk = p.dataset.blk, ulBlk = ul.dataset.blk;
  const secFirst = a.d.querySelector('#s3 [data-rk]').dataset.rk;
  a.close();
  // Old model: list items joined by "\n". Pick a word that also comes earlier, if any.
  const at = Math.max(0, pText.indexOf(' ', 20) + 1);
  const word = pText.slice(at, pText.indexOf(' ', at));
  localStorage.setItem('pphys.study.v1', JSON.stringify({
    fav: { ch01: 1 }, notes: {}, bm: { 'ch01/s3': 100 },
    marks: [
      { id: 'a', ch: 'ch01', lang: 'en', blk: pBlk, start: at, end: at + word.length, text: word, style: 'blue', note: 'old note', at: 10 },
      { id: 'b', ch: 'ch01', lang: 'en', blk: ulBlk, start: li1.length - 6, end: li1.length + 1 + 5, text: `${li1.slice(-6)}\n${li2.slice(0, 5)}`, style: 'underline', note: '', at: 20 },
    ],
  }));
  a = await openApp({ hash: '#/ch/ch01', prefs: { lang: 'en' } });
  await until(() => a.d.querySelectorAll('.rd-r').length >= 3);
  const d = reader();
  const ranges = Object.values(d.ranges).sort((x, y) => x.t - y.t);
  assert(ranges.length === 3, JSON.stringify(ranges));
  assert(ranges[0].k === pKey && ranges[0].s === at && ranges[0].hl === 'blue', JSON.stringify(ranges[0]));
  assert(d.rnotes[ranges[0].g].text === 'old note', 'note lost');
  assert(ranges[1].k === ulKeys[0] && ranges[1].q === li1.slice(-6) && ranges[1].ul === 'pink', JSON.stringify(ranges[1]));
  assert(ranges[2].k === ulKeys[1] && ranges[2].s === 0 && ranges[2].e === 5, JSON.stringify(ranges[2]));
  assert(d.bookmarks[secFirst], `section bookmark not on ${secFirst}: ${JSON.stringify(d.bookmarks)}`);
  const left = JSON.parse(localStorage.getItem('pphys.study.v1'));
  assert(!left.marks.length && !Object.keys(left.bm).length && left.fav.ch01, JSON.stringify(left));
  a.close();
  localStorage.removeItem(RKEY);
  localStorage.removeItem('pphys.study.v1');
  localStorage.removeItem('pphys.study.v1.before-1.2');
});

document.getElementById('summary').textContent = `${passed} passed, ${failed} failed`;
document.documentElement.dataset.done = 'true';
