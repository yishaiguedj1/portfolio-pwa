package io.github.yishaiguedj1.snowball

import android.content.Context
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import java.io.File

/**
 * 24/10/2026 — תרגום בטלפון: ה־ffmpeg/ffprobe שבתוך youtubedl-android (אותו בינארי של ההורדות; נבדק ב־Studio Lab:
 * libass, ‏fribidi, ‏harfbuzz). רץ כתהליך נפרד מתיקיית הספריות, עם הספריות שחולצו (extractNativeLibs).
 */
object PhFf {
    class Out(val code: Int, val out: String, val err: String)

    @Volatile private var cur: Process? = null
    @Volatile private var ready = false

    fun init(ctx: Context) {
        if (ready) return
        YoutubeDL.getInstance().init(ctx.applicationContext)
        FFmpeg.getInstance().init(ctx.applicationContext)
        ready = true
    }

    private fun env(ctx: Context): Map<String, String> {
        val pk = File(ctx.noBackupFilesDir, "youtubedl-android/packages")
        return mapOf(
            "LD_LIBRARY_PATH" to "${File(pk, "python/usr/lib")}:${File(pk, "ffmpeg/usr/lib")}",
            "HOME" to ctx.filesDir.absolutePath,
            "TMPDIR" to ctx.cacheDir.absolutePath,
            "FONTCONFIG_PATH" to ctx.cacheDir.absolutePath,
        )
    }

    private fun bin(ctx: Context, probe: Boolean) = File(ctx.applicationInfo.nativeLibraryDir, if (probe) "libffprobe.so" else "libffmpeg.so").absolutePath

    /** מריץ ffmpeg / ffprobe עד הסוף. stdout נשמר (ל־ffprobe — ה־JSON); מ־stderr רק השורות ש־keep מחזיר עליהן true
     *  (scdet כותב שורה לכל חיתוך), ועוד 12 השורות האחרונות לאבחון */
    fun run(ctx: Context, args: List<String>, probe: Boolean = false, stop: () -> Boolean = { false }, keep: (String) -> Boolean = { false }): Out {
        init(ctx)
        val errF = File(ctx.cacheDir, "ph-ff.err")
        val pb = ProcessBuilder(listOf(bin(ctx, probe)) + args).redirectError(errF)
        pb.environment().putAll(env(ctx))
        val p = pb.start(); cur = p
        val watcher = Thread { while (p.isAlive) { if (stop()) { p.destroy(); break }; try { Thread.sleep(300) } catch (e: InterruptedException) { break } } }
        watcher.start()
        val out = p.inputStream.bufferedReader().use { it.readText() }
        val code = p.waitFor(); cur = null
        watcher.interrupt()
        val kept = StringBuilder(); val last = ArrayDeque<String>()
        if (errF.isFile) errF.bufferedReader().useLines { ls ->
            ls.forEach { l -> if (keep(l)) kept.append(l).append('\n'); last.addLast(l); while (last.size > 12) last.removeFirst() }
        }
        errF.delete()
        return Out(code, out, kept.toString() + last.joinToString("\n"))
    }

    /** ffmpeg שהפלט שלו (stdout) הוא הנתונים — לצינור אל MediaCodec. השגיאות לקובץ, כדי שהצינור לא ייתקע */
    fun spawn(ctx: Context, args: List<String>, err: File): Process {
        init(ctx)
        val pb = ProcessBuilder(listOf(bin(ctx, false)) + args).redirectError(err)
        pb.environment().putAll(env(ctx))
        return pb.start().also { cur = it }
    }

    fun cancel() { cur?.destroy() }
}
