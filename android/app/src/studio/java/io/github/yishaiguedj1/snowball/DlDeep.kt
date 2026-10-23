package io.github.yishaiguedj1.snowball

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

/**
 * 23/10/2026 (בקשת המשתמש: "למשוך ישירות כמו IDM, בלי דפדפן הציד"): "בדיקה לעומק" — החלק הטהור (נבדק ב־JVM).
 * IDM מוצא את הסרטון כי הוא בתוך דפדפן שכבר עבר את בדיקת "אתה לא רובוט" (IMDb = AWS WAF: ‏202 + אתגר JS) וכבר ביקש
 * את הקובץ. אצלנו: דפדפן נסתר בחלון ההורדה (DlActivity) טוען את הדף, ואז —
 *   1. yt-dlp שוב עם העוגיות וזהות הדפדפן (‎--cookies/‎--user-agent — כך ב־yt-dlp #16346 ל־IMDb);
 *   2. אם לא — כתובות הסרטון מתוך הדף (JSON-LD, ‏og:video, ‏__NEXT_DATA__, ‏<video>) ומהבקשות של הנגן (ניגון מושתק),
 *      ו־yt-dlp על הזרם שנמצא עם ה־Referer של הדף.
 * העוגיות נשארות בטלפון בלבד: קובץ זמני באחסון הפרטי של האפליקציה, נמחק אחרי ‎CK_TTL_MS‎. לא לאתר, לא לשרת, לא ללוגים.
 */
object DlDeep {
    const val DEEP_MS = 20_000L           // כל הבדיקה לעומק — ואז דפדפן הציד הגלוי
    const val SETTLE_MS = 1_500L          // אחרי שהדף נטען — זמן לאתגר ולנגן
    const val NO_FINISH_MS = 8_000L       // הדף לא סיים להיטען — מנסים בכל זאת עם מה שיש
    const val CK_TTL_MS = 30 * 60_000L    // ההורדה עצמה (אחרי בחירת האיכות) משתמשת באותן עוגיות
    const val MEDIA_TRIES = 3
    private val NAME = Regex("^[A-Za-z0-9!#%&'*+.^_`|~-]{1,200}$")

    /** שם הקובץ לפי האתר (רק אותיות, ספרות, נקודה ומקף) */
    fun hostKey(url: String?): String {
        val h = try { URI(url ?: "").host?.lowercase() } catch (e: Exception) { null } ?: return ""
        val k = h.removePrefix("www.")
        return if (Regex("^[a-z0-9.-]{1,253}$").matches(k)) k else ""
    }

    /** קובץ עוגיות בפורמט Netscape (מה ש־yt-dlp קורא ב־‎--cookies). jar = [(כתובת, כותרת Cookie מ־CookieManager)] */
    fun netscape(jar: List<Pair<String, String?>>, nowSec: Long): String {
        val sb = StringBuilder("# Netscape HTTP Cookie File\n")
        val seen = HashSet<String>()
        for ((url, header) in jar) {
            val host = hostKey(url)
            if (host.isEmpty() || header.isNullOrBlank()) continue
            for (part in header.split(';')) {
                val i = part.indexOf('=')
                if (i <= 0) continue
                val name = part.substring(0, i).trim(); val value = part.substring(i + 1).trim()
                if (name.isEmpty() || !NAME.matches(name) || value.any { it < ' ' || it == '\u007f' }) continue
                if (!seen.add("$host\t$name")) continue
                sb.append('.').append(host).append("\tTRUE\t/\tTRUE\t").append(nowSec + CK_TTL_MS / 1000)
                    .append('\t').append(name).append('\t').append(value).append('\n')
            }
        }
        return sb.toString()
    }

    /** מה שהסקריפט בדף החזיר (‎EXTRACT) → כותרת, תמונה וכתובות הסרטון (רק בצורה הצפויה) */
    data class Page(val title: String, val image: String, val urls: List<String>)

    fun parsePage(json: String?): Page? {
        val o = try { JSONObject(json ?: return null) } catch (e: Exception) { return null }
        val us = o.optJSONArray("u") ?: JSONArray()
        val urls = (0 until minOf(us.length(), 60)).mapNotNull { us.opt(it) as? String }.filter { it.length <= 4096 }
        val img = o.optString("i", "").let { if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(it) && it.length <= 2048) it else "" }
        return Page(DlProbe.clean(o.optString("t", ""), DlProbe.TITLE_MAX), img, urls)
    }

    /** הסיכום של הזרם שנמצא → הסיכום לאתר: כותרת ותמונה של הדף, והכתובת + ה־Referer שמהם מורידים */
    fun fromMedia(s: JSONObject, media: String, page: String, pg: Page?): JSONObject {
        val t = pg?.title ?: ""
        val generic = s.optString("t", "").let { it.isEmpty() || it == "video" || Regex("^(master|index|playlist|manifest|chunklist)", RegexOption.IGNORE_CASE).containsMatchIn(it) }
        if (t.isNotEmpty() && generic) s.put("t", t)
        s.put("u", media.take(DlProbe.URL_MAX))
        s.put("rf", page.take(DlProbe.URL_MAX))
        return s
    }

    /**
     * רץ בדף (evaluateJavascript), אחרי שנטען: מחזיר ‎{t, i, u:[…]}‎ ומנסה לנגן מושתק (כמו נגיעה של המשתמש ב"נגן" —
     * רק בתוך הבדיקה שהוא התחיל). לא שולח כלום לשום מקום ולא משנה את הדף מעבר לניגון.
     */
    const val EXTRACT = """(function(){try{
var out={t:'',i:'',u:[]},R=/\.(m3u8?|mpd|mp4|m4v|webm|mov)(\?|#|$)|format=m3u8|m3u8-aapl|mpd-time-csf/i,seen={};
function add(u){try{if(typeof u!=='string'||u.length>4096)return;u=new URL(u,location.href).href;if(u.indexOf('http')!==0||seen[u]||!R.test(u))return;seen[u]=1;out.u.push(u);}catch(e){}}
function meta(p){var m=document.querySelector('meta[property="'+p+'"],meta[name="'+p+'"]');return m?(m.getAttribute('content')||''):'';}
out.t=meta('og:title')||document.title||'';out.i=meta('og:image');
['og:video','og:video:url','og:video:secure_url','twitter:player:stream'].forEach(function(p){add(meta(p));});
function walk(x,d){if(d>12||x==null)return;if(typeof x==='string'){add(x);return;}if(typeof x!=='object')return;
for(var k in x){try{var v=x[k];if(k==='contentUrl'||k==='url'||typeof v==='object'||typeof v==='string')walk(v,d+1);}catch(e){}}}
var ld=document.querySelectorAll('script[type="application/ld+json"]');for(var a=0;a<ld.length&&a<20;a++){try{walk(JSON.parse(ld[a].textContent),0);}catch(e){}}
var nx=document.getElementById('__NEXT_DATA__');if(nx&&nx.textContent.length<4000000){try{walk(JSON.parse(nx.textContent),0);}catch(e){}}
var v=document.querySelectorAll('video,source');for(var b=0;b<v.length;b++){var s=v[b].currentSrc||v[b].src;if(s&&s.indexOf('blob:')!==0)add(s);}
var vs=document.querySelectorAll('video');for(var c=0;c<vs.length;c++){try{vs[c].muted=true;var p=vs[c].play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
if(!vs.length||vs[0].paused){var bt=document.querySelector('.vjs-big-play-button,.jw-icon-display,.ytp-large-play-button,.plyr__control--overlaid,button[aria-label*="Play" i],button[aria-label*="play" i],[class*="play-button" i]');
if(bt&&!window.__snbClick){window.__snbClick=1;try{bt.click();}catch(e){}}}
return JSON.stringify(out);}catch(e){return '{}';}})()"""
}
