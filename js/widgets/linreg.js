/* Linear regression: drag the line's two handles over the seven cars from
   the lesson's table and watch MAE and MSE change. Residuals are drawn from
   each point to the line; "Best fit" puts the least-squares line in. */

import { s, h, track, readout, frame, size, axes, button, fmt, scale, clamp, T } from './kit.js';
import { CARS, mse, mae, leastSquares, predict } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Fit a line: drag the two handles', '拟合一条直线：拖动两个圆点'),
  x: T('Car weight (1000 lb)', '车重（千磅）'),
  y: T('Miles per gallon', '每加仑英里数'),
  w: T('Weight w', '权重 w'), b: T('Bias b', '偏差 b'),
  best: T('Best fit', '最佳拟合'), google: T("Lesson's model", '课文的模型'),
  residuals: T('Lines from each point to the model are the errors that MAE and MSE average.', '每个点到直线的竖线就是误差；MAE 和 MSE 就是把这些误差平均起来。'),
  source: T("The 7 cars in the lesson's table (Google MLCC)", '课文表格里的 7 辆车（Google 机器学习速成课程）'),
};

export function mount(el, { lang, opts = {} }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el);
  const M = { t: 26, r: 14, b: 30, l: 40 };
  const x = scale(2, 5, M.l, W - M.r), y = scale(10, 28, H - M.b, M.t);
  // The lesson's example model: y' = 34 - 4.6x (its Linear regression page).
  let w = opts.start === 'flat' ? 0 : -4.6, b = opts.start === 'flat' ? 18 : 34;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  axes(svg, { x, y, xTicks: [2, 2.5, 3, 3.5, 4, 4.5, 5], yTicks: [10, 14, 18, 22, 26], M, W, H, xLabel: p(L.x), yLabel: p(L.y) });
  const res = s('g', { class: 'lr-res' });
  const line = s('line', { class: 'lr-line' });
  const dots = s('g', {}, CARS.map(([cx, cy]) => s('circle', { cx: x(cx), cy: y(cy), r: 5, class: 'lr-dot' })));
  const hx = [2.05, 4.9];
  const handles = hx.map(() => s('circle', { r: 11, class: 'w-handle', tabindex: '0' }));
  svg.append(res, line, dots, ...handles);
  const out = readout([['w', p(L.w)], ['b', p(L.b)], ['mae', 'MAE'], ['mse', 'MSE']]);
  const [bw, bb] = leastSquares(CARS);

  function draw() {
    const y0 = predict(w, b, 2), y1 = predict(w, b, 5);
    line.setAttribute('x1', x(2)); line.setAttribute('y1', y(y0));
    line.setAttribute('x2', x(5)); line.setAttribute('y2', y(y1));
    hx.forEach((hxv, i) => { handles[i].setAttribute('cx', x(hxv)); handles[i].setAttribute('cy', y(predict(w, b, hxv))); });
    res.replaceChildren(...CARS.map(([cx, cy]) => s('line', { x1: x(cx), x2: x(cx), y1: y(cy), y2: y(predict(w, b, cx)) })));
    out.set('w', fmt(w, 2)); out.set('b', fmt(b, 2));
    out.set('mae', fmt(mae(CARS, w, b), 2)); out.set('mse', fmt(mse(CARS, w, b), 2));
  }

  // Dragging moves the nearer handle; the other stays put, so the line
  // pivots around it the way you would lay a ruler.
  let grab = null;
  track(svg, (pt, e) => {
    if (e.type === 'pointerdown') grab = Math.abs(pt.x - x(hx[0])) < Math.abs(pt.x - x(hx[1])) ? 0 : 1;
    if (grab == null || (e.type === 'pointermove' && e.buttons === 0)) return;
    const ys = hx.map(v => predict(w, b, v));
    ys[grab] = clamp(y.invert(pt.y), 4, 34);
    w = (ys[1] - ys[0]) / (hx[1] - hx[0]);
    b = ys[0] - w * hx[0];
    draw();
  });
  svg.addEventListener('pointerup', () => { grab = null; });
  handles.forEach((hd, i) => hd.addEventListener('keydown', e => {
    const d = { ArrowUp: 0.5, ArrowDown: -0.5 }[e.key];
    if (!d) return;
    e.preventDefault();
    const ys = hx.map(v => predict(w, b, v));
    ys[i] += d;
    w = (ys[1] - ys[0]) / (hx[1] - hx[0]); b = ys[0] - w * hx[0];
    draw();
  }));

  const bar = h('div', { class: 'w-buttons' },
    button(p(L.best), () => { w = bw; b = bb; draw(); }),
    button(p(L.google), () => { w = -4.6; b = 34; draw(); }));
  el.append(frame({ title: p(L.title), lang, source: p(L.source), children: [svg, out, bar, h('p', { class: 'w-explain' }, p(L.residuals))] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
