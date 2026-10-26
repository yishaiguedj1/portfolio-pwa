package io.github.yishaiguedj1.snowball

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

/**
 * 26/10/2026 (דיווח המשתמש: ביוטיוב, נגיעה בכפתור ההורדה כמה שניות אחרי שהדף עלה — "לפעמים חצי דקה, דקה עד שכל
 * הפרטים נטענים"): הבדיקה של yt-dlp בטלפון פותרת את בדיקת ה־JavaScript של יוטיוב ב־QuickJS — איטי. אבל הנגן של
 * יוטיוב כבר מחזיק בדף את רשימת הפורמטים (itag, קודק, גובה, גודל) — כאן קוראים אותה ברגע שהנגן עלה, ובונים ממנה את
 * אותו מידע ש־yt-dlp מחזיר (`formats`), כך שהסיכום (DlProbe.summarize), הרשימה והתפריט זהים.
 *
 * רק מספרים וקודים — לא כתובות של קבצים (הקישורים של יוטיוב חתומים וצריכים את yt-dlp בכל מקרה). ההורדה עצמה נשארת
 * של yt-dlp: ה־itag הוא אותו מזהה פורמט שלו, והבורר (DlProbe.selector) נופל לגובה כשהפורמט לא קיים אצלו.
 * הבדיקה המלאה ממשיכה ברקע ומחליפה את המידע הזה כשהיא מסתיימת (DmPre).
 */
object YtPage {
    /** רץ בדף (evaluateJavascript): הנגן הפעיל, ואם אין — הנתונים שהדף נטען איתם. מחזיר JSON קטן או null */
    const val JS = """(function(){try{var p=null,m=document.getElementById('movie_player');
if(m&&m.getPlayerResponse){try{p=m.getPlayerResponse();}catch(e){}}
if(!p||!p.streamingData)p=window.ytInitialPlayerResponse;
if(!p||!p.streamingData||!p.videoDetails)return null;
var v=p.videoDetails,s=p.streamingData,f=[].concat(s.adaptiveFormats||[],s.formats||[]).slice(0,80).map(function(x){
var a=x.audioTrack;return[x.itag||0,String(x.mimeType||'').slice(0,80),x.height||0,x.fps||0,String(x.contentLength||''),x.bitrate||0,
String(x.qualityLabel||'').slice(0,20),a?(a.audioIsDefault?1:2):0,x.isDrc?1:0];});
return JSON.stringify({id:String(v.videoId||''),t:String(v.title||'').slice(0,300),d:+v.lengthSeconds||0,
live:(v.isLive||v.isUpcoming)?1:0,f:f});}catch(e){return null;}})()"""

    private val ID = Regex("^[A-Za-z0-9_-]{11}$")
    private val ID_IN_URL = Regex("(?:[?&]v=|youtu\\.be/|/shorts/|/live/|/embed/)([A-Za-z0-9_-]{11})")

    /** מזהה הסרטון מהכתובת (watch?v=, youtu.be, shorts) — "" כשאין */
    fun idOf(url: String): String = ID_IN_URL.find(url)?.groupValues?.get(1) ?: ""

    fun isYt(url: String): Boolean {
        val h = Regex("^https?://([^/?#:]+)", RegexOption.IGNORE_CASE).find(url)?.groupValues?.get(1)?.lowercase() ?: return false
        return h == "youtu.be" || h == "youtube.com" || h.endsWith(".youtube.com")
    }

    /**
     * התשובה של evaluateJavascript (מחרוזת JSON של המחרוזת שהסקריפט החזיר) → מידע בצורה של ‎yt-dlp -J‎, או null:
     * לא יוטיוב, הנגן עוד לא עלה, שידור חי, או שהנגן מחזיק סרטון אחר מזה שבכתובת (מעבר בין סרטונים בלי טעינת דף)
     */
    fun toInfo(raw: String?, pageUrl: String): JSONObject? {
        if (raw == null || !isYt(pageUrl)) return null
        val want = idOf(pageUrl)
        if (want.isEmpty()) return null
        val txt = try { JSONTokener(raw).nextValue() as? String } catch (e: Throwable) { null } ?: return null
        val o = try { JSONObject(txt) } catch (e: Throwable) { return null }
        val id = o.optString("id")
        if (!ID.matches(id) || id != want || o.optInt("live") == 1) return null
        val dur = o.optDouble("d", 0.0).takeIf { it > 0 && it < 24 * 3600 } ?: return null
        val fs = o.optJSONArray("f") ?: return null
        val out = JSONArray()
        for (i in 0 until minOf(fs.length(), 80)) {
            val r = fs.optJSONArray(i) ?: continue
            fmt(r)?.let { out.put(it) }
        }
        if (out.length() == 0) return null
        return JSONObject()
            .put("id", id)
            .put("title", o.optString("t"))
            .put("duration", dur)
            .put("webpage_url", "https://www.youtube.com/watch?v=$id")
            .put("extractor_key", "Youtube")
            .put("formats", out)
    }

    private val MIME = Regex("^(video|audio)/([a-z0-9]+)(?:;\\s*codecs=\"([^\"]*)\")?", RegexOption.IGNORE_CASE)

    /** שורה אחת מהנגן → פורמט בצורה של yt-dlp. null = לא שימושי (בלי קודק או itag). בלי תלות בכתובת — בנגן של היום
     *  (SABR) לפורמטים לרוב אין כתובת בכלל, והרשימה היא כל מה שצריך לתפריט */
    private fun fmt(r: JSONArray): JSONObject? {
        val itag = r.optInt(0)
        if (itag <= 0 || itag > 9999) return null
        val m = MIME.find(r.optString(1)) ?: return null
        val kind = m.groupValues[1].lowercase()
        val ext = m.groupValues[2].lowercase().let { if (it == "mp4" && kind == "audio") "m4a" else it }
        val codecs = m.groupValues[3].split(',').map { it.trim() }.filter { it.isNotEmpty() }
        if (codecs.isEmpty()) return null
        val vc: String; val ac: String
        if (kind == "video") { vc = codecs[0]; ac = codecs.getOrNull(1) ?: "none" } else { vc = "none"; ac = codecs[0] }
        val track = r.optInt(7)
        // רצועת קול שאינה ברירת המחדל (דיבוב) — yt-dlp נותן לה מזהה אחר; לא מציעים אותה כאן (הבדיקה המלאה כן)
        if (track == 2) return null
        val note = listOfNotNull(if (r.optInt(8) == 1) "drc" else null, if (track == 1) "original" else null).joinToString(", ")
        val f = JSONObject()
            .put("format_id", itag.toString())
            .put("ext", ext)
            .put("vcodec", vc)
            .put("acodec", ac)
            .put("protocol", "https")
            .put("format_note", note)
            .put("dynamic_range", if (r.optString(6).contains("HDR", true)) "HDR" else "SDR")
        val len = r.optString(4).toLongOrNull() ?: 0L
        if (len > 0) f.put("filesize", len)
        val br = r.optLong(5)
        if (br > 0) f.put(if (kind == "audio") "abr" else "tbr", br / 1000.0)
        if (kind == "video") {
            val h = r.optInt(2); if (h > 0) f.put("height", h)
            val fps = r.optInt(3); if (fps > 0) f.put("fps", fps)
        }
        return f
    }
}
