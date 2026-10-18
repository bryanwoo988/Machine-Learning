/* Shared pieces for the interactive figures.

   The pure helpers (scale, clamp, valueAt, niceTicks, fmt) are unit-tested;
   the DOM helpers build SVG and wire pointer + keyboard input the same way
   in every widget, so each widget file only describes its own figure. */

import { t } from '../i18n.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function scale(d0, d1, r0, r1) {
  const f = v => r0 + (v - d0) * (r1 - r0) / (d1 - d0);
  f.invert = p => d0 + (p - r0) * (d1 - d0) / (r1 - r0);
  return f;
}

// Pointer position → value on a slider-like axis, snapped and clamped, so a
// finger that leaves the plot still gives a sensible end value.
export function valueAt(px, left, width, min, max, step) {
  const raw = min + (px - left) / width * (max - min);
  const snapped = Math.round(raw / step) * step;
  return clamp(Number(snapped.toFixed(6)), min, max);
}

export function niceTicks(min, max, count = 5) {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export const fmt = (v, digits = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits));

/* ---------- DOM ---------- */

const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const k of kids.flat(Infinity)) if (k != null) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}

export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null) n.append(k instanceof Node ? k : String(k));
  return n;
}

// Track a finger or mouse over an element. onMove gets the pointer position
// in the element's own SVG coordinates. Pointer capture keeps the drag alive
// when the finger leaves the plot.
export function track(svg, onMove) {
  const toLocal = e => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  let down = false;
  svg.addEventListener('pointerdown', e => { down = true; svg.setPointerCapture(e.pointerId); onMove(toLocal(e), e); });
  svg.addEventListener('pointermove', e => { if (down || e.pointerType === 'mouse') onMove(toLocal(e), e); });
  const up = e => { down = false; try { svg.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}

// A labelled native range input: keyboard, screen reader and fine control
// for free, alongside dragging on the figure itself.
export function slider({ label, min, max, step, value, unit = '', onInput }) {
  const out = h('output', {}, `${value}${unit}`);
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = `${input.value}${unit}`; onInput(Number(input.value)); });
  const wrap = h('label', { class: 'w-slider' }, h('span', { class: 'w-slider-label' }, label), input, out);
  wrap.set = v => { input.value = v; out.textContent = `${v}${unit}`; };
  return wrap;
}

export function readout(rows) {
  const dl = h('dl', { class: 'w-readout' });
  const cells = {};
  for (const [key, label] of rows) {
    const dd = h('dd', { 'data-k': key }, '—');
    cells[key] = dd;
    dl.append(h('div', {}, h('dt', {}, label), dd));
  }
  dl.set = (key, text) => { cells[key].textContent = text; };
  return dl;
}

export function frame({ title, lang, schematic = false, source, children }) {
  return h('figure', { class: 'w-frame' },
    h('figcaption', { class: 'w-title' }, title, schematic ? h('span', { class: 'w-badge' }, t('schematic', null, lang)) : null),
    ...children,
    source ? h('p', { class: 'w-source' }, `${t('source', null, lang)}: ${source}`) : null);
}

/* ---------- Plots ---------- */

// Width that fits the figure's host, and a plot area with margins.
export function size(el, { ratio = 0.68, min = 280, max = 640, minH = 200, maxH = 420 } = {}) {
  const W = Math.round(clamp((el.clientWidth || 600) - 30, min, max));
  return { W, H: Math.round(clamp(W * ratio, minH, maxH)) };
}

// Gridlines, tick labels and axis titles for x/y scales over a plot area.
export function axes(svg, { x, y, xTicks, yTicks, M, W, H, xLabel, yLabel, xFmt = v => v, yFmt = v => v }) {
  const g = s('g', { class: 'chart-axes' });
  for (const v of yTicks) {
    g.append(s('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'grid' }));
    g.append(s('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, yFmt(v)));
  }
  for (const v of xTicks) {
    g.append(s('line', { x1: x(v), x2: x(v), y1: M.t, y2: H - M.b, class: 'grid' }));
    g.append(s('text', { x: x(v), y: H - M.b + 15, 'text-anchor': x(v) > W - M.r - 14 ? 'end' : x(v) < M.l + 8 ? 'start' : 'middle' }, xFmt(v)));
  }
  if (xLabel) g.append(s('text', { x: W - M.r, y: H - 4, 'text-anchor': 'end', class: 'unit' }, xLabel));
  if (yLabel) g.append(s('text', { x: 4, y: M.t - 10, class: 'unit' }, yLabel));
  svg.append(g);
  return g;
}

// A row of toggle buttons, one pressed.
export function seg(options, current, onPick, label) {
  const g = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const [value, text] of options) {
    const b = h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(value === current) }, text);
    b.addEventListener('click', () => { for (const n of g.children) n.setAttribute('aria-pressed', String(n === b)); onPick(value); });
    g.append(b);
  }
  return g;
}

export function button(text, onClick, cls = 'button button-quiet') {
  const b = h('button', { type: 'button', class: cls }, text);
  b.addEventListener('click', onClick);
  return b;
}

// Bilingual label helper used by every figure: T('English', '中文').
export const T = (en, zh) => ({ en, zh });
