/* An embedding space you can tap. The foods and the two imagined dimensions
   ("sandwichness", "dessertness") are the lesson's own example; the exact
   coordinates are illustrative. Switch between 1-D and 2-D and tap a food to
   see which others are nearest — distance stands for similarity. */

import { s, h, frame, size, seg, fmt, scale, T } from './kit.js';
import { distance } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Embedding space: distance means similarity', '嵌入空间：距离代表相似度'),
  dims: T('Dimensions', '维度'), one: T('1-D', '一维'), two: T('2-D', '二维'),
  sand: T('sandwichness →', '像三明治的程度 →'), dess: T('dessertness →', '像甜点的程度 →'),
  tap: T('Tap a food to see its nearest neighbours.', '点一种食物，看离它最近的是哪些。'),
  near: T('Nearest to {x}:', '离 {x} 最近的：'),
};
// [sandwichness, dessertness] in [0, 1]
const FOODS = [
  [T('borscht', '罗宋汤'), 0.05, 0.12],
  [T('salad', '沙拉'), 0.22, 0.1],
  [T('pizza', '披萨'), 0.48, 0.12],
  [T('hot dog', '热狗'), 0.78, 0.1],
  [T('shawarma', '沙威玛'), 0.92, 0.08],
  [T('apple strudel', '苹果卷'), 0.85, 0.88],
  [T('tangyuan', '汤圆'), 0.08, 0.82],
];

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.62 });
  const M = { t: 18, r: 18, b: 30, l: 30 };
  let dims = 2, sel = 3;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  const list = h('ol', { class: 'emb-list' });
  const head = h('p', { class: 'w-sub' });
  const vec = i => (dims === 1 ? [FOODS[i][1]] : [FOODS[i][1], FOODS[i][2]]);
  function draw() {
    const x = scale(0, 1, M.l, W - M.r);
    const y = dims === 1 ? () => H / 2 : scale(0, 1, H - M.b, M.t);
    const kids = [
      s('line', { x1: M.l, x2: W - M.r, y1: dims === 1 ? H / 2 : H - M.b, y2: dims === 1 ? H / 2 : H - M.b, class: 'emb-axis' }),
      s('text', { x: W - M.r, y: (dims === 1 ? H / 2 : H - M.b) + 20, 'text-anchor': 'end', class: 'unit' }, p(L.sand)),
    ];
    if (dims === 2) kids.push(s('line', { x1: M.l, x2: M.l, y1: H - M.b, y2: M.t, class: 'emb-axis' }), s('text', { x: M.l + 6, y: M.t + 4, class: 'unit' }, p(L.dess)));
    const order = FOODS.map((_, i) => i).filter(i => i !== sel).sort((a, b) => distance(vec(sel), vec(a)) - distance(vec(sel), vec(b)));
    for (const i of order.slice(0, 2)) kids.push(s('line', { x1: x(FOODS[sel][1]), y1: y(FOODS[sel][2]), x2: x(FOODS[i][1]), y2: y(FOODS[i][2]), class: 'emb-link' }));
    FOODS.forEach(([name, a, b], i) => {
      const g = s('g', { class: `emb-pt${i === sel ? ' is-on' : ''}`, tabindex: '0', role: 'button', transform: `translate(${x(a)},${y(b)})` },
        s('circle', { r: i === sel ? 9 : 7 }),
        s('text', { x: 0, y: dims === 1 ? (i % 2 ? 24 : -14) : (i === 4 ? 24 : -13), 'text-anchor': i === 4 && dims === 2 ? 'start' : 'middle' }, p(name)));
      const choose = () => { sel = i; draw(); };
      g.addEventListener('click', choose);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      kids.push(g);
    });
    svg.replaceChildren(...kids);
    head.textContent = p(L.near).replace('{x}', p(FOODS[sel][0]));
    list.replaceChildren(...order.map(i => h('li', {}, `${p(FOODS[i][0])} — ${fmt(distance(vec(sel), vec(i)), 2)}`)));
  }
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [
    seg([[1, p(L.one)], [2, p(L.two)]], dims, d => { dims = d; draw(); }, p(L.dims)), svg, h('p', { class: 'w-explain' }, p(L.tap)), head, list] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
