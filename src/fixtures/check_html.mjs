// Structural check of a built index.html. Usage: node fixtures/check_html.mjs <path>
import fs from 'node:fs';
const f = process.argv[2] || 'dist/index.html';
const h = fs.readFileSync(f, 'utf8');
const body = h.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const idset = new Set(ids);
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
const dup = ids.filter((x, i) => ids.indexOf(x) !== i); if (dup.length) fail('duplicate ids: ' + [...new Set(dup)]);
const hrefs = [...body.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
const missing = [...new Set(hrefs.filter((x) => !idset.has(x)))]; if (missing.length) fail('hrefs to missing ids: ' + missing);
console.log('ids', ids.length, 'internal links', hrefs.length);
const cards = [...body.matchAll(/<article class="qcase[^"]*" id="(q-[^"]+)"/g)].map((m) => m[1]);
console.log('full case cards', cards.length, cards);
const sols = (body.match(/<details class="sol">/g) || []).length;
const parts = (body.match(/<section class="qpart[ "]/g) || []).length;
console.log('parts', parts, 'details.sol', sols); if (parts !== sols) fail('parts != details');
const qs = [...body.matchAll(/id="(qs-[^"]+)"/g)].map((m) => m[1]); console.log('question sections', qs);
const links = (body.match(/class="qlink /g) || []).length; console.log('compact link cards', links);
console.log('article chips', (body.match(/class="exam-refs"/g) || []).length);
console.log('mapping', idset.has('mapping'), 'chips linked', (body.match(/class="mchip[^"]*" href="#q-/g) || []).length, 'plain', (body.match(/<span class="mchip[^"]*nolink/g) || []).length);
if (/PRACTICE|tech_audit_practice|תרגול בנושא|target="_blank"/.test(h)) fail('practice remnants');
if (/<script>alert/.test(body)) console.log('NOTE raw <script> in markdown passes through (content has no HTML per spec)');
const idx = JSON.parse(h.match(/window\.__INDEX__=(.*?);<\/script>/s)[1]);
console.log('index', idx.length, 'case entries', idx.filter((x) => x.q).length);
for (const x of idx) if (!idset.has(x.id)) fail('index id missing: ' + x.id);
// ---- new structure checks (only when the relevant data is present) ----
const pos = (id) => body.indexOf(`id="${id}"`);
const chapIds = [...body.matchAll(/<section class="chapter container" id="([^"]+)"/g)].map((m) => m[1]);
console.log('chapter sections', chapIds.join(' '));
if (idset.has('submit')) {
  const lastCh = chapIds.filter((x) => x.startsWith('ch-')).pop();
  if (!(pos(lastCh) < pos('submit'))) fail('submit must come after the last chapter');
  if (idset.has('mapping') && !(pos('submit') < pos('mapping'))) fail('submit must come before mapping');
  const subSec = body.split('id="submit"')[1].split(/<section class="chapter container"/)[0];
  const subCards = [...subSec.matchAll(/<article class="qcase tag-submit" id="(q-[^"]+)"/g)].map((m) => m[1]);
  console.log('submit cards', subCards.length);
  if (!subSec.includes('שש שאלות המועצה שהמרצה נתן להגשה. רובן עוסקות בנושאי ביקורת כלליים שאינם חלק מתשעת נושאי הקורס.')) fail('submit intro text missing');
  const outside = body.replace(subSec, '');
  if (/<article class="qcase tag-submit"/.test(outside)) fail('submit card rendered outside #submit');
  if (/<a class="qlink tag-submit"/.test(body)) fail('submit link card inside a chapter');
  if (!/href="#submit"/.test(body)) fail('no nav link to #submit');
  if (!/class="sheet-link" href="#submit"/.test(body)) fail('no mobile sheet link to #submit');
}
// question-bank groups: order + no group heading without items + chips with counts
const GROUP_ORDER = ['בחינות המכללה', 'מועצה — נפתר בכיתה', 'מועצה — שיעורי בית', 'מועצה — לא במיפוי'];
for (const sec of body.split('<div class="qs" id="qs-').slice(1)) {
  const id = sec.slice(0, sec.indexOf('"'));
  if (id === 'submit') continue;
  const heads = [...sec.matchAll(/<h4 class="qgroup-title">([^<]+)</g)].map((m) => m[1]);
  const idxs = heads.map((h) => GROUP_ORDER.indexOf(h));
  if (idxs.includes(-1) || idxs.some((v, i) => i && v <= idxs[i - 1])) fail(`qs-${id}: group headings out of order: ${heads}`);
  const chips = [...sec.matchAll(/<button type="button" data-f="([^"]+)"[^>]*>([^<]*)</g)].map((m) => m[2]);
  if (!chips.every((c) => /\(\d+\)$/.test(c))) fail(`qs-${id}: filter chips without counts: ${chips}`);
  console.log(`qs-${id}`, heads.length, 'groups;', chips.join(' | '));
}
if (/id="ch-exam"/.test(body) && body.split('id="ch-exam"')[1].split('<section class="chapter')[0].includes('class="qs"')) fail('exam chapter has a question bank');
// partial-topic link cards
const linkCards = [...body.matchAll(/<a class="qlink [^>]*>.*?<\/a>/gs)].map((m) => m[0]);
console.log('link cards naming parts', linkCards.filter((x) => /class="qparts"/.test(x)).length, 'of', linkCards.length);
// notes / reason / mapping
console.log('notes', (body.match(/<aside class="qnote"/g) || []).length, 'reasons', (body.match(/class="qreason"/g) || []).length, 'pointsNotes', (body.match(/class="qpn"/g) || []).length);
const mapSec = body.split('id="mapping"')[1]?.split('</section>')[0] || '';
if (mapSec) {
  const chips = [...mapSec.matchAll(/class="mchip[^"]*"/g)].length;
  console.log('mapping chips (incl. legend)', chips, 'markers', (mapSec.match(/class="mchip-note"/g) || []).length, 'missed subsection', /id="mapping-missed"/.test(mapSec));
  if (!/ורוד/.test(mapSec) || !/שיעורי בית/.test(mapSec)) fail('mapping legend');
}
const strip = body.split('id="college-exams"')[1]?.split('class="bento"')[0] || '';
if (strip) {
  const sl = [...strip.matchAll(/href="#(q-college-[^"]+)"/g)].map((m) => m[1]);
  console.log('college strip links', sl.length, 'exams', (strip.match(/class="cs-exam"/g) || []).length);
  for (const x of sl) if (!idset.has(x)) fail('strip link target missing ' + x);
}
// footer + leftovers
if (!body.includes('נבנה מתוך חומרי הקורס: חוברת הקורס,') || !body.includes('במקרה של סתירה — נוסח התקן והחוק קובע.')) fail('footer text');
if (!/נבנה לאחרונה: \d{1,2}\.\d{1,2}\.\d{4}/.test(body)) fail('build date missing');
if (/itaudit|tech_audit|practice-link|<a [^>]*href="https?:/i.test(body)) fail('old-project leftovers or external links: ' + (body.match(/itaudit|tech_audit|practice-link|<a [^>]*href="https?:[^"]*/i) || [])[0]);
const navPills = (body.match(/<div class="nav-item">/g) || []).length; console.log('nav pills', navPills); if (navPills > 8) fail('more than 8 nav pills');
// order of cards within fraud chapter
const fraudSec = body.split('id="qs-fraud"')[1]?.split('id="ch-')[0] || '';
console.log('fraud order', [...fraudSec.matchAll(/(?:id="|href=")(q-[^"]+)"/g)].map((m) => m[1]));
// ---- part status badges / missed groups / governance bank / count lines ----
const cardsHtml = [...body.matchAll(/<article class="qcase [^>]*>[\s\S]*?<\/article>/g)].map((m) => m[0]);
const cardId = (c) => (c.match(/id="(q-[^"]+)"/) || [])[1];
const mixedCards = cardsHtml.filter((c) => /data-mixed="1"/.test(c));
console.log('mixed-status cards', mixedCards.length, mixedCards.map(cardId).join(' '));
for (const c of cardsHtml) {
  const id = cardId(c), mixed = /data-mixed="1"/.test(c);
  const nParts = (c.match(/<section class="qpart/g) || []).length;
  const nBadges = (c.match(/class="qbadge qp-status"/g) || []).length;
  if (mixed) {
    if (nBadges !== nParts) fail(`${id}: mixed card has ${nBadges} part badges for ${nParts} parts`);
    if (!/<span class="qbadge">[^<]*· חלקי<\/span>/.test(c)) fail(`${id}: mixed card header badge lacks "· חלקי"`);
    const sts = [...c.matchAll(/<section class="qpart ps tag-(\w+)"/g)].map((m) => m[1]);
    if (new Set(sts).size < 2) fail(`${id}: flagged mixed but part statuses are ${sts}`);
    const missedParts = (c.match(/<section class="qpart ps tag-missed"/g) || []).length;
    const reasons = (c.match(/<p class="qreason tag-missed"><b>למה זה רלוונטי:<\/b>/g) || []).length;
    if (missedParts !== reasons) fail(`${id}: ${missedParts} missed parts but ${reasons} reason lines`);
    const dt = (c.match(/data-tag="([^"]+)"/) || [])[1].split(' ');
    for (const s of new Set(sts)) if (!dt.includes(s)) fail(`${id}: data-tag ${dt} lacks status ${s}`);
  } else {
    if (nBadges) fail(`${id}: non-mixed card carries part badges`);
    if (/data-tag="[^"]* [^"]*"/.test(c.slice(0, 300))) fail(`${id}: non-mixed card has several statuses in data-tag`);
  }
}
for (const id of ['q-council-2020-autumn-q4', 'q-council-2019-spring-q4', 'q-council-2021-spring-q4']) {
  const c = cardsHtml.find((x) => cardId(x) === id);
  if (!c) { fail('expected mixed card missing: ' + id); continue; }
  if (!/data-mixed="1"/.test(c)) fail(id + ' not rendered as mixed');
}
{ // 2021-spring-q4: part 3 class, parts 6 and 10 missed
  const c = cardsHtml.find((x) => cardId(x) === 'q-council-2021-spring-q4') || '';
  const st = [...c.matchAll(/<section class="qpart ps tag-(\w+)"[^>]*><div class="qp-head"><span class="qp-label">([^<]*)</g)].map((m) => `${m[2]}=${m[1]}`);
  console.log('council-2021-spring-q4 parts', st.join(' | '));
  if (st.join('|') !== 'סעיף 3=class|סעיף 6=missed|סעיף 10=missed') fail('council-2021-spring-q4 part statuses: ' + st);
}
// missed groups: every chapter with a "לא במיפוי" group -> cards/links carry the status; chips counted correctly
for (const sec of body.split('<div class="qs" id="qs-').slice(1)) {
  const id = sec.slice(0, sec.indexOf('"'));
  if (id === 'submit') continue;
  const block = sec.split(/<section class="chapter container"/)[0];
  const items = [...block.matchAll(/<(?:article class="qcase|a class="qlink)[^>]*data-tag="([^"]+)"/g)].map((m) => m[1].split(' '));
  const chips = [...block.matchAll(/<button type="button" data-f="([^"]+)"[^>]*>[^<]*\((\d+)\)</g)];
  for (const [, f, n] of chips) {
    const want = f === 'all' ? items.length : items.filter((t) => t.includes(f)).length;
    if (want !== Number(n)) fail(`qs-${id}: chip ${f} says ${n}, cards matching = ${want}`);
  }
  const grp = [...block.matchAll(/<h4 class="qgroup-title">[^<]+<span class="n">(\d+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  if (grp !== items.length) fail(`qs-${id}: group counts sum ${grp} != ${items.length} items`);
}
{
  const gov = body.split('<div class="qs" id="qs-governance"')[1]?.split(/<section class="chapter container"/)[0] || '';
  const missedGrp = gov.split('<h4 class="qgroup-title">מועצה — לא במיפוי')[1]?.split('<h4 class="qgroup-title">')[0] || '';
  const nMissed = (missedGrp.match(/<article class="qcase tag-missed"/g) || []).length;
  const reasons = (missedGrp.match(/class="qreason"/g) || []).length;
  console.log('governance bank: missed-group cards', nMissed, 'with case-level reason lines', reasons, '| chips:', [...gov.matchAll(/data-f="([^"]+)"[^>]*>([^<]*)</g)].map((m) => m[2]).join(' | '));
  if (!gov) fail('no governance question bank');
  else if (nMissed < 5) fail('governance bank shows fewer than 5 missed cases');
  if (nMissed && reasons < nMissed) fail('governance missed cases without reason line');
  if (!/data-f="missed"/.test(gov)) fail('governance bank lacks a "missed" filter chip');
}
{
  const mm = body.split('id="mapping-missed"')[1]?.split('</section>')[0] || '';
  if (!mm) fail('mapping page lacks the "לא במיפוי" sub-section');
  else {
    const linked = [...new Set([...mm.matchAll(/href="#(q-[^"]+)"/g)].map((m) => m[1]))];
    const rowsN = (mm.match(/<tr><td data-label="נושא">/g) || []).length;
    console.log('mapping "לא במיפוי": topics', rowsN, 'distinct cases', linked.length, 'partial chips', (mm.match(/class="mchip partial"/g) || []).length);
    for (const id of linked) if (!cardsHtml.some((c) => cardId(c) === id)) fail('missed-list link without a full card: ' + id);
    for (const id of mixedCards.map(cardId)) {
      const c = mixedCards.find((x) => cardId(x) === id);
      if (/<section class="qpart ps tag-missed"/.test(c) && !linked.includes(id)) fail('mixed card with missed parts not listed under "לא במיפוי": ' + id);
    }
    for (const id of cardsHtml.filter((c) => /class="qcase tag-missed"/.test(c)).map(cardId)) if (!linked.includes(id)) fail('missed card not listed on mapping page: ' + id);
  }
}
for (const c of chapIds.filter((x) => x.startsWith('ch-'))) {
  const sec = body.split(`id="${c}"`)[1].split(/<section class="chapter container"/)[0];
  const cc = sec.match(/<p class="ch-count">(.*?)<\/p>/);
  const hasBank = sec.includes('<div class="qs" id="qs-');
  if (!cc) { fail(`${c}: no count line`); continue; }
  if (hasBank && !new RegExp(`href="#qs-${c.slice(3)}"`).test(cc[1])) fail(`${c}: count line does not link to its question bank`);
  if (!/(\d+ מאמרים|מאמר אחד)/.test(cc[1])) fail(`${c}: count line text: ${cc[1]}`);
}
console.log('count lines', (body.match(/class="ch-count"/g) || []).length);
if (!/class="hero-note"/.test(body) || !body.includes('נוספו בסריקה של כל 23 מועדי המועצה')) fail('hero explainer missing');
console.log(bad ? `${bad} FAILURES` : 'ALL OK'); process.exit(bad ? 1 : 0);
