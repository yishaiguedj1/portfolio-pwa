/* v211: דף ה־HTML של הווידג'ט — גרסה B שאושרה (תצוגה מקדימה H5): לוגו 84px במרכז העליון, מסגרת עליונה
   מינימלית, כרטיסים בגובה אחיד, השינוי היומי בצ׳יפ "‎+$5.15 (+1.53%)". מצויר ב־Chromium ונשלח כ־PNG שקוף.
   טהור: model → מחרוזת. כל טקסט עובר esc. */
'use strict';
const fs = require('fs');
const path = require('path');

let _assets = null;
function assets() {
  if (_assets) return _assets;
  const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
  // נתיבים מפורשים — כך Vercel כולל את הקבצים בפונקציה (וגם includeFiles ב־vercel.json)
  _assets = { logo: b64(fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png'))), ibkr: b64(fs.readFileSync(path.join(__dirname, '..', 'assets', 'ibkr.png'))) };
  return _assets;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const WIDTH = 400; // CSS px — ~רוחב ווידג'ט 4 תאים; KWGT מתאים את התמונה לרוחב
const LOGO = 84;   // בקשת המשתמש: 84px בכל תנאי

const CSS = `
:root{--w:#1c1d20;--w2:#26282c;--on:#f3f5f4;--var:#a3a9a6;--pos:#34c759;--neg:#ff453a;--pill:#2b2d31;--tagbg:rgba(255,69,58,.14);--watch:#9fb0ff;--man:#34c759}
.light{--w:#ffffff;--w2:#f2f4f3;--on:#111413;--var:#5d6561;--pos:#16a34a;--neg:#dc2626;--pill:#eef0ef;--watch:#4757c9;--man:#16a34a}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
body{font-family:Roboto,"Noto Sans Hebrew",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
#wrap{width:${WIDTH}px;padding-top:8px}
.widget{position:relative;background:var(--w);border-radius:26px;padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px;color:var(--on)}
.hero{position:absolute;left:50%;top:-6px;width:${LOGO}px;height:${LOGO}px;transform:translateX(-50%);z-index:3;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.light .hero{filter:drop-shadow(0 6px 14px rgba(0,0,0,.18))}
.wh{display:grid;grid-template-columns:minmax(0,1fr) ${LOGO + 12}px minmax(0,1fr);align-items:center;padding:0 2px;min-height:28px}
.wh .upd{justify-self:start;padding-inline-start:4px;font-size:11px;color:var(--var);white-space:nowrap}
.wh .mkw{justify-self:end;display:flex;max-width:100%}
.mk{display:inline-flex;align-items:center;justify-content:center;column-gap:4px;font-size:10.5px;line-height:1.25;color:var(--var);background:var(--pill);padding:3px 8px;border-radius:12px;text-align:center;white-space:nowrap}
.mk.two{flex-direction:column;border-radius:11px;padding:3px 9px}
.dot{width:7px;height:7px;border-radius:50%;background:#8e9490;display:inline-block;margin-inline-end:4px;vertical-align:middle}
.dot.live{background:var(--pos);box-shadow:0 0 0 2px rgba(52,199,89,.25)}
.list{display:flex;flex-direction:column;gap:6px}
.card{background:var(--w2);border-radius:18px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;column-gap:10px;padding:9px 11px}
.logo{width:38px;height:38px;border-radius:11px;background:#fff;display:grid;place-items:center;overflow:hidden;flex:none;position:relative}
.logo img{width:30px;height:30px;object-fit:contain}
.logo img.inv{filter:invert(1)}
.logo .fb{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:17px;color:#3a3a3c}
.logo.has .fb{display:none}
.id{display:flex;flex-direction:column;gap:2px;min-width:0}
.r1{display:flex;align-items:center;gap:6px}
.sym{font-weight:800;font-size:17px;direction:ltr}
.tag{height:19px;min-width:26px;padding:0 5px;border-radius:999px;background:var(--tagbg);display:inline-grid;place-items:center;font-size:10.5px;font-weight:700}
.tag img{height:13px}
.tag.watch{background:rgba(120,140,255,.16);color:var(--watch)}
.tag.manual{background:rgba(52,199,89,.15);color:var(--man)}
.name{font-size:12.5px;color:var(--var);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ext{font-size:11px;color:var(--var);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.price{font-weight:800;font-size:21px;letter-spacing:-.3px;font-variant-numeric:tabular-nums;white-space:nowrap}
.chip{direction:ltr;unicode-bidi:isolate;border-radius:9px;padding:3px 8px;font-size:13px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
.chip.pos,.pos{color:var(--pos)}.chip.neg,.neg{color:var(--neg)}
.chip.pos{background:rgba(52,199,89,.16)}.chip.neg{background:rgba(255,69,58,.15)}.chip.flat{background:var(--pill)}
`;

/* סקריפט בדף: לוגו לבן על רקע שקוף (FMP: UNH/UBER/APP) → הפוך לשחור על האריח הלבן; לוגו עם רקע לבן אטום (AAPL)
   לא נחשב "לבן" (לפחות 20% שקיפות). כישלון → האות הראשונה */
const SCRIPT = `
function light(img){try{if(/tradingview/.test(img.src))return false;var w=Math.min(64,img.naturalWidth),h=Math.min(64,img.naturalHeight);if(w<4||h<4)return false;
var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.drawImage(img,0,0,w,h);var d=x.getImageData(0,0,w,h).data,s=0,n=0;
for(var i=0;i<d.length;i+=4){if(d[i+3]>128){s+=d[i]*.299+d[i+1]*.587+d[i+2]*.114;n++;}}return n>=5&&n<=w*h*0.8&&s/n>225;}catch(e){return false;}}
window.__logos=Promise.all(Array.prototype.map.call(document.querySelectorAll('.logo img'),function(img){return new Promise(function(r){
function ok(){img.parentNode.classList.add('has');if(light(img))img.classList.add('inv');r();}
function bad(){img.remove();r();}
if(img.complete&&img.naturalWidth)ok();else if(img.complete)bad();else{img.onload=ok;img.onerror=bad;}setTimeout(r,4000);});}));
`;

function tagHTML(c, L, a) {
  if (c.src === 'ibkr') return '<span class="tag"><img src="' + a.ibkr + '" alt=""></span>';
  if (c.src === 'watch') return '<span class="tag watch">' + esc(L.watch) + '</span>';
  return '<span class="tag manual">' + esc(L.manual) + '</span>';
}
function cardHTML(c, L, a) {
  const logo = '<span class="logo"><span class="fb">' + esc(c.disp.charAt(0)) + '</span>' +
    (c.logo ? '<img crossorigin="anonymous" src="' + esc(c.logo) + '" alt="">' : '') + '</span>';
  const ext = c.sub ? '<div class="ext">' + esc(c.sub) + (c.subPct ? ' <span class="' + c.subDir + '">' + esc(c.subPct) + '</span>' : '') + '</div>' : '';
  return '<div class="card">' + logo +
    '<div class="id"><div class="r1"><span class="sym">' + esc(c.disp) + '</span>' + tagHTML(c, L, a) + '</div>' +
    '<div class="name">' + esc(c.name) + '</div>' + ext + '</div>' +
    '<div class="pc"><span class="price">' + esc(c.price) + '</span>' +
    (c.chg ? '<span class="chip ' + c.dir + '">' + esc(c.chg) + '</span>' : '') + '</div></div>';
}

function buildHtml(model, opts) {
  const a = assets();
  const theme = opts && opts.theme === 'light' ? 'light' : 'dark';
  const n = Math.max(1, Math.min(8, (opts && opts.n) || 3));
  const h = model.header;
  const mk = '<span class="mk' + (h.two ? ' two' : '') + '">' +
    '<span><span class="dot' + (h.live ? ' live' : '') + '"></span>' + esc(h.lines[0]) + '</span>' +
    (h.lines[1] ? '<span>' + esc(h.lines[1]) + '</span>' : '') + '</span>';
  // רווח בשורה אחת בין "השוק סגור ·" לסיבה
  const mkFixed = h.two ? mk : mk.replace('</span><span>', '</span>&nbsp;<span>');
  return '<!doctype html><html lang="' + model.lang + '" dir="' + model.dir + '"><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700;800&family=Roboto:wght@400;500;700;900&display=block">' +
    '<style>' + CSS + '</style></head><body class="' + theme + '"><div id="wrap"><div class="widget ' + theme + '">' +
    '<img class="hero" src="' + a.logo + '" alt="">' +
    '<div class="wh"><span class="upd">' + esc(model.updated) + '</span><span></span><span class="mkw">' + mkFixed + '</span></div>' +
    '<div class="list">' + model.cards.slice(0, n).map((c) => cardHTML(c, model.L, a)).join('') + '</div>' +
    '</div></div><script>' + SCRIPT + '</script></body></html>';
}

module.exports = { buildHtml, WIDTH, LOGO, esc };
