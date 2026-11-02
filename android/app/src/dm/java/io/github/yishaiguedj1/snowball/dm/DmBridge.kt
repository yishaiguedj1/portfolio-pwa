package io.github.yishaiguedj1.snowball.dm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import io.github.yishaiguedj1.snowball.AppRoute
import io.github.yishaiguedj1.snowball.DlDeep
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * 01/11/2026 (בקשת המשתמש: "שהדפדפן של DM יהיה שליחה לדפדפן של הסטודיו — שלא יהיו סתם שני דפדפנים",
 * ו"ההורדות שנתפסות שם עוברות ל־Studio DM"). הגשר בין שתי האפליקציות. אותו קוד בשתיהן (src/dm), ובכל אחת תפקיד אחר:
 *  · ב־Studio DM: מקבל מ־Studio Browser הורדה. פעולה SHEET פותחת את גיליון ההוספה, כמו מסירה בתוך התהליך. פעולה TASK
 *    מוסיפה לתור הורדה שנבחרה מהתפריט שעל הנגן, בלי לצאת מהדף.
 *  · ב־Studio Browser: מקבל מ־DM את OPEN, כלומר פתיחת דף או "רענון קישור" של הורדה ב־DM.
 * אבטחה: הרכיב מוגן בהרשאת חתימה (DM_HANDOFF), ולכן רק אפליקציה שחתומה במפתח שלנו יכולה לפתוח אותו. אפליקציה זרה
 * לא יכולה לגרום ל־DM לקבל עוגיות או User-Agent ולשלוח אותם לכתובת שהיא בחרה. ה־extras נקראים רק כאן, עוברים בדיקה,
 * ומשם ממשיכים בדרך הרגילה: DmBrowser.stage → DmActivity עם אסימון חד־פעמי.
 * העוגיות שעוברות הן רק של הכתובות של אותה הורדה (הקישור, הדף, הזרמים). הן לא נכתבות ליומן ולא יוצאות מהטלפון.
 */
class DmBridge : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try { handle(intent) } catch (e: Throwable) {}   // בלי פרטים ביומן: ב־extras יש עוגיות
        finish()
    }

    private fun handle(i: Intent?) {
        i ?: return
        val inDm = packageName == AppRoute.DM_PKG
        when (i.action) {
            ACTION_SHEET -> if (inDm) sheet(i)
            ACTION_TASK -> if (inDm) task(i)
            ACTION_OPEN -> if (!inDm) open(i)
        }
    }

    /* ---------- ב־Studio DM ---------- */

    private fun sheet(i: Intent) {
        val url = i.getStringExtra(X_URL).orEmpty().takeIf { http(it) } ?: return
        val ref = i.getStringExtra(X_REF).orEmpty().takeIf { http(it) } ?: ""
        val ua = cleanUa(i.getStringExtra(X_UA))
        cookies(i, ua, ref.ifEmpty { url })
        // רענון — רק של הורדה שקיימת כאן
        val refresh = i.getStringExtra(X_REFRESH).orEmpty().takeIf { it.isNotEmpty() && DmStore.get(it) != null } ?: ""
        val title = i.getStringExtra(X_TITLE).orEmpty().take(300)
        val tok = DmBrowser.stage(url, ref, ua, refresh, title)
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url), this, DmActivity::class.java).putExtra(DmBrowser.EXTRA_TOKEN, tok))
    }

    private fun task(i: Intent) {
        // 01/11/2026 (Studio Browser, הגל הרביעי — 57): כל הקבצים בדף בבת אחת
        i.getStringExtra(X_FILES)?.let { files(i, it); return }
        val o = runCatching { JSONObject(i.getStringExtra(X_TASK).orEmpty()) }.getOrNull() ?: return
        // מזהה חדש ומצב נקי: רק מה שמתאר את הבחירה עובר, לא מצב הורדה (מקטעים, קובץ, שגיאה)
        o.put("id", DmStore.newId()).put("s", DmState.QUEUED.name).put("e", "").put("uri", "").put("sg", JSONArray())
            .put("f", 0).put("tr", 0).put("by", 0).put("k", DmKind.YTDL.name)
        val t = DmTask.of(o) ?: return
        if (!http(t.ref) && t.ref.isNotEmpty()) t.ref = ""
        t.ua = cleanUa(i.getStringExtra(X_UA)); t.ck = true
        cookies(i, t.ua, t.ref.ifEmpty { t.url })
        DmStore.init(this)
        DmStore.add(t); DmPre.rememberSite(this, t.ref.ifEmpty { t.url }, true); DmEngine.pump(this)
        Toast.makeText(this, R.string.dmBridgeAdded, Toast.LENGTH_SHORT).show()
    }

    /** 57 "הורדת כל הקבצים בדף": קבצים ישירים (המנוע שלנו, לא yt-dlp), עם הדף כמפנה ואותו User-Agent; מה שכבר בתור — לא נכפל */
    private fun files(i: Intent, s: String) {
        val a = runCatching { JSONArray(s) }.getOrNull() ?: return
        val ref = i.getStringExtra(X_REF).orEmpty().takeIf { http(it) } ?: ""
        val ua = cleanUa(i.getStringExtra(X_UA))
        cookies(i, ua, ref)
        DmStore.init(this)
        val now = System.currentTimeMillis(); var n = 0
        for (k in 0 until minOf(a.length(), FILES_MAX)) {
            val o = a.optJSONObject(k) ?: continue
            val u = o.optString("u").takeIf { http(it) && it.length < 4000 } ?: continue
            if (DmStore.has(u)) continue
            DmStore.add(DmTask(DmStore.newId(), u, ref, DmKind.HTTP).apply { name = DmName.clean(o.optString("n").take(150)); created = now + k; this.ua = ua; ck = true })
            n++
        }
        if (n > 0) DmEngine.pump(this)
        Toast.makeText(this, getString(R.string.dmBridgeFiles, n), Toast.LENGTH_SHORT).show()
    }

    /** העוגיות של ההורדה לתוך מאגר העוגיות של DM (המנוע קורא משם בכל המשך), ולקובץ של yt-dlp */
    private fun cookies(i: Intent, ua: String, page: String) {
        val a = runCatching { JSONArray(i.getStringExtra(X_CKS).orEmpty()) }.getOrNull()
        if (a != null) {
            val cm = DmCookies.get()
            for (k in 0 until minOf(a.length(), MAX_CK)) {
                val p = a.optJSONArray(k) ?: continue
                val u = p.optString(0); val c = p.optString(1)
                if (!http(u) || c.isEmpty() || c.length > 16_000 || '\n' in c || '\r' in c) continue
                c.split(';').map { it.trim() }.filter { it.contains('=') }.forEach { runCatching { cm.setCookie(u, it) } }
            }
            runCatching { cm.flush() }
        }
        val nets = i.getStringExtra(X_NETS).orEmpty()
        if (nets.isNotEmpty() && nets.length < 400_000 && ua.isNotEmpty()) runCatching { DlEngine.saveCookies(this, page, nets, ua) }
    }

    /* ---------- ב־Studio Browser ---------- */

    private fun open(i: Intent) {
        val start = i.getStringExtra(X_URL).orEmpty().takeIf { it.isEmpty() || http(it) } ?: return
        val refresh = i.getStringExtra(X_REFRESH).orEmpty().take(40)
        // רענון קישור — בדפדפן הקטן (שם הבחירה מחליפה את הכתובת של ההורדה ב־DM); דף רגיל — הדפדפן המלא
        val full = if (refresh.isEmpty()) runCatching { Class.forName(DmActivity.FULL_BROWSER) }.getOrNull() else null
        val it = if (full != null) Intent(this, full).putExtra(DmBrowser.EXTRA_START, start)
            else Intent(this, DmBrowser::class.java).putExtra(DmBrowser.EXTRA_START, start).putExtra(DmBrowser.EXTRA_REFRESH, refresh)
        startActivity(it)
    }

    companion object {
        const val ACTION_SHEET = "app.thesnowball.dm.SHEET"
        const val ACTION_TASK = "app.thesnowball.dm.TASK"
        const val ACTION_OPEN = "app.thesnowball.br.OPEN"
        private const val CLS = "io.github.yishaiguedj1.snowball.dm.DmBridge"
        private const val X_URL = "u"; private const val X_REF = "r"; private const val X_UA = "ua"; private const val X_TITLE = "ti"
        private const val X_REFRESH = "rf"; private const val X_CKS = "ck"; private const val X_NETS = "nc"; private const val X_TASK = "t"; private const val X_FILES = "fs"
        const val FILES_MAX = 500
        private const val MAX_CK = 40
        /** הקישור להתקנת Studio Browser (מנהל ההורדות מוריד ומתקין אותו בעצמו) */
        const val BROWSER_APK = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/the-snowball-browser.apk"

        private fun http(u: String) = u.startsWith("https://") || u.startsWith("http://")
        private fun cleanUa(s: String?) = (s ?: "").take(400).takeIf { u -> u.none { it < ' ' } } ?: ""

        /** אנחנו Studio Browser ו־Studio DM מותקן — ההורדות עוברות לשם */
        fun remote(ctx: Context) = ctx.packageName == AppRoute.BROWSER_PKG && AppRoute.installed(ctx, AppRoute.DM_PKG)

        /** העוגיות של הכתובות האלה מהמאגר של הדפדפן (בתוך התהליך שלו), לשליחה ל־DM */
        private fun jar(urls: List<String>): JSONArray {
            val cm = DmCookies.get()
            val a = JSONArray()
            urls.filter { http(it) }.distinct().take(MAX_CK).forEach { u ->
                runCatching { cm.getCookie(u) }.getOrNull()?.takeIf { it.isNotEmpty() && '\n' !in it && '\r' !in it }?.let { a.put(JSONArray().put(u).put(it)) }
            }
            return a
        }

        private fun toDm(a: Activity, action: String) = Intent(action).setClassName(AppRoute.DM_PKG, CLS)

        /** הורדה מהדפדפן → גיליון ההוספה ב־DM. file = קובץ ישיר; אחרת (דף/זרם) — גם קובץ עוגיות ל־yt-dlp */
        fun sendSheet(a: Activity, url: String, ref: String, file: Boolean, title: String, ua: String, urls: List<String>, refresh: String): Boolean {
            runCatching { DmCookies.get().flush() }
            val all = (listOf(url, ref) + urls).filter { http(it) }.distinct()
            val nets = if (file) "" else runCatching {
                val cm = DmCookies.get()
                DlDeep.netscape(all.map { it to cm.getCookie(it) }, System.currentTimeMillis() / 1000)
            }.getOrDefault("")
            return try {
                a.startActivity(toDm(a, ACTION_SHEET).putExtra(X_URL, url).putExtra(X_REF, ref).putExtra(X_UA, ua.take(400))
                    .putExtra(X_TITLE, title.take(300)).putExtra(X_REFRESH, refresh).putExtra(X_CKS, jar(all).toString()).putExtra(X_NETS, nets)); true
            } catch (e: Exception) { false }
        }

        /** בחירה מהתפריט שעל הנגן → ישר לתור של DM (בלי לצאת מהדף). העוגיות — מהקובץ שהבדיקה ברקע כבר שמרה (DmPre.start) */
        fun sendTask(a: Activity, t: DmTask, ua: String, urls: List<String>): Boolean {
            val page = t.ref.ifEmpty { t.url }
            val ck = DlEngine.cookiesFor(a, t.url, t.ref)
            val nets = ck?.let { runCatching { it.file.readText() }.getOrNull() } ?: ""
            return try {
                a.startActivity(toDm(a, ACTION_TASK).putExtra(X_TASK, t.json().toString()).putExtra(X_UA, (ck?.ua ?: ua).take(400))
                    .putExtra(X_CKS, jar(listOf(t.url, page) + urls).toString()).putExtra(X_NETS, nets)); true
            } catch (e: Exception) { false }
        }

        /** 57 מ־Studio Browser: כמה קבצים ישירים לתור של DM (name = השם מהדף). cookies = false בכרטיסייה פרטית */
        fun sendFiles(a: Activity, files: List<Pair<String, String>>, ref: String, ua: String, cookies: Boolean): Boolean {
            val arr = JSONArray(); files.take(FILES_MAX).forEach { (u, n) -> arr.put(JSONObject().put("u", u).put("n", n)) }
            return try {
                a.startActivity(toDm(a, ACTION_TASK).putExtra(X_FILES, arr.toString()).putExtra(X_REF, ref).putExtra(X_UA, ua.take(400))
                    .putExtra(X_CKS, if (cookies) jar(listOf(ref) + files.map { it.first }).toString() else "[]")); true
            } catch (e: Exception) { false }
        }

        /** מ־DM: לפתוח דף (או רענון קישור של הורדה) ב־Studio Browser. false = לא מותקן */
        fun openInBrowser(ctx: Context, start: String, refresh: String): Boolean {
            if (!AppRoute.browserInstalled(ctx)) return false
            return try {
                if (refresh.isEmpty() && start.isEmpty()) ctx.startActivity(ctx.packageManager.getLaunchIntentForPackage(AppRoute.BROWSER_PKG) ?: return false)
                else ctx.startActivity(Intent(ACTION_OPEN).setClassName(AppRoute.BROWSER_PKG, CLS).putExtra(X_URL, start).putExtra(X_REFRESH, refresh))
                true
            } catch (e: Exception) { false }
        }
    }
}
