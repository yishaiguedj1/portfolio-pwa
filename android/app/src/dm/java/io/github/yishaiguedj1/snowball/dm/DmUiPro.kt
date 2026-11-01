@file:OptIn(ExperimentalFoundationApi::class)

package io.github.yishaiguedj1.snowball.dm

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.absoluteValue

/*
 * השדרוג "מקצועי", סבב 1 (01/11/2026, docs/dm-upgrade-plan.md, לפי ת־הורדות):
 * מפת המקטעים החיה, "למה זה לא יורד?", הבדיקה לפני הורדה (כולל כפולים) וההצצה לתוך ZIP/APK.
 * מינימליזם: הפירוט לפי חיבור מוסתר מאחורי נגיעה; הכל בצבעי הערכה, בלי מסגרות.
 */

/** צבע קבוע לכל מקטע (לפי ההתחלה שלו — לא משתנה כשמקטע אחר נחצה) */
private val SEG_COLORS = listOf(0xFF3D8BFD, 0xFF2EC4A0, 0xFFFFB020, 0xFFEF5DA8, 0xFF8B6CFF, 0xFF22B8E6, 0xFFFF7A45, 0xFF8FC93A).map { Color(it) }
private fun segColor(start: Long) = SEG_COLORS[((start xor (start ushr 20)) % SEG_COLORS.size).toInt().absoluteValue]

@Composable
private fun Kv(k: String, v: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Text(k, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(v, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/* ---------- מפת המקטעים: כל חיבור בצבע משלו, גרף מהירות, ופירוט לפי חיבור ---------- */
@Composable
internal fun SegMap(t: DmTask, rev: Int) {
    if (t.kind != DmKind.HTTP || t.total <= 0) return
    val ctx = LocalContext.current
    data class S(val start: Long, val end: Long, val done: Long) { val left get() = (end - start - done).coerceAtLeast(0); val fin get() = left == 0L }
    val segs = remember(rev) { t.segs.map { S(it.start, it.end, it.done.coerceAtMost(it.end - it.start)) } }
    val running = t.state == DmState.RUNNING
    // מהירות לכל מקטע: ההפרש מהתמונה הקודמת (פעם בשנייה, עם rev)
    val prev = remember(t.id) { HashMap<Long, Pair<Long, Long>>() }
    val segSpeed = remember(rev) {
        val now = System.currentTimeMillis()
        segs.associate { s ->
            val p = prev[s.start]
            val v = if (p != null && now > p.second) ((s.done - p.first) * 1000 / (now - p.second)).coerceAtLeast(0) else 0L
            prev[s.start] = s.done to now
            s.start to v
        }
    }
    val hist = remember(t.id) { mutableStateListOf<Long>() }
    LaunchedEffect(rev) { if (running) { hist.add(DmEngine.speed[t.id] ?: 0); while (hist.size > 60) hist.removeAt(0) } }

    val tot = t.total.toFloat()
    val track = MaterialTheme.colorScheme.surfaceContainerHigh
    val doneC = MaterialTheme.colorScheme.primary.copy(alpha = 0.55f)
    val head = MaterialTheme.colorScheme.onSurface
    Canvas(Modifier.fillMaxWidth().height(18.dp).clip(RoundedCornerShape(9.dp))) {
        drawRect(track)
        for (s in segs) {
            val x0 = s.start / tot * size.width
            val w = s.done / tot * size.width
            val active = running && !s.fin
            if (w > 0) drawRect(if (active) segColor(s.start) else doneC, Offset(x0, 0f), Size(w.coerceAtLeast(1f), size.height))
            if (active) drawRect(head, Offset((x0 + w - 1f).coerceAtLeast(0f), 0f), Size(2f, size.height))
        }
    }
    val live = DmEngine.live[t.id] ?: segs.count { !it.fin }
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(stringResource(R.string.dmSegs, if (running) live else 0, segs.size), style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        if (running) DmFmt.heat(ctx).takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary) }
    }

    // גרף המהירות של הדקה האחרונה — רק בזמן הורדה
    if (running && hist.size >= 3) {
        val line = MaterialTheme.colorScheme.primary
        val max = (hist.maxOrNull() ?: 1L).coerceAtLeast(1L).toFloat()
        Spacer(Modifier.height(10.dp))
        Text(stringResource(R.string.dmSpeedT) + " · " + DmFmt.speed(ctx, hist.maxOrNull() ?: 0), style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Canvas(Modifier.fillMaxWidth().height(56.dp).padding(top = 4.dp)) {
            val n = hist.size
            val dx = size.width / (60 - 1).toFloat()
            val x0 = size.width - (n - 1) * dx
            val p = Path(); val area = Path()
            hist.forEachIndexed { i, v ->
                val x = x0 + i * dx; val y = size.height - v / max * (size.height - 4f) - 2f
                if (i == 0) { p.moveTo(x, y); area.moveTo(x, size.height); area.lineTo(x, y) } else { p.lineTo(x, y); area.lineTo(x, y) }
            }
            area.lineTo(x0 + (n - 1) * dx, size.height); area.close()
            drawPath(area, line.copy(alpha = 0.14f))
            drawPath(p, line, style = Stroke(width = 2.5f))
        }
    }

    // פירוט לפי חיבור — מאחורי נגיעה
    val act = segs.filter { running && !it.fin }
    if (act.isNotEmpty()) {
        var open by remember(t.id) { mutableStateOf(false) }
        TextButton(onClick = { open = !open }) { Text(stringResource(R.string.dmConnsT) + if (open) " ▴" else " ▾") }
        if (open) act.take(DmSegs.MAX_CONNS).forEachIndexed { i, s ->
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(segColor(s.start)))
                Text(stringResource(R.string.dmConn, i + 1), Modifier.padding(start = 8.dp).weight(1f), style = MaterialTheme.typography.bodySmall)
                Text(listOf(DmFmt.speed(ctx, segSpeed[s.start] ?: 0), DmFmt.size(ctx, s.left)).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/* ---------- "למה זה לא יורד?" ---------- */
private fun dgRes(k: String) = when (k) {
    "Dns" -> R.string.dmDgDns; "Net" -> R.string.dmDgNet; "Wifi" -> R.string.dmDgWifi; "Expired" -> R.string.dmDgExpired
    "Gone" -> R.string.dmDgGone; "Busy" -> R.string.dmDgBusy; "Server" -> R.string.dmDgServer; "Space" -> R.string.dmDgSpace
    "Ssl" -> R.string.dmDgSsl; "Changed" -> R.string.dmDgChanged; "Incomplete" -> R.string.dmDgIncomplete; "Page" -> R.string.dmDgPage
    "Login" -> R.string.dmDgLogin; "Blocked" -> R.string.dmDgBlocked; "Drm" -> R.string.dmDgDrm; "Geo" -> R.string.dmDgGeo
    "Live" -> R.string.dmDgLive; "NoVideo" -> R.string.dmDgNoVideo; "Heat" -> R.string.dmDgHeat; "NoResume" -> R.string.dmDgNoResume
    else -> R.string.dmDgUnknown
}

private fun actRes(a: DmDiag.Act) = when (a) {
    DmDiag.Act.RETRY -> R.string.dmActRetry; DmDiag.Act.REFRESH -> R.string.dmActRefresh; DmDiag.Act.BROWSER -> R.string.dmActBrowser
    DmDiag.Act.FEWER -> R.string.dmActFewer; DmDiag.Act.CELL -> R.string.dmActCell; DmDiag.Act.SPACE -> R.string.dmActSpace
    DmDiag.Act.RESTART -> R.string.dmActRestart; DmDiag.Act.NONE -> 0
}

private fun stepRes(k: String) = when (k) {
    "dns" -> R.string.dmStepDns; "conn" -> R.string.dmStepConn; "http" -> R.string.dmStepHttp; "redir" -> R.string.dmStepRedir
    "page" -> R.string.dmStepPage; "size" -> R.string.dmStepSize; "ranges" -> R.string.dmStepRanges; else -> R.string.dmStepSame
}

private fun originOf(u: String) = Regex("^(https?://[^/?#]+)").find(u)?.groupValues?.get(1) ?: ""

@Composable
internal fun DiagCard(a: DmActivity, t: DmTask, onClose: () -> Unit) {
    if (t.state != DmState.FAILED && t.state != DmState.WAITING) return
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    val whys = remember(t.err, t.tries) { DmDiag.explain(t.err, t.kind, t.ranges, t.tries, wifiOnly = pr.wifiOnly) }
    var steps by remember(t.id) { mutableStateOf<List<DmDiag.Step>?>(null) }
    var busy by remember(t.id) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun run(act: DmDiag.Act) {
        when (act) {
            DmDiag.Act.RETRY -> DmEngine.resume(ctx, t.id)
            DmDiag.Act.REFRESH -> { onClose(); a.openBrowser(t.ref.ifEmpty { originOf(t.url) }, t.id) }
            DmDiag.Act.BROWSER -> { onClose(); a.openBrowser(t.ref.ifEmpty { t.url }) }
            DmDiag.Act.FEWER -> DmEngine.fewer(ctx, t.id)
            DmDiag.Act.CELL -> { pr.wifiOnly = false; DmEngine.pump(ctx) }
            DmDiag.Act.SPACE -> a.storageSettings()
            DmDiag.Act.RESTART -> DmEngine.restart(ctx, t.id)
            DmDiag.Act.NONE -> {}
        }
    }
    Spacer(Modifier.height(12.dp))
    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(stringResource(R.string.dmDiagT), fontWeight = FontWeight.SemiBold)
            whys.forEach { Text(stringResource(dgRes(it.key)), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp)) }
            val acts = whys.map { it.act }.filter { it != DmDiag.Act.NONE }.distinct().take(2)
            if (acts.isNotEmpty()) Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                acts.forEachIndexed { i, x ->
                    if (i == 0) GButton(onClick = { run(x) }) { Text(stringResource(actRes(x))) }
                    else GTonal(onClick = { run(x) }) { Text(stringResource(actRes(x))) }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(enabled = !busy, onClick = {
                    busy = true; steps = null
                    scope.launch { steps = withContext(Dispatchers.IO) { runCatching { a.diagCheck(t) }.getOrDefault(emptyList()) }; busy = false }
                }) { Text(stringResource(if (busy) R.string.dmDiagRunning else R.string.dmDiagRun)) }
                if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
            }
            steps?.forEach { s ->
                val v = when (s.k) {
                    "size" -> s.v.toLongOrNull()?.let { DmFmt.size(ctx, it) } ?: ""
                    "http" -> if (s.ok) "" else "HTTP " + s.v
                    "conn" -> if (s.ok) "" else s.v
                    else -> s.v
                }
                Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (s.ok) "✓" else "✗", color = if (s.ok) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                    Text(stringResource(stepRes(s.k)) + if (v.isNotEmpty()) " · $v" else "", Modifier.padding(start = 8.dp), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/* ---------- בדיקה לפני הורדה: מה השרת אמר, לאן זה יישמר, וכבר הורדת? ---------- */
@Composable
internal fun FileFacts(a: DmActivity, f: DmActivity.Found.File) {
    val ctx = LocalContext.current
    val type = f.mime.ifEmpty { DmName.ext(f.name).uppercase() }
    if (type.isNotEmpty()) Kv(stringResource(R.string.dmType), type)
    if (f.server.isNotEmpty()) Kv(stringResource(R.string.dmServer), f.server)
    DmFmt.httpDate(f.lastMod).takeIf { it.isNotEmpty() }?.let { Kv(stringResource(R.string.dmModified), it) }
    Kv(stringResource(R.string.dmFolder), DmMedia.folderOf(f.name, f.mime))
    val old = remember(f.url, f.name, f.size) {
        DmStore.all().firstOrNull { it.state == DmState.DONE && it.uri.isNotEmpty() && (it.url == f.url || (f.size > 0 && it.total == f.size && it.name == f.name)) }
    }
    if (old != null) {
        Spacer(Modifier.height(8.dp))
        Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.tertiaryContainer, modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.dmDupDone), Modifier.weight(1f), color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { a.open(old) }) { Text(stringResource(R.string.dmDupOpen)) }
            }
        }
    }
    if (DmZipPeek.canPeek(f.name, f.ranges, f.size)) PeekBlock(a, f)
}

/* ---------- מה יש בתוך ZIP / APK — ולהוריד רק חלק ---------- */
@Composable
private fun PeekBlock(a: DmActivity, f: DmActivity.Found.File) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember(f.url) { mutableStateOf(false) }
    var res by remember(f.url) { mutableStateOf<DmActivity.Peek?>(null) }
    var err by remember(f.url) { mutableStateOf("") }
    var sel by remember(f.url) { mutableStateOf(setOf<Int>()) }
    var got by remember(f.url) { mutableStateOf(-1) }
    var bytes by remember(f.url) { mutableStateOf(0L) }
    var done by remember(f.url) { mutableStateOf("") }
    val ref = a.sheetRef.value
    val r = res
    if (r == null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(enabled = !busy, onClick = {
                busy = true; err = ""
                scope.launch {
                    val x = withContext(Dispatchers.IO) { a.peek(f, ref) }
                    busy = false
                    x.onSuccess { res = it }.onFailure { e -> err = if (e.message == "changed") ctx.getString(R.string.dmPeekChanged) else ctx.getString(R.string.dmPeekFail) }
                }
            }) { Text(stringResource(R.string.dmPeek)) }
            if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
        }
        if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        return
    }
    val files = remember(r) { r.list.entries.withIndex().filter { !it.value.dir } }
    Spacer(Modifier.height(8.dp))
    r.apk?.let { ApkBox(it) }
    Text(stringResource(R.string.dmPeekN, files.size, DmFmt.size(ctx, files.sumOf { it.value.size })), fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 6.dp))
    if (r.list.truncated) Text(stringResource(R.string.dmPeekMore, (r.list.count - r.list.entries.size).toInt()), style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant)
    files.take(300).forEach { (i, e) ->
        Row(Modifier.fillMaxWidth().combinedClickable(onClick = { if (!e.enc) sel = if (i in sel) sel - i else sel + i }), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(i in sel, { v -> if (!e.enc) sel = if (v) sel + i else sel - i }, enabled = !e.enc && got < 0)
            Column(Modifier.weight(1f)) {
                Text(e.name.substringAfterLast('/'), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                if ('/' in e.name) Text(e.name.substringBeforeLast('/'), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(if (e.enc) stringResource(R.string.dmPeekEnc) else DmFmt.size(ctx, e.size), style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 8.dp))
        }
    }
    if (done.isNotEmpty()) Text(done, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
    else if (got >= 0) Text("${got}/${sel.size} · " + DmFmt.size(ctx, bytes), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
    else if (sel.isNotEmpty()) GTonal(onClick = {
        got = 0; bytes = 0
        val pick = r.list.entries.filterIndexed { i, _ -> i in sel }
        scope.launch {
            val x = withContext(Dispatchers.IO) { a.peekGet(f, ref, pick) { n, b -> got = n; bytes = b } }
            done = x.fold({ n -> ctx.getString(R.string.dmPeekDone, n, "Download/" + DmMedia.DIR) }, { ctx.getString(R.string.dmPeekFail) })
        }
    }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(stringResource(R.string.dmPeekGo, sel.size)) }
}

/** מה ה־APK מבקש — לפני שמורידים ומתקינים */
@Composable
private fun ApkBox(i: DmApk.Info) {
    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(stringResource(R.string.dmApkT), fontWeight = FontWeight.SemiBold)
            if (i.label.isNotEmpty()) Kv(stringResource(R.string.dmApkName), i.label)
            Kv(stringResource(R.string.dmApkPkg), i.pkg)
            Kv(stringResource(R.string.dmApkVer), listOf(i.versionName, if (i.versionCode > 0) "(${i.versionCode})" else "").filter { it.isNotEmpty() }.joinToString(" "))
            if (i.minSdk > 0) Kv(stringResource(R.string.dmApkMin), "API ${i.minSdk}")
            if (i.accessibility) Text(stringResource(R.string.dmApkAcc), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
            Text(if (i.risky.isEmpty()) stringResource(R.string.dmApkNone) else stringResource(R.string.dmApkRisky) + ": " + i.risky.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall, color = if (i.risky.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp))
        }
    }
}

/* ---------- הגדרה: להאט כשחם ---------- */
@Composable
internal fun HeatSetting() {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var on by remember { mutableStateOf(pr.heat) }
    ListItem(headlineContent = { Text(stringResource(R.string.dmSetHeat)) }, supportingContent = { Text(stringResource(R.string.dmSetHeatS)) },
        trailingContent = { GSwitch(on, { on = it; pr.heat = it; DmEngine.heatTick(ctx, force = true) }) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}
