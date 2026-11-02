package io.github.yishaiguedj1.snowball.br

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Base64
import androidx.annotation.RequiresApi
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.genai.common.DownloadCallback
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.summarization.Summarization
import com.google.mlkit.genai.summarization.SummarizationRequest
import com.google.mlkit.genai.summarization.Summarizer
import com.google.mlkit.genai.summarization.SummarizerOptions
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import java.io.OutputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Studio Browser Pro — הגל החמישי (01/11/2026): הצד של אנדרואיד. הלוגיקה הטהורה — BrLocal.kt.
 * תלויות (חינם; רישיון: תנאי השימוש של ML Kit מ־Google — לא קוד פתוח; docs/android-apps.md):
 * com.google.mlkit:translate (58, המודל של כל שפה יורד פעם אחת, ~30MB, ואז הכל בטלפון) ו־
 * com.google.mlkit:genai-summarization (59, המודל שבטלפון דרך AICore — רק בדגמים שתומכים; באחרים המצב UNAVAILABLE ומסתירים).
 * הכתוביות (50) — SpeechRecognizer במכשיר של המערכת (Android 13+), בלי ספרייה.
 */
object BrMl {
    /** התרגום והסיכום — ת׳רדים ברקע (הקריאות כאן חוסמות, לא לקרוא מהת׳רד של הממשק) */
    val ex = Executors.newFixedThreadPool(2)

    /* ---------- 58 תרגום ---------- */

    private val clients = LinkedHashMap<String, Translator>(4, 0.75f, true)
    private fun client(s: String, d: String): Translator = synchronized(clients) {
        clients.getOrPut("$s>$d") { Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(s).setTargetLanguage(d).build()) }.also {
            while (clients.size > 3) { val k = clients.keys.first(); clients.remove(k)?.close() }
        }
    }

    /** האם המודל של השפה כבר בטלפון (אנגלית תמיד בפנים) */
    fun has(code: String): Boolean = code == "en" || models().contains(code)
    fun models(): Set<String> = runCatching {
        Tasks.await(RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel::class.java), 20, TimeUnit.SECONDS).map { it.language }.toSet()
    }.getOrDefault(emptySet())
    /** הורדת המודל (חוסם). wifi = רק ב־Wi‑Fi */
    fun download(code: String, wifi: Boolean = false): Boolean = runCatching {
        val c = DownloadConditions.Builder().apply { if (wifi) requireWifi() }.build()
        Tasks.await(RemoteModelManager.getInstance().download(TranslateRemoteModel.Builder(code).build(), c), 10, TimeUnit.MINUTES); true
    }.getOrDefault(false)
    fun delete(code: String): Boolean = runCatching {
        if (code == "en") return false
        synchronized(clients) { clients.keys.filter { it.startsWith("$code>") || it.endsWith(">$code") }.forEach { clients.remove(it)?.close() } }
        Tasks.await(RemoteModelManager.getInstance().deleteDownloadedModel(TranslateRemoteModel.Builder(code).build()), 30, TimeUnit.SECONDS); true
    }.getOrDefault(false)

    /** תרגום (חוסם): מוריד את המודלים אם צריך (allowDl), ומחזיר null לטקסט שנכשל. part(i, תרגום) — אחרי כל טקסט */
    fun translate(s: String, d: String, texts: List<String>, allowDl: Boolean = true, part: ((Int, String) -> Unit)? = null): List<String?>? {
        if (s == d) return texts
        if (!allowDl && (!has(s) || !has(d))) return null
        val tr = client(s, d)
        if (runCatching { Tasks.await(tr.downloadModelIfNeeded(), 10, TimeUnit.MINUTES) }.isFailure) return null
        return texts.mapIndexed { i, x -> runCatching { Tasks.await(tr.translate(x), 60, TimeUnit.SECONDS) }.getOrNull()?.also { part?.invoke(i, it) } }
    }
    /** טקסט ארוך (סיכום) — בחתיכות לפי משפטים */
    fun translateLong(s: String, d: String, text: String, allowDl: Boolean = true): String? {
        val ch = BrRead.chunks(text, 1500)
        val r = translate(s, d, ch, allowDl) ?: return null
        return r.mapIndexed { i, x -> x ?: ch[i] }.joinToString(" ")
    }

    /* ---------- 59 סיכום במודל שבטלפון ---------- */

    private val sums = HashMap<Int, Summarizer>()
    private fun summarizer(ctx: Context, out: Int): Summarizer = synchronized(sums) {
        sums.getOrPut(out) {
            Summarization.getClient(SummarizerOptions.builder(ctx.applicationContext).setInputType(SummarizerOptions.InputType.ARTICLE)
                .setOutputType(out).setLanguage(SummarizerOptions.Language.ENGLISH).setLongInputAutoTruncationEnabled(true).build())
        }
    }
    /** FeatureStatus: 0 לא נתמך בדגם · 1 להורדה · 2 בהורדה · 3 זמין (חוסם; כל תקלה = 0) */
    fun sumStatus(ctx: Context): Int = runCatching { summarizer(ctx, SummarizerOptions.OutputType.THREE_BULLETS).checkFeatureStatus().get(20, TimeUnit.SECONDS) }.getOrDefault(0)
    /** הורדת המודל (חוסם); prog(הורד, סה״כ) */
    fun sumDownload(ctx: Context, prog: (Long, Long) -> Unit): Boolean = runCatching {
        var total = 0L
        summarizer(ctx, SummarizerOptions.OutputType.THREE_BULLETS).downloadFeature(object : DownloadCallback {
            override fun onDownloadStarted(bytesToDownload: Long) { total = bytesToDownload; prog(0, total) }
            override fun onDownloadProgress(totalBytesDownloaded: Long) { prog(totalBytesDownloaded, total) }
            override fun onDownloadCompleted() {}
            override fun onDownloadFailed(e: GenAiException) {}
        }).get(30, TimeUnit.MINUTES); true
    }.getOrDefault(false)
    /** סיכום של טקסט באנגלית (חוסם): bullets = 1–3 נקודות */
    fun summarizeEn(ctx: Context, text: String, bullets: Int = 3): String? = runCatching {
        val out = when (bullets) { 1 -> SummarizerOptions.OutputType.ONE_BULLET; 2 -> SummarizerOptions.OutputType.TWO_BULLETS; else -> SummarizerOptions.OutputType.THREE_BULLETS }
        summarizer(ctx, out).runInference(SummarizationRequest.builder(text).build()).get(3, TimeUnit.MINUTES).summary
    }.getOrNull()
    /**
     * סיכום בכל שפה (חוסם): שפה שהמודל לא מסכם בה — לאנגלית דרך 58, סיכום, והנקודות לשפת היעד. null = נכשל.
     */
    fun summarize(ctx: Context, text: String, lang: String, target: String, bullets: Int = 3, allowDl: Boolean = true): List<String>? {
        val en = if (lang in BrLocal.SUM_LANGS) text else translateLong(lang, "en", text, allowDl) ?: return null
        val src = if (lang in BrLocal.SUM_LANGS) lang else "en"
        val pts = BrLocal.bullets(summarizeEn(ctx, en, bullets) ?: return null)
        if (pts.isEmpty() || src == target) return pts
        return translate(src, target, pts, allowDl)?.mapIndexed { i, x -> x ?: pts[i] } ?: pts
    }
    fun close() {
        synchronized(clients) { clients.values.forEach { runCatching { it.close() } }; clients.clear() }
        synchronized(sums) { sums.values.forEach { runCatching { it.close() } }; sums.clear() }
    }
}

/**
 * 50 כתוביות חיות: הקול של הדף (מה ש־BrLocal.audioJs שולח, PCM 16kHz מונו) נכנס בצינור לזיהוי הדיבור של המערכת במכשיר
 * (createOnDeviceSpeechRecognizer + EXTRA_AUDIO_SOURCE, מצב segmented — זרם ארוך בלי לעצור בשקט). Android 13+.
 * ev(סוג, טקסט): 0 חלקי · 1 סופי · 2 תקלה (הקוד) · 3 נגמר. נקרא בת׳רד של הממשק.
 */
@RequiresApi(33)
class BrCaptions(private val ctx: Context, val lang: String, private val ev: (Int, String) -> Unit) {
    private var sr: SpeechRecognizer? = null
    private var rd: ParcelFileDescriptor? = null
    private var out: OutputStream? = null
    private val wq = Executors.newSingleThreadExecutor()
    @Volatile private var alive = false

    fun start() {
        val p = ParcelFileDescriptor.createPipe(); rd = p[0]; out = ParcelFileDescriptor.AutoCloseOutputStream(p[1]); alive = true
        val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx); sr = r
        fun first(b: Bundle?) = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) { if (alive) ev(2, error.toString()) }
            override fun onResults(results: Bundle?) { first(results).let { if (it.isNotBlank()) ev(1, it) } }
            override fun onPartialResults(partialResults: Bundle?) { first(partialResults).let { if (it.isNotBlank()) ev(0, it) } }
            override fun onSegmentResults(segmentResults: Bundle) { first(segmentResults).let { if (it.isNotBlank()) ev(1, it) } }
            override fun onEndOfSegmentedSession() { if (alive) ev(3, "") }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        r.startListening(intent(lang).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, p[0])
            .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
            .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
            .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, BrLocal.RATE)
            .putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE))
    }

    /** חתיכת קול מהדף (base64) — לצינור בת׳רד משלו (כתיבה לצינור מלא חוסמת) */
    fun feed(b64: String) {
        if (!alive || b64.length > BrLocal.AUDIO_MAX) return
        wq.execute { if (alive) runCatching { out?.write(Base64.decode(b64, Base64.NO_WRAP)) }.onFailure { alive = false } }
    }

    fun stop() {
        alive = false
        runCatching { rd?.close() }   // הכותב שחסום מקבל שגיאה ומשתחרר
        wq.execute { runCatching { out?.close() } }; wq.shutdown()
        runCatching { sr?.stopListening() }; runCatching { sr?.destroy() }; sr = null
    }

    companion object {
        fun intent(lang: String): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, BrLocal.speechTag(lang))

        /** האם יש בטלפון זיהוי דיבור במכשיר שמקבל קול מאיתנו */
        fun ok(ctx: Context) = Build.VERSION.SDK_INT >= 33 && runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) }.getOrDefault(false)

        /** השפה בזיהוי במכשיר: cb(0 מותקנת · 1 אפשר להוריד · 2 לא נתמכת). בת׳רד של הממשק */
        fun support(ctx: Context, lang: String, cb: (Int) -> Unit) {
            if (Build.VERSION.SDK_INT < 33) { cb(2); return }
            val r = runCatching { SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx) }.getOrNull() ?: run { cb(2); return }
            val main = android.os.Handler(android.os.Looper.getMainLooper())
            var done = false
            fun fin(v: Int) = main.post { if (!done) { done = true; cb(v); runCatching { r.destroy() } } }
            runCatching {
                r.checkRecognitionSupport(intent(lang), Executors.newSingleThreadExecutor(), object : RecognitionSupportCallback {
                    override fun onSupportResult(s: RecognitionSupport) = fin(when {
                        BrLocal.hasSpeech(s.installedOnDeviceLanguages, lang) -> 0
                        BrLocal.hasSpeech(s.supportedOnDeviceLanguages + s.pendingOnDeviceLanguages, lang) -> 1
                        else -> 2
                    }).let {}
                    override fun onError(error: Int) = fin(0).let {}   // אין תשובה — מנסים, והזיהוי יגיד אם חסר
                })
            }.onFailure { fin(0) }
            main.postDelayed({ fin(0) }, 4000)
        }
        fun download(ctx: Context, lang: String) {
            if (Build.VERSION.SDK_INT < 33) return
            runCatching { SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx).apply { triggerModelDownload(intent(lang)); destroy() } }
        }
    }
}
