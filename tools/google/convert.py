"""Turn the downloaded Google pages (tools/.cache, see fetch.py) into the
app's data files.

    python3 tools/google/convert.py

Writes
  data/index.json      courses (stages) and modules (chapters)
  data/cNN.json        one module: its pages as sections, each a list of blocks
  data/terms.json      Google's ML glossary, English and Chinese
  img/…                every figure, downloaded once

Each block carries the English and the Chinese of the same element. The two
languages are parsed separately and lined up by block type; Google's
Chinese pages are translations of the same HTML, so nearly everything pairs
up. A block found in only one language keeps that language for both.

Inline text is kept as a small, whitelisted subset of HTML (b, i, code,
sub, sup, br, links, glossary terms) with maths pre-rendered by KaTeX, so the
app needs no maths library at run time."""

import difflib, hashlib, html, io, json, re, subprocess, sys, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch import nav_tree  # noqa: E402
import bs4
from bs4 import NavigableString, Tag

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'tools' / '.cache'
DATA = ROOT / 'data'
IMG = ROOT / 'img'
BASE = 'https://developers.google.com'
EXTRA = Path(__file__).resolve().parent

COURSES = {
    'intro-to-ml': {'en': 'Intro to Machine Learning', 'zh': '机器学习简介'},
    'crash-course': {'en': 'Machine Learning Crash Course', 'zh': '机器学习速成课程'},
    'problem-framing': {'en': 'Problem Framing', 'zh': '问题构建'},
    'managing-ml-projects': {'en': 'Managing ML Projects', 'zh': '管理机器学习项目'},
}

# Google's own one-line course descriptions (Foundational courses page),
# with the Chinese from the same page in ?hl=zh-cn.
BLURBS = json.loads((EXTRA / 'blurbs.json').read_text(encoding='utf-8'))
# English-only parts of Google's pages (the "Page Summary" key takeaways),
# translated for this app. Keyed by page path.
TAKEAWAYS_ZH = json.loads((EXTRA / 'takeaways-zh.json').read_text(encoding='utf-8'))
# Where the app's own interactive figures go: page path -> [{id, after|at, opts}].
WIDGETS = json.loads((EXTRA / 'widgets.json').read_text(encoding='utf-8'))
# Module titles that Google's Chinese navigation leaves in English.
TITLES_ZH = json.loads((EXTRA / 'titles-zh.json').read_text(encoding='utf-8'))

SINGLE = {'intro-to-ml', 'problem-framing'}

SKIP_TAGS = {'devsite-engedu-telemetry', 'devsite-feedback', 'hr', 'script', 'style',
             'devsite-mathjax', 'link', 'meta', 'noscript'}
NOTE_KINDS = {'note': 'note', 'caution': 'caution', 'warning': 'warning', 'special': 'special',
              'key-point': 'key', 'objective': 'objective', 'success': 'note', 'dogfood': 'note'}

PAGES = {}          # path -> (chapter id, section id), filled before parsing, for links
ALIASES = {}        # old glossary anchor name -> term id ("logistic_regression" -> "logistic-regression")
MATH = {}           # tex source -> placeholder number
images = {}         # remote src -> local path


def soup(path, lang):
    name = path.strip('/').replace('/', '__') + f'.{lang}.html'
    return bs4.BeautifulSoup((CACHE / 'pages' / name).read_text(encoding='utf-8'), 'lxml')


def cls(el):
    return set(el.get('class', [])) if isinstance(el, Tag) else set()


# ---------------------------------------------------------------- inline

def math_token(tex, display=False):
    tex = tex.strip()
    key = ('D' if display else 'I') + tex
    if key not in MATH:
        MATH[key] = len(MATH)
    return f'⟦m{MATH[key]}⟧'


def text_with_math(s):
    """Escape text and swap $…$ / $$…$$ / \\(…\\) for maths placeholders."""
    out, i = [], 0
    pat = re.compile(r'\$\$(.+?)\$\$|\\\[(.+?)\\\]|\\\((.+?)\\\)|\$(?!\s*\d+(?:[.,]\d+)?\s*(?:[A-Za-z%]|$))([^$]+?)\$', re.S)
    for m in pat.finditer(s):
        out.append(html.escape(s[i:m.start()], quote=False))
        if m.group(1) or m.group(2):
            out.append(math_token(m.group(1) or m.group(2), True))
        else:
            out.append(math_token(m.group(3) or m.group(4)))
        i = m.end()
    out.append(html.escape(s[i:], quote=False))
    return ''.join(out)


def link(a, lang):
    href = a.get('href', '')
    m = re.match(r'^(?:https://developers\.google\.com)?/machine-learning/glossary(?:/[a-z-]+)?(?:\?[^#]*)?#([\w-]+)', href)
    if m:
        return 'term', ALIASES.get(m.group(1), m.group(1))
    if href.startswith('#'):
        return 'anchor', None
    full = href if href.startswith('http') else (BASE + href if href.startswith('/') else None)
    if not full:
        return None, None
    path = re.sub(r'[?#].*$', '', full.replace(BASE, ''))
    if path.rstrip('/') in PAGES:
        ch, sec = PAGES[path.rstrip('/')]
        return 'page', f'#/ch/{ch}/{sec}'
    return 'ext', full


def inline(el, lang):
    """Whitelisted inline HTML for an element's contents, maths as placeholders."""
    parts = []
    for n in el.children:
        if isinstance(n, NavigableString):
            if type(n).__name__ in ('Comment', 'Doctype'):
                continue
            parts.append(text_with_math(str(n)))
            continue
        if not isinstance(n, Tag) or n.name in SKIP_TAGS:
            continue
        name = n.name
        inner = inline(n, lang)
        if name in ('b', 'strong'):
            parts.append(f'<b>{inner}</b>' if inner.strip() else inner)
        elif name in ('em', 'i', 'cite', 'dfn', 'var'):
            parts.append(f'<i>{inner}</i>' if inner.strip() else inner)
        elif name in ('code', 'tt', 'kbd', 'samp'):
            parts.append(f'<code>{html.escape(n.get_text(), quote=False)}</code>')
        elif name in ('sub', 'sup'):
            parts.append(f'<{name}>{inner}</{name}>')
        elif name == 'br':
            parts.append('<br>')
        elif name == 'a':
            kind, target = link(n, lang)
            if kind == 'term':
                parts.append(f'<button type="button" class="term" data-term="{target}">{inner}</button>')
            elif kind == 'page':
                parts.append(f'<a href="{target}">{inner}</a>')
            elif kind == 'ext':
                parts.append(f'<a href="{html.escape(target)}" target="_blank" rel="noopener">{inner}</a>')
            else:
                parts.append(inner)
        elif name in ('ul', 'ol'):
            items = ''.join(f'<li>{inline(li, lang)}</li>' for li in n.find_all('li', recursive=False))
            parts.append(f'<{name}>{items}</{name}>')
        elif name == 'p':
            parts.append(inner + '<br>')
        elif name == 'img':
            continue
        elif name == 'span' and cls(n) & {'compare-better', 'compare-worse'}:
            mark = '✔︎ ' if 'compare-better' in cls(n) else '✘ '
            parts.append(mark + inner)
        else:
            parts.append(inner)
    s = ''.join(parts)
    s = re.sub(r'(<br>\s*)+$', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def plain(el):
    return re.sub(r'\s+', ' ', el.get_text(' ')).strip()


# ---------------------------------------------------------------- media

def fetch_image(src, course):
    if src.startswith('//'):
        src = 'https:' + src
    full = src if src.startswith('http') else BASE + src
    full = re.sub(r'\?.*$', '', full)
    if full in images:
        return images[full]
    tail = full.split('/machine-learning/')[-1] if '/machine-learning/' in full else hashlib.md5(full.encode()).hexdigest()[:10] + '-' + full.rsplit('/', 1)[-1]
    tail = re.sub(r'^static/', '', tail)
    local = IMG / tail
    webp = local.with_suffix('.webp')
    if webp.exists():
        local = webp
    elif not local.exists():
        local.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(full, headers={'User-Agent': 'Mozilla/5.0'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                break
            except Exception as e:
                if attempt == 3:
                    print('  ! image failed', full, e, file=sys.stderr)
                    images[full] = None
                    return None
                time.sleep(2 ** attempt)
        out, ext = shrink(raw, local.suffix.lower())
        if ext != local.suffix.lower():
            local = local.with_suffix(ext)
        local.write_bytes(out)
    rel = local.relative_to(ROOT).as_posix()
    images[full] = rel
    return rel


def shrink(raw, ext):
    """Large still images are scaled to at most 1200 px wide and, when that
    saves at least a third, stored as WebP (every current phone browser reads
    it). Animations and SVG are left alone. Returns (bytes, extension)."""
    if ext not in ('.png', '.jpg', '.jpeg') or len(raw) < 100_000:
        return raw, ext
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw))
        if im.width > 1200:
            im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=86, method=6)
        if buf.tell() < 0.67 * len(raw):
            return buf.getvalue(), '.webp'
        return raw, ext
    except Exception:
        return raw, ext


# ---------------------------------------------------------------- blocks

def blocks(container, lang, course):
    out = []
    for n in container.children:
        if isinstance(n, NavigableString):
            t = str(n).strip()
            if t:
                out.append({'type': 'p', 'html': text_with_math(t)})
            continue
        if isinstance(n, Tag):
            out.extend(block(n, lang, course))
    return [b for b in out if b]


def block(n, lang, course):
    name, c = n.name, cls(n)
    if name in SKIP_TAGS or name == 'devsite-key-takeaways-panel':
        return []
    if name == 'aside' and 'key-term' in c:
        return []
    if name == 'aside' and 'badge' in c:
        # "Take this quiz … and earn a badge": Google grades these quizzes on
        # its own server, so the app can only link to them.
        a = n.select_one('.open_quiz a')
        if a and a.get('href'):
            href = a['href'] if a['href'].startswith('http') else BASE + a['href']
            return [{'type': 'gquiz', 'href': href}]
        return []
    if name in ('h1', 'h2', 'h3', 'h4', 'h5'):
        t = inline(n, lang)
        if not t or 'showalways' in c and n.parent and n.parent.name == 'devsite-expandable':
            return []
        return [{'type': 'h', 'level': 2 if name in ('h1', 'h2') else 3, 'html': t}]
    if name == 'p':
        t = inline(n, lang)
        if 'x-smartling-placeholder' in t or t in ('&lt;/ph&gt;',):
            t = ''
        imgs = n.find_all('img')
        res = [{'type': 'p', 'html': t}] if t else []
        for im in imgs:
            res += figure(im, None, lang, course)
        for fr in n.find_all('iframe'):
            res += block(fr, lang, course)
        return res
    if name in ('ul', 'ol'):
        items = [inline(li, lang) for li in n.find_all('li', recursive=False)]
        items = [i for i in items if i]
        res = [{'type': 'list', 'ordered': name == 'ol', 'items': items}] if items else []
        for im in n.find_all('img'):
            res += figure(im, None, lang, course)
        return res
    if name == 'table':
        return table(n, lang, course)
    if name == 'figure':
        im = n.find('img')
        cap = n.find('figcaption')
        if not im:
            return blocks(n, lang, course)
        return figure(im, cap, lang, course)
    if name == 'img':
        return figure(n, None, lang, course)
    if name == 'picture':
        im = n.find('img')
        return figure(im, None, lang, course) if im else []
    if name == 'aside' or (name == 'p' and 'note' in c):
        kind = next((NOTE_KINDS[k] for k in c if k in NOTE_KINDS), 'note')
        if 'time' in c:
            return []
        t = inline(n, lang)
        if 'Moma' in t:   # a Google-internal badge
            return []
        return [{'type': 'note', 'kind': kind, 'html': t}] if t else []
    if name == 'blockquote':
        t = inline(n, lang)
        return [{'type': 'note', 'kind': 'quote', 'html': t}] if t else []
    if name == 'devsite-multiple-choice':
        return [quiz(n, lang)]
    if name == 'devsite-expandable' or (name == 'section' and 'expandable' in c):
        head = n.find(class_='showalways')
        title = inline(head, lang) if head else ''
        if head:
            head.extract()
        body = n.find(class_='expand-background') or n
        return [{'type': 'more', 'title': title, 'blocks': blocks(body, lang, course)}]
    if name == 'devsite-video':
        return [{'type': 'video', 'id': n.get('video-id')}]
    if name in ('iframe', 'devsite-iframe'):
        fr = n if name == 'iframe' else n.find('iframe')
        if not fr or not fr.get('src'):
            return []
        src = fr['src']
        if src.startswith('/'):
            src = BASE + src
        return [{'type': 'frame', 'src': src}]
    if name in ('pre', 'devsite-code'):
        pre = n if name == 'pre' else n.find('pre')
        return [{'type': 'code', 'text': (pre or n).get_text().strip('\n')}]
    if name == 'a' and ('button' in c or 'gc-analytics-event' in c):
        kind, target = link(n, lang)
        if kind in ('ext', 'page') and 'support.google.com' not in (target or ''):
            return [{'type': 'link', 'href': target, 'html': inline(n, lang)}]
        return []
    if name in ('b', 'strong', 'em', 'span', 'code', 'i'):
        t = inline(n, lang) if name == 'span' else inline(bs4.BeautifulSoup(f'<p>{n}</p>', 'lxml').p, lang)
        return [{'type': 'p', 'html': t}] if t else []
    if name == 'devsite-tracking-question':
        return [tracking_question(n, lang)]
    # Wrappers: div, section, span, devsite-carousel, layout rows …
    return blocks(n, lang, course)


def figure(im, cap, lang, course):
    src = im.get('src') or im.get('data-src')
    if not src or src.endswith('.svg') and 'icons' in src:
        return []
    local = fetch_image(src, course)
    if not local:
        return []
    alt = im.get('alt', '').strip()
    return [{'type': 'figure', 'src': local, 'alt': alt, 'caption': inline(cap, lang) if cap else ''}]


def table(n, lang, course):
    rows = n.find_all('tr')
    # Layout tables (side-by-side columns) become ordinary blocks.
    if 'columns' in cls(n) or (rows and all(len(r.find_all(['td', 'th'], recursive=False)) <= 1 for r in rows) and n.find('img')):
        out = []
        for cell in n.find_all(['td', 'th']):
            out += blocks(cell, lang, course)
        return out
    head = []
    body = []
    for r in rows:
        cells = r.find_all(['td', 'th'], recursive=False)
        if not cells:
            continue
        vals = [inline(x, lang) for x in cells]
        imgs = [im for x in cells for im in x.find_all('img')]
        if imgs and not any(v for v in vals):
            continue
        if not head and not body and all(x.name == 'th' for x in cells):
            head = vals
        else:
            body.append(vals)
    extra = []
    for im in n.find_all('img'):
        extra += figure(im, None, lang, course)
    cap = n.find('caption')
    if not body and not head:
        return extra
    return [{'type': 'table', 'headers': head, 'rows': body, 'caption': inline(cap, lang) if cap else ''}] + extra


def quiz(n, lang):
    divs = n.find_all('div', recursive=False)
    q = inline(divs[0], lang) if divs else ''
    q = re.sub(r'^\d+\.\s*', '', q)
    opts = []
    for d in divs[1:]:
        parts = d.find_all('div', recursive=False)
        text = inline(parts[0], lang) if parts else inline(d, lang)
        # Some questions answer with pictures (ROC curves): keep them.
        for im in (parts[0] if parts else d).find_all('img'):
            local = fetch_image(im.get('src', ''), None) if im.get('src') else None
            if local:
                text += f'<img class="quiz-img" src="{local}" alt="{html.escape(re.sub(r"\s+", " ", im.get("alt", "")).strip())}" loading="lazy">'
        why = inline(parts[1], lang) if len(parts) > 1 else ''
        opts.append({'html': text, 'why': why, 'correct': d.has_attr('correct')})
    return {'type': 'quiz', 'q': q, 'options': opts}


def tracking_question(n, lang):
    text = n.find(class_='devsite-tracking-question-text')
    choices = n.find_all(class_='devsite-tracking-question-choice-button')
    answers = n.find_all(class_='devsite-tracking-question-answer')
    opts = [{'html': inline(c, lang), 'why': inline(answers[i], lang) if i < len(answers) else '', 'correct': None} for i, c in enumerate(choices)]
    return {'type': 'quiz', 'q': inline(text, lang) if text else '', 'options': opts, 'open': True}


# ---------------------------------------------------------------- one page

def page_parts(path, lang, course):
    s = soup(path, lang)
    h1 = s.select_one('h1.devsite-page-title')
    # The heading also holds Google's "save to collection" controls; keep its own words.
    title = ' '.join(t.strip() for t in h1.find_all(string=True, recursive=False) if t.strip()) if h1 else ''
    body = s.select_one('.devsite-article-body')
    takeaways = []
    panel = body.find('devsite-key-takeaways-panel')
    if panel:
        takeaways = [inline(li, lang) for li in panel.select('ul.devsite-key-takeaways-panel-list > li')]
    terms = []
    for aside in body.select('aside.key-term'):
        for a in aside.find_all('a'):
            kind, target = link(a, lang)
            if kind == 'term' and target not in terms:
                terms.append(target)
    bl = blocks(body, lang, course)
    # The Chinese pages start with a note that the page was machine-translated
    # or is a translation; it has no English twin.
    if lang == 'zh':
        bl = [b for b in bl if not (b['type'] == 'p' and re.search(r'本页面由.*翻译|Cloud Translation', b.get('html', '')))]
    return {'title': title, 'takeaways': takeaways, 'terms': terms, 'blocks': bl}


def sig(b):
    return b['type'] + (str(b.get('level', '')) if b['type'] == 'h' else '') + (str(len(b.get('items', []))) if b['type'] == 'list' else '')


def pair(en, zh):
    """Line up two block lists; return bilingual blocks."""
    out = []
    sm = difflib.SequenceMatcher(a=[sig(b) for b in en], b=[sig(b) for b in zh], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == 'equal' or (op == 'replace' and a1 - a0 == b1 - b0 and all(en[a0 + k]['type'] == zh[b0 + k]['type'] for k in range(a1 - a0))):
            out += [merge(en[a0 + k], zh[b0 + k]) for k in range(a1 - a0)]
        else:
            out += [merge(b, None) for b in en[a0:a1]]
            out += [merge(None, b) for b in zh[b0:b1]]
    return out


def bi(e, z):
    return {'en': e if e is not None else z, 'zh': z if z is not None else e}


def merge(e, z):
    one = e or z
    t = one['type']
    E = e or {}
    Z = z or {}
    only = None if (e and z) else ('en' if e else 'zh')
    if t in ('p', 'h'):
        b = {'type': t, 'html': bi(E.get('html'), Z.get('html'))}
        if t == 'h':
            b['level'] = one['level']
    elif t == 'note':
        b = {'type': 'note', 'kind': one['kind'], 'html': bi(E.get('html'), Z.get('html'))}
    elif t == 'list':
        ei, zi = E.get('items'), Z.get('items')
        if ei and zi and len(ei) != len(zi):
            # Different item counts: keep each language's list whole.
            b = {'type': 'list', 'ordered': one['ordered'], 'items': None, 'itemsBy': {'en': ei, 'zh': zi}}
        else:
            n = len(ei or zi)
            b = {'type': 'list', 'ordered': one['ordered'], 'items': [bi(ei[k] if ei else None, zi[k] if zi else None) for k in range(n)]}
    elif t == 'table':
        eh, zh_ = E.get('headers'), Z.get('headers')
        er, zr = E.get('rows'), Z.get('rows')
        same = er and zr and len(er) == len(zr) and all(len(x) == len(y) for x, y in zip(er, zr)) and len(eh or []) == len(zh_ or [])
        if e and z and not same:
            b = {'type': 'table', 'by': {'en': {'headers': eh, 'rows': er}, 'zh': {'headers': zh_, 'rows': zr}}, 'caption': bi(E.get('caption'), Z.get('caption'))}
        else:
            hs = eh if e else zh_
            rs = er if e else zr
            b = {'type': 'table',
                 'headers': [bi(eh[k] if e else None, zh_[k] if z else None) for k in range(len(hs or []))],
                 'rows': [[bi(er[i][j] if e else None, zr[i][j] if z else None) for j in range(len(rs[i]))] for i in range(len(rs))],
                 'caption': bi(E.get('caption'), Z.get('caption'))}
    elif t == 'figure':
        b = {'type': 'figure', 'src': bi(E.get('src'), Z.get('src')), 'alt': bi(E.get('alt'), Z.get('alt')), 'caption': bi(E.get('caption'), Z.get('caption'))}
        if b['src']['en'] == b['src']['zh']:
            b['src'] = b['src']['en']
    elif t == 'quiz':
        eo, zo = E.get('options'), Z.get('options')
        if eo and zo and len(eo) != len(zo):
            zo = None
        n = len(eo or zo)
        b = {'type': 'quiz', 'q': bi(E.get('q'), Z.get('q')), 'open': one.get('open', False),
             'options': [{'html': bi(eo[k]['html'] if eo else None, zo[k]['html'] if zo else None),
                          'why': bi(eo[k]['why'] if eo else None, zo[k]['why'] if zo else None),
                          'correct': (eo or zo)[k]['correct']} for k in range(n)]}
    elif t == 'more':
        b = {'type': 'more', 'title': bi(E.get('title'), Z.get('title')), 'blocks': pair(E.get('blocks', []), Z.get('blocks', [])) if e and z else [merge(x, None) if e else merge(None, x) for x in one['blocks']]}
    elif t == 'code':
        b = {'type': 'code', 'text': E.get('text') or Z.get('text')}
    elif t == 'video':
        b = {'type': 'video', 'id': one['id']}
    elif t == 'frame':
        b = {'type': 'frame', 'src': bi(E.get('src'), Z.get('src'))}
    elif t == 'gquiz':
        b = {'type': 'gquiz', 'href': {'en': E.get('href') or Z.get('href'), 'zh': (Z.get('href') or E.get('href')).split('?')[0] + '?hl=zh-cn'}}
    elif t == 'link':
        b = {'type': 'link', 'href': bi(E.get('href'), Z.get('href')), 'html': bi(E.get('html'), Z.get('html'))}
    else:
        b = dict(one)
    if only:
        b['only'] = only
    return b


def place_widgets(path, bl):
    """Insert the app's figures: after the first block whose English text
    contains `after`, or just before Google's online exercise (`at: frame`),
    or at the start / end."""
    for spec in WIDGETS.get(path, []):
        w = {'type': 'widget', 'id': spec['id']}
        if spec.get('opts'):
            w['opts'] = spec['opts']
        where = len(bl)
        if spec.get('at') == 'start':
            where = 0
        elif spec.get('at') == 'frame':
            where = next((i for i, b in enumerate(bl) if b['type'] == 'frame'), len(bl))
        elif spec.get('after'):
            needle = spec['after'].lower()
            hit = next((i for i, b in enumerate(bl) if needle in re.sub(r'<[^>]+>', '', json.dumps(b.get('html') or b.get('caption') or b.get('alt') or b.get('items') or '', ensure_ascii=False)).lower()), None)
            if hit is None:
                print(f'  ! widget {spec["id"]}: "{spec["after"]}" not found in {path}', file=sys.stderr)
            else:
                where = hit + 1
        bl.insert(where, w)
    return bl


# ---------------------------------------------------------------- glossary

def glossary():
    terms = {}
    for lang, f in (('en', 'glossary.en.html'), ('zh', 'glossary.zh-cn.html')):
        s = bs4.BeautifulSoup((CACHE / f).read_text(encoding='utf-8'), 'lxml')
        body = s.select_one('.devsite-article-body')
        for a in body.select('a.glossary-anchor[name]'):
            nxt = a.find_next(['h2', 'h3'])
            if nxt is not None and nxt.get('id'):
                ALIASES.setdefault(a['name'], nxt['id'])
        for h in body.find_all(['h2', 'h3'], id=True):
            if 'hide-from-toc' not in cls(h):
                continue
            tid = h['id']
            name = plain(h)
            parts, tags = [], []
            for sib in h.next_siblings:
                if not isinstance(sib, Tag):
                    continue
                if sib.name in ('h2', 'h3') and sib.get('id'):
                    break
                if 'glossary-icon-container' in cls(sib):
                    tags = [x.get_text(strip=True).lstrip('#') for x in sib.select('.glossary-icon')]
                    continue
                if sib.name == 'p' and sib.find('a', class_='glossary-anchor') and not plain(sib):
                    break
                if sib.name in ('p', 'ul', 'ol'):
                    t = inline(sib, lang) if sib.name == 'p' else inline(bs4.BeautifulSoup(f'<div>{sib}</div>', 'lxml').div, lang)
                    if t:
                        parts.append(t)
                if len(parts) >= 4:
                    break
            e = terms.setdefault(tid, {'id': tid, 'name': {}, 'def': {}, 'tags': tags})
            e['name'][lang] = name
            e['def'][lang] = parts
    out = []
    for tid, e in terms.items():
        if 'en' not in e['name']:
            continue
        e['name'].setdefault('zh', e['name']['en'])
        e['def'].setdefault('zh', e['def']['en'])
        out.append(e)
    return out


# ---------------------------------------------------------------- maths

def render_math(obj):
    if not MATH:
        return obj
    items = [{'tex': k[1:], 'display': k[0] == 'D'} for k in sorted(MATH, key=MATH.get)]
    res = subprocess.run(['node', str(EXTRA / 'katex-render.mjs')], input=json.dumps(items), capture_output=True, text=True, check=True)
    rendered = json.loads(res.stdout)
    if res.stderr.strip():
        print(res.stderr.strip(), file=sys.stderr)
    s = json.dumps(obj, ensure_ascii=False)
    s = re.sub(r'⟦m(\d+)⟧', lambda m: json.dumps(rendered[int(m.group(1))], ensure_ascii=False)[1:-1], s)
    return json.loads(s)


# ---------------------------------------------------------------- main

def main():
    nav = json.loads((CACHE / 'nav.json').read_text(encoding='utf-8'))
    # Short courses become one module each; their navigation headings
    # ("Overview", "Conclusion") are not useful chapter titles.
    for c in nav:
        if c['course'] in SINGLE:
            c['modules'] = [{'part': None, 'title': COURSES[c['course']]['en'], 'zh': COURSES[c['course']]['zh'],
                             'pages': [p for m in c['modules'] for p in m['pages']]}]
        else:
            first = c['modules'][0]['pages'][0]['path']
            zh_mods = nav_tree((CACHE / 'pages' / (first.strip('/').replace('/', '__') + '.zh.html')).read_text(encoding='utf-8'), c['course'])
            for m, z in zip(c['modules'], zh_mods):
                if [p['path'] for p in m['pages']] == [p['path'] for p in z['pages']]:
                    m['zh'] = z['title']
    chapters, plan = [], []
    num = 0
    for stage_n, c in enumerate(nav, 1):
        for m in c['modules']:
            num += 1
            cid = f'c{num:02d}'
            secs = []
            for p in m['pages']:
                sec = p['path'].rstrip('/').rsplit('/', 1)[-1]
                if sec == c['course'] or sec in [s for s, _ in secs]:
                    sec = ('intro' if 'intro' not in [s for s, _ in secs] else 'overview') if sec == c['course'] else sec + '-2'
                secs.append((sec, p))
                PAGES[p['path'].rstrip('/')] = (cid, sec)
            plan.append((stage_n, c['course'], cid, num, m, secs))

    index = {'app': {'en': 'Machine Learning', 'zh': '机器学习'}, 'stages': [], 'chapters': []}
    for stage_n, c in enumerate(nav, 1):
        index['stages'].append({'n': stage_n, 'id': c['course'], 'title': COURSES[c['course']],
                                'blurb': BLURBS[c['course']], 'url': f'{BASE}/machine-learning/{c["course"]}',
                                'chapters': [cid for s, _, cid, *_ in plan if s == stage_n]})

    terms = glossary()
    for stage_n, course, cid, num, m, secs in plan:
        sections, minutes = [], 0
        for sec, p in secs:
            en = page_parts(p['path'], 'en', course)
            zh = page_parts(p['path'], 'zh', course)
            tz = TAKEAWAYS_ZH.get(p['path'].rstrip('/'))
            takeaways = [{'en': t, 'zh': tz[i] if tz and i < len(tz) else None} for i, t in enumerate(en['takeaways'])]
            blocks_ = place_widgets(p['path'].rstrip('/'), pair(en['blocks'], zh['blocks']))
            sections.append({
                'id': sec, 'path': p['path'], 'min': p['min'],
                'heading': {'en': en['title'] or p['title'], 'zh': zh['title'] or en['title']},
                'url': {'en': BASE + p['path'], 'zh': BASE + p['path'] + '?hl=zh-cn'},
                'takeaways': takeaways,
                'terms': en['terms'] or zh['terms'],
                'blocks': blocks_,
            })
            minutes += p['min'] or 0
        zh_title = TITLES_ZH.get(m['title']) or m.get('zh') or m['title']
        ch = {'id': cid, 'num': num, 'stage': stage_n, 'title': {'en': m['title'], 'zh': zh_title},
              'minutes': minutes or None, 'sections': sections}
        (DATA / f'{cid}.json').write_text(json.dumps(render_math(ch), ensure_ascii=False, indent=0), encoding='utf-8')
        MATH.clear()
        index['chapters'].append({'id': cid, 'num': num, 'stage': stage_n, 'title': ch['title'], 'minutes': ch['minutes'],
                                  'sections': [{'id': s['id'], 'heading': s['heading']} for s in sections]})
        unpaired = sum(1 for s in sections for b in s['blocks'] if b.get('only'))
        total = sum(len(s['blocks']) for s in sections)
        print(f'{cid} {m["title"]}: {len(sections)} pages, {total} blocks, {unpaired} unpaired')

    (DATA / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
    terms = render_math(terms)
    (DATA / 'terms.json').write_text(json.dumps(terms, ensure_ascii=False, indent=0), encoding='utf-8')
    print(f'{len(terms)} glossary terms, {len([v for v in images.values() if v])} images')


if __name__ == '__main__':
    DATA.mkdir(exist_ok=True)
    main()
