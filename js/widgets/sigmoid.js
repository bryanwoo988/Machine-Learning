/* The sigmoid function: drag along z (the log-odds, b + w₁x₁ + …) and read
   the probability σ(z) = 1 / (1 + e^−z). With a threshold, the same output
   becomes a class. */

import { s, h, track, readout, frame, size, axes, fmt, scale, clamp, T } from './kit.js';
import { sigmoid } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('The sigmoid squashes any z into a probability', 'S 型函数把任何 z 压到 0 和 1 之间'),
  z: T('z = b + w₁x₁ + … (log-odds)', 'z = b + w₁x₁ + …（对数几率）'),
  p: T('σ(z) probability', 'σ(z) 概率'),
  odds: T('Odds p / (1 − p)', '几率 p / (1 − p)'),
  cls: T('Class at threshold 0.5', '阈值 0.5 时的类别'),
  pos: T('positive', '正类'), neg: T('negative', '负类'),
  hint: T('Drag along the curve. However large z gets, σ(z) never quite reaches 0 or 1.', '沿着曲线拖动。无论 z 多大，σ(z) 都不会真正到达 0 或 1。'),
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.55 });
  const M = { t: 24, r: 14, b: 30, l: 40 };
  const x = scale(-8, 8, M.l, W - M.r), y = scale(0, 1, H - M.b, M.t);
  let z = 1.5;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  axes(svg, { x, y, xTicks: [-8, -4, 0, 4, 8], yTicks: [0, 0.25, 0.5, 0.75, 1], M, W, H, xLabel: 'z', yLabel: 'σ(z)' });
  const pts = [];
  for (let v = -8; v <= 8.001; v += 0.1) pts.push(`${x(v).toFixed(1)},${y(sigmoid(v)).toFixed(1)}`);
  const guideV = s('line', { class: 'ref-line' }), guideH = s('line', { class: 'ref-line' });
  const knob = s('circle', { r: 9, class: 'w-handle', tabindex: '0' });
  svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y(0.5), y2: y(0.5), class: 'sg-thresh' }),
    s('polyline', { points: pts.join(' '), class: 'sg-curve' }), guideV, guideH, knob);
  const out = readout([['z', 'z'], ['p', p(L.p)], ['odds', p(L.odds)], ['cls', p(L.cls)]]);
  function draw() {
    const pr = sigmoid(z);
    knob.setAttribute('cx', x(z)); knob.setAttribute('cy', y(pr));
    guideV.setAttribute('x1', x(z)); guideV.setAttribute('x2', x(z)); guideV.setAttribute('y1', H - M.b); guideV.setAttribute('y2', y(pr));
    guideH.setAttribute('x1', M.l); guideH.setAttribute('x2', x(z)); guideH.setAttribute('y1', y(pr)); guideH.setAttribute('y2', y(pr));
    out.set('z', fmt(z, 2)); out.set('p', pr > 0.9995 || pr < 0.0005 ? pr.toExponential(2) : fmt(pr, 3));
    out.set('odds', fmt(pr / (1 - pr), 2)); out.set('cls', p(pr >= 0.5 ? L.pos : L.neg));
  }
  track(svg, pt => { z = clamp(Math.round(x.invert(pt.x) * 10) / 10, -8, 8); draw(); });
  knob.addEventListener('keydown', e => { const d = { ArrowRight: 0.5, ArrowLeft: -0.5 }[e.key]; if (d) { e.preventDefault(); z = clamp(z + d, -8, 8); draw(); } });
  el.append(frame({ title: p(L.title), lang, children: [svg, out, h('p', { class: 'w-explain' }, p(L.hint))] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
