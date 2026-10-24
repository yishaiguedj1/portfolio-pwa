package io.github.yishaiguedj1.snowball

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * 24/10/2026 — תרגום בטלפון, שלב 1 (הסרטון לא עוזב את הטלפון): הליבה בלי אנדרואיד (נבדקת ב־JVM — PhCoreTest).
 * Studio לאנדרואיד מחלץ את הקול (בלי קידוד), מודד את הסרטון (ffprobe) ואת חילופי השוטים (אותה פקודת scdet של vt shots),
 * מעלה רק אותם, ובסוף צורב את הכתוביות שהשרת בנה (he.ass) במקודד החומרה של הטלפון.
 *
 * קובץ המדידות = הצורה ש־translator/job.py ‏ph_meta_check מקבל (PH_V זהה בשני הצדדים):
 *   {"v":1, "probe": פלט ffprobe ‏-show_format -show_streams, "shots": {"threshold": 10, "shots": [{"t","score"}]}}
 */
object PhCore {
    const val PH_V = 1
    const val SHOT_TH = 10.0                       // ברירת המחדל של vt (settings.shot_threshold)
    const val SMALL_MB = 28                        // העותק לוואטסאפ — כמו SMALL_MB בעובד ובטופס

    /** השרתונים שהאפליקציה מדברת איתם — רשימה סגורה (הכתובת מגיעה מהאתר ב־intent). הראשון — גם גיבוי חם ל־Vercel */
    val HOSTS = listOf("https://api.thesnowball.app", "https://api-staging.thesnowball.app", "https://ibkr-proxy-wine.vercel.app")
    private const val VERCEL = "https://ibkr-proxy-wine.vercel.app"

    val JOB_RE = Regex("^j[A-Za-z0-9_-]{20}$")
    val KEY_RE = Regex("^[A-Za-z0-9_-]{43}$")
    val PID_RE = Regex("^p[0-9a-f]{16}$")

    fun hostOk(b: String?): Boolean = b != null && b in HOSTS

    /** השרתון לא ענה (לא קוד שגיאה — אין תשובה): השרתון של הייצור ← Vercel, כמו installFailover באתר */
    fun fallback(b: String): String? = if (b == HOSTS[0]) VERCEL else null

    // ---------------------------------------------------------------- המדידות
    private val SCD = Regex("""lavfi\.scd\.score:\s*([\d.]+),\s*lavfi\.scd\.time:\s*([\d.]+)""")

    /** הפלט של scdet (stderr של ffmpeg) → [(זמן, ציון)] — כמו vt/media.py ‏detect_shots */
    fun shots(stderr: String): List<Pair<Double, Double>> =
        SCD.findAll(stderr).mapNotNull { m ->
            val sc = m.groupValues[1].toDoubleOrNull(); val t = m.groupValues[2].toDoubleOrNull()
            if (sc == null || t == null) null else t to sc
        }.toList()

    fun meta(probe: JSONObject, shots: List<Pair<Double, Double>>, th: Double = SHOT_TH): JSONObject {
        val arr = JSONArray()
        for ((t, s) in shots) arr.put(JSONObject().put("t", t).put("score", s))
        return JSONObject().put("v", PH_V).put("probe", probe).put("shots", JSONObject().put("threshold", th).put("shots", arr))
    }

    class Info(val w: Int, val h: Int, val fpsNum: Long, val fpsDen: Long, val dur: Double, val base: Double,
               val vt0: Double, val at0: Double, val aCodec: String, val hasAudio: Boolean) {
        val fps: Double get() = fpsNum.toDouble() / fpsDen
        val fpsStr: String get() = "$fpsNum/$fpsDen"
    }

    private fun num(o: JSONObject?, k: String): Double = o?.optString(k, "")?.toDoubleOrNull() ?: 0.0

    private fun rational(s: String?): Pair<Long, Long>? {
        val p = (s ?: "").split('/')
        val n = p.getOrNull(0)?.toLongOrNull() ?: return null
        val d = if (p.size > 1) p[1].toLongOrNull() ?: return null else 1L
        return if (n > 0 && d > 0) n to d else null
    }

    /** מה שהצריבה צריכה מה־ffprobe — אותם כללים של vt/media.py ‏summarize (הסרטון הראשון שאינו תמונה מצורפת, הקול הראשון,
     *  ציר הזמן = ההתחלה המוקדמת ביותר) */
    fun info(probe: JSONObject): Info? {
        val st = probe.optJSONArray("streams") ?: return null
        var v: JSONObject? = null; var a: JSONObject? = null
        for (i in 0 until st.length()) {
            val s = st.optJSONObject(i) ?: continue
            if (v == null && s.optString("codec_type") == "video" && s.optJSONObject("disposition")?.optInt("attached_pic", 0) != 1) v = s
            if (a == null && s.optString("codec_type") == "audio") a = s
        }
        v ?: return null
        val w = v.optInt("width", 0); val h = v.optInt("height", 0)
        if (w < 16 || h < 16) return null
        val fr = rational(v.optString("avg_frame_rate")) ?: rational(v.optString("r_frame_rate")) ?: (25L to 1L)
        val fmt = probe.optJSONObject("format")
        val starts = listOfNotNull(num(fmt, "start_time"), num(v, "start_time"), a?.let { num(it, "start_time") })
        val base = starts.minOrNull() ?: 0.0
        return Info(w, h, fr.first, fr.second, num(fmt, "duration"), base, num(v, "start_time") - base,
            a?.let { num(it, "start_time") - base } ?: 0.0, a?.optString("codec_name") ?: "", a != null)
    }

    // ---------------------------------------------------------------- פקודות ffmpeg
    fun probeArgs(src: String) = listOf("-v", "error", "-print_format", "json", "-show_format", "-show_streams", src)

    /** הקול כמו שהוא (בלי קידוד) — Matroska מקבל כל קודק; הזמנים נשמרים יחסית לציר של הסרטון (העובד מתקן לפי t0) */
    fun audioArgs(src: String, out: String) =
        listOf("-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i", src, "-map", "0:a:0", "-vn", "-sn", "-dn", "-c:a", "copy", "-f", "matroska", out)

    /** חילופי השוטים — בדיוק הפקודה של vt (scale=320 + scdet=10) */
    fun shotsArgs(src: String, th: Double = SHOT_TH) =
        listOf("-hide_banner", "-nostats", "-nostdin", "-loglevel", "info", "-i", src, "-map", "0:v:0", "-vf", "scale=320:-2,scdet=threshold=${fmt(th)}", "-an", "-f", "null", "-")

    /** גודל הצריבה: המקור, או לוואטסאפ — עד 720p (צד קצר), זוגי */
    fun outSize(i: Info, small: Boolean): Pair<Int, Int> {
        if (!small || minOf(i.w, i.h) <= 720) return (i.w and 1.inv()) to (i.h and 1.inv())
        val k = 720.0 / minOf(i.w, i.h)
        return ((i.w * k).toInt() and 1.inv()) to ((i.h * k).toInt() and 1.inv())
    }

    /** קצב הווידאו: כמו המקור (‏90%, 2–20Mbps); לוואטסאפ — מה שנכנס ב־SMALL_MB פחות הקול (96k), לפחות 300k */
    fun bitrate(size: Long, dur: Double, small: Boolean): Int {
        val d = maxOf(1.0, dur)
        return if (small) ((SMALL_MB * 1_000_000.0 * 8 * 0.92 / d) - 96_000).toInt().coerceIn(300_000, 8_000_000)
        else (size * 8 / d * 0.9).toLong().coerceIn(2_000_000, 20_000_000).toInt()
    }

    /** ffmpeg מפענח וצורב את הכתוביות (libass) ומוציא פריימים nv12 בקצב קבוע — MediaCodec של האפליקציה מקודד.
     *  ציר הזמן: ffmpeg כבר מזיז הכל לפי ההתחלה של הקובץ (format.start_time = הבסיס של media.summarize), ו־cfr משלים
     *  בפריים הראשון את הזמן עד שהווידאו מתחיל — פריים i = הבסיס + i/fps, כמו זמני ה־ASS.
     *  24/10/2026 (בטלפון: הווידאו איחר ב־5 שנ׳): עד עכשיו גם setpts=PTS-base (הבסיס הוחסר פעמיים — בקובץ שמתחיל
     *  אחרי 0 נחתך ההתחלה) וגם ‎-itsoffset vt0‎ באריזה (הפער שכבר הושלם נוסף שוב). שניהם הוסרו. */
    fun burnArgs(src: String, ass: String, fonts: String, i: Info, w: Int, h: Int): List<String> {
        val vf = buildList {
            add("subtitles=filename=${esc(ass)}:fontsdir=${esc(fonts)}")
            add("scale=$w:$h")
            add("format=nv12")
        }.joinToString(",")
        return listOf("-hide_banner", "-nostdin", "-loglevel", "error", "-i", src, "-map", "0:v:0", "-vf", vf,
            "-fps_mode", "cfr", "-r", i.fpsStr, "-an", "-sn", "-f", "rawvideo", "-pix_fmt", "nv12", "pipe:1")
    }

    /** הווידאו שקודד (מתחיל בבסיס — burnArgs) + הקול מהמקור, שנשאר במקומו יחסית לבסיס (ffmpeg מזיז כל קלט לפי ההתחלה שלו).
     *  בלי ‎-itsoffset‎. copy כשאפשר; לוואטסאפ (או כשהעתקה נכשלה) — AAC */
    fun muxArgs(video: String, src: String, out: String, i: Info, aac: Boolean): List<String> = buildList {
        addAll(listOf("-hide_banner", "-nostdin", "-y", "-loglevel", "error"))
        addAll(listOf("-i", video, "-i", src, "-map", "0:v:0"))
        if (i.hasAudio) addAll(listOf("-map", "1:a:0"))
        addAll(listOf("-c:v", "copy"))
        if (i.hasAudio) addAll(if (aac) listOf("-c:a", "aac", "-b:a", "96k") else listOf("-c:a", "copy"))
        addAll(listOf("-movflags", "+faststart", out))
    }

    /** קודק קול שנכנס ל־MP4 בלי קידוד (אחרת — AAC) */
    fun mp4Audio(codec: String) = codec in setOf("aac", "mp3", "opus", "flac", "alac", "ac3", "eac3")

    private fun esc(p: String) = p.replace("\\", "/").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")
    fun fmt(x: Double): String = String.format(Locale.ROOT, "%.6f", x).trimEnd('0').trimEnd('.').ifEmpty { "0" }

    /** שם התוצר ב־Movies/Studio */
    fun outName(name: String, small: Boolean): String {
        val base = name.substringBeforeLast('.').ifBlank { "video" }.replace(Regex("""[\\/:*?"<>|\u0000-\u001f]"""), "_").take(90).trim()
        return base + (if (small) " — עברית קטן" else " — עברית") + ".mp4"
    }

    // ---------------------------------------------------------------- העלאה בחלקים (R2 — studior2.js)
    /** חלק n (מ־1) של קובץ בגודל size בחלקים של ps */
    fun part(n: Int, ps: Long, size: Long): LongRange {
        val a = (n - 1) * ps
        return a until minOf(size, a + ps)
    }

    fun parts(size: Long, ps: Long): Int = ((size + ps - 1) / ps).toInt()

    // ---------------------------------------------------------------- מסירה לאתר
    /** ‎#phpick=<pid>.<base64url של JSON> — מה שהטופס צריך כדי ליצור את העבודה (השם, הגודל, האורך, המידות) */
    fun pickJson(pid: String, name: String, size: Long, i: Info?): JSONObject = JSONObject().put("pid", pid).put("name", name.take(200)).put("size", size)
        .put("dur", i?.dur ?: 0.0).put("w", i?.w ?: 0).put("h", i?.h ?: 0).put("fps", i?.fps ?: 0.0).put("a", i?.hasAudio ?: false)
}
