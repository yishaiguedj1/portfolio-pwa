package io.github.yishaiguedj1.snowball.br

import android.Manifest
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.PictureInPictureParams
import android.app.SearchManager
import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
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
import android.os.CancellationSignal
import android.os.SystemClock
import android.util.Rational
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.View
import android.view.WindowManager
import android.view.textclassifier.TextClassifier
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
import androidx.activity.result.IntentSenderRequest
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
import io.github.yishaiguedj1.snowball.AppRoute
import io.github.yishaiguedj1.snowball.HuntMedia
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.dm.DmActivity
import io.github.yishaiguedj1.snowball.dm.DmBrowser
import io.github.yishaiguedj1.snowball.dm.DmEngine
import io.github.yishaiguedj1.snowball.dm.DmLang
import io.github.yishaiguedj1.snowball.dm.DmPre
import io.github.yishaiguedj1.snowball.dm.DmPrefs
import io.github.yishaiguedj1.snowball.dm.DmSubs
import io.github.yishaiguedj1.snowball.dm.DmStore

/**
 * Studio Browser (26/10/2026, בקשת המשתמש: "דפדפן Chrome אחד לאחד, בגימור של Apple, עם כל היכולות הנוספות").
 * המבנה של Chrome: שורת הכתובת, מונה הטאבים, ⋮, מסך הטאבים ברשת, טאב חדש עם קיצורי דרך. מעליו — הצייד של DM
 * (אותו סקריפט ואותה בדיקה — DmBrowser.hook/headProbe) וההורדות בתוך האפליקציה (DmBrowser.handOff → DmActivity),
 * כך שהעוגיות של האתרים לא יוצאות מהאפליקציה. הממשק — BrUi.kt.
 */
class BrowserActivity : ComponentActivity() {
    enum class Screen { PAGE, SWITCHER, HISTORY, BOOKMARKS, SETTINGS, ENGINE, PASSWORDS, PRIVACY, BARPOS, IMPORT, CHROME, SITES, SITE, VIDEO }
    /** עמודי המשנה של ההגדרות — "חזור" מהם חוזר להגדרות, לא לדף (אתר אחד — חוזר לרשימת האתרים) */
    private val settingsSubs = setOf(Screen.ENGINE, Screen.PASSWORDS, Screen.PRIVACY, Screen.BARPOS, Screen.IMPORT, Screen.CHROME, Screen.SITES, Screen.VIDEO)
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
    /** הסנכרון עם Chrome (BrChrome) השתנה — המסך מתעדכן */
    var chromeRev by mutableIntStateOf(0)
    var barBottom by mutableStateOf(false)
    var homeBtn by mutableStateOf(false)
    var engine by mutableStateOf("google")
    var isDefault by mutableStateOf(false)
    var bubble by mutableStateOf(true)
    var suggestOn by mutableStateOf(true)
    var zoom by mutableIntStateOf(100)
    var lastImport by mutableStateOf("")
    /** גיליונות ותיבות שפתוחים מעל הדף — "חזור" סוגר אותם קודם */
    var info by mutableStateOf(false)
    var zoomSheet by mutableStateOf(false)
    var clearAsk by mutableStateOf(false)
    /** בסימניות: 0 = הכל, 1 = סימניות בנייד, 2 = מיובאות מ־Chrome */
    var markFolder by mutableIntStateOf(0)

    /* שלב 3 (26/10): פרטיות ווידאו */
    var shield by mutableStateOf(true)
    var cookies by mutableStateOf(true)
    var lockPriv by mutableStateOf(false)
    var bgPlay by mutableStateOf(true)
    var pip by mutableStateOf(true)
    var speedSheet by mutableStateOf(false)
    /** הטאבים הפרטיים נעולים עד טביעת אצבע / קוד המסך (אחרי שהאפליקציה יצאה לרקע) */
    var privLocked by mutableStateOf(false)
    var inPip by mutableStateOf(false)
    /** האתר שפתוח במסך "הגדרות האתר" */
    var siteHost by mutableStateOf("")
    var sitesRev by mutableIntStateOf(0)
    /** ההגדרות לכל אתר — מתחלף כולו בכל שינוי (נקרא גם מהת׳רד של הרשת) */
    @Volatile var rules: Map<String, BrShield.SiteRule> = emptyMap()

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
    private val importLaunch = registerForActivityResult(ActivityResultContracts.OpenDocument()) { u -> if (u != null) importFrom(u) }
    private val chromeLaunch = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { r ->
        if (!BrChrome.connected(this, r.data)) Toast.makeText(this, R.string.brSyncNoAuth, Toast.LENGTH_LONG).show()
        chromeRev++
    }
    private val exportLaunch = registerForActivityResult(ActivityResultContracts.CreateDocument("text/html")) { u -> if (u != null) exportTo(u) }
    private val voiceLaunch = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val q = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
        if (!q.isNullOrEmpty()) { screen = Screen.PAGE; go(q) }
    }

    override fun attachBaseContext(base: Context) { super.attachBaseContext(DmLang.wrap(base)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        prefs = BrPrefs(this)
        barBottom = prefs.barBottom; homeBtn = prefs.homeBtn; engine = prefs.engine; bubble = prefs.bubble
        suggestOn = prefs.suggest; zoom = prefs.zoom; lastImport = prefs.lastImport
        shield = prefs.shield; cookies = prefs.cookies; lockPriv = prefs.lockPriv; bgPlay = prefs.bgPlay; pip = prefs.pip
        rules = BrShield.decode(prefs.sites)
        BrStore.init(this)
        BrPics.init(this)
        BrMedia.onCmd = { play -> ui.post { mediaCmd(play) } }
        BrChrome.init(this); BrChrome.attach(this)
        BrChrome.onChange = { chromeRev++; markRev++ }
        DmStore.init(this)
        DmEngine.pump(this)
        swClient()
        // טאבים פרטיים לא שורדים סגירה של האפליקציה — מה שנשאר מהפעם הקודמת נמחק
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        val (saved, at) = BrStore.loadTabs()
        saved.forEach { tabs.add(BrTab(nextId++, it.url, it.title, false).apply { thumb = BrPics.thumb(it.url) }) }
        if (!handle(intent)) {
            if (tabs.isEmpty()) newTab("") else select(tabs[at.coerceIn(0, tabs.size - 1)])
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { back() } })
        setContent { BrApp(this) }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }
    override fun onResume() {
        super.onResume(); checkDefault(); checkFill(); cur?.web?.onResume(); BrChrome.sync(this); ui.postDelayed(chromeTick, CHROME_EVERY)
        // חזרה מניגון ברקע — הדף שוב יודע שהוא מוצג, והשירות נעצר
        if (bgOn) { bgOn = false; runCatching { bgTab?.web?.evaluateJavascript(BrShield.bgJs(false), null) }; bgTab = null; BrMedia.stop(this) }
        if (privLocked && showsPrivate()) unlockPriv()
    }
    /** ניגון ברקע: הטאב שממשיך לנגן כשהאפליקציה לא מוצגת */
    private var bgOn = false
    private var bgTab: BrTab? = null
    /** כל עוד האפליקציה פתוחה — סנכרון עם Chrome כל כמה דקות (התוסף במחשב מסנכרן בקצב דומה) */
    private val chromeTick: Runnable = Runnable { BrChrome.sync(this); ui.postDelayed(chromeTick, CHROME_EVERY) }
    override fun onPause() {
        ui.removeCallbacks(chromeTick)
        val t = cur
        when {
            isInPictureInPictureMode -> {}   // תמונה בתוך תמונה — הסרטון ממשיך
            // משהו מתנגן ו"ניגון ברקע" פועל: לא משהים את הדף, מסתירים ממנו שהאפליקציה ברקע, ומעלים שירות עם התראה
            bgPlay && t != null && t.playing && t.web != null -> {
                bgOn = true; bgTab = t
                runCatching { t.web?.evaluateJavascript(BrShield.bgJs(true), null) }
                // טאב פרטי — בלי שם הדף והאתר בהתראה (היא מופיעה גם במסך הנעילה)
                if (t.private) BrMedia.start(this, getString(R.string.brPrivate), "") else BrMedia.start(this, t.title, BrStore.hostOf(t.url))
            }
            else -> t?.web?.onPause()
        }
        saveSession()
        super.onPause()
    }

    override fun onStop() {
        super.onStop()
        if (lockPriv && tabs.any { it.private } && canLock()) privLocked = true
    }

    /** פקודה מההתראה / מסך הנעילה / האוזניות: true = להמשיך, false = להשהות, null = לסגור */
    private fun mediaCmd(play: Boolean?) {
        val w = bgTab?.web ?: return
        runCatching { w.evaluateJavascript(if (play == true) BrShield.RESUME_JS else BrShield.PAUSE_JS, null) }
        if (play == null) { bgOn = false; bgTab = null }
    }

    /* תמונה בתוך תמונה: סרטון במסך מלא + יציאה מהאפליקציה (כפתור הבית / החלקה) — ממשיך בחלון קטן, כמו ב־Chrome */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT < 31 && pip && customView != null && !privLocked) runCatching { enterPictureInPictureMode(pipParams(false)) }
    }

    private fun pipParams(auto: Boolean): PictureInPictureParams {
        val b = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
        if (Build.VERSION.SDK_INT >= 31) b.setAutoEnterEnabled(auto).setSeamlessResizeEnabled(true)
        return b.build()
    }

    override fun onPictureInPictureModeChanged(isInPip: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPip, newConfig)
        inPip = isInPip
        if (!isInPip && !hasWindowFocus() && customView != null) runCatching { cur?.web?.onPause() }   // סגרת את החלון הקטן
    }

    /* ---------------- נעילת הטאבים הפרטיים ---------------- */

    fun showsPrivate() = (screen == Screen.PAGE && cur?.private == true) || (screen == Screen.SWITCHER && swPrivate)

    /** יש בטלפון נעילת מסך — בלעדיה אין במה לנעול */
    fun canLock(): Boolean = runCatching { getSystemService(KeyguardManager::class.java)?.isDeviceSecure == true }.getOrDefault(false)

    private var unlocking = false
    fun unlockPriv() {
        if (!privLocked || unlocking) return
        if (!canLock()) { privLocked = false; return }
        unlocking = true
        val b = BiometricPrompt.Builder(this).setTitle(getString(R.string.brLockTitle)).setSubtitle(getString(R.string.brLockSub))
        if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        else @Suppress("DEPRECATION") b.setDeviceCredentialAllowed(true)
        runCatching {
            b.build().authenticate(CancellationSignal(), mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(r: BiometricPrompt.AuthenticationResult) { unlocking = false; privLocked = false }
                override fun onAuthenticationError(code: Int, msg: CharSequence) { unlocking = false }
            })
        }.onFailure { unlocking = false }
    }

    /** "לטאבים הרגילים" ממסך הנעילה */
    fun leavePrivate() {
        swPrivate = false
        if (cur?.private == true) tabs.lastOrNull { !it.private }?.let { select(it) } ?: newTab("")
        if (screen != Screen.SWITCHER) screen = Screen.PAGE
    }

    /** טאב פרטי על המסך (או במסך הטאבים) — בלי צילומי מסך ובלי תמונה במסך האפליקציות האחרונות, כמו ב־Chrome */
    fun applySecure() {
        if (showsPrivate() || (screen == Screen.SWITCHER && tabs.any { it.private } && privLocked)) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    override fun onDestroy() {
        BrMedia.onCmd = null
        if (isFinishing) BrMedia.stop(this)
        tabs.forEach { t -> runCatching { t.web?.destroy() } }
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        super.onDestroy()
    }

    private fun saveSession() {
        val pub = tabs.filter { !it.private && it.url.startsWith("http") }
        BrStore.saveTabs(pub.map { BrTabRec(it.url, it.title) }, pub.indexOf(cur).coerceAtLeast(0))
        cur?.takeIf { !it.private }?.let { snap(it) }
        if (blkNew > 0) { prefs.blockedAll = prefs.blockedAll + blkNew; blkNew = 0 }
        BrPics.keepThumbs(pub.map { it.url })
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
        val t = newTab(url, fromApp = i.action == Intent.ACTION_VIEW)
        // מהבועה ב־Chrome: הצייד כאן רואה את הזרמים האמיתיים של הדף — כשנמצא משהו, רשימת ההורדה נפתחת לבד.
        // רק פותח את הרשימה — שום הורדה לא מתחילה בלי נגיעה שלך
        if (i.getBooleanExtra(AppRoute.EXTRA_HUNT, false)) { t.autoPick = SystemClock.uptimeMillis() + HUNT_MS; autoPick(t) }
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
            if (!t.private) BrPics.saveThumb(t.url, b)   // שורד סגירה של האפליקציה (מסך הטאבים אחרי ההפעלה הבאה)
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
            clearAsk -> clearAsk = false
            zoomSheet -> zoomSheet = false
            speedSheet -> speedSheet = false
            info -> info = false
            menu -> menu = false
            finding -> stopFind()
            editing -> editing = false
            screen == Screen.SITE -> screen = Screen.SITES
            screen in settingsSubs -> screen = Screen.SETTINGS
            screen == Screen.BOOKMARKS && markFolder != 0 -> markFolder = 0
            screen != Screen.PAGE -> screen = Screen.PAGE
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
        // מנהל הסיסמאות של Google (וכל שירות מילוי אחר) ממלא בדפים דרך המילוי האוטומטי של אנדרואיד — WebView תומך בו;
        // כאן רק מוודאים שהוא לא כבוי בטעות לאזור הדף
        if (Build.VERSION.SDK_INT >= 26) w.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
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
        s.textZoom = zoom
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
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                if (!req.isForMainFrame && blockReq(t, req.url.host)) return EMPTY()
                seen(t, req.url.toString(), headers = req.requestHeaders); return null
            }
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (url != t.page) { t.page = url; t.vid = null; t.blocked = 0; t.playing = false; t.found.clear(); synchronized(t.headSeen) { t.headSeen.clear() }; t.recount(); autoPick(t) }
                if (BrStore.hostOf(url) != BrStore.hostOf(t.url)) t.icon = null
                t.url = url; if (favicon != null) { t.icon = favicon; if (!t.private) BrPics.saveIcon(BrStore.hostOf(url), favicon) }
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
                pageScripts(t, view, url)
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { t.progress = p }
            override fun onReceivedTitle(view: WebView, title: String?) { if (!title.isNullOrEmpty()) { t.title = title; if (!t.private) BrStore.setTitle(t.url, title) } }
            override fun onReceivedIcon(view: WebView, icon: Bitmap?) { if (icon != null) { t.icon = icon; if (!t.private) BrPics.saveIcon(BrStore.hostOf(t.url), icon) } }
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
                if (Build.VERSION.SDK_INT >= 31) runCatching { setPictureInPictureParams(pipParams(pip && !t.private)) }   // יציאה מהאפליקציה = חלון קטן
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
                ask(req.origin.host ?: "", if (cam && mic) 3 else if (cam) 1 else 2, need, t.private) { ok ->
                    if (ok) req.grant(req.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && cam || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && mic }.toTypedArray()) else req.deny()
                }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                ask(Uri.parse(origin).host ?: origin, 4, listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), t.private) { ok -> cb.invoke(origin, ok, false) }
            }
        }
        // הורדה שהדף מתחיל — למנהל ההורדות (DmActivity), עם העוגיות של האתר
        w.setDownloadListener { url, _, _, _, _ -> if (url.startsWith("http")) send(t, url, t.page, file = true) }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(w, "snbHunt", setOf("*")) { _, msg, _, _, _ -> msg.data?.let { seen(t, it, hook = true) } }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(w, DmBrowser.hook, setOf("*"))
            // הנגן שעל המסך — רק מהמסגרת הראשית (הבועה נצמדת אליו; BrVideo)
            WebViewCompat.addWebMessageListener(w, "snbVid", setOf("*")) { _, msg, _, main, _ ->
                if (main) when (val d = msg.data) {
                    BrVideo.TAP -> if (cur === t && screen == Screen.PAGE) bubbleTap()   // הכפתור שעל הנגן
                    BrVideo.HELLO -> pushDl(t)                                         // מסמך חדש — כמה נמצא והתווית
                    else -> {
                        val k = d?.let { BrVideo.pickOf(it, dlKey) }
                        if (k != null) menuPick(t, k)                                  // בחירה מהתפריט שעל הנגן
                        else if (d?.startsWith(BrVideo.PICK) != true) t.vid = BrVideo.parse(d)
                    }
                }
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(w, BrVideo.JS, setOf("*"))
            // מה מתנגן בדף (כל המסגרות) — לניגון ברקע; ובאותו סקריפט מהירות הווידאו של האתר
            WebViewCompat.addWebMessageListener(w, "snbPlay", setOf("*")) { _, msg, _, _, _ ->
                val p = msg.data == "1"; t.playing = p
                if (bgOn && bgTab === t) BrMedia.state(this, p)
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(w, BrShield.PLAY_JS, setOf("*"))
        }
        w.setFindListener { active, count, done -> if (done) findRes = (if (count == 0) 0 else active + 1) to count }
        t.web = w
        t.state?.let { st -> runCatching { w.restoreState(st) }; t.state = null }
        return w
    }

    private fun navState(t: BrTab, w: WebView) { t.canBack = w.canGoBack(); t.canFwd = w.canGoForward() }

    /* ---------------- שלב 3: ההגנה, הודעות העוגיות ומהירות הווידאו ---------------- */

    /** ההגנה פועלת באתר הזה? (המתג הכללי, וכלום לא כובה לאתר — "הגנה באתר הזה" בפרטי האתר) */
    fun shieldOn(host: String) = shield && rules[host.lowercase().removePrefix("www.")]?.shield != false
    fun rule(host: String) = rules[host] ?: BrShield.SiteRule(host)

    /** רץ בת׳רד של הרשת: בקשה של פרסום/מעקב מצד שלישי — נחסמת ונספרת */
    private fun blockReq(t: BrTab, reqHost: String?): Boolean {
        val pageHost = BrStore.hostOf(t.page)
        if (reqHost == null || !shieldOn(pageHost) || !BrShield.blocks(reqHost, pageHost)) return false
        ui.post { t.blocked++; blkNew++ }
        return true
    }

    /** אחרי שהדף נטען: הודעות העוגיות (דחייה / הסתרה) ומהירות הווידאו שבחרת לאתר */
    private fun pageScripts(t: BrTab, w: WebView, url: String) {
        if (!url.startsWith("http")) return
        val host = BrStore.hostOf(url)
        if (cookies && shieldOn(host)) runCatching { w.evaluateJavascript(BrShield.COOKIE_JS, null) }
        val sp = rules[host]?.speed ?: 100
        if (sp != 100) runCatching { w.evaluateJavascript(BrShield.speedJs(sp), null) }
    }

    /** שינוי בהגדרות של אתר אחד — נשמר מיד; הגדרה שחזרה לברירת המחדל נמחקת מהרשימה */
    fun setRule(host: String, f: (BrShield.SiteRule) -> BrShield.SiteRule) {
        val m = LinkedHashMap(rules)
        val r = f(m[host] ?: BrShield.SiteRule(host))
        if (r.empty) m.remove(host) else m[host] = r
        rules = m; prefs.sites = BrShield.encode(m.values); sitesRev++
    }

    fun forgetSite(host: String) { setRule(host) { BrShield.SiteRule(host) }; if (screen == Screen.SITE) screen = Screen.SITES }
    fun forgetAllSites() { rules = emptyMap(); prefs.sites = ""; sitesRev++ }

    /** "הגנה באתר הזה" (מפרטי האתר) — ונטען מחדש, כדי שיראו מיד את ההבדל */
    fun toggleSiteShield(t: BrTab) {
        val h = BrStore.hostOf(t.url).ifEmpty { return }
        setRule(h) { it.copy(shield = !it.shield) }
        t.web?.reload()
    }

    /** מהירות הווידאו — לדף הזה עכשיו, ונזכרת לאתר (100 = רגיל) */
    fun pickSpeed(pct: Int) {
        val t = cur ?: return
        val h = BrStore.hostOf(t.url)
        if (h.isNotEmpty() && !t.private) setRule(h) { it.copy(speed = pct) }
        runCatching { t.web?.evaluateJavascript(BrShield.speedJs(pct), null) }
        speedSheet = false
    }
    fun speedOf(t: BrTab?): Int = t?.let { rules[BrStore.hostOf(it.url)]?.speed } ?: 100

    fun pickShield(b: Boolean) { shield = b; prefs.shield = b; tabs.forEach { runCatching { it.web?.reload() } } }
    fun pickCookies(b: Boolean) { cookies = b; prefs.cookies = b }
    fun pickLockPriv(b: Boolean) { lockPriv = b; prefs.lockPriv = b; if (!b) privLocked = false }
    fun pickBgPlay(b: Boolean) { bgPlay = b; prefs.bgPlay = b }
    fun pickPip(b: Boolean) { pip = b; prefs.pip = b; if (Build.VERSION.SDK_INT >= 31 && customView != null) runCatching { setPictureInPictureParams(pipParams(b)) } }
    /** הספירה נשמרת רק ביציאה מהאפליקציה — לא כתיבה לקובץ בכל בקשה שנחסמה */
    private var blkNew = 0L
    fun blockedAll() = prefs.blockedAll + blkNew

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
        if (h.kind != HuntMedia.Kind.FILE) { ui.post { if (t.found.add(h, now)) { t.recount(); autoPick(t) } }; return }
        synchronized(t.headSeen) { if (!t.headSeen.add(h.url) || t.headSeen.size > 60) return }
        val ref = t.page
        val ua = runCatching { t.web?.settings?.userAgentString }.getOrNull() ?: ""
        Thread { if (DmBrowser.headProbe(h, ref, ua)) ui.post { if (t.found.add(h, now)) { t.recount(); autoPick(t) } } }.start()
    }

    /* נפתח מהבועה ב־Chrome: הממצא הראשון → הרשימה נפתחת אחרי רגע (שיספיקו להגיע עוד איכויות). דף שהוא עצמו סרטון
       מוכר (יוטיוב…) — מיד כשנטען */
    private fun autoPick(t: BrTab) {
        if (t.autoPick == 0L) return
        if (SystemClock.uptimeMillis() > t.autoPick) { t.autoPick = 0L; return }
        if (t.foundN == 0) return
        t.autoPick = 0L
        ui.postDelayed({ if (cur === t && screen == Screen.PAGE && !editing && !pick && picks(t).isNotEmpty()) pick = true }, 1500)
    }

    /** הכפתור שעל הנגן (BrVideo): המצב לדף — כמה נמצא (0 = בלי כפתור; גם כשכובה בהגדרות) והתווית */
    fun pushDl(t: BrTab) {
        val w = t.web ?: return
        runCatching { w.evaluateJavascript(BrVideo.stateJs(if (bubble) t.foundN else 0, getString(R.string.brBubble), menuJson(t), dlKey), null) }
    }

    /** מפתח אקראי לתפריט שעל הנגן (BrVideo.pickOf) — חדש בכל פתיחה של הדפדפן */
    private val dlKey = java.util.UUID.randomUUID().toString().replace("-", "")

    /**
     * 26/10/2026 (דיווח המשתמש: ב־Vimeo "הסרטון בדף" נכשל ורק הזרם הכחול עבד): המועמדים לסרטון הראשי — הדף עצמו
     * (כשהאתר מוכר ל־yt-dlp) והזרם הראשון שנמצא בו (HLS/DASH). שניהם נבדקים במקביל ברקע (DmPre), והראשון שהצליח (הדף
     * קודם) הוא "הסרטון" ברשימה ובתפריט שעל הנגן — כמו ב־IDM, שורה לכל איכות במקום כל קובץ שהנגן ביקש.
     * לא בטאב פרטי (העוגיות שלו לא נשמרות בשום מקום)
     */
    fun mainCands(t: BrTab): List<Pick> {
        if (t.private) return emptyList()
        val ps = picks(t)
        return listOfNotNull(ps.firstOrNull { it.page }, ps.firstOrNull { !it.page && !it.file })
    }

    /** הסרטון הראשי שנבדק: המועמד והמידע. st = 2 מוכן, 1 עוד בודק, 3 כולם נכשלו, 0 אין מועמד */
    data class Main(val p: Pick?, val info: org.json.JSONObject?, val st: Int)

    fun mainOf(t: BrTab): Main {
        val cs = mainCands(t)
        if (cs.isEmpty()) return Main(null, null, 0)
        for (p in cs) DmPre.get(p.url)?.let { info ->
            // הזרם לבד לא יודע איך קוראים לסרטון ("playlist") — השם מהדף
            if (!p.page && t.title.isNotBlank()) info.put("t", t.title.take(200))
            return Main(p, info, 2)
        }
        return Main(null, null, if (cs.any { DmPre.state(it.url) <= 1 }) 1 else 3)
    }

    /** התפריט לדף: האיכויות כשהבדיקה מוכנה, {"w":1} כשהיא עוד רצה, null = אין (נגיעה פותחת את הרשימה) */
    fun menuJson(t: BrTab): String {
        val m = mainOf(t)
        if (m.info != null) return DmPre.menu(this, m.info, AppRoute.studioInstalled(this)).toString()
        return if (m.st == 1) org.json.JSONObject().put("w", 1).put("more", getString(R.string.dmMenuMore)).toString() else "null"
    }

    /**
     * בחירה מהתפריט שעל הנגן או מהרשימה: ההורדה נכנסת לתור של מנהל ההורדות (DmPre.enqueue) — בלי לצאת מהדף. רק בחירה
     * שהוצעה (DmPre.choice), רק לסרטון שנבדק, בטאב שעל המסך; העוגיות של הדף כבר נשמרו בבדיקה (DmPre.start)
     */
    fun menuPick(t: BrTab, k: String) {
        if (cur !== t || screen != Screen.PAGE) return
        val m = mainOf(t)
        val p = m.p ?: run { bubbleTap(); return }
        val info = m.info ?: return
        val (q, audio, tr) = DmPre.choice(info, k) ?: return
        if (tr && !AppRoute.studioInstalled(this)) return
        val subs = if (!audio && DmPrefs(this).subs) DmSubs.pick(info.optJSONArray("sub"), java.util.Locale.getDefault().language) else emptyList()
        DmPre.enqueue(this, p.url, info, q, audio, if (p.page) "" else t.page, ck = true, tr = tr, subs = subs)
        pick = false
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            runCatching { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7) }
        Toast.makeText(this, R.string.dmMenuStarted, Toast.LENGTH_SHORT).show()
    }

    /**
     * 26/10/2026 (בקשת המשתמש: "שהקבצים יהיו כבר מוכנים להורדה תמיד"): המועמדים לסרטון הראשי נבדקים ברקע (DmPre) —
     * כשנוגעים בכפתור / ב־⬇, האיכויות מוכנות מיד
     */
    fun prefetch(t: BrTab) {
        if (t.private || cur !== t || t.foundN == 0) return
        val ua = t.web?.settings?.userAgentString ?: ""
        val urls = listOf(t.page) + t.found.list.map { it.url }
        mainCands(t).forEach { p -> DmPre.start(this, p.url, if (p.page) "" else t.page, ua, urls) }
    }

    /** הכפתור שעל הנגן (BrVideo) — כמו ⬇ בשורת הכתובת: קובץ ישיר יחיד מוריד מיד, אחרת הרשימה עם האיכויות */
    fun bubbleTap() {
        val t = cur ?: return
        val ps = picks(t)
        if (ps.size == 1 && ps[0].file) download(ps[0]) else if (ps.isNotEmpty()) pick = true
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
        // סמל אדפטיבי בגודל של אפליקציה: סמל האתר במרכז (או האות שלו), לא 16 פיקסלים מתוחים
        val host = BrStore.hostOf(t.url)
        val ic = t.icon ?: BrPics.icon(host)
        val icon = Icon.createWithAdaptiveBitmap(BrPics.shortcutIcon(this, ic, BrStore.siteName(host).ifEmpty { "?" }, FAV_COLORS[(host.hashCode() and 0x7fffffff) % FAV_COLORS.size]))
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
        if (Build.VERSION.SDK_INT >= 31) runCatching { setPictureInPictureParams(pipParams(false)) }
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
    }

    /**
     * הרשאה לאתר: מה שכבר החלטת לאתר הזה (הגדרות האתר) — בלי לשאול שוב, כמו ב־Chrome; אחרת שואלים אותך (בשם האתר)
     * וזוכרים. ואז את אנדרואיד — רק מה שחסר. בטאב פרטי — שואלים בכל פעם ולא זוכרים
     */
    private fun ask(host: String, kind: Int, need: List<String>, private: Boolean, then: (Boolean) -> Unit) {
        val h = host.lowercase().removePrefix("www.")
        val r = rules[h]
        val known = if (private || r == null) 0 else when (kind) {
            1 -> r.cam; 2 -> r.mic; 4 -> r.loc
            else -> if (r.cam == r.mic) r.cam else 0
        }
        if (known == -1) { then(false); return }
        if (known == 1) { osAsk(need, then); return }
        permAsk = PermAsk(host, kind) { ok ->
            permAsk = null
            if (!private && h.isNotEmpty()) setRule(h) { x -> val v = if (ok) 1 else -1
                when (kind) { 1 -> x.copy(cam = v); 2 -> x.copy(mic = v); 3 -> x.copy(cam = v, mic = v); else -> x.copy(loc = v) } }
            if (!ok) { then(false); return@PermAsk }
            osAsk(need, then)
        }
    }

    private fun osAsk(need: List<String>, then: (Boolean) -> Unit) {
        run {
            val miss = need.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            if (miss.isEmpty()) then(true) else { permThen = { g -> then(g || need.any { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) }; permLaunch.launch(miss.toTypedArray()) }
        }
    }

    /* ---------------- הגדרות ---------------- */

    fun pickEngine(e: String) { engine = e; prefs.engine = e }
    fun pickBarBottom(b: Boolean) { barBottom = b; prefs.barBottom = b }
    fun pickHomeBtn(b: Boolean) { homeBtn = b; prefs.homeBtn = b }
    fun pickBubble(b: Boolean) { bubble = b; prefs.bubble = b; cur?.let { pushDl(it) } }
    fun pickSuggest(b: Boolean) { suggestOn = b; prefs.suggest = b }
    /** גודל הטקסט בדפים — כמו "גודל הטקסט" ב־Chrome; חל על כל הטאבים */
    fun pickZoom(v: Int) { zoom = v.coerceIn(50, 300); prefs.zoom = zoom; tabs.forEach { t -> runCatching { t.web?.settings?.textZoom = zoom } } }

    /* ---------------- שורת הכתובת: הצעות, הקישור שהעתקת, חיפוש קולי ---------------- */

    /** הצעות החיפוש של המנוע שנבחר (כמו Chrome). רק כשהמתג פועל; בלי עוגיות; עד 2 שניות; רק טקסט */
    fun fetchSuggest(q: String): List<String> {
        val t = q.trim()
        if (!suggestOn || t.length < 2 || t.length > 200 || BrStore.toUrl(t, engine).let { it.isNotEmpty() && it != BrStore.searchUrl(engine, t) }) return emptyList()
        val lang = resources.configuration.locales[0].language.let { if (it == "iw") "he" else it }
        val u = when (engine) {
            "ddg" -> "https://duckduckgo.com/ac/?type=list&q="
            "bing" -> "https://api.bing.com/osjson.aspx?query="
            else -> "https://suggestqueries.google.com/complete/search?client=firefox&ie=utf-8&oe=utf-8&hl=$lang&q="
        } + Uri.encode(t)
        return runCatching {
            val c = java.net.URL(u).openConnection() as java.net.HttpURLConnection
            c.connectTimeout = 2000; c.readTimeout = 2000; c.instanceFollowRedirects = false; c.useCaches = false
            c.setRequestProperty("Cookie", "")
            try {
                if (c.responseCode != 200) return@runCatching emptyList<String>()
                val body = c.inputStream.use { it.readBytes().take(64 * 1024).toByteArray() }.toString(Charsets.UTF_8)
                val a = org.json.JSONArray(body).optJSONArray(1) ?: return@runCatching emptyList<String>()
                (0 until a.length()).mapNotNull { a.optString(it).trim().takeIf { s -> s.isNotEmpty() && s.length <= 200 } }
                    .filter { !it.equals(t, true) }.distinct().take(4)
            } finally { c.disconnect() }
        }.getOrDefault(emptyList())
    }

    /** "הקישור שהעתקת" — בלי לקרוא את הלוח (אנדרואיד מציג הודעה על כל קריאה): רק הסיווג שהמערכת כבר עשתה */
    fun clipHasUrl(): Boolean {
        if (Build.VERSION.SDK_INT < 31) return false
        val d = runCatching { getSystemService(ClipboardManager::class.java)?.primaryClipDescription }.getOrNull() ?: return false
        return d.classificationStatus == ClipDescription.CLASSIFICATION_COMPLETE &&
            runCatching { d.getConfidenceScore(TextClassifier.TYPE_URL) }.getOrDefault(0f) >= 0.5f
    }

    /** הקריאה של הלוח — רק בנגיעה */
    fun pasteGo() {
        val txt = runCatching { getSystemService(ClipboardManager::class.java)?.primaryClip?.getItemAt(0)?.coerceToText(this)?.toString() }.getOrNull()?.trim()
        if (!txt.isNullOrEmpty()) go(txt.take(4000))
    }

    fun voice() {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_WEB_SEARCH)
        try { voiceLaunch.launch(i) } catch (e: ActivityNotFoundException) { Toast.makeText(this, R.string.brNoVoice, Toast.LENGTH_SHORT).show() }
    }

    /* ---------------- פרטי האתר ---------------- */

    /** מחיקת הנתונים של האתר הזה בלבד: עוגיות (בפרופיל של הטאב) ואחסון, וטעינה מחדש */
    fun clearSite(t: BrTab) {
        val u = runCatching { Uri.parse(t.url) }.getOrNull() ?: return
        val host = u.host ?: return
        if (u.scheme != "http" && u.scheme != "https") return
        val prof = if (t.private && privOk) runCatching { ProfileStore.getInstance().getProfile(PRIV) }.getOrNull() else null
        val cm = prof?.cookieManager ?: CookieManager.getInstance()
        val ws = prof?.webStorage ?: WebStorage.getInstance()
        runCatching {
            cm.getCookie(t.url)?.split(";")?.map { it.substringBefore("=").trim() }?.filter { it.isNotEmpty() }?.forEach { n ->
                cm.setCookie(t.url, "$n=; Max-Age=0; Path=/")
                cm.setCookie(t.url, "$n=; Max-Age=0; Path=/; Domain=$host")
            }
            cm.flush()
        }
        runCatching { ws.deleteOrigin("${u.scheme}://$host") }
        info = false
        t.web?.reload()
        Toast.makeText(this, R.string.brSiteCleared, Toast.LENGTH_SHORT).show()
    }

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
        BrPics.clear()
        markRev++
        Toast.makeText(this, R.string.brClearDone, Toast.LENGTH_SHORT).show()
    }

    /* ---------------- סיסמאות ---------------- */

    /** מי ממלא סיסמאות בטלפון: שם השירות; "" = כבוי; null = הטלפון לא תומך */
    var fillBy by mutableStateOf<String?>("")
    val fillGoogle get() = fillPkg == GMS
    private var fillPkg = ""

    private fun checkFill() {
        if (Build.VERSION.SDK_INT < 28) { fillBy = null; return }
        val am = getSystemService(android.view.autofill.AutofillManager::class.java)
        if (am == null || !am.isAutofillSupported) { fillBy = null; return }
        val cn = runCatching { am.autofillServiceComponentName }.getOrNull()
        fillPkg = cn?.packageName ?: ""
        fillBy = if (cn == null) "" else runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(cn.packageName, 0)).toString() }.getOrDefault(cn.packageName)
    }

    /** "שירות המילוי האוטומטי" של הטלפון — שם בוחרים ב־Google (אנדרואיד 14+: "סיסמאות, מפתחות גישה וחשבונות") */
    fun fillSettings() {
        val tries = buildList {
            if (Build.VERSION.SDK_INT >= 34) add(Intent(Settings.ACTION_CREDENTIAL_PROVIDER))
            add(Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE, Uri.parse("package:$GMS")))
            add(Intent(Settings.ACTION_SETTINGS))
        }
        for (i in tries) if (runCatching { startActivity(i) }.isSuccess) return
    }

    /** מנהל הסיסמאות של Google — באתר שלו, בטאב חדש (מחובר דרך החשבון שלך בדפדפן) */
    fun openPasswords() { screen = Screen.PAGE; newTab("https://passwords.google.com/") }
    fun openCheckup() { screen = Screen.PAGE; newTab("https://passwords.google.com/checkup") }

    /* ---------------- ייבוא מ־Chrome ---------------- */

    /** Google Takeout עם Chrome בלבד — שם מבקשים את הייצוא (מגיע במייל, ומורד לתיקיית ההורדות) */
    fun openTakeout() { screen = Screen.PAGE; newTab(TAKEOUT) }
    fun pickImport() { runCatching { importLaunch.launch(arrayOf("application/zip", "application/x-zip-compressed", "text/html", "application/json", "application/octet-stream")) } }

    private fun importFrom(u: Uri) {
        Toast.makeText(this, R.string.brImporting, Toast.LENGTH_SHORT).show()
        Thread {
            val r = runCatching { contentResolver.openInputStream(u)?.use { BrImport.read(it, u.lastPathSegment ?: "") } }.getOrNull()
            ui.post {
                if (r == null || (r.marks.isEmpty() && r.visits.isEmpty())) { Toast.makeText(this, R.string.brImportNone, Toast.LENGTH_LONG).show(); return@post }
                val st = BrStore.importAll(r)
                lastImport = "${st.marks},${st.visits},${System.currentTimeMillis()},${st.known}"; prefs.lastImport = lastImport
                markRev++
                Toast.makeText(this, if (st.marks + st.visits == 0) getString(R.string.brImportNothingNew)
                    else getString(R.string.brImported, st.marks, st.visits), Toast.LENGTH_LONG).show()
            }
        }.apply { isDaemon = true }.start()
    }

    /** רק הסימניות ש־Chrome עוד לא קיבל (BrSync.toExport); `all` = שוב את כולן — רק אם הקובץ הקודם לא יובא */
    private var exportList: List<BrMark> = emptyList()
    fun exportMarks(all: Boolean = false) {
        val list = BrStore.exportList(all)
        if (list.isEmpty()) { Toast.makeText(this, R.string.brExportNone, Toast.LENGTH_LONG).show(); return }
        exportList = list
        val day = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(java.util.Date())
        runCatching { exportLaunch.launch("studio-browser-bookmarks-$day.html") }
    }

    private fun exportTo(u: Uri) {
        val list = exportList.ifEmpty { return }
        val day = java.text.DateFormat.getDateInstance(java.text.DateFormat.SHORT).format(java.util.Date())
        val html = BrSync.exportHtml(list, "Studio Browser · $day")
        val ok = runCatching { contentResolver.openOutputStream(u, "wt")?.use { it.write(html.toByteArray(Charsets.UTF_8)) } != null }.getOrDefault(false)
        if (ok) { BrStore.markExported(list); exportList = emptyList(); markRev++ }
        Toast.makeText(this, if (ok) getString(R.string.brExportedN, list.size) else getString(R.string.dmErrFail), Toast.LENGTH_SHORT).show()
    }

    /* ---------------- סנכרון עם Chrome (התוסף במחשב) ---------------- */

    fun chromeConnect() {
        BrChrome.connect(this, { s -> runCatching { chromeLaunch.launch(IntentSenderRequest.Builder(s).build()) } }) { ok ->
            if (!ok && !BrChrome.on) Toast.makeText(this, R.string.brSyncNoAuth, Toast.LENGTH_LONG).show()
            chromeRev++
        }
    }
    fun chromeNow() { BrChrome.sync(this, force = true); chromeRev++ }
    fun chromeOff() { BrChrome.disable(); chromeRev++ }
    /** הקישור לתוסף — לשלוח לעצמך ולפתוח במחשב (עד שיעלה לחנות: התקנה במצב מפתח) */
    fun chromeShareExt() {
        val txt = getString(R.string.brSyncShareText, BrChrome.EXT_ZIP)
        runCatching { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, txt), getString(R.string.brShare))) }
    }

    fun dlSettings() { runCatching { startActivity(Intent(this, DmActivity::class.java)) } }

    fun version(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName ?: "" }.getOrDefault("")

    companion object {
        const val PRIV = "private"
        const val LIVE_MAX = 6
        /** מהבועה ב־Chrome: כמה זמן מחכים לממצא הראשון כדי לפתוח את הרשימה לבד */
        const val HUNT_MS = 45_000L
        const val CHROME_EVERY = 5 * 60_000L
        const val GMS = "com.google.android.gms"
        /** הצבעים של האות במקום סמל — אותם צבעים של Fav במסך */
        val FAV_COLORS = intArrayOf(0xFF1A73E8.toInt(), 0xFFEA4335.toInt(), 0xFF34A853.toInt(), 0xFFF29900.toInt(), 0xFF9334E6.toInt(), 0xFFE8710A.toInt(), 0xFF129EAF.toInt(), 0xFFD01884.toInt())
        /** תשובה ריקה לבקשה שנחסמה (204 — הדף ממשיך כאילו השרת לא החזיר כלום) */
        fun EMPTY() = WebResourceResponse("text/plain", "utf-8", 204, "No Content", emptyMap(), java.io.ByteArrayInputStream(ByteArray(0)))
        const val TAKEOUT = "https://takeout.google.com/settings/takeout/custom/chrome"

        /** "אתר למחשב": ה־User-Agent של Chrome במחשב, באותה גרסה של המנוע */
        fun desktopUa(def: String): String {
            val v = Regex("""Chrome/([\d.]+)""").find(def)?.groupValues?.get(1) ?: "130.0.0.0"
            return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$v Safari/537.36"
        }
    }
}
