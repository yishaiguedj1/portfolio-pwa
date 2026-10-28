package io.github.yishaiguedj1.snowball.br

/**
 * 26/10/2026 (Studio Browser שלב 3 — "פרטיות"): חסימת פרסומות ומעקב, הודעות עוגיות, והגדרות לכל אתר. טהור (בלי
 * אנדרואיד) — נבדק ב־BrShieldTest.
 *
 * החסימה לפי שם השרת בלבד, ורק של צד שלישי: בקשה מ־doubleclick.net בדף של ynet נחסמת; הדף של doubleclick עצמו לא
 * (ובקשה ראשית של טאב — אף פעם, BrowserActivity בודק isForMainFrame). הרשימה קצרה ושמרנית בכוונה: רשתות פרסום ומעקב
 * מוכרות שחסימתן לא שוברת אתרים — בלי googletagmanager (אתרים טוענים דרכו גם קוד שלהם), בלי connect.facebook.net
 * (התחברות עם Facebook) ובלי שום שרת של יוטיוב. אתר שנשבר — "הגנה באתר הזה" כבוי בפרטי האתר (`SiteRule.shield`).
 */
object BrShield {
    val ADS: Set<String> = """
        doubleclick.net googlesyndication.com googleadservices.com google-analytics.com adservice.google.com pagead2.googlesyndication.com
        googletagservices.com app-measurement.com imasdk.googleapis.com adsense.com
        adnxs.com adsrvr.org criteo.com criteo.net taboola.com outbrain.com outbrainimg.com rubiconproject.com pubmatic.com
        openx.net casalemedia.com indexexchange.com smartadserver.com amazon-adsystem.com media.net advertising.com
        yieldmo.com teads.tv sharethrough.com triplelift.com 33across.com gumgum.com spotxchange.com spotx.tv
        moatads.com doubleverify.com adsafeprotected.com serving-sys.com sizmek.com adform.net adition.com
        bidswitch.net contextweb.com districtm.io lijit.com sovrn.com rhythmone.com undertone.com yieldlab.net
        zedo.com revcontent.com mgid.com adblade.com content.ad propellerads.com popads.net popcash.net
        exoclick.com juicyads.com trafficjunky.net adcash.com adsterra.com hilltopads.net onclickads.net
        scorecardresearch.com quantserve.com quantcount.com chartbeat.com chartbeat.net comscore.com
        hotjar.com hotjar.io mouseflow.com crazyegg.com fullstory.com luckyorange.com inspectlet.com clarity.ms
        mixpanel.com amplitude.com segment.io segment.com heap.io heapanalytics.com kissmetrics.com
        newrelic.com nr-data.net bugsnag.com
        branch.io appsflyer.com adjust.com kochava.com
        bluekai.com krxd.net demdex.net omtrdc.net everesttech.net exelator.com eyeota.net agkn.com
        rlcdn.com liveramp.com tapad.com crwdcntrl.net lotame.com bidr.io mathtag.com mookie1.com
        turn.com adsymptotic.com addthis.com addthisedge.com sharethis.com
        yandex.ru/metrika mc.yandex.ru adfox.ru
        ads.yahoo.com analytics.yahoo.com advertising.yahoo.com
        ads.linkedin.com px.ads.linkedin.com snap.licdn.com
        analytics.twitter.com ads-twitter.com static.ads-twitter.com
        analytics.tiktok.com ads.tiktok.com
        ads.pinterest.com ct.pinterest.com
        bat.bing.com ads.microsoft.com
        cdn.krxd.net tags.tiqcdn.com
        zemanta.com nativo.com nativo.net plista.com ligatus.com
        adtech.de adtechus.com yieldoptimizer.com
        2mdn.net admob.com adcolony.com applovin.com unityads.unity3d.com vungle.com inmobi.com chartboost.com startappservice.com
        ad.walla.co.il adserver.ynet.co.il
    """.split(Regex("\\s+")).filter { it.isNotEmpty() && '/' !in it }.toHashSet()

    /** סיומות של שתי רמות שהאתר עצמו נמצא מתחתן (co.il, co.uk…) — כדי ש־a.co.il ו־b.co.il לא ייחשבו אותו אתר */
    private val TWO = setOf("co.il", "org.il", "net.il", "ac.il", "gov.il", "muni.il", "co.uk", "org.uk", "ac.uk", "gov.uk",
        "com.au", "net.au", "org.au", "co.nz", "co.jp", "ne.jp", "or.jp", "co.kr", "com.br", "com.mx", "com.ar", "com.tr", "co.in",
        "co.za", "com.cn", "com.hk", "com.tw", "com.sg")

    /** האתר (הדומיין שנרשם): news.ynet.co.il → ynet.co.il, a.b.example.com → example.com */
    fun site(host: String): String {
        val h = host.lowercase().trimEnd('.').removePrefix("www.")
        val p = h.split('.')
        if (p.size <= 2) return h
        val last2 = p.takeLast(2).joinToString(".")
        return if (last2 in TWO && p.size >= 3) p.takeLast(3).joinToString(".") else last2
    }

    /** לחסום? רק בקשה לשרת מהרשימה (או תת־שרת שלו), ורק כשהוא לא האתר של הדף */
    fun blocks(reqHost: String, pageHost: String): Boolean {
        val h = reqHost.lowercase().trimEnd('.')
        if (h.isEmpty() || pageHost.isNotEmpty() && site(h) == site(pageHost)) return false
        var d = h
        while (true) {
            if (d in ADS) return true
            val i = d.indexOf('.')
            if (i < 0 || d.indexOf('.', i + 1) < 0) return false   // לא בודקים סיומת בודדת ("com")
            d = d.substring(i + 1)
        }
    }

    /* ---------- הגדרות לכל אתר ---------- */

    /**
     * מה שהחלטת לאתר אחד: shield = ההגנה פועלת (חסימה והודעות עוגיות); cam/mic/loc: 1 מותר, -1 חסום, 0 לשאול (ברירת
     * המחדל — לפי ת־עיצוב, ההחלטה שלך נזכרת ולא שואלים שוב); speed = מהירות הווידאו באתר (100 = רגיל)
     */
    data class SiteRule(val host: String, val shield: Boolean = true, val cam: Int = 0, val mic: Int = 0, val loc: Int = 0, val speed: Int = 100) {
        val empty get() = shield && cam == 0 && mic == 0 && loc == 0 && speed == 100
    }

    /** "host|s|c|m|l|v" בכל שורה — בלי JSON (נבדק ב־JVM בלי אנדרואיד) */
    fun encode(rules: Collection<SiteRule>): String = rules.filter { !it.empty && ok(it.host) }
        .joinToString("\n") { "${it.host}|${if (it.shield) 1 else 0}|${it.cam}|${it.mic}|${it.loc}|${it.speed}" }

    fun decode(s: String): Map<String, SiteRule> {
        val out = LinkedHashMap<String, SiteRule>()
        for (line in s.split('\n')) {
            val p = line.split('|')
            if (p.size < 5 || !ok(p[0])) continue
            fun tri(x: String) = (x.toIntOrNull() ?: 0).coerceIn(-1, 1)
            val r = SiteRule(p[0], p[1] != "0", tri(p[2]), tri(p[3]), tri(p[4]), (p.getOrNull(5)?.toIntOrNull() ?: 100).let { if (it in SPEEDS) it else 100 })
            if (!r.empty) out[r.host] = r
        }
        return out
    }

    private fun ok(h: String) = h.isNotEmpty() && h.length <= 253 && h.all { it.isLetterOrDigit() || it == '.' || it == '-' }

    /** מהירויות הווידאו (באחוזים) — לפי ת־נגן */
    val SPEEDS = listOf(50, 75, 100, 125, 150, 175, 200)

    /* ---------- סקריפטים בדף ---------- */

    /**
     * הודעות עוגיות: קודם לוחצים "דחייה" של מערכות ההסכמה הנפוצות (OneTrust, Cookiebot, Didomi, Quantcast, Usercentrics,
     * TrustArc, Complianz, CookieYes, Sourcepoint) — דחייה ולא הסכמה; אם אין כפתור כזה — מסתירים את ההודעה ומשחררים את
     * הגלילה שהיא נעלה. רק בדף עצמו, בלי לשלוח כלום החוצה. רץ כמה פעמים (ההודעה מופיעה באיחור) ומפסיק אחרי 10 שניות.
     */
    const val COOKIE_JS = """(function(){try{
if(window.__snbCk)return;window.__snbCk=1;
var REJ=['#onetrust-reject-all-handler','#CybotCookiebotDialogBodyButtonDecline','#didomi-notice-disagree-button','.didomi-continue-without-agreeing',
'.qc-cmp2-summary-buttons button[mode="secondary"]','[data-testid="uc-deny-all-button"]','#truste-consent-required','.cmplz-deny','.cky-btn-reject',
'button.sp_choice_type_13','#cookiescript_reject','.cc-deny','#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll','.osano-cm-denyAll','.fc-cta-do-not-consent'];
var HIDE=['#onetrust-banner-sdk','#onetrust-consent-sdk','#CybotCookiebotDialog','#didomi-host','.qc-cmp2-container','#usercentrics-root','#truste-consent-track',
'.cmplz-cookiebanner','.cky-consent-container','#cookiescript_injected','.cc-window','.osano-cm-window','.fc-consent-root','#sp_message_container','[id^="sp_message_container"]',
'#cookie-law-info-bar','.cookie-notice-container','#cookie-notice','#gdpr-cookie-message','.js-cookie-consent','#CookieConsent'];
var st=null,n=0;
function run(){try{
for(var i=0;i<REJ.length;i++){var b=document.querySelector(REJ[i]);if(b&&b.offsetParent!==null){b.click();return true;}}
var hit=false;for(var j=0;j<HIDE.length;j++){if(document.querySelector(HIDE[j])){hit=true;break;}}
if(hit&&!st){st=document.createElement('style');st.id='snb-ck';
st.textContent=HIDE.join(',')+'{display:none!important}html,body{overflow:auto!important;position:static!important}';
(document.head||document.documentElement).appendChild(st);}
return hit;}catch(e){return false;}}
var t=setInterval(function(){if(run()||++n>20)clearInterval(t);},500);run();
}catch(e){}})();"""

    /**
     * ניגון בדף (כל המסגרות): מדווח לדפדפן אם משהו מתנגן (window.snbPlay — רק "1"/"0"), מחיל את מהירות האתר על כל
     * סרטון שמתחיל (window.__snbRate), ובזמן ניגון ברקע מסתיר מהדף שהאפליקציה ברקע (window.__snbBg) — אחרת אתרים
     * עוצרים את הסרטון ברגע שהמסך נכבה.
     */
    const val PLAY_JS = """(function(){try{
if(window.__snbPlay)return;var ch=window.snbPlay;if(!ch)return;window.__snbPlay=1;
var last=-1;
function now(){var p=0,m=document.querySelectorAll('video,audio');for(var i=0;i<m.length;i++){if(!m[i].paused&&!m[i].ended)p=1;}return p;}
function rep(){var p=now();if(p!==last){last=p;ch.postMessage(String(p));}}
['play','playing','pause','ended','emptied'].forEach(function(e){document.addEventListener(e,function(ev){
if(e==='play'&&window.__snbRate&&ev.target&&ev.target.playbackRate!==window.__snbRate)try{ev.target.playbackRate=window.__snbRate;}catch(x){}
setTimeout(rep,60);},true);});
try{var D=Document.prototype,hd=Object.getOwnPropertyDescriptor(D,'hidden'),vs=Object.getOwnPropertyDescriptor(D,'visibilityState');
if(hd&&hd.get)Object.defineProperty(document,'hidden',{configurable:true,get:function(){return window.__snbBg?false:hd.get.call(document);}});
if(vs&&vs.get)Object.defineProperty(document,'visibilityState',{configurable:true,get:function(){return window.__snbBg?'visible':vs.get.call(document);}});
}catch(x){}
['visibilitychange','webkitvisibilitychange','pagehide','blur'].forEach(function(e){window.addEventListener(e,function(ev){if(window.__snbBg)ev.stopImmediatePropagation();},true);
document.addEventListener(e,function(ev){if(window.__snbBg)ev.stopImmediatePropagation();},true);});
}catch(e){}})();"""

    /** מהירות לכל הסרטונים בדף (גם לאלה שיתחילו אחר כך — PLAY_JS) */
    fun speedJs(pct: Int): String {
        val r = (pct.coerceIn(25, 400) / 100.0).toString()
        return "(function(){try{window.__snbRate=$r;var m=document.querySelectorAll('video,audio');for(var i=0;i<m.length;i++)m[i].playbackRate=$r;}catch(e){}})();"
    }

    /** ניגון ברקע: on = האפליקציה יוצאת לרקע ומשהו מתנגן; ההשהיה/ההמשך מההתראה */
    fun bgJs(on: Boolean) = "window.__snbBg=${if (on) 1 else 0};"
    const val PAUSE_JS = "(function(){var m=document.querySelectorAll('video,audio');for(var i=0;i<m.length;i++)try{m[i].pause();}catch(e){}})();"
    const val RESUME_JS = "(function(){var m=document.querySelectorAll('video,audio');for(var i=0;i<m.length;i++)try{if(m[i].currentTime>0&&!m[i].ended){m[i].play();break;}}catch(e){}})();"
}
