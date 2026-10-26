package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import android.webkit.CookieManager
import io.github.yishaiguedj1.snowball.DlDeep
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.SiteList
import org.json.JSONArray
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

    fun busy(url: String): Boolean = synchronized(lock) { url in busy }

    fun ready(url: String): Boolean = synchronized(lock) { done[url]?.let { it.info != null && System.currentTimeMillis() - it.at < TTL_MS } == true }

    /** התוצאה המוכנה בלי לחכות (עותק); null = עוד לא / נכשלה / ישנה */
    fun get(url: String): JSONObject? = synchronized(lock) {
        done[url]?.takeIf { it.info != null && System.currentTimeMillis() - it.at < TTL_MS }?.let { JSONObject(it.info.toString()) }
    }

    /**
     * הוספת הורדה של סרטון (yt-dlp) לתור — אותה פעולה מהגיליון של מנהל ההורדות (DmActivity.addVideo) ומהתפריט שעל
     * הנגן ב־Studio Browser, בלי לעבור למסך אחר. `ck` = עוגיות הדף נשמרו (DlEngine.saveCookies) — רק ממסירה בתוך התהליך
     */
    fun enqueue(ctx: Context, url: String, info: JSONObject, q: JSONObject?, audio: Boolean, ref: String, ck: Boolean,
                tr: Boolean = false, later: Boolean = false, subs: List<DmSubs.Sub> = emptyList()): DmTask {
        val t = DmTask(DmStore.newId(), url, ref, DmKind.YTDL).apply {
            this.tr = tr && !audio; this.later = later
            if (!audio) { this.subs = DmSubs.langs(subs); subsAuto = DmSubs.anyAuto(subs) }
            title = info.optString("t"); name = title
            audioOnly = audio
            if (q != null && !audio) {
                // פורמט הווידאו מההגדרות (DmCodec): חסכוני = מה שנבחר (AV1/VP9), תואם = H.264 + AAC באותה רזולוציה
                val pk = DmCodec.prefer(q, info.optJSONArray("fm"), info.optJSONObject("ao"), DmPrefs(ctx).codec)
                vf = pk.v; af = pk.a; height = q.optInt("h"); total = pk.sz
            }
            if (audio) total = info.optJSONObject("ao")?.optLong("sz", -1) ?: -1
            created = System.currentTimeMillis(); this.ck = ck
        }
        DmStore.add(t); rememberSite(ctx, ref, ck); DmEngine.pump(ctx)
        return t
    }

    /** הורדה שהגיעה מדפדפן (עם העוגיות שלו) — האתר נשמר לבועה ב־Chrome (SiteList, DmSitesProvider) */
    fun rememberSite(ctx: Context, ref: String, ck: Boolean) {
        if (!ck) return
        val h = SiteList.hostOf(ref)
        if (h.isEmpty()) return
        val pr = DmPrefs(ctx)
        pr.brSites = SiteList.add(SiteList.parse(pr.brSites), h).joinToString("\n")
    }

    /**
     * 26/10/2026 (בקשת המשתמש, לפי התצוגה המקדימה): התפריט שנפתח מהכפתור שעל הנגן — האיכויות שהבדיקה מצאה, עם הגודל
     * לפי פורמט הווידאו שבהגדרות (מה שבאמת יירד), "קול בלבד", ו"להוריד ולתרגם ב־Studio" כש־Studio מותקן.
     * `k` = מה שהדף שולח בחזרה: הגובה, "a" לקול, "t<גובה>" לתרגום. רק טקסט ומספרים — הדף מציג אותם כטקסט
     */
    fun menu(ctx: Context, info: JSONObject, studio: Boolean): JSONObject {
        val qs = info.optJSONArray("q") ?: JSONArray()
        val codec = DmPrefs(ctx).codec
        val v = JSONArray()
        var top = 0
        for (i in 0 until minOf(qs.length(), 8)) {
            val q = qs.optJSONObject(i) ?: continue
            val h = q.optInt("h"); if (h <= 0) continue
            if (top == 0) top = h
            val sz = DmCodec.prefer(q, info.optJSONArray("fm"), info.optJSONObject("ao"), codec).sz
            v.put(JSONObject().put("k", "$h").put("t", label(h)).put("s", if (sz > 0) DmFmt.size(ctx, sz) else ""))
        }
        val ao = info.optJSONObject("ao")
        return JSONObject()
            .put("v", v)
            .put("a", if (ao != null) JSONObject().put("k", "a").put("t", ctx.getString(R.string.dmAudioOnly)).put("s", ao.optLong("sz", -1).let { if (it > 0) DmFmt.size(ctx, it) else "" }) else JSONObject.NULL)
            .put("tr", if (studio && top > 0) ctx.getString(R.string.dmDlTr) else "")
            .put("tk", "t$top")
            .put("hv", ctx.getString(R.string.dmMenuVideo)).put("ha", ctx.getString(R.string.dmMenuAudio))
            .put("more", ctx.getString(R.string.dmMenuMore))
    }

    /** "2160p 4K", "1440p 2K", "1080p HD", "720p", … — כמו ביוטיוב */
    fun label(h: Int) = "${h}p" + when { h >= 2160 -> " 4K"; h >= 1440 -> " 2K"; h >= 1080 -> " HD"; else -> "" }

    /** הבחירה מהתפריט: [גובה, קול, תרגום] — רק ערך שהתפריט באמת הציע (הדף יכול לשלוח כל מחרוזת) */
    fun choice(info: JSONObject, k: String): Triple<JSONObject?, Boolean, Boolean>? {
        if (k == "a") return if (info.optJSONObject("ao") != null) Triple(null, true, false) else null
        val tr = k.startsWith("t")
        val h = (if (tr) k.drop(1) else k).toIntOrNull() ?: return null
        val qs = info.optJSONArray("q") ?: return null
        for (i in 0 until minOf(qs.length(), 8)) qs.optJSONObject(i)?.let { if (it.optInt("h") == h) return Triple(it, false, tr) }
        return null
    }
}
