# 机器学习 · Machine Learning

An offline, bilingual (English / 中文) study app for Google's four foundational
machine-learning courses — Intro to Machine Learning, Machine Learning Crash
Course, Problem Framing and Managing ML Projects — with interactive figures,
key takeaways, module recaps, quizzes, highlights and notes. A static PWA: no
build step at run time, no CDN.

Live: <https://bryanwoo988.github.io/Machine-Learning/>

## Content and licence

The lesson text, figures and quiz questions come from
[Google for Developers – Machine Learning](https://developers.google.com/machine-learning/foundational-courses),
in English and in Google's own Simplified Chinese translation (`?hl=zh-cn`).
Google publishes that content under the
[Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/),
and code samples under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
Every lesson links back to its original page. Changes made here: the pages are
rearranged for offline reading, maths is pre-rendered, Google's English-only
"Page Summary" (key takeaways) is translated into Chinese for this app, and
the interactive figures are drawn afresh.

Google's end-of-module quizzes are graded on Google's site, so the app links
to them; the in-lesson "Check your understanding" questions work offline.

## House conventions

First-run language picker (default English); English ⇄ 中文 that keeps your
place; light / dark / auto theme; six text sizes; offline after the first
visit; update prompt and "what's new" sheet; QR code, share and copy-link in
Settings; notes backup (export / import). See
[APP-STANDARDS.md](https://github.com/bryanwoo988/woobrothers.my/blob/main/APP-STANDARDS.md).

## Rebuilding the content

```bash
python3 tools/google/fetch.py      # download the pages (tools/.cache, not committed)
npm install                        # KaTeX, used only at build time
python3 tools/google/convert.py    # data/*.json and img/
node tools/build-sw.mjs            # refresh the offline precache list
```

Translations of the key takeaways live in `tools/google/takeaways-zh.json`,
interactive figures are placed by `tools/google/widgets.json`.

## Run it locally

```bash
python3 tools/serve.py             # http://127.0.0.1:4210/
```

The service worker is skipped on localhost unless you add `?sw=1`.

## Tests and checks

```bash
node --test 'tests/*.test.js'      # logic: maths behind the figures, prefs, search, quizzes, SW, content lint
node tools/lint-content.mjs        # both languages present, takeaways translated, figures/links/terms exist
node tests/e2e.mjs                 # real browser at 375 px: a user's path + every screen in both languages
```

`tests/e2e.mjs` needs Playwright and the dev server (`python3 tools/serve.py`).
