"""Helpers for the per-chapter content scripts in tools/content/.

Each chapter is written as a Python script so the three languages of every
sentence sit side by side, which is how they are reviewed. write_chapter()
merges the chapter's terms, sources and quiz into the shared data files and
marks the chapter ready in data/index.json. Re-running a script is safe."""
import json
import re
from pathlib import Path

DATA = Path('data')


def T(zh, en, ms):
    return {"zh": zh, "en": en, "ms": ms}


def P(zh, en, ms, **kw):
    return {"type": "p", "text": T(zh, en, ms), **kw}


def L(*items, **kw):
    return {"type": "list", "items": [T(*i) for i in items], **kw}


def N(kind, zh, en, ms, **kw):
    return {"type": "note", "kind": kind, "text": T(zh, en, ms), **kw}


def _load(name, default):
    p = DATA / f"{name}.json"
    return json.loads(p.read_text()) if p.exists() else default


def _dump(name, value):
    (DATA / f"{name}.json").write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n")


UNIT = re.compile(r"(\d) (°C|%|MPa|kPa|nm|μm|mm|cm|m\b|kJ|kcal|mV|mM|μM|mol|μmol|g\b|kg|h\b|K\b)")


def tidy(v):
    """Keep a number on the same line as its unit."""
    if isinstance(v, str):
        return UNIT.sub("\\1\u00a0\\2", v)
    if isinstance(v, list):
        return [tidy(x) for x in v]
    if isinstance(v, dict):
        return {k: tidy(x) for k, x in v.items()}
    return v


def write_chapter(chapter, terms, sources, quiz, datasets=()):
    chapter, terms, quiz = tidy(chapter), tidy(terms), tidy(quiz)
    num, cid = chapter["num"], chapter["id"]
    chapter = {**chapter, "newTerms": [t[0] for t in terms]}
    _dump(cid, chapter)

    all_terms = [t for t in _load("terms", []) if t["chapter"] != num]
    for tid, name, short, *rest in terms:
        entry = {"id": tid, "name": name, "short": short, "chapter": num}
        if rest and rest[0]:
            entry["abbr"] = rest[0]
        all_terms.append(entry)
    _dump("terms", sorted(all_terms, key=lambda t: (t["chapter"], t["id"])))

    by_id = {s["id"]: s for s in _load("sources", [])}
    for s in sources:
        by_id[s["id"]] = s
    _dump("sources", sorted(by_id.values(), key=lambda s: s["id"]))

    _dump("quiz", [q for q in _load("quiz", []) if q["chapter"] != cid] + quiz)

    if datasets:
        by = {d["id"]: d for d in _load("datasets", [])}
        for d in datasets:
            by[d["id"]] = tidy(d)
        _dump("datasets", list(by.values()))

    index = _load("index", None)
    for c in index["chapters"]:
        if c["id"] == cid:
            c.pop("ready", None)
            c["title"] = chapter["title"]
    _dump("index", index)
    print(f"{cid}: {sum(len(s['blocks']) for s in chapter['sections'])} blocks, {len(terms)} terms, {len(quiz)} questions")
