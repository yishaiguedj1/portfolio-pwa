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
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.trusted.TrustedWebActivityIntentBuilder
import com.google.androidbrowserhelper.trusted.TwaLauncher

/**
 * פותח את האתר כאפליקציה (Trusted Web Activity) — תמיד ב־Chrome (לא בדפדפן ברירת המחדל: דפדפן היצרן
 * לפעמים נכשל), עם מסך לוגו בזמן הטעינה, והודעת שגיאה על המסך במקום להיסגר בשקט.
 *
 * v254 — קישור (‎#stock=SYM מהווידג'ט) כשהאפליקציה כבר פתוחה: כמו LauncherActivity הרשמי — מופע חדש לכל
 * קישור (בלי singleTask), מעל ה־TWA ובאותה משימה. Chrome מזהה את הסשן במשימה ומעביר את הכתובת ללשונית הקיימת
 * (CLEAR_TOP → onNewIntent → ניווט; LaunchIntentDispatcher.createCustomTabActivityIntent). המופע החדש נסגר
 * מיד אחרי ההעברה; רק מופע השורש נשאר מתחת ל־TWA (בשביל "אחורה" → רענון הווידג'ט).
 * עד v253 (singleTask): נגיעה בווידג'ט הביאה את המופע הישן קדימה — זה סגר את ה־TWA שמעליו, ו־onRestart
 * (launched=true) סגר גם אותו לפני שהחיבור ל־Chrome הושלם, והפתיחה של הכתובת החדשה בוטלה.
 */
class MainActivity : Activity() {
    private var launcher: TwaLauncher? = null
    private var launched = false
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // נוצרנו מחדש אחרי שהתהליך נהרג ברקע, כשה־TWA מעלינו נסגר ("אחורה") — יוצאים, לא פותחים שוב
        if (savedInstanceState?.getBoolean(KEY_LAUNCHED) == true) { finish(); return }
        if (restartInOwnTask()) { finish(); return }
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
        WidgetRefresh.now(this) // חוזרים מהאפליקציה למסך הבית — הווידג'ט מתרענן
        if (launched) finish()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_LAUNCHED, launched)
    }

    override fun onDestroy() {
        launcher?.destroy()
        super.onDestroy()
    }

    /* קישור מאפליקציה אחרת נפתח במשימה שלה — מפעילים את עצמנו מחדש במשימה של האפליקציה, שבה רץ ה־TWA
       (כמו LauncherActivity.restartInNewTask). מהווידג'ט (הטרמפולינה של Glance, שלנו) — כבר במשימה שלנו. */
    private fun restartInOwnTask(): Boolean {
        val f = intent.flags
        if (f and Intent.FLAG_ACTIVITY_NEW_TASK != 0 && f and Intent.FLAG_ACTIVITY_NEW_DOCUMENT == 0) return false
        if (referrer?.host == packageName) return false
        startActivity(Intent(intent).setFlags((f or Intent.FLAG_ACTIVITY_NEW_TASK) and Intent.FLAG_ACTIVITY_NEW_DOCUMENT.inv()))
        return true
    }

    /* הכתובת לפתיחה + ‎app=<חתימת רשימת הווידג'ט> ב־hash: האתר יודע שהוא בתוך האפליקציה ומה הווידג'ט כבר מכיר,
       ומסנכרן רשימה רק כשיש הבדל (app.js → appWidgetSync). hash — לא משנה את הכתובת במטמון של ה־SW */
    private fun urlFor(i: Intent?): Uri {
        val d = i?.data
        val base = if (d != null && d.scheme == "https" && d.host == SITE_HOST && (d.path ?: "").startsWith(SITE_PATH)) d.toString()
        else getString(R.string.launchUrl)
        // v353: ‎n=<זמן> — כתובת שונה בכל פתיחה. הלוגו בווידג'ט שולח תמיד אותה כתובת (‎#tab=stocks), ונגיעה חוזרת
        // לא תמיד הגיעה לדף ("לפעמים לא עובד"); כרטיס מניה — כתובת שונה לכל מניה. האתר מוחק את ‎n= (appSessionFromHash)
        val app = "app=" + WidgetStore.sig(this) + "&n=" + java.lang.Long.toString(System.currentTimeMillis(), 36)
        return Uri.parse(if (base.contains('#')) "$base&$app" else "$base#$app")
    }

    private fun open(url: Uri) {
        try {
            val pkg = CustomTabsClient.getPackageName(this, CHROME_PACKAGES, true)
            if (pkg == null) {
                openInAnyBrowser(url)
                return
            }
            // אותו מחבר (וסשן) גם לקישור נוסף באותו מופע — השמדה ויצירה מחדש ביטלו פתיחה שעוד חיכתה לחיבור
            val l = launcher ?: TwaLauncher(this, pkg).also { launcher = it }
            // שורת הסטטוס: בבהיר — הירוק של האפליקציה (#30D158, כמו theme-color של האתר מ־v217); בכהה — שחור.
            // נקבע לפי מצב המערכת (TWA לא יודע על מתג הערכה שבתוך האתר)
            val dark = CustomTabColorSchemeParams.Builder()
                .setToolbarColor(Color.BLACK).setNavigationBarColor(Color.BLACK).build()
            val light = CustomTabColorSchemeParams.Builder()
                .setToolbarColor(Color.parseColor("#30D158")).setNavigationBarColor(Color.BLACK).build()
            val builder = TrustedWebActivityIntentBuilder(url)
                .setColorScheme(CustomTabsIntent.COLOR_SCHEME_SYSTEM)
                .setDefaultColorSchemeParams(light)
                .setColorSchemeParams(CustomTabsIntent.COLOR_SCHEME_LIGHT, light)
                .setColorSchemeParams(CustomTabsIntent.COLOR_SCHEME_DARK, dark)
            // מופע שנפתח מעל ה־TWA (קישור כשהאפליקציה פתוחה) — נסגר אחרי ההעברה; השורש נשאר עד "אחורה"
            l.launch(builder, null, null, { launched = true; if (!isTaskRoot) finish() }, TwaLauncher.CCT_FALLBACK_STRATEGY)
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
        private const val KEY_LAUNCHED = "snowball.launched"
        const val SITE_HOST = "yishaiguedj1.github.io"
        const val SITE_PATH = "/portfolio-pwa"
        val CHROME_PACKAGES = listOf("com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary")
    }
}
