package io.github.yishaiguedj1.snowball

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * 22/10/2026 (בקשת המשתמש: "כל ההורדות תמיד מקומית למכשיר"): המסך הקטן של ההורדה בטלפון — מעל Studio.
 *   snbstudio://probe?u=…&ref=…&n=…   → בדיקת הקישור (yt-dlp -J) → חזרה לאתר עם ‎#probe=<n>.<base64url של הסיכום>
 *                                       (שגיאה: ‎#probe=<n>.!<קוד>). האתר מציג את האיכויות כמו קודם.
 *   snbstudio://dl?u=…&ref=…&n=…&v=…&a=…&h=…&s0=…&s1=…&t=…  → ההורדה (DlService) עם התקדמות; בסוף הקובץ ב־Movies/Studio
 *                                       ועובר לאתר (DlState.handoff → MainActivity → Chrome → /share-file ב־sw.js).
 * הכתובות מהאתר שלנו (intent://… עם החבילה), אבל כל ערך נבדק כאן כאילו הגיע מכל אפליקציה.
 */
class DlActivity : Activity() {
    private val main = Handler(Looper.getMainLooper())
    private lateinit var titleV: TextView
    private lateinit var subV: TextView
    private lateinit var bar: ProgressBar
    private lateinit var btn: Button
    private lateinit var btn2: Button
    private var mode = ""
    private var nonce = ""
    private var handed = false
    private val onState: () -> Unit = { paint() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        guard()
        setContentView(build())
        route(intent)
    }

    /** קריסה לא צפויה → האתר מקבל שגיאה (‎!crash / ‎crash) במקום מסך שנעלם בשקט */
    private fun guard() {
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try {
                val n = nonce
                if (N_RE.matches(n)) startActivity(if (mode == "dl") DlState.errIntent(this, n, "crash")
                    else Intent(Intent.ACTION_VIEW, Uri.parse(s(R.string.launchUrl) + "#probe=$n.!crash"), this, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (x: Throwable) {}
            prev?.uncaughtException(t, e)
        }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); route(intent) }

    private fun route(i: Intent?) {
        val d = i?.data
        if (i?.action == ACT_SHOW) { if (!DlState.busy()) { finish(); return }; mode = "dl"; nonce = DlState.id ?: ""; paint(); return }
        if (d == null || d.scheme != "snbstudio") { finish(); return }
        DlLang.set(this, d.getQueryParameter("l"))
        val n = d.getQueryParameter("n") ?: ""
        val u = DlProbe.extractUrl(d.getQueryParameter("u"))
        if (!N_RE.matches(n) || u.isEmpty() || u.length > DlProbe.URL_MAX) { finish(); return }
        nonce = n
        val ref = DlProbe.refOk(d.getQueryParameter("ref"))
        when (d.host) {
            "probe" -> probe(u, ref)
            "dl" -> download(d, u, ref)
            else -> finish()
        }
    }

    @Volatile private var probeSlow = false

    private fun probe(u: String, ref: String) {
        mode = "probe"
        titleV.text = s(R.string.dlChecking); subV.text = s(R.string.dlCheckingS)
        bar.isIndeterminate = true; btn.text = s(R.string.dlCancel)
        val pid = "probe-$nonce"
        btn.setOnClickListener { DlEngine.cancel(pid); back("#probe=$nonce.!cancel") }
        // 23/10/2026 (דיווח המשתמש: קובץ מדפדפן הציד — יותר מדקה בלי תשובה): תקרת זמן לבדיקה עצמה, אחרי ההכנה.
        // עברה → עוצרים את yt-dlp ומחזירים "slow" (האתר: לנסות שוב / דפדפן הציד; כתובת של דף — הבדיקה לעומק)
        val slow = Runnable { probeSlow = true; DlEngine.cancel(pid) }
        Thread {
            var miss = false
            val res = try {
                val s = DlEngine.probe(this, u, ref, DlEngine.cookiesFor(this, u, ref), pid) { st ->
                    main.post { subV.text = s(when (st) { "init" -> R.string.dlInit; "update" -> R.string.dlUpdate; else -> R.string.dlCheckingS }) }
                    if (st == "probe") main.postDelayed(slow, if (ref.isNotEmpty()) PROBE_REF_MS else PROBE_MS)
                }
                main.removeCallbacks(slow)
                // קובץ שנתפס בדף (דפדפן הציד) ונראה כמו פרסומת / קובץ זעיר — לא מציעים להוריד אותו
                if (ref.isNotEmpty() && !DlDeep.realVideo(s, 0)) throw IllegalArgumentException("tiny")
                "#probe=$nonce." + DlEngine.b64(s.toString())
            } catch (e: Throwable) {
                main.removeCallbacks(slow)
                val code = if (probeSlow) "slow" else (e as? IllegalArgumentException)?.message ?: "fail"
                miss = ref.isEmpty() && code in HUNT_ON
                "#probe=$nonce.!" + code
            }
            main.post {
                if (isFinishing) return@post
                if (!miss) back(res) else deep(u, res)   // 23/10/2026: לא נמצא ישירות → בדיקה לעומק, ואז דפדפן הציד
            }
        }.start()
    }

    /* ---------- הבדיקה לעומק (DlDeep): דפדפן נסתר בחלון הזה ---------- */
    private var web: WebView? = null
    private val found = HuntMedia.Found()
    @Volatile private var deepDone = false
    private var deepPage: DlDeep.Page? = null
    private var ckTried = false; private var ckFailed = false; private var mediaBusy = false
    private val mediaTried = HashSet<String>()

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun deep(u: String, miss: String) {
        // WebView בשני תהליכים (דפדפן הציד בראשי) — כל אחד בתיקייה משלו
        try { WebView.setDataDirectorySuffix("dl") } catch (e: Throwable) {}
        val w = try { WebView(this) } catch (e: Throwable) { null }
        if (w == null) { hunt(u, miss); return }
        web = w
        subV.text = s(R.string.dlDeep)
        btn.setOnClickListener { stopDeep(); back("#probe=$nonce.!cancel") }
        val st = w.settings
        st.javaScriptEnabled = true; st.domStorageEnabled = true
        st.mediaPlaybackRequiresUserGesture = false          // ניגון מושתק בלי נגיעה — רק כאן, בבדיקה שהמשתמש התחיל
        st.allowFileAccess = false; st.allowContentAccess = false; st.setSupportMultipleWindows(false)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        w.alpha = 0.01f                                       // מחובר לחלון (אחרת הדף "מוסתר" והנגן לא מתחיל), כמעט שקוף
        w.setOnTouchListener { _, _ -> true }                 // אין נגיעות בדף הנסתר
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val sc = req.url.scheme?.lowercase(); return sc != "http" && sc != "https"
            }
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? { seen(req.url.toString()); return null }
            override fun onPageFinished(view: WebView, url: String) { main.postDelayed({ tryCookies(u, miss) }, DlDeep.SETTLE_MS) }
        }
        findViewById<ViewGroup>(android.R.id.content).addView(w, 0,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        w.loadUrl(u)
        val t0 = System.currentTimeMillis()
        val tick = object : Runnable {
            override fun run() {
                if (deepDone) return
                val el = System.currentTimeMillis() - t0
                if (el > DlDeep.NO_FINISH_MS) tryCookies(u, miss)
                w.evaluateJavascript(DlDeep.EXTRACT) { r ->
                    val js = try { org.json.JSONTokener(r).nextValue() as? String } catch (e: Throwable) { null }
                    DlDeep.parsePage(js)?.let { pg -> deepPage = pg; pg.urls.forEach { seen(it) } }
                    nextMedia(u, miss)
                }
                // הזמן נגמר — מחכים רק לבדיקה שכבר רצה; אחרת דפדפן הציד
                if ((el > DlDeep.DEEP_MS && !mediaBusy && (ckFailed || !ckTried)) || el > DlDeep.DEEP_MS * 3) {
                    val b = bestMedia
                    if (b != null) okMedia(b) else hunt(u, miss)   // לא נמצא קובץ אמיתי — דפדפן הציד, לא קובץ זעיר
                    return
                }
                main.postDelayed(this, 1000)
            }
        }
        main.postDelayed(tick, 1000)
    }

    private fun seen(url: String) {
        val h = HuntMedia.classify(url) ?: return
        main.post { found.add(h) }
    }

    /** 1. yt-dlp שוב, עם העוגיות של הדפדפן (אתגר שנפתר) */
    private fun tryCookies(u: String, miss: String) {
        if (ckTried || deepDone) return
        ckTried = true
        val ck = writeCookies(u)
        if (ck == null) { ckFailed = true; return }
        val img = deepPage?.image ?: ""
        Thread {
            val r = deepProbe(u, "", ck, PROBE_MS)
            if (r != null) DlEngine.thumbIfEmpty(r, img)
            main.post {
                if (deepDone) return@post
                if (r != null && DlDeep.realVideo(r, pageDur())) okDeep(r) else { ckFailed = true; nextMedia(u, miss) }
            }
        }.start()
    }

    /** 2. הזרם שנמצא בדף (הטוב קודם), עם ה־Referer של הדף */
    private fun nextMedia(u: String, miss: String) {
        if (deepDone || mediaBusy || !ckFailed || mediaTried.size >= DlDeep.MEDIA_TRIES) return
        val h = found.list.firstOrNull { it.url !in mediaTried } ?: return
        mediaTried.add(h.url); mediaBusy = true
        val page = web?.url ?: u
        val ck = writeCookies(page, h.url)
        val pg = deepPage
        Thread {
            val r = deepProbe(h.url, page, ck, PROBE_REF_MS)
            if (r != null) { DlDeep.fromMedia(r, h.url, page, pg); DlEngine.thumbIfEmpty(r, pg?.image ?: "") }
            main.post {
                mediaBusy = false
                if (deepDone) return@post
                // 23/10/2026: קובץ זעיר / קצר / פרסומת — לא מציעים. כל קובץ אמיתי נשמר (מקורות נוספים), והטוב נבחר:
                // תואם למשך של הדף, ובין התואמים — האיכות הגבוהה ביותר. ממשיכים עד שאין עוד קבצים לבדוק
                if (r != null && DlDeep.realVideo(r, pageDur())) {
                    goods.add(r)
                    if (DlDeep.better(r, bestMedia, pageDur())) bestMedia = r
                }
                val left = found.list.any { it.url !in mediaTried }
                val b = bestMedia
                if (b != null && (mediaTried.size >= DlDeep.MEDIA_TRIES || (!left && DlDeep.matches(b, pageDur())))) { okMedia(b); return@post }
                nextMedia(u, miss)
            }
        }.start()
    }

    /** בדיקה אחת בתוך הבדיקה לעומק — עם תקרת זמן, ונעצרת יחד איתה (stopDeep). כל תקלה → null */
    @Volatile private var deepPid = ""
    private fun deepProbe(u: String, ref: String, ck: DlEngine.Ck?, ms: Long): org.json.JSONObject? {
        val pid = "deep-$nonce-${System.nanoTime()}"
        deepPid = pid
        val stop = Runnable { DlEngine.cancel(pid) }
        main.postDelayed(stop, ms)
        return try { DlEngine.probe(this, u, ref, ck, pid) } catch (e: Throwable) { null }
            finally { main.removeCallbacks(stop); if (deepPid == pid) deepPid = "" }
    }

    private var bestMedia: org.json.JSONObject? = null
    private val goods = ArrayList<org.json.JSONObject>()
    private fun okMedia(b: org.json.JSONObject) = okDeep(DlDeep.withAlt(b, goods, pageDur()))
    private fun pageDur() = deepPage?.dur ?: 0

    private fun writeCookies(page: String, vararg more: String): DlEngine.Ck? {
        val cm = CookieManager.getInstance()
        try { cm.flush() } catch (e: Throwable) {}
        val urls = (listOf(page) + more + found.list.map { it.url }).distinct()
        val text = DlDeep.netscape(urls.map { it to cm.getCookie(it) }, System.currentTimeMillis() / 1000)
        val ua = web?.settings?.userAgentString ?: return null
        return DlEngine.saveCookies(this, page, text, ua)
    }

    private fun okDeep(r: org.json.JSONObject) { stopDeep(); back("#probe=$nonce." + DlEngine.b64(r.toString())) }

    private fun stopDeep() {
        deepDone = true
        main.removeCallbacksAndMessages(null)
        deepPid.let { if (it.isNotEmpty()) DlEngine.cancel(it) }
        web?.let { try { it.stopLoading(); (it.parent as? ViewGroup)?.removeView(it); it.destroy() } catch (e: Throwable) {} }
        web = null
    }

    /** 3. לא נמצא — דפדפן הציד הגלוי נפתח לבד (מהאפליקציה; מהאתר Chrome חוסם intent בלי נגיעה). האתר מקבל את התוצאה */
    private fun hunt(u: String, miss: String) {
        stopDeep()
        if (isFinishing) return
        // 23/10/2026 (סרטון המשתמש): לא שולחים לאתר את "לא נמצא" עכשיו — שני שינויי hash כמעט יחד (התוצאה + מה שנשלח
        // מדפדפן הציד) כשהאתר ברקע = רק האחרון נקרא, והשליחה אבדה. דפדפן הציד מעביר את "לא נמצא" רק אם נסגר בלי לשלוח
        startActivity(Intent(this, HuntActivity::class.java).setData(Uri.parse("snbstudio://hunt?u=" + Uri.encode(u)))
            .putExtra(HuntActivity.EXTRA_AUTO, true).putExtra(HuntActivity.EXTRA_MISS, miss))
        finish()
    }

    override fun onDestroy() { stopDeep(); super.onDestroy() }

    private fun download(d: Uri, u: String, ref: String) {
        mode = "dl"
        if (DlState.busy() && DlState.id != nonce) { titleV.text = s(R.string.dlBusy); subV.text = DlState.title; bar.visibility = View.GONE
            btn.text = s(R.string.dlClose); btn.setOnClickListener { finish() }; return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        if (DlState.id != nonce) {
            val num = { k: String -> (d.getQueryParameter(k) ?: "").toIntOrNull()?.coerceIn(0, 360000) ?: 0 }
            val t = DlProbe.clean(d.getQueryParameter("t"), DlProbe.TITLE_MAX)
            val s = Intent(this, DlService::class.java).putExtra(DlService.X_ID, nonce).putExtra(DlService.X_URL, u)
                .putExtra(DlService.X_REF, ref).putExtra(DlService.X_TITLE, t)
                .putExtra(DlService.X_V, d.getQueryParameter("v") ?: "").putExtra(DlService.X_A, d.getQueryParameter("a") ?: "")
                .putExtra(DlService.X_H, num("h")).putExtra(DlService.X_S0, num("s0")).putExtra(DlService.X_S1, num("s1"))
                .putExtra(DlService.X_ONLY, d.getQueryParameter("o") == "1")
            DlState.start(nonce, t, d.getQueryParameter("o") == "1")
            // אנדרואיד 14+: משימת העברה שהמשתמש התחיל (DlJob, בלי מגבלת 6 השעות); אחרת — השירות בחזית
            if (!DlJob.schedule(this, DlService.reqOf(s)!!)) startForegroundService(s)
        }
        paint()
    }

    /** המסך לפי המצב של ההורדה */
    private fun paint() {
        if (mode != "dl") return
        titleV.text = DlState.title.ifEmpty { s(R.string.dlTitle) }
        when (DlState.phase) {
            "dl" -> { bar.visibility = View.VISIBLE; val p = DlState.pct.toInt().coerceIn(0, 100); bar.isIndeterminate = p <= 0; bar.progress = p
                subV.text = if (p > 0) s(R.string.dlPct, p) else s(R.string.dlPrep)
                btn.text = s(R.string.dlHide); btn.setOnClickListener { back("") } }
            "save" -> { bar.isIndeterminate = true; subV.text = s(R.string.dlSaving) }
            "done" -> { val u = DlState.uri
                if (u != null && DlState.only) {   // "רק להוריד" — נשאר בטלפון; פתיחה בנגן או סגירה
                    titleV.text = s(R.string.dlSaved); subV.text = s(R.string.dlSavedS); bar.visibility = View.GONE
                    btn.text = s(R.string.dlOpen)
                    btn.setOnClickListener { DlState.clear(); try { startActivity(DlState.viewIntent(u)) } catch (e: Exception) {}; finish() }
                    btn2.visibility = View.VISIBLE; btn2.text = s(R.string.dlShare)
                    btn2.setOnClickListener { DlState.clear(); try { startActivity(DlState.shareIntent(this, u)) } catch (e: Exception) {}; finish() }
                } else if (u != null && !handed) { handed = true; DlState.clear(); startActivity(DlState.handoffIntent(this, u, nonce)); finish() } }
            "err" -> { val c = DlState.err; DlState.clear(); if (c == "cancel") finish() else { startActivity(DlState.errIntent(this, nonce, c)); finish() } }
        }
    }

    /** חזרה לאתר (‎#… = התוצאה; ריק = רק לחזור) */
    private fun back(hash: String) {
        if (hash.isNotEmpty()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(s(R.string.launchUrl) + hash), this, MainActivity::class.java))
        finish()
    }

    override fun onResume() { super.onResume(); DlState.listen(onState); paint() }
    override fun onPause() { DlState.unlisten(onState); super.onPause() }

    private fun s(id: Int, vararg a: Any): String = DlLang.of(this).getString(id, *a)

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    private fun build(): View {
        val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val fg = if (dark) Color.WHITE else Color.parseColor("#1C1C1E")
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#66000000")) }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(22f), dp(24f), dp(16f))
            background = GradientDrawable().apply { cornerRadius = dp(28f).toFloat(); setColor(if (dark) Color.parseColor("#2C2C2E") else Color.WHITE) }
        }
        titleV = TextView(this).apply { setTextColor(fg); textSize = 19f; typeface = Typeface.DEFAULT_BOLD; maxLines = 2 }
        subV = TextView(this).apply { setTextColor(if (dark) Color.parseColor("#AEAEB2") else Color.parseColor("#6C6C70")); textSize = 15f; setPadding(0, dp(6f), 0, dp(14f)) }
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; isIndeterminate = true
            progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#FF4656")); indeterminateTintList = progressTintList }
        btn = Button(this, null, android.R.attr.borderlessButtonStyle).apply { setTextColor(Color.parseColor("#FF4656")); textSize = 16f; isAllCaps = false }
        card.addView(titleV); card.addView(subV); card.addView(bar)
        btn2 = Button(this, null, android.R.attr.borderlessButtonStyle).apply { setTextColor(Color.parseColor("#FF4656")); textSize = 16f; isAllCaps = false; visibility = View.GONE }
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.END; addView(btn2); addView(btn) }
        card.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8f) })
        root.addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            .apply { leftMargin = dp(20f); rightMargin = dp(20f) })
        return root
    }

    companion object {
        const val ACT_SHOW = "app.thesnowball.studio.DL_SHOW"
        private val N_RE = Regex("^[A-Za-z0-9]{6,24}$")
        private val HUNT_ON = setOf("unsupported", "no_video", "fail", "slow")   // = מתי האתר מציע את דפדפן הציד
        const val PROBE_MS = 90_000L       // תקרת הזמן לבדיקה של דף
        const val PROBE_REF_MS = 45_000L   // ושל קובץ שנתפס בדף (דפדפן הציד / הבדיקה לעומק)
    }
}
