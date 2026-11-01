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
import android.view.KeyEvent
import android.view.MotionEvent
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
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.YtPage
import io.github.yishaiguedj1.snowball.HuntMedia
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.dm.DmActivity
import io.github.yishaiguedj1.snowball.dm.DmBridge
import io.github.yishaiguedj1.snowball.dm.DmBrowser
import io.github.yishaiguedj1.snowball.dm.DmCookies
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
    enum class Screen { PAGE, SWITCHER, HISTORY, BOOKMARKS, SETTINGS, ENGINE, PASSWORDS, PRIVACY, BARPOS, IMPORT, CHROME, SITES, SITE, VIDEO, CLOUD, RECENT, USERS, LAB, TASKS, GROUPS, TOOLBAR, GESTURES, PERF, NTPSET, KEYS,
        SCRIPTS, WATCHES, MACROS }
    /** עמודי המשנה של ההגדרות — "חזור" מהם חוזר להגדרות, לא לדף (אתר אחד — חוזר לרשימת האתרים) */
    private val settingsSubs = setOf(Screen.ENGINE, Screen.PASSWORDS, Screen.PRIVACY, Screen.BARPOS, Screen.IMPORT, Screen.CHROME, Screen.SITES, Screen.VIDEO, Screen.CLOUD, Screen.USERS, Screen.LAB, Screen.TOOLBAR, Screen.GESTURES, Screen.PERF, Screen.NTPSET, Screen.KEYS)
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
    var markPath by mutableStateOf("")   // התיקייה הפתוחה במסך הסימניות ("" = השורש) — BrSync.folderOf

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
    /* Pro — הגל הראשון (01/11/2026, BrPro): לחיצה ארוכה, נסגרו לאחרונה, כלי מפתחים, מעבדה */
    /** לחיצה ארוכה על קישור / תמונה — הגיליון עם כל הפעולות (לפי ת־עיצוב של התפריט בלחיצה ימנית במחשב) */
    data class Ctx(val tab: BrTab, val link: String?, val img: String?, val text: String)
    /** כרטיסייה שנסגרה — חוזרת עם מחסנית "חזור" שלה */
    data class Closed(val url: String, val title: String, val state: Bundle?, val pinned: Boolean, val at: Long)
    var ctx by mutableStateOf<Ctx?>(null)
    val closed = mutableStateListOf<Closed>()
    var devSheet by mutableStateOf(false)
    var heFix by mutableStateOf(true)
    var cleanCopy by mutableStateOf(true)

    /* ---- הגל השני (01/11/2026): כרטיסיות, שורת הכתובת ונוחות ---- */
    /** 13 מסך מפוצל: הכרטיסייה השנייה שעל המסך (לא הפעילה); splitFirst = הפעילה בחלון הראשון (למעלה / בהתחלה) */
    var split by mutableStateOf<BrTab?>(null)
    var splitFirst by mutableStateOf(true)
    var splitPick by mutableStateOf(false)
    /** 14 תצוגה מקדימה לקישור (מהלחיצה הארוכה) */
    var preview by mutableStateOf<String?>(null)
    var quickAsk by mutableStateOf(false)
    /** 35 הסרגל, 39 המחוות, 16 החיסכון, 40 מצב שולחן, 19 פס הכרטיסיות, 36 הכרטיסייה החדשה, 37 צבע המשתמש */
    var tools by mutableStateOf(BrPro.TOOLS_DEFAULT)
    var gest by mutableIntStateOf(BrPro.G_ALL)
    var saver by mutableIntStateOf(0)
    var battery by mutableStateOf(true)
    var desk by mutableIntStateOf(0)
    var strip by mutableStateOf(false)
    var ntpShow by mutableIntStateOf(15)
    var ucolor by mutableIntStateOf(-1)
    /** 17/18 קבוצות שמורות וסשנים */
    var sets by mutableStateOf<List<BrPro.TabSet>>(emptyList())
    var tasksRev by mutableIntStateOf(0)

    /* ---- הגל השלישי (01/11/2026, BrDev): כלי מפתחים ושליטה באתר ---- */
    /** הכלים שמדברים עם הדף (בחירת רכיב, הקלטה) צריכים את ערוץ ההודעות של WebView */
    val toolsOk by lazy { runCatching { WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) }.getOrDefault(false) }
    var devPane by mutableIntStateOf(0)
    /** 5/63: מצב בחירה בדף (BrDev.PICK_*; 0 = כבוי), הרכיב שנבחר, ומה נמחק בסבב הנוכחי */
    var pickMode by mutableIntStateOf(0)
    var picked by mutableStateOf<BrDev.Picked?>(null)
    val zappedNow = mutableStateListOf<String>()
    @Volatile var zaps: Map<String, List<String>> = emptyMap()
    /** 66 הקלטה: באיזו כרטיסייה, הצעדים עד עכשיו, ומאיזה דף התחילה */
    var recTab by mutableStateOf<BrTab?>(null)
    var recSteps by mutableStateOf<List<BrDev.Step>>(emptyList())
    private var recUrl = ""
    var macros by mutableStateOf<List<BrDev.Macro>>(emptyList())
    /** 67 סקריפטים של משתמשים, 65 מעקב אחרי דפים */
    var uscripts by mutableStateOf<List<BrDev.UScript>>(emptyList())
    var editScript by mutableStateOf<BrDev.UScript?>(null)
    var watches by mutableStateOf<List<BrDev.Watch>>(emptyList())

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
    private val cloudLaunch = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { r ->
        if (!BrCloud.authorized(this, r.data)) Toast.makeText(this, R.string.brSyncNoAuth, Toast.LENGTH_LONG).show() else googleWeb(true)
        cloudRev++
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
        // לכל משתמש בדפדפן — פרופיל WebView משלו (עוגיות, אחסון של אתרים); מה שעובר להורדה לוקח את העוגיות שלו
        userProfile()?.let { DmCookies.cm = it.cookieManager }
        // 26/10/2026: מנוע ההורדות (פייתון + yt-dlp, והעדכון היומי שלו) מתחמם ברקע מההתחלה — הבדיקה הראשונה של סרטון לא
        // מחכה לו (עד עכשיו: חלק מה"חצי דקה, דקה" ביוטיוב)
        // 27/10/2026: אחרי שהמסך והדף הראשון עלו — לא מתחרה בהם על מעבד, דיסק ורשת (בדיקה ראשונה של סרטון עדיין מוכנה)
        ui.postDelayed({ Thread { runCatching { DlEngine.prepare(applicationContext) } }.apply { isDaemon = true; name = "dm-warm"; priority = Thread.MIN_PRIORITY }.start() }, 8000)
        barBottom = prefs.barBottom; homeBtn = prefs.homeBtn; engine = prefs.engine; bubble = prefs.bubble
        suggestOn = prefs.suggest; zoom = prefs.zoom; lastImport = prefs.lastImport
        shield = prefs.shield; cookies = prefs.cookies; lockPriv = prefs.lockPriv; bgPlay = prefs.bgPlay; pip = prefs.pip
        rules = BrShield.decode(prefs.sites); heFix = prefs.heFix; cleanCopy = prefs.cleanCopy
        tools = BrPro.tools(prefs.tools); gest = prefs.gest; saver = prefs.saver; battery = prefs.battery; desk = prefs.desk; strip = prefs.strip
        ntpShow = prefs.ntp; ucolor = BrUsers.color(this)
        BrStore.init(this)
        BrPics.init(this)
        sets = BrStore.loadSets()
        zaps = BrDev.zapsDecode(prefs.zaps); macros = BrDev.macrosDecode(prefs.macros); uscripts = BrDev.scriptsDecode(prefs.uscripts); watches = BrWatch.load(this)
        BrMedia.onCmd = { play -> ui.post { mediaCmd(play) } }
        initCloud()
        BrChrome.init(this); BrChrome.attach(this)
        BrChrome.onChange = { chromeRev++; markRev++ }
        DmStore.init(this)
        DmEngine.pump(this)
        swClient()
        // טאבים פרטיים לא שורדים סגירה של האפליקציה — מה שנשאר מהפעם הקודמת נמחק
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        val (saved, at) = BrStore.loadTabs()
        // כל טאב חוזר עם מחסנית "חזור"/"קדימה" שלו (BrStore.loadState) ועם הכרטיסייה שפתחה אותו — לפי ת־עיצוב, גם אחרי סגירה ברקע
        val restored = saved.mapIndexed { i, r -> BrTab(nextId++, r.url, r.title, false).also { it.born = 0L; it.ntpBack = r.nb; it.pinned = r.pin; it.state = BrStore.loadState(i) } }
        saved.forEachIndexed { i, r -> if (r.p in restored.indices && r.p != i) restored[i].parent = restored[r.p].id }
        tabs.addAll(restored)
        // התמונות של הטאבים — ברקע, לא לפני המסך הראשון (50 טאבים = עשרות MB ופענוח בתהליכון הראשי)
        Thread { tabs.toList().forEach { t -> val b = BrPics.thumb(t.url); if (b != null) ui.post { if (t.thumb == null) t.thumb = b } } }.apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
        if (!handle(intent)) {
            if (tabs.isEmpty()) newTab("") else select(tabs[at.coerceIn(0, tabs.size - 1)])
        }
        // משתמש חדש — מתחילים בכניסה לחשבון (כמו בהוספת פרופיל ב־Chrome)
        if (intent?.getBooleanExtra(USER_NEW, false) == true && !BrCloud.on) screen = Screen.CLOUD
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { back() } })
        setContent { BrApp(this) }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }
    override fun onResume() {
        super.onResume(); checkDefault(); checkFill(); cur?.web?.onResume(); BrChrome.sync(this); ui.postDelayed(chromeTick, CHROME_EVERY)
        BrCloud.foreground(true); ui.postDelayed(measureTick, MEASURE_EVERY); ui.postDelayed(sleepTick, SLEEP_EVERY)
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
        ui.removeCallbacks(chromeTick); ui.removeCallbacks(measureTick); ui.removeCallbacks(sleepTick)
        // הסנכרון בענן: המקום המדויק בכרטיסייה, ואז הכל עולה מיד (המכשיר השני יכול להמשיך מכאן)
        cur?.let { measure(it) }
        ui.postDelayed({ BrCloud.foreground(false) }, 300)
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

    override fun onStart() { super.onStart(); cur?.web?.resumeTimers() ?: tabs.firstNotNullOfOrNull { it.web }?.resumeTimers() }
    override fun onStop() {
        super.onStop()
        // JavaScript של כל הטאבים נעצר ברקע (onPause לבדו לא עוצר אותו) — חוץ מניגון ברקע / חלון קטן
        if (!bgOn && !isInPictureInPictureMode) tabs.firstNotNullOfOrNull { it.web }?.pauseTimers()
        if (lockPriv && tabs.any { it.private } && canLock()) privLocked = true
    }

    /** פקודה מההתראה / מסך הנעילה / האוזניות: true = להמשיך, false = להשהות, null = לסגור */
    private fun mediaCmd(play: Boolean?) {
        val w = bgTab?.web ?: return
        runCatching { w.evaluateJavascript(if (play == true) BrShield.RESUME_JS else BrShield.PAUSE_JS, null) }
        if (play == null) { bgOn = false; bgTab = null }
    }

    /* תמונה בתוך תמונה: סרטון במסך מלא + יציאה מהאפליקציה (כפתור הבית / החלקה) — ממשיך בחלון קטן, לפי ת־עיצוב */
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

    /** טאב פרטי על המסך (או במסך הטאבים) — בלי צילומי מסך ובלי תמונה במסך האפליקציות האחרונות, לפי ת־עיצוב */
    fun applySecure() {
        if (showsPrivate() || (screen == Screen.SWITCHER && tabs.any { it.private } && privLocked)) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    override fun onDestroy() {
        // הסבב ברקע ממשיך בלי המסך — לא מחזיקים אותו
        BrCloud.onChange = null; BrCloud.onApplied = null; BrCloud.onIncoming = null; BrCloud.tabsProvider = null
        BrMedia.onCmd = null
        if (isFinishing) BrMedia.stop(this)
        tabs.forEach { t -> kill(t.web) }
        if (privOk) runCatching { ProfileStore.getInstance().deleteProfile(PRIV) }
        super.onDestroy()
    }

    /* ---------------- הסנכרון בענן בין המכשירים (BrCloud) ---------------- */

    var cloudRev by mutableIntStateOf(0)
    /** כרטיסייה שנשלחה לכאן ממכשיר אחר בזמן שהדפדפן פתוח: (שם המכשיר, הכרטיסייה) */
    var incoming by mutableStateOf<Pair<String, BrCloudCore.STab>?>(null)
    var sendSheet by mutableStateOf(false)
    var cloudWiping by mutableStateOf(false)

    private fun initCloud() {
        BrCloud.init(this)
        BrCloud.onChange = { cloudRev++ }
        BrCloud.onApplied = { p -> if (p) reloadPrefs(); markRev++; cloudRev++ }
        BrCloud.onIncoming = { s, x -> if (lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)) { incoming = s.name to x.tab; true } else false }
        BrCloud.tabsProvider = {
            tabs.filter { !it.private && it.url.startsWith("http") }.sortedByDescending { it.la }.take(60)
                .map { BrCloudCore.STab(it.url, it.title, it.la, it.sc, it.tx, it.mt) }
        }
        if (BrCloud.on) BrCloud.schedule(this)
    }

    /** ההגדרות השתנו מהענן (מכשיר אחר) — המסך מתעדכן */
    private fun reloadPrefs() {
        barBottom = prefs.barBottom; homeBtn = prefs.homeBtn; engine = prefs.engine; bubble = prefs.bubble
        suggestOn = prefs.suggest; shield = prefs.shield; cookies = prefs.cookies; bgPlay = prefs.bgPlay; pip = prefs.pip
        rules = BrShield.decode(prefs.sites); heFix = prefs.heFix; cleanCopy = prefs.cleanCopy; sitesRev++
        if (zoom != prefs.zoom) { zoom = prefs.zoom; tabs.forEach { t -> runCatching { t.web?.settings?.textZoom = zoom } } }
    }

    /** המקום המדויק בדף — כמה נגלל, המשפט שבראש המסך והזמן בסרטון (כל MEASURE_EVERY, ובמעבר כרטיסייה/יציאה) */
    private fun measure(t: BrTab) {
        if (t.private || !BrCloud.on) return
        val w = t.web ?: return
        runCatching { w.evaluateJavascript(BrCloudJs.MEASURE) { r -> BrCloudJs.parse(r)?.let { (sc, tx, mt) -> t.sc = sc; t.tx = tx; t.mt = mt } } }
    }
    private val measureTick: Runnable = Runnable { cur?.let { measure(it) }; ui.postDelayed(measureTick, MEASURE_EVERY) }
    /** 16 חיסכון בזיכרון ובסוללה: כל דקה — כרטיסייה ברקע שלא נגעת בה מספיק זמן נרדמת (המצב נשמר, חוזרת לאותו מקום) */
    private val sleepTick: Runnable = Runnable {
        val now = SystemClock.uptimeMillis(); val b = batterySaving()
        tabs.filter { it.web != null && it !== cur && it !== split && BrPro.sleepy(now - it.used, saver, b, it.playing) }.forEach { sleep(it) }
        ui.postDelayed(sleepTick, SLEEP_EVERY)
    }

    /** כרטיסייה ממכשיר אחר — כרטיסייה חדשה, וכשהדף נטען חוזרים בדיוק לאותו מקום (ובסרטון — לאותו רגע) */
    fun openRemote(st: BrCloudCore.STab) {
        screen = Screen.PAGE; editing = false; incoming = null
        val t = newTab(BrCloudJs.withTime(st.u, st.mt), after = cur)
        t.restore = st
    }

    fun cloudSignIn(r: BrCloud.SignIn) {
        when (r) {
            is BrCloud.SignIn.Need -> runCatching { cloudLaunch.launch(IntentSenderRequest.Builder(r.s).build()) }
            is BrCloud.SignIn.Ok -> googleWeb(true)
            is BrCloud.SignIn.Fail -> Toast.makeText(this, if (r.why == "setup") getString(R.string.brCloudSetup) else getString(R.string.brCloudFail, r.why), Toast.LENGTH_LONG).show()
            else -> {}
        }
        cloudRev++
    }

    /* ---------------- כמה משתמשים (BrUsers) ---------------- */

    /** הפרופיל של WebView של המשתמש הפעיל (null = הראשי, פרופיל ברירת המחדל / אין תמיכה בכמה פרופילים) */
    fun userProfile(): androidx.webkit.Profile? {
        val n = BrUsers.profile(this) ?: return null
        if (!privOk) return null
        return runCatching { ProfileStore.getInstance().getOrCreateProfile(n) }.getOrNull()
    }
    private fun profOf(t: BrTab): androidx.webkit.Profile? =
        if (t.private && privOk) runCatching { ProfileStore.getInstance().getProfile(PRIV) }.getOrNull() else userProfile()
    fun cmOf(t: BrTab): CookieManager = profOf(t)?.cookieManager ?: CookieManager.getInstance()
    fun wsOf(t: BrTab): WebStorage = profOf(t)?.webStorage ?: WebStorage.getInstance()

    /** האם המשתמש מחובר לחשבון Google באתרים (עוגיית ההתחברות של Google בפרופיל שלו) */
    fun googleWebOn(): Boolean = runCatching {
        val ck = (userProfile()?.cookieManager ?: CookieManager.getInstance()).getCookie("https://accounts.google.com") ?: ""
        Regex("(^|;\\s*)(SID|__Secure-1PSID)=").containsMatchIn(ck)
    }.getOrDefault(false)

    /**
     * אחרי כניסה לסנכרון — גם לאתרים של Google, באותו חשבון. Chrome עושה את זה לבד (רק לו Google נותן את החיבור הזה);
     * כאן: דף הכניסה של Google עם המייל כבר בפנים, בפעם אחת, ומאז העוגיות נשמרות בפרופיל של המשתמש
     */
    fun googleWeb(auto: Boolean) {
        val em = BrCloud.email
        if (em.isEmpty() || (auto && googleWebOn())) return
        screen = Screen.PAGE; editing = false
        newTab("https://accounts.google.com/AccountChooser?Email=" + Uri.encode(em) + "&continue=" + Uri.encode("https://www.google.com/"), after = cur)
    }

    /** מעבר למשתמש אחר: שומרים הכל, ומתחילים מחדש בתהליך חדש — כל מה שבזיכרון שייך למי שהיה */
    fun switchUser(id: String, fresh: Boolean = false) {
        if (id == BrUsers.cur(this)) { screen = Screen.PAGE; return }
        cur?.let { measure(it) }
        saveSession()
        BrMedia.stop(this)
        BrUsers.select(this, id)
        var gone = false
        val go = Runnable { if (!gone) { gone = true; BrRestart.go(this, fresh) } }
        // הסנכרון בענן מעלה את מה שהשתנה לפני שיוצאים (עד 3 שנ׳)
        if (BrCloud.on) { BrCloud.cycle(true) { ui.post(go) }; ui.postDelayed(go, 3000) } else go.run()
    }

    fun addUser() {
        if (!privOk) { Toast.makeText(this, R.string.brUsersNoSupport, Toast.LENGTH_LONG).show(); return }
        val id = BrUsers.add(this) ?: run { Toast.makeText(this, R.string.brUsersMax, Toast.LENGTH_LONG).show(); return }
        switchUser(id, true)
    }

    fun removeUser(id: String) { if (BrUsers.remove(this, id)) usersRev++ }
    var usersRev by mutableIntStateOf(0)

    fun cloudOff(wipe: Boolean) {
        cloudWiping = wipe
        BrCloud.signOut(wipe) { ok ->
            cloudWiping = false
            if (!ok) Toast.makeText(this, R.string.brCloudWipeFail, Toast.LENGTH_LONG).show()
            cloudRev++
        }
    }

    fun sendTo(dev: String) {
        val t = cur ?: return
        sendSheet = false; menu = false
        measure(t)
        ui.postDelayed({
            BrCloud.send(dev, BrCloudCore.STab(t.url, t.title, System.currentTimeMillis(), t.sc, t.tx, t.mt))
            Toast.makeText(this, R.string.brSent, Toast.LENGTH_SHORT).show()
        }, 250)
    }

    private fun saveSession() {
        val pub = tabs.filter { !it.private && it.url.startsWith("http") }
        BrStore.saveTabs(pub.map { t -> BrTabRec(t.url, t.title, t.ntpBack, pub.indexOfFirst { it.id == t.parent }, t.pinned) }, pub.indexOf(cur).coerceAtLeast(0))
        // מחסנית "חזור"/"קדימה" של כל טאב — שורדת סגירה של האפליקציה ברקע (חי: עכשיו; שוחרר: המצב שנשמר כששוחרר)
        BrStore.saveStates(pub.map { t -> t.web?.let { w -> runCatching { Bundle().also { w.saveState(it) } }.getOrNull() } ?: t.state ?: t.lastState })
        cur?.takeIf { !it.private }?.let { snap(it) }
        if (blkNew > 0) { prefs.blockedAll = prefs.blockedAll + blkNew; blkNew = 0 }
        BrPics.keepThumbs(pub.map { it.url })
        // 18 סשנים: התמונה של הכרטיסיות הרגילות — אותו סשן עד חצי שעה, אחר כך סשן חדש (עד 10)
        val ns = BrPro.pushSession(sets, pub.map { it.url to it.title }, System.currentTimeMillis()) { setId() }
        if (ns != sets) { sets = ns; BrStore.saveSets(ns) }
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
        // כרטיסייה שנשלחה ממכשיר אחר (מההתראה) — מאותו מקום. רק מה שנשמר בתוך התהליך, לא extras מבחוץ
        // 65: נפתח מההתראה של המעקב — השינוי נראה (רק מוריד את הסימון, לא פותח שום דבר מעבר לכתובת)
        i.getStringExtra("snb_watch")?.let { id -> BrWatch.update(this, id) { it.copy(changed = 0L) }; watches = BrWatch.load(this) }
        i.getStringExtra("snb_cloud")?.let { k -> BrCloud.pendingOpen.remove(k)?.let { openRemote(it); return true } }
        val t = newTab(url, fromApp = i.action == Intent.ACTION_VIEW)
        // מהבועה ב־Chrome: הצייד כאן רואה את הזרמים האמיתיים של הדף — כשנמצא משהו, רשימת ההורדה נפתחת לבד.
        // רק פותח את הרשימה — שום הורדה לא מתחילה בלי נגיעה שלך
        if (i.getBooleanExtra(AppRoute.EXTRA_HUNT, false)) { t.autoPick = SystemClock.uptimeMillis() + HUNT_MS; autoPick(t) }
        return true
    }

    /* ---------------- טאבים ---------------- */

    fun newTab(url: String, private: Boolean = false, fromApp: Boolean = false, after: BrTab? = null): BrTab {
        val t = BrTab(nextId++, "", "", private && privOk, fromApp)
        if (deskNow()) t.desktop = true   // 40 מצב שולחן: גרסת המחשב של האתרים, לפי ת־עיצוב בטאבלטים
        val i = after?.let { tabs.indexOf(it) + 1 } ?: tabs.size
        tabs.add(i.coerceIn(0, tabs.size), t)
        select(t)
        if (url.startsWith("http")) load(t, url) else editing = !fromApp
        return t
    }

    fun select(t: BrTab) {
        val old = cur
        if (t === split) split = null   // הכרטיסייה השנייה נבחרה — ממשיכים בה במסך מלא
        // במסך מפוצל הכרטיסייה השנייה נשארת על המסך — לא משהים אותה
        if (old != null && old !== t) { snap(old); measure(old); if (old !== split) old.web?.onPause() }
        if (old !== t) { t.la = System.currentTimeMillis(); BrCloud.nudge(4000) }
        cur = t
        t.used = SystemClock.uptimeMillis()
        wake(t)
        trim()
        finding = false
    }

    /** טאב ששוחזר / שהשתחרר: עם מצב שמור — חוזר לאותו מקום; בלי — טוען את הכתובת מחדש */
    private fun wake(t: BrTab) {
        if (t.web == null && (t.state != null || t.url.startsWith("http"))) {
            val fresh = t.state == null
            val w = ensureWeb(t)
            if (fresh) w.loadUrl(t.url)
        }
        t.web?.onResume()
    }

    fun close(t: BrTab) {
        val i = tabs.indexOf(t)
        if (i < 0) return
        if (t === split) { split = null; t.web?.onPause() }
        // מסך מפוצל: סוגרים את החלון הפעיל — השני ממלא את המסך
        val other = if (cur === t) split else null
        if (other != null) split = null
        keepClosed(t)
        kill(t.web)
        t.web = null
        tabs.removeAt(i)
        if (t.private && tabs.none { it.private } && privOk) ui.postDelayed({ runCatching { ProfileStore.getInstance().deleteProfile(PRIV) } }, 300)
        if (other != null && other in tabs) { select(other); return }
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
        // כרטיסייה נעוצה לא נסגרת ב"סגירת הכל" (לפי ת־עיצוב של כרטיסיות נעוצות במחשב)
        val gone = tabs.filter { it.private == private && !it.pinned }
        if (split in gone) split = null
        gone.asReversed().forEach { keepClosed(it) }
        gone.forEach { kill(it.web); it.web = null }
        tabs.removeAll { it in gone }
        if (private && privOk) ui.postDelayed({ runCatching { ProfileStore.getInstance().deleteProfile(PRIV) } }, 300)
        if (tabs.isEmpty()) { newTab(""); return }
        if (cur?.let { it in tabs } != true) select(tabs.last())
    }

    /* ---------------- Pro: נסגרו לאחרונה, נעוצות, שכפול ---------------- */

    /** כרטיסייה רגילה שנסגרת — לראש "נסגרו לאחרונה" (עד 25), עם מחסנית "חזור" שלה. פרטית — אף פעם */
    private fun keepClosed(t: BrTab) {
        if (t.private || !t.url.startsWith("http")) return
        val st = t.web?.let { w -> runCatching { Bundle().also { w.saveState(it) } }.getOrNull() } ?: t.state ?: t.lastState
        closed.removeAll { it.url == t.url }
        closed.add(0, Closed(t.url, t.title, st, t.pinned, System.currentTimeMillis()))
        while (closed.size > 25) closed.removeAt(closed.size - 1)
    }

    /** פתיחה מחדש (ברירת המחדל — האחרונה שנסגרה), במקום שלה בסוף הרשימה */
    fun reopen(c: Closed? = closed.firstOrNull()) {
        c ?: return
        closed.remove(c)
        val t = BrTab(nextId++, c.url, c.title, false)
        t.state = c.state; t.pinned = c.pinned
        tabs.add(if (c.pinned) tabs.count { it.pinned && !it.private } else tabs.size, t)
        select(t); screen = Screen.PAGE
    }

    /** נעיצה: הנעוצות תמיד ראשונות (בסדר שננעצו), השאר אחריהן באותו סדר */
    fun togglePin(t: BrTab) {
        if (t.private) return
        t.pinned = !t.pinned
        val order = tabs.filter { it.pinned && !it.private } + tabs.filter { !(it.pinned && !it.private) }
        tabs.clear(); tabs.addAll(order)
    }

    /** שכפול — אותו דף עם אותה מחסנית "חזור", מיד אחרי המקורית */
    fun duplicate(t: BrTab) {
        val st = t.web?.let { w -> runCatching { Bundle().also { w.saveState(it) } }.getOrNull() } ?: t.state
        val n = BrTab(nextId++, t.url, t.title, t.private)
        n.state = st; n.parent = t.parent
        tabs.add(tabs.indexOf(t) + 1, n)
        select(n); screen = Screen.PAGE
    }

    /** סגירת כל האחרות מאותו סוג (הנעוצות נשארות) */
    fun closeOthers(t: BrTab) { tabs.filter { it !== t && it.private == t.private && !it.pinned }.forEach { close(it) } }

    /** "מעבר לכרטיסייה" משורת הכתובת */
    fun switchTo(t: BrTab) { editing = false; select(t); screen = Screen.PAGE }

    /** טאבים חיים מעבר ל־liveMax — שומרים את המצב ומשחררים את ה־WebView (לפי ת־עיצוב בטלפון). `keep` = כמה חיים מלבד הנוכחי */
    private fun trim(keep: Int = liveCap() - 1) {
        val live = tabs.filter { it.web != null && it !== cur && it !== split }.sortedByDescending { it.used }
        for (t in live.drop(keep)) {
            val b = Bundle(); runCatching { t.web?.saveState(b) }; t.state = b
            kill(t.web); t.web = null
        }
    }

    /**
     * יעילות (27/10/2026, מחקר "דפדפן מהיר וחסכוני"): כל ה־WebView של האפליקציה חולקים renderer אחד — כל טאב חי מוסיף לו
     * את הזיכרון של הדף. Chrome בטלפון משאיר רק מה שהזיכרון מרשה; כאן — לפי הזיכרון של המכשיר: עד 4GB (או "זיכרון נמוך") 2,
     * עד 8GB — 3, מעל — 5.
     */
    private val liveMax: Int by lazy {
        val am = getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager
        val mi = android.app.ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val gb = mi.totalMem / (1L shl 30).toDouble()
        when { am.isLowRamDevice || gb <= 4.5 -> 2; gb <= 8.5 -> 3; else -> 5 }
    }

    /** הסדר של התיעוד: מהעץ, עצירה, ורק אז destroy (אחרת דליפה) */
    private fun kill(w: WebView?) {
        w ?: return
        runCatching { (w.parent as? android.view.ViewGroup)?.removeView(w); w.stopLoading(); w.destroy() }
    }

    /** המערכת מבקשת זיכרון כשהדפדפן ברקע — משחררים את כל הטאבים החיים חוץ מזה שעל המסך (המצב נשמר, חוזרים לאותו מקום) */
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        @Suppress("DEPRECATION")
        if (level >= TRIM_MEMORY_BACKGROUND || level == TRIM_MEMORY_RUNNING_CRITICAL) trim(0)
    }

    /**
     * ה־renderer מת (קריסה, או המערכת הרגה אותו בגלל זיכרון) — כל ה־WebView שלנו מתו איתו. בלי הטיפול הזה WebView מפיל את
     * כל האפליקציה. כאן: משחררים את כולם, כל טאב חוזר מהמצב האחרון שנשמר (או מהכתובת), והטאב שעל המסך נטען מחדש
     */
    private fun renderGone() {
        for (t in tabs) {
            if (t.web == null) continue
            t.state = t.lastState; kill(t.web); t.web = null
        }
        cur?.let { ui.post { select(it) } }
    }

    /** תמונה קטנה של הדף למסך הטאבים */
    fun snap(t: BrTab) {
        val w = t.web ?: return
        if (w.width <= 0 || w.height <= 0) return
        val now = SystemClock.uptimeMillis()
        if (now - t.snapAt < 2500) return
        t.snapAt = now
        // לפי ת־עיצוב: העתקה אסינכרונית מהמסך (GPU), בלי לצייר את הדף מחדש בתוכנה בתהליכון הראשי — רק לטאב שעל המסך
        if (Build.VERSION.SDK_INT >= 26 && w.isAttachedToWindow && w === cur?.web) {
            val loc = IntArray(2); w.getLocationInWindow(loc)
            val s = 0.35f
            val b = Bitmap.createBitmap((w.width * s).toInt().coerceAtLeast(1), (w.height * s).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
            val ok = runCatching {
                android.view.PixelCopy.request(window, android.graphics.Rect(loc[0], loc[1], loc[0] + w.width, loc[1] + w.height), b, { r ->
                    if (r == android.view.PixelCopy.SUCCESS) { t.thumb = b; if (!t.private) BrPics.saveThumb(t.url, b) }
                }, ui)
            }.isSuccess
            if (ok) return
        }
        runCatching {
            val s = 0.35f
            val b = Bitmap.createBitmap((w.width * s).toInt().coerceAtLeast(1), (w.height * s).toInt().coerceAtLeast(1), Bitmap.Config.RGB_565)
            val c = Canvas(b); c.scale(s, s); c.translate(-w.scrollX.toFloat(), -w.scrollY.toFloat())
            w.draw(c); t.thumb = b
            if (!t.private) BrPics.saveThumb(t.url, b)   // שורד סגירה של האפליקציה (מסך הטאבים אחרי ההפעלה הבאה)
        }
    }

    fun openSwitcher() { cur?.let { snap(it) }; swPrivate = cur?.private == true; menu = false; editing = false; screen = Screen.SWITCHER }

    /** החלקה על שורת הכתובת — הטאב הבא/הקודם באותו סוג (רגיל/פרטי), לפי ת־עיצוב */
    fun swipeTab(dir: Int) {
        val c = cur ?: return
        val same = tabs.filter { it.private == c.private }
        val i = same.indexOf(c) + dir
        if (i in same.indices) select(same[i])
    }

    /* ---------------- הגל השני: מסך מפוצל, שינה, קבוצות וסשנים, מחיקה מהירה ---------------- */

    /** 16: כמה חיות מותר עכשיו — לפי הזיכרון של המכשיר, החיסכון שבחרת, וחיסכון הסוללה של הטלפון */
    fun liveCap(): Int = BrPro.liveCap(liveMax, saver, batterySaving())
    fun liveBase(): Int = liveMax
    fun batterySaving(): Boolean = battery && runCatching { (getSystemService(POWER_SERVICE) as android.os.PowerManager).isPowerSaveMode }.getOrDefault(false)
    /** להרדים כרטיסייה ברקע (מנהל המשימות / החיסכון): המצב נשמר, ה־WebView משתחרר */
    fun sleep(t: BrTab) {
        if (t === cur || t === split || t.web == null) return
        val b = Bundle(); runCatching { t.web?.saveState(b) }; t.state = b
        kill(t.web); t.web = null; tasksRev++
    }
    fun sleepAll() { tabs.toList().forEach { sleep(it) } }
    fun pickSaver(v: Int) { saver = v.coerceIn(0, 2); prefs.saver = saver; trim() }
    fun pickBattery(b: Boolean) { battery = b; prefs.battery = b; trim() }

    /** 40: מצב שולחן — מסך רחב (טאבלט, DeX, מסך חיצוני) או לפי הבחירה */
    fun deskNow(): Boolean = BrPro.desk(desk, resources.configuration.screenWidthDp)
    fun pickDesk(v: Int) { desk = v; prefs.desk = v }
    fun pickStrip(b: Boolean) { strip = b; prefs.strip = b }
    fun pickTools(l: List<String>) { tools = l; prefs.tools = BrPro.toolsEncode(l) }
    fun pickGest(v: Int) { gest = v; prefs.gest = v }
    fun pickNtp(v: Int) { ntpShow = v; prefs.ntp = v }
    fun pickUserColor(i: Int) { ucolor = i; BrUsers.setColor(this, i); usersRev++ }

    /** 13: הכרטיסיות שאפשר לפתוח בחלון השני (מאותו סוג, עם דף) */
    fun splitCands(): List<BrTab> = tabs.filter { it !== cur && it.private == (cur?.private == true) && it.url.startsWith("http") }
    fun toggleSplit() { menu = false; if (split != null) endSplit() else if (splitCands().isEmpty()) startSplit(null) else splitPick = true }
    /** פתיחה במסך מפוצל: עם כרטיסייה קיימת — בחלון השני; בלי — כרטיסייה חדשה בחלון השני, והיא הפעילה (להקלדה) */
    fun startSplit(o: BrTab?) {
        val c = cur ?: return
        splitPick = false; menu = false; screen = Screen.PAGE
        if (o != null) { split = o; splitFirst = true; o.used = SystemClock.uptimeMillis(); wake(o); trim(); return }
        val n = BrTab(nextId++, "", "", c.private && privOk)
        tabs.add(tabs.indexOf(c) + 1, n)
        split = c; splitFirst = false
        select(n); editing = true
    }
    /** נגיעה בחלון השני — הוא הפעיל (שורת הכתובת, ⋮, "חזור"); החלונות נשארים במקום */
    fun focusSplit() {
        val o = split ?: return
        val c = cur ?: return
        split = c; splitFirst = !splitFirst; editing = false; finding = false
        select(o)
    }
    fun endSplit() { split?.web?.onPause(); split = null; trim() }

    /** 17/18: קבוצה שמורה / סשן — נפתחות ככרטיסיות חדשות (נטענות רק כשבוחרים בהן) */
    fun setId(): String = java.lang.Long.toString(System.nanoTime() xor (System.currentTimeMillis() shl 20), 36).takeLast(10)
    fun saveGroup(name: String) {
        val pub = tabs.filter { !it.private && it.url.startsWith("http") }
        sets = BrPro.saveGroup(sets, name, pub.map { it.url to it.title }, System.currentTimeMillis()) { setId() }
        BrStore.saveSets(sets)
        Toast.makeText(this, R.string.brGroupSaved, Toast.LENGTH_SHORT).show()
    }
    fun openSet(s: BrPro.TabSet) {
        if (s.tabs.isEmpty()) return
        val added = s.tabs.map { (u, ti) -> BrTab(nextId++, u, ti, false) }
        tabs.addAll(added)
        screen = Screen.PAGE; select(added.first())
    }
    fun deleteSet(s: BrPro.TabSet) { sets = sets.filter { it.id != s.id }; BrStore.saveSets(sets) }

    /** 74 מחיקה מהירה (לפי ת־עיצוב): ההיסטוריה של הטווח, הכרטיסיות שנפתחו בו (לא נעוצות), "נסגרו לאחרונה" והמטמון */
    fun quickDelete(minutes: Int) {
        quickAsk = false; menu = false
        val since = BrPro.since(System.currentTimeMillis(), minutes)
        val vis = BrStore.history.filter { it.at >= since }
        vis.forEach { BrStore.removeVisit(it) }
        closed.removeAll { it.at >= since }
        val gone = tabs.filter { !it.private && !it.pinned && it.born >= since }
        if (split in gone) split = null
        gone.forEach { kill(it.web); it.web = null }
        tabs.removeAll(gone)
        runCatching { tabs.firstNotNullOfOrNull { it.web }?.clearCache(true) }
        sets = sets.filter { !(it.auto && it.at >= since) }; BrStore.saveSets(sets)
        when {
            tabs.none { !it.private } -> newTab("")
            cur?.let { it in tabs } != true -> select(tabs.last { !it.private })
        }
        markRev++
        Toast.makeText(this, getString(R.string.brQuickDone, vis.size, gone.size), Toast.LENGTH_LONG).show()
    }

    /** 14 תצוגה מקדימה: WebView קטן לקישור, באותו פרופיל של הכרטיסייה (פרטית — בפרופיל הפרטי), בלי חלונות ובלי הורדות */
    @SuppressLint("SetJavaScriptEnabled")
    fun previewWeb(priv: Boolean, onUrl: (String) -> Unit, onTitle: (String) -> Unit): WebView {
        val w = WebView(this)
        if (priv && privOk) runCatching { ProfileStore.getInstance().getOrCreateProfile(PRIV); WebViewCompat.setProfile(w, PRIV) }
        else userProfile()?.let { p -> runCatching { WebViewCompat.setProfile(w, p.name) } }
        val s = w.settings
        s.javaScriptEnabled = true; s.domStorageEnabled = true; s.allowFileAccess = false; s.allowContentAccess = false
        s.mediaPlaybackRequiresUserGesture = true; s.loadWithOverviewMode = true; s.useWideViewPort = true; s.textZoom = zoom
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean = req.url.scheme?.lowercase() !in setOf("http", "https")
            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) { onUrl(url) }
        }
        w.webChromeClient = object : WebChromeClient() { override fun onReceivedTitle(view: WebView, title: String?) { if (!title.isNullOrEmpty()) onTitle(title) } }
        return w
    }
    fun previewOpen(url: String) {
        val t = cur; preview = null
        if (url.startsWith("http")) newTab(url, private = t?.private == true, after = t).parent = t?.id ?: -1L
    }
    fun previewKill(w: WebView) { kill(w) }

    /** 38 מקלדת אמיתית: הקיצורים של הדפדפנים במחשב (BrPro.shortcut). Ctrl+C/V/A/Z — נשארים לדף ולשדות */
    override fun dispatchKeyEvent(e: KeyEvent): Boolean {
        if (e.action == KeyEvent.ACTION_DOWN && e.repeatCount == 0) {
            val id = BrPro.shortcut(e.keyCode, e.isCtrlPressed, e.isShiftPressed, e.isAltPressed)
            if (id != null && keyCmd(id)) return true
        }
        return super.dispatchKeyEvent(e)
    }
    fun keyCmd(id: String): Boolean {
        val t = cur
        val web = t?.url?.startsWith("http") == true
        when {
            id == "newtab" -> { screen = Screen.PAGE; newTab("", private = t?.private == true) }
            id == "private" -> { if (!privOk) return false; screen = Screen.PAGE; newTab("", private = true) }
            id == "close" -> { if (t == null || screen != Screen.PAGE) return false; close(t) }
            id == "reopen" -> { if (closed.isEmpty()) return false; reopen() }
            id == "next" || id == "prev" -> cycleTab(if (id == "next") 1 else -1)
            id.startsWith("tab") -> {
                val same = tabs.filter { it.private == (t?.private == true) }
                val n = id.removePrefix("tab").toIntOrNull() ?: return false
                val pick = if (n == 9) same.lastOrNull() else same.getOrNull(n - 1)
                pick?.let { switchTo(it) } ?: return false
            }
            id == "address" -> { screen = Screen.PAGE; finding = false; editing = true }
            id == "reload" -> { if (!web) return false; reload() }
            id == "find" -> { if (!web) return false; screen = Screen.PAGE; startFind() }
            id == "star" -> { if (!web) return false; toggleMark() }
            id == "history" -> screen = Screen.HISTORY
            id == "downloads" -> openDownloads()
            id == "marks" -> { markPath = ""; screen = Screen.BOOKMARKS }
            id == "back" -> { if (screen != Screen.PAGE) return false; goBack() }
            id == "fwd" -> forward()
            id == "home" -> goHome()
            id == "zoomin" -> pickZoom(zoom + 10)
            id == "zoomout" -> pickZoom(zoom - 10)
            id == "zoom0" -> pickZoom(100)
            id == "split" -> { screen = Screen.PAGE; toggleSplit() }
            id == "tasks" -> screen = Screen.TASKS
            id == "clear" -> clearAsk = true
            id == "keys" -> screen = Screen.KEYS
            else -> return false
        }
        return true
    }
    /** 24 פעולה מהשורה (BrPro.action) — מה שהשורה הציעה, בנגיעה */
    fun runAct(x: BrPro.Act) {
        editing = false; screen = Screen.PAGE
        when (x) {
            BrPro.Act.CLEAR -> clearAsk = true
            BrPro.Act.QUICK -> quickAsk = true
            BrPro.Act.HISTORY -> screen = Screen.HISTORY
            BrPro.Act.MARKS -> { markPath = ""; screen = Screen.BOOKMARKS }
            BrPro.Act.SETTINGS -> screen = Screen.SETTINGS
            BrPro.Act.PRIVATE -> if (privOk) newTab("", private = true)
            BrPro.Act.DOWNLOADS -> openDownloads()
            BrPro.Act.PASSWORDS -> screen = Screen.PASSWORDS
            BrPro.Act.TASKS -> screen = Screen.TASKS
            BrPro.Act.SPLIT -> toggleSplit()
            BrPro.Act.SESSIONS -> screen = Screen.GROUPS
        }
    }

    /** Ctrl+Tab — הבאה, ובסוף חוזרים לראשונה (לפי ת־עיצוב במחשב) */
    fun cycleTab(d: Int) {
        val c = cur ?: return
        val same = tabs.filter { it.private == c.private }
        if (same.size < 2) return
        select(same[(same.indexOf(c) + d).mod(same.size)]); screen = Screen.PAGE
    }

    /* ---------------- ניווט ---------------- */

    fun go(raw: String) {
        // "yt שיר" → חיפוש ביוטיוב (BrPro.KEYWORDS), כמו מילות המפתח של מנועי החיפוש במחשב
        val u = BrPro.keyword(raw)?.let { (k, q) -> BrPro.keywordUrl(k, q) } ?: BrStore.toUrl(raw, engine)
        if (u.isEmpty()) return
        editing = false
        val t = cur ?: newTab("")
        if (t.isNtp) { t.ntpBack = true; t.ntpFwd = null }   // הכרטיסייה החדשה = רשומה בהיסטוריה, לפי ת־עיצוב
        load(t, u)
    }

    fun load(t: BrTab, url: String) {
        t.url = url
        val w = ensureWeb(t)
        applyJs(w, url)
        w.loadUrl(url)
    }

    fun goHome() { cur?.let { t -> kill(t.web); t.web = null; t.state = null; t.url = ""; t.title = ""; t.foundN = 0; t.found.clear() } ; editing = false }

    private fun back() {
        val t = cur
        when {
            customView != null -> hideCustom()
            permAsk != null -> { permAsk?.go?.invoke(false); permAsk = null }
            pick -> pick = false
            preview != null -> preview = null
            splitPick -> splitPick = false
            quickAsk -> quickAsk = false
            ctx != null -> ctx = null
            devSheet -> devSheet = false
            editScript != null -> editScript = null
            pickMode != 0 -> endPick(false)
            t?.editing == true -> toggleEdit(t)
            recTab != null && recTab === t && screen == Screen.PAGE -> stopRec(true)
            sendSheet -> sendSheet = false
            clearAsk -> clearAsk = false
            zoomSheet -> zoomSheet = false
            speedSheet -> speedSheet = false
            info -> info = false
            menu -> menu = false
            finding -> stopFind()
            editing -> editing = false
            screen == Screen.SITE -> screen = Screen.SITES
            screen in settingsSubs -> screen = Screen.SETTINGS
            screen == Screen.BOOKMARKS && markPath.isNotEmpty() -> markPath = BrSync.parent(markPath)
            screen != Screen.PAGE -> screen = Screen.PAGE
            else -> goBack()
        }
    }

    /**
     * "חזור" בדף — הסדר של Chrome לאנדרואיד (ChromeTabbedActivity.minimizeAppAndCloseTabOnBackPress, TabLaunchTypeUtils):
     * הדף הקודם בכרטיסייה → הכרטיסייה החדשה שממנה נפתח הדף הראשון → כרטיסייה שנפתחה מקישור: נסגרת וחוזרים לזו שפתחה אותה →
     * מאפליקציה אחרת: נסגרת וחוזרים לאפליקציה → אחרת הדפדפן יורד לרקע (הכרטיסייה נשארת). עד 27/10/2026 כל "חזור" מהדף הראשון יצא.
     */
    fun goBack() {
        menu = false
        val t = cur
        when {
            t == null -> moveTaskToBack(true)
            t.web?.canGoBack() == true -> t.web?.goBack()
            t.ntpBack && !t.isNtp -> { val u = t.url; goHome(); t.ntpBack = false; t.ntpFwd = u }
            t.fromApp -> { close(t); moveTaskToBack(true) }   // לפי ת־עיצוב: קישור מאפליקציה — "חזור" חוזר אליה
            t.parent >= 0 && tabs.any { it.id == t.parent } -> { val p = tabs.first { it.id == t.parent }; close(t); select(p) }
            else -> moveTaskToBack(true)
        }
    }

    /** יש לאן לחזור בתוך הדפדפן (חץ החזרה בתפריט) */
    fun canGoBackHere(t: BrTab?): Boolean = t != null && (t.canBack || (t.ntpBack && !t.isNtp) || (t.parent >= 0 && tabs.any { it.id == t.parent }))

    fun forward() {
        menu = false
        val t = cur ?: return
        val f = t.ntpFwd
        if (t.isNtp && f != null) { t.ntpFwd = null; t.ntpBack = true; load(t, f) } else t.web?.takeIf { it.canGoForward() }?.goForward()
    }
    fun reload() { val w = cur?.web ?: return; if ((cur?.progress ?: 0) in 1..99) w.stopLoading() else w.reload(); menu = false }

    /* ---------------- WebView ---------------- */

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    fun ensureWeb(t: BrTab): WebView {
        t.web?.let { return it }
        val w = WebView(this)
        // 28/10/2026 (מעבר מקיף — "בלי הבהובים"): עד הצביעה הראשונה של הדף — צבע הדף של הדפדפן (שחור בכהה ובפרטי),
        // לא הלבן של WebView שהבהב. מ־onPageCommitVisible חוזרים ללבן: אתר בלי רקע משלו מניח קנבס לבן
        val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        w.setBackgroundColor(if (t.private) 0xFF131314.toInt() else if (night) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
        // מנהל הסיסמאות של Google (וכל שירות מילוי אחר) ממלא בדפים דרך המילוי האוטומטי של אנדרואיד — WebView תומך בו;
        // כאן רק מוודאים שהוא לא כבוי בטעות לאזור הדף
        // בטאב פרטי — בלי מילוי/שמירה של טפסים (כמו בגלישה בסתר של Chrome)
        if (Build.VERSION.SDK_INT >= 26) w.importantForAutofill = if (t.private) View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS else View.IMPORTANT_FOR_AUTOFILL_YES
        if (t.private && privOk) runCatching {
            ProfileStore.getInstance().getOrCreateProfile(PRIV)
            WebViewCompat.setProfile(w, PRIV)
        } else userProfile()?.let { p -> runCatching { WebViewCompat.setProfile(w, p.name) } }
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
        BrDev.emu(t.emu).ua?.let { s.userAgentString = it }   // 7 התחזות למכשיר (נשמרת לכרטיסייה גם אחרי שה־WebView שוחרר)
        runCatching { cmOf(t).setAcceptThirdPartyCookies(w, !t.private) }   // טאב פרטי: בלי עוגיות של צד שלישי (לפי ת־עיצוב)

        // המערכת יכולה להוריד את ה־renderer לעדיפות נמוכה כשהדפדפן לא מוצג (במקום להרוג את כל האפליקציה) — רק יחד עם onRenderProcessGone
        if (Build.VERSION.SDK_INT >= 26) runCatching { w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true) }
        w.webViewClient = object : WebViewClient() {
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean { renderGone(); return true }
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url.toString()
                val sc = req.url.scheme?.lowercase()
                if (sc == "http" || sc == "https") {
                    if (req.isForMainFrame) {
                        // 42: הפניה אוטומטית לאתר אחר — נחסמת רק באתר שכיבית בו "הפניות"
                        val from = BrStore.hostOf(t.url)
                        if (BrDev.blockRedirect(rules[from]?.redir != false, from, req.url.host ?: "", req.hasGesture(), req.isRedirect)) {
                            ui.post { Toast.makeText(this@BrowserActivity, R.string.brRedirBlocked, Toast.LENGTH_SHORT).show() }; return true
                        }
                        applyJs(view, u)
                    }
                    return false
                }
                if (sc == "about" || sc == "javascript" || sc == "data" || sc == "blob") return false
                external(u, t)
                return true
            }
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                val blk = !req.isForMainFrame && blockReq(t, req.url.host)
                // כלי המפתחים — מה ש־WebView מראה: הכתובת, השיטה והכותרות (בלי גוף ובלי התשובה)
                t.net.add(BrPro.Net(System.currentTimeMillis(), req.method ?: "GET", req.url.toString(), req.isForMainFrame, blk, req.requestHeaders ?: emptyMap()))
                if (blk) return EMPTY()
                seen(t, req.url.toString(), headers = req.requestHeaders); return null
            }
            override fun onPageCommitVisible(view: WebView, url: String) { view.setBackgroundColor(android.graphics.Color.WHITE) }
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (url != t.page && !t.private) { t.la = System.currentTimeMillis(); t.sc = 0f; t.tx = ""; t.mt = 0f; BrCloud.nudge(4000) }
                if (url != t.page) { t.logs.clear(); t.net.add(BrPro.Net(System.currentTimeMillis(), "GET", url, true, false)) }
                // הגל השלישי: עריכה ובחירת רכיב שייכות לדף — מסמך חדש מבטל אותן
                if (url != t.page) { t.editing = false; if (cur === t && pickMode != 0) { pickMode = 0; zappedNow.clear() } }
                if (url != t.page) { t.page = url; t.vid = null; t.blocked = 0; t.playing = false; t.found.clear(); synchronized(t.headSeen) { t.headSeen.clear() }; t.recount(); autoPick(t) }
                // 26/10/2026 (דיווח המשתמש: אחרי רענון של אותו דף הרשימה גדלה בכפילויות): מסמך חדש באותה כתובת (רענון) —
                // הנגן מבקש את הכל מחדש, עם חתימות חדשות. מה שנמצא במסמך הקודם כבר לא רלוונטי
                else { t.found.clear(); synchronized(t.headSeen) { t.headSeen.clear() }; t.recount() }
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
                t.restore?.let { r -> t.restore = null; runCatching { view.evaluateJavascript(BrCloudJs.restore(r), null) } }
                t.url = url; t.page = url
                view.title?.let { if (it.isNotEmpty()) { t.title = it; if (!t.private) BrStore.setTitle(url, it) } }
                t.recount(); navState(t, view)
                markRev++
                pageScripts(t, view, url)
                // המצב האחרון (מחסנית "חזור") — אם ה־renderer ימות, הטאב חוזר ממנו ולא רק מהכתובת
                if (!t.private) runCatching { val b = Bundle(); view.saveState(b); t.lastState = b }
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { t.progress = p }
            override fun onConsoleMessage(m: android.webkit.ConsoleMessage): Boolean {
                val lv = when (m.messageLevel()) { android.webkit.ConsoleMessage.MessageLevel.ERROR -> 2; android.webkit.ConsoleMessage.MessageLevel.WARNING -> 1; else -> 0 }
                t.logs.add(BrPro.Log(System.currentTimeMillis(), lv, m.message().take(2000), "${m.sourceId().substringAfterLast('/').take(60)}:${m.lineNumber()}"))
                return false
            }
            override fun onReceivedTitle(view: WebView, title: String?) { if (!title.isNullOrEmpty()) { t.title = title; if (!t.private) BrStore.setTitle(t.url, title) } }
            override fun onReceivedIcon(view: WebView, icon: Bitmap?) { if (icon != null) { t.icon = icon; if (!t.private) BrPics.saveIcon(BrStore.hostOf(t.url), icon) } }
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                // חלון קופץ בלי נגיעה — חסום, לפי ת־עיצוב; 42: לכל אתר אפשר "מותר תמיד" / "חסום תמיד"
                if (!BrDev.popupOk(rules[BrStore.hostOf(t.url)]?.pop ?: 0, isUserGesture)) return false
                val nt = newTab("", private = t.private, after = t)
                nt.parent = t.id   // נפתחה מקישור: "חזור" בדף הראשון סוגר אותה וחוזר לכאן (FROM_LINK ב־Chrome)
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
            // הגל השלישי: הערוץ של הכלים (רכיב שנבחר / נמחק, צעד שהוקלט / הוצג) — רק מהמסגרת הראשית; ומדדי המהירות מתחילת הדף
            WebViewCompat.addWebMessageListener(w, BrDev.CH, setOf("*")) { _, msg, _, main, _ -> if (main) msg.data?.let { onTool(t, it) } }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(w, BrDev.PERF_START, setOf("*"))
        }
        w.setOnLongClickListener { longPress(t, w) }
        // 13 מסך מפוצל: נגיעה בחלון השני — הוא הפעיל (לא עוצרים את הנגיעה; הדף מקבל אותה כרגיל)
        w.setOnTouchListener { _, e -> if (e.actionMasked == MotionEvent.ACTION_DOWN && split === t) ui.post { if (split === t) focusSplit() }; false }
        applyJs(w, t.url)
        w.setFindListener { active, count, done -> if (done) findRes = (if (count == 0) 0 else active + 1) to count }
        t.web = w
        // מצב שלא נפתח (גרסה אחרת של WebView אחרי עדכון) — טוענים את הכתובת, כמו טאב בלי מצב
        t.state?.let { st ->
            t.state = null
            if (runCatching { w.restoreState(st) }.getOrNull() != null) navState(t, w) else if (t.url.startsWith("http")) w.loadUrl(t.url)
        }
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
        // מונה בלי ציור על כל בקשה שנחסמה: מצטבר, ומתעדכן במסך פעם בחצי שנייה
        if (t.blkQ.getAndIncrement() == 0) ui.postDelayed({ val n = t.blkQ.getAndSet(0); t.blocked += n; blkNew += n }, 500)
        return true
    }

    /** אחרי שהדף נטען: הודעות העוגיות (דחייה / הסתרה) ומהירות הווידאו שבחרת לאתר */
    private fun pageScripts(t: BrTab, w: WebView, url: String) {
        if (!url.startsWith("http")) return
        val host = BrStore.hostOf(url)
        if (cookies && shieldOn(host)) runCatching { w.evaluateJavascript(BrShield.COOKIE_JS, null) }
        val sp = rules[host]?.speed ?: 100
        if (sp != 100) runCatching { w.evaluateJavascript(BrShield.speedJs(sp), null) }
        if (heFix) runCatching { w.evaluateJavascript(BrPro.HEBREW_JS, null) }
        if (rules[host]?.mute == true) runCatching { w.evaluateJavascript(BrPro.muteJs(true), null) }
        // הגל השלישי: רכיבים שהוסתרו תמיד (63), כהה בכוח כשהאפליקציה בהירה (44), סקריפטים של משתמשים (67 — לא בפרטי),
        // הקלטה שנמשכת לדף הבא (66) והרצה של הקלטה מהצעד שהגיעה אליו
        zaps[host]?.let { runCatching { w.evaluateJavascript(BrDev.hideJs(it), null) } }
        if (rules[host]?.dark == true && !night()) runCatching { w.evaluateJavascript(BrDev.DARK_JS, null) }
        if (!t.private) BrDev.runnable(uscripts, url).forEach { sc -> runCatching { w.evaluateJavascript(BrDev.wrap(sc), null) } }
        if (recTab === t) { recSteps = BrDev.addStep(recSteps, BrDev.Step('n', url)); runCatching { w.evaluateJavascript(BrDev.recJs(true), null) } }
        t.replay?.let { st -> runCatching { w.evaluateJavascript(BrDev.replayJs(st, t.replayAt), null) } }
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

    /** קישור לאפליקציה (intent:, mailto:, tel:, market:…) — לפי ת־עיצוב: לאפליקציה שמתאימה, ובלעדיה — כתובת הגיבוי */
    private fun external(u: String, t: BrTab) {
        val i = try {
            if (u.startsWith("intent:")) Intent.parseUri(u, Intent.URI_INTENT_SCHEME).apply { component = null; selector = null }
            else Intent(Intent.ACTION_VIEW, Uri.parse(u))
        } catch (e: Exception) { return }
        // אבטחה (27/10/2026): קישור מדף לא בוחר דגלים (הרשאות לקבצים, משימה חדשה…), לא מכוון לאפליקציה שלנו, ולא פותח
        // קבצים מקומיים / content: — לפי ת־עיצוב מנקה intent: מהרשת
        i.flags = 0
        i.clipData = null
        if (i.`package` == packageName) return
        val sch = i.data?.scheme?.lowercase()
        if (sch == "file" || sch == "content" || sch == "javascript" || sch == "android-app" || sch == "data") return
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
        val priv = t.private
        Thread { if (DmBrowser.headProbe(h, ref, ua, priv)) ui.post { if (t.found.add(h, now)) { t.recount(); autoPick(t) } } }.start()
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

    /**
     * 26/10/2026 (דיווח המשתמש: ביוטיוב הפרטים נטענו אחרי חצי דקה עד דקה): רשימת הפורמטים מהנגן שבדף (YtPage) — מיד
     * כשהנגן עלה, בלי לחכות לבדיקה של yt-dlp (שממשיכה ברקע וגוברת כשהיא מסתיימת). רק בטאב שעל המסך, לא בטאב פרטי
     */
    fun ytSeed(t: BrTab) {
        if (t.private || cur !== t) return
        val page = t.page
        if (!YtPage.isYt(page) || !t.pageIsVideo() || DmPre.seeded(page) || DmPre.state(page) == 2) return
        val w = t.web ?: return
        runCatching {
            w.evaluateJavascript(YtPage.JS) { raw ->
                if (t.page != page) return@evaluateJavascript
                val info = YtPage.toInfo(raw, page) ?: return@evaluateJavascript
                if (DmPre.seed(page, info)) pushDl(t)
            }
        }
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
        val subs = DmSubs.forTask(info.optJSONArray("sub"), !audio)   // 27/10: עם כתוביות כברירת מחדל, כמו בגיליון
        val ref = if (p.page) "" else t.page
        // 01/11/2026: כש־Studio DM מותקן — ההורדה נכנסת לתור שלו (DmBridge), אחרת לתור של הדפדפן
        if (DmBridge.remote(this)) {
            if (!DmBridge.sendTask(this, DmPre.build(this, p.url, info, q, audio, ref, ck = true, tr = tr, subs = subs), runCatching { t.web?.settings?.userAgentString }.getOrNull() ?: "", listOf(t.page))) {
                Toast.makeText(this, R.string.dmErrFail, Toast.LENGTH_SHORT).show(); return
            }
            pick = false; return
        }
        DmPre.enqueue(this, p.url, info, q, audio, ref, ck = true, tr = tr, subs = subs)
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
        ytSeed(t)
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

    /** ההורדות: Studio DM כשהוא מותקן (לשם הן עוברות — DmBridge), אחרת מנהל ההורדות שבתוך הדפדפן */
    private fun dmIntent(): Intent = (if (DmBridge.remote(this)) packageManager.getLaunchIntentForPackage(AppRoute.DM_PKG) else null) ?: Intent(this, DmActivity::class.java)
    fun openDownloads() { menu = false; runCatching { startActivity(dmIntent()) } }

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
        runCatching { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, linkOut(t.url)).putExtra(Intent.EXTRA_SUBJECT, t.title), getString(R.string.brShare))) }
    }

    fun copyLink() {
        val t = cur ?: return
        getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("url", linkOut(t.url)))
        Toast.makeText(this, R.string.brCopied, Toast.LENGTH_SHORT).show()
    }

    /** קישור שיוצא מהדפדפן (העתקה, שיתוף) — בלי פרמטרי מעקב, כשהמתג במעבדה דולק */
    fun linkOut(u: String) = if (cleanCopy) BrPro.clean(u) else u

    fun copyText(s: String, toast: Int = R.string.brCopied) {
        getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("text", s))
        Toast.makeText(this, toast, Toast.LENGTH_SHORT).show()
    }

    fun shareText(s: String) {
        runCatching { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, s), getString(R.string.brShare))) }
    }

    /* ---------------- Pro: הגיליון של לחיצה ארוכה ---------------- */

    /** לחיצה ארוכה בדף: קישור / תמונה / תמונה בתוך קישור → הגיליון (ctx). טקסט — נשאר לבחירה של WebView */
    private fun longPress(t: BrTab, w: WebView): Boolean {
        val h = w.hitTestResult
        val type = h.type
        if (type != WebView.HitTestResult.SRC_ANCHOR_TYPE && type != WebView.HitTestResult.IMAGE_TYPE && type != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) return false
        val extra = h.extra
        val hd = Handler(Looper.getMainLooper()) { m ->
            val d = m.data
            val link = (d.getString("url") ?: if (type == WebView.HitTestResult.SRC_ANCHOR_TYPE) extra else null)?.takeIf { it.startsWith("http") }
            val img = if (type == WebView.HitTestResult.SRC_ANCHOR_TYPE) null else (d.getString("src") ?: extra)?.takeIf { it.startsWith("http") }
            if (link != null || img != null) { w.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS); ctx = Ctx(t, link, img, d.getString("title").orEmpty().trim()) }
            true
        }
        w.requestFocusNodeHref(hd.obtainMessage())
        return true
    }

    /** פתיחת הקישור מהגיליון: בכרטיסייה חדשה, ברקע (בלי לעבור אליה) או בפרטית */
    fun ctxOpen(url: String, background: Boolean = false, private: Boolean = false) {
        val c = ctx ?: return
        ctx = null
        val priv = (private || c.tab.private) && privOk
        if (background) {
            val n = BrTab(nextId++, url, "", priv)
            n.parent = c.tab.id
            tabs.add(tabs.indexOf(c.tab) + 1, n)
            Toast.makeText(this, R.string.brOpenedBg, Toast.LENGTH_SHORT).show()
        } else newTab(url, private = priv, after = c.tab).parent = c.tab.id
    }

    /** הורדה מהגיליון — אותו מסלול של הורדה מהדף (DmActivity, עם העוגיות של האתר) */
    fun ctxDownload(url: String) { val c = ctx ?: return; ctx = null; send(c.tab, url, c.tab.page, file = true) }

    /* ---------------- Pro: הגדרות אתר — JavaScript, השתקה, תעודה ---------------- */

    /** JavaScript לפי האתר — נקבע לפני שהדף נטען (WebView לא משנה סקריפטים של דף שכבר רץ) */
    private fun applyJs(w: WebView, url: String) {
        val r = rules[BrStore.hostOf(url)]
        val s = w.settings
        val on = r?.js != false
        if (s.javaScriptEnabled != on) s.javaScriptEnabled = on
        // הגל השלישי (42, 44): תמונות, חלונות קופצים בלי נגיעה, כהה אלגוריתמי (פועל כשערכת הנושא כהה; בבהירה — DARK_JS ב־pageScripts)
        val img = r?.img != false
        if (s.loadsImagesAutomatically != img) { s.loadsImagesAutomatically = img; s.blockNetworkImage = !img }
        s.javaScriptCanOpenWindowsAutomatically = r?.pop == 1
        val dark = r?.dark == true
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) runCatching {
            if (androidx.webkit.WebSettingsCompat.isAlgorithmicDarkeningAllowed(s) != dark) androidx.webkit.WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, dark)
        }
    }

    fun setSiteJs(t: BrTab, on: Boolean) {
        val h = BrStore.hostOf(t.url).ifEmpty { return }
        setRule(h) { it.copy(js = on) }
        t.web?.let { applyJs(it, t.url); it.reload() }
    }

    fun setSiteMute(t: BrTab, on: Boolean) {
        val h = BrStore.hostOf(t.url).ifEmpty { return }
        setRule(h) { it.copy(mute = on) }
        runCatching { t.web?.evaluateJavascript(BrPro.muteJs(on), null) }
    }
    fun siteJs(t: BrTab) = rules[BrStore.hostOf(t.url)]?.js != false
    fun muted(t: BrTab?) = t != null && rules[BrStore.hostOf(t.url)]?.mute == true

    /** התעודה של הדף: למי הונפקה, מי הנפיק, עד מתי — null בדף לא מאובטח */
    fun cert(t: BrTab): Triple<String, String, Long>? {
        val c = t.web?.certificate ?: return null
        val to = c.issuedTo?.cName.orEmpty()
        val by = c.issuedBy?.oName?.takeIf { it.isNotEmpty() } ?: c.issuedBy?.cName.orEmpty()
        return Triple(to, by, c.validNotAfterDate?.time ?: 0L)
    }

    /* ---------------- Pro: כלי מפתחים, מעבדה ---------------- */

    fun runJs(t: BrTab, code: String) {
        val w = t.web ?: return
        if (code.isBlank()) return
        t.logs.add(BrPro.Log(System.currentTimeMillis(), 3, code, ""))
        runCatching { w.evaluateJavascript(code) { r -> t.logs.add(BrPro.Log(System.currentTimeMillis(), 4, BrPro.evalShow(r), "")) } }
    }

    /* ---------------- הגל השלישי (01/11/2026, BrDev): כלי מפתחים ושליטה באתר ---------------- */

    private fun night() = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private fun say(r: Int) = Toast.makeText(this, r, Toast.LENGTH_SHORT).show()
    private fun js(t: BrTab, code: String, cb: ((String?) -> Unit)? = null) {
        val w = t.web ?: run { cb?.invoke(null); return }
        runCatching { w.evaluateJavascript(code) { cb?.invoke(it) } }.onFailure { cb?.invoke(null) }
    }

    /** מה שהדף שלח בערוץ הכלים — מתקבל רק כשהכלי המתאים פועל בכרטיסייה הזו (דף לא יכול "להזריק" צעדים או בחירות) */
    private fun onTool(t: BrTab, d: String) {
        when {
            d.startsWith("p:") -> if (pickMode == BrDev.PICK_INSPECT && cur === t) { picked = BrDev.pickedParse(d.drop(2)); pickMode = 0; devPane = 3; devSheet = true }
            d.startsWith("z:") -> if (pickMode == BrDev.PICK_ZAP && cur === t) d.drop(2).takeIf { it.isNotEmpty() && it !in zappedNow }?.let { zappedNow.add(it) }
            d.startsWith("r:") -> if (recTab === t) BrDev.stepParse(d.drop(2))?.let { recSteps = BrDev.addStep(recSteps, it) }
            d.startsWith("q:") -> t.replay?.let { st ->
                val i = d.drop(2).toIntOrNull() ?: return
                if (i < 0) { t.replay = null; say(R.string.brMacroMissing) }
                else { t.replayAt = i + 1; if (t.replayAt >= st.size) { t.replay = null; say(R.string.brMacroDone) } }
            }
        }
    }

    /** 5 בדיקת רכיב / 63 מחיקת רכיב: הגיליון נסגר, ונוגעים בדף */
    fun startPick(mode: Int) {
        val t = cur ?: return
        menu = false; devSheet = false; picked = null; zappedNow.clear(); pickMode = mode
        js(t, BrDev.pickJs(mode))
    }
    /** always = "תמיד באתר הזה" — מה שנמחק נשמר ומוסתר בכל ביקור */
    fun endPick(always: Boolean) {
        val t = cur; val m = pickMode
        pickMode = 0
        t?.let { js(it, BrDev.pickJs(0)) }
        if (m == BrDev.PICK_ZAP && always && t != null && zappedNow.isNotEmpty()) addZaps(BrStore.hostOf(t.url), zappedNow.toList())
        zappedNow.clear()
    }
    fun addZaps(host: String, sels: List<String>) {
        if (host.isEmpty()) return
        setZaps(zaps + (host to ((zaps[host] ?: emptyList()) + sels).distinct().takeLast(BrDev.ZAPS_MAX)))
        tabs.filter { BrStore.hostOf(it.url) == host }.forEach { js(it, BrDev.hideJs(zaps[host] ?: emptyList())) }
    }
    private fun setZaps(m: Map<String, List<String>>) { zaps = m.filterValues { it.isNotEmpty() }; prefs.zaps = BrDev.zapsEncode(zaps); sitesRev++ }
    fun zapCount(host: String) = zaps[host]?.size ?: 0
    fun clearZaps(host: String) {
        setZaps(zaps - host)
        tabs.filter { BrStore.hostOf(it.url) == host }.forEach { js(it, BrDev.hideJs(emptyList())); it.web?.reload() }
    }
    /** מהלוח של הרכיב: הסתרה עכשיו (ואם always — גם בביקורים הבאים) */
    fun hidePicked(t: BrTab, sel: String, always: Boolean) {
        js(t, "(function(){try{document.querySelectorAll(${org.json.JSONObject.quote(sel)}).forEach(function(e){e.style.setProperty('display','none','important')})}catch(e){}})()")
        if (always) addZaps(BrStore.hostOf(t.url), listOf(sel))
        devSheet = false
    }

    /** 4 העוגיות והאחסון של הדף */
    fun storage(t: BrTab, cb: (BrDev.Storage?, List<BrDev.Cookie>) -> Unit) = js(t, BrDev.STORAGE_JS) { r ->
        val s = BrDev.storageParse(r)
        val cm = if (t.url.startsWith("http")) runCatching { cmOf(t).getCookie(t.url) }.getOrNull() else null
        cb(s, BrDev.cookies(cm, s?.doc))
    }
    fun delCookie(t: BrTab, name: String) {
        val cm = cmOf(t); val h = BrStore.hostOf(t.url).ifEmpty { return }
        BrDev.expire(name, h).forEach { runCatching { cm.setCookie(t.url, it) } }
        runCatching { cm.flush() }
    }
    fun delStorage(t: BrTab, kind: Char, key: String?) = js(t, BrDev.delStorageJs(kind, key))

    /** 6 קוד המקור (כפי שהדף עכשיו), 9 דוח מהירות */
    fun source(t: BrTab, cb: (String) -> Unit) = js(t, BrDev.SOURCE_JS) { cb(BrDev.unquote(it)) }
    fun perf(t: BrTab, cb: (BrDev.Perf?) -> Unit) = js(t, BrDev.PERF_JS) { cb(BrDev.perfParse(it)) }

    /** 7 התחזות למכשיר: ה־User-Agent של הכרטיסייה (מחשב = גם בלי "תצוגת מחשב" נפרדת), ונטען מחדש */
    fun setEmu(t: BrTab, id: String) {
        val e = BrDev.emu(id)
        t.emu = e.id
        if (e.id.isNotEmpty()) t.desktop = false
        val w = t.web ?: return
        w.settings.userAgentString = e.ua
        w.reload()
    }

    /** 8 עריכת הדף (designMode) — עד "סיום" או עד דף חדש */
    fun toggleEdit(t: BrTab) {
        menu = false; devSheet = false
        t.editing = !t.editing
        js(t, BrDev.editJs(t.editing))
    }

    /** 66 הקלטת פעולות — לא בפרטי (ההקלטה נשמרת) */
    fun startRec() {
        val t = cur?.takeIf { it.url.startsWith("http") && !it.private } ?: return
        menu = false; devSheet = false
        recTab = t; recSteps = emptyList(); recUrl = t.url
        js(t, BrDev.recJs(true))
    }
    fun stopRec(save: Boolean) {
        val t = recTab ?: return
        recTab = null
        js(t, BrDev.recJs(false))
        val steps = recSteps.dropLastWhile { it.k == 'n' }
        if (save && steps.any { it.k != 'n' }) {
            val m = BrDev.Macro(System.currentTimeMillis().toString(36), recUrl, t.title.ifEmpty { BrStore.hostOf(recUrl) }.take(60), steps)
            setMacros((listOf(m) + macros).take(BrDev.MACROS_MAX)); say(R.string.brMacroSaved)
        }
        recSteps = emptyList()
    }
    fun setMacros(l: List<BrDev.Macro>) { macros = l; prefs.macros = BrDev.macrosEncode(l) }
    fun play(m: BrDev.Macro) {
        val t = cur?.takeIf { !it.private } ?: newTab("")
        screen = Screen.PAGE
        t.replay = m.steps; t.replayAt = 0
        load(t, m.url)
    }

    /** 67 סקריפטים של משתמשים — נשמרים בטלפון בלבד (לא בענן) */
    fun saveScript(sc: BrDev.UScript) {
        val l = if (uscripts.any { it.id == sc.id }) uscripts.map { if (it.id == sc.id) sc else it } else uscripts + sc
        uscripts = l.take(BrDev.SCRIPTS_MAX); prefs.uscripts = BrDev.scriptsEncode(uscripts)
    }
    fun delScript(id: String) { uscripts = uscripts.filter { it.id != id }; prefs.uscripts = BrDev.scriptsEncode(uscripts) }

    /** 65 מעקב אחרי שינוי בדף */
    fun addWatch(t: BrTab) {
        menu = false
        if (t.private || !t.url.startsWith("http")) return
        say(if (BrWatch.add(this, t.url, t.title)) R.string.brWatchAdded else R.string.brWatchHave)
        watches = BrWatch.load(this)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            runCatching { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7) }
    }
    fun watchSet(id: String, f: (BrDev.Watch) -> BrDev.Watch) { BrWatch.update(this, id, f); watches = BrWatch.load(this) }
    fun watchReload() { val l = BrWatch.load(this); if (l != watches) watches = l }
    fun watchDel(id: String) { BrWatch.remove(this, id); watches = BrWatch.load(this) }
    fun watchOpen(w: BrDev.Watch) { watchSet(w.id) { it.copy(changed = 0L) }; screen = Screen.PAGE; newTab(w.url) }

    /** 42/44 שינוי שצריך טעינה מחדש (תמונות, כהה, חלונות קופצים, הפניות) — בכל הכרטיסיות של האתר */
    fun setSiteReload(host: String, f: (BrShield.SiteRule) -> BrShield.SiteRule) {
        setRule(host, f)
        tabs.filter { BrStore.hostOf(it.url) == host }.forEach { t -> t.web?.let { applyJs(it, t.url); it.reload() } }
    }

    fun pickHeFix(b: Boolean) { heFix = b; prefs.heFix = b; if (b) cur?.web?.let { runCatching { it.evaluateJavascript(BrPro.HEBREW_JS, null) } } }
    fun pickCleanCopy(b: Boolean) { cleanCopy = b; prefs.cleanCopy = b }

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
        t.desktop = !t.desktop; t.emu = ""
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
     * הרשאה לאתר: מה שכבר החלטת לאתר הזה (הגדרות האתר) — בלי לשאול שוב, לפי ת־עיצוב; אחרת שואלים אותך (בשם האתר)
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

    /** הצעות החיפוש של המנוע שנבחר (לפי ת־עיצוב). רק כשהמתג פועל; בלי עוגיות; עד 2 שניות; רק טקסט */
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
        val cm = cmOf(t)
        val ws = wsOf(t)
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
        BrStore.clearHistory(); BrStore.clearStates()
        val p = userProfile()
        runCatching { val cm = p?.cookieManager ?: CookieManager.getInstance(); cm.removeAllCookies(null); cm.flush() }
        runCatching { (p?.webStorage ?: WebStorage.getInstance()).deleteAllData() }
        tabs.forEach { t -> runCatching { t.web?.clearCache(true); t.web?.clearHistory() }; t.lastState = null; if (t.web == null) t.state = null; t.web?.let { navState(t, it) } }
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

    fun dlSettings() { runCatching { startActivity(dmIntent()) } }

    fun version(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName ?: "" }.getOrDefault("")

    /** מנוע הדפדפן (Android System WebView — מתעדכן מ־Google Play עם עדכוני האבטחה של Chromium): הגרסה הראשית שלו */
    fun engineMajor(): Int = runCatching { WebViewCompat.getCurrentWebViewPackage(this)?.versionName?.substringBefore('.')?.toInt() }.getOrNull() ?: 0
    fun engineVersion(): String = runCatching { WebViewCompat.getCurrentWebViewPackage(this)?.versionName }.getOrNull() ?: ""
    /** הגרסה הצפויה היום: Chromium 159 ב־27/10/2026 ואחת חדשה כל 4 שבועות. מאחר ב־3 ומעלה (כשלושה חודשי עדכוני אבטחה) — מתריעים */
    fun engineOld(): Boolean {
        val m = engineMajor(); if (m == 0) return false
        val exp = 159 + ((System.currentTimeMillis() - 1793059200000L) / (28L * 86_400_000)).toInt().coerceAtLeast(0)
        return m <= exp - 3
    }
    fun updateEngine() {
        val pkg = runCatching { WebViewCompat.getCurrentWebViewPackage(this)?.packageName }.getOrNull() ?: "com.google.android.webview"
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))) }.onFailure {
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))) }
        }
    }

    companion object {
        const val PRIV = "private"
        const val USER_NEW = "snb_user_new"
        const val LIVE_MAX = 6   // (עד 27/10/2026 קבוע; היום liveMax לפי הזיכרון — נשאר לבדיקות ישנות)
        /** מהבועה ב־Chrome: כמה זמן מחכים לממצא הראשון כדי לפתוח את הרשימה לבד */
        const val HUNT_MS = 45_000L
        const val CHROME_EVERY = 5 * 60_000L
        const val MEASURE_EVERY = 8_000L
        const val SLEEP_EVERY = 60_000L
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
