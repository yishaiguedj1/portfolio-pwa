package io.github.yishaiguedj1.snowball

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import android.content.ComponentName
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.ColorFilter
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.LocalSize
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider as GColor
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * הווידג'ט למסך הבית — גרסה B (תצוגות מקדימות native-1 → native3 שאושרה): כותרת עם "עודכן" + ↻ ובועת מצב השוק,
 * הלוגו 98dp במרכז עולה ~28dp על הכרטיס הראשון; מתחת — כל התיק ברשימה שנגללת (בלי פס גלילה), כרטיס 74dp לכל מניה:
 * לוגו, סימבול + תגית + שם, בועת הסשן של האפליקציה, מחיר + צ׳יפ. מימין לשמאל כמו באפליקציה.
 * בהיר/כהה לפי מצב המערכת. נגיעה בכרטיס → האפליקציה על אותה מניה (‎#stock=SYM, openStockFromHash באתר).
 */
class SnowballWidget : GlanceAppWidget() {
    // הגודל האמיתי (LocalSize) — בווידג'ט צר הכותרת והבועה מתקצרות
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            currentState<Preferences>()[KEY_STAMP] // קריאה = ציור מחדש בכל רענון (WidgetRefresh.repaint)
            val model = WidgetModel.parse(WidgetStore.model(context))
            val logos = model?.rows?.associate { it.sym to LogoCache.bitmap(context, it.sym) } ?: emptyMap()
            Content(context, model, logos, WidgetStore.updated(context))
        }
    }

    companion object {
        val KEY_STAMP = longPreferencesKey("stamp")
    }
}

class SnowballWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = SnowballWidget()

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        WidgetRefresh.ensurePeriodic(context)
        WidgetRefresh.now(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        stopIfNoWidgets(context)
    }
}

/** v249: עוצרים את הרענון רק כשלא נשאר אף ווידג'ט (התיק או רשימות המעקב) */
fun stopIfNoWidgets(context: Context) {
    val m = AppWidgetManager.getInstance(context)
    val any = listOf(SnowballWidgetReceiver::class.java, SnowballWatchWidgetReceiver::class.java)
        .any { m.getAppWidgetIds(ComponentName(context, it)).isNotEmpty() }
    if (!any) WidgetRefresh.stopAll(context)
}

/** ↻ — רענון מיידי מהשרתון */
class RefreshAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        WidgetRefresh.now(context)
    }
}

// הצבעים — 20/11/2026 (בקשת המשתמש): זכוכית כמו Invest (invest-glass.css). הרקע, הכרטיסים, הכפתורים והקפסולות = משאבי ציור
// 20/11/2026 (תיקון אחרי הצילום מהטלפון — שכבות XML יצאו שטוחות): חומר הזכוכית = תמונות 9-patch שמצולמות מאותו CSS של התצוגה
// המקדימה שאושרה (tools/widget-glass.js → drawable(-night)-xxhdpi): צל, שפה בהירה וזוהר פנימי — אותם פיקסלים. כל תמונה כוללת
// שוליים לצל (G_*): הקופסה בקוד גדולה בהם, והתוכן מרופד בהם. כאן רק טקסט וגלולות.
private object C {
    val on = ColorProvider(Color(0xFF111413), Color(0xFFF3F5F4))
    val variant = ColorProvider(Color(0xFF5D6561), Color(0xFFA3A9A6))
    val pos = ColorProvider(Color(0xFF16A34A), Color(0xFF34C759))
    val neg = ColorProvider(Color(0xFFDC2626), Color(0xFFFF453A))
    val letter: GColor = ColorProvider(Color(0xFF3A3A3C), Color(0xFF3A3A3C))
    val onPrimary = ColorProvider(Color(0xFF06281A), Color(0xFF06281A))
}

private fun ltr(s: String) = "\u2066$s\u2069"
private fun dirColor(d: Dir) = when (d) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.on }
private fun softColor(d: Dir) = when (d) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.variant }
/** הגלולה והנקודה — תמונות מעוגלות (tools/widget-glass.js): cornerRadius של Glance לא נחתך בכל מכשיר */
private fun dayBg(d: Dir) = when (d) { Dir.POS -> R.drawable.day_pos; Dir.NEG -> R.drawable.day_neg; Dir.FLAT -> R.drawable.day_flat }
private fun dotImg(d: Dir) = when (d) { Dir.POS -> R.drawable.dot_pos; Dir.NEG -> R.drawable.dot_neg; Dir.FLAT -> R.drawable.dot_flat }

@Composable
private fun Dot(d: Dir) { Image(ImageProvider(dotImg(d)), contentDescription = null, modifier = GlanceModifier.size(6.dp)) }

/** הרקע של Invest (‎--gl-ambient: ירוק, טורקיז וסגול) — תמונה מוכנה בבהיר ובכהה, נמתחת לגודל הווידג'ט */
/** שולי הצל בתמונות הזכוכית (dp) — זהים ל־tools/widget-glass.js */
private object G { const val CARD_T = 1; const val CARD_S = 3; const val CARD_B = 6; const val S = 2; const val T = 1; const val B3 = 3; const val B4 = 4 }

private val BG = GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_bg), ContentScale.FillBounds).cornerRadius(28.dp)

private fun stockIntent(context: Context, sym: String, extra: String = ""): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launchUrl) + "#stock=" + Uri.encode(sym) + extra))
        .setClass(context, MainActivity::class.java)

/** v250: הלוגו פותח את הטאב של הווידג'ט — התיק → "מניות", רשימות המעקב → "מעקב" על הרשימה שבווידג'ט (app.js → openStockFromHash) */
private fun tabIntent(context: Context, tab: String, list: String? = null): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launchUrl) + "#tab=" + tab + (if (list.isNullOrEmpty()) "" else "&wl=" + Uri.encode(list))))
        .setClass(context, MainActivity::class.java)

/** טקסטים בשפת האפליקציה (לא בשפת הטלפון) — "עודכן", "ידני" */
private fun localized(context: Context, lang: String): Context {
    val conf = Configuration(context.resources.configuration)
    conf.setLocale(Locale.forLanguageTag(lang))
    return context.createConfigurationContext(conf)
}

/**
 * כיוון: כמו כרטיס המניה באפליקציה — בעברית מימין לשמאל (הלוגו מימין), גם כשהטלפון באנגלית.
 * את כיוון הפריסה של ווידג'ט קובע המשגר (שפת הטלפון), ולכן כשהוא הפוך מהרצוי — הופכים בעצמנו את סדר
 * הילדים בשורות ואת היישור (Start↔End). "s" = תחילת הקריאה (ימין בעברית), "e" = סופה.
 */
private class Dirn(context: Context, lang: String) {
    val rtlPhone = context.resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL
    val flip = (lang != "en") != rtlPhone
    val s: Alignment.Horizontal get() = if (flip) Alignment.End else Alignment.Start
    val e: Alignment.Horizontal get() = if (flip) Alignment.Start else Alignment.End
    val ts: TextAlign get() = if (flip) TextAlign.End else TextAlign.Start
    fun <T> order(parts: List<T>) = if (flip) parts.reversed() else parts
}

private typealias Part = @Composable RowScope.() -> Unit

@Composable
private fun narrow() = LocalSize.current.width < 340.dp

@Composable
private fun DRow(d: Dirn, modifier: GlanceModifier = GlanceModifier, parts: List<Part>) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) { d.order(parts).forEach { it() } }
}

@Composable
private fun Content(context: Context, model: WidgetModel?, logos: Map<String, Bitmap?>, updated: Long) {
    val lang = WidgetStore.lang(context)
    val lc = localized(context, lang)
    val d = Dirn(context, lang)
    Box(BG) {
        Column(GlanceModifier.fillMaxSize()) {
            Header(lc, d, model?.fx, updated)
            if (model == null || model.rows.isEmpty()) {
                // עוד לא הגיעה רשימה מהאפליקציה (או שהשרתון לא ענה בפעם הראשונה)
                Box(
                    GlanceModifier.fillMaxWidth().defaultWeight().padding(16.dp).clickable(actionStartActivity<MainActivity>()),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        lc.getString(if (WidgetStore.items(context).isEmpty()) R.string.wEmpty else R.string.wLoading),
                        style = TextStyle(color = C.variant, fontSize = 14.sp, textAlign = TextAlign.Center),
                    )
                }
            } else {
                // בלי פס גלילה: הסגנון Glance.AppWidget.List נדרס ב־res/values/styles.xml
                LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 7.dp, end = 7.dp)) {
                    items(model.rows, itemId = { it.sym.hashCode().toLong() }) { row ->
                        Column(GlanceModifier.fillMaxWidth()) { Card(context, lc, d, row, logos[row.sym]) }
                    }
                }
            }
        }
        /* הלוגו (98dp מ־30/09/2026, היה 84dp — בקשת המשתמש) — בשכבה מעל הרשימה, עולה ~28dp על הכרטיס הראשון (הכותרת לא גדלה).
           נגיעה בכל הלוגו — גם בחלק שמעל הכרטיס — פותחת את האפליקציה (בקשת המשתמש). רק ריבוע הלוגו לוחץ;
           מחוץ לו הנגיעה עוברת לכרטיס. גלילה שמתחילה על הלוגו לא גוללת (הוא תופס את המגע). */
        Box(GlanceModifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.TopCenter) {
            Image(
                ImageProvider(R.drawable.widget_logo), contentDescription = lc.getString(R.string.app_name),
                modifier = GlanceModifier.size(if (narrow()) 84.dp else 98.dp).clickable(actionStartActivity(tabIntent(context, "stocks"))),
            )
        }
    }
}

/* v228: כותרת — מצד אחד כפתור רענון עגול בסגנון כפתורי ההדר באפליקציה (רקע + מסגרת דקה, אייקון ירוק) ו"עודכן",
   מהצד השני בועת שער הדולר כמו באפליקציה (נקודה + "שער הדולר", מתחת ₪3.06). בועת מצב השוק הוסרה (בקשת המשתמש) —
   מצב המסחר כבר מופיע בבועה של כל כרטיס. תצוגה מקדימה אושרה 28/09/2026. */
@Composable
private fun Header(lc: Context, d: Dirn, fx: Fx?, updated: Long, logo: (@Composable () -> Unit)? = null) {
    val time = if (updated <= 0L) "—" else DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(updated))
    // ווידג'ט המעקב (20/11/2026): הלוגו באמצע שורת הכותרת — לא חופף לטאבים, והחלק העליון נמוך יותר
    Column(
        if (logo == null) GlanceModifier.fillMaxWidth().height(74.dp).padding(start = 14.dp, end = 14.dp, bottom = 10.dp)
        else GlanceModifier.fillMaxWidth().height(90.dp).padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 2.dp),
        verticalAlignment = if (logo == null) Alignment.Bottom else Alignment.CenterVertically,
    ) {
        DRow(d, GlanceModifier.fillMaxWidth(), listOf(
            {
                // עיגול זכוכית, הסמל בצבע הטקסט — כמו כפתורי ההדר ב־Invest
                Box(
                    GlanceModifier.width((36 + 2 * G.S).dp).height((36 + G.T + G.B3).dp).background(ImageProvider(R.drawable.glass_circle))
                        .padding(top = G.T.dp, bottom = G.B3.dp).clickable(actionRunCallback<RefreshAction>()),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(ImageProvider(R.drawable.ic_widget_refresh), contentDescription = lc.getString(R.string.wRefresh),
                        modifier = GlanceModifier.size(19.dp), colorFilter = ColorFilter.tint(C.on))
                }
            },
            { Spacer(GlanceModifier.width(8.dp)) },
            { Text(if (narrow()) time else lc.getString(R.string.wUpdated, time), style = TextStyle(color = C.variant, fontSize = 12.sp), maxLines = 1) },
            { Spacer(GlanceModifier.defaultWeight()) },
            { if (logo != null) logo() },
            { if (logo != null) Spacer(GlanceModifier.defaultWeight()) },
            { if (fx != null) FxPill(lc, d, fx) },
        ))
    }
}

@Composable
private fun FxPill(lc: Context, d: Dirn, fx: Fx) {
    val dot = if (!fx.open) Dir.FLAT else fx.dir
    // 20/11/2026: קפסולת זכוכית בשורה אחת "● דולר ₪3.33" — כמו ‎.fx-pill בהדר של Invest
    // "₪3.33" — הסימן קטן מהמספר, תמיד משמאל: Row מסדר לפי כיוון הטלפון, אז הופכים ב־RTL
    val cur: Part = { Text("₪", style = TextStyle(color = C.on, fontSize = 12.sp, fontWeight = FontWeight.Medium), maxLines = 1) }
    val num: Part = { Text(fx.value, style = TextStyle(color = C.on, fontSize = 15.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
    DRow(d, GlanceModifier.height((34 + G.T + G.B3).dp).background(ImageProvider(R.drawable.glass_pill))
        .padding(start = (12 + G.S).dp, end = (12 + G.S).dp, top = G.T.dp, bottom = G.B3.dp), listOf(
        { Dot(dot) },
        { Spacer(GlanceModifier.width(5.dp)) },
        { Text(lc.getString(R.string.wFxShort), style = TextStyle(color = C.variant, fontSize = 12.5.sp, fontWeight = FontWeight.Medium), maxLines = 1) },
        { Spacer(GlanceModifier.width(5.dp)) },
        { Row(verticalAlignment = Alignment.Bottom) { (if (d.rtlPhone) listOf(num, cur) else listOf(cur, num)).forEach { it() } } },
    ))
}

/** 20/11/2026 (בקשת המשתמש, תצוגה מקדימה "קומפקטי" אושרה): כרטיס זכוכית כמו כרטיס המניה ב־Invest — לוגו עגול; סימבול + תגית + שם,
 *  מתחת בועת המסחר המורחב; מחיר, מתחת גלולת השינוי היומי באותו סדר כמו באפליקציה ("−$3.12 −1.35%"). אותו גובה (74dp). */
@Composable
private fun Card(context: Context, lc: Context, d: Dirn, r: WidgetRow, logo: Bitmap?, extra: String = "") {
    DRow(
        d,
        GlanceModifier.fillMaxWidth().height((74 + G.CARD_T + G.CARD_B).dp).background(ImageProvider(R.drawable.glass_card))
            .padding(start = (11 + G.CARD_S).dp, end = (11 + G.CARD_S).dp, top = G.CARD_T.dp, bottom = G.CARD_B.dp).clickable(actionStartActivity(stockIntent(context, r.sym, extra))),
        listOf(
            {
                // לוגו עגול (‎.stock-logo) — דיסק לבן; התמונה בתוך העיגול (ת"א — מלאה, נחתכת לעיגול באנדרואיד 12+)
                Box(GlanceModifier.width((40 + 2 * G.S).dp).height((40 + G.T + G.B4).dp).background(ImageProvider(R.drawable.logo_disc))
                    .padding(start = G.S.dp, end = G.S.dp, top = G.T.dp, bottom = G.B4.dp), contentAlignment = Alignment.Center) {
                    Box(GlanceModifier.size(40.dp).cornerRadius(20.dp), contentAlignment = Alignment.Center) {
                        if (logo != null) Image(ImageProvider(logo), contentDescription = null, modifier = GlanceModifier.size(if (r.sym.endsWith(".TA")) 40.dp else 27.dp), contentScale = ContentScale.Fit)
                        else Text(r.disp.take(1), style = TextStyle(color = C.letter, fontSize = 17.sp, fontWeight = FontWeight.Bold))
                    }
                }
            },
            { Spacer(GlanceModifier.width(8.dp)) },
            {
                Column(GlanceModifier.defaultWeight(), horizontalAlignment = d.s) {
                    DRow(d, GlanceModifier.fillMaxWidth(), listOf(
                        // 20/11/2026 (בקשת המשתמש): בלי תגית המקור — יותר מקום לשם המלא של החברה
                        { Text(ltr(r.disp), style = TextStyle(color = C.on, fontSize = 16.5.sp, fontWeight = FontWeight.Bold), maxLines = 1) },
                        { Spacer(GlanceModifier.width(7.dp)) },
                        { Text(r.name, modifier = GlanceModifier.defaultWeight(), style = TextStyle(color = C.variant, fontSize = 12.sp, textAlign = d.ts), maxLines = 1) },
                    ))
                    val b = r.bubble
                    if (b != null) {
                        if (!b.closed || b.l2.isNotEmpty() || b.pct.isNotEmpty()) { Spacer(GlanceModifier.height(5.dp)); SessionBubble(d, b) }
                    } else if (r.sub.isNotEmpty()) { // שרתון ישן בלי bubble
                        Spacer(GlanceModifier.height(5.dp))
                        Text(r.sub + (if (r.subPct.isNotEmpty()) " " + ltr(r.subPct) else ""), style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1)
                    }
                }
            },
            { Spacer(GlanceModifier.width(8.dp)) },
            {
                Column(horizontalAlignment = d.e) {
                    Text(ltr(r.price), style = TextStyle(color = C.on, fontSize = 20.sp, fontWeight = FontWeight.Bold), maxLines = 1)
                    Spacer(GlanceModifier.height(4.dp))
                    if (r.chg.isNotEmpty()) Box(GlanceModifier.background(ImageProvider(dayBg(r.dir))).padding(start = 8.dp, end = 8.dp, top = 2.dp, bottom = 2.dp)) {
                        Text(ltr(dayChip(r.chg)), style = TextStyle(color = dirColor(r.dir), fontSize = 12.sp, fontWeight = FontWeight.Bold), maxLines = 1)
                    }
                }
            },
        ),
    )
}

/** "−$3.12 (−1.35%)" מהשרתון → "−$3.12  −1.35%" — הסכום משמאל והאחוז מימין, כמו ‎.day-chg באפליקציה (בלי סוגריים) */
internal fun dayChip(chg: String): String {
    val i = chg.lastIndexOf(" (")
    return if (i > 0 && chg.endsWith(")")) chg.substring(0, i) + "  " + chg.substring(i + 2, chg.length - 1) else chg
}

/** הבועה — כמו ‎.ext-sess באפליקציה: קפסולת זכוכית, נקודה + המסחר המורחב + האחוז בצבע הכיוון.
 *  השוק סגור — כמו באפליקציה: בלי שורת "השוק סגור" ובלי הנקודה, רק שורת המסחר האחרון ("מסחר־מאוחר +0.3%") */
@Composable
private fun SessionBubble(d: Dirn, b: Bubble) {
    val parts = mutableListOf<Part>()
    if (narrow()) {
        // צר: רק נקודה ואחוז — בלי שם המסחר שנחתך ל"מסחר…"
        parts += { Dot(b.dir) }
        if (b.pct.isNotEmpty()) parts += { Spacer(GlanceModifier.width(5.dp)) }
        if (b.pct.isNotEmpty()) parts += { Text(ltr(b.pct), style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
    } else if (b.closed) {
        if (b.l2.isNotEmpty()) parts += { Text(b.l2, style = TextStyle(color = C.variant, fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
        if (b.l2.isNotEmpty() && b.pct.isNotEmpty()) parts += { Spacer(GlanceModifier.width(5.dp)) }
        if (b.pct.isNotEmpty()) parts += { Text(ltr(b.pct), style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
    } else {
        parts += { Dot(b.dir) }
        parts += { Spacer(GlanceModifier.width(5.dp)) }
        parts += { Text(b.l1, style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
        parts += { Spacer(GlanceModifier.width(5.dp)) }
        parts += { Text(ltr(b.pct), style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
    }
    DRow(d, GlanceModifier.background(ImageProvider(R.drawable.glass_fill)).padding(start = 9.dp, end = 9.dp, top = 2.dp, bottom = 3.dp), parts)
}

/* ---------------- v249: ווידג'ט "רשימות מעקב" ----------------
   ווידג'ט נפרד מהתיק (בקשת המשתמש): אותה כותרת, אותו לוגו ואותם כרטיסים, ומתחת לכותרת טאבים — אחד לכל רשימה,
   כמו בטאב המעקב באפליקציה. נגיעה בטאב מחליפה את הרשימה בווידג'ט הזה בלבד (כל ווידג'ט זוכר את שלו) —
   אפשר לשים כמה ווידג'טים, כל אחד על רשימה אחרת. יותר מ־3 רשימות: חלון של 3 טאבים + חצים. */
class SnowballWatchWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val st = currentState<Preferences>()
            st[SnowballWidget.KEY_STAMP]
            val lists = WidgetStore.watchLists(context)
            val sel = lists.firstOrNull { it.id == st[KEY_LIST] } ?: lists.firstOrNull()
            val model = sel?.let { WidgetModel.parse(WidgetStore.watchModel(context, it.id)) }
            val logos = model?.rows?.associate { it.sym to LogoCache.bitmap(context, it.sym) } ?: emptyMap()
            WatchContent(context, lists, sel, model, logos, WidgetStore.watchUpdated(context))
        }
    }

    companion object {
        val KEY_LIST = stringPreferencesKey("wl")
    }
}

class SnowballWatchWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = SnowballWatchWidget()

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        WidgetRefresh.ensurePeriodic(context)
        WidgetRefresh.now(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        stopIfNoWidgets(context)
    }
}

private val LIST_PARAM = ActionParameters.Key<String>("wl")

/** נגיעה בטאב — הרשימה של הווידג'ט הזה. הנתונים כבר שמורים (הרענון מושך את כל הרשימות) — ציור מיידי, ואם אין — רענון */
class SelectListAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[LIST_PARAM] ?: return
        // v251: גם חותמת ציור חדשה — מאלצת ציור מלא גם אם הרכבה קודמת עוד פתוחה (מעבר טאבים ש"נתקע" לסירוגין)
        updateAppWidgetState(context, glanceId) { it[SnowballWatchWidget.KEY_LIST] = id; it[SnowballWidget.KEY_STAMP] = System.nanoTime() }
        SnowballWatchWidget().update(context, glanceId)
        if (WidgetStore.watchModel(context, id) == null) WidgetRefresh.now(context)
    }
}

@Composable
private fun WatchContent(context: Context, lists: List<WatchList>, sel: WatchList?, model: WidgetModel?, logos: Map<String, Bitmap?>, updated: Long) {
    val lang = WidgetStore.lang(context)
    val lc = localized(context, lang)
    val d = Dirn(context, lang)
    Box(BG) {
        Column(GlanceModifier.fillMaxSize()) {
            // 20/11/2026 (בקשת המשתמש): הלוגו (80dp) באמצע שורת הכותרת — לא מסתיר את הטאבים, והחלק העליון מינימלי
            Header(lc, d, model?.fx, updated) {
                Image(
                    ImageProvider(R.drawable.widget_logo), contentDescription = lc.getString(R.string.app_name),
                    modifier = GlanceModifier.size(80.dp).clickable(actionStartActivity(tabIntent(context, "wishlist", sel?.id))),
                )
            }
            if (lists.isNotEmpty()) WatchTabs(d, lang, lists, sel)
            if (lists.isEmpty() || model == null || model.rows.isEmpty()) {
                Box(
                    GlanceModifier.fillMaxWidth().defaultWeight().padding(16.dp).clickable(actionStartActivity<MainActivity>()),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        lc.getString(if (lists.isEmpty()) R.string.wWatchEmpty else R.string.wLoading),
                        style = TextStyle(color = C.variant, fontSize = 14.sp, textAlign = TextAlign.Center),
                    )
                }
            } else {
                // v251: מזהה השורה כולל את הרשימה — עם מזהה לפי הסימבול בלבד מסך הבית שמר שורות (ואת הקישור שלהן, עם ‎wl= של
                // הרשימה הקודמת) בין טאבים: הרשימה נראתה "תקועה", ונגיעה במניה פתחה את הרשימה הקודמת
                val listKey = sel?.id ?: ""
                LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 7.dp, end = 7.dp)) {
                    items(model.rows, itemId = { (listKey + "|" + it.sym).hashCode().toLong() }) { row ->
                        Column(GlanceModifier.fillMaxWidth()) { Card(context, lc, d, row, logos[row.sym], "&tab=wishlist&wl=" + Uri.encode(listKey)) }
                    }
                }
            }
        }
    }
}

/* הטאבים: קפסולות זכוכית שממלאות את הרוחב, הנבחר — טיפת זכוכית ירוקה (כמו באפליקציה). עד 3 גלויים; יותר — חלון סביב
   הנבחר עם ‹ › לרשימה הקודמת/הבאה. צמודים מתחת לכותרת (הלוגו בתוכה מ־20/11/2026). */
@Composable
private fun WatchTabs(d: Dirn, lang: String, lists: List<WatchList>, sel: WatchList?) {
    val max = 3
    val i = lists.indexOfFirst { it.id == sel?.id }.coerceAtLeast(0)
    val start = (i - 1).coerceIn(0, maxOf(0, lists.size - max))
    val win = lists.subList(start, minOf(lists.size, start + max))
    val rtl = lang != "en"
    val parts = mutableListOf<Part>()
    if (start > 0) parts += { TabArrow(if (rtl) "›" else "‹", lists[start - 1].id) }
    win.forEachIndexed { k, l ->
        if (k > 0 || start > 0) parts += { Spacer(GlanceModifier.width(4.dp)) } // + שולי הצל של התמונות (2+2) = 8dp בעין
        parts += { TabChip(l, l.id == (sel?.id ?: lists.first().id)) }
    }
    if (start + max < lists.size) {
        parts += { Spacer(GlanceModifier.width(4.dp)) }
        parts += { TabArrow(if (rtl) "‹" else "›", lists[start + max].id) }
    }
    DRow(d, GlanceModifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 0.dp, bottom = 4.dp), parts)
}

@Composable
private fun RowScope.TabChip(l: WatchList, on: Boolean) {
    Box(
        // 30/09/2026 (בקשת המשתמש): טאבים גדולים ונוחים ללחיצה — 44dp (היה 32), טקסט 15 (היה 13)
        GlanceModifier.defaultWeight().height((44 + G.T + G.B4).dp).background(ImageProvider(if (on) R.drawable.glass_tab_on else R.drawable.glass_tab))
            .padding(top = G.T.dp, bottom = G.B4.dp).clickable(actionRunCallback<SelectListAction>(actionParametersOf(LIST_PARAM to l.id))),
        contentAlignment = Alignment.Center,
    ) {
        Text(l.name, modifier = GlanceModifier.padding(start = 8.dp, end = 8.dp),
            style = TextStyle(color = if (on) C.onPrimary else C.on, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center), maxLines = 1)
    }
}

@Composable
private fun TabArrow(glyph: String, target: String) {
    Box(
        GlanceModifier.width((44 + 2 * G.S).dp).height((44 + G.T + G.B4).dp).background(ImageProvider(R.drawable.glass_arrow))
            .padding(top = G.T.dp, bottom = G.B4.dp).clickable(actionRunCallback<SelectListAction>(actionParametersOf(LIST_PARAM to target))),
        contentAlignment = Alignment.Center,
    ) {
        Text(glyph, style = TextStyle(color = C.on, fontSize = 22.sp, fontWeight = FontWeight.Bold), maxLines = 1)
    }
}
