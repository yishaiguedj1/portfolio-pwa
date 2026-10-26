package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import android.webkit.CookieManager
import io.github.yishaiguedj1.snowball.DlDeep
import io.github.yishaiguedj1.snowball.DlEngine
import org.json.JSONObject

/**
 * 26/10/2026 (בקשת המשתמש: "שרשימת האיכויות כבר תופיע כשלוחצים — כאילו הקבצים כבר מוכנים להורדה תמיד"):
 * הבדיקה של yt-dlp (DlEngine.probe — האיכויות, הגודל, התמונה) רצה ברקע ברגע ש־Studio Browser מצא סרטון בטאב שעל המסך,
 * והתוצאה נשמרת כאן לפי הכתובת. כשנוגעים בכפתור ההורדה, DmActivity.probe לוקח אותה מכאן — בלי עוד בדיקה של כמה שניות
 * (ביוטיוב, עם בדיקת ה־JavaScript, לפעמים דקות). בדיקה שעוד רצה — מחכים לה, לא מריצים שנייה במקביל.
 * רק בזיכרון של התהליך, רק מה שהמשתמש פתח בעצמו בדפדפן, ולא בטאב פרטי (BrowserActivity.prefetch).
 */
object DmPre {
    private const val TTL_MS = 20 * 60_000L          // הקישורים של יוטיוב תקפים כמה שעות; 20 דקות — בטוח
    private const val FAIL_MS = 5 * 60_000L          // בדיקה שנכשלה — לא שוב באותה כתובת לפני כן
    private const val MAX = 12

    private class E(val at: Long, val info: JSONObject?)
    private val done = LinkedHashMap<String, E>()
    private val busy = HashSet<String>()
    private val lock = Object()

    private fun fresh(e: E?, now: Long) = e != null && now - e.at < (if (e.info != null) TTL_MS else FAIL_MS)

    /** מתחיל בדיקה ברקע (אם אין תוצאה טרייה ואם לא רצה כבר). העוגיות של הדף נשמרות כמו במסירה (DmBrowser.handOff) */
    fun start(ctx: Context, url: String, ref: String, ua: String, urls: List<String>) {
        if (!url.startsWith("http")) return
        val now = System.currentTimeMillis()
        synchronized(lock) {
            if (url in busy || fresh(done[url], now)) return
            busy.add(url)
        }
        val app = ctx.applicationContext
        Thread {
            var info: JSONObject? = null
            try {
                val cm = CookieManager.getInstance()
                val us = urls.filter { it.startsWith("http") }.distinct()
                DlEngine.saveCookies(app, ref.ifEmpty { url }, DlDeep.netscape(us.map { it to cm.getCookie(it) }, System.currentTimeMillis() / 1000), ua)
            } catch (e: Throwable) {}
            try { info = DlEngine.probe(app, url, ref, DlEngine.cookiesFor(app, url, ref)) } catch (e: Throwable) {}
            synchronized(lock) {
                busy.remove(url)
                done.remove(url); done[url] = E(System.currentTimeMillis(), info)
                while (done.size > MAX) done.remove(done.keys.first())
                lock.notifyAll()
            }
        }.apply { isDaemon = true; name = "dm-pre" }.start()
    }

    /** התוצאה המוכנה (עותק — מי שמקבל אותה מוסיף לה שדות). בדיקה שרצה עכשיו — מחכים לה עד maxMs; אין — null */
    fun await(url: String, maxMs: Long = 120_000L): JSONObject? {
        val end = System.currentTimeMillis() + maxMs
        synchronized(lock) {
            while (url in busy) {
                val left = end - System.currentTimeMillis()
                if (left <= 0) return null
                try { lock.wait(left) } catch (e: InterruptedException) { return null }
            }
            val e = done[url]
            if (e?.info == null || System.currentTimeMillis() - e.at >= TTL_MS) return null
            return JSONObject(e.info.toString())
        }
    }

    fun ready(url: String): Boolean = synchronized(lock) { done[url]?.let { it.info != null && System.currentTimeMillis() - it.at < TTL_MS } == true }
}
