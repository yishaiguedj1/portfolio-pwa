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
    /** 26/10/2026: מידע מהיר מהנגן שבדף (YtPage) — עד שהבדיקה המלאה מסתיימת. ביוטיוב: מיד כשהנגן עלה, במקום חצי דקה */
    private val seeded = LinkedHashMap<String, E>()
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

    /**
     * המידע מהנגן שבדף (yt-dlp -J בצורה, YtPage.toInfo) → הסיכום, כמו בבדיקה. לא דורס בדיקה מלאה שכבר הסתיימה.
     * הבדיקה המלאה ממשיכה ברקע — כשהיא מסתיימת היא גוברת (התמונה, הכתוביות והגדלים המדויקים)
     */
    fun seed(url: String, info: JSONObject): Boolean {
        val s = try { io.github.yishaiguedj1.snowball.DlProbe.summarize(info) } catch (e: Throwable) { return false }
        s.put("th", "").put("pg", 1)
        synchronized(lock) {
            val now = System.currentTimeMillis()
            if (done[url]?.let { it.info != null && fresh(it, now) } == true) return false
            seeded.remove(url); seeded[url] = E(now, s)
            while (seeded.size > MAX) seeded.remove(seeded.keys.first())
            lock.notifyAll()
        }
        return true
    }

    fun seeded(url: String): Boolean = synchronized(lock) { seededInfo(url, System.currentTimeMillis()) != null }

    private fun seededInfo(url: String, now: Long) = seeded[url]?.takeIf { it.info != null && now - it.at < TTL_MS }?.info

    /** התוצאה המוכנה (עותק — מי שמקבל אותה מוסיף לה שדות). בדיקה שרצה עכשיו — מחכים לה עד maxMs, אלא אם יש כבר
     *  מידע מהנגן שבדף (אז הוא מיד); אין — null */
    fun await(url: String, maxMs: Long = 120_000L): JSONObject? {
        val end = System.currentTimeMillis() + maxMs
        synchronized(lock) {
            while (url in busy) {
                seededInfo(url, System.currentTimeMillis())?.let { return JSONObject(it.toString()) }
                val left = end - System.currentTimeMillis()
                if (left <= 0) return null
                try { lock.wait(left) } catch (e: InterruptedException) { return null }
            }
            val e = done[url]
            if (e?.info == null || System.currentTimeMillis() - e.at >= TTL_MS) return seededInfo(url, System.currentTimeMillis())?.let { JSONObject(it.toString()) }
            return JSONObject(e.info.toString())
        }
    }

    fun busy(url: String): Boolean = synchronized(lock) { url in busy }

    fun ready(url: String): Boolean = get(url) != null

    /** התוצאה המוכנה בלי לחכות (עותק) — הבדיקה המלאה, ואם עוד אין — המידע מהנגן שבדף; null = עוד לא / נכשלה / ישנה */
    fun get(url: String): JSONObject? = synchronized(lock) {
        val now = System.currentTimeMillis()
        (done[url]?.takeIf { it.info != null && now - it.at < TTL_MS }?.info ?: seededInfo(url, now))?.let { JSONObject(it.toString()) }
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

    /** 0 = לא נבדק, 1 = רץ, 2 = מוכן, 3 = נכשל (טרי) */
    fun state(url: String): Int = synchronized(lock) {
        val now = System.currentTimeMillis()
        if (done[url]?.let { it.info != null && fresh(it, now) } == true || seededInfo(url, now) != null) return 2
        if (url in busy) return 1
        val e = done[url] ?: return 0
        if (!fresh(e, System.currentTimeMillis())) 0 else if (e.info != null) 2 else 3
    }

    /**
     * 26/10/2026 (בקשת המשתמש: "כמו ב־IDM — בדיוק מה הקובץ, הסוג, הפורמט והמשקל"): שורה לכל איכות.
     * k = מה שהבחירה מחזירה (גובה / "a"), t = "1080p HD", f = הקודקים ("H.264 · AAC · 60fps"), sz = הגודל
     * לפי פורמט הווידאו שבהגדרות (DmCodec — מה שבאמת יירד), -1 = לא ידוע
     */
    data class Q(val k: String, val t: String, val f: String, val sz: Long)

    private val VC_NAME = mapOf("h264" to "H.264", "h265" to "HEVC", "vp9" to "VP9", "av1" to "AV1", "vp8" to "VP8")
    private val AC_NAME = mapOf("aac" to "AAC", "opus" to "Opus", "mp3" to "MP3", "vorbis" to "Vorbis", "ac3" to "Dolby", "eac3" to "Dolby", "flac" to "FLAC")
    private fun aName(c: String) = AC_NAME[c] ?: c.uppercase()

    fun quals(ctx: Context, info: JSONObject): Pair<List<Q>, Q?> {
        val qs = info.optJSONArray("q") ?: JSONArray()
        val fm = info.optJSONArray("fm"); val ao = info.optJSONObject("ao")
        val codec = DmPrefs(ctx).codec
        val v = ArrayList<Q>()
        for (i in 0 until minOf(qs.length(), 8)) {
            val q = qs.optJSONObject(i) ?: continue
            val h = q.optInt("h"); if (h <= 0) continue
            val pk = DmCodec.prefer(q, fm, ao, codec)
            val ac = if (pk.c == "h264" && pk.a.isNotEmpty() && pk.a != q.optString("a")) "aac" else q.optString("ac")
            val f = listOfNotNull(VC_NAME[pk.c.ifEmpty { q.optString("c") }] ?: q.optString("c").uppercase().ifEmpty { null },
                ac.takeIf { it.isNotEmpty() }?.let { aName(it) },
                q.optInt("fps").takeIf { it > 30 }?.let { "${it}fps" },
                if (q.optInt("hdr") > 0) "HDR" else null).joinToString(" · ")
            v.add(Q("$h", label(h), f, pk.sz))
        }
        val a = ao?.let { Q("a", ctx.getString(R.string.dmAudioOnly), aName(it.optString("ac")), it.optLong("sz", -1)) }
        return v to a
    }

    /**
     * 26/10/2026 (בקשת המשתמש, לפי התצוגה המקדימה): התפריט שנפתח מהכפתור שעל הנגן — האיכויות עם הגודל, "קול בלבד",
     * ו"להוריד ולתרגם ב־Studio" כש־Studio מותקן. `k` = מה שהדף שולח בחזרה: הגובה, "a" לקול, "t<גובה>" לתרגום.
     * רק טקסט ומספרים — הדף מציג אותם כטקסט
     */
    fun menu(ctx: Context, info: JSONObject, studio: Boolean): JSONObject {
        val (vs, au) = quals(ctx, info)
        val v = JSONArray()
        vs.forEach { v.put(JSONObject().put("k", it.k).put("t", it.t).put("s", if (it.sz > 0) DmFmt.size(ctx, it.sz) else "")) }
        val top = vs.firstOrNull()?.k ?: ""
        return JSONObject()
            .put("v", v)
            .put("a", if (au != null) JSONObject().put("k", "a").put("t", au.t).put("s", if (au.sz > 0) DmFmt.size(ctx, au.sz) else "") else JSONObject.NULL)
            .put("tr", if (studio && top.isNotEmpty()) ctx.getString(R.string.dmDlTr) else "")
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
