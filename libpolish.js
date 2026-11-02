// Academy Pro, גל 1 (01/11/2026): ליטוש ובדיקה ב"הספרייה שלי" — נטען רק כשנכנסים (כמו libadmin.js).
// B1 חלון הליטוש (B3 B4 B5 B6 B8 B10 H3 H4 + A10 בדיקת הספר), D11 בדיקת הספרייה, D14 משיכת פרטים לכל הספרייה, D13 עמודים וזמן קריאה.
// הליבה (בלי DOM של התוכן) ב־epubkit.js: polishBook. כל מה שצריך מהספרייה מוזרק (E) — בלי תלות הפוכה.
// כללים: רק ספרים של המשתמש (E.isMine); הקובץ הקודם נשמר לביטול; המזהה לא משתנה (ההתקדמות וההדגשות לפיו).
let EKP = null;
const kit = () => (EKP || (EKP = import('./epubkit.js')));
const WORDS_PER_PAGE = 250;                       // עמוד מודפס ממוצע
const WPM_DEFAULT = { he: 180, other: 230 };       // בלי מספיק נתונים על הקצב שלך
const PACE_MIN_MS = 10 * 60 * 1000;                // מתחת ל־10 דקות קריאה מדודה — הקצב הממוצע
const FETCH_GAP_MS = 2100;                          // השרתון: 40 בקשות לדקה לכתובת — משאירים מקום לכריכות
const FETCH_FIELDS = ['subtitle', 'author', 'pub', 'date', 'lang', 'series', 'seriesIdx', 'isbn', 'tags', 'desc'];
const ISSUE_KEY = { container: 'plI_container', missing_file: 'plI_missing_file', missing_img: 'plI_missing_img', no_language: 'plI_no_language', no_toc: 'plI_no_toc',
  broken_toc: 'plI_broken_toc', unused_font: 'plI_unused_font', remote_resource: 'plI_remote_resource', no_title: 'plI_no_title', corrupt: 'plI_corrupt', bad_toc: 'plI_bad_toc' };
const FIELD_LABEL = { subtitle: 'edSubtitle', author: 'edAuthor', pub: 'edPub', date: 'edDate', lang: 'edLang', series: 'edSeries', seriesIdx: 'edSeriesIdx', isbn: 'edIsbn', tags: 'edTags', desc: 'edDesc' };

/* D13 — מילים → עמודים ושעות. pace = { ms, w } מהקורא (הזמן שקראת בפועל ומספר המילים שעברת) */
export function readingStats(words, fraction, pace, lang) {
  if (!words) return null;
  const he = /^(he|iw)/i.test(lang || '');
  const mine = pace && pace.ms >= PACE_MIN_MS && pace.w > 0;
  const wpm = mine ? Math.min(600, Math.max(80, pace.w / (pace.ms / 60000))) : (he ? WPM_DEFAULT.he : WPM_DEFAULT.other);
  const totalMin = words / wpm, left = Math.max(0, 1 - (fraction || 0)) * totalMin;
  return { words, pages: Math.max(1, Math.ceil(words / WORDS_PER_PAGE)), totalMin, leftMin: left, mine: !!mine, wpm: Math.round(wpm) };
}
export const fmtHours = (min) => { const m = Math.round(min); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
export const countWords = (secs) => (secs || []).reduce((s, x) => s + ((String(x.t || '').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'׳״-]*/gu) || []).length), 0);

/* מה החלון מציע לספר הזה — רק שורות שיש להן מה לעשות */
export function polishRows(a, b) {
  const s = a.stats, he = a.info.hebrew, rows = [];
  if (he && s.punct) rows.push('punct');
  if (he && s.bidi) rows.push('bidi');
  if (s.cssBytes) rows.push('css');
  if (s.forcedBytes) rows.push('forced');
  if (!he && s.hyph) rows.push('hyph');
  if (a.info.version === 2) rows.push('epub3');
  if (b && (b.edit || b.cat)) rows.push('meta');
  if (a.issues.some((i) => i.fix === 'kindle')) rows.push('kindle');
  return rows;
}
/* המשקל והבעיות אחרי — הערכה לפי מה שמסומן (החלון מעדכן בכל מתג) */
export function polishEstimate(a, on) {
  const s = a.stats;
  let saved = 0;
  /* CSS נספר לפני כיווץ — בקובץ הוא תופס בערך שליש. גופנים כבר נספרים בגודל המכווץ */
  if (on.css) saved += s.cssBytes * 0.3;
  if (on.forced) saved += s.forcedBytes * 0.3;
  if (on.kindle) saved += s.fontBytes;
  const fixed = (i) => i.fix === 'auto' || (i.fix === 'kindle' && on.kindle) || (i.fix === 'epub3' && on.epub3);
  return { after: Math.max(Math.round(a.info.size * 0.05), Math.round(a.info.size - saved)), left: a.issues.filter((i) => !fixed(i)).length };
}
export function polishOpts(on, forced) {
  return { punct: !!on.punct, bidi: !!on.bidi, css: !!on.css, forced: on.forced ? Object.assign({}, forced) : false, epub3: !!on.epub3, kindle: !!on.kindle, hyph: !!on.hyph };
}
/* B6 — הפרטים של הספרייה בצורה של writeOpfMeta. רק מה שיש בו ערך */
export function recMeta(b) {
  const v = (k) => (b.edit && typeof b.edit[k] === 'string') ? b.edit[k].trim() : (b[k] != null ? String(b[k]).trim() : '');
  const authors = v('author').split(/\s*[,،]\s*/).filter(Boolean).map((name, i) => ({ name, sort: i === 0 ? v('authorSort') : '' }));
  const tags = v('tags').split(/\s*[,،]\s*/).filter(Boolean);
  return { title: v('title'), subtitle: v('subtitle'), authors: authors.length ? authors : undefined, publisher: v('pub'), date: v('date'), lang: v('lang'), series: v('series'), seriesIndex: v('series') ? v('seriesIdx') : '', isbn: v('isbn'), tags: tags.length ? tags : undefined, description: v('desc') };
}
/* D14 — מה חסר בספר ומה נמצא: רק שדות ריקים, אף פעם לא דורסים */
export function fetchProposal(b, r) {
  const v = (k) => (b.edit && typeof b.edit[k] === 'string') ? b.edit[k] : (b[k] != null ? String(b[k]) : '');
  const from = {
    subtitle: r.subtitle, author: (r.authors || []).join(', '), pub: r.publisher, date: r.date || (r.year ? String(r.year) : ''),
    lang: r.lang, series: r.series, seriesIdx: r.series && r.seriesIndex != null ? String(r.seriesIndex) : '', isbn: r.isbn,
    tags: Array.isArray(r.tags) ? r.tags.join(', ') : r.tags, desc: r.desc,
  };
  const out = {};
  for (const k of FETCH_FIELDS) { const x = from[k] == null ? '' : String(from[k]).trim(); if (x && !v(k).trim()) out[k] = x; }
  if (r.cover && !b.cover) out.cover = r.cover;
  return out;
}
const normT = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function sameBook(b, r) {                    // התוצאה באמת של הספר הזה (כותר דומה) — אחרת לא מציעים
  const a = normT(b.title), c = normT(r.title);
  if (!a || !c) return false;
  return a === c || a.startsWith(c) || c.startsWith(a) || (a.length > 6 && c.includes(a)) || (c.length > 6 && a.includes(c));
}

export function createPolish(E) {
  const { h, T } = E;
  const flash = (m) => E.flash && E.flash(m);
  const tag = (t, cls) => h('span', 'pl-tag' + (cls ? ' ' + cls : ''), t);
  const dot = (lv) => h('i', 'pl-dot ' + lv);

  /* ---------- B1: חלון הליטוש ---------- */
  function openPolish(b, after) {
    if (!E.isMine(b)) return;
    E.sheet(T('plTitle'), async (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      const S = { a: null, file: null, on: {}, forced: { font: true, color: true, size: false, margin: false }, view: 'after', phase: 'load', err: '' };
      const head = () => {
        const hd = h('div', 'pl-hd');
        const cv = h('div', 'pl-cv'); cv.append(E.cover(b, true));
        const m = h('div', 'pl-hm'); const bt = h('b', null, b.title); bt.dir = 'auto'; m.append(bt);
        const tags = h('div', 'pl-tags');
        if (S.a) {
          tags.append(tag('EPUB ' + S.a.info.version), tag(E.fmtBytes(S.a.info.size)));
          if (S.a.issues.length) tags.append(tag(T('plIssuesN', { n: S.a.issues.length }), 'warn'));
        }
        m.append(tags); hd.append(cv, m);
        return hd;
      };
      const paint = () => {
        box.textContent = '';
        box.append(head());
        if (S.phase === 'load') { box.append(h('p', 'lib-empty', T('plChecking'))); return; }
        if (S.phase === 'err') { box.append(h('p', 'lib-empty', S.err)); return; }
        const a = S.a, st = a.stats, rows = polishRows(a, b);
        if (S.phase === 'done') return paintDone();
        if (st.sample && (rows.includes('punct') || rows.includes('bidi'))) box.append(sample(st.sample));
        const grp = (key, list) => {
          const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T(key)));
          const card = h('div', 'lib-ios pl-card'); list.forEach((x) => card.append(x)); g.append(card); box.append(g);
        };
        const row = (k, t, s) => {
          const r = h('div', 'lib-row pl-row' + (S.on[k] ? '' : ' off'));
          const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', t)); if (s) l.append(h('span', 'pl-rs', s));
          r.append(l, E.swEl(!!S.on[k], (v) => { S.on[k] = v; if (k === 'forced') paint(); else { r.classList.toggle('off', !v); paintFoot(); } }, t));
          return r;
        };
        const he = [], clean = [], file = [];
        if (rows.includes('punct')) he.push(row('punct', T('plPunct'), T('plPunctS', { n: st.punct.toLocaleString() })));
        if (rows.includes('bidi')) he.push(row('bidi', T('plBidi'), T('plBidiS', { n: st.bidi.toLocaleString() })));
        if (rows.includes('css')) clean.push(row('css', T('plCss'), T('plCssS', { x: E.fmtBytes(st.cssBytes) })));
        if (rows.includes('forced')) {
          const r = row('forced', T('plForced'), T('plForcedS'));
          if (S.on.forced) {
            const chips = h('div', 'pl-chips');
            for (const [k, key] of [['font', 'plFFont'], ['color', 'plFColor'], ['size', 'plFSize'], ['margin', 'plFMargin']]) {
              const c = h('button', 'pl-chip', T(key)); c.type = 'button'; c.setAttribute('aria-pressed', String(!!S.forced[k]));
              c.addEventListener('click', () => { S.forced[k] = !S.forced[k]; c.setAttribute('aria-pressed', String(S.forced[k])); if (!Object.values(S.forced).some(Boolean)) { S.on.forced = false; paint(); } });
              chips.append(c);
            }
            r.classList.add('wrap'); r.append(chips);
          }
          clean.push(r);
        }
        if (rows.includes('hyph')) clean.push(row('hyph', T('plHyph'), T('plHyphS')));
        if (rows.includes('epub3')) file.push(row('epub3', T('plEpub3'), T('plEpub3S')));
        if (rows.includes('meta')) file.push(row('meta', T('plMeta'), T('plMetaS')));
        if (rows.includes('kindle')) file.push(row('kindle', T('plKindle'), T('plKindleS', { n: a.issues.filter((i) => i.fix === 'kindle').reduce((s, i) => s + i.n, 0) })));
        if (he.length) grp('plGHe', he);
        if (clean.length) grp('plGClean', clean);
        if (file.length) grp('plGFile', file);
        if (a.issues.length) grp('plGCheck', a.issues.map(issueRow));
        if (!rows.length && !a.issues.some((i) => i.fix)) box.append(h('p', 'lib-empty', T('plClean')));
        const foot = h('div', 'pl-foot'); box.append(foot); S.foot = foot;
        paintFoot();
      };
      const issueRow = (i) => {
        const r = h('div', 'lib-row pl-iss');
        const fixed = i.fix === 'auto' || (i.fix && S.on[i.fix]);
        r.append(dot(i.fix ? (fixed ? 'ok' : 'warn') : 'bad'));
        const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(ISSUE_KEY[i.code] || 'plI_corrupt', { n: i.n })));
        if (i.first) { const f = h('span', 'pl-rs', i.first); f.dir = 'auto'; l.append(f); }
        r.append(l, h('span', 'pl-st' + (i.fix ? '' : ' man'), T(i.fix ? (fixed ? 'plWillFix' : 'plOff') : 'plManual')));
        return r;
      };
      const sample = (sm) => {
        const w = h('div', 'pl-cmp');
        const seg = h('div', 'pl-seg'); seg.setAttribute('role', 'group');
        const txt = h('div', 'pl-sample'); txt.dir = 'rtl';
        const draw = () => {
          txt.textContent = '';
          const show = S.view === 'after' ? sm.a : sm.b, other = S.view === 'after' ? sm.b : sm.a;
          if (show.length === other.length) {
            let run = '', hi = false;
            const flush = () => { if (run) txt.append(hi ? h('mark', S.view, run) : document.createTextNode(run)); run = ''; };
            for (let i = 0; i < show.length; i++) { const d = show[i] !== other[i]; if (d !== hi) { flush(); hi = d; } run += show[i]; }
            flush();
          } else txt.textContent = show;
          seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === S.view)));
        };
        for (const [v, key] of [['before', 'plBefore'], ['after', 'plAfter']]) {
          const bt = h('button', null, T(key)); bt.type = 'button'; bt.dataset.v = v;
          bt.addEventListener('click', () => { S.view = v; draw(); });
          seg.append(bt);
        }
        w.append(seg, txt); draw();
        return w;
      };
      const paintFoot = () => {
        const f = S.foot; if (!f) return;
        f.textContent = '';
        if (S.phase === 'run') { f.append(h('p', 'pl-delta', T('plRunning'))); return; }
        const est = polishEstimate(S.a, S.on);
        const d = h('p', 'pl-delta');
        d.append(h('span', null, T('plWeight') + ' ' + E.fmtBytes(S.a.info.size) + ' ← '), h('b', null, E.fmtBytes(est.after)),
          h('span', null, ' · ' + T('plProblems') + ' ' + S.a.issues.length + ' ← '), h('b', null, String(est.left)));
        const go = h('button', 'bk-cta', T('plRun')); go.type = 'button';
        go.disabled = !Object.values(S.on).some(Boolean) && !S.a.issues.some((i) => i.fix === 'auto');
        go.addEventListener('click', run);
        f.append(d, go);
        box.querySelectorAll('.pl-iss').forEach((r, ix) => r.replaceWith(issueRow(S.a.issues[ix])));
      };
      const run = async () => {
        if (S.phase === 'run') return;
        S.phase = 'run'; paintFoot();
        try {
          const EK = await kit();
          const cur = (await E.allBooksRaw()).find((x) => x.id === b.id) || b;
          const meta = S.on.meta ? recMeta(cur) : undefined;
          const coverBlob = S.on.meta && cur.coverCustom && cur.cover instanceof Blob ? cur.cover : undefined;
          const r = await EK.polishBook(S.file, polishOpts(S.on, S.forced), { meta, cover: coverBlob });
          const nf = new File([r.blob], S.file.name || (b.id + '.epub'), { type: 'application/epub+zip' });
          await E.savePolished(b.id, nf, S.file);
          S.result = r; S.newSize = nf.size; S.phase = 'done';
        } catch (e) { S.phase = 'ready'; flash(T('plErr')); }
        paint();
      };
      const paintDone = () => {
        const d = h('div', 'pl-done');
        d.append(h('b', null, T('plDone')), h('p', null, E.fmtBytes(S.a.info.size) + ' ← ' + E.fmtBytes(S.newSize) + ' · ' + T('plDoneS')));
        const acts = h('div', 'pl-two');
        const undo = h('button', 'ed-btn ghost', T('plUndo')); undo.type = 'button';
        undo.addEventListener('click', async () => { undo.disabled = true; try { await E.undoPolish(b.id); flash(T('plUndone')); } catch (e) { flash(T('plErr')); } close(); if (after) after(); });
        const fin = h('button', 'bk-cta', T('plFinish')); fin.type = 'button';
        fin.addEventListener('click', () => { close(); if (after) after(); });
        acts.append(undo, fin); d.append(acts); box.append(d);
      };
      paint();
      try {
        const f = await E.getFile(b.id);
        if (!f) throw Object.assign(new Error('nofile'), { msg: 'plNoFile' });
        const EK = await kit();
        if (await EK.classify(f).catch(() => '') !== 'epub') throw Object.assign(new Error('type'), { msg: 'plOnlyEpub' });
        S.file = f;
        S.a = await EK.polishBook(f, EK.POLISH_ALL, { dry: true });
        for (const k of polishRows(S.a, b)) S.on[k] = k !== 'meta' || !!b.edit;
        S.phase = 'ready';
      } catch (e) { S.phase = 'err'; S.err = T((e && e.msg) || 'plBroken'); }
      if (box.isConnected) paint();
    });
  }

  /* ---------- D11: בדיקת הספרייה ---------- */
  function openLibCheck() {
    E.sheet(T('lcTitle'), async (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      const R = { broken: [], missing: [], noCover: [], noMeta: [], polish: [], total: 0, done: 0, stop: false };
      const prog = h('p', 'lib-empty'); box.append(prog);
      const books = (await E.allBooksRaw()).filter((b) => E.isMine(b) && !b.hidden);
      R.total = books.length;
      const EK = await kit();
      for (const b of books) {
        if (!box.isConnected) return;
        prog.textContent = T('lcRun', { n: R.done + 1, t: R.total });
        const v = (k) => (b.edit && typeof b.edit[k] === 'string') ? b.edit[k] : (b[k] != null ? String(b[k]) : '');
        if (!b.cover) R.noCover.push(b);
        if (!v('isbn').trim() || !v('desc').trim()) R.noMeta.push(b);
        try {
          const f = await E.getFile(b.id);
          if (!f) R.missing.push(b);
          else if (await EK.classify(f).catch(() => '') === 'epub') {
            const a = await EK.polishBook(f, EK.POLISH_DEFAULT, { dry: true }).catch((e) => { if (e && e.code === 'not_editable') R.broken.push(b); return null; });
            if (a) {
              const s = a.stats;
              if (a.issues.some((i) => i.code === 'corrupt')) R.broken.push(b);
              else if (s.punct || s.bidi || s.cssBytes || s.forcedBytes || s.hyph || s.fontsRemoved || s.missingRemoved || s.tocFixed || s.upgraded || s.langAdded) R.polish.push(b);
            }
          }
        } catch (e) { R.broken.push(b); }
        R.done++;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!box.isConnected) return;
      prog.remove();
      paintCheck(box, R, close);
    });
  }
  function paintCheck(box, R, close) {
    box.textContent = '';
    /* תקין = הקובץ שלם, בטלפון ולא צריך ליטוש. כריכה ו־ISBN חסרים — הצעה, לא תקלה */
    const bad = new Set([...R.broken, ...R.missing, ...R.polish].map((b) => b.id)).size;
    const ok = R.total - bad;
    const top = h('div', 'pl-ring');
    const C = 2 * Math.PI * 28, frac = R.total ? ok / R.total : 1;
    top.innerHTML = '<svg viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="28" fill="none" class="pl-ring-bg" stroke-width="8"/><circle cx="34" cy="34" r="28" fill="none" class="pl-ring-fg" stroke-width="8" stroke-linecap="round"' + (frac ? '' : ' opacity="0"') + ' stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 34 34)"/></svg>';
    const tt = h('div', 'pl-hm'); tt.append(h('b', null, T('lcOk', { n: ok, t: R.total })));
    top.append(tt); box.append(top);
    const card = h('div', 'lib-ios pl-card');
    const line = (lv, key, list, act) => {
      const r = h('div', 'lib-row pl-iss');
      r.append(dot(list.length ? lv : 'ok'));
      const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key)));
      if (list.length) { const s = h('span', 'pl-rs', list.slice(0, 3).map((b) => b.title).join(' · ') + (list.length > 3 ? ' …' : '')); s.dir = 'auto'; l.append(s); }
      r.append(l, h('span', 'pl-cnt', String(list.length)));
      if (act && list.length) r.append(act); else r.append(h('span', 'pl-actsp'));
      card.append(r);
    };
    const btn = (key, fn) => { const b = h('button', 'mini-btn', T(key)); b.type = 'button'; b.addEventListener('click', fn); return b; };
    line('bad', 'lcBroken', R.broken);
    line('warn', 'lcMissing', R.missing);
    const fetchList = [...new Map([...R.noCover, ...R.noMeta].map((b) => [b.id, b])).values()];
    line('warn', 'lcNoCover', R.noCover, btn('lcFetch', () => E.closeSheetThen(box.closest('.lib-veil'), () => openFetch(fetchList))));
    line('warn', 'lcNoMeta', R.noMeta, btn('lcFetch', () => E.closeSheetThen(box.closest('.lib-veil'), () => openFetch(fetchList))));
    line('warn', 'lcPolish', R.polish, btn('lcPolishAll', (e) => polishAll(R.polish, e.currentTarget, box, R, close)));
    box.append(card);
    if (!bad) box.append(h('p', 'lib-empty', T('lcNone')));
  }
  async function polishAll(list, btn, box, R, close) {
    btn.disabled = true;
    const EK = await kit();
    let n = 0;
    const msg = h('p', 'pl-delta'); box.append(msg);
    for (const b of list) {
      if (!box.isConnected) return;
      msg.textContent = T('lcPolishing', { n: n + 1, t: list.length });
      try {
        const f = await E.getFile(b.id);
        const r = await EK.polishBook(f, EK.POLISH_DEFAULT);
        if (r.blob !== f) await E.savePolished(b.id, new File([r.blob], f.name || (b.id + '.epub'), { type: 'application/epub+zip' }), f);
        n++;
      } catch (e) { /* ספר שנכשל — נשאר כמו שהוא */ }
    }
    flash(T('lcPolished', { n }));
    R.polish = R.polish.filter((b) => !list.includes(b));
    paintCheck(box, R, close);
  }

  /* ---------- D14: משיכת פרטים לכל הספרייה, עם אישור לכל שדה ---------- */
  function openFetch(list) {
    E.sheet(T('mfTitle'), async (sh) => {
      const box = h('div', 'pl'); sh.append(box);
      const prog = h('p', 'lib-empty'); box.append(prog);
      await null;   // החלון נכנס לדף רק אחרי שהבנייה חוזרת — בלי זה isConnected עוד false
      const found = [];
      for (let i = 0; i < list.length; i++) {
        if (!box.isConnected) return;
        const b = list[i];
        prog.textContent = T('mfRun', { n: i + 1, t: list.length });
        const v = (k) => (b.edit && typeof b.edit[k] === 'string') ? b.edit[k] : (b[k] != null ? String(b[k]) : '');
        try {
          const j = await E.meta({ op: 'search', isbn: v('isbn'), title: v('title') || b.title, author: v('author').split(',')[0], lang: v('lang') }).then((r) => r.json());
          const r = j && j.ok && (j.results || []).find((x) => (v('isbn') && x.isbn && x.isbn === v('isbn').replace(/[^0-9X]/gi, '')) || sameBook(b, x));
          const p = r ? fetchProposal(b, r) : {};
          if (Object.keys(p).length) found.push({ b, p, on: Object.fromEntries(Object.keys(p).map((k) => [k, true])) });
        } catch (e) { /* בלי רשת / הגבלה — ממשיכים */ }
        if (i < list.length - 1) await new Promise((r) => setTimeout(r, FETCH_GAP_MS));
      }
      if (!box.isConnected) return;
      prog.remove();
      if (!found.length) { box.append(h('p', 'lib-empty', T('mfNone'))); return; }
      const save = h('button', 'bk-cta', ''); save.type = 'button';
      const count = () => { const n = found.reduce((s, x) => s + Object.values(x.on).filter(Boolean).length, 0); save.textContent = T('mfSave', { n }); save.disabled = !n; };
      for (const x of found) {
        const card = h('div', 'lib-ios pl-card pl-mf');
        const hd = h('div', 'pl-hd'); const cv = h('div', 'pl-cv'); cv.append(E.cover(x.b, true));
        const t = h('b', null, x.b.title); t.dir = 'auto'; const m = h('div', 'pl-hm'); m.append(t); hd.append(cv, m); card.append(hd);
        for (const [k, val] of Object.entries(x.p)) {
          const r = h('div', 'lib-row pl-fr');
          const lab = T(k === 'cover' ? 'mfCover' : FIELD_LABEL[k]);
          const sw = E.swEl(true, (on) => { x.on[k] = on; r.classList.toggle('off', !on); count(); }, lab);
          const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rs', lab));
          if (k === 'cover') { const th = h('span', 'pl-th'); E.remoteCover(val).then((bl) => { const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(bl); th.append(im); }).catch(() => {}); l.append(th); }
          else { const s = h('span', 'pl-rt pl-val', val); s.dir = 'auto'; l.append(s); }
          r.append(l, sw); card.append(r);
        }
        box.append(card);
      }
      count();
      save.addEventListener('click', async () => {
        save.disabled = true;
        let n = 0;
        for (const x of found) {
          const keys = Object.keys(x.on).filter((k) => x.on[k]);
          if (!keys.length) continue;
          let cv = null;
          if (keys.includes('cover')) cv = await E.remoteCover(x.p.cover).then((bl) => E.coverFromBlob(bl)).catch(() => null);
          const vals = {}; keys.filter((k) => k !== 'cover').forEach((k) => { vals[k] = x.p[k]; });
          if (await E.saveFields(x.b.id, vals, cv)) n++;
        }
        flash(T('mfSaved', { n }));
        const veil = box.closest('.lib-veil'); if (veil && veil._close) veil._close();
        E.renderHome();
      });
      box.append(save);
    });
  }

  return { openPolish, openLibCheck, openFetch };
}
