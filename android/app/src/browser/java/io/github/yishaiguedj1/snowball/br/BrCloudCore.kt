package io.github.yishaiguedj1.snowball.br

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * סנכרון בענן בין המכשירים (27/10/2026, בקשת המשתמש: "סנכרון בזמן אמת כמו Chrome, וגיבוי ל־Google Drive") — הליבה.
 * טהור (בלי אנדרואיד ובלי org.json) — נבדק ב־BrCloudCoreTest. הרשת והחיבור לסימניות/היסטוריה/הגדרות — BrCloud.
 *
 * המודל של Chrome Sync, בלי שרת: כל פריט = רשומה עם מפתח שהלקוח קובע (כמו client_tag_hash) — "m:<BrSync.key>" סימנייה,
 * "h:<visitKey>" ביקור, "p:<שם>" הגדרה, "s:<host>" הגדרות אתר — ושעון (`c`). מחיקה = רשומה בלי ערך (tombstone).
 * כל מכשיר כותב רק את הקבצים שלו ב־appDataFolder (ל־Drive v3 אין כתיבה מותנית, אז אף פעם לא שני כותבים לקובץ אחד);
 * המיזוג קורה בקריאה: לכל מפתח — הרשומה עם השעון הגבוה ביותר מכל המכשירים (LWW).
 *
 * השעון = Hybrid Logical Clock: "זמן.מונה.מכשיר", באורך קבוע — השוואת מחרוזות = הסדר. טלפון ששעונו מקדים/מאחר לא
 * הופך את הסדר: כל מכשיר רואה את השעונים של האחרים (`see`) והבא שלו תמיד גבוה מהם.
 */
object BrCloudCore {
    const val TOMB_TTL = 60L * 86_400_000      // מחיקה נשמרת חודשיים — מכשיר שלא סונכרן יותר מזה לא מחזיר פריט שנמחק אצל אחרים, אבל גם לא מקבל את המחיקה
    const val HIST_TTL = 180L * 86_400_000     // ביקורים בקובץ שלי: חצי שנה, ולכל היותר HIST_MAX — ישנים יוצאים מהקובץ (לא נמחקים מהמכשירים)
    const val HIST_MAX = 6000
    const val RESUME_MS = 24L * 3_600_000      // "המשך מ־<מכשיר>" — רק כרטיסייה שהייתה פעילה ביממה האחרונה

    class Rec(val v: String?, val c: String) {
        override fun equals(other: Any?) = other is Rec && other.v == v && other.c == c
        override fun hashCode() = (v?.hashCode() ?: 0) * 31 + c.hashCode()
    }

    fun clock(wall: Long, n: Int, dev: String) = String.format(java.util.Locale.ROOT, "%013d.%05d.%s", wall.coerceIn(0, 9_999_999_999_999), n.coerceIn(0, 99_999), dev)
    fun wallOf(c: String): Long = c.substringBefore('.').toLongOrNull() ?: 0L

    class Hlc(val dev: String) {
        var wall = 0L; private set
        var n = 0; private set
        fun next(now: Long): String { if (now > wall) { wall = now; n = 0 } else n++; return clock(wall, n, dev) }
        fun see(c: String) {
            val p = c.split('.')
            val w = p.getOrNull(0)?.toLongOrNull() ?: return
            val k = p.getOrNull(1)?.toIntOrNull() ?: 0
            if (w > wall || (w == wall && k > n)) { wall = w; n = k }
        }
    }

    /* ---------------- המיזוג ---------------- */

    fun merge(srcs: Collection<Map<String, Rec>>): Map<String, Rec> {
        val out = HashMap<String, Rec>()
        for (m in srcs) for ((k, r) in m) { val o = out[k]; if (o == null || r.c > o.c) out[k] = r }
        return out
    }

    /** תוצאה של סבב: מה צריך להיות במכשיר עכשיו (`view`), והאם הקובץ שלי השתנה */
    class Step(val view: Map<String, String>, val ownChanged: Boolean)

    /**
     * סבב אחד:
     * 1. מה שהשתנה כאן מאז הסבב הקודם (`local` מול `base`) → רשומה חדשה בקובץ שלי. בסבב הראשון (base ריק) השעון =
     *    הזמן של הפריט עצמו (`seed`) — כך מחיקה שקרתה במכשיר אחר אחרי שהפריט נוסף כאן גוברת, והגדרות (seed = 0) נלקחות
     *    מהחשבון, כמו כשנכנסים ל־Chrome במכשיר חדש.
     * 2. המיזוג של כל המכשירים — `view`: מה שבמיזוג, ועוד מה שיש כאן ואינו במיזוג בכלל (פריט שיצא מהקובץ של מכשיר אחר
     *    כי הוא ישן — לא מוחקים אותו כאן). מחיקה רק ברשומה של מחיקה.
     */
    fun step(local: Map<String, String>, base: Map<String, String>, own: MutableMap<String, Rec>, remote: Collection<Map<String, Rec>>,
             hlc: Hlc, now: Long, seed: (String, String?) -> Long?): Step {
        for (m in remote) for (r in m.values) hlc.see(r.c)
        // "סבב ראשון" לכל סוג בנפרד (m/h/p/s): גם כשסוג שהיה כבוי נדלק שוב — הפריטים שלו נכנסים בזמן שלהם, לא "עכשיו"
        val seen = base.keys.mapTo(HashSet()) { it.take(2) }
        var changed = false
        val keys = HashSet<String>(local.keys); keys.addAll(base.keys)
        for (k in keys) {
            val lv = local[k]; val bv = base[k]
            if (lv == bv) continue
            val sw = if (k.take(2) !in seen) seed(k, lv) else null
            val c = if (sw != null) clock(sw, 0, hlc.dev) else hlc.next(now)
            own[k] = Rec(lv, c); hlc.see(c)
            changed = true
        }
        val merged = merge(remote + listOf(own))
        val view = HashMap(local)
        for ((k, r) in merged) if (r.v == null) view.remove(k) else view[k] = r.v
        return Step(view, changed)
    }

    /** ניקוי הקובץ שלי: מחיקות ישנות, וביקורים ישנים / מעבר לתקרה */
    fun gc(own: MutableMap<String, Rec>, now: Long): Boolean {
        val n0 = own.size
        own.entries.removeAll { (k, r) -> (r.v == null && now - wallOf(r.c) > TOMB_TTL) || (r.v != null && k.startsWith("h:") && now - wallOf(r.c) > HIST_TTL) }
        val h = own.entries.filter { it.key.startsWith("h:") && it.value.v != null }
        if (h.size > HIST_MAX) h.sortedBy { it.value.c }.take(h.size - HIST_MAX).forEach { own.remove(it.key) }
        return own.size != n0
    }

    /* ---------------- הקובץ: שורה לכל רשומה, gzip ---------------- */

    private const val MAGIC = "snbc1"

    fun esc(s: String): String = buildString(s.length) {
        for (ch in s) when (ch) { '\\' -> append("\\\\"); '\t' -> append("\\t"); '\n' -> append("\\n"); '\r' -> append("\\r"); else -> append(ch) }
    }
    fun unesc(s: String): String {
        if ('\\' !in s) return s
        val b = StringBuilder(s.length); var i = 0
        while (i < s.length) {
            val ch = s[i]
            if (ch == '\\' && i + 1 < s.length) { b.append(when (s[i + 1]) { 't' -> '\t'; 'n' -> '\n'; 'r' -> '\r'; else -> s[i + 1] }); i += 2 }
            else { b.append(ch); i++ }
        }
        return b.toString()
    }

    fun encode(dev: String, recs: Map<String, Rec>): ByteArray {
        val sb = StringBuilder(MAGIC).append('\t').append(esc(dev)).append('\n')
        for ((k, r) in recs.entries.sortedBy { it.key }) {
            sb.append(esc(k)).append('\t').append(r.c)
            if (r.v != null) sb.append('\t').append(esc(r.v))
            sb.append('\n')
        }
        return gz(sb.toString())
    }

    /** null = לא קובץ שלנו / פגום — מתעלמים ממנו (לא מוחקים בגללו) */
    fun decode(b: ByteArray): Pair<String, Map<String, Rec>>? {
        val txt = ungz(b) ?: return null
        val lines = txt.split('\n')
        val head = lines.firstOrNull()?.split('\t') ?: return null
        if (head.getOrNull(0) != MAGIC) return null
        val out = HashMap<String, Rec>()
        for (i in 1 until lines.size) {
            val p = lines[i].split('\t')
            if (p.size < 2 || p[0].isEmpty() || p[1].length < 20) continue
            out[unesc(p[0])] = Rec(if (p.size >= 3) unesc(p[2]) else null, p[1])
        }
        return unesc(head.getOrElse(1) { "" }) to out
    }

    fun gz(s: String): ByteArray = ByteArrayOutputStream().also { o -> GZIPOutputStream(o).use { it.write(s.toByteArray(Charsets.UTF_8)) } }.toByteArray()
    fun ungz(b: ByteArray): String? = runCatching { GZIPInputStream(ByteArrayInputStream(b)).use { it.readBytes().toString(Charsets.UTF_8) } }.getOrNull()

    /* ---------------- הצפנה (27/10/2026, בקשת המשתמש: "שרק המשתמש עם החשבון במערכת שלנו יוכל לקרוא") ---------------- */

    /** כל קובץ ב־Drive: "snbE1" + מזהה המפתח (בית) + IV של 12 + AES-256-GCM. AAD = שם הקובץ — קובץ של מכשיר אחד שהועתק
     *  לשם של אחר לא נפתח. המפתח מהשרת שלנו (brKey), Google רואה רק בתים מוצפנים */
    private val EMAGIC = "snbE1".toByteArray()

    fun isSealed(b: ByteArray) = b.size > EMAGIC.size + 1 + 12 + 16 && EMAGIC.indices.all { b[it] == EMAGIC[it] }

    fun seal(key: ByteArray, kid: Char, aad: String, plain: ByteArray, iv: ByteArray = java.security.SecureRandom().let { r -> ByteArray(12).also { r.nextBytes(it) } }): ByteArray {
        val c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        c.init(javax.crypto.Cipher.ENCRYPT_MODE, javax.crypto.spec.SecretKeySpec(key, "AES"), javax.crypto.spec.GCMParameterSpec(128, iv))
        c.updateAAD(aad.toByteArray(Charsets.UTF_8))
        return EMAGIC + byteArrayOf(kid.code.toByte()) + iv + c.doFinal(plain)
    }

    /** null = לא מוצפן / מפתח אחר / שובש — לעולם לא זורק */
    fun open(key: ByteArray, aad: String, b: ByteArray): ByteArray? = runCatching {
        if (!isSealed(b)) return null
        val o = EMAGIC.size + 1
        val c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        c.init(javax.crypto.Cipher.DECRYPT_MODE, javax.crypto.spec.SecretKeySpec(key, "AES"), javax.crypto.spec.GCMParameterSpec(128, b, o, 12))
        c.updateAAD(aad.toByteArray(Charsets.UTF_8))
        c.doFinal(b, o + 12, b.size - o - 12)
    }.getOrNull()

    fun kidOf(b: ByteArray): Char? = if (isSealed(b)) b[EMAGIC.size].toInt().toChar() else null

    /* ---------------- ערכים: סימנייה וביקור ---------------- */

    private const val US = '\u001f'
    private fun clean(s: String) = s.replace(US, ' ')
    fun markVal(u: String, t: String, at: Long, imp: Boolean, f: String = "") = "${clean(u)}$US${clean(t)}$US$at$US${if (imp) 1 else 0}" + if (f.isEmpty()) "" else "$US${clean(f)}"
    fun visitVal(u: String, t: String, at: Long) = "${clean(u)}$US${clean(t)}$US$at"
    /** [כתובת, כותרת, זמן, יובאה מ־Chrome, התיקייה (אם יש)] */
    fun parts(v: String): List<String> = v.split(US)

    /* ---------------- המכשירים: הכרטיסיות הפתוחות, ושליחת כרטיסייה ---------------- */

    /** כרטיסייה פתוחה במכשיר — מה ש־Chrome שומר (כתובת, כותרת, מתי הייתה פעילה) ועוד המקום המדויק: כמה מהדף נגלל (0–1),
     *  משפט מהשורה העליונה שעל המסך (לחזור בדיוק אליו גם כשהדף נטען בגובה אחר), והזמן בסרטון */
    data class STab(val u: String, val t: String, val la: Long, val sc: Float = 0f, val tx: String = "", val mt: Float = 0f)
    /** "שליחה למכשירים שלך": id עולה אצל השולח; היעד מאשר ב־acks של הקובץ שלו, והשולח מוחק אחרי האישור */
    data class Send(val id: Long, val to: String, val tab: STab, val at: Long)
    data class Session(val dev: String, val name: String, val form: String, val at: Long, val tabs: List<STab>,
                       val sends: List<Send> = emptyList(), val acks: Map<String, Long> = emptyMap())

    fun encodeSession(s: Session): ByteArray {
        val sb = StringBuilder("snbs1\t").append(esc(s.dev)).append('\t').append(esc(s.name)).append('\t').append(s.form).append('\t').append(s.at).append('\n')
        fun tab(t: STab) = "${esc(t.u)}\t${esc(t.t)}\t${t.la}\t${t.sc}\t${esc(t.tx)}\t${t.mt}"
        for (t in s.tabs) sb.append("T\t").append(tab(t)).append('\n')
        for (x in s.sends) sb.append("S\t").append(x.id).append('\t').append(esc(x.to)).append('\t').append(x.at).append('\t').append(tab(x.tab)).append('\n')
        for ((d, id) in s.acks) sb.append("A\t").append(esc(d)).append('\t').append(id).append('\n')
        return gz(sb.toString())
    }

    fun decodeSession(b: ByteArray): Session? {
        val lines = (ungz(b) ?: return null).split('\n')
        val h = lines.firstOrNull()?.split('\t') ?: return null
        if (h.getOrNull(0) != "snbs1" || h.size < 5) return null
        fun tab(p: List<String>, i: Int) = STab(unesc(p[i]), unesc(p.getOrElse(i + 1) { "" }), p.getOrNull(i + 2)?.toLongOrNull() ?: 0L,
            p.getOrNull(i + 3)?.toFloatOrNull()?.coerceIn(0f, 1f) ?: 0f, unesc(p.getOrElse(i + 4) { "" }), p.getOrNull(i + 5)?.toFloatOrNull()?.coerceAtLeast(0f) ?: 0f)
        val tabs = ArrayList<STab>(); val sends = ArrayList<Send>(); val acks = HashMap<String, Long>()
        for (i in 1 until lines.size) {
            val p = lines[i].split('\t')
            when (p[0]) {
                "T" -> if (p.size >= 4) tabs += tab(p, 1)
                "S" -> if (p.size >= 6) { val id = p[1].toLongOrNull() ?: continue; sends += Send(id, unesc(p[2]), tab(p, 4), p[3].toLongOrNull() ?: 0L) }
                "A" -> if (p.size >= 3) p[2].toLongOrNull()?.let { acks[unesc(p[1])] = it }
            }
        }
        return Session(unesc(h[1]), unesc(h[2]), h[3], h[4].toLongOrNull() ?: 0L, tabs, sends, acks)
    }

    /** מה ששלחו למכשיר הזה ועוד לא נפתח: `seen` = ה־id האחרון שאישרתי לכל שולח */
    fun inbox(others: Collection<Session>, self: String, seen: Map<String, Long>): List<Pair<Session, Send>> =
        others.flatMap { s -> s.sends.filter { it.to == self && it.id > (seen[s.dev] ?: 0L) }.map { s to it } }.sortedBy { it.second.at }

    /** אחרי שהיעד אישר: מסננים לפי ה־acks של כל מכשיר יעד (`acks[self]`) */
    fun pruneSends(mine: List<Send>, others: Collection<Session>, self: String, now: Long): List<Send> {
        val by = others.associateBy { it.dev }
        return mine.filter { x -> now - x.at < 7L * 86_400_000 && x.id > (by[x.to]?.acks?.get(self) ?: 0L) }
    }

    /**
     * "המשך מ־<מכשיר>" בכרטיסייה חדשה (כמו מודול ה־tab resumption של Chrome): הכרטיסייה שהייתה פעילה הכי לאחרונה במכשיר
     * אחר, ביממה האחרונה, שאינה פתוחה כבר כאן ושלא סגרת את ההצעה שלה (`dismissed` — מפתח + זמן).
     */
    fun resume(others: Collection<Session>, openHere: Set<String>, dismissed: Set<String>, now: Long): Pair<Session, STab>? =
        others.flatMap { s -> s.tabs.map { s to it } }
            .filter { (_, t) -> now - t.la in 0..RESUME_MS && BrSync.key(t.u) !in openHere && resumeId(t) !in dismissed && t.u.startsWith("http") }
            .maxByOrNull { it.second.la }

    fun resumeId(t: STab) = BrSync.key(t.u) + "@" + t.la
}
