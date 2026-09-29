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
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
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
 * הלוגו 84dp במרכז עולה ~14dp על הכרטיס הראשון; מתחת — כל התיק ברשימה שנגללת (בלי פס גלילה), כרטיס 74dp לכל מניה:
 * לוגו, סימבול + תגית + שם, בועת הסשן של האפליקציה, מחיר + צ׳יפ. מימין לשמאל כמו באפליקציה.
 * בהיר/כהה לפי מצב המערכת. נגיעה בכרטיס → האפליקציה על אותה מניה (‎#stock=SYM, openStockFromHash באתר).
 */
class SnowballWidget : GlanceAppWidget() {

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

// הצבעים של העיצוב המאושר (אותם משתנים כמו lib/widget-html.js: --w, --w2, --on, --var …)
private object C {
    val w = ColorProvider(Color(0xFFFFFFFF), Color(0xFF1C1D20))
    val w2 = ColorProvider(Color(0xFFF2F4F3), Color(0xFF26282C))
    val on = ColorProvider(Color(0xFF111413), Color(0xFFF3F5F4))
    val variant = ColorProvider(Color(0xFF5D6561), Color(0xFFA3A9A6))
    val pos = ColorProvider(Color(0xFF16A34A), Color(0xFF34C759))
    val neg = ColorProvider(Color(0xFFDC2626), Color(0xFFFF453A))
    val pill = ColorProvider(Color(0xFFEEF0EF), Color(0xFF2B2D31))
    val posBg = ColorProvider(Color(0x2934C759), Color(0x2934C759))
    val negBg = ColorProvider(Color(0x26FF453A), Color(0x26FF453A))
    val tagBg = ColorProvider(Color(0x24FF453A), Color(0x24FF453A))
    val manBg = ColorProvider(Color(0x2634C759), Color(0x2634C759))
    val white: GColor = ColorProvider(Color.White, Color.White)
    val letter: GColor = ColorProvider(Color(0xFF3A3A3C), Color(0xFF3A3A3C))
    val dot = ColorProvider(Color(0xFF8E9490), Color(0xFF8E9490))
    val btnBorder = ColorProvider(Color(0xFFDFE2E0), Color(0xFF3C3E42))
}

private fun ltr(s: String) = "\u2066$s\u2069"
private fun dirColor(d: Dir) = when (d) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.on }
private fun softColor(d: Dir) = when (d) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.variant }
private fun chipBg(d: Dir) = when (d) { Dir.POS -> C.posBg; Dir.NEG -> C.negBg; Dir.FLAT -> C.pill }

private fun stockIntent(context: Context, sym: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launchUrl) + "#stock=" + Uri.encode(sym)))
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
private fun DRow(d: Dirn, modifier: GlanceModifier = GlanceModifier, parts: List<Part>) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) { d.order(parts).forEach { it() } }
}

@Composable
private fun Content(context: Context, model: WidgetModel?, logos: Map<String, Bitmap?>, updated: Long) {
    val lang = WidgetStore.lang(context)
    val lc = localized(context, lang)
    val d = Dirn(context, lang)
    Box(GlanceModifier.fillMaxSize().background(C.w).cornerRadius(28.dp)) {
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
                LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 10.dp, end = 10.dp)) {
                    items(model.rows, itemId = { it.sym.hashCode().toLong() }) { row ->
                        Column(GlanceModifier.fillMaxWidth().padding(bottom = 6.dp)) { Card(context, lc, d, row, logos[row.sym]) }
                    }
                }
            }
        }
        /* הלוגו של באפט (84dp) — בשכבה מעל הרשימה, עולה ~14dp על הכרטיס הראשון (תצוגה מקדימה ב׳ שאושרה).
           נגיעה בכל הלוגו — גם בחלק שמעל הכרטיס — פותחת את האפליקציה (בקשת המשתמש). רק ריבוע הלוגו לוחץ;
           מחוץ לו הנגיעה עוברת לכרטיס. גלילה שמתחילה על הלוגו לא גוללת (הוא תופס את המגע). */
        Box(GlanceModifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.TopCenter) {
            Image(
                ImageProvider(R.drawable.widget_logo), contentDescription = lc.getString(R.string.app_name),
                modifier = GlanceModifier.size(84.dp).clickable(actionStartActivity<MainActivity>()),
            )
        }
    }
}

/* v228: כותרת — מצד אחד כפתור רענון עגול בסגנון כפתורי ההדר באפליקציה (רקע + מסגרת דקה, אייקון ירוק) ו"עודכן",
   מהצד השני בועת שער הדולר כמו באפליקציה (נקודה + "שער הדולר", מתחת ₪3.06). בועת מצב השוק הוסרה (בקשת המשתמש) —
   מצב המסחר כבר מופיע בבועה של כל כרטיס. תצוגה מקדימה אושרה 28/09/2026. */
@Composable
private fun Header(lc: Context, d: Dirn, fx: Fx?, updated: Long) {
    val time = if (updated <= 0L) "—" else DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(updated))
    Column(GlanceModifier.fillMaxWidth().height(74.dp).padding(start = 14.dp, end = 14.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        DRow(d, GlanceModifier.fillMaxWidth(), listOf(
            {
                // מסגרת דקה: עיגול בצבע המסגרת ובתוכו עיגול הרקע (ל־Glance אין border)
                Box(
                    GlanceModifier.size(34.dp).cornerRadius(17.dp).background(C.btnBorder).padding(1.dp)
                        .clickable(actionRunCallback<RefreshAction>()),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(GlanceModifier.fillMaxSize().cornerRadius(16.dp).background(C.pill), contentAlignment = Alignment.Center) {
                        Image(ImageProvider(R.drawable.ic_widget_refresh), contentDescription = lc.getString(R.string.wRefresh), modifier = GlanceModifier.size(19.dp))
                    }
                }
            },
            { Spacer(GlanceModifier.width(8.dp)) },
            { Text(lc.getString(R.string.wUpdated, time), style = TextStyle(color = C.variant, fontSize = 12.sp), maxLines = 1) },
            { Spacer(GlanceModifier.defaultWeight()) },
            { if (fx != null) FxPill(lc, d, fx) },
        ))
    }
}

@Composable
private fun FxPill(lc: Context, d: Dirn, fx: Fx) {
    val dot = if (!fx.open) C.dot else when (fx.dir) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.dot }
    Column(
        GlanceModifier.cornerRadius(12.dp).background(C.pill).padding(start = 11.dp, end = 11.dp, top = 4.dp, bottom = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        DRow(d, parts = listOf(
            { Box(GlanceModifier.size(6.dp).cornerRadius(3.dp).background(dot)) {} },
            { Spacer(GlanceModifier.width(5.dp)) },
            { Text(lc.getString(R.string.wFx), style = TextStyle(color = C.variant, fontSize = 11.sp, fontWeight = FontWeight.Medium), maxLines = 1) },
        ))
        // "₪3.06" — הסימן קטן מהמספר (כמו .fx-cur באפליקציה), תמיד משמאל: Row מסדר לפי כיוון הטלפון, אז הופכים ב־RTL
        val cur: Part = { Text("₪", style = TextStyle(color = C.variant, fontSize = 11.sp, fontWeight = FontWeight.Medium), maxLines = 1) }
        val num: Part = { Text(fx.value, style = TextStyle(color = C.on, fontSize = 15.sp, fontWeight = FontWeight.Bold), maxLines = 1) }
        Row(verticalAlignment = Alignment.Bottom) { (if (d.rtlPhone) listOf(num, cur) else listOf(cur, num)).forEach { it() } }
    }
}

@Composable
private fun Card(context: Context, lc: Context, d: Dirn, r: WidgetRow, logo: Bitmap?) {
    DRow(
        d,
        GlanceModifier.fillMaxWidth().height(74.dp).cornerRadius(18.dp).background(C.w2)
            .padding(start = 11.dp, end = 11.dp).clickable(actionStartActivity(stockIntent(context, r.sym))),
        listOf(
            {
                Box(GlanceModifier.size(40.dp).cornerRadius(11.dp).background(C.white), contentAlignment = Alignment.Center) {
                    if (logo != null) Image(ImageProvider(logo), contentDescription = null, modifier = GlanceModifier.size(if (r.sym.endsWith(".TA")) 40.dp else 31.dp), contentScale = ContentScale.Fit)
                    else Text(r.disp.take(1), style = TextStyle(color = C.letter, fontSize = 17.sp, fontWeight = FontWeight.Bold))
                }
            },
            { Spacer(GlanceModifier.width(10.dp)) },
            {
                // סימבול + תגית + שם החברה בשורה אחת; מתחת — הבועה של האפליקציה
                Column(GlanceModifier.defaultWeight(), horizontalAlignment = d.s) {
                    DRow(d, GlanceModifier.fillMaxWidth(), listOf(
                        { Text(ltr(r.disp), style = TextStyle(color = C.on, fontSize = 17.sp, fontWeight = FontWeight.Bold), maxLines = 1) },
                        { Spacer(GlanceModifier.width(6.dp)) },
                        { Tag(lc, r.src) },
                        { Spacer(GlanceModifier.width(6.dp)) },
                        { Text(r.name, modifier = GlanceModifier.defaultWeight(), style = TextStyle(color = C.variant, fontSize = 12.5.sp, textAlign = d.ts), maxLines = 1) },
                    ))
                    val b = r.bubble
                    if (b != null) {
                        Spacer(GlanceModifier.height(4.dp))
                        SessionBubble(d, b)
                    } else if (r.sub.isNotEmpty()) { // שרתון ישן בלי bubble
                        Spacer(GlanceModifier.height(4.dp))
                        Text(r.sub + (if (r.subPct.isNotEmpty()) " " + ltr(r.subPct) else ""), style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1)
                    }
                }
            },
            { Spacer(GlanceModifier.width(10.dp)) },
            {
                Column(horizontalAlignment = d.e) {
                    Text(ltr(r.price), style = TextStyle(color = C.on, fontSize = 19.sp, fontWeight = FontWeight.Bold), maxLines = 1)
                    Spacer(GlanceModifier.height(5.dp))
                    if (r.chg.isNotEmpty()) Box(GlanceModifier.cornerRadius(9.dp).background(chipBg(r.dir)).padding(start = 7.dp, end = 7.dp, top = 2.dp, bottom = 2.dp)) {
                        Text(ltr(r.chg), style = TextStyle(color = dirColor(r.dir), fontSize = 12.sp, fontWeight = FontWeight.Bold), maxLines = 1)
                    }
                }
            },
        ),
    )
}

/** הבועה — כמו .ext-sess באפליקציה, מותאמת לגודל: סגור = שתי שורות על רקע אפור; מסחר מורחב = שורה אחת צבעונית */
@Composable
private fun SessionBubble(d: Dirn, b: Bubble) {
    if (b.closed) {
        Column(GlanceModifier.cornerRadius(10.dp).background(C.pill).padding(start = 7.dp, end = 7.dp, top = 3.dp, bottom = 3.dp), horizontalAlignment = d.s) {
            DRow(d, parts = listOf(
                { Box(GlanceModifier.size(6.dp).cornerRadius(3.dp).background(C.dot)) {} },
                { Spacer(GlanceModifier.width(4.dp)) },
                { Text(b.l1, style = TextStyle(color = C.variant, fontSize = 10.5.sp, fontWeight = FontWeight.Medium), maxLines = 1) },
            ))
            if (b.l2.isNotEmpty() || b.pct.isNotEmpty()) DRow(d, parts = listOf(
                { Text(b.l2, style = TextStyle(color = C.variant, fontSize = 10.5.sp, fontWeight = FontWeight.Medium), maxLines = 1) },
                { Spacer(GlanceModifier.width(4.dp)) },
                { Text(ltr(b.pct), style = TextStyle(color = softColor(b.dir), fontSize = 10.5.sp, fontWeight = FontWeight.Bold), maxLines = 1) },
            ))
        }
    } else {
        DRow(d, GlanceModifier.cornerRadius(10.dp).background(C.pill).padding(start = 9.dp, end = 9.dp, top = 3.dp, bottom = 3.dp), listOf(
            { Box(GlanceModifier.size(6.dp).cornerRadius(3.dp).background(softColor(b.dir))) {} },
            { Spacer(GlanceModifier.width(5.dp)) },
            { Text(b.l1, style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) },
            { Spacer(GlanceModifier.width(5.dp)) },
            { Text(ltr(b.pct), style = TextStyle(color = softColor(b.dir), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1) },
        ))
    }
}

@Composable
private fun Tag(lc: Context, src: Src) {
    when (src) {
        Src.IBKR -> Box(GlanceModifier.height(18.dp).width(25.dp).cornerRadius(9.dp).background(C.tagBg), contentAlignment = Alignment.Center) {
            Image(ImageProvider(R.drawable.tag_ibkr), contentDescription = "IBKR", modifier = GlanceModifier.size(12.dp))
        }
        Src.MANUAL -> Box(GlanceModifier.height(18.dp).cornerRadius(9.dp).background(C.manBg).padding(start = 5.dp, end = 5.dp), contentAlignment = Alignment.Center) {
            Text(lc.getString(R.string.wManual), style = TextStyle(color = C.pos, fontSize = 10.sp, fontWeight = FontWeight.Bold))
        }
        // v249: פריטי מעקב מופיעים רק בווידג'ט "רשימות מעקב" — שם כל השורות ממעקב, בלי תגית (רעש)
        Src.WATCH -> {}
    }
}


/* ---------------- v249: ווידג'ט "רשימות מעקב" ----------------
   ווידג'ט נפרד מהתיק (בקשת המשתמש): אותה כותרת, אותו לוגו ואותם כרטיסים, ומתחת לכותרת טאבים — אחד לכל רשימה,
   כמו בטאב המעקב באפליקציה. נגיעה בטאב מחליפה את הרשימה בווידג'ט הזה בלבד (כל ווידג'ט זוכר את שלו) —
   אפשר לשים כמה ווידג'טים, כל אחד על רשימה אחרת. יותר מ־3 רשימות: חלון של 3 טאבים + חצים. */
class SnowballWatchWidget : GlanceAppWidget() {
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
        updateAppWidgetState(context, glanceId) { it[SnowballWatchWidget.KEY_LIST] = id }
        SnowballWatchWidget().update(context, glanceId)
        if (WidgetStore.watchModel(context, id) == null) WidgetRefresh.now(context)
    }
}

@Composable
private fun WatchContent(context: Context, lists: List<WatchList>, sel: WatchList?, model: WidgetModel?, logos: Map<String, Bitmap?>, updated: Long) {
    val lang = WidgetStore.lang(context)
    val lc = localized(context, lang)
    val d = Dirn(context, lang)
    Box(GlanceModifier.fillMaxSize().background(C.w).cornerRadius(28.dp)) {
        Column(GlanceModifier.fillMaxSize()) {
            Header(lc, d, model?.fx, updated)
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
                LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 10.dp, end = 10.dp)) {
                    items(model.rows, itemId = { it.sym.hashCode().toLong() }) { row ->
                        Column(GlanceModifier.fillMaxWidth().padding(bottom = 6.dp)) { Card(context, lc, d, row, logos[row.sym]) }
                    }
                }
            }
        }
        Box(GlanceModifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.TopCenter) {
            Image(
                ImageProvider(R.drawable.widget_logo), contentDescription = lc.getString(R.string.app_name),
                modifier = GlanceModifier.size(84.dp).clickable(actionStartActivity<MainActivity>()),
            )
        }
    }
}

/* הטאבים: גלולות שממלאות את הרוחב (כמו segmented control של Apple), הנבחר ירוק מלא (כמו הצ'יפים באפליקציה).
   עד 3 גלויים; יותר — חלון סביב הנבחר עם ‹ › לרשימה הקודמת/הבאה. מתחת ללוגו (שעולה ~14dp מתחת לכותרת). */
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
        if (k > 0 || start > 0) parts += { Spacer(GlanceModifier.width(6.dp)) }
        parts += { TabChip(l, l.id == (sel?.id ?: lists.first().id)) }
    }
    if (start + max < lists.size) {
        parts += { Spacer(GlanceModifier.width(6.dp)) }
        parts += { TabArrow(if (rtl) "‹" else "›", lists[start + max].id) }
    }
    DRow(d, GlanceModifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 8.dp), parts)
}

@Composable
private fun RowScope.TabChip(l: WatchList, on: Boolean) {
    Box(
        GlanceModifier.defaultWeight().height(32.dp).cornerRadius(16.dp).background(if (on) C.pos else C.pill)
            .clickable(actionRunCallback<SelectListAction>(actionParametersOf(LIST_PARAM to l.id))),
        contentAlignment = Alignment.Center,
    ) {
        Text(l.name, modifier = GlanceModifier.padding(start = 8.dp, end = 8.dp),
            style = TextStyle(color = if (on) C.white else C.on, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center), maxLines = 1)
    }
}

@Composable
private fun TabArrow(glyph: String, target: String) {
    Box(
        GlanceModifier.size(32.dp).cornerRadius(16.dp).background(C.pill)
            .clickable(actionRunCallback<SelectListAction>(actionParametersOf(LIST_PARAM to target))),
        contentAlignment = Alignment.Center,
    ) {
        Text(glyph, style = TextStyle(color = C.pos, fontSize = 18.sp, fontWeight = FontWeight.Bold), maxLines = 1)
    }
}
