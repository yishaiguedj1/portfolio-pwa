package io.github.yishaiguedj1.snowball

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import kotlin.math.abs

/**
 * 22/10/2026 (שלב 1.5 של ההורדה מקישור, בקשת המשתמש: "כמו IDM, בלי פעולה נוספת"): בועה שמופיעה לבד כשפותחים
 * סרטון בדפדפן, ונגיעה בה שולחת את הקישור ל־Studio (אותו מסלול של "שיתוף ← Studio": MainActivity → ‎#share=).
 * 26/10/2026: מחוברת ל־Studio Browser — דף עם נגן (ולחיצה ארוכה על כל בועה) נפתח שם, והצייד שם מוצא את הזרמים
 * האמיתיים ופותח את רשימת ההורדה. בתוך Studio Browser עצמו הבועה הזו נעלמת — שם יש בועה משלו (BrUi.HuntBubble),
 * שמחוברת ישירות לצייד.
 *
 * פרטיות: השירות מקבל אירועים רק מדפדפנים (packageNames ב־res/xml/grab_service.xml), קורא רק את שורת הכתובת
 * (לפי המזהה שלה), לא שומר ולא שולח כלום — רק בנגיעה, ורק את הקישור.
 * הבועה = חלון TYPE_ACCESSIBILITY_OVERLAY — בלי הרשאת "הצגה מעל אפליקציות" ובלי התראה קבועה.
 * יציאה מהדפדפן: אין אירועים מאפליקציות אחרות, לכן כשהבועה מוצגת בודקים כל שנייה מי בחזית.
 */
class GrabService : AccessibilityService() {
    private val h = Handler(Looper.getMainLooper())
    // 23/10/2026: החיפוש אחרי נגן בעץ של דף כבד לוקח מאות קריאות לדפדפן — רץ ברקע, לא בתהליכון של הבועה
    private val deepThread = HandlerThread("grab-deep").apply { start() }
    private val deepH = Handler(deepThread.looper)
    private var wm: WindowManager? = null
    private var root: LinearLayout? = null
    private var bubble: View? = null
    private var hint: TextView? = null
    private var lp: WindowManager.LayoutParams? = null
    private var shownFor: String? = null        // הכתובת (או האתר) שהבועה מוצגת בשבילה
    private var hit: VideoUrl.Hit = VideoUrl.Hit.None
    private var hitPkg: String? = null
    // 26/10/2026: אתרים שבהם הורדת דרך הדפדפן של DM (שם ההתחברות) — נקראים מ־DM לכל היותר פעם בדקה, ברקע
    @Volatile private var sites: Set<String> = emptySet()
    private var sitesAt = 0L
    private var hitKnown = false               // הבועה הזו = אתר מהרשימה → הדף לדפדפן של DM
    private val dismissed = LinkedHashSet<String>()   // "לא עכשיו" לכתובת הזו (גרירה לתחתית) — עד שהשירות נעצר
    private lateinit var prefs: SharedPreferences

    private val check = Runnable { scan() }
    private val watch = object : Runnable {
        override fun run() {
            if (root == null) return
            val pkg = try { rootInActiveWindow?.packageName?.toString() } catch (e: Exception) { null }
            if (pkg != null && pkg != packageName && pkg !in URL_BAR) hide() else h.postDelayed(this, 1000)
        }
    }
    private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, k -> if (k == KEY_ON && !isOn(this)) hide() }

    override fun onServiceConnected() {
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        prefs.registerOnSharedPreferenceChangeListener(prefListener)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        GrabTile.refresh(this)
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent?) {
        val pkg = e?.packageName?.toString() ?: return
        if (pkg == packageName || pkg !in URL_BAR) return
        h.removeCallbacks(check)
        h.postDelayed(check, if (e.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) 120L else 350L)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        hide()
        if (::prefs.isInitialized) prefs.unregisterOnSharedPreferenceChangeListener(prefListener)
        h.removeCallbacksAndMessages(null)
        deepThread.quitSafely()
        GrabTile.refresh(this)
        super.onDestroy()
    }

    /* מה בשורת הכתובת עכשיו */
    private fun scan() {
        if (!isOn(this)) { hide(); return }
        val r = try { rootInActiveWindow } catch (e: Exception) { null } ?: return
        val pkg = r.packageName?.toString() ?: return
        val ids = URL_BAR[pkg] ?: return
        val node = findBar(r, pkg, ids)
        if (node == null) return                       // מסך מלא / השורה מוסתרת — הבועה נשארת כמו שהיא
        if (node.isFocused) { hide(); return }         // המשתמש מקליד כתובת
        var c = VideoUrl.classify(node.text)
        val now = android.os.SystemClock.uptimeMillis()
        if (now - sitesAt > 60_000L) { sitesAt = now; deepH.post { sites = AppRoute.dmSites(this) } }
        var known = false
        if (c is VideoUrl.Hit.None) {
            val pg = VideoUrl.page(node.text)
            if (pg != null && SiteList.has(sites, SiteList.hostOf(pg))) { c = VideoUrl.Hit.Page(pg, VideoUrl.pageIsBare(pg)); known = true }
        }
        if (c is VideoUrl.Hit.None && prefs.getBoolean(KEY_DEEP, true)) {
            // הניסוי: דף באתר לא מוכר — מחפשים בו נגן (פעם בכמה שניות לכל דף, עד שנמצא), ואז מציעים את הדף עצמו
            val pg = VideoUrl.page(node.text)
            if (pg != null && deepHas(r, pg)) c = VideoUrl.Hit.Page(pg, VideoUrl.pageIsBare(pg))
        }
        val key = when (c) { is VideoUrl.Hit.Video -> c.url; is VideoUrl.Hit.SiteOnly -> "site:" + c.host; is VideoUrl.Hit.Page -> c.url; else -> null }
        if (key == null || key in dismissed) { hide(); return }
        hit = c; hitPkg = pkg; hitKnown = known
        if (key != shownFor) show(key)
    }

    /* הניסוי — מצא נגן בדף: סריקה רחבה של עץ הנגישות עם תקרה (צמתים, עומק, זמן), ותוצאה שמורה לכל כתובת.
       הסריקה ברקע (deepH); כשנמצא נגן — scan() שוב בתהליכון הראשי. דף שלא נמצא בו נגן נבדק שוב רק אחרי
       DEEP_AGAIN (הנגן נטען מאוחר), ועד DEEP_TRIES פעמים */
    private var deepUrl = ""
    @Volatile private var deepFound = false
    private var deepAt = 0L
    private var deepTries = 0
    private var deepBusy = false

    private fun deepHas(r: AccessibilityNodeInfo, url: String): Boolean {
        val now = android.os.SystemClock.uptimeMillis()
        if (url != deepUrl) { deepUrl = url; deepFound = false; deepAt = 0L; deepTries = 0 }
        if (deepFound) return true
        if (deepBusy || deepTries >= DEEP_TRIES || now - deepAt < DEEP_AGAIN) return false
        deepAt = now; deepTries++; deepBusy = true
        val root = AccessibilityNodeInfo.obtain(r)
        deepH.post {
            val found = try { findVideo(root, android.os.SystemClock.uptimeMillis()) } catch (e: Exception) { false }
            h.post {
                deepBusy = false
                if (found && url == deepUrl) { deepFound = true; scan() }
                else if (!found && deepTries < DEEP_TRIES) { h.removeCallbacks(check); h.postDelayed(check, DEEP_AGAIN) }
            }
        }
        return false
    }

    private fun findVideo(root: AccessibilityNodeInfo, t0: Long): Boolean {
        val q = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
        q.add(root to 0)
        var n = 0
        while (q.isNotEmpty()) {
            val (v, d) = q.removeFirst()
            if (++n > DEEP_NODES || android.os.SystemClock.uptimeMillis() - t0 > DEEP_MS) return false
            val ex = try { v.extras } catch (e: Exception) { null }
            val role = ex?.getCharSequence("AccessibilityNodeInfo.chromeRole")
            val desc = ex?.getCharSequence("AccessibilityNodeInfo.roleDescription")
            if (VideoUrl.isVideoNode(v.className, role, desc)) return true
            if (d < DEEP_DEPTH) for (i in 0 until v.childCount) { val ch = try { v.getChild(i) } catch (e: Exception) { null }; if (ch != null) q.add(ch to d + 1) }
        }
        return false
    }

    private fun findBar(r: AccessibilityNodeInfo, pkg: String, ids: List<String>): AccessibilityNodeInfo? {
        for (id in ids) {
            val l = try { r.findAccessibilityNodeInfosByViewId("$pkg:id/$id") } catch (e: Exception) { null }
            l?.firstOrNull { !TextUtils.isEmpty(it.text) }?.let { return it }
        }
        return null
    }

    // ---------- הבועה ----------

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

    private fun show(key: String) {
        shownFor = key
        val w = wm ?: return
        if (root != null) return                       // כבר מוצגת — רק הכתובת התחלפה
        val right = prefs.getBoolean(KEY_RIGHT, true)
        val size = dp(54f).toInt()
        val b = BubbleView(this).apply {
            contentDescription = getString(R.string.grabBubble)
            layoutParams = LinearLayout.LayoutParams(size, size)
            elevation = dp(6f)
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f).toInt(), dp(8f).toInt(), dp(8f).toInt(), dp(8f).toInt())
            clipToPadding = false
            clipChildren = false
            layoutDirection = View.LAYOUT_DIRECTION_LTR
        }
        // תווית קצרה ליד הבועה — רק בשלוש הפעמים הראשונות (שיהיה ברור מה זה), ונעלמת אחרי 2.5 שנ׳
        val shows = prefs.getInt(KEY_HINTS, 0)
        val t = if (shows < 3) TextView(this).apply {
            text = getString(R.string.grabHint)
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(dp(12f).toInt(), dp(7f).toInt(), dp(12f).toInt(), dp(7f).toInt())
            background = GradientDrawable().apply { cornerRadius = dp(999f); setColor(0xE61C1C1E.toInt()) }
            elevation = dp(4f)
            val m = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            if (right) m.rightMargin = dp(8f).toInt() else m.leftMargin = dp(8f).toInt()
            layoutParams = m
        } else null
        if (t != null && right) box.addView(t)
        box.addView(b)
        if (t != null && !right) box.addView(t)
        if (t != null) prefs.edit().putInt(KEY_HINTS, shows + 1).apply()

        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or (if (right) Gravity.RIGHT else Gravity.LEFT)
            x = 0
            y = prefs.getInt(KEY_Y, (resources.displayMetrics.heightPixels * 0.42f).toInt())
        }
        wireTouch(b, box, p)
        try { w.addView(box, p) } catch (e: Exception) { return }
        root = box; bubble = b; hint = t; lp = p
        box.alpha = 0f; b.scaleX = 0.6f; b.scaleY = 0.6f
        box.animate().alpha(1f).setDuration(180).start()
        b.animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(DecelerateInterpolator(2f)).start()
        t?.let { h.postDelayed({ hideHint() }, 2500) }
        h.removeCallbacks(watch)
        h.postDelayed(watch, 1000)
    }

    private fun hideHint() {
        val t = hint ?: return
        hint = null
        t.animate().alpha(0f).setDuration(200).withEndAction { (t.parent as? LinearLayout)?.removeView(t) }.start()
    }

    private fun hide() {
        shownFor = null
        h.removeCallbacks(watch)
        val box = root ?: return
        root = null; bubble = null; hint = null; lp = null
        box.animate().alpha(0f).setDuration(150).withEndAction { try { wm?.removeView(box) } catch (e: Exception) {} }.start()
    }

    private fun wireTouch(b: View, box: View, p: WindowManager.LayoutParams) {
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        var sx = 0f; var sy = 0f; var y0 = 0; var dragging = false; var low = false; var held = false
        val dm = resources.displayMetrics
        // 26/10/2026: לחיצה ארוכה = לפתוח את הדף ב־Studio Browser (הצייד שם רואה את הזרמים האמיתיים של הדף)
        val hold = Runnable {
            if (!dragging && AppRoute.browserInstalled(this)) { held = true; b.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS); send(toBr = true) }
        }
        b.setOnTouchListener { v, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    sx = ev.rawX; sy = ev.rawY; y0 = p.y; dragging = false; low = false; held = false
                    v.animate().scaleX(0.92f).scaleY(0.92f).setDuration(90).start()
                    h.postDelayed(hold, ViewConfiguration.getLongPressTimeout().toLong())
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = ev.rawX - sx; val dy = ev.rawY - sy
                    if (!dragging && (abs(dx) > slop || abs(dy) > slop)) { dragging = true; h.removeCallbacks(hold); hideHint() }
                    if (dragging) {
                        p.y = (y0 + dy).toInt().coerceIn(dp(24f).toInt(), dm.heightPixels - dp(90f).toInt())
                        // גרירה לצד השני: x נמדד מהקצה שהבועה צמודה אליו
                        val right = p.gravity and Gravity.RIGHT == Gravity.RIGHT
                        p.x = (if (right) -dx else dx).toInt().coerceAtLeast(0)
                        try { wm?.updateViewLayout(box, p) } catch (e: Exception) {}
                        val nowLow = ev.rawY > dm.heightPixels * 0.86f
                        if (nowLow != low) {
                            low = nowLow
                            box.alpha = if (low) 0.45f else 1f
                            if (low) v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                        }
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    h.removeCallbacks(hold)
                    v.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    if (held) Unit
                    else if (!dragging) {
                        if (ev.actionMasked == MotionEvent.ACTION_UP) { v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); send() }
                    } else if (low) {
                        shownFor?.let { dismissed.add(it); while (dismissed.size > 50) dismissed.remove(dismissed.first()) }
                        hide()
                    } else snap(box, p, ev.rawX < dm.widthPixels / 2f)
                }
            }
            true
        }
    }

    /* שחרור אחרי גרירה → נצמדת לצד הקרוב, נשמר לפעם הבאה */
    private fun snap(box: View, p: WindowManager.LayoutParams, left: Boolean) {
        val right = !left
        val wasRight = p.gravity and Gravity.RIGHT == Gravity.RIGHT
        if (right != wasRight) {
            // מעבר צד: מחשבים את המיקום ביחס לקצה החדש, כדי שההחלקה תתחיל מאיפה שהאצבע עזבה
            p.x = (resources.displayMetrics.widthPixels - box.width - p.x).coerceAtLeast(0)
            p.gravity = Gravity.TOP or (if (right) Gravity.RIGHT else Gravity.LEFT)
        }
        prefs.edit().putBoolean(KEY_RIGHT, right).putInt(KEY_Y, p.y).apply()
        val a = ValueAnimator.ofInt(p.x, 0).setDuration(220)
        a.interpolator = DecelerateInterpolator(2f)
        a.addUpdateListener { p.x = it.animatedValue as Int; try { if (root === box) wm?.updateViewLayout(box, p) } catch (e: Exception) {} }
        a.start()
    }

    /* נגיעה: הקישור → Studio (כמו "שיתוף"). כשהשורה מציגה רק את שם האתר — פותחים אותה רגע כדי לקרוא את הכתובת המלאה.
       toBr = לחיצה ארוכה: הדף ל־Studio Browser */
    private fun send(toBr: Boolean = false) {
        when (val c = hit) {
            is VideoUrl.Hit.Video -> open(c.url, toBr, false)
            is VideoUrl.Hit.Page -> if (c.bare) readFull(c.url, toBr) else open(c.url, toBr, true)
            is VideoUrl.Hit.SiteOnly -> readFull(null, toBr)
            else -> hide()
        }
    }

    /* page = הדף שבו נמצא נגן (השורה הציגה רק שם אתר): מה שנקרא בשורה הפתוחה — ואם לא נקרא, הדף עצמו */
    private fun readFull(page: String?, toBr: Boolean) {
        val pkg = hitPkg ?: return
        val r = try { rootInActiveWindow } catch (e: Exception) { null } ?: return
        val node = findBar(r, pkg, URL_BAR[pkg] ?: return) ?: return
        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        h.postDelayed({
            val r2 = try { rootInActiveWindow } catch (e: Exception) { null }
            val n2 = r2?.let { findBar(it, pkg, URL_BAR[pkg] ?: emptyList()) }
            val c = VideoUrl.classify(n2?.text)
            performGlobalAction(GLOBAL_ACTION_BACK)          // סוגרים את שורת הכתובת שפתחנו
            if (c is VideoUrl.Hit.Video) open(c.url, toBr, false)
            else if (page != null) open(VideoUrl.page(n2?.text) ?: page, toBr, true)
            else Toast.makeText(this, R.string.grabNoVideo, Toast.LENGTH_SHORT).show()
        }, 350)
    }

    /* isPage = דף שבו נמצא נגן, לא סרטון שהמנוע מכיר (יוטיוב, ‏Vimeo…) */
    private fun open(url: String, toBr: Boolean, isPage: Boolean) {
        hide()
        if (toBr && AppRoute.toBrowser(this, url)) return
        if (hitKnown && AppRoute.toDmBrowser(this, url)) return
        // 26/10/2026: דף עם נגן → Studio Browser כשהוא מותקן: הצייד שם רואה את הזרמים האמיתיים (כמו הצייד בדפדפן של
        // DM), עם ההתחברות שלך שם, ופותח את רשימת ההורדה לבד. סרטון שהמנוע מכיר — ישר ל־DM כמו קודם
        if (isPage && AppRoute.toBrowser(this, url)) return
        // 24/10/2026: Studio DM מותקן → ההורדה אליו (ברירת המחדל; משם "לתרגם ב־Studio" / "ישר לענן של Studio")
        if (AppRoute.toDm(this, url)) return
        // לאפליקציית Studio (הבועה ב־APK נפרד). Studio לא מותקנת — האתר שלה מכאן (אותו MainActivity, ‎#share=)
        val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url)
            .setPackage(STUDIO_PKG).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { startActivity(i); return } catch (e: Exception) {}
        try { startActivity(Intent(i).setPackage(null).setClass(this, MainActivity::class.java)) } catch (e: Exception) {}
    }

    /** העיגול: אדום של Studio עם חץ הורדה לבן (מצויר — בלי קובצי תמונה) */
    private class BubbleView(c: Context) : View(c) {
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x40FFFFFF; style = Paint.Style.STROKE }
        private val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        }
        private val path = Path()

        init {
            outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#FF4656")) }
        }

        override fun onDraw(cv: Canvas) {
            val w = width.toFloat(); val r = w / 2f
            ring.strokeWidth = w * 0.03f
            cv.drawCircle(r, r, r - ring.strokeWidth, ring)
            ink.strokeWidth = w * 0.085f
            path.reset()
            path.moveTo(r, w * 0.27f); path.lineTo(r, w * 0.60f)              // הקו
            path.moveTo(w * 0.35f, w * 0.46f); path.lineTo(r, w * 0.61f); path.lineTo(w * 0.65f, w * 0.46f) // ראש החץ
            path.moveTo(w * 0.32f, w * 0.73f); path.lineTo(w * 0.68f, w * 0.73f) // המגש
            cv.drawPath(path, ink)
        }
    }

    companion object {
        const val PREFS = "grab"
        const val STUDIO_PKG = "app.thesnowball.studio"
        const val KEY_ON = "on"
        private const val KEY_RIGHT = "right"
        private const val KEY_Y = "y"
        private const val KEY_HINTS = "hints"
        const val KEY_DEEP = "deep"                 // הניסוי (חיפוש נגן בכל דף) — פועל כברירת מחדל
        // 23/10/2026: 40ms הספיקו רק לעשרות צמתים בדף כבד (buffett.cnbc.com — הבועה לא הופיעה); ברקע אפשר יותר
        private const val DEEP_NODES = 6000
        private const val DEEP_DEPTH = 80
        private const val DEEP_MS = 600L
        private const val DEEP_AGAIN = 2500L
        private const val DEEP_TRIES = 6

        /* דפדפן → המזהים של שורת הכתובת (לפי הסדר). רשימה שמתחזקים: מזהה שהשתנה בגרסה חדשה = הבועה לא מופיעה שם */
        val URL_BAR: Map<String, List<String>> = mapOf(
            "com.android.chrome" to listOf("url_bar"),
            "com.chrome.beta" to listOf("url_bar"),
            "com.chrome.dev" to listOf("url_bar"),
            "com.chrome.canary" to listOf("url_bar"),
            "com.microsoft.emmx" to listOf("url_bar"),
            "com.brave.browser" to listOf("url_bar"),
            "com.vivaldi.browser" to listOf("url_bar"),
            "com.kiwibrowser.browser" to listOf("url_bar"),
            "com.sec.android.app.sbrowser" to listOf("location_bar_edit_text", "custom_tab_toolbar_url_bar_text"),
            "com.sec.android.app.sbrowser.beta" to listOf("location_bar_edit_text"),
            "org.mozilla.firefox" to listOf("mozac_browser_toolbar_url_view", "url_bar_title"),
            "org.mozilla.firefox_beta" to listOf("mozac_browser_toolbar_url_view"),
            "org.mozilla.fenix" to listOf("mozac_browser_toolbar_url_view"),
            "com.opera.browser" to listOf("url_field"),
            "com.opera.mini.native" to listOf("url_field"),
            "com.duckduckgo.mobile.android" to listOf("omnibarTextInput"),
            "com.mi.globalbrowser" to listOf("url"),
            "com.heytap.browser" to listOf("url_bar"),
            "com.android.browser" to listOf("url"),
        )

        fun isOn(c: Context) = c.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_ON, true)

        /** השירות מופעל במסך הנגישות של המכשיר */
        fun enabled(c: Context): Boolean {
            val s = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            val me = ComponentName(c, GrabService::class.java)
            return s.split(':').any { ComponentName.unflattenFromString(it) == me }
        }
    }
}
