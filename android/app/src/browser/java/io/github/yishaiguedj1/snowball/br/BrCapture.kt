package io.github.yishaiguedj1.snowball.br

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.WebView
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.util.Locale

/**
 * הגל הרביעי (01/11/2026): החלקים של אנדרואיד — שמירה לגלריה (MediaStore), קוד QR (ZXing core, Apache-2.0),
 * הקראה (TextToSpeech של המערכת — בטלפון, בלי ענן) והדפסה ל־PDF (PrintManager). הלוגיקה הטהורה — BrRead.
 */
object BrCapture {
    private const val DIR = "Studio Browser"

    /** תמונה לגלריה (Pictures/Studio Browser) — מחזיר את הכתובת, או null */
    fun saveImage(ctx: Context, b: Bitmap, name: String): Uri? = save(ctx, name, "image/png", true) { o -> b.compress(Bitmap.CompressFormat.PNG, 100, o) }
    fun savePng(ctx: Context, png: ByteArray, name: String): Uri? = save(ctx, name, "image/png", true) { it.write(png) }
    /** קליפ לגלריה (Movies/Studio Browser) */
    fun saveVideo(ctx: Context, data: ByteArray, name: String): Uri? = save(ctx, name, "video/webm", false) { it.write(data) }

    private fun save(ctx: Context, name: String, mime: String, image: Boolean, w: (java.io.OutputStream) -> Unit): Uri? = runCatching {
        val cr = ctx.contentResolver
        val v = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name); put(MediaStore.MediaColumns.MIME_TYPE, mime)
            if (Build.VERSION.SDK_INT >= 29) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, (if (image) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_MOVIES) + "/" + DIR)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }
        val col = if (image) MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        val u = cr.insert(col, v) ?: return null
        try { cr.openOutputStream(u)?.use(w) ?: throw IllegalStateException() } catch (e: Exception) { cr.delete(u, null, null); return null }
        if (Build.VERSION.SDK_INT >= 29) cr.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        u
    }.getOrNull()

    /* ---------- 56 קוד QR ---------- */

    /** QR של הטקסט (רמת תיקון M, שוליים של 2 מודולים) — שחור על לבן, size×size */
    fun qr(text: String, size: Int): Bitmap? = runCatching {
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size,
            mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 2, EncodeHintType.CHARACTER_SET to "UTF-8"))
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) Color.BLACK else Color.WHITE }
        Bitmap.createBitmap(px, m.width, m.height, Bitmap.Config.ARGB_8888)
    }.getOrNull()

    /** קריאת QR מתמונה (צילום של הדף, או תמונה מהגלריה) — null = לא נמצא */
    fun readQr(b: Bitmap): String? = runCatching {
        val src = if (b.width * b.height > 4_000_000) Bitmap.createScaledBitmap(b, b.width / 2, b.height / 2, true) else b
        val px = IntArray(src.width * src.height); src.getPixels(px, 0, src.width, 0, 0, src.width, src.height)
        decode(px, src.width, src.height)
    }.getOrNull()

    /** הפענוח עצמו (גם בבדיקות ב־JVM — בלי Bitmap) */
    fun decode(px: IntArray, w: Int, h: Int): String? = runCatching {
        val r = MultiFormatReader().apply { setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE), DecodeHintType.TRY_HARDER to true)) }
        r.decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(w, h, px)))).text
    }.getOrNull()

    /* ---------- 55 PDF ---------- */

    /** הדפסה דרך המערכת — "שמירה כ־PDF" היא אחת המדפסות. ה־WebView חייב להישאר חי עד שהעבודה נוצרת */
    fun print(ctx: Context, w: WebView, title: String): Boolean = runCatching {
        val pm = ctx.getSystemService(Context.PRINT_SERVICE) as PrintManager
        val name = title.ifEmpty { "Studio Browser" }.take(80)
        pm.print(name, w.createPrintDocumentAdapter(name), PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
        true
    }.getOrDefault(false)

    /* ---------- 27/31 הקראה ---------- */

    /**
     * ההקראה: TextToSpeech של המערכת. units = (מספר הבלוק, הטקסט) — onAt מדווח איזה בלוק מוקרא עכשיו (להדגשה במצב קריאה),
     * onEnd כשנגמר או נעצר. השפה — לפי האותיות (BrRead.langOf); קול שלא מותקן → onMissing (ההגדרות של המערכת).
     */
    class Speaker(ctx: Context, private val onAt: (Int) -> Unit, private val onEnd: () -> Unit, private val onMissing: () -> Unit) {
        private var tts: TextToSpeech? = null
        private var ready = false
        private var pending: (() -> Unit)? = null
        private var units: List<Pair<Int, String>> = emptyList()
        var rate = 1f
        @Volatile var speaking = false; private set

        init {
            tts = TextToSpeech(ctx.applicationContext) { st ->
                ready = st == TextToSpeech.SUCCESS
                if (ready) pending?.invoke() else onMissing()
                pending = null
            }
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String) { id.toIntOrNull()?.let { i -> units.getOrNull(i)?.let { onAt(it.first) } } }
                override fun onDone(id: String) { if (id.toIntOrNull() == units.size - 1) { speaking = false; onEnd() } }
                @Deprecated("Deprecated in Java") override fun onError(id: String) { speaking = false; onEnd() }
                override fun onStop(id: String, interrupted: Boolean) {}
            })
        }

        /** from = מאיזו יחידה להתחיל (המשך אחרי עצירה / נגיעה בפסקה) */
        fun speak(u: List<Pair<Int, String>>, lang: String, from: Int = 0) {
            val go = {
                val t = tts
                if (t != null && u.isNotEmpty()) {
                    units = u; speaking = true
                    val loc = Locale.forLanguageTag(if (lang == "he") "iw" else lang)
                    val ok = t.setLanguage(loc)
                    if (ok == TextToSpeech.LANG_MISSING_DATA || ok == TextToSpeech.LANG_NOT_SUPPORTED) {
                        if (lang == "he" && t.setLanguage(Locale.forLanguageTag("he")) >= 0) Unit else onMissing()
                    }
                    t.setSpeechRate(rate)
                    t.stop()
                    u.forEachIndexed { i, (_, s) -> if (i >= from) t.speak(s, TextToSpeech.QUEUE_ADD, null, i.toString()) }
                }
            }
            if (ready) go() else pending = go
        }
        fun stop() { speaking = false; runCatching { tts?.stop() } }
        fun shutdown() { stop(); runCatching { tts?.shutdown() }; tts = null }
    }
}
