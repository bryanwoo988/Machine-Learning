/* Activation functions: ReLU, sigmoid and tanh next to the identity (no
   activation). Drag along x to read the output. Then see why they matter:
   stacking linear layers without one is still a straight line. */

import { s, h, track, readout, frame, size, axes, seg, fmt, scale, clamp, T } from './kit.js';
import { ACTIVATIONS } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Activation functions', '激活函数'),
  fn: T('Function', '函数'), linear: T('None (linear)', '无（线性）'),
  out: T('Output', '输出'),
  notes: {
    linear: T('Without an activation function, a node only passes on a weighted sum: any number of such layers still adds up to one linear model.', '没有激活函数时，节点只是把加权和传下去：无论叠多少层，结果仍等于一个线性模型。'),
    relu: T('ReLU: 0 for negative inputs, the input itself for positive ones. Cheap to compute and the most common choice for hidden layers.', 'ReLU：输入为负时输出 0，为正时输出输入本身。计算简单，是隐藏层最常用的选择。'),
    sigmoid: T('Sigmoid: squeezes any input into (0, 1). Its slope is tiny far from 0, which can make gradients vanish in deep networks.', 'S 型函数：把任何输入压进 (0, 1)。离 0 越远斜率越小，在深层网络中可能导致梯度消失。'),
    tanh: T('Tanh: like the sigmoid but between −1 and 1, centred on 0.', 'tanh：和 S 型函数相似，但介于 −1 和 1 之间，以 0 为中心。'),
  },
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  const { W, H } = size(el, { ratio: 0.62 });
  const M = { t: 20, r: 14, b: 28, l: 34 };
  const x = scale(-4, 4, M.l, W - M.r), y = scale(-2, 4, H - M.b, M.t);
  let fn = 'relu', v = 1.5;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w-svg', role: 'img', 'aria-label': p(L.title) });
  axes(svg, { x, y, xTicks: [-4, -2, 0, 2, 4], yTicks: [-2, 0, 2, 4], M, W, H, xLabel: 'x', yLabel: 'f(x)' });
  const ghost = s('g', {}), curve = s('polyline', { class: 'act-curve' }), knob = s('circle', { r: 8, class: 'w-handle', tabindex: '0' });
  svg.append(ghost, curve, knob);
  const out = readout([['x', 'x'], ['y', p(L.out)]]);
  const note = h('p', { class: 'w-explain' });
  const line = f => { const a = []; for (let u = -4; u <= 4.0001; u += 0.05) a.push(`${x(u).toFixed(1)},${y(clamp(f(u), -2.2, 4.2)).toFixed(1)}`); return a.join(' '); };
  function draw() {
    ghost.replaceChildren(...Object.keys(ACTIVATIONS).filter(k => k !== fn).map(k => s('polyline', { points: line(ACTIVATIONS[k]), class: 'act-ghost' })));
    curve.setAttribute('points', line(ACTIVATIONS[fn]));
    const o = ACTIVATIONS[fn](v);
    knob.setAttribute('cx', x(v)); knob.setAttribute('cy', y(o));
    out.set('x', fmt(v, 2)); out.set('y', fmt(o, 3));
    note.textContent = p(L.notes[fn]);
  }
  track(svg, pt => { v = clamp(Math.round(x.invert(pt.x) * 20) / 20, -4, 4); draw(); });
  knob.addEventListener('keydown', e => { const d = { ArrowRight: 0.25, ArrowLeft: -0.25 }[e.key]; if (d) { e.preventDefault(); v = clamp(v + d, -4, 4); draw(); } });
  const pickF = seg([['linear', p(L.linear)], ['relu', 'ReLU'], ['sigmoid', 'Sigmoid'], ['tanh', 'tanh']], fn, k => { fn = k; draw(); }, p(L.fn));
  el.append(frame({ title: p(L.title), lang, children: [pickF, svg, out, note] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
