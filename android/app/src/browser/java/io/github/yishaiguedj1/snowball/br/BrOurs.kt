package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Studio Browser Pro — הגל השישי (02/11/2026, docs/browser-pro-plan.md): רק אצלנו — Studio, Academy ו־Invest.
 * 68 תרגום הסרטון ב־Studio (והכתוביות חוזרות לנגן של האתר) · 69 מאוחר יותר, מתורגם · 73 פרקים וסיכום מהתמליל הקיים ·
 * 70 מאמר ל־Academy (EPUB) · 71 כרטיס מניה (דרך השרתון — בקשה אחת לכמה סימבולים, גם ת״א).
 * רק לוגיקה טהורה והסקריפטים לדף — בלי אנדרואיד (נבדק ב־BrOursTest ב־JVM). הצד של אנדרואיד — BrOursAndroid.kt.
 * בנייה נקייה: הפענוח, הפרקים, הסיכום וה־EPUB נכתבו כאן מאפס. שום דבר כאן לא עולה כסף: הסיכום והפרקים מחולצים
 * מהתמליל עצמו (בלי מודל בשרת), והמחירים מהשרתון שלנו (מידע ציבורי, בלי נתוני משתמש).
 */
object BrOurs {

    /* ---------- כתוביות (68, 73) ---------- */

    data class Cue(val s: Long, val e: Long, val t: String)

    const val MAX_CUES = 6000
    const val MAX_SUBS_BYTES = 2_000_000

    private val TIME = Regex("""(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})""")

    /** "00:01:02,345" / "01:02.345" → מילישניות; null = לא זמן */
    fun ms(s: String): Long? {
        val m = TIME.matchEntire(s.trim()) ?: return null
        val (h, mi, se, f) = m.destructured
        val frac = f.padEnd(3, '0').take(3).toLong()
        return ((h.toLongOrNull() ?: 0) * 3600 + mi.toLong() * 60 + se.toLong()) * 1000 + frac
    }

    /** SRT או WebVTT → רשימת קטעים לפי הזמן. תגיות (<i>, {\an8}) יורדות, קטע ריק נזרק */
    fun parseSubs(raw: String): List<Cue> {
        val txt = raw.take(MAX_SUBS_BYTES).removePrefix("﻿").replace("\r\n", "\n").replace('\r', '\n')
        val out = ArrayList<Cue>()
        for (block in txt.split(Regex("\n[ \t]*\n"))) {
            val lines = block.split('\n').map { it.trimEnd() }.filter { it.isNotEmpty() }
            val ti = lines.indexOfFirst { "-->" in it }
            if (ti < 0) continue
            val parts = lines[ti].split("-->")
            val s = ms(parts[0].trim()) ?: continue
            val e = ms(parts.getOrElse(1) { "" }.trim().substringBefore(' ').substringBefore('\t')) ?: continue
            val t = lines.drop(ti + 1).joinToString("\n") { clean(it) }.trim()
            if (t.isEmpty() || e < s) continue
            out.add(Cue(s, e, t.take(500)))
            if (out.size >= MAX_CUES) break
        }
        return out.sortedBy { it.s }
    }

    private fun clean(l: String) = l.replace(Regex("<[^>]{0,80}>"), "").replace(Regex("""\{\\[^}]{0,40}\}"""), "")
        .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ").trim()

    /** קובץ שנשמר לדף (בטלפון בלבד) — SRT פשוט */
    fun toSrt(c: List<Cue>): String = buildString {
        c.forEachIndexed { i, q -> append(i + 1).append('\n').append(stamp(q.s)).append(" --> ").append(stamp(q.e)).append('\n').append(q.t).append("\n\n") }
    }
    private fun stamp(v: Long) = "%02d:%02d:%02d,%03d".format(v / 3600000, v / 60000 % 60, v / 1000 % 60, v % 1000)

    /** "1:02:03" / "4:05" — לרשימת הפרקים */
    fun clock(v: Long): String {
        val s = v / 1000
        return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)
    }

    /** הסרטון הראשי בדף = הגדול ביותר על המסך */
    private const val MAIN_V = "function V(){var vs=[].slice.call(document.querySelectorAll('video'));if(!vs.length)return null;vs.sort(function(a,b){return b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight});return vs[0]}"

    /**
     * הכתוביות לנגן של האתר: מסלול כתוביות של הדפדפן עצמו (addTextTrack + VTTCue) — בלי קובץ, בלי רשת ובלי blob,
     * כך שגם CSP של האתר לא חוסם, והכתוביות נראות גם במסך מלא. אין עדיין סרטון — מחכים לו עד חצי דקה.
     * החזרה: מספר הקטעים, 0 = מחכים לסרטון, ‎-1 = שגיאה
     */
    fun attachJs(c: List<Cue>, label: String, lang: String): String {
        val a = JSONArray(); c.take(MAX_CUES).forEach { a.put(JSONArray().put(it.s).put(it.e).put(it.t)) }
        return "(function(C,L,G){try{$MAIN_V;function go(v){var t=v.__snbSt;if(!t){t=v.addTextTrack('subtitles',L,G);v.__snbSt=t}else{while(t.cues&&t.cues.length)t.removeCue(t.cues[0])}" +
            "for(var i=0;i<v.textTracks.length;i++){var x=v.textTracks[i];if(x!==t&&x.mode==='showing')x.mode='hidden'}" +
            "C.forEach(function(q){try{t.addCue(new VTTCue(q[0]/1000,q[1]/1000,q[2]))}catch(e){}});t.mode='showing';return C.length}" +
            "var v=V();if(v)return go(v);var n=0,o=new MutationObserver(function(){var w=V();if(w){o.disconnect();go(w)}});o.observe(document.documentElement,{childList:true,subtree:true});" +
            "setTimeout(function(){o.disconnect()},30000);return 0}catch(e){return -1}})(" + a + "," + JSONObject.quote(label) + "," + JSONObject.quote(lang) + ")"
    }

    /** הורדת הכתוביות שלנו מהנגן */
    const val DETACH_JS = "(function(){try{[].forEach.call(document.querySelectorAll('video'),function(v){if(v.__snbSt)v.__snbSt.mode='disabled'})}catch(e){}})()"

    /** קפיצה לזמן בסרטון הראשי (פרק / תוצאת חיפוש) */
    fun seekJs(ms: Long): String = "(function(){try{$MAIN_V;var v=V();if(v){v.currentTime=${ms / 1000.0};if(v.paused&&v.play)v.play()}}catch(e){}})()"

    /**
     * 73 התמליל שכבר בדף: הכתוביות שהנגן עצמו טען (מסלולי subtitles/captions — מסלול כבוי עובר ל־hidden כדי שייטען).
     * החזרה: {l: שפה, c: [[התחלה, סוף, טקסט]]}; הכי ארוך מבין המסלולים
     */
    const val PAGE_SUBS_JS = """(function(){try{var vs=[].slice.call(document.querySelectorAll('video'));if(!vs.length)return '';
vs.sort(function(a,b){return b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight});var v=vs[0],best=null,bl='';
for(var i=0;i<v.textTracks.length;i++){var t=v.textTracks[i];if(t.kind!=='subtitles'&&t.kind!=='captions')continue;if(t.mode==='disabled')t.mode='hidden';
if(t.cues&&t.cues.length&&(!best||t.cues.length>best.length)){best=[];bl=t.language||'';for(var j=0;j<t.cues.length&&j<6000;j++){var c=t.cues[j];best.push([Math.round(c.startTime*1000),Math.round(c.endTime*1000),String(c.text||'').slice(0,500)])}}}
return JSON.stringify({l:bl,c:best||[]})}catch(e){return ''}})()"""

    /** התוצאה של PAGE_SUBS_JS → שפה וקטעים (ריק = אין תמליל בדף) */
    fun pageSubs(r: String?): Pair<String, List<Cue>> = runCatching {
        val o = JSONObject(BrDev.unquote(r).ifEmpty { return "" to emptyList() })
        val a = o.optJSONArray("c") ?: JSONArray()
        o.optString("l").take(8) to (0 until minOf(a.length(), MAX_CUES)).mapNotNull { i ->
            a.optJSONArray(i)?.let { q -> clean(q.optString(2)).trim().takeIf { it.isNotEmpty() }?.let { Cue(q.optLong(0), q.optLong(1), it.take(500)) } }
        }.sortedBy { it.s }
    }.getOrDefault("" to emptyList())

    /* ---------- 73 פרקים, סיכום ושאלה — מהתמליל בלבד ---------- */

    data class Sentence(val s: Long, val t: String)
    data class Chapter(val s: Long, val title: String)
    data class Hit(val s: Long, val t: String)

    private val END = Regex("""[.!?…։׃؟]["')\]״]*$""")

    /** הקטעים → משפטים (נקודה/סימן שאלה בסוף, או הפסקה של שנייה וחצי), עם זמן ההתחלה */
    fun sentences(c: List<Cue>): List<Sentence> {
        val out = ArrayList<Sentence>()
        var buf = StringBuilder(); var st = -1L; var lastEnd = -1L
        fun flush() { val t = buf.toString().replace(Regex("\\s+"), " ").trim(); if (t.isNotEmpty()) out.add(Sentence(st, t.take(400))); buf = StringBuilder(); st = -1L }
        for (q in c) {
            if (lastEnd >= 0 && q.s - lastEnd > 1500 && buf.isNotEmpty()) flush()
            val t = q.t.replace('\n', ' ').trim()
            if (t.isEmpty()) continue
            // משפט שמסתיים באמצע הקטע — מפצלים
            val parts = t.split(Regex("(?<=[.!?…؟])\\s+"))
            for ((i, p) in parts.withIndex()) {
                if (st < 0) st = q.s
                buf.append(' ').append(p)
                if (i < parts.size - 1 || END.containsMatchIn(p) || buf.length > 300) flush()
            }
            lastEnd = q.e
        }
        flush()
        return out
    }

    /** מילים "ריקות" (עברית ואנגלית) — לא נספרות בניקוד */
    private val STOP = (
        "את של על עם זה זו זאת הוא היא הם הן אני אתה את אנחנו אתם לא כן גם רק אבל או אם כי כמו מה מי איך למה כל יש אין היה הייתה היו " +
        "להיות אז עוד כבר מאוד פה שם הזה הזאת האלה אלה אותו אותה לי לך לו לה לנו להם בו בה שלי שלך שלו שלה שלנו כאן עכשיו טוב בסדר אוקיי " +
        "the a an and or but if of to in on at for with from by is are was were be been being it its this that these those i you he she we they " +
        "me him her us them my your his our their not no yes so do does did have has had will would can could should just like what which who how " +
        "why when where there here then than very really also into about out up down over all some any more most one two okay yeah um uh"
        ).split(' ').filter { it.isNotEmpty() }.toSet()

    /** קיפול לחיפוש: אותיות קטנות, בלי ניקוד וטעמים, אותיות סופיות כרגילות */
    fun fold(s: String): String = buildString {
        for (ch in s.lowercase()) when (ch) {
            in '֑'..'ׇ' -> {}
            'ך' -> append('כ'); 'ם' -> append('מ'); 'ן' -> append('נ'); 'ף' -> append('פ'); 'ץ' -> append('צ')
            else -> append(ch)
        }
    }

    private fun words(s: String) = fold(s).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 3 && it !in STOP }

    /** ניקוד לכל משפט: סכום תדירות המילים בתמליל, חלקי שורש האורך (משפט ארוך לא מנצח רק בגלל האורך) */
    private fun scores(ss: List<Sentence>): DoubleArray {
        val tf = HashMap<String, Int>()
        val ws = ss.map { words(it.t) }
        ws.forEach { l -> l.toSet().forEach { tf[it] = (tf[it] ?: 0) + 1 } }
        return DoubleArray(ss.size) { i ->
            val l = ws[i]
            if (l.size < 4) 0.0 else l.sumOf { (tf[it] ?: 1).toDouble() - 1 } / Math.sqrt(l.size.toDouble())
        }
    }

    /**
     * 73 הסיכום: המשפטים הכי מייצגים מהתמליל עצמו (סיכום מחלץ — בלי מודל, בלי ענן, בלי כסף), בסדר שבו נאמרו,
     * 3–7 לפי האורך. כל נקודה עם הזמן — נגיעה קופצת אליה
     */
    fun summary(c: List<Cue>, max: Int = 7): List<Sentence> {
        val ss = sentences(c)
        if (ss.isEmpty()) return emptyList()
        val n = (ss.size / 12).coerceIn(3, max).coerceAtMost(ss.size)
        val sc = scores(ss)
        val pick = sc.indices.sortedByDescending { sc[it] }.filter { sc[it] > 0 }.take(n).sorted()
        return (pick.ifEmpty { listOf(0) }).map { ss[it] }
    }

    /**
     * 73 פרקים: מספר הפרקים לפי האורך (פרק לכ־4 דקות, 2–12). לכל גבול משוער בוחרים את תחילת המשפט עם ההפסקה הכי ארוכה
     * לפניו בחלון של ±רבע פרק; הכותרת = המשפט הכי מייצג בפרק, מקוצר. סרטון קצר מ־3 דקות — אין פרקים
     */
    fun chapters(c: List<Cue>): List<Chapter> {
        val ss = sentences(c)
        if (ss.size < 4) return emptyList()
        val total = c.maxOf { it.e }
        if (total < 180_000) return emptyList()
        val n = (total / 240_000).toInt().coerceIn(2, 12).coerceAtMost(ss.size / 2)
        if (n < 2) return emptyList()
        // ההפסקה לפני כל משפט
        val gap = LongArray(ss.size) { i -> if (i == 0) 0 else ss[i].s - lastEnd(c, ss[i].s) }
        val starts = ArrayList<Int>(); starts.add(0)
        val seg = total / n
        for (k in 1 until n) {
            val target = seg * k; val win = seg / 4
            val cand = ss.indices.filter { it > (starts.last()) && Math.abs(ss[it].s - target) <= win }
            val b = cand.maxByOrNull { gap[it] * 4 - Math.abs(ss[it].s - target) / 50 } ?: ss.indices.firstOrNull { it > starts.last() && ss[it].s >= target } ?: continue
            starts.add(b)
        }
        val sc = scores(ss)
        return starts.mapIndexed { k, from ->
            val to = starts.getOrNull(k + 1) ?: ss.size
            val best = (from until to).maxByOrNull { sc[it] } ?: from
            Chapter(ss[from].s, title(ss[best].t))
        }
    }
    private fun lastEnd(c: List<Cue>, before: Long): Long = c.lastOrNull { it.s < before }?.e ?: before

    /** כותרת לפרק: עד 9 מילים / 64 תווים, בלי סימני פיסוק בסוף */
    fun title(s: String): String {
        val w = s.trim().split(Regex("\\s+"))
        var t = w.take(9).joinToString(" ")
        if (t.length > 64) t = t.take(64).substringBeforeLast(' ')
        return (t.trimEnd(',', '.', ';', ':', '-', '–', '!', '?') + if (w.size > 9 || t.length < s.trim().length) "…" else "").trim()
    }

    /** 73 שאלה על הסרטון = חיפוש בתמליל (כל המילים, בלי ניקוד), עד 30 תוצאות עם הזמן */
    fun search(c: List<Cue>, q: String, max: Int = 30): List<Hit> {
        val ws = fold(q).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 2 && it !in STOP }
        if (ws.isEmpty()) return emptyList()
        return sentences(c).filter { s -> val f = fold(s.t); ws.all { it in f } }.take(max).map { Hit(it.s, it.t) }
    }

    /* ---------- 68 מה נשלח ל־Studio (כדי שהכתוביות שחוזרות יגיעו לדף הנכון) ---------- */

    data class Sent(val url: String, val title: String, val at: Long)
    const val SENT_MAX = 30
    const val SENT_DAYS = 14

    fun sentEncode(l: List<Sent>): String = JSONArray().apply { l.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("a", it.at)) } }.toString()
    fun sentDecode(s: String?): List<Sent> = runCatching {
        val a = JSONArray(s ?: return emptyList())
        (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { Sent(it.optString("u"), it.optString("t"), it.optLong("a")) }.filter { it.url.startsWith("http") }
    }.getOrDefault(emptyList())

    /** הוספה בראש (אותו דף — מתעדכן), עד SENT_MAX ובלי ישנים מ־SENT_DAYS */
    fun sentAdd(l: List<Sent>, x: Sent, now: Long): List<Sent> {
        val k = BrRead.pageKey(x.url)
        return (listOf(x) + l.filter { BrRead.pageKey(it.url) != k && now - it.at < SENT_DAYS * 86_400_000L }).take(SENT_MAX)
    }

    /**
     * קובץ כתוביות שחזר מ־Studio (שיתוף) → לאיזה דף. Studio קורא לקובץ "שם הסרטון.he.srt": הדף עם הכי הרבה מילים
     * משותפות לכותרת; אין התאמה — האחרון שנשלח. null = לא נשלח כלום
     */
    fun matchSent(l: List<Sent>, fileName: String, now: Long): Sent? {
        val live = l.filter { now - it.at < SENT_DAYS * 86_400_000L }
        if (live.isEmpty()) return null
        val base = fileName.substringBeforeLast('.').replace(Regex("\\.[a-z]{2,3}$"), "")
        val fw = words(base).toSet()
        val best = live.maxByOrNull { s -> words(s.title).count { it in fw } * 1000 - live.indexOf(s) }
        return if (best != null && words(best.title).any { it in fw }) best else live.first()
    }

    /** שם קובץ לכתוביות של דף (בטלפון בלבד, בתיקייה של המשתמש) */
    fun subsFile(url: String): String = "subs/" + sha(BrRead.pageKey(url)).take(24) + ".srt"
    private fun sha(s: String) = java.security.MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    /* ---------- 69 מאוחר יותר, מתורגם ---------- */

    /** האיכות לתור "אחר כך": הגבוהה ביותר עד 1080p (מספיק לצפייה ולתרגום, ופחות נפח), אחרת הנמוכה שיש */
    fun laterHeight(heights: List<Int>): Int? {
        val hs = heights.filter { it > 0 }
        return hs.filter { it <= 1080 }.maxOrNull() ?: hs.minOrNull()
    }

    /* ---------- 70 מאמר ל־Academy (EPUB) ---------- */

    private fun x(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
        .filter { it == '\n' || it == '\t' || it >= ' ' }

    /** שם קובץ בטוח: הכותרת, עד 80 תווים, בלי תווים שמערכת קבצים לא מקבלת */
    fun epubName(title: String): String =
        (title.replace(Regex("""[\\/:*?"<>|\u0000-\u001F]+"""), " ").replace(Regex("\\s+"), " ").trim().take(80).ifEmpty { "article" }) + ".epub"

    private fun rtl(lang: String) = lang.lowercase().substringBefore('-').let { it == "he" || it == "iw" || it == "ar" || it == "fa" || it == "ur" || it == "yi" }

    /**
     * המאמר (מהחילוץ של מצב הקריאה, BrRead) → ספר EPUB 3 תקין: mimetype לא דחוס ראשון, container, ‏OPF עם מטא־נתונים
     * (כותרת, כותב/אתר, שפה, מזהה מהכתובת, מקור), תוכן ניווט, ופרק אחד עם הכותרות, הפסקאות, הציטוטים והרשימות.
     * בסוף — קישור למקור. רק טקסט: בלי תמונות, סקריפטים או סגנונות של האתר
     */
    fun epub(a: BrRead.Article, lang: String, now: Long): ByteArray {
        val title = a.title.ifEmpty { a.site }.ifEmpty { "Article" }
        val l = lang.ifEmpty { a.lang }.ifEmpty { "en" }.take(8)
        val dir = if (rtl(l)) "rtl" else "ltr"
        val id = "urn:snb:br:" + sha(BrRead.pageKey(a.url)).take(32)
        val date = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(now))
        val by = a.byline.ifEmpty { a.site }
        val body = StringBuilder()
        body.append("<h1>").append(x(title)).append("</h1>\n")
        if (by.isNotEmpty()) body.append("<p class=\"by\">").append(x(by)).append("</p>\n")
        var inList = false
        for (b in a.blocks) {
            if (b.k == 'l' && !inList) { body.append("<ul>\n"); inList = true }
            if (b.k != 'l' && inList) { body.append("</ul>\n"); inList = false }
            when (b.k) {
                'h' -> body.append("<h2>").append(x(b.t)).append("</h2>\n")
                'q' -> body.append("<blockquote><p>").append(x(b.t)).append("</p></blockquote>\n")
                'l' -> body.append("<li>").append(x(b.t)).append("</li>\n")
                else -> body.append("<p>").append(x(b.t)).append("</p>\n")
            }
        }
        if (inList) body.append("</ul>\n")
        body.append("<hr/>\n<p class=\"src\"><a href=\"").append(x(a.url)).append("\">").append(x(a.site.ifEmpty { a.url })).append("</a></p>\n")
        val xhtml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\" lang=\"$l\" xml:lang=\"$l\" dir=\"$dir\">\n" +
            "<head><meta charset=\"utf-8\"/><title>${x(title)}</title><link rel=\"stylesheet\" href=\"style.css\"/></head>\n<body dir=\"$dir\">\n$body</body>\n</html>\n"
        val nav = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\" lang=\"$l\" xml:lang=\"$l\" dir=\"$dir\">\n" +
            "<head><meta charset=\"utf-8\"/><title>${x(title)}</title></head>\n<body><nav epub:type=\"toc\" id=\"toc\"><ol><li><a href=\"text.xhtml\">${x(title)}</a></li></ol></nav></body>\n</html>\n"
        val opf = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bid\" xml:lang=\"$l\" dir=\"$dir\">\n" +
            "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n<dc:identifier id=\"bid\">$id</dc:identifier>\n<dc:title>${x(title)}</dc:title>\n" +
            (if (by.isNotEmpty()) "<dc:creator>${x(by)}</dc:creator>\n" else "") +
            (if (a.site.isNotEmpty()) "<dc:publisher>${x(a.site)}</dc:publisher>\n" else "") +
            "<dc:language>$l</dc:language>\n<dc:source>${x(a.url)}</dc:source>\n<meta property=\"dcterms:modified\">$date</meta>\n</metadata>\n" +
            "<manifest>\n<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>\n" +
            "<item id=\"text\" href=\"text.xhtml\" media-type=\"application/xhtml+xml\"/>\n<item id=\"css\" href=\"style.css\" media-type=\"text/css\"/>\n</manifest>\n" +
            "<spine page-progression-direction=\"$dir\"><itemref idref=\"text\"/></spine>\n</package>\n"
        val css = "body{line-height:1.6}h1{font-size:1.5em}p.by,p.src{opacity:.7;font-size:.9em}blockquote{margin:1em 1.5em;font-style:italic}\n"
        val container = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n" +
            "<rootfiles><rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles>\n</container>\n"
        val bo = ByteArrayOutputStream()
        ZipOutputStream(bo).use { z ->
            val mt = "application/epub+zip".toByteArray()
            z.putNextEntry(ZipEntry("mimetype").apply { method = ZipEntry.STORED; size = mt.size.toLong(); compressedSize = mt.size.toLong(); crc = CRC32().apply { update(mt) }.value })
            z.write(mt); z.closeEntry()
            fun put(n: String, s: String) { z.putNextEntry(ZipEntry(n)); z.write(s.toByteArray(Charsets.UTF_8)); z.closeEntry() }
            put("META-INF/container.xml", container)
            put("OEBPS/content.opf", opf)
            put("OEBPS/nav.xhtml", nav)
            put("OEBPS/style.css", css)
            put("OEBPS/text.xhtml", xhtml)
        }
        return bo.toByteArray()
    }

    /* ---------- 71 כרטיס מניה ---------- */

    /** מה לחפש: סימבולים מפורשים (לבקשה אחת של מחירים), או טקסט לחיפוש לפי שם */
    data class Query(val syms: List<String>, val q: String)

    private val SYM_OK = Regex("""^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$""")
    fun symOk(s: String) = SYM_OK.matches(s)

    private val CASH = Regex("""\$([A-Za-z]{1,6}(?:\.[A-Za-z]{1,2})?)\b""")
    private val EXCH = Regex("""\b(NASDAQ|NYSE|NYSEARCA|AMEX|ARCA|BATS|OTC|TASE|TLV)\s*[:：]\s*([A-Za-z0-9]{1,6}(?:\.[A-Za-z]{1,2})?)\b""", RegexOption.IGNORE_CASE)
    private val TA = Regex("""\b([A-Za-z0-9]{1,6})\.TA\b""", RegexOption.IGNORE_CASE)
    private val BARE = Regex("""^[A-Z]{1,5}(?:\.[A-Z])?$""")

    /**
     * הבחירה בדף → מה לחפש. ‎$AAPL, ‏"NASDAQ: AAPL", ‏"TASE: POLI" / ‏POLI.TA (ת״א), או סימבול לבד (אותיות גדולות) → סימבולים;
     * כל השאר (שם חברה, גם בעברית) → חיפוש לפי שם בשרתון. עד 3 סימבולים
     */
    fun query(sel: String): Query? {
        val s = sel.replace(Regex("\\s+"), " ").trim().trim('"', '\'', '(', ')', ',', '.', ':', ';', '״', '׳')
        if (s.isEmpty() || s.length > 80) return null
        val out = LinkedHashSet<String>()
        EXCH.findAll(s).forEach { m ->
            val ex = m.groupValues[1].uppercase(); val sym = m.groupValues[2].uppercase()
            out.add(if (ex == "TASE" || ex == "TLV") sym.removeSuffix(".TA") + ".TA" else sym.replace('.', '-'))
        }
        TA.findAll(s).forEach { out.add(it.groupValues[1].uppercase() + ".TA") }
        CASH.findAll(s).forEach { out.add(it.groupValues[1].uppercase().replace('.', '-')) }
        if (out.isEmpty() && BARE.matches(s)) out.add(s.replace('.', '-'))
        val syms = out.filter { symOk(it) }.take(3)
        if (syms.isNotEmpty()) return Query(syms, "")
        if (s.length < 2 || s.count { it.isLetterOrDigit() } < 2) return null
        return Query(emptyList(), s.take(60))
    }

    /** בקשת החיפוש לשרתון (‎/api/search — מידע ציבורי, שום נתון של המשתמש) */
    fun searchBody(q: String): String = JSONObject().put("q", q.take(60)).toString()

    /** התשובה של החיפוש → עד 3 סימבולים עם השם (ארה״ב ות״א בלבד — השרתון כבר מסנן) */
    fun searchParse(s: String?): List<Pair<String, String>> = runCatching {
        val a = JSONObject(s ?: return emptyList()).optJSONArray("items") ?: return emptyList()
        (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { it.optString("sym").uppercase() to it.optString("name").take(120) }
            .filter { symOk(it.first) }.distinctBy { it.first }.take(3)
    }.getOrDefault(emptyList())

    /** בקשת המחירים — כל הסימבולים בבקשה אחת (‎/api/quotes, עד 40; כאן עד 3) */
    fun quotesBody(syms: List<String>): String = JSONObject().put("syms", JSONArray(syms.filter { symOk(it) }.take(3))).toString()

    /** כרטיס: מחיר ושינוי יומי; ת״א באגורות (ILA) → שקלים. ext = מחיר טרום/אחרי מסחר כשיש */
    data class Card(val sym: String, val name: String, val price: Double, val chg: Double, val pct: Double, val cur: String, val state: String,
                    val ext: Double? = null, val extPct: Double? = null, val ta: Boolean = false)

    fun quotesParse(s: String?, names: Map<String, String>): List<Card> = runCatching {
        val d = JSONObject(s ?: return emptyList()).optJSONObject("data") ?: return emptyList()
        d.keys().asSequence().mapNotNull { sym ->
            val o = d.optJSONObject(sym) ?: return@mapNotNull null
            val meta = o.optJSONObject("chart")?.optJSONArray("result")?.optJSONObject(0)?.optJSONObject("meta") ?: return@mapNotNull null
            val ila = meta.optString("currency").equals("ILA", true)
            val k = if (ila) 0.01 else 1.0
            val p = meta.optDouble("regularMarketPrice", Double.NaN) * k
            if (p.isNaN() || p <= 0) return@mapNotNull null
            val prev = (meta.optDouble("chartPreviousClose", Double.NaN).takeIf { !it.isNaN() } ?: meta.optDouble("previousClose", Double.NaN)) * k
            val chg = if (prev.isNaN() || prev <= 0) 0.0 else p - prev
            val pct = if (prev.isNaN() || prev <= 0) 0.0 else chg / prev * 100
            val x = o.optJSONObject("x")
            val st = x?.optString("state").orEmpty()
            val e = x?.optJSONObject(if (st.startsWith("PRE")) "pre" else "post")?.takeIf { st.startsWith("PRE") || st.startsWith("POST") }
            Card(sym, (names[sym] ?: "").ifEmpty { meta.optString("longName").ifEmpty { meta.optString("shortName") } }.take(120), p, chg, pct,
                if (ila) "ILS" else meta.optString("currency").uppercase().take(4), st,
                e?.optDouble("p")?.takeIf { it > 0 }, e?.optDouble("pct")?.takeIf { !it.isNaN() }, sym.endsWith(".TA"))
        }.toList()
    }.getOrDefault(emptyList())

    /** "₪12.34" / "$187.20" / "€9.10" */
    fun money(v: Double, cur: String): String {
        val sign = when (cur) { "USD" -> "$"; "ILS" -> "₪"; "EUR" -> "€"; "GBP" -> "£"; else -> "" }
        val n = if (v >= 1000) "%,.2f".format(java.util.Locale.US, v) else if (v >= 1) "%.2f".format(java.util.Locale.US, v) else "%.4f".format(java.util.Locale.US, v)
        return if (sign.isEmpty()) "$n $cur" else sign + n
    }
    /** "+1.23%" / "−0.45%" (מינוס אמיתי) */
    fun pctText(p: Double): String = (if (p >= 0) "+" else "−") + "%.2f".format(java.util.Locale.US, Math.abs(p)) + "%"

    const val INVEST = "https://invest.thesnowball.app/"
    /** הגרף של המניה ב־Invest (‎#chart= — אותו קישור של התראת המחיר) */
    fun chartUrl(sym: String) = INVEST + "#chart=" + java.net.URLEncoder.encode(sym, "UTF-8")
    /** הוספה לרשימת המעקב ב־Invest (‎#watch= — Invest שואל לפני ההוספה) */
    fun watchUrl(sym: String, name: String) = INVEST + "#watch=" + java.net.URLEncoder.encode(sym, "UTF-8") +
        if (name.isEmpty()) "" else "&nm=" + java.net.URLEncoder.encode(name.take(80), "UTF-8").replace("+", "%20")
}
