@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)

package io.github.yishaiguedj1.snowball.dm

import android.content.ClipData
import android.content.ClipboardManager
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/* ---------- הערכה: הצבע של Studio, בהיר וכהה, נקי ושקט ---------- */
private val Red = Color(0xFFFF4656)
private val Green = Color(0xFF30D158)

@Composable
private fun DmTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val cs = if (dark) darkColorScheme(primary = Red, onPrimary = Color(0xFF1A0003), primaryContainer = Color(0xFF3A1216),
        onPrimaryContainer = Color(0xFFFFDADB), background = Color(0xFF0E0E10), surface = Color(0xFF0E0E10),
        surfaceContainer = Color(0xFF1A1A1D), surfaceContainerHigh = Color(0xFF222226), surfaceContainerLow = Color(0xFF151517))
    else lightColorScheme(primary = Red, onPrimary = Color(0xFF1A0003), primaryContainer = Color(0xFFFFE1E3),
        onPrimaryContainer = Color(0xFF5A0010), background = Color(0xFFF6F6F8), surface = Color(0xFFF6F6F8),
        surfaceContainer = Color.White, surfaceContainerHigh = Color.White, surfaceContainerLow = Color(0xFFFFFFFF))
    MaterialTheme(colorScheme = cs, content = content)
}

private enum class Tab { DOWNLOADS, LIBRARY, SETTINGS }

@Composable
fun DmApp(a: DmActivity) {
    DmTheme {
        val rev by DmStore.rev.collectAsState()
        // מהירות/התקדמות — רענון כל שנייה כשמשהו רץ (בלי לכתוב לדיסק)
        LaunchedEffect(Unit) { while (true) { delay(1000); if (DmEngine.busy()) DmStore.ping() } }
        var tab by remember { mutableStateOf(Tab.DOWNLOADS) }
        var details by remember { mutableStateOf<String?>(null) }
        val sheet by a.sheetUrl
        Scaffold(
            topBar = {
                TopAppBar(title = {
                    Text(stringResource(when (tab) { Tab.DOWNLOADS -> R.string.dmTabDownloads; Tab.LIBRARY -> R.string.dmTabLibrary; Tab.SETTINGS -> R.string.dmTabSettings }),
                        fontWeight = FontWeight.Bold, fontSize = 30.sp)
                }, actions = {
                    if (tab == Tab.DOWNLOADS) {
                        IconButton(onClick = { a.openBrowser("") }) {
                            Icon(DmIcons.Globe, stringResource(R.string.dmBrowser), tint = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = { a.sheetRef.value = ""; a.sheetUrl.value = "" }) {
                            Icon(DmIcons.Paste, stringResource(R.string.dmAdd), tint = MaterialTheme.colorScheme.primary)
                        }
                        var more by remember { mutableStateOf(false) }
                        val ctx = LocalContext.current
                        IconButton(onClick = { more = true }) { Icon(DmIcons.More, stringResource(R.string.dmMore)) }
                        DropdownMenu(more, { more = false }) {
                            DropdownMenuItem({ Text(stringResource(R.string.dmPauseAll)) }, { more = false; DmEngine.pauseAll(ctx) })
                            DropdownMenuItem({ Text(stringResource(R.string.dmResumeAll)) }, { more = false; DmEngine.resumeAll(ctx) })
                            DropdownMenuItem({ Text(stringResource(R.string.dmAddList)) }, { more = false; a.sheetRef.value = ""; a.sheetUrl.value = "" })
                        }
                    }
                })
            },
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                    NavigationBarItem(tab == Tab.DOWNLOADS, { tab = Tab.DOWNLOADS }, { Icon(DmIcons.Download, null) }, label = { Text(stringResource(R.string.dmTabDownloads)) })
                    NavigationBarItem(tab == Tab.LIBRARY, { tab = Tab.LIBRARY }, { Icon(DmIcons.Library, null) }, label = { Text(stringResource(R.string.dmTabLibrary)) })
                    NavigationBarItem(tab == Tab.SETTINGS, { tab = Tab.SETTINGS }, { Icon(Icons.Rounded.Settings, null) }, label = { Text(stringResource(R.string.dmTabSettings)) })
                }
            },
            containerColor = MaterialTheme.colorScheme.background,
        ) { pad ->
            Box(Modifier.padding(pad)) {
                rev.let { _ -> }
                when (tab) {
                    Tab.DOWNLOADS -> Downloads(a, rev) { details = it }
                    Tab.LIBRARY -> Library(a, rev)
                    Tab.SETTINGS -> SettingsScreen(a)
                }
            }
        }
        if (sheet != null) AddSheet(a, sheet ?: "", a.sheetRef.value) { a.sheetDone() }
        details?.let { id -> DmStore.get(id)?.let { t -> Details(a, t, rev) { details = null } } ?: run { details = null } }
    }
}

/* ---------- הורדות ---------- */
@Composable
private fun Downloads(a: DmActivity, rev: Int, onDetails: (String) -> Unit) {
    val all = remember(rev) { DmStore.all() }
    val active = all.filter { it.state != DmState.DONE }
    val done = all.filter { it.state == DmState.DONE }.sortedByDescending { it.finishedAt }
    val clip by a.clipUrl
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (clip.isNotEmpty()) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text(stringResource(R.string.dmClipT), fontWeight = FontWeight.SemiBold)
                    Text(clip, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall)
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { a.sheetRef.value = ""; a.sheetUrl.value = clip; a.dismissClip() }) { Text(stringResource(R.string.dmClipGo)) }
                        TextButton(onClick = { a.dismissClip() }) { Text(stringResource(R.string.dmNotNow)) }
                    }
                }
            }
        }
        if (all.isEmpty()) item { Empty(a) }
        item { SignInCard(a) }
        if (active.isNotEmpty()) { item { Section(stringResource(R.string.dmActive)) }; items(active, key = { it.id }) { TaskRow(a, it, onDetails) } }
        if (done.isNotEmpty()) { item { Section(stringResource(R.string.dmDone)) }; items(done.take(50), key = { it.id }) { TaskRow(a, it, onDetails) } }
    }
}

/* מאגר הנתונים (24/10/2026): בתקופת הפיתוח השליחה דלוקה כברירת מחדל (DmSync.DEFAULT_ON) — חסרה רק הכניסה עם Google.
   הכרטיס מסביר מה נשלח, נכנסים בנגיעה אחת, ואפשר לכבות בהגדרות */
@Composable
private fun SignInCard(a: DmActivity) {
    val ctx = LocalContext.current
    var show by remember { mutableStateOf(DmSync.enabled(ctx) && !DmSync.signedIn(ctx) && !DmSync.asked(ctx)) }
    if (!show) return
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.dmImpT), fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.dmImpS), style = MaterialTheme.typography.bodySmall)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SignInButton(a) { show = false }
                TextButton(onClick = { DmSync.setAsked(ctx); show = false }) { Text(stringResource(R.string.dmNotNow)) }
            }
        }
    }
}

/** כפתור "כניסה עם Google" — חלון המערכת של Google, ואז onOk */
@Composable
internal fun SignInButton(a: DmActivity, onOk: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    Button(enabled = !busy, onClick = {
        busy = true
        scope.launch {
            val r = DmSync.signIn(a)
            busy = false
            when (r) {
                is DmSync.R.Ok -> onOk()
                is DmSync.R.Fail -> android.widget.Toast.makeText(ctx, ctx.getString(R.string.dmSignFail) + "\n" + r.code + (if (r.why.isNotEmpty()) " · " + r.why else ""), android.widget.Toast.LENGTH_LONG).show()
                else -> {}
            }
        }
    }) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(stringResource(R.string.dmConsentGo)) }
}

/* רשימת השמעה (24/10): האיכויות לבחירה (בלי בדיקה של כל סרטון — "עד הגובה הזה") */
private val PL_Q = listOf("best", "2160", "1080", "720", "480", "audio")
private fun fmtCount(ctx: android.content.Context, n: Int) = ctx.resources.getQuantityString(R.plurals.dmPlCount, n, n)
private fun fmtSel(ctx: android.content.Context, n: Int, of: Int) = ctx.getString(R.string.dmPlSel, n, of)
private fun fmtGo(ctx: android.content.Context, n: Int) = ctx.resources.getQuantityString(R.plurals.dmPlGo, n, n)
private fun durTxt(sec: Int) = if (sec >= 3600) String.format(java.util.Locale.US, "%d:%02d:%02d", sec / 3600, sec / 60 % 60, sec % 60) else String.format(java.util.Locale.US, "%d:%02d", sec / 60, sec % 60)

/* "אחר כך" (24/10): ההורדה מתחילה כשיש Wi‑Fi והטלפון בטעינה — בלי הרשאת שעון מדויק (DmRun.scheduleLater) */
@Composable
private fun LaterRow(on: Boolean, set: (Boolean) -> Unit) {
    ListItem(headlineContent = { Text(stringResource(R.string.dmLater)) }, supportingContent = { Text(stringResource(R.string.dmLaterS)) },
        trailingContent = { Switch(on, set) }, colors = androidx.compose.material3.ListItemDefaults.colors(containerColor = androidx.compose.ui.graphics.Color.Transparent),
        modifier = Modifier.padding(bottom = 4.dp))
}

@Composable
private fun Section(t: String) = Text(t, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(top = 10.dp, start = 4.dp))

@Composable
private fun Empty(a: DmActivity) {
    Column(Modifier.fillMaxWidth().padding(top = 80.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(DmIcons.Download, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.dmEmptyT), fontWeight = FontWeight.SemiBold, fontSize = 20.sp)
        Text(stringResource(R.string.dmEmptyS), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(24.dp, 6.dp))
        FilledTonalButton(onClick = { a.sheetRef.value = ""; a.sheetUrl.value = "" }) { Text(stringResource(R.string.dmAdd)) }
    }
}

private fun isVideo(t: DmTask) = if (t.kind == DmKind.YTDL) !t.audioOnly else DmName.cat(t.name, t.mime) == DmName.Cat.VIDEO

private fun catIcon(t: DmTask): ImageVector = when (if (t.kind == DmKind.YTDL) (if (t.audioOnly) DmName.Cat.AUDIO else DmName.Cat.VIDEO) else DmName.cat(t.name, t.mime)) {
    DmName.Cat.VIDEO -> DmIcons.Movie
    DmName.Cat.AUDIO -> DmIcons.Music
    DmName.Cat.IMAGE -> DmIcons.Image
    DmName.Cat.DOC -> DmIcons.Doc
    DmName.Cat.ARCHIVE -> DmIcons.Folder
    DmName.Cat.APK -> DmIcons.File
    DmName.Cat.OTHER -> DmIcons.File
}

/** שורה: נגיעה = עצירה/המשך (או פתיחה בסיום), לחיצה ארוכה = תפריט */
@Composable
private fun TaskRow(a: DmActivity, t: DmTask, onDetails: (String) -> Unit) {
    val ctx = LocalContext.current
    var menu by remember { mutableStateOf(false) }
    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).combinedClickable(
            onClick = {
                when (t.state) {
                    DmState.RUNNING, DmState.QUEUED, DmState.WAITING -> DmEngine.pause(ctx, t.id)
                    DmState.PAUSED, DmState.FAILED -> DmEngine.resume(ctx, t.id)
                    DmState.DONE -> a.open(t)
                }
            },
            onLongClick = { menu = true })) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
                Icon(catIcon(t), null, tint = MaterialTheme.colorScheme.primary)
            }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(t.name.ifEmpty { t.title }.ifEmpty { t.url }, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
                Text(DmFmt.line(ctx, t), style = MaterialTheme.typography.bodySmall,
                    color = if (t.state == DmState.FAILED) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (t.state != DmState.DONE) {
                    Spacer(Modifier.height(6.dp))
                    val f = t.frac
                    if (f >= 0) LinearProgressIndicator(progress = { f }, Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                        color = if (t.state == DmState.RUNNING) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)
                    else if (t.state == DmState.RUNNING) LinearProgressIndicator(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)))
                }
            }
            val ic = when (t.state) { DmState.RUNNING, DmState.QUEUED, DmState.WAITING -> DmIcons.Pause; DmState.PAUSED -> Icons.Rounded.PlayArrow; DmState.FAILED -> Icons.Rounded.Refresh; DmState.DONE -> null }
            if (ic != null) Icon(ic, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            DropdownMenu(menu, { menu = false }) {
                DropdownMenuItem({ Text(stringResource(R.string.dmDetails)) }, { menu = false; onDetails(t.id) })
                if (t.state == DmState.QUEUED || t.state == DmState.WAITING || t.state == DmState.PAUSED || t.state == DmState.FAILED)
                    DropdownMenuItem({ Text(stringResource(R.string.dmFirst)) }, { menu = false; DmEngine.startFirst(ctx, t.id) })
                if ((t.state == DmState.QUEUED || t.state == DmState.WAITING || t.state == DmState.PAUSED) && !t.later)
                    DropdownMenuItem({ Text(stringResource(R.string.dmLaterAct)) }, { menu = false; DmEngine.setLater(ctx, t.id, true) })
                if (t.state == DmState.DONE) DropdownMenuItem({ Text(stringResource(R.string.dmShare)) }, { menu = false; a.share(t) })
                if (t.state == DmState.DONE && isVideo(t) && a.studioHere()) DropdownMenuItem({ Text(stringResource(R.string.dmTranslate)) }, { menu = false; a.translate(t) })
                DropdownMenuItem({ Text(stringResource(R.string.dmCopyLink)) }, { menu = false; copy(ctx, t.url) })
                DropdownMenuItem({ Text(stringResource(R.string.dmRemove)) }, { menu = false; DmEngine.delete(ctx, t.id, false) })
                if (t.state == DmState.DONE) DropdownMenuItem({ Text(stringResource(R.string.dmDeleteFile), color = MaterialTheme.colorScheme.error) },
                    { menu = false; DmEngine.delete(ctx, t.id, true) })
            }
        }
    }
}

private fun copy(ctx: android.content.Context, s: String) {
    ctx.getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("url", s))
}

/* ---------- פרטים: פס המקטעים (כמו הקווים של IDM) ---------- */
@Composable
private fun Details(a: DmActivity, t: DmTask, rev: Int, onClose: () -> Unit) {
    val ctx = LocalContext.current
    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            Text(t.name.ifEmpty { t.title }, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Text(DmFmt.line(ctx, t), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(16.dp))
            if (t.kind == DmKind.HTTP && t.total > 0) {
                val segs = t.segs.toList()
                val tot = t.total.toFloat()
                val track = MaterialTheme.colorScheme.surfaceContainerHigh; val fill = MaterialTheme.colorScheme.primary
                Canvas(Modifier.fillMaxWidth().height(14.dp)) {
                    drawRoundRect(track, cornerRadius = CornerRadius(7f, 7f))
                    for (s in segs) {
                        val x0 = s.start / tot * size.width
                        val w = s.done.coerceAtMost(s.end - s.start) / tot * size.width
                        if (w > 0) drawRect(fill, Offset(x0, 0f), Size(w.coerceAtLeast(1f), size.height))
                    }
                }
                Text(stringResource(R.string.dmSegs, segs.count { !it.finished }, segs.size), style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
            }
            Spacer(Modifier.height(12.dp))
            Info(stringResource(R.string.dmSource), runCatching { java.net.URI(t.url).host }.getOrNull() ?: t.url)
            Info(stringResource(R.string.dmResume), stringResource(if (t.kind == DmKind.YTDL || t.ranges) R.string.dmYes else R.string.dmNo))
            if (t.state == DmState.DONE) Info(stringResource(R.string.dmSavedIn), stringResource(R.string.dmSavedWhere))
            if (t.state == DmState.DONE && t.uri.isNotEmpty()) HashBlock(a, t)
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                when (t.state) {
                    DmState.DONE -> {
                        Button(onClick = { a.open(t) }) { Text(stringResource(R.string.dmOpen)) }
                        if (isVideo(t) && a.studioHere()) FilledTonalButton(onClick = { a.translate(t) }) { Text(stringResource(R.string.dmTranslate)) }
                        else FilledTonalButton(onClick = { a.share(t) }) { Text(stringResource(R.string.dmShare)) }
                    }
                    DmState.FAILED, DmState.PAUSED -> Button(onClick = { DmEngine.resume(ctx, t.id) }) { Text(stringResource(R.string.dmRetry)) }
                    else -> FilledTonalButton(onClick = { DmEngine.pause(ctx, t.id) }) { Text(stringResource(R.string.dmPause)) }
                }
                TextButton(onClick = { copy(ctx, t.url) }) { Text(stringResource(R.string.dmCopyLink)) }
            }
            // הקישור פג (כתובת חתומה) — מוצאים אותו שוב בדפדפן, וההורדה ממשיכה מאותה נקודה
            if (t.kind == DmKind.HTTP && t.state != DmState.DONE) {
                Spacer(Modifier.height(4.dp))
                FilledTonalButton(onClick = { onClose(); a.openBrowser(t.ref.ifEmpty { originOf(t.url) }, t.id) }, Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.dmRefresh))
                }
                if (t.err == "expired") Text(stringResource(R.string.dmRefreshS), style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

/** בדיקת שלמות: מדביקים את הסיכום שהאתר מפרסם (או רק מחשבים SHA-256), ו־DM משווה לקובץ שבטלפון */
@Composable
private fun HashBlock(a: DmActivity, t: DmTask) {
    val ctx = LocalContext.current
    var want by remember(t.id) { mutableStateOf("") }
    var busy by remember(t.id) { mutableStateOf(false) }
    var got by remember(t.id) { mutableStateOf<Long>(0) }
    var res by remember(t.id) { mutableStateOf<String?>(null) }
    var failed by remember(t.id) { mutableStateOf(false) }
    val algo = DmHash.algoOf(want) ?: "SHA-256"
    Spacer(Modifier.height(10.dp))
    Text(stringResource(R.string.dmHashT), fontWeight = FontWeight.SemiBold)
    OutlinedTextField(want, { want = it; res = null }, Modifier.fillMaxWidth(), singleLine = true,
        label = { Text(stringResource(R.string.dmHashWant)) }, shape = RoundedCornerShape(14.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        TextButton(enabled = !busy, onClick = {
            busy = true; res = null; failed = false; got = 0
            a.hashFile(t, algo, { got = it }) { h -> busy = false; if (h == null) failed = true else res = h }
        }) { Text(stringResource(R.string.dmHashGo, algo)) }
        if (busy) Text(if (t.total > 0) "${(got * 100 / t.total).coerceIn(0, 100)}%" else DmFmt.size(ctx, got),
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (failed) Text(stringResource(R.string.dmErrFail), color = MaterialTheme.colorScheme.error)
    res?.let { h ->
        val m = DmHash.matches(h, want)
        Text(h, style = MaterialTheme.typography.bodySmall, modifier = Modifier.combinedClickable(onClick = { copy(ctx, h) }))
        if (m != null) Text(stringResource(if (m) R.string.dmHashOk else R.string.dmHashBad),
            color = if (m) Green else MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
    }
}

private fun originOf(u: String) = Regex("^(https?://[^/?#]+)").find(u)?.groupValues?.get(1) ?: ""

@Composable
private fun Info(k: String, v: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(k, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(v, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/* ---------- גיליון ההוספה: אותו גיליון לכל מקורות הקלט ---------- */
@Composable
private fun AddSheet(a: DmActivity, url0: String, ref: String, onClose: () -> Unit) {
    var url by remember { mutableStateOf(url0) }
    var busy by remember { mutableStateOf(false) }
    var found by remember { mutableStateOf<DmActivity.Found?>(null) }
    var name by remember { mutableStateOf("") }
    var qi by remember { mutableIntStateOf(0) }
    var audio by remember { mutableStateOf(false) }
    var later by remember { mutableStateOf(false) }   // "אחר כך" — Wi‑Fi וטעינה
    var plSel by remember { mutableStateOf(setOf<Int>()) }   // רשימת השמעה: מה נבחר
    var plQ by remember { mutableStateOf("best") }
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    val refId by a.refreshId
    val refTask = remember(refId) { if (refId.isEmpty()) null else DmStore.get(refId) }
    var refErr by remember { mutableStateOf("") }
    // שלב 3: כמה קישורים בבת אחת, או גיבוי של DM — אותו שדה
    val parsed = remember(url) { DmImport.parse(url) }
    val multi = refTask == null && ((parsed is DmImport.Parsed.Links && parsed.urls.size > 1) || parsed is DmImport.Parsed.Backup)

    suspend fun check() {
        val u = DmLink.first(url).ifEmpty { url.trim() }
        if (!u.startsWith("http")) { found = DmActivity.Found.Fail("bad"); return }
        busy = true; found = null
        val f = withContext(Dispatchers.IO) { a.probe(u, ref) }
        busy = false; found = f
        if (f is DmActivity.Found.File) name = f.name
        if (f is DmActivity.Found.Playlist) { plSel = f.pl.entries.indices.toSet(); plQ = pr.quality }
        if (f is DmActivity.Found.Video) {
            audio = pr.quality == "audio"
            val qs = f.info.optJSONArray("q")
            val want = pr.quality.toIntOrNull()
            qi = 0
            if (qs != null && want != null) for (i in 0 until qs.length()) if (qs.optJSONObject(i)?.optInt("h") ?: 0 <= want) { qi = i; break }
        }
    }
    LaunchedEffect(url0) { if (url0.startsWith("http") && DmLink.all(url0).size <= 1) check() }
    // גיליון חדש: ההתקדמות של רשימה קודמת שהסתיימה כבר לא רלוונטית
    LaunchedEffect(Unit) { if (a.batch.value?.finished == true) a.batch.value = null }

    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(20.dp, 0.dp, 20.dp, 28.dp).verticalScroll(rememberScrollState())) {
            Text(stringResource(if (refTask != null) R.string.dmRefresh else R.string.dmAddT), fontWeight = FontWeight.Bold, fontSize = 22.sp)
            if (refTask != null) Text(refTask.name.ifEmpty { refTask.title }, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(url, { url = it; found = null }, Modifier.fillMaxWidth(), singleLine = false, maxLines = 4,
                label = { Text(stringResource(R.string.dmLink)) }, shape = RoundedCornerShape(14.dp),
                trailingIcon = { IconButton(onClick = {
                    val cm = ctx.getSystemService(ClipboardManager::class.java)
                    val txt = cm?.primaryClip?.getItemAt(0)?.coerceToText(ctx)?.toString() ?: ""
                    val p = DmImport.parse(txt)
                    url = when {
                        refTask == null && (p is DmImport.Parsed.Backup || (p is DmImport.Parsed.Links && p.urls.size > 1)) -> txt.take(200_000)
                        else -> DmLink.first(txt).ifEmpty { url }
                    }
                    found = null
                    if (DmLink.all(url).size == 1 && DmImport.parse(url) !is DmImport.Parsed.Backup) scope.launch { check() }
                }) { Icon(DmIcons.Paste, stringResource(R.string.dmPaste)) } })
            Spacer(Modifier.height(14.dp))
            if (multi) BatchBlock(a, parsed, ref, onClose)
            else when (val f = found) {
                null -> if (busy) Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp)
                    Text(stringResource(R.string.dmChecking), Modifier.padding(start = 12.dp))
                } else Button(onClick = { scope.launch { check() } }, Modifier.fillMaxWidth(), enabled = url.isNotBlank()) { Text(stringResource(R.string.dmCheck)) }
                is DmActivity.Found.Fail -> {
                    Text(if (f.code == "bad") stringResource(R.string.dmErrBad) else DmFmt.err(ctx, f.code), color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = { scope.launch { check() } }) { Text(stringResource(R.string.dmRetry)) }
                }
                is DmActivity.Found.File -> {
                    OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text(stringResource(R.string.dmName)) }, shape = RoundedCornerShape(14.dp))
                    Info(stringResource(R.string.dmSize), DmFmt.size(ctx, f.size))
                    Info(stringResource(R.string.dmResume), stringResource(if (f.ranges) R.string.dmYesParts else R.string.dmNo))
                    Spacer(Modifier.height(12.dp))
                    if (refTask != null) {
                        if (refErr.isNotEmpty()) Text(DmFmt.err(ctx, refErr), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 8.dp))
                        Button(onClick = { val e = a.refresh(refTask.id, f, ref); if (e == null) onClose() else refErr = e }, Modifier.fillMaxWidth().height(52.dp)) {
                            Text(stringResource(R.string.dmRefreshGo), fontSize = 17.sp)
                        }
                        TextButton(onClick = { a.refreshId.value = "" }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmRefreshNew)) }
                    } else {
                        LaterRow(later) { later = it }
                        Button(onClick = { a.addFile(f, name, ref, later = later); onClose() }, Modifier.fillMaxWidth().height(52.dp)) { Text(stringResource(if (later) R.string.dmGoLater else R.string.dmGo), fontSize = 17.sp) }
                        if (DmName.cat(f.name, f.mime) == DmName.Cat.VIDEO) StudioRow(a, f.url, ref, true) { a.addFile(f, name, ref, tr = true); onClose() }
                    }
                }
                is DmActivity.Found.Video -> {
                    val info = f.info
                    val th = info.optString("th")
                    if (th.startsWith("data:image")) runCatching {
                        val raw = Base64.decode(th.substringAfter(","), Base64.DEFAULT)
                        BitmapFactory.decodeByteArray(raw, 0, raw.size)
                    }.getOrNull()?.let { bm ->
                        Image(bm.asImageBitmap(), null, Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
                        Spacer(Modifier.height(10.dp))
                    }
                    Text(info.optString("t"), fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(listOf(info.optString("s"), info.optString("up")).filter { it.isNotEmpty() }.joinToString(" · "),
                        color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(12.dp))
                    val qs = info.optJSONArray("q")
                    val list = (0 until (qs?.length() ?: 0)).mapNotNull { qs?.optJSONObject(it) }
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(list.size) { i ->
                            val q = list[i]
                            // הגודל לפי פורמט הווידאו שבהגדרות (תואם = H.264, גדול יותר) — מה שבאמת יירד
                            val sz = DmCodec.prefer(q, info.optJSONArray("fm"), info.optJSONObject("ao"), DmPrefs(ctx).codec).sz
                            FilterChip(!audio && qi == i, { audio = false; qi = i }, label = {
                                Text(q.optInt("h").toString() + "p" + (if (sz > 0) " · " + DmFmt.size(ctx, sz) else ""))
                            })
                        }
                        if (info.optJSONObject("ao") != null) item {
                            FilterChip(audio, { audio = true }, label = { Text(stringResource(R.string.dmAudioOnly)) })
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    LaterRow(later) { later = it }
                    Button(onClick = { a.addVideo(f, list.getOrNull(qi), audio, ref, later = later); onClose() }, Modifier.fillMaxWidth().height(52.dp)) {
                        Text(stringResource(if (later) R.string.dmGoLater else R.string.dmGo), fontSize = 17.sp)
                    }
                    if (!audio) StudioRow(a, f.url, ref, cloudOk(info)) { a.addVideo(f, list.getOrNull(qi), false, ref, tr = true); onClose() }
                    val lu = remember(f.url) { DmPlaylist.listUrl(f.url) }
                    if (lu.isNotEmpty()) TextButton(onClick = {
                        scope.launch { busy = true; found = null; val r = withContext(Dispatchers.IO) { a.probeList(lu, ref) }; busy = false; found = r; if (r is DmActivity.Found.Playlist) { plSel = r.pl.entries.indices.toSet(); plQ = pr.quality } }
                    }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmPlWhole)) }
                }
                is DmActivity.Found.Playlist -> {
                    val pl = f.pl
                    Text(pl.title.ifEmpty { stringResource(R.string.dmPlT) }, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(listOf(pl.up, fmtCount(ctx, pl.entries.size)).filter { it.isNotEmpty() }.joinToString(" · "),
                        color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(12.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(PL_Q.size) { i -> val o = PL_Q[i]; FilterChip(plQ == o, { plQ = o }, label = { Text(qName(o)) }) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                        Text(fmtSel(ctx, plSel.size, pl.entries.size), Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = { plSel = if (plSel.size == pl.entries.size) emptySet() else pl.entries.indices.toSet() }) {
                            Text(stringResource(if (plSel.size == pl.entries.size) R.string.dmPlNone else R.string.dmPlAll))
                        }
                    }
                    pl.entries.forEachIndexed { i, e ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().combinedClickable(onClick = { plSel = if (i in plSel) plSel - i else plSel + i })) {
                            androidx.compose.material3.Checkbox(i in plSel, { plSel = if (it) plSel + i else plSel - i })
                            Text(e.title, Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                            if (e.dur > 0) Text(durTxt(e.dur), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    LaterRow(later) { later = it }
                    Button(enabled = plSel.isNotEmpty(), onClick = {
                        a.addPlaylist(pl.entries.filterIndexed { i, _ -> i in plSel }, plQ.toIntOrNull() ?: 0, plQ == "audio", later); onClose()
                    }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(fmtGo(ctx, plSel.size), fontSize = 17.sp) }
                }
            }
        }
    }
}


/** יוטיוב חוסם את השרת — שם "ישר לענן" לא אפשרי (כמו cloudBlocked ב־studio.js) */
private fun cloudOk(info: JSONObject) = !Regex("^youtube", RegexOption.IGNORE_CASE).containsMatchIn(info.optString("s"))

/** 24/10: סרטון — גם לעבודה ב־Studio: להוריד כאן ולתרגם, או ישר לענן של Studio בלי להוריד לטלפון */
@Composable
private fun StudioRow(a: DmActivity, url: String, ref: String, cloud: Boolean, downloadAndTranslate: () -> Unit) {
    if (!a.studioHere()) return
    Spacer(Modifier.height(6.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilledTonalButton(onClick = downloadAndTranslate, Modifier.weight(1f)) { Text(stringResource(R.string.dmDlTr), maxLines = 2) }
        if (cloud) FilledTonalButton(onClick = { a.toCloud(url, ref) }, Modifier.weight(1f)) { Text(stringResource(R.string.dmToCloud), maxLines = 2) }
    }
}

/* ---------- שלב 3: הוספה של הרבה קישורים / שחזור מגיבוי ---------- */
@Composable
private fun BatchBlock(a: DmActivity, parsed: DmImport.Parsed, ref: String, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val b by a.batch
    when (parsed) {
        is DmImport.Parsed.Backup -> {
            var added by remember(parsed) { mutableStateOf(-1) }
            Text(stringResource(R.string.dmBackupFound, parsed.tasks.size), fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            if (added < 0) Button(onClick = { added = a.importBackup(parsed.tasks) }, Modifier.fillMaxWidth().height(52.dp)) {
                Text(stringResource(R.string.dmBackupGo), fontSize = 17.sp)
            } else {
                Text(stringResource(R.string.dmBackupDone, added), color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = onClose, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmClose)) }
            }
        }
        is DmImport.Parsed.Links -> {
            val st = b
            if (st == null) {
                Text(stringResource(R.string.dmBatchFound, parsed.urls.size), fontWeight = FontWeight.SemiBold)
                parsed.urls.take(6).forEach {
                    Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (parsed.urls.size > 6) Text(stringResource(R.string.dmBatchMore, parsed.urls.size - 6), style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                Button(onClick = { a.addBatch(parsed.urls, ref) }, Modifier.fillMaxWidth().height(52.dp)) {
                    Text(stringResource(R.string.dmBatchGo, parsed.urls.size), fontSize = 17.sp)
                }
            } else {
                Text(stringResource(R.string.dmBatchProg, st.done, st.total), fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(progress = { if (st.total > 0) st.done.toFloat() / st.total else 0f },
                    Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)))
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.dmBatchOk, st.ok) + if (st.failed.isNotEmpty()) " · " + stringResource(R.string.dmBatchBad, st.failed.size) else "",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (st.finished && st.failed.isNotEmpty()) TextButton(onClick = { copy(ctx, st.failed.joinToString("\n")) }) { Text(stringResource(R.string.dmBatchCopyBad)) }
                if (!st.finished) TextButton(onClick = { a.stopBatch() }) { Text(stringResource(R.string.dmBatchStop)) }
                else TextButton(onClick = { a.batch.value = null; onClose() }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.dmClose)) }
            }
        }
        DmImport.Parsed.Empty -> {}
    }
}

/* ---------- ספרייה: תיקיות חכמות (נגזרות, בלי ניהול תיקיות) ---------- */
@Composable
private fun Library(a: DmActivity, rev: Int) {
    val ctx = LocalContext.current
    var cat by remember { mutableStateOf<DmName.Cat?>(null) }
    val done = remember(rev) { DmStore.all().filter { it.state == DmState.DONE }.sortedByDescending { it.finishedAt } }
    fun catOf(t: DmTask) = if (t.kind == DmKind.YTDL) (if (t.audioOnly) DmName.Cat.AUDIO else DmName.Cat.VIDEO) else DmName.cat(t.name, t.mime)
    val cats = listOf(null, DmName.Cat.VIDEO, DmName.Cat.AUDIO, DmName.Cat.DOC, DmName.Cat.ARCHIVE, DmName.Cat.OTHER)
    Column {
        LazyRow(contentPadding = PaddingValues(16.dp, 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(cats.size) { i ->
                val c = cats[i]
                FilterChip(cat == c, { cat = c }, label = { Text(stringResource(when (c) {
                    null -> R.string.dmCatAll; DmName.Cat.VIDEO -> R.string.dmCatVideo; DmName.Cat.AUDIO -> R.string.dmCatAudio
                    DmName.Cat.DOC -> R.string.dmCatDoc; DmName.Cat.ARCHIVE -> R.string.dmCatArchive; else -> R.string.dmCatOther
                })) })
            }
        }
        val list = done.filter { cat == null || catOf(it) == cat || (cat == DmName.Cat.OTHER && catOf(it) in setOf(DmName.Cat.OTHER, DmName.Cat.APK, DmName.Cat.IMAGE)) }
        if (list.isEmpty()) Text(stringResource(R.string.dmLibEmpty), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(24.dp))
        LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(list, key = { it.id }) { TaskRow(a, it) {} }
        }
    }
}

/* ---------- הגדרות: שש שורות עם הערך הנוכחי ---------- */
@Composable
private fun SettingsScreen(a: DmActivity) {
    val ctx = LocalContext.current
    val pr = remember { DmPrefs(ctx) }
    var wifi by remember { mutableStateOf(pr.wifiOnly) }
    var par by remember { mutableIntStateOf(pr.parallel) }
    var conns by remember { mutableIntStateOf(pr.conns) }
    var q by remember { mutableStateOf(pr.quality) }
    var codec by remember { mutableStateOf(pr.codec) }
    var lang by remember { mutableStateOf(pr.lang) }
    var lim by remember { mutableStateOf(pr.limit) }
    var dlg by remember { mutableStateOf("") }
    var synced by remember { mutableStateOf(DmSync.enabled(ctx)) }
    var signed by remember { mutableStateOf(DmSync.signedIn(ctx)) }
    var forgetMsg by remember { mutableStateOf("") }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp, 0.dp, 16.dp, 24.dp)) {
        Group {
            SetRow(stringResource(R.string.dmSetQuality), qName(q)) { dlg = "q" }
            Div()
            SetRow(stringResource(R.string.dmSetCodec), codecName(codec)) { dlg = "k" }
            Div()
            SetRow(stringResource(R.string.dmSetWhere), stringResource(R.string.dmSavedWhere)) {}
            Div()
            ListItem(headlineContent = { Text(stringResource(R.string.dmSetWifi)) },
                trailingContent = { Switch(wifi, { wifi = it; pr.wifiOnly = it; DmEngine.pump(ctx) }) })
            Div()
            SetRow(stringResource(R.string.dmSetParallel), par.toString()) { dlg = "p" }
            Div()
            SetRow(stringResource(R.string.dmSetConns), conns.toString()) { dlg = "c" }
            Div()
            SetRow(stringResource(R.string.dmSetLimit), limName(lim)) { dlg = "s" }
            Div()
            SetRow(stringResource(R.string.dmSetLang), langName(lang)) { dlg = "g" }
        }
        Spacer(Modifier.height(14.dp))
        Group {
            ListItem(headlineContent = { Text(stringResource(R.string.dmSetBattery)) }, supportingContent = { Text(stringResource(R.string.dmSetBatteryS)) },
                leadingContent = { Icon(DmIcons.Battery, null) }, modifier = Modifier.combinedClickable(onClick = { a.batterySettings() }))
            Div()
            SetRow(stringResource(R.string.dmSetExport), "") { a.shareText(DmStore.exportJson()) }
            Div()
            SetRow(stringResource(R.string.dmSetLog), "") { DmLogFile.init(ctx); a.shareText(DmLogFile.exportText(ctx)) }
            Div()
            SetRow(stringResource(R.string.dmSetLicenses), "") { dlg = "l" }
        }
        Spacer(Modifier.height(14.dp))
        Group {
            ListItem(headlineContent = { Text(stringResource(R.string.dmSetImprove)) },
                supportingContent = { Text(stringResource(if (synced) R.string.dmSetImproveS else R.string.dmSetImproveOff)) },
                trailingContent = { Switch(synced, { synced = it; DmSync.setEnabled(ctx, it) }) })
            if (synced) {
                Div()
                if (signed) ListItem(headlineContent = { Text(DmSync.email(ctx)) })
                else ListItem(headlineContent = { Text(stringResource(R.string.dmSignNeed)) }, trailingContent = { SignInButton(a) { signed = true } })
            }
            if (signed) { Div(); SetRow(stringResource(R.string.dmSetForget), forgetMsg) { dlg = "f" } }
        }
        Text(stringResource(if (synced) R.string.dmPrivacyOn else R.string.dmPrivacy), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(8.dp, 16.dp))
    }
    if (dlg == "f") AlertDialog(onDismissRequest = { dlg = "" }, text = { Text(stringResource(R.string.dmForgetQ)) },
        confirmButton = { TextButton(onClick = {
            dlg = ""; forgetMsg = "…"
            Thread {
                val n = DmSync.forget(ctx)
                forgetMsg = if (n == null) ctx.getString(R.string.dmForgetFail) else ctx.getString(R.string.dmForgetDone, n)
                if (n != null) signed = false
            }.start()
        }) { Text(stringResource(R.string.dmForgetGo), color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { dlg = "" }) { Text(stringResource(R.string.dmNotNow)) } })
    when (dlg) {
        "q" -> Choose(stringResource(R.string.dmSetQuality), listOf("best", "2160", "1080", "720", "480", "audio"), q, { qName(it) }) { q = it; pr.quality = it; dlg = "" }
        "k" -> Choose(stringResource(R.string.dmSetCodec), DmCodec.MODES, codec, { codecName(it) }) { codec = it; pr.codec = it; dlg = "" }
        "p" -> Choose(stringResource(R.string.dmSetParallel), listOf("1", "2", "3", "4", "5"), par.toString(), { it }) { par = it.toInt(); pr.parallel = par; dlg = ""; DmEngine.pump(ctx) }
        "g" -> Choose(stringResource(R.string.dmSetLang), DmLang.MODES, lang, { langName(it) }) {
            dlg = ""; if (it != lang) { lang = it; pr.lang = it; a.recreate() }   // מחרוזות וכיוון — מההקשר החדש
        }
        "s" -> Choose(stringResource(R.string.dmSetLimit), LIMITS.map { it.toString() }, lim.toString(), { limName(it.toLong()) }) {
            lim = it.toLong(); pr.limit = lim; DmLimit.bytesPerSec = lim; dlg = ""
        }
        "c" -> Choose(stringResource(R.string.dmSetConns), listOf("1", "2", "4", "8"), conns.toString(), { it }) { conns = it.toInt(); pr.conns = conns; dlg = "" }
        "l" -> AlertDialog(onDismissRequest = { dlg = "" }, confirmButton = { TextButton({ dlg = "" }) { Text(stringResource(R.string.dmClose)) } },
            title = { Text(stringResource(R.string.dmSetLicenses)) },
            text = { Text(stringResource(R.string.dmLicensesText), Modifier.verticalScroll(rememberScrollState())) })
    }
    if (dlg == "x") dlg = ""
}

@Composable
private fun codecName(c: String) = stringResource(if (c == DmCodec.COMPAT) R.string.dmCodecCompat else R.string.dmCodecSmall)

@Composable
private fun qName(q: String) = when (q) {
    "best" -> stringResource(R.string.dmQBest); "audio" -> stringResource(R.string.dmAudioOnly); else -> q + "p"
}

/** הגבלת מהירות: בלי, ‏1/2/5/10 MB/s */
private val LIMITS = listOf(0L, 1L shl 20, 2L shl 20, 5L shl 20, 10L shl 20)

@Composable
private fun limName(b: Long): String = if (b <= 0) stringResource(R.string.dmLimitOff) else DmFmt.speed(LocalContext.current, b)

@Composable
private fun langName(m: String) = when (m) {
    "he" -> stringResource(R.string.dmLangHe); "en" -> stringResource(R.string.dmLangEn); else -> stringResource(R.string.dmLangSys)
}

@Composable
private fun Group(content: @Composable () -> Unit) = Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surfaceContainer) { Column { content() } }

@Composable
private fun Div() = HorizontalDivider(Modifier.padding(start = 16.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))

@Composable
private fun SetRow(k: String, v: String, on: () -> Unit) {
    ListItem(headlineContent = { Text(k) }, trailingContent = { if (v.isNotEmpty()) Text(v, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) },
        modifier = Modifier.combinedClickable(onClick = on))
}

@Composable
private fun Choose(title: String, opts: List<String>, cur: String, label: @Composable (String) -> String, pick: (String) -> Unit) {
    AlertDialog(onDismissRequest = { pick(cur) }, confirmButton = {}, title = { Text(title) }, text = {
        Column { opts.forEach { o ->
            ListItem(headlineContent = { Text(label(o), fontWeight = if (o == cur) FontWeight.Bold else FontWeight.Normal) },
                modifier = Modifier.combinedClickable(onClick = { pick(o) }).width(280.dp))
        } }
    })
}
