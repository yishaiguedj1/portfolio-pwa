package io.github.yishaiguedj1.snowball

import android.content.Context
import io.github.yishaiguedj1.snowball.lab.Parakeet
import io.github.yishaiguedj1.snowball.ph2.Diarize
import io.github.yishaiguedj1.snowball.ph2.NemoMel
import io.github.yishaiguedj1.snowball.ph2.PhoneAlign
import io.github.yishaiguedj1.snowball.ph2.PhoneAsr
import io.github.yishaiguedj1.snowball.ph2.PwJson
import io.github.yishaiguedj1.snowball.ph2.QTok
import io.github.yishaiguedj1.snowball.ph2.QwenAligner
import io.github.yishaiguedj1.snowball.ph2.SileroVad
import io.github.yishaiguedj1.snowball.ph2.WavAudio
import io.github.yishaiguedj1.snowball.ph2.WeSpeaker
import io.github.yishaiguedj1.snowball.ph2.WhisperMel
import io.github.yishaiguedj1.snowball.ph2.Word
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 25/10/2026 — תרגום בטלפון, שלב 2: התמלול, זיהוי הדוברים והיישור בטלפון — הקוד של השרת ב־Kotlin (ph2, ‏Ph2Test).
 * כל שלב נשמר בתיקיית העבודה, כך שעצירה של המערכת באמצע ממשיכה מהשלב (והיישור — מהקטע) שבו נעצרה:
 *   a16.wav (+.ok) → asr.json → diar.json → align.part.json → words.json (מה שעולה לשרתון, ‏PwJson)
 * מודל אחד בזיכרון בכל רגע (נטען ונסגר בכל שלב).
 */
object PhLocal {
    /** [step] = (שלב: wav/asr/diar/align, חלק 0..1 או ‎-1‎ כשלא ידוע) */
    fun run(ctx: Context, work: File, src: File, stopped: () -> Boolean, step: (String, Float) -> Unit): File {
        val out = File(work, "words.json")
        if (out.isFile && out.length() > 0) return out
        val md = PhModels.dir(ctx)
        val cores = Runtime.getRuntime().availableProcessors().coerceIn(1, 8)
        fun chk() { if (stopped()) throw PhWork.Stop("stopped") }
        // 27/10/2026: זמן, סוללה וחום לכל שלב (PhTel) — נכנס ל־words.json; כשל במדידה לא נוגע בעבודה
        val tel = PhTel(File(work, "tel.json")) { PhTel.snapOf(ctx) }
        val stepT: (String, Float) -> Unit = { s, f -> tel.stage(s); step(s, f) }
        try {
            // 1. הקול 16kHz מונו (כמו vt ingest)
            val wav = File(work, "a16.wav"); val wok = File(work, "a16.wav.ok")
            if (!wok.isFile) {
                stepT("wav", -1f)
                val o = PhFf.run(ctx, PhCore.wav16Args(src.absolutePath, wav.absolutePath), stop = stopped)
                chk()
                if (o.code != 0 || wav.length() < 1000) { wav.delete(); throw PhWork.Stop("no_audio") }
                wok.writeText("1")
            }
            WavAudio(wav).use { au ->
                // 2. תמלול (Silero + Parakeet + חורים)
                val asrF = File(work, "asr.json")
                val words: List<Word> = if (asrF.isFile) readWords(asrF) else {
                    stepT("asr", 0f)
                    val r = SileroVad(File(md, "vad/silero_vad.onnx")).use { vad ->
                        Parakeet(File(md, "parakeet"), cores).use { pk ->
                            PhoneAsr(vad, pk, NemoMel(NemoMel.filters(PhModels.asset(ctx, "ph2/nemo_mel_128.bin")))).run(au) { st, i, t ->
                                chk()
                                stepT("asr", when (st) { "vad" -> 0.1f * i / t; "asr" -> 0.1f + 0.85f * i / t; else -> 0.95f + 0.05f * i / t })
                            }
                        }
                    }
                    if (r.words.isEmpty()) throw PhWork.Stop("no_speech")
                    val ws = PwJson.words(r.words)
                    writeWords(asrF, ws, JSONObject().put("holes", r.holes).put("rescued", r.rescued)); ws
                }
                chk()
                // 3. דוברים
                val dF = File(work, "diar.json")
                var dst: Diarize.Stats? = null; var dsec: Double? = null
                if (dF.isFile) {
                    val o = JSONObject(dF.readText()); val sp = o.getJSONArray("spk")
                    for (i in words.indices) words[i].spk = if (sp.isNull(i)) null else sp.getString(i)
                    if (o.has("speakers")) { dst = Diarize.Stats(o.getInt("speakers"), o.getInt("units"), emptyMap()); dsec = o.optDouble("seconds") }
                } else {
                    stepT("diar", -1f)
                    val t0 = System.currentTimeMillis()
                    try {
                        dst = WeSpeaker(File(md, "speaker/voxceleb_resnet34_LM.onnx"), minOf(cores, 4)).use { Diarize.assign(words, au, it) }
                        dsec = Math.round((System.currentTimeMillis() - t0) / 100.0) / 10.0
                    } catch (e: PhWork.Stop) { throw e } catch (e: Throwable) {
                        for (w in words) w.spk = null; dst = null                 // כמו בשרת: זיהוי דוברים לעולם לא מפיל
                    }
                    val o = JSONObject().put("spk", JSONArray(words.map { it.spk ?: JSONObject.NULL }))
                    dst?.let { o.put("speakers", it.speakers).put("units", it.units).put("seconds", dsec) }
                    dF.writeText(o.toString())
                }
                chk()
                // 4. יישור (Qwen, קטעים של עד 90 שנ׳ — כמו בשרת)
                stepT("align", 0f)
                val am = File(md, "aligner/model")
                val cfg = JSONObject(File(am, "config.json").readText())
                val tok = QTok(File(am, "vocab.json").readText(), File(am, "merges.txt").readText(), QTok.addedFrom(File(am, "tokenizer_config.json").readText()))
                val mel = WhisperMel(WhisperMel.filters(PhModels.asset(ctx, "ph2/whisper_mel_128.bin")))
                QwenAligner(File(md, "aligner"), cores, false, tok, mel, cfg.getJSONObject("thinker_config").getInt("audio_token_id"),
                    cfg.getInt("timestamp_token_id"), cfg.getDouble("timestamp_segment_time")).use { al ->
                    PhoneAlign(al).run(words, au, File(work, "align.part.json")) { i, t -> chk(); stepT("align", i.toFloat() / t) }
                }
                tel.end()
                val mem = try { (ctx.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).let { am ->
                    android.app.ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.totalMem / (1L shl 30) }.toInt() + 1 } catch (e: Throwable) { 0 }
                val tmp = File(work, "words.json.tmp")
                tmp.writeText(PwJson.build(words, dst, dsec).put("tel", tel.json(Runtime.getRuntime().availableProcessors(), mem, android.os.Build.VERSION.SDK_INT)).toString())
                if (!tmp.renameTo(out)) throw PhWork.Stop("io")
            }
            wav.delete(); wok.delete()          // המקור עדיין בטלפון; הקול לא נחוץ יותר
            return out
        } finally { tel.end() }
    }

    private fun writeWords(f: File, ws: List<Word>, extra: JSONObject) {
        val a = JSONArray(); for (w in ws) a.put(JSONObject().put("w", w.w).put("s", w.s).put("e", w.e))
        val t = File(f.path + ".tmp"); t.writeText(extra.put("words", a).toString()); t.renameTo(f)
    }

    private fun readWords(f: File): List<Word> {
        val a = JSONObject(f.readText()).getJSONArray("words")
        return List(a.length()) { a.getJSONObject(it).let { o -> Word(o.getString("w"), o.getDouble("s"), o.getDouble("e")) } }
    }
}
