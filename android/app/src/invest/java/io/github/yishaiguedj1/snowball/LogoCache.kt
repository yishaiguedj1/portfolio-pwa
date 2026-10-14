package io.github.yishaiguedj1.snowball

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import com.caverock.androidsvg.SVG
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * לוגואים לשורות הווידג'ט: מהרשת פעם בשבוע, שמורים בקבצים (cacheDir). מוקטנים ל־LOGO_PX
 * (RemoteViews מגביל את סך הביטמפים בווידג'ט). לוגו לבן על רקע שקוף (UNH/UBER/APP ב־FMP) מתהפך לשחור
 * על האריח הלבן — אותו כלל של השרתון (lib/widget-html.js): לפחות 20% שקיפות וממוצע בהירות > 225.
 * כישלון → null (השורה מציגה את האות הראשונה).
 */
object LogoCache {
    private const val LOGO_PX = 96
    private const val MAX_AGE_MS = 7L * 24 * 3600 * 1000

    /** מוריד לקבצים את מה שחסר/ישן (במקביל) — ברענון, לפני הציור */
    suspend fun warm(context: Context, rows: List<WidgetRow>) = coroutineScope {
        rows.filter { it.logoUrl != null }.map { row ->
            async(Dispatchers.IO) { runCatching { one(context, row.sym, row.logoUrl!!) } }
        }.awaitAll()
        Unit
    }

    /** הלוגו השמור (או null → האות הראשונה). SVG (לוגואים של ת״א ב־TradingView) מצויר עם AndroidSVG */
    fun bitmap(context: Context, sym: String): Bitmap? = runCatching {
        val f = file(context, sym)
        if (!f.exists()) return@runCatching null
        // v252: מטמון בזיכרון (לפי הקובץ וזמן השינוי) — כל מעבר טאב בווידג'ט המעקב פענח מחדש את כל הלוגואים מהדיסק
        val key = f.path + "@" + f.lastModified()
        mem.get(key) ?: BitmapFactory.decodeFile(f.path)?.also { mem.put(key, it) }
    }.getOrNull()

    private val mem = object : android.util.LruCache<String, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    private fun file(context: Context, sym: String) =
        File(File(context.cacheDir, "logos").apply { mkdirs() }, sym.replace(Regex("[^A-Za-z0-9._-]"), "_") + ".v3.png") // v3: לוגואים שנשמרו קטנים/חתוכים לפני התיקון לא נטענים (ת״א מגיעים עכשיו כ־PNG מהאתר)

    private fun one(context: Context, sym: String, url: String) {
        val f = file(context, sym)
        if (f.exists() && System.currentTimeMillis() - f.lastModified() < MAX_AGE_MS) return
        val bytes = fetch(url) ?: return
        val isSvg = url.endsWith(".svg") || String(bytes, 0, minOf(bytes.size, 200)).trimStart().let { it.startsWith("<") }
        if (isSvg) { // לוגואים של ת״א (TradingView) — ריבוע מלא עם רקע משלהם, בלי היפוך צבעים (כמו באפליקציה)
            val bmp = svgBitmap(String(bytes, Charsets.UTF_8)) ?: return
            f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            return
        }
        val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return
        f.outputStream().use { prep(raw).compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun fetch(url: String): ByteArray? {
        val c = URL(url).openConnection() as HttpURLConnection
        return try {
            c.connectTimeout = 5000
            c.readTimeout = 5000
            if (c.responseCode == 200) c.inputStream.use { it.readBytes() } else null
        } finally { c.disconnect() }
    }

    private fun svgBitmap(text: String): Bitmap? = runCatching {
        val svg = SVG.getFromString(text)
        // הלוגואים של TradingView: width/height=18 בלי viewBox — בלי viewBox שינוי הגודל רק מגדיל את הקנבס,
        // והציור נשאר 18px בפינה (לוגו זעיר וחתוך בווידג׳ט). viewBox בגודל המקורי → נמתח על כל הריבוע.
        if (svg.documentViewBox == null) {
            val w0 = svg.documentWidth.takeIf { it > 0f } ?: 18f
            val h0 = svg.documentHeight.takeIf { it > 0f } ?: w0
            svg.setDocumentViewBox(0f, 0f, w0, h0)
        }
        svg.documentWidth = LOGO_PX.toFloat()
        svg.documentHeight = LOGO_PX.toFloat()
        val out = Bitmap.createBitmap(LOGO_PX, LOGO_PX, Bitmap.Config.ARGB_8888)
        svg.renderToCanvas(Canvas(out))
        out
    }.getOrNull()

    private fun prep(src: Bitmap): Bitmap {
        val s = LOGO_PX.toFloat() / maxOf(src.width, src.height)
        val w = maxOf(1, (src.width * s).toInt())
        val h = maxOf(1, (src.height * s).toInt())
        val b = Bitmap.createScaledBitmap(src, w, h, true)
        if (!isLight(b)) return b
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val invert = ColorMatrix(floatArrayOf(-1f, 0f, 0f, 0f, 255f, 0f, -1f, 0f, 0f, 255f, 0f, 0f, -1f, 0f, 255f, 0f, 0f, 0f, 1f, 0f))
        Canvas(out).drawBitmap(b, 0f, 0f, Paint().apply { colorFilter = ColorMatrixColorFilter(invert) })
        return out
    }

    private fun isLight(b: Bitmap): Boolean {
        val px = IntArray(b.width * b.height)
        b.getPixels(px, 0, b.width, 0, 0, b.width, b.height)
        var sum = 0.0
        var n = 0
        for (p in px) {
            if ((p ushr 24) > 128) {
                sum += ((p shr 16) and 255) * .299 + ((p shr 8) and 255) * .587 + (p and 255) * .114
                n++
            }
        }
        return n >= 5 && n <= px.size * 0.8 && sum / n > 225
    }
}
