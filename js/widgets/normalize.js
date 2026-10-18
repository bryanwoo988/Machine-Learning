/* Normalisation: the same skewed feature (a power-law-like spread, many
   small values and a long tail) before and after linear scaling, Z-score
   scaling, log scaling and clipping. Illustrative data. */

import { s, h, frame, size, seg, readout, fmt, scale, T } from './kit.js';
import { rng, gauss, normalise, mean, sd } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Normalise a skewed feature', '把偏斜的特征归一化'),
  method: T('Method', '方法'),
  none: T('Raw', '原始'), linear: T('Linear scaling', '线性缩放'), z: T('Z-score', 'Z 分数'), log: T('Log scaling', '对数缩放'), clip: T('Clipping', '截断'),
  count: T('Count', '数量'), value: T('Feature value', '特征值'),
  min: T('Min', '最小值'), max: T('Max', '最大值'), mean: T('Mean', '平均值'), sd: T('Std dev', '标准差'),
  notes: {
    none: T('Most values are small and a long tail stretches to the right: the shape of a power-law-like distribution.', '大多数值很小，右边拖着一条长尾：类似幂律分布的形状。'),
    linear: T('Everything is squeezed into [0, 1], but the shape is unchanged: the tail still crowds the bulk into a corner.', '所有值被压进 [0, 1]，但形状不变：长尾仍把大部分数据挤在一角。'),
    z: T('Mean 0 and standard deviation 1; the skew remains, and the tail sits several standard deviations out.', '平均值为 0、标准差为 1；偏斜仍在，长尾落在好几个标准差之外。'),
    log: T('Taking the log spreads the small values and pulls in the tail; the histogram becomes roughly bell-shaped.', '取对数把小值拉开、把长尾收回来；直方图大致变成钟形。'),
    clip: T('Values above 4 are set to 4, so the outliers pile up in the last bar instead of stretching the axis.', '大于 4 的值都设为 4，离群值堆在最后一栏，而不是把坐标轴拉长。'),
  },
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.5, maxH: 300 });
  const M = { t: 20, r: 14, b: 30, l: 38 };
  const r = rng(21);
  const raw = Array.from({ length: 400 }, () => Math.exp(0.15 + 0.75 * gauss(r)));
  let method = 'none';
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  const out = readout([['min', p(L.min)], ['max', p(L.max)], ['mean', p(L.mean)], ['sd', p(L.sd)]]);
  const note = h('p', { class: 'w-explain' });
  function draw() {
    const xs = normalise(raw, method, { clipAt: 4 });
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const NB = 24, w = (hi - lo) / NB || 1;
    const bins = new Array(NB).fill(0);
    for (const v of xs) bins[Math.min(NB - 1, Math.floor((v - lo) / w))]++;
    const top = Math.max(...bins);
    const x = scale(lo, hi, M.l, W - M.r), y = scale(0, top, H - M.b, M.t);
    const ticks = [lo, lo + (hi - lo) / 2, hi];
    svg.replaceChildren(
      ...[0, Math.round(top / 2), top].map(v => s('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-tick' }, String(v))),
      ...bins.map((n, i) => s('rect', { x: x(lo + i * w) + 0.5, y: y(n), width: Math.max(1, x(lo + w) - x(lo) - 1), height: y(0) - y(n), class: 'nm-bar' })),
      s('line', { x1: M.l, x2: W - M.r, y1: y(0), y2: y(0), class: 'grid' }),
      ...ticks.map(v => s('text', { x: x(v), y: H - M.b + 15, 'text-anchor': 'middle', class: 'chart-tick' }, fmt(v, Math.abs(hi - lo) < 5 ? 2 : 1))),
      s('text', { x: W - M.r, y: H - 4, 'text-anchor': 'end', class: 'unit' }, p(L.value)),
      s('text', { x: 4, y: 12, class: 'unit' }, p(L.count)));
    out.set('min', fmt(lo, 2)); out.set('max', fmt(hi, 2)); out.set('mean', fmt(mean(xs), 2)); out.set('sd', fmt(sd(xs), 2));
    note.textContent = p(L.notes[method]);
  }
  const pickM = seg(['none', 'linear', 'z', 'log', 'clip'].map(k => [k, p(L[k])]), method, k => { method = k; draw(); }, p(L.method));
  el.append(frame({ title: p(L.title), lang, schematic: true, children: [pickM, svg, out, note] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
