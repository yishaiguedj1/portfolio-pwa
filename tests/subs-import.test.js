// ייבוא קובץ כתוביות (22/10/2026): importSubs של studiosubs.js = import_subs של translator/subsimport.py — אותה תוצאה
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const S = await import(path.join(__dirname, '..', 'studiosubs.js'));
  const FX = path.join(__dirname, '..', 'translator', 'tests', 'fixtures', 'subs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'subsimp-'));
  const files = fs.readdirSync(FX).sort().map((f) => path.join(FX, f));

  // קבצים אקראיים: תגיות, SDH, תוויות דובר, פרסומות, חפיפות, כפולים, סדר הפוך, קידודים, שלושה פורמטים
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const W = ['Where', 'were', 'you', 'last', 'night?', 'I', 'was', 'at', 'work.', 'Fine,', '<i>you</i>', 'win.', 'Café', 'naïve', '1999', 'O\'BRIEN', "it's", '...', '♪', '{\\an8}', '<b>bold</b>', '<font color="red">red</font>', '[door slams]', '(sighs)', '[MUSIC', 'PLAYING]'];
  const LINE = () => {
    const r = rnd();
    if (r < 0.06) return pick(['[DOOR SLAMS]', '(sighs)', '♪ ♪', '(LAUGHTER)']);
    if (r < 0.1) return pick(['MICHAEL: ', 'SARAH (whispering): ', '- JOHN: ', 'DR. REES: ', 'WARNING: HIGH VOLTAGE ']) + pick(W) + ' ' + pick(W);
    if (r < 0.13) return pick(['Synced by kitty', 'www.addic7ed.com', 'Subtitles by OpenSubtitles']);
    if (r < 0.2) return '<i>' + pick(W) + ' ' + pick(W) + '</i>';
    if (r < 0.24) return '- ' + pick(W) + ' ' + pick(W);
    return Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(W)).join(' ');
  };
  const ts = (ms, sep) => { const p = (n, w) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600e3), 2)}:${p(Math.floor(ms / 60e3) % 60, 2)}:${p(Math.floor(ms / 1e3) % 60, 2)}${sep}${p(ms % 1e3, 3)}`; };
  const assT = (ms) => `${Math.floor(ms / 3600e3)}:${String(Math.floor(ms / 60e3) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1e3) % 60).padStart(2, '0')}.${String(Math.floor(ms % 1e3 / 10)).padStart(2, '0')}`;
  for (let k = 0; k < 160; k++) {
    const kind = pick(['srt', 'srt', 'vtt', 'ass']);
    const n = 3 + Math.floor(rnd() * 30);
    let t = Math.floor(rnd() * 2000);
    const cues = [];
    for (let i = 0; i < n; i++) {
      const d = 300 + Math.floor(rnd() * 3500);
      const s = t + (rnd() < 0.1 ? -500 : 0);
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 2.4) }, LINE);
      cues.push({ s: Math.max(0, s), e: Math.max(0, s) + d, lines });
      if (rnd() < 0.05) cues.push({ s: Math.max(0, s), e: s + d, lines });
      t += d + Math.floor(rnd() * 800);
    }
    if (rnd() < 0.1) cues.reverse();
    let text;
    if (kind === 'srt') text = cues.map((c, i) => `${i + 1}\n${ts(c.s, ',')} --> ${ts(c.e, ',')}\n${c.lines.join('\n')}`).join(rnd() < 0.5 ? '\n\n' : '\r\n\r\n');
    else if (kind === 'vtt') text = 'WEBVTT\n\n' + cues.map((c) => `${ts(c.s, '.')} --> ${ts(c.e, '.')}${rnd() < 0.15 ? ' line:5%' : ''}\n${c.lines.join('\n')}`).join('\n\n');
    else text = '[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + cues.map((c) => `Dialogue: 0,${assT(c.s)},${assT(c.e)},Default,${pick(['', 'Anna', 'Bob'])},0,0,0,,${c.lines.join('\\N').replace(/<i>/g, '{\\i1}').replace(/<\/i>/g, '{\\i0}')}`).join('\n');
    let buf = Buffer.from(text, 'utf8');
    const enc = rnd();
    if (enc < 0.15) buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buf]);
    else if (enc < 0.25) buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
    else if (enc < 0.35 && !/[^\x00-\xff]/.test(text)) buf = Buffer.from(text, 'latin1');
    const f = path.join(tmp, `r${k}.${kind}`);
    fs.writeFileSync(f, buf);
    files.push(f);
  }
  fs.writeFileSync(path.join(tmp, 'list.json'), JSON.stringify(files));
  const py = execFileSync('python3', ['-I', '-c',
    'import json,sys;sys.path.insert(0,sys.argv[1]);from subsimport import import_subs as f\n'
    + 'L=json.load(open(sys.argv[2]))\nprint(json.dumps([[f(open(p,"rb").read(),sdh=s) for s in (True,False)] for p in L]))',
    path.join(__dirname, '..', 'translator'), path.join(tmp, 'list.json')], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const P = JSON.parse(py);
  let cuesSeen = 0, sdhSeen = 0, labelsSeen = 0;
  files.forEach((f, i) => [true, false].forEach((sdh, j) => {
    const js = S.importSubs(fs.readFileSync(f), { sdh });
    const a = JSON.stringify(js), b = JSON.stringify(P[i][j]);
    ok(a === b, `${path.basename(f)} sdh=${sdh}\n js ${a.slice(0, 600)}\n py ${b.slice(0, 600)}`);
    cuesSeen += js.stats.n; sdhSeen += js.stats.sdh; labelsSeen += js.stats.labels;
  }));
  ok(cuesSeen > 1000 && sdhSeen > 50 && labelsSeen > 30, `המקרים האקראיים מכסים: ${cuesSeen} כתוביות, ${sdhSeen} SDH, ${labelsSeen} תוויות`);
  ok(S.subsDetect('WEBVTT\n') === 'vtt' && S.subsDetect('garbage') === '', 'זיהוי פורמט');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`subs-import: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
