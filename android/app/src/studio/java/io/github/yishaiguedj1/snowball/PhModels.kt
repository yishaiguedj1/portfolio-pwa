package io.github.yishaiguedj1.snowball

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * 25/10/2026 — תרגום בטלפון, שלב 2: המודלים שהטלפון מריץ — אותם קבצים בדיוק של השרת (כל אחד עם גרסה וטביעה קבועות):
 *   Parakeet TDT 0.6B v2 INT8 (istupakov/parakeet-tdt-0.6b-v2-onnx, ‏CC-BY-4.0) · Silero VAD (istupakov/silero-vad-onnx, MIT)
 *   WeSpeaker ResNet34-LM (Wespeaker/wespeaker-voxceleb-resnet34-LM, ‏CC-BY-4.0 — אותו revision של infra/worker/Dockerfile)
 *   Qwen3-ForcedAligner-0.6B INT8 (Apache-2.0): הגרפים מתמונת העובד (Release ‏lab-models) + הטוקנייזר מ־Hugging Face
 *   באותו revision שב־manifest. בלי ctc.onnx (‏MMS_FA — CC-BY-NC, לא מופץ; בטלפון רק Qwen).
 * כ־1.8GB, פעם אחת, באחסון הפנימי (לא בגיבוי). קובץ שלא תואם את הטביעה — נמחק ולא בשימוש. החלפת מודל בשרת = לעדכן כאן.
 */
object PhModels {
    class F(val path: String, val url: String, val sha: String, val size: Long)

    private const val PK = "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v2-onnx/resolve/main/"
    private const val QW = "https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B/resolve/c7cbfc2048c462b0d63a45797104fc9db3ad62b7/"
    private const val GH = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/lab-models/"

    val FILES = listOf(
        F("parakeet/config.json", PK + "config.json", "666903c76b9798caf2c210afd4f6cd60b08a8dbf9800ec8d7a3bc0d2148ac466", 97),
        F("parakeet/vocab.txt", PK + "vocab.txt", "ec182b70dd42113aff6c5372c75cac58c952443eb22322f57bbd7f53977d497d", 9384),
        F("parakeet/decoder_joint-model.int8.onnx", PK + "decoder_joint-model.int8.onnx", "a449f49acd68979d418651dd2dcb737cc0f1bf0225e009e29ee326354edbf7d3", 8998286),
        F("parakeet/encoder-model.int8.onnx", PK + "encoder-model.int8.onnx", "3e0581fda6ab843888b51e56d7ee78b6d5bc3237ec113af1f732d1d5286aa155", 652184014),
        F("vad/silero_vad.onnx", "https://huggingface.co/istupakov/silero-vad-onnx/resolve/b3e3ee3cce4c11ceb63b1a0b229d916069c1ddf6/silero_vad.onnx",
            "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3", 2327524),
        F("speaker/voxceleb_resnet34_LM.onnx", "https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM/resolve/f0c48c298fd835726c27956a5d617bad7115627e/voxceleb_resnet34_LM.onnx",
            "7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068", 26530309),
        F("aligner/model/config.json", QW + "config.json", "d616c65d46c4b90bdc651b0a0963ea932732241140f337f9bb6b0335a9c8ef09", 5982),
        F("aligner/model/vocab.json", QW + "vocab.json", "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910", 2776833),
        F("aligner/model/merges.txt", QW + "merges.txt", "8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5", 1671853),
        F("aligner/model/tokenizer_config.json", QW + "tokenizer_config.json", "3ab80063f8511deb9566e6ad438d17b7a6277fcffd52d92854112f19d36bd81c", 12666),
        F("aligner/audio-conv.onnx", GH + "audio-conv.onnx", "a233dc36657d3b845c1cb45e87d69d11a6d1054e04dea1a4a0c47e3870f9af2f", 48073472),
        F("aligner/audio-encoder.onnx", GH + "audio-encoder.onnx", "769aebf04491b09a72124876b4d848034927e4a8611b81d54bcdcda0104b8be5", 305795188),
        F("aligner/text-decoder.onnx", GH + "text-decoder.onnx", "fa4e49b52edd05889eaa2bac17fc716e31fec1eba9f6f49749ae2f4b7575c70a", 446779279),
        F("aligner/embed.npy", GH + "embed.npy", "b5ca50b20464aa57ede40e12fb248669a9000f1032b76dfe9edd4c62c05bf41a", 311427200),
        F("aligner/pos.npy", GH + "pos.npy", "fb734af899026939b13adb7cb3383abf48a0c2a845989c0dd5f1cdb33c6c32e2", 6144128),
    )
    val TOTAL: Long = FILES.sumOf { it.size }

    fun dir(ctx: Context) = File(ctx.noBackupFilesDir, "ph2m").apply { mkdirs() }

    /** הקובץ נבדק פעם אחת (sha256) כשהורד — סימן ‎.ok‎ ליד; אחר כך רק הגודל */
    fun ready(ctx: Context): Boolean = FILES.all { val f = File(dir(ctx), it.path); f.length() == it.size && File(f.path + ".ok").isFile }

    fun missingBytes(ctx: Context): Long = FILES.sumOf { f ->
        val x = File(dir(ctx), f.path)
        if (x.length() == f.size && File(x.path + ".ok").isFile) 0L else f.size - File(x.path + ".part").let { if (it.isFile) it.length() else 0L }
    }

    /** מוריד את מה שחסר (המשך מאותו בייט), בודק טביעה, ורק אז שם במקום. [prog] = (כמה ירד, מתוך) של הכל */
    fun fetch(ctx: Context, cancel: () -> Boolean, prog: (Long, Long) -> Unit) {
        val d = dir(ctx)
        var base = 0L
        for (f in FILES) {
            val out = File(d, f.path); out.parentFile?.mkdirs()
            val ok = File(out.path + ".ok")
            if (out.length() == f.size && ok.isFile) { base += f.size; continue }
            ok.delete()
            if (!(out.length() == f.size && sha(out) == f.sha)) {
                val part = File(out.path + ".part")
                get(f.url, part, cancel) { done -> prog(base + done, TOTAL) }
                if (part.length() != f.size || sha(part) != f.sha) { part.delete(); throw PhWork.Stop("models_sha") }
                out.delete(); if (!part.renameTo(out)) throw PhWork.Stop("models_io")
            }
            ok.writeText(f.sha)
            base += f.size
            prog(base, TOTAL)
        }
    }

    private fun get(url: String, part: File, cancel: () -> Boolean, prog: (Long) -> Unit) {
        var tries = 0
        while (true) {
            try { get1(url, part, cancel, prog); return }
            catch (e: PhWork.Stop) { throw e }
            catch (e: Exception) { if (cancel()) throw PhWork.Stop("stopped"); if (++tries >= 4) throw PhWork.Stop("models_net"); Thread.sleep(3000L * tries) }
        }
    }

    private fun get1(url: String, part: File, cancel: () -> Boolean, prog: (Long) -> Unit) {
        var have = if (part.isFile) part.length() else 0L
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 20000; c.readTimeout = 60000
            if (have > 0) c.setRequestProperty("Range", "bytes=$have-")
            val st = c.responseCode
            if (st == 416) return                                  // כבר הכל (הטביעה תחליט)
            if (st == 200) have = 0 else if (st != 206) throw java.io.IOException("http_$st")
            c.inputStream.use { inp ->
                FileOutputStream(part, have > 0).use { o ->
                    val buf = ByteArray(1 shl 16)
                    var done = have; var last = 0L
                    while (true) {
                        if (cancel()) throw PhWork.Stop("stopped")
                        val n = inp.read(buf); if (n < 0) break
                        o.write(buf, 0, n); done += n
                        if (done - last > (4 shl 20)) { prog(done); last = done }
                    }
                    prog(done)
                }
            }
        } finally { c.disconnect() }
    }

    fun sha(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { i -> val b = ByteArray(1 shl 20); while (true) { val n = i.read(b); if (n < 0) break; md.update(b, 0, n) } }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /** קובץ מהנכסים של ה־APK (מסנני המל) */
    fun asset(ctx: Context, name: String): ByteArray = ctx.assets.open(name).use { it.readBytes() }
}
