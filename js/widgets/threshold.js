/* Classification threshold and the confusion matrix. Each dot is one email
   with the model's spam score; red dots are really spam, blue are not.
   Drag the threshold: everything at or right of it is predicted spam. The
   matrix and the metrics follow. Illustrative data, generated so the two
   classes overlap the way real scores do. */

import { s, h, track, readout, frame, size, seg, fmt, scale, clamp, T } from './kit.js';
import { scoredExamples, confusion, metrics } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Move the classification threshold', '移动分类阈值'),
  spam: T('Spam (actual positive)', '垃圾邮件（实际正类）'), ham: T('Not spam (actual negative)', '非垃圾邮件（实际负类）'),
  score: T('Model score', '模型得分'), thr: T('Threshold', '阈值'),
  data: T('Dataset', '数据集'), balanced: T('Balanced', '类别平衡'), imbalanced: T('Imbalanced (1 in 5 is spam)', '类别不平衡（5 封中 1 封是垃圾邮件）'),
  sep: T('Model', '模型'), weak: T('Weaker', '较弱'), mid: T('Medium', '中等'), strong: T('Stronger', '较强'),
  pred: T('Predicted', '预测'), act: T('Actual', '实际'), pos: T('Spam', '垃圾'), neg: T('Not spam', '非垃圾'),
  acc: T('Accuracy', '准确率'), prec: T('Precision', '精确率'), rec: T('Recall (TPR)', '召回率 (TPR)'), fpr: T('False positive rate', '假正例率'), f1: 'F1',
  hint: T('Raise the threshold: fewer false positives, more false negatives — precision usually rises while recall falls.', '提高阈值：假正例变少、假负例变多——精确率通常上升，召回率下降。'),
  tie: T('A score exactly at the threshold counts as spam here.', '本图中得分刚好等于阈值时算作垃圾邮件。'),
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W } = size(el);
  let balanced = true, separation = 1.8, t = 0.5, ex = [];
  const M = { l: 14, r: 14 };
  const x = scale(0, 1, M.l, W - M.r);
  const R = 5, BIN = 0.025;
  const svg = s('svg', { class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  const matrix = h('table', { class: 'cm' });
  const out = readout([['t', p(L.thr)], ['acc', p(L.acc)], ['prec', p(L.prec)], ['rec', p(L.rec)], ['fpr', p(L.fpr)], ['f1', 'F1']]);
  let H = 200, base = 100;

  function data() {
    ex = scoredExamples(balanced ? { nPos: 24, nNeg: 24, separation, seed: 11 } : { nPos: 10, nNeg: 40, separation, seed: 11 });
    // Stack dots into columns so none hides another: spam above the axis, not-spam below.
    const cols = new Map();
    let up = 0, down = 0;
    for (const e of ex) {
      const k = `${e.label}:${Math.floor(e.score / BIN)}`;
      e.n = cols.get(k) || 0;
      cols.set(k, e.n + 1);
      if (e.label) up = Math.max(up, e.n + 1); else down = Math.max(down, e.n + 1);
    }
    base = 30 + up * (2 * R + 1);
    H = base + 34 + down * (2 * R + 1) + 6;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  function draw() {
    const c = confusion(ex, t);
    svg.replaceChildren(
      s('text', { x: M.l, y: 14, class: 'unit' }, p(L.spam)),
      s('text', { x: M.l, y: H - 4, class: 'unit' }, p(L.ham)),
      s('rect', { x: x(t), y: 18, width: Math.max(0, W - M.r - x(t)), height: H - 30, class: 'th-zone' }),
      s('line', { x1: M.l, x2: W - M.r, y1: base + 14, y2: base + 14, class: 'grid' }),
      ...[0, 0.25, 0.5, 0.75, 1].map(v => s('text', { x: x(v), y: base + 28, 'text-anchor': 'middle', class: 'chart-tick' }, String(v))),
      ...ex.map(e => {
        const cy = e.label ? base - e.n * (2 * R + 1) : base + 40 + e.n * (2 * R + 1);
        const predicted = e.score >= t;
        const kind = e.label ? (predicted ? 'tp' : 'fn') : (predicted ? 'fp' : 'tn');
        return s('circle', { cx: x(Math.floor(e.score / BIN) * BIN + BIN / 2), cy, r: R, class: `th-dot th-${e.label ? 'pos' : 'neg'} th-${kind}` });
      }),
      s('line', { x1: x(t), x2: x(t), y1: 18, y2: H - 12, class: 'th-line' }),
      s('circle', { cx: x(t), cy: base + 14, r: 10, class: 'w-handle', tabindex: '0' }));
    matrix.replaceChildren(
      h('tr', {}, h('th', {}), h('th', { scope: 'col' }, `${p(L.pred)}: ${p(L.pos)}`), h('th', { scope: 'col' }, `${p(L.pred)}: ${p(L.neg)}`)),
      h('tr', {}, h('th', { scope: 'row' }, `${p(L.act)}: ${p(L.pos)}`), h('td', { class: 'cm-tp' }, `TP ${c.tp}`), h('td', { class: 'cm-fn' }, `FN ${c.fn}`)),
      h('tr', {}, h('th', { scope: 'row' }, `${p(L.act)}: ${p(L.neg)}`), h('td', { class: 'cm-fp' }, `FP ${c.fp}`), h('td', { class: 'cm-tn' }, `TN ${c.tn}`)));
    const m = metrics(c);
    const f = v => (Number.isFinite(v) ? fmt(v, 2) : '—');
    out.set('t', t.toFixed(2)); out.set('acc', f(m.accuracy)); out.set('prec', f(m.precision)); out.set('rec', f(m.recall)); out.set('fpr', f(m.fpr)); out.set('f1', f(m.f1));
  }

  track(svg, pt => { t = clamp(Math.round(x.invert(pt.x) * 100) / 100, 0, 1); draw(); });
  svg.addEventListener('keydown', e => { const d = { ArrowRight: 0.01, ArrowLeft: -0.01 }[e.key]; if (d) { e.preventDefault(); t = clamp(+(t + d).toFixed(2), 0, 1); draw(); } });
  const controls = h('div', { class: 'w-controls' },
    seg([[true, p(L.balanced)], [false, p(L.imbalanced)]], balanced, v => { balanced = v; data(); draw(); }, p(L.data)),
    seg([[1.0, p(L.weak)], [1.8, p(L.mid)], [3.0, p(L.strong)]], separation, v => { separation = v; data(); draw(); }, p(L.sep)));
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [controls, svg, h('div', { class: 'table-scroll' }, matrix), out,
    h('p', { class: 'w-explain' }, p(L.hint)), h('p', { class: 'w-note' }, p(L.tie))] }));
  data(); draw();
  return { destroy() { el.replaceChildren(); } };
}
