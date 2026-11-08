package io.github.yishaiguedj1.snowball.upd

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import io.github.yishaiguedj1.snowball.R

/* 08/11/2026 (בקשת המשתמש): מסך "עדכון תוכנה" — כמו עדכון המערכת בהגדרות של המכשיר: הגרסה המותקנת, המצב
   ("מעודכנת" / "עדכון זמין · 112 MB" / "מוריד… 42%" / "מתקין…"), מתי נבדק, וכפתור אחד: "בדיקת עדכונים" או "עדכון".
   אחרי "עדכון" אפשר לצאת — הכל ממשיך ברקע (Upd), ובסוף מגיעה התראה. נפתח מההגדרות בכל אפליקציה: DM/הדפדפן
   (שורה נייטיב), אפליקציות האתר (שורת "עדכון תוכנה" → intent://…#Intent;scheme=snbupd;package=…), וההתראות.
   Views רגילים (לא Compose) — הקוד ב־source set הראשי ורץ בכל שבע האפליקציות. */
class UpdActivity : Activity() {
    companion object {
        @Volatile var shown = false
        @Volatile var pendingAsk: Intent? = null
    }

    private val h = Handler(Looper.getMainLooper())
    private var checking = false
    private var checkFailed = false
    private lateinit var status: TextView
    private lateinit var detail: TextView
    private lateinit var bar: ProgressBar
    private lateinit var btn: Button
    private lateinit var ver: TextView

    private val dark get() = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private val accent by lazy { try { Color.parseColor(getString(R.string.barColor)) } catch (e: Exception) { Color.parseColor("#0A84FF") } }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val bg = if (dark) Color.BLACK else Color.parseColor("#F2F2F7")
        val card = if (dark) Color.parseColor("#1C1C1E") else Color.WHITE
        val fg = if (dark) Color.WHITE else Color.BLACK
        val mute = if (dark) Color.parseColor("#98989F") else Color.parseColor("#6C6C70")
        window.statusBarColor = bg; window.navigationBarColor = bg
        if (!dark) window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or (if (Build.VERSION.SDK_INT >= 26) View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0)

        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(8), dp(16), dp(24)) }
        val title = TextView(this).apply {
            text = getString(R.string.updTitle); setTextColor(fg); textSize = 30f; typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(4), dp(20), dp(4), dp(16))
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(20), dp(24), dp(20), dp(20))
            background = GradientDrawable().apply { setColor(card); cornerRadius = dp(20).toFloat() }
        }
        val icon = ImageView(this).apply { setImageDrawable(applicationInfo.loadIcon(packageManager)) }
        val name = TextView(this).apply { text = getString(R.string.app_name); setTextColor(fg); textSize = 20f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER; setPadding(0, dp(12), 0, 0) }
        ver = TextView(this).apply { setTextColor(mute); textSize = 15f; gravity = Gravity.CENTER; textDirection = View.TEXT_DIRECTION_LOCALE }
        status = TextView(this).apply { setTextColor(fg); textSize = 18f; gravity = Gravity.CENTER; setPadding(0, dp(22), 0, 0) }
        detail = TextView(this).apply { setTextColor(mute); textSize = 15f; gravity = Gravity.CENTER; setPadding(0, dp(6), 0, 0) }
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000; progressTintList = android.content.res.ColorStateList.valueOf(accent); visibility = View.GONE
        }
        btn = Button(this).apply {
            isAllCaps = false; textSize = 17f; setTextColor(Color.WHITE); stateListAnimator = null
            background = GradientDrawable().apply { setColor(accent); cornerRadius = dp(26).toFloat() }
            setOnClickListener { onButton() }
        }
        box.addView(icon, LinearLayout.LayoutParams(dp(72), dp(72)))
        box.addView(name); box.addView(ver); box.addView(status); box.addView(detail)
        box.addView(bar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(8)).apply { topMargin = dp(16) })
        col.addView(title); col.addView(box)
        col.addView(btn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(20) })
        val note = TextView(this).apply { text = getString(R.string.updNote); setTextColor(mute); textSize = 13f; gravity = Gravity.CENTER; setPadding(dp(8), dp(12), dp(8), 0) }
        col.addView(note)
        val root = ScrollView(this).apply { setBackgroundColor(bg); addView(col) }
        // אנדרואיד 15 (targetSdk 35) מצייר מתחת לשורת המצב — ריווח לפי ה־insets
        root.setOnApplyWindowInsetsListener { v, ins ->
            if (Build.VERSION.SDK_INT >= 30) { val s = ins.getInsets(WindowInsets.Type.systemBars()); v.setPadding(s.left, s.top, s.right, s.bottom) }
            else @Suppress("DEPRECATION") v.setPadding(ins.systemWindowInsetLeft, ins.systemWindowInsetTop, ins.systemWindowInsetRight, ins.systemWindowInsetBottom)
            ins
        }
        setContentView(root)
        Upd.schedule(this)
        // בפתיחה: אם לא נבדק בשעה האחרונה — בודקים מיד (כמו מסך העדכון של המכשיר)
        if (System.currentTimeMillis() - Upd.state(this).checked > 60 * 60 * 1000L) runCheck()
    }

    override fun onResume() {
        super.onResume()
        shown = true
        Upd.cancelNotice(this)
        pendingAsk?.let { pendingAsk = null; try { startActivity(it) } catch (e: Exception) {} }
        tick()
    }

    override fun onPause() { super.onPause(); shown = false; h.removeCallbacksAndMessages(null) }

    private fun runCheck() {
        if (checking) return
        checking = true; checkFailed = false; render()
        Thread {
            val ok = Upd.check(applicationContext)
            h.post { checking = false; checkFailed = !ok; render() }
        }.start()
    }

    private fun onButton() {
        val st = Upd.state(this)
        if (Upd.busy(this)) return
        if (!Upd.available(this)) { runCheck(); return }
        // ההתראה בסוף העדכון — באנדרואיד 13+ צריך הרשאה; מבקשים פעם אחת, וממשיכים בכל מקרה
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        Upd.start(this)
        render()
    }

    private fun tick() { render(); h.postDelayed({ tick() }, 500) }

    private fun render() {
        val st = Upd.state(this)
        val avail = Upd.available(this)
        val busy = Upd.busy(this)
        ver.text = getString(R.string.updVersion, Upd.installedName(this))
        val sz = UpdCore.mb(st.rel?.size ?: 0)
        bar.visibility = View.GONE; btn.isEnabled = true; btn.alpha = 1f
        when {
            checking -> {
                status.text = getString(R.string.updChecking); detail.text = ""
                bar.visibility = View.VISIBLE; bar.isIndeterminate = true
                btn.text = getString(R.string.updCheckBtn); btn.isEnabled = false; btn.alpha = .5f
            }
            st.phase == "dl" && avail && busy -> {
                val p = Upd.progress(this)
                val pct = if (p != null && p.second > 0) (p.first * 1000 / p.second).toInt() else -1
                status.text = getString(R.string.updDownloading)
                detail.text = if (pct >= 0) "${pct / 10}% · $sz" else getString(R.string.updBgNote)
                bar.visibility = View.VISIBLE; bar.isIndeterminate = pct < 0; if (pct >= 0) bar.progress = pct
                btn.text = getString(R.string.updInBg); btn.isEnabled = false; btn.alpha = .5f
            }
            st.phase == "inst" && avail && busy -> {
                status.text = getString(R.string.updInstalling); detail.text = getString(R.string.updBgNote)
                bar.visibility = View.VISIBLE; bar.isIndeterminate = true
                btn.text = getString(R.string.updInBg); btn.isEnabled = false; btn.alpha = .5f
            }
            avail -> {
                val failed = st.phase == "err" || st.phase == "dl" || st.phase == "inst"   // נכשל, או נקטע באמצע (busy = false)
                status.text = if (failed) getString(R.string.updFailText) else getString(R.string.updAvailable)
                detail.text = listOf(getString(R.string.updVersion, st.rel?.name ?: ""), sz).filter { it.isNotBlank() }.joinToString(" · ")
                btn.text = getString(if (failed) R.string.updRetry else R.string.updNow)
            }
            else -> {
                status.text = getString(if (checkFailed) R.string.updCheckFail else R.string.updUpToDate)
                detail.text = if (st.checked > 0) getString(R.string.updChecked,
                    DateUtils.getRelativeTimeSpanString(st.checked, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)) else ""
                btn.text = getString(R.string.updCheckBtn)
            }
        }
    }
}
