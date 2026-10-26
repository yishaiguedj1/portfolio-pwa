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

    const val JS = """(function(){try{
if(window.top!==window||window.__snbVid)return;var ch=window.snbVid;if(!ch)return;window.__snbVid=1;
var E=/youtube|youtu\.be|vimeo|dailymotion|wistia|jwplayer|brightcove|twitch|vidyard|kaltura|streamable|plugins\/video|player|embed|video/i;
var last=null,q=0,beat=0;
function vis(el){var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05;}
function pick(){q=0;try{
var vv=window.visualViewport,ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,W=vv?vv.width:innerWidth,H=vv?vv.height:innerHeight;
var best=null,ba=0,els=document.querySelectorAll('video,iframe');
for(var i=0;i<els.length&&i<80;i++){var el=els[i];
if(el.tagName==='IFRAME'&&!(E.test(el.src||'')||el.hasAttribute('allowfullscreen')||/fullscreen/.test(el.getAttribute('allow')||'')))continue;
var r=el.getBoundingClientRect();if(r.width<120||r.height<68)continue;
var x=r.left-ox,y=r.top-oy,ix=Math.max(0,Math.min(x+r.width,W)-Math.max(x,0)),iy=Math.max(0,Math.min(y+r.height,H)-Math.max(y,0)),a=ix*iy;
if(iy<40||a<Math.min(r.width*r.height*0.3,14400)||!vis(el))continue;
if(a>ba){ba=a;best=[x/W,y/H,r.width/W,r.height/H];}}
var s=best?best.map(function(v){return v.toFixed(4);}).join(','):'';
if(s!==last||++beat>=3){last=s;beat=0;ch.postMessage(s);}
}catch(e){}}
function sch(){if(!q){q=1;requestAnimationFrame(pick);}}
addEventListener('scroll',sch,{passive:true,capture:true});addEventListener('resize',sch);
if(window.visualViewport){visualViewport.addEventListener('scroll',sch);visualViewport.addEventListener('resize',sch);}
['play','loadedmetadata','playing'].forEach(function(e){document.addEventListener(e,sch,true);});
document.addEventListener('fullscreenchange',sch);
setInterval(sch,700);sch();
}catch(e){}})();"""
}
