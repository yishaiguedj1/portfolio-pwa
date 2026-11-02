package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLDecoder
import java.util.Locale

/*
 * 01/11/2026 — השדרוג "מקצועי", סבב 3 (docs/dm-upgrade-plan.md, לפי ת־הורדות). החלק הטהור, בלי אנדרואיד: נבדק ב־testDm (DmRound3Test).
 *  · DmWindow — חלון זמן: ימים ושעות, גם מעבר לחצות (15, 19, 43, 44);
 *  · DmQueue / DmQueues — תורים בשם: כמה במקביל, רשת, חלון, ניסיונות לקובץ, פעולה בסוף התור (15, 44);
 *  · DmFolders — תיקייה לכל סוג או סיומת: תת־תיקייה או תיקייה שנבחרה במערכת (16);
 *  · DmRule / DmRules — חוקים לפי אתר וסוג: תור, תיקייה, חיבורים, מהירות, שם, פעולות בסיום (17);
 *  · DmOnDone — פעולות בסיום, וקובץ הסיכום שליד הקישור (22);
 *  · DmApkCheck — חתימה, גרסה והשוואה לאפליקציה המותקנת (23);
 *  · DmSpeed / DmBucket / DmQuota — מגבלה לפי שעות, לכל הורדה ולסלולר, ומכסת נפח ליום ולחודש (19, 43);
 *  · DmApi — הוספה מאפליקציות אחרות: Intent ו־deep link (45). בלי עוגיות ובלי כותרות מבחוץ.
 */

/** חלון זמן. days = ביטים (0 = ראשון … 6 = שבת). start/end = דקות מתחילת היום; end ≤ start = עובר חצות; start == end = כל היום */
data class DmWindow(val days: Int = ALL, val start: Int = 0, val end: Int = 0) {
    val always get() = (days and ALL) == ALL && start == end
    private val len get() = if (start == end) DAY else ((end - start) % DAY + DAY) % DAY

    private fun on(d: Int) = (days and (1 shl (((d % 7) + 7) % 7))) != 0

    /** פתוח עכשיו? dow = 0 (ראשון) … 6, min = דקות מתחילת היום */
    fun open(dow: Int, min: Int): Boolean {
        if (always) return true
        if (on(dow) && min >= start && min - start < len) return true
        return on(dow - 1) && min + DAY - start < len   // חלון של אתמול שעובר חצות
    }

    /** עוד כמה דקות ייפתח (0 = פתוח עכשיו, ‎-1‎ = אין אף יום) */
    fun untilOpen(dow: Int, min: Int): Int {
        if (open(dow, min)) return 0
        if ((days and ALL) == 0) return -1
        for (k in 0..7) {
            if (!on(dow + k)) continue
            val at = k * DAY + start - min
            if (at > 0) return at
        }
        return -1
    }

    /** עוד כמה דקות ייסגר (‎-1‎ = סגור עכשיו או לא נסגר בשבוע הקרוב). חלונות צמודים נחשבים אחד */
    fun untilClose(dow: Int, min: Int): Int {
        if (always || !open(dow, min)) return -1
        for (k in 1..8 * DAY) { val m = min + k; if (!open(dow + m / DAY, m % DAY)) return k }
        return -1
    }

    fun dump() = "$days,$start,$end"

    companion object {
        const val ALL = 0x7f
        const val DAY = 1440
        fun parse(s: String?): DmWindow {
            val p = (s ?: "").split(',').mapNotNull { it.trim().toIntOrNull() }
            if (p.size != 3) return DmWindow()
            return DmWindow(p[0] and ALL, p[1].coerceIn(0, DAY - 1), p[2].coerceIn(0, DAY - 1))
        }
        /** "HH:MM" → דקות (‎-1‎ = לא תקין) */
        fun hm(s: String): Int {
            val m = Regex("^\\s*(\\d{1,2})(?::(\\d{2}))?\\s*$").find(s) ?: return -1
            val h = m.groupValues[1].toInt(); val mm = m.groupValues[2].ifEmpty { "0" }.toInt()
            return if (h in 0..23 && mm in 0..59) h * 60 + mm else if (h == 24 && mm == 0) 0 else -1
        }
        fun fmt(min: Int) = String.format(Locale.US, "%02d:%02d", min / 60 % 24, min % 60)
    }
}

/** תור בשם. parallel 0 = כמו בהגדרות; tries 0 = בלי ניסיון חוזר לבד; done = "" / "notify" / "intent" (גם וגם: "notify,intent") */
data class DmQueue(
    val id: String, val name: String, val parallel: Int = 0, val wifi: Boolean = false,
    val win: DmWindow = DmWindow(), val tries: Int = 0, val done: String = "notify",
) {
    fun json(): JSONObject = JSONObject().put("id", id).put("n", name).put("p", parallel).put("w", wifi).put("win", win.dump()).put("tr", tries).put("d", done)
    companion object {
        fun of(o: JSONObject?): DmQueue? {
            o ?: return null
            val id = o.optString("id"); val n = o.optString("n").trim().take(DmQueues.MAX_NAME)
            if (!Regex("^[a-z0-9]{1,16}$").matches(id) || n.isEmpty()) return null
            return DmQueue(id, n, o.optInt("p").coerceIn(0, 5), o.optBoolean("w"), DmWindow.parse(o.optString("win")),
                o.optInt("tr").coerceIn(0, DmQueues.MAX_TRIES), o.optString("d", "notify").take(40))
        }
    }
}

object DmQueues {
    /** התור הראשי = המזהה הריק: ההגדרות הרגילות, בלי חלון */
    const val MAIN = ""
    const val MAX = 12
    const val MAX_NAME = 30
    const val MAX_TRIES = 20

    fun parse(s: String?): List<DmQueue> {
        val a = runCatching { JSONArray(s ?: "") }.getOrNull() ?: return emptyList()
        val out = ArrayList<DmQueue>()
        for (i in 0 until a.length()) DmQueue.of(a.optJSONObject(i))?.let { q -> if (out.none { it.id == q.id } && out.size < MAX) out.add(q) }
        return out
    }

    fun dump(qs: List<DmQueue>): String = JSONArray().also { a -> qs.take(MAX).forEach { a.put(it.json()) } }.toString()

    fun newId(qs: List<DmQueue>): String { var n = qs.size + 1; while (qs.any { it.id == "q$n" }) n++; return "q$n" }

    /** תור לפי מזהה, או לפי שם (מאפליקציה אחרת) — בלי הבדל באותיות */
    fun find(qs: List<DmQueue>, idOrName: String): DmQueue? = qs.firstOrNull { it.id == idOrName } ?: qs.firstOrNull { it.name.equals(idOrName.trim(), true) }

    /** למה התור לא מתחיל עכשיו: null = מותר; "window" = מחוץ לחלון; "wifi" = צריך רשת לא מוגבלת */
    fun block(q: DmQueue?, unmetered: Boolean, dow: Int, min: Int): String? = when {
        q == null -> null
        !q.win.open(dow, min) -> "window"
        q.wifi && !unmetered -> "wifi"
        else -> null
    }

    /**
     * מהמועמדים (לפי הסדר, ‏queue = המזהה של התור של כל אחד) — מי עובר את התקרה של התור שלו.
     * running = כמה רצים עכשיו בכל תור. תקרה 0 = רק התקרה הכללית (שנבדקת אחר כך ב־DmLink.pickStart)
     */
    fun gate(queue: List<String>, running: Map<String, Int>, caps: Map<String, Int>): List<Int> {
        val n = HashMap(running)
        val out = ArrayList<Int>()
        for ((i, q) in queue.withIndex()) {
            val cap = caps[q] ?: 0
            val c = n[q] ?: 0
            if (cap > 0 && c >= cap) continue
            n[q] = c + 1; out.add(i)
        }
        return out
    }

    /** הורדה שנכשלה בתור עם ניסיונות חוזרים: עוד ניסיון (לסוף התור)? tries = כמה כבר נכשלה */
    fun retry(q: DmQueue?, tries: Int, code: String): Boolean =
        q != null && q.tries > 0 && tries < q.tries && code !in FATAL

    /** קודים שניסיון חוזר לא יעזור בהם (המשתמש צריך להחליט) */
    val FATAL = setOf("space", "page", "http_404", "http_410", "http_401", "http_403", "quota")

    /** התור הסתיים (אין בו יותר ממתינות/רצות): כמה ירדו וכמה נכשלו */
    data class End(val done: Int, val failed: Int)
    fun ended(states: List<DmState>): End? {
        if (states.isEmpty() || states.any { it == DmState.QUEUED || it == DmState.RUNNING || it == DmState.WAITING }) return null
        return End(states.count { it == DmState.DONE }, states.count { it == DmState.FAILED })
    }
}

/** תיקייה לכל סוג או סיומת. ערך: "" = ברירת המחדל; "sub:<שם>" = תת־תיקייה ב־<Movies|Music|…>/Studio DM/<שם>; "tree:<uri>" = תיקייה שבחרת במערכת */
object DmFolders {
    const val SUB = "sub:"
    const val TREE = "tree:"

    /** המפתחות: שם הקטגוריה (VIDEO…) או ".ext" */
    fun parse(s: String?): Map<String, String> {
        val o = runCatching { JSONObject(s ?: "") }.getOrNull() ?: return emptyMap()
        val out = LinkedHashMap<String, String>()
        o.keys().forEach { k -> val v = norm(o.optString(k)); if (v.isNotEmpty() && (k.startsWith(".") || DmName.Cat.entries.any { it.name == k })) out[k.lowercase(Locale.ROOT).let { if (it.startsWith(".")) it else k }] = v }
        return out
    }

    fun dump(m: Map<String, String>): String = JSONObject().also { o -> m.forEach { (k, v) -> if (norm(v).isNotEmpty()) o.put(k, norm(v)) } }.toString()

    /** היעד לקובץ: קודם לפי הסיומת, אחר כך לפי הסוג */
    fun pick(m: Map<String, String>, name: String, mime: String): String {
        val e = DmName.ext(name)
        if (e.isNotEmpty()) m[".$e"]?.let { return it }
        return m[DmName.cat(name, mime).name] ?: ""
    }

    /** ערך תקין בלבד: תת־תיקייה נקייה (עד שתי רמות, בלי ‎..‎), או tree של content:// */
    fun norm(v: String): String = when {
        v.startsWith(SUB) -> cleanSub(v.removePrefix(SUB)).let { if (it.isEmpty()) "" else SUB + it }
        v.startsWith(TREE) -> v.removePrefix(TREE).let { if (it.startsWith("content://") && it.length < 600 && !it.contains('\n')) TREE + it else "" }
        else -> ""
    }

    fun cleanSub(s: String): String = s.replace('\\', '/').split('/').map { DmName.clean(it).replace(Regex("^\\.+"), "").take(60) }
        .filter { it.isNotEmpty() && it != "." && it != ".." }.take(2).joinToString("/")

    /** הנתיב היחסי ב־MediaStore: <top>/Studio DM/<sub> */
    fun rel(top: String, v: String): String = if (v.startsWith(SUB)) "$top/${cleanSub(v.removePrefix(SUB))}" else top
}

/** חוק לפי אתר וסוג. host: "example.com" (כולל תת־אתרים) / "*" ; ext: "mp4,mkv" (ריק = כל סוג). 0 / "" = בלי שינוי */
data class DmRule(
    val host: String = "", val ext: String = "", val queue: String = "", val dir: String = "",
    val conns: Int = 0, val lim: Long = 0, val name: String = "", val done: String = "", val on: Boolean = true,
) {
    fun json(): JSONObject = JSONObject().put("h", host).put("x", ext).put("q", queue).put("d", dir).put("c", conns).put("l", lim).put("n", name).put("a", done).put("on", on)
    val exts get() = ext.split(',', ' ', ';').map { it.trim().trimStart('.').lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }

    companion object {
        fun of(o: JSONObject?): DmRule? {
            o ?: return null
            val h = o.optString("h").trim().lowercase(Locale.ROOT).removePrefix("www.").take(120)
            val x = o.optString("x").take(120)
            if (h.isEmpty() && x.isBlank()) return null
            if (h.isNotEmpty() && h != "*" && !Regex("^(\\*\\.)?[a-z0-9.-]+$").matches(h)) return null
            return DmRule(h, x, o.optString("q").take(16), DmFolders.norm(o.optString("d")), o.optInt("c").coerceIn(0, DmSegs.MAX_CONNS),
                o.optLong("l").coerceAtLeast(0), o.optString("n").take(120), DmOnDone.dump(DmOnDone.parse(o.optString("a"))), o.optBoolean("on", true))
        }
    }
}

object DmRules {
    const val MAX = 50

    fun parse(s: String?): List<DmRule> {
        val a = runCatching { JSONArray(s ?: "") }.getOrNull() ?: return emptyList()
        return (0 until a.length()).mapNotNull { DmRule.of(a.optJSONObject(it)) }.take(MAX)
    }

    fun dump(rs: List<DmRule>): String = JSONArray().also { a -> rs.take(MAX).forEach { a.put(it.json()) } }.toString()

    fun hostMatch(rule: String, host: String): Boolean {
        val r = rule.removePrefix("*.")
        val h = host.lowercase(Locale.ROOT).removePrefix("www.")
        return rule == "*" || h == r || h.endsWith(".$r")
    }

    /** החוק הראשון שמתאים (דלוק, אתר וסוג) */
    fun match(rs: List<DmRule>, url: String, name: String): DmRule? {
        val h = DmLink.host(url); val e = DmName.ext(name)
        return rs.firstOrNull { r -> r.on && (r.host.isEmpty() || hostMatch(r.host, h)) && (r.exts.isEmpty() || e in r.exts) }
    }

    /** תבנית שם: {name} (השם המלא), {base} (בלי סיומת), {ext}, {host}, {date} (yyyy-MM-dd). תמיד נשארת הסיומת של הקובץ */
    fun rename(tpl: String, name: String, url: String, date: String): String {
        if (tpl.isBlank()) return name
        val e = DmName.ext(name)
        val base = if (e.isEmpty()) name else name.removeSuffix(".$e")
        var out = tpl.replace("{name}", name).replace("{base}", base).replace("{ext}", e).replace("{host}", DmLink.host(url)).replace("{date}", date)
        out = DmName.clean(out.replace('/', '-').replace('\\', '-'))
        if (out.isEmpty()) return name
        if (e.isNotEmpty() && !out.lowercase(Locale.ROOT).endsWith(".$e")) out = DmName.clean("$out.$e")
        return out
    }
}

/** פעולות בסיום הורדה. MOVE = התיקייה של החוק (נקבעת בהוספה) */
object DmOnDone {
    enum class A { OPEN, UNZIP, HASH, SHARE, STUDIO, SILENT }

    fun parse(s: String?): Set<A> = (s ?: "").split(',').mapNotNull { k -> A.entries.firstOrNull { it.name.equals(k.trim(), true) } }.toSet()
    fun dump(a: Set<A>): String = A.entries.filter { it in a }.joinToString(",") { it.name.lowercase(Locale.ROOT) }

    /** איפה לחפש את הסיכום שהאתר מפרסם ליד הקישור (רק אותו אתר, עד 8 בקשות) */
    fun sidecars(url: String): List<String> {
        val u = url.substringBefore('#')
        val path = u.substringBefore('?')
        if (!path.startsWith("http")) return emptyList()
        val dir = path.substringBeforeLast('/') + "/"
        val q = if (u.contains('?')) "?" + u.substringAfter('?') else ""
        return listOf("$path.sha256$q", "$path.sha256sum$q", "$path.sha512$q", "$path.md5$q", "$path.sha1$q",
            dir + "SHA256SUMS", dir + "sha256sums.txt", dir + "SHA512SUMS").distinct()
    }

    /** הסיכום של הקובץ מתוך הטקסט: "hex  name" / "hex *name" / "SHA256 (name) = hex" / שורה אחת עם hex בלבד */
    fun sumFor(text: String, name: String): String? {
        val lines = text.lineSequence().map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("#") }.take(5000).toList()
        val n = name.lowercase(Locale.ROOT)
        val hex = Regex("^[0-9a-fA-F]{32,128}$")
        for (l in lines) {
            Regex("^[A-Za-z0-9-]+\\s*\\((.+)\\)\\s*=\\s*([0-9a-fA-F]{32,128})$").find(l)?.let { m ->
                if (m.groupValues[1].substringAfterLast('/').lowercase(Locale.ROOT) == n) return m.groupValues[2].lowercase(Locale.ROOT)
            }
            Regex("^([0-9a-fA-F]{32,128})\\s+\\*?(.+)$").find(l)?.let { m ->
                if (m.groupValues[2].trim().substringAfterLast('/').lowercase(Locale.ROOT) == n) return m.groupValues[1].lowercase(Locale.ROOT)
            }
        }
        if (lines.size == 1) {
            val one = lines[0].split(Regex("\\s+"))[0]
            if (hex.matches(one) && (lines[0].split(Regex("\\s+")).size == 1)) return one.lowercase(Locale.ROOT)
        }
        return null
    }
}

/** בודק APK לפני התקנה: החתימה (SHA‑256 של התעודה) מול האפליקציה שכבר מותקנת */
object DmApkCheck {
    enum class V { NEW, UPDATE, SAME, DOWNGRADE, OTHER_SIG, UNSIGNED }

    fun hex(b: ByteArray): String = b.joinToString(":") { String.format(Locale.US, "%02X", it.toInt() and 0xff) }

    /** certs = טביעות SHA‑256 של הקובץ; old = של המותקנת (null = לא מותקנת) */
    fun verdict(certs: Set<String>, code: Long, old: Set<String>?, oldCode: Long): V = when {
        certs.isEmpty() -> V.UNSIGNED
        old == null -> V.NEW
        old.isEmpty() || certs.intersect(old).isEmpty() -> V.OTHER_SIG
        code < oldCode -> V.DOWNGRADE
        code == oldCode -> V.SAME
        else -> V.UPDATE
    }

    /** האם להזהיר (צבע אדום ואישור נוסף) */
    fun warn(v: V) = v == V.OTHER_SIG || v == V.UNSIGNED || v == V.DOWNGRADE

    /** הרשאות רגישות — השם הקצר (בלי android.permission.) */
    fun risky(perms: List<String>): List<String> = perms.map { it.substringAfterLast('.') }.filter { it in DmApk.RISKY }.distinct()
}

/** מגבלת מהירות לפי שעות: חלון + קצב. הראשון שפתוח קובע */
data class DmSlot(val win: DmWindow, val bps: Long)

object DmSpeed {
    const val MAX = 8

    fun parse(s: String?): List<DmSlot> = (s ?: "").split(';').mapNotNull { p ->
        val i = p.lastIndexOf(','); if (i <= 0) return@mapNotNull null
        if (p.substring(0, i).split(',').size != 3) return@mapNotNull null
        val b = p.substring(i + 1).trim().toLongOrNull() ?: return@mapNotNull null
        if (b <= 0) null else DmSlot(DmWindow.parse(p.substring(0, i)), b)
    }.take(MAX)

    fun dump(sl: List<DmSlot>): String = sl.take(MAX).joinToString(";") { it.win.dump() + "," + it.bps }

    /** הקצב הכולל עכשיו (0 = בלי): חלון פתוח → שלו; אחרת base. בסלולר — הנמוך מבין זה למגבלת הסלולר */
    fun now(base: Long, slots: List<DmSlot>, metered: Boolean, cell: Long, dow: Int, min: Int): Long {
        val r = slots.firstOrNull { it.win.open(dow, min) }?.bps ?: base
        return if (metered && cell > 0) (if (r > 0) minOf(r, cell) else cell) else r
    }
}

/** דלי אסימונים להורדה אחת (מגבלה לכל הורדה בנפרד), באותו אופן של DmLimit */
class DmBucket(private val rate: () -> Long, private val now: () -> Long = { System.nanoTime() }) {
    private var tokens = 0.0
    private var at = now()
    private var last = -1L

    fun take(n: Long, sleep: (Long) -> Unit) {
        val r = rate()
        if (r <= 0) { last = r; return }
        val wait: Long
        synchronized(this) {
            val t = now()
            if (r != last) { tokens = 0.0; at = t; last = r }
            tokens = minOf(r / 2.0, tokens + (t - at) / 1e9 * r)
            at = t
            tokens -= n
            wait = if (tokens < 0) (-tokens / r * 1000).toLong() else 0
        }
        if (wait > 0) sleep(wait)
    }
}

/** מכסת נפח: ליום ולחודש, בנפרד ל־Wi‑Fi ולסלולר (מה ש־DM עצמו הוריד) */
object DmQuota {
    data class Use(val day: Int = 0, val mon: Int = 0, val dW: Long = 0, val dC: Long = 0, val mW: Long = 0, val mC: Long = 0)
    /** בבתים; 0 = בלי */
    data class Caps(val dayW: Long = 0, val dayC: Long = 0, val monW: Long = 0, val monC: Long = 0) {
        val any get() = dayW > 0 || dayC > 0 || monW > 0 || monC > 0
    }

    /** day = yyyymmdd, mon = yyyymm */
    fun roll(u: Use, day: Int, mon: Int): Use {
        var r = u
        if (r.mon != mon) r = r.copy(mon = mon, mW = 0, mC = 0)
        if (r.day != day) r = r.copy(day = day, dW = 0, dC = 0)
        return r
    }

    fun add(u: Use, bytes: Long, cell: Boolean): Use = if (bytes <= 0) u else if (cell) u.copy(dC = u.dC + bytes, mC = u.mC + bytes) else u.copy(dW = u.dW + bytes, mW = u.mW + bytes)

    /** "day" / "month" כשהמכסה של הרשת הזו נגמרה, אחרת null */
    fun over(u: Use, c: Caps, cell: Boolean): String? = when {
        cell && c.dayC > 0 && u.dC >= c.dayC || !cell && c.dayW > 0 && u.dW >= c.dayW -> "day"
        cell && c.monC > 0 && u.mC >= c.monC || !cell && c.monW > 0 && u.mW >= c.monW -> "month"
        else -> null
    }

    fun dumpUse(u: Use) = "${u.day},${u.mon},${u.dW},${u.dC},${u.mW},${u.mC}"
    fun parseUse(s: String?): Use {
        val p = (s ?: "").split(',').map { it.trim().toLongOrNull() ?: 0L }
        return if (p.size != 6) Use() else Use(p[0].toInt(), p[1].toInt(), p[2], p[3], p[4], p[5])
    }
    fun dumpCaps(c: Caps) = "${c.dayW},${c.dayC},${c.monW},${c.monC}"
    fun parseCaps(s: String?): Caps {
        val p = (s ?: "").split(',').map { (it.trim().toLongOrNull() ?: 0L).coerceAtLeast(0) }
        return if (p.size != 4) Caps() else Caps(p[0], p[1], p[2], p[3])
    }
}

/**
 * הוספה מאפליקציות אחרות (45): Intent (‏ADD עם extras) או deep link ‏`studiodm://add?url=…&name=…&queue=…&folder=…&later=1`.
 * רק http/https; אין עוגיות, User-Agent או כותרות מבחוץ. "בשקט" (בלי הגיליון) — רק מ־Intent של אפליקציה שקיבלה את ההרשאה שלנו
 */
object DmApi {
    const val ADD = "app.thesnowball.studiodm.ADD"
    const val PAUSE_ALL = "app.thesnowball.studiodm.API_PAUSE_ALL"
    const val RESUME_ALL = "app.thesnowball.studiodm.API_RESUME_ALL"
    const val STATUS = "app.thesnowball.studiodm.STATUS"
    /** שידור בסוף תור — רק לאפליקציות עם ההרשאה */
    const val QUEUE_DONE = "app.thesnowball.studiodm.QUEUE_DONE"
    const val SCHEME = "studiodm"
    const val MAX_URLS = 50

    data class Req(val urls: List<String>, val name: String, val queue: String, val folder: String, val quiet: Boolean, val later: Boolean)

    /** get = extras או פרמטרים. quietOk = מותר בלי הגיליון (רק Intent עם ההרשאה) */
    fun parse(get: (String) -> String?, quietOk: Boolean): Req? {
        val urls = (DmLink.all(get("url")) + DmLink.all(get("urls"))).filter { it.startsWith("http://") || it.startsWith("https://") }.distinct().take(MAX_URLS)
        if (urls.isEmpty()) return null
        val name = if (urls.size == 1) DmName.clean(get("name") ?: "").take(120) else ""
        val queue = (get("queue") ?: "").trim().take(DmQueues.MAX_NAME)
        val folder = DmFolders.cleanSub(get("folder") ?: "")
        fun yes(k: String) = (get(k) ?: "").trim().lowercase(Locale.ROOT) in setOf("1", "true", "yes")
        return Req(urls, name, queue, folder, quietOk && yes("quiet"), yes("later"))
    }

    /** deep link → בקשה (תמיד עם הגיליון) */
    fun fromUri(uri: String?): Req? {
        val u = uri ?: return null
        if (!u.startsWith("$SCHEME://add", true)) return null
        val q = u.substringAfter('?', "")
        val m = HashMap<String, String>()
        q.split('&').forEach { kv ->
            val k = kv.substringBefore('='); val v = kv.substringAfter('=', "")
            if (k.isNotEmpty() && !m.containsKey(k)) m[k] = runCatching { URLDecoder.decode(v, "UTF-8") }.getOrDefault(v)
        }
        return parse({ m[it] }, false)
    }
}
