package io.github.yishaiguedj1.snowball.dm

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.yishaiguedj1.snowball.DlDeep
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.HuntMedia
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.VideoUrl

/**
 * הדפדפן של Studio DM (שלב 2, בקשת המשתמש: "כמו IDM / 1DM"): גולשים, מנגנים, והקפסולה למטה אומרת "נמצא".
 * אותו זיהוי של דפדפן הציד ב־Studio (HuntMedia — בקשות הרשת, ה־Service Worker וסקריפט שמדווח על fetch/XHR/‏<video>),
 * ובנוסף — הורדה שהדף עצמו מתחיל (setDownloadListener) נתפסת ועוברת ל־DM, כמו "Download with IDM".
 *
 * הכל בטלפון: העוגיות של האתרים נשארות ב־CookieManager של האפליקציה, ונשלחות רק לאתר שהן שלו, ורק להורדה שהתחילה כאן
 * (DmFetch.open עוקב אחרי הפניות בעצמו). ל־yt-dlp — קובץ עוגיות זמני באחסון הפרטי (DlEngine.saveCookies, 30 דק׳).
 * המסירה ל־DmActivity — בתוך התהליך עם אסימון חד־פעמי (take), לא ב־extras שאפליקציה אחרת יכולה לזייף.
 *
 * "רענון קישור" (EXTRA_REFRESH): נפתח מהפרטים של הורדה שהקישור שלה פג — מה שנבחר כאן מחליף את הכתובת, וההורדה ממשיכה.
 */
class DmBrowser : Activity() {
    private lateinit var web: WebView
    private lateinit var bar: EditText
    private lateinit var prog: ProgressBar
    private lateinit var pill: TextView
    private val found = HuntMedia.Found()
    private val ui = Handler(Looper.getMainLooper())
    private var page = ""
    private val headSeen = HashSet<String>()
    private val refresh get() = intent?.getStringExtra(EXTRA_REFRESH) ?: ""

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()
    private val dark get() = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES

    override fun attachBaseContext(base: Context) { super.attachBaseContext(DmLang.wrap(base)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val bg = if (dark) Color.parseColor("#0E0E10") else Color.parseColor("#F6F6F8")
        val fg = if (dark) Color.WHITE else Color.parseColor("#1C1C1E")
        val field = if (dark) Color.parseColor("#222226") else Color.WHITE
        window.statusBarColor = bg
        window.navigationBarColor = bg

        val root = FrameLayout(this).apply { setBackgroundColor(bg); fitsSystemWindows = true }
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), dp(6f), dp(12f), dp(6f)); setBackgroundColor(bg)
        }
        val close = TextView(this).apply {
            text = "✕"; setTextColor(fg); textSize = 20f; gravity = Gravity.CENTER
            contentDescription = getString(R.string.dmBrClose)
            layoutParams = LinearLayout.LayoutParams(dp(44f), dp(44f))
            setOnClickListener { finish() }
        }
        bar = EditText(this).apply {
            hint = getString(R.string.dmBrHint)
            setSingleLine(true); textSize = 16f; setTextColor(fg); setHintTextColor(Color.parseColor("#8E8E93"))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_GO
            setSelectAllOnFocus(true)
            textDirection = View.TEXT_DIRECTION_LTR   // כתובת — תמיד משמאל לימין
            background = GradientDrawable().apply { cornerRadius = dp(999f).toFloat(); setColor(field) }
            setPadding(dp(16f), dp(10f), dp(16f), dp(10f))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnEditorActionListener { v, id, ev ->
                if (id == EditorInfo.IME_ACTION_GO || (ev != null && ev.keyCode == KeyEvent.KEYCODE_ENTER && ev.action == KeyEvent.ACTION_DOWN)) { go(v.text.toString()); true } else false
            }
        }
        top.addView(close); top.addView(bar)
        prog = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100; progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#FF4656"))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3f))
            visibility = View.INVISIBLE
        }
        web = WebView(this).apply { layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f) }
        col.addView(top)
        if (refresh.isNotEmpty()) col.addView(TextView(this).apply {   // מה עושים כאן — שורה אחת, רק ברענון
            text = getString(R.string.dmBrRefreshHint); textSize = 14f; setTextColor(fg)
            setPadding(dp(16f), dp(2f), dp(16f), dp(8f))
        })
        col.addView(prog); col.addView(web)
        root.addView(col)
        pill = TextView(this).apply {
            setTextColor(Color.parseColor("#1A0003")); textSize = 16f; gravity = Gravity.CENTER
            setPadding(dp(22f), dp(13f), dp(22f), dp(13f))
            background = GradientDrawable().apply { cornerRadius = dp(999f).toFloat(); setColor(Color.parseColor("#FF4656")) }
            elevation = dp(8f).toFloat()
            visibility = View.GONE
            setOnClickListener { pick() }
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = dp(28f) }
        }
        root.addView(pill)
        setContentView(root)

        setupWeb()
        val start = intent?.getStringExtra(EXTRA_START) ?: ""
        if (start.startsWith("http")) go(start) else { bar.requestFocus(); ui.postDelayed({ (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(bar, 0) }, 250) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWeb() {
        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.setSupportMultipleWindows(false)
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val sc = req.url.scheme?.lowercase()
                return sc != "http" && sc != "https"          // intent:/market:/… לא נפתחים מכאן
            }
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? { seen(req.url.toString(), headers = req.requestHeaders); return null }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (url != page) { page = url; found.clear(); synchronized(headSeen) { headSeen.clear() }; paintPill() }
                if (!bar.hasFocus()) bar.setText(url)
            }
            // אתר של "דף אחד" (קורס, פיד): שיעור אחר בלי טעינת דף — onPageStarted לא נקרא, והרשימה צברה את כולם
            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                if (page.isNotEmpty() && !HuntMedia.samePage(url, page)) {
                    synchronized(headSeen) { headSeen.clear() }; if (found.navigated(android.os.SystemClock.uptimeMillis())) paintPill()
                }
                page = url
                if (!bar.hasFocus()) bar.setText(url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!bar.hasFocus()) bar.setText(url)
                page = url; paintPill()
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { prog.progress = p; prog.visibility = if (p in 1..99) View.VISIBLE else View.INVISIBLE }
        }
        // הורדה שהדף מתחיל (קישור "הורדה", קובץ שאינו דף) — ישר ל־DM, עם ה־User-Agent של הדפדפן ועוגיות
        web.setDownloadListener { url, _, _, _, _ -> if (url.startsWith("http")) send(url, page, file = true) }
        try {
            ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
                override fun shouldInterceptRequest(req: WebResourceRequest): WebResourceResponse? { seen(req.url.toString(), headers = req.requestHeaders); return null }
            })
        } catch (e: Exception) {}
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "snbHunt", setOf("*")) { _, msg, _, _, _ -> msg.data?.let { seen(it, hook = true) } }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(web, HOOK, setOf("*"))
        }
    }

    /* מכל חוט → הסינון → הרשימה בחוט הראשי. קובץ ישיר נבדק קודם (HEAD): קטן מ־DlDeep.MIN_BYTES, דף או תמונה — לא נספר */
    private fun seen(url: String, hook: Boolean = false, headers: Map<String, String>? = null) {
        val h = (if (hook) HuntMedia.fromHook(url) else HuntMedia.fromRequest(url, headers)) ?: return
        val t = android.os.SystemClock.uptimeMillis()
        if (h.kind != HuntMedia.Kind.FILE) { ui.post { if (found.add(h, t)) paintPill() }; return }
        synchronized(headSeen) { if (!headSeen.add(h.url) || headSeen.size > 60) return }
        val ref = page
        val ua = web.settings.userAgentString
        Thread {
            var ok = true
            try {
                // הפניות ביד: לכל קפיצה העוגיות של הכתובת שלה בלבד, בלי ירידה מ־https ל־http (כמו DmFetch)
                var u = java.net.URL(h.url); var hops = 0
                while (true) {
                    val c = u.openConnection() as java.net.HttpURLConnection
                    c.requestMethod = "HEAD"; c.connectTimeout = 8000; c.readTimeout = 8000
                    c.instanceFollowRedirects = false
                    c.setRequestProperty("User-Agent", ua)
                    if (ref.startsWith("http")) c.setRequestProperty("Referer", ref)
                    // 26/10/2026: באתר שדורש התחברות הבדיקה בלי עוגיות קיבלה דף כניסה (text/html) והסרטון נפסל
                    ck(u.toString())?.let { c.setRequestProperty("Cookie", it) }
                    val code = c.responseCode
                    val loc = c.getHeaderField("Location")
                    if (code in 300..399 && loc != null && hops < 4) {
                        c.disconnect()
                        val next = java.net.URL(u, loc)
                        if (u.protocol == "https" && next.protocol == "http") { ok = !h.guess; break }
                        u = next; hops++; continue
                    }
                    ok = if (code >= 400) !h.guess && code != 404 && code != 410
                    else HuntMedia.headOk(c.contentType, c.contentLengthLong, h.guess, DlDeep.MIN_BYTES)
                    c.disconnect(); break
                }
            } catch (e: Throwable) { if (h.guess) ok = false }
            if (ok) ui.post { if (found.add(h, t)) paintPill() }
        }.start()
    }

    /* עוגיות הדף לבדיקה (בתוך האפליקציה בלבד; לא נשמרות). בלי \r\n — לא מזריקים כותרות */
    private fun ck(u: String): String? = try {
        CookieManager.getInstance().getCookie(u)?.takeIf { it.isNotEmpty() && '\n' !in it && '\r' !in it }
    } catch (e: Throwable) { null }

    private fun pageIsVideo() = VideoUrl.classify(page) is VideoUrl.Hit.Video

    private fun paintPill() {
        val n = found.size + (if (pageIsVideo()) 1 else 0)
        if (n == 0) { pill.visibility = View.GONE; return }
        pill.text = if (n == 1) getString(R.string.dmBrFound) else getString(R.string.dmBrFoundN, n)
        if (pill.visibility != View.VISIBLE) {
            pill.visibility = View.VISIBLE
            pill.alpha = 0f; pill.scaleX = 0.8f; pill.scaleY = 0.8f
            pill.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(220).start()
        }
    }

    /* מה להוריד: הדף עצמו (אתר מוכר — yt-dlp מביא כותרת ואיכויות) או אחד הממצאים */
    private fun pick() {
        val items = ArrayList<Pair<String, () -> Unit>>()
        if (pageIsVideo()) items.add(getString(R.string.dmBrPage) to { send(page, "") })
        for (h in found.list) {
            val label = when (h.kind) { HuntMedia.Kind.HLS -> R.string.dmBrHls; HuntMedia.Kind.DASH -> R.string.dmBrDash; else -> R.string.dmBrFile }
            items.add((getString(label) + " · " + h.host) to { send(h.url, page, file = h.kind == HuntMedia.Kind.FILE) })
        }
        if (items.size == 1) { items[0].second(); return }
        AlertDialog.Builder(this, if (dark) android.R.style.Theme_DeviceDefault_Dialog_Alert else android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle(R.string.dmBrPick)
            .setItems(items.map { it.first }.toTypedArray()) { _, i -> items[i].second() }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    /* מסירה ל־DmActivity: הקישור בגלוי (Intent), והשאר — בתוך התהליך עם אסימון */
    private fun send(url: String, ref: String, file: Boolean = false) {
        // 25/10/2026: שם הסרטון מהדף (שם השיעור בקורס) — לא "playlist" של רשימת ה־HLS. באתר וידאו מוכר — הכותרת של yt-dlp
        if (pageIsVideo()) { handOver(url, ref, file, ""); return }
        var done = false
        val go = { t: String -> if (!done) { done = true; handOver(url, ref, file, t) } }
        ui.postDelayed({ go("") }, 1200)
        try {
            web.evaluateJavascript(TITLE_JS) { r -> go(if (r == null || !r.startsWith("\"")) "" else runCatching { org.json.JSONArray("[$r]").getString(0) }.getOrDefault("").trim().take(200)) }
        } catch (e: Exception) { go("") }
    }

    private fun handOver(url: String, ref: String, file: Boolean, title: String) {
        val ua = web.settings.userAgentString ?: ""
        val cm = CookieManager.getInstance()
        try { cm.flush() } catch (e: Throwable) {}
        // ל־yt-dlp (דף, HLS, DASH): קובץ עוגיות זמני של האתר — אותו מנגנון של Studio
        if (!file) try {
            val urls = (listOf(page, url) + found.list.map { it.url }).filter { it.startsWith("http") }.distinct()
            DlEngine.saveCookies(this, ref.ifEmpty { url }, DlDeep.netscape(urls.map { it to cm.getCookie(it) }, System.currentTimeMillis() / 1000), ua)
        } catch (e: Throwable) {}
        val tok = java.util.UUID.randomUUID().toString()
        synchronized(Companion) { handoff = Handoff(tok, url, ref, ua.take(400), true, refresh, System.currentTimeMillis(), title) }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url), this, DmActivity::class.java).putExtra(EXTRA_TOKEN, tok))
            finish()
        } catch (e: Exception) { Toast.makeText(this, R.string.dmErrFail, Toast.LENGTH_SHORT).show() }
    }

    private fun go(raw: String) {
        val t = raw.trim()
        if (t.isEmpty()) return
        val url = when {
            Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(t) -> t
            !t.contains(' ') && Regex("""^[\w.-]+\.[a-z]{2,}(/|$)""", RegexOption.IGNORE_CASE).containsMatchIn(t) -> "https://$t"
            else -> "https://www.google.com/search?q=" + Uri.encode(t)
        }
        bar.clearFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(bar.windowToken, 0)
        web.loadUrl(url)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }

    override fun onDestroy() {
        try { web.stopLoading(); web.destroy() } catch (e: Exception) {}
        super.onDestroy()
    }

    /** מה עובר לגיליון ההוספה מעבר לקישור */
    data class Handoff(val token: String, val url: String, val ref: String, val ua: String, val ck: Boolean, val refresh: String, val at: Long, val title: String = "")

    companion object {
        const val EXTRA_START = "dm_start"
        const val EXTRA_REFRESH = "dm_refresh"
        const val EXTRA_TOKEN = "dm_tok"
        private const val TTL_MS = 60_000L
        private var handoff: Handoff? = null

        /** המסירה — פעם אחת, רק עם האסימון הנכון, לאותו קישור, ותוך דקה */
        @Synchronized fun take(token: String?, url: String): Handoff? {
            val h = handoff ?: return null
            if (token.isNullOrEmpty() || token != h.token || url != h.url || System.currentTimeMillis() - h.at > TTL_MS) return null
            handoff = null
            return h
        }

        /**
         * שם הסרטון בדף: כותרת h1 גלויה שאינה שם האתר/הקורס (ב־schooler: "היכרות" ולא "המדריך המלא…"), אחרת og:title, אחרת
         * כותרת הדף. רק קורא טקסט
         */
        const val TITLE_JS = """(function(){try{
function n(s){return (s||'').replace(/\s+/g,' ').trim();}
function m(p){var e=document.querySelector('meta[property="'+p+'"]');return e?n(e.content):'';}
var og=m('og:title'),site=[n(document.title),og,m('og:site_name')];
var h=document.querySelectorAll('h1');
for(var i=0;i<h.length;i++){var r=h[i].getBoundingClientRect(),t=n(h[i].innerText||h[i].textContent);
if(r.width>0&&r.height>0&&t.length>1&&t.length<=150&&site.indexOf(t)<0)return t;}
return og||n(document.title);}catch(e){return '';}})()"""

        /** הסקריפט בדף — זהה לזה של דפדפן הציד ב־Studio: רק מדווח כתובות (מחרוזות), לא משנה כלום */
        private const val HOOK = """(function(){try{
var ch=window.snbHunt;if(!ch||window.__snbHunt)return;window.__snbHunt=1;
var R=/\.(m3u8?|mpd|mp4|m4v|webm|mov|mkv)(\?|#|$)|format=m3u8|m3u8-aapl|mpd-time-csf/i,seen={};
var pg='';function rep(u){try{if(!u)return;var p=location.pathname+location.search;if(p!==pg){pg=p;seen={};}u=new URL(String(u),location.href).href;if(u.indexOf('http')!==0||seen[u]||!R.test(u))return;seen[u]=1;ch.postMessage(u);}catch(e){}}
function ct(u,t){try{t=String(t||'').toLowerCase();if(!u||!t||/mp2t|iso\.segment/.test(t))return;var k=/mpegurl/.test(t)?'hls':/dash\+xml/.test(t)?'dash':/^(video|audio)\//.test(t)?'file':'';if(!k)return;u=new URL(String(u),location.href).href;if(u.indexOf('http')!==0||R.test(u)||seen['@'+u])return;seen['@'+u]=1;ch.postMessage('@'+k+' '+u);}catch(e){}}
var f=window.fetch;if(f)window.fetch=function(i){try{rep(i&&i.url?i.url:i);}catch(e){}var p=f.apply(this,arguments);try{p.then(function(r){try{ct(r.url,r.headers.get('content-type'));}catch(e){}},function(){});}catch(e){}return p;};
var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){rep(u);try{var x=this;x.addEventListener('load',function(){try{ct(x.responseURL||u,x.getResponseHeader('content-type'));}catch(e){}});}catch(e){}return o.apply(this,arguments);};
function scan(){var v=document.querySelectorAll('video,source');for(var k=0;k<v.length;k++){var s=v[k].currentSrc||v[k].src;if(s&&s.indexOf('blob:')!==0)rep(s);}}
document.addEventListener('play',scan,true);document.addEventListener('loadedmetadata',scan,true);setInterval(scan,3000);
}catch(e){}})();"""
    }
}
