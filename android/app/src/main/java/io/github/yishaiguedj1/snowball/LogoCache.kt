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
import kotlinx.coroutines.withContext
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

    suspend fun load(context: Context, rows: List<WidgetRow>): Map<String, Bitmap> = coroutineScope {
        rows.filter { it.logoUrl != null }.map { row ->
            async(Dispatchers.IO) { row.sym to runCatching { one(context, row.sym, row.logoUrl!!) }.getOrNull() }
        }.awaitAll().mapNotNull { (s, b) -> b?.let { s to it } }.toMap()
    }

    private suspend fun one(context: Context, sym: String, url: String): Bitmap? = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "logos").apply { mkdirs() }
        val f = File(dir, sym.replace(Regex("[^A-Za-z0-9._-]"), "_") + ".png")
        val fresh = f.exists() && System.currentTimeMillis() - f.lastModified() < MAX_AGE_MS
        if (!fresh) {
            val bytes = fetch(url)
            if (bytes != null) {
                val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                if (raw != null) f.outputStream().use { prep(raw).compress(Bitmap.CompressFormat.PNG, 100, it) }
            }
        }
        if (f.exists()) BitmapFactory.decodeFile(f.path) else null
    }

    private fun fetch(url: String): ByteArray? {
        val c = URL(url).openConnection() as HttpURLConnection
        return try {
            c.connectTimeout = 5000
            c.readTimeout = 5000
            if (c.responseCode == 200) c.inputStream.use { it.readBytes() } else null
        } finally { c.disconnect() }
    }

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
