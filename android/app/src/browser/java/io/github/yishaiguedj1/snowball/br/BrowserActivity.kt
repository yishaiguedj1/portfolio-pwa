package io.github.yishaiguedj1.snowball.br

import android.Manifest
import android.annotation.SuppressLint
import android.app.SearchManager
import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.os.SystemClock
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.yishaiguedj1.snowball.HuntMedia
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.dm.DmActivity
import io.github.yishaiguedj1.snowball.dm.DmBrowser
import io.github.yishaiguedj1.snowball.dm.DmEngine
import io.github.yishaiguedj1.snowball.dm.DmLang
import io.github.yishaiguedj1.snowball.dm.DmStore

/**
 * Studio Browser (26/10/2026, בקשת המשתמש: "דפדפן Chrome אחד לאחד, בגימור של Apple, עם כל היכולות הנוספות").
 * המבנה של Chrome: שורת הכתובת, מונה הטאבים, ⋮, מסך הטאבים ברשת, טאב חדש עם קיצורי דרך. מעליו — הצייד של DM
 * (אותו סקריפט ואותה בדיקה — DmBrowser.hook/headProbe) וההורדות בתוך האפליקציה (DmBrowser.handOff → DmActivity),
 * כך שהעוגיות של האתרים לא יוצאות מהאפליקציה. הממשק — BrUi.kt.
 */
class BrowserActivity : ComponentActivity() {
    enum class Screen { PAGE, SWITCHER, HISTORY, BOOKMARKS, SETTINGS }
    data class PermAsk(val host: String, val kind: Int, val go: (Boolean) -> Unit)   // kind: 1 מצלמה, 2 מיקרופון, 3 שניהם, 4 מיקום

    val tabs = mutableStateListOf<BrTab>()
    var cur by mutableStateOf<BrTab?>(null)
    var screen by mutableStateOf(Screen.PAGE)
    var editing by mutableStateOf(false)
    var menu by mutableStateOf(false)
    var finding by mutableStateOf(false)
    var findRes by mutableStateOf(0 to 0)
    var pick by mutableStateOf(false)
    var customView by mutableStateOf<View?>(null)
    var permAsk by mutableStateOf<PermAsk?>(null)
    var swPrivate by mutableStateOf(false)
    var markRev by mutableIntStateOf(0)
    var barBottom by mutableStateOf(false)
    var homeBtn by mutableStateOf(false)
    var engine by mutableStateOf("google")
    var isDefault by mutableStateOf(false)

    private val ui = Handler(Looper.getMainLooper())
    private var nextId = 1L
    private var customCb: WebChromeClient.CustomViewCallback? = null
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var permThen: ((Boolean) -> Unit)? = null
    lateinit var prefs: BrPrefs
    val privOk by lazy { runCatching { WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE) }.getOrDefault(false) }

    private val fileLaunch = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)); fileCb = null
    }
    private val permLaunch = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { m ->
        permThen?.invoke(m.values.all { it }); permThen = null
    }
    private val roleLaunch = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { checkDefault() }

    override fun attachBaseContext(base: Context) { super.attachBaseContext(DmLang.wrap(base)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        prefs = BrPrefs(this)
        barBottom = prefs.barBottom; homeBtn = prefs.homeBtn; engine = prefs.engine
        BrStore.init(this)
        DmStore.init(this)
        DmEngine.pump(this)
        swClient()
        // טאבים פרטיים לא שורדים סגירה של האפליקציה — מה שנשאר מהפעם הקודמת נמחק
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        val (saved, at) = BrStore.loadTabs()
        saved.forEach { tabs.add(BrTab(nextId++, it.url, it.title, false)) }
        if (!handle(intent)) {
            if (tabs.isEmpty()) newTab("") else select(tabs[at.coerceIn(0, tabs.size - 1)])
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { back() } })
        setContent { BrApp(this) }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }
    override fun onResume() { super.onResume(); checkDefault(); cur?.web?.onResume() }
    override fun onPause() {
        cur?.web?.onPause()
        saveSession()
        super.onPause()
    }

    override fun onDestroy() {
        tabs.forEach { t -> runCatching { t.web?.destroy() } }
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        super.onDestroy()
    }

    private fun saveSession() {
        val pub = tabs.filter { !it.private && it.url.startsWith("http") }
        BrStore.saveTabs(pub.map { BrTabRec(it.url, it.title) }, pub.indexOf(cur).coerceAtLeast(0))
        BrStore.saveNow()
    }

    /** קישור מאפליקציה אחרת / חיפוש / שיתוף — טאב חדש. true = נפתח משהו */
    private fun handle(i: Intent?): Boolean {
        i ?: return false
        val start = i.getStringExtra(DmBrowser.EXTRA_START) ?: ""
        val url = when (i.action) {
            Intent.ACTION_VIEW -> i.dataString?.takeIf { it.startsWith("http") } ?: ""
            Intent.ACTION_WEB_SEARCH -> i.getStringExtra(SearchManager.QUERY)?.let { BrStore.searchUrl(engine, it) } ?: ""
            Intent.ACTION_SEND -> i.getStringExtra(Intent.EXTRA_TEXT)?.let { BrStore.toUrl(Regex("""https?://\S+""").find(it)?.value ?: it, engine) } ?: ""
            else -> start
        }
        if (url.isEmpty()) return false
        screen = Screen.PAGE; editing = false
        newTab(url, fromApp = i.action == Intent.ACTION_VIEW)
        return true
    }

    /* ---------------- טאבים ---------------- */

    fun newTab(url: String, private: Boolean = false, fromApp: Boolean = false, after: BrTab? = null): BrTab {
        val t = BrTab(nextId++, "", "", private && privOk, fromApp)
        val i = after?.let { tabs.indexOf(it) + 1 } ?: tabs.size
        tabs.add(i.coerceIn(0, tabs.size), t)
        select(t)
        if (url.startsWith("http")) load(t, url) else editing = !fromApp
        return t
    }

    fun select(t: BrTab) {
        val old = cur
        if (old != null && old !== t) { snap(old); old.web?.onPause() }
        cur = t
        t.used = SystemClock.uptimeMillis()
        // טאב ששוחזר / שהשתחרר: עם מצב שמור — חוזר לאותו מקום; בלי — טוען את הכתובת מחדש
        if (t.web == null && (t.state != null || t.url.startsWith("http"))) {
            val fresh = t.state == null
            val w = ensureWeb(t)
            if (fresh) w.loadUrl(t.url)
        }
        t.web?.onResume()
        trim()
        finding = false
    }

    fun close(t: BrTab) {
        val i = tabs.indexOf(t)
        if (i < 0) return
        runCatching { t.web?.destroy() }
        t.web = null
        tabs.removeAt(i)
        if (t.private && tabs.none { it.private } && privOk) ui.postDelayed({ runCatching { ProfileStore.getInstance().deleteProfile(PRIV) } }, 300)
        if (cur === t) {
            val same = tabs.filter { it.private == t.private }
            when {
                same.isNotEmpty() -> select(same[(i - 1).coerceIn(0, same.size - 1).coerceAtMost(same.size - 1)])
                tabs.isNotEmpty() -> select(tabs.last())
                else -> newTab("")
            }
        }
    }

    fun closeAll(private: Boolean) {
        tabs.filter { it.private == private }.forEach { runCatching { it.web?.destroy() }; it.web = null }
        tabs.removeAll { it.private == private }
        if (private && privOk) ui.postDelayed({ runCatching { ProfileStore.getInstance().deleteProfile(PRIV) } }, 300)
        if (tabs.isEmpty()) { newTab(""); return }
        if (cur?.let { it in tabs } != true) select(tabs.last())
    }

    /** טאבים חיים מעבר ל־LIVE_MAX — שומרים את המצב ומשחררים את ה־WebView (כמו Chrome בטלפון) */
    private fun trim() {
        val live = tabs.filter { it.web != null && it !== cur }.sortedByDescending { it.used }
        for (t in live.drop(LIVE_MAX - 1)) {
            val b = Bundle(); runCatching { t.web?.saveState(b) }; t.state = b
            runCatching { t.web?.destroy() }; t.web = null
        }
    }

    /** תמונה קטנה של הדף למסך הטאבים */
    fun snap(t: BrTab) {
        val w = t.web ?: return
        if (w.width <= 0 || w.height <= 0) return
        runCatching {
            val s = 0.35f
            val b = Bitmap.createBitmap((w.width * s).toInt().coerceAtLeast(1), (w.height * s).toInt().coerceAtLeast(1), Bitmap.Config.RGB_565)
            val c = Canvas(b); c.scale(s, s); c.translate(-w.scrollX.toFloat(), -w.scrollY.toFloat())
            w.draw(c); t.thumb = b
        }
    }

    fun openSwitcher() { cur?.let { snap(it) }; swPrivate = cur?.private == true; menu = false; editing = false; screen = Screen.SWITCHER }

    /** החלקה על שורת הכתובת — הטאב הבא/הקודם באותו סוג (רגיל/פרטי), כמו ב־Chrome */
    fun swipeTab(dir: Int) {
        val c = cur ?: return
        val same = tabs.filter { it.private == c.private }
        val i = same.indexOf(c) + dir
        if (i in same.indices) select(same[i])
    }

    /* ---------------- ניווט ---------------- */

    fun go(raw: String) {
        val u = BrStore.toUrl(raw, engine)
        if (u.isEmpty()) return
        editing = false
        val t = cur ?: newTab("")
        load(t, u)
    }

    fun load(t: BrTab, url: String) {
        t.url = url
        val w = ensureWeb(t)
        w.loadUrl(url)
    }

    fun goHome() { cur?.let { t -> runCatching { t.web?.destroy() }; t.web = null; t.state = null; t.url = ""; t.title = ""; t.foundN = 0; t.found.clear() } ; editing = false }

    private fun back() {
        val t = cur
        when {
            customView != null -> hideCustom()
            permAsk != null -> { permAsk?.go?.invoke(false); permAsk = null }
            pick -> pick = false
            menu -> menu = false
            finding -> stopFind()
            editing -> editing = false
            screen != Screen.PAGE -> screen = if (screen == Screen.SWITCHER) Screen.PAGE else Screen.PAGE
            t?.web?.canGoBack() == true -> t.web?.goBack()
            t != null && t.fromApp -> { close(t); moveTaskToBack(true) }   // כמו Chrome: קישור מאפליקציה — "חזור" חוזר אליה
            else -> moveTaskToBack(true)
        }
    }

    fun forward() { cur?.web?.takeIf { it.canGoForward() }?.goForward(); menu = false }
    fun reload() { val w = cur?.web ?: return; if ((cur?.progress ?: 0) in 1..99) w.stopLoading() else w.reload(); menu = false }

    /* ---------------- WebView ---------------- */

    @SuppressLint("SetJavaScriptEnabled")
    fun ensureWeb(t: BrTab): WebView {
        t.web?.let { return it }
        val w = WebView(this)
        if (t.private && privOk) runCatching {
            ProfileStore.getInstance().getOrCreateProfile(PRIV)
            WebViewCompat.setProfile(w, PRIV)
        }
        val s = w.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.setSupportMultipleWindows(true)
        s.javaScriptCanOpenWindowsAutomatically = false
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        s.builtInZoomControls = true
        s.displayZoomControls = false
        s.setGeolocationEnabled(true)
        if (t.desktop) s.userAgentString = desktopUa(s.userAgentString)
        runCatching { (if (t.private && privOk) ProfileStore.getInstance().getProfile(PRIV)?.cookieManager else CookieManager.getInstance())?.setAcceptThirdPartyCookies(w, true) }

        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url.toString()
                val sc = req.url.scheme?.lowercase()
                if (sc == "http" || sc == "https") return false
                if (sc == "about" || sc == "javascript" || sc == "data" || sc == "blob") return false
                external(u, t)
                return true
            }
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? { seen(t, req.url.toString(), headers = req.requestHeaders); return null }
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (url != t.page) { t.page = url; t.found.clear(); synchronized(t.headSeen) { t.headSeen.clear() }; t.recount() }
                if (BrStore.hostOf(url) != BrStore.hostOf(t.url)) t.icon = null
                t.url = url; if (favicon != null) t.icon = favicon
                navState(t, view)
            }
            // אתר של "דף אחד" (קורס, פיד): מעבר בלי טעינת דף — כמו ב־DmBrowser
            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                if (t.page.isNotEmpty() && !HuntMedia.samePage(url, t.page)) {
                    synchronized(t.headSeen) { t.headSeen.clear() }; t.found.navigated(SystemClock.uptimeMillis())
                }
                t.page = url; t.url = url; t.recount()
                if (!t.private) BrStore.visit(url, view.title ?: "")
                navState(t, view)
            }
            override fun onPageFinished(view: WebView, url: String) {
                t.url = url; t.page = url
                view.title?.let { if (it.isNotEmpty()) { t.title = it; if (!t.private) BrStore.setTitle(url, it) } }
                t.recount(); navState(t, view)
                markRev++
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { t.progress = p }
            override fun onReceivedTitle(view: WebView, title: String?) { if (!title.isNullOrEmpty()) { t.title = title; if (!t.private) BrStore.setTitle(t.url, title) } }
            override fun onReceivedIcon(view: WebView, icon: Bitmap?) { if (icon != null) t.icon = icon }
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                if (!isUserGesture) return false   // חלון קופץ בלי נגיעה — חסום, כמו ב־Chrome
                val nt = newTab("", private = t.private, after = t)
                editing = false
                val nw = ensureWeb(nt)
                (resultMsg.obj as WebView.WebViewTransport).webView = nw
                resultMsg.sendToTarget()
                return true
            }
            override fun onCloseWindow(window: WebView) { tabs.firstOrNull { it.web === window }?.let { close(it) } }
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                return try { fileLaunch.launch(p.createIntent()); true } catch (e: Exception) { fileCb = null; false }
            }
            override fun onShowCustomView(v: View, cb: CustomViewCallback) {
                customCb?.onCustomViewHidden(); customCb = cb; customView = v
                WindowInsetsControllerCompat(window, window.decorView).apply {
                    hide(WindowInsetsCompat.Type.systemBars()); systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            }
            override fun onHideCustomView() { hideCustom(false) }
            override fun onPermissionRequest(req: PermissionRequest) {
                val cam = PermissionRequest.RESOURCE_VIDEO_CAPTURE in req.resources
                val mic = PermissionRequest.RESOURCE_AUDIO_CAPTURE in req.resources
                if (!cam && !mic) { req.deny(); return }
                val need = buildList { if (cam) add(Manifest.permission.CAMERA); if (mic) add(Manifest.permission.RECORD_AUDIO) }
                ask(req.origin.host ?: "", if (cam && mic) 3 else if (cam) 1 else 2, need) { ok ->
                    if (ok) req.grant(req.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && cam || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && mic }.toTypedArray()) else req.deny()
                }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                ask(Uri.parse(origin).host ?: origin, 4, listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) { ok -> cb.invoke(origin, ok, false) }
            }
        }
        // הורדה שהדף מתחיל — למנהל ההורדות (DmActivity), עם העוגיות של האתר
        w.setDownloadListener { url, _, _, _, _ -> if (url.startsWith("http")) send(t, url, t.page, file = true) }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(w, "snbHunt", setOf("*")) { _, msg, _, _, _ -> msg.data?.let { seen(t, it, hook = true) } }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(w, DmBrowser.hook, setOf("*"))
        }
        w.setFindListener { active, count, done -> if (done) findRes = (if (count == 0) 0 else active + 1) to count }
        t.web = w
        t.state?.let { st -> runCatching { w.restoreState(st) }; t.state = null }
        return w
    }

    private fun navState(t: BrTab, w: WebView) { t.canBack = w.canGoBack(); t.canFwd = w.canGoForward() }

    /** בקשות של Service Worker — לטאב הנוכחי (אין דרך לדעת מאיזה טאב) */
    private fun swClient() = runCatching {
        ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
            override fun shouldInterceptRequest(req: WebResourceRequest): WebResourceResponse? { cur?.let { seen(it, req.url.toString(), headers = req.requestHeaders) }; return null }
        })
    }

    /** קישור לאפליקציה (intent:, mailto:, tel:, market:…) — כמו ב־Chrome: לאפליקציה שמתאימה, ובלעדיה — כתובת הגיבוי */
    private fun external(u: String, t: BrTab) {
        val i = try {
            if (u.startsWith("intent:")) Intent.parseUri(u, Intent.URI_INTENT_SCHEME).apply { component = null; selector = null }
            else Intent(Intent.ACTION_VIEW, Uri.parse(u))
        } catch (e: Exception) { return }
        i.addCategory(Intent.CATEGORY_BROWSABLE)
        try { startActivity(i) } catch (e: ActivityNotFoundException) {
            val fb = i.getStringExtra("browser_fallback_url")
            if (fb != null && fb.startsWith("http")) load(t, fb) else Toast.makeText(this, R.string.brNoApp, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {}
    }

    /* ---------------- הצייד ---------------- */

    private fun seen(t: BrTab, url: String, hook: Boolean = false, headers: Map<String, String>? = null) {
        val h = (if (hook) HuntMedia.fromHook(url) else HuntMedia.fromRequest(url, headers)) ?: return
        val now = SystemClock.uptimeMillis()
        if (h.kind != HuntMedia.Kind.FILE) { ui.post { if (t.found.add(h, now)) t.recount() }; return }
        synchronized(t.headSeen) { if (!t.headSeen.add(h.url) || t.headSeen.size > 60) return }
        val ref = t.page
        val ua = runCatching { t.web?.settings?.userAgentString }.getOrNull() ?: ""
        Thread { if (DmBrowser.headProbe(h, ref, ua)) ui.post { if (t.found.add(h, now)) t.recount() } }.start()
    }

    data class Pick(val label: Int, val host: String, val url: String, val file: Boolean, val page: Boolean)

    fun picks(t: BrTab): List<Pick> = buildList {
        if (t.pageIsVideo()) add(Pick(R.string.brPage, BrStore.hostOf(t.page), t.page, false, true))
        for (h in t.found.list) add(Pick(when (h.kind) { HuntMedia.Kind.HLS -> R.string.brHls; HuntMedia.Kind.DASH -> R.string.brDash; else -> R.string.brFile }, h.host, h.url, h.kind == HuntMedia.Kind.FILE, false))
    }

    fun download(p: Pick) {
        pick = false
        val t = cur ?: return
        send(t, p.url, if (p.page) "" else t.page, p.file)
    }

    /** למנהל ההורדות: שם הסרטון מהדף (DmBrowser.TITLE_JS), ואז המסירה בתוך התהליך */
    private fun send(t: BrTab, url: String, ref: String, file: Boolean) {
        val w = t.web
        var done = false
        val go = { title: String ->
            if (!done) {
                done = true
                val urls = listOf(t.page, url) + t.found.list.map { it.url }
                if (!DmBrowser.handOff(this, url, ref, file, title, w?.settings?.userAgentString ?: "", urls)) Toast.makeText(this, R.string.dmErrFail, Toast.LENGTH_SHORT).show()
            }
        }
        if (t.pageIsVideo() || w == null) { go(""); return }
        ui.postDelayed({ go("") }, 1200)
        try {
            w.evaluateJavascript(DmBrowser.TITLE_JS) { r -> go(if (r == null || !r.startsWith("\"")) "" else runCatching { org.json.JSONArray("[$r]").getString(0) }.getOrDefault("").trim().take(200)) }
        } catch (e: Exception) { go("") }
    }

    fun openDownloads() { menu = false; runCatching { startActivity(Intent(this, DmActivity::class.java)) } }

    /* ---------------- תפריט ---------------- */

    fun toggleMark() {
        val t = cur ?: return
        if (!t.url.startsWith("http")) return
        val on = BrStore.toggleMark(t.url, t.title)
        markRev++
        Toast.makeText(this, if (on) R.string.brAdded else R.string.brRemoved, Toast.LENGTH_SHORT).show()
    }

    fun share() {
        menu = false
        val t = cur ?: return
        if (!t.url.startsWith("http")) return
        runCatching { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t.url).putExtra(Intent.EXTRA_SUBJECT, t.title), getString(R.string.brShare))) }
    }

    fun copyLink() {
        val t = cur ?: return
        getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("url", t.url))
        Toast.makeText(this, R.string.brCopied, Toast.LENGTH_SHORT).show()
    }

    fun translate() {
        menu = false
        val t = cur ?: return
        if (!t.url.startsWith("http") || t.url.contains("translate.goog") || t.url.contains("translate.google.")) return
        val lang = resources.configuration.locales[0].language.let { if (it == "iw") "he" else it }
        load(t, "https://translate.google.com/translate?sl=auto&tl=$lang&u=" + Uri.encode(t.url))
    }

    fun toggleDesktop() {
        menu = false
        val t = cur ?: return
        t.desktop = !t.desktop
        val w = t.web ?: return
        w.settings.userAgentString = if (t.desktop) desktopUa(android.webkit.WebSettings.getDefaultUserAgent(this)) else null
        w.reload()
    }

    fun install() {
        menu = false
        val t = cur ?: return
        if (!t.url.startsWith("http")) return
        val sm = getSystemService(ShortcutManager::class.java) ?: return
        if (!sm.isRequestPinShortcutSupported) return
        val icon = t.icon?.let { Icon.createWithBitmap(it) } ?: Icon.createWithResource(this, R.mipmap.br_launcher)
        val info = ShortcutInfo.Builder(this, "br-" + t.url.hashCode())
            .setShortLabel(t.title.ifEmpty { BrStore.hostOf(t.url) }.take(24))
            .setIcon(icon)
            .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse(t.url), this, BrowserActivity::class.java))
            .build()
        runCatching { sm.requestPinShortcut(info, null) }
    }

    fun startFind() { menu = false; finding = true; findRes = 0 to 0 }
    fun find(q: String) { val w = cur?.web ?: return; if (q.isEmpty()) { w.clearMatches(); findRes = 0 to 0 } else w.findAllAsync(q) }
    fun findNext(fwd: Boolean) { cur?.web?.findNext(fwd) }
    fun stopFind() { cur?.web?.clearMatches(); finding = false }

    private fun hideCustom(notify: Boolean = true) {
        if (notify) runCatching { customCb?.onCustomViewHidden() }
        customCb = null; customView = null
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
    }

    /** הרשאה לאתר: קודם שואלים אותך (בשם האתר), ואז את אנדרואיד — רק מה שחסר */
    private fun ask(host: String, kind: Int, need: List<String>, then: (Boolean) -> Unit) {
        permAsk = PermAsk(host, kind) { ok ->
            permAsk = null
            if (!ok) { then(false); return@PermAsk }
            val miss = need.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            if (miss.isEmpty()) then(true) else { permThen = { g -> then(g || need.any { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) }; permLaunch.launch(miss.toTypedArray()) }
        }
    }

    /* ---------------- הגדרות ---------------- */

    fun pickEngine(e: String) { engine = e; prefs.engine = e }
    fun pickBarBottom(b: Boolean) { barBottom = b; prefs.barBottom = b }
    fun pickHomeBtn(b: Boolean) { homeBtn = b; prefs.homeBtn = b }

    private fun checkDefault() {
        isDefault = if (Build.VERSION.SDK_INT >= 29) runCatching { getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_BROWSER) == true }.getOrDefault(false) else false
    }

    fun makeDefault() {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_BROWSER) && !rm.isRoleHeld(RoleManager.ROLE_BROWSER)) {
                runCatching { roleLaunch.launch(rm.createRequestRoleIntent(RoleManager.ROLE_BROWSER)) }.onSuccess { return }
            }
        }
        runCatching { startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)) }
    }

    fun clearData() {
        BrStore.clearHistory()
        runCatching { CookieManager.getInstance().removeAllCookies(null); CookieManager.getInstance().flush() }
        runCatching { WebStorage.getInstance().deleteAllData() }
        tabs.forEach { t -> runCatching { t.web?.clearCache(true) } }
        markRev++
        Toast.makeText(this, R.string.brClearDone, Toast.LENGTH_SHORT).show()
    }

    fun dlSettings() { runCatching { startActivity(Intent(this, DmActivity::class.java)) } }

    fun version(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName ?: "" }.getOrDefault("")

    companion object {
        const val PRIV = "private"
        const val LIVE_MAX = 6

        /** "אתר למחשב": ה־User-Agent של Chrome במחשב, באותה גרסה של המנוע */
        fun desktopUa(def: String): String {
            val v = Regex("""Chrome/([\d.]+)""").find(def)?.groupValues?.get(1) ?: "130.0.0.0"
            return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$v Safari/537.36"
        }
    }
}
