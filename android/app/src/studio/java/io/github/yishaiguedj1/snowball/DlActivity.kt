package io.github.yishaiguedj1.snowball

import android.Manifest
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
                    else Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.launchUrl) + "#probe=$n.!crash"), this, MainActivity::class.java)
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

    private fun probe(u: String, ref: String) {
        mode = "probe"
        titleV.text = getString(R.string.dlChecking); subV.text = getString(R.string.dlCheckingS)
        bar.isIndeterminate = true; btn.text = getString(R.string.dlCancel)
        btn.setOnClickListener { back("#probe=$nonce.!cancel") }
        Thread {
            val res = try {
                val s = DlEngine.probe(this, u, ref) { st ->
                    main.post { subV.text = getString(when (st) { "init" -> R.string.dlInit; "update" -> R.string.dlUpdate; else -> R.string.dlCheckingS }) }
                }
                "#probe=$nonce." + DlEngine.b64(s.toString())
            } catch (e: Throwable) {
                "#probe=$nonce.!" + ((e as? IllegalArgumentException)?.message ?: "fail")
            }
            main.post { if (!isFinishing) back(res) }
        }.start()
    }

    private fun download(d: Uri, u: String, ref: String) {
        mode = "dl"
        if (DlState.busy() && DlState.id != nonce) { titleV.text = getString(R.string.dlBusy); subV.text = DlState.title; bar.visibility = View.GONE
            btn.text = getString(R.string.dlClose); btn.setOnClickListener { finish() }; return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        if (DlState.id != nonce) {
            val num = { k: String -> (d.getQueryParameter(k) ?: "").toIntOrNull()?.coerceIn(0, 360000) ?: 0 }
            val t = DlProbe.clean(d.getQueryParameter("t"), DlProbe.TITLE_MAX)
            val s = Intent(this, DlService::class.java).putExtra(DlService.X_ID, nonce).putExtra(DlService.X_URL, u)
                .putExtra(DlService.X_REF, ref).putExtra(DlService.X_TITLE, t)
                .putExtra(DlService.X_V, d.getQueryParameter("v") ?: "").putExtra(DlService.X_A, d.getQueryParameter("a") ?: "")
                .putExtra(DlService.X_H, num("h")).putExtra(DlService.X_S0, num("s0")).putExtra(DlService.X_S1, num("s1"))
            DlState.start(nonce, t)
            startForegroundService(s)
        }
        paint()
    }

    /** המסך לפי המצב של ההורדה */
    private fun paint() {
        if (mode != "dl") return
        titleV.text = DlState.title.ifEmpty { getString(R.string.dlTitle) }
        when (DlState.phase) {
            "dl" -> { bar.visibility = View.VISIBLE; val p = DlState.pct.toInt().coerceIn(0, 100); bar.isIndeterminate = p <= 0; bar.progress = p
                subV.text = if (p > 0) getString(R.string.dlPct, p) else getString(R.string.dlPrep)
                btn.text = getString(R.string.dlHide); btn.setOnClickListener { back("") } }
            "save" -> { bar.isIndeterminate = true; subV.text = getString(R.string.dlSaving) }
            "done" -> { val u = DlState.uri; if (u != null && !handed) { handed = true; DlState.clear(); startActivity(DlState.handoffIntent(this, u, nonce)); finish() } }
            "err" -> { val c = DlState.err; DlState.clear(); if (c == "cancel") finish() else { startActivity(DlState.errIntent(this, nonce, c)); finish() } }
        }
    }

    /** חזרה לאתר (‎#… = התוצאה; ריק = רק לחזור) */
    private fun back(hash: String) {
        if (hash.isNotEmpty()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.launchUrl) + hash), this, MainActivity::class.java))
        finish()
    }

    override fun onResume() { super.onResume(); DlState.listen(onState); paint() }
    override fun onPause() { DlState.unlisten(onState); super.onPause() }

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
        card.addView(btn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.END; topMargin = dp(8f) })
        root.addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            .apply { leftMargin = dp(20f); rightMargin = dp(20f) })
        return root
    }

    companion object {
        const val ACT_SHOW = "app.thesnowball.studio.DL_SHOW"
        private val N_RE = Regex("^[A-Za-z0-9]{6,24}$")
    }
}
