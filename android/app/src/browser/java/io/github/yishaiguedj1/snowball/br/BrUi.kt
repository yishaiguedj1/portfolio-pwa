package io.github.yishaiguedj1.snowball.br

import android.graphics.Bitmap
import android.graphics.Color as AColor
import android.text.format.DateUtils
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/*
 * 26/10/2026 (בקשת המשתמש: "יותר זהה ל־Chrome במראה ויותר Apple בעיצוב", לפי התצוגה המקדימה שאושרה —
 * claude.ai/artifact/E88MeyAc1a5eowdAYo6CmG): המבנה של Chrome לאייפון — שורת כתובת בגלולה למעלה וסרגל כלים למטה
 * (חזרה · קדימה · טאב חדש · טאבים · ⋯), תפריט ⋯ כגיליון עם שורת יעדים, מסך טאבים כהה; הגימור של iOS — רשימות
 * מקובצות, כותרות גדולות, מתגים ירוקים. הכחול של Chrome לכל פעולה, והאדום של Studio רק למה ששייך ל־Studio
 * (הבועה, "סרטונים בדף").
 */
private val Red = Color(0xFFFF4656)
private val Green = Color(0xFF34C759)

data class BrC(val page: Color, val bar: Color, val fill: Color, val card: Color, val screen: Color, val fg: Color,
               val mute: Color, val line: Color, val tint: Color, val dis: Color, val dark: Boolean)

private val Light = BrC(Color.White, Color(0xFFF9F9F9), Color(0xFFECECEE), Color.White, Color(0xFFF2F2F7), Color.Black,
    Color(0xFF6E6E73), Color(0xFFDCDCE0), Color(0xFF1A73E8), Color(0xFFC7C7CC), false)
private val Dark = BrC(Color.Black, Color(0xFF161618), Color(0xFF2C2C2E), Color(0xFF1C1C1E), Color.Black, Color.White,
    Color(0xFF98989F), Color(0xFF38383A), Color(0xFF8AB4F8), Color(0xFF48484A), true)
private val Priv = BrC(Color(0xFF202124), Color(0xFF1F1F23), Color(0xFF35353B), Color(0xFF2A2A2F), Color(0xFF161618), Color.White,
    Color(0xFF9A9AA2), Color(0xFF3E3E45), Color(0xFF8AB4F8), Color(0xFF4A4A50), true)
/** מסך הטאבים — תמיד כהה, כמו ב־Chrome לאייפון */
private val Grid = BrC(Color.White, Color(0xF01C1C1E), Color(0x3D767680), Color(0xFF2C2C2E), Color(0xFF1C1C1E), Color.White,
    Color(0xFFAEAEB2), Color(0xFF3A3A3C), Color(0xFF8AB4F8), Color(0xFF48484A), true)
private val LocalBr = staticCompositionLocalOf { Light }

@Composable
private fun BrTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val b = if (dark) Dark else Light
    val cs = if (dark) darkColorScheme(primary = b.tint, onPrimary = Color.Black, surface = b.card, background = b.screen)
    else lightColorScheme(primary = b.tint, onPrimary = Color.White, surface = b.card, background = b.screen)
    CompositionLocalProvider(LocalBr provides b) { MaterialTheme(colorScheme = cs, content = content) }
}

@Composable
fun BrApp(a: BrowserActivity) {
    BrTheme {
        val c = when {
            a.screen == BrowserActivity.Screen.SWITCHER -> Grid
            a.cur?.private == true && a.screen == BrowserActivity.Screen.PAGE -> Priv
            else -> LocalBr.current
        }
        CompositionLocalProvider(LocalBr provides c) {
            Box(Modifier.fillMaxSize().background(if (a.screen == BrowserActivity.Screen.PAGE) c.bar else c.screen)) {
                when (a.screen) {
                    BrowserActivity.Screen.PAGE -> PageScreen(a)
                    BrowserActivity.Screen.SWITCHER -> Switcher(a)
                    BrowserActivity.Screen.HISTORY -> HistoryScreen(a)
                    BrowserActivity.Screen.BOOKMARKS -> MarksScreen(a)
                    BrowserActivity.Screen.SETTINGS -> SettingsScreen(a)
                    BrowserActivity.Screen.ENGINE -> EngineScreen(a)
                    BrowserActivity.Screen.PASSWORDS -> PasswordsScreen(a)
                    BrowserActivity.Screen.PRIVACY -> PrivacyScreen(a)
                    BrowserActivity.Screen.BARPOS -> BarPosScreen(a)
                    BrowserActivity.Screen.IMPORT -> ImportScreen(a)
                    BrowserActivity.Screen.CHROME -> ChromeScreen(a)
                }
                a.customView?.let { v ->
                    AndroidView({ ctx -> FrameLayout(ctx).apply { setBackgroundColor(AColor.BLACK) } }, Modifier.fillMaxSize(),
                        update = { f -> if (v.parent !== f) { (v.parent as? ViewGroup)?.removeView(v); f.removeAllViews(); f.addView(v, FrameLayout.LayoutParams(-1, -1)) } },
                        onRelease = { it.removeAllViews() })
                }
                FullBubble(a)   // סרטון במסך מלא — הבועה בפינה של המסך
                a.permAsk?.let { PermDialog(it) }
                if (a.clearAsk) ClearDialog(a)
            }
        }
    }
}

/* ======================= אבני בניין ======================= */

private val FavPal = listOf(0xFF1A73E8, 0xFFEA4335, 0xFF34A853, 0xFFF29900, 0xFF9334E6, 0xFFE8710A, 0xFF129EAF, 0xFFD01884)

/** הסמל של אתר: הסמל שלו אם הדף פתוח בטאב, אחרת האות הראשונה על צבע שנגזר מהשם (קבוע לכל אתר) */
@Composable
private fun Fav(a: BrowserActivity, url: String, size: Dp, radius: Dp = size / 4, icon: Bitmap? = null) {
    val host = BrStore.hostOf(url)
    val ic = icon ?: remember(host, a.tabs.size) { a.tabs.firstOrNull { it.icon != null && BrStore.hostOf(it.url) == host }?.icon }
    if (ic != null) { Image(ic.asImageBitmap(), null, Modifier.size(size).clip(RoundedCornerShape(radius))); return }
    val name = if (host.isEmpty()) "?" else BrStore.siteName(host)
    val col = Color(FavPal[(host.hashCode() and 0x7fffffff) % FavPal.size])
    Box(Modifier.size(size).clip(RoundedCornerShape(radius)).background(col), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = Color.White, fontSize = (size.value * 0.48f).sp, fontWeight = FontWeight.Bold)
    }
}

/** אריח צבעוני של iOS בשורת הגדרות */
@Composable
private fun Tile(icon: ImageVector, color: Color) {
    Box(Modifier.size(29.dp).clip(RoundedCornerShape(7.dp)).background(color), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(18.dp), tint = Color.White)
    }
}

/** מתג של iOS: ירוק כשפועל, הכפתור עובר לסוף השורה (בעברית — שמאלה) */
@Composable
private fun IosSwitch(on: Boolean, onChange: (Boolean) -> Unit) {
    val c = LocalBr.current
    val bias by animateFloatAsState(if (on) 1f else -1f, label = "sw")
    Box(Modifier.size(51.dp, 31.dp).clip(RoundedCornerShape(16.dp)).background(if (on) Green else if (c.dark) Color(0xFF39393D) else Color(0xFFE9E9EA))
        .clickable { onChange(!on) }.padding(2.dp)) {
        Box(Modifier.align(BiasAlignment(bias, 0f)).size(27.dp).shadow(2.dp, CircleShape).clip(CircleShape).background(Color.White))
    }
}

/** קבוצה מקובצת של iOS: כותרת קטנה, כרטיס מעוגל, הערה מתחת */
@Composable
private fun Group(header: String? = null, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxWidth().padding(bottom = 28.dp)) {
        if (header != null) Text(header, Modifier.padding(start = 32.dp, end = 32.dp, bottom = 7.dp), color = c.mute, fontSize = 13.sp)
        Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card), content = content)
        if (footer != null) Text(footer, Modifier.padding(start = 32.dp, end = 32.dp, top = 7.dp), color = c.mute, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun Sep(inset: Dp = 60.dp) { HorizontalDivider(Modifier.padding(start = inset), thickness = 0.5.dp, color = LocalBr.current.line) }

/** שורה ברשימה: אריח/סמל בהתחלה, כותרת ותת־כותרת, ערך, וחץ בסוף */
@Composable
private fun IRow(title: String, sub: String? = null, lead: (@Composable () -> Unit)? = null, value: String? = null, color: Color? = null,
                 chevron: Boolean = true, ltrSub: Boolean = false, trailing: (@Composable () -> Unit)? = null, onClick: (() -> Unit)? = null) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = if (sub != null) 60.dp else 46.dp)
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        if (lead != null) { lead(); Spacer(Modifier.width(14.dp)) }
        Column(Modifier.weight(1f)) {
            Text(title, color = color ?: c.fg, fontSize = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 13.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                style = TextStyle(textDirection = if (ltrSub) TextDirection.Ltr else TextDirection.Content))
        }
        if (value != null) { Spacer(Modifier.width(8.dp)); Text(value, color = c.mute, fontSize = 17.sp, maxLines = 1) }
        trailing?.invoke()
        if (chevron && onClick != null) { Spacer(Modifier.width(6.dp)); Icon(BrIcons.ChevFwd, null, Modifier.size(20.dp), tint = if (c.dark) Color(0xFF5A5A5E) else c.dis) }
    }
}

/** כפתור עגול עם סמל (בסרגלים) */
@Composable
private fun IBtn(icon: ImageVector, desc: String, size: Dp = 44.dp, iconSize: Dp = 24.dp, enabled: Boolean = true, tint: Color? = null, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(size).clip(CircleShape).clickable(enabled = enabled, onClick = on), contentAlignment = Alignment.Center) {
        Icon(icon, desc, Modifier.size(iconSize), tint = if (enabled) (tint ?: c.tint) else c.dis)
    }
}

@Composable
private fun CloseCircle(on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(30.dp).clip(CircleShape).background(c.fill).clickable(onClick = on), contentAlignment = Alignment.Center) {
        Icon(BrIcons.Close, stringResource(R.string.brClose), Modifier.size(16.dp), tint = c.mute)
    }
}

/** כותרת עליונה של מסך משנה: "‹ חזרה" בהתחלה, "סיום" בסוף */
@Composable
private fun NavTop(back: String? = null, onBack: () -> Unit = {}, done: String? = null, onDone: () -> Unit = {}) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(44.dp).padding(start = 6.dp, end = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        if (back != null) Row(Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onBack).padding(end = 6.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(BrIcons.ChevBack, null, Modifier.size(30.dp), tint = c.tint)
            Text(back, color = c.tint, fontSize = 17.sp)
        }
        Spacer(Modifier.weight(1f))
        if (done != null) Text(done, Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onDone).padding(6.dp), color = c.tint, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** מסך משנה של iOS: כותרת גדולה שגוללת עם התוכן, ותחתית קבועה (אם יש) */
@Composable
private fun SubPage(title: String, back: String? = null, onBack: () -> Unit = {}, done: Boolean = false, onDone: () -> Unit = {},
                    bottom: (@Composable () -> Unit)? = null, body: LazyListScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxSize().background(c.screen).statusBarsPadding().imePadding()) {
        NavTop(back, onBack, if (done) stringResource(R.string.brDone) else null, onDone)
        LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            item { Text(title, Modifier.padding(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 12.dp), color = c.fg, fontSize = 34.sp, fontWeight = FontWeight.Bold) }
            body()
            item { Spacer(Modifier.height(24.dp)) }
        }
        if (bottom != null) bottom() else Spacer(Modifier.navigationBarsPadding())
    }
}

/** שדה חיפוש של iOS */
@Composable
private fun SearchField(hint: String, q: String, setQ: (String) -> Unit) {
    val c = LocalBr.current
    Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp).fillMaxWidth().height(38.dp).clip(RoundedCornerShape(10.dp)).background(c.fill).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(BrIcons.Search, null, Modifier.size(19.dp), tint = c.mute); Spacer(Modifier.width(6.dp))
        BasicTextField(q, setQ, Modifier.weight(1f), singleLine = true, textStyle = TextStyle(color = c.fg, fontSize = 17.sp, textDirection = TextDirection.Content),
            cursorBrush = SolidColor(c.tint), decorationBox = { inner -> Box { if (q.isEmpty()) Text(hint, color = c.mute, fontSize = 17.sp); inner() } })
        if (q.isNotEmpty()) Box(Modifier.size(22.dp).clip(CircleShape).clickable { setQ("") }, contentAlignment = Alignment.Center) {
            Icon(BrIcons.Close, stringResource(R.string.brClear), Modifier.size(15.dp), tint = c.mute)
        }
    }
}

/** סרגל תחתון של מסך משנה: פעולה בהתחלה, פעולה בסוף */
@Composable
private fun SubBottom(start: String?, startColor: Color? = null, onStart: () -> Unit = {}, end: String?, onEnd: () -> Unit = {}) {
    val c = LocalBr.current
    Column(Modifier.fillMaxWidth().background(c.bar)) {
        HorizontalDivider(thickness = 0.5.dp, color = c.line)
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(50.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            if (start != null) Text(start, Modifier.clickable(onClick = onStart).padding(vertical = 8.dp), color = startColor ?: c.tint, fontSize = 17.sp)
            Spacer(Modifier.weight(1f))
            if (end != null) Text(end, Modifier.clickable(onClick = onEnd).padding(vertical = 8.dp), color = c.tint, fontSize = 17.sp)
        }
    }
}

/* ======================= הדף ======================= */

@Composable
private fun PageScreen(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val start = if (t?.url?.startsWith("http") == true) t.url else ""
    var q by remember(a.editing, t?.id) { mutableStateOf(TextFieldValue(start, TextRange(0, start.length))) }
    val ntp = t == null || t.isNtp
    val showBar = !ntp || a.editing || a.finding
    Column(Modifier.fillMaxSize().background(if (!showBar && !a.barBottom) c.page else c.bar).statusBarsPadding().imePadding()) {
        if (!a.barBottom && showBar) { TopBar(a, q) { q = it }; Line(t) }
        Box(Modifier.weight(1f).fillMaxWidth().background(c.page)) {
            if (t == null || t.isNtp) Ntp(a) else { WebHost(a, t); VideoBubble(a, t) }   // הבועה צמודה לנגן שעל המסך
            if (a.editing) Suggest(a, q) { q = it }
        }
        if (a.barBottom && showBar) { Line(t); TopBar(a, q) { q = it } }
        when {
            a.finding -> FindBar(a)
            a.editing -> KeyRow(a, q) { q = it }
            else -> Toolbar(a)
        }
    }
    if (a.menu) MenuSheet(a)
    if (a.pick && t != null) PickSheet(a, t)
    if (a.info && t != null) InfoSheet(a, t)
    if (a.zoomSheet) ZoomSheet(a)
}

/** קו ההתקדמות מתחת לשורת הכתובת (כחול, דק) — או קו הפרדה כשהדף נטען */
@Composable
private fun Line(t: BrTab?) {
    val c = LocalBr.current
    val p = t?.progress ?: 0
    if (p in 1..99 && t?.url?.startsWith("http") == true)
        LinearProgressIndicator(progress = { p / 100f }, modifier = Modifier.fillMaxWidth().height(2.5.dp), color = c.tint, trackColor = Color.Transparent, drawStopIndicator = {})
    else HorizontalDivider(thickness = 0.5.dp, color = c.line)
}

@Composable
private fun TopBar(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().background(c.bar).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (a.editing) EditField(a, q, setQ) else Omnibox(a)
    }
}

/** שורת הכתובת במנוחה: ⚙ פרטי האתר · מנעול ודומיין באמצע · שיתוף. גרירה הצידה = הטאב הבא, כמו ב־Chrome */
@Composable
private fun androidx.compose.foundation.layout.RowScope.Omnibox(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val web = t?.url?.startsWith("http") == true
    if (a.homeBtn) { IBtn(BrIcons.Home, stringResource(R.string.brHome), size = 40.dp, iconSize = 22.dp) { a.goHome() }; Spacer(Modifier.width(4.dp)) }
    Row(
        Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(20.dp)).background(c.fill)
            .pointerInput(t?.id) {
                var dx = 0f
                detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = {
                    if (kotlin.math.abs(dx) > 90f) a.swipeTab(if ((dx < 0) != rtl) 1 else -1)
                }) { ch, d -> ch.consume(); dx += d }
            }
            .clickable { a.editing = true }.padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (web) IBtn(BrIcons.Tune, stringResource(R.string.brInfo), size = 32.dp, iconSize = 18.dp, tint = c.mute) { a.info = true } else Spacer(Modifier.width(32.dp))
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            if (web) {
                val secure = t!!.url.startsWith("https://")
                Icon(if (secure) BrIcons.Lock else BrIcons.Warn, null, Modifier.size(13.dp), tint = if (secure) c.mute else Color(0xFFFF9500))
                Spacer(Modifier.width(5.dp))
                Text(BrStore.hostOf(t.url).ifEmpty { t.url }, color = c.fg, fontSize = 16.sp, fontWeight = FontWeight.Medium, maxLines = 1,
                    overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Ltr))
            } else {
                Icon(BrIcons.Search, null, Modifier.size(16.dp), tint = c.mute); Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.brHintLong), color = c.mute, fontSize = 16.sp, maxLines = 1)
            }
        }
        if (web) IBtn(BrIcons.Share, stringResource(R.string.brShare), size = 32.dp, iconSize = 18.dp) { a.share() } else Spacer(Modifier.width(32.dp))
    }
}

/** שורת הכתובת בעריכה: השדה, ✕ לניקוי, ו"ביטול" בסוף */
@Composable
private fun androidx.compose.foundation.layout.RowScope.EditField(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    Row(Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(20.dp)).background(c.fill).padding(start = 10.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(BrIcons.Search, null, Modifier.size(18.dp), tint = c.mute); Spacer(Modifier.width(8.dp))
        BasicTextField(
            q, setQ, Modifier.weight(1f).focusRequester(fr), singleLine = true,
            textStyle = TextStyle(color = c.fg, fontSize = 17.sp, textDirection = TextDirection.Content),
            cursorBrush = SolidColor(c.tint),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onGo = { a.go(q.text) }),
            decorationBox = { inner -> Box { if (q.text.isEmpty()) Text(stringResource(R.string.brHintLong), color = c.mute, fontSize = 17.sp, maxLines = 1); inner() } }
        )
        if (q.text.isNotEmpty()) Box(Modifier.size(20.dp).clip(CircleShape).background(c.mute.copy(alpha = 0.55f)).clickable { setQ(TextFieldValue("")) }, contentAlignment = Alignment.Center) {
            Icon(BrIcons.Close, stringResource(R.string.brClear), Modifier.size(13.dp), tint = Color.White)
        }
    }
    Spacer(Modifier.width(12.dp))
    Text(stringResource(R.string.brCancel), Modifier.clickable { a.editing = false }, color = c.tint, fontSize = 17.sp)
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

/** מעל המקלדת, כמו ב־Chrome: . / ‎.com וחיפוש קולי */
@Composable
private fun KeyRow(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    fun ins(s: String) {
        val t = q.text; val from = q.selection.min; val to = q.selection.max
        setQ(TextFieldValue(t.substring(0, from) + s + t.substring(to), TextRange(from + s.length)))
    }
    Column(Modifier.fillMaxWidth().background(c.bar)) {
        HorizontalDivider(thickness = 0.5.dp, color = c.line)
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(46.dp).padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (k in listOf(".", "/", ".com")) Box(Modifier.height(32.dp).defaultMinSize(minWidth = 46.dp).clip(RoundedCornerShape(16.dp)).background(c.fill)
                .clickable { ins(k) }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text(k, color = c.fg, fontSize = 16.sp, style = TextStyle(textDirection = TextDirection.Ltr))
            }
            Spacer(Modifier.weight(1f))
            IBtn(BrIcons.Mic, stringResource(R.string.brVoice), size = 40.dp, iconSize = 22.dp) { a.voice() }
        }
    }
}

/** סרגל הכלים למטה: חזרה · קדימה · טאב חדש · טאבים · ⋯ */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Toolbar(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    var tabMenu by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().background(c.bar)) {
        HorizontalDivider(thickness = 0.5.dp, color = c.line)
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(50.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceAround) {
            IBtn(BrIcons.ChevBack, stringResource(R.string.brClose), iconSize = 30.dp, enabled = t?.canBack == true) { t?.web?.goBack() }
            IBtn(BrIcons.ChevFwd, stringResource(R.string.brForward), iconSize = 30.dp, enabled = t?.canFwd == true) { a.forward() }
            IBtn(BrIcons.Add, stringResource(R.string.brNewTab), iconSize = 28.dp) { a.newTab("", private = t?.private == true) }
            val n = a.tabs.count { it.private == (t?.private == true) }
            Box {
                Box(Modifier.size(44.dp).clip(CircleShape).combinedClickable(onClick = { a.openSwitcher() }, onLongClick = { tabMenu = true }), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(22.dp).border(2.2.dp, c.tint, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
                        Text(if (n > 99) ":D" else "$n", color = c.tint, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                DropdownMenu(tabMenu, { tabMenu = false }, containerColor = c.card) {
                    DropdownMenuItem({ Text(stringResource(R.string.brNewTab)) }, { tabMenu = false; a.newTab("") }, leadingIcon = { Icon(BrIcons.Add, null) })
                    if (a.privOk) DropdownMenuItem({ Text(stringResource(R.string.brNewPrivate)) }, { tabMenu = false; a.newTab("", private = true) }, leadingIcon = { Icon(BrIcons.Private, null) })
                    if (t != null) DropdownMenuItem({ Text(stringResource(R.string.brCloseTab)) }, { tabMenu = false; a.close(t) }, leadingIcon = { Icon(BrIcons.Close, null) })
                }
            }
            IBtn(BrIcons.More, stringResource(R.string.brMenu), iconSize = 26.dp) { a.menu = true }
        }
    }
}

/** חיפוש בדף — סרגל מעל המקלדת: השדה, "2 מתוך 3", ⌃ ⌄, סיום */
@Composable
private fun FindBar(a: BrowserActivity) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    var q by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().background(c.bar)) {
        HorizontalDivider(thickness = 0.5.dp, color = c.line)
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f).height(38.dp).clip(RoundedCornerShape(10.dp)).background(c.fill).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(BrIcons.Search, null, Modifier.size(18.dp), tint = c.mute); Spacer(Modifier.width(6.dp))
                BasicTextField(q, { q = it; a.find(it) }, Modifier.weight(1f).focusRequester(fr), singleLine = true,
                    textStyle = TextStyle(color = c.fg, fontSize = 17.sp, textDirection = TextDirection.Content), cursorBrush = SolidColor(c.tint),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { a.findNext(true) }),
                    decorationBox = { inner -> Box { if (q.isEmpty()) Text(stringResource(R.string.brFind), color = c.mute, fontSize = 17.sp); inner() } })
                if (q.isNotEmpty()) Text(stringResource(R.string.brFindN, a.findRes.first, a.findRes.second), color = c.mute, fontSize = 15.sp)
            }
            IBtn(BrIcons.Up, stringResource(R.string.brPrev), size = 40.dp) { a.findNext(false) }
            IBtn(BrIcons.Down, stringResource(R.string.brNext), size = 40.dp) { a.findNext(true) }
            Text(stringResource(R.string.brDone), Modifier.clickable { a.stopFind() }.padding(start = 4.dp), color = c.tint, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
    }
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

/* ---------------- WebView ---------------- */

@Composable
private fun WebHost(a: BrowserActivity, t: BrTab) {
    AndroidView(
        factory = { ctx -> SwipeRefreshLayout(ctx).apply { setColorSchemeColors(0xFF1A73E8.toInt()); setOnRefreshListener { a.cur?.web?.reload(); isRefreshing = false } } },
        modifier = Modifier.fillMaxSize(),
        update = { srl ->
            val w = a.ensureWeb(t)
            if (srl.getChildAt(0) !== w) { (w.parent as? ViewGroup)?.removeView(w); srl.removeAllViews(); srl.addView(w, ViewGroup.LayoutParams(-1, -1)) }
        },
        onRelease = { it.removeAllViews() }
    )
}

/* ======================= טאב חדש ======================= */

@Composable
private fun Ntp(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val priv = t?.private == true
    val sites = remember(a.markRev) { BrStore.topSites(8) }
    val recent = remember(a.markRev) { BrStore.history.asReversed().distinctBy { it.url }.filter { it.title.isNotEmpty() }.take(3) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(64.dp))
        if (priv) {
            Box(Modifier.size(64.dp).clip(CircleShape).background(c.fill), contentAlignment = Alignment.Center) { Icon(BrIcons.Private, null, Modifier.size(34.dp), tint = c.fg) }
            Spacer(Modifier.height(14.dp))
            Text(stringResource(R.string.brPrivateTitle), color = c.fg, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.brPrivateHint), color = c.mute, fontSize = 15.sp, textAlign = TextAlign.Center, lineHeight = 21.sp)
            Spacer(Modifier.height(26.dp))
            NtpSearch(a)
            return@Column
        }
        Box(Modifier.size(64.dp).shadow(10.dp, RoundedCornerShape(18.dp), ambientColor = Red, spotColor = Red).clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFFF6B78), Red))), contentAlignment = Alignment.Center) {
            Icon(BrIcons.Globe, null, Modifier.size(36.dp), tint = Color.White)
        }
        Spacer(Modifier.height(12.dp))
        Text("Studio Browser", color = c.fg, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(26.dp))
        NtpSearch(a)
        Spacer(Modifier.height(28.dp))
        sites.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { s -> SiteTile(a, s, Modifier.weight(1f)) { a.go(s.url) } }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
            Spacer(Modifier.height(16.dp))
        }
        if (recent.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if (c.dark) c.card else c.screen).padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.brContinue), Modifier.weight(1f), color = c.fg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.brAll), Modifier.clickable { a.screen = BrowserActivity.Screen.HISTORY }, color = c.tint, fontSize = 15.sp)
                }
                recent.forEach { v ->
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(8.dp)).clickable { a.go(v.url) }, verticalAlignment = Alignment.CenterVertically) {
                        Fav(a, v.url, 40.dp, 10.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(v.title, color = c.fg, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(BrStore.hostOf(v.url) + " · " + DateUtils.getRelativeTimeSpanString(v.at).toString(), color = c.mute, fontSize = 13.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
private fun NtpSearch(a: BrowserActivity) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(50.dp).shadow(6.dp, RoundedCornerShape(25.dp)).clip(RoundedCornerShape(25.dp)).background(if (c.dark) c.fill else Color.White)
        .clickable { a.editing = true }.padding(start = 16.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(BrIcons.Search, null, Modifier.size(20.dp), tint = c.mute); Spacer(Modifier.width(10.dp))
        Text(stringResource(R.string.brHintLong), Modifier.weight(1f), color = c.mute, fontSize = 17.sp, maxLines = 1)
        IBtn(BrIcons.Mic, stringResource(R.string.brVoice), size = 40.dp, iconSize = 22.dp) { a.voice() }
    }
}

@Composable
private fun SiteTile(a: BrowserActivity, s: BrMark, m: Modifier, on: () -> Unit) {
    val c = LocalBr.current
    Column(m.clip(RoundedCornerShape(14.dp)).clickable(onClick = on).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(if (c.dark) c.fill else c.screen), contentAlignment = Alignment.Center) {
            Fav(a, s.url, 30.dp, 15.dp)
        }
        Spacer(Modifier.height(6.dp))
        Text(s.title, color = c.mute, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/* ======================= הצעות בשורת הכתובת ======================= */

@Composable
private fun Suggest(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    // כל הכתובת מסומנת (רק נכנסו לעריכה) = עוד לא הקלידו — מציגים את הדפים האחרונים
    val qq = if (q.text.isNotEmpty() && q.selection.length == q.text.length) "" else q.text.trim()
    var net by remember { mutableStateOf<List<String>>(emptyList()) }
    LaunchedEffect(qq, a.engine, a.suggestOn) {
        net = emptyList()
        if (qq.isNotBlank()) { delay(120); net = withContext(Dispatchers.IO) { a.fetchSuggest(qq) } }
    }
    val list = remember(qq, a.markRev) {
        if (qq.isBlank()) BrStore.history.asReversed().distinctBy { it.url }.take(6).map { BrMark(it.url, it.title, it.at) } else BrStore.suggest(qq, 5)
    }
    val clip = remember(a.editing) { a.clipHasUrl() }
    val isUrl = qq.isNotEmpty() && BrStore.toUrl(qq, a.engine).let { it.isNotEmpty() && it != BrStore.searchUrl(a.engine, qq) }
    val eng = when (a.engine) { "ddg" -> "DuckDuckGo"; "bing" -> "Bing"; else -> "Google" }
    run {
        LazyColumn(Modifier.fillMaxSize().background(c.page)) {
            if (clip) {
                item { Text(stringResource(R.string.brClipLink), Modifier.padding(start = 16.dp, top = 14.dp, bottom = 4.dp), color = c.mute, fontSize = 13.sp) }
                item { SugRow(BrIcons.Paste, stringResource(R.string.brPasteGo), null, null) { a.pasteGo() } }
                item { Spacer(Modifier.fillMaxWidth().height(8.dp).background(c.screen)) }
            }
            if (qq.isNotBlank()) item {
                SugRow(if (isUrl) BrIcons.Globe else BrIcons.Search, qq, if (isUrl) null else stringResource(R.string.brSearchWith, eng), null) { a.go(qq) }
                Sep(56.dp)
            }
            items(list, key = { "m" + it.url }) { m ->
                SugRow(if (BrStore.isMarked(m.url)) BrIcons.StarOn else BrIcons.History, m.title.ifEmpty { m.url }, BrStore.hostOf(m.url).ifEmpty { m.url },
                    { setQ(TextFieldValue(m.url, TextRange(m.url.length))) }, ltrSub = true) { a.go(m.url) }
                Sep(56.dp)
            }
            items(net, key = { "s$it" }) { s ->
                SugRow(BrIcons.Search, s, null, { setQ(TextFieldValue("$s ", TextRange(s.length + 1))) }, bold = qq) { a.go(s) }
                Sep(56.dp)
            }
        }
    }
}

/** שורת הצעה: סמל · טקסט (החלק שהוקלד מודגש) · ↖ להעתקה לשדה בלי ללכת */
@Composable
private fun SugRow(icon: ImageVector, title: String, sub: String?, append: (() -> Unit)?, ltrSub: Boolean = false, bold: String? = null, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = if (sub != null) 58.dp else 48.dp).clickable(onClick = on).padding(start = 16.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(20.dp), tint = c.mute)
        Spacer(Modifier.width(20.dp))
        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
            val text = if (bold != null && bold.isNotEmpty() && title.startsWith(bold, ignoreCase = true)) buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(title.substring(0, bold.length)) }; append(title.substring(bold.length))
            } else buildAnnotatedString { append(title) }
            Text(text, color = c.fg, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Content))
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(textDirection = if (ltrSub) TextDirection.Ltr else TextDirection.Content))
        }
        if (append != null) IBtn(BrIcons.Append, stringResource(R.string.brEdit), size = 40.dp, iconSize = 20.dp, tint = c.mute, on = append)
    }
}

/* ======================= התפריט ⋯ — גיליון כמו ב־Chrome לאייפון ======================= */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MenuSheet(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val web = t?.url?.startsWith("http") == true
    @Suppress("UNUSED_VARIABLE") val rev = a.markRev
    val st = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    fun close() { a.menu = false }
    ModalBottomSheet(onDismissRequest = { close() }, sheetState = st, containerColor = c.screen) {
        LazyRow(contentPadding = PaddingValues(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            item { Dest(BrIcons.StarOn, R.string.brBookmarks) { close(); a.markFolder = 0; a.screen = BrowserActivity.Screen.BOOKMARKS } }
            item { Dest(BrIcons.History, R.string.brHistory) { close(); a.screen = BrowserActivity.Screen.HISTORY } }
            item { Dest(BrIcons.Key, R.string.brSetPw) { close(); a.screen = BrowserActivity.Screen.PASSWORDS } }
            item { Dest(BrIcons.Dl, R.string.brDownloads) { a.openDownloads() } }
            item { Dest(BrIcons.Settings, R.string.brSettings) { close(); a.screen = BrowserActivity.Screen.SETTINGS } }
        }
        Spacer(Modifier.height(16.dp))
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            MCard {
                Act(R.string.brNewTab, BrIcons.Add) { close(); a.newTab("") }
                if (a.privOk) { Sep(16.dp); Act(R.string.brNewPrivate, BrIcons.Private) { close(); a.newTab("", private = true) } }
                Sep(16.dp); Act(R.string.brClearData, BrIcons.Trash) { close(); a.clearAsk = true }
            }
            if (web) MCard {
                val loading = (t!!.progress) in 1..99
                Act(if (loading) R.string.brStop else R.string.brRefresh, if (loading) BrIcons.Close else BrIcons.Refresh) { a.reload() }
                Sep(16.dp)
                val marked = BrStore.isMarked(t.url)
                Act(if (marked) R.string.brStarOff else R.string.brStar, if (marked) BrIcons.StarOn else BrIcons.Star) { a.toggleMark(); close() }
                Sep(16.dp); Act(R.string.brTranslate, BrIcons.Translate) { a.translate() }
                Sep(16.dp); Act(R.string.brFind, BrIcons.Search) { a.startFind() }
                Sep(16.dp); Act(R.string.brDesktop, BrIcons.Desktop, check = t.desktop) { a.toggleDesktop() }
                Sep(16.dp); Act(R.string.brTextSize, BrIcons.TextSize) { close(); a.zoomSheet = true }
                Sep(16.dp); Act(R.string.brInstall, BrIcons.Install) { a.install() }
            }
            if ((t?.foundN ?: 0) > 0) MCard {
                // אותה בחירה של הבועה: ממצא אחד מוריד מיד, כמה — הרשימה
                Act(R.string.brVideos, BrIcons.Video, iconTint = Red, badge = "${t!!.foundN}") {
                    close(); val ps = a.picks(t); if (ps.size == 1) a.download(ps[0]) else a.pick = true
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun Dest(icon: ImageVector, label: Int, on: () -> Unit) {
    val c = LocalBr.current
    Column(Modifier.width(74.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = on).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(58.dp).clip(RoundedCornerShape(16.dp)).background(c.card), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(26.dp), tint = c.tint) }
        Spacer(Modifier.height(7.dp))
        Text(stringResource(label), color = c.fg.copy(alpha = 0.8f), fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2, lineHeight = 14.sp)
    }
}

@Composable
private fun MCard(content: @Composable ColumnScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card), content = content)
}

@Composable
private fun Act(label: Int, icon: ImageVector, iconTint: Color? = null, badge: String? = null, check: Boolean = false, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(50.dp).clickable(onClick = on).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(stringResource(label), Modifier.weight(1f), color = c.fg, fontSize = 17.sp)
        if (badge != null) { Text(badge, color = c.mute, fontSize = 15.sp); Spacer(Modifier.width(10.dp)) }
        if (check) { Icon(BrIcons.Check, null, Modifier.size(20.dp), tint = c.tint); Spacer(Modifier.width(10.dp)) }
        Icon(icon, null, Modifier.size(22.dp), tint = iconTint ?: c.tint)
    }
}

/* ======================= גיליונות: מה להוריד · פרטי האתר · גודל הטקסט ======================= */

@Composable
private fun SheetHead(title: String, sub: String?, lead: (@Composable () -> Unit)? = null, ltrTitle: Boolean = false, close: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        if (lead != null) { lead(); Spacer(Modifier.width(12.dp)) }
        Column(Modifier.weight(1f)) {
            Text(title, color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(textDirection = if (ltrTitle) TextDirection.Ltr else TextDirection.Content))
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        CloseCircle(close)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickSheet(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val ps = a.picks(t)
    ModalBottomSheet(onDismissRequest = { a.pick = false }, containerColor = c.screen) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            SheetHead(stringResource(R.string.brPick), BrStore.hostOf(t.url), close = { a.pick = false })
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card).padding(10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(112.dp, 63.dp).clip(RoundedCornerShape(8.dp)).background(Brush.linearGradient(listOf(Color(0xFF3A3A3C), Color(0xFF1C1C1E)))),
                    contentAlignment = Alignment.Center) {
                    t.thumb?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                        ?: Icon(BrIcons.Video, null, Modifier.size(26.dp), tint = Color.White.copy(alpha = 0.85f))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.title.ifEmpty { BrStore.hostOf(t.url) }, color = c.fg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 19.sp)
                    Text(stringResource(R.string.brOptions, ps.size), color = c.mute, fontSize = 13.sp)
                }
            }
            Group(stringResource(R.string.brFoundInPage)) {
                ps.forEachIndexed { i, p ->
                    if (i > 0) Sep()
                    IRow(stringResource(p.label), p.host, lead = { Tile(BrIcons.Video, if (p.page) Red else Color(0xFF007AFF)) }, chevron = false, ltrSub = true,
                        trailing = { Icon(BrIcons.Dl, null, Modifier.size(22.dp), tint = c.tint) }) { a.download(p) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InfoSheet(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val secure = t.url.startsWith("https://")
    var ask by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = { a.info = false }, containerColor = c.screen) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            SheetHead(BrStore.hostOf(t.url), t.title, lead = { Fav(a, t.url, 40.dp, 10.dp, t.icon) }, ltrTitle = true, close = { a.info = false })
            Group {
                IRow(stringResource(if (secure) R.string.brSecure else R.string.brNotSecureShort), stringResource(if (secure) R.string.brSecureSub else R.string.brNotSecure),
                    lead = { Tile(if (secure) BrIcons.Lock else BrIcons.Warn, if (secure) Green else Color(0xFFFF3B30)) }, chevron = false)
            }
            Group {
                IRow(stringResource(R.string.brCopyLink), lead = { Tile(BrIcons.Copy, Color(0xFF8E8E93)) }, chevron = false) { a.copyLink(); a.info = false }
                Sep()
                IRow(stringResource(R.string.brShare), lead = { Tile(BrIcons.Share, Color(0xFF007AFF)) }, chevron = false) { a.info = false; a.share() }
            }
            Group { IRow(stringResource(R.string.brSiteClear), color = Color(0xFFFF3B30), chevron = false) { ask = true } }
        }
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false }, text = { Text(stringResource(R.string.brSiteClearQ, BrStore.hostOf(t.url))) },
        confirmButton = { TextButton({ ask = false; a.clearSite(t) }) { Text(stringResource(R.string.brDelete), color = Color(0xFFFF3B30)) } },
        dismissButton = { TextButton({ ask = false }) { Text(stringResource(R.string.brCancel)) } })
}

private val ZOOMS = listOf(50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ZoomSheet(a: BrowserActivity) {
    val c = LocalBr.current
    ModalBottomSheet(onDismissRequest = { a.zoomSheet = false }, containerColor = c.screen) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 20.dp)) {
            SheetHead(stringResource(R.string.brTextSize), null, close = { a.zoomSheet = false })
            Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                val down = ZOOMS.lastOrNull { it < a.zoom }; val up = ZOOMS.firstOrNull { it > a.zoom }
                ZoomBtn("A", 15, stringResource(R.string.brSmaller), down != null) { down?.let { a.pickZoom(it) } }
                Text("${a.zoom}%", Modifier.weight(1f), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                ZoomBtn("A", 24, stringResource(R.string.brBigger), up != null) { up?.let { a.pickZoom(it) } }
            }
            if (a.zoom != 100) Text(stringResource(R.string.brReset), Modifier.align(Alignment.CenterHorizontally).padding(top = 14.dp).clickable { a.pickZoom(100) },
                color = c.tint, fontSize = 17.sp)
        }
    }
}

@Composable
private fun ZoomBtn(label: String, size: Int, desc: String, enabled: Boolean, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(56.dp, 44.dp).clip(RoundedCornerShape(10.dp)).background(c.fill).clickable(enabled = enabled, onClick = on), contentAlignment = Alignment.Center) {
        Text(label, color = if (enabled) c.tint else c.dis, fontSize = size.sp, fontWeight = FontWeight.SemiBold)
    }
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

@Composable
private fun ClearDialog(a: BrowserActivity) {
    AlertDialog(onDismissRequest = { a.clearAsk = false }, title = { Text(stringResource(R.string.brClearData)) }, text = { Text(stringResource(R.string.brClearQ)) },
        confirmButton = { TextButton({ a.clearData(); a.clearAsk = false }) { Text(stringResource(R.string.brDelete), color = Color(0xFFFF3B30)) } },
        dismissButton = { TextButton({ a.clearAsk = false }) { Text(stringResource(R.string.brCancel)) } })
}

/* ======================= מסך הטאבים — כהה, כמו ב־Chrome לאייפון ======================= */

@Composable
private fun Switcher(a: BrowserActivity) {
    val c = LocalBr.current
    var more by remember { mutableStateOf(false) }
    val list = a.tabs.filter { it.private == a.swPrivate }
    Column(Modifier.fillMaxSize().background(c.screen).statusBarsPadding()) {
        Box(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp), contentAlignment = Alignment.Center) {
            Row(Modifier.height(36.dp).clip(RoundedCornerShape(10.dp)).background(c.fill).padding(2.dp)) {
                if (a.privOk) SegBox(a.swPrivate, { a.swPrivate = true }) { Icon(BrIcons.Private, stringResource(R.string.brPrivate), Modifier.size(20.dp), tint = Color.White) }
                SegBox(!a.swPrivate, { a.swPrivate = false }) {
                    Box(Modifier.size(19.dp).border(2.dp, Color.White, RoundedCornerShape(5.dp)), contentAlignment = Alignment.Center) {
                        val n = a.tabs.count { !it.private }
                        Text(if (n > 99) ":D" else "$n", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        if (list.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(stringResource(if (a.swPrivate) R.string.brPrivateNone else R.string.brNoTabs), color = c.mute, fontSize = 17.sp, textAlign = TextAlign.Center)
            }
        } else LazyVerticalGrid(GridCells.Fixed(2), Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            items(list, key = { it.id }) { t -> TabCard(a, t) }
        }
        Column(Modifier.fillMaxWidth().background(c.bar)) {
            Row(Modifier.fillMaxWidth().navigationBarsPadding().height(56.dp).padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    Text(stringResource(R.string.brEdit), Modifier.clickable { more = true }.padding(vertical = 8.dp), color = c.tint, fontSize = 17.sp)
                    DropdownMenu(more, { more = false }, containerColor = Color(0xFF2C2C2E)) {
                        DropdownMenuItem({ Text(stringResource(R.string.brCloseAll), color = Color(0xFFFF453A)) },
                            { more = false; a.closeAll(a.swPrivate); if (a.swPrivate) a.swPrivate = false })
                    }
                }
                Box(Modifier.size(44.dp).clip(CircleShape).background(c.tint).clickable { a.screen = BrowserActivity.Screen.PAGE; a.newTab("", private = a.swPrivate) },
                    contentAlignment = Alignment.Center) { Icon(BrIcons.Add, stringResource(R.string.brNewTab), Modifier.size(26.dp), tint = Color(0xFF1C1C1E)) }
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                    Text(stringResource(R.string.brDone), Modifier.clickable {
                        if (a.cur == null) a.newTab("")
                        a.screen = BrowserActivity.Screen.PAGE
                    }.padding(vertical = 8.dp), color = c.tint, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun SegBox(on: Boolean, click: () -> Unit, content: @Composable () -> Unit) {
    Box(Modifier.size(78.dp, 32.dp).clip(RoundedCornerShape(8.dp)).background(if (on) Color(0xFF636366) else Color.Transparent).clickable(onClick = click),
        contentAlignment = Alignment.Center) { content() }
}

@Composable
private fun TabCard(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val on = t === a.cur
    Column(
        Modifier.fillMaxWidth().height(212.dp).clip(RoundedCornerShape(14.dp)).background(c.card)
            .then(if (on) Modifier.border(3.dp, c.tint, RoundedCornerShape(14.dp)) else Modifier)
            .clickable { a.select(t); a.screen = BrowserActivity.Screen.PAGE }
    ) {
        Row(Modifier.fillMaxWidth().height(34.dp).padding(start = 8.dp, end = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            if (t.url.startsWith("http")) Fav(a, t.url, 18.dp, 4.dp, t.icon) else Box(Modifier.size(18.dp))
            Spacer(Modifier.width(7.dp))
            Text(t.title.ifEmpty { if (t.url.startsWith("http")) BrStore.hostOf(t.url) else stringResource(R.string.brNewTab) },
                Modifier.weight(1f), color = Color.White, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Box(Modifier.size(30.dp).clip(CircleShape).clickable { a.close(t) }, contentAlignment = Alignment.Center) {
                Icon(BrIcons.Close, stringResource(R.string.brCloseTab), Modifier.size(15.dp), tint = c.mute)
            }
        }
        Box(Modifier.fillMaxSize().background(if (t.private) Color(0xFF202124) else Color.White)) {
            t.thumb?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = Alignment.TopCenter) }
        }
    }
}

/* ======================= היסטוריה ======================= */

@Composable
private fun HistoryScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    var edit by remember { mutableStateOf(false) }
    val today = stringResource(R.string.brToday); val yday = stringResource(R.string.brYesterday)
    val days = remember(q, rev, a.markRev) {
        val t = q.trim().lowercase()
        val list = BrStore.history.asReversed().filter { t.isEmpty() || it.title.lowercase().contains(t) || it.url.lowercase().contains(t) }.take(500)
        list.groupBy { java.util.Calendar.getInstance().apply { timeInMillis = it.at }.let { k -> k.get(java.util.Calendar.YEAR) * 1000 + k.get(java.util.Calendar.DAY_OF_YEAR) } }.values.toList()
    }
    val time = remember { java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT) }
    val dayFmt = remember { java.text.SimpleDateFormat("EEEE, d MMMM", java.util.Locale.getDefault()) }
    SubPage(stringResource(R.string.brHistory), done = true, onDone = { a.screen = BrowserActivity.Screen.PAGE },
        bottom = { SubBottom(stringResource(R.string.brClearData) + "…", Color(0xFFFF3B30), { a.clearAsk = true }, stringResource(if (edit) R.string.brDone else R.string.brEdit), { edit = !edit }) }) {
        item { SearchField(stringResource(R.string.brSearchHistory), q) { q = it } }
        if (days.isEmpty()) item { Empty(R.string.brHistoryEmpty) }
        days.forEach { day ->
            item {
                val at = day[0].at
                val label = when {
                    DateUtils.isToday(at) -> today
                    DateUtils.isToday(at + DateUtils.DAY_IN_MILLIS) -> yday
                    else -> dayFmt.format(java.util.Date(at))
                }
                Group(label) {
                    day.forEachIndexed { i, v ->
                        if (i > 0) Sep(58.dp)
                        IRow(v.title.ifEmpty { v.url }, BrStore.hostOf(v.url), lead = {
                            if (edit) Box(Modifier.size(28.dp).clip(CircleShape).background(Color(0xFFFF3B30)).clickable { BrStore.removeVisit(v); rev++; a.markRev++ },
                                contentAlignment = Alignment.Center) { Icon(BrIcons.Minus, stringResource(R.string.brDelete), Modifier.size(18.dp), tint = Color.White) }
                            else Fav(a, v.url, 28.dp, 7.dp)
                        }, value = time.format(java.util.Date(v.at)), chevron = false, ltrSub = true) {
                            if (!edit) { a.screen = BrowserActivity.Screen.PAGE; a.go(v.url) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Empty(text: Int) {
    val c = LocalBr.current
    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { Text(stringResource(text), color = c.mute, fontSize = 17.sp) }
}

/* ======================= סימניות ======================= */

@Composable
private fun MarksScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    var edit by remember { mutableStateOf(false) }
    val all = remember(rev, a.markRev) { BrStore.marks.toList() }
    val imported = all.count { it.imp }
    val folders = imported > 0
    val title = when (a.markFolder) { 1 -> stringResource(R.string.brMobileMarks); 2 -> stringResource(R.string.brImportedMarks); else -> stringResource(R.string.brBookmarks) }
    val list = run {
        val t = q.trim().lowercase()
        when {
            t.isNotEmpty() -> all.filter { it.title.lowercase().contains(t) || it.url.lowercase().contains(t) }
            a.markFolder == 1 -> all.filter { !it.imp }
            a.markFolder == 2 -> all.filter { it.imp }
            folders -> emptyList()
            else -> all
        }
    }
    SubPage(title, back = if (a.markFolder != 0) stringResource(R.string.brBookmarks) else null, onBack = { a.markFolder = 0 },
        done = true, onDone = { a.markFolder = 0; a.screen = BrowserActivity.Screen.PAGE },
        bottom = { SubBottom(null, end = stringResource(if (edit) R.string.brDone else R.string.brEdit), onEnd = { edit = !edit }) }) {
        item { SearchField(stringResource(R.string.brSearchMarks), q) { q = it } }
        if (a.markFolder == 0 && folders && q.isBlank()) item {
            Group {
                IRow(stringResource(R.string.brMobileMarks), lead = { Icon(BrIcons.Folder, null, Modifier.size(28.dp), tint = c.tint) }, value = "${all.size - imported}") { a.markFolder = 1 }
                Sep(58.dp)
                IRow(stringResource(R.string.brImportedMarks), lead = { Icon(BrIcons.Folder, null, Modifier.size(28.dp), tint = c.tint) }, value = "$imported") { a.markFolder = 2 }
            }
        }
        if (list.isEmpty() && !(a.markFolder == 0 && folders && q.isBlank())) item { Empty(R.string.brMarksEmpty) }
        if (list.isNotEmpty()) item {
            Group {
                list.forEachIndexed { i, m ->
                    if (i > 0) Sep(58.dp)
                    IRow(m.title.ifEmpty { m.url }, BrStore.hostOf(m.url), lead = {
                        if (edit) Box(Modifier.size(28.dp).clip(CircleShape).background(Color(0xFFFF3B30)).clickable { BrStore.removeMark(m); rev++; a.markRev++ },
                            contentAlignment = Alignment.Center) { Icon(BrIcons.Minus, stringResource(R.string.brDelete), Modifier.size(18.dp), tint = Color.White) }
                        else Fav(a, m.url, 28.dp, 7.dp)
                    }, chevron = false, ltrSub = true) {
                        if (!edit) { a.markFolder = 0; a.screen = BrowserActivity.Screen.PAGE; a.go(m.url) }
                    }
                }
            }
        }
    }
}

/* ======================= הגדרות ======================= */

@Composable
private fun SettingsScreen(a: BrowserActivity) {
    val c = LocalBr.current
    val back = stringResource(R.string.brSettings)
    val eng = when (a.engine) { "ddg" -> "DuckDuckGo"; "bing" -> "Bing"; else -> "Google" }
    SubPage(back, done = true, onDone = { a.screen = BrowserActivity.Screen.PAGE }) {
        if (a.lastImport.isEmpty() && BrStore.marks.none { it.imp }) item {
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(52.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(Color(0xFF4C8DF6), Color(0xFF1A73E8)))),
                    contentAlignment = Alignment.Center) { Icon(BrIcons.StarOn, null, Modifier.size(28.dp), tint = Color.White) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.brPromoTitle), color = c.fg, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.brPromoSub), color = c.mute, fontSize = 14.sp, lineHeight = 18.sp)
                }
                Spacer(Modifier.width(8.dp))
                Box(Modifier.height(32.dp).clip(RoundedCornerShape(16.dp)).background(c.tint).clickable { a.screen = BrowserActivity.Screen.IMPORT }.padding(horizontal = 14.dp),
                    contentAlignment = Alignment.Center) { Text(stringResource(R.string.brImportBtn), color = if (c.dark) Color.Black else Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
            }
        }
        item {
            Group {
                IRow(stringResource(R.string.brSetEngine), lead = { Tile(BrIcons.Search, Color(0xFF007AFF)) }, value = eng) { a.screen = BrowserActivity.Screen.ENGINE }
                Sep()
                IRow(stringResource(R.string.brPwTitle), lead = { Tile(BrIcons.Key, Color(0xFF1A73E8)) }, value = pwValue(a)) { a.screen = BrowserActivity.Screen.PASSWORDS }
                Sep()
                IRow(stringResource(R.string.brSetDefault), lead = { Tile(BrIcons.Globe, Green) }, value = if (a.isDefault) stringResource(R.string.brYes) else null,
                    trailing = if (a.isDefault) null else ({ Text(stringResource(R.string.brSetDefaultAsk), color = c.tint, fontSize = 17.sp) }), chevron = false) {
                    if (!a.isDefault) a.makeDefault()
                }
            }
        }
        item {
            Group {
                IRow(stringResource(R.string.brPrivacy), lead = { Tile(BrIcons.Shield, Color(0xFF5856D6)) }) { a.screen = BrowserActivity.Screen.PRIVACY }
                Sep()
                IRow(stringResource(R.string.brSyncTitle), lead = { Tile(BrIcons.Refresh, Color(0xFF34C759)) }, value = syncValue(a)) { a.screen = BrowserActivity.Screen.CHROME }
                Sep()
                IRow(stringResource(R.string.brImportTitle), lead = { Tile(BrIcons.StarOn, Color(0xFF007AFF)) }) { a.screen = BrowserActivity.Screen.IMPORT }
                Sep()
                IRow(stringResource(R.string.brDownloads), lead = { Tile(BrIcons.Dl, Color(0xFFFF9500)) }, value = "Studio DM") { a.dlSettings() }
            }
        }
        item {
            Group {
                IRow(stringResource(R.string.brSetBubble), lead = { Tile(BrIcons.Dl, Red) }, chevron = false, trailing = { IosSwitch(a.bubble) { a.pickBubble(it) } })
                Sep()
                IRow(stringResource(R.string.brSetBar), lead = { Tile(BrIcons.Bar, Color(0xFF8E8E93)) },
                    value = stringResource(if (a.barBottom) R.string.brBarBottom else R.string.brBarTop)) { a.screen = BrowserActivity.Screen.BARPOS }
                Sep()
                IRow(stringResource(R.string.brSetHome), lead = { Tile(BrIcons.Home, Color(0xFF8E8E93)) }, chevron = false, trailing = { IosSwitch(a.homeBtn) { a.pickHomeBtn(it) } })
            }
        }
        item { Group { IRow(stringResource(R.string.brAboutApp), lead = { Tile(BrIcons.Info, Color(0xFF8E8E93)) }, value = a.version(), chevron = false) } }
    }
}

@Composable
private fun pwValue(a: BrowserActivity): String = when (val b = a.fillBy) {
    null -> stringResource(R.string.brPwNoSupport)
    "" -> stringResource(R.string.brPwOff)
    else -> if (a.fillGoogle) "Google" else b
}

@Composable
private fun EngineScreen(a: BrowserActivity) {
    val c = LocalBr.current
    SubPage(stringResource(R.string.brSetEngine), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item {
            Group {
                listOf("google" to "Google", "ddg" to "DuckDuckGo", "bing" to "Bing").forEachIndexed { i, (k, l) ->
                    if (i > 0) Sep(16.dp)
                    IRow(l, chevron = false, trailing = { if (a.engine == k) Icon(BrIcons.Check, null, Modifier.size(22.dp), tint = c.tint) }) { a.pickEngine(k) }
                }
            }
        }
    }
}

@Composable
private fun BarPosScreen(a: BrowserActivity) {
    val c = LocalBr.current
    SubPage(stringResource(R.string.brSetBar), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item {
            Group(footer = stringResource(R.string.brBarFoot)) {
                IRow(stringResource(R.string.brBarTop), chevron = false, trailing = { if (!a.barBottom) Icon(BrIcons.Check, null, Modifier.size(22.dp), tint = c.tint) }) { a.pickBarBottom(false) }
                Sep(16.dp)
                IRow(stringResource(R.string.brBarBottom), chevron = false, trailing = { if (a.barBottom) Icon(BrIcons.Check, null, Modifier.size(22.dp), tint = c.tint) }) { a.pickBarBottom(true) }
            }
        }
    }
}

@Composable
private fun PrivacyScreen(a: BrowserActivity) {
    val eng = when (a.engine) { "ddg" -> "DuckDuckGo"; "bing" -> "Bing"; else -> "Google" }
    SubPage(stringResource(R.string.brPrivacy), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item { Group { IRow(stringResource(R.string.brClearData), lead = { Tile(BrIcons.Trash, Color(0xFFFF3B30)) }) { a.clearAsk = true } } }
        item {
            Group(footer = stringResource(R.string.brSuggestSub, eng)) {
                IRow(stringResource(R.string.brSuggest), lead = { Tile(BrIcons.Search, Color(0xFF007AFF)) }, chevron = false, trailing = { IosSwitch(a.suggestOn) { a.pickSuggest(it) } })
            }
        }
    }
}

/** מנהל הסיסמאות — כמו ב־Chrome, והכל ב־Google Password Manager: הוא ממלא לפי האתר כאן, ב־Chrome ובכל אפליקציה בטלפון */
@Composable
private fun PasswordsScreen(a: BrowserActivity) {
    val c = LocalBr.current
    SubPage(stringResource(R.string.brPwTitle), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.card).padding(18.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(64.dp).shadow(8.dp, RoundedCornerShape(18.dp)).clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF4C8DF6), Color(0xFF1A73E8)))), contentAlignment = Alignment.Center) {
                    Icon(BrIcons.Key, null, Modifier.size(34.dp), tint = Color.White)
                }
                Spacer(Modifier.height(12.dp))
                Text("Google Password Manager", color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(stringResource(R.string.brPwHero), color = c.mute, fontSize = 15.sp, textAlign = TextAlign.Center, lineHeight = 21.sp)
                Spacer(Modifier.height(14.dp))
                val good = a.fillGoogle
                val (txt, col) = when {
                    good -> stringResource(R.string.brPwOn) to Green
                    a.fillBy == null -> stringResource(R.string.brPwNoSupport) to c.mute
                    a.fillBy == "" -> stringResource(R.string.brPwNone) to Color(0xFFFF9500)
                    else -> stringResource(R.string.brPwOther, a.fillBy!!) to Color(0xFFFF9500)
                }
                Row(Modifier.clip(RoundedCornerShape(15.dp)).background(col.copy(alpha = 0.14f)).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (good) { Icon(BrIcons.Check, null, Modifier.size(16.dp), tint = col); Spacer(Modifier.width(6.dp)) }
                    Text(txt, color = if (good) Color(0xFF248A3D) else col, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(18.dp))
                if (!good && a.fillBy != null) {
                    BigBtn(stringResource(R.string.brPwSet), true) { a.fillSettings() }
                    Spacer(Modifier.height(10.dp))
                }
                BigBtn(stringResource(R.string.brPwMine), good || a.fillBy == null) { a.openPasswords() }
            }
        }
        item {
            Group {
                IRow(stringResource(R.string.brPwCheck), stringResource(R.string.brPwCheckSub), lead = { Tile(BrIcons.Shield, Green) }) { a.openCheckup() }
            }
        }
        item {
            Group(stringResource(R.string.brPwOnPhone), stringResource(R.string.brPwFoot)) {
                IRow(stringResource(R.string.brPwService), lead = { Tile(BrIcons.Phone, Color(0xFF8E8E93)) }, value = pwValue(a)) { a.fillSettings() }
            }
        }
    }
}

@Composable
private fun BigBtn(label: String, primary: Boolean, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.fillMaxWidth().height(50.dp).clip(RoundedCornerShape(12.dp)).background(if (primary) c.tint else c.tint.copy(alpha = 0.12f)).clickable(onClick = on),
        contentAlignment = Alignment.Center) {
        Text(label, color = if (primary) (if (c.dark) Color.Black else Color.White) else c.tint, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

/* ======================= סנכרון עם Chrome (התוסף במחשב) ======================= */

@Composable
private fun syncValue(a: BrowserActivity): String {
    a.chromeRev
    return stringResource(when {
        !BrChrome.on -> R.string.brSyncOffShort
        BrChrome.err.isNotEmpty() -> R.string.brSyncErrShort
        BrChrome.stateAt == 0L -> R.string.brSyncWaitShort
        else -> R.string.brSyncOnShort
    })
}

/** לפי התצוגה המקדימה (claude.ai/artifact/MXE9EGTVzjchDQK8bHkhmb): לא מחובר = שני צעדים; מחובר = המצב, מה מסתנכרן, המחשב */
@Composable
private fun ChromeScreen(a: BrowserActivity) {
    val c = LocalBr.current
    a.chromeRev
    SubPage(stringResource(R.string.brSyncTitle), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        if (!BrChrome.on) {
            item {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.card).padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(64.dp).shadow(8.dp, RoundedCornerShape(18.dp)).clip(RoundedCornerShape(18.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF4C8DF6), Color(0xFF1A73E8)))), contentAlignment = Alignment.Center) {
                        Icon(BrIcons.Refresh, null, Modifier.size(34.dp), tint = Color.White)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(stringResource(R.string.brSyncHero), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.brSyncHeroSub), color = c.mute, fontSize = 15.sp, textAlign = TextAlign.Center, lineHeight = 21.sp)
                }
            }
            item {
                Group(footer = stringResource(R.string.brSyncFootOff)) {
                    Step(1, stringResource(R.string.brSyncStep1), stringResource(R.string.brSyncStep1Sub), stringResource(R.string.brSyncStep1Btn), false) { a.chromeShareExt() }
                    Sep()
                    Step(2, stringResource(R.string.brSyncStep2), stringResource(R.string.brSyncStep2Sub), stringResource(R.string.brSyncStep2Btn), true) { a.chromeConnect() }
                }
            }
            return@SubPage
        }
        item {
            val err = BrChrome.err
            val wait = BrChrome.stateAt == 0L
            val (title, sub) = when {
                err.isNotEmpty() -> stringResource(R.string.brSyncErr) to stringResource(if (err.contains("auth")) R.string.brSyncErrAuth else R.string.brSyncErrNet)
                wait -> stringResource(R.string.brSyncWait) to stringResource(R.string.brSyncWaitSub)
                else -> stringResource(R.string.brSyncOk) to stringResource(R.string.brSyncOkSub, DateUtils.getRelativeTimeSpanString(BrChrome.stateAt).toString())
            }
            val col = if (err.isEmpty() && !wait) Green else Color(0xFFFF9500)
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.card).padding(horizontal = 18.dp, vertical = 20.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(CircleShape).background(col.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                    Icon(if (err.isEmpty() && !wait) BrIcons.Check else BrIcons.Warn, null, Modifier.size(26.dp), tint = col)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(sub, color = c.mute, fontSize = 14.sp, lineHeight = 19.sp)
                }
            }
        }
        item {
            Group(stringResource(R.string.brSyncWhat), stringResource(R.string.brSyncWhatFoot)) {
                IRow(stringResource(R.string.brSyncMarks), lead = { Tile(BrIcons.StarOn, Color(0xFFFF9500)) }, chevron = false,
                    trailing = { IosSwitch(BrChrome.marksOn) { BrChrome.marksOn = it; a.chromeRev++ } })
                Sep()
                IRow(stringResource(R.string.brSyncHist), lead = { Tile(BrIcons.History, Color(0xFF5856D6)) }, chevron = false,
                    trailing = { IosSwitch(BrChrome.histOn) { BrChrome.histOn = it; a.chromeRev++ } })
            }
        }
        item {
            Group(stringResource(R.string.brSyncPc)) {
                IRow(stringResource(R.string.brSyncPcRow), if (BrChrome.stateAt > 0) stringResource(R.string.brSyncPcSeen, DateUtils.getRelativeTimeSpanString(BrChrome.stateAt).toString()) else stringResource(R.string.brSyncPcNone),
                    lead = { Tile(BrIcons.Desktop, Color(0xFF8E8E93)) }, chevron = false)
                Sep(16.dp)
                IRow(stringResource(R.string.brSyncNow), color = c.tint, chevron = false) { a.chromeNow() }
                Sep(16.dp)
                IRow(stringResource(R.string.brSyncShareAgain), color = c.tint, chevron = false) { a.chromeShareExt() }
            }
        }
        item {
            Group(footer = stringResource(R.string.brSyncStopFoot)) {
                IRow(stringResource(R.string.brSyncStop), color = Color(0xFFFF3B30), chevron = false) { a.chromeOff() }
            }
        }
    }
}

/** ייבוא מ־Chrome (Google Takeout / קובץ סימניות) וייצוא חזרה ל־Chrome בקובץ — Chrome Sync סגור לאפליקציות אחרות */
@Composable
private fun ImportScreen(a: BrowserActivity) {
    val c = LocalBr.current
    SubPage(stringResource(R.string.brImportTitle), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item { Text(stringResource(R.string.brImportLead), Modifier.padding(start = 16.dp, end = 16.dp, bottom = 18.dp), color = c.mute, fontSize = 15.sp, lineHeight = 21.sp) }
        item {
            Group {
                Step(1, stringResource(R.string.brStep1), stringResource(R.string.brStep1Sub), stringResource(R.string.brStep1Btn), true) { a.openTakeout() }
                Sep()
                Step(2, stringResource(R.string.brStep2), stringResource(R.string.brStep2Sub), stringResource(R.string.brStep2Btn), false) { a.pickImport() }
            }
        }
        val li = a.lastImport.split(',')
        if (li.size >= 3) item {
            val at = li[2].toLongOrNull() ?: 0L
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card).padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(Green), contentAlignment = Alignment.Center) { Icon(BrIcons.Check, null, Modifier.size(18.dp), tint = Color.White) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.brImportedN, li[0].toIntOrNull() ?: 0, li[1].toIntOrNull() ?: 0), color = c.fg, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.brLastImport, DateUtils.getRelativeTimeSpanString(at).toString()) +
                        (li.getOrNull(3)?.toIntOrNull()?.takeIf { it > 0 }?.let { " · " + stringResource(R.string.brSkippedN, it) } ?: ""), color = c.mute, fontSize = 13.sp)
                }
            }
        }
        item {
            Group(stringResource(R.string.brToChrome), stringResource(R.string.brExportFoot)) {
                IRow(stringResource(R.string.brExport), stringResource(R.string.brExportSub), lead = { Tile(BrIcons.Share, Color(0xFF007AFF)) }) { a.exportMarks() }
                if (a.markRev >= 0 && BrStore.anyExported()) {
                    Sep()
                    IRow(stringResource(R.string.brExportAll), stringResource(R.string.brExportAllSub), lead = { Tile(BrIcons.Append, Color(0xFF8E8E93)) }) { a.exportMarks(all = true) }
                }
            }
        }
        item {
            Group(stringResource(R.string.brNoImportNeeded)) {
                IRow(stringResource(R.string.brSetPw), stringResource(R.string.brPwAlready), lead = { Tile(BrIcons.Key, Color(0xFF1A73E8)) }) { a.screen = BrowserActivity.Screen.PASSWORDS }
            }
        }
    }
}

@Composable
private fun Step(n: Int, title: String, sub: String, btn: String, primary: Boolean, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().padding(16.dp)) {
        Box(Modifier.size(30.dp).clip(CircleShape).background(c.tint), contentAlignment = Alignment.Center) {
            Text("$n", color = if (c.dark) Color.Black else Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = c.fg, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, color = c.mute, fontSize = 14.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 3.dp))
            Spacer(Modifier.height(12.dp))
            Box(Modifier.height(34.dp).clip(RoundedCornerShape(17.dp)).background(if (primary) c.tint else c.tint.copy(alpha = 0.12f)).clickable(onClick = on).padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center) {
                Text(btn, color = if (primary) (if (c.dark) Color.Black else Color.White) else c.tint, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
