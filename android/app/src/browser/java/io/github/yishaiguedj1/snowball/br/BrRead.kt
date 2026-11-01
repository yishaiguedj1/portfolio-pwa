package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Studio Browser Pro — הגל הרביעי (01/11/2026, docs/browser-pro-plan.md): קריאה, צילום ומדיה.
 * רק לוגיקה טהורה, הסקריפטים לדף והקבצים בתיקייה של המשתמש — בלי אנדרואיד (נבדק ב־BrReadTest ב־JVM).
 * החיבור לפעילות — BrowserActivity ("הגל הרביעי"), הצילום/PDF/QR/הקראה — BrCapture.kt.
 * בנייה נקייה: חילוץ המאמר, ההדגשות והאינדקס נכתבו כאן מאפס, לפי ההתנהגות (ת־עיצוב של מצב הקריאה בדפדפנים), בלי ספרייה של מוצר אחר.
 * כל מה שנשמר כאן (רשימת הקריאה, ההדגשות, האינדקס של ההיסטוריה) — בטלפון בלבד, בתיקייה של המשתמש (BrUsers.dir), לא בענן.
 */
object BrRead {

    /* ---------- 31 מצב קריאה (והבסיס של 27, 29, 30, 55) ---------- */

    /** בלוק במאמר: h כותרת, p פסקה, q ציטוט, l פריט ברשימה */
    data class Block(val k: Char, val t: String)
    data class Article(val url: String, val title: String, val byline: String, val site: String, val lang: String, val blocks: List<Block>) {
        val words get() = blocks.sumOf { b -> b.t.split(' ').count { it.isNotBlank() } }
        /** דקות קריאה: 200 מילים לדקה, לפחות 1 */
        val minutes get() = maxOf(1, (words + 199) / 200)
    }

    /**
     * החילוץ (משלנו): המועמד = article / main / ‏role=main / ההורה של הפסקאות. ניקוד לכל מועמד = אורך הטקסט בפסקאות,
     * פחות מה שבתוך קישורים (תפריטים וקישורים קשורים), ובונוס לרכיב article. מתוך המנצח — כותרות, פסקאות, ציטוטים ורשימות,
     * בלי nav/aside/footer/form/פרסומות ובלי מה שמוסתר.
     */
    const val READER_JS = """(function(){try{
var BAD=/(^|[\s_-])(nav|menu|footer|sidebar|aside|comment|share|social|promo|advert|ads?|banner|related|recommend|newsletter|subscribe|cookie|popup|modal)([\s_-]|$)/i;
function bad(e){for(var x=e;x&&x!==document.body;x=x.parentElement){var t=x.tagName;if(t==='NAV'||t==='ASIDE'||t==='FOOTER'||t==='FORM'||t==='HEADER'&&x!==e)return true;
var c=(x.className&&x.className.baseVal===undefined?x.className:'')+' '+(x.id||'');if(BAD.test(c)&&x.tagName!=='ARTICLE'&&x.tagName!=='MAIN')return true}return false}
function txt(e){return (e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()}
function linkLen(e){var n=0;e.querySelectorAll('a').forEach(function(a){n+=txt(a).length});return n}
var cands=[],seen=new Set();
document.querySelectorAll('article,main,[role=main],[itemprop=articleBody]').forEach(function(e){if(!seen.has(e)){seen.add(e);cands.push(e)}});
document.querySelectorAll('p').forEach(function(p){var e=p.parentElement;if(e&&!seen.has(e)){seen.add(e);cands.push(e)}var g=e&&e.parentElement;if(g&&!seen.has(g)){seen.add(g);cands.push(g)}});
var best=null,bs=0;
cands.forEach(function(e){if(bad(e))return;var s=0;e.querySelectorAll('p,pre,blockquote,li').forEach(function(p){var l=txt(p).length;if(l>=40)s+=l});
s=s-linkLen(e)*0.5;if(e.tagName==='ARTICLE'||e.getAttribute('itemprop')==='articleBody')s*=1.3;if(s>bs){bs=s;best=e}});
if(!best||bs<300)return '';
var out=[],n=0;
best.querySelectorAll('h1,h2,h3,h4,p,pre,blockquote,li').forEach(function(e){if(n>800)return;if(bad(e))return;var st=getComputedStyle(e);if(st.display==='none'||st.visibility==='hidden')return;
var tg=e.tagName,k=/^H/.test(tg)?'h':tg==='BLOCKQUOTE'?'q':tg==='LI'?'l':'p';if(k!=='q'&&e.closest('blockquote')&&e.closest('blockquote')!==e)return;if(k==='p'&&e.closest('li'))return;
var t=txt(e);if(!t)return;if(k==='l'&&linkLen(e)>t.length*0.6)return;if(k==='p'&&t.length<25&&linkLen(e)>0)return;out.push([k,t.slice(0,6000)]);n++});
var m=function(s){var e=document.querySelector(s);return e?(e.content||txt(e)):''};
var by=m('meta[name=author]')||m('[rel=author]')||m('.byline')||'';
var site=m('meta[property="og:site_name"]')||location.hostname.replace(/^www\./,'');
var h1=document.querySelector('h1');var title=m('meta[property="og:title"]')||(h1?txt(h1):'')||document.title;
return JSON.stringify({t:title.slice(0,300),b:by.slice(0,120),s:site.slice(0,80),l:(document.documentElement.lang||'').slice(0,8),p:out})}catch(e){return ''}})()"""

    /** התוצאה של READER_JS → מאמר; כותרת שחוזרת כבלוק ראשון יורדת, ומאמר קצר מדי = אין (null) */
    fun articleParse(r: String?, url: String): Article? = runCatching {
        val s = BrDev.unquote(r).ifEmpty { return null }
        val o = JSONObject(s)
        val a = o.optJSONArray("p") ?: return null
        val title = o.optString("t").trim()
        var blocks = (0 until a.length()).mapNotNull { i -> a.optJSONArray(i)?.let { p -> p.optString(0).firstOrNull()?.takeIf { it in "hpql" }?.let { Block(it, p.optString(1).trim()) } } }
            .filter { it.t.isNotEmpty() }
        blocks = blocks.filterIndexed { i, b -> i == 0 || b != blocks[i - 1] }
        if (blocks.firstOrNull()?.let { it.k == 'h' && norm(it.t) == norm(title) } == true) blocks = blocks.drop(1)
        if (blocks.sumOf { if (it.k == 'h') 0 else it.t.length } < 280) return null
        Article(url, title, o.optString("b").trim(), o.optString("s").trim(), o.optString("l"), blocks)
    }.getOrNull()

    fun articleJson(a: Article): JSONObject = JSONObject().put("u", a.url).put("t", a.title).put("b", a.byline).put("s", a.site).put("l", a.lang)
        .put("p", JSONArray().apply { a.blocks.forEach { put(JSONArray().put(it.k.toString()).put(it.t)) } })
    fun articleOf(o: JSONObject?): Article? = o?.let { j ->
        val p = j.optJSONArray("p") ?: return null
        Article(j.optString("u"), j.optString("t"), j.optString("b"), j.optString("s"), j.optString("l"),
            (0 until p.length()).mapNotNull { i -> p.optJSONArray(i)?.let { b -> Block(b.optString(0).firstOrNull() ?: 'p', b.optString(1)) } })
    }

    fun esc(s: String) = buildString { s.forEach { ch -> when (ch) { '<' -> append("&lt;"); '>' -> append("&gt;"); '&' -> append("&amp;"); '"' -> append("&quot;"); '\'' -> append("&#39;"); else -> append(ch) } } }

    /** HTML נקי של המאמר — ל־PDF (55). בלי סקריפטים ובלי תמונות; הכיוון לפי השפה (או לפי האותיות) */
    fun html(a: Article): String {
        val rtl = isRtl(a.lang, a.title + " " + a.blocks.take(5).joinToString(" ") { it.t })
        val body = buildString {
            a.blocks.forEach { b ->
                when (b.k) {
                    'h' -> append("<h2>").append(esc(b.t)).append("</h2>")
                    'q' -> append("<blockquote>").append(esc(b.t)).append("</blockquote>")
                    'l' -> append("<p class=l>• ").append(esc(b.t)).append("</p>")
                    else -> append("<p>").append(esc(b.t)).append("</p>")
                }
                append('\n')
            }
        }
        val meta = listOf(a.site, a.byline).filter { it.isNotEmpty() }.joinToString(" · ")
        return "<!doctype html><html dir=\"${if (rtl) "rtl" else "ltr"}\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">" +
            "<title>${esc(a.title)}</title><style>body{font:17px/1.65 Georgia,'Noto Serif Hebrew',serif;color:#111;max-width:680px;margin:24px auto;padding:0 18px}" +
            "h1{font-size:28px;line-height:1.25;margin:0 0 6px}h2{font-size:21px;margin:26px 0 8px}.m{color:#666;font-size:14px;margin-bottom:22px}" +
            "blockquote{margin:14px 0;padding:0 14px;border-inline-start:3px solid #ccc;color:#444}.l{margin:6px 0}.u{color:#888;font-size:12px;margin-top:30px;word-break:break-all}</style></head><body>" +
            "<h1>${esc(a.title)}</h1>" + (if (meta.isNotEmpty()) "<div class=m>${esc(meta)}</div>" else "") + body +
            "<div class=u>${esc(a.url)}</div></body></html>"
    }

    /** כיוון: לפי lang של הדף, ואם אין — לפי רוב האותיות (עברית/ערבית מול לטינית) */
    fun isRtl(lang: String, sample: String): Boolean {
        val l = lang.lowercase().substringBefore('-')
        if (l in setOf("he", "iw", "ar", "fa", "ur", "yi")) return true
        if (l.isNotEmpty() && l.all { it.isLetter() }) return false
        return langOf(sample) in setOf("he", "ar")
    }

    /* ---------- 27 הקראה (TTS של אנדרואיד) ---------- */

    /** השפה להקראה לפי האותיות: עברית / ערבית / רוסית / אנגלית (ברירת המחדל) */
    fun langOf(s: String): String {
        var he = 0; var ar = 0; var ru = 0; var la = 0
        for (ch in s.take(4000)) when (ch) {
            in 'א'..'ת' -> he++
            in 'ؠ'..'ي' -> ar++
            in 'А'..'я' -> ru++
            in 'a'..'z', in 'A'..'Z' -> la++
        }
        val m = maxOf(he, ar, ru, la)
        return when { m == 0 -> "en"; m == he -> "he"; m == ar -> "ar"; m == ru -> "ru"; else -> "en" }
    }

    /** הטקסט לחתיכות שה־TTS מקבל (עד max תווים) — חותכים בסוף משפט, ואם אין — ברווח */
    fun chunks(text: String, max: Int = 3000): List<String> {
        val out = ArrayList<String>()
        var s = text.replace(Regex("\\s+"), " ").trim()
        while (s.length > max) {
            val head = s.substring(0, max)
            var cut = maxOf(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "), head.lastIndexOf("; "))
            if (cut < max / 3) cut = head.lastIndexOf(' ')
            if (cut < max / 3) cut = max - 1
            out += s.substring(0, cut + 1).trim(); s = s.substring(cut + 1).trim()
        }
        if (s.isNotEmpty()) out += s
        return out
    }

    /** מה להקריא ממאמר: כל בלוק = יחידה (כדי להדגיש את הפסקה שמוקראת), בלוק ארוך — כמה חתיכות עם אותו מספר */
    fun speakUnits(a: Article): List<Pair<Int, String>> =
        (listOf(-1 to a.title) + a.blocks.mapIndexed { i, b -> i to b.t }).filter { it.second.isNotBlank() }.flatMap { (i, t) -> chunks(t).map { i to it } }

    const val SEL_JS = "(function(){try{return String(getSelection()||'').replace(/\\s+/g,' ').trim().slice(0,20000)}catch(e){return ''}})()"

    /* ---------- 30 רשימת קריאה אופליין ---------- */

    data class Saved(val id: String, val url: String, val title: String, val site: String, val at: Long, val mins: Int, val read: Boolean = false)

    const val SAVED_MAX = 300

    fun savedEncode(l: List<Saved>): String = JSONArray().apply {
        l.forEach { put(JSONObject().put("i", it.id).put("u", it.url).put("t", it.title).put("s", it.site).put("a", it.at).put("m", it.mins).apply { if (it.read) put("r", true) }) }
    }.toString()
    fun savedDecode(s: String?): List<Saved> = runCatching {
        val a = JSONArray(s ?: return emptyList())
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            Saved(o.optString("i"), o.optString("u"), o.optString("t"), o.optString("s"), o.optLong("a"), o.optInt("m", 1), o.optBoolean("r")).takeIf { it.id.isNotEmpty() && it.url.startsWith("http") }
        } }
    }.getOrDefault(emptyList())

    /** שמירה לרשימה: אותו דף (pageKey) — מתעדכן ועולה לראש, לא נכפל; הישנים יוצאים מעבר לתקרה (מחזיר גם את מה שיצא — למחוק את הקבצים) */
    fun savedAdd(l: List<Saved>, s: Saved): Pair<List<Saved>, List<Saved>> {
        val k = pageKey(s.url)
        val old = l.firstOrNull { pageKey(it.url) == k }
        val all = listOf(if (old != null) s.copy(id = old.id) else s) + l.filter { pageKey(it.url) != k }
        return all.take(SAVED_MAX) to all.drop(SAVED_MAX)
    }

    /* ---------- 32 הערות והדגשות על אתרים ---------- */

    /** text = הקטע המודגש (ריק = הערה לדף כולו), color = מספר ב־COLORS */
    data class Mark(val id: String, val url: String, val title: String, val text: String, val note: String, val color: Int, val at: Long)

    val COLORS = listOf(0xFFFFE066.toInt(), 0xFF9BE59B.toInt(), 0xFF8EC9FF.toInt(), 0xFFFFA8C8.toInt())
    const val MARKS_MAX = 2000

    /** הכתובת "של הדף": בלי #, ובלי פרמטרים של מעקב (utm_*, fbclid, gclid…) — אותו מאמר מקישורים שונים = אותו דף */
    fun pageKey(url: String): String {
        val u = url.substringBefore('#')
        val q = u.substringAfter('?', "")
        val base = u.substringBefore('?').trimEnd('/')
        val keep = q.split('&').filter { p -> p.isNotEmpty() && p.substringBefore('=').lowercase().let { n -> !n.startsWith("utm_") && n !in TRACK } }
        return base.replaceFirst("://www.", "://") + if (keep.isEmpty()) "" else "?" + keep.joinToString("&")
    }
    private val TRACK = setOf("fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref_src", "_ga", "yclid", "si")

    fun marksEncode(l: List<Mark>): String = JSONArray().apply {
        l.forEach { put(JSONObject().put("i", it.id).put("u", it.url).put("h", it.title).put("t", it.text).put("n", it.note).put("c", it.color).put("a", it.at)) }
    }.toString()
    fun marksDecode(s: String?): List<Mark> = runCatching {
        val a = JSONArray(s ?: return emptyList())
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            Mark(o.optString("i"), o.optString("u"), o.optString("h"), o.optString("t"), o.optString("n"), o.optInt("c").coerceIn(0, COLORS.size - 1), o.optLong("a"))
                .takeIf { it.id.isNotEmpty() && (it.text.isNotEmpty() || it.note.isNotEmpty()) }
        } }
    }.getOrDefault(emptyList())

    fun forPage(l: List<Mark>, url: String): List<Mark> { val k = pageKey(url); return l.filter { pageKey(it.url) == k } }

    /** הדפים שיש בהם הערות/הדגשות — מהחדש לישן, עם מספר */
    fun pages(l: List<Mark>): List<Pair<Mark, Int>> = l.groupBy { pageKey(it.url) }.values.map { g -> g.maxBy { it.at } to g.size }.sortedByDescending { it.first.at }

    private fun hex(c: Int) = String.format("#%06X", c and 0xFFFFFF)

    /**
     * אוסף צמתי הטקסט של הדף עם מפה מהטקסט המנורמל (רווח אחד) למקום האמיתי — כך מוצאים קטע שנבחר גם כשהרווחים בדף שונים,
     * ועוטפים כל חלק שלו ב־mark (גם כשהקטע עובר בין כמה רכיבים).
     */
    private const val MARK_FN = """function __snbNodes(){var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentElement;if(!p)return 2;var t=p.tagName;return t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||t==='TEXTAREA'?2:1}}),s='',m=[],n,sp=true;
while(n=w.nextNode()){var v=n.nodeValue;for(var i=0;i<v.length;i++){var c=v.charCodeAt(i),ws=c===32||c===10||c===9||c===13||c===160;if(ws){if(sp)continue;s+=' ';sp=true}else{s+=v[i];sp=false}m.push([n,i])}}return{s:s,m:m}}
function __snbWrap(r,id,col){var root=r.commonAncestorContainer;if(root.nodeType===3)root=root.parentNode;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),ns=[],n;
while(n=w.nextNode()){if(r.intersectsNode(n))ns.push(n)}
ns.forEach(function(n){var a=n===r.startContainer?r.startOffset:0,b=n===r.endContainer?r.endOffset:n.nodeValue.length;if(b<=a||!n.nodeValue.slice(a,b).trim())return;
var x=n;if(a>0)x=x.splitText(a);if(b-a<x.nodeValue.length)x.splitText(b-a);var k=document.createElement('mark');k.setAttribute('data-snb',id);k.style.cssText='background:'+col+';color:inherit;border-radius:2px;padding:0';x.parentNode.insertBefore(k,x);k.appendChild(x)})}"""

    /** הדגשת הבחירה עכשיו: מחזיר את הטקסט המנורמל ("" = אין בחירה) */
    fun markSelJs(id: String, color: Int): String = """(function(){$MARK_FN
try{var s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return '';var t=String(s).replace(/\s+/g,' ').trim();if(!t)return '';
__snbWrap(s.getRangeAt(0),${JSONObject.quote(id)},'${hex(COLORS[color.coerceIn(0, COLORS.size - 1)])}');s.removeAllRanges();return t.slice(0,4000)}catch(e){return ''}})()"""

    /** ההדגשות השמורות של הדף — חוזרות בכל ביקור (גם בדף שנבנה אחרי הטעינה: ניסיון שני אחרי שתי שניות). מה שכבר מסומן — לא נעטף שוב */
    fun applyJs(l: List<Mark>): String {
        val a = JSONArray(); l.filter { it.text.isNotEmpty() }.forEach { a.put(JSONArray().put(it.id).put(it.text).put(hex(COLORS[it.color]))) }
        return """(function(L){$MARK_FN
function run(){var d=null;L.forEach(function(x){if(document.querySelector('mark[data-snb="'+x[0]+'"]'))return;d=d||__snbNodes();var i=d.s.indexOf(x[1]);if(i<0)return;
var A=d.m[i],B=d.m[i+x[1].length-1];if(!A||!B)return;var r=document.createRange();try{r.setStart(A[0],A[1]);r.setEnd(B[0],B[1]+1);__snbWrap(r,x[0],x[2]);d=null}catch(e){}})}
try{run();setTimeout(run,2000)}catch(e){}})($a)"""
    }

    /** הסרת הדגשה מהדף (הטקסט נשאר) */
    fun unmarkJs(id: String): String = "(function(){document.querySelectorAll('mark[data-snb='+${JSONObject.quote(JSONObject.quote(id))}+']').forEach(function(k){var p=k.parentNode;while(k.firstChild)p.insertBefore(k.firstChild,k);p.removeChild(k);p.normalize()})})()"

    /** גלילה להדגשה בדף */
    fun gotoJs(id: String): String = "(function(){var k=document.querySelector('mark[data-snb='+${JSONObject.quote(JSONObject.quote(id))}+']');if(k)k.scrollIntoView({block:'center',behavior:'smooth'})})()"

    /* ---------- 33 חיפוש בתוכן ההיסטוריה ---------- */

    data class Doc(val url: String, val title: String, val text: String, val at: Long)
    data class Hit(val doc: Doc, val score: Int, val snip: String)

    const val DOCS_MAX = 400
    const val DOC_TEXT = 5000

    /** הטקסט של הדף לאינדקס — הנראה בלבד, עד 8000 תווים (נחתך ל־DOC_TEXT אחרי הניקוי) */
    const val TEXT_JS = "(function(){try{return (document.body&&document.body.innerText||'').slice(0,8000)}catch(e){return ''}})()"

    /** נרמול לחיפוש: אותיות קטנות, בלי ניקוד וטעמים, רווח אחד */
    fun norm(s: String): String = s.lowercase().replace(Regex("[֑-ׇ]"), "").replace(Regex("\\s+"), " ").trim()
    fun tokens(q: String): List<String> = norm(q).split(' ').map { it.trim('"', '\'', ',', '.', ':', ';', '?', '!', '(', ')') }.filter { it.length >= 2 }.distinct()

    /** דף לאינדקס: אותו דף (pageKey) מתחלף, החדש ראשון, תקרה DOCS_MAX */
    fun indexAdd(l: List<Doc>, d: Doc): List<Doc> {
        val txt = d.text.replace(Regex("\\s+"), " ").trim().take(DOC_TEXT)
        if (txt.length < 40) return l
        val k = pageKey(d.url)
        return (listOf(d.copy(text = txt, title = d.title.take(300))) + l.filter { pageKey(it.url) != k }).take(DOCS_MAX)
    }

    /**
     * חיפוש: כל המילים חייבות להופיע (בכותרת, בכתובת או בטקסט). ציון — מילה בכותרת ×5, כל הופעה בטקסט (עד 5), והביטוי המלא ×8;
     * קטע להצגה סביב ההופעה הראשונה. alive = הכתובות שעדיין בהיסטוריה (מה שנמחק מההיסטוריה — לא נמצא)
     */
    fun search(l: List<Doc>, q: String, alive: Set<String>? = null, max: Int = 40): List<Hit> {
        val ts = tokens(q); if (ts.isEmpty()) return emptyList()
        val phrase = norm(q)
        return l.asSequence().filter { alive == null || pageKey(it.url) in alive }.mapNotNull { d ->
            val ti = norm(d.title); val tx = norm(d.text); val u = d.url.lowercase()
            if (!ts.all { ti.contains(it) || tx.contains(it) || u.contains(it) }) return@mapNotNull null
            var sc = ts.sumOf { t -> (if (ti.contains(t)) 5 else 0) + minOf(5, count(tx, t)) }
            if (ts.size > 1 && (tx.contains(phrase) || ti.contains(phrase))) sc += 8
            Hit(d, sc, snippet(d.text, ts))
        }.sortedWith(compareByDescending<Hit> { it.score }.thenByDescending { it.doc.at }).take(max).toList()
    }

    private fun count(s: String, t: String): Int { var n = 0; var i = s.indexOf(t); while (i >= 0 && n < 50) { n++; i = s.indexOf(t, i + t.length) }; return n }

    /** קטע של כ־len תווים סביב המילה הראשונה שנמצאה, עם … בקצוות; המיקום — בטקסט המקורי (בלי לשבור מילה) */
    fun snippet(text: String, ts: List<String>, len: Int = 150): String {
        val s = text.replace(Regex("\\s+"), " ").trim()
        val low = norm(s)
        // אחרי הסרת הניקוד המיקומים זזים — מחפשים בגרסה בלי ניקוד בלבד כשאין בטקסט ניקוד
        val src = if (low.length == s.length) s else low
        val i = ts.map { low.indexOf(it) }.filter { it >= 0 }.minOrNull() ?: return src.take(len)
        var a = maxOf(0, i - len / 3); var b = minOf(src.length, a + len)
        if (a > 0) src.indexOf(' ', a).takeIf { it in a until i }?.let { a = it + 1 }
        if (b < src.length) src.lastIndexOf(' ', b).takeIf { it > i }?.let { b = it }
        return (if (a > 0) "…" else "") + src.substring(a, b).trim() + (if (b < src.length) "…" else "")
    }

    fun docsEncode(l: List<Doc>): String = JSONArray().apply { l.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("x", it.text).put("a", it.at)) } }.toString()
    fun docsDecode(s: String?): List<Doc> = runCatching {
        val a = JSONArray(s ?: return emptyList())
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o -> Doc(o.optString("u"), o.optString("t"), o.optString("x"), o.optLong("a")).takeIf { it.url.startsWith("http") } } }
    }.getOrDefault(emptyList())

    /* ---------- 34 היסטוריה לפי נושאים ---------- */

    data class Topic(val name: String, val visits: List<BrVisit>)

    private val STOP = setOf(
        "the", "and", "for", "with", "from", "that", "this", "you", "your", "are", "was", "how", "what", "why", "who", "new", "all", "not", "but", "can",
        "has", "have", "will", "about", "more", "home", "page", "official", "site", "online", "free", "best", "news", "video", "videos", "login", "search", "www", "com",
        "של", "את", "על", "עם", "לא", "זה", "הוא", "היא", "גם", "או", "כל", "מה", "אם", "אבל", "יותר", "בין", "אחרי", "לפני", "כמו", "רק", "עוד", "כי",
        "דף", "הבית", "אתר", "חדשות", "וידאו", "סרטון", "חיפוש", "google", "youtube")

    /** מילים מהכותרת: 3 אותיות ומעלה, בלי מילות קישור ובלי מספרים; "ה" בתחילת מילה עברית ארוכה יורדת (הבחירות = בחירות) */
    fun words(title: String): List<String> = norm(title).split(Regex("[^\\p{L}\\p{N}]+")).asSequence()
        .map { w -> if (w.length >= 5 && w[0] == 'ה' && w[1] in 'א'..'ת') w.substring(1) else w }
        .filter { it.length >= 3 && it !in STOP && !it.all { c -> c.isDigit() } }.distinct().toList()

    /**
     * קיבוץ הביקורים לנושאים (משלנו, בלי מודל): כל פעם המילה שמופיעה בהכי הרבה ביקורים שעוד לא שובצו (לפחות minN) — נושא;
     * מה שנשאר — לפי האתר (לפחות minN); השאר — "אחר" (name ריק). ביקור באותו דף פעמיים נספר פעם אחת.
     */
    fun topics(visits: List<BrVisit>, max: Int = 12, minN: Int = 3): List<Topic> {
        val uniq = visits.sortedByDescending { it.at }.distinctBy { pageKey(it.url) }
        val kw = uniq.associateWith { v -> words(v.title) }
        val left = uniq.toMutableList()
        val out = ArrayList<Topic>()
        while (out.size < max) {
            val freq = HashMap<String, Int>()
            left.forEach { v -> kw[v]!!.forEach { w -> freq[w] = (freq[w] ?: 0) + 1 } }
            val (w, n) = freq.entries.maxWithOrNull(compareBy<Map.Entry<String, Int>> { it.value }.thenBy { it.key.length })?.toPair() ?: break
            if (n < minN) break
            val g = left.filter { w in kw[it]!! }
            out += Topic(w, g); left.removeAll(g.toSet())
        }
        left.groupBy { host(it.url) }.filter { it.value.size >= minN && it.key.isNotEmpty() }.entries.sortedByDescending { it.value.size }
            .take(maxOf(0, max - out.size)).forEach { (h, g) -> out += Topic(h, g); left.removeAll(g.toSet()) }
        if (left.isNotEmpty()) out += Topic("", left)
        return out
    }

    /** המארח בלי www (בלי Uri של אנדרואיד — הבדיקות ב־JVM) */
    fun host(url: String): String = url.substringAfter("://", "").substringBefore('/').substringBefore('?').substringBefore('#').substringAfterLast('@').substringBefore(':').lowercase().removePrefix("www.")

    /* ---------- 57 הורדת כל הקבצים בדף ---------- */

    /** d מסמך, a שמע, v וידאו, i תמונה, z ארכיון, o אחר (apk, iso, כתוביות…) */
    data class FileLink(val url: String, val name: String, val ext: String, val cat: Char)

    private val EXT = mapOf(
        'd' to setOf("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "csv", "epub", "mobi"),
        'a' to setOf("mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"),
        'v' to setOf("mp4", "m4v", "mkv", "webm", "mov", "avi", "wmv", "flv", "3gp"),
        'i' to setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff"),
        'z' to setOf("zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"),
        'o' to setOf("apk", "iso", "exe", "msi", "dmg", "srt", "vtt", "ass", "torrent", "json", "xml"))
    val CATS = listOf('d', 'a', 'v', 'i', 'z', 'o')

    /** כל הקישורים בדף (a[href] עם הטקסט שלהם, ו־a[download]) — הסינון לפי הסיומת כאן */
    const val FILES_JS = """(function(){try{var o=[],s=new Set();document.querySelectorAll('a[href]').forEach(function(a){if(o.length>=3000)return;var h=a.href;if(!h||s.has(h))return;s.add(h);
o.push([h,(a.getAttribute('download')||a.innerText||a.title||'').replace(/\s+/g,' ').trim().slice(0,120),a.hasAttribute('download')?1:0])});return JSON.stringify(o)}catch(e){return '[]'}})()"""

    fun extOf(url: String): String {
        val p = url.substringBefore('#').substringBefore('?').substringAfterLast('/')
        val e = p.substringAfterLast('.', "").lowercase()
        return if (e.length in 2..8 && e.all { it.isLetterOrDigit() }) e else ""
    }
    fun catOf(ext: String): Char? = EXT.entries.firstOrNull { ext in it.value }?.key

    /** הקבצים בדף: http(s) בלבד, לפי סיומת מוכרת (או download), בלי כפילויות; השם — מהקישור (אם יש בו סיומת) או מהכתובת */
    fun files(raw: String?): List<FileLink> = runCatching {
        val a = JSONArray(BrDev.unquote(raw).ifEmpty { "[]" })
        val seen = HashSet<String>()
        (0 until a.length()).mapNotNull { i ->
            val p = a.optJSONArray(i) ?: return@mapNotNull null
            val u = p.optString(0); if (!u.startsWith("http://") && !u.startsWith("https://")) return@mapNotNull null
            val key = u.substringBefore('#'); if (!seen.add(key)) return@mapNotNull null
            val text = p.optString(1); val dl = p.optInt(2) == 1
            val e = extOf(u).ifEmpty { if (dl) extOf(text) else "" }
            val cat = catOf(e) ?: if (dl) 'o' else return@mapNotNull null
            val fromUrl = runCatching { java.net.URLDecoder.decode(u.substringBefore('#').substringBefore('?').substringAfterLast('/'), "UTF-8") }.getOrDefault("")
            val name = (if (extOf(text) == e && e.isNotEmpty()) text else fromUrl.ifEmpty { text }).replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().take(120).ifEmpty { "file.$e" }
            FileLink(key, name, e, cat)
        }
    }.getOrDefault(emptyList())

    /* ---------- 49 בקרת מדיה כללית ---------- */

    /** המצב של המדיה בדף: כמה רכיבים, אם משהו מתנגן, אם מושתק. cmd: "" = רק מצב, play / pause / mute / unmute */
    fun mediaJs(cmd: String): String = """(function(c){try{var m=[].slice.call(document.querySelectorAll('video,audio'));
if(c==='pause')m.forEach(function(e){e.pause()});if(c==='play'){var e=m.filter(function(x){return x.currentTime>0&&!x.ended})[0]||m[0];if(e)e.play()}
if(c==='mute'||c==='unmute')m.forEach(function(e){e.muted=c==='mute'});
var p=m.some(function(e){return !e.paused&&!e.ended&&e.readyState>2});return JSON.stringify({n:m.length,p:p,m:m.length>0&&m.every(function(e){return e.muted})})}catch(e){return '{"n":0}'}})(${JSONObject.quote(cmd)})"""

    data class MediaState(val n: Int, val playing: Boolean, val muted: Boolean)
    fun mediaParse(r: String?): MediaState = runCatching { JSONObject(BrDev.unquote(r)).let { MediaState(it.optInt("n"), it.optBoolean("p"), it.optBoolean("m")) } }.getOrDefault(MediaState(0, false, false))

    /* ---------- 53 צילום פריים וקליפ ---------- */

    /**
     * הסרטון הגדול שעל המסך: המקום שלו (בפיקסלים של CSS, יחסית לחלון) ויחס הפיקסלים; ותמונה מהסרטון עצמו ברזולוציה המלאה (canvas) —
     * באתר שלא מרשה (סרטון מאתר אחר בלי CORS / DRM) d ריק, ואז מצלמים את המסך באותו מקום (PixelCopy).
     */
    const val FRAME_JS = """(function(){try{var v=[].slice.call(document.querySelectorAll('video')).filter(function(x){var r=x.getBoundingClientRect();return r.width>40&&r.height>40&&x.readyState>=2})
.sort(function(a,b){var p=a.getBoundingClientRect(),q=b.getBoundingClientRect();return q.width*q.height-p.width*p.height})[0];if(!v)return '';
var r=v.getBoundingClientRect(),d='';try{var c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);d=c.toDataURL('image/png')}catch(e){d=''}
return JSON.stringify({x:r.left,y:r.top,w:r.width,h:r.height,r:devicePixelRatio||1,t:v.currentTime,d:d})}catch(e){return ''}})()"""

    data class Frame(val x: Float, val y: Float, val w: Float, val h: Float, val dpr: Float, val time: Double, val png: ByteArray?)
    fun frameParse(r: String?): Frame? = runCatching {
        val o = JSONObject(BrDev.unquote(r).ifEmpty { return null })
        val d = o.optString("d")
        val png = if (d.startsWith("data:image/png;base64,")) java.util.Base64.getDecoder().decode(d.substringAfter(',')) else null
        Frame(o.optDouble("x").toFloat(), o.optDouble("y").toFloat(), o.optDouble("w").toFloat(), o.optDouble("h").toFloat(), o.optDouble("r", 1.0).toFloat(), o.optDouble("t"), png?.takeIf { it.size > 2000 })
    }.getOrNull()

    /**
     * קליפ: MediaRecorder על captureStream של הסרטון (התמונה והקול כמו שהם מתנגנים), sec שניות, WebM. החלקים חוזרים בערוץ הכלים
     * ("c:" + base64, "c:." בסוף, "c:!" כשהאתר לא מרשה) — מתקבלים רק כשהקליפ פעיל בכרטיסייה הזו (BrowserActivity.onTool)
     */
    fun clipJs(sec: Int): String = """(function(S){try{var v=[].slice.call(document.querySelectorAll('video')).filter(function(x){return x.readyState>=2}).sort(function(a,b){return b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight})[0];
if(!v){snbTool.postMessage('c:!');return}var st=(v.captureStream||v.mozCaptureStream).call(v);var mt=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].filter(function(t){return MediaRecorder.isTypeSupported(t)})[0]||'';
var rec=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:2500000}),parts=[];window.__snbClip=rec;
rec.ondataavailable=function(e){if(e.data&&e.data.size)parts.push(e.data)};
rec.onerror=function(){snbTool.postMessage('c:!')};
rec.onstop=function(){window.__snbClip=null;var b=new Blob(parts,{type:'video/webm'});if(!b.size){snbTool.postMessage('c:!');return}var fr=new FileReader();fr.onload=function(){var s=String(fr.result),i=s.indexOf(',')+1,N=393216;
for(var k=i;k<s.length;k+=N)snbTool.postMessage('c:'+s.slice(k,k+N));snbTool.postMessage('c:.')};fr.readAsDataURL(b)};
if(v.paused)v.play();rec.start(1000);setTimeout(function(){if(rec.state!=='inactive')rec.stop()},S*1000)}catch(e){snbTool.postMessage('c:!')}})($sec)"""
    const val CLIP_STOP_JS = "(function(){var r=window.__snbClip;if(r&&r.state!=='inactive')r.stop()})()"
    val CLIP_SECS = listOf(5, 10, 30)
    /** תקרה לקליפ (בייטים של base64) — כ־20MB של וידאו */
    const val CLIP_MAX = 28 * 1024 * 1024

    /* ---------- 54 צילום הדף המלא ---------- */

    /** צעד בצילום: לגלול ל־y, ומהמסך לקחת את השורות top..top+h (הכל בפיקסלים של CSS) */
    data class Shot(val y: Int, val top: Int, val h: Int)

    /**
     * מתכננים את הצילומים: גלילה בקפיצות של מסך, והאחרון — עד הסוף בדיוק (רק החלק שעוד לא צולם). עד maxScreens מסכים
     * (דף אינסופי נחתך) — sh גובה הדף, vh גובה החלון
     */
    fun shots(sh: Int, vh: Int, maxScreens: Int = 25): List<Shot> {
        if (vh <= 0) return emptyList()
        val total = minOf(maxOf(sh, vh), vh * maxScreens)
        val out = ArrayList<Shot>()
        var y = 0
        while (y < total) {
            val h = minOf(vh, total - y)
            if (h < vh && y + vh <= sh) out += Shot(y, 0, h)          // דף שנחתך בתקרה — מהחלק העליון של המסך
            else if (h < vh) out += Shot(maxOf(0, sh - vh), vh - h, h) // הסוף של הדף: גוללים עד הסוף, והחלק החדש בתחתית המסך
            else out += Shot(y, 0, h)
            y += h
        }
        return out
    }

    /** מידות הדף לצילום */
    const val PAGE_DIM_JS = "(function(){var d=document.documentElement,b=document.body;return JSON.stringify({h:Math.max(d.scrollHeight,b?b.scrollHeight:0),v:innerHeight,y:scrollY})})()"
    /** בצילומים שאחרי הראשון — מסתירים את מה שקבוע על המסך (כותרת דביקה, באנר), כדי שלא יחזור בכל חתיכה; 0 = מחזירים */
    fun fixedJs(hide: Boolean): String = if (hide)
        "(function(){var l=[];document.querySelectorAll('body *').forEach(function(e){var p=getComputedStyle(e).position;if(p==='fixed'||p==='sticky'){l.push([e,e.style.visibility]);e.style.visibility='hidden'}});window.__snbFx=l})()"
    else "(function(){(window.__snbFx||[]).forEach(function(x){x[0].style.visibility=x[1]});window.__snbFx=null})()"
    fun scrollJs(y: Int) = "(function(){window.scrollTo(0,$y);return scrollY})()"

    /* ---------- 55 PDF נקי ---------- */

    /** כשאין מאמר (דף שאינו כתבה) — מדפיסים את הדף עצמו, בלי מה שלא שייך לנייר: תפריטים, פרסומות, כפתורים צפים, iframe */
    const val PRINT_CLEAN_JS = """(function(){var s=document.getElementById('__snbPrint');if(s)return;s=document.createElement('style');s.id='__snbPrint';
s.textContent='@media print{nav,aside,footer,iframe,video,audio,form,[role=navigation],[role=banner],[role=complementary],[class*=advert],[id*=advert],[class*=cookie],[class*=banner],[class*=share],[class*=social]{display:none!important}*{position:static!important;box-shadow:none!important}body{background:#fff!important}}';
document.head.appendChild(s)})()"""

    /** שם קובץ בטוח מהכותרת (ל־PDF, לצילום ולקליפ) */
    fun fileName(title: String, ext: String, now: Long): String {
        val base = title.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), " ").replace(Regex("\\s+"), " ").trim().take(60).ifEmpty { "Studio Browser" }
        val ts = java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.US).format(java.util.Date(now))
        return "$base $ts.$ext"
    }

    /* ---------- 51 חלון צף לחלק מהדף ---------- */

    /**
     * בחלון הצף נטען אותו דף ב־WebView נפרד, ומשאירים רק את הרכיב שנבחר: כל השאר מוסתר, והרכיב ממלא את החלון.
     * דף שנבנה אחרי הטעינה — מחכים לרכיב עד 15 שניות. כך החלק חי (מתעדכן) גם כשגוללים או עוברים כרטיסייה.
     */
    fun isolateJs(sel: String): String = """(function(S){var n=0;function go(){var e=null;try{e=document.querySelector(S)}catch(x){return}if(!e){if(n++<30)setTimeout(go,500);return}
var keep=new Set();for(var x=e;x;x=x.parentElement)keep.add(x);
for(var x=e;x&&x!==document.documentElement;x=x.parentElement){var p=x.parentElement;if(!p)break;[].forEach.call(p.children,function(c){if(!keep.has(c)&&c.tagName!=='SCRIPT'&&c.tagName!=='STYLE'&&c.tagName!=='LINK')c.style.setProperty('display','none','important')})}
keep.forEach(function(k){if(k!==e&&k!==document.documentElement){k.style.setProperty('margin','0','important');k.style.setProperty('padding','0','important');k.style.setProperty('transform','none','important')}});
e.style.setProperty('position','fixed','important');e.style.setProperty('inset','0','important');e.style.setProperty('width','100%','important');e.style.setProperty('height','100%','important');
e.style.setProperty('max-width','none','important');e.style.setProperty('z-index','2147483646','important');e.style.setProperty('overflow','auto','important');e.style.setProperty('margin','0','important')}
go()})(${JSONObject.quote(sel)})"""

    /* ---------- הקבצים (בתיקייה של המשתמש) ---------- */

    /** קריאה וכתיבה אטומית (tmp → rename) — כמו BrStore */
    fun readFile(dir: File, name: String): String? = runCatching { File(dir, name).takeIf { it.exists() }?.readText() }.getOrNull()
    fun writeFile(dir: File, name: String, s: String) {
        runCatching {
            dir.mkdirs()
            val tmp = File(dir, "$name.tmp"); tmp.writeText(s)
            if (!tmp.renameTo(File(dir, name))) { File(dir, name).delete(); tmp.renameTo(File(dir, name)) }
        }
    }
    /** המאמרים של רשימת הקריאה — קובץ לכל אחד ב־read/ */
    fun articleFile(dir: File, id: String) = File(File(dir, "read"), id.filter { it.isLetterOrDigit() } + ".json")
}
