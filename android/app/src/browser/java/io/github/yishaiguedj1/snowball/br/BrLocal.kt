package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject

/**
 * Studio Browser Pro — הגל החמישי (01/11/2026, docs/browser-pro-plan.md): בתוך הטלפון, בלי ענן.
 * 26 תרגום הקטע במקום · 58 תרגום בלי אינטרנט · 50 כתוביות חיות · 59 סיכום במודל שבטלפון · 60 ממשקי AI לאתרים.
 * רק לוגיקה טהורה והסקריפטים לדף — בלי אנדרואיד (נבדק ב־BrLocalTest ב־JVM). הצד של אנדרואיד (ML Kit, SpeechRecognizer) — BrLocalAi.kt.
 * בנייה נקייה: זיהוי השפה, איסוף הטקסט מהדף ושכבת התאימות נכתבו כאן מאפס, לפי ההתנהגות ולפי טיוטות התקן הפתוחות לממשקי AI בדפדפן.
 * שום טקסט לא יוצא מהטלפון: התרגום, הזיהוי והסיכום רצים במכשיר (המודל של שפה יורד פעם אחת).
 */
object BrLocal {

    /* ---------- שפות (58) ---------- */

    /** שפה: הקוד של ML Kit, השם בעברית ובאנגלית */
    data class Lang(val code: String, val he: String, val en: String)
    val LANGS = listOf(
        Lang("he", "עברית", "Hebrew"), Lang("en", "אנגלית", "English"), Lang("ar", "ערבית", "Arabic"), Lang("ru", "רוסית", "Russian"),
        Lang("fr", "צרפתית", "French"), Lang("es", "ספרדית", "Spanish"), Lang("de", "גרמנית", "German"), Lang("it", "איטלקית", "Italian"),
        Lang("pt", "פורטוגזית", "Portuguese"), Lang("nl", "הולנדית", "Dutch"), Lang("pl", "פולנית", "Polish"), Lang("uk", "אוקראינית", "Ukrainian"),
        Lang("tr", "טורקית", "Turkish"), Lang("fa", "פרסית", "Persian"), Lang("el", "יוונית", "Greek"), Lang("ro", "רומנית", "Romanian"),
        Lang("hu", "הונגרית", "Hungarian"), Lang("cs", "צ'כית", "Czech"), Lang("sv", "שוודית", "Swedish"), Lang("da", "דנית", "Danish"),
        Lang("fi", "פינית", "Finnish"), Lang("no", "נורווגית", "Norwegian"), Lang("ja", "יפנית", "Japanese"), Lang("ko", "קוריאנית", "Korean"),
        Lang("zh", "סינית", "Chinese"), Lang("hi", "הינדי", "Hindi"), Lang("th", "תאית", "Thai"), Lang("vi", "וייטנאמית", "Vietnamese"),
        Lang("id", "אינדונזית", "Indonesian"),
    )
    private val CODES = LANGS.map { it.code }.toSet()
    fun name(code: String, he: Boolean) = LANGS.firstOrNull { it.code == code }?.let { if (he) it.he else it.en } ?: code
    fun rtl(code: String) = code == "he" || code == "ar" || code == "fa"

    /** קוד שפה מהדף או מהמערכת לקוד של ML Kit: en-US → en, iw → he, in → id, nb → no; לא מוכר — "" */
    fun norm(raw: String?): String {
        val s = raw?.trim()?.lowercase()?.replace('_', '-')?.substringBefore('-') ?: return ""
        val c = when (s) { "iw" -> "he"; "in" -> "id"; "nb", "nn" -> "no"; "ji" -> "yi"; else -> s }
        return if (c in CODES) c else ""
    }

    private val STOP = mapOf(
        "en" to setOf("the", "and", "of", "to", "is", "in", "that", "it", "for", "with", "you", "this", "are", "was", "on"),
        "fr" to setOf("le", "la", "les", "et", "des", "est", "une", "dans", "que", "pour", "pas", "qui", "sur", "du", "au"),
        "es" to setOf("el", "la", "los", "las", "y", "que", "en", "es", "por", "una", "con", "para", "del", "se", "no"),
        "de" to setOf("der", "die", "das", "und", "ist", "nicht", "mit", "ein", "eine", "zu", "auf", "für", "den", "sich", "ich"),
        "it" to setOf("il", "di", "che", "è", "per", "una", "non", "con", "del", "della", "gli", "sono", "nel", "anche", "le"),
        "pt" to setOf("o", "os", "que", "não", "uma", "para", "com", "do", "da", "em", "é", "se", "dos", "mais", "por"),
        "nl" to setOf("de", "het", "een", "en", "van", "is", "dat", "niet", "op", "te", "zijn", "voor", "met", "ook", "maar"),
    )

    /**
     * השפה של טקסט: קודם התווית של הדף (lang), אחר כך האותיות (עברית, ערבית/פרסית, קירילית, יוונית, יפנית, קוריאנית, סינית,
     * תאית, הינדי), ובאותיות לטיניות — מילים נפוצות (en/fr/es/de/it/pt/nl). לא ברור — אנגלית.
     */
    fun detect(pageLang: String?, sample: String): String {
        norm(pageLang).let { if (it.isNotEmpty()) return it }
        return guess(sample)
    }
    fun guess(sample: String): String {
        val n = IntArray(10)   // 0 he, 1 ar, 2 cyr, 3 el, 4 kana, 5 hangul, 6 han, 7 thai, 8 deva, 9 latin
        var fa = 0; var uk = 0
        for (ch in sample.take(6000)) {
            val c = ch.code
            when {
                c in 0x05D0..0x05EA -> n[0]++
                c in 0x0620..0x06FF -> { n[1]++; if (ch in "پچژگک") fa++ }
                c in 0x0400..0x04FF -> { n[2]++; if (ch in "іїєґІЇЄҐ") uk++ }
                c in 0x0370..0x03FF -> n[3]++
                c in 0x3040..0x30FF -> n[4]++
                c in 0xAC00..0xD7AF || c in 0x1100..0x11FF -> n[5]++
                c in 0x4E00..0x9FFF -> n[6]++
                c in 0x0E00..0x0E7F -> n[7]++
                c in 0x0900..0x097F -> n[8]++
                ch.isLetter() && c < 0x0250 -> n[9]++
            }
        }
        val m = n.maxOrNull() ?: 0
        if (m == 0) return "en"
        // יפנית: גם קאנג׳י (han) — מספיק מעט קאנה
        if (n[4] > 0 && n[4] * 5 >= n[6]) if (n[4] + n[6] >= m) return "ja"
        return when (n.indexOf(m)) {
            0 -> "he"; 1 -> if (fa > 0) "fa" else "ar"; 2 -> if (uk > 0) "uk" else "ru"; 3 -> "el"; 4 -> "ja"; 5 -> "ko"; 6 -> "zh"; 7 -> "th"; 8 -> "hi"
            else -> latin(sample)
        }
    }
    private fun latin(s: String): String {
        val words = s.take(6000).lowercase().split(Regex("[^\\p{L}]+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return "en"
        var best = "en"; var bs = 0
        for ((code, set) in STOP) { val sc = words.count { it in set }; if (sc > bs) { bs = sc; best = code } }
        return best
    }

    /** שפת היעד: השפה של הטלפון אם ML Kit מכיר אותה, אחרת עברית */
    fun target(sysLang: String?): String = norm(sysLang).ifEmpty { "he" }

    /* ---------- 26/58 תרגום במקום ---------- */

    /**
     * איסוף צומתי הטקסט: sel = רק מה שבבחירה (26), אחרת כל הדף (58). בלי script/style/code/pre/שדות/svg ובלי translate=no
     * או notranslate. נשמר ב־window.__snbTr (הצומת, הטקסט המקורי והרווחים מסביב) — כדי להחליף במקום ולהחזיר את המקור.
     */
    fun collectJs(sel: Boolean) = """(function(){try{
var S=$sel,MAXN=$MAX_NODES,MAXC=$MAX_CHARS,r=null;
if(S){var g=getSelection();if(!g||!g.rangeCount||g.isCollapsed)return JSON.stringify({l:'',t:[]});r=g.getRangeAt(0)}
var old=window.__snbTr;if(old&&!S){return JSON.stringify({l:'',t:[],busy:1})}
var root=S?r.commonAncestorContainer:document.body;if(root.nodeType===3)root=root.parentNode;
var BAD={SCRIPT:1,STYLE:1,NOSCRIPT:1,CODE:1,PRE:1,TEXTAREA:1,INPUT:1,SELECT:1,OPTION:1,SVG:1,MATH:1,KBD:1,SAMP:1,VAR:1,TEMPLATE:1,IFRAME:1};
function skip(e){for(var x=e;x&&x!==document.documentElement;x=x.parentElement){if(BAD[x.tagName&&x.tagName.toUpperCase()])return true;
if(x.getAttribute&&(x.getAttribute('translate')==='no'||x.isContentEditable&&x!==document.body))return true;if(x.classList&&x.classList.contains('notranslate'))return true}return false}
var st=window.__snbTr=old&&S?old:{n:[],o:[],w:[],d:[]};var base=st.n.length,out=[],tot=0;
var it=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),nd,cache=new Map();
while((nd=it.nextNode())&&out.length<MAXN&&tot<MAXC){var v=nd.nodeValue;if(!v||!/\p{L}/u.test(v))continue;
if(S&&!r.intersectsNode(nd))continue;if(st.n.indexOf(nd)>=0)continue;var p=nd.parentElement;if(!p)continue;
var sk=cache.get(p);if(sk===undefined){sk=skip(p);cache.set(p,sk)}if(sk)continue;
var m=/^(\s*)([\s\S]*?)(\s*)$/.exec(v);if(!m[2])continue;
st.n.push(nd);st.o.push(v);st.w.push([m[1],m[3]]);out.push(m[2].replace(/\s+/g,' '));tot+=m[2].length}
var l=(document.documentElement.lang||'');return JSON.stringify({l:l,t:out,b:base})}catch(e){return JSON.stringify({l:'',t:[]})}})()"""

    const val MAX_NODES = 1500
    const val MAX_CHARS = 60000

    /** התשובה של collectJs; b = האינדקס הראשון (בחירה שנייה בדף שכבר תורגם בחלקו מתווספת אחרי הקודמת) */
    data class Collected(val lang: String, val texts: List<String>, val base: Int, val busy: Boolean)
    fun collected(r: String?): Collected? = runCatching {
        val o = JSONObject(BrDev.unquote(r).ifEmpty { return null })
        val a = o.optJSONArray("t") ?: JSONArray()
        Collected(o.optString("l"), List(a.length()) { a.optString(it) }, o.optInt("b", 0), o.optInt("busy", 0) == 1)
    }.getOrNull()

    /**
     * מה לתרגם בפועל: רק טקסטים שונים (תפריט שחוזר 40 פעם — מתורגם פעם אחת), ובלי מה שאין בו מה לתרגם (מספרים, סימנים).
     * uniq = הרשימה לתרגום, of[i] = המקום ב־uniq של הטקסט i (או -1 = להשאיר כמו שהוא).
     */
    data class Plan(val uniq: List<String>, val of: IntArray)
    fun plan(texts: List<String>): Plan {
        val idx = LinkedHashMap<String, Int>()
        val of = IntArray(texts.size) { i ->
            val s = texts[i].trim()
            if (s.isEmpty() || s.none { it.isLetter() } || s.length > 5000) -1 else idx.getOrPut(s) { idx.size }
        }
        return Plan(idx.keys.toList(), of)
    }
    /** התרגומים של uniq בחזרה לסדר של הטקסטים (מה שלא תורגם — המקור) */
    fun spread(texts: List<String>, p: Plan, done: List<String?>): List<String> =
        texts.indices.map { i -> p.of[i].let { k -> if (k >= 0) done.getOrNull(k) ?: texts[i] else texts[i] } }

    /** מה שתורגם עכשיו (uniq בטווח lo עד hi) — זוגות של המקום ב־__snbTr (base + i) והתרגום, להחלה בהדרגה */
    fun fresh(p: Plan, base: Int, lo: Int, hi: Int, done: List<String?>): List<Pair<Int, String>> =
        p.of.indices.mapNotNull { i -> val k = p.of[i]; if (k in lo until hi) done.getOrNull(k)?.let { base + i to it } else null }

    /** החלה במקום: זוגות (המקום ב־__snbTr, התרגום); rtl — כיוון לפי התוכן לבלוק שמכיל (נשמר כדי להחזיר) */
    fun applyJs(pairs: List<Pair<Int, String>>, rtl: Boolean): String {
        val arr = JSONArray().apply { pairs.forEach { put(JSONArray().put(it.first).put(it.second)) } }.toString()
        return """(function(){try{var st=window.__snbTr;if(!st)return 0;var T=$arr,R=$rtl,k=0;
for(var i=0;i<T.length;i++){var j=T[i][0],nd=st.n[j];if(!nd||!nd.isConnected)continue;var w=st.w[j];nd.nodeValue=w[0]+T[i][1]+w[1];k++;
if(R){var b=nd.parentElement&&nd.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,td,th,dd,dt,blockquote,figcaption,caption,label,button,a,div');
if(b&&!b.__snbDir){b.__snbDir=1;st.d.push([b,b.getAttribute('dir')]);b.setAttribute('dir','auto')}}}
document.documentElement.setAttribute('data-snb-tr','1');return k}catch(e){return 0}})()"""
    }

    /** "מקור": מחזירים את הטקסט ואת הכיוון, ומוחקים את המצב */
    const val RESTORE_JS = """(function(){try{var st=window.__snbTr;if(!st)return 0;
for(var i=0;i<st.n.length;i++){try{st.n[i].nodeValue=st.o[i]}catch(e){}}
st.d.forEach(function(x){try{delete x[0].__snbDir;if(x[1]==null)x[0].removeAttribute('dir');else x[0].setAttribute('dir',x[1])}catch(e){}});
delete window.__snbTr;document.documentElement.removeAttribute('data-snb-tr');return 1}catch(e){return 0}})()"""

    /** האם הדף כבר מתורגם (אחרי רענון של המצב, למשל חזרה לכרטיסייה) */
    const val STATE_JS = "(function(){return window.__snbTr?1:0})()"

    /* ---------- 50 כתוביות חיות ---------- */

    /** התג של זיהוי הדיבור לשפה (SpeechRecognizer רוצה אזור): en → en-US, he → he-IL… */
    fun speechTag(code: String): String = when (code) {
        "en" -> "en-US"; "he" -> "he-IL"; "ar" -> "ar-SA"; "ru" -> "ru-RU"; "fr" -> "fr-FR"; "es" -> "es-ES"; "de" -> "de-DE"
        "it" -> "it-IT"; "pt" -> "pt-BR"; "nl" -> "nl-NL"; "pl" -> "pl-PL"; "uk" -> "uk-UA"; "tr" -> "tr-TR"; "ja" -> "ja-JP"
        "ko" -> "ko-KR"; "zh" -> "cmn-Hans-CN"; "hi" -> "hi-IN"; "fa" -> "fa-IR"; "el" -> "el-GR"; "sv" -> "sv-SE"; "da" -> "da-DK"
        "fi" -> "fi-FI"; "no" -> "nb-NO"; "ro" -> "ro-RO"; "hu" -> "hu-HU"; "cs" -> "cs-CZ"; "th" -> "th-TH"; "vi" -> "vi-VN"; "id" -> "id-ID"
        else -> code
    }
    /** האם רשימת השפות של המכשיר (תגים כמו en-US) כוללת את השפה */
    fun hasSpeech(tags: Collection<String>, code: String) = tags.any { norm(it) == code || it.equals(speechTag(code), true) }

    /** השורות על המסך: עד max שורות סופיות + החלק שעוד מזוהה. כל שורה — עד lineMax תווים (שורה ארוכה נחתכת למילים) */
    data class Cap(val lines: List<String> = emptyList(), val partial: String = "")
    fun capFinal(c: Cap, text: String, max: Int = 2, lineMax: Int = 90): Cap {
        val s = text.replace(Regex("\\s+"), " ").trim()
        if (s.isEmpty()) return c.copy(partial = "")
        val parts = ArrayList<String>(); var cur = StringBuilder()
        for (w in s.split(' ')) { if (cur.isNotEmpty() && cur.length + 1 + w.length > lineMax) { parts += cur.toString(); cur = StringBuilder() }; if (cur.isNotEmpty()) cur.append(' '); cur.append(w) }
        if (cur.isNotEmpty()) parts += cur.toString()
        return Cap((c.lines + parts).takeLast(max), "")
    }
    fun capPartial(c: Cap, text: String) = c.copy(partial = text.replace(Regex("\\s+"), " ").trim().takeLast(120))

    /** ההגבלה על הקול שמגיע מהדף: עד 64KB לחתיכה (base64), כדי שדף לא יציף את הטלפון */
    const val AUDIO_MAX = 65536
    const val RATE = 16000

    /**
     * 50: הקול של הנגן שמתנגן (הגדול ביותר) — captureStream (לא משנה את מה שנשמע), AudioContext, דגימה ל־16kHz מונו 16 ביט,
     * וכל ~250ms חתיכה בערוץ הכלים בקידומת a:. לא עובד על נגן עם DRM או ממקור אחר בלי CORS (אותו גבול של הקליפ בגל 4).
     */
    fun audioJs(ch: String) = """(function(){try{
if(window.__snbCap)return 'on';var best=null,bs=0;
document.querySelectorAll('video,audio').forEach(function(v){var r=v.getBoundingClientRect(),s=(r.width*r.height||1)*(v.paused?1:1000);if(v.readyState>1&&s>bs){bs=s;best=v}});
if(!best)return 'none';var cs=best.captureStream||best.mozCaptureStream;if(!cs)return 'nocap';
var ms=cs.call(best);if(!ms.getAudioTracks().length)return 'noaudio';
var A=window.AudioContext||window.webkitAudioContext,ac=new A(),src=ac.createMediaStreamSource(ms),pr=ac.createScriptProcessor(4096,1,1),g=ac.createGain();g.gain.value=0;
var R=ac.sampleRate/$RATE,buf=[],last=Date.now();
pr.onaudioprocess=function(e){var d=e.inputBuffer.getChannelData(0),n=Math.floor(d.length/R),o=new Int16Array(n);
for(var i=0;i<n;i++){var x=d[Math.floor(i*R)];o[i]=x<0?Math.max(-1,x)*32768:Math.min(1,x)*32767}buf.push(o);
if(Date.now()-last>250){last=Date.now();var len=0;buf.forEach(function(b){len+=b.length});var all=new Uint8Array(len*2),off=0;
buf.forEach(function(b){all.set(new Uint8Array(b.buffer),off);off+=b.byteLength});buf=[];var s='';for(var k=0;k<all.length;k+=8192)s+=String.fromCharCode.apply(null,all.subarray(k,k+8192));
try{window.$ch.postMessage('a:'+btoa(s))}catch(x){}}};
src.connect(pr);pr.connect(g);g.connect(ac.destination);if(ac.state==='suspended')ac.resume();
window.__snbCap={ac:ac,src:src,pr:pr,ms:ms};return 'ok:'+(document.documentElement.lang||'')}catch(e){return 'err'}})()"""

    const val AUDIO_STOP_JS = """(function(){try{var c=window.__snbCap;if(!c)return 0;c.pr.onaudioprocess=null;try{c.src.disconnect();c.pr.disconnect()}catch(e){}
try{c.ac.close()}catch(e){}try{c.ms.getTracks().forEach(function(t){t.stop()})}catch(e){}delete window.__snbCap;return 1}catch(e){return 0}})()"""

    /** התשובה של audioJs: "ok:<lang>" — הצליח (והשפה של הדף), אחרת קוד הסיבה */
    fun audioRes(r: String?): Pair<Boolean, String> { val s = BrDev.unquote(r); return if (s.startsWith("ok:")) true to s.drop(3) else (s == "on") to s }

    /* ---------- 59 סיכום ---------- */

    /** המודל שבטלפון מסכם רק באנגלית (וביפנית ובקוריאנית) — שפה אחרת עוברת דרך 58 לאנגלית ובחזרה */
    val SUM_LANGS = setOf("en", "ja", "ko")
    /** הקלט לסיכום: הכותרת והפסקאות, עד max תווים (המודל ממילא קוצץ קלט ארוך) */
    fun sumInput(a: BrRead.Article, max: Int = 8000): String {
        val sb = StringBuilder(a.title.trim())
        for (b in a.blocks) { if (sb.length >= max) break; if (sb.isNotEmpty()) sb.append("\n"); sb.append(b.t.trim()) }
        return sb.toString().take(max)
    }
    /** הסיכום (נקודות מהמודל: "* ", "- ", "• ") לרשימה נקייה */
    fun bullets(s: String): List<String> = s.split('\n').map { it.trim().trimStart('*', '-', '•', '·', ' ').trim() }.filter { it.isNotEmpty() }

    /* ---------- 60 ממשקי ה־AI לאתרים (שכבת תאימות, רק כש־59 עובד בטלפון) ---------- */

    /**
     * window.Summarizer / Translator / LanguageDetector בצורה של טיוטות התקן הפתוחות לממשקי AI בדפדפן (availability, create,
     * summarize/translate/detect, ‏גרסת streaming פשוטה, destroy). כל קריאה = הודעה בערוץ הכלים בקידומת i: עם מזהה, והתשובה
     * חוזרת ל־__snbAi.r. רק במסגרת הראשית, לא בכרטיסייה פרטית, ורק כשההגדרה דלוקה. לא דורסים ממשק שכבר קיים.
     */
    fun shimJs(ch: String) = """(function(){if(window!==top||window.__snbAi)return;var P={},n=0,C=window.$ch;if(!C)return;
function call(op,a){return new Promise(function(ok,no){var id=++n;P[id]=[ok,no];try{C.postMessage('i:'+JSON.stringify({id:id,op:op,a:a||{}}))}catch(e){delete P[id];no(e)}})}
window.__snbAi={r:function(id,good,v){var p=P[id];if(!p)return;delete P[id];if(good)p[0](v);else p[1](new DOMException(String(v||'error'),'NotSupportedError'))}};
function str(s){return typeof s==='string'?s:String(s==null?'':s)}
function stream(pr){return new ReadableStream({start:function(c){pr.then(function(v){c.enqueue(v);c.close()},function(e){c.error(e)})}})}
function mk(name,api){if(name in window)return;window[name]=api}
mk('Summarizer',{availability:function(o){return call('sa',o)},create:function(o){o=o||{};return call('sa',o).then(function(s){if(s==='unavailable')throw new DOMException('unavailable','NotSupportedError');
return {sharedContext:o.sharedContext||'',type:o.type||'key-points',format:o.format||'markdown',length:o.length||'short',inputQuota:8000,
summarize:function(t,x){return call('s',{t:str(t),type:o.type,length:o.length})},summarizeStreaming:function(t,x){return stream(call('s',{t:str(t),type:o.type,length:o.length}))},
measureInputUsage:function(t){return Promise.resolve(str(t).length)},destroy:function(){}}})}});
mk('Translator',{availability:function(o){return call('ta',o)},create:function(o){o=o||{};return call('ta',o).then(function(s){if(s==='unavailable')throw new DOMException('unavailable','NotSupportedError');
return {sourceLanguage:o.sourceLanguage,targetLanguage:o.targetLanguage,inputQuota:5000,translate:function(t){return call('t',{t:str(t),s:o.sourceLanguage,d:o.targetLanguage})},
translateStreaming:function(t){return stream(call('t',{t:str(t),s:o.sourceLanguage,d:o.targetLanguage}))},measureInputUsage:function(t){return Promise.resolve(str(t).length)},destroy:function(){}}})}});
mk('LanguageDetector',{availability:function(){return Promise.resolve('available')},create:function(){return Promise.resolve({inputQuota:6000,
detect:function(t){return call('d',{t:str(t)})},measureInputUsage:function(t){return Promise.resolve(str(t).length)},destroy:function(){}})}});
})()"""

    /** בקשה מהשכבה: מזהה, פעולה (sa/s/ta/t/d) והפרמטרים; פעולה לא מוכרת או בלי מזהה — null */
    data class AiReq(val id: Int, val op: String, val a: JSONObject)
    fun aiReq(d: String): AiReq? = runCatching {
        val o = JSONObject(d); val id = o.optInt("id", 0); val op = o.optString("op")
        if (id <= 0 || op !in setOf("sa", "s", "ta", "t", "d")) null else AiReq(id, op, o.optJSONObject("a") ?: JSONObject())
    }.getOrNull()
    /** הטקסט בבקשה — עד max תווים (הגבלה של השכבה, כמו inputQuota) */
    fun aiText(r: AiReq, max: Int = 8000) = r.a.optString("t").take(max)
    /** התשובה לדף (ערך JSON בטוח בתוך הסקריפט) */
    fun aiReply(id: Int, ok: Boolean, v: Any?): String =
        "window.__snbAi&&__snbAi.r($id,$ok,${if (v is JSONArray || v is JSONObject) v.toString() else JSONObject.quote(v?.toString() ?: "")})"
    /** התשובה של LanguageDetector.detect: [{detectedLanguage, confidence}] */
    fun detectRes(t: String): JSONArray = JSONArray().put(JSONObject().put("detectedLanguage", guess(t)).put("confidence", if (t.length > 40) 0.9 else 0.6))
    /** מצב ל־availability של התקן: 3 זמין · 1/2 להורדה · 0 לא */
    fun avail(status: Int) = when (status) { 3 -> "available"; 1 -> "downloadable"; 2 -> "downloading"; else -> "unavailable" }
}
