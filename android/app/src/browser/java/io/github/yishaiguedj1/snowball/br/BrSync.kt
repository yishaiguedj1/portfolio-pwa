package io.github.yishaiguedj1.snowball.br

/**
 * 26/10/2026 (בקשת המשתמש: "שבייצוא ובייבוא בין הפלטפורמות לא ייווצרו כפילויות — רק מידע חדש יתווסף"): הזהות של
 * סימנייה וביקור בין Studio Browser ל־Chrome. טהור (בלי אנדרואיד) — נבדק ב־BrSyncTest.
 *
 * הכתובת לבדה לא מספיקה: Chrome שומר "https://www.ynet.co.il/" וכאן נשמר "https://ynet.co.il" — אותו אתר. המפתח
 * (`key`) מתעלם ממה שלא משנה את הדף: http/https, ‏www, פורט ברירת מחדל, "/" בסוף, פרמטרי מעקב (utm_*, fbclid…),
 * ועוגן (#) — חוץ מעוגן של אפליקציה ("#/…", "#!…"), שהוא דף אחר.
 */
object BrSync {
    private val TRACK = Regex("^(utm_[a-z0-9_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|_gl|yclid|ref_src)$", RegexOption.IGNORE_CASE)
    private val PCT = Regex("%[0-9a-fA-F]{2}")

    fun key(url: String): String {
        var u = url.trim()
        val sch = u.indexOf("://")
        if (sch <= 0) return u.lowercase()
        val scheme = u.substring(0, sch).lowercase()
        u = u.substring(sch + 3)
        var frag = ""
        u.indexOf('#').takeIf { it >= 0 }?.let { frag = u.substring(it + 1); u = u.substring(0, it) }
        var query = ""
        u.indexOf('?').takeIf { it >= 0 }?.let { query = u.substring(it + 1); u = u.substring(0, it) }
        val slash = u.indexOf('/')
        var host = (if (slash >= 0) u.substring(0, slash) else u).substringAfterLast('@').lowercase().trimEnd('.')
        var path = if (slash >= 0) u.substring(slash) else "/"
        host = host.removePrefix("www.")
        if ((scheme == "https" && host.endsWith(":443")) || (scheme == "http" && host.endsWith(":80"))) host = host.substringBeforeLast(':')
        path = PCT.replace(path) { it.value.uppercase() }
        if (path.length > 1) path = path.trimEnd('/').ifEmpty { "/" }
        val q = query.split('&').filter { it.isNotEmpty() && !TRACK.matches(it.substringBefore('=')) }.joinToString("&")
        val f = if (frag.startsWith("/") || frag.startsWith("!")) frag else ""
        val web = scheme == "http" || scheme == "https"
        return (if (web) "" else "$scheme://") + host + path + (if (q.isEmpty()) "" else "?$q") + (if (f.isEmpty()) "" else "#$f")
    }

    /** ביקור: אותו דף באותה שנייה = אותו ביקור (Takeout נותן מיקרו־שניות, הייבוא הבא כולל שוב את הישנים) */
    fun visitKey(url: String, at: Long) = key(url) + "\u0000" + (at / 1000)

    class MarksPlan(val add: List<BrMark>, val known: Int, val gone: Int)

    /**
     * סימניות מ־Chrome: מוסיפים רק מה שאין כאן — לא סימנייה שכבר קיימת (גם בכתובת שנכתבה אחרת, וגם אם יצאה מכאן
     * ל־Chrome וחזרה), לא אחת שמחקת כאן (`gone`), ולא פעמיים מאותו קובץ.
     */
    fun planMarks(have: List<BrMark>, incoming: List<BrImport.Item>, gone: Set<String>, now: Long): MarksPlan {
        val seen = have.mapTo(HashSet()) { key(it.url) }
        val add = ArrayList<BrMark>()
        var known = 0; var dead = 0
        for (it in incoming) {
            val k = key(it.url)
            when {
                k in gone -> dead++
                !seen.add(k) -> known++
                else -> add += BrMark(it.url, it.title.ifEmpty { hostOf(it.url) }, if (it.at > 0) it.at else now, imp = true)
            }
        }
        add.sortByDescending { it.at }
        return MarksPlan(add, known, dead)
    }

    /** ביקורים מ־Takeout: רק מה שעוד לא כאן (אותו דף באותה שנייה) */
    fun planVisits(have: List<BrVisit>, incoming: List<BrImport.Item>): List<BrVisit> {
        val seen = have.mapTo(HashSet()) { visitKey(it.url, it.at) }
        return incoming.filter { it.at > 0 && seen.add(visitKey(it.url, it.at)) }.map { BrVisit(it.url, it.title, it.at) }
    }

    /**
     * מה יוצא ל־Chrome: רק סימניות שנשמרו כאן (לא מה שהגיע מ־Chrome — הוא כבר שם) ושעוד לא יצאו (`x` = מתי יצאו).
     * ייבוא קובץ ב־Chrome לא בודק כפילויות — לכן כל קובץ מכיל רק את החדשות מאז הקודם. `all` = שוב את כולן.
     */
    fun toExport(marks: List<BrMark>, all: Boolean): List<BrMark> {
        val seen = HashSet<String>()
        return marks.filter { !it.imp && (all || it.x == 0L) && (it.url.startsWith("http://") || it.url.startsWith("https://")) && seen.add(key(it.url)) }
    }

    /** קובץ הסימניות של הדפדפנים (Netscape) — תיקייה אחת עם התאריך, כדי שב־Chrome יהיה ברור מאיזה ייצוא כל אחת */
    fun exportHtml(list: List<BrMark>, folder: String): String {
        fun e(x: String) = x.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
        val sb = StringBuilder("<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n")
        sb.append("    <DT><H3>").append(e(folder)).append("</H3>\n    <DL><p>\n")
        for (m in list) sb.append("        <DT><A HREF=\"").append(e(m.url)).append("\" ADD_DATE=\"").append(m.at / 1000).append("\">").append(e(m.title)).append("</A>\n")
        return sb.append("    </DL><p>\n</DL><p>\n").toString()
    }

    /* ---------- הסנכרון האוטומטי עם Chrome (דרך התוסף במחשב — android/chrome-ext) ---------- */

    /** סימנייה כפי שהתוסף כתב אותה ב־state.json; o = a (נשמרה בטלפון) / c (Chrome) */
    data class SMark(val id: String, val u: String, val t: String, val at: Long, val o: String, val r: String = "", val p: String = "")
    /** פעולה מהטלפון שעוד לא אושרה (s > ack): add / del / ren */
    data class Op(val s: Long, val k: String, val id: String, val u: String, val t: String, val at: Long)

    /**
     * הסימניות בטלפון אחרי שהגיע state.json: Chrome הוא המקור — מה שבמצב, פחות מה שמחקת כאן ועוד לא הגיע ל־Chrome,
     * ועוד מה ששמרת כאן ועוד לא הגיע. בלי כפולים (`key`). `imp` = הגיעה מ־Chrome (התיקייה "מ־Chrome").
     */
    fun applyState(state: List<SMark>, pending: List<Op>, alias: Map<String, String>): List<BrMark> {
        fun sid(id: String) = if (id.startsWith("a")) alias[id] ?: id else id
        val delIds = HashSet<String>(); val delKeys = HashSet<String>()
        val adds = LinkedHashMap<String, Op>()
        val ren = HashMap<String, String>()
        for (o in pending.sortedBy { it.s }) when (o.k) {
            "add" -> { adds[o.id] = o; delIds.remove(o.id); delKeys.remove(key(o.u)) }
            "del" -> { if (adds.remove(o.id) == null) { val i = sid(o.id); delIds += i; if (i.startsWith("a") && o.u.isNotEmpty()) delKeys += key(o.u) } }   // לפי כתובת רק כשאין עדיין מזהה של Chrome — אחרת היא נשארת בתיקיות האחרות
            "ren" -> ren[sid(o.id)] = o.t
        }
        // כפולה = אותה כתובת באותה תיקייה (Chrome מרשה אותה כתובת בשתי תיקיות). הסדר = הסדר של Chrome; מה שנשמר כאן — בראש
        val seen = HashSet<String>()
        val out = ArrayList<BrMark>()
        for (m in state) {
            val k = key(m.u)
            val f = folderPath(m.r, m.p)
            if (m.id in delIds || k in delKeys || !seen.add(k + "\u0000" + f)) continue
            out += BrMark(m.u, ren[m.id] ?: m.t.ifEmpty { hostOf(m.u) }, m.at, imp = m.o != "a", sid = m.id, f = f)
        }
        val mine = adds.values.reversed().filter { seen.add(key(it.u) + "\u0000m") }.map { BrMark(it.u, it.t.ifEmpty { hostOf(it.u) }, it.at, sid = it.id, f = "m") }
        return mine + out
    }

    /* ---------------- התיקיות — העץ של Chrome ---------------- */

    /** שורש (b/o/m מהתוסף) + נתיב התיקיות → "b/Learning/x". בלי שורש = נשמרה כאן (בנייד) */
    fun folderPath(r: String, p: String): String = r.ifEmpty { "m" } + if (p.isEmpty()) "" else "/$p"
    /** התיקייה של סימנייה; ייבוא ישן בלי תיקייה = "i" (מיובאות מ־Chrome), שמורה כאן = "m" */
    fun folderOf(m: BrMark): String = m.f.ifEmpty { if (m.imp) "i" else "m" }
    /** השורשים בסדר של Chrome לאנדרואיד: נייד, סרגל, אחרות (+ ייבוא ישן) — רק מה שיש בו משהו, והנייד תמיד */
    fun roots(marks: List<BrMark>): List<String> = listOf("m", "b", "o", "i").filter { r -> r == "m" || marks.any { folderOf(it).let { f -> f == r || f.startsWith("$r/") } } }
    fun inFolder(m: BrMark, path: String): Boolean = folderOf(m).let { it == path || it.startsWith("$path/") }
    fun count(marks: List<BrMark>, path: String): Int = marks.count { inFolder(it, path) }
    /** התיקיות שמתחת ל־path (נתיבים מלאים, לפי הסדר שבו הופיעו) והסימניות שבו עצמו */
    fun children(marks: List<BrMark>, path: String): Pair<List<String>, List<BrMark>> {
        val subs = LinkedHashSet<String>(); val here = ArrayList<BrMark>()
        for (m in marks) {
            val f = folderOf(m)
            if (f == path) here += m
            else if (f.startsWith("$path/")) subs += path + "/" + f.substring(path.length + 1).substringBefore('/')
        }
        return subs.toList() to here
    }
    fun parent(path: String): String = if ('/' in path) path.substringBeforeLast('/') else ""
    fun folderName(path: String): String = path.substringAfterLast('/')

    fun hostOf(url: String): String = key(url).substringBefore('/').substringBefore('?').substringBefore(':')
}
