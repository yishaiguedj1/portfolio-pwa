package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.trusted.TrustedWebActivityIntentBuilder
import com.google.androidbrowserhelper.trusted.TwaLauncher

/**
 * פותח את האתר כאפליקציה (Trusted Web Activity) — תמיד ב־Chrome (לא בדפדפן ברירת המחדל: דפדפן היצרן
 * לפעמים נכשל), עם מסך לוגו בזמן הטעינה, והודעת שגיאה על המסך במקום להיסגר בשקט.
 * קישור לאתר (למשל ‎#stock=SYM מהווידג'ט) נפתח בכתובת שלו — גם כשהאפליקציה כבר פתוחה (onNewIntent).
 */
class MainActivity : Activity() {
    private var launcher: TwaLauncher? = null
    private var launched = false
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildSplash())
        open(urlFor(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        open(urlFor(intent))
    }

    // חזרה מהאתר (כפתור "אחורה") — סוגרים, במקום להשאיר מסך לוגו ריק
    override fun onRestart() {
        super.onRestart()
        if (launched) finish()
    }

    override fun onDestroy() {
        launcher?.destroy()
        super.onDestroy()
    }

    private fun urlFor(i: Intent?): Uri {
        val d = i?.data
        return if (d != null && d.scheme == "https" && d.host == SITE_HOST && (d.path ?: "").startsWith(SITE_PATH)) d
        else Uri.parse(getString(R.string.launchUrl))
    }

    private fun open(url: Uri) {
        try {
            val pkg = CustomTabsClient.getPackageName(this, CHROME_PACKAGES, true)
            if (pkg == null) {
                openInAnyBrowser(url)
                return
            }
            launcher?.destroy()
            val colors = CustomTabColorSchemeParams.Builder()
                .setToolbarColor(Color.BLACK).setNavigationBarColor(Color.BLACK).build()
            val builder = TrustedWebActivityIntentBuilder(url).setDefaultColorSchemeParams(colors)
            launcher = TwaLauncher(this, pkg).also {
                it.launch(builder, null, null, { launched = true }, TwaLauncher.CCT_FALLBACK_STRATEGY)
            }
        } catch (e: Throwable) {
            showError(e)
        }
    }

    // בלי Chrome: דפדפן רגיל (לא אנחנו — אחרת הקישור היה חוזר לאפליקציה)
    private fun openInAnyBrowser(url: Uri) {
        try {
            val probe = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com/"))
            val browser = packageManager.resolveActivity(probe, 0)?.activityInfo?.packageName
            val i = Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)
            if (browser != null && browser != packageName && browser != "android") i.setPackage(browser)
            startActivity(i)
            launched = true
        } catch (e: ActivityNotFoundException) {
            status.text = getString(R.string.noBrowser)
        } catch (e: Throwable) {
            showError(e)
        }
    }

    private fun showError(e: Throwable) {
        status.text = getString(R.string.openFailed) + "\n" + e.javaClass.simpleName + ": " + (e.message ?: "")
    }

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun buildSplash(): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }
        root.addView(ImageView(this).apply { setImageResource(R.mipmap.ic_launcher_foreground) }, LinearLayout.LayoutParams(dp(180), dp(180)))
        status = TextView(this).apply {
            setTextColor(Color.parseColor("#A3A9A6"))
            textSize = 15f
            gravity = Gravity.CENTER
            text = getString(R.string.loading)
        }
        root.addView(status, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) })
        return root
    }

    companion object {
        const val SITE_HOST = "yishaiguedj1.github.io"
        const val SITE_PATH = "/portfolio-pwa"
        val CHROME_PACKAGES = listOf("com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary")
    }
}
