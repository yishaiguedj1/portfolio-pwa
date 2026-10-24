package io.github.yishaiguedj1.snowball

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom

/**
 * 24/10/2026 — תרגום בטלפון: רשומה לכל סרטון שנבחר (filesDir/ph/<pid>.json) — כך העבודה ממשיכה אחרי שהמערכת עצרה את
 * האפליקציה, מאותו שלב ומאותו בייט בהעלאה. העותק של הסרטון (ffmpeg לא פותח content://) — ב־noBackupFilesDir/ph/<pid>,
 * ונמחק אחרי הצריבה (או אחרי שבוע בלי צריבה).
 *
 * שלבים (st): picked → audio → upa → start → shots → upm → wait → burn → done; err = נעצר עם קוד (e)
 */
object PhStore {
    const val KEEP_MS = 7 * 24 * 3600_000L

    private fun dir(ctx: Context) = File(ctx.filesDir, "ph").apply { mkdirs() }
    fun work(ctx: Context, pid: String) = File(ctx.noBackupFilesDir, "ph/$pid").apply { mkdirs() }

    fun newPid(): String {
        val b = ByteArray(8); SecureRandom().nextBytes(b)
        return "p" + b.joinToString("") { "%02x".format(it) }
    }

    @Synchronized fun get(ctx: Context, pid: String): JSONObject? {
        if (!PhCore.PID_RE.matches(pid)) return null
        val f = File(dir(ctx), "$pid.json")
        return try { if (f.isFile) JSONObject(f.readText()) else null } catch (e: Throwable) { null }
    }

    @Synchronized fun put(ctx: Context, r: JSONObject) {
        val pid = r.optString("pid")
        if (!PhCore.PID_RE.matches(pid)) return
        val f = File(dir(ctx), "$pid.json"); val t = File(dir(ctx), "$pid.json.tmp")
        t.writeText(r.toString()); t.renameTo(f)
    }

    fun update(ctx: Context, pid: String, fn: (JSONObject) -> Unit): JSONObject? {
        val r = get(ctx, pid) ?: return null
        fn(r); put(ctx, r); return r
    }

    fun drop(ctx: Context, pid: String) {
        work(ctx, pid).deleteRecursively()
        File(dir(ctx), "$pid.json").delete()
    }

    /** ניקוי: עותקים של סרטונים שלא נצרבו שבוע, ורשומות שהסתיימו לפני שבוע */
    fun gc(ctx: Context, now: Long = System.currentTimeMillis()) {
        for (f in dir(ctx).listFiles() ?: emptyArray()) {
            if (!f.name.endsWith(".json")) continue
            val r = try { JSONObject(f.readText()) } catch (e: Throwable) { f.delete(); continue }
            if (now - r.optLong("at") > KEEP_MS) drop(ctx, r.optString("pid"))
        }
    }
}
