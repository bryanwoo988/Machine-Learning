/* Clustering, the commonest unsupervised method: the points carry no labels.
   Choose how many clusters, then press Step to run k-means one round at a
   time — assign each point to its nearest centre, then move each centre to
   the middle of its points. Illustrative data. */

import { s, h, frame, size, seg, button, scale, T } from './kit.js';
import { rng, gauss, kmeansStep } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Unsupervised learning: find the groups yourself', '非监督式学习：自己找出分组'),
  k: T('Clusters', '分组数'), step: T('Step', '下一步'), reset: T('Reset', '重设'),
  round: T('Round {n}', '第 {n} 轮'), done: T('Round {n}: the centres no longer move.', '第 {n} 轮：中心点不再移动。'),
  hint: T('No point has a label: the model only groups points that sit close together. Naming the groups is still up to you.', '这些点都没有标签：模型只是把靠在一起的点分成一组。每一组代表什么，仍要由人来判断。'),
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.62 });
  const M = { t: 12, r: 12, b: 12, l: 12 };
  const x = scale(0, 1, M.l, W - M.r), y = scale(0, 1, H - M.b, M.t);
  const r = rng(9);
  const pts = [];
  for (const [cx, cy] of [[0.25, 0.7], [0.72, 0.75], [0.5, 0.25]]) for (let i = 0; i < 22; i++) pts.push([cx + 0.09 * gauss(r), cy + 0.09 * gauss(r)]);
  let k = 3, centres, assign, round, settled;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  const status = h('p', { class: 'w-sub', role: 'status' });
  function reset() {
    const rr = rng(3 + k);
    centres = Array.from({ length: k }, () => [0.15 + 0.7 * rr(), 0.15 + 0.7 * rr()]);
    assign = pts.map(() => -1); round = 0; settled = false;
    draw();
  }
  function step() {
    if (settled) return;
    const res = kmeansStep(pts, centres);
    settled = round > 0 && res.centres.every((c, i) => Math.hypot(c[0] - centres[i][0], c[1] - centres[i][1]) < 1e-4);
    assign = res.assign; centres = res.centres; round++;
    draw();
  }
  function draw() {
    svg.replaceChildren(
      ...pts.map(([a, b], i) => s('circle', { cx: x(a), cy: y(b), r: 5, class: `km-pt km-${assign[i]}` })),
      ...centres.map(([a, b], i) => s('path', { d: `M${x(a) - 9},${y(b)}h18M${x(a)},${y(b) - 9}v18`, class: `km-c km-${i}` })));
    status.textContent = round === 0 ? '' : p(settled ? L.done : L.round).replace('{n}', round);
  }
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [
    seg([[2, '2'], [3, '3'], [4, '4']], k, v => { k = v; reset(); }, p(L.k)), svg, status,
    h('div', { class: 'w-buttons' }, button(p(L.step), step, 'button'), button(p(L.reset), reset)), h('p', { class: 'w-explain' }, p(L.hint))] }));
  reset();
  return { destroy() { el.replaceChildren(); } };
}
