package io.github.yishaiguedj1.snowball.br

import android.graphics.Color as AColor
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import io.github.yishaiguedj1.snowball.R

/* ---------- הצבעים: המבנה של Chrome, הגימור של Apple (גווני iOS, פינות רכות, קווים דקים) ---------- */
private val Red = Color(0xFFFF4656)

data class BrC(val page: Color, val bar: Color, val fill: Color, val card: Color, val screen: Color, val fg: Color, val mute: Color, val line: Color)

private val Light = BrC(Color.White, Color(0xFFF9F9FB), Color(0xFFEDEDF0), Color.White, Color(0xFFF2F2F7), Color(0xFF1C1C1E), Color(0xFF8E8E93), Color(0xFFE3E3E8))
private val Dark = BrC(Color.Black, Color(0xFF1C1C1E), Color(0xFF2C2C2E), Color(0xFF1C1C1E), Color.Black, Color(0xFFF2F2F7), Color(0xFF8E8E93), Color(0xFF38383A))
private val Priv = BrC(Color(0xFF121214), Color(0xFF26262B), Color(0xFF38383F), Color(0xFF26262B), Color(0xFF121214), Color(0xFFF2F2F7), Color(0xFF9A9AA2), Color(0xFF3E3E45))
private val LocalBr = staticCompositionLocalOf { Light }

@Composable
private fun BrTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val cs = if (dark) darkColorScheme(primary = Red, onPrimary = Color.White, surface = Dark.card, background = Dark.screen)
    else lightColorScheme(primary = Red, onPrimary = Color.White, surface = Light.card, background = Light.screen)
    CompositionLocalProvider(LocalBr provides if (dark) Dark else Light) { MaterialTheme(colorScheme = cs, content = content) }
}

@Composable
fun BrApp(a: BrowserActivity) {
    BrTheme {
        val c = if (a.cur?.private == true && a.screen == BrowserActivity.Screen.PAGE) Priv else LocalBr.current
        CompositionLocalProvider(LocalBr provides c) {
            Box(Modifier.fillMaxSize().background(if (a.screen == BrowserActivity.Screen.PAGE) c.bar else c.screen)) {
                when (a.screen) {
                    BrowserActivity.Screen.PAGE -> PageScreen(a)
                    BrowserActivity.Screen.SWITCHER -> Switcher(a)
                    BrowserActivity.Screen.HISTORY -> HistoryScreen(a)
                    BrowserActivity.Screen.BOOKMARKS -> MarksScreen(a)
                    BrowserActivity.Screen.SETTINGS -> SettingsScreen(a)
                }
                a.customView?.let { v ->
                    AndroidView({ ctx -> FrameLayout(ctx).apply { setBackgroundColor(AColor.BLACK) } }, Modifier.fillMaxSize(),
                        update = { f -> if (v.parent !== f) { (v.parent as? ViewGroup)?.removeView(v); f.removeAllViews(); f.addView(v, FrameLayout.LayoutParams(-1, -1)) } },
                        onRelease = { it.removeAllViews() })
                }
                a.permAsk?.let { PermDialog(it) }
            }
        }
    }
}

/* ---------------- הדף ---------------- */

@Composable
private fun PageScreen(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val start = if (t?.url?.startsWith("http") == true) t.url else ""
    var q by remember(a.editing, t?.id) { mutableStateOf(TextFieldValue(start, TextRange(0, start.length))) }
    var info by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
        if (!a.barBottom) { Bar(a, q, { q = it }); Progress(t) }
        Box(Modifier.weight(1f).fillMaxWidth().background(c.page)) {
            if (t == null || t.isNtp) Ntp(a) else WebHost(a, t)
            if (a.editing) Suggest(a, q.text)
            if (a.menu) Menu(a, Modifier.align(if (a.barBottom) Alignment.BottomEnd else Alignment.TopEnd)) { info = true }
        }
        if (a.barBottom) { Progress(t); Bar(a, q, { q = it }) }
    }
    if (a.pick && t != null) PickSheet(a, t)
    if (info && t != null) PageInfo(a, t) { info = false }
}

@Composable
private fun Progress(t: BrTab?) {
    val c = LocalBr.current
    val p = t?.progress ?: 0
    if (p in 1..99 && t?.url?.startsWith("http") == true)
        LinearProgressIndicator(progress = { p / 100f }, modifier = Modifier.fillMaxWidth().height(2.dp), color = Red, trackColor = Color.Transparent, drawStopIndicator = {})
    else HorizontalDivider(thickness = 0.5.dp, color = c.line)
}

@Composable
private fun Bar(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(56.dp).background(c.bar).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        when {
            a.finding -> FindBar(a)
            a.editing -> EditBar(a, q, setQ)
            else -> NormalBar(a)
        }
    }
}

@Composable
private fun RowScopeIcon(icon: ImageVector, desc: String, enabled: Boolean = true, tint: Color? = null, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(42.dp).clip(CircleShape).clickable(enabled = enabled, onClick = on), contentAlignment = Alignment.Center) {
        Icon(icon, desc, Modifier.size(22.dp), tint = (tint ?: c.fg).copy(alpha = if (enabled) 1f else 0.3f))
    }
}

@Composable
private fun RowScope.NormalBar(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    if (a.homeBtn) RowScopeIcon(BrIcons.Home, stringResource(R.string.brHome)) { a.goHome() }
    val secure = t?.url?.startsWith("https://") == true
    Row(
        Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(20.dp)).background(c.fill)
            .pointerInput(t?.id) {
                var dx = 0f
                detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = {
                    if (kotlin.math.abs(dx) > 90f) a.swipeTab(if ((dx < 0) != rtl) 1 else -1)
                }) { ch, d -> ch.consume(); dx += d }
            }
            .clickable { a.editing = true }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        val ntp = t == null || !t.url.startsWith("http")
        Icon(if (ntp) BrIcons.Search else if (secure) BrIcons.Lock else BrIcons.Info, null, Modifier.size(15.dp), tint = c.mute)
        Spacer(Modifier.width(8.dp))
        Text(
            if (ntp) stringResource(R.string.brHint) else BrStore.hostOf(t!!.url).ifEmpty { t.url },
            Modifier.weight(1f), color = if (ntp) c.mute else c.fg, fontSize = 15.sp, fontWeight = if (ntp) FontWeight.Normal else FontWeight.Medium,
            maxLines = 1, overflow = TextOverflow.Ellipsis,
            style = TextStyle(textDirection = if (ntp) TextDirection.Content else TextDirection.Ltr)
        )
        if ((t?.foundN ?: 0) > 0) {
            Spacer(Modifier.width(6.dp))
            Box(Modifier.size(28.dp).clip(CircleShape).background(Red).clickable {
                val ps = a.picks(t!!); if (ps.size == 1) a.download(ps[0]) else a.pick = true
            }, contentAlignment = Alignment.Center) { Icon(BrIcons.Dl, stringResource(R.string.brVideos), Modifier.size(17.dp), tint = Color.White) }
        }
    }
    Spacer(Modifier.width(4.dp))
    val n = a.tabs.count { it.private == (t?.private == true) }
    Box(Modifier.size(42.dp).clip(CircleShape).clickable { a.openSwitcher() }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(22.dp).border(2.dp, c.fg, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
            Text(if (n > 99) ":D" else "$n", color = c.fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
    RowScopeIcon(BrIcons.More, stringResource(R.string.brMenu)) { a.menu = !a.menu }
}

@Composable
private fun RowScope.EditBar(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    RowScopeIcon(BrIcons.Back, stringResource(R.string.brClose)) { a.editing = false }
    Row(Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(20.dp)).background(c.fill).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        BasicTextField(
            q, setQ, Modifier.weight(1f).focusRequester(fr), singleLine = true,
            textStyle = TextStyle(color = c.fg, fontSize = 15.sp, textDirection = TextDirection.Content),
            cursorBrush = SolidColor(Red),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onGo = { a.go(q.text) }),
            decorationBox = { inner -> Box { if (q.text.isEmpty()) Text(stringResource(R.string.brHint), color = c.mute, fontSize = 15.sp); inner() } }
        )
        if (q.text.isNotEmpty()) Box(Modifier.size(28.dp).clip(CircleShape).clickable { setQ(TextFieldValue("")) }, contentAlignment = Alignment.Center) {
            Icon(BrIcons.Close, stringResource(R.string.brClear), Modifier.size(18.dp), tint = c.mute)
        }
    }
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

@Composable
private fun RowScope.FindBar(a: BrowserActivity) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    var q by remember { mutableStateOf("") }
    Row(Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(20.dp)).background(c.fill).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        BasicTextField(q, { q = it; a.find(it) }, Modifier.weight(1f).focusRequester(fr), singleLine = true,
            textStyle = TextStyle(color = c.fg, fontSize = 15.sp, textDirection = TextDirection.Content), cursorBrush = SolidColor(Red),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { a.findNext(true) }),
            decorationBox = { inner -> Box { if (q.isEmpty()) Text(stringResource(R.string.brFind), color = c.mute, fontSize = 15.sp); inner() } })
        if (q.isNotEmpty()) Text(stringResource(R.string.brFindN, a.findRes.first, a.findRes.second), color = c.mute, fontSize = 13.sp)
    }
    RowScopeIcon(BrIcons.Up, stringResource(R.string.brPrev)) { a.findNext(false) }
    RowScopeIcon(BrIcons.Down, stringResource(R.string.brNext)) { a.findNext(true) }
    RowScopeIcon(BrIcons.Close, stringResource(R.string.brClose)) { a.stopFind() }
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

/* ---------------- WebView ---------------- */

@Composable
private fun WebHost(a: BrowserActivity, t: BrTab) {
    AndroidView(
        factory = { ctx -> SwipeRefreshLayout(ctx).apply { setColorSchemeColors(0xFFFF4656.toInt()); setOnRefreshListener { a.cur?.web?.reload(); isRefreshing = false } } },
        modifier = Modifier.fillMaxSize(),
        update = { srl ->
            val w = a.ensureWeb(t)
            if (srl.getChildAt(0) !== w) { (w.parent as? ViewGroup)?.removeView(w); srl.removeAllViews(); srl.addView(w, ViewGroup.LayoutParams(-1, -1)) }
        },
        onRelease = { it.removeAllViews() }
    )
}

/* ---------------- טאב חדש ---------------- */

@Composable
private fun Ntp(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val priv = t?.private == true
    val sites = remember(a.markRev) { BrStore.topSites(8) }
    val recent = remember(a.markRev) { BrStore.history.asReversed().distinctBy { it.url }.filter { it.title.isNotEmpty() }.take(3) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(44.dp))
        if (priv) {
            Icon(BrIcons.Private, null, Modifier.size(44.dp), tint = c.fg)
            Spacer(Modifier.height(14.dp))
            Text(stringResource(R.string.brPrivateTitle), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.brPrivateHint), color = c.mute, fontSize = 14.sp, textAlign = TextAlign.Center)
            return@Column
        }
        Text("THE SNOWBALL", color = c.fg, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(24.dp))
        Row(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(24.dp)).background(c.fill).clickable { a.editing = true }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(BrIcons.Search, null, Modifier.size(20.dp), tint = c.mute); Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.brHint), color = c.mute, fontSize = 16.sp)
        }
        Spacer(Modifier.height(28.dp))
        sites.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                row.forEach { s -> SiteTile(s.title, Modifier.weight(1f)) { a.go(s.url) } }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
            Spacer(Modifier.height(14.dp))
        }
        if (recent.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text(stringResource(R.string.brContinue), Modifier.fillMaxWidth(), color = c.mute, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Group {
                recent.forEachIndexed { i, v ->
                    if (i > 0) HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = c.line)
                    LinkRow(v.title, BrStore.hostOf(v.url), null) { a.go(v.url) }
                }
            }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
private fun SiteTile(title: String, m: Modifier, on: () -> Unit) {
    val c = LocalBr.current
    Column(m.clip(RoundedCornerShape(14.dp)).clickable(onClick = on).padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(52.dp).clip(RoundedCornerShape(14.dp)).background(c.fill), contentAlignment = Alignment.Center) {
            Text(title.take(1).uppercase(), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(6.dp))
        Text(title, color = c.mute, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/* ---------------- הצעות בשורת הכתובת ---------------- */

@Composable
private fun Suggest(a: BrowserActivity, q: String) {
    val c = LocalBr.current
    // שורה ריקה: הדפים האחרונים (כמו Chrome); אחרת — סימניות והיסטוריה שמתאימות
    val list = remember(q, a.markRev) {
        if (q.isBlank()) BrStore.history.asReversed().distinctBy { it.url }.take(8).map { BrMark(it.url, it.title, it.at) } else BrStore.suggest(q)
    }
    val isUrl = BrStore.toUrl(q, a.engine).let { it.isNotEmpty() && it != BrStore.searchUrl(a.engine, q.trim()) }
    LazyColumn(Modifier.fillMaxSize().background(c.page)) {
        if (q.isNotBlank()) item {
            LinkRow(if (isUrl) q.trim() else stringResource(R.string.brSearchFor, q.trim()), null, if (isUrl) BrIcons.Globe else BrIcons.Search) { a.go(q) }
            HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = c.line)
        }
        items(list, key = { it.url }) { m ->
            LinkRow(m.title.ifEmpty { m.url }, m.url, if (BrStore.isMarked(m.url)) BrIcons.StarOn else BrIcons.History) { a.go(m.url) }
            HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = c.line)
        }
    }
}

@Composable
private fun LinkRow(title: String, sub: String?, icon: ImageVector?, trailing: (@Composable () -> Unit)? = null, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().clickable(onClick = on).padding(horizontal = 16.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(c.fill), contentAlignment = Alignment.Center) {
            if (icon != null) Icon(icon, null, Modifier.size(17.dp), tint = c.mute)
            else Text(title.take(1).uppercase(), color = c.fg, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = c.fg, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Ltr))
        }
        trailing?.invoke()
    }
}

/* ---------------- התפריט ⋮ — אותו סדר של Chrome, והתוספות בקבוצה משלהן ---------------- */

@Composable
private fun Menu(a: BrowserActivity, m: Modifier, onInfo: () -> Unit) {
    val c = LocalBr.current
    val t = a.cur
    val web = t?.url?.startsWith("http") == true
    @Suppress("UNUSED_VARIABLE") val rev = a.markRev
    Box(Modifier.fillMaxSize().clickable(remember { MutableInteractionSource() }, null) { a.menu = false }) {
        Column(
            m.padding(8.dp).width(256.dp).shadow(18.dp, RoundedCornerShape(18.dp)).clip(RoundedCornerShape(18.dp))
                .background(c.card).clickable(remember { MutableInteractionSource() }, null) {}.verticalScroll(rememberScrollState())
        ) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                RowScopeIcon(BrIcons.Forward, stringResource(R.string.brForward), enabled = t?.canFwd == true) { a.forward() }
                val marked = web && BrStore.isMarked(t!!.url)
                RowScopeIcon(if (marked) BrIcons.StarOn else BrIcons.Star, stringResource(if (marked) R.string.brStarOff else R.string.brStar), enabled = web, tint = if (marked) Red else null) { a.toggleMark() }
                RowScopeIcon(BrIcons.Dl, stringResource(R.string.brDownloads)) { a.openDownloads() }
                RowScopeIcon(BrIcons.Info, stringResource(R.string.brInfo), enabled = web) { a.menu = false; onInfo() }
                RowScopeIcon(if ((t?.progress ?: 0) in 1..99) BrIcons.Close else BrIcons.Refresh, stringResource(R.string.brRefresh), enabled = web) { a.reload() }
            }
            HorizontalDivider(thickness = 0.5.dp, color = c.line)
            MenuItem(R.string.brNewTab) { a.menu = false; a.newTab("") }
            if (a.privOk) MenuItem(R.string.brNewPrivate) { a.menu = false; a.newTab("", private = true) }
            HorizontalDivider(thickness = 0.5.dp, color = c.line)
            MenuItem(R.string.brHistory) { a.menu = false; a.screen = BrowserActivity.Screen.HISTORY }
            MenuItem(R.string.brDownloads) { a.openDownloads() }
            MenuItem(R.string.brBookmarks) { a.menu = false; a.screen = BrowserActivity.Screen.BOOKMARKS }
            HorizontalDivider(thickness = 0.5.dp, color = c.line)
            if ((t?.foundN ?: 0) > 0) MenuItem(R.string.brVideos, accent = true, trail = "${t!!.foundN}") { a.menu = false; a.pick = true }
            if (web) {
                MenuItem(R.string.brTranslate) { a.translate() }
                MenuItem(R.string.brFind) { a.startFind() }
                MenuItem(R.string.brShare) { a.share() }
                MenuItem(R.string.brInstall) { a.install() }
                MenuItem(R.string.brDesktop, check = t!!.desktop) { a.toggleDesktop() }
                HorizontalDivider(thickness = 0.5.dp, color = c.line)
            }
            MenuItem(R.string.brSettings) { a.menu = false; a.screen = BrowserActivity.Screen.SETTINGS }
            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable
private fun MenuItem(label: Int, accent: Boolean = false, trail: String? = null, check: Boolean? = null, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().clickable(onClick = on).padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(stringResource(label), Modifier.weight(1f), color = if (accent) Red else c.fg, fontSize = 15.sp, fontWeight = if (accent) FontWeight.SemiBold else FontWeight.Normal)
        if (trail != null) Text(trail, color = c.mute, fontSize = 13.sp)
        if (check == true) Icon(BrIcons.Check, null, Modifier.size(18.dp), tint = Red)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickSheet(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    ModalBottomSheet(onDismissRequest = { a.pick = false }, containerColor = c.card) {
        Text(stringResource(R.string.brPick), Modifier.padding(horizontal = 20.dp, vertical = 6.dp), color = c.fg, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        a.picks(t).forEach { p -> LinkRow(stringResource(p.label), p.host, BrIcons.Video) { a.download(p) } }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun PageInfo(a: BrowserActivity, t: BrTab, close: () -> Unit) {
    val secure = t.url.startsWith("https://")
    AlertDialog(
        onDismissRequest = close,
        title = { Text(BrStore.hostOf(t.url), style = TextStyle(textDirection = TextDirection.Ltr)) },
        text = { Text(stringResource(if (secure) R.string.brSecure else R.string.brNotSecure)) },
        confirmButton = { TextButton({ a.copyLink(); close() }) { Text(stringResource(R.string.brCopyLink)) } },
        dismissButton = { TextButton(close) { Text(stringResource(R.string.brClose)) } }
    )
}

@Composable
private fun PermDialog(p: BrowserActivity.PermAsk) {
    val what = when (p.kind) { 1 -> R.string.brPermCam; 2 -> R.string.brPermMic; 3 -> R.string.brPermCamMic; else -> R.string.brPermLoc }
    AlertDialog(
        onDismissRequest = { p.go(false) },
        text = { Text(stringResource(what, p.host)) },
        confirmButton = { TextButton({ p.go(true) }) { Text(stringResource(R.string.brAllow)) } },
        dismissButton = { TextButton({ p.go(false) }) { Text(stringResource(R.string.brDeny)) } }
    )
}

/* ---------------- מסך הטאבים ---------------- */

@Composable
private fun Switcher(a: BrowserActivity) {
    val c = LocalBr.current
    var more by remember { mutableStateOf(false) }
    val list = a.tabs.filter { it.private == a.swPrivate }
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            RowScopeIcon(BrIcons.Add, stringResource(R.string.brNewTab)) { a.screen = BrowserActivity.Screen.PAGE; a.newTab("", private = a.swPrivate) }
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Row(Modifier.clip(RoundedCornerShape(10.dp)).background(c.fill).padding(3.dp)) {
                    Seg(stringResource(R.string.brTabsN, a.tabs.count { !it.private }), !a.swPrivate) { a.swPrivate = false }
                    if (a.privOk) Seg(stringResource(R.string.brPrivate), a.swPrivate) { a.swPrivate = true }
                }
            }
            Box {
                RowScopeIcon(BrIcons.More, stringResource(R.string.brMenu)) { more = true }
                androidx.compose.material3.DropdownMenu(more, { more = false }, containerColor = c.card) {
                    androidx.compose.material3.DropdownMenuItem({ Text(stringResource(R.string.brCloseAll)) }, { more = false; a.closeAll(a.swPrivate); if (a.swPrivate) a.swPrivate = false })
                }
            }
        }
        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(stringResource(if (a.swPrivate) R.string.brPrivateNone else R.string.brNoTabs), color = c.mute, fontSize = 15.sp, textAlign = TextAlign.Center)
            }
        } else LazyVerticalGrid(GridCells.Fixed(2), Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(list, key = { it.id }) { t -> TabCard(a, t) }
        }
    }
}

@Composable
private fun Seg(label: String, on: Boolean, click: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.clip(RoundedCornerShape(8.dp)).background(if (on) c.card else Color.Transparent).clickable(onClick = click).padding(horizontal = 14.dp, vertical = 6.dp)) {
        Text(label, color = c.fg, fontSize = 13.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
    }
}

@Composable
private fun TabCard(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val on = t === a.cur
    Column(
        Modifier.fillMaxWidth().height(220.dp).shadow(if (on) 0.dp else 3.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp))
            .background(c.card).border(if (on) BorderStroke(2.dp, Red) else BorderStroke(0.5.dp, c.line), RoundedCornerShape(16.dp))
            .clickable { a.select(t); a.screen = BrowserActivity.Screen.PAGE }
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 10.dp, end = 4.dp, top = 4.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            val ic = t.icon
            if (ic != null) Image(ic.asImageBitmap(), null, Modifier.size(16.dp).clip(RoundedCornerShape(4.dp)))
            else Box(Modifier.size(16.dp).clip(RoundedCornerShape(4.dp)).background(c.fill))
            Spacer(Modifier.width(6.dp))
            Text(t.title.ifEmpty { if (t.url.startsWith("http")) BrStore.hostOf(t.url) else stringResource(R.string.brNewTab) },
                Modifier.weight(1f), color = c.fg, fontSize = 12.5.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Box(Modifier.size(30.dp).clip(CircleShape).clickable { a.close(t) }, contentAlignment = Alignment.Center) {
                Icon(BrIcons.Close, stringResource(R.string.brCloseTab), Modifier.size(16.dp), tint = c.mute)
            }
        }
        Box(Modifier.fillMaxSize().padding(start = 4.dp, end = 4.dp, bottom = 4.dp).clip(RoundedCornerShape(12.dp)).background(c.page)) {
            t.thumb?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = Alignment.TopCenter) }
        }
    }
}

/* ---------------- היסטוריה, סימניות, הגדרות — מסכים בסגנון iOS (רשימות מקובצות) ---------------- */

@Composable
private fun SubScreen(a: BrowserActivity, title: Int, search: Boolean, onSearch: (String) -> Unit = {}, content: @Composable ColumnScope.() -> Unit) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            RowScopeIcon(BrIcons.Back, stringResource(R.string.brClose)) { a.screen = BrowserActivity.Screen.PAGE }
            Text(stringResource(title), Modifier.weight(1f).padding(horizontal = 6.dp), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        }
        if (search) Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth().height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.fill).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(BrIcons.Search, null, Modifier.size(18.dp), tint = c.mute); Spacer(Modifier.width(8.dp))
            BasicTextField(q, { q = it; onSearch(it) }, Modifier.weight(1f), singleLine = true, textStyle = TextStyle(color = c.fg, fontSize = 15.sp, textDirection = TextDirection.Content),
                cursorBrush = SolidColor(Red), decorationBox = { inner -> Box { if (q.isEmpty()) Text(stringResource(R.string.brSearch), color = c.mute, fontSize = 15.sp); inner() } })
        }
        content()
    }
}

@Composable
private fun Group(content: @Composable () -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.card)) { content() }
}

@Composable
private fun HistoryScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    var ask by remember { mutableStateOf(false) }
    val fmt = remember { java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT, java.text.DateFormat.SHORT) }
    SubScreen(a, R.string.brHistory, true, { q = it }) {
        val list = remember(q, rev) {
            val t = q.trim().lowercase()
            BrStore.history.asReversed().filter { t.isEmpty() || it.title.lowercase().contains(t) || it.url.lowercase().contains(t) }.take(500)
        }
        if (list.isEmpty()) Box(Modifier.weight(1f)) { Empty(R.string.brHistoryEmpty) }
        else LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            items(list) { v ->
                LinkRow(v.title.ifEmpty { v.url }, BrStore.hostOf(v.url) + " · " + fmt.format(java.util.Date(v.at)), null, trailing = {
                    Box(Modifier.size(34.dp).clip(CircleShape).clickable { BrStore.removeVisit(v); rev++; a.markRev++ }, contentAlignment = Alignment.Center) {
                        Icon(BrIcons.Close, stringResource(R.string.brDelete), Modifier.size(16.dp), tint = c.mute)
                    }
                }) { a.screen = BrowserActivity.Screen.PAGE; a.go(v.url) }
                HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = c.line)
            }
        }
        if (BrStore.history.isNotEmpty()) Text(stringResource(R.string.brClearHistory), Modifier.fillMaxWidth().clickable { ask = true }.padding(16.dp),
            color = Red, fontSize = 16.sp, textAlign = TextAlign.Center)
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false }, text = { Text(stringResource(R.string.brClearHistoryQ)) },
        confirmButton = { TextButton({ BrStore.clearHistory(); rev++; a.markRev++; ask = false }) { Text(stringResource(R.string.brDelete), color = Red) } },
        dismissButton = { TextButton({ ask = false }) { Text(stringResource(R.string.brCancel)) } })
}

@Composable
private fun MarksScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    SubScreen(a, R.string.brBookmarks, true, { q = it }) {
        val list = remember(q, rev, a.markRev) {
            val t = q.trim().lowercase()
            BrStore.marks.filter { t.isEmpty() || it.title.lowercase().contains(t) || it.url.lowercase().contains(t) }
        }
        if (list.isEmpty()) Box(Modifier.weight(1f)) { Empty(R.string.brMarksEmpty) }
        else LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            items(list, key = { it.url }) { m ->
                LinkRow(m.title.ifEmpty { m.url }, m.url, BrIcons.StarOn, trailing = {
                    Box(Modifier.size(34.dp).clip(CircleShape).clickable { BrStore.removeMark(m); rev++; a.markRev++ }, contentAlignment = Alignment.Center) {
                        Icon(BrIcons.Close, stringResource(R.string.brDelete), Modifier.size(16.dp), tint = c.mute)
                    }
                }) { a.screen = BrowserActivity.Screen.PAGE; a.go(m.url) }
                HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = c.line)
            }
        }
    }
}

@Composable
private fun Empty(text: Int) {
    val c = LocalBr.current
    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { Text(stringResource(text), color = c.mute, fontSize = 15.sp) }
}

@Composable
private fun SettingsScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var ask by remember { mutableStateOf(false) }
    SubScreen(a, R.string.brSettings, false) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(8.dp))
            Group {
                SetRow(stringResource(R.string.brSetDefault), if (a.isDefault) stringResource(R.string.brSetDefaultOn) else null, onClick = if (a.isDefault) null else ({ a.makeDefault() })) {
                    if (!a.isDefault) Text(stringResource(R.string.brSetDefaultAsk), color = Red, fontSize = 15.sp)
                }
            }
            Caption(R.string.brSetEngine)
            Group {
                listOf("google" to "Google", "ddg" to "DuckDuckGo", "bing" to "Bing").forEachIndexed { i, (k, l) ->
                    if (i > 0) HorizontalDivider(Modifier.padding(start = 16.dp), thickness = 0.5.dp, color = c.line)
                    SetRow(l, null, onClick = { a.pickEngine(k) }) { if (a.engine == k) Icon(BrIcons.Check, null, Modifier.size(20.dp), tint = Red) }
                }
            }
            Caption(R.string.brSetBar)
            Group {
                SetRow(stringResource(R.string.brBarTop), null, onClick = { a.pickBarBottom(false) }) { if (!a.barBottom) Icon(BrIcons.Check, null, Modifier.size(20.dp), tint = Red) }
                HorizontalDivider(Modifier.padding(start = 16.dp), thickness = 0.5.dp, color = c.line)
                SetRow(stringResource(R.string.brBarBottom), null, onClick = { a.pickBarBottom(true) }) { if (a.barBottom) Icon(BrIcons.Check, null, Modifier.size(20.dp), tint = Red) }
                HorizontalDivider(Modifier.padding(start = 16.dp), thickness = 0.5.dp, color = c.line)
                SetRow(stringResource(R.string.brSetHome), null, onClick = { a.pickHomeBtn(!a.homeBtn) }) {
                    Switch(a.homeBtn, { a.pickHomeBtn(it) }, colors = SwitchDefaults.colors(checkedTrackColor = Color(0xFF30D158), checkedThumbColor = Color.White))
                }
            }
            Caption(R.string.brSetPrivacy)
            Group { SetRow(stringResource(R.string.brSetClear), null, onClick = { ask = true }) {} }
            Caption(R.string.brDownloads)
            Group { SetRow(stringResource(R.string.brSetDl), null, onClick = { a.dlSettings() }) {} }
            Caption(R.string.brAbout)
            Group { SetRow("Studio Browser", a.version()) {} }
            Spacer(Modifier.height(30.dp))
        }
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false }, text = { Text(stringResource(R.string.brClearQ)) },
        confirmButton = { TextButton({ a.clearData(); ask = false }) { Text(stringResource(R.string.brDelete), color = Red) } },
        dismissButton = { TextButton({ ask = false }) { Text(stringResource(R.string.brCancel)) } })
}

@Composable
private fun Caption(text: Int) {
    val c = LocalBr.current
    Text(stringResource(text), Modifier.padding(start = 16.dp, top = 22.dp, bottom = 6.dp), color = c.mute, fontSize = 13.sp)
}

@Composable
private fun SetRow(title: String, sub: String?, onClick: (() -> Unit)? = null, trailing: @Composable () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = c.fg, fontSize = 16.sp)
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 13.sp)
        }
        trailing()
    }
}

