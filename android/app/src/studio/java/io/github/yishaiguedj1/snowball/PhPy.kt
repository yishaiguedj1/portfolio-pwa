package io.github.yishaiguedj1.snowball

import android.content.Context
import com.yausername.youtubedl_android.YoutubeDL
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipInputStream

/**
 * 25/10/2026 — תרגום בטלפון, שלב 3: שלבי הטקסט (ההגהה, התכנון, התרגום, הביקורת, השופט והבנייה — translator/job.py auto)
 * רצים כאן, בפייתון של youtubedl-android (3.12, ספרייה סטנדרטית בלבד). הקוד של העובד נארז בבנייה (translator.zip —
 * build.gradle.kts, ptPack) ונפתח לתיקייה פרטית בפעם הראשונה אחרי כל עדכון. הקריאות ל־Claude עוברות דרך התור בשרתון
 * (job.py יודע לבד — rh בלקיחה), והשרת שלנו עונה עם המפתח של המערכת. אין כאן מפתח ואין גישה ל־Claude.
 */
object PhPy {
    private const val ZIP = "translator.zip"
    private val FONTS = listOf("Arimo-Bold.ttf", "Assistant-SemiBold.ttf", "metrics.json")   // translator/fonts — כבר נכסים (לצריבה)

    @Volatile private var cur: Process? = null

    fun dir(ctx: Context) = File(ctx.filesDir, "translator")

    /** הקוד של העובד בתיקייה פרטית — נפתח מחדש רק כשהארכיון באפליקציה השתנה (טביעה) */
    fun ensure(ctx: Context): File {
        val bytes = ctx.assets.open(ZIP).use { it.readBytes() }
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val d = dir(ctx)
        val mark = File(d, ".v")
        if (mark.isFile && mark.readText() == sha) return d
        val tmp = File(ctx.filesDir, "translator.new")
        tmp.deleteRecursively(); tmp.mkdirs()
        val root = tmp.canonicalPath + File.separator
        ZipInputStream(bytes.inputStream()).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                val f = File(tmp, e.name)
                if (!f.canonicalPath.startsWith(root)) throw SecurityException("zip")   // בלי ../ — רק בתוך התיקייה
                if (e.isDirectory) { f.mkdirs(); continue }
                f.parentFile?.mkdirs()
                f.outputStream().use { z.copyTo(it) }
            }
        }
        val fonts = File(tmp, "fonts").apply { mkdirs() }
        for (fn in FONTS) ctx.assets.open(fn).use { i -> File(fonts, fn).outputStream().use { i.copyTo(it) } }
        File(tmp, ".v").writeText(sha)
        d.deleteRecursively()
        if (!tmp.renameTo(d)) throw IllegalStateException("translator_dir")
        return d
    }

    /** הסביבה של הפייתון — כמו ש־youtubedl-android מריץ את yt-dlp, ועוד מה ש־job.py צריך בטלפון */
    fun env(ctx: Context, work: File): Map<String, String> {
        val pk = File(ctx.noBackupFilesDir, "youtubedl-android/packages")
        val home = File(pk, "python/usr")
        return mapOf(
            "LD_LIBRARY_PATH" to "${File(home, "lib")}:${File(pk, "ffmpeg/usr/lib")}",
            "PYTHONHOME" to home.absolutePath,
            "SSL_CERT_FILE" to File(home, "etc/tls/cert.pem").absolutePath,
            "HOME" to File(work, "home").apply { mkdirs() }.absolutePath,
            "TMPDIR" to ctx.cacheDir.absolutePath,
            "PYTHONUNBUFFERED" to "1", "PYTHONUTF8" to "1",   // עברית בפלט ובקבצים — בלי תלות בשפה של המערכת
            "SNB_PHONE" to "1",                                  // job.py: בלי התקנה ובלי מנועים כבדים
            "SNB_STATE" to File(work, "pt-state").absolutePath,
            "VT_WORK" to File(work, "pt-vt").absolutePath,
            "VT_PY" to py(ctx),
            "SNB_LADDER" to "off", "SNB_LEARNMEDIA" to "off", "SNB_EARLY_SHOTS" to "off",
        )
    }

    fun py(ctx: Context) = File(ctx.applicationInfo.nativeLibraryDir, "libpython.so").absolutePath

    /** הפייתון עם הארגומנטים (‎-u job.py …), עד הסוף (או עד stop). הפלט — ל־pt.log בתיקיית העבודה (12 השורות האחרונות
     *  חוזרות לאבחון) */
    fun run(ctx: Context, work: File, args: List<String>, stop: () -> Boolean, tick: () -> Unit = {}): Pair<Int, String> {
        YoutubeDL.getInstance().init(ctx.applicationContext)    // מחלץ את הפייתון (פעם אחת)
        val d = ensure(ctx)
        val log = File(work, "pt.log")
        val pb = ProcessBuilder(listOf(py(ctx)) + args)
            .directory(d.parentFile).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(log))
        pb.environment().putAll(env(ctx, work))
        val p = pb.start(); cur = p
        while (true) {
            if (p.waitFor(1, java.util.concurrent.TimeUnit.SECONDS)) break
            if (stop()) { p.destroy(); p.waitFor(); break }
            tick()
        }
        cur = null
        val tail = try { log.readLines().takeLast(12).joinToString("\n") } catch (e: Throwable) { "" }
        return p.exitValue() to tail
    }

    fun cancel() { cur?.destroy() }

    /** השלב האחרון ש־job.py כתב (prog.json — mirror_prog): {st, p} */
    fun prog(work: File): Pair<String, Float> = try {
        val o = JSONObject(File(work, "pt-state/prog.json").readText())
        o.optString("st") to o.optDouble("p", -1.0).toFloat()
    } catch (e: Throwable) { "" to -1f }
}
