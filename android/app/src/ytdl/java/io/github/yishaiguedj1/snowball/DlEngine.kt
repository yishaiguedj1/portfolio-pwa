package io.github.yishaiguedj1.snowball

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.MediaStore
import android.util.Base64
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 22/10/2026 (בקשת המשתמש: "כל ההורדות של מנהל ההורדות תמיד מקומית למכשיר, לא לשרת"): yt-dlp רץ בטלפון
 * (youtubedl-android: פייתון 3.12 + QuickJS לאתגרים של יוטיוב + ffmpeg למיזוג). יוטיוב חוסם כתובות של חוות שרתים —
 * מהטלפון (כתובת ביתית/סלולרית) ההורדה עוברת. הקובץ נשמר ב־Movies/Studio (גלוי בגלריה), ומשם עובר לאתר.
 *
 * yt-dlp מתעדכן לבד מתוך האפליקציה (nightly, פעם ביום) — יוטיוב משנה דברים כל כמה שבועות, ובלי עדכון הכל נשבר.
 */
object DlEngine {
    private const val PREFS = "dl"
    private const val UPD_EVERY_MS = 24 * 3600 * 1000L
    @Volatile private var ready = false

    /** הפעלה ראשונה פורסת את הפייתון (כמה שניות); אחר כך — מיד. ואז עדכון של yt-dlp אם עבר יום */
    @Synchronized
    fun prepare(ctx: Context, onStage: (String) -> Unit = {}) {
        if (!ready) {
            onStage("init")
            YoutubeDL.getInstance().init(ctx.applicationContext)
            FFmpeg.getInstance().init(ctx.applicationContext)
            ready = true
        }
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (System.currentTimeMillis() - p.getLong("upd", 0) > UPD_EVERY_MS) {
            onStage("update")
            try {
                YoutubeDL.getInstance().updateYoutubeDL(ctx.applicationContext, YoutubeDL.UpdateChannel.NIGHTLY)
                p.edit().putLong("upd", System.currentTimeMillis()).apply()
            } catch (e: Throwable) {
                // בלי רשת לעדכון — ממשיכים עם הגרסה שיש; ננסה שוב בפעם הבאה
            }
        }
    }

    /** עוגיות + זהות הדפדפן מהבדיקה לעומק (DlDeep) — קובץ זמני באחסון הפרטי, לפי האתר */
    data class Ck(val file: File, val ua: String)

    private fun ckDir(ctx: Context) = File(ctx.filesDir, "ck")

    fun saveCookies(ctx: Context, page: String, text: String, ua: String): Ck? {
        val k = DlDeep.hostKey(page)
        if (k.isEmpty() || ua.isEmpty() || ua.length > 512 || ua.any { it < ' ' }) return null
        val d = ckDir(ctx).apply { mkdirs() }
        d.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > DlDeep.CK_TTL_MS) it.delete() }
        return try {
            File(d, "$k.txt").writeText(text); File(d, "$k.ua").writeText(ua)
            Ck(File(d, "$k.txt"), ua)
        } catch (e: Throwable) { null }
    }

    /** לפי ה־Referer (זרם שנמצא בדף) או לפי הכתובת עצמה; רק כשטרי */
    fun cookiesFor(ctx: Context, url: String, ref: String): Ck? {
        val k = DlDeep.hostKey(ref.ifEmpty { url })
        if (k.isEmpty()) return null
        val f = File(ckDir(ctx), "$k.txt"); val u = File(ckDir(ctx), "$k.ua")
        if (!f.isFile || !u.isFile || System.currentTimeMillis() - f.lastModified() > DlDeep.CK_TTL_MS) return null
        return try { Ck(f, u.readText()) } catch (e: Throwable) { null }
    }

    private fun base(req: YoutubeDLRequest, ref: String, ck: Ck? = null, quick: Boolean = false, list: Boolean = false): YoutubeDLRequest {
        if (ck != null) req.addOption("--cookies", ck.file.absolutePath).addOption("--user-agent", ck.ua)
        // 23/10/2026: בבדיקה — ניסיונות קצרים (5 ניסיונות × 20 שנ׳ השאירו את הבדיקה יותר מדקה בלי תשובה)
        if (list) req.addOption("--socket-timeout", 20).addOption("--retries", 2).addOption("--extractor-retries", 2)
        else if (quick) req.addOption("--no-playlist").addOption("--socket-timeout", 12).addOption("--retries", 1).addOption("--extractor-retries", 1)
        else req.addOption("--no-playlist").addOption("--socket-timeout", 20).addOption("--retries", 5)
            .addOption("--fragment-retries", 10).addOption("--extractor-retries", 2)
        val r = DlProbe.refOk(ref)
        if (r.isNotEmpty()) {
            val o = Regex("^(https?://[^/?#]+)").find(r)?.groupValues?.get(1) ?: ""
            req.addOption("--add-headers", "Referer:$r")
            if (o.isNotEmpty()) req.addOption("--add-headers", "Origin:$o")
        }
        return req
    }

    /** בדיקה: yt-dlp -J → הסיכום של DlProbe + תמונה קטנה. כשל → IllegalArgumentException(קוד) */
    fun probe(ctx: Context, url: String, ref: String, ck: Ck? = null, id: String? = null, onStage: (String) -> Unit = {}): JSONObject {
        prepare(ctx, onStage)
        onStage("probe")
        // לא נמצא סרטון בכתובת כמו שהיא → הכתובות החלופיות (DlProbe.altUrls: www.); שגיאה אחרת — מיד.
        // קובץ שנתפס בדף (ref) או כתובת של קובץ/זרם — בלי חלופות (www. של שרת קבצים רק מוסיף המתנה)
        val alts = if (ref.isNotEmpty() || DlDeep.isMediaUrl(url)) emptyList() else DlProbe.altUrls(url)
        var s: JSONObject? = null; var info: JSONObject? = null; var err: IllegalArgumentException? = null
        for (u in listOf(url) + alts) {
            try {
                val out = try {
                    YoutubeDL.getInstance().execute(base(YoutubeDLRequest(u), ref, ck, true).addOption("-J").addOption("--skip-download"), id).out
                } catch (e: YoutubeDL.CanceledException) { throw IllegalArgumentException("cancel")
                } catch (e: Throwable) { throw IllegalArgumentException(DlProbe.errCode(e.message)) }
                val i = try { JSONObject(out) } catch (e: Throwable) { throw IllegalArgumentException("fail") }
                s = DlProbe.summarize(i); info = i; break
            } catch (e: IllegalArgumentException) {
                if (err == null) err = e
                if (e.message !in RETRY_ALT) break
            }
        }
        if (s == null || info == null) throw err ?: IllegalArgumentException("fail")
        s.put("th", thumbData(DlProbe.thumbUrl(info)))
        fillSize(s, info, ref, ck)
        return s
    }

    /** רשימת השמעה (Studio DM, 24/10/2026): ‎--flat-playlist -J‎ — הכותרות והכתובות בלבד, בלי לבדוק כל סרטון. מחזיר את ה־JSON הגולמי
     *  (DmPlaylist.parse). כשל → IllegalArgumentException(קוד) */
    fun probePlaylist(ctx: Context, url: String, ref: String, ck: Ck? = null): JSONObject {
        prepare(ctx)
        val out = try {
            YoutubeDL.getInstance().execute(base(YoutubeDLRequest(url), ref, ck, list = true).addOption("--flat-playlist").addOption("-J")
                .addOption("--playlist-end", 500)).out
        } catch (e: Throwable) { throw IllegalArgumentException(DlProbe.errCode(e.message)) }
        return try { JSONObject(out) } catch (e: Throwable) { throw IllegalArgumentException("fail") }
    }

    /** 23/10/2026 (דיווח המשתמש: "1KB" ב־buffett.cnbc.com — בפועל גודל לא ידוע): קובץ ישיר בלי גודל במידע של yt-dlp →
     *  שואלים את השרת (HEAD, עם ה־Referer). כך realVideo פוסל קובץ זעיר באמת, והאתר מציג את הגודל הנכון */
    private fun fillSize(s: JSONObject, info: JSONObject, ref: String, ck: Ck?) {
        val q = s.optJSONArray("q") ?: return
        if (q.length() != 1 || (q.optJSONObject(0)?.optLong("sz", 0) ?: 0) > 0) return
        val u = info.optString("url", "").ifEmpty { info.optString("webpage_url", "") }
        if (!Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(u)) return
        try {
            val c = URL(u).openConnection() as HttpURLConnection
            c.requestMethod = "HEAD"; c.instanceFollowRedirects = true
            c.connectTimeout = 10000; c.readTimeout = 10000
            c.setRequestProperty("User-Agent", ck?.ua ?: "Mozilla/5.0")
            val r = DlProbe.refOk(ref)
            if (r.isNotEmpty()) c.setRequestProperty("Referer", r)
            val type = (c.contentType ?: "").lowercase()
            val len = c.contentLengthLong
            c.disconnect()
            val list = type.contains("mpegurl") || type.contains("dash")
            if (!list && (type.startsWith("text/") || type.contains("json") || type.contains("xml") || type.startsWith("image/"))) s.put("nv", 1)
            else if (len > 0 && !list) q.getJSONObject(0).put("sz", len)
        } catch (e: Throwable) {}
    }

    /** תמונה מהדף (og:image) כשל־yt-dlp אין — לבדיקה לעומק */
    fun thumbIfEmpty(s: JSONObject, img: String) {
        if (s.optString("th", "").isEmpty() && img.isNotEmpty()) s.put("th", thumbData(img))
    }

    /** תמונה קטנה (320px, JPEG) כ־data: — כמו fetchurl.thumb_data. כל תקלה → "" */
    private fun thumbData(u: String): String {
        if (u.isEmpty()) return ""
        return try {
            val c = URL(u).openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 10000
            c.setRequestProperty("User-Agent", "Mozilla/5.0")
            val raw = c.inputStream.use { it.readBytes() }
            if (raw.size > 3 * 1024 * 1024) return ""
            val bm = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return ""
            val w = 320; val h = (bm.height * w / bm.width.coerceAtLeast(1)).coerceAtLeast(1)
            val sm = Bitmap.createScaledBitmap(bm, w, h, true)
            val bo = ByteArrayOutputStream()
            sm.compress(Bitmap.CompressFormat.JPEG, 70, bo)
            val b = "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)
            if (b.length <= 70 * 1024) b else ""
        } catch (e: Throwable) { "" }
    }

    private val RETRY_ALT = setOf("unsupported", "no_video", "fail")

    data class Pick(val v: String, val a: String, val h: Int, val s0: Int, val s1: Int)

    /** הורדה לתיקייה של האפליקציה (yt-dlp צריך נתיב רגיל), מיזוג בלי קידוד מחדש — MP4 כשאפשר, אחרת MKV.
     *  progress: 0–100. מחזיר את הקובץ. כשל → IllegalArgumentException(קוד) */
    fun download(ctx: Context, url: String, ref: String, pick: Pick, id: String, progress: (Float, Long) -> Unit): File =
        download(ctx, url, ref, pick, id, "", progress = progress)

    /** format = בורר yt-dlp משלך (Studio DM: "רק קול" — ‎ba/b‎); ריק = לפי pick, כמו ב־Studio */
    fun download(ctx: Context, url: String, ref: String, pick: Pick, id: String, format: String, onLine: (String) -> Unit = {}, progress: (Float, Long) -> Unit): File {
        prepare(ctx)
        val dir = File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "dl/$id").apply { mkdirs() }
        val req = base(YoutubeDLRequest(url), ref, cookiesFor(ctx, url, ref))
            .addOption("-f", format.ifEmpty { DlProbe.selector(pick.v, pick.a, pick.h) })
            .addOption("--merge-output-format", "mp4/mkv")
            .addOption("--no-mtime").addOption("--continue").addOption("--concurrent-fragments", 4)
            .addOption("-o", dir.absolutePath + "/%(title).80B [%(id)s].%(ext)s")
            .addOption("--print", "after_move:filepath")
        if (pick.s1 > pick.s0) req.addOption("--download-sections", "*${pick.s0}-${pick.s1}")
        val res = try {
            YoutubeDL.getInstance().execute(req, id) { p, eta, line -> progress(p, eta); onLine(line) }
        } catch (e: YoutubeDL.CanceledException) {
            throw IllegalArgumentException("cancel")
        } catch (e: Throwable) {
            throw IllegalArgumentException(DlProbe.errCode(e.message), e)   // הסיבה — ליומן של DM (מנוקה שם)
        }
        val path = res.out.lines().map { it.trim() }.lastOrNull { it.startsWith("/") } ?: ""
        val f = File(path)
        if (path.isEmpty() || !f.isFile || !f.canonicalPath.startsWith(dir.canonicalPath)) throw IllegalArgumentException("fail")
        // לא סרטון (דף שגיאה, פרסומת, קובץ ריק) — לא נשמר בגלריה; האתר מציג "הקובץ שירד הוא לא סרטון"
        val head = ByteArray(200)
        val n = try { f.inputStream().use { it.read(head) } } catch (e: Throwable) { 0 }
        if (f.length() < DlDeep.MIN_BYTES / 3 || !DlDeep.looksLikeVideo(head.copyOf(maxOf(n, 0)))) {
            dir.deleteRecursively()
            throw IllegalArgumentException("not_video")
        }
        return f
    }

    fun cancel(id: String) { try { YoutubeDL.getInstance().destroyProcessById(id) } catch (e: Throwable) {} }

    /** הקובץ עובר ל־Movies/Studio (גלוי בגלריה ובכל אפליקציה) — העתקה ומחיקה של הזמני. מחזיר את הכתובת ב־MediaStore */
    fun publish(ctx: Context, f: File): Uri {
        val mime = if (f.name.endsWith(".mkv", true)) "video/x-matroska" else if (f.name.endsWith(".webm", true)) "video/webm" else "video/mp4"
        val cv = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, f.name)
            put(MediaStore.Video.Media.MIME_TYPE, mime)
            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/Studio")
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val cr = ctx.contentResolver
        val uri = cr.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, cv) ?: throw IllegalArgumentException("store")
        try {
            cr.openOutputStream(uri)?.use { o -> f.inputStream().use { it.copyTo(o, 1 shl 20) } } ?: throw IllegalArgumentException("store")
            cr.update(uri, ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }, null, null)
        } catch (e: Throwable) {
            try { cr.delete(uri, null, null) } catch (x: Throwable) {}
            throw IllegalArgumentException("store")
        }
        f.parentFile?.deleteRecursively()
        return uri
    }

    /** תוצאת הבדיקה לאתר (ב־hash): base64url של ה־JSON */
    fun b64(s: String): String = Base64.encodeToString(s.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
}
