package io.github.yishaiguedj1.snowball.br

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Handler
import android.os.HandlerThread
import android.util.LruCache
import java.io.File
import java.security.MessageDigest

/**
 * 26/10/2026 (Studio Browser — השלמות שלב 2): תמונות שנשמרות בטלפון — הסמל של כל אתר (לקיצורי הדרך בטאב חדש,
 * להיסטוריה ולסימניות, גם בלי טאב פתוח) ותמונת הדף של כל טאב (למסך הטאבים אחרי שהאפליקציה נסגרה). בתיקיית המטמון של
 * האפליקציה (cacheDir/br) — המערכת רשאית למחוק אותה, ואז פשוט חוזרים לאות הצבעונית / לכרטיס הריק. טאב פרטי — לא נשמר.
 */
object BrPics {
    private lateinit var favDir: File
    private lateinit var thumbDir: File
    private val io by lazy { Handler(HandlerThread("br-pics").apply { start() }.looper) }
    private val mem = LruCache<String, Bitmap>(80)
    private val missing = HashSet<String>()

    fun init(ctx: Context) {
        if (::favDir.isInitialized) return
        favDir = File(BrUsers.cacheDir(ctx), "fav").apply { mkdirs() }
        thumbDir = File(BrUsers.cacheDir(ctx), "thumb").apply { mkdirs() }
    }

    private fun name(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }.take(20)

    /** סמל שהגיע מאתר — נשמר כשהוא גדול יותר ממה שכבר יש */
    fun saveIcon(host: String, b: Bitmap) {
        if (!::favDir.isInitialized || host.isEmpty() || b.width < 8) return
        val old = mem.get("f$host")
        if (old != null && old.width >= b.width) return
        mem.put("f$host", b); missing.remove("f$host")
        val copy = runCatching { b.copy(Bitmap.Config.ARGB_8888, false) }.getOrNull() ?: return
        io.post { write(File(favDir, name(host) + ".png"), copy, Bitmap.CompressFormat.PNG, 100) }
    }

    /** הסמל של אתר: מהזיכרון, אחרת מהקובץ (קריאה קטנה — עד כמה KB) */
    fun icon(host: String): Bitmap? {
        if (!::favDir.isInitialized || host.isEmpty()) return null
        val k = "f$host"
        mem.get(k)?.let { return it }
        if (k in missing) return null
        val b = runCatching { File(favDir, name(host) + ".png").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path) } }.getOrNull()
        if (b == null) missing.add(k) else mem.put(k, b)
        return b
    }

    fun saveThumb(url: String, b: Bitmap) {
        if (!::thumbDir.isInitialized || !url.startsWith("http")) return
        val copy = runCatching { b.copy(Bitmap.Config.RGB_565, false) }.getOrNull() ?: return
        io.post { write(File(thumbDir, name(url) + ".webp"), copy, webp(), 70) }
    }

    fun thumb(url: String): Bitmap? = if (!::thumbDir.isInitialized) null
        else runCatching { File(thumbDir, name(url) + ".webp").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path) } }.getOrNull()

    /** תמונות של טאבים שכבר לא פתוחים — נמחקות (נשארות רק של הכתובות שברשימה) */
    fun keepThumbs(urls: Collection<String>) {
        if (!::thumbDir.isInitialized) return
        val keep = urls.map { name(it) + ".webp" }.toHashSet()
        io.post { thumbDir.listFiles()?.forEach { if (it.name !in keep) it.delete() } }
    }

    fun clear() {
        if (!::favDir.isInitialized) return
        mem.evictAll(); missing.clear()
        io.post { favDir.listFiles()?.forEach { it.delete() }; thumbDir.listFiles()?.forEach { it.delete() } }
    }

    @Suppress("DEPRECATION")
    private fun webp() = if (android.os.Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP

    private fun write(f: File, b: Bitmap, fmt: Bitmap.CompressFormat, q: Int) {
        runCatching {
            val tmp = File(f.path + ".tmp")
            tmp.outputStream().use { b.compress(fmt, q, it) }
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
        }
    }

    /**
     * סמל לקיצור דרך במסך הבית: סמל האתר (או האות שלו) במרכז אריח מעוגל בגודל של אייקון אפליקציה (108dp — אדפטיבי),
     * כמו שהמערכת מציגה אפליקציות — לא סמל של 16 פיקסלים שנמתח ומיטשטש.
     */
    fun shortcutIcon(ctx: Context, icon: Bitmap?, letter: String, color: Int): Bitmap {
        val px = (108 * ctx.resources.displayMetrics.density).toInt().coerceAtLeast(108)
        val out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        // האזור הבטוח של אייקון אדפטיבי = 66% באמצע
        if (icon != null && icon.width >= 8) {
            c.drawColor(0xFFFFFFFF.toInt())
            val s = px * 0.42f
            val l = (px - s) / 2f
            c.drawBitmap(icon, null, RectF(l, l, l + s, l + s), p)
        } else {
            c.drawColor(color)
            p.color = 0xFFFFFFFF.toInt(); p.textAlign = Paint.Align.CENTER; p.textSize = px * 0.36f; p.isFakeBoldText = true
            val y = px / 2f - (p.descent() + p.ascent()) / 2f
            c.drawText(letter.take(1).uppercase(), px / 2f, y, p)
        }
        return out
    }
}
