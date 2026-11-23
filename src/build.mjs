// Builds the single-file guide (dist/index.html) from <content>/*.json.
// Usage: node build.mjs [contentDir] [outDir]     (or env CONTENT_DIR / OUT_DIR; defaults: content, dist)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(ROOT, process.argv[2] || process.env.CONTENT_DIR || 'content');
const OUT = path.resolve(ROOT, process.argv[3] || process.env.OUT_DIR || 'dist');

const BUILD_DATE = (() => { const d = new Date(); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; })();
const SITE_TITLE = "ביקורת מתקדמת ב' — מדריך לימוד";

// Chapter order; accent/soft from the existing palette.
const CHAPTERS = [
  { id: 'prospectus', title: 'תשקיפים — תקן 920', accent: '#2E7CF6', soft: '#EAF2FE' },
  { id: 'laws', title: 'חוקים ותקנות — תקן 250', accent: '#9333EA', soft: '#F5ECFE' },
  { id: 'fraud', title: 'תרמית — תקן 240', accent: '#E11D48', soft: '#FDEAEF' },
  { id: 'tax', title: 'פרקטיקה במיסים', accent: '#D97706', soft: '#FDF3E3' },
  { id: 'governance', title: 'ממשל תאגידי', accent: '#6366F1', soft: '#EEF0FE' },
  { id: 'quality', title: 'בקרת איכות — תקן 1 ו-220', accent: '#0E9F6E', soft: '#E6F7F0' },
  { id: 'internal', title: 'ביקורת פנימית — תקן 610', accent: '#0891B2', soft: '#E4F6FA' },
  { id: 'estimates', title: 'אומדנים — תקן 540', accent: '#7C3AED', soft: '#F3EDFD' },
  { id: 'fairvalue', title: 'שווי הוגן — תקן 545', accent: '#1E3A8A', soft: '#E7ECF8' },
  { id: 'exam', title: 'הבחינה', accent: '#171E33', soft: '#E7E9F1' },
];

// Navbar groups (<= 8 pills together with the intro and mapping links).
const NAV = [
  { label: 'תשקיפים', chapters: ['prospectus'] },
  { label: 'חוקים ותרמית', chapters: ['laws', 'fraud'] },
  { label: 'מיסים וממשל', chapters: ['tax', 'governance'] },
  { label: 'איכות וביקורת פנימית', chapters: ['quality', 'internal'] },
  { label: 'אומדנים ושווי הוגן', chapters: ['estimates', 'fairvalue'] },
  { label: 'הבחינה', chapters: ['exam'] },
];

const TAGS = { college: 'בחינת מכללה', class: 'נפתר בכיתה', homework: 'שיעורי בית', submit: 'שאלת הגשה', missed: 'לא במיפוי' };
// question-bank groups inside a chapter (submit questions have their own section)
const GROUPS = [
  { tag: 'college', title: 'בחינות המכללה' },
  { tag: 'class', title: 'מועצה — נפתר בכיתה' },
  { tag: 'homework', title: 'מועצה — שיעורי בית' },
  { tag: 'missed', title: 'מועצה — לא במיפוי' },
];
const SUBMIT_INTRO = 'שש שאלות המועצה שהמרצה נתן להגשה. רובן עוסקות בנושאי ביקורת כלליים שאינם חלק מתשעת נושאי הקורס.';
const FOOTER_TEXT = 'נבנה מתוך חומרי הקורס: חוברת הקורס, קובץ התקנים, בחינות המכללה ובחינות המועצה. במקרה של סתירה — נוסח התקן והחוק קובע.';
const HERO_NOTE = 'המדריך עוקב אחר נוסח התקנים והחוקים; במקומות שבהם חוברת הקורס שונה מהנוסח, ההבדל מצוין בטקסט. הפתרונות הרשמיים מובאים כפי שפורסמו, עם הערה במקומות שבהם הפניה בפתרון אינה תואמת את התקן. שאלות המסומנות ״לא במיפוי״ נוספו בסריקה של כל 23 מועדי המועצה, ואינן חלק מהמיפוי של המרצה.';
const tagOf = (cs) => (TAGS[cs.tag] ? cs.tag : 'missed');

marked.setOptions({ gfm: true, breaks: false });
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// raw HTML in content is escaped (only <br> is allowed)
marked.use({ renderer: { html(h) { return /^<br\s*\/?>$/i.test(String(h).trim()) ? '<br>' : esc(h); } } });
// bidi isolation for section references such as 15(ב)(1) or א14ב, so they keep their order inside RTL runs
const REF_RX = /(?<![\dא-תA-Za-z])(?:\d+(?:\.\d+)*(?:\([א-תA-Za-z0-9]{1,3}\))+(?:[–-]\([א-תA-Za-z0-9]{1,3}\))*|[א-ת]\d{1,3}[א-ת]?(?![\dא-ת])|\d+[א-ת]{1,2}\d*(?:[–-]\d+[א-ת]{1,2}\d*)?(?![א-תA-Za-z\d]))/g;
const isolate = (html) => html.split(/(<[^>]*>)/).map((seg) => (seg.startsWith('<') ? seg : seg.replace(REF_RX, '<bdi>$&</bdi>'))).join('');
const inline = (s) => isolate(marked.parseInline(String(s ?? '')));
const block = (s) => isolate(marked.parse(String(s ?? '')));
const plain = (s) => String(s ?? '').replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').trim();

function readJson(p, what) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.warn(`cannot read ${what} (${p}): ${e.message}`); return null; }
}

// ---------- chapters ----------
const chapters = [];
for (const c of CHAPTERS) {
  const f = path.join(CONTENT, `${c.id}.json`);
  if (!fs.existsSync(f)) { console.warn('missing chapter, skipped:', c.id); continue; }
  const data = readJson(f, `chapter ${c.id}`);
  if (!data) continue;
  if (/^פרק\s*\d+$/.test((data.eyebrow ?? '').trim())) delete data.eyebrow;
  chapters.push({ ...c, ...data, id: c.id, articles: data.articles ?? [] });
}
const chap = Object.fromEntries(chapters.map((c) => [c.id, c]));
chapters.forEach((c, i) => { c.num = i + 1; });

// ---------- cases ----------
let cases = [];
{
  const p = path.join(CONTENT, 'cases.json');
  if (fs.existsSync(p)) { const d = readJson(p, 'cases.json'); if (Array.isArray(d)) cases = d; }
}
const caseById = new Map();
for (const cs of cases) {
  if (!cs?.id) { console.warn('case without id skipped'); continue; }
  if (caseById.has(cs.id)) { console.warn('duplicate case id skipped:', cs.id); continue; }
  cs.parts = cs.parts ?? [];
  cs.topics = (cs.topics?.length ? cs.topics : [...new Set(cs.parts.map((x) => x.topic).filter(Boolean))]);
  caseById.set(cs.id, cs);
}

let exams = [];
{
  const p = path.join(CONTENT, 'exams.json');
  if (fs.existsSync(p)) { const d = readJson(p, 'exams.json'); if (Array.isArray(d)) exams = d.filter((e) => e?.id); }
}
const fmtDate = (d) => {
  const t = String(d ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${Number(m[3])}.${Number(m[2])}.${m[1]}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${Number(m[1])}.${Number(m[2])}.${m[3]}` : t;
};

const SESSION_RANK = { winter: 1, spring: 2, summer: 3, special: 3.5, autumn: 4 };
function examKey(cs) {
  // returns [group, year, sessionRank, examLabel, qnum]
  const q = Number((cs.id.match(/-q(\d+)/) || [])[1] ?? 0);
  const college = cs.kind === 'college' || cs.tag === 'college';
  if (college) {
    const m = cs.id.match(/college-(\d{4})([a-z]?)/);
    return [0, m ? Number(m[1]) : (cs.year ?? 0), m ? (m[2] || 'a').charCodeAt(0) : 0, q];
  }
  const m = cs.id.match(/council-(\d{4})-([a-z]+)/);
  const year = cs.year ?? (m ? Number(m[1]) : 0);
  const ses = SESSION_RANK[cs.session ?? (m ? m[2] : '')] ?? 0;
  return [1, year, ses, q];
}
function cmpCases(a, b) {
  const ka = examKey(a), kb = examKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];         // college first
  if (ka[1] !== kb[1]) return kb[1] - ka[1];         // year, newest first
  if (ka[2] !== kb[2]) return kb[2] - ka[2];         // session, latest first
  return ka[3] - kb[3] || String(a.id).localeCompare(String(b.id)); // question number ascending
}

// home chapter of each case = chapter of its first (existing) topic
const home = {};
const casesByChapter = Object.fromEntries(chapters.map((c) => [c.id, []]));
const submitCases = [];
for (const cs of caseById.values()) {
  if (cs.tag === 'submit') { home[cs.id] = 'submit'; submitCases.push(cs); continue; } // own section, not in the topic chapters
  const present = cs.topics.filter((t) => chap[t]);
  if (!present.length) { console.warn(`case ${cs.id}: none of its topics (${cs.topics.join(', ')}) is a built chapter - not rendered`); continue; }
  home[cs.id] = present[0];
  for (const t of present) casesByChapter[t].push(cs);
}
for (const k of Object.keys(casesByChapter)) casesByChapter[k].sort(cmpCases);
submitCases.sort(cmpCases);
const caseIds = new Set(Object.keys(home)); // ids that have a rendered anchor #q-<id>
const caseSource = Object.fromEntries([...caseById.values()].map((c) => [c.id, c.source]));

// ---------- part status ----------
// part.status (class | homework | missed) is computed by merge.py for council cases; other cases: the case tag
const stOf = (cs, p) => (p?.status && TAGS[p.status] ? p.status : tagOf(cs));
const caseStatuses = (cs, parts = cs.parts) => { const u = [...new Set(parts.map((p) => stOf(cs, p)))]; return u.length ? u : [tagOf(cs)]; };
const isMixed = (cs) => caseStatuses(cs).length > 1;
const primaryStatus = (cs, sts) => (sts.length === 1 ? sts[0] : sts.includes(tagOf(cs)) ? tagOf(cs) : sts[0]);

// ---------- rendering: cases ----------
const pts = (n) => (n || n === 0) && n !== '' ? `<span class="qpts">${esc(n)} נק׳</span>` : '';
const topicTitle = (t) => chap[t]?.title ?? t;
const topicLink = (t) => (chap[t] ? `<a class="qp-topic" href="#ch-${esc(t)}">${esc(chap[t].title)}</a>` : `<span class="qp-topic">${esc(t)}</span>`);

function caseCard(cs) {
  const o = [];
  const tag = tagOf(cs);
  const homeId = home[cs.id];
  const sts = caseStatuses(cs);
  const mixed = sts.length > 1;
  o.push(`<article class="qcase tag-${tag}" id="q-${esc(cs.id)}" data-tag="${sts.join(' ')}"${mixed ? ' data-mixed="1"' : ''}>`);
  o.push(`<header class="qc-head"><div class="qc-title"><h5>${inline(cs.title)}</h5><div class="qc-src">${esc(cs.source)}</div></div><div class="qc-badges"><span class="qbadge">${TAGS[tag]}${mixed ? ' · חלקי' : ''}</span>${cs.alsoMapped && TAGS[cs.alsoMapped] ? `<span class="qbadge also tag-${esc(cs.alsoMapped)}">גם: ${TAGS[cs.alsoMapped]}</span>` : ''}${pts(cs.points)}</div></header>`);
  if (cs.pointsNote) o.push(`<p class="qpn">${inline(cs.pointsNote)}</p>`);
  if (cs.reason) o.push(`<p class="qreason"><b>למה זה רלוונטי:</b> ${inline(cs.reason)}</p>`);
  if (cs.note) o.push(`<aside class="qnote" role="note"><span class="qlabel">הערה</span><div class="md">${block(cs.note)}</div></aside>`);
  if (cs.background) o.push(`<div class="qbg"><span class="qlabel">רקע</span><div class="md">${block(cs.background)}</div></div>`);
  for (const p of cs.parts) {
    const topics = [p.topic, p.alsoTopic].filter((t, i, a) => t && a.indexOf(t) === i);
    const showTopics = (cs.topics.length > 1 || homeId === 'submit') && topics.length;
    const st = stOf(cs, p);
    o.push(`<section class="qpart${mixed ? ` ps tag-${st}` : ''}"${mixed ? ` data-status="${st}"` : ''}><div class="qp-head"><span class="qp-label">${inline(p.label)}</span>${mixed ? `<span class="qbadge qp-status">${TAGS[st]}</span>` : ''}${pts(p.points)}${showTopics ? `<span class="qp-topics">${topics.map(topicLink).join('')}</span>` : ''}</div>`);
    if (p.reason && st === 'missed' && (mixed || !cs.reason)) o.push(`<p class="qreason tag-missed"><b>למה זה רלוונטי:</b> ${inline(p.reason)}</p>`);
    if (p.pointsNote) o.push(`<p class="qpn">${inline(p.pointsNote)}</p>`);
    o.push(`<div class="qq md">${block(p.question)}</div>`);
    const kps = (p.keyPoints ?? []).filter(Boolean);
    const sol = String(p.solution ?? '').trim();
    o.push(`<details class="sol"><summary>הצגת הפתרון הרשמי</summary><div class="sol-body">`
      + (sol ? `<div class="md">${block(sol)}</div>` : `<p class="sol-missing">הפתרון הרשמי לא הוזן.</p>`)
      + (kps.length ? `<div class="kp"><div class="kp-title">נקודות מפתח</div><ul class="tight">${kps.map((k) => `<li>${inline(k)}</li>`).join('')}</ul></div>` : '')
      + `</div></details></section>`);
  }
  o.push(`</article>`);
  return o.join('\n');
}

// which parts of a case belong to chapter c (part.topic / part.alsoTopic)
function relevantParts(cs, c) {
  return cs.parts.filter((p) => p.topic === c.id || p.alsoTopic === c.id);
}
function partsNote(cs, c) {
  const rel = relevantParts(cs, c);
  if (!rel.length) return '';
  const labels = rel.map((p) => String(p.label ?? '').trim());
  if (rel.length === cs.parts.length) return rel.length === 1 ? `${labels[0]} שייך לפרק זה` : 'כל סעיפי השאלה שייכים לפרק זה';
  const nums = labels.map((l) => (l.match(/^סעיף\s+(.+)$/) || [])[1]);
  if (nums.every(Boolean)) return nums.length === 1 ? `סעיף ${nums[0]} שייך לפרק זה` : `סעיפים ${nums.join(', ')} שייכים לפרק זה`;
  const reqs = labels.map((l) => (l.match(/^נדרש\s+(.+)$/) || [])[1]);
  if (reqs.every(Boolean)) return reqs.length === 1 ? `סעיף נדרש ${reqs[0]} שייך לפרק זה` : `סעיפי נדרש ${reqs.join(', ')} שייכים לפרק זה`;
  return `${labels.join(', ')} — שייכים לפרק זה`;
}

// statuses shown for case cs inside chapter c: full card = all parts; link card = the parts that belong to c
function chapterStatuses(cs, c) {
  if (home[cs.id] === c.id) return caseStatuses(cs);
  const rel = relevantParts(cs, c);
  return caseStatuses(cs, rel.length ? rel : cs.parts);
}

function caseLink(cs, c) {
  const sts = chapterStatuses(cs, c);
  const tag = primaryStatus(cs, sts);
  const h = chap[home[cs.id]];
  const pn = partsNote(cs, c);
  return `<a class="qlink tag-${tag}" href="#q-${esc(cs.id)}" data-tag="${sts.join(' ')}"><span class="qbadge">${TAGS[tag]}</span><b>${inline(cs.title)}</b><span class="qc-src">${esc(cs.source)}</span>${pn ? `<span class="qparts">${inline(pn)}</span>` : ''}<span class="go">מוצגת במלואה בפרק ${h.num} · ${esc(h.title)} ←</span></a>`;
}

function questionSection(c) {
  const list = casesByChapter[c.id];
  if (c.id === 'exam' || !list.length) return '';
  // group = primary status of the card in this chapter; a filter chip matches a card when ANY of its (shown) parts has that status
  const info = list.map((x) => { const sts = chapterStatuses(x, c); return { x, sts, primary: primaryStatus(x, sts) }; });
  const groups = GROUPS.map((g) => ({ ...g, items: info.filter((i) => i.primary === g.tag).map((i) => i.x) })).filter((g) => g.items.length);
  const chipTags = GROUPS.map((g) => ({ ...g, n: info.filter((i) => i.sts.includes(g.tag)).length })).filter((g) => g.n);
  const full = list.filter((x) => home[x.id] === c.id).length;
  const anyMixed = list.some((x) => home[x.id] === c.id && isMixed(x));
  const chips = [`<button type="button" data-f="all" aria-pressed="true">הכול (${list.length})</button>`]
    .concat(chipTags.map((g) => `<button type="button" data-f="${g.tag}" aria-pressed="false">${g.title} (${g.n})</button>`));
  return `<div class="qs" id="qs-${c.id}">
  <div class="qs-head"><h3>שאלות מבחינות</h3><span class="qs-count">${list.length} שאלות</span></div>
  <p class="qs-note">שאלות מבחינות המועצה והמכללה שנוגעות בפרק זה, עם הפתרון הרשמי. נסו לענות לפני שפותחים את הפתרון.${list.length > full ? ' שאלה שמוצגת במלואה בפרק אחר מופיעה כקישור, עם ציון הסעיפים השייכים לפרק זה.' : ''}${anyMixed ? ' שאלה שסעיפיה אינם כולם מאותו סוג מסומנת ״חלקי״, ולכל סעיף בה יש תג משלו.' : ''}</p>
  <div class="qs-tools"><div class="qfilter" role="group" aria-label="סינון לפי סוג">${chips.join('')}</div><button type="button" class="qtoggle">פתח את כל הפתרונות</button></div>
  <div class="qs-groups">
${groups.map((g) => `  <div class="qgroup"><h4 class="qgroup-title">${g.title}<span class="n">${g.items.length}</span></h4><div class="qs-list">
${g.items.map((x) => (home[x.id] === c.id ? caseCard(x) : caseLink(x, c))).join('\n')}
  </div></div>`).join('\n')}
  </div>
  <p class="qs-empty">אין שאלות מסוג זה בפרק.</p>
</div>`;
}

// ---------- rendering: submission questions ----------
function submitSection() {
  if (!submitCases.length) return '';
  return `
<section class="chapter container" id="submit" style="--accent:#0E9F6E;--accent-soft:#E6F7F0">
  <div class="ch-head">
    <span class="eyebrow">הגשה</span>
    <h2>שאלות מועצה להגשה</h2>
    <p class="lead">${esc(SUBMIT_INTRO)}</p>
  </div>
  <div class="qs" id="qs-submit">
    <div class="qs-tools"><span class="qs-count">${submitCases.length} שאלות</span><button type="button" class="qtoggle">פתח את כל הפתרונות</button></div>
    <div class="qs-groups"><div class="qgroup"><div class="qs-list">
${submitCases.map(caseCard).join('\n')}
    </div></div></div>
  </div>
</section>`;
}

// ---------- rendering: articles ----------
function article(a, c) {
  const out = [];
  out.push(`<article class="standard" id="${esc(a.id)}">`);
  out.push(`<div class="standard-header"><span class="standard-code">${esc(a.code)}</span><h3>${inline(a.title)}</h3></div>`);
  if (a.purpose) out.push(`<div class="purpose"><strong>במה מדובר:</strong> ${inline(a.purpose)}</div>`);
  if (a.summary?.length) {
    out.push(`<div class="section-label">הסבר</div>`);
    a.summary.forEach((p) => out.push(`<div class="summary">${block(p)}</div>`));
  }
  const cols = [];
  if (a.concepts?.length) cols.push(['מושגים מרכזיים', a.concepts]);
  if (a.duties?.length) cols.push(['תפקיד המבקר ודגשי ביקורת', a.duties]);
  if (cols.length) {
    out.push(`<div class="${cols.length === 2 ? 'two-col' : 'one-col'}">`);
    cols.forEach(([t, items]) => out.push(`<div class="col-block"><div class="section-label">${t}</div><ul class="tight">${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>`));
    out.push(`</div>`);
  }
  (a.lists ?? []).forEach((l) => {
    const tag = l.ordered ? 'ol' : 'ul';
    out.push(`<div class="section-label">${inline(l.title)}</div><${tag} class="${l.ordered ? 'numbered' : 'tight'}">${l.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
  });
  (a.tables ?? []).forEach((t) => {
    out.push(`<div class="section-label">${inline(t.title)}</div><div class="tbl-wrap"><table class="gtable"><thead><tr>${t.headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((x, i) => `<td data-label="${esc(String(t.headers[i] ?? '').replace(/[*_`]/g, ''))}">${i === 0 ? `<b>${inline(x)}</b>` : inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  });
  if (a.quotes?.length) {
    out.push(`<div class="section-label">ציטוטים מהמקור</div>`);
    a.quotes.forEach((q) => out.push(`<blockquote class="citation"><p>${inline(q.text)}</p><cite>${esc(q.cite)}</cite></blockquote>`));
  }
  if (a.examTip) out.push(`<div class="notes-block"><strong>🎯 דגש לבחינה</strong>${block(a.examTip)}</div>`);
  const links = [];
  for (const cid of a.caseIds ?? []) {
    if (caseIds.has(cid)) links.push(`<a href="#q-${esc(cid)}">${esc(caseSource[cid] ?? cid)}</a>`);
    else console.warn(`article ${a.id}: caseId "${cid}" not found among rendered cases - omitted`);
  }
  if (!links.length) (a.exam ?? []).forEach((l) => links.push(`<span>${esc(l)}</span>`));
  if (links.length || a.sources?.length) {
    out.push(`<div class="art-foot">`);
    if (links.length) out.push(`<div class="exam-refs"><span class="ef-label">הופיע בבחינות:</span>${links.join('')}</div>`);
    if (a.sources?.length) out.push(`<div class="art-actions"><span class="srcs">מקורות: ${a.sources.map(esc).join(' · ')}</span></div>`);
    out.push(`</div>`);
  }
  out.push(`</article>`);
  return out.join('\n');
}

// ---------- rendering: mapping ----------
let mapping = null;
{
  const p = path.join(CONTENT, 'mapping.json');
  if (fs.existsSync(p)) { const d = readJson(p, 'mapping.json'); if (Array.isArray(d) && d.length) mapping = d; }
}
const candId = (v) => (v && typeof v === 'object' ? v.caseId : typeof v === 'string' ? v : null);
// one target per printed reference: resolved.caseId, else candidateIfLecturerIsRight; plus additionalRefs
function mapTargets(m) {
  const t = [];
  const main = m.resolved?.caseId;
  t.push(main ? { id: main, cand: false } : { id: candId(m.candidateIfLecturerIsRight) ?? null, cand: true });
  for (const a of m.additionalRefs ?? []) {
    const id = a?.resolved?.caseId ?? candId(a?.candidateIfLecturerIsRight) ?? null;
    t.push({ id, cand: !a?.resolved?.caseId });
  }
  return t;
}
function mappingChips(m, stat) {
  const targets = mapTargets(m);
  const printed = String(m.refAsPrinted ?? '');
  const pieces = printed.split(/\s*\+\s*/).filter(Boolean);
  const labels = pieces.length === targets.length
    ? pieces.map((pc, i) => (i > 0 && m.sessionLabelAsPrinted && !pc.includes(m.sessionLabelAsPrinted) ? `${m.sessionLabelAsPrinted}, ${pc}` : pc))
    : [printed];
  const chip = (t, label) => {
    const ok = t.id && caseIds.has(t.id);
    if (ok) stat.linked++;
    const cls = `mchip${m.highlighted ? ' hl' : ''}${ok ? '' : ' nolink'}${t.cand && ok ? ' cand' : ''}`;
    const body = ok ? `<a class="${cls}" href="#q-${esc(t.id)}" title="${esc(caseSource[t.id] ?? '')}">${esc(label)}</a>` : `<span class="${cls}">${esc(label)}</span>`;
    return t.cand ? `<span class="mgrp">${body}<span class="mchip-note">ראו הערה בשאלה</span></span>` : body;
  };
  if (labels.length === targets.length) return targets.map((t, i) => chip(t, labels[i])).join(' ');
  // printed text does not split into one piece per target: single chip, extra targets as numbered links
  return chip(targets[0], printed) + targets.slice(1).map((t, i) => (t.id && caseIds.has(t.id) ? ` <a class="mchip xtra${m.highlighted ? ' hl' : ''}" href="#q-${esc(t.id)}" title="${esc(caseSource[t.id] ?? '')}">${i + 2}</a>` : '')).join('');
}
function missedSection() {
  // a case is listed under every topic that carries one of its missed parts: wholly-missed cases and class/homework cases with missed parts
  const byTopic = new Map();
  let whole = 0, partial = 0;
  for (const cs of [...caseById.values()].sort(cmpCases)) {
    if (!caseIds.has(cs.id) || cs.tag === 'submit' || cs.tag === 'college') continue;
    const mp = cs.parts.filter((p) => stOf(cs, p) === 'missed');
    if (!mp.length) continue;
    const wholly = mp.length === cs.parts.length;
    if (wholly) whole++; else partial++;
    const perTopic = new Map();
    for (const p of mp) {
      const ts = [p.topic, p.alsoTopic].filter((t, k, a) => t && a.indexOf(t) === k);
      for (const t of (ts.length ? ts : [cs.topics.find((x) => chap[x]) ?? cs.topics[0]])) { if (!perTopic.has(t)) perTopic.set(t, []); perTopic.get(t).push(String(p.label ?? '').trim()); }
    }
    for (const [t, labels] of perTopic) { if (!byTopic.has(t)) byTopic.set(t, []); byTopic.get(t).push({ cs, labels, wholly }); }
  }
  if (!byTopic.size) return '';
  const order = [...chapters.map((c) => c.id), ...[...byTopic.keys()].filter((k) => !chap[k])];
  const chip = ({ cs, labels, wholly }) => `<a class="mchip${wholly ? '' : ' partial'}" href="#q-${esc(cs.id)}" title="${esc(cs.title)}">${esc(cs.source)}${wholly ? '' : ` · <span class="mpart">${inline(labels.join(', '))}</span>`}</a>`;
  const rows = order.filter((t) => byTopic.has(t)).map((t) => `<tr><td data-label="נושא"><b>${esc(topicTitle(t))}</b>${chap[t] && hasQs(chap[t]) ? `<a class="map-sub" href="#qs-${esc(t)}">לשאלות הפרק</a>` : ''}</td><td class="chips" data-label="שאלות">${byTopic.get(t).map(chip).join(' ')}</td></tr>`).join('');
  return `
  <div class="standard map-card" id="mapping-missed">
    <div class="section-label">לא במיפוי</div>
    <p class="map-stats">${whole + partial} שאלות מועצה שרלוונטיות לקורס ואינן מופיעות במיפוי של המרצה, לפי נושא: ${whole} שאלות שלמות${partial ? ` ועוד ${partial} שאלות שחלק מסעיפיהן במיפוי (לצד כל אחת מהן מצוינים הסעיפים שאינם במיפוי)` : ''}. שאלה שנוגעת בכמה נושאים מופיעה בכל אחד מהם.</p>
    <div class="tbl-wrap"><table class="gtable"><thead><tr><th>נושא</th><th>שאלות מועצה</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
function mappingSection() {
  if (!mapping) return '';
  const groups = new Map();
  for (const m of mapping) {
    const k = String(m.row ?? '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const stat = { linked: 0 };
  const hl = mapping.filter((m) => m.highlighted).length;
  const rows = [...groups.entries()].map(([row, items]) => {
    const topic = items.find((x) => x.topic)?.topic;
    const sub = topic && chap[topic] ? `<a class="map-sub" href="#ch-${esc(topic)}">פרק ${chap[topic].num} · ${esc(chap[topic].title)}</a>` : '';
    const chips = items.map((m) => mappingChips(m, stat)).join(' ');
    return `<tr><td data-label="נושא"><b>${esc(row)}</b>${sub}</td><td class="chips" data-label="שאלות">${chips}</td></tr>`;
  }).join('');
  return `
<section class="chapter container" id="mapping" style="--accent:#171E33;--accent-soft:#E7E9F1">
  <div class="ch-head">
    <span class="eyebrow">מיפוי</span>
    <h2>מיפוי שאלות המועצה</h2>
    <p class="lead">מיפוי השאלות מבחינות המועצה לפי נושאי הקורס, כפי שהוכן על ידי המרצה. לחיצה על שאלה מובילה אל נוסח השאלה והפתרון הרשמי.</p>
    <div class="map-legend">
      <span><span class="mchip hl">ורוד</span> נפתר בכיתה</span>
      <span><span class="mchip">ללא סימון</span> שיעורי בית</span>
      <span><span class="mchip-note">ראו הערה בשאלה</span> התאמת השאלה לנושא אינה ודאית; ההערה בכרטיס השאלה</span>
    </div>
  </div>
  <div class="standard map-card">
    <div class="map-stats">${mapping.length} פריטים במיפוי · ${hl} נפתרו בכיתה · ${stat.linked} קישורים לשאלות במדריך</div>
    <div class="tbl-wrap"><table class="gtable"><thead><tr><th>נושא</th><th>שאלות מועצה</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>${missedSection()}
</section>`;
}

// ---------- navigation / hero / sections ----------
const hasQs = (c) => c.id !== 'exam' && casesByChapter[c.id].length > 0;
const navHtml = NAV.map((g) => {
  const cs = g.chapters.map((id) => chap[id]).filter(Boolean);
  if (!cs.length) return '';
  const first = cs[0];
  const dd = cs.map((c) => `<div class="dd-head">פרק ${c.num} · ${esc(c.title)}</div>` + c.articles.map((a) => `<a href="#${esc(a.id)}"><span class="dd-code">${esc(a.code)}</span>${inline(a.title)}</a>`).join('') + (hasQs(c) ? `<a href="#qs-${c.id}"><span class="dd-code">שאל׳</span>שאלות מבחינות</a>` : '')).join('');
  return `<div class="nav-item"><a href="#ch-${first.id}" data-ch="${cs.map((c) => 'ch-' + c.id).join(' ')}" style="--accent:${first.accent}">${esc(g.label)}</a><div class="dropdown">${dd}</div></div>`;
}).join('\n');
// one extra pill with a dropdown: submission questions + mapping (keeps the bar at 8 pills)
const councilLinks = [
  submitCases.length ? { id: 'submit', title: 'שאלות מועצה להגשה', code: 'הגשה' } : null,
  mapping ? { id: 'mapping', title: 'מיפוי שאלות המועצה', code: 'מיפוי' } : null,
].filter(Boolean);
const councilNav = councilLinks.length
  ? `<div class="nav-item"><a href="#${councilLinks[0].id}" data-ch="${councilLinks.map((l) => l.id).join(' ')}">שאלות מועצה</a><div class="dropdown">${councilLinks.map((l) => `<a href="#${l.id}"><span class="dd-code">${l.code}</span>${l.title}</a>`).join('')}</div></div>`
  : '';
// chapters not placed in any NAV group would be unreachable from the navbar -> warn
chapters.forEach((c) => { if (!NAV.some((g) => g.chapters.includes(c.id))) console.warn('chapter not in NAV:', c.id); });

const bento = chapters.map((c, i) => `<a class="b-card ${i % 5 === 3 || i % 5 === 4 ? 'b-wide' : 'b-item'} rv" href="#ch-${c.id}" style="--accent:${c.accent};--accent-soft:${c.soft}"><span class="b-code">פרק ${c.num}</span><h3>${esc(c.title)}</h3><p>${inline(c.lead?.split(/(?<=\.)\s/)[0] ?? '')}</p></a>`).join('\n');

const collegeStrip = (() => {
  const rows = exams.map((e) => {
    const links = (e.caseIds ?? []).filter((id) => caseIds.has(id)).map((id) => {
      const n = (id.match(/-q(\d+)$/) || [])[1];
      return `<a href="#q-${esc(id)}" title="${esc(caseById.get(id)?.title ?? '')}">שאלה ${n ?? ''}<small>${inline(caseById.get(id)?.title ?? '')}</small></a>`;
    });
    if (!links.length) return '';
    const mo = String(e.title ?? '').match(/מועד\s+[א-ת]['׳]?/);
    const label = `${mo ? mo[0] : e.id}${e.date ? ' · ' + fmtDate(e.date) : ''}`;
    return `<div class="cs-exam"><b>${esc(label)}</b><div class="cs-links">${links.join('')}</div></div>`;
  }).filter(Boolean);
  return rows.length ? `<div class="college-strip" id="college-exams"><span class="cs-title">בחינות המכללה</span><div class="cs-rows">${rows.join('')}</div></div>` : '';
})();

const countLine = (c) => {
  const na = c.articles.length;
  const arts = na === 1 ? 'מאמר אחד' : `${na} מאמרים`;
  if (!hasQs(c)) return `<p class="ch-count">${arts}</p>`;
  const nq = casesByChapter[c.id].length;
  return `<p class="ch-count"><a href="#qs-${c.id}">${arts} · ${nq === 1 ? 'שאלה אחת מבחינות' : `${nq} שאלות מבחינות`}</a></p>`;
};

const sections = chapters.map((c) => `
<section class="chapter container" id="ch-${c.id}" style="--accent:${c.accent};--accent-soft:${c.soft}">
  <div class="ch-head">
    <span class="eyebrow">פרק ${c.num}${c.eyebrow ? ' · ' + esc(c.eyebrow) : ''}</span>
    <h2>${esc(c.title)}</h2>
    <p class="lead">${inline(c.lead)}</p>
    ${countLine(c)}
    <div class="toc">${c.articles.map((a) => `<a href="#${esc(a.id)}">${inline(a.title)}</a>`).join('')}${hasQs(c) ? `<a href="#qs-${c.id}">שאלות מבחינות</a>` : ''}</div>
  </div>
  ${c.articles.map((a) => article(a, c)).join('\n')}
  ${questionSection(c)}
</section>`).join('\n') + submitSection();

// ---------- search index ----------
const index = chapters.flatMap((c) => c.articles.map((a) => ({
  id: a.id, t: plain(a.title), c: c.title, k: plain([a.title, a.code, a.purpose, ...(a.concepts ?? []), ...(a.summary ?? [])].join(' ')),
})));
const nArticles = index.length;
for (const cs of caseById.values()) {
  if (!caseIds.has(cs.id)) continue;
  index.push({
    id: 'q-' + cs.id, q: 1, t: plain(cs.title), c: cs.source ?? '',
    k: plain([...(cs.topics ?? []).map((t) => chap[t]?.title ?? t), cs.source, plain(cs.reason), ...cs.parts.map((p) => plain(p.reason)), plain(cs.background).slice(0, 160), ...cs.parts.map((p) => `${p.label ?? ''} ${plain(p.question).slice(0, 200)}`)].join(' ')),
  });
}
const nCases = caseIds.size;

// ---------- assemble ----------
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const refCss = read('ref_style.css');
const extraCss = read('extra.css') + read('mobile.css') + read('mdtable.css') + read('cases.css');
const mobileJs = read('mobile.js');
const sheet = chapters.map((c) => `<details data-ch="ch-${c.id}"><summary><span class="n" style="background:${c.accent}">${c.num}</span>${esc(c.title)}<span class="chev">⌄</span></summary><div class="arts"><a href="#ch-${c.id}"><b>פתיחת הפרק</b></a>${c.articles.map((a) => `<a href="#${esc(a.id)}">${inline(a.title)}</a>`).join('')}${hasQs(c) ? `<a href="#qs-${c.id}"><b>שאלות מבחינות</b></a>` : ''}</div></details>`).join('')
  + councilLinks.map((l) => `<a class="sheet-link" href="#${l.id}">${l.title}</a>`).join('');
const script = read('guide.js');
const heroMeta = [
  `<span>ד״ר אלון כהן · אונו (קוד 6210)</span>`,
  `<span>תקני ביקורת 1 · 220 · 240 · 250 · 540 · 545 · 610 · 920</span>`,
  `<span>בחינות מועצה 2015–2025</span>`,
  nCases ? `<span>${nCases} שאלות עם פתרון רשמי</span>` : '',
  `<span>מותאם למובייל</span>`,
].filter(Boolean).join('\n    ');

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#F6F7FC">
<title>${esc(SITE_TITLE)}</title>
<meta name="description" content="מדריך לימוד לקורס ביקורת מתקדמת ב' (ד״ר אלון כהן, אונו) — תקנים וחוקים, הסברים, ציטוטים עם מספרי סעיפים, שאלות מבחינות המועצה והמכללה עם פתרונות רשמיים.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%236366F1'/%3E%3Cpath d='M18 18h20l8 8v20H18z' fill='none' stroke='%23fff' stroke-width='4'/%3E%3Cpath d='M24 34h16M24 41h10' stroke='%23fff' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&family=Assistant:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
${refCss}
${extraCss}
</style>
</head>
<body>
<div class="mesh" aria-hidden="true"></div>
<div class="nav-wrap">
  <nav class="pill" aria-label="ניווט ראשי">
    <a class="brand" href="#top"><span class="dot"></span>ביקורת מתקדמת ב'</a>
    <button class="hamburger" id="hamburger" aria-label="פתיחת תפריט" aria-expanded="false">☰</button>
    <div class="nav-links" id="navLinks">
      <div class="nav-item"><a href="#top">מבוא</a></div>
      ${navHtml}
      ${councilNav}
    </div>
  </nav>
</div>

<header class="hero container" id="top">
  <span class="eyebrow" style="--accent:#6366F1">מדריך לימוד · ${chapters.length} פרקים · ${nArticles} נושאים${nCases ? ` · ${nCases} שאלות מבחינות` : ''}</span>
  <h1>ביקורת מתקדמת ב'</h1>
  <p class="sub">מדריך לימוד לקורס של ד״ר אלון כהן (אונו) — הסברים מובנים לפי תקנים וחוקים, מושגי מפתח, תפקיד רואה החשבון המבקר, ציטוטים עם מספרי סעיפים, ושאלות מבחינות המועצה והמכללה עם הפתרון הרשמי.</p>
  <p class="hero-note">${esc(HERO_NOTE)}</p>
  <div class="meta">
    ${heroMeta}
  </div>
  <div class="search-box">
    <input id="q" type="search" placeholder="🔎 חיפוש נושא, מושג או שאלה במדריך…" aria-label="חיפוש במדריך" autocomplete="off">
    <div id="results" class="results" hidden></div>
  </div>
  ${collegeStrip}
  <div class="bento">
${bento}
  </div>
</header>
${sections}
${mappingSection()}
<footer class="foot">
  <span class="mark">ביקורת מתקדמת ב' · מדריך לימוד</span>
  ${esc(FOOTER_TEXT)}
  <span class="built">נבנה לאחרונה: ${esc(BUILD_DATE)}</span>
</footer>
<button class="b2t" id="b2t" aria-label="חזרה למעלה">↑</button>
<div class="progress" aria-hidden="true"><i></i></div>
<nav class="mbar" aria-label="ניווט מהיר">
  <button data-sheet><span class="ic">📚</span>פרקים</button>
  <button data-search><span class="ic">🔎</span>חיפוש</button>
  <button data-qs><span class="ic">❓</span>שאלות</button>
  <button data-top><span class="ic">↑</span>למעלה</button>
</nav>
<div class="mscrim"></div>
<div class="msheet" role="dialog" aria-label="פרקי המדריך"><div class="grab"></div><h4>פרקי המדריך</h4>${sheet}</div>
<script>window.__INDEX__=${JSON.stringify(index).replace(/</g, '\\u003c')};</script>
<script>
${script}
${mobileJs}
${read('mdtable.js')}
enhanceTables(document);
</script>
</body>
</html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`built: ${chapters.length} chapters, ${nArticles} articles, ${nCases} cases${mapping ? `, mapping ${mapping.length} refs` : ''}, ${(html.length / 1024).toFixed(0)} KB -> ${path.join(OUT, 'index.html')}`);
