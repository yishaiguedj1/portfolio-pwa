package io.github.yishaiguedj1.snowball

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
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * 22/10/2026 (שלב 2 של ההורדה מקישור, בקשת המשתמש: "כמו IDM / 1DM"): דפדפן ציד בתוך Studio. גולשים לאתר, מנגנים את
 * הסרטון, והקפסולה למטה אומרת "נמצא סרטון". נגיעה → בוחרים מה לשלוח (הדף עצמו כשזה אתר מוכר, או הקובץ/הזרם שנמצא),
 * ו־Studio פותח את דף "מקישור" עם הבדיקה רצה (‎#share= + ‎&ref=<הדף> — השרת מוריד עם ה־Referer של הדף).
 *
 * הזיהוי (כמו cat-catch ו־IDM, במגבלות WebView):
 *  1. shouldInterceptRequest — כל בקשה של הדף ושל ה־Service Worker שלו, לפי צורת הכתובת (HuntMedia). לא משנים
 *     ולא חוסמים כלום — מחזירים null.
 *  2. סקריפט שרץ לפני הדף (addDocumentStartJavaScript): fetch/XHR של הנגן ו־src של ‎<video>‎ (כשאינו blob:) —
 *     מדווח בערוץ snbHunt (addWebMessageListener). הדף יכול לשלוח לשם רק מחרוזות, ומה שמגיע עובר אותו סינון.
 * לא נשלחות עוגיות ולא כלום מלבד הכתובות — ורק בנגיעה של המשתמש.
 */
class HuntActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var bar: EditText
    private lateinit var prog: ProgressBar
    private lateinit var pill: TextView
    private val found = HuntMedia.Found()
    private val ui = Handler(Looper.getMainLooper())
    private var page = ""

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()
    private val dark get() = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES

    @SuppressLint("SetJavaScriptEnabled")
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(DlLang.of(base))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // השפה של Studio (l= מהאתר) — נקבעת לפני שהמסך נבנה; שפה חדשה → בנייה מחדש פעם אחת
        val l = intent?.data?.getQueryParameter("l")
        if ((l == "he" || l == "en") && DlLang.cur(this) != l) { DlLang.set(this, l); recreate(); return }
        val bg = if (dark) Color.parseColor("#000000") else Color.parseColor("#F2F2F7")
        val fg = if (dark) Color.WHITE else Color.parseColor("#1C1C1E")
        val field = if (dark) Color.parseColor("#2C2C2E") else Color.WHITE
        window.statusBarColor = bg
        window.navigationBarColor = bg

        val root = FrameLayout(this).apply { setBackgroundColor(bg); fitsSystemWindows = true }
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        // שורת הכתובת: ✕ | שדה (חיפוש או כתובת)
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), dp(6f), dp(12f), dp(6f))
            setBackgroundColor(bg)
        }
        val close = TextView(this).apply {
            text = "✕"; setTextColor(fg); textSize = 20f; gravity = Gravity.CENTER
            contentDescription = getString(R.string.huntClose)
            layoutParams = LinearLayout.LayoutParams(dp(44f), dp(44f))
            setOnClickListener { finish() }
        }
        bar = EditText(this).apply {
            hint = getString(R.string.huntPh)
            setSingleLine(true)
            textSize = 16f
            setTextColor(fg)
            setHintTextColor(Color.parseColor("#8E8E93"))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_GO
            setSelectAllOnFocus(true)
            background = GradientDrawable().apply { cornerRadius = dp(999f).toFloat(); setColor(field) }
            setPadding(dp(16f), dp(10f), dp(16f), dp(10f))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnEditorActionListener { v, id, ev ->
                if (id == EditorInfo.IME_ACTION_GO || (ev != null && ev.keyCode == KeyEvent.KEYCODE_ENTER && ev.action == KeyEvent.ACTION_DOWN)) {
                    go(v.text.toString()); true
                } else false
            }
        }
        top.addView(close); top.addView(bar)
        prog = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100; progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor(getString(R.string.barColor)))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3f))
            visibility = View.INVISIBLE
        }
        web = WebView(this).apply { layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f) }
        col.addView(top); col.addView(prog); col.addView(web)
        root.addView(col)

        // הקפסולה "נמצא סרטון" — למטה באמצע, מופיעה רק כשיש ממצא
        pill = TextView(this).apply {
            setTextColor(Color.WHITE); textSize = 16f; gravity = Gravity.CENTER
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
        val start = intent?.data?.getQueryParameter("u") ?: intent?.getStringExtra(Intent.EXTRA_TEXT)
        if (!start.isNullOrBlank()) go(start) else { bar.requestFocus(); showKeyboard() }
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
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)   // נגנים מוטמעים (iframe) צריכים אותן

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val sc = req.url.scheme?.lowercase()
                return sc != "http" && sc != "https"          // intent:/market:/… לא נפתחים מכאן
            }

            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                seen(req.url.toString()); return null
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (url != page) { page = url; found.clear(); paintPill() }
                if (!bar.hasFocus()) bar.setText(url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!bar.hasFocus()) bar.setText(url)
                page = url
                paintPill()
                hint()
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) {
                prog.progress = p
                prog.visibility = if (p in 1..99) View.VISIBLE else View.INVISIBLE
            }
        }
        // בקשות של ה־Service Worker של האתר (נגנים שמביאים את הקטעים דרכו)
        try {
            ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
                override fun shouldInterceptRequest(req: WebResourceRequest): WebResourceResponse? { seen(req.url.toString()); return null }
            })
        } catch (e: Exception) {}
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "snbHunt", setOf("*")) { _, msg, _, _, _ -> msg.data?.let { seen(it) } }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(web, HOOK, setOf("*"))
            }
        }
    }

    /* מכל חוט (בקשות רשת מגיעות מחוט רקע) → הסינון → הרשימה בחוט הראשי */
    private fun seen(url: String) {
        val h = HuntMedia.classify(url) ?: return
        ui.post { if (found.add(h)) paintPill() }
    }

    private fun paintPill() {
        val n = found.size + (if (pageIsVideo()) 1 else 0)
        if (n == 0) { pill.visibility = View.GONE; return }
        pill.text = if (n == 1) getString(R.string.huntFound) else getString(R.string.huntFoundN, n)
        if (pill.visibility != View.VISIBLE) {
            pill.visibility = View.VISIBLE
            pill.alpha = 0f; pill.scaleX = 0.8f; pill.scaleY = 0.8f
            pill.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(220).start()
        }
    }

    /* כמו ב־1DM: הנגן מבקש את הסרטון רק כשמנגנים — רמז קצר, רק בשלוש הפעמים הראשונות */
    private var hinted = false
    private fun hint() {
        if (hinted || found.size > 0 || pageIsVideo() || page.startsWith("https://www.google.")) return
        if (intent?.getBooleanExtra(EXTRA_AUTO, false) == true) {   // נפתח לבד — תמיד מסבירים למה ומה לעשות
            hinted = true
            android.widget.Toast.makeText(this, R.string.huntAuto, android.widget.Toast.LENGTH_LONG).show()
            return
        }
        val p = getSharedPreferences("hunt", MODE_PRIVATE)
        val n = p.getInt("huntHints", 0)
        if (n >= 3) return
        hinted = true
        p.edit().putInt("huntHints", n + 1).apply()
        android.widget.Toast.makeText(this, R.string.huntHint, android.widget.Toast.LENGTH_LONG).show()
    }

    private fun pageIsVideo() = VideoUrl.classify(page) is VideoUrl.Hit.Video

    /* מה לשלוח: הדף עצמו (כשזה דף צפייה באתר מוכר — yt-dlp יביא כותרת, פרקים וכתוביות) או אחד הממצאים */
    private fun pick() {
        val items = ArrayList<Pair<String, () -> Unit>>()
        if (pageIsVideo()) items.add(getString(R.string.huntPage) to { send(page, "") })
        for (h in found.list) {
            val label = when (h.kind) { HuntMedia.Kind.HLS -> R.string.huntHls; HuntMedia.Kind.DASH -> R.string.huntDash; else -> R.string.huntFile }
            items.add((getString(label) + " · " + h.host) to { send(h.url, page) })
        }
        if (items.size == 1) { items[0].second(); return }
        AlertDialog.Builder(this, if (dark) android.R.style.Theme_DeviceDefault_Dialog_Alert else android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle(R.string.huntPick)
            .setItems(items.map { it.first }.toTypedArray()) { _, i -> items[i].second() }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun send(url: String, ref: String) {
        val i = Intent(this, MainActivity::class.java)
            .setAction(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, url)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (ref.isNotEmpty()) i.putExtra(EXTRA_REF, ref)
        startActivity(i)
        finish()
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
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(bar.windowToken, 0)
        web.loadUrl(url)
    }

    private fun showKeyboard() {
        ui.postDelayed({ (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(bar, 0) }, 250)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        try { web.stopLoading(); web.destroy() } catch (e: Exception) {}
        super.onDestroy()
    }

    companion object {
        const val EXTRA_REF = "snb_ref"
        const val EXTRA_AUTO = "snb_auto"   // נפתח לבד אחרי בדיקה שלא מצאה סרטון (DlActivity)

        /* הסקריפט בדף: fetch/XHR של הנגן ו־src של <video>/<source>. רק מדווח כתובות (מחרוזות) — לא משנה כלום */
        private const val HOOK = """(function(){try{
var ch=window.snbHunt;if(!ch||window.__snbHunt)return;window.__snbHunt=1;
var R=/\.(m3u8?|mpd|mp4|m4v|webm|mov|mkv)(\?|#|$)|format=m3u8|m3u8-aapl|mpd-time-csf/i,seen={};
function rep(u){try{if(!u)return;u=new URL(String(u),location.href).href;if(u.indexOf('http')!==0||seen[u]||!R.test(u))return;seen[u]=1;ch.postMessage(u);}catch(e){}}
var f=window.fetch;if(f)window.fetch=function(i){try{rep(i&&i.url?i.url:i);}catch(e){}return f.apply(this,arguments);};
var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){rep(u);return o.apply(this,arguments);};
function scan(){var v=document.querySelectorAll('video,source');for(var k=0;k<v.length;k++){var s=v[k].currentSrc||v[k].src;if(s&&s.indexOf('blob:')!==0)rep(s);}}
document.addEventListener('play',scan,true);document.addEventListener('loadedmetadata',scan,true);setInterval(scan,3000);
}catch(e){}})();"""
    }
}
