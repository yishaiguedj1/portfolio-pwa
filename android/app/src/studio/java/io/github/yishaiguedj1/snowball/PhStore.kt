package io.github.yishaiguedj1.snowball

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom

/**
 * 24/10/2026 — תרגום בטלפון: רשומה לכל סרטון שנבחר (filesDir/ph/<pid>.json) — כך העבודה ממשיכה אחרי שהמערכת עצרה את
 * האפליקציה, מאותו שלב ומאותו בייט בהעלאה. העותק של הסרטון (ffmpeg לא פותח content://) — ב־noBackupFilesDir/ph/<pid>,
 * ונשמר עד שהפרויקט נמחק באתר (לצריבה נוספת — gcRemote), או אחרי שבוע כשלא נוצרה לו עבודה.
 *
 * שלבים (st): picked → audio → upa → start → shots → upm → wait → burn → done; err = נעצר עם קוד (e)
 * "הכל בטלפון" (pw): picked → models → wav → asr → diar → align → upw → shots → upm → start → wait → burn → done
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

    // 29/10/2026: synchronized — שני תהליכונים כותבים לאותה רשומה (הקול ב־PhService והסרטון ב־PhUpJob); בלי זה אחד דורס את השני
    @Synchronized fun update(ctx: Context, pid: String, fn: (JSONObject) -> Unit): JSONObject? {
        val r = get(ctx, pid) ?: return null
        fn(r); put(ctx, r); return r
    }

    fun drop(ctx: Context, pid: String) {
        work(ctx, pid).deleteRecursively()
        File(dir(ctx), "$pid.json").delete()
    }

    /** ניקוי מקומי (בלי רשת): סרטון שנבחר ולא נוצרה לו עבודה — אחרי שבוע. סרטון של עבודה נשמר עד שהפרויקט נמחק
     *  (25/10/2026, בקשת המשתמש — לצריבה נוספת): gcRemote שואל את השרתון */
    fun gc(ctx: Context, now: Long = System.currentTimeMillis()) {
        for (f in dir(ctx).listFiles() ?: emptyArray()) {
            if (!f.name.endsWith(".json")) continue
            val r = try { JSONObject(f.readText()) } catch (e: Throwable) { f.delete(); continue }
            if (r.optString("job").isEmpty() && now - r.optLong("at") > KEEP_MS) drop(ctx, r.optString("pid"))
        }
    }

    const val CHK_MS = 6 * 3600_000L

    /** הפרויקט נמחק באתר (גם ממכשיר אחר) → הסרטון והרשומה נמחקים מהטלפון. רק כשהשרתון ענה במפורש "gone" (‏404 של
     *  Firestore); בלי רשת / תקלה — לא נוגעים. כל רשומה נבדקת לכל היותר פעם ב־6 שעות. ברקע — לא מהתהליכון הראשי */
    fun gcRemote(ctx: Context, now: Long = System.currentTimeMillis()) {
        for (f in dir(ctx).listFiles() ?: emptyArray()) {
            if (!f.name.endsWith(".json")) continue
            val r = try { JSONObject(f.readText()) } catch (e: Throwable) { continue }
            val pid = r.optString("pid"); val job = r.optString("job")
            if (job.isEmpty() || now - r.optLong("chk") < CHK_MS || PhService.busy) continue
            val gone = try {
                val j = PhNet(r.optString("base"), job, r.optString("key")).call("phAlive")
                !j.optBoolean("ok") && j.optString("error") == "gone"
            } catch (e: Throwable) { update(ctx, pid) { it.put("chk", now) }; continue }
            if (gone) drop(ctx, pid) else update(ctx, pid) { it.put("chk", now) }
        }
    }

    fun hasJobs(ctx: Context): Boolean = (dir(ctx).listFiles() ?: emptyArray()).any { f ->
        f.name.endsWith(".json") && try { JSONObject(f.readText()).optString("job").isNotEmpty() } catch (e: Throwable) { false } }

    fun gcRemoteAsync(ctx: Context) {
        val app = ctx.applicationContext
        Thread { try { gcRemote(app) } catch (e: Throwable) {} }.start()
    }
}
