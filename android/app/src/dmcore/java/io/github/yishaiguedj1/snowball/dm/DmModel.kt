package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject

/**
 * Studio DM (23/10/2026, בקשת המשתמש: מנהל הורדות בסגנון IDM, הכל בטלפון — בלי השרת שלנו).
 * הליבה בלי אנדרואיד: המודל, הפיצול הדינמי, סיווג התקלות, שמות הקבצים וההורדה עצמה (DmFetch) —
 * נבדקת ב־JVM מול שרת אמיתי (testDm). השכבה של אנדרואיד (src/dm) רק שומרת, מציגה ומחזיקה את התהליך חי.
 */

/** מקטע של הקובץ: [start, end) — `done` = כמה בתים מתחילתו כבר כתובים. `end` יכול להתקצר כשמקטע אחר נולד ממנו */
class Seg(start: Long, end: Long, done: Long = 0) {
    @Volatile var start = start
    @Volatile var end = end
    @Volatile var done = done
    val pos get() = start + done
    val left get() = (end - pos).coerceAtLeast(0)
    val finished get() = pos >= end

    fun json(): JSONArray = JSONArray().put(start).put(end).put(done)

    companion object {
        fun of(a: JSONArray?): Seg? {
            a ?: return null
            if (a.length() != 3) return null
            val s = a.optLong(0, -1); val e = a.optLong(1, -1); val d = a.optLong(2, -1)
            if (s < 0 || e < s || d < 0 || d > e - s) return null
            return Seg(s, e, d)
        }
    }
}

enum class DmState { QUEUED, RUNNING, PAUSED, WAITING, DONE, FAILED }

/** סוג המשימה: קובץ ישיר (המנוע שלנו) או דף וידאו (yt-dlp בטלפון) */
enum class DmKind { HTTP, YTDL }

class DmTask(
    val id: String,
    var url: String,
    var ref: String = "",
    var kind: DmKind = DmKind.HTTP,
) {
    var name = ""
    var mime = ""
    var total = -1L             // ‏-1 = לא ידוע
    var ranges = false          // השרת תומך ב־Range → הורדה בחלקים והמשך מאותו בייט
    var etag = ""
    var lastMod = ""
    @Volatile var state = DmState.QUEUED
    var err = ""               // קוד בלבד (net, http_404, expired, space…) — הטקסט בממשק
    var segs: MutableList<Seg> = mutableListOf()
    var created = 0L
    var finishedAt = 0L
    var uri = ""               // content:// ב־MediaStore (בכתיבה: IS_PENDING)
    var tries = 0
    // yt-dlp: האיכות שנבחרה (כמו DlEngine.Pick) והכותרת מהבדיקה
    var vf = ""; var af = ""; var height = 0
    var audioOnly = false
    var title = ""
    var bytesYt = 0L           // yt-dlp: בתים שהגיעו (לפי האחוז), לתצוגה
    var pctYt = -1f            // yt-dlp: האחוז עצמו (0–1) — כשהגודל לא ידוע מראש
    // מהדפדפן של DM: אותו User-Agent של הדף, ועוגיות מ־CookieManager (בזמן הבקשה — לא נשמרות כאן)
    var ua = ""
    var ck = false
    var tr = false             // 24/10: "להוריד ולתרגם ב־Studio" — בסוף ההורדה הקובץ מוצע ל־Studio
    var later = false          // 24/10: "אחר כך" — מתחילה רק ב־Wi‑Fi ובטעינה (DmRun.scheduleLater)
    var subs = ""              // 24/10: כתוביות היוצר לצרף ("he,en") — DmSubs; subsAuto = כולל אוטומטיות
    var subsAuto = false        // 27/10/2026: לא בשימוש — אוטומטיות לא יורדות (נשאר לקריאת משימות ישנות)
    var autoRefresh = 0        // 01/11/2026: כמה פעמים הקישור רוענן לבד (DmRefresh) — עד MAX_AUTO, ואז המשתמש מחליט
    // 01/11/2026 (סבב 3, DmRound3): התור (‏"" = הראשי), התיקייה (DmFolders — "" = לפי הסוג), חיבורים ומגבלת מהירות להורדה הזו
    // (0 = כמו בהגדרות), פעולות בסיום (DmOnDone) ותוצאת בדיקת הסיכום ("" / ok / bad / none)
    var q = ""
    var dir = ""
    var conns = 0
    var lim = 0L
    var onDone = ""
    var sum = ""
    var ruled = false          // החוקים כבר הוחלו (פעם אחת — שם לפי תבנית לא מתחלף שוב)

    val got: Long get() = if (kind == DmKind.YTDL) bytesYt else segs.sumOf { it.done.coerceAtMost(it.end - it.start) }
    // yt-dlp לפני האחוז הראשון (מתחבר, פותר את בדיקת יוטיוב) = ‎-1‎ — פס בתנועה, לא "0" קפוא
    val frac: Float get() = if (kind == DmKind.YTDL) (if (pctYt >= 0) pctYt.coerceIn(0f, 1f) else -1f)
        else if (total > 0) (got.toDouble() / total).toFloat().coerceIn(0f, 1f) else -1f
    val active get() = state == DmState.RUNNING || state == DmState.QUEUED || state == DmState.WAITING

    fun json(): JSONObject = JSONObject().apply {
        put("id", id); put("u", url); put("r", ref); put("k", kind.name); put("n", name); put("m", mime)
        put("t", total); put("rg", ranges); put("et", etag); put("lm", lastMod); put("s", state.name); put("e", err)
        put("sg", JSONArray().also { a -> segs.forEach { a.put(it.json()) } })
        put("c", created); put("f", finishedAt); put("uri", uri); put("tr", tries)
        put("vf", vf); put("af", af); put("h", height); put("ao", audioOnly); put("ti", title); put("by", bytesYt); put("py", pctYt.toDouble())
        put("ua", ua); put("ck", ck); put("st", tr); put("lt", later); put("sb", subs); put("sa", subsAuto); put("ar", autoRefresh)
        put("q", q); put("dr", dir); put("cn", conns); put("li", lim); put("od", onDone); put("hk", sum); put("rl", ruled)   // st: עד 24/10 "tr" — התנגש עם tries
    }

    companion object {
        private val ID_RE = Regex("^[A-Za-z0-9]{6,32}$")

        fun of(o: JSONObject?): DmTask? {
            o ?: return null
            val id = o.optString("id"); val u = o.optString("u")
            if (!ID_RE.matches(id) || !u.startsWith("http")) return null
            val k = runCatching { DmKind.valueOf(o.optString("k")) }.getOrDefault(DmKind.HTTP)
            return DmTask(id, u, o.optString("r"), k).apply {
                name = o.optString("n"); mime = o.optString("m"); total = o.optLong("t", -1); ranges = o.optBoolean("rg")
                etag = o.optString("et"); lastMod = o.optString("lm")
                state = runCatching { DmState.valueOf(o.optString("s")) }.getOrDefault(DmState.QUEUED)
                // תהליך שמת באמצע — מה שרץ חוזר לתור (ממשיך מאותו בייט)
                if (state == DmState.RUNNING) state = DmState.QUEUED
                err = o.optString("e")
                val a = o.optJSONArray("sg")
                if (a != null) for (i in 0 until a.length()) Seg.of(a.optJSONArray(i))?.let { segs.add(it) }
                created = o.optLong("c"); finishedAt = o.optLong("f"); uri = o.optString("uri"); tries = (o.opt("tr") as? Number)?.toInt() ?: 0
                vf = o.optString("vf"); af = o.optString("af"); height = o.optInt("h"); audioOnly = o.optBoolean("ao")
                title = o.optString("ti"); bytesYt = o.optLong("by"); pctYt = o.optDouble("py", -1.0).toFloat()
                ua = o.optString("ua").take(400); ck = o.optBoolean("ck"); tr = o.optBoolean("st", o.opt("tr") as? Boolean ?: false); later = o.optBoolean("lt"); subs = o.optString("sb").take(120); subsAuto = o.optBoolean("sa"); autoRefresh = o.optInt("ar")
                q = o.optString("q").take(16); dir = DmFolders.norm(o.optString("dr")); conns = o.optInt("cn").coerceIn(0, DmSegs.MAX_CONNS)
                lim = o.optLong("li").coerceAtLeast(0); onDone = o.optString("od").take(80); sum = o.optString("hk").take(8); ruled = o.optBoolean("rl")
            }
        }

        fun listJson(tasks: List<DmTask>): String = JSONObject().put("v", 1)
            .put("tasks", JSONArray().also { a -> tasks.forEach { a.put(it.json()) } }).toString()

        fun listOf(text: String?): MutableList<DmTask> {
            val out = mutableListOf<DmTask>()
            val o = runCatching { JSONObject(text ?: "") }.getOrNull() ?: return out
            val a = o.optJSONArray("tasks") ?: return out
            for (i in 0 until a.length()) of(a.optJSONObject(i))?.let { t -> if (out.none { it.id == t.id }) out.add(t) }
            return out
        }
    }
}
