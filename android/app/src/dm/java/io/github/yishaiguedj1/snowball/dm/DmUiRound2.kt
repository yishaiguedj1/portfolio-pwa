package io.github.yishaiguedj1.snowball.dm

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

/* 01/11/2026 — השדרוג "מקצועי", סבב 2: המסכים (לפי ת־עיצוב ות־הורדות; רכיבי הזכוכית מ־DmGlass) */

/** הגדרה: Wi‑Fi וסלולר יחד, עם התקרה היומית (נגיעה בשורה = התקרה הבאה) */
@Composable
internal fun BondSetting() {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var on by remember { mutableStateOf(pr.bond) }
    var cap by remember { mutableStateOf(pr.bondCapMb) }
    val used = remember(on, cap) { DmBondNet.usedToday(pr) }
    ListItem(headlineContent = { Text(stringResource(R.string.dmSetBond)) },
        supportingContent = { Text(stringResource(R.string.dmSetBondS)) },
        trailingContent = { GSwitch(on, { on = it; pr.bond = it }) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
    if (on) ListItem(headlineContent = { Text(stringResource(R.string.dmSetBondCap)) },
        supportingContent = { Text(stringResource(R.string.dmSetBondUsed, DmFmt.size(ctx, used))) },
        trailingContent = { Text(if (cap == 0) stringResource(R.string.dmSetBondNoCap) else DmFmt.size(ctx, cap * 1024L * 1024L), color = LocalDmG.current.mute) },
        modifier = Modifier.clickable {
            val i = DmBond.CAPS_MB.indexOf(cap)
            cap = DmBond.CAPS_MB[(i + 1) % DmBond.CAPS_MB.size]; pr.bondCapMb = cap
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}

/** הגדרה: רענון אוטומטי של קישור שפג */
@Composable
internal fun AutoRefreshSetting() {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var on by remember { mutableStateOf(pr.autoRefresh) }
    ListItem(headlineContent = { Text(stringResource(R.string.dmSetAutoRef)) }, supportingContent = { Text(stringResource(R.string.dmSetAutoRefS)) },
        trailingContent = { GSwitch(on, { on = it; pr.autoRefresh = it }) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}

/** בפרטים: סרטון/קול שעוד יורד — לצפות כבר עכשיו (הנגן מחכה לחלקים שעוד לא ירדו) */
@Composable
internal fun WatchLive(a: DmActivity, t: DmTask) {
    val c = DmName.cat(t.name, t.mime)
    if (t.kind != DmKind.HTTP || t.state == DmState.DONE || t.uri.isEmpty() || t.got <= 0 || (c != DmName.Cat.VIDEO && c != DmName.Cat.AUDIO)) return
    GTonal(onClick = { a.watchLive(t) }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(stringResource(R.string.dmWatchLive)) }
}

/**
 * "כל הקישורים בדף" (פריט 4) עם בדיקה מקוונת (46): הדף נטען (HTML, בלי להריץ אותו), הקבצים לפי סוג, ואפשר לבדוק את כולם
 * (גודל, זמינות) לפני שבוחרים. דף שבונה את הקישורים ב־JavaScript — "פתיחה בדפדפן" (Studio Browser).
 */
@Composable
internal fun PageLinksBlock(a: DmActivity, page: String, ref: String, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val g = LocalDmG.current
    val scope = rememberCoroutineScope()
    var links by remember(page) { mutableStateOf<List<DmPageLinks.L>?>(null) }
    var base by remember(page) { mutableStateOf(page) }
    var err by remember(page) { mutableStateOf("") }
    var cat by remember(page) { mutableStateOf<DmName.Cat?>(null) }
    val sel = remember(page) { mutableStateMapOf<String, Boolean>() }
    val checks = remember(page) { mutableStateMapOf<String, DmPageLinks.Check>() }
    var checking by remember(page) { mutableStateOf(false) }
    LaunchedEffect(page) {
        withContext(Dispatchers.IO) {
            runCatching { DmPageLinks.fetch(page, ref, DmFetch.UA) }
                .onSuccess { (fin, html) -> base = fin; links = DmPageLinks.extract(html, fin) }
                .onFailure { e -> err = if (e is DmHttpError) DmRetry.http(e.status).code else if (e.message == "not_html") "page" else DmRetry.io(e).code }
        }
    }
    val all = links
    if (all == null) {
        if (err.isNotEmpty()) Text(DmFmt.err(ctx, err), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
        else Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = StRed)
            Text(stringResource(R.string.dmLinksLoading), Modifier.padding(start = 10.dp))
        }
        return
    }
    if (all.isEmpty()) { Text(stringResource(R.string.dmLinksNone), color = g.mute); return }
    val cats = remember(all) { listOf<DmName.Cat?>(null) + all.map { it.cat }.distinct() }
    val shown = all.filter { cat == null || it.cat == cat }
    Text(stringResource(R.string.dmLinksFound, all.size), fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(8.dp))
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(cats.size) { i ->
            val c = cats[i]
            GChip(cat == c, { cat = c }, label = { Text(catName(c) + " · " + (if (c == null) all.size else all.count { it.cat == c })) })
        }
    }
    Spacer(Modifier.height(6.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = { val on = shown.any { sel[it.url] != true }; shown.forEach { sel[it.url] = on } }) {
            Text(stringResource(if (shown.any { sel[it.url] != true }) R.string.dmLinksAll else R.string.dmLinksNoneSel))
        }
        Spacer(Modifier.weight(1f))
        if (checking) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = StRed)
        else TextButton(onClick = {
            checking = true
            scope.launch {
                val gate = Semaphore(6)
                withContext(Dispatchers.IO) {
                    shown.take(200).map { l -> async { gate.withPermit { if (checks[l.url] == null) checks[l.url] = DmPageLinks.check(l.url, base, DmFetch.UA) } } }.awaitAll()
                }
                checking = false
            }
        }) { Text(stringResource(R.string.dmLinksCheck)) }
    }
    Column(Modifier.fillMaxWidth()) {
        shown.take(300).forEach { l ->
            val ck = checks[l.url]
            Row(Modifier.fillMaxWidth().clickable { sel[l.url] = sel[l.url] != true }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(sel[l.url] == true, { sel[l.url] = it }, colors = CheckboxDefaults.colors(checkedColor = StRed))
                Column(Modifier.weight(1f)) {
                    Text(l.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
                    Text(DmLink.host(l.url) + when {
                        ck == null -> ""
                        ck.ok -> " · " + (if (ck.size > 0) DmFmt.size(ctx, ck.size) else stringResource(R.string.dmLinksOk))
                        else -> " · " + DmFmt.err(ctx, ck.code)
                    }, fontSize = 13.sp, color = if (ck != null && !ck.ok) androidx.compose.material3.MaterialTheme.colorScheme.error else g.mute, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        if (shown.size > 300) Text(stringResource(R.string.dmBatchMore, shown.size - 300), color = g.mute, fontSize = 13.sp)
    }
    Spacer(Modifier.height(12.dp))
    val pick = all.filter { sel[it.url] == true && checks[it.url]?.ok != false }.map { it.url }.take(DmLink.MAX_BATCH)
    GButton(onClick = { a.addBatch(pick, base) }, Modifier.fillMaxWidth().height(52.dp), enabled = pick.isNotEmpty()) {
        Text(stringResource(R.string.dmLinksGo, pick.size), fontSize = 17.sp)
    }
}

@Composable
private fun catName(c: DmName.Cat?): String = stringResource(when (c) {
    null -> R.string.dmCatAll; DmName.Cat.VIDEO -> R.string.dmCatVideo; DmName.Cat.AUDIO -> R.string.dmCatAudio
    DmName.Cat.DOC -> R.string.dmCatDoc; DmName.Cat.ARCHIVE -> R.string.dmCatArchive; DmName.Cat.IMAGE -> R.string.dmCatImage
    DmName.Cat.APK -> R.string.dmCatApk; DmName.Cat.OTHER -> R.string.dmCatOther
})
