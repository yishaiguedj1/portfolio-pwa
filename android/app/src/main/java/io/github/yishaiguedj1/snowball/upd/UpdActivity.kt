package io.github.yishaiguedj1.snowball.upd

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.LinearGradient
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowInsets
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import io.github.yishaiguedj1.snowball.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* 08/11/2026 (בקשת המשתמש): מסך "עדכון תוכנה" — כמו עדכון המערכת בהגדרות של המכשיר: הגרסה המותקנת, המצב
   ("מעודכנת" / "עדכון זמין · 112 MB" / "מוריד… 42%" / "מתקין…"), מתי נבדק, וכפתור אחד: "בדיקת עדכונים" או "עדכון".
   אחרי "עדכון" אפשר לצאת — הכל ממשיך ברקע (Upd), ובסוף מגיעה התראה. נפתח מההגדרות בכל אפליקציה: DM/הדפדפן
   (שורה נייטיב), אפליקציות האתר (שורת "עדכון תוכנה" → intent://open?l=<שפה>#Intent;scheme=snbupd;package=…), וההתראות.
   העיצוב (בקשת המשתמש, אותו יום: "בדיוק כמו הממשק") = הזכוכית של האתר (styles.css): רקע --gl-ambient (שדה צבע רך
   בגוון האפליקציה + שני גוונים משלימים), כרטיס --gl-card ברדיוס 28, גלולת "‹ הגדרות" (--gl-btn), כותרת גדולה,
   כפתור ראשי בצבע האפליקציה עם זוהר. השפה = שפת הממשק (Upd.lang), לא שפת הטלפון.
   Views רגילים (לא Compose) — הקוד ב־source set הראשי ורץ בכל שבע האפליקציות. */
class UpdActivity : Activity() {
    companion object {
        @Volatile var shown = false
        @Volatile var pendingAsk: Intent? = null
    }

    private val h = Handler(Looper.getMainLooper())
    private var checking = false
    private var checkFailed = false
    private lateinit var r: Context   // המחרוזות בשפת הממשק
    private lateinit var status: TextView
    private lateinit var detail: TextView
    private lateinit var bar: ProgressBar
    private lateinit var btn: TextView
    private lateinit var ver: TextView

    private val dark get() = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
    private fun dp(v: Int) = dp(v.toFloat()).toInt()
    private fun s(id: Int, vararg a: Any) = r.getString(id, *a)
    private val accent by lazy { try { Color.parseColor(getString(R.string.barColor)) } catch (e: Exception) { Color.parseColor("#30D158") } }

    /* --on-primary לפי צבע האפליקציה (styles.css): ירוק / אדום / כחול */
    private fun onAccent() = when (accent) {
        Color.parseColor("#FF4656") -> Color.parseColor("#3D0008")
        Color.parseColor("#4699FF") -> Color.parseColor("#00214D")
        else -> Color.parseColor("#06281A")
    }

    /* --gl-tint2 / --gl-tint3 לכל אפליקציה (styles.css, :root[data-app=…]) — בהיר / כהה של iOS */
    private fun tints(): Pair<Int, Int> {
        fun c(l: String, d: String) = Color.parseColor(if (dark) d else l)
        val teal = c("#5AC8FA", "#64D2FF"); val purple = c("#AF52DE", "#BF5AF2"); val cyan = c("#32ADE6", "#64D2FF")
        val indigo = c("#5856D6", "#5E5CE6"); val orange = c("#FF9500", "#FF9F0A")
        return when (packageName) {
            "app.thesnowball.academy" -> cyan to indigo
            "app.thesnowball.admin" -> c("#007AFF", "#0A84FF") to c("#FF2D55", "#FF375F")
            "app.thesnowball.studio", "app.thesnowball.bubble", "app.thesnowball.studiodm", "app.thesnowball.browser" -> orange to purple
            else -> teal to purple
        }
    }

    private fun alpha(c: Int, a: Float) = Color.argb((a * 255).toInt().coerceIn(0, 255), Color.red(c), Color.green(c), Color.blue(c))

    /** רקע העמוד = --gl-ambient: שלושה כתמי צבע אליפטיים רכים + שכבה לינארית בגוון האפליקציה, על --bg */
    private inner class Ambient(private val tint: Int, private val t2: Int, private val t3: Int) : Drawable() {
        private val p = Paint(Paint.ANTI_ALIAS_FLAG)
        private val base = if (dark) Color.BLACK else Color.parseColor("#F2F2F7")
        override fun draw(cv: Canvas) {
            val w = bounds.width().toFloat(); val hh = bounds.height().toFloat()
            cv.drawColor(base)
            p.shader = LinearGradient(0f, 0f, 0f, hh, alpha(tint, .08f), alpha(tint, .05f), Shader.TileMode.CLAMP); cv.drawRect(0f, 0f, w, hh, p)
            val k = if (dark) floatArrayOf(.36f, .26f, .26f) else floatArrayOf(.32f, .24f, .20f)
            blob(cv, .96f * w, .02f * hh, .70f * w, .44f * hh, alpha(tint, k[0]))
            blob(cv, .02f * w, .46f * hh, .60f * w, .40f * hh, alpha(t2, k[1]))
            blob(cv, .86f * w, .98f * hh, .70f * w, .44f * hh, alpha(t3, k[2]))
            p.shader = null
        }
        private fun blob(cv: Canvas, cx: Float, cy: Float, rx: Float, ry: Float, c: Int) {
            cv.save(); cv.translate(cx, cy); cv.scale(1f, ry / rx)
            p.shader = RadialGradient(0f, 0f, rx, intArrayOf(c, Color.TRANSPARENT), floatArrayOf(0f, .72f), Shader.TileMode.CLAMP)
            cv.drawCircle(0f, 0f, rx, p); cv.restore()
        }
        override fun setAlpha(a: Int) {}
        override fun setColorFilter(f: ColorFilter?) {}
        @Deprecated("") override fun getOpacity() = PixelFormat.OPAQUE
    }

    /** --gl-card: זכוכית שקופה למחצה + קו בהיר דק (הברק העליון של הזכוכית) */
    private fun glass(radius: Float, fillL: Float = .58f, fillD: Float = .62f) = GradientDrawable().apply {
        cornerRadius = radius
        setColor(if (dark) Color.argb((fillD * 255).toInt(), 22, 22, 24) else Color.argb((fillL * 255).toInt(), 255, 255, 255))
        setStroke(dp(1), if (dark) Color.argb(36, 255, 255, 255) else Color.argb(230, 255, 255, 255))
    }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        takeLang(intent)
        build()
        Upd.schedule(this)
        // בפתיחה: אם לא נבדק בשעה האחרונה — בודקים מיד (כמו מסך העדכון של המכשיר)
        if (System.currentTimeMillis() - Upd.state(this).checked > 60 * 60 * 1000L) runCheck()
    }

    override fun onNewIntent(i: Intent) {
        super.onNewIntent(i)
        val was = Upd.lang(this)
        takeLang(i)
        if (Upd.lang(this) != was) build()
    }

    /* השפה מהממשק שפתח: ‎?l= מהאתר, ‏extra "l" מ־DM/הדפדפן */
    private fun takeLang(i: Intent?) { Upd.setLang(this, i?.data?.getQueryParameter("l") ?: i?.getStringExtra("l")) }

    private fun build() {
        r = Upd.res(this)
        val he = Upd.lang(this) == "he"
        val fg = if (dark) Color.WHITE else Color.parseColor("#1C1C1E")
        val mute = if (dark) Color.parseColor("#98989D") else Color.parseColor("#636366")
        val bgBase = if (dark) Color.BLACK else Color.parseColor("#F2F2F7")
        window.statusBarColor = Color.TRANSPARENT; window.navigationBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or (if (!dark) View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(bgBase))
        val (t2, t3) = tints()

        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(28)) }

        // "‹ הגדרות" — גלולת זכוכית (--gl-btn) בצבע האפליקציה, כמו בעמודי המשנה באתר
        val back = TextView(this).apply {
            text = (if (he) "›  " else "‹  ") + s(R.string.updBack)
            setTextColor(accent); textSize = 18f; typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(18), dp(10), dp(20), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(26f); setColor(if (dark) Color.argb(150, 44, 44, 46) else Color.argb(199, 255, 255, 255))
                setStroke(dp(1), if (dark) Color.argb(36, 255, 255, 255) else Color.argb(26, 0, 0, 0))
            }
            elevation = dp(2f)
            setOnClickListener { finish() }
        }
        col.addView(back, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.START; topMargin = dp(8) })

        val title = TextView(this).apply {
            text = s(R.string.updTitle); setTextColor(fg); textSize = 34f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = -.01f; setPadding(dp(4), dp(22), dp(4), dp(18))
        }
        col.addView(title)

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(22), dp(28), dp(22), dp(24))
            background = glass(dp(28f))
        }
        val icon = ImageView(this).apply {
            setImageDrawable(applicationInfo.loadIcon(packageManager))
            outlineProvider = object : ViewOutlineProvider() { override fun getOutline(v: View, o: Outline) { o.setRoundRect(0, 0, v.width, v.height, v.width * .23f) } }
            clipToOutline = true
        }
        val name = TextView(this).apply { text = getString(R.string.app_name); setTextColor(fg); textSize = 22f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER; setPadding(0, dp(14), 0, 0) }
        ver = TextView(this).apply { setTextColor(mute); textSize = 16f; gravity = Gravity.CENTER; setPadding(0, dp(2), 0, 0) }
        // המצב — בתוך "תת־כרטיס" שקוף (--surface-2), כמו שורות הרשימה בכרטיס "אפליקציה"
        val inner = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(16), dp(16), dp(16), dp(16))
            background = GradientDrawable().apply { cornerRadius = dp(18f); setColor(if (dark) Color.argb(20, 255, 255, 255) else Color.argb(31, 118, 118, 128)) }
        }
        status = TextView(this).apply { setTextColor(fg); textSize = 19f; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL); gravity = Gravity.CENTER }
        detail = TextView(this).apply { setTextColor(mute); textSize = 15f; gravity = Gravity.CENTER; setPadding(0, dp(4), 0, 0) }
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000; progressTintList = ColorStateList.valueOf(accent); progressBackgroundTintList = ColorStateList.valueOf(alpha(accent, .22f))
            indeterminateTintList = ColorStateList.valueOf(accent); visibility = View.GONE
        }
        inner.addView(status); inner.addView(detail)
        inner.addView(bar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(6)).apply { topMargin = dp(14) })
        card.addView(icon, LinearLayout.LayoutParams(dp(84), dp(84)))
        card.addView(name); card.addView(ver)
        card.addView(inner, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(20) })
        col.addView(card)

        // הכפתור הראשי — גלולה בצבע האפליקציה, ברק עליון וזוהר בגוון שלה (כמו "סנכרון לווידג׳ט")
        btn = TextView(this).apply {
            textSize = 18f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER; setTextColor(onAccent())
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(blend(accent, Color.WHITE, .28f), accent)).apply {
                cornerRadius = dp(30f); setStroke(dp(1), alpha(Color.WHITE, .45f))
            }
            elevation = dp(8f)
            if (Build.VERSION.SDK_INT >= 28) { outlineSpotShadowColor = accent; outlineAmbientShadowColor = accent }
            isClickable = true; isFocusable = true
            setOnClickListener { onButton() }
        }
        col.addView(btn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(58)).apply { topMargin = dp(22); leftMargin = dp(4); rightMargin = dp(4) })
        val note = TextView(this).apply { text = s(R.string.updNote); setTextColor(mute); textSize = 14f; gravity = Gravity.CENTER; setPadding(dp(12), dp(14), dp(12), 0) }
        col.addView(note)

        val root = ScrollView(this).apply {
            background = Ambient(accent, t2, t3); isFillViewport = true; clipToPadding = false
            layoutDirection = if (he) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
            textDirection = if (he) View.TEXT_DIRECTION_RTL else View.TEXT_DIRECTION_LTR
            addView(col)
        }
        // מתחת לשורת המצב ומעל שורת הניווט — ריווח לפי ה־insets (הרקע ממשיך מאחוריהן)
        root.setOnApplyWindowInsetsListener { v, ins ->
            if (Build.VERSION.SDK_INT >= 30) { val x = ins.getInsets(WindowInsets.Type.systemBars()); v.setPadding(x.left, x.top, x.right, x.bottom) }
            else @Suppress("DEPRECATION") v.setPadding(ins.systemWindowInsetLeft, ins.systemWindowInsetTop, ins.systemWindowInsetRight, ins.systemWindowInsetBottom)
            ins
        }
        setContentView(root)
        render()
    }

    private fun blend(a: Int, b: Int, t: Float) = Color.rgb(
        (Color.red(a) + (Color.red(b) - Color.red(a)) * t).toInt(), (Color.green(a) + (Color.green(b) - Color.green(a)) * t).toInt(),
        (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t).toInt())

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
        checking = true; checkFailed = false; if (::btn.isInitialized) render()
        Thread {
            val ok = Upd.check(applicationContext)
            h.post { checking = false; checkFailed = !ok; render() }
        }.start()
    }

    private fun onButton() {
        if (Upd.busy(this)) return
        if (!Upd.available(this)) { runCheck(); return }
        // ההתראה בסוף העדכון — באנדרואיד 13+ צריך הרשאה; מבקשים פעם אחת, וממשיכים בכל מקרה
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        Upd.start(this)
        render()
    }

    private fun tick() { render(); h.postDelayed({ tick() }, 500) }

    private fun setBtn(text: String, on: Boolean) { btn.text = text; btn.isEnabled = on; btn.alpha = if (on) 1f else .55f }

    /* "נבדק ב־16:27" (היום) / "נבדק ב־7/11 16:27" */
    private fun checkedAt(t: Long): String {
        val loc = Locale(Upd.lang(this))
        val today = SimpleDateFormat("yyyyMMdd", loc).format(Date()) == SimpleDateFormat("yyyyMMdd", loc).format(Date(t))
        return SimpleDateFormat(if (today) "HH:mm" else "d/M HH:mm", loc).format(Date(t))
    }

    private fun render() {
        val st = Upd.state(this)
        val avail = Upd.available(this)
        val busy = Upd.busy(this)
        ver.text = s(R.string.updVersion, Upd.installedName(this))
        val sz = UpdCore.mb(st.rel?.size ?: 0)
        bar.visibility = View.GONE
        when {
            checking -> {
                status.text = s(R.string.updChecking); detail.text = ""
                bar.visibility = View.VISIBLE; bar.isIndeterminate = true
                setBtn(s(R.string.updCheckBtn), false)
            }
            st.phase == "dl" && avail && busy -> {
                val p = Upd.progress(this)
                val pct = if (p != null && p.second > 0) (p.first * 1000 / p.second).toInt() else -1
                status.text = s(R.string.updDownloading)
                detail.text = if (pct >= 0) "${pct / 10}% · $sz" else s(R.string.updBgNote)
                bar.visibility = View.VISIBLE; bar.isIndeterminate = pct < 0; if (pct >= 0) bar.progress = pct
                setBtn(s(R.string.updInBg), false)
            }
            st.phase == "inst" && avail && busy -> {
                status.text = s(R.string.updInstalling); detail.text = s(R.string.updBgNote)
                bar.visibility = View.VISIBLE; bar.isIndeterminate = true
                setBtn(s(R.string.updInBg), false)
            }
            avail -> {
                val failed = st.phase == "err" || st.phase == "dl" || st.phase == "inst"   // נכשל, או נקטע באמצע (busy = false)
                status.text = if (failed) s(R.string.updFailText) else s(R.string.updAvailable)
                detail.text = listOf(s(R.string.updVersion, st.rel?.name ?: ""), sz).filter { it.isNotBlank() }.joinToString(" · ")
                setBtn(s(if (failed) R.string.updRetry else R.string.updNow), true)
            }
            else -> {
                status.text = s(if (checkFailed) R.string.updCheckFail else R.string.updUpToDate)
                detail.text = if (st.checked > 0) s(R.string.updChecked, checkedAt(st.checked)) else ""
                setBtn(s(R.string.updCheckBtn), true)
            }
        }
    }
}
