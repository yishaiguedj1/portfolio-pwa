package io.github.yishaiguedj1.snowball

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
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
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import java.util.Locale
import kotlin.math.roundToInt

/*
 * ווידג'ט מדדי השרתים (מרכז הניהול). שורה לכל שרת: נקודת מצב, שם, מצב; מתחתיה מעבד/זיכרון/דיסק ורשת.
 * צבע הנקודה: אפור = מושהה, אדום = לא מחובר, כתום = אזהרה (מעבד/זיכרון/דיסק/לחץ), ירוק = תקין.
 * כיוון: הטלפון קובע את כיוון הפריסה (השפה), ולכן אין הפיכת סדר ידנית כמו ב־Invest — הממשק בעברית או אנגלית לפי השפה.
 */
class MonWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            currentState<Preferences>()[KEY_STAMP] // קריאה = ציור מחדש בכל רענון (MonRefresh.repaint)
            MonContent(
                context = context,
                hasToken = MonStore.token(context).isNotEmpty(),
                authBad = MonStore.authBad(context),
                snap = MonParse.parse(MonStore.model(context)),
                updated = MonStore.updated(context),
            )
        }
    }

    companion object {
        val KEY_STAMP = longPreferencesKey("stamp")
    }
}

class MonWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MonWidget()

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        MonRefresh.ensurePeriodic(context)
        MonRefresh.now(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // עוצרים את הרענון רק כשלא נשאר ווידג'ט מרכז הניהול על המסך
        if (AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, MonWidgetReceiver::class.java)).isEmpty()) {
            MonRefresh.stopAll(context)
        }
    }
}

/** ↻ — רענון מיידי */
class MonRefreshAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        MonRefresh.now(context)
    }
}

// צבעים: בהיר/כהה לפי מצב המערכת; הירוק = צבע האפליקציה (#30D158)
private object C {
    val bg = ColorProvider(Color(0xFFF2F2F7), Color(0xFF000000))
    val chip = ColorProvider(Color(0xFFFFFFFF), Color(0xFF1C1C1E))
    val on = ColorProvider(Color(0xFF111413), Color(0xFFF3F5F4))
    val variant = ColorProvider(Color(0xFF5D6561), Color(0xFFA3A9A6))
    val primary = ColorProvider(Color(0xFF30D158), Color(0xFF30D158))
    val pos = ColorProvider(Color(0xFF16A34A), Color(0xFF34C759))
    val warn = ColorProvider(Color(0xFFD97706), Color(0xFFFF9F0A))
    val neg = ColorProvider(Color(0xFFDC2626), Color(0xFFFF453A))
    val dot = ColorProvider(Color(0xFF8E9490), Color(0xFF8E9490))
}

// ספרות ומספרים בתוך טקסט עברי: בידוד LTR כדי שלא יתהפכו (כמו ltrNum באפליקציה)
private fun ltr(s: String) = "⁦$s⁩"

@Composable
private fun MonContent(context: Context, hasToken: Boolean, authBad: Boolean, snap: MonSnap?, updated: Long) {
    Box(GlanceModifier.fillMaxSize().background(C.bg).cornerRadius(24.dp)) {
        Column(GlanceModifier.fillMaxSize().padding(12.dp)) {
            Header(context, updated)
            when {
                !hasToken -> Hint(context.getString(R.string.mon_no_token), openConfig = true)
                authBad -> Hint(context.getString(R.string.mon_auth_bad), openConfig = true)
                snap == null -> Hint(context.getString(R.string.mon_loading), openConfig = false)
                snap.servers.isEmpty() -> Hint(context.getString(R.string.mon_no_servers), openConfig = false)
                else -> LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
                    items(snap.servers, itemId = { it.id.hashCode().toLong() }) { s -> ServerRow(context, s) }
                }
            }
        }
    }
}

@Composable
private fun Header(context: Context, updated: Long) {
    Row(GlanceModifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            context.getString(R.string.mon_title),
            style = TextStyle(color = C.on, fontSize = 14.sp, fontWeight = FontWeight.Bold),
            maxLines = 1,
        )
        Spacer(GlanceModifier.width(8.dp))
        Text(
            if (updated <= 0L) context.getString(R.string.mon_never) else context.getString(R.string.mon_updated, ago(context, updated)),
            style = TextStyle(color = C.variant, fontSize = 11.sp),
            maxLines = 1,
        )
        Spacer(GlanceModifier.defaultWeight())
        Box(
            GlanceModifier.size(28.dp).cornerRadius(14.dp).background(C.chip).clickable(actionRunCallback<MonRefreshAction>()),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                ImageProvider(R.drawable.ic_widget_refresh),
                contentDescription = context.getString(R.string.mon_refresh),
                modifier = GlanceModifier.size(16.dp),
            )
        }
        Text(
            context.getString(R.string.mon_settings),
            style = TextStyle(color = C.primary, fontSize = 12.sp),
            modifier = GlanceModifier.padding(start = 10.dp).clickable(actionStartActivity<MonConfigActivity>()),
            maxLines = 1,
        )
    }
}

/** הודעה במקום הרשימה. openConfig = נגיעה פותחת את מסך הטוקן */
@Composable
private fun ColumnScope.Hint(text: String, openConfig: Boolean) {
    val mod = if (openConfig) GlanceModifier.fillMaxWidth().defaultWeight().clickable(actionStartActivity<MonConfigActivity>())
    else GlanceModifier.fillMaxWidth().defaultWeight()
    Box(mod, contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(color = C.variant, fontSize = 13.sp, textAlign = TextAlign.Center))
    }
}

@Composable
private fun ServerRow(context: Context, s: MonServer) {
    val dot = when {
        s.paused -> C.dot
        !s.online -> C.neg
        s.warn.isNotEmpty() -> C.warn
        else -> C.pos
    }
    Column(GlanceModifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(GlanceModifier.size(8.dp).cornerRadius(4.dp).background(dot)) {}
            Spacer(GlanceModifier.width(6.dp))
            Text(s.name, style = TextStyle(color = C.on, fontSize = 13.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            Spacer(GlanceModifier.defaultWeight())
            Text(statusText(context, s), style = TextStyle(color = dot, fontSize = 11.sp), maxLines = 1)
        }
        Text(line1(context, s), style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1)
        val hb = s.hb
        if (s.online && hb != null) {
            Text(
                context.getString(R.string.mon_net, rate(hb.rx), rate(hb.tx)),
                style = TextStyle(color = C.variant, fontSize = 11.sp),
                maxLines = 1,
            )
        }
    }
}

private fun statusText(c: Context, s: MonServer): String = when {
    s.paused -> c.getString(R.string.mon_st_paused)
    !s.online -> c.getString(R.string.mon_st_off)
    s.warn.isNotEmpty() -> c.getString(R.string.mon_st_warn, s.warn.joinToString(", ") { warnName(c, it) })
    s.hb?.busy?.isNotEmpty() == true -> c.getString(R.string.mon_st_busy)
    else -> c.getString(R.string.mon_st_on)
}

private fun warnName(c: Context, code: String): String = when (code) {
    "cu" -> c.getString(R.string.mon_w_cu)
    "mem" -> c.getString(R.string.mon_w_mem)
    "disk" -> c.getString(R.string.mon_w_disk)
    "psi" -> c.getString(R.string.mon_w_psi)
    else -> code
}

/** שורה ראשונה: במצב לא מחובר — מתי נראה לאחרונה; בלי מדדים — הודעה; אחרת אחוזי המעבד/זיכרון/דיסק */
private fun line1(c: Context, s: MonServer): String {
    val hb = s.hb
    return when {
        !s.online -> if (s.seen <= 0L) c.getString(R.string.mon_never) else c.getString(R.string.mon_seen, ago(c, s.seen * 1000))
        hb == null -> c.getString(R.string.mon_no_data)
        else -> c.getString(R.string.mon_metrics, pct(hb.cu), pct(hb.mem), pct(hb.disk))
    }
}

private fun pct(v: Double): String = if (v.isNaN()) "—" else ltr("${v.roundToInt()}%")

private fun rate(v: Double): String = when {
    v.isNaN() -> "—"
    v >= 1_000_000 -> ltr(String.format(Locale.ROOT, "%.1f MB/s", v / 1_000_000))
    else -> ltr("${(v / 1_000).roundToInt()} KB/s")
}

/** "עכשיו" / "לפני 5 דק׳" / "לפני 3 שע׳" / "לפני 2 ימים" — לפי השעון של הטלפון, מ־ms */
private fun ago(c: Context, ms: Long): String {
    val m = ((System.currentTimeMillis() - ms) / 60_000L).coerceAtLeast(0L)
    return when {
        m < 1L -> c.getString(R.string.mon_now)
        m < 60L -> c.getString(R.string.mon_ago_m, m.toInt())
        m < 48L * 60L -> c.getString(R.string.mon_ago_h, (m / 60L).toInt())
        else -> c.getString(R.string.mon_ago_d, (m / 1440L).toInt())
    }
}
