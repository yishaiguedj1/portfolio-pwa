package io.github.yishaiguedj1.snowball

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Looper
import android.view.View
import android.widget.FrameLayout
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.compose
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assume
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * צילום הווידג'טים האמיתיים בלי מכשיר (20/11/2026, אחרי שתצוגה ב־HTML יצאה שונה מהטלפון): Glance → RemoteViews (מה שהמשגר מקבל)
 * → apply → ציור במנוע של אנדרואיד (Robolectric, native graphics), בבהיר ובכהה. נתוני דמו בלבד.
 * רץ רק עם WIDGET_SHOTS=<תיקייה> — `bash tools/widget-shots.sh`. לא חלק מ־CI.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi")
class WidgetShotTest {
    private val out = System.getenv("WIDGET_SHOTS").orEmpty()

    private fun card(sym: String, name: String, price: String, chg: String, dir: String, pre: String, preDir: String, src: String = "ibkr") =
        """{"sym":"$sym","disp":"$sym","name":"$name","price":"$price","chg":"$chg","dir":"$dir","src":"$src","q":{"session":"pre"},
           "bubble":{"closed":false,"l1":"מסחר־מוקדם","l2":"","pct":"$pre","dir":"$preDir"}}"""

    private fun model(cards: List<String>) =
        """{"header":{"lines":[],"live":true},"fx":{"v":"3.34","dir":"pos","open":true},"cards":[${cards.joinToString(",")}]}"""

    private val pf = listOf(
        card("AAPL", "Apple", "\$228.41", "⁦−\$3.12⁩ (⁦−1.35%⁩)", "neg", "−0.42%", "neg"),
        card("MSFT", "Microsoft", "\$512.10", "⁦−\$9.01⁩ (⁦−1.73%⁩)", "neg", "+0.18%", "pos"),
        card("NVDA", "NVIDIA", "\$174.90", "⁦+\$2.21⁩ (⁦+1.28%⁩)", "pos", "−0.85%", "neg", "manual"),
        card("KO", "Coca-Cola", "\$69.10", "⁦+\$0.32⁩ (⁦+0.47%⁩)", "pos", "+0.05%", "pos"),
        card("UBER", "Uber Technologies", "\$65.20", "⁦−\$3.16⁩ (⁦−4.60%⁩)", "neg", "−0.62%", "neg"),
        card("NOW", "ServiceNow", "\$178.20", "⁦−\$2.40⁩ (⁦−1.33%⁩)", "neg", "−1.10%", "neg"),
        card("ADBE", "Adobe", "\$221.37", "⁦−\$4.52⁩ (⁦−2.00%⁩)", "neg", "−0.14%", "neg"),
    )
    private val wl = listOf(
        card("AMD", "Advanced Micro Devices", "\$161.36", "⁦−\$4.95⁩ (⁦−2.98%⁩)", "neg", "−1.79%", "neg", "watch"),
        card("AVGO", "Broadcom", "\$337.76", "⁦−\$7.40⁩ (⁦−2.09%⁩)", "neg", "+0.56%", "pos", "watch"),
        card("INTU", "Intuit", "\$703.83", "⁦+\$6.31⁩ (⁦+0.90%⁩)", "pos", "−0.20%", "neg", "watch"),
        card("ANET", "Arista Networks", "\$183.99", "⁦−\$4.35⁩ (⁦−2.24%⁩)", "neg", "−3.02%", "neg", "watch"),
        card("QQQ", "Invesco QQQ Trust", "\$634.29", "⁦−\$14.47⁩ (⁦−2.19%⁩)", "neg", "−1.67%", "neg", "watch"),
    )

    private fun seed(c: Context) {
        val now = System.currentTimeMillis()
        val lists = """[{"i":"a","n":"תוכנה","s":"MSFT"},{"i":"b","n":"שבבים","s":"AMD"},{"i":"c","n":"פיננסים","s":"JPM"},{"i":"d","n":"מדדים","s":"SPX"}]"""
        c.getSharedPreferences("snowball_widget", Context.MODE_PRIVATE).edit()
            .putString("model", model(pf)).putLong("t", now).putString("l", "he")
            .putString("w", lists).putString("wm_b", model(wl)).putString("wm_a", model(wl)).putLong("wt", now)
            .commit()
    }

    private fun shoot(c: Context, w: GlanceAppWidget, name: String, wDp: Int, hDp: Int) = runBlocking {
        val rv = w.compose(c, size = DpSize(wDp.dp, hDp.dp))
        val d = c.resources.displayMetrics.density
        val wPx = (wDp * d).toInt(); val hPx = (hDp * d).toInt()
        val host = FrameLayout(c)
        val v = rv.apply(c, host)
        host.addView(v, FrameLayout.LayoutParams(wPx, hPx))
        // הרשימה (RemoteCollectionItems → ListView) בונה את השורות רק בפריסה, ולפעמים אחרי הודעה בלולאה — שלושה סבבים
        repeat(3) {
            shadowOf(Looper.getMainLooper()).idle()
            host.measure(View.MeasureSpec.makeMeasureSpec(wPx, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(hPx, View.MeasureSpec.EXACTLY))
            host.layout(0, 0, wPx, hPx)
        }
        // Robolectric לא ממלא את הרשימה (adapter=null). הפריטים עצמם נמצאים ב־RemoteViews (RemoteCollectionItems) — שולפים אותם,
        // מציירים כל שורה באותו מנוע, ומניחים אותן בטור במקום הרשימה (באותו מקום ובאותו גודל)
        val items = mutableListOf<android.widget.RemoteViews.RemoteCollectionItems>()
        collect(rv, items, java.util.IdentityHashMap())
        val lists = mutableListOf<android.widget.AbsListView>()
        fun find(x: View) { if (x is android.widget.AbsListView) lists += x; if (x is android.view.ViewGroup) for (i in 0 until x.childCount) find(x.getChildAt(i)) }
        find(host)
        println("WidgetShot $name: רשימות=${lists.size} אוספים=${items.size} פריטים=${items.map { it.itemCount }}")
        val lv = lists.firstOrNull(); val col = items.firstOrNull()
        if (lv != null && col != null) {
            val parent = lv.parent as android.view.ViewGroup
            val idx = parent.indexOfChild(lv)
            val box = android.widget.LinearLayout(c).apply { orientation = android.widget.LinearLayout.VERTICAL; setPadding(lv.paddingLeft, lv.paddingTop, lv.paddingRight, lv.paddingBottom) }
            for (i in 0 until col.itemCount) box.addView(col.getItemView(i).apply(c, box))
            val clip = FrameLayout(c).apply { clipChildren = true; addView(box, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT)) }
            parent.removeViewAt(idx); parent.addView(clip, idx, lv.layoutParams)
            repeat(2) {
                host.measure(View.MeasureSpec.makeMeasureSpec(wPx, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(hPx, View.MeasureSpec.EXACTLY))
                host.layout(0, 0, wPx, hPx)
            }
        }
        val pad = (16 * d).toInt()
        val bmp = Bitmap.createBitmap(wPx + 2 * pad, hPx + 2 * pad, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        cv.drawColor(Color.rgb(0x2A, 0x21, 0x60)) // בערך הטפט של המשתמש — הווידג'ט על רקע כהה כמו במסך הבית
        cv.translate(pad.toFloat(), pad.toFloat())
        host.draw(cv)
        File(out).mkdirs()
        File(out, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** חיפוש RemoteCollectionItems בעומק ה־RemoteViews (פעולות, תצוגות מקוננות, גדלים) — רפלקציה על מחלקות המסגרת */
    private fun collect(o: Any?, out: MutableList<android.widget.RemoteViews.RemoteCollectionItems>, seen: java.util.IdentityHashMap<Any, Boolean>) {
        if (o == null || seen.containsKey(o)) return
        seen[o] = true
        when (o) {
            is android.widget.RemoteViews.RemoteCollectionItems -> { out += o; return }
            is Collection<*> -> { o.forEach { collect(it, out, seen) }; return }
            is Map<*, *> -> { o.values.forEach { collect(it, out, seen) }; return }
            is Array<*> -> { o.forEach { collect(it, out, seen) }; return }
            is android.util.SparseArray<*> -> { for (i in 0 until o.size()) collect(o.valueAt(i), out, seen); return }
        }
        if (!o.javaClass.name.startsWith("android.widget.RemoteViews")) return
        var k: Class<*>? = o.javaClass
        while (k != null && k != Any::class.java) {
            for (fld in k.declaredFields) {
                if (java.lang.reflect.Modifier.isStatic(fld.modifiers) || fld.type.isPrimitive) continue
                runCatching { fld.isAccessible = true; collect(fld.get(o), out, seen) }
            }
            k = k.superclass
        }
    }

    @Test
    fun shots() {
        Assume.assumeTrue("WIDGET_SHOTS לא הוגדר — מדלגים", out.isNotEmpty())
        for (night in listOf(false, true)) {
            RuntimeEnvironment.setQualifiers(if (night) "+night" else "+notnight")
            val c = ApplicationProvider.getApplicationContext<Context>()
            seed(c)
            val t = if (night) "dark" else "light"
            shoot(c, SnowballWidget(), "pf-$t", 358, 588)
            shoot(c, SnowballWatchWidget(), "wl-$t", 358, 588)
            shoot(c, SnowballWidget(), "pf-$t-narrow", 300, 520)
        }
    }
}
