#!/usr/bin/env python3
"""Scan content JSON strings for likely reversed-Hebrew / extraction artefacts.

Usage: python check_text.py [DIR_OR_FILE ...]      (default: C:\\baudit\\guide\\content)
Prints: file | json path | rule | snippet.   Always exits 0 (it is a review aid, not a gate).
"""
import json, os, re, sys, glob

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
targets = sys.argv[1:] or [os.path.join(BASE, 'guide', 'content')]

H = '\u05D0-\u05EA'  # Hebrew letters
RULES = [
    ('paren-reversed', re.compile(r'\)[^\s()–\-]{0,20}\w{2,}[^\s()–\-]{0,20}\(')),                    # ")X(" - reversed parentheses
    ('paren-hebrew', re.compile(rf'\)[{H}][^()\n]{{0,40}}\(')),               # ")עברית ... ("
    ('digits+hebrew', re.compile(rf'\d{{2,}}[{H}]{{2,}}')),                   # 2016קיץ
    ('hebrew+digits', re.compile(rf'[{H}]{{2,}}\d{{2,}}')),                   # קיץ2016
    ('year-1025-1027', re.compile(r'(?<!\d)102[567](?!\d)')),                 # font glitch for 2015-2017
    ('unclear-marker', re.compile(r'\[לא ברור במקור\]')),
    ('final-letter-first', re.compile(rf'(?<![{H}"\u05F3\u05F4\'])[\u05DD\u05DF\u05E5\u05E3\u05DA][{H}]')),  # word starting with a final-form letter
    ('bidi-control', re.compile('[\u200e\u200f\u202a-\u202e\u2066-\u2069]')),
    ('presentation-forms', re.compile('[\uFB1D-\uFB4F\uFE70-\uFEFF]')),
    ('replacement-char', re.compile('\uFFFD')),
]


def walk(node, path):
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f'{path}[{i}]')
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, f'{path}.{k}' if path else k)


def snippet(s, m, w=28):
    a, b = max(0, m.start() - w), min(len(s), m.end() + w)
    return ('…' if a else '') + s[a:b].replace('\n', ' ') + ('…' if b < len(s) else '')


files = []
for t in targets:
    if os.path.isdir(t):
        files += sorted(glob.glob(os.path.join(t, '*.json')))
    elif os.path.exists(t):
        files.append(t)
    else:
        print(f'not found: {t}')

total = 0
per_rule = {}
for f in files:
    try:
        with open(f, encoding='utf-8') as fh:
            data = json.load(fh)
    except Exception as e:  # noqa
        print(f'{os.path.basename(f)} | - | cannot load: {e}')
        continue
    for path, s in walk(data, ''):
        for name, rx in RULES:
            for m in rx.finditer(s):
                total += 1
                per_rule[name] = per_rule.get(name, 0) + 1
                print(f'{os.path.basename(f)} | {path} | {name} | {snippet(s, m)}')

print(f'\nscanned {len(files)} file(s); {total} suspicious spot(s)')
for k, v in sorted(per_rule.items(), key=lambda x: -x[1]):
    print(f'  {k}: {v}')
