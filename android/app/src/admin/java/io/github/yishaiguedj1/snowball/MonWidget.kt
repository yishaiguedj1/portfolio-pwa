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
 * ווידג'ט מדדי השרתים (מרכז הניהול). 26/10/2026 — עיצוב 2 (בקשת המשתמש: "כמה שיותר מידע, נקי לפי ת־עיצוב, הכי קטן שאפשר",
 * התצוגה המקדימה שאושרה): 4×2 משבצות. שרת אחד — שורת מצב (נקודה, שם, מה עושה עכשיו: שלב העבודה ואחוז / פנוי / חורג /
 * דיסק מלא, מתי עודכן, ↻), ארבעה מדדים (מעבד, זיכרון, דיסק, רשת) עם פס דק, ושורת תחתית: R2, צפי לחודש, Drive, פנוי, זמן פעולה.
 * כמה שרתים — טבלה: שורה לכל שרת. ההגדרות — בלחיצה ארוכה על הווידג'ט (reconfigurable); נגיעה בשם פותחת את מרכז הניהול.
 * צבע הנקודה: אפור = מושהה, אדום = לא מחובר, כתום = חריגה / דיסק מלא, ירוק = תקין.
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

// צבעים: בהיר/כהה לפי מצב המערכת — הצבעים של iOS (רקע, טקסט משני, ירוק/כתום/אדום וצבעי המדדים של המערכת)
private object C {
    val bg = ColorProvider(Color(0xFFFFFFFF), Color(0xFF1C1C1E))
    val track = ColorProvider(Color(0x1F3C3C43), Color(0x33EBEBF5))
    val on = ColorProvider(Color(0xFF000000), Color(0xFFFFFFFF))
    val variant = ColorProvider(Color(0xFF6C6C70), Color(0xFF98989F))
    val pos = ColorProvider(Color(0xFF248A3D), Color(0xFF30D158))
    val warn = ColorProvider(Color(0xFFC93400), Color(0xFFFF9F0A))
    val neg = ColorProvider(Color(0xFFD70015), Color(0xFFFF453A))
    val dot = ColorProvider(Color(0xFF8E8E93), Color(0xFF8E8E93))
    val cpu = ColorProvider(Color(0xFF007AFF), Color(0xFF0A84FF))
    val mem = ColorProvider(Color(0xFF5856D6), Color(0xFF5E5CE6))
    val disk = ColorProvider(Color(0xFF34C759), Color(0xFF30D158))
    val net = ColorProvider(Color(0xFFFF9500), Color(0xFFFF9F0A))
}
private typealias Tone = androidx.glance.unit.ColorProvider

// ספרות ומספרים בתוך טקסט עברי: בידוד LTR כדי שלא יתהפכו (כמו ltrNum באפליקציה)
private fun ltr(s: String) = "⁦$s⁩"

@Composable
private fun MonContent(context: Context, hasToken: Boolean, authBad: Boolean, snap: MonSnap?, updated: Long) {
    val size = LocalSize.current
    Box(GlanceModifier.fillMaxSize().background(C.bg).cornerRadius(22.dp)) {
        Column(GlanceModifier.fillMaxSize().padding(horizontal = 13.dp, vertical = 11.dp)) {
            when {
                !hasToken -> Hint(context, context.getString(R.string.mon_no_token), updated, openConfig = true)
                authBad -> Hint(context, context.getString(R.string.mon_auth_bad), updated, openConfig = true)
                snap == null -> Hint(context, context.getString(R.string.mon_loading), updated, openConfig = false)
                snap.servers.isEmpty() -> Hint(context, context.getString(R.string.mon_no_servers), updated, openConfig = false)
                snap.servers.size == 1 -> One(context, snap, snap.servers[0], updated, size.height >= 118.dp, size.width >= 300.dp)
                else -> Many(context, snap, updated, size.height >= 118.dp)
            }
        }
    }
}

/** פתיחת האפליקציה (מרכז הניהול) מנגיעה בשם */
private fun openApp(c: Context): Intent =
    (c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

/** מצב השרת: הצבע והטקסט. מה שהוא עושה עכשיו — השלב והאחוז של העבודה שרצה בו (mon.jobs לפי sid) */
private class St(val tone: Tone, val text: String)

private fun stateOf(c: Context, s: MonServer, jobs: List<MonJob>): St {
    val mine = jobs.filter { it.sid == s.id }
    val hb = s.hb
    return when {
        s.paused -> St(C.dot, c.getString(R.string.mon_st_paused))
        !s.online -> St(C.neg, if (s.seen <= 0L) c.getString(R.string.mon_st_off) else c.getString(R.string.mon_st_off_ago, ago(c, s.seen)))
        hb?.dl == true -> St(C.warn, c.getString(R.string.mon_st_disk_low))
        s.warn.isNotEmpty() -> St(C.warn, c.getString(R.string.mon_st_warn, s.warn.joinToString(", ") { warnName(c, it) }))
        mine.isNotEmpty() -> {
            val j = mine[0]
            val stg = stageName(c, j.st)
            val p = if (j.p.isNaN()) "" else " " + ltr("${(j.p * 100).roundToInt()}%")
            val more = if (mine.size > 1) " · " + c.getString(R.string.mon_more, mine.size - 1) else ""
            St(C.pos, (stg ?: c.getString(R.string.mon_st_busy)) + p + more)
        }
        hb?.busy?.isNotEmpty() == true -> St(C.pos, c.getString(R.string.mon_st_busy))
        else -> St(C.pos, c.getString(R.string.mon_st_idle))
    }
}

/** שורת הכותרת: נקודה, שם (פותח את מרכז הניהול), מצב, מתי עודכן, ↻ */
@Composable
private fun Head(c: Context, name: String, st: St?, updated: Long) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Row(GlanceModifier.defaultWeight().clickable(actionStartActivity(openApp(c))), verticalAlignment = Alignment.CenterVertically) {
            if (st != null) {
                Box(GlanceModifier.size(8.dp).cornerRadius(4.dp).background(st.tone)) {}
                Spacer(GlanceModifier.width(6.dp))
            }
            Text(name, style = TextStyle(color = C.on, fontSize = 14.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            if (st != null) {
                Spacer(GlanceModifier.width(6.dp))
                Text(st.text, style = TextStyle(color = st.tone, fontSize = 12.sp, fontWeight = FontWeight.Medium), maxLines = 1,
                    modifier = GlanceModifier.defaultWeight())
            }
        }
        Text(
            if (updated <= 0L) c.getString(R.string.mon_never) else ago(c, updated),
            style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1,
        )
        Box(GlanceModifier.size(26.dp).cornerRadius(13.dp).clickable(actionRunCallback<MonRefreshAction>()), contentAlignment = Alignment.Center) {
            Image(ImageProvider(R.drawable.ic_widget_refresh), contentDescription = c.getString(R.string.mon_refresh), modifier = GlanceModifier.size(15.dp))
        }
    }
}

/** הודעה במקום המדדים. openConfig = נגיעה פותחת את מסך הטוקן */
@Composable
private fun ColumnScope.Hint(c: Context, text: String, updated: Long, openConfig: Boolean) {
    Head(c, c.getString(R.string.mon_title), null, updated)
    val mod = if (openConfig) GlanceModifier.fillMaxWidth().defaultWeight().clickable(actionStartActivity<MonConfigActivity>())
    else GlanceModifier.fillMaxWidth().defaultWeight()
    Box(mod, contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(color = C.variant, fontSize = 14.sp, textAlign = TextAlign.Center))
    }
}

/** שרת אחד: ארבעה מדדים + שורת תחתית */
@Composable
private fun ColumnScope.One(c: Context, snap: MonSnap, s: MonServer, updated: Long, tall: Boolean, wide: Boolean) {
    Head(c, s.name, stateOf(c, s, snap.jobs), updated)
    val hb = s.hb
    if (!s.online || hb == null) {
        Box(GlanceModifier.fillMaxWidth().defaultWeight(), contentAlignment = Alignment.Center) {
            Text(c.getString(if (s.online) R.string.mon_no_data else R.string.mon_off_hint),
                style = TextStyle(color = C.variant, fontSize = 13.sp, textAlign = TextAlign.Center))
        }
    } else {
        Spacer(GlanceModifier.height(if (tall) 9.dp else 6.dp))
        Row(GlanceModifier.fillMaxWidth()) {
            Metric(pct(hb.cu), c.getString(R.string.mon_l_cu), "cu" in s.warn, hb.cu / 100.0, C.cpu, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(10.dp))
            Metric(pct(hb.mem), c.getString(R.string.mon_l_mem), "mem" in s.warn || hb.psi >= 20.0, hb.mem / 100.0, C.mem, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(10.dp))
            Metric(pct(hb.disk), c.getString(R.string.mon_l_disk), "disk" in s.warn || hb.dl, hb.disk / 100.0, C.disk, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(10.dp))
            val net = netOf(hb)
            // הפס של הרשת — יחסי ל־10MB/s (קו של שרת ענן רגיל), כדי שגם תעבורה קטנה תיראה
            Metric(rateShort(net), c.getString(R.string.mon_l_net), false, if (net.isNaN()) Double.NaN else net / 10_000_000.0, C.net, GlanceModifier.defaultWeight())
        }
    }
    Spacer(GlanceModifier.defaultWeight())
    if (tall) Foot(c, snap, hb, wide)
}

/** כמה שרתים: טבלה — שם ומצב, ואחריהם מעבד, זיכרון, דיסק ורשת */
@Composable
private fun ColumnScope.Many(c: Context, snap: MonSnap, updated: Long, tall: Boolean) {
    Head(c, c.getString(R.string.mon_title), null, updated)
    Spacer(GlanceModifier.height(5.dp))
    Row(GlanceModifier.fillMaxWidth()) {
        Spacer(GlanceModifier.defaultWeight())
        for (l in listOf(R.string.mon_l_cu, R.string.mon_l_mem, R.string.mon_l_disk, R.string.mon_l_net)) {
            Text(c.getString(l), style = TextStyle(color = C.variant, fontSize = 10.sp, textAlign = TextAlign.End), maxLines = 1,
                modifier = GlanceModifier.width(44.dp))
        }
    }
    for (s in snap.servers.take(if (tall) 3 else 2)) {
        val st = stateOf(c, s, snap.jobs)
        val hb = if (s.online) s.hb else null
        Row(GlanceModifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(GlanceModifier.size(8.dp).cornerRadius(4.dp).background(st.tone)) {}
            Spacer(GlanceModifier.width(6.dp))
            Column(GlanceModifier.defaultWeight()) {
                Text(s.name, style = TextStyle(color = if (s.paused || !s.online) C.variant else C.on, fontSize = 13.sp, fontWeight = FontWeight.Medium), maxLines = 1)
                if (st.tone != C.pos || st.text != c.getString(R.string.mon_st_idle)) {
                    Text(st.text, style = TextStyle(color = st.tone, fontSize = 10.sp), maxLines = 1)
                }
            }
            Cell(hb?.let { pct(it.cu) } ?: "—", "cu" in s.warn)
            Cell(hb?.let { pct(it.mem) } ?: "—", "mem" in s.warn)
            Cell(hb?.let { pct(it.disk) } ?: "—", "disk" in s.warn || hb?.dl == true)
            Cell(hb?.let { rateShort(netOf(it)) } ?: "—", false)
        }
    }
    Spacer(GlanceModifier.defaultWeight())
    if (tall) Foot(c, snap, null, false)
}

@Composable
private fun Cell(v: String, warn: Boolean) {
    Text(v, style = TextStyle(color = if (warn) C.warn else C.on, fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.End),
        maxLines = 1, modifier = GlanceModifier.width(44.dp))
}

/** שורת התחתית: R2, צפי לחודש, Drive, פנוי בדיסק, וכמה זמן השרת פועל (כשיש מקום). מדידה שנכשלה — "!" */
@Composable
private fun Foot(c: Context, snap: MonSnap, hb: MonHb?, wide: Boolean) {
    val st = snap.sto
    val parts = mutableListOf<Pair<String, String>>()
    if (st != null) {
        val r2 = when {
            !st.r2Gb.isNaN() -> gb(st.r2Gb)
            st.r2Err.isNotEmpty() -> "!"
            else -> ""
        }
        if (r2.isNotEmpty()) parts += "R2" to r2
        if (!st.proj.isNaN()) parts += c.getString(R.string.mon_f_proj) to usd(st.proj)
        if (!st.driveGb.isNaN() && !st.driveLim.isNaN() && st.driveLim > 0.0) parts += "Drive" to pct(st.driveGb / st.driveLim * 100.0)
    }
    if (hb != null && !hb.free.isNaN()) parts += c.getString(R.string.mon_f_free) to gb(hb.free)
    if (hb != null && wide && !hb.up.isNaN()) parts += c.getString(R.string.mon_f_up) to dur(c, hb.up)
    if (hb == null && snap.jobs.isNotEmpty()) parts += c.getString(R.string.mon_f_jobs) to ltr("${snap.jobs.size}")
    if (parts.isEmpty()) return
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        parts.forEachIndexed { i, (k, v) ->
            if (i > 0) Spacer(GlanceModifier.width(10.dp))
            Text(k + " ", style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1)
            Text(v, style = TextStyle(color = C.on, fontSize = 11.sp, fontWeight = FontWeight.Medium), maxLines = 1)
        }
    }
}

/** מדד אחד: הערך בגדול, השם מתחתיו ופס דק. חורג מהסף = כתום */
@Composable
private fun Metric(value: String, label: String, warn: Boolean, frac: Double, color: Tone, mod: GlanceModifier) {
    Column(mod) {
        Text(value, style = TextStyle(color = if (warn) C.warn else C.on, fontSize = 19.sp, fontWeight = FontWeight.Bold), maxLines = 1)
        Text(label, style = TextStyle(color = C.variant, fontSize = 11.sp), maxLines = 1)
        Spacer(GlanceModifier.height(4.dp))
        LinearProgressIndicator(
            progress = if (frac.isNaN()) 0f else frac.toFloat().coerceIn(0f, 1f),
            modifier = GlanceModifier.fillMaxWidth().height(3.dp).cornerRadius(2.dp),
            color = if (warn) C.warn else color,
            backgroundColor = C.track,
        )
    }
}

private fun netOf(hb: MonHb): Double = if (hb.rx.isNaN() && hb.tx.isNaN()) Double.NaN else (if (hb.rx.isNaN()) 0.0 else hb.rx) + (if (hb.tx.isNaN()) 0.0 else hb.tx)

private fun stageName(c: Context, st: String): String? = when (st) {
    "up" -> c.getString(R.string.mon_stg_up)
    "tr" -> c.getString(R.string.mon_stg_tr)
    "al" -> c.getString(R.string.mon_stg_al)
    "tl" -> c.getString(R.string.mon_stg_tl)
    "rv" -> c.getString(R.string.mon_stg_rv)
    "bn" -> c.getString(R.string.mon_stg_bn)
    "sv" -> c.getString(R.string.mon_stg_sv)
    else -> null
}

private fun warnName(c: Context, code: String): String = when (code) {
    "cu" -> c.getString(R.string.mon_w_cu)
    "mem" -> c.getString(R.string.mon_w_mem)
    "disk" -> c.getString(R.string.mon_w_disk)
    "psi" -> c.getString(R.string.mon_w_psi)
    else -> code
}

private fun gb(v: Double): String = ltr(if (v < 1.0) "${(v * 1000).roundToInt()}MB" else if (v < 10.0) String.format(Locale.ROOT, "%.1fGB", v) else "${v.roundToInt()}GB")

private fun usd(v: Double): String = ltr(String.format(Locale.ROOT, "$%.2f", v))

private fun pct(v: Double): String = if (v.isNaN()) "—" else ltr("${v.roundToInt()}%")

/** קצב רשת קצר לאריח: "1.4MB/s", "320KB/s" */
private fun rateShort(v: Double): String = when {
    v.isNaN() -> "—"
    v >= 1_000_000 -> ltr(String.format(Locale.ROOT, if (v >= 10_000_000) "%.0fMB/s" else "%.1fMB/s", v / 1_000_000))
    else -> ltr("${(v / 1_000).roundToInt()}KB/s")
}

/** זמן פעולה (שניות) — "3 ימ׳" / "5 שע׳" / "12 דק׳" */
private fun dur(c: Context, sec: Double): String {
    val m = (sec / 60.0).toLong()
    return when {
        m < 60L -> c.getString(R.string.mon_dur_m, m.toInt())
        m < 48L * 60L -> c.getString(R.string.mon_dur_h, (m / 60L).toInt())
        else -> c.getString(R.string.mon_dur_d, (m / 1440L).toInt())
    }
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
