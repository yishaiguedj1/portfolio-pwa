package io.github.yishaiguedj1.snowball.dm

import android.content.Intent
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.widget.Toast
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

/*
 * 02/11/2026 — השדרוג "מקצועי", סבב 4: הממשק. רק רכיבי הזכוכית (GButton/GTonal/GSwitch/GChip/GField/GSheet/glassCard),
 * וחלונות עם containerColor = g.dialog. כל מחרוזת ב־values וב־values-en.
 */

/** איזה גיליון של סבב 4 פתוח ("" = אף אחד): crawl · watch · subs · vault · lan:<id> */
object DmR4Ui {
    val sheet = mutableStateOf("")
}

@Composable private fun R2(title: String, sub: String, trailing: @Composable (() -> Unit)? = null, onClick: () -> Unit) {
    val g = LocalDmG.current
    ListItem(headlineContent = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }, supportingContent = { if (sub.isNotEmpty()) Text(sub, color = g.mute, maxLines = 2) },
        trailingContent = trailing, modifier = Modifier.padding(vertical = 3.dp).glassCard(g, RoundedCornerShape(18.dp)).clickable(onClick = onClick),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}
@Composable private fun H(s: String) = Text(s, color = LocalDmG.current.mute, fontSize = 13.sp, modifier = Modifier.padding(4.dp, 8.dp))
@Composable private fun L(s: String) = Text(s, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(top = 10.dp, bottom = 2.dp))
@Composable private fun T(s: String) = Text(s, fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(bottom = 8.dp))
private fun toast(ctx: android.content.Context, s: String) = Toast.makeText(ctx, s, Toast.LENGTH_LONG).show()

/* ---------- תפריט "עוד" ---------- */

@Composable
internal fun R4MenuItems(a: DmActivity, close: () -> Unit) {
    DropdownMenuItem({ Text(stringResource(R.string.dmScanPc)) }, { close(); scanQr(a) })
    DropdownMenuItem({ Text(stringResource(R.string.dmCrawlT)) }, { close(); DmR4Ui.sheet.value = "crawl" })
    DropdownMenuItem({ Text(stringResource(R.string.dmWatchT)) }, { close(); DmR4Ui.sheet.value = "watch" })
    DropdownMenuItem({ Text(stringResource(R.string.dmSubSearchT)) }, { close(); DmR4Ui.sheet.value = "subs" })
    DropdownMenuItem({ Text(stringResource(R.string.dmVaultT)) }, { close(); openVault(a) })
}

/** 11: קוד QR מהתוסף במחשב ("להוריד בטלפון") — הסורק של Google Play (בלי הרשאת מצלמה לאפליקציה), תמיד עם הגיליון */
fun scanQr(a: DmActivity) {
    runCatching {
        GmsBarcodeScanning.getClient(a).startScan()
            .addOnSuccessListener { b -> DmScan.parse(b.rawValue)?.let { r -> DmR3.take(a, r.copy(quiet = false)) } ?: toast(a, a.getString(R.string.dmScanBad)) }
            .addOnFailureListener { e -> if (e !is com.google.mlkit.common.MlKitException || e.errorCode != com.google.mlkit.common.MlKitException.CODE_SCANNER_CANCELLED) toast(a, a.getString(R.string.dmScanFail)) }
    }.onFailure { toast(a, a.getString(R.string.dmScanFail)) }
}

/** 29: הכספת — רק אחרי טביעת אצבע (ביומטריה חזקה של המכשיר; שום דבר לא יוצא מהטלפון) */
fun openVault(a: DmActivity) {
    val ok = if (Build.VERSION.SDK_INT >= 30) a.getSystemService(BiometricManager::class.java)?.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
        else @Suppress("DEPRECATION") a.getSystemService(BiometricManager::class.java)?.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
    if (!ok) { toast(a, a.getString(R.string.dmVaultNoBio)); return }
    val b = BiometricPrompt.Builder(a).setTitle(a.getString(R.string.dmVaultT)).setSubtitle(a.getString(R.string.dmVaultBioS))
    if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    b.setNegativeButton(a.getString(R.string.dmCancel), a.mainExecutor) { _, _ -> }
    b.build().authenticate(CancellationSignal(), a.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(r: BiometricPrompt.AuthenticationResult?) { DmR4Ui.sheet.value = "vault" }
    })
}

/* ---------- הגיליונות ---------- */

@Composable
internal fun R4Sheets(a: DmActivity, rev: Int) {
    val s by DmR4Ui.sheet
    val close = { DmR4Ui.sheet.value = "" }
    when {
        s == "crawl" -> CrawlSheet(a, close)
        s == "watch" -> WatchSheet(close)
        s == "subs" -> SubSearchSheet(a, close)
        s == "vault" -> VaultSheet(a, rev, close)
        s.startsWith("lan:") -> DmStore.get(s.removePrefix("lan:"))?.let { LanSheet(a, it, close) } ?: close()
    }
    val tp by DmR4.travelPrompt
    if (tp) TravelDialog { DmR4.travelPrompt.value = false }
}

/* ---------- 5: סורק אתר ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CrawlSheet(a: DmActivity, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val p4 = remember { DmPrefs4(ctx) }
    val jobs = remember { mutableStateListOf<DmCrawlJob>().apply { addAll(DmCrawl.parseJobs(p4.crawls)) } }
    var start by remember { mutableStateOf(DmLink.first(a.clipUrl.value)) }
    var depth by remember { mutableIntStateOf(1) }
    var kind by remember { mutableStateOf("video") }
    var exts by remember { mutableStateOf("") }
    var minKb by remember { mutableStateOf("") }
    var maxMb by remember { mutableStateOf("") }
    var running by remember { mutableStateOf(false) }
    var pages by remember { mutableIntStateOf(0) }
    val found = remember { mutableStateListOf<DmCrawl.Found>() }
    var sel by remember { mutableStateOf(setOf<String>()) }
    var cur by remember { mutableStateOf<DmCrawlJob?>(null) }
    val scope = rememberCoroutineScope()
    fun job(): DmCrawlJob {
        val es = if (kind == "custom") exts.split(',', ' ').map { it.trim().trimStart('.').lowercase() }.filter { it.isNotEmpty() }.toSet() else DmCrawl.PRESETS[kind] ?: emptySet()
        return (cur ?: DmCrawlJob("c" + System.currentTimeMillis(), start.trim())).copy(start = start.trim(), depth = depth, exts = es,
            minKb = minKb.toLongOrNull() ?: 0, maxMb = maxMb.toLongOrNull() ?: 0)
    }
    fun run(j: DmCrawlJob) {
        found.clear(); sel = emptySet(); pages = 0; running = true; cur = j
        scope.launch {
            withContext(Dispatchers.IO) { DmR4.crawl(j, { f -> scope.launch { found.add(f); sel = sel + f.url } }, { n -> pages = n }) }
            running = false
        }
    }
    GSheet({ DmR4.crawlStop = true; onClose() }) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            T(stringResource(R.string.dmCrawlT))
            H(stringResource(R.string.dmCrawlS))
            GField(start, { start = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmLink)) }, shape = RoundedCornerShape(14.dp))
            L(stringResource(R.string.dmCrawlDepth))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { (1..3).forEach { d -> GChip(depth == d, { depth = d }, { Text(d.toString()) }) } }
            L(stringResource(R.string.dmCrawlKind))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("video" to R.string.dmCatVideo, "audio" to R.string.dmCatAudio, "doc" to R.string.dmCatDoc, "archive" to R.string.dmCatArchive,
                    "image" to R.string.dmCatImage, "apk" to R.string.dmCatApk, "" to R.string.dmCatAll, "custom" to R.string.dmCrawlCustom).forEach { (k, s) ->
                    GChip(kind == k, { kind = k }, { Text(stringResource(s)) })
                }
            }
            if (kind == "custom") GField(exts, { exts = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmCrawlExts)) }, shape = RoundedCornerShape(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GField(minKb, { minKb = it.filter(Char::isDigit).take(7) }, Modifier.weight(1f), singleLine = true, label = { Text(stringResource(R.string.dmCrawlMinKb)) }, shape = RoundedCornerShape(14.dp))
                GField(maxMb, { maxMb = it.filter(Char::isDigit).take(6) }, Modifier.weight(1f), singleLine = true, label = { Text(stringResource(R.string.dmCrawlMaxMb)) }, shape = RoundedCornerShape(14.dp))
            }
            Spacer(Modifier.height(10.dp))
            if (running) Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Text(stringResource(R.string.dmCrawlProg, pages, found.size), Modifier.padding(start = 10.dp).weight(1f))
                TextButton({ DmR4.crawlStop = true }) { Text(stringResource(R.string.dmBatchStop)) }
            } else GButton({ run(job()) }, Modifier.fillMaxWidth(), enabled = start.trim().startsWith("http")) { Text(stringResource(R.string.dmCrawlGo)) }
            H(stringResource(R.string.dmCrawlPolite))
            if (found.isNotEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.dmCrawlFound, found.size, sel.size), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                    TextButton({ sel = if (sel.size == found.size) emptySet() else found.map { it.url }.toSet() }) {
                        Text(stringResource(if (sel.size == found.size) R.string.dmPlNone else R.string.dmPlAll))
                    }
                }
                found.forEach { f ->
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().clickable { sel = if (f.url in sel) sel - f.url else sel + f.url }) {
                        Checkbox(f.url in sel, { sel = if (it) sel + f.url else sel - f.url })
                        Column(Modifier.weight(1f)) {
                            Text(f.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(DmLink.host(f.from), color = LocalDmG.current.mute, fontSize = 12.sp, maxLines = 1)
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                GButton({
                    val j = job().let { it.copy(seen = (it.seen + found.map { f -> f.url }).takeLast(2000)) }
                    jobs.removeAll { it.id == j.id }; jobs.add(0, j); p4.crawls = DmCrawl.dumpJobs(jobs)
                    a.addBatch(found.map { it.url }.filter { it in sel }, j.start); onClose()
                }, Modifier.fillMaxWidth(), enabled = sel.isNotEmpty()) { Text(stringResource(R.string.dmBatchGo, sel.size)) }
            }
            if (jobs.isNotEmpty() && !running) {
                L(stringResource(R.string.dmCrawlSaved))
                jobs.forEach { j ->
                    R2(DmLink.host(j.start) + j.start.substringAfter(DmLink.host(j.start)).take(40), stringResource(R.string.dmCrawlSavedS, j.depth, j.seen.size),
                        trailing = { TextButton({ jobs.remove(j); p4.crawls = DmCrawl.dumpJobs(jobs) }) { Text(stringResource(R.string.dmDelete)) } }) {
                        start = j.start; depth = j.depth; cur = j; run(j)
                    }
                }
            }
        }
    }
}

/* ---------- 7/38: תור סנכרון ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WatchSheet(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val ws = remember { mutableStateListOf<DmWatch>().apply { addAll(DmR4.watches(ctx)) } }
    var edit by remember { mutableStateOf<DmWatch?>(null) }
    val scope = rememberCoroutineScope()
    fun save() = DmR4.saveWatches(ctx, ws.toList())
    GSheet(onClose) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            T(stringResource(R.string.dmWatchT))
            H(stringResource(R.string.dmWatchS))
            ws.forEach { w ->
                val sub = listOf(stringResource(when (w.kind) { "file" -> R.string.dmWatchFile; "feed" -> R.string.dmWatchFeed; else -> R.string.dmWatchList }),
                    stringResource(R.string.dmWatchEvery, w.everyH),
                    if (w.checked > 0) stringResource(R.string.dmWatchChecked, android.text.format.DateUtils.getRelativeTimeSpanString(w.checked).toString()) else "",
                    if (w.err.isNotEmpty()) stringResource(R.string.dmWatchErr) else "").filter { it.isNotEmpty() }.joinToString(" · ")
                R2(w.name.ifEmpty { DmLink.host(w.url) }, sub, trailing = {
                    TextButton({ scope.launch { val n = withContext(Dispatchers.IO) { DmR4.checkWatches(ctx, w.id) }; ws.clear(); ws.addAll(DmR4.watches(ctx)); toast(ctx, ctx.resources.getQuantityString(R.plurals.dmWatchNewS, n, n)) } }) {
                        Text(stringResource(R.string.dmWatchNow))
                    }
                }) { edit = w }
            }
            Spacer(Modifier.height(8.dp))
            GTonal({ edit = DmWatch(DmWatches.newId(ws), "", "feed") }, Modifier.fillMaxWidth(), enabled = ws.size < DmWatches.MAX) { Text(stringResource(R.string.dmWatchAdd)) }
        }
    }
    edit?.let { w0 ->
        WatchDialog(w0, onDone = { w -> edit = null; if (w != null) { val i = ws.indexOfFirst { it.id == w.id }; if (i >= 0) ws[i] = w else ws.add(w); save() } },
            onDelete = { edit = null; ws.removeAll { it.id == w0.id }; save() })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WatchDialog(w0: DmWatch, onDone: (DmWatch?) -> Unit, onDelete: () -> Unit) {
    val g = LocalDmG.current
    var url by remember { mutableStateOf(w0.url) }
    var kind by remember { mutableStateOf(w0.kind) }
    var every by remember { mutableIntStateOf(w0.everyH) }
    var keep by remember { mutableStateOf(if (w0.keep > 0) w0.keep.toString() else "") }
    var audio by remember { mutableStateOf(w0.audio) }
    AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { onDone(null) },
        title = { Text(stringResource(R.string.dmWatchT)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                GField(url, { url = it.trim(); if (DmSmart.feedUrl(url) || DmFeed.youtubeFeed(url) != null) kind = "feed" }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(stringResource(R.string.dmLink)) }, shape = RoundedCornerShape(14.dp))
                L(stringResource(R.string.dmWatchKind))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("feed" to R.string.dmWatchFeed, "list" to R.string.dmWatchList, "file" to R.string.dmWatchFile).forEach { (k, s) -> GChip(kind == k, { kind = k }, { Text(stringResource(s)) }) }
                }
                L(stringResource(R.string.dmWatchEveryT))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(3, 6, 12, 24, 72, 168).forEach { h -> GChip(every == h, { every = h }, { Text(stringResource(R.string.dmWatchEvery, h)) }) }
                }
                if (kind != "file") {
                    GField(keep, { keep = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true,
                        label = { Text(stringResource(R.string.dmWatchKeep)) }, shape = RoundedCornerShape(14.dp))
                    ListItem(headlineContent = { Text(stringResource(R.string.dmWatchAudio)) }, trailingContent = { GSwitch(audio, { audio = it }) },
                        colors = ListItemDefaults.colors(containerColor = Color.Transparent))
                }
                H(stringResource(R.string.dmWatchLaterHint))
            }
        },
        confirmButton = { TextButton({ onDone(w0.copy(url = url, kind = kind, everyH = every, keep = keep.toIntOrNull() ?: 0, audio = audio)) }, enabled = url.startsWith("http")) { Text(stringResource(R.string.dmSave)) } },
        dismissButton = { if (w0.url.isNotEmpty()) TextButton(onDelete) { Text(stringResource(R.string.dmDelete)) } })
}

/* ---------- 37: חיפוש בכתוביות ---------- */

@Composable
private fun SubSearchSheet(a: DmActivity, onClose: () -> Unit) {
    val ctx = LocalContext.current
    var q by remember { mutableStateOf("") }
    var hits by remember { mutableStateOf<List<DmSubIndex.Hit>>(emptyList()) }
    LaunchedEffect(q) {
        kotlinx.coroutines.delay(250)
        hits = if (q.trim().length < 2) emptyList() else withContext(Dispatchers.IO) { DmR4.searchSubs(ctx, q) }
    }
    GSheet(onClose) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            T(stringResource(R.string.dmSubSearchT))
            GField(q, { q = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmSubSearchQ)) }, shape = RoundedCornerShape(14.dp))
            H(stringResource(R.string.dmSubSearchS))
            hits.forEach { h ->
                val t = DmStore.get(h.id) ?: return@forEach
                R2(h.text, (t.title.ifEmpty { t.name }) + " · " + DmClip.fmt((h.ms / 1000).toInt())) {
                    a.getSharedPreferences("dm-player", android.content.Context.MODE_PRIVATE).edit().putLong("p:" + Uri.parse(t.uri).toString().hashCode(), h.ms).apply()
                    a.open(t)
                }
            }
        }
    }
}

/* ---------- 29: הכספת ---------- */

@Composable
private fun VaultSheet(a: DmActivity, rev: Int, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val list = remember(rev) { DmStore.all().filter { it.priv && it.state == DmState.DONE } }
    GSheet(onClose) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            T(stringResource(R.string.dmVaultT))
            H(stringResource(R.string.dmVaultS))
            if (list.isEmpty()) H(stringResource(R.string.dmVaultEmpty))
            list.forEach { t ->
                R2(t.name.ifEmpty { t.title }, DmFmt.size(ctx, t.total), trailing = {
                    TextButton({ DmEngine.delete(ctx, t.id, true) }) { Text(stringResource(R.string.dmDelete)) }
                }) { a.open(t) }
            }
        }
    }
}

/* ---------- 12: מהטלפון למחשב ---------- */

@Composable
private fun LanSheet(a: DmActivity, t: DmTask, onClose: () -> Unit) {
    val ctx = LocalContext.current
    var st by remember { mutableStateOf<Pair<DmLanServer, String>?>(null) }
    var ended by remember { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(t.id) { st = withContext(Dispatchers.IO) { DmR4.lanStart(ctx.applicationContext, t) { ok -> ended = ok } } }
    GSheet({ DmR4.lan?.stop(false); onClose() }) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
            T(stringResource(R.string.dmLanT))
            val s = st
            when {
                ended == true -> H(stringResource(R.string.dmLanDone))
                ended == false -> H(stringResource(R.string.dmLanClosed))
                s == null -> H(stringResource(R.string.dmLanNoWifi))
                else -> {
                    val bm = remember(s.second) { DmR4.qr(s.second) }
                    Image(bm.asImageBitmap(), null, Modifier.size(220.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(s.second, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                    Spacer(Modifier.height(10.dp))
                    Text(stringResource(R.string.dmLanPin), color = LocalDmG.current.mute)
                    Text(s.first.pin, fontFamily = FontFamily.Monospace, fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = 6.sp)
                    H(stringResource(R.string.dmLanS))
                }
            }
            GTonal({ DmR4.lan?.stop(false); onClose() }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmClose)) }
        }
    }
}

/* ---------- 24: מצב חו"ל ---------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TravelDialog(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val g = LocalDmG.current
    val p4 = remember { DmPrefs4(ctx) }
    val st = rememberDatePickerState(initialSelectedDateMillis = System.currentTimeMillis() + 7 * 86_400_000L,
        selectableDates = object : androidx.compose.material3.SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis >= System.currentTimeMillis() - 86_400_000L
        })
    var roamOk by remember { mutableStateOf(p4.roamOk) }
    DatePickerDialog(onDismissRequest = onClose, colors = DatePickerDefaults.colors(containerColor = g.dialog), shape = RoundedCornerShape(28.dp),
        confirmButton = {
            TextButton({
                st.selectedDateMillis?.let { ms ->
                    val c = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = ms }
                    p4.travelUntil = DmTravel.endOfDay(c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH))
                }
                p4.roamOk = roamOk
                onClose(); DmEngine.pump(ctx)
            }) { Text(stringResource(R.string.dmTravelOn)) }
        },
        dismissButton = { TextButton(onClose) { Text(stringResource(R.string.dmNotNow)) } }) {
        Column {
            Text(stringResource(R.string.dmTravelT), fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(24.dp, 16.dp, 24.dp, 0.dp))
            Text(stringResource(R.string.dmTravelS), color = g.mute, fontSize = 14.sp, modifier = Modifier.padding(24.dp, 4.dp))
            ListItem(headlineContent = { Text(stringResource(R.string.dmTravelRoam)) }, supportingContent = { Text(stringResource(R.string.dmTravelRoamS), color = g.mute) },
                trailingContent = { GSwitch(roamOk, { roamOk = it }) }, colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                modifier = Modifier.padding(horizontal = 8.dp))
            DatePicker(st, title = null, headline = null, showModeToggle = false, colors = DatePickerDefaults.colors(containerColor = g.dialog))
        }
    }
}

/** כרטיס בראש ההורדות: מצב חו"ל פעיל (עד מתי, כיבוי), או נדידה שמחכה לתשובה */
@Composable
internal fun TravelCard(rev: Int) {
    val ctx = LocalContext.current
    val p4 = remember { DmPrefs4(ctx) }
    val until = remember(rev) { p4.travelUntil }
    val roamWait = remember(rev) { DmStore.all().any { it.state == DmState.WAITING && it.err == "roam" } }
    val g = LocalDmG.current
    if (until > System.currentTimeMillis()) {
        R2(stringResource(R.string.dmTravelActive, java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM).format(java.util.Date(until))),
            stringResource(if (p4.roamOk) R.string.dmTravelActiveRoam else R.string.dmTravelActiveWifi),
            trailing = { TextButton({ p4.travelUntil = 0; DmStore.ping(); DmEngine.pump(ctx) }) { Text(stringResource(R.string.dmTravelOff)) } }) { DmR4.travelPrompt.value = true }
    } else if (roamWait) {
        R2(stringResource(R.string.dmRoamN), stringResource(R.string.dmRoamS), trailing = { Text("›", color = g.mute, fontSize = 22.sp) }) { DmR4.travelPrompt.value = true }
    }
}

/* ---------- גיליון ההוספה: סרטון (33/34/35/29), קובץ (29), סוג הקישור (39) ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun VideoPro4(url: String, info: JSONObject, sizes: List<Long>, audio: Boolean, setQ: (Int) -> Unit, setAudio: (Boolean) -> Unit) {
    val dur = info.optInt("d", 0)
    var from by remember(url) { mutableStateOf("") }
    var to by remember(url) { mutableStateOf("") }
    var cv by remember(url) { mutableStateOf("") }
    var chm by remember(url) { mutableStateOf("") }
    var priv by remember(url) { mutableStateOf(false) }
    var fit by remember(url) { mutableStateOf("") }
    var open by remember(url) { mutableStateOf(false) }
    val s0 = DmClip.parse(from) ?: 0; val s1 = DmClip.parse(to) ?: 0
    val clipOk = from.isEmpty() && to.isEmpty() || DmClip.valid(s0, if (to.isEmpty() && dur > 0) dur else s1, dur)
    SideEffect {
        DmR4.nextVideo = DmR4.Video(url, if (clipOk) s0 else 0, if (clipOk) (if (to.isEmpty() && from.isNotEmpty()) dur else s1) else 0, cv, chm, priv, System.currentTimeMillis() + 120_000)
    }
    val g = LocalDmG.current
    Text(stringResource(if (open) R.string.dmMoreOptsHide else R.string.dmMoreOpts), color = StRed, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clickable { open = !open }.padding(vertical = 8.dp))
    if (!open) return
    L(stringResource(R.string.dmCutT))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        GField(from, { from = it.take(9) }, Modifier.weight(1f), singleLine = true, label = { Text(stringResource(R.string.dmCutFrom)) }, shape = RoundedCornerShape(14.dp))
        GField(to, { to = it.take(9) }, Modifier.weight(1f), singleLine = true, label = { Text(if (dur > 0) DmClip.fmt(dur) else stringResource(R.string.dmCutTo)) }, shape = RoundedCornerShape(14.dp))
    }
    if (!clipOk) Text(stringResource(R.string.dmCutBad), color = StRed, fontSize = 13.sp)
    L(stringResource(R.string.dmConvT))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("" to R.string.dmConvNone, "mp4" to R.string.dmConvMp4, "mp3" to R.string.dmConvMp3, "m4a" to R.string.dmConvM4a, "opus" to R.string.dmConvOpus).forEach { (k, s) ->
            GChip(cv == k, { cv = k; if (DmConv.audio(k)) setAudio(true) else if (k == "mp4") setAudio(false) }, { Text(stringResource(s)) })
        }
    }
    if (!audio && !DmConv.audio(cv)) {
        L(stringResource(R.string.dmFitT))
        Row(verticalAlignment = Alignment.CenterVertically) {
            GField(fit, { fit = it.filter(Char::isDigit).take(5) }, Modifier.width(140.dp), singleLine = true, label = { Text("MB") }, shape = RoundedCornerShape(14.dp))
            Spacer(Modifier.width(8.dp))
            GTonal({ DmConv.fit(sizes, (fit.toLongOrNull() ?: 0) shl 20)?.let(setQ) }, enabled = fit.isNotEmpty()) { Text(stringResource(R.string.dmFitGo)) }
        }
    }
    L(stringResource(R.string.dmChapT))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("" to R.string.dmChapNone, "list" to R.string.dmChapList, "split" to R.string.dmChapSplit).forEach { (k, s) -> GChip(chm == k, { chm = k }, { Text(stringResource(s)) }) }
    }
    ListItem(headlineContent = { Text(stringResource(R.string.dmPrivT)) }, supportingContent = { Text(stringResource(R.string.dmPrivS), color = g.mute) },
        trailingContent = { GSwitch(priv, { priv = it }) }, colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}

@Composable
internal fun FilePro4(url: String) {
    val g = LocalDmG.current
    var priv by remember(url) { mutableStateOf(false) }
    SideEffect { DmR4.nextPriv = if (priv) url to System.currentTimeMillis() + 120_000 else null }
    ListItem(headlineContent = { Text(stringResource(R.string.dmPrivT)) }, supportingContent = { Text(stringResource(R.string.dmPrivS), color = g.mute) },
        trailingContent = { GSwitch(priv, { priv = it }) }, colors = ListItemDefaults.colors(containerColor = Color.Transparent))
}

/** 39: מה הודבק — פעולה שמתאימה (Metalink, פיד למעקב, קוד מהמחשב, magnet שלא נתמך) */
@Composable
internal fun SmartRow(a: DmActivity, text: String, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val k = remember(text) { DmSmart.kind(text) }
    val scope = rememberCoroutineScope()
    var busy by remember(text) { mutableStateOf(false) }
    when (k) {
        DmSmart.K.METALINK -> GButton({
            busy = true
            scope.launch {
                val t = text.trim()
                val n = withContext(Dispatchers.IO) { if (DmMeta4.looks(t)) DmR4.addMetalink(ctx, t) else DmR4.addMetalinkUrl(ctx, DmLink.first(t)) }
                busy = false
                if (n > 0) { a.askNotifications(); onClose() } else toast(ctx, ctx.getString(R.string.dmMetaBad))
            }
        }, Modifier.fillMaxWidth().padding(bottom = 10.dp), enabled = !busy) { Text(stringResource(R.string.dmMetaGo)) }
        DmSmart.K.FEED -> GTonal({
            val ws = DmR4.watches(ctx)
            val u = DmLink.first(text)
            if (ws.none { it.url == u }) DmR4.saveWatches(ctx, ws + DmWatch(DmWatches.newId(ws), u, "feed"))
            toast(ctx, ctx.getString(R.string.dmWatchAdded)); onClose(); DmR4Ui.sheet.value = "watch"
        }, Modifier.fillMaxWidth().padding(bottom = 10.dp)) { Text(stringResource(R.string.dmFeedGo)) }
        DmSmart.K.STUDIODM -> GTonal({ DmApi.fromUri(text.trim())?.let { DmR3.take(a, it.copy(quiet = false)) } }, Modifier.fillMaxWidth().padding(bottom = 10.dp)) { Text(stringResource(R.string.dmCheck)) }
        DmSmart.K.MAGNET -> H(stringResource(R.string.dmMagnetNo))
        else -> {}
    }
    // פלייליסט / ערוץ — אפשר גם לעקוב (הורדה אוטומטית של מה שחדש)
    if (k == DmSmart.K.ONE && DmPlaylist.listUrl(DmLink.first(text)).isNotEmpty()) TextButton({
        val ws = DmR4.watches(ctx); val u = DmPlaylist.listUrl(DmLink.first(text))
        if (ws.none { it.url == u }) DmR4.saveWatches(ctx, ws + DmWatch(DmWatches.newId(ws), u, "list"))
        toast(ctx, ctx.getString(R.string.dmWatchAdded))
    }) { Text(stringResource(R.string.dmFollowList)) }
}

/* ---------- פרטי ההורדה: תגיות והערה (28), פרקים (35), סיכום (47), למחשב (12) ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TaskPro4(a: DmActivity, t: DmTask) {
    val g = LocalDmG.current
    var tags by remember(t.id) { mutableStateOf(t.tags) }
    var note by remember(t.id) { mutableStateOf(t.note) }
    if (t.state == DmState.DONE) {
        L(stringResource(R.string.dmTagsT))
        GField(tags, { tags = it.take(200); t.tags = DmLib.tags(tags).joinToString(", "); DmStore.save() }, Modifier.fillMaxWidth(), singleLine = true,
            label = { Text(stringResource(R.string.dmTagsHint)) }, shape = RoundedCornerShape(14.dp))
        GField(note, { note = it.take(500); t.note = note; DmStore.save() }, Modifier.fillMaxWidth().padding(top = 6.dp), maxLines = 4,
            label = { Text(stringResource(R.string.dmNoteHint)) }, shape = RoundedCornerShape(14.dp))
    }
    val chs = remember(t.chp) { DmChap.parse(t.chp) }
    if (chs.isNotEmpty()) {
        L(stringResource(R.string.dmChapters))
        chs.take(30).forEach { c -> Text(DmClip.fmt(c.start) + "  " + c.title, color = g.mute, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    }
    if (t.mirrors().size > 1) H(stringResource(R.string.dmMirrors, t.mirrors().size))
    if (t.dg.isNotEmpty() && t.sum.isEmpty() && t.state != DmState.DONE) H(stringResource(R.string.dmDigestWill))
    if (t.state == DmState.DONE && !t.priv && t.uri.isNotEmpty()) {
        Spacer(Modifier.height(8.dp))
        GTonal({ DmR4Ui.sheet.value = "lan:" + t.id }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmLanT)) }
    }
}

/* ---------- 28: ספרייה מקצועית ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun LibraryTools(all: List<DmTask>, q: DmLib.Q, setQ: (DmLib.Q) -> Unit, selecting: Boolean, setSelecting: (Boolean) -> Unit) {
    val tags = remember(all) { DmLib.allTags(all) }
    Column(Modifier.padding(16.dp, 0.dp, 16.dp, 6.dp)) {
        GField(q.text, { setQ(q.copy(text = it.take(80))) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmLibSearch)) }, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(6.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf(DmLib.Sort.DATE to R.string.dmSortDate, DmLib.Sort.SIZE to R.string.dmSortSize, DmLib.Sort.SITE to R.string.dmSortSite, DmLib.Sort.NAME to R.string.dmSortName).forEach { (s, r) ->
                GChip(q.sort == s, { setQ(q.copy(sort = s)) }, { Text(stringResource(r)) })
            }
            GChip(selecting, { setSelecting(!selecting) }, { Text(stringResource(R.string.dmSelect)) })
            tags.forEach { tg -> GChip(q.tag == tg, { setQ(q.copy(tag = if (q.tag == tg) "" else tg)) }, { Text("#$tg") }) }
        }
    }
}

@Composable
internal fun SelectRow(t: DmTask, on: Boolean, flip: () -> Unit) {
    val ctx = LocalContext.current
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().glassCard(LocalDmG.current, RoundedCornerShape(18.dp)).clickable(onClick = flip).padding(6.dp)) {
        Checkbox(on, { flip() })
        Column(Modifier.weight(1f)) {
            Text(t.name.ifEmpty { t.title }, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(DmFmt.size(ctx, t.total) + (DmLib.tags(t.tags).takeIf { it.isNotEmpty() }?.joinToString(" ", " · ") { "#$it" } ?: ""), color = LocalDmG.current.mute, fontSize = 12.sp)
        }
    }
}

@Composable
internal fun SelectBar(a: DmActivity, sel: Set<String>, clear: () -> Unit) {
    val ctx = LocalContext.current
    var tagDlg by remember { mutableStateOf(false) }
    var del by remember { mutableStateOf(false) }
    val g = LocalDmG.current
    Row(Modifier.fillMaxWidth().padding(16.dp, 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(pluralStringResource(R.plurals.dmSelN, sel.size, sel.size), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
        GTonal({ tagDlg = true }, enabled = sel.isNotEmpty()) { Text(stringResource(R.string.dmTagsT)) }
        GTonal({
            val us = sel.mapNotNull { DmStore.get(it) }.filter { it.uri.isNotEmpty() && !it.priv }.map { Uri.parse(it.uri) }
            if (us.isNotEmpty()) runCatching {
                a.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND_MULTIPLE).setType("*/*").putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(us))
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), null))
            }
        }, enabled = sel.isNotEmpty()) { Text(stringResource(R.string.dmShare)) }
        GButton({ del = true }, enabled = sel.isNotEmpty()) { Text(stringResource(R.string.dmDelete)) }
    }
    if (tagDlg) {
        var s by remember { mutableStateOf("") }
        AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { tagDlg = false },
            title = { Text(stringResource(R.string.dmTagsT)) },
            text = { GField(s, { s = it.take(100) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmTagsHint)) }, shape = RoundedCornerShape(14.dp)) },
            confirmButton = { TextButton({
                val add = DmLib.tags(s)
                sel.mapNotNull { DmStore.get(it) }.forEach { t -> t.tags = DmLib.tags((DmLib.tags(t.tags) + add).joinToString(",")).joinToString(", ") }
                DmStore.save(); tagDlg = false
            }) { Text(stringResource(R.string.dmSave)) } },
            dismissButton = { TextButton({ tagDlg = false }) { Text(stringResource(R.string.dmCancel)) } })
    }
    if (del) AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { del = false },
        title = { Text(pluralStringResource(R.plurals.dmSelDelT, sel.size, sel.size)) }, text = { Text(stringResource(R.string.dmSelDelS)) },
        confirmButton = { TextButton({ sel.forEach { DmEngine.delete(ctx, it, true) }; del = false; clear() }) { Text(stringResource(R.string.dmDeleteFile)) } },
        dismissButton = { TextButton({ sel.forEach { DmEngine.delete(ctx, it, false) }; del = false; clear() }) { Text(stringResource(R.string.dmRemove)) } })
}

/* ---------- לשוניות ההגדרות המקצועיות של סבב 4 ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun NetTab() {
    val ctx = LocalContext.current
    val p4 = remember { DmPrefs4(ctx) }
    var proxy by remember { mutableStateOf(p4.proxy) }
    var cs by remember { mutableIntStateOf(p4.connectS) }
    var rs by remember { mutableIntStateOf(p4.readS) }
    var ua by remember { mutableStateOf(p4.ua) }
    fun apply() { p4.proxy = proxy.trim(); p4.connectS = cs; p4.readS = rs; p4.ua = ua; DmR4.applyNet(ctx) }
    H(stringResource(R.string.dmNetS))
    GField(proxy, { proxy = it.take(120); apply() }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmNetProxy)) }, shape = RoundedCornerShape(14.dp))
    if (proxy.isNotBlank() && DmNet.parseProxy(proxy) == null) Text(stringResource(R.string.dmNetProxyBad), color = StRed, fontSize = 13.sp)
    L(stringResource(R.string.dmNetConnect))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(10, 20, 40, 60).forEach { s -> GChip(cs == s, { cs = s; apply() }, { Text(stringResource(R.string.dmSec, s)) }) } }
    L(stringResource(R.string.dmNetRead))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(15, 30, 60, 120).forEach { s -> GChip(rs == s, { rs = s; apply() }, { Text(stringResource(R.string.dmSec, s)) }) } }
    L(stringResource(R.string.dmNetUa))
    GField(ua, { ua = it.take(4000); apply() }, Modifier.fillMaxWidth(), maxLines = 6, label = { Text(stringResource(R.string.dmNetUaHint)) }, shape = RoundedCornerShape(14.dp))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 6.dp)) {
        DmNet.UA_PRESETS.forEach { (k, v) -> GChip(false, { ua = (ua.trimEnd() + "\nexample.com=" + v).trimStart(); apply() }, { Text(k) }) }
    }
}

@Composable
internal fun LoginsTab() {
    val ctx = LocalContext.current
    val cs = remember { mutableStateListOf<DmCred>().apply { addAll(DmCreds.all(ctx)) } }
    var edit by remember { mutableStateOf<DmCred?>(null) }
    val g = LocalDmG.current
    H(stringResource(R.string.dmLoginsS))
    cs.forEach { c -> R2(c.host, c.user) { edit = c } }
    GTonal({ edit = DmCred("", "", "") }, Modifier.fillMaxWidth().padding(top = 6.dp)) { Text(stringResource(R.string.dmLoginAdd)) }
    edit?.let { c0 ->
        var host by remember(c0) { mutableStateOf(c0.host) }
        var user by remember(c0) { mutableStateOf(c0.user) }
        var pass by remember(c0) { mutableStateOf(c0.pass) }
        AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { edit = null },
            title = { Text(stringResource(R.string.dmLoginT)) },
            text = {
                Column {
                    GField(host, { host = it.trim().take(253) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmLoginHost)) }, shape = RoundedCornerShape(14.dp))
                    GField(user, { user = it.take(200) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true, label = { Text(stringResource(R.string.dmLoginUser)) }, shape = RoundedCornerShape(14.dp))
                    GField(pass, { pass = it.take(500) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true, label = { Text(stringResource(R.string.dmLoginPass)) }, shape = RoundedCornerShape(14.dp),
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation())
                    H(stringResource(R.string.dmLoginHint))
                }
            },
            confirmButton = { TextButton({
                val h = DmAuth.hostOf(host)
                if (h.isNotEmpty() && user.isNotEmpty()) { cs.removeAll { it.host == c0.host || it.host == h }; cs.add(DmCred(h, user, pass)); runCatching { DmCreds.save(ctx, cs.toList()) } }
                edit = null
            }, enabled = DmAuth.hostOf(host).isNotEmpty() && user.isNotEmpty()) { Text(stringResource(R.string.dmSave)) } },
            dismissButton = { if (c0.host.isNotEmpty()) TextButton({ cs.removeAll { it.host == c0.host }; runCatching { DmCreds.save(ctx, cs.toList()) }; edit = null }) { Text(stringResource(R.string.dmDelete)) } })
    }
}

@Composable
internal fun ExclTab() {
    val ctx = LocalContext.current
    val p4 = remember { DmPrefs4(ctx) }
    var s by remember { mutableStateOf(p4.excl) }
    H(stringResource(R.string.dmExclS))
    GField(s, { s = it.take(8000); p4.excl = s }, Modifier.fillMaxWidth(), maxLines = 10, label = { Text(stringResource(R.string.dmExclHint)) }, shape = RoundedCornerShape(14.dp))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MoreTab() {
    val ctx = LocalContext.current
    val p4 = remember { DmPrefs4(ctx) }
    var pro by remember { mutableStateOf(p4.pro) }
    var dly by remember { mutableStateOf(p4.dailyOn) }
    var cln by remember { mutableIntStateOf(p4.cleanDays) }
    val until = p4.travelUntil
    R2(stringResource(R.string.dmProMode), stringResource(R.string.dmProModeS), trailing = { GSwitch(pro, { pro = it; p4.pro = it; DmStore.ping() }) }) { pro = !pro; p4.pro = pro; DmStore.ping() }
    R2(stringResource(R.string.dmDailyT), stringResource(R.string.dmDailyTS), trailing = { GSwitch(dly, { dly = it; p4.dailyOn = it }) }) { dly = !dly; p4.dailyOn = dly }
    R2(stringResource(R.string.dmTravelT), if (until > System.currentTimeMillis()) stringResource(R.string.dmTravelActive,
        java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM).format(java.util.Date(until))) else stringResource(R.string.dmTravelOffS)) { DmR4.travelPrompt.value = true }
    L(stringResource(R.string.dmCleanT))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(0, 7, 30, 90, 365).forEach { d -> GChip(cln == d, { cln = d; p4.cleanDays = d }, { Text(if (d == 0) stringResource(R.string.dmLimitOff) else pluralStringResource(R.plurals.dmDays, d, d)) }) }
    }
    H(stringResource(R.string.dmCleanS))
    H(stringResource(R.string.dmWidgetHint))
}

/** 42: מצב מקצוען כבוי — בלי השורות הטכניות בפרטים */
fun proMode(ctx: android.content.Context) = DmPrefs4(ctx).pro
