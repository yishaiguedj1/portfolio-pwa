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
    const val MEDIA_TRIES = 5
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

    /** מה שהסקריפט בדף החזיר (‎EXTRACT) → כותרת, תמונה, כתובות הסרטון ומשך הסרטון של הדף (רק בצורה הצפויה) */
    data class Page(val title: String, val image: String, val urls: List<String>, val dur: Int = 0)

    fun parsePage(json: String?): Page? {
        val o = try { JSONObject(json ?: return null) } catch (e: Exception) { return null }
        val us = o.optJSONArray("u") ?: JSONArray()
        val urls = (0 until minOf(us.length(), 60)).mapNotNull { us.opt(it) as? String }.filter { it.length <= 4096 }
        val img = o.optString("i", "").let { if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(it) && it.length <= 2048) it else "" }
        // המשך שהדף מצהיר (JSON-LD) גובר; אורך הנגן — רק מדקה (נגן שמנגן פרסומת מראה את אורך הפרסומת)
        val ld = o.optDouble("d", 0.0).let { if (it.isFinite() && it in 1.0..360_000.0) it.toInt() else 0 }
        val vd = o.optDouble("vd", 0.0).let { if (it.isFinite() && it in 60.0..360_000.0) it.toInt() else 0 }
        return Page(DlProbe.clean(o.optString("t", ""), DlProbe.TITLE_MAX), img, urls, if (ld > 0) ld else vd)
    }

    /* 23/10/2026 (דיווח המשתמש: ב־buffett.cnbc.com נבחר "סרטון" של 1KB): לא כל קובץ וידאו בדף הוא הסרטון — יש פרסומות,
       תצוגות מקדימות וקבצים זעירים. קובץ שנמצא נבדק לפני שמציעים אותו */
    const val MIN_BYTES = 300_000L
    const val MIN_SEC = 8

    private fun sizeOf(s: JSONObject): Long {
        var m = 0L
        val q = s.optJSONArray("q") ?: JSONArray()
        for (i in 0 until q.length()) m = maxOf(m, q.optJSONObject(i)?.optLong("sz", 0) ?: 0)
        return m
    }
    private fun heightOf(s: JSONObject): Int {
        var m = 0
        val q = s.optJSONArray("q") ?: JSONArray()
        for (i in 0 until q.length()) m = maxOf(m, q.optJSONObject(i)?.optInt("h", 0) ?: 0)
        return m
    }

    /** כתובת של קובץ וידאו / רשימת זרם (לא דף) — בבדיקה שלה אין טעם בכתובות חלופיות */
    fun isMediaUrl(u: String): Boolean =
        Regex("^https?://[^?#]+\\.(m3u8|mpd|mp4|m4v|webm|mkv|mov|ts|flv)([?#].*)?$", RegexOption.IGNORE_CASE).matches(u.trim())

    /** הסרטון האמיתי ולא פרסומת / קובץ זעיר: לא קטן מ־300KB, לא קצר מ־8 שניות, ולא פחות מחצי מהמשך שהדף מצהיר */
    fun realVideo(s: JSONObject, pageDur: Int): Boolean {
        val d = s.optInt("d", 0); val sz = sizeOf(s)
        if (s.optInt("nv", 0) == 1) return false            // השרת של הקובץ אמר שזה דף / תמונה, לא וידאו (DlEngine.fillSize)
        if (sz in 1 until MIN_BYTES) return false
        if (d in 1 until MIN_SEC) return false
        if (pageDur >= 60 && d > 0 && d < pageDur / 2) return false
        return true
    }

    /** המשך תואם את מה שהדף מצהיר (±15%, לפחות 5 שניות) — זה הסרטון, לא צריך לחפש עוד */
    fun matches(s: JSONObject, pageDur: Int): Boolean {
        val d = s.optInt("d", 0)
        return pageDur > 0 && d > 0 && kotlin.math.abs(d - pageDur) <= maxOf(5, pageDur * 15 / 100)
    }

    /** מבין שני קבצים אמיתיים: התואם לדף קודם; שניהם תואמים — האיכות הגבוהה ביותר (גובה, ואז גודל);
     *  אחרת — הארוך (פרסומת קצרה), ואז הגבוה, ואז הגדול. (בקשת המשתמש: "תמיד את הקובץ האיכותי ביותר") */
    fun better(a: JSONObject, b: JSONObject?, pageDur: Int): Boolean {
        if (b == null) return true
        val ma = matches(a, pageDur); val mb = matches(b, pageDur)
        if (ma != mb) return ma
        val ka = if (ma) listOf(heightOf(a).toLong(), sizeOf(a), a.optInt("d", 0).toLong()) else listOf(a.optInt("d", 0).toLong(), heightOf(a).toLong(), sizeOf(a))
        val kb = if (mb) listOf(heightOf(b).toLong(), sizeOf(b), b.optInt("d", 0).toLong()) else listOf(b.optInt("d", 0).toLong(), heightOf(b).toLong(), sizeOf(b))
        for (i in ka.indices) if (ka[i] != kb[i]) return ka[i] > kb[i]
        return false
    }

    /** 23/10/2026 (דיווח המשתמש: הקובץ שירד מ־buffett.cnbc.com לא נפתח): תחילת הקובץ שירד — באמת וידאו?
     *  MP4/MOV/3GP ‏(ftyp/moov/mdat/free/wide בבתים 4–8), Matroska/WebM ‏(1A45DFA3), MPEG-TS ‏(0x47 כל 188), FLV, AVI */
    fun looksLikeVideo(b: ByteArray): Boolean {
        if (b.size < 12) return false
        val box = String(b, 4, 4, Charsets.ISO_8859_1)
        if (box in setOf("ftyp", "moov", "mdat", "free", "wide", "skip")) return true
        if (b[0] == 0x1A.toByte() && b[1] == 0x45.toByte() && b[2] == 0xDF.toByte() && b[3] == 0xA3.toByte()) return true
        if (b[0] == 0x47.toByte() && (b.size < 189 || b[188] == 0x47.toByte())) return true
        val head = String(b, 0, 4, Charsets.ISO_8859_1)
        if (head.startsWith("FLV")) return true
        if (head == "RIFF" && String(b, 8, 4, Charsets.ISO_8859_1) == "AVI ") return true
        return false
    }

    const val ALT_MAX = 8

    /** שאר הקבצים האמיתיים (מהטוב לפחות טוב) — באתר: "מקורות נוספים בדף". רק כתובת, גובה, משך וגודל */
    fun withAlt(best: JSONObject, goods: List<JSONObject>, pageDur: Int): JSONObject {
        val bu = best.optString("u", "")
        val rest = goods.filter { it !== best && it.optString("u", "") != bu }
            .sortedWith { x, y -> if (better(x, y, pageDur)) -1 else if (better(y, x, pageDur)) 1 else 0 }
        val arr = JSONArray()
        for (g in rest.take(ALT_MAX)) arr.put(JSONObject().put("u", g.optString("u", "").take(DlProbe.URL_MAX))
            .put("h", heightOf(g)).put("d", g.optInt("d", 0)).put("sz", sizeOf(g)))
        if (arr.length() > 0) best.put("alt", arr)
        return best
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
var out={t:'',i:'',u:[],d:0,vd:0},R=/\.(m3u8?|mpd|mp4|m4v|webm|mov)(\?|#|$)|format=m3u8|m3u8-aapl|mpd-time-csf/i,seen={};
function add(u){try{if(typeof u!=='string'||u.length>4096)return;u=new URL(u,location.href).href;if(u.indexOf('http')!==0||seen[u]||!R.test(u))return;seen[u]=1;out.u.push(u);}catch(e){}}
function meta(p){var m=document.querySelector('meta[property="'+p+'"],meta[name="'+p+'"]');return m?(m.getAttribute('content')||''):'';}
out.t=meta('og:title')||document.title||'';out.i=meta('og:image');
['og:video','og:video:url','og:video:secure_url','twitter:player:stream'].forEach(function(p){add(meta(p));});
function iso(s){var m=/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(s);return m?((+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+(+m[4]||0)):0;}
function walk(x,d){if(d>12||x==null)return;if(typeof x==='string'){add(x);return;}if(typeof x!=='object')return;
for(var k in x){try{var v=x[k];if(k==='duration'&&typeof v==='string'){var s=iso(v);if(s>out.d)out.d=s;continue;}
if(k==='contentUrl'||k==='url'||typeof v==='object'||typeof v==='string')walk(v,d+1);}catch(e){}}}
var ld=document.querySelectorAll('script[type="application/ld+json"]');for(var a=0;a<ld.length&&a<20;a++){try{walk(JSON.parse(ld[a].textContent),0);}catch(e){}}
var nx=document.getElementById('__NEXT_DATA__');if(nx&&nx.textContent.length<4000000){try{walk(JSON.parse(nx.textContent),0);}catch(e){}}
var v=document.querySelectorAll('video,source');for(var b=0;b<v.length;b++){var s=v[b].currentSrc||v[b].src;if(s&&s.indexOf('blob:')!==0)add(s);}
var vs=document.querySelectorAll('video');for(var c=0;c<vs.length;c++){try{var vdu=vs[c].duration;if(isFinite(vdu)&&vdu>out.vd)out.vd=vdu;vs[c].muted=true;var p=vs[c].play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
var playing=false;for(var e2=0;e2<vs.length;e2++)if(!vs[e2].paused)playing=true;
var nc=window.__snbClick||0;
if(!playing&&nc<3&&Date.now()-(window.__snbT||0)>3500){window.__snbClick=nc+1;window.__snbT=Date.now();
function vis(el){var r=el.getBoundingClientRect();return r.width>=20&&r.height>=20&&r.bottom>0&&r.top<innerHeight?r:null;}
var bt=null;
if(nc===0)bt=document.querySelector('.vjs-big-play-button,.jw-icon-display,.ytp-large-play-button,.plyr__control--overlaid,button[aria-label*="Play" i],[class*="play-button" i],[class*="PlayButton"],[class*="playButton"]');
if(!bt&&nc<=1){var best=0,all=document.querySelectorAll('button,[role="button"],a,div,span,svg');
for(var f=0;f<all.length&&f<4000;f++){var el=all[f],k=((el.getAttribute('class')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')).toLowerCase();
if(k.indexOf('play')<0||/playlist|display|player-?(wrap|container)|autoplay/.test(k))continue;var r=vis(el);if(!r)continue;var ar=r.width*r.height;if(ar>best&&ar<300000){best=ar;bt=el;}}}
if(!bt){var big=null,ba=0,ms=document.querySelectorAll('video,img,[class*="player" i],[class*="video" i]');
for(var g=0;g<ms.length&&g<500;g++){var r2=vis(ms[g]);if(r2&&r2.width*r2.height>ba){ba=r2.width*r2.height;big=r2;}}
if(big)bt=document.elementFromPoint(big.left+big.width/2,big.top+big.height/2);}
if(bt){try{bt.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}catch(e){try{bt.click();}catch(x){}}}}
return JSON.stringify(out);}catch(e){return '{}';}})()"""
}
