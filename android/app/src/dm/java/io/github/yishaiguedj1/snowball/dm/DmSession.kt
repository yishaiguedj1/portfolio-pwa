package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import io.github.yishaiguedj1.snowball.AppRoute
import io.github.yishaiguedj1.snowball.DlDeep
import io.github.yishaiguedj1.snowball.DlEngine
import java.util.concurrent.ConcurrentHashMap

/**
 * 03/11/2026 (בקשת המשתמש: "שההתחברות מהדפדפן תעבור ל־DM איך שצריך, בצורה הכי מקצועית"):
 * ההתחברות לאתר חיה במקום אחד — Studio Browser. DM מושך ממנו את העוגיות העדכניות של האתר **ממש לפני כל הורדה**
 * (ולא רק ברגע המסירה), כך שהתחברות שהתחדשה בדפדפן, או רשימה ארוכה שנמשכת שעות, ממשיכות לעבוד.
 *
 * ⛔ אבטחה:
 *  - הסיסמה לא עוברת לעולם — רק העוגיות שהאתר עצמו נתן לדפדפן.
 *  - הערוץ = ContentProvider של הדפדפן (`BrSessionProvider`), מיוצא רק בהרשאת חתימה `DM_HANDOFF`; הדפדפן בודק בנוסף שהפונה
 *    הוא החבילה של DM עם אותה חתימה, ו־DM בודק שהספק הוא החבילה של הדפדפן עם אותה חתימה (הגנה משני הצדדים).
 *  - הדפדפן עונה רק על אתרים שהמשתמש עצמו שלח מהם הורדה ל־DM (`grant`), לא מכרטיסייה פרטית, ועד 30 יום מהשליחה האחרונה.
 *  - שאילתה אחת לכל אתר לכל היותר פעם בחצי דקה; שום ערך לא נכתב ליומן.
 */
object DmSession {
    const val AUTH = "app.thesnowball.browser.session"
    const val TTL_MS = 30L * 24 * 3600 * 1000
    private const val PREFS = "dm_session_grants"
    private const val MAX_HOSTS = 300
    private const val PULL_GAP_MS = 30_000L

    fun hostKey(u: String): String = DlDeep.hostKey(u)

    /* ---------- בדפדפן: לאילו אתרים DM רשאי לבקש ---------- */

    /** נרשם בכל מסירה מכרטיסייה רגילה (לא פרטית) */
    fun grant(ctx: Context, urls: List<String>) {
        if (ctx.packageName != AppRoute.BROWSER_PKG) return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val all = p.all.mapNotNull { (k, v) -> (v as? Long)?.takeIf { it > now }?.let { k to it } }.toMap(HashMap())
        urls.filter { it.startsWith("https://") || it.startsWith("http://") }.map { hostKey(it) }.filter { it.isNotEmpty() }.forEach { all[it] = now + TTL_MS }
        val keep = all.entries.sortedByDescending { it.value }.take(MAX_HOSTS)
        p.edit().clear().apply { keep.forEach { putLong(it.key, it.value) } }.apply()
    }

    fun granted(ctx: Context, url: String): Boolean {
        val h = hostKey(url); if (h.isEmpty()) return false
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(h, 0) > System.currentTimeMillis()
    }

    /** "מחיקת נתונים" בדפדפן — גם ההרשאות של DM */
    fun revokeAll(ctx: Context) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply() }

    /* ---------- ב־DM: משיכה לפני הורדה ---------- */

    private val last = ConcurrentHashMap<String, Long>()

    /** הספק הוא באמת הדפדפן שלנו (אותה חתימה) */
    private fun trusted(ctx: Context): Boolean = runCatching {
        val pm = ctx.packageManager
        val info = pm.resolveContentProvider(AUTH, 0) ?: return false
        info.packageName == AppRoute.BROWSER_PKG && pm.checkSignatures(info.packageName, ctx.packageName) == PackageManager.SIGNATURE_MATCH
    }.getOrDefault(false)

    /**
     * העוגיות העדכניות של הכתובות האלה מהדפדפן → מאגר העוגיות של DM, וקובץ העוגיות של yt-dlp לדף. רץ בתהליכון של ההורדה.
     * false = לא רלוונטי (אנחנו לא DM / הדפדפן לא מותקן / לא אושר) — ההורדה ממשיכה עם מה שכבר יש.
     */
    fun pull(ctx: Context, page: String, urls: List<String>, ua: String): Boolean {
        if (ctx.packageName != AppRoute.DM_PKG || !AppRoute.installed(ctx, AppRoute.BROWSER_PKG)) return false
        val list = (listOf(page) + urls).filter { it.startsWith("https://") || it.startsWith("http://") }.filter { it.length < 4000 }.distinctBy { hostKey(it) }.take(6)
        if (list.isEmpty()) return false
        val now = System.currentTimeMillis()
        val due = list.filter { u -> (last[hostKey(u)] ?: 0) + PULL_GAP_MS < now }
        if (due.isEmpty()) return true
        if (!trusted(ctx)) return false
        val cm = DmCookies.get()
        var got = 0
        for (u in due) {
            last[hostKey(u)] = now
            runCatching {
                ctx.contentResolver.query(Uri.Builder().scheme("content").authority(AUTH).appendPath("c").appendQueryParameter("u", u).build(), null, null, null, null)
            }.getOrNull()?.use { c ->
                while (c.moveToNext() && got < 200) {
                    val s = c.getString(0) ?: continue
                    if (s.length > 8000 || s.any { it == '\r' || it == '\n' || it == '\u0000' } || '=' !in s.substringBefore(';')) continue
                    runCatching { cm.setCookie(u, s) }; got++
                }
            }
        }
        runCatching { cm.flush() }
        if (got > 0 && ua.isNotEmpty() && page.startsWith("http")) runCatching {
            DlEngine.saveCookies(ctx, page, DlDeep.netscape(list.map { it to cm.getCookie(it) }, System.currentTimeMillis() / 1000), ua)
        }
        return got > 0
    }
}
