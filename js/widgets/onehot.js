/* One-hot encoding of the lesson's car_color feature: tap a colour to see
   its index number, its one-hot vector and the sparse representation that
   stores only where the 1 is. */

import { h, frame, T } from './kit.js';
import { pick } from '../i18n.js';

const L = {
  title: T('One-hot encoding: one feature per category', '独热编码：每个类别一个特征'),
  tap: T('Tap a colour', '点一个颜色'),
  index: T('Index number', '索引号'), vector: T('One-hot vector', '独热向量'), sparse: T('Sparse representation', '稀疏表示'),
  why: T('Only one element is 1.0, all the rest are 0.0. A sparse representation stores just the position of the 1, saving memory when there are many categories.', '只有一个元素是 1.0，其余都是 0.0。稀疏表示只记下 1 的位置，类别很多时可以省下内存。'),
};
const COLORS = [
  [T('Red', '红色'), '#e5484d'], [T('Orange', '橙色'), '#f08c2e'], [T('Blue', '蓝色'), '#2f63d6'], [T('Yellow', '黄色'), '#f2c400'],
  [T('Green', '绿色'), '#1f9d6e'], [T('Black', '黑色'), '#222'], [T('Purple', '紫色'), '#7b5bd6'], [T('Brown', '棕色'), '#8a5a3c'],
];

export function mount(el, { lang }) {
  const p = v => pick(v, lang);
  let sel = 2;
  const chips = h('div', { class: 'oh-chips', role: 'group', 'aria-label': p(L.tap) });
  const vec = h('div', { class: 'oh-vec' });
  const info = h('dl', { class: 'w-readout' });
  function draw() {
    chips.replaceChildren(...COLORS.map(([name, c], i) => {
      const b = h('button', { type: 'button', class: 'oh-chip', 'aria-pressed': String(i === sel), style: `--c:${c}` }, p(name));
      b.addEventListener('click', () => { sel = i; draw(); });
      return b;
    }));
    vec.replaceChildren(...COLORS.map(([name, c], i) => h('span', { class: `oh-cell${i === sel ? ' is-on' : ''}`, style: `--c:${c}`, title: p(name) }, i === sel ? '1' : '0')));
    info.replaceChildren(
      h('div', {}, h('dt', {}, p(L.index)), h('dd', {}, `${p(COLORS[sel][0])} → ${sel}`)),
      h('div', {}, h('dt', {}, p(L.vector)), h('dd', {}, `[${COLORS.map((_, i) => (i === sel ? '1' : '0')).join(', ')}]`)),
      h('div', {}, h('dt', {}, p(L.sparse)), h('dd', {}, String(sel))));
  }
  el.append(frame({ title: p(L.title), lang, children: [h('p', { class: 'w-sub' }, p(L.tap)), chips, vec, info, h('p', { class: 'w-explain' }, p(L.why))] }));
  draw();
  return { destroy() { el.replaceChildren(); } };
}
