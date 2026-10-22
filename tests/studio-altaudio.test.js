// 22/10/2026 (בקשת המשתמש: "לא לדרוס סאונד איכותי, לתמוך בכמה שיותר סוגי סאונד"): קול שהטלפון לא מנגן (Dolby/DTS/TrueHD)
// נשאר במקור כמו שהוא; העובד בונה לצידו עותק Opus לנגן; הטלפון מסיר את רצועת הקול מהקטעים תוך כדי ומנגן את העותק כרצועת
// קול חלופית (hls.js המלא). וגם: התוצרים ב־R2 מורדים לטלפון / נשמרים ב־Drive (עד היום — קישור ל־Drive שלא קיים).
// הרצה: node tests/studio-altaudio.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* MP4 מלאכותי: moov עם trak וידאו (1) + trak קול (2) + mvex/trex לשניהם; moof עם traf לכל אחד ו־trun עם data_offset */
function box(type, ...body) { const b = Buffer.concat(body); const h = Buffer.alloc(8); h.writeUInt32BE(8 + b.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, b]); }
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };
function trak(id, hdlr) {
  const tkhd = box('tkhd', u32(0), u32(0), u32(0), u32(id), u32(0), Buffer.alloc(60));   // גרסה 0: flags, ctime, mtime, track_ID…
  return box('trak', tkhd, box('mdia', box('hdlr', u32(0), u32(0), Buffer.from(hdlr, 'latin1'), Buffer.alloc(12))));
}
const trex = (id) => box('trex', u32(0), u32(id), u32(1), u32(0), u32(0), u32(0));
function traf(id, off) { return box('traf', box('tfhd', u32(0x020000), u32(id)), box('trun', u32(0x000001), u32(1), u32(off))); }

(async () => {
  const P = await import(path.join(root, 'studioplay.js'));
  const SV = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- הסרת רצועת הקול (מבנה) ---------- */
  const moov = box('moov', box('mvhd', Buffer.alloc(100)), trak(1, 'vide'), trak(2, 'soun'), box('mvex', trex(1), trex(2)));
  const init = Buffer.concat([box('ftyp', Buffer.from('iso6\0\0\0\0', 'latin1')), moov]);
  const x = P.stripInitAudio(new Uint8Array(init));
  ok(JSON.stringify(x.ids) === '[2]', 'מזהה רצועת הקול נמצא לפי ה־hdlr (soun)');
  const ib = Buffer.from(x.data);
  ok(!ib.includes(Buffer.from('soun')) && ib.includes(Buffer.from('vide')) && ib.length === init.length - trak(2, 'soun').length - trex(2).length, 'האתחול: trak הקול ו־trex שלו יצאו, הווידאו נשאר');
  const moovAt = ib.indexOf(Buffer.from('moov')) - 4;
  ok(ib.readUInt32BE(moovAt) === ib.length - moovAt, 'גודל ה־moov עודכן');
  const mvexAt = ib.indexOf(Buffer.from('mvex')) - 4;
  ok(ib.readUInt32BE(mvexAt) === 8 + trex(1).length, 'גודל ה־mvex עודכן');
  ok(P.stripInitAudio(new Uint8Array(Buffer.concat([box('moov', trak(2, 'soun'))]))).ids.length === 0, 'קובץ קול בלבד — לא נוגעים');

  const mdat = box('mdat', Buffer.from('VVVVAAAA'));
  const t1 = traf(1, 0), t2 = traf(2, 0);
  const moofLen = 8 + 16 + t1.length + t2.length;
  const frag = Buffer.concat([box('moof', box('mfhd', u32(0), u32(1)), traf(1, moofLen + 8), traf(2, moofLen + 12)), mdat]);
  const fb = Buffer.from(P.stripFragAudio(new Uint8Array(frag), [2]));
  ok(fb.length === frag.length - t2.length, 'הקטע: traf הקול יצא, ה־mdat נשאר כמו שהוא');
  const tr = fb.indexOf(Buffer.from('trun')) - 4;
  ok(fb.readUInt32BE(tr + 16) === moofLen + 8 - t2.length, 'data_offset של הווידאו קטן בגודל שהוסר — מצביע לאותם בתים');
  ok(fb.subarray(fb.readUInt32BE(tr + 16), fb.readUInt32BE(tr + 16) + 4).toString() === 'VVVV', 'ההיסט החדש מצביע בדיוק לנתוני הווידאו');
  ok(P.stripFragAudio(new Uint8Array(frag), []) .length === frag.length, 'בלי מזהים — הקטע כמו שהוא');

  /* ---------- עותק הקול: זהה בטלפון ובשרתון ---------- */
  const a = { id: 'R2_abcdefghij_klmnopqrstuv', c: 'opus', bw: 330000, abw: 300000, ch: 6, size: 12345 };
  const pa = P.normAlt(a), sa = SV.normHla(a);
  ok(pa && sa && pa.id === sa.id && pa.ch === 6 && pa.bw === sa.bw, 'normAlt (טלפון) = normHla (שרתון)');
  for (const bad of [{ ...a, c: 'mp4a.40.2' }, { ...a, ch: 9 }, { ...a, abw: 400000 }, { ...a, id: 'x' }, null])
    ok(!P.normAlt(bad) && !SV.normHla(bad), 'עותק קול לא תקין נדחה בשני הצדדים: ' + JSON.stringify(bad && { c: bad.c, ch: bad.ch, id: bad.id }));
  ok(SV.normHl([{ id: 'R2_abcdefghij_aaaaaaaaaaaa', w: 1920, h: 1080, bw: 9e6, abw: 8e6, c: 'avc1.640028,ec-3', size: 9 }, { id: 'R2_abcdefghij_bbbbbbbbbbbb', w: 1280, h: 720, bw: 2e6, abw: 1e6, c: 'avc1.64001f,mp4a.40.2', size: 9 }]),
    'השרתון מקבל קודק ec-3 ברמה העליונה (הקול המקורי נשאר במקור)');
  ok(P.normLadder([{ id: 'R2_abcdefghij_aaaaaaaaaaaa', w: 1920, h: 1080, bw: 9e6, abw: 8e6, c: 'avc1.640028,ec-3' }, { id: 'R2_abcdefghij_bbbbbbbbbbbb', w: 1280, h: 720, bw: 2e6, abw: 1e6, c: 'avc1.64001f,mp4a.40.2' }]),
    'גם הטלפון');

  /* ---------- הקודקים והרשימה הראשית ---------- */
  ok(JSON.stringify(P.splitCodecs('avc1.640028,ec-3')) === '["avc1.640028","ec-3"]' && JSON.stringify(P.splitCodecs('ec-3,vp09.00.21.08')) === '["vp09.00.21.08","ec-3"]', 'וידאו וקול — בלי להניח סדר');
  const isType = (t) => !/ec-3|ac-3|mp4a\.A9|mlpa/.test(t);
  ok(!P.audioPlayable('avc1.640028,ec-3', isType) && P.audioPlayable('avc1.640028,mp4a.40.2', isType) && P.audioPlayable('avc1.640028', isType), 'הקול המקורי מתנגן? (ec-3 לא, AAC כן, בלי קול — כן)');
  const m = P.masterPlaylist([{ bw: 9e6, abw: 8e6, w: 1920, h: 1080, c: 'avc1.640028,ec-3', uri: 'a/0.m3u8' }, { bw: 2e6, abw: 1e6, w: 1280, h: 720, c: 'avc1.64001f,mp4a.40.2', uri: 'a/1.m3u8' }],
    { ch: 6, bw: 330000, abw: 300000, uri: 'a/a.m3u8' });
  ok(/#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="main",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="a\/a\.m3u8"/.test(m), 'רצועת קול חלופית ברשימה הראשית');
  ok(m.includes('CODECS="avc1.640028,opus",AUDIO="a"') && m.includes('CODECS="avc1.64001f,opus",AUDIO="a"') && !m.includes('ec-3'), 'בכל רמה: הווידאו + opus (הקול שבקטעים מוסר) — ec-3 לא מופיע (hls.js היה זורק את הרמה)');
  ok(m.includes('BANDWIDTH=9330000'), 'הקצב כולל את הקול');
  ok(!P.masterPlaylist([{ bw: 1, abw: 1, w: 2, h: 2, c: 'avc1.1,mp4a.40.2', uri: 'x' }]).includes('EXT-X-MEDIA'), 'בלי עותק — כמו קודם');

  /* ---------- hls.js המלא ---------- */
  const full = fs.readFileSync(path.join(root, 'vendor/hls/hls.min.js'));
  ok(read('vendor/hls/VERSION').includes(crypto.createHash('sha256').update(full).digest('hex')), 'hls.js המלא = הגרסה שנבדקה (sha256 ב־VERSION)');
  const pl = read('studioplay.js');
  ok(/const full = '\.\/vendor\/hls\/hls\.min\.js'/.test(pl) && /!audioPlayable\(ladder\[0\]\.c, isType\)/.test(pl), 'המלא נטען רק כשהקול המקורי לא מתנגן בטלפון ויש עותק');
  ok(/frag\.sn === 'initSegment'/.test(pl) && /stripFragAudio\(r\.data/.test(pl) && /frag\.type === 'main'/.test(pl), 'הסרת הקול — רק בקטעי הווידאו (main), לא ברצועת הקול');

  /* ---------- העובד והשרתון ---------- */
  const lad = read('translator/ladder.py');
  ok(/A_ALT = \('ac3', 'eac3', 'alac', 'dts', 'truehd'\)/.test(lad) && /delay_moov/.test(lad) && /'libopus'/.test(lad), 'העובד: אריזה בלי קידוד עם delay_moov (Dolby), עותק Opus');
  const job = read('translator/job.py');
  ok(/hla=hl and hl\.get\('hla'\)/.test(job) && /put_output\(ctx, ap, title \+ ' \(קול לנגן\)\.mp4', 'hl', 'audio\/mp4'\)/.test(job), 'העובד מעלה את העותק ומדווח hla');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/S\.normHla\(body\.hla\)/.test(api) && /driveFileInFolder\(deps, job\.uid, job\.folder, hla\.id\)/.test(api), 'השרתון: העותק מאומת בתיקיית העבודה ובגודל');
  ok(/'hl', 'hla',/.test(read('ibkr-proxy/lib/studio.js')), 'hla נשמר כ־JSON (שם שלא קיים באוסף אחר)');

  /* ---------- ההורדות ---------- */
  const st = read('studio.js');
  ok(/if \(isR2Id\(o\.id\)\) \{\s*a\.href = '#'/.test(st) && /net\.r2Get\(o\.id, outDlName\(rec, o\)\)/.test(st), 'תוצר ב־R2: נגיעה = הורדה בקישור חתום עם שם הקובץ (לא Drive)');
  ok(!/r\.srv\.out\.map\(\(o\) => rowExt\(\{ href: 'https:\/\/drive\.google\.com/.test(st) && !/pv\.srv\.out\.map\(\(o\) => rowExt/.test(st), 'ההפקה מחדש והצריבה לבדיקה — דרך rowOut (בלי קישור ל־Drive)');
  ok(/dx \? saveOutDrive\(rec, o\) : shareOut\(rec, o\)/.test(st) && /net\.r2ToDrive\(o\.id, dest\.id, outDlName\(rec, o\)\)/.test(st), 'סרטון: כפתור שמירה ב־Drive (תיקייה שבוחרים)');
  const app = read('app.js');
  for (const k of ['studioOutDx', 'studioOutDlStart']) ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);

  /* ---------- מול ffmpeg אמיתי: E-AC3 → הקובץ אחרי ההסרה = וידאו בלבד, כל הפריימים ---------- */
  let ff = false;
  try { execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=d=0.1', '-c:a', 'eac3', '-f', 'null', '-'], { stdio: 'ignore' }); ff = true; } catch (e) {}
  if (ff) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-'));
    try {
      const src = path.join(tmp, 's.mkv'), out = path.join(tmp, 'top.mp4');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25:d=8', '-f', 'lavfi', '-i', 'sine=d=8,aformat=channel_layouts=5.1',
        '-c:v', 'mpeg4', '-g', '25', '-c:a', 'eac3', src]);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-movflags', '+frag_keyframe+empty_moov+delay_moov+default_base_moof+global_sidx', '-f', 'mp4', out]);
      const all = fs.readFileSync(out), h = P.parseMp4Head(all.subarray(0, P.HEAD_BYTES));
      const si = P.stripInitAudio(all.subarray(0, h.init));
      ok(si.ids.length === 1, 'קובץ אמיתי: רצועת ה־E-AC3 זוהתה');
      const parts = [Buffer.from(si.data)];
      for (const sg of h.segs) parts.push(Buffer.from(P.stripFragAudio(all.subarray(sg.o, sg.o + sg.s), si.ids)));
      const vo = path.join(tmp, 'vo.mp4');
      fs.writeFileSync(vo, Buffer.concat(parts));
      const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames', '-of', 'json', vo]).toString());
      ok(pr.streams.length === 1 && pr.streams[0].codec_type === 'video' && +pr.streams[0].nb_read_frames === 200, 'אחרי ההסרה: וידאו בלבד, כל 200 הפריימים מתפענחים (ההיסטים נכונים)');
      const dec = execFileSync('ffmpeg', ['-v', 'error', '-i', vo, '-f', 'framemd5', '-'], { maxBuffer: 1 << 24 }).toString().split('\n').filter((l) => /^0,/.test(l)).map((l) => l.split(',').pop().trim());
      const ref = execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-map', '0:v', '-f', 'framemd5', '-'], { maxBuffer: 1 << 24 }).toString().split('\n').filter((l) => /^0,/.test(l)).map((l) => l.split(',').pop().trim());
      ok(dec.length === 200 && dec.join() === ref.join(), 'כל פריים זהה לפריים במקור (framemd5)');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } else console.log('ok - ffmpeg בלי מקודד eac3 — דילוג על הבדיקה מול קובץ אמיתי');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
