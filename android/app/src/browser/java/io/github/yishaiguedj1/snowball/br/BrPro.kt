package io.github.yishaiguedj1.snowball.br

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/**
 * Studio Browser Pro — הגל הראשון (01/11/2026, בקשת המשתמש: "יותר כלים מ־Chrome, מה שיש במחשב ואין באנדרואיד"; המחקר:
 * docs/android-apps.md "Studio Browser Pro"). הלוגיקה הטהורה (בלי אנדרואיד) — נבדקת ב־BrProTest:
 *  · מחשבון והמרות בשורת הכתובת (התשובה לפני Enter, בלי רשת) — לפי ת־עיצוב של שורת הכתובת במחשב;
 *  · מילות קיצור לחיפוש באתר ("yt שיר", "w ריבית");
 *  · ניקוי קישור מפרמטרי מעקב בהעתקה ובשיתוף;
 *  · הסקריפטים שרצים בדף: מתקן עברית (כיוון לכל פסקה), השתקת אתר, ולכידת הקונסולה לכלי המפתחים.
 */
object BrPro {

    /* ---------------- מחשבון והמרות ---------------- */

    /** תשובה לשורת הכתובת — "510", "37.78 °C"; null = זה לא חישוב (לא מציגים כלום) */
    fun answer(raw: String): String? {
        val q = raw.trim()
        if (q.length < 3 || q.length > 80) return null
        convert(q)?.let { return it }
        return calc(q)?.let { fmt(it) }
    }

    /** ביטוי חשבוני: + − × ÷ ^ סוגריים, אחוזים ("15% מ־3,400", "15% of 3400", "200+10%"). חייב לפחות פעולה אחת */
    fun calc(raw: String): BigDecimal? {
        var s = raw.trim().lowercase()
            .replace('×', '*').replace('·', '*').replace('÷', '/').replace('−', '-').replace('–', '-')
            .replace("**", "^")
        s = s.trimEnd('=').trim()
        // "15% מ־3400" / "15% מ-3400" / "15% of 3400" → (15/100)*3400
        Regex("""^([\d.,]+)\s*%\s*(?:מ[־\-]?|of)\s*([\d.,]+)$""").find(s)?.let { m ->
            val a = num(m.groupValues[1]) ?: return null; val b = num(m.groupValues[2]) ?: return null
            return a.multiply(b).divide(BigDecimal(100), MC)
        }
        // חייבת להיות פעולה בין שני ערכים ("50%" לבד או "-3" — לא חישוב)
        if (!Regex("""[\d)%]\s*[+\-*/^]\s*[\d(.\-]""").containsMatchIn(s)) return null
        if (s.any { !(it.isDigit() || it in "+-*/^%()., ") }) return null
        if (Regex("""^\s*-?[\d.,]+\s*$""").matches(s)) return null   // מספר לבד — לא חישוב
        if (Regex("""^\d{1,4}([-/.])\d{1,2}\1\d{1,4}$""").matches(s.replace(" ", ""))) return null   // תאריך, לא חילוק
        if (Regex("""^0\d{1,3}-?\d{6,8}$""").matches(s.replace(" ", ""))) return null   // מספר טלפון
        return runCatching { Parser(s.replace(" ", "")).parse() }.getOrNull()
    }

    private val MC = MathContext(16, RoundingMode.HALF_EVEN)

    private fun num(t: String): BigDecimal? {
        val c = t.replace(",", "")
        if (c.isEmpty() || c.count { it == '.' } > 1) return null
        return c.toBigDecimalOrNull()
    }

    /** מנתח רקורסיבי קטן: expr = term (± term)*, term = pow (×÷ pow)*, pow = unary (^ pow)?, unary = -unary | atom%? */
    private class Parser(val s: String) {
        var i = 0
        fun parse(): BigDecimal { val v = expr(); require(i == s.length); return v }
        fun expr(): BigDecimal {
            var v = term()
            while (i < s.length && (s[i] == '+' || s[i] == '-')) {
                val op = s[i++]
                val start = i
                val r = term()
                // "200+10%" = 200 + 10% מ־200 (כמו מחשבון)
                val pct = s.substring(start, i).endsWith("%") && s.substring(start, i).none { it in "*/^(" }
                val rr = if (pct) v.multiply(r, MC) else r
                v = if (op == '+') v.add(rr, MC) else v.subtract(rr, MC)
            }
            return v
        }
        fun term(): BigDecimal {
            var v = pow()
            while (i < s.length && (s[i] == '*' || s[i] == '/')) {
                val op = s[i++]; val r = pow()
                v = if (op == '*') v.multiply(r, MC) else { require(r.signum() != 0); v.divide(r, MC) }
            }
            return v
        }
        fun pow(): BigDecimal {
            val b = unary()
            if (i < s.length && s[i] == '^') {
                i++; val e = pow()
                require(e.stripTrailingZeros().scale() <= 0 && e.abs() <= BigDecimal(64))
                val n = e.toInt()
                return if (n >= 0) b.pow(n, MC) else BigDecimal.ONE.divide(b.pow(-n, MC), MC)
            }
            return b
        }
        fun unary(): BigDecimal {
            if (i < s.length && s[i] == '-') { i++; return unary().negate() }
            if (i < s.length && s[i] == '+') { i++; return unary() }
            var v = atom()
            if (i < s.length && s[i] == '%') { i++; v = v.divide(BigDecimal(100), MC) }
            return v
        }
        fun atom(): BigDecimal {
            require(i < s.length)
            if (s[i] == '(') { i++; val v = expr(); require(i < s.length && s[i] == ')'); i++; return v }
            val st = i
            while (i < s.length && (s[i].isDigit() || s[i] == '.' || s[i] == ',')) i++
            require(i > st)
            return requireNotNull(num(s.substring(st, i)))
        }
    }

    /** תצוגה: עד 10 ספרות אחרי הנקודה, בלי אפסים מיותרים, עם פסיקי אלפים */
    fun fmt(v: BigDecimal): String {
        val r = v.setScale(10, RoundingMode.HALF_EVEN).stripTrailingZeros()
        val plain = r.toPlainString()
        val neg = plain.startsWith("-")
        val body = plain.removePrefix("-")
        val int = body.substringBefore('.'); val frac = body.substringAfter('.', "")
        val grouped = int.reversed().chunked(3).joinToString(",").reversed()
        return (if (neg) "-" else "") + grouped + (if (frac.isNotEmpty()) ".$frac" else "")
    }

    private data class Unit(val names: List<String>, val kind: String, val toBase: Double, val sym: String)
    private val UNITS = listOf(
        Unit(listOf("km", "ק״מ", "ק\"מ", "קמ", "קילומטר"), "len", 1000.0, "ק״מ"),
        Unit(listOf("m", "מטר", "מ׳"), "len", 1.0, "מ׳"),
        Unit(listOf("cm", "ס״מ", "ס\"מ", "סמ"), "len", 0.01, "ס״מ"),
        Unit(listOf("mi", "mile", "miles", "מייל", "מיילים"), "len", 1609.344, "מייל"),
        Unit(listOf("ft", "feet", "foot", "רגל"), "len", 0.3048, "רגל"),
        Unit(listOf("in", "inch", "inches", "אינץ׳", "אינץ'", "אינץ"), "len", 0.0254, "אינץ׳"),
        Unit(listOf("kg", "ק״ג", "ק\"ג", "קג", "קילו"), "mass", 1.0, "ק״ג"),
        Unit(listOf("g", "גרם"), "mass", 0.001, "גרם"),
        Unit(listOf("lb", "lbs", "pound", "pounds", "פאונד"), "mass", 0.45359237, "פאונד"),
        Unit(listOf("oz", "אונקיה"), "mass", 0.028349523125, "אונקיה"),
        Unit(listOf("l", "ליטר"), "vol", 1.0, "ליטר"),
        Unit(listOf("gal", "gallon", "גלון"), "vol", 3.785411784, "גלון"),
    )
    private fun unitOf(n: String) = UNITS.firstOrNull { u -> u.names.any { it.equals(n, ignoreCase = true) } }

    /** "5 מייל בק״מ", "5 mi to km", "100f to c", "30 מעלות צלזיוס בפרנהייט" */
    fun convert(raw: String): String? {
        val m = Regex("""^(-?[\d.,]+)\s*([^\d\s]+(?:\s[^\d\s]+)?)\s+(?:to|in|ל|ב|ל־|ב־|ל-|ב-)\s*([^\d\s]+)$""", RegexOption.IGNORE_CASE)
            .find(raw.trim().replace(Regex("""\s+(?:ל|ב)[־\-]"""), " ב ")) ?: return null
        val v = num(m.groupValues[1])?.toDouble() ?: return null
        val from = m.groupValues[2].trim(); val to = m.groupValues[3].trim()
        temp(from)?.let { f -> val t = temp(to) ?: return null; if (f == t) return null
            val r = if (f == 'c') v * 9 / 5 + 32 else (v - 32) * 5 / 9
            return fmt(BigDecimal(r).setScale(2, RoundingMode.HALF_EVEN)) + if (t == 'c') " °C" else " °F" }
        val a = unitOf(from) ?: return null; val b = unitOf(to) ?: return null
        if (a.kind != b.kind || a === b) return null
        val r = v * a.toBase / b.toBase
        return fmt(BigDecimal(r).round(MathContext(8))) + " " + b.sym
    }
    private fun temp(n: String): Char? = when (n.lowercase().replace("°", "").removePrefix("מעלות").trim()) {
        "c", "celsius", "צלזיוס" -> 'c'
        "f", "fahrenheit", "פרנהייט" -> 'f'
        else -> null
    }

    /* ---------------- מילות קיצור לחיפוש באתר ---------------- */

    data class Keyword(val key: String, val name: String, val url: String)

    /** הקיצורים המובנים — %s = מה שמחפשים */
    val KEYWORDS = listOf(
        Keyword("yt", "YouTube", "https://www.youtube.com/results?search_query=%s"),
        Keyword("w", "ויקיפדיה", "https://he.wikipedia.org/w/index.php?search=%s"),
        Keyword("we", "Wikipedia", "https://en.wikipedia.org/w/index.php?search=%s"),
        Keyword("m", "מפות", "https://www.google.com/maps/search/%s"),
        Keyword("tr", "תרגום", "https://translate.google.com/?sl=auto&tl=iw&text=%s"),
        Keyword("gh", "GitHub", "https://github.com/search?q=%s"),
        Keyword("img", "תמונות", "https://www.google.com/search?tbm=isch&q=%s"),
    )

    /** "yt שיר" → הקיצור והשאילתה; null = לא קיצור */
    fun keyword(raw: String, list: List<Keyword> = KEYWORDS): Pair<Keyword, String>? {
        val t = raw.trimStart()
        val sp = t.indexOf(' ')
        if (sp <= 0) return null
        val k = list.firstOrNull { it.key.equals(t.substring(0, sp), ignoreCase = true) } ?: return null
        val q = t.substring(sp + 1).trim()
        return if (q.isEmpty()) null else k to q
    }

    fun keywordUrl(k: Keyword, q: String): String = k.url.replace("%s", java.net.URLEncoder.encode(q, "UTF-8"))

    /* ---------------- ניקוי קישור ---------------- */

    private val TRACK = Regex("""^(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_eid|mc_cid|igshid|igsh|yclid|_hsenc|_hsmi|mkt_tok|ref_src|spm|si)$""", RegexOption.IGNORE_CASE)

    /** הקישור בלי פרמטרי מעקב — אותו קישור אם אין מה לנקות. `si` רק ביוטיוב ובספוטיפיי (במקומות אחרים הוא פרמטר אמיתי) */
    fun clean(url: String): String {
        val q = url.indexOf('?')
        if (q < 0) return url
        val hash = url.indexOf('#', q).let { if (it < 0) url.length else it }
        val host = url.substringAfter("://").substringBefore('/').substringBefore('?').lowercase()
        val siOk = host.endsWith("youtube.com") || host == "youtu.be" || host.endsWith("spotify.com")
        val kept = url.substring(q + 1, hash).split('&').filter { p ->
            if (p.isEmpty()) return@filter false
            val k = p.substringBefore('=')
            !(TRACK.matches(k) && (k.lowercase() != "si" || siOk))
        }
        return url.substring(0, q) + (if (kept.isEmpty()) "" else "?" + kept.joinToString("&")) + url.substring(hash)
    }

    /* ---------------- סקריפטים בדף ---------------- */

    /**
     * מתקן עברית: פסקה שיש בה עברית ואין לה כיוון משלה מקבלת dir="auto" — הכיוון נקבע לפי האות החזקה הראשונה, כמו שהטקסט
     * נכתב (תגובות וצ'אטים באתרים באנגלית שמציגים עברית הפוך; אנגלית בתוך אתר עברי). רק בלוקים של טקסט; עוקב אחרי תוכן חדש.
     */
    const val HEBREW_JS = """(function(){if(window.__snbHe)return;window.__snbHe=1;var H=/[֐-׿]/,S='p,li,dd,dt,td,th,blockquote,h1,h2,h3,h4,h5,h6,figcaption,summary,label,div,span';
function fix(root){try{var els=(root.querySelectorAll?root.querySelectorAll(S):[]);for(var i=0;i<els.length&&i<4000;i++){var e=els[i];if(e.hasAttribute('dir')||e.closest('[contenteditable],input,textarea,pre,code'))continue;
var tag=e.tagName;if((tag==='DIV'||tag==='SPAN')&&e.childElementCount>3)continue;var t=e.textContent;if(t&&t.length<5000&&H.test(t))e.setAttribute('dir','auto')}}catch(x){}}
fix(document);var q=0;new MutationObserver(function(){if(q)return;q=1;setTimeout(function(){q=0;fix(document)},600)}).observe(document.documentElement,{childList:true,subtree:true})})();"""

    /** השתקת אתר: כל וידאו/אודיו בדף מושתק, גם מה שנוסף אחר כך. `on=false` — מחזיר את הקול */
    fun muteJs(on: Boolean) = """(function(){window.__snbMute=$on;function m(){document.querySelectorAll('video,audio').forEach(function(v){v.muted=window.__snbMute})}m();
if(!window.__snbMuteObs){window.__snbMuteObs=1;document.addEventListener('play',function(e){if(window.__snbMute&&e.target&&'muted' in e.target)e.target.muted=true},true);setInterval(function(){if(window.__snbMute)m()},2000)}})();"""

    /* ---------------- כלי מפתחים ---------------- */

    data class Net(val at: Long, val method: String, val url: String, val main: Boolean, val blocked: Boolean, val headers: Map<String, String> = emptyMap())
    data class Log(val at: Long, val level: Int, val msg: String, val src: String)   // level: 0 log, 1 warn, 2 error, 3 קלט, 4 תוצאה

    /** טבעת של רשומות אחרונות — בטוחה בין ת׳רדים (הרשת רצה מחוץ לת׳רד הראשי) */
    class Ring<T>(private val max: Int) {
        private val q = ArrayDeque<T>()
        @Synchronized fun add(x: T) { q.addLast(x); while (q.size > max) q.removeFirst() }
        @Synchronized fun all(): List<T> = q.toList()
        @Synchronized fun clear() = q.clear()
        @get:Synchronized val size get() = q.size
    }

    /** "העתקה כפקודת curl" — מה ש־WebView נותן: הכתובת, השיטה והכותרות שנשלחו (בלי גוף) */
    fun curl(url: String, method: String, headers: Map<String, String>): String = buildString {
        append("curl")
        if (!method.equals("GET", true)) append(" -X ").append(method.uppercase())
        append(" '").append(url.replace("'", "'\\''")).append("'")
        for ((k, v) in headers) if (!k.equals("cookie", true)) append(" -H '").append("$k: $v".replace("'", "'\\''")).append("'")
    }

    /** סוג הבקשה לפי הכתובת — לתצוגה בלבד */
    fun kindOf(url: String, main: Boolean): String {
        if (main) return "doc"
        val p = url.substringBefore('?').substringBefore('#').lowercase()
        return when {
            p.endsWith(".js") || p.endsWith(".mjs") -> "js"
            p.endsWith(".css") -> "css"
            Regex("""\.(png|jpe?g|gif|webp|avif|svg|ico)$""").containsMatchIn(p) -> "img"
            Regex("""\.(woff2?|ttf|otf)$""").containsMatchIn(p) -> "font"
            Regex("""\.(mp4|webm|m3u8|mpd|ts|m4s|mp3|m4a|aac|ogg)$""").containsMatchIn(p) -> "media"
            p.endsWith(".json") || "/api/" in p -> "xhr"
            else -> "other"
        }
    }

    /** תוצאה של הרצת JavaScript (JSON שמגיע מ־evaluateJavascript) — מחרוזת בלי מרכאות, השאר כמו שהוא */
    fun evalShow(json: String?): String {
        if (json == null || json == "null") return "undefined"
        if (json.length >= 2 && json.startsWith("\"") && json.endsWith("\""))
            return json.substring(1, json.length - 1).replace("\\n", "\n").replace("\\\"", "\"").replace("\\u003C", "<").replace("\\\\", "\\")
        return json
    }

    /* ================= הגל השני (01/11/2026): כרטיסיות, שורת הכתובת ונוחות ================= */

    /** 23 — חיפוש ממוקד: "@כרטיסיות שיר", "@history ynet" — רק במקור אחד (לפי ת־עיצוב של שורת הכתובת במחשב) */
    enum class Scope { TABS, MARKS, HISTORY }
    private val SCOPES = listOf(
        Scope.TABS to listOf("כרטיסיות", "טאבים", "tabs"),
        Scope.MARKS to listOf("סימניות", "bookmarks"),
        Scope.HISTORY to listOf("היסטוריה", "history"),
    )
    /** המקור והחיפוש שאחריו; null = אין "@" של מקור מוכר */
    fun scope(raw: String): Pair<Scope, String>? {
        val q = raw.trimStart()
        if (!q.startsWith("@")) return null
        val word = q.drop(1).substringBefore(' ')
        val sc = SCOPES.firstOrNull { (_, ns) -> ns.any { it.equals(word, ignoreCase = true) } }?.first ?: return null
        return sc to q.drop(1 + word.length).trim()
    }
    /** "@" או תחילת מילה ("@הי") — המקורות שמתאימים, להצעה */
    fun scopeHints(raw: String): List<Scope> {
        val q = raw.trim()
        if (!q.startsWith("@") || ' ' in q) return emptyList()
        val w = q.drop(1)
        return SCOPES.filter { (_, ns) -> ns.any { it.startsWith(w, ignoreCase = true) } && ns.none { it.equals(w, ignoreCase = true) } }.map { it.first }
    }
    fun scopeWord(s: Scope, he: Boolean): String = SCOPES.first { it.first == s }.second.let { if (he) it[0] else it.last() }

    /** 24 — פעולות מהשורה: מקלידים "מחיקת היסטוריה" / "settings" — שורה שמבצעת את הפעולה (בנוסף לחיפוש, לא במקומו) */
    enum class Act { CLEAR, QUICK, HISTORY, MARKS, SETTINGS, PRIVATE, DOWNLOADS, PASSWORDS, TASKS, SPLIT, SESSIONS }
    private val ACTS = listOf(
        Act.CLEAR to listOf("מחיקת נתוני גלישה", "ניקוי נתוני גלישה", "מחיקת היסטוריה", "ניקוי היסטוריה", "clear browsing data", "clear history", "delete history"),
        Act.QUICK to listOf("מחיקה מהירה", "מחיקת 15 הדקות האחרונות", "quick delete"),
        Act.HISTORY to listOf("היסטוריה", "history"),
        Act.MARKS to listOf("סימניות", "bookmarks"),
        Act.SETTINGS to listOf("הגדרות", "settings"),
        Act.PRIVATE to listOf("כרטיסייה פרטית", "גלישה פרטית", "גלישה בסתר", "private tab", "incognito"),
        Act.DOWNLOADS to listOf("הורדות", "downloads"),
        Act.PASSWORDS to listOf("סיסמאות", "מנהל הסיסמאות", "passwords"),
        Act.TASKS to listOf("מנהל המשימות", "מנהל משימות", "task manager"),
        Act.SPLIT to listOf("מסך מפוצל", "split screen", "split view"),
        Act.SESSIONS to listOf("קבוצות שמורות", "סשנים", "saved groups", "sessions"),
    )
    /** הפעולה שהטקסט מתאר — מ־3 אותיות, תחילה של אחד הניסוחים (או הניסוח עצמו עם עוד מילים, "הגדרות דפדפן") */
    fun action(raw: String): Act? {
        val q = raw.trim().lowercase().replace(Regex("\\s+"), " ")
        if (q.length < 3 || q.startsWith("@") || "://" in q || q.contains('.') && ' ' !in q) return null
        return ACTS.firstOrNull { (_, ns) -> ns.any { n -> n.startsWith(q) || q.startsWith("$n ") } }?.first
    }

    /** 35 — סרגל שמסדרים: הכפתורים בין שורת הכתובת לכפתור הכרטיסיות, בסדר שבחרת (עד 3; ריק = רק הכרטיסיות ו־⋮) */
    val TOOLS = listOf("newtab", "home", "share", "star", "reload", "downloads", "translate", "find", "quick", "split")
    const val TOOLS_MAX = 3
    val TOOLS_DEFAULT = listOf("newtab")
    fun tools(s: String?): List<String> = if (s == null) TOOLS_DEFAULT else s.split(',').map { it.trim() }.filter { it in TOOLS }.distinct().take(TOOLS_MAX)
    fun toolsEncode(l: List<String>): String = l.filter { it in TOOLS }.distinct().take(TOOLS_MAX).joinToString(",")
    /** הוספה בסוף / הסרה; מעל התקרה — לא נוסף */
    fun toolToggle(l: List<String>, id: String): List<String> = if (id in l) l - id else if (l.size >= TOOLS_MAX || id !in TOOLS) l else l + id
    fun toolMove(l: List<String>, id: String, d: Int): List<String> {
        val i = l.indexOf(id); val j = i + d
        if (i < 0 || j !in l.indices) return l
        return l.toMutableList().also { it[i] = it[j]; it[j] = id }
    }

    /** 38 — מקלדת אמיתית: הקיצורים של הדפדפנים במחשב. קודי המקשים של KeyEvent (קבועים — נבדקים ב־JVM) */
    fun shortcut(key: Int, ctrl: Boolean, shift: Boolean, alt: Boolean): String? {
        if (alt && !ctrl) return when (key) { android.view.KeyEvent.KEYCODE_DPAD_LEFT -> "back"; android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> "fwd"; android.view.KeyEvent.KEYCODE_HOME -> "home"; else -> null }
        if (!ctrl) return when (key) {
            android.view.KeyEvent.KEYCODE_F5 -> "reload"
            android.view.KeyEvent.KEYCODE_F6 -> "address"
            android.view.KeyEvent.KEYCODE_F3 -> "find"
            android.view.KeyEvent.KEYCODE_FORWARD -> "fwd"
            android.view.KeyEvent.KEYCODE_ESCAPE -> if (shift) "tasks" else null
            else -> null
        }
        if (key in android.view.KeyEvent.KEYCODE_1..android.view.KeyEvent.KEYCODE_9 && !shift) return "tab" + (key - android.view.KeyEvent.KEYCODE_0)
        return when (key) {
            android.view.KeyEvent.KEYCODE_T -> if (shift) "reopen" else "newtab"
            android.view.KeyEvent.KEYCODE_N -> if (shift) "private" else "newtab"
            android.view.KeyEvent.KEYCODE_W, android.view.KeyEvent.KEYCODE_F4 -> if (shift) null else "close"
            android.view.KeyEvent.KEYCODE_TAB -> if (shift) "prev" else "next"
            android.view.KeyEvent.KEYCODE_PAGE_DOWN -> "next"
            android.view.KeyEvent.KEYCODE_PAGE_UP -> "prev"
            android.view.KeyEvent.KEYCODE_L, android.view.KeyEvent.KEYCODE_K -> "address"
            android.view.KeyEvent.KEYCODE_R -> "reload"
            android.view.KeyEvent.KEYCODE_F -> "find"
            android.view.KeyEvent.KEYCODE_D -> "star"
            android.view.KeyEvent.KEYCODE_H -> "history"
            android.view.KeyEvent.KEYCODE_J -> "downloads"
            android.view.KeyEvent.KEYCODE_O -> if (shift) "marks" else null
            android.view.KeyEvent.KEYCODE_DEL, android.view.KeyEvent.KEYCODE_FORWARD_DEL -> if (shift) "clear" else null
            android.view.KeyEvent.KEYCODE_EQUALS, android.view.KeyEvent.KEYCODE_PLUS, android.view.KeyEvent.KEYCODE_NUMPAD_ADD -> "zoomin"
            android.view.KeyEvent.KEYCODE_MINUS, android.view.KeyEvent.KEYCODE_NUMPAD_SUBTRACT -> "zoomout"
            android.view.KeyEvent.KEYCODE_0 -> "zoom0"
            android.view.KeyEvent.KEYCODE_BACKSLASH -> "split"
            android.view.KeyEvent.KEYCODE_SLASH -> "keys"
            else -> null
        }
    }
    /** רשימת העזרה (מסך "מקלדת"): הצירוף והפעולה, בסדר הזה */
    val KEYS_HELP = listOf("Ctrl+T" to "newtab", "Ctrl+Shift+N" to "private", "Ctrl+W" to "close", "Ctrl+Shift+T" to "reopen", "Ctrl+Tab" to "next",
        "Ctrl+Shift+Tab" to "prev", "Ctrl+1…9" to "tab1", "Ctrl+L" to "address", "Ctrl+R" to "reload", "Ctrl+F" to "find", "Ctrl+D" to "star",
        "Ctrl+H" to "history", "Ctrl+J" to "downloads", "Ctrl+Shift+O" to "marks", "Alt+←" to "back", "Alt+→" to "fwd", "Ctrl+ +/−/0" to "zoomin",
        "Ctrl+\\" to "split", "Shift+Esc" to "tasks", "Ctrl+Shift+Del" to "clear", "Ctrl+/" to "keys")

    /** 39 — מחוות: גרירה על הסרגל. 1/‎-1 = כרטיסייה הבאה/הקודמת (אופקית), 2 = מסך הכרטיסיות (אנכית, לכיוון הדף); 0 = כלום */
    fun swipe(dx: Float, dy: Float, min: Float, barBottom: Boolean): Int {
        val ax = kotlin.math.abs(dx); val ay = kotlin.math.abs(dy)
        if (ax >= min && ax > ay * 1.5f) return if (dx < 0) 1 else -1
        if (ay >= min && ay > ax * 1.5f && (if (barBottom) dy < 0 else dy > 0)) return 2
        return 0
    }
    /** המחוות שפועלות (סיביות): משיכה לרענון, החלקה בין כרטיסיות, גרירה למסך הכרטיסיות */
    const val G_PULL = 1; const val G_SWIPE = 2; const val G_SWITCHER = 4; const val G_ALL = 7

    /** 17/18 — קבוצות שמורות וסשנים: אוסף כרטיסיות עם שם (או סשן אוטומטי — `auto`) */
    data class TabSet(val id: String, val name: String, val at: Long, val auto: Boolean, val tabs: List<Pair<String, String>>)
    const val SESSIONS_MAX = 10
    const val GROUPS_MAX = 40
    const val SESSION_GAP = 30 * 60_000L
    fun setsEncode(l: List<TabSet>): String = org.json.JSONArray().apply {
        l.forEach { s -> put(org.json.JSONObject().put("id", s.id).put("n", s.name).put("at", s.at).put("a", s.auto)
            .put("t", org.json.JSONArray().apply { s.tabs.forEach { (u, t) -> put(org.json.JSONArray().put(u).put(t)) } })) }
    }.toString()
    fun setsDecode(s: String?): List<TabSet> = runCatching {
        val a = org.json.JSONArray(s ?: "[]")
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            val ta = o.optJSONArray("t") ?: org.json.JSONArray()
            val tabs = (0 until ta.length()).mapNotNull { j -> ta.optJSONArray(j)?.let { p -> p.optString(0) to p.optString(1) } }.filter { it.first.startsWith("http") }
            TabSet(o.optString("id"), o.optString("n"), o.optLong("at"), o.optBoolean("a"), tabs).takeIf { it.id.isNotEmpty() && tabs.isNotEmpty() }
        } }
    }.getOrDefault(emptyList())
    /** סשן אוטומטי: אותן כתובות כמו האחרון — רק הזמן; פחות מחצי שעה מהאחרון — מחליף אותו; אחרת סשן חדש. עד 10 סשנים */
    fun pushSession(l: List<TabSet>, tabs: List<Pair<String, String>>, now: Long, id: () -> String): List<TabSet> {
        val t = tabs.filter { it.first.startsWith("http") }
        if (t.isEmpty()) return l
        val autos = l.filter { it.auto }.sortedByDescending { it.at }
        val last = autos.firstOrNull()
        val named = l.filter { !it.auto }
        val next = when {
            last != null && last.tabs.map { it.first } == t.map { it.first } -> listOf(last.copy(at = now, tabs = t)) + autos.drop(1)
            last != null && now - last.at < SESSION_GAP -> listOf(last.copy(at = now, tabs = t)) + autos.drop(1)
            else -> listOf(TabSet(id(), "", now, true, t)) + autos
        }
        return named + next.take(SESSIONS_MAX)
    }
    fun saveGroup(l: List<TabSet>, name: String, tabs: List<Pair<String, String>>, now: Long, id: () -> String): List<TabSet> {
        val t = tabs.filter { it.first.startsWith("http") }
        if (t.isEmpty() || name.isBlank()) return l
        val named = l.filter { !it.auto && it.name != name.trim() }
        return listOf(TabSet(id(), name.trim(), now, false, t)) + named.take(GROUPS_MAX - 1) + l.filter { it.auto }
    }

    /** 16 — חיסכון בזיכרון: 0 כבוי, 1 מאוזן, 2 מרבי. כמה כרטיסיות חיות מותר, ומתי כרטיסייה ברקע נרדמת (0 = לא לפי זמן) */
    fun liveCap(base: Int, saver: Int, battery: Boolean): Int = when {
        saver >= 2 -> 1
        saver == 1 || battery -> base.coerceAtMost(2)
        else -> base
    }.coerceAtLeast(1)
    fun sleepAfter(saver: Int, battery: Boolean): Long = when {
        saver >= 2 -> 5 * 60_000L
        saver == 1 -> 20 * 60_000L
        battery -> 10 * 60_000L
        else -> 0L
    }
    /** כרטיסייה ברקע שתירדם עכשיו: לא מנגנת, לא על המסך, ועבר הזמן */
    fun sleepy(idleMs: Long, saver: Int, battery: Boolean, playing: Boolean): Boolean {
        val after = sleepAfter(saver, battery)
        return !playing && after > 0 && idleMs >= after
    }

    /** 74 — מחיקה מהירה: הטווחים (דקות) — 15 דקות (ברירת המחדל), שעה, 24 שעות */
    val QUICK = listOf(15, 60, 24 * 60)
    fun since(now: Long, minutes: Int): Long = now - minutes * 60_000L

    /** 37 — צבע לכל משתמש (לפי ת־עיצוב של צבעי פרופילים): הפלטה; ‎-1 = בלי צבע */
    val USER_COLORS = listOf(0xFF007AFF, 0xFF34C759, 0xFFFF9500, 0xFFAF52DE, 0xFFFF2D55, 0xFF5AC8FA, 0xFFA2845E, 0xFF8E8E93)
    fun userColor(i: Int): Long? = USER_COLORS.getOrNull(i)

    /** 40 — מצב שולחן: 0 אוטומטי (מסך מ־840dp — טאבלט, DeX, מסך חיצוני), 1 תמיד, 2 אף פעם */
    fun desk(mode: Int, widthDp: Int): Boolean = when (mode) { 1 -> true; 2 -> false; else -> widthDp >= 840 }
}
