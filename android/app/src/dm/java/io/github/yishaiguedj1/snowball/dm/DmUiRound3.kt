package io.github.yishaiguedj1.snowball.dm

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/* 01/11/2026 — השדרוג "מקצועי", סבב 3: המסכים (לפי ת־עיצוב ות־הורדות; רכיבי הזכוכית מ־DmGlass). הכל מאחורי שורה אחת
   בהגדרות ("מקצועי") — המסך הרגיל נשאר נקי */

private val SPEEDS = listOf(0L, 256L shl 10, 512L shl 10, 1L shl 20, 2L shl 20, 5L shl 20, 10L shl 20)
private val QUOTA_MB = listOf(0L, 500L, 1024L, 2048L, 5120L, 10240L, 51200L)
private val TRIES = listOf(0, 1, 3, 5, 10)
private val CONNS = listOf(0, 1, 2, 4, 8)
private val CATS = listOf(DmName.Cat.VIDEO, DmName.Cat.AUDIO, DmName.Cat.IMAGE, DmName.Cat.DOC, DmName.Cat.ARCHIVE, DmName.Cat.APK, DmName.Cat.OTHER)

@Composable private fun spd(b: Long) = if (b <= 0) stringResource(R.string.dmLimitOff) else DmFmt.speed(LocalContext.current, b)
@Composable private fun mb(m: Long) = if (m <= 0) stringResource(R.string.dmLimitOff) else DmFmt.size(LocalContext.current, m shl 20)

@Composable
private fun daysTxt(d: Int): String {
    val short = stringResource(R.string.dmDaysShort).split(',')
    if ((d and DmWindow.ALL) == DmWindow.ALL) return stringResource(R.string.dmDaysAll)
    return (0..6).filter { (d and (1 shl it)) != 0 }.joinToString(" ") { short.getOrElse(it) { "" } }
}

@Composable
private fun winTxt(w: DmWindow): String = if (w.always) stringResource(R.string.dmWinAlways)
    else daysTxt(w.days) + (if (w.start == w.end) "" else " · " + DmWindow.fmt(w.start) + "–" + DmWindow.fmt(w.end))

/** השורה בהגדרות */
@Composable
internal fun ProSettingRow(a: DmActivity) {
    var open by remember { mutableStateOf(false) }
    ListItem(headlineContent = { Text(stringResource(R.string.dmPro)) }, supportingContent = { Text(stringResource(R.string.dmProS)) },
        modifier = Modifier.clickable { open = true }, colors = ListItemDefaults.colors(containerColor = Color.Transparent))
    if (open) ProSheet(a) { open = false }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProSheet(a: DmActivity, onClose: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    GSheet(onClose) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            Text(stringResource(R.string.dmPro), fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Spacer(Modifier.height(10.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(R.string.dmProQueues, R.string.dmProFolders, R.string.dmProRules, R.string.dmProLimits, R.string.dmProApps).forEachIndexed { i, s ->
                    GChip(tab == i, { tab = i }, { Text(stringResource(s)) })
                }
            }
            Spacer(Modifier.height(12.dp))
            when (tab) {
                0 -> QueuesTab()
                1 -> FoldersTab(a)
                2 -> RulesTab(a)
                3 -> LimitsTab()
                else -> AppsTab()
            }
        }
    }
}

@Composable
private fun Row2(title: String, sub: String, trailing: @Composable (() -> Unit)? = null, onClick: () -> Unit) {
    val g = LocalDmG.current
    ListItem(headlineContent = { Text(title, maxLines = 1) }, supportingContent = { if (sub.isNotEmpty()) Text(sub, color = g.mute, maxLines = 2) },
        trailingContent = trailing, modifier = Modifier.padding(vertical = 3.dp).glassCard(g, RoundedCornerShape(18.dp)).clickable(onClick = onClick),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}

@Composable
private fun Hint(s: String) = Text(s, color = LocalDmG.current.mute, fontSize = 13.sp, modifier = Modifier.padding(4.dp, 8.dp))

@Composable
private fun Label(s: String) = Text(s, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(top = 10.dp, bottom = 2.dp))

/* ---------- תורים ---------- */

@Composable
private fun QueuesTab() {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var qs by remember { mutableStateOf(DmQueues.parse(pr.queues)) }
    var edit by remember { mutableStateOf<DmQueue?>(null) }
    fun save(n: List<DmQueue>) { qs = n; pr.queues = DmQueues.dump(n); DmR3.scheduleWake(ctx, true); DmEngine.pump(ctx) }
    Hint(stringResource(R.string.dmQueuesS))
    qs.forEach { q ->
        val par = if (q.parallel == 0) "" else stringResource(R.string.dmQPar, q.parallel)
        Row2(q.name, listOf(winTxt(q.win), par, if (q.wifi) stringResource(R.string.dmQWifi) else "").filter { it.isNotEmpty() }.joinToString(" · ")) { edit = q }
    }
    if (qs.size < DmQueues.MAX) GTonal(onClick = { edit = DmQueue(DmQueues.newId(qs), "") }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(stringResource(R.string.dmQNew)) }
    edit?.let { q0 ->
        QueueDialog(q0, onDone = { q -> edit = null; if (q != null) save(if (qs.any { it.id == q.id }) qs.map { if (it.id == q.id) q else it } else qs + q) },
            onDelete = { edit = null; save(qs.filter { it.id != q0.id }) })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WindowEditor(w: DmWindow, set: (DmWindow) -> Unit) {
    val short = stringResource(R.string.dmDaysShort).split(',')
    var from by remember { mutableStateOf(if (w.always) "" else DmWindow.fmt(w.start)) }
    var to by remember { mutableStateOf(if (w.always) "" else DmWindow.fmt(w.end)) }
    var days by remember { mutableIntStateOf(w.days) }
    fun push() {
        val s = DmWindow.hm(from); val e = DmWindow.hm(to)
        set(if (s < 0 || e < 0) DmWindow(days, 0, 0) else DmWindow(days, s, e))
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        (0..6).forEach { d -> GChip((days and (1 shl d)) != 0, { days = days xor (1 shl d); push() }, { Text(short.getOrElse(d) { "" }) }) }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        GField(from, { from = it.take(5); push() }, Modifier.weight(1f), singleLine = true, label = { Text(stringResource(R.string.dmWinFrom)) }, placeholder = { Text("23:00") })
        GField(to, { to = it.take(5); push() }, Modifier.weight(1f), singleLine = true, label = { Text(stringResource(R.string.dmWinTo)) }, placeholder = { Text("06:00") })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QueueDialog(q0: DmQueue, onDone: (DmQueue?) -> Unit, onDelete: () -> Unit) {
    var q by remember { mutableStateOf(q0) }
    AlertDialog(containerColor = LocalDmG.current.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { onDone(null) },
        title = { Text(stringResource(if (q0.name.isEmpty()) R.string.dmQNew else R.string.dmQEdit)) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            GField(q.name, { q = q.copy(name = it.take(DmQueues.MAX_NAME)) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmQName)) })
            Label(stringResource(R.string.dmSetParallel))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                (0..5).forEach { n -> GChip(q.parallel == n, { q = q.copy(parallel = n) }, { Text(if (n == 0) stringResource(R.string.dmAsSettings) else "$n") }) }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                Text(stringResource(R.string.dmSetWifi), Modifier.weight(1f)); GSwitch(q.wifi, { q = q.copy(wifi = it) })
            }
            Label(stringResource(R.string.dmWin))
            WindowEditor(q.win) { q = q.copy(win = it) }
            Label(stringResource(R.string.dmQTries))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TRIES.forEach { n -> GChip(q.tries == n, { q = q.copy(tries = n) }, { Text(if (n == 0) stringResource(R.string.dmLimitOff) else "$n") }) }
            }
            Label(stringResource(R.string.dmQEnd))
            val acts = q.done.split(',').filter { it.isNotEmpty() }.toSet()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("notify" to R.string.dmQEndNotify, "intent" to R.string.dmQEndIntent).forEach { (k, s) ->
                    GChip(k in acts, { q = q.copy(done = (if (k in acts) acts - k else acts + k).joinToString(",")) }, { Text(stringResource(s)) })
                }
            }
        } },
        confirmButton = { TextButton(onClick = { if (q.name.isNotBlank()) onDone(q.copy(name = q.name.trim())) }) { Text(stringResource(R.string.dmSave)) } },
        dismissButton = { if (q0.name.isNotEmpty()) TextButton(onClick = onDelete) { Text(stringResource(R.string.dmDelete), color = StRed) } })
}

/* ---------- תיקיות ---------- */

@Composable
private fun folderTxt(v: String): String = when {
    v.startsWith(DmFolders.SUB) -> "Studio DM/" + v.removePrefix(DmFolders.SUB)
    v.startsWith(DmFolders.TREE) -> stringResource(R.string.dmFolderPicked, android.net.Uri.decode(v.substringAfterLast("%3A", v.substringAfterLast('/'))).take(40))
    else -> stringResource(R.string.dmFolderDefault)
}

@Composable
private fun catLabel(c: DmName.Cat) = stringResource(when (c) {
    DmName.Cat.VIDEO -> R.string.dmCatVideo; DmName.Cat.AUDIO -> R.string.dmCatAudio; DmName.Cat.IMAGE -> R.string.dmCatImage
    DmName.Cat.DOC -> R.string.dmCatDoc; DmName.Cat.ARCHIVE -> R.string.dmCatArchive; DmName.Cat.APK -> R.string.dmCatApk; else -> R.string.dmCatOther
})

@Composable
private fun FoldersTab(a: DmActivity) {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var m by remember { mutableStateOf(DmFolders.parse(pr.folders)) }
    var edit by remember { mutableStateOf<DmName.Cat?>(null) }
    Hint(stringResource(R.string.dmFoldersS))
    CATS.forEach { c -> Row2(catLabel(c), folderTxt(m[c.name] ?: "")) { edit = c } }
    edit?.let { c ->
        FolderDialog(a, m[c.name] ?: "") { v ->
            edit = null
            if (v != null) { m = (m - c.name).let { if (v.isEmpty()) it else it + (c.name to v) }; pr.folders = DmFolders.dump(m) }
        }
    }
}

/** בחירת יעד: ברירת המחדל, תת־תיקייה בשם, או תיקייה בטלפון/בכרטיס (SAF). onDone(null) = ביטול */
@Composable
private fun FolderDialog(a: DmActivity, cur: String, onDone: (String?) -> Unit) {
    var sub by remember { mutableStateOf(if (cur.startsWith(DmFolders.SUB)) cur.removePrefix(DmFolders.SUB) else "") }
    AlertDialog(containerColor = LocalDmG.current.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { onDone(null) },
        title = { Text(stringResource(R.string.dmFolder)) },
        text = { Column {
            Text(folderTxt(cur), color = LocalDmG.current.mute)
            Spacer(Modifier.height(10.dp))
            GField(sub, { sub = it.take(120) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmFolderSub)) })
            Spacer(Modifier.height(8.dp))
            GTonal(onClick = { a.pickTree { onDone(it) } }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmFolderPick)) }
            TextButton(onClick = { onDone("") }) { Text(stringResource(R.string.dmFolderDefault)) }
        } },
        confirmButton = { TextButton(onClick = { onDone(DmFolders.norm(DmFolders.SUB + sub)) }) { Text(stringResource(R.string.dmSave)) } },
        dismissButton = { TextButton(onClick = { onDone(null) }) { Text(stringResource(R.string.dmNotNow)) } })
}

/* ---------- חוקים ---------- */

@Composable
private fun RulesTab(a: DmActivity) {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var rs by remember { mutableStateOf(DmRules.parse(pr.rules)) }
    var edit by remember { mutableStateOf<Int?>(null) }
    fun save(n: List<DmRule>) { rs = n; pr.rules = DmRules.dump(n) }
    Hint(stringResource(R.string.dmRulesS))
    rs.forEachIndexed { i, r ->
        val title = listOf(r.host.ifEmpty { "*" }, r.exts.joinToString(", ") { ".$it" }).filter { it.isNotEmpty() }.joinToString(" · ")
        Row2(title, ruleSummary(r), { GSwitch(r.on, { v -> save(rs.mapIndexed { j, x -> if (j == i) x.copy(on = v) else x }) }) }) { edit = i }
    }
    if (rs.size < DmRules.MAX) GTonal(onClick = { edit = -1 }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(stringResource(R.string.dmRuleNew)) }
    edit?.let { i ->
        RuleDialog(a, rs.getOrNull(i) ?: DmRule(), onDone = { r ->
            edit = null
            if (r != null) save(if (i in rs.indices) rs.mapIndexed { j, x -> if (j == i) r else x } else rs + r)
        }, onDelete = if (i in rs.indices) ({ edit = null; save(rs.filterIndexed { j, _ -> j != i }) }) else null)
    }
}

@Composable
private fun ruleSummary(r: DmRule): String {
    val ctx = LocalContext.current
    val qs = remember { DmQueues.parse(DmPrefs(ctx).queues) }
    return listOfNotNull(
        qs.firstOrNull { it.id == r.queue }?.name, r.dir.takeIf { it.isNotEmpty() }?.let { folderTxt(it) },
        if (r.conns > 0) stringResource(R.string.dmRuleConnsN, r.conns) else null, if (r.lim > 0) DmFmt.speed(ctx, r.lim) else null,
        r.name.takeIf { it.isNotEmpty() }, DmOnDone.parse(r.done).takeIf { it.isNotEmpty() }?.let { s -> s.joinToString(", ") { ctx.getString(actName(it)) } },
    ).joinToString(" · ")
}

private fun actName(a: DmOnDone.A) = when (a) {
    DmOnDone.A.OPEN -> R.string.dmActOpen; DmOnDone.A.UNZIP -> R.string.dmActUnzip; DmOnDone.A.HASH -> R.string.dmActHash
    DmOnDone.A.SHARE -> R.string.dmActShare; DmOnDone.A.STUDIO -> R.string.dmActStudio; DmOnDone.A.SILENT -> R.string.dmActSilent
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ActChips(cur: String, set: (String) -> Unit) {
    val s = DmOnDone.parse(cur)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        DmOnDone.A.entries.forEach { a -> GChip(a in s, { set(DmOnDone.dump(if (a in s) s - a else s + a)) }, { Text(stringResource(actName(a))) }) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QueueChips(cur: String, set: (String) -> Unit) {
    val ctx = LocalContext.current
    val qs = remember { DmQueues.parse(DmPrefs(ctx).queues) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        GChip(cur.isEmpty() || qs.none { it.id == cur }, { set("") }, { Text(stringResource(R.string.dmQMain)) })
        qs.forEach { q -> GChip(q.id == cur, { set(q.id) }, { Text(q.name) }) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RuleDialog(a: DmActivity, r0: DmRule, onDone: (DmRule?) -> Unit, onDelete: (() -> Unit)?) {
    val ctx = LocalContext.current
    var r by remember { mutableStateOf(r0) }
    var folder by remember { mutableStateOf(false) }
    val hasQueues = remember { DmQueues.parse(DmPrefs(ctx).queues).isNotEmpty() }
    AlertDialog(containerColor = LocalDmG.current.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { onDone(null) },
        title = { Text(stringResource(if (onDelete == null) R.string.dmRuleNew else R.string.dmRuleEdit)) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            GField(r.host, { r = r.copy(host = it.trim().lowercase().take(120)) }, Modifier.fillMaxWidth(), singleLine = true,
                label = { Text(stringResource(R.string.dmRuleHost)) }, placeholder = { Text("example.com") })
            Spacer(Modifier.height(6.dp))
            GField(r.ext, { r = r.copy(ext = it.take(120)) }, Modifier.fillMaxWidth(), singleLine = true,
                label = { Text(stringResource(R.string.dmRuleExt)) }, placeholder = { Text("mp4, mkv") })
            if (hasQueues) { Label(stringResource(R.string.dmProQueues)); QueueChips(r.queue) { r = r.copy(queue = it) } }
            Label(stringResource(R.string.dmFolder))
            GTonal(onClick = { folder = true }, Modifier.fillMaxWidth()) { Text(folderTxt(r.dir)) }
            Label(stringResource(R.string.dmSetConns))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                CONNS.forEach { n -> GChip(r.conns == n, { r = r.copy(conns = n) }, { Text(if (n == 0) stringResource(R.string.dmAsSettings) else "$n") }) }
            }
            Label(stringResource(R.string.dmSetLimit))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { SPEEDS.forEach { b -> GChip(r.lim == b, { r = r.copy(lim = b) }, { Text(spd(b)) }) } }
            Label(stringResource(R.string.dmRuleName))
            GField(r.name, { r = r.copy(name = it.take(120)) }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("{date} {base}") })
            Hint(stringResource(R.string.dmRuleNameS))
            Label(stringResource(R.string.dmOnDone))
            ActChips(r.done) { r = r.copy(done = it) }
        } },
        confirmButton = { TextButton(onClick = {
            DmRule.of(r.json())?.let { onDone(it) } ?: android.widget.Toast.makeText(ctx, R.string.dmRuleBad, android.widget.Toast.LENGTH_SHORT).show()
        }) { Text(stringResource(R.string.dmSave)) } },
        dismissButton = { if (onDelete != null) TextButton(onClick = onDelete) { Text(stringResource(R.string.dmDelete), color = StRed) } })
    if (folder) FolderDialog(a, r.dir) { v -> folder = false; if (v != null) r = r.copy(dir = v) }
}

/* ---------- מגבלות ומכסות ---------- */

@Composable
private fun LimitsTab() {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var slots by remember { mutableStateOf(DmSpeed.parse(pr.speedPlan)) }
    var cell by remember { mutableStateOf(pr.cellLimit) }
    var caps by remember { mutableStateOf(DmQuota.parseCaps(pr.quotaCaps)) }
    var edit by remember { mutableStateOf<Int?>(null) }
    val use = remember(caps) { DmR3.usage(pr) }
    fun saveSlots(n: List<DmSlot>) { slots = n; pr.speedPlan = DmSpeed.dump(n); DmR3.tick(ctx, true) }
    fun saveCaps(c: DmQuota.Caps) { caps = c; pr.quotaCaps = DmQuota.dumpCaps(c); DmEngine.pump(ctx) }
    fun nextMb(cur: Long): Long { val i = QUOTA_MB.indexOf(cur shr 20); return QUOTA_MB[(i + 1) % QUOTA_MB.size] shl 20 }

    Label(stringResource(R.string.dmSpeedPlan))
    Hint(stringResource(R.string.dmSpeedPlanS))
    slots.forEachIndexed { i, s -> Row2(winTxt(s.win), spd(s.bps), onClick = { edit = i }) }
    if (slots.size < DmSpeed.MAX) GTonal(onClick = { edit = -1 }, Modifier.fillMaxWidth().padding(top = 6.dp)) { Text(stringResource(R.string.dmSpeedNew)) }
    Label(stringResource(R.string.dmCellLimit))
    Row2(stringResource(R.string.dmCellLimitS), spd(cell), onClick = {
        cell = SPEEDS[(SPEEDS.indexOf(cell) + 1) % SPEEDS.size]; pr.cellLimit = cell; DmR3.tick(ctx, true)
    })
    Label(stringResource(R.string.dmQuota))
    Hint(stringResource(R.string.dmQuotaS))
    Row2(stringResource(R.string.dmQuotaDayW), stringResource(R.string.dmQuotaUsed, DmFmt.size(ctx, use.dW), mbOr(caps.dayW)), onClick = { saveCaps(caps.copy(dayW = nextMb(caps.dayW))) })
    Row2(stringResource(R.string.dmQuotaDayC), stringResource(R.string.dmQuotaUsed, DmFmt.size(ctx, use.dC), mbOr(caps.dayC)), onClick = { saveCaps(caps.copy(dayC = nextMb(caps.dayC))) })
    Row2(stringResource(R.string.dmQuotaMonW), stringResource(R.string.dmQuotaUsed, DmFmt.size(ctx, use.mW), mbOr(caps.monW)), onClick = { saveCaps(caps.copy(monW = nextMb(caps.monW))) })
    Row2(stringResource(R.string.dmQuotaMonC), stringResource(R.string.dmQuotaUsed, DmFmt.size(ctx, use.mC), mbOr(caps.monC)), onClick = { saveCaps(caps.copy(monC = nextMb(caps.monC))) })
    edit?.let { i ->
        SlotDialog(slots.getOrNull(i) ?: DmSlot(DmWindow(0x1f, 9 * 60, 18 * 60), 2L shl 20), onDone = { s ->
            edit = null; if (s != null) saveSlots(if (i in slots.indices) slots.mapIndexed { j, x -> if (j == i) s else x } else slots + s)
        }, onDelete = if (i in slots.indices) ({ edit = null; saveSlots(slots.filterIndexed { j, _ -> j != i }) }) else null)
    }
}

@Composable private fun mbOr(b: Long) = mb(b shr 20)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SlotDialog(s0: DmSlot, onDone: (DmSlot?) -> Unit, onDelete: (() -> Unit)?) {
    var s by remember { mutableStateOf(s0) }
    AlertDialog(containerColor = LocalDmG.current.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { onDone(null) },
        title = { Text(stringResource(R.string.dmSpeedPlan)) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            WindowEditor(s.win) { s = s.copy(win = it) }
            Label(stringResource(R.string.dmSetLimit))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { SPEEDS.drop(1).forEach { b -> GChip(s.bps == b, { s = s.copy(bps = b) }, { Text(spd(b)) }) } }
        } },
        confirmButton = { TextButton(onClick = { onDone(s) }) { Text(stringResource(R.string.dmSave)) } },
        dismissButton = { if (onDelete != null) TextButton(onClick = onDelete) { Text(stringResource(R.string.dmDelete), color = StRed) } })
}

/* ---------- אפליקציות אחרות ---------- */

@Composable
private fun AppsTab() {
    val ctx = LocalContext.current
    val g = LocalDmG.current
    Hint(stringResource(R.string.dmAppsS))
    listOf(
        stringResource(R.string.dmAppsLink) to "studiodm://add?url=https%3A%2F%2Fexample.com%2Ffile.zip&queue=Night",
        stringResource(R.string.dmAppsIntent) to "${DmApi.ADD}\nurl · urls · name · queue · folder · later · quiet\n${DmApi.PAUSE_ALL} · ${DmApi.RESUME_ALL} · ${DmApi.STATUS}",
        stringResource(R.string.dmAppsPerm) to DmR3.PERM_ADD,
        stringResource(R.string.dmAppsDone) to "${DmApi.QUEUE_DONE}  (queue · done · failed)",
    ).forEach { (k, v) ->
        Label(k)
        Text(v, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = g.fg, modifier = Modifier.fillMaxWidth().glassCard(g, RoundedCornerShape(14.dp))
            .clickable {
                ctx.getSystemService(android.content.ClipboardManager::class.java)?.setPrimaryClip(android.content.ClipData.newPlainText("dm", v))
                android.widget.Toast.makeText(ctx, R.string.dmCopied, android.widget.Toast.LENGTH_SHORT).show()
            }.padding(12.dp))
    }
    Hint(stringResource(R.string.dmAppsTile))
}

/* ---------- בפרטים של הורדה ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TaskPro(t: DmTask) {
    val ctx = LocalContext.current
    var q by remember(t.id) { mutableStateOf(t.q) }
    var lim by remember(t.id) { mutableStateOf(t.lim) }
    var done by remember(t.id) { mutableStateOf(t.onDone) }
    val hasQueues = remember { DmQueues.parse(DmPrefs(ctx).queues).isNotEmpty() }
    if (t.state == DmState.DONE) {
        if (t.sum.isNotEmpty()) {
            val (s, c) = when (t.sum) { "ok" -> R.string.dmSumOk to StGreen; "bad" -> R.string.dmSumBad to StRed; else -> R.string.dmSumNone to LocalDmG.current.mute }
            Text(stringResource(s), color = c, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 6.dp))
        }
        return
    }
    if (hasQueues) { Label(stringResource(R.string.dmProQueues)); QueueChips(q) { q = it; t.q = it; DmStore.save(); DmEngine.pump(ctx) } }
    Label(stringResource(R.string.dmTaskLimit))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        SPEEDS.forEach { b -> GChip(lim == b, { lim = b; t.lim = b; DmStore.save() }, { Text(spd(b)) }) }
    }
    if (t.kind == DmKind.YTDL && lim > 0) Hint(stringResource(R.string.dmTaskLimitYt))
    Label(stringResource(R.string.dmOnDone))
    ActChips(done) { done = it; t.onDone = it; t.tr = DmOnDone.A.STUDIO in DmOnDone.parse(it) || t.tr; DmStore.save() }
}

/* ---------- בודק APK לפני התקנה ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ApkCheckSheet(a: DmActivity, t: DmTask, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val g = LocalDmG.current
    var res by remember(t.id) { mutableStateOf<DmApkInspect.Res?>(null) }
    var busy by remember(t.id) { mutableStateOf(true) }
    LaunchedEffect(t.id) { res = withContext(Dispatchers.IO) { DmApkInspect.inspect(ctx, android.net.Uri.parse(t.uri)) }; busy = false }
    GSheet(onClose) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            Text(stringResource(R.string.dmApkCheck), fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Spacer(Modifier.height(10.dp))
            val r = res
            when {
                busy -> Row(verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.width(22.dp).height(22.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)); Text(stringResource(R.string.dmApkChecking)) }
                r == null -> Text(stringResource(R.string.dmApkCheckFail), color = StRed)
                else -> {
                    Text(r.label.ifEmpty { r.pkg }, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                    Text(r.pkg, color = g.mute, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(if (r.oldVName != null) stringResource(R.string.dmApkVer2, r.oldVName, r.vName) else stringResource(R.string.dmApkVer1, r.vName))
                    val (vs, vc) = when (r.verdict) {
                        DmApkCheck.V.NEW -> R.string.dmApkNew to g.fg
                        DmApkCheck.V.UPDATE -> R.string.dmApkUpdate to StGreen
                        DmApkCheck.V.SAME -> R.string.dmApkSame to g.fg
                        DmApkCheck.V.DOWNGRADE -> R.string.dmApkDown to g.orange
                        DmApkCheck.V.OTHER_SIG -> R.string.dmApkOtherSig to StRed
                        DmApkCheck.V.UNSIGNED -> R.string.dmApkUnsigned to StRed
                    }
                    Text(stringResource(vs), color = vc, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 8.dp))
                    if (r.risky.isNotEmpty()) {
                        Label(stringResource(R.string.dmApkRisky))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { r.risky.forEach { p -> GChip(false, {}, { Text(p, fontSize = 12.sp) }) } }
                    }
                    Label(stringResource(R.string.dmApkCert))
                    r.certs.take(2).forEach { c -> Text(c, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = g.mute) }
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val warn = r?.let { DmApkCheck.warn(it.verdict) } ?: !busy
                GButton(onClick = { onClose(); a.install(t) }, enabled = !busy) { Text(stringResource(if (warn) R.string.dmApkInstallAnyway else R.string.dmInstall)) }
                GTonal(onClick = onClose) { Text(stringResource(R.string.dmNotNow)) }
            }
        }
    }
}
