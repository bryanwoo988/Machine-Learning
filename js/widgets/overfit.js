/* Model complexity and overfitting. Twelve noisy points from a smooth curve
   are split into training (filled) and validation (hollow) examples. Raise
   the polynomial degree: training loss keeps falling, validation loss falls
   and then rises — the generalisation gap. With the L2 slider, a complex
   model is pulled back towards a simpler one. Illustrative data. */

import { s, h, frame, size, axes, slider, readout, fmt, scale, T } from './kit.js';
import { rng, gauss, polyfit, polyval } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('More complex is not always better', '模型越复杂不一定越好'),
  degree: T('Model complexity (polynomial degree)', '模型复杂度（多项式次数）'),
  lambda: T('L2 regularization rate λ', 'L2 正则化率 λ'),
  train: T('Training loss', '训练损失'), val: T('Validation loss', '验证损失'),
  legendT: T('● training', '● 训练'), legendV: T('○ validation', '○ 验证'),
  under: T('Underfitting: too simple to follow the pattern; both losses are high.', '欠拟合：模型太简单，跟不上规律；两种损失都高。'),
  fit: T('A good fit: the curve follows the trend without chasing every point.', '拟合得好：曲线跟着趋势走，而不是追着每一个点。'),
  over: T('Overfitting: the curve bends through the training points, and validation loss climbs.', '过拟合：曲线为了穿过训练点而弯来弯去，验证损失上升。'),
};

export function mount(el, { lang, opts = {} }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.6 });
  const M = { t: 20, r: 14, b: 28, l: 34 };
  const x = scale(-1, 1, M.l, W - M.r), y = scale(-1.8, 1.8, H - M.b, M.t);
  const r = rng(4);
  const truth = v => Math.sin(Math.PI * v * 0.9);
  const pts = Array.from({ length: 12 }, (_, i) => { const v = -0.95 + i * 1.9 / 11 + (r() - 0.5) * 0.08; return [v, truth(v) + 0.28 * gauss(r)]; });
  const train = pts.filter((_, i) => i % 3 !== 1), val = pts.filter((_, i) => i % 3 === 1);
  let degree = opts.degree ?? 3, lambda = 0;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  axes(svg, { x, y, xTicks: [-1, 0, 1], yTicks: [-1, 0, 1], M, W, H });
  const curve = s('polyline', { class: 'of-curve' });
  svg.append(curve,
    ...train.map(([a, b]) => s('circle', { cx: x(a), cy: y(b), r: 5, class: 'of-train' })),
    ...val.map(([a, b]) => s('circle', { cx: x(a), cy: y(b), r: 5, class: 'of-val' })),
    s('text', { x: M.l + 4, y: M.t + 2, class: 'unit' }, `${p(L.legendT)}   ${p(L.legendV)}`));
  const out = readout([['train', p(L.train)], ['val', p(L.val)]]);
  const bars = s('svg', { viewBox: `0 0 ${W} 54`, class: 'w-svg of-bars', 'aria-hidden': 'true' });
  const note = h('p', { class: 'w-explain' });
  const loss = (c, set) => set.reduce((a, [u, v]) => a + (polyval(c, u) - v) ** 2, 0) / set.length;
  function draw() {
    const c = polyfit(train, degree, lambda);
    const line = [];
    for (let v = -1; v <= 1.0001; v += 0.01) line.push(`${x(v).toFixed(1)},${y(Math.max(-2.2, Math.min(2.2, polyval(c, v)))).toFixed(1)}`);
    curve.setAttribute('points', line.join(' '));
    const lt = loss(c, train), lv = loss(c, val);
    out.set('train', fmt(lt, 3)); out.set('val', fmt(lv, 3));
    const sc = v => Math.min(W - 120, (W - 120) * Math.sqrt(v / 1.2));
    bars.replaceChildren(
      s('text', { x: 0, y: 16, class: 'chart-tick' }, p(L.train)), s('rect', { x: 110, y: 6, width: Math.max(2, sc(lt)), height: 14, class: 'of-bar-t' }),
      s('text', { x: 0, y: 44, class: 'chart-tick' }, p(L.val)), s('rect', { x: 110, y: 34, width: Math.max(2, sc(lv)), height: 14, class: 'of-bar-v' }));
    note.textContent = p(lt > 0.12 && lv > 0.12 && degree <= 1 ? L.under : lv > 2 * lt + 0.08 && degree >= 5 ? L.over : L.fit);
  }
  const kids = [svg, slider({ label: p(L.degree), min: 1, max: 7, step: 1, value: degree, onInput: v => { degree = v; draw(); } })];
  if (opts.lambda !== false) kids.push(slider({ label: p(L.lambda), min: 0, max: 0.1, step: 0.001, value: 0, onInput: v => { lambda = v; draw(); } }));
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [...kids, out, bars, note] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
