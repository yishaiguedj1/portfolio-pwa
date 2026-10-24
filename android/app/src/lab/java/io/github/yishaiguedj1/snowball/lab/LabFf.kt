package io.github.yishaiguedj1.snowball.lab

import android.content.Context
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import java.io.File

/**
 * Studio Lab — ה־ffmpeg 7.1 שבתוך youtubedl-android (אותו בינארי של Studio ו־DM): libass, ‏fribidi, ‏harfbuzz, ‏x264,
 * ‏SVT-AV1, ומקודדי החומרה ‏*_mediacodec. רץ כתהליך נפרד מתיקיית הספריות (כמו yt-dlp), עם הספריות שחולצו.
 */
object LabFf {
    class Out(val code: Int, val ms: Long, val text: String, val last: List<String>, val speed: Double?, val fps: Double?, val peakChildKb: Long)

    @Volatile private var cur: Process? = null

    fun init(ctx: Context) {
        YoutubeDL.getInstance().init(ctx.applicationContext)
        FFmpeg.getInstance().init(ctx.applicationContext)
    }

    private fun env(ctx: Context): Map<String, String> {
        val pk = File(ctx.noBackupFilesDir, "youtubedl-android/packages")
        return mapOf(
            "LD_LIBRARY_PATH" to "${File(pk, "python/usr/lib")}:${File(pk, "ffmpeg/usr/lib")}",
            "HOME" to ctx.filesDir.absolutePath,
            "TMPDIR" to ctx.cacheDir.absolutePath,
        )
    }

    private fun pidOf(p: Process): Int = try {
        p.javaClass.getDeclaredField("pid").apply { isAccessible = true }.getInt(p)
    } catch (e: Throwable) { 0 }

    /** מריץ ffmpeg (או ffprobe) ומחזיר את כל הפלט, הזמן, המהירות האחרונה ושיא הזיכרון של התהליך */
    fun run(ctx: Context, args: List<String>, probe: Boolean = false, onLine: (String) -> Unit = {}): Out {
        val bin = File(ctx.applicationInfo.nativeLibraryDir, if (probe) "libffprobe.so" else "libffmpeg.so").absolutePath
        val pb = ProcessBuilder(listOf(bin) + args).redirectErrorStream(true)
        pb.environment().putAll(env(ctx))
        val t0 = System.nanoTime()
        val p = pb.start(); cur = p
        val pid = pidOf(p)
        val s = LabSys.Sampler { pid }
        val sb = StringBuilder()
        val last = ArrayDeque<String>()
        var speed: Double? = null; var fps: Double? = null
        p.inputStream.bufferedReader().use { r ->
            // ffmpeg כותב את ההתקדמות עם \r — קוראים תו־תו ומפרקים גם עליו
            val line = StringBuilder()
            while (true) {
                val c = r.read()
                if (c < 0 || c == '\n'.code || c == '\r'.code) {
                    if (line.isNotEmpty()) {
                        val l = line.toString(); line.clear()
                        FfLine.parse(l)?.let { pr -> pr.speed?.let { speed = it }; pr.fps?.let { fps = it }; onLine(l) }
                            ?: run { if (sb.length < 200_000) sb.append(l).append('\n') }
                        last.addLast(l); while (last.size > 12) last.removeFirst()
                    }
                    if (c < 0) break
                } else line.append(c.toChar())
            }
        }
        val code = p.waitFor(); cur = null
        s.stop()
        return Out(code, (System.nanoTime() - t0) / 1_000_000, sb.toString(), last.toList(), speed, fps, s.peakChildKb)
    }

    /** ffmpeg שהפלט שלו (stdout) הוא הנתונים — לצינור אל MediaCodec. השגיאות לקובץ, כדי שהצינור לא ייתקע */
    fun spawn(ctx: Context, args: List<String>, err: File): Process {
        val bin = File(ctx.applicationInfo.nativeLibraryDir, "libffmpeg.so").absolutePath
        val pb = ProcessBuilder(listOf(bin) + args).redirectError(err)
        pb.environment().putAll(env(ctx))
        return pb.start().also { cur = it }
    }

    fun cancel() { cur?.destroy() }
}
