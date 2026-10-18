/* Gradient descent on the lesson's seven cars. Left: the loss surface (MSE
   for every weight and bias; darker is lower) with the path the steps take.
   Right: the loss curve. Pick a learning rate and press Start; tap the
   surface to start from somewhere else. The numbers are computed, not drawn:
   the "too large" rate is just above 2 / (largest Hessian eigenvalue), where
   gradient descent on MSE stops converging. */

import { s, h, track, readout, frame, size, axes, seg, button, fmt, scale, T } from './kit.js';
import { CARS, mse, gradient, leastSquares, maxStableRate } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Gradient descent: watch the steps go downhill', '梯度下降：看每一步怎样走下坡'),
  rate: T('Learning rate', '学习速率'),
  small: T('Too small', '太小'), good: T('Good', '合适'), edge: T('Near the limit', '接近上限'), big: T('Too large', '太大'),
  start: T('Start', '开始'), pause: T('Pause', '暂停'), reset: T('Reset', '重设'),
  surface: T('Loss surface: the coloured valley is where MSE is lowest', '损失曲面：有颜色的“山谷”就是 MSE 最低的地方'),
  curve: T('Loss curve', '损失曲线'), iter: T('Iterations', '迭代次数'),
  steps: T('Iterations', '迭代次数'),
  tap: T('Tap the surface to choose a new starting weight and bias.', '点一下曲面，可以换一个起始的权重和偏差。'),
  conv: T('Converged: the loss has stopped falling.', '已收敛：损失不再下降。'),
  div: T('Diverged: each step overshoots further and the loss explodes.', '发散：每一步都冲得更远，损失爆炸。'),
  slow: T('Still far from the minimum: the steps are tiny.', '离最低点还很远：每一步都太小。'),
  source: T("Computed on the 7 cars in the lesson's table", '用课文表格里的 7 辆车计算'),
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const rmax = maxStableRate(CARS);
  const RATES = [['small', 0.001], ['good', +(0.85 * rmax).toFixed(3)], ['edge', +(0.97 * rmax).toFixed(3)], ['big', +(1.04 * rmax).toFixed(3)]];
  let rate = RATES[1][1];
  const [bw, bb] = leastSquares(CARS);
  const best = mse(CARS, bw, bb);
  const START = [0, 0];
  let w = START[0], b = START[1], path = [], losses = [], timer = 0, i = 0;

  const { W } = size(el, {});
  const wide = W >= 560;
  const PW = wide ? Math.floor((W - 16) / 2) : W, PH = Math.round(PW * 0.8);
  const M = { t: 24, r: 10, b: 30, l: 40 };
  const xw = scale(-12, 4, M.l, PW - M.r), yb = scale(-10, 60, PH - M.b, M.t);

  // Loss surface as a grid of cells, shaded by log(MSE).
  const surf = s('svg', { viewBox: `0 0 ${PW} ${PH}`, class: 'w-svg', role: 'img', 'aria-label': p(L.surface) });
  const cells = s('g', {});
  const NX = 48, NY = 40;
  const lo = Math.log(best), hi = Math.log(mse(CARS, 4, -10));
  for (let ix = 0; ix < NX; ix++) for (let iy = 0; iy < NY; iy++) {
    const cw = -12 + (ix + 0.5) * 16 / NX, cb = -10 + (iy + 0.5) * 70 / NY;
    const v = Math.min(1, Math.max(0, (Math.log(mse(CARS, cw, cb)) - lo) / (hi - lo)));
    cells.append(s('rect', { x: xw(-12 + ix * 16 / NX), y: yb(-10 + (iy + 1) * 70 / NY), width: (PW - M.l - M.r) / NX + 0.5, height: (PH - M.t - M.b) / NY + 0.5,
      class: 'gd-cell', 'fill-opacity': (0.85 * (1 - v) ** 1.6 + 0.04).toFixed(3) }));
  }
  surf.append(cells);
  axes(surf, { x: xw, y: yb, xTicks: [-12, -8, -4, 0, 4], yTicks: [0, 20, 40, 60], M, W: PW, H: PH, xLabel: 'w', yLabel: 'b' });
  const trail = s('polyline', { class: 'gd-path' });
  const dot = s('circle', { r: 6, class: 'gd-dot' });
  surf.append(s('circle', { cx: xw(bw), cy: yb(bb), r: 4, class: 'gd-min' }), trail, dot);

  // Loss curve.
  const curve = s('svg', { viewBox: `0 0 ${PW} ${PH}`, class: 'w-svg', role: 'img', 'aria-label': p(L.curve) });
  const MAXI = 1500;
  const xi = scale(0, MAXI, M.l, PW - M.r), yl = scale(0, 400, PH - M.b, M.t);
  axes(curve, { x: xi, y: yl, xTicks: [0, 500, 1000, 1500], yTicks: [0, 100, 200, 300, 400], M, W: PW, H: PH, xLabel: p(L.iter), yLabel: 'MSE' });
  const lossLine = s('polyline', { class: 'gd-loss' });
  curve.append(s('line', { x1: M.l, x2: PW - M.r, y1: yl(best), y2: yl(best), class: 'ref-line' }), lossLine);

  const out = readout([['i', p(L.steps)], ['w', 'w'], ['b', 'b'], ['mse', 'MSE']]);
  const status = h('p', { class: 'w-explain', role: 'status' }, p(L.tap));
  const play = button(p(L.start), () => (timer ? stop() : run()), 'button');

  function reset(nw = START[0], nb = START[1]) {
    stop();
    w = nw; b = nb; i = 0;
    path = [[w, b]]; losses = [mse(CARS, w, b)];
    status.textContent = p(L.tap);
    draw();
  }
  function step() {
    const [gw, gb] = gradient(CARS, w, b);
    w -= rate * gw; b -= rate * gb; i++;
    const l = mse(CARS, w, b);
    path.push([w, b]); losses.push(l);
    return l;
  }
  function run() {
    play.textContent = p(L.pause);
    const tick = () => {
      let l = losses.at(-1);
      for (let k = 0; k < 6 && i < MAXI; k++) l = step();
      draw();
      const done = !Number.isFinite(l) || l > 1e6;
      const conv = Math.abs(l - best) < 0.02;
      if (done) status.textContent = p(L.div);
      else if (conv) status.textContent = p(L.conv);
      else if (i >= MAXI) status.textContent = p(L.slow);
      if (done || conv || i >= MAXI) return stop();
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function stop() {
    cancelAnimationFrame(timer); timer = 0;
    play.textContent = p(L.start);
  }
  const clampV = (v, a, z) => Math.max(a, Math.min(z, v));
  function draw() {
    const pts = path.map(([pw, pb]) => `${xw(clampV(pw, -40, 30)).toFixed(1)},${yb(clampV(pb, -60, 120)).toFixed(1)}`);
    trail.setAttribute('points', pts.join(' '));
    dot.setAttribute('cx', xw(clampV(w, -12.5, 4.5))); dot.setAttribute('cy', yb(clampV(b, -12, 62)));
    lossLine.setAttribute('points', losses.map((l, k) => `${xi(k).toFixed(1)},${yl(Math.min(l, 420)).toFixed(1)}`).join(' '));
    out.set('i', String(i)); out.set('w', fmt(w, 2)); out.set('b', fmt(b, 2));
    const l = losses.at(-1);
    out.set('mse', Number.isFinite(l) && l < 1e6 ? fmt(l, 2) : '∞');
  }
  track(surf, (pt, e) => { if (e.type === 'pointerdown') reset(clampV(xw.invert(pt.x), -12, 4), clampV(yb.invert(pt.y), -10, 60)); });

  const rates = seg(RATES.map(([k, v]) => [v, `${p(L[k])} · ${v}`]), rate, v => { rate = v; reset(path[0][0], path[0][1]); }, p(L.rate));
  const plots = h('div', { class: wide ? 'w-pair' : 'w-stack' },
    h('div', {}, h('p', { class: 'w-sub' }, p(L.surface)), surf),
    h('div', {}, h('p', { class: 'w-sub' }, p(L.curve)), curve));
  el.append(frame({ title: p(L.title), lang, source: p(L.source), children: [
    h('p', { class: 'w-sub' }, p(L.rate)), rates, plots, out,
    h('div', { class: 'w-buttons' }, play, button(p(L.reset), () => reset())), status] }));
  reset();
  return { destroy() { stop(); el.replaceChildren(); } };
}
