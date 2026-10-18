/* Declarative line charts that you can scrub with a finger.

   A chart spec names a data file in data/series/ and which columns to draw:

   { "kind": "line", "series_file": "kl-humidity-2025",
     "title": {…}, "x": { "col": "hour", "label": {…}, "format": "hour" },
     "y":  { "label": {…}, "unit": "°C" },
     "y2": { "label": {…}, "unit": "%" },               optional right axis
     "series": [ { "col": "dew_point_2m", "name": {…}, "color": "rain", "axis": "y" } ] }

   Values are read off in a readout line under the plot rather than a
   tooltip, which a finger would cover. Every chart also carries its numbers
   as a visually hidden table. Colours are CSS tokens, so a theme switch
   needs no redraw. */

import { pick, t } from './i18n.js';
import { s, h, scale, clamp, niceTicks, track } from './widgets/kit.js';
import { loadData } from './content.js';

const M = { t: 28, r: 40, b: 34, l: 40 };

// Drawn at the container's own width, so one SVG unit is one CSS pixel and
// axis labels stay legible on a phone.
const sizeFor = host => {
  const W = Math.round(clamp((host.clientWidth || 640) - 30, 280, 680));
  return { W, H: Math.round(W < 480 ? W * 0.68 : W * 0.46) };
};

const MONTHS = {
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'],
};
let LANG = 'en';
export function xLabel(v, format, lang = LANG) {
  if (format === 'hour') return `${String(v).padStart(2, '0')}:00`;
  if (format === 'month') return MONTHS[lang][v - 1];
  if (format === 'year') return String(v).slice(0, 4);
  if (format === 'date') {                      // 'YYYY-MM-DD' → '18 Sep' / '9月18日'
    const [, m, d] = String(v).split('-').map(Number);
    return lang === 'zh' ? `${m}月${d}日` : `${d} ${MONTHS[lang][m - 1]}`;
  }
  return String(v);
}

function domain(values) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  return [Math.min(ticks[0], lo), Math.max(ticks[ticks.length - 1], hi), ticks];
}

export function render(spec, { lang }) {
  const host = h('figure', { class: 'chart' });
  loadData(`series/${spec.series_file}`).then(data => draw(host, spec, data, lang)).catch(e => {
    console.error(e);
    host.append(h('p', { class: 'error' }, t('loadError', null, lang)));
  });
  return host;
}

function draw(host, spec, data, lang) {
  LANG = lang;
  const { W, H } = sizeFor(host);
  const col = name => data.columns.indexOf(name);
  const xs = data.rows.map(r => r[col(spec.x.col)]);
  const n = xs.length;
  const x = scale(0, n - 1, M.l, W - M.r);
  const axes = {};
  for (const key of ['y', 'y2']) {
    if (!spec[key]) continue;
    const vals = spec.series.filter(sr => (sr.axis ?? 'y') === key).flatMap(sr => data.rows.map(r => r[col(sr.col)]));
    const [lo, hi, ticks] = domain(vals);
    axes[key] = { y: scale(lo, hi, H - M.b, M.t), ticks, unit: spec[key].unit };
  }

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', tabindex: '0', role: 'img', 'aria-label': pick(spec.title, lang) });
  svg.append(s('title', {}, pick(spec.title, lang)));

  // Grid and axis labels.
  const g = s('g', { class: 'chart-axes' });
  for (const tk of axes.y.ticks) {
    const yy = axes.y.y(tk);
    g.append(s('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: 'grid' }));
    g.append(s('text', { x: M.l - 8, y: yy + 4, 'text-anchor': 'end' }, `${tk}`));
  }
  if (axes.y2) for (const tk of axes.y2.ticks) g.append(s('text', { x: W - M.r + 8, y: axes.y2.y(tk) + 4 }, `${tk}`));
  g.append(s('text', { x: M.l - 8, y: M.t - 14, 'text-anchor': 'end', class: 'unit' }, axes.y.unit));
  if (axes.y2) g.append(s('text', { x: W - M.r + 8, y: M.t - 14, class: 'unit' }, axes.y2.unit));
  const every = Math.ceil(n / (W < 480 ? 4 : 8));
  xs.forEach((v, i) => { if (i % every === 0) g.append(s('text', { x: x(i), y: H - M.b + 18, 'text-anchor': 'middle' }, xLabel(v, spec.x.format))); });
  // Reference lines, e.g. the ±0.5 °C El Niño / La Niña thresholds.
  for (const r of spec.y.refs ?? []) {
    const yy = axes.y.y(r.v);
    g.append(s('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: 'ref-line' }));
    if (r.label) g.append(s('text', { x: W - M.r - 4, y: yy - 4, 'text-anchor': 'end', class: 'ref-label' }, pick(r.label, lang)));
  }
  svg.append(g);

  // Series.
  for (const sr of spec.series) {
    const ax = axes[sr.axis ?? 'y'];
    const d = data.rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${ax.y(r[col(sr.col)]).toFixed(1)}`).join('');
    svg.append(s('path', { d, class: 'series', style: `stroke: var(--${sr.color})`, ...(sr.axis === 'y2' ? { 'stroke-dasharray': '5 4' } : {}) }));
  }

  // Scrub cursor.
  const cursor = s('g', { class: 'chart-cursor' });
  const line = s('line', { y1: M.t, y2: H - M.b });
  cursor.append(line);
  const dots = spec.series.map(sr => { const c = s('circle', { r: 4.5, style: `fill: var(--${sr.color})` }); cursor.append(c); return c; });
  svg.append(cursor);

  const legend = h('ul', { class: 'chart-legend' }, spec.series.map(sr =>
    h('li', {}, h('span', { class: `swatch${sr.axis === 'y2' ? ' is-dashed' : ''}`, style: `--c: var(--${sr.color})` }), pick(sr.name, lang))));
  const out = h('p', { class: 'chart-readout', 'aria-live': 'polite' });

  let at = 0;
  const show = i => {
    at = clamp(i, 0, n - 1);
    const xx = x(at);
    line.setAttribute('x1', xx); line.setAttribute('x2', xx);
    spec.series.forEach((sr, k) => {
      dots[k].setAttribute('cx', xx);
      dots[k].setAttribute('cy', axes[sr.axis ?? 'y'].y(data.rows[at][col(sr.col)]));
    });
    out.textContent = `${spec.x.format === 'year' ? xs[at] : xLabel(xs[at], spec.x.format)} · ` + spec.series.map(sr =>
      `${pick(sr.name, lang)} ${data.rows[at][col(sr.col)]}${spec[sr.axis ?? 'y'].unit === '%' ? ' %' : ` ${spec[sr.axis ?? 'y'].unit}`}`).join(' · ');
  };
  track(svg, p => show(Math.round(x.invert(p.x))));
  svg.addEventListener('keydown', e => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    show(at + step);
  });

  // The numbers, for screen readers and for when the graphic fails.
  const table = h('div', { class: 'visually-hidden' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, pick(spec.x.label, lang)), spec.series.map(sr => h('th', {}, pick(sr.name, lang))))),
    h('tbody', {}, data.rows.map(r => h('tr', {}, h('td', {}, xLabel(r[col(spec.x.col)], spec.x.format)), spec.series.map(sr => h('td', {}, String(r[col(sr.col)]))))))));

  host.replaceChildren(
    h('figcaption', { class: 'chart-title' }, pick(spec.title, lang)),
    legend, svg, out, table,
    h('p', { class: 'chart-source' }, `${t('source', null, lang)}: ${data.source}`));
  show(Math.floor(n / 2));
}
