package io.github.yishaiguedj1.snowball.br

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import io.github.yishaiguedj1.snowball.AppRoute
import java.net.HttpURLConnection
import java.net.URL

/**
 * הגל השישי (02/11/2026): החלקים של אנדרואיד ל־BrOurs — השרתון (מחירים וחיפוש), שמירת EPUB להורדות, המסירה
 * ל־Academy ול־Invest, וקריאת קובץ כתוביות שחזר מ־Studio. הלוגיקה עצמה — BrOurs.kt (נבדקת ב־JVM).
 */
object BrOursAndroid {
    const val ACADEMY_PKG = "app.thesnowball.academy"
    const val INVEST_PKG = "io.github.yishaiguedj1.snowball"

    /**
     * השרתון שלנו: הכתובת הראשית ואחריה Vercel כגיבוי (כמו DmSync.API). מחירים וחיפוש = מידע ציבורי — בלי חשבון ובלי
     * שום נתון של המשתמש; השרתון מאשר רק Origin של אתרי האפליקציה, ולכן בשם Invest (כמו הווידג'ט של מרכז הניהול)
     */
    private val HOSTS = listOf("https://api.thesnowball.app", "https://ibkr-proxy-wine.vercel.app")
    private const val ORIGIN = "https://invest.thesnowball.app"

    /** POST ל־/api/<path>. null = אין תשובה מאף כתובת */
    fun post(path: String, body: String): String? {
        for (h in HOSTS) {
            val r = runCatching {
                val c = URL("$h/api/$path").openConnection() as HttpURLConnection
                c.requestMethod = "POST"; c.connectTimeout = 8000; c.readTimeout = 10000; c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Origin", ORIGIN)
                c.outputStream.use { it.write(body.toByteArray()) }
                val code = c.responseCode
                val t = if (code == 200) c.inputStream.bufferedReader().use { it.readText().take(200_000) } else null
                c.disconnect(); t
            }.getOrNull()
            if (r != null) return r
        }
        return null
    }

    /**
     * 71: הכרטיס — לכל היותר שתי בקשות: חיפוש לפי שם (כשאין סימבול מפורש) ובקשת מחירים אחת לכל הסימבולים.
     * null = אין רשת / השרתון לא ענה; רשימה ריקה = לא נמצאה מניה
     */
    fun cards(q: BrOurs.Query): List<BrOurs.Card>? {
        val names = HashMap<String, String>()
        val syms = q.syms.ifEmpty {
            val r = post("search", BrOurs.searchBody(q.q)) ?: return null
            BrOurs.searchParse(r).onEach { names[it.first] = it.second }.map { it.first }
        }
        if (syms.isEmpty()) return emptyList()
        val r = post("quotes", BrOurs.quotesBody(syms)) ?: return null
        val got = BrOurs.quotesParse(r, names)
        return syms.mapNotNull { s -> got.firstOrNull { it.sym == s } }
    }

    /** 70: ה־EPUB להורדות (Download/Studio Browser) — נשאר שם גם אחרי ההעברה ל־Academy */
    fun saveEpub(ctx: Context, data: ByteArray, name: String): Uri? = runCatching {
        if (Build.VERSION.SDK_INT < 29) return null
        val cr = ctx.contentResolver
        val v = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name); put(MediaStore.MediaColumns.MIME_TYPE, "application/epub+zip")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + BrCapture.DIR)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: return null
        try { cr.openOutputStream(u)?.use { it.write(data) } ?: throw IllegalStateException() } catch (e: Exception) { cr.delete(u, null, null); return null }
        cr.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        u
    }.getOrNull()

    fun academyInstalled(ctx: Context) = AppRoute.installed(ctx, ACADEMY_PKG)

    /** הספר ל־Academy (שיתוף ישיר לחבילה שלנו, הרשאת קריאה לקובץ הזה בלבד). Academy מוסיפה אותו לספרייה הפרטית */
    fun toAcademy(ctx: Context, u: Uri, title: String): Boolean = runCatching {
        ctx.startActivity(Intent(Intent.ACTION_SEND).setType("application/epub+zip").putExtra(Intent.EXTRA_STREAM, u)
            .putExtra(Intent.EXTRA_TEXT, title.take(200)).setPackage(ACADEMY_PKG)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)); true
    }.getOrDefault(false)

    /** בלי Academy — שיתוף רגיל של הקובץ */
    fun shareFile(ctx: Context, u: Uri, mime: String, title: CharSequence?) = runCatching {
        ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, u)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** 71: קישור ל־Invest — באפליקציה כשהיא מותקנת, אחרת false (הדפדפן פותח כרטיסייה) */
    fun toInvest(ctx: Context, url: String): Boolean {
        if (!AppRoute.installed(ctx, INVEST_PKG)) return false
        return runCatching {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(INVEST_PKG).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
        }.getOrDefault(false)
    }

    /** 68: קובץ כתוביות (מהבורר או משיתוף של Studio) → הטקסט והשם. עד MAX_SUBS_BYTES */
    fun readSubs(ctx: Context, u: Uri): Pair<String, String>? = runCatching {
        val name = ctx.contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } ?: ""
        val bytes = ctx.contentResolver.openInputStream(u)?.use { s ->
            val b = java.io.ByteArrayOutputStream(); val buf = ByteArray(16384); var n = 0
            while (n < BrOurs.MAX_SUBS_BYTES) { val r = s.read(buf); if (r < 0) break; b.write(buf, 0, r); n += r }
            b.toByteArray()
        } ?: return null
        String(bytes, Charsets.UTF_8) to name
    }.getOrNull()

    /** שיתוף שהגיע: קובץ כתוביות? (לפי הסיומת או הסוג) */
    fun isSubs(name: String, mime: String?) = name.lowercase().let { it.endsWith(".srt") || it.endsWith(".vtt") } ||
        mime == "application/x-subrip" || mime == "text/vtt"
}
