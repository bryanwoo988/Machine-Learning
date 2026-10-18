/* Widget registry. Widgets load on demand; every file is precached, so this
   works offline too. Contract of each module:
     export function mount(el, { lang, opts, data }) → { destroy() } */

export async function mountWidget(el, id, ctx) {
  try {
    const mod = await import(`./${String(id).toLowerCase()}.js`);
    el.replaceChildren();
    mod.mount(el, ctx);
  } catch (e) {
    console.error(`[widget ${id}]`, e);
  }
}
