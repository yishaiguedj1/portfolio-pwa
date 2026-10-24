package io.github.yishaiguedj1.snowball.lab

import android.content.Context
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import java.io.File

/**
 * Studio Lab — המדידה עצמה (שלב 0 של "תרגום סרטונים בטלפון"). כל שלב כבד של העבודה בשרת, על הקובץ שבחרת:
 * חילוץ הקול, שוטים, צריבה (מקודדי חומרה ו־SVT-AV1), תמלול (Parakeet) ויישור (Qwen, ‏30/45/90 שנ׳, עם arena ובלעדיה),
 * ובכל אחד: זמן, מהירות ביחס לאורך, שיא זיכרון וחום. בסוף — דוח טקסט לשיתוף (אותו פורמט, להדבקה בצ'אט).
 */
object LabRun {
    class Opts(
        val ff: Boolean = true,
        val asr: Boolean = true,
        val align: Boolean = true,
        val asrMin: Int = 10,
        val alMin: Int = 5,
        val burnSec: Int = 60,
        val soak: Boolean = false,      // מבחן עומס: תמלול ברצף 20 דק׳ — כמה מאט מהחום
    )

    val running = mutableStateOf(false)
    val log = mutableStateListOf<String>()
    val report = mutableStateOf("")
    val stage = mutableStateOf("")
    @Volatile private var stop = false

    private val rep = StringBuilder()

    // המצב של Compose מתעדכן רק מהתהליכון הראשי — המדידה רצה בתהליכון משלה
    private val ui = android.os.Handler(android.os.Looper.getMainLooper())
    private fun say(s: String) { ui.post { log.add(s); if (log.size > 400) log.removeAt(0) } }
    private fun st(s: String) { ui.post { stage.value = s } }
    private fun r(s: String) { rep.append(s).append('\n'); say(s) }

    fun cancel() { stop = true; LabFf.cancel() }
    private fun ck() { if (stop) error("stopped") }

    fun start(ctx: Context, input: File, name: String, o: Opts) {
        if (running.value) return
        running.value = true; stop = false; log.clear(); report.value = ""; rep.clear()
        Thread {
            try { go(ctx.applicationContext, input, name, o) } catch (e: Throwable) {
                r("✕ נעצר: ${e.javaClass.simpleName}: ${e.message?.take(300)}")
            } finally {
                r("— ${LabSys.heat(ctx)}")
                val txt = rep.toString()
                ui.post { report.value = txt; stage.value = ""; running.value = false }
            }
        }.also { it.name = "lab" }.start()
    }

    private fun go(ctx: Context, input: File, name: String, o: Opts) {
        val cores = Runtime.getRuntime().availableProcessors()
        r("Studio Lab · ${java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.US).format(java.util.Date())}")
        r(LabSys.device(ctx))
        r(LabSys.heat(ctx))
        val work = File(ctx.cacheDir, "lab").apply { deleteRecursively(); mkdirs() }

        st("מכין את ffmpeg")
        LabFf.init(ctx)
        val info = LabFf.run(ctx, listOf("-hide_banner", "-i", input.absolutePath))
        val dur = FfLine.duration(info.text) ?: 0.0
        val vid = FfLine.video(info.text)
        r("קובץ: ${name.take(60)} · ${Fmt.mb(input.length())} · ${Fmt.dur(dur)}" +
            (vid?.let { v -> " · ${v.first} ${v.second?.let { "${it.first}x${it.second}" } ?: "?"} ${v.third?.let { Fmt.n(it, 2) } ?: "?"}fps" } ?: " · בלי וידאו"))

        // ---------- 1. חילוץ הקול (כמו vt ingest)
        st("מחלץ את הקול")
        val wav = File(work, "a.wav")
        val ex = LabFf.run(ctx, listOf("-hide_banner", "-nostdin", "-y", "-i", input.absolutePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav.absolutePath))
        require(ex.code == 0 && wav.length() > 1000) { "ffmpeg_audio:${ex.last.lastOrNull()}" }
        r("1. חילוץ קול: ${Fmt.n(ex.ms / 1000.0)} שנ׳ (${Fmt.perHour(ex.ms / 1000.0, dur)}) · שיא ffmpeg ${ex.peakChildKb / 1024}MB")
        ck()

        if (o.ff && vid != null) ffTests(ctx, input, work, dur, vid, o)
        ck()
        if (o.asr) asr(ctx, wav, o, cores)
        ck()
        if (o.align) align(ctx, wav, o, cores)
        ck()
        if (o.soak && o.asr) soak(ctx, wav, cores)
        r("סוף · ${LabSys.heat(ctx)}")
    }

    private fun ffTests(ctx: Context, input: File, work: File, dur: Double, vid: Triple<String, Pair<Int, Int>?, Double?>, o: Opts) {
        val enc = LabFf.run(ctx, listOf("-hide_banner", "-encoders"))
        val have = FfLine.encoders(enc.text, listOf("hevc_mediacodec", "h264_mediacodec", "av1_mediacodec", "libx264", "libsvtav1"))
        r("2. מקודדים: ${have.joinToString(", ").ifEmpty { "—" }}")

        // שוטים: scdet על עותק 320px (כמו vt shots), על עד 10 דק׳
        st("שוטים")
        val shotSec = minOf(dur, 600.0)
        val sh = LabFf.run(ctx, listOf("-hide_banner", "-nostdin", "-t", Fmt.n(shotSec, 0), "-i", input.absolutePath, "-vf", "scale=320:-2,scdet=threshold=10", "-an", "-f", "null", "-"))
        r("3. שוטים (${Fmt.dur(shotSec)}): ${Fmt.n(sh.ms / 1000.0)} שנ׳ (${Fmt.perHour(sh.ms / 1000.0, shotSec)}) · ${sh.speed?.let { Fmt.n(it) + "x" } ?: "?"}" +
            if (sh.code != 0) " · ✕ ${sh.last.lastOrNull()?.take(120)}" else "")
        ck()

        // צריבה: כתוביות בעברית (libass) על [burnSec] שנ׳, בכל מקודד שקיים
        val (w, h) = vid.second ?: (1920 to 1080)
        val fonts = File(work, "fonts").apply { mkdirs() }
        ctx.assets.open("Assistant-SemiBold.ttf").use { i -> File(fonts, "Assistant-SemiBold.ttf").outputStream().use { i.copyTo(it) } }
        val ass = File(work, "t.ass").apply { writeText(TestAss.build(o.burnSec.toDouble(), "Assistant SemiBold", w, h)) }
        val sec = minOf(dur, o.burnSec.toDouble())
        val br = (input.length() * 8 / maxOf(1.0, dur) * 0.9).toLong().coerceIn(2_000_000, 20_000_000)
        val hw = listOf("hevc_mediacodec" to br, "h264_mediacodec" to br * 3 / 2, "av1_mediacodec" to br * 3 / 4).filter { it.first in have }
        val sw = buildList {
            if ("libsvtav1" in have) add("libsvtav1 p10" to listOf("-c:v", "libsvtav1", "-preset", "10", "-crf", "32"))
            if ("libx264" in have) add("libx264 veryfast" to listOf("-c:v", "libx264", "-preset", "veryfast", "-crf", "22"))
        }
        val vf = "subtitles=${ass.absolutePath}:fontsdir=${fonts.absolutePath}"
        val out = File(work, "b.mp4")
        fun burn(lbl: String, pix: String, codec: List<String>, s: Double, extra: List<String> = emptyList()): LabFf.Out {
            out.delete()
            return LabFf.run(ctx, listOf("-hide_banner", "-nostdin", "-y") + extra + listOf("-t", Fmt.n(s, 0), "-i", input.absolutePath, "-vf", "$vf,format=$pix") +
                codec + listOf("-an", out.absolutePath))
        }
        fun okLine(lbl: String, pix: String, b: LabFf.Out) =
            r("4. צריבה $lbl ($pix, ${Fmt.dur(sec)}): ${Fmt.n(b.ms / 1000.0)} שנ׳ = ${Fmt.n(sec / (b.ms / 1000.0), 2)}x זמן אמת (${Fmt.perHour(b.ms / 1000.0, sec)}) · " +
                "${b.fps?.let { Fmt.n(it, 0) } ?: "?"}fps · ${Fmt.mb(out.length())} · שיא ${b.peakChildKb / 1024}MB · ${LabSys.heat(ctx)}")

        // מקודדי החומרה דרך ffmpeg: נכשלו בגרסה 2 בכל הצורות ("Could not open encoder", ‏-22). ניסיון אחד, והשורות של המקודד עצמו
        for ((name, rate) in hw) {
            ck()
            st("צריבה · $name")
            val b = burn(name, "nv12", listOf("-c:v", name, "-b:v", "$rate", "-ndk_codec", "1"), minOf(3.0, sec), listOf("-loglevel", "debug"))
            if (b.code == 0 && out.length() > 0) { r("4. $name (ffmpeg): ✓"); continue }
            r("4. $name (ffmpeg): ✕ קוד ${b.code}")
            for (l in FfLine.own(b.text, name, 10)) r("   $l")
        }

        // המסלול החדש: ffmpeg צורב את הכתוביות ומוציא פריימים, MediaCodec של אנדרואיד מקודד (בתוך האפליקציה)
        val fps = vid.third ?: 30.0
        for ((mime, lbl, rate) in listOf(Triple("video/hevc", "HEVC", br), Triple("video/avc", "H.264", br * 3 / 2), Triple("video/av01", "AV1", br * 3 / 4))) {
            ck()
            st("צריבה · MediaCodec $lbl")
            val res = LabCodec.burn(ctx, input, vf, sec, w, h, fps, mime, rate.toInt(), out, File(work, "ff.err"), { stop })
            if (res.ok) {
                val s = res.ms / 1000.0
                r("4. צריבה MediaCodec $lbl · ${res.codec} (${Fmt.dur(sec)}): ${Fmt.n(s)} שנ׳ = ${Fmt.n(sec / s, 2)}x זמן אמת (${Fmt.perHour(s, sec)}) · " +
                    "${Fmt.n(res.frames / s, 0)}fps · ${res.frames} פריימים · ${Fmt.mb(res.bytes)} · ${LabSys.heat(ctx)}")
            } else r("4. צריבה MediaCodec $lbl: ✕ ${res.codec ?: ""} ${res.err ?: ""}".trim())
        }
        for ((lbl, codec) in sw) {
            ck()
            st("צריבה · $lbl")
            val b = burn(lbl, "yuv420p", codec, sec)
            if (b.code == 0 && out.length() > 0) okLine(lbl, "yuv420p", b)
            else { r("4. צריבה $lbl: ✕ קוד ${b.code}"); for (l in FfLine.errors(b.text, 6)) r("   $l") }
        }
        File(work, "b.mp4").delete()
    }

    private fun asr(ctx: Context, wav: File, o: Opts, cores: Int) {
        if (!LabModels.ready(ctx, "parakeet")) { r("5. תמלול: דילוג — המודל לא הורד"); return }
        st("טוען את Parakeet")
        val inf = Wav.info(wav)
        val sec = minOf(inf.seconds, o.asrMin * 60.0)
        System.gc()
        val s = LabSys.Sampler()
        val t0 = System.nanoTime()
        Parakeet(LabModels.dir(ctx, "parakeet"), cores).use { p ->
            val load = (System.nanoTime() - t0) / 1e9
            val rssLoad = LabSys.selfRssKb() / 1024
            val text = StringBuilder(); var toks = 0
            val t1 = System.nanoTime()
            val wins = Win.of(sec, 20.0)
            for ((i, w) in wins.withIndex()) {
                ck()
                st("תמלול ${i + 1}/${wins.size}")
                val res = p.transcribe(Wav.read(wav, w.first, w.second - w.first))
                toks += res.tokens
                if (text.length < 400) text.append(res.text).append(' ')
            }
            val el = (System.nanoTime() - t1) / 1e9
            s.stop()
            r("5. תמלול Parakeet ($cores תהליכונים, ${Fmt.dur(sec)} בחלונות של 20 שנ׳): טעינה ${Fmt.n(load)} שנ׳ (RSS ${rssLoad}MB) · " +
                "${Fmt.n(el)} שנ׳ = RTF ${Fmt.n(el / sec, 3)} (${Fmt.perHour(el, sec)}) · $toks טוקנים · שיא ${s.peakSelfKb / 1024}MB · ${LabSys.heat(ctx)}")
            r("   \"${text.toString().trim().take(300)}\"")
        }
    }

    private fun align(ctx: Context, wav: File, o: Opts, cores: Int) {
        if (!LabModels.ready(ctx, "aligner")) { r("6. יישור: דילוג — המודל לא הורד"); return }
        val mel = LabModels.asset(ctx, "whisper128.onnx")
        val inf = Wav.info(wav)
        val sec = minOf(inf.seconds, o.alMin * 60.0)
        // מהזול לכבד: בלי arena קודם (הכי פחות זיכרון), ו־90 שנ׳ עם arena = מה שהשרת עושה היום
        for ((chunk, arena) in listOf(30.0 to false, 45.0 to false, 90.0 to false, 90.0 to true)) {
            ck()
            if (arena && LabSys.availMb(ctx) < 2500) { r("6. יישור $chunk שנ׳ + arena: דילוג — פנוי רק ${LabSys.availMb(ctx)}MB"); continue }
            st("יישור · $chunk שנ׳" + if (arena) " + arena" else "")
            System.gc()
            val s = LabSys.Sampler()
            val t0 = System.nanoTime()
            try {
                QwenAlign(LabModels.dir(ctx, "aligner"), mel, cores, arena).use { q ->
                    val load = (System.nanoTime() - t0) / 1e9
                    var mel0 = 0L; var enc = 0L; var dec = 0L; var worst = 0L
                    val wins = Win.of(sec, chunk)
                    val t1 = System.nanoTime()
                    for ((i, w) in wins.withIndex()) {
                        ck()
                        st("יישור · ${chunk.toInt()} שנ׳${if (arena) " + arena" else ""} · ${i + 1}/${wins.size}")
                        val a = Wav.read(wav, w.first, w.second - w.first)
                        val res = q.run(a, ((w.second - w.first) * 8).toInt(), i.toLong())   // ~8 טוקני טקסט לשנייה (מילים + חותמות זמן)
                        mel0 += res.melMs; enc += res.encMs; dec += res.decMs
                        worst = maxOf(worst, res.melMs + res.encMs + res.decMs)
                    }
                    val el = (System.nanoTime() - t1) / 1e9
                    s.stop()
                    r("6. יישור Qwen ${chunk.toInt()} שנ׳${if (arena) " + arena" else ""} (${Fmt.dur(sec)}): טעינה ${Fmt.n(load)} שנ׳ · ${Fmt.n(el)} שנ׳ (${Fmt.perHour(el, sec)}) · " +
                        "מל ${mel0 / 1000}s · מקודד ${enc / 1000}s · מפענח ${dec / 1000}s · חלק כבד ${Fmt.n(worst / 1000.0)} שנ׳ · שיא ${s.peakSelfKb / 1024}MB · ${LabSys.heat(ctx)}")
                }
            } catch (e: OutOfMemoryError) {
                s.stop(); r("6. יישור ${chunk.toInt()} שנ׳${if (arena) " + arena" else ""}: ✕ אין זיכרון (שיא ${s.peakSelfKb / 1024}MB)")
            }
        }
    }

    /** תמלול ברצף 20 דק׳ — הקצב בכל 2 דק׳ מול החום: כמה הטלפון מאט בעבודה של שעה */
    private fun soak(ctx: Context, wav: File, cores: Int) {
        if (!LabModels.ready(ctx, "parakeet")) return
        val inf = Wav.info(wav)
        r("7. מבחן עומס (תמלול ברצף 20 דק׳):")
        Parakeet(LabModels.dir(ctx, "parakeet"), cores).use { p ->
            val end = System.nanoTime() + 20 * 60_000_000_000L
            var pos = 0.0; var audio = 0.0; var t = System.nanoTime(); var k = 0
            while (System.nanoTime() < end) {
                ck()
                if (pos >= inf.seconds - 20) pos = 0.0
                p.transcribe(Wav.read(wav, pos, 20.0)); pos += 20; audio += 20
                val el = (System.nanoTime() - t) / 1e9
                if (el >= 120) { k++; r("   ${k * 2} דק׳: ${Fmt.n(audio / el, 1)}x זמן אמת · ${LabSys.heat(ctx)}"); audio = 0.0; t = System.nanoTime() }
                st("מבחן עומס · ${k * 2} דק׳")
            }
        }
    }
}
