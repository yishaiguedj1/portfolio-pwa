package io.github.yishaiguedj1.snowball

import android.content.Context
import org.json.JSONObject

/**
 * 20/11/2026 (בקשת המשתמש — "קישורי יוטיוב ברשימה… מאוד חשוב שיהיה לזה פיתרון"): יוטיוב חוסם את השרת, אז קישור כזה בתור
 * העבודות יורד כאן, בטלפון — אותו מנוע של "הורדה מקישור" (yt-dlp, ‏1080 או הכי קרוב מתחתיו עם הקול הטוב ביותר, הכתוביות של
 * היוצר בתוך הקובץ), נשמר ב־Movies/Studio, ומשם ממשיך בדיוק כמו סרטון שנבחר (nu): הקול עולה, העבודה מתחילה, והסרטון לענן.
 * הרשומה ב־PhStore נוצרת ב־phq2 עם yu (הקישור) ובלי uri; אחרי ההורדה — uri, name, size ו־ydur (לשרתון: spec.yd).
 * נעצר באמצע — ‎--continue‎ ממשיך מאותה תיקייה ("להמשיך", phgo)
 */
object PhYt {
    @Volatile private var cur = ""

    /** yu בלי uri — מוריד ומחזיר את הרשומה המעודכנת. אחרת — אותה רשומה. כשל — PhWork.Stop(קוד) */
    fun fetch(ctx: Context, pid: String, r0: JSONObject, stopped: () -> Boolean, show: (Float) -> Unit): JSONObject {
        val u = r0.optString("yu")
        if (u.isEmpty() || r0.optString("uri").isNotEmpty()) return r0
        if (!PhCore.ytOk(u)) throw PhWork.Stop("bad_url")
        val id = "ph$pid"
        cur = id
        try {
            PhStore.update(ctx, pid) { it.put("st", "dl") }
            var last = 0L
            val f = try {
                DlEngine.download(ctx, u, "", DlEngine.Pick("", "", DlProbe.DEFAULT_H, 0, 0), id, "", subs = DlEngine.SUBS) { p, _ ->
                    val now = System.currentTimeMillis()
                    if (now - last >= 1000) { last = now; show(maxOf(0f, minOf(1f, p / 100f))) }
                }
            } catch (e: IllegalArgumentException) {
                throw PhWork.Stop(if (e.message == "cancel" || stopped()) "stopped" else "dl_" + (e.message ?: "fail").take(16))
            }
            if (stopped()) throw PhWork.Stop("stopped")
            val name = f.name.take(200); val size = f.length()
            val uri = try { DlEngine.publish(ctx, f) } catch (e: Throwable) { throw PhWork.Stop("dl_store") }
            val dur = try { PhPu.probe(ctx, uri)?.dur ?: 0.0 } catch (e: Throwable) { 0.0 }
            return PhStore.update(ctx, pid) { it.put("uri", uri.toString()).put("name", name).put("size", size).put("ydur", dur).put("st", "picked") }
                ?: throw PhWork.Stop("src_gone")
        } finally { cur = "" }
    }

    fun cancel() { cur.takeIf { it.isNotEmpty() }?.let { DlEngine.cancel(it) } }
}
