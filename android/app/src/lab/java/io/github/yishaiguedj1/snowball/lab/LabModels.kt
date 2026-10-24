package io.github.yishaiguedj1.snowball.lab

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Studio Lab — המודלים, פעם אחת ובאחסון הפנימי (לא בגיבוי). כל קובץ נבדק ב־sha256 לפני שימוש:
 * Parakeet — אותם קבצים של istupakov/parakeet-tdt-0.6b-v2-onnx שהשרת טוען (הטביעות מ־Hugging Face);
 * Qwen — הגרפים מתמונת העובד (‏/opt/aligner), שה־workflow ‏lab-models מעלה ל־Release, עם ה־manifest שלהם.
 */
object LabModels {
    private const val HF = "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v2-onnx/resolve/main/"
    private const val GH = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/lab-models/"

    class F(val name: String, val url: String, val sha: String?, val size: Long)

    val PARAKEET = listOf(
        F("config.json", HF + "config.json", "666903c76b9798caf2c210afd4f6cd60b08a8dbf9800ec8d7a3bc0d2148ac466", 97),
        F("vocab.txt", HF + "vocab.txt", "ec182b70dd42113aff6c5372c75cac58c952443eb22322f57bbd7f53977d497d", 9384),
        F("nemo128.onnx", HF + "nemo128.onnx", "a9fde1486ebfcc08f328d75ad4610c67835fea58c73ba57e3209a6f6cf019e9f", 139764),
        F("decoder_joint-model.int8.onnx", HF + "decoder_joint-model.int8.onnx", "a449f49acd68979d418651dd2dcb737cc0f1bf0225e009e29ee326354edbf7d3", 8998286),
        F("encoder-model.int8.onnx", HF + "encoder-model.int8.onnx", "3e0581fda6ab843888b51e56d7ee78b6d5bc3237ec113af1f732d1d5286aa155", 652184014),
    )
    val ALIGN_FILES = listOf("audio-conv.onnx", "audio-encoder.onnx", "text-decoder.onnx", "embed.npy", "pos.npy")

    fun dir(ctx: Context, g: String) = File(ctx.noBackupFilesDir, "lab/$g").apply { mkdirs() }

    fun ready(ctx: Context, g: String): Boolean = when (g) {
        "parakeet" -> PARAKEET.all { File(dir(ctx, g), it.name).length() == it.size }
        else -> File(dir(ctx, g), "manifest.json").isFile && ALIGN_FILES.all { File(dir(ctx, g), it).isFile }
    }

    fun sizeMb(g: String): Long = if (g == "parakeet") PARAKEET.sumOf { it.size } / 1048576 else 1067

    /** מוריד את מה שחסר (עם המשך מאותו בייט), בודק טביעה, ורק אז שם את הקובץ במקומו */
    fun fetch(ctx: Context, g: String, cancel: () -> Boolean, prog: (String, Long, Long) -> Unit) {
        val d = dir(ctx, g)
        val files = if (g == "parakeet") PARAKEET else {
            val man = File(d, "manifest.json")
            get(GH + "manifest.json", File(d, "manifest.json.part"), cancel) { _, _ -> }
            File(d, "manifest.json.part").renameTo(man)
            val sha = JSONObject(man.readText()).getJSONObject("sha256")
            ALIGN_FILES.map { F(it, GH + it, sha.getString(it), -1) }
        }
        for (f in files) {
            val out = File(d, f.name)
            if (out.isFile && (f.size < 0 || out.length() == f.size) && (f.sha == null || sha(out) == f.sha)) continue
            val part = File(d, f.name + ".part")
            get(f.url, part, cancel) { done, total -> prog(f.name, done, total) }
            if (f.sha != null && sha(part) != f.sha) { part.delete(); error("sha:${f.name}") }
            out.delete(); require(part.renameTo(out)) { "rename:${f.name}" }
        }
    }

    private fun get(url: String, part: File, cancel: () -> Boolean, prog: (Long, Long) -> Unit) {
        var have = if (part.isFile) part.length() else 0L
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 20000; c.readTimeout = 60000
            if (have > 0) c.setRequestProperty("Range", "bytes=$have-")
            val st = c.responseCode
            if (st == 200) have = 0 else require(st == 206) { "http_$st:${part.name}" }
            val total = have + c.contentLengthLong.coerceAtLeast(0)
            c.inputStream.use { inp ->
                FileOutputStream(part, have > 0).use { o ->
                    val buf = ByteArray(1 shl 16)
                    var done = have; var last = 0L
                    while (true) {
                        if (cancel()) error("cancel")
                        val n = inp.read(buf); if (n < 0) break
                        o.write(buf, 0, n); done += n
                        if (done - last > (4 shl 20)) { prog(done, total); last = done }
                    }
                    prog(done, total)
                }
            }
        } finally { c.disconnect() }
    }

    fun sha(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { i -> val b = ByteArray(1 shl 20); while (true) { val n = i.read(b); if (n < 0) break; md.update(b, 0, n) } }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /** whisper128.onnx (‏onnx_asr, ‏MIT) — מהנכסים של ה־APK לקובץ, כי ONNX Runtime טוען מנתיב */
    fun asset(ctx: Context, name: String): File {
        val f = File(dir(ctx, "assets"), name)
        if (!f.isFile) ctx.assets.open(name).use { i -> f.outputStream().use { i.copyTo(it) } }
        return f
    }
}
