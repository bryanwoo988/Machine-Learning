/* ROC curve and AUC. The curve is the true positive rate against the false
   positive rate at every threshold; drag along it (or the slider) to see the
   threshold each point stands for. Change how well the model separates the
   classes and watch the area under the curve. Illustrative data. */

import { s, h, track, readout, frame, size, axes, seg, slider, fmt, scale, T } from './kit.js';
import { scoredExamples, roc, auc, confusion, metrics } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('ROC curve: every threshold at once', 'ROC 曲线：所有阈值一次看完'),
  fpr: T('False positive rate', '假正例率'), tpr: T('True positive rate', '真正例率'),
  model: T('Model', '模型'), random: T('Random guess', '随机猜测'), weak: T('Weak', '较弱'), good: T('Good', '较好'), perfect: T('Perfect', '完美'),
  thr: T('Threshold', '阈值'), auc: 'AUC',
  hint: T('The diagonal is a coin flip (AUC 0.5). The closer the curve hugs the top-left corner, the better the model ranks positives above negatives.', '对角线相当于抛硬币（AUC 0.5）。曲线越贴近左上角，模型越能把正例排在负例前面。'),
};
const SEP = { random: 0, weak: 1.2, good: 2.4, perfect: 9 };

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W } = size(el);
  const S = Math.min(W, 420);
  const M = { t: 22, r: 14, b: 32, l: 40 };
  const x = scale(0, 1, M.l, S - M.r), y = scale(0, 1, S - M.b, M.t);
  let kind = 'good', ex = [], pts = [], t = 0.5;
  const svg = s('svg', { viewBox: `0 0 ${S} ${S}`, class: 'w-svg roc-svg', role: 'img', 'aria-label': p(L.title) });
  axes(svg, { x, y, xTicks: [0, 0.5, 1], yTicks: [0, 0.5, 1], M, W: S, H: S, xLabel: p(L.fpr), yLabel: p(L.tpr) });
  const area = s('polygon', { class: 'roc-area' }), curve = s('polyline', { class: 'roc-curve' }), dot = s('circle', { r: 8, class: 'w-handle' });
  svg.append(s('line', { x1: x(0), y1: y(0), x2: x(1), y2: y(1), class: 'ref-line' }), area, curve, dot);
  const out = readout([['auc', 'AUC'], ['t', p(L.thr)], ['tpr', p(L.tpr)], ['fpr', p(L.fpr)]]);
  const thr = slider({ label: p(L.thr), min: 0, max: 1, step: 0.01, value: t, onInput: v => { t = v; draw(); } });

  function data() {
    ex = scoredExamples({ nPos: 40, nNeg: 40, separation: SEP[kind], seed: 5 });
    pts = roc(ex);
    curve.setAttribute('points', pts.map(q => `${x(q.fpr).toFixed(1)},${y(q.tpr).toFixed(1)}`).join(' '));
    area.setAttribute('points', [`${x(0)},${y(0)}`, ...pts.map(q => `${x(q.fpr).toFixed(1)},${y(q.tpr).toFixed(1)}`), `${x(1)},${y(0)}`].join(' '));
    out.set('auc', fmt(auc(pts), 2));
  }
  function draw() {
    const m = metrics(confusion(ex, t));
    const fp = m.fpr || 0, tp = m.recall || 0;
    dot.setAttribute('cx', x(fp)); dot.setAttribute('cy', y(tp));
    out.set('t', fmt(t, 2)); out.set('tpr', fmt(tp, 2)); out.set('fpr', fmt(fp, 2));
    thr.set(t.toFixed(2));
  }
  // Dragging on the plot picks the curve point nearest the finger.
  track(svg, pt => {
    let best = null, bd = Infinity;
    for (const q of pts) { const d = (x(q.fpr) - pt.x) ** 2 + (y(q.tpr) - pt.y) ** 2; if (d < bd && Number.isFinite(q.t)) { bd = d; best = q; } }
    if (best) { t = Math.min(1, best.t); draw(); }
  });
  const pick4 = seg(Object.keys(SEP).map(k => [k, p(L[k])]), kind, k => { kind = k; data(); draw(); }, p(L.model));
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [pick4, h('div', { class: 'w-center' }, svg), thr, out, h('p', { class: 'w-explain' }, p(L.hint))] }));
  data(); draw();
  return { destroy() { el.replaceChildren(); } };
}
