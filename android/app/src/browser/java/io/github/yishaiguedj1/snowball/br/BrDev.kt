package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject

/**
 * Studio Browser Pro — הגל השלישי (01/11/2026, docs/browser-pro-plan.md): כלי מפתחים ושליטה באתר.
 * רק לוגיקה טהורה וסקריפטים לדף — בלי אנדרואיד (נבדק ב־BrDevTest ב־JVM). החיבור לפעילות — BrowserActivity ("הגל השלישי").
 * בנייה נקייה: הכל נכתב כאן מאפס, לפי ההתנהגות (ת־עיצוב של כלי המפתחים במחשב), בלי קוד של מנהלי סקריפטים או תוספים קיימים.
 */
object BrDev {

    /** הערוץ היחיד מהדף אלינו (addWebMessageListener, מסגרת ראשית): "p:" רכיב שנבחר, "z:" רכיב שנמחק, "r:" צעד שהוקלט, "q:" צעד שהוצג */
    const val CH = "snbTool"

    /* ---------- 4 עוגיות ואחסון ---------- */

    data class Cookie(val name: String, val value: String?, val httpOnly: Boolean)

    /** "a=1; b=2" → זוגות (ערך ריק מותר; שם ריק — לא) */
    fun parseCookies(s: String?): List<Pair<String, String>> = (s ?: "").split(';').mapNotNull { p ->
        val t = p.trim(); if (t.isEmpty()) return@mapNotNull null
        val i = t.indexOf('=')
        val n = (if (i < 0) t else t.substring(0, i)).trim(); if (n.isEmpty()) null else n to (if (i < 0) "" else t.substring(i + 1).trim())
    }

    /**
     * העוגיות של הדף: CookieManager.getCookie(url) רואה הכל (גם HttpOnly), document.cookie — רק מה שהדף עצמו רואה.
     * מה שיש רק בראשון = HttpOnly: מציגים את השם, **לא את הערך** (docs/browser-pro-plan.md, 4).
     */
    fun cookies(cm: String?, doc: String?): List<Cookie> {
        val seen = parseCookies(doc).toMap()
        val out = LinkedHashMap<String, Cookie>()
        parseCookies(cm).forEach { (n, v) -> if (n !in out) out[n] = if (n in seen) Cookie(n, v, false) else Cookie(n, null, true) }
        parseCookies(doc).forEach { (n, v) -> if (n !in out) out[n] = Cookie(n, v, false) }
        return out.values.sortedBy { it.name.lowercase() }
    }

    /** מחיקת עוגייה דרך CookieManager.setCookie — לא יודעים באיזה דומיין/נתיב נקבעה, אז מנסים את כל הצירופים הסבירים */
    fun expire(name: String, host: String): List<String> {
        val doms = buildList { add(""); var h = host; while (h.count { it == '.' } >= 1) { add("; domain=$h"); add("; domain=.$h"); h = h.substringAfter('.') } }
        return doms.flatMap { d -> listOf("/", "").map { p -> "$name=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${if (p.isEmpty()) "" else "; path=$p"}$d" } }
    }

    data class Storage(val local: List<Pair<String, String>>, val session: List<Pair<String, String>>, val idb: List<String>, val doc: String)

    /** אחסון הדף: localStorage, sessionStorage, ושמות מסדי IndexedDB (אסינכרוני — נשמרים בדף ונקראים בפעם הבאה) */
    const val STORAGE_JS = """(function(){function kv(s){var o=[];try{for(var i=0;i<s.length&&i<500;i++){var k=s.key(i);o.push([k,String(s.getItem(k)).slice(0,2000)])}}catch(e){}return o}
try{if(indexedDB.databases)indexedDB.databases().then(function(d){window.__snbIdb=d.map(function(x){return x.name})})}catch(e){}
var c='';try{c=document.cookie}catch(e){}
return JSON.stringify({l:kv(window.localStorage||{length:0}),s:kv(window.sessionStorage||{length:0}),i:window.__snbIdb||[],c:c})})()"""

    fun storageParse(r: String?): Storage? = runCatching {
        val o = JSONObject(unquote(r))
        fun kv(a: JSONArray?) = (0 until (a?.length() ?: 0)).mapNotNull { a!!.optJSONArray(it)?.let { p -> p.optString(0) to p.optString(1) } }
        val i = o.optJSONArray("i")
        Storage(kv(o.optJSONArray("l")), kv(o.optJSONArray("s")), (0 until (i?.length() ?: 0)).map { i!!.optString(it) }, o.optString("c"))
    }.getOrNull()

    /** מחיקת מפתח אחד (kind: l/s) או כל האחסון (key = null); i = מסד IndexedDB */
    fun delStorageJs(kind: Char, key: String?): String {
        val k = JSONObject.quote(key ?: "")
        return when (kind) {
            'i' -> "(function(){try{indexedDB.deleteDatabase($k);window.__snbIdb=(window.__snbIdb||[]).filter(function(n){return n!==$k})}catch(e){}})()"
            else -> { val s = if (kind == 's') "sessionStorage" else "localStorage"; if (key == null) "(function(){try{$s.clear()}catch(e){}})()" else "(function(){try{$s.removeItem($k)}catch(e){}})()" }
        }
    }

    /* ---------- 5 בדיקת רכיב · 63 מחיקת רכיב בנגיעה ---------- */

    const val PICK_INSPECT = 1
    const val PICK_ZAP = 2

    /** בורר CSS יציב לרכיב (id ייחודי, אחרת שרשרת tag:nth-of-type עד 6 רמות) — משותף לבחירה, למחיקה ולהקלטה */
    private const val SEL_FN = """function __snbSel(e){if(!e||e.nodeType!==1)return'';var p=[];while(e&&e.nodeType===1&&e!==document.documentElement&&p.length<6){
if(e.id&&document.querySelectorAll('#'+CSS.escape(e.id)).length===1){p.unshift('#'+CSS.escape(e.id));break}
var t=e.tagName.toLowerCase(),i=1,s=e;while((s=s.previousElementSibling))if(s.tagName===e.tagName)i++;
var n=0,q=e.parentElement?e.parentElement.children:[];for(var j=0;j<q.length;j++)if(q[j].tagName===e.tagName)n++;
p.unshift(n>1?t+':nth-of-type('+i+')':t);e=e.parentElement}return p.join(' > ')}"""

    /**
     * מצב בחירה בדף: המסגרת עוקבת אחרי האצבע; נגיעה = הרכיב (לא לוחצים עליו בפועל).
     * בדיקה (1) — מדווחת ויוצאת; מחיקה (2) — מסתירה ונשארת עד "סיום". mode 0 = יציאה.
     */
    fun pickJs(mode: Int): String = """(function(m){$SEL_FN
var o=window.__snbPk;if(o){o.off();window.__snbPk=null}if(!m)return;
var b=document.createElement('div');b.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #FF4656;background:rgba(255,70,86,.14);border-radius:4px;display:none;box-sizing:border-box';
document.documentElement.appendChild(b);
function at(ev){var x=ev.touches&&ev.touches[0]||ev;return document.elementFromPoint(x.clientX,x.clientY)}
function show(e){if(!e||e===b)return;var r=e.getBoundingClientRect();b.style.display='block';b.style.left=r.left+'px';b.style.top=r.top+'px';b.style.width=r.width+'px';b.style.height=r.height+'px'}
function mv(ev){show(at(ev))}
function info(e){var cs=getComputedStyle(e),r=e.getBoundingClientRect(),st={};['display','position','color','background-color','font-size','font-family','font-weight','margin','padding','border','z-index'].forEach(function(k){st[k]=cs.getPropertyValue(k)});
return JSON.stringify({s:__snbSel(e),t:e.tagName.toLowerCase(),w:Math.round(r.width),h:Math.round(r.height),x:e.outerHTML.slice(0,4000),st:st})}
function tap(ev){var e=at(ev);if(!e||e===b)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation&&ev.stopImmediatePropagation();
if(m===1){snbTool.postMessage('p:'+info(e));off()}else{var s=__snbSel(e);e.style.setProperty('display','none','important');b.style.display='none';snbTool.postMessage('z:'+s)}}
function blk(ev){ev.preventDefault();ev.stopPropagation()}
function off(){removeEventListener('pointermove',mv,true);removeEventListener('pointerdown',mv,true);removeEventListener('click',tap,true);removeEventListener('mousedown',blk,true);removeEventListener('mouseup',blk,true);b.remove();window.__snbPk=null}
addEventListener('pointermove',mv,true);addEventListener('pointerdown',mv,true);addEventListener('click',tap,true);addEventListener('mousedown',blk,true);addEventListener('mouseup',blk,true);
window.__snbPk={off:off}})($mode)"""

    data class Picked(val sel: String, val tag: String, val w: Int, val h: Int, val html: String, val styles: List<Pair<String, String>>)

    fun pickedParse(s: String): Picked? = runCatching {
        val o = JSONObject(s); val st = o.optJSONObject("st")
        Picked(o.optString("s"), o.optString("t"), o.optInt("w"), o.optInt("h"), o.optString("x"),
            st?.keys()?.asSequence()?.map { it to st.optString(it) }?.filter { it.second.isNotEmpty() }?.toList() ?: emptyList())
    }.getOrNull()?.takeIf { it.sel.isNotEmpty() }

    /** "תמיד באתר הזה": בוררים מוסתרים לכל אתר — "host\tsel1\u001fsel2" בכל שורה (בורר לא מכיל טאב/ירידת שורה) */
    const val ZAPS_MAX = 60
    fun zapsEncode(m: Map<String, List<String>>): String = m.filter { it.value.isNotEmpty() && okHost(it.key) }
        .entries.joinToString("\n") { (h, l) -> h + "\t" + l.map { clean(it) }.filter { it.isNotEmpty() }.distinct().take(ZAPS_MAX).joinToString("\u001f") }
    fun zapsDecode(s: String?): Map<String, List<String>> = (s ?: "").split('\n').mapNotNull { line ->
        val h = line.substringBefore('\t'); val l = line.substringAfter('\t', "").split('\u001f').map { clean(it) }.filter { it.isNotEmpty() }
        if (okHost(h) && l.isNotEmpty()) h to l else null
    }.toMap()
    private fun clean(sel: String) = sel.replace(Regex("[\\t\\n\\r\\u001f{}<]"), "").trim().take(400)
    private fun okHost(h: String) = h.isNotEmpty() && h.length <= 253 && h.all { it.isLetterOrDigit() || it == '.' || it == '-' }

    /** הסתרה של הבוררים — <style> אחד שמתעדכן (גם כשהדף מוסיף את הרכיב אחר כך) */
    fun hideJs(sels: List<String>): String {
        val css = sels.map { clean(it) }.filter { it.isNotEmpty() }.joinToString(",") + "{display:none!important}"
        return "(function(){var s=document.getElementById('__snbZap');if(!s){s=document.createElement('style');s.id='__snbZap';(document.head||document.documentElement).appendChild(s)}s.textContent=${JSONObject.quote(if (sels.isEmpty()) "" else css)}})()"
    }

    /* ---------- 6 קוד המקור ---------- */

    /** הקוד של הדף כפי שהוא עכשיו (אחרי הסקריפטים — לא מה שהשרת שלח; נאמר בחלון) */
    const val SOURCE_JS = "(function(){var d=document.doctype;return (d?'<!DOCTYPE '+d.name+'>\\n':'')+document.documentElement.outerHTML})()"

    /** התוצאה של evaluateJavascript היא JSON — מחרוזת במירכאות; "null"/ריק = ריק */
    fun unquote(r: String?): String {
        if (r.isNullOrEmpty() || r == "null" || r == "undefined") return ""
        return if (r.startsWith("\"")) runCatching { JSONArray("[$r]").getString(0) }.getOrDefault(r) else r
    }

    /** שורות עם מספרים לתצוגה (עד max שורות — דף ענק לא תוקע את הטלפון) */
    fun lines(src: String, max: Int = 4000): List<String> = src.split('\n').take(max).map { if (it.length > 600) it.take(600) + "…" else it }

    /* ---------- 7 התחזות למכשיר ---------- */

    /** id, תווית, ה־User-Agent (null = של הטלפון), desktop = תצוגת מחשב (viewport רחב) */
    data class Emu(val id: String, val he: String, val en: String, val ua: String?, val desktop: Boolean = false)
    val EMUS = listOf(
        Emu("", "הטלפון הזה", "This phone", null),
        Emu("ios", "iPhone", "iPhone",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"),
        Emu("ipad", "iPad", "iPad",
            "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"),
        Emu("tab", "טאבלט אנדרואיד", "Android tablet",
            "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
        Emu("win", "מחשב Windows", "Windows PC",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", desktop = true),
        Emu("mac", "מחשב Mac", "Mac",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15", desktop = true),
    )
    fun emu(id: String?): Emu = EMUS.firstOrNull { it.id == id } ?: EMUS[0]

    /* ---------- 8 עריכת הדף ---------- */

    fun editJs(on: Boolean) = "(function(){try{document.designMode='${if (on) "on" else "off"}'}catch(e){}})()"

    /* ---------- 9 דוח מהירות ---------- */

    /** המדדים מ־Performance API: ttfb|fcp|dcl|load|lcp|res|kb|dom|cls (ms, ‎-1 = לא ידוע). LCP/CLS — מהצופה שנרשם ב־PERF_START */
    const val PERF_JS = """(function(){var n=performance.getEntriesByType('navigation')[0]||{},f=-1;performance.getEntriesByType('paint').forEach(function(p){if(p.name==='first-contentful-paint')f=p.startTime});
var r=performance.getEntriesByType('resource'),kb=0;r.forEach(function(x){kb+=(x.transferSize||0)});kb+=(n.transferSize||0);
function v(x){return x>0?Math.round(x):-1}
return [v(n.responseStart),v(f),v(n.domContentLoadedEventEnd),v(n.loadEventEnd),v(window.__snbLcp||-1),r.length,Math.round(kb/1024),document.getElementsByTagName('*').length,Math.round((window.__snbCls||0)*1000)].join('|')})()"""

    /** נרשם לפני הדף (DOCUMENT_START_SCRIPT): הצביעה הגדולה וההזזות — לא נשלח לשום מקום, רק נשמר בדף לדוח */
    const val PERF_START = """(function(){try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__snbLcp=e.startTime})}).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)window.__snbCls=(window.__snbCls||0)+e.value})}).observe({type:'layout-shift',buffered:true})}catch(e){}})()"""

    data class Perf(val ttfb: Int, val fcp: Int, val dcl: Int, val load: Int, val lcp: Int, val res: Int, val kb: Int, val dom: Int, val cls: Int)

    fun perfParse(r: String?): Perf? {
        val p = unquote(r).split('|').map { it.toIntOrNull() ?: -1 }
        return if (p.size < 9) null else Perf(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8])
    }

    /** ספי "טוב / צריך שיפור / גרוע" — הספים המקובלים של מדדי הליבה (ms; CLS באלפיות) */
    val LIMITS = mapOf("ttfb" to (800 to 1800), "fcp" to (1800 to 3000), "lcp" to (2500 to 4000), "load" to (3000 to 6000), "cls" to (100 to 250))
    /** 0 טוב · 1 צריך שיפור · 2 גרוע · ‎-1 לא נמדד */
    fun grade(metric: String, v: Int): Int {
        if (v < 0) return -1
        val (g, p) = LIMITS[metric] ?: return -1
        return if (v <= g) 0 else if (v <= p) 1 else 2
    }

    /* ---------- 42 מה מותר לכל אתר · 44 כהה בכוח ---------- */

    /**
     * הפניה אוטומטית לאתר אחר (בלי נגיעה, לא הפניית שרת של קישור שנלחץ) — נחסמת כשבאתר כבית "הפניות".
     * אותו אתר (או תת־דומיין שלו) — תמיד מותר.
     */
    fun blockRedirect(allowed: Boolean, from: String, to: String, gesture: Boolean, serverRedirect: Boolean): Boolean {
        if (allowed || gesture || serverRedirect || from.isEmpty() || to.isEmpty()) return false
        fun base(h: String) = h.split('.').takeLast(if (h.endsWith(".co.il") || h.endsWith(".org.il") || h.endsWith(".co.uk")) 3 else 2).joinToString(".")
        return base(from) != base(to)
    }

    /** חלון קופץ: pop 1 = מותר תמיד, ‎-1 = חסום תמיד, 0 = רק אחרי נגיעה (ברירת המחדל) */
    fun popupOk(pop: Int, gesture: Boolean) = when (pop) { 1 -> true; -1 -> false; else -> gesture }

    /** כהה בכוח כשהאפליקציה בהירה (ה־WebView מכהה אלגוריתמית רק בערכת נושא כהה): היפוך צבעים, ותמונות/וידאו חוזרים */
    const val DARK_JS = """(function(){if(document.getElementById('__snbDark'))return;var s=document.createElement('style');s.id='__snbDark';
s.textContent='html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important}img,video,picture,canvas,iframe,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
(document.head||document.documentElement).appendChild(s)})()"""
    const val UNDARK_JS = "(function(){var s=document.getElementById('__snbDark');if(s)s.remove()})()"

    /* ---------- 65 מעקב אחרי שינוי בדף ---------- */

    /** every = שעות בין בדיקות; hash = של הטקסט האחרון; changed = מתי זוהה שינוי שעוד לא נראה (0 = אין) */
    data class Watch(val id: String, val url: String, val title: String, val every: Int, val hash: String = "", val at: Long = 0L,
                     val changed: Long = 0L, val diff: String = "")
    val EVERY = listOf(1, 6, 24)
    const val WATCH_MAX = 30

    fun watchEncode(l: List<Watch>): String = JSONArray().apply {
        l.forEach { w -> put(JSONObject().put("id", w.id).put("u", w.url).put("t", w.title).put("e", w.every).put("h", w.hash).put("a", w.at).put("c", w.changed).put("d", w.diff)) }
    }.toString()
    fun watchDecode(s: String?): List<Watch> = runCatching {
        val a = JSONArray(s ?: "[]")
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            Watch(o.optString("id"), o.optString("u"), o.optString("t"), o.optInt("e", 6).let { if (it in EVERY) it else 6 },
                o.optString("h"), o.optLong("a"), o.optLong("c"), o.optString("d")).takeIf { it.id.isNotEmpty() && it.url.startsWith("http") }
        } }
    }.getOrDefault(emptyList())

    /** הטקסט שהדף מציג (בלי סקריפטים, סגנונות ותגיות), שורה לכל בלוק — מה שמשווים בין בדיקה לבדיקה */
    fun pageText(html: String): String {
        var s = html.replace(Regex("(?is)<(script|style|noscript|template|svg)\\b.*?</\\1>"), " ")
            .replace(Regex("(?s)<!--.*?-->"), " ")
            .replace(Regex("(?i)<(br|/p|/div|/li|/h[1-6]|/tr|/section|/article)\\b[^>]*>"), "\n")
            .replace(Regex("<[^>]+>"), " ")
        s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
        return s.split('\n').map { it.replace(Regex("\\s+"), " ").trim() }.filter { it.isNotEmpty() }.joinToString("\n")
    }

    fun hash(s: String): String = java.security.MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).take(12).joinToString("") { "%02x".format(it) }

    /** מה השתנה — השורות החדשות הראשונות (עד 3, עד 240 תווים) */
    fun diff(old: String, new: String): String {
        val had = old.split('\n').toHashSet()
        return new.split('\n').filter { it !in had && it.length > 1 }.take(3).joinToString(" · ").take(240)
    }

    /** הבדיקה ב־Worker: האם עכשיו הזמן (every שעות מאז הבדיקה האחרונה, עם מרווח של 10 דק׳ — WorkManager לא מדויק) */
    fun due(w: Watch, now: Long) = now - w.at >= w.every * 3_600_000L - 10 * 60_000L

    /* ---------- 66 הקלטת פעולות ---------- */

    /** c = נגיעה, i = הקלדה/בחירה בשדה (ערך), n = מעבר לדף אחר (מחכים שייטען) */
    data class Step(val k: Char, val sel: String, val v: String = "")
    /** url = הדף שבו ההקלטה התחילה (ההרצה נטענת ממנו) */
    data class Macro(val id: String, val url: String, val name: String, val steps: List<Step>)
    const val MACROS_MAX = 30
    const val STEPS_MAX = 200

    /**
     * ההקלטה בדף: נגיעות ושינויים בשדות. **סיסמאות, שדות מוסתרים ופרטי כרטיס לא נרשמים לעולם** (רק "נגיעה" בהם).
     * on=false — מפסיקה.
     */
    fun recJs(on: Boolean): String = """(function(on){$SEL_FN
var o=window.__snbRec;if(o){removeEventListener('click',o.c,true);removeEventListener('change',o.i,true);window.__snbRec=null}if(!on)return;
function secret(e){var t=(e.type||'').toLowerCase(),a=(e.autocomplete||'').toLowerCase(),n=((e.name||'')+' '+(e.id||'')).toLowerCase();
return t==='password'||t==='hidden'||a.indexOf('cc-')===0||a.indexOf('password')>=0||a==='one-time-code'||/pass|cvv|cvc|card|otp|pin|sisma|סיסמ/.test(n)}
function c(ev){var e=ev.target;if(!e||!e.tagName)return;var tg=e.tagName;if((tg==='INPUT'&&!/^(button|submit|checkbox|radio|reset|image)$/i.test(e.type))||tg==='TEXTAREA'||tg==='SELECT')return;
snbTool.postMessage('r:'+JSON.stringify({k:'c',s:__snbSel(e)}))}
function i(ev){var e=ev.target;if(!e||!e.tagName||!/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))return;if(/^(checkbox|radio)$/i.test(e.type))return;if(secret(e))return;
snbTool.postMessage('r:'+JSON.stringify({k:'i',s:__snbSel(e),v:String(e.value).slice(0,500)}))}
addEventListener('click',c,true);addEventListener('change',i,true);window.__snbRec={c:c,i:i}})($on)"""

    fun stepParse(s: String): Step? = runCatching {
        val o = JSONObject(s); val k = o.optString("k").firstOrNull() ?: return null
        if (k != 'c' && k != 'i') return null
        Step(k, o.optString("s").take(400), o.optString("v").take(500)).takeIf { it.sel.isNotEmpty() }
    }.getOrNull()

    fun macrosEncode(l: List<Macro>): String = JSONArray().apply {
        l.forEach { m -> put(JSONObject().put("id", m.id).put("u", m.url).put("n", m.name)
            .put("s", JSONArray().apply { m.steps.forEach { st -> put(JSONArray().put(st.k.toString()).put(st.sel).put(st.v)) } })) }
    }.toString()
    fun macrosDecode(s: String?): List<Macro> = runCatching {
        val a = JSONArray(s ?: "[]")
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            val sa = o.optJSONArray("s") ?: JSONArray()
            val st = (0 until sa.length()).mapNotNull { j -> sa.optJSONArray(j)?.let { p -> p.optString(0).firstOrNull()?.takeIf { it in "cin" }?.let { Step(it, p.optString(1), p.optString(2)) } } }
            Macro(o.optString("id"), o.optString("u"), o.optString("n"), st).takeIf { it.id.isNotEmpty() && st.isNotEmpty() && it.url.startsWith("http") }
        } }
    }.getOrDefault(emptyList())

    /** הצעד שמוסיפים להקלטה: שתי הקלדות ברצף באותו שדה = אחת (הערך האחרון); מעבר דף אחרי מעבר — לא כפול */
    fun addStep(l: List<Step>, s: Step): List<Step> {
        if (l.size >= STEPS_MAX) return l
        val last = l.lastOrNull()
        if (last != null && s.k == 'i' && last.k == 'i' && last.sel == s.sel) return l.dropLast(1) + s
        if (last != null && s.k == 'n' && last.k == 'n') return l
        if (l.isEmpty() && s.k == 'n') return l
        return l + s
    }

    /**
     * ההרצה בדף מצעד from: כל צעד אחרי 600ms; "n" = עוצרים ומחכים לדף הבא (ממשיכים ב־onPageFinished);
     * "n" שבו מתחילים = כבר בדף החדש — מדלגים עליו.
     * מדווח "q:<i>" אחרי כל צעד, "q:-<i>" כשרכיב לא נמצא.
     */
    fun replayJs(steps: List<Step>, from: Int): String {
        val arr = JSONArray().apply { steps.forEach { put(JSONArray().put(it.k.toString()).put(it.sel).put(it.v)) } }
        return """(function(S,i){var F=i;function nx(){if(i>=S.length)return;var s=S[i];if(s[0]==='n'){if(i===F){i++;F=-1;return nx()}snbTool.postMessage('q:'+i);return}F=-1;
var e=null;try{e=document.querySelector(s[1])}catch(x){}if(!e){snbTool.postMessage('q:-'+i);return}
try{e.scrollIntoView({block:'center'})}catch(x){}
if(s[0]==='i'){var p=Object.getPrototypeOf(e),d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set)d.set.call(e,s[2]);else e.value=s[2];
e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}else e.click();
snbTool.postMessage('q:'+i);i++;setTimeout(nx,600)}setTimeout(nx,400)})($arr,$from)"""
    }

    /* ---------- 67 סקריפטים של משתמשים ---------- */

    /** match = רשימת דפוסים מופרדים בפסיק ("ynet.co.il", "*.example.com/news/*"); sensitive = הורשה גם בבנקים ובדפי כניסה */
    data class UScript(val id: String, val name: String, val match: String, val code: String, val on: Boolean = true, val sensitive: Boolean = false)
    const val SCRIPTS_MAX = 40
    const val CODE_MAX = 100_000

    fun scriptsEncode(l: List<UScript>): String = JSONArray().apply {
        l.forEach { s -> put(JSONObject().put("id", s.id).put("n", s.name).put("m", s.match).put("c", s.code).put("o", s.on).put("x", s.sensitive)) }
    }.toString()
    fun scriptsDecode(s: String?): List<UScript> = runCatching {
        val a = JSONArray(s ?: "[]")
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o ->
            UScript(o.optString("id"), o.optString("n"), o.optString("m"), o.optString("c").take(CODE_MAX), o.optBoolean("o", true), o.optBoolean("x"))
                .takeIf { it.id.isNotEmpty() && it.match.isNotBlank() }
        } }
    }.getOrDefault(emptyList())

    /** דפוס אחד מול כתובת: בלי "/" — רק המארח; עם "/" — מארח+נתיב. "*" = כל רצף. "*.x.com" תופס גם את x.com עצמו */
    fun matches(pattern: String, url: String): Boolean {
        val u = url.substringAfter("://", "")
        if (u.isEmpty()) return false
        val host = u.substringBefore('/').substringBefore('?').substringBefore('#').substringBefore(':').lowercase()
        val path = "/" + u.substringAfter('/', "").substringBefore('?').substringBefore('#')
        return pattern.split(',').map { it.trim().lowercase().substringAfter("://") }.filter { it.isNotEmpty() }.any { p ->
            val ph = p.substringBefore('/'); val pp = if ('/' in p) "/" + p.substringAfter('/') else null
            val hostOk = glob(ph, host) || (ph.startsWith("*.") && host == ph.drop(2))
            hostOk && (pp == null || glob(pp, path))
        }
    }
    private fun glob(p: String, s: String): Boolean = Regex(p.split('*').joinToString(".*") { Regex.escape(it) }).matches(s)

    /** בנקים, תשלומים ודפי כניסה — סקריפט של משתמש לא רץ שם בלי אישור מפורש (docs/browser-pro-plan.md, 67) */
    private val SENSITIVE_HOSTS = listOf("bankhapoalim.co.il", "leumi.co.il", "discountbank.co.il", "mizrahi-tefahot.co.il", "fibi.co.il", "onlinefibi.co.il",
        "bankjerusalem.co.il", "mercantile.co.il", "bank-yahav.co.il", "bankotsar.co.il", "max.co.il", "cal-online.co.il", "isracard.co.il",
        "americanexpress.co.il", "paypal.com", "bit.co.il", "paybox.co.il", "gov.il", "accounts.google.com", "login.microsoftonline.com", "appleid.apple.com")
    fun sensitive(url: String): Boolean {
        val u = url.substringAfter("://", "")
        val host = u.substringBefore('/').substringBefore(':').lowercase()
        val path = u.substringAfter('/', "").substringBefore('?').lowercase()
        if (SENSITIVE_HOSTS.any { host == it || host.endsWith(".$it") }) return true
        if (Regex("(^|[.-])(bank|banking|secure|login|signin|auth|sso|id|accounts?)[.-]").containsMatchIn(host + ".")) return true
        return Regex("(^|/)(login|log-in|signin|sign-in|signup|auth|oauth2?|sso|password|checkout|payment|pay)(/|$|[.?#_-])").containsMatchIn(path)
    }

    /** מה רץ בדף: מופעל, מתאים לכתובת, ובדף רגיש — רק מה שאושר לזה */
    fun runnable(l: List<UScript>, url: String): List<UScript> {
        if (!url.startsWith("http")) return emptyList()
        val sens = sensitive(url)
        return l.filter { it.on && matches(it.match, url) && (!sens || it.sensitive) }
    }

    /** עטיפה: שגיאה בסקריפט לא שוברת את הדף, ונרשמת בקונסולה עם השם */
    fun wrap(s: UScript): String = "(function(){try{\n${s.code}\n}catch(e){console.error('[${s.name.replace(Regex("[^\\p{L}\\p{N} _-]"), "")}] '+e)}})();"
}
