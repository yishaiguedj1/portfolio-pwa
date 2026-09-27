package io.github.yishaiguedj1.snowball

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
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

/**
 * הווידג'ט למסך הבית — גרסה B שאושרה (תצוגה מקדימה native-1): כותרת קבועה עם הלוגו 84dp במרכז, "עודכן" + ↻
 * בצד ההתחלה, בועת מצב השוק בצד הסוף; מתחת — כל התיק ברשימה שנגללת, כרטיס 70dp לכל מניה.
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
        WidgetRefresh.stopAll(context)
    }
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
}

private fun ltr(s: String) = "⁦$s⁩"
private fun dirColor(d: Dir) = when (d) { Dir.POS -> C.pos; Dir.NEG -> C.neg; Dir.FLAT -> C.on }
private fun chipBg(d: Dir) = when (d) { Dir.POS -> C.posBg; Dir.NEG -> C.negBg; Dir.FLAT -> C.pill }

private fun stockIntent(context: Context, sym: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launchUrl) + "#stock=" + Uri.encode(sym)))
        .setClass(context, MainActivity::class.java)

@Composable
private fun Content(context: Context, model: WidgetModel?, logos: Map<String, Bitmap?>, updated: Long) {
    Column(GlanceModifier.fillMaxSize().background(C.w).cornerRadius(28.dp)) {
        Header(context, model?.header, updated)
        if (model == null || model.rows.isEmpty()) {
            // עוד לא הגיעה רשימה מהאפליקציה (או שהשרתון לא ענה בפעם הראשונה)
            Box(
                GlanceModifier.fillMaxWidth().defaultWeight().padding(16.dp).clickable(actionStartActivity<MainActivity>()),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    context.getString(if (WidgetStore.items(context).isEmpty()) R.string.wEmpty else R.string.wLoading),
                    style = TextStyle(color = C.variant, fontSize = 14.sp, textAlign = TextAlign.Center),
                )
            }
            return@Column
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 10.dp, end = 10.dp)) {
            items(model.rows, itemId = { it.sym.hashCode().toLong() }) { row ->
                Column(GlanceModifier.fillMaxWidth().padding(bottom = 6.dp)) { Card(context, row, logos[row.sym]) }
            }
        }
    }
}

@Composable
private fun Header(context: Context, h: WidgetHeader?, updated: Long) {
    val time = if (updated <= 0L) "—" else DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(updated))
    Box(GlanceModifier.fillMaxWidth().height(96.dp), contentAlignment = Alignment.Center) {
        Column(GlanceModifier.fillMaxSize().padding(start = 14.dp, end = 14.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
            Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    GlanceModifier.size(30.dp).cornerRadius(15.dp).background(C.pill).clickable(actionRunCallback<RefreshAction>()),
                    contentAlignment = Alignment.Center,
                ) { Text("↻", style = TextStyle(color = C.on, fontSize = 16.sp, fontWeight = FontWeight.Bold)) }
                Spacer(GlanceModifier.width(6.dp))
                Text(context.getString(R.string.wUpdated, time), style = TextStyle(color = C.variant, fontSize = 11.5.sp), maxLines = 1)
                Spacer(GlanceModifier.defaultWeight())
                if (h != null && h.lines.isNotEmpty()) Row(
                    GlanceModifier.cornerRadius(12.dp).background(C.pill).padding(start = 9.dp, end = 9.dp, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(GlanceModifier.size(7.dp).cornerRadius(4.dp).background(if (h.live) C.pos else C.dot)) {}
                    Spacer(GlanceModifier.width(5.dp))
                    Text(h.lines.joinToString(" "), style = TextStyle(color = C.variant, fontSize = 10.5.sp), maxLines = 1)
                }
            }
        }
        // הלוגו מעל השורה — נגיעה בו פותחת את האפליקציה
        Image(
            ImageProvider(R.drawable.widget_logo), contentDescription = context.getString(R.string.app_name),
            modifier = GlanceModifier.size(84.dp).clickable(actionStartActivity<MainActivity>()),
        )
    }
}

@Composable
private fun Card(context: Context, r: WidgetRow, logo: Bitmap?) {
    Row(
        GlanceModifier.fillMaxWidth().height(70.dp).cornerRadius(18.dp).background(C.w2)
            .padding(start = 11.dp, end = 11.dp).clickable(actionStartActivity(stockIntent(context, r.sym))),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(GlanceModifier.size(38.dp).cornerRadius(11.dp).background(C.white), contentAlignment = Alignment.Center) {
            if (logo != null) Image(ImageProvider(logo), contentDescription = null, modifier = GlanceModifier.size(30.dp), contentScale = ContentScale.Fit)
            else Text(r.disp.take(1), style = TextStyle(color = C.letter, fontSize = 17.sp, fontWeight = FontWeight.Bold))
        }
        Spacer(GlanceModifier.width(10.dp))
        Column(GlanceModifier.defaultWeight()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(ltr(r.disp), style = TextStyle(color = C.on, fontSize = 16.5.sp, fontWeight = FontWeight.Bold), maxLines = 1)
                Spacer(GlanceModifier.width(6.dp))
                Tag(context, r.src)
            }
            Text(r.name, style = TextStyle(color = C.variant, fontSize = 12.sp), maxLines = 1)
            if (r.sub.isNotEmpty()) Row {
                Text(r.sub, style = TextStyle(color = C.variant, fontSize = 10.5.sp), maxLines = 1)
                if (r.subPct.isNotEmpty()) Text(" " + ltr(r.subPct), style = TextStyle(color = dirColor(r.subDir), fontSize = 10.5.sp), maxLines = 1)
            }
        }
        Spacer(GlanceModifier.width(10.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(ltr(r.price), style = TextStyle(color = C.on, fontSize = 19.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            Spacer(GlanceModifier.height(4.dp))
            if (r.chg.isNotEmpty()) Box(GlanceModifier.cornerRadius(9.dp).background(chipBg(r.dir)).padding(start = 7.dp, end = 7.dp, top = 2.dp, bottom = 2.dp)) {
                Text(ltr(r.chg), style = TextStyle(color = dirColor(r.dir), fontSize = 12.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            }
        }
    }
}

@Composable
private fun Tag(context: Context, src: Src) {
    when (src) {
        Src.IBKR -> Box(GlanceModifier.height(18.dp).width(25.dp).cornerRadius(9.dp).background(C.tagBg), contentAlignment = Alignment.Center) {
            Image(ImageProvider(R.drawable.tag_ibkr), contentDescription = "IBKR", modifier = GlanceModifier.size(12.dp))
        }
        Src.MANUAL -> Box(GlanceModifier.height(18.dp).cornerRadius(9.dp).background(C.manBg).padding(start = 5.dp, end = 5.dp), contentAlignment = Alignment.Center) {
            Text(context.getString(R.string.wManual), style = TextStyle(color = C.pos, fontSize = 10.sp, fontWeight = FontWeight.Bold))
        }
    }
}
