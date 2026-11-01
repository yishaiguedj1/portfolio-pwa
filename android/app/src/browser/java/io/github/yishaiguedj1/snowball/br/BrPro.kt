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
}
