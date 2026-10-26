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
 * האלמנט שבמסך מלא. מופיע רק כשהדפדפן אמר שנמצא מה להוריד (window.__snbN, stateJs — מסמך חדש מבקש אותו ב־"!?").
 * נגיעה = "!dl" לדפדפן בלבד (BrowserActivity.bubbleTap). דף שמזייף את ההודעה — רק פותח את הרשימה, לא מוריד.
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

    /** הודעות מהסקריפט (חוץ מהמלבן): הכפתור על הנגן נלחץ / מסמך חדש מבקש את המצב (כמה נמצא, התווית) */
    const val TAP = "!dl"
    const val HELLO = "!?"

    /** המצב שהדפדפן שולח לדף: כמה אפשרויות הורדה נמצאו (0 = בלי כפתור) והתווית בשפת האפליקציה */
    fun stateJs(n: Int, label: String) = "window.__snbN=$n;window.__snbL=${org.json.JSONObject.quote(label)};window.__snbUp&&window.__snbUp();"

    const val JS = """(function(){try{
if(window.top!==window||window.__snbVid)return;var ch=window.snbVid;if(!ch)return;window.__snbVid=1;
var E=/youtube|youtu\.be|vimeo|dailymotion|wistia|jwplayer|brightcove|twitch|vidyard|kaltura|streamable|plugins\/video|player|embed|video/i;
var last=null,q=0,beat=0,host=null,btn=null,txt=null,box=null;
function vis(el){var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05;}
function mk(){
host=document.createElement('snb-dl');host.style.cssText='all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;display:none';
var root=host.attachShadow({mode:'closed'}),st=document.createElement('style');
st.textContent='button{all:initial;box-sizing:border-box;position:fixed;display:flex;align-items:center;gap:6px;height:34px;padding:0 14px 0 11px;border-radius:999px;background:#FF4656;color:#fff;font:600 14px/1 system-ui,-apple-system,Roboto,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:auto;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;transform:translateX(-50%)}button:active{filter:brightness(.88)}svg{width:18px;height:18px;flex:none}';
btn=document.createElement('button');btn.type='button';
var ns='http://www.w3.org/2000/svg',sv=document.createElementNS(ns,'svg'),pa=document.createElementNS(ns,'path');
sv.setAttribute('viewBox','0 0 24 24');pa.setAttribute('d','M12 4v10m-4.5-4.5L12 14l4.5-4.5M6 19h12');pa.setAttribute('fill','none');pa.setAttribute('stroke','#fff');pa.setAttribute('stroke-width','2.4');pa.setAttribute('stroke-linecap','round');pa.setAttribute('stroke-linejoin','round');
sv.appendChild(pa);txt=document.createElement('span');btn.appendChild(sv);btn.appendChild(txt);
['pointerdown','touchstart','mousedown'].forEach(function(e){btn.addEventListener(e,function(ev){ev.stopPropagation();},true);});
btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();ch.postMessage('!dl');},true);
root.appendChild(st);root.appendChild(btn);}
function place(){try{
var n=+window.__snbN||0;
if(!box||n<=0){if(host)host.style.display='none';return;}
if(!host)mk();
var fs=document.fullscreenElement||document.webkitFullscreenElement,par=(fs&&fs.tagName!=='VIDEO')?fs:document.documentElement;
if(host.parentNode!==par)par.appendChild(host);
var l=String(window.__snbL||'');if(txt.textContent!==l)txt.textContent=l;btn.dir=/[\u0590-\u05FF]/.test(l)?'rtl':'ltr';
var top=Math.max(box.top,0)+8,cx=Math.min(Math.max(box.left+box.width/2,70),innerWidth-70);
if(top+34>Math.min(box.top+box.height,innerHeight)){host.style.display='none';return;}
btn.style.top=top+'px';btn.style.left=cx+'px';host.style.display='block';
}catch(e){}}
window.__snbUp=place;
function pick(){q=0;try{
var vv=window.visualViewport,ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,W=vv?vv.width:innerWidth,H=vv?vv.height:innerHeight;
var best=null,ba=0,br=null,els=document.querySelectorAll('video,iframe');
for(var i=0;i<els.length&&i<80;i++){var el=els[i];
if(el.tagName==='IFRAME'&&!(E.test(el.src||'')||el.hasAttribute('allowfullscreen')||/fullscreen/.test(el.getAttribute('allow')||'')))continue;
var r=el.getBoundingClientRect();if(r.width<120||r.height<68)continue;
var x=r.left-ox,y=r.top-oy,ix=Math.max(0,Math.min(x+r.width,W)-Math.max(x,0)),iy=Math.max(0,Math.min(y+r.height,H)-Math.max(y,0)),a=ix*iy;
if(iy<40||a<Math.min(r.width*r.height*0.3,14400)||!vis(el))continue;
if(a>ba){ba=a;br=r;best=[x/W,y/H,r.width/W,r.height/H];}}
box=br;place();
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
