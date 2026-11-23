#!/usr/bin/env python3
"""Merge case files into the guide's content folder.

  C:\\baudit\\analysis\\cases_*.json  (each: array of cases)  -> validate -> C:\\baudit\\guide\\content\\cases.json
  C:\\baudit\\analysis\\mapping.json                           -> copied to C:\\baudit\\guide\\content\\mapping.json
  then checks caseIds referenced by guide\\content\\<chapter>.json and mapping resolved.caseId.

  C:\\baudit\\analysis\\extra_parts_*.json ({caseId: [part,...]}, parts flagged missed:true) are merged into the case with that id
  (in memory only; source files are never modified); then every part of a council case gets a `status` (class|homework|missed)
  derived from mapping.json, and case.topics is recomputed from the parts' topics.

Usage: python merge.py [--analysis DIR] [--content DIR] [--force] [--dry-run]
Exit code 1 when validation errors were found (nothing is written unless --force).
Does not fail when no cases files exist yet (nothing written, exit 0).
"""
import argparse, glob, json, os, re, shutil, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # C:\baudit

ap = argparse.ArgumentParser()
ap.add_argument('--analysis', default=os.path.join(BASE, 'analysis'))
ap.add_argument('--content', default=os.path.join(BASE, 'guide', 'content'))
ap.add_argument('--force', action='store_true', help='write cases.json even if validation errors exist')
ap.add_argument('--dry-run', action='store_true', help='validate and report only, write nothing')
args = ap.parse_args()
A, G = args.analysis, args.content

TOPICS = {'prospectus', 'laws', 'fraud', 'tax', 'governance', 'quality', 'internal', 'estimates', 'fairvalue'}  # SPEC, without 'exam'
KINDS = {'council', 'college'}
TAGS = {'class', 'homework', 'submit', 'missed', 'college'}
ALSO = {'class', 'homework'}
NON_CHAPTER = {'cases.json', 'mapping.json', 'exams.json'}

errors, warns = [], []
err = lambda m: errors.append(m)
warn = lambda m: warns.append(m)


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:  # noqa
        err(f'{os.path.basename(path)}: cannot load ({e})')
        return None


# ---------------- collect cases ----------------
NOT_CASE_PREFIXES = ('missed_final', 'missed_candidates', 'extra_parts', 'exam_meta', 'council_index', 'mapping')
files = [f for f in sorted(glob.glob(os.path.join(A, 'cases_*.json'))) if not os.path.basename(f).startswith(NOT_CASE_PREFIXES)]
cases, seen = [], {}
for f in files:
    data = load(f)
    if data is None:
        continue
    if not isinstance(data, list):
        err(f'{os.path.basename(f)}: top level must be an array')
        continue
    for i, c in enumerate(data):
        where = f'{os.path.basename(f)}[{i}]'
        if not isinstance(c, dict):
            err(f'{where}: not an object')
            continue
        cid = c.get('id')
        if not cid or not isinstance(cid, str):
            err(f'{where}: missing id')
            continue
        where = f'{os.path.basename(f)}:{cid}'
        if cid in seen:
            err(f'{where}: duplicate id (also in {seen[cid]})')
            continue
        seen[cid] = os.path.basename(f)
        for k in ('title', 'source'):
            if not str(c.get(k) or '').strip():
                err(f'{where}: missing {k}')
        if c.get('kind') not in KINDS:
            err(f'{where}: kind {c.get("kind")!r} not in {sorted(KINDS)}')
        if c.get('tag') not in TAGS:
            err(f'{where}: tag {c.get("tag")!r} not in {sorted(TAGS)}')
        if (c.get('kind') == 'college') != (c.get('tag') == 'college'):
            warn(f'{where}: kind={c.get("kind")!r} but tag={c.get("tag")!r} (college kind should have tag college)')
        if 'alsoMapped' in c and c['alsoMapped'] not in ALSO:
            err(f'{where}: alsoMapped {c["alsoMapped"]!r} not in {sorted(ALSO)}')
        for k in ('note', 'pointsNote', 'reason'):
            if k in c and not (isinstance(c[k], str) and c[k].strip()):
                err(f'{where}: {k} must be a non-empty string when present')
        if c.get('tag') == 'missed' and not str(c.get('reason') or '').strip():
            warn(f'{where}: tag missed without reason')
        if c.get('alsoMapped') and c.get('tag') != 'submit':
            warn(f'{where}: alsoMapped is only meaningful with tag submit')
        # year/session from id when absent
        m = re.match(r'council-(\d{4})-(summer|winter|spring|autumn|special)-q\d+', cid)
        if m:
            c.setdefault('year', int(m.group(1)))
            c.setdefault('session', m.group(2))
        elif cid.startswith('council-'):
            warn(f'{where}: id does not match council-YYYY-<session>-qN')
        if c.get('kind') == 'college' and not re.match(r'college-\d{4}[abc]-q\d+$', cid):
            warn(f'{where}: id does not match college-YYYYx-qN')
        # topics
        parts = c.get('parts')
        if not isinstance(parts, list) or not parts:
            err(f'{where}: parts must be a non-empty array')
            parts = []
        topics = c.get('topics')
        if not isinstance(topics, list) or not topics:
            err(f'{where}: topics must be a non-empty array')
            topics = []
        for t in topics:
            if t not in TOPICS:
                err(f'{where}: topic {t!r} not a valid topic id')
        if len(set(topics)) != len(topics):
            warn(f'{where}: duplicate entries in topics')
        for j, p in enumerate(parts):
            pw = f'{where} part[{j}]'
            if not isinstance(p, dict):
                err(f'{pw}: not an object')
                continue
            if not str(p.get('label') or '').strip():
                err(f'{pw}: missing label')
            if not str(p.get('question') or '').strip():
                err(f'{pw}: missing question')
            if p.get('topic') is not None and p['topic'] not in TOPICS:
                err(f'{pw}: topic {p["topic"]!r} not a valid topic id')
            elif p.get('topic') and topics and p['topic'] not in topics:
                warn(f'{pw}: part topic {p["topic"]!r} not listed in case topics')
            if p.get('alsoTopic') is not None and p['alsoTopic'] not in TOPICS:
                err(f'{pw}: alsoTopic {p["alsoTopic"]!r} not a valid topic id')
            pp = p.get('points')
            if pp is not None and (isinstance(pp, bool) or not isinstance(pp, (int, float))):
                err(f'{pw}: points must be a number or null, got {pp!r}')
            if 'keyPoints' not in p:
                warn(f'{pw}: keyPoints missing (set to [])')
                p['keyPoints'] = []
            elif not isinstance(p['keyPoints'], list):
                err(f'{pw}: keyPoints must be a list')
            if 'solution' not in p:
                p['solution'] = ''
        cases.append(c)

# ---------------- extra parts (missed sub-items of already-mapped cases) ----------------
def label_num(label):
    """numeric value of a part label: 'סעיף 4.1' -> 4.1, 'נדרש 2' -> 2.0; None when unparseable"""
    m = re.search(r'\d+(?:\.\d+)?', str(label or ''))
    return float(m.group(0)) if m else None


def check_extra_part(p, where):
    if not isinstance(p, dict):
        err(f'{where}: not an object')
        return False
    ok = True
    for k in ('label', 'question'):
        if not str(p.get(k) or '').strip():
            err(f'{where}: missing {k}')
            ok = False
    if p.get('topic') not in TOPICS:
        err(f'{where}: topic {p.get("topic")!r} not a valid topic id')
        ok = False
    if p.get('alsoTopic') is not None and p['alsoTopic'] not in TOPICS:
        err(f'{where}: alsoTopic {p["alsoTopic"]!r} not a valid topic id')
        ok = False
    if p.get('missed') is not True:
        err(f'{where}: extra part must carry "missed": true')
        ok = False
    if not str(p.get('reason') or '').strip():
        err(f'{where}: extra part must carry a non-empty reason')
        ok = False
    return ok


by_id = {c['id']: c for c in cases}
extra_files = sorted(glob.glob(os.path.join(A, 'extra_parts_*.json')))
n_extra = 0
for f in extra_files:
    data = load(f)
    if data is None:
        continue
    fn = os.path.basename(f)
    if not isinstance(data, dict):
        err(f'{fn}: top level must be an object {{caseId: [part,...]}}')
        continue
    for cid, plist in data.items():
        if cid not in by_id:
            err(f'{fn}: unknown caseId {cid!r}')
            continue
        if not isinstance(plist, list) or not plist:
            err(f'{fn}:{cid}: must be a non-empty array of parts')
            continue
        c = by_id[cid]
        for j, p in enumerate(plist):
            w = f'{fn}:{cid} part[{j}]'
            if not check_extra_part(p, w):
                continue
            lab = str(p['label']).strip()
            if any(str(q.get('label')).strip() == lab for q in c['parts']):
                err(f'{w}: label {lab!r} duplicates an existing part of {cid}')
                continue
            p = json.loads(json.dumps(p))  # copy; the source data is never touched
            p.setdefault('keyPoints', [])
            p.setdefault('solution', '')
            n = label_num(lab)
            pos = len(c['parts'])
            if n is not None:
                for k, q in enumerate(c['parts']):
                    qn = label_num(q.get('label'))
                    if qn is not None and qn > n:
                        pos = k
                        break
            else:
                warn(f'{w}: label {lab!r} has no number - appended last')
            c['parts'].insert(pos, p)
            n_extra += 1
            print(f'extra part {cid} / {lab} ({p["topic"]}) inserted at position {pos + 1} of {len(c["parts"])}')
print(f'extra parts merged: {n_extra} from {len(extra_files)} file(s)')

# ---------------- case topics for placement ----------------
# union of the parts' topics (topic + alsoTopic), case.topics[0] first; listed topics no part carries are ignored
for c in cases:
    carried = []
    for p in c['parts']:
        for t in (p.get('topic'), p.get('alsoTopic')):
            if t and t not in carried:
                carried.append(t)
    old = [t for t in (c.get('topics') or []) if t in TOPICS]
    ignored = [t for t in old if t not in carried]
    added = [t for t in carried if t not in old]
    first = old[0] if old and old[0] in carried else None
    ordered = ([first] if first else []) + [t for t in old if t in carried and t != first] + added
    if not ordered:
        continue
    if ignored:
        print(f'notice: {c["id"]}: topics {ignored} listed in case.topics but carried by no part - ignored for placement')
    if added:
        print(f'notice: {c["id"]}: topics {added} added from parts')
    c['topics'] = ordered

# ---------------- part status (class | homework | missed) ----------------
_map_path = os.path.join(A, 'mapping.json')
_map = load(_map_path) if os.path.exists(_map_path) else None
_map = _map if isinstance(_map, list) else []


def _cid(v):
    return v.get('caseId') if isinstance(v, dict) else (v if isinstance(v, str) else None)


def map_targets(case_id):
    """[(subItems|None, highlighted)] for every mapping target that points at case_id"""
    out = []
    for m in _map:
        if not isinstance(m, dict):
            continue
        hl = bool(m.get('highlighted'))
        main = (m.get('resolved') or {}).get('caseId') or _cid(m.get('candidateIfLecturerIsRight'))
        if main == case_id:
            out.append((m.get('subItems') or None, hl))
        for a in m.get('additionalRefs') or []:
            a = a or {}
            aid = (a.get('resolved') or {}).get('caseId') or _cid(a.get('candidateIfLecturerIsRight'))
            if aid == case_id:
                out.append((a.get('subItems') or None, hl))
    return out


def part_number(label):
    lab = str(label or '')
    if 'מקבץ' in lab:
        return None  # cluster labels: the first number is not a sub-item number
    m = re.search(r'\d+', lab)
    return int(m.group(0)) if m else None  # 'סעיף 4.1' -> 4


for c in cases:
    tag = c.get('tag')
    if c.get('kind') != 'council' or tag not in ('class', 'homework', 'missed'):
        continue
    tg = map_targets(c['id']) if tag != 'missed' else []
    if tag != 'missed' and not tg:
        warn(f'{c["id"]}: tag {tag} but no mapping target found - all parts fall back to the case tag')
    for p in c['parts']:
        if tag == 'missed' or p.get('missed') is True:
            p['status'] = 'missed'
            continue
        n = part_number(p.get('label'))
        hits = [hl for (sub, hl) in tg if sub is None or (n is not None and n in sub)]
        if hits:
            p['status'] = 'class' if any(hits) else 'homework'
        else:
            p['status'] = tag
            why = 'label has no sub-item number' if n is None else f'sub-item {n} is not named by any mapping target'
            warn(f'{c["id"]} / {p.get("label")!r}: {why} - fell back to case tag {tag!r}')
    sts = {p['status'] for p in c['parts']}
    if tag in ('class', 'homework') and tag not in sts:
        warn(f'{c["id"]}: case tag {tag!r} but no part has that status ({sorted(sts)})')

# ---------------- chapters (for caseIds check) ----------------
chapter_files = [f for f in sorted(glob.glob(os.path.join(G, '*.json'))) if os.path.basename(f) not in NON_CHAPTER]
case_ids = {c['id'] for c in cases}

# ---------------- write ----------------
write_ok = not errors or args.force
out_cases = os.path.join(G, 'cases.json')
if not files:
    print(f'no cases_*.json in {A} yet - cases.json not written')
elif args.dry_run:
    print('dry run - nothing written')
elif write_ok:
    os.makedirs(G, exist_ok=True)
    with open(out_cases, 'w', encoding='utf-8') as f:
        json.dump(cases, f, ensure_ascii=False, indent=1)
    print(f'wrote {out_cases}: {len(cases)} cases from {len(files)} file(s)')
else:
    print('validation errors - cases.json NOT written (use --force to override)')

mapping, map_src = None, os.path.join(A, 'mapping.json')
if os.path.exists(map_src):
    mapping = load(map_src)
    if isinstance(mapping, list):
        for i, m in enumerate(mapping):
            if not isinstance(m, dict) or 'row' not in m or 'refAsPrinted' not in m:
                err(f'mapping.json[{i}]: needs row and refAsPrinted')
        if not args.dry_run and not errors:
            os.makedirs(G, exist_ok=True)
            shutil.copyfile(map_src, os.path.join(G, 'mapping.json'))
            print(f'copied mapping.json ({len(mapping)} refs)')
        elif not args.dry_run:
            print('mapping.json NOT copied because of errors')
    elif mapping is not None:
        err('mapping.json: top level must be an array')
        mapping = None
else:
    print('no mapping.json in analysis yet')
    cur = os.path.join(G, 'mapping.json')
    if os.path.exists(cur):
        mapping = load(cur)

# exam metas -> exams.json
exams = []
for f in sorted(glob.glob(os.path.join(A, 'exam_meta_*.json')), reverse=True):
    d = load(f)
    if isinstance(d, dict) and d.get('id'):
        exams.append(d)
    elif d is not None:
        err(f'{os.path.basename(f)}: needs an object with id')
if exams and not args.dry_run and not errors:
    os.makedirs(G, exist_ok=True)
    with open(os.path.join(G, 'exams.json'), 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=1)
    print(f'wrote exams.json ({len(exams)} exams)')

# ---------------- cross references ----------------
# cases already written by an earlier run count too when none are present in this run
if not cases and os.path.exists(out_cases):
    prev = load(out_cases)
    if isinstance(prev, list):
        case_ids = {c.get('id') for c in prev}
missing_refs = []
for f in chapter_files:
    d = load(f)
    if not isinstance(d, dict):
        continue
    for a in d.get('articles') or []:
        for cid in a.get('caseIds') or []:
            if cid not in case_ids:
                missing_refs.append(f'{os.path.basename(f)} / {a.get("id")}: caseId {cid!r} not in cases')
def cand_id(v):
    return v.get('caseId') if isinstance(v, dict) else (v if isinstance(v, str) else None)


unresolved = []
if isinstance(mapping, list):
    for m in mapping:
        if not isinstance(m, dict):
            continue
        tag = f'mapping: {m.get("row")!r} / {m.get("refAsPrinted")!r}'
        r = m.get('resolved')
        if r and r.get('caseId') and r['caseId'] not in case_ids:
            missing_refs.append(f'{tag} -> {r["caseId"]!r} not in cases')
        if not (r and r.get('caseId')):
            c = cand_id(m.get('candidateIfLecturerIsRight'))
            unresolved.append(f'{tag}: unresolved, candidate {c!r}')
            if c and c not in case_ids:
                missing_refs.append(f'{tag} -> candidate {c!r} not in cases')
        for ar in m.get('additionalRefs') or []:
            ar_r = (ar or {}).get('resolved') or {}
            if ar_r.get('caseId') and ar_r['caseId'] not in case_ids:
                missing_refs.append(f'{tag} additionalRef -> {ar_r["caseId"]!r} not in cases')
for ex in exams:
    for cid in ex.get('caseIds') or []:
        if cid not in case_ids:
            missing_refs.append(f'exam {ex.get("id")}: caseId {cid!r} not in cases')

# ---------------- report ----------------
print()
print(f'cases: {len(cases)}  (files: {len(files)})')
print('by tag  :', dict(Counter(c.get('tag') for c in cases)))
print('by kind :', dict(Counter(c.get('kind') for c in cases)))
print('by topic (case.topics):', dict(Counter(t for c in cases for t in (c.get('topics') or []))))
print('by first topic        :', dict(Counter((c.get('topics') or ['?'])[0] for c in cases)))
print('parts by topic        :', dict(Counter(p.get('topic') for c in cases for p in c.get('parts', []) if isinstance(p, dict))))
print('parts by status       :', dict(Counter(p.get('status', '-') for c in cases for p in c.get('parts', []) if isinstance(p, dict))))
mixed = [c['id'] for c in cases if len({p.get('status') for p in c.get('parts', [])} - {None}) > 1]
print(f'mixed-status cases ({len(mixed)}):', ', '.join(mixed))
empty = [f"{c['id']} / {p.get('label')}" for c in cases for p in c.get('parts', []) if isinstance(p, dict) and not str(p.get('solution') or '').strip()]
print(f'\nmapping entries without resolved caseId: {len(unresolved)}')
for u in unresolved:
    print('  -', u)
print(f'\nparts with empty solution: {len(empty)}')
for e in empty:
    print('  -', e)
print(f'\ncaseIds referenced but missing ({len(missing_refs)}):')
for m in missing_refs:
    print('  -', m)
if warns:
    print(f'\nwarnings ({len(warns)}):')
    for w in warns:
        print('  -', w)
if errors:
    print(f'\nERRORS ({len(errors)}):')
    for e in errors:
        print('  -', e)
    sys.exit(1)
print('\nOK')
