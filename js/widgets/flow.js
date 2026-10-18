/* A small clickable process diagram shared by several figures: boxes at
   fixed positions (0–1 coordinates) joined by labelled arrows; tapping an
   arrow or box shows its note underneath. Data in, nothing else. */

import { s, h, clamp, frame } from './kit.js';
import { pick } from '../i18n.js';

export function flowDiagram(el, { lang, title, nodes, edges, hint, source, schematic = true, aspect = 0.72 }) {
  const p = v => pick(v, lang);
  const W = Math.round(clamp((el.clientWidth || 640) - 30, 300, 680)), H = Math.round(W * aspect);
  const BW = Math.min(118, W * 0.26), BH = 34;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg flow-svg', role: 'img', 'aria-label': p(title) });
  const defs = s('defs', {}, s('marker', { id: 'flow-head', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 Z', class: 'flow-head' })));
  svg.append(defs);
  const pos = Object.fromEntries(nodes.map(n => [n.id, [n.x * (W - BW) + BW / 2, n.y * (H - BH) + BH / 2]]));
  const note = h('p', { class: 'w-explain', 'aria-live': 'polite' }, p(hint));
  const all = [];
  const select = (g, text) => { for (const n of all) n.classList.toggle('is-on', n === g); note.textContent = text; };
  const clip = ([x1, y1], [x2, y2]) => {
    // Shorten a segment so it starts and ends at the box edges.
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.min(Math.abs((BW / 2 + 4) / (dx || 1e-6)), Math.abs((BH / 2 + 4) / (dy || 1e-6)));
    return [x1 + dx * t, y1 + dy * t, x2 - dx * t, y2 - dy * t];
  };
  for (const e of edges) {
    const [x1, y1, x2, y2] = clip(pos[e.from], pos[e.to]);
    const bend = e.bend ?? 0;
    const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
    const g = s('g', { class: `flow-edge${e.cls ? ` ${e.cls}` : ''}`, tabindex: '0', role: 'button' },
      s('path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, 'marker-end': 'url(#flow-head)' }),
      s('path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, class: 'flow-hit' }),
      s('text', { x: (x1 + 2 * mx + x2) / 4, y: (y1 + 2 * my + y2) / 4 - 4, 'text-anchor': 'middle' }, p(e.label)));
    const go = () => select(g, `${p(e.label)}: ${p(e.note)}`);
    g.addEventListener('click', go);
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    svg.append(g); all.push(g);
  }
  for (const n of nodes) {
    const [cx, cy] = pos[n.id];
    const g = s('g', { class: `flow-node${n.cls ? ` ${n.cls}` : ''}`, tabindex: '0', role: 'button' },
      s('rect', { x: cx - BW / 2, y: cy - BH / 2, width: BW, height: BH, rx: 10 }),
      s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle' }, p(n.label)));
    if (n.note) {
      const go = () => select(g, `${p(n.label)}: ${p(n.note)}`);
      g.addEventListener('click', go);
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    }
    svg.append(g); all.push(g);
  }
  el.append(frame({ title: p(title), lang, schematic, source, children: [svg, note] }));
  return { destroy() { el.replaceChildren(); } };
}
