/* Softmax versus independent sigmoids. Each class has a raw score (logit);
   drag the sliders. Softmax turns them into probabilities that add up to 1
   (one-vs.-one); applying a sigmoid to each separately (one-vs.-all) does not.
   The classes are the lesson's fruit. */

import { h, frame, slider, seg, fmt, T } from './kit.js';
import { softmax, sigmoid } from './mlmath.js';
import { pick } from '../i18n.js';

const L = {
  title: T('Softmax: probabilities that add up to 1', 'Softmax：加起来等于 1 的概率'),
  mode: T('Output layer', '输出层'), soft: T('Softmax (one-vs.-one)', 'Softmax（一对一）'), sig: T('Sigmoid each (one-vs.-all)', '各自用 S 型函数（一对多）'),
  logit: T('score', '得分'), sum: T('Sum of probabilities', '概率总和'),
  classes: [T('Apple', '苹果'), T('Orange', '橙子'), T('Pear', '梨'), T('Grape', '葡萄')],
  hint: T('Raise one score and, with softmax, every other probability must fall; with separate sigmoids they move independently.', '提高一个得分时，用 softmax 其他概率都会下降；用各自的 S 型函数，它们各自独立变化。'),
};

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  let mode = 'soft';
  const z = [0.4, -0.8, 2.0, 0.1];
  const rows = h('div', { class: 'sm-rows' });
  const sum = h('p', { class: 'sm-sum' });
  function draw() {
    const pr = mode === 'soft' ? softmax(z) : z.map(sigmoid);
    rows.replaceChildren(...pr.map((v, i) => h('div', { class: 'sm-row' },
      h('span', { class: 'sm-name' }, p(L.classes[i])),
      h('span', { class: 'sm-track' }, h('span', { class: 'sm-fill', style: `width:${(v * 100).toFixed(1)}%` })),
      h('span', { class: 'sm-val' }, fmt(v, 2)))));
    sum.textContent = `${p(L.sum)}: ${fmt(pr.reduce((a, b) => a + b, 0), 2)}`;
  }
  const sliders = z.map((v, i) => slider({ label: `${p(L.classes[i])} ${p(L.logit)}`, min: -4, max: 4, step: 0.1, value: v, onInput: nv => { z[i] = nv; draw(); } }));
  el.append(frame({ title: p(L.title), lang, children: [
    seg([['soft', p(L.soft)], ['sig', p(L.sig)]], mode, m => { mode = m; draw(); }, p(L.mode)),
    rows, sum, h('div', { class: 'w-controls' }, sliders), h('p', { class: 'w-explain' }, p(L.hint))] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
