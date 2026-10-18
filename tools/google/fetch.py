"""Download every page of Google's four foundational ML courses, in English
and in Google's own Simplified Chinese (?hl=zh-cn), into tools/.cache/.

    python3 tools/google/fetch.py            # only what is missing
    python3 tools/google/fetch.py --refresh  # everything again

Writes tools/.cache/nav.json: the courses, their modules and pages in
Google's order, taken from each course's left-hand navigation."""

import json, re, sys, time, urllib.request
from pathlib import Path
import bs4

BASE = 'https://developers.google.com'
COURSES = ['intro-to-ml', 'crash-course', 'problem-framing', 'managing-ml-projects']
CACHE = Path(__file__).resolve().parents[1] / '.cache'
REFRESH = '--refresh' in sys.argv


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (offline study app builder)'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8')
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def cached(path, lang):
    name = path.strip('/').replace('/', '__') + f'.{lang}.html'
    f = CACHE / 'pages' / name
    if REFRESH or not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        url = BASE + path + ('?hl=zh-cn' if lang == 'zh' else '?hl=en')
        f.write_text(get(url), encoding='utf-8')
        time.sleep(0.3)
    return f.read_text(encoding='utf-8')


def nav_tree(html, course):
    """Modules (expandable groups) with their pages. Pages outside a group
    form a module of their own. Quick links and '#whats_next' are skipped."""
    s = bs4.BeautifulSoup(html, 'lxml')
    ul = s.select_one('ul.devsite-nav-list[menu="_book"]')
    prefix = f'/machine-learning/{course}'
    mods, part = [], None

    def page(a):
        href = a.get('href', '').replace(BASE, '')
        if '#' in href or not href.startswith(prefix):
            return None
        title = re.sub(r'\s*\(\d+\s*mins?\)\s*$', '', a.get_text(' ', strip=True))
        mins = re.search(r'\((\d+)\s*mins?\)', a.get_text(' ', strip=True))
        return {'path': href, 'title': title, 'min': int(mins.group(1)) if mins else None}

    loose = None   # leaf pages directly under a heading: one module per heading
    for li in ul.find_all('li', recursive=False):
        cls = ' '.join(li.get('class', []))
        sub = li.find('ul')
        if 'devsite-nav-heading' in cls:
            part = li.get_text(' ', strip=True)
            loose = None
            continue
        if part == 'Quick links':
            continue
        if sub:
            title = (li.find(class_='devsite-nav-title') or li).get_text(' ', strip=True)
            title = re.sub(r'\s*\(\d+\s*mins?\)\s*$', '', title)
            pages = [p for p in (page(a) for a in sub.find_all('a')) if p]
            if pages:
                mods.append({'part': part, 'title': title, 'pages': pages})
            loose = None
        else:
            a = li.find('a')
            p = a and page(a)
            if not p:
                continue
            if loose is None:
                loose = {'part': part, 'title': part or p['title'], 'pages': []}
                mods.append(loose)
            loose['pages'].append(p)
    return mods


def main():
    out = []
    for course in COURSES:
        # The crash course's landing page has no book navigation; its first lesson does.
        root = f'/machine-learning/{course}' + ('/linear-regression' if course == 'crash-course' else '')
        mods = nav_tree(cached(root, 'en'), course)
        seen = set()
        for m in mods:
            for p in m['pages']:
                if p['path'] in seen:
                    continue
                seen.add(p['path'])
                for lang in ('en', 'zh'):
                    cached(p['path'], lang)
            print(f'{course}: {m["title"]} ({len(m["pages"])} pages)')
        out.append({'course': course, 'modules': mods})
    (CACHE / 'nav.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
