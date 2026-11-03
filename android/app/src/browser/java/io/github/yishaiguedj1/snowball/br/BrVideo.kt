package io.github.yishaiguedj1.snowball.br

/**
 * 26/10/2026 (בקשת המשתמש: "שהבועה תהיה צמודה לחלק העליון הימני של הנגן ותיעלם כשאין וידאו על המסך — כמו IDM"):
 * איפה הנגן שעל המסך. סקריפט שרץ רק במסגרת הראשית של הדף (גם window.snbVid נבדק במסגרת הראשית בלבד — isMainFrame),
 * מוצא את הנגן הגדול ביותר שנראה עכשיו: <video>, או <iframe> של נגן מוטמע (יוטיוב, Vimeo… או מסגרת עם מסך מלא),
 * ושולח את המלבן שלו ביחס לאזור הנראה (visualViewport — נכון גם בהגדלה בצביטה) — רק כשהוא השתנה.
 * "על המסך" = לפחות 40 פיקסלים בגובה ו־30% מהנגן (או 160×90) גלויים. אין נגן כזה = מחרוזת ריקה → הבועה נעלמת.
 * הסקריפט לא שולח שום דבר מחוץ לאפליקציה — רק ארבעה מספרים לדפדפן עצמו.
 * 26/10/2026 (דיווח המשתמש: ביוטיוב הבועה לא הופיעה): גם בלי שינוי — שוב כל ~2 שניות, כי טעינת דף מאפסת את המיקום
 * אצל הדפדפן (onPageStarted), ודיווח שהגיע לפני האיפוס אבד — נגן שלא זז לא דיווח שוב לעולם.
 * 26/10/2026 (בקשת המשתמש: "לא בועה מרחפת — תמיד צמוד לחלק העליון של הסרטון"): הבועה של Compose מעל ה־WebView לא
 * הופיעה בטלפון (גם לא ב־Vimeo), ולכן הכפתור עצמו בתוך הדף — כמו הפס של IDM: גלולה אדומה "הורדת הסרטון" באמצע החלק
 * העליון של הנגן, בתוך shadow DOM סגור (עיצוב האתר לא נוגע בו), position:fixed שמתעדכן בכל גלילה, ובמסך מלא — בתוך
 * האלמנט שבמסך מלא. מופיע רק כשהדפדפן אמר שנמצא מה להוריד (stateJs — מסמך חדש מבקש אותו ב־"!?").
 * 26/10/2026 (בקשת המשתמש, לפי התצוגה המקדימה): נגיעה בכפתור פותחת תפריט נגלל בעיצוב של Apple מתחתיו (או מעליו כשאין
 * מקום) — האיכויות עם הגודל, קול בלבד, להוריד ולתרגם ב־Studio, ועוד אפשרויות (= מנהל ההורדות). האיכויות מהבדיקה שכבר
 * רצה ברקע (DmPre), ובחירה מתחילה את ההורדה בלי לצאת מהדף. בלי תפריט מוכן — הנגיעה פותחת את מנהל ההורדות כמו קודם.
 * נגיעה = "!dl" לדפדפן בלבד (BrowserActivity.bubbleTap). דף שמזייף את ההודעה — רק פותח את הרשימה, לא מוריד.
 * 03/11/2026 (בקשת המשתמש: "רק סימן של הורדה וזהו, נקי, בצד הימני העליון של הוידאו, שלא יסתיר את הנגן"): במקום הגלולה
 * באמצע — עיגול קטן עם חץ בלבד בפינה הימנית העליונה של הנגן (התווית נשארת לקורא המסך), והתפריט נפתח מיושר לפינה.
 * ונגן מוטמע (מסגרת) — הסקריפט שולח גם את הכתובת שלו ("!f:<src>"), כי בחיפוש של גוגל הדף עצמו אינו סרטון (BrTab.embed).
 * 03/11/2026 (בקשת המשתמש: "תמיד כשמוצג וידאו על המסך — אופציה להוריד אותו, חוץ מפרסומות"): הסקריפט אומר גם אם מה שעל
 * המסך הוא נגן אמיתי ("!k:1" — ‏<video> או מסגרת של נגן מוכר; "!k:0" = אין), ואז הדף עצמו נבדק ב־yt-dlp (BrTab.live).
 * פרסומת לא נחשבת נגן בכלל (גם לא למיקום — הכפתור נעלם בזמן פרסומת), לפי שלושה סימנים: (1) מחלקה/מזהה של מכל פרסומת
 * אצל הנגן או אחד מעשרת ההורים שלו (`AD` — ‏ad-showing, ‏ima-ad-container, ‏vjs-ad-playing, ‏jw-flag-ads, ‏preroll, ‏outstream…);
 * (2) מקור הווידאו / המסגרת מרשת פרסום (`AH`, כמו HuntMedia.NOISE ו־BrShield.ADS); (3) וידאו מוגן (EME, ‏mediaKeys) — לא נגן
 * "אמיתי" כי אי אפשר להוריד אותו (עדיין ממוקם, אם נמצא בו משהו אחר).
 */
object BrVideo {
    /** [x, y, רוחב, גובה] כחלקים מהאזור הנראה של הדף; null = אין נגן על המסך */
    fun parse(s: String?): FloatArray? {
        val p = (s ?: return null).split(',')
        if (p.size != 4) return null
        val v = FloatArray(4) { p[it].toFloatOrNull() ?: return null }
        if (v.any { it.isNaN() || it < -10f || it > 10f } || v[2] <= 0f || v[3] <= 0f) return null
        return v
    }

    /** הודעות מהסקריפט (חוץ מהמלבן): הכפתור על הנגן נלחץ / מסמך חדש מבקש את המצב / בחירה מהתפריט ("!q:<מפתח>:<בחירה>") */
    const val TAP = "!dl"
    const val HELLO = "!?"
    const val PICK = "!q:"
    const val FRAME = "!f:"
    const val LIVE = "!k:"

    /** המקורות של מסגרת יוטיוב מוטמעת — רק בהן רץ YT_FRAME, ורק מהן מתקבלות הודעות "snbYt" */
    val YT_ORIGINS = setOf("https://www.youtube.com", "https://www.youtube-nocookie.com")
    const val FRAME_URL = "!u:"

    /**
     * 03/11/2026 (דיווח המשתמש: מהחיפוש של גוגל — התפריט על הנגן "מתחיל לטעון ולא נטען"): בדף של יוטיוב האיכויות נקראות
     * מהנגן שבדף (YtPage.JS) מיד; בנגן מוטמע הוא במסגרת של מקור אחר, ונשארה רק הבדיקה של yt-dlp (חצי דקה עד דקה ויותר).
     * לכן אותה קריאה רצה בתוך מסגרת ה־embed עצמה (סקריפט בתחילת המסמך, רק במקורות של יוטיוב, רק ב־/embed/, לא במסגרת
     * הראשית), כל שנייה וחצי עד שהנגן מחזיק את רשימת הפורמטים, ונשלחת לדפדפן (BrowserActivity.ytFrame → DmPre.seed)
     * 03/11/2026 (דיווח שני בסרטון): (1) קודם כל המסגרת שולחת את הכתובת שלה ("!u:") — בקשת המסגרת עוברת לפעמים דרך
     * ה־Service Worker של יוטיוב ולא נראתה, ובלי הנגן המוטמע הדף של גוגל נבדק, נכשל, והכפתור נעלם. (2) נגן שעוד לא ניגן
     * לא מחזיק פורמטים — אחרי ~4 שניות המסגרת מבקשת אותם בעצמה מאותו שרת (‏/youtubei/v1/player, אותה בקשה של הנגן,
     * עם המפתח וההקשר שבדף — ytcfg), פעם אחת, והתוצאה נקראת כמו ytInitialPlayerResponse
     */
    val YT_FRAME: String get() = "(function(){try{if(window.top===window||!/^\\/embed\\//.test(location.pathname))return;var ch=window.snbYt;" +
        "if(!ch||window.__snbYt)return;window.__snbYt=1;var n=0,last='',asked=0;ch.postMessage('!u:'+String(location.href).slice(0,2048));" +
        "function ask(){try{var c=window.ytcfg&&ytcfg.get?ytcfg:null,m=location.pathname.match(/\\/embed\\/([A-Za-z0-9_-]{11})/);if(!c||!m||!window.fetch)return;" +
        "var k=c.get('INNERTUBE_API_KEY'),cx=c.get('INNERTUBE_CONTEXT');if(!cx)return;" +
        "fetch('/youtubei/v1/player?prettyPrint=false'+(k?'&key='+encodeURIComponent(k):''),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}," +
        "body:JSON.stringify({context:cx,videoId:m[1]})}).then(function(r){return r.json();}).then(function(p){" +
        "if(p&&p.streamingData&&p.videoDetails&&!(window.ytInitialPlayerResponse&&window.ytInitialPlayerResponse.streamingData))window.ytInitialPlayerResponse=p;},function(){});}catch(e){}}" +
        "function go(){var r=null;try{r=" + io.github.yishaiguedj1.snowball.YtPage.JS + ";}catch(e){}" +
        "if(r&&r!==last&&r.length<200000){last=r;ch.postMessage(r);}else if(!r&&n>=2&&!asked){asked=1;ask();}if(++n<120)setTimeout(go,1500);}" +
        "setTimeout(go,600);}catch(e){}})();"

    private val YT_EMBED = Regex("^https?://(?:www\\.|m\\.)?youtube(?:-nocookie)?\\.com/embed/([A-Za-z0-9_-]{11})(?:[/?#]|$)", RegexOption.IGNORE_CASE)
    private val VIMEO_EMBED = Regex("^https?://player\\.vimeo\\.com/video/(\\d{4,})(?:[/?#]|$)", RegexOption.IGNORE_CASE)
    private val DM_EMBED = Regex("^https?://(?:www\\.|geo\\.)?dailymotion\\.com/(?:embed/video/|player\\.html\\?video=)([A-Za-z0-9]{5,})", RegexOption.IGNORE_CASE)

    /**
     * כתובת של נגן מוטמע (המסגרת שבדף) → כתובת הצפייה הרגילה של הסרטון (מה ש־yt-dlp ומנהל ההורדות מכירים); null = לא נגן מוכר.
     * רק שלושה אתרים, ורק המזהה — דף שמזייף "!f:" מקבל לכל היותר כתובת צפייה ביוטיוב/Vimeo/Dailymotion
     */
    fun embedOf(url: String?): String? {
        val u = url?.trim()?.takeIf { it.length <= 2048 } ?: return null
        YT_EMBED.find(u)?.let { return "https://www.youtube.com/watch?v=" + it.groupValues[1] }
        VIMEO_EMBED.find(u)?.let { return "https://vimeo.com/" + it.groupValues[1] }
        DM_EMBED.find(u)?.let { return "https://www.dailymotion.com/video/" + it.groupValues[1] }
        return null
    }

    /**
     * המצב שהדפדפן שולח לדף: כמה אפשרויות הורדה נמצאו (0 = בלי כפתור), התווית, והתפריט (DmPre.menu; ‏{"w":1} = עוד בודק,
     * null = אין — נגיעה פותחת את מנהל ההורדות כמו קודם). `key` = מפתח אקראי של הטאב: בחירה מהתפריט נשלחת איתו, והוא נשמר
     * רק בתוך הסקריפט (__snbUp לא ניתן להחלפה) — דף שמזייף "!q:" בלי המפתח לא מתחיל הורדה
     */
    fun stateJs(n: Int, label: String, menu: String = "null", key: String = "") =
        "window.__snbUp&&window.__snbUp($n,${org.json.JSONObject.quote(label)},$menu,${org.json.JSONObject.quote(key)});"

    /** "!q:<מפתח>:<בחירה>" → הבחירה, רק כשהמפתח נכון */
    fun pickOf(d: String, key: String): String? {
        if (!d.startsWith(PICK) || key.isEmpty()) return null
        val r = d.removePrefix(PICK)
        val i = r.indexOf(':')
        if (i <= 0 || r.substring(0, i) != key) return null
        return r.substring(i + 1).takeIf { it.length in 1..8 && it.all { c -> c.isLetterOrDigit() } }
    }

    const val JS = """(function(){try{
if(window.top!==window||window.__snbVid)return;var ch=window.snbVid;if(!ch)return;window.__snbVid=1;
var E=/youtube|youtu\.be|vimeo|dailymotion|wistia|jwplayer|brightcove|twitch|vidyard|kaltura|streamable|plugins\/video|player|embed|video/i;
var AD=/\b(ad-showing|ad-interrupting|ima-ad-container|vjs-ad-playing|vjs-ad-loading|jw-flag-ads|pre-?roll|mid-?roll|outstream|video-?ads?|ad-?container|ad-?slot|ad-?player|adsbygoogle)\b/i;
var AH=/(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|imasdk\.googleapis\.com|2mdn\.net|innovid\.com|teads\.tv|spotx\.tv|spotxchange\.com|springserve\.com|fwmrm\.net|adsrvr\.org|adnxs\.com|serving-sys\.com|tremorhub\.com|smartadserver\.com|moatads\.com|amazon-adsystem\.com)$/i;
function hostOf(u){try{return /^https?:/i.test(u)?new URL(u,location.href).hostname:'';}catch(e){return '';}}
function isAd(el){var s=el.tagName==='IFRAME'?(el.src||''):(el.currentSrc||el.src||'');if(AH.test(hostOf(s)))return true;
for(var p=el,i=0;p&&p.nodeType===1&&i<11;p=p.parentNode,i++){if(AD.test((p.getAttribute('class')||'')+' '+(p.id||'')))return true;}return false;}
var last=null,lf='',lk=null,bx=null,q=0,beat=0,host=null,btn=null,box=null,N=0,L='',M=null,K='',menu=null,open=false;
function vis(el){var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05;}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function mk(){
host=document.createElement('snb-dl');host.style.cssText='all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;display:none';
var root=host.attachShadow({mode:'closed'}),st=document.createElement('style');
st.textContent='button{all:initial;box-sizing:border-box;position:fixed;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(255,70,86,.9);-webkit-backdrop-filter:blur(10px) saturate(180%);backdrop-filter:blur(10px) saturate(180%);box-shadow:inset 0 0 0 .8px rgba(255,255,255,.35),0 2px 8px rgba(0,0,0,.28);pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;transform:scale(1);transition:transform .18s cubic-bezier(.2,.9,.3,1.2),opacity .2s;opacity:1}button::before{content:"";position:absolute;inset:-8px}button:active{transform:scale(.9)}svg{width:18px;height:18px;flex:none}'+
'.m{position:fixed;box-sizing:border-box;width:270px;max-width:calc(100vw - 24px);overflow:auto;overscroll-behavior:contain;pointer-events:auto;border-radius:18px;padding:6px 0;background:rgba(248,248,250,.985);-webkit-backdrop-filter:blur(40px) saturate(180%);backdrop-filter:blur(40px) saturate(180%);box-shadow:0 0 0 .5px rgba(0,0,0,.10),0 18px 50px rgba(0,0,0,.28),0 4px 12px rgba(0,0,0,.10);color:#1c1c1e;font:400 16px/1.25 -apple-system,system-ui,Roboto,sans-serif;transform-origin:100% 0;animation:in .22s cubic-bezier(.2,.9,.3,1.1);-webkit-tap-highlight-color:transparent}'+
'.m.up{transform-origin:100% 100%}@keyframes in{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}'+
'.h{padding:9px 16px 4px;font-size:13px;color:#8a8a8e}.r{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 16px;cursor:pointer}.r:active{background:rgba(0,0,0,.07)}'+
'.r .t{flex:1}.r .s{color:#8a8a8e;font-size:15px;direction:ltr;unicode-bidi:isolate}.sep{height:.5px;margin:4px 0;background:rgba(60,60,67,.24)}.st{color:#ff4656;font-weight:600}.w{color:#8a8a8e;justify-content:center;cursor:default}.w:active{background:none}'+
'.sp{width:16px;height:16px;border:2px solid rgba(138,138,142,.35);border-top-color:#8a8a8e;border-radius:50%;animation:rot .8s linear infinite}@keyframes rot{to{transform:rotate(360deg)}}'+
'@media (prefers-color-scheme:dark){.m{background:rgba(37,37,40,.97);color:#f2f2f7;box-shadow:0 0 0 .5px rgba(255,255,255,.12),0 18px 50px rgba(0,0,0,.55)}.r:active{background:rgba(255,255,255,.10)}.sep{background:rgba(84,84,88,.6)}.h,.r .s,.w{color:#98989f}}';
btn=document.createElement('button');btn.type='button';
var ns='http://www.w3.org/2000/svg',sv=document.createElementNS(ns,'svg'),pa=document.createElementNS(ns,'path');
sv.setAttribute('viewBox','0 0 24 24');pa.setAttribute('d','M12 3.5v11.5m-5-5 5 5 5-5M5.5 20h13');pa.setAttribute('fill','none');pa.setAttribute('stroke','#fff');pa.setAttribute('stroke-width','2.2');pa.setAttribute('stroke-linecap','round');pa.setAttribute('stroke-linejoin','round');
sv.appendChild(pa);btn.appendChild(sv);
menu=el('div','m');menu.style.display='none';
['pointerdown','touchstart','mousedown'].forEach(function(e){btn.addEventListener(e,function(ev){ev.stopPropagation();},true);menu.addEventListener(e,function(ev){ev.stopPropagation();},true);});
btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();if(!M){ch.postMessage('!dl');return;}open=!open;draw();place();},true);
menu.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();var r=ev.target.closest&&ev.target.closest('[data-k]');if(!r)return;var k=r.getAttribute('data-k');open=false;place();
if(k==='+')ch.postMessage('!dl');else ch.postMessage('!q:'+K+':'+k);},true);
document.addEventListener('pointerdown',function(ev){if(open&&ev.target!==host){open=false;place();}},true);
root.appendChild(st);root.appendChild(btn);root.appendChild(menu);}
function row(k,t,s,c){var r=el('div','r'+(c?' '+c:''));if(k)r.setAttribute('data-k',k);r.appendChild(el('span','t',t));if(s)r.appendChild(el('span','s',s));return r;}
function draw(){if(!menu)return;menu.textContent='';if(!M)return;menu.dir=btn.dir;
if(M.w){var w=el('div','r w');w.appendChild(el('span','sp'));menu.appendChild(w);}
else{var v=M.v||[];if(v.length){menu.appendChild(el('div','h',M.hv||''));for(var i=0;i<v.length;i++)menu.appendChild(row(String(v[i].k),String(v[i].t),String(v[i].s||'')));}
if(M.a){menu.appendChild(el('div','h',M.ha||''));menu.appendChild(row(String(M.a.k),String(M.a.t),String(M.a.s||'')));}
if(M.tr){menu.appendChild(el('div','sep'));menu.appendChild(row(String(M.tk),String(M.tr),'','st'));}}
menu.appendChild(el('div','sep'));menu.appendChild(row('+',String(M.more||'…')));}
function up(n,l,m,k){N=+n||0;L=String(l||'');var was=M?JSON.stringify(M):'';M=(m&&typeof m==='object')?m:null;if(k)K=String(k);
if(!M||N<=0)open=false;if(menu&&open&&JSON.stringify(M)!==was)draw();place();}
try{Object.defineProperty(window,'__snbUp',{value:up,writable:false,configurable:false});}catch(e){window.__snbUp=up;}
function tl(el){for(var p=el;p&&p.nodeType===1;p=p.parentElement){try{if(p.matches(':modal'))return p;}catch(e){}try{if(p.matches(':popover-open'))return p;}catch(e){}}return null;}
function place(){try{
if(!box||N<=0){if(host)host.style.display='none';open=false;return;}
if(!host)mk();
var fs=document.fullscreenElement||document.webkitFullscreenElement,par=(fs&&fs.tagName!=='VIDEO')?fs:(tl(bx)||document.documentElement);
if(host.parentNode!==par)par.appendChild(host);
if(btn.getAttribute('aria-label')!==L){btn.setAttribute('aria-label',L);btn.title=L;}btn.dir=/[\u0590-\u05FF]/.test(L)?'rtl':'ltr';
var top=Math.max(box.top,0)+8,rx=Math.min(box.left+box.width,innerWidth)-8;
if(top+40>Math.min(box.top+box.height,innerHeight)||rx-32<Math.max(box.left,0)){host.style.display='none';open=false;return;}
host.style.display='block';var o=host.getBoundingClientRect(),ox=o.left,oy=o.top;
btn.style.top=(top-oy)+'px';btn.style.left=(rx-32-ox)+'px';
if(!open){menu.style.display='none';return;}
if(menu.style.display==='none'){menu.style.display='block';draw();}
var mw=menu.offsetWidth,below=innerHeight-(top+40)-12,above=top-12,ub=below<200&&above>below;
menu.classList.toggle('up',ub);menu.style.maxHeight=Math.max(120,ub?above:below)+'px';
menu.style.left=(Math.min(Math.max(rx-mw,12),innerWidth-mw-12)-ox)+'px';
menu.style.bottom='';menu.style.top=((ub?top-8-menu.offsetHeight:top+40)-oy)+'px';
}catch(e){}}
function pick(){q=0;try{
var vv=window.visualViewport,ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,W=vv?vv.width:innerWidth,H=vv?vv.height:innerHeight;
var best=null,ba=0,br=null,be=null,bf='',bk=false,els=document.querySelectorAll('video,iframe');
for(var i=0;i<els.length&&i<80;i++){var el=els[i];
if(el.tagName==='IFRAME'&&!(E.test(el.src||'')||el.hasAttribute('allowfullscreen')||/fullscreen/.test(el.getAttribute('allow')||'')))continue;
var r=el.getBoundingClientRect();if(r.width<120||r.height<68)continue;
var x=r.left-ox,y=r.top-oy,ix=Math.max(0,Math.min(x+r.width,W)-Math.max(x,0)),iy=Math.max(0,Math.min(y+r.height,H)-Math.max(y,0)),a=ix*iy;
if(iy<40||a<Math.min(r.width*r.height*0.3,14400)||!vis(el)||isAd(el))continue;
if(a>ba){ba=a;br=r;be=el;bf=el.tagName==='IFRAME'?String(el.src||''):'';bk=el.tagName==='VIDEO'?!el.mediaKeys:E.test(el.src||'');best=[x/W,y/H,r.width/W,r.height/H];}}
box=br;bx=be;if(bf&&bf!==lf&&/^https?:/.test(bf)){lf=bf;ch.postMessage('!f:'+bf.slice(0,2048));}
var k=best&&bk?'!k:1':'!k:0';if(k!==lk||beat>=2){lk=k;ch.postMessage(k);}place();
var s=best?best.map(function(v){return v.toFixed(4);}).join(','):'';
if(s!==last||++beat>=3){last=s;beat=0;ch.postMessage(s);}
}catch(e){}}
function sch(){if(!q){q=1;requestAnimationFrame(pick);}}
addEventListener('scroll',sch,{passive:true,capture:true});addEventListener('resize',sch);
if(window.visualViewport){visualViewport.addEventListener('scroll',sch);visualViewport.addEventListener('resize',sch);}
['play','loadedmetadata','playing'].forEach(function(e){document.addEventListener(e,sch,true);});
document.addEventListener('fullscreenchange',sch);
ch.postMessage('!?');setInterval(sch,700);sch();
}catch(e){}})();"""
}
