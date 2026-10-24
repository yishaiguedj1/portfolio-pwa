package io.github.yishaiguedj1.snowball

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
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
import androidx.glance.layout.height
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
 * ווידג'ט מדדי השרתים (מרכז הניהול). 24/10/2026 — עיצוב חדש (בקשת המשתמש: "נקי כמו Apple, כתב קריא"):
 * לכל שרת שם ומצב, ומתחתיהם שלושה מדדים גדולים (מעבד, זיכרון, דיסק) עם פס דק, ושורה קטנה של רשת ומקום פנוי.
 * צבע הנקודה: אפור = מושהה, אדום = לא מחובר, כתום = אזהרה (מעבד/זיכרון/דיסק/לחץ), ירוק = תקין.
 * כיוון: הטלפון קובע את כיוון הפריסה (השפה), ולכן אין הפיכת סדר ידנית כמו ב־Invest — הממשק בעברית או אנגלית לפי השפה.
 */
class MonWidget : GlanceAppWidget() {

    // הגודל האמיתי — כדי לוותר על שורות משניות כשהווידג'ט נמוך (4×2)
    override val sizeMode: SizeMode = SizeMode.Exact

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

// צבעים: בהיר/כהה לפי מצב המערכת — הצבעים של iOS (רקע, טקסט משני, ירוק/כתום/אדום של המערכת)
private object C {
    val bg = ColorProvider(Color(0xFFFFFFFF), Color(0xFF1C1C1E))
    val chip = ColorProvider(Color(0xFFF2F2F7), Color(0xFF2C2C2E))
    val track = ColorProvider(Color(0x1F3C3C43), Color(0x33EBEBF5))
    val line = ColorProvider(Color(0x1A3C3C43), Color(0x26EBEBF5))
    val on = ColorProvider(Color(0xFF000000), Color(0xFFFFFFFF))
    val variant = ColorProvider(Color(0xFF6C6C70), Color(0xFF98989F))
    val pos = ColorProvider(Color(0xFF248A3D), Color(0xFF30D158))
    val warn = ColorProvider(Color(0xFFC93400), Color(0xFFFF9F0A))
    val neg = ColorProvider(Color(0xFFD70015), Color(0xFFFF453A))
    val dot = ColorProvider(Color(0xFF8E8E93), Color(0xFF8E8E93))
    val cpu = ColorProvider(Color(0xFF007AFF), Color(0xFF0A84FF))
    val mem = ColorProvider(Color(0xFF5856D6), Color(0xFF5E5CE6))
    val disk = ColorProvider(Color(0xFF34C759), Color(0xFF30D158))
}

// ספרות ומספרים בתוך טקסט עברי: בידוד LTR כדי שלא יתהפכו (כמו ltrNum באפליקציה)
private fun ltr(s: String) = "\u2066$s\u2069"

@Composable
private fun MonContent(context: Context, hasToken: Boolean, authBad: Boolean, snap: MonSnap?, updated: Long) {
    val compact = LocalSize.current.height < 170.dp
    Box(GlanceModifier.fillMaxSize().background(C.bg).cornerRadius(22.dp)) {
        Column(GlanceModifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp)) {
            Header(context, updated)
            when {
                !hasToken -> Hint(context.getString(R.string.mon_no_token), openConfig = true)
                authBad -> Hint(context.getString(R.string.mon_auth_bad), openConfig = true)
                snap == null -> Hint(context.getString(R.string.mon_loading), openConfig = false)
                snap.servers.isEmpty() -> Hint(context.getString(R.string.mon_no_servers), openConfig = false)
                else -> LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
                    items(snap.servers, itemId = { it.id.hashCode().toLong() }) { s ->
                        ServerBlock(context, s, compact, first = s === snap.servers.first())
                    }
                }
            }
        }
    }
}

/** פתיחת האפליקציה (מרכז הניהול) מנגיעה בכותרת */
private fun openApp(c: Context): Intent =
    (c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

@Composable
private fun Header(context: Context, updated: Long) {
    Row(GlanceModifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(GlanceModifier.defaultWeight().clickable(actionStartActivity(openApp(context)))) {
            Text(
                context.getString(R.string.mon_title),
                style = TextStyle(color = C.on, fontSize = 17.sp, fontWeight = FontWeight.Bold),
                maxLines = 1,
            )
            Text(
                if (updated <= 0L) context.getString(R.string.mon_never) else context.getString(R.string.mon_updated, ago(context, updated)),
                style = TextStyle(color = C.variant, fontSize = 12.sp),
                maxLines = 1,
            )
        }
        IconBtn(R.drawable.ic_widget_refresh, context.getString(R.string.mon_refresh), actionRunCallback<MonRefreshAction>())
        Spacer(GlanceModifier.width(8.dp))
        IconBtn(R.drawable.ic_widget_settings, context.getString(R.string.mon_settings), actionStartActivity<MonConfigActivity>())
    }
}

@Composable
private fun IconBtn(icon: Int, desc: String, action: androidx.glance.action.Action) {
    Box(
        GlanceModifier.size(32.dp).cornerRadius(16.dp).background(C.chip).clickable(action),
        contentAlignment = Alignment.Center,
    ) {
        Image(ImageProvider(icon), contentDescription = desc, modifier = GlanceModifier.size(17.dp))
    }
}

/** הודעה במקום הרשימה. openConfig = נגיעה פותחת את מסך הטוקן */
@Composable
private fun ColumnScope.Hint(text: String, openConfig: Boolean) {
    val mod = if (openConfig) GlanceModifier.fillMaxWidth().defaultWeight().clickable(actionStartActivity<MonConfigActivity>())
    else GlanceModifier.fillMaxWidth().defaultWeight()
    Box(mod, contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(color = C.variant, fontSize = 15.sp, textAlign = TextAlign.Center))
    }
}

@Composable
private fun ServerBlock(context: Context, s: MonServer, compact: Boolean, first: Boolean) {
    val tone = when {
        s.paused -> C.dot
        !s.online -> C.neg
        s.warn.isNotEmpty() -> C.warn
        else -> C.pos
    }
    Column(GlanceModifier.fillMaxWidth()) {
        if (!first) Box(GlanceModifier.fillMaxWidth().height(1.dp).background(C.line)) {}
        Spacer(GlanceModifier.height(10.dp))
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(GlanceModifier.size(9.dp).cornerRadius(5.dp).background(tone)) {}
            Spacer(GlanceModifier.width(7.dp))
            Text(
                s.name, style = TextStyle(color = C.on, fontSize = 15.sp, fontWeight = FontWeight.Medium),
                maxLines = 1, modifier = GlanceModifier.defaultWeight(),
            )
            Text(statusText(context, s), style = TextStyle(color = tone, fontSize = 13.sp, fontWeight = FontWeight.Medium), maxLines = 1)
        }
        val hb = s.hb
        if (!s.online || hb == null) {
            Text(
                line1(context, s), style = TextStyle(color = C.variant, fontSize = 13.sp),
                maxLines = 1, modifier = GlanceModifier.padding(top = 4.dp, bottom = 8.dp),
            )
            return@Column
        }
        Spacer(GlanceModifier.height(8.dp))
        Row(GlanceModifier.fillMaxWidth()) {
            Metric(context.getString(R.string.mon_l_cu), hb.cu, "cu" in s.warn, C.cpu, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(14.dp))
            Metric(context.getString(R.string.mon_l_mem), hb.mem, "mem" in s.warn, C.mem, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(14.dp))
            Metric(context.getString(R.string.mon_l_disk), hb.disk, "disk" in s.warn, C.disk, GlanceModifier.defaultWeight())
        }
        if (!compact) {
            val parts = mutableListOf(context.getString(R.string.mon_net, rate(hb.rx), rate(hb.tx)))
            if (!hb.free.isNaN()) parts += context.getString(R.string.mon_free, ltr("${hb.free.roundToInt()}GB"))
            Text(
                parts.joinToString("  ·  "), style = TextStyle(color = C.variant, fontSize = 12.sp),
                maxLines = 1, modifier = GlanceModifier.padding(top = 8.dp),
            )
        }
        Spacer(GlanceModifier.height(10.dp))
    }
}

/** מדד אחד: הערך בגדול, השם מתחתיו ופס דק. חורג מהסף = כתום */
@Composable
private fun Metric(label: String, v: Double, warn: Boolean, color: androidx.glance.unit.ColorProvider, mod: GlanceModifier) {
    Column(mod) {
        Text(
            pct(v), style = TextStyle(color = if (warn) C.warn else C.on, fontSize = 22.sp, fontWeight = FontWeight.Bold),
            maxLines = 1,
        )
        Text(label, style = TextStyle(color = C.variant, fontSize = 12.sp), maxLines = 1)
        Spacer(GlanceModifier.height(5.dp))
        LinearProgressIndicator(
            progress = if (v.isNaN()) 0f else (v / 100.0).toFloat().coerceIn(0f, 1f),
            modifier = GlanceModifier.fillMaxWidth().height(4.dp).cornerRadius(2.dp),
            color = if (warn) C.warn else color,
            backgroundColor = C.track,
        )
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

/** שרת שלא מדווח — מתי נראה לאחרונה (seen במילישניות, כמו בשרתון); בלי מדדים — הודעה */
private fun line1(c: Context, s: MonServer): String = when {
    !s.online -> if (s.seen <= 0L) c.getString(R.string.mon_never) else c.getString(R.string.mon_seen, ago(c, s.seen))
    else -> c.getString(R.string.mon_no_data)
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
