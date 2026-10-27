package io.github.yishaiguedj1.snowball.br

import android.graphics.Bitmap
import android.graphics.Color as AColor
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.format.DateUtils
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.positionOnScreen
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.withContext

/*
 * 27/10/2026 (בקשת המשתמש: "שיראה אחד לאחד כמו Chrome באנדרואיד", ואחר כך: "הצבעים והמראה כמו הממשק שלנו ושל Apple —
 * המבנה, המיקום והצורה של כל דבר נשארים זהים ל־Chrome"; התצוגה המקדימה שאושרה: claude.ai/artifact/RoCSRDZTkrSpthtkm7L7gk).
 * המבנה — Chrome 159 לאנדרואיד (נמדד מהקוד של Chromium): סרגל עליון של 56dp (דף הבית · גלולת הכתובת 40dp ברדיוס 24 ·
 * כרטיסייה חדשה 52dp · כרטיסיות · ⋮), תפריט ⋮ שנפתח מהפינה עם שורת חמישה כפתורים עגולים ואחריה הפריטים בסדר של Chrome,
 * מסך כרטיסיות עם "+" · מעבר רגיל/פרטי · ⋮ ושתי עמודות, הגדרות בכרטיסים מקובצים. הגימור — Apple (iOS 27, Liquid Glass):
 * האדום של כפתור ההורדה (#FF4656) כצבע הפעולה, הניטרליים של iOS, רקע רך עם גוונים מאחורי הזכוכית, כרטיסי זכוכית עם קו אור
 * בשפה העליונה וקו כהה דק סביב, והתפריט ⋮ חלון שמצייר את הדף שמאחוריו מטושטש (PixelCopy + boxBlur).
 */
private val Red = Color(0xFFFF4656)
private val Green = Color(0xFF34C759)

/** הצבעים של מסך: page = הדף, bar = הסרגל, fill = גלולות ותיבות, card = כרטיס זכוכית, screen = הבסיס של הרקע הרך,
 *  fg/mute = טקסט ראשי ומשני, icon = סמלי הרשימות, line = קווים, tint = צבע הפעולה, dis = כבוי */
data class BrC(val page: Color, val bar: Color, val fill: Color, val card: Color, val screen: Color, val fg: Color,
               val mute: Color, val line: Color, val tint: Color, val dis: Color, val dark: Boolean, val icon: Color)

private val Light = BrC(Color.White, Color(0xF5FFFFFF), Color(0x1F767680), Color(0xA6FFFFFF), Color(0xFFF2F1F6), Color.Black,
    Color(0x993C3C43), Color(0x4A3C3C43), Red, Color(0x4D3C3C43), false, Color(0xFF3C3C43))
private val Dark = BrC(Color.Black, Color(0xF51C1C1E), Color(0x3D767680), Color(0x8C2C2C2E), Color(0xFF0E0E11), Color.White,
    Color(0x99EBEBF5), Color(0x5C545458), Color(0xFFFF5A6A), Color(0x4DEBEBF5), true, Color(0xFFD1D1D6))
/** כרטיסייה פרטית — תמיד כהה, כמו ב־Chrome */
private val Priv = BrC(Color(0xFF131314), Color(0xFF161618), Color(0x3D767680), Color(0x8C2C2C2E), Color(0xFF0B0B0D), Color.White,
    Color(0x99EBEBF5), Color(0x5C545458), Color(0xFFFF5A6A), Color(0x4DEBEBF5), true, Color(0xFFD1D1D6))
private val LocalBr = staticCompositionLocalOf { Light }

@Composable
private fun BrTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val b = if (dark) Dark else Light
    val cs = if (dark) darkColorScheme(primary = b.tint, onPrimary = Color.White, surface = Color(0xFF1C1C1E), background = b.screen, surfaceContainerHigh = Color(0xFF2C2C2E))
    else lightColorScheme(primary = b.tint, onPrimary = Color.White, surface = Color.White, background = b.screen, surfaceContainerHigh = Color(0xFFF7F7FA))
    CompositionLocalProvider(LocalBr provides b) { MaterialTheme(colorScheme = cs, content = content) }
}

@Composable
fun BrApp(a: BrowserActivity) {
    BrTheme {
        val c = when {
            a.screen == BrowserActivity.Screen.SWITCHER && a.swPrivate -> Priv
            a.cur?.private == true && a.screen == BrowserActivity.Screen.PAGE -> Priv
            else -> LocalBr.current
        }
        // טאב פרטי על המסך — בלי צילומי מסך ובלי תמונה במסך האפליקציות האחרונות
        LaunchedEffect(a.screen, a.cur?.private, a.swPrivate, a.privLocked) { a.applySecure() }
        CompositionLocalProvider(LocalBr provides c) {
            Box(Modifier.fillMaxSize().background(if (a.screen == BrowserActivity.Screen.PAGE) c.page else c.screen)) {
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
                    BrowserActivity.Screen.SITES -> SitesScreen(a)
                    BrowserActivity.Screen.SITE -> SiteScreen(a)
                    BrowserActivity.Screen.VIDEO -> VideoScreen(a)
                    BrowserActivity.Screen.CLOUD -> CloudScreen(a)
                    BrowserActivity.Screen.RECENT -> RecentScreen(a)
                }
                if (a.privLocked && a.showsPrivate()) LockScreen(a)
                a.customView?.let { v ->
                    AndroidView({ ctx -> FrameLayout(ctx).apply { setBackgroundColor(AColor.BLACK) } }, Modifier.fillMaxSize(),
                        update = { f -> if (v.parent !== f) { (v.parent as? ViewGroup)?.removeView(v); f.removeAllViews(); f.addView(v, FrameLayout.LayoutParams(-1, -1)) } },
                        onRelease = { it.removeAllViews() })
                }
                a.permAsk?.let { PermDialog(it) }
                if (a.clearAsk) ClearDialog(a)
            }
        }
    }
}

/* ======================= אבני בניין: הרקע הרך, הזכוכית, הרשימות ======================= */

/** הרקע הרך של iOS 27 מאחורי הזכוכית: בסיס בהיר (או כהה) ושלוש הילות — האדום שלנו בפינה העליונה, כחלחל בצד, חם למטה */
private fun Modifier.ambient(c: BrC): Modifier = drawBehind {
    val w = size.width; val h = size.height
    drawRect(Brush.verticalGradient(if (c.dark) listOf(Color(0xFF111114), c.screen) else listOf(Color(0xFFF7F6FA), Color(0xFFEEEDF3))))
    val k = if (c.dark) 1.25f else 1f
    fun glow(x: Float, y: Float, r: Float, col: Color) = drawRect(Brush.radialGradient(listOf(col, col.copy(alpha = 0f)), Offset(x, y), r))
    glow(w * 0.88f, 0f, w * 1.05f, Red.copy(alpha = 0.15f * k))
    glow(0f, h * 0.38f, w * 0.95f, Color(0xFF788CFF).copy(alpha = 0.13f * k))
    glow(w * 0.7f, h, w * 1.0f, Color(0xFFFFAA5A).copy(alpha = 0.11f * k))
}

/** זכוכית (Liquid Glass של iOS 27): מילוי שקוף למחצה, קו כהה דק סביב, וקו אור בשפה העליונה */
private fun Modifier.glass(c: BrC, shape: Shape, fill: Color = c.card): Modifier = this
    .clip(shape).background(fill)
    .border(0.5.dp, if (c.dark) Color.Black.copy(alpha = 0.45f) else Color.Black.copy(alpha = 0.09f), shape)
    .padding(0.5.dp)
    .border(0.5.dp, Brush.verticalGradient(if (c.dark) listOf(Color.White.copy(alpha = 0.26f), Color.White.copy(alpha = 0.05f))
        else listOf(Color.White, Color.White.copy(alpha = 0.4f))), shape)

/** זכוכית אדומה — כפתור ההורדה, "+" במסך הכרטיסיות */
private fun Modifier.redGlass(shape: Shape): Modifier = this
    .clip(shape).background(Red.copy(alpha = 0.9f))
    .border(0.5.dp, Color(0x59780010), shape).padding(0.5.dp)
    .border(0.5.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.75f), Color.White.copy(alpha = 0.15f))), shape)

private val FavPal = listOf(0xFF1A73E8, 0xFFEA4335, 0xFF34A853, 0xFFF29900, 0xFF9334E6, 0xFFE8710A, 0xFF129EAF, 0xFFD01884)

/** הסמל של אתר: הסמל שלו אם הדף פתוח בטאב, אחרת האות הראשונה על צבע שנגזר מהשם (קבוע לכל אתר) */
@Composable
private fun Fav(a: BrowserActivity, url: String, size: Dp, radius: Dp = size / 4, icon: Bitmap? = null) {
    val host = BrStore.hostOf(url)
    val ic = icon ?: remember(host, a.tabs.size) { a.tabs.firstOrNull { it.icon != null && BrStore.hostOf(it.url) == host }?.icon ?: BrPics.icon(host) }
    if (ic != null) { Image(ic.asImageBitmap(), null, Modifier.size(size).clip(RoundedCornerShape(radius))); return }
    val name = if (host.isEmpty()) "?" else BrStore.siteName(host)
    val col = Color(FavPal[(host.hashCode() and 0x7fffffff) % FavPal.size])
    Box(Modifier.size(size).clip(RoundedCornerShape(radius)).background(col), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = Color.White, fontSize = (size.value * 0.48f).sp, fontWeight = FontWeight.Bold)
    }
}

/** סמל בתחילת שורה — כמו ב־Chrome: 24dp בצבע הסמלים (האדום רק למה ששייך ל־Studio) */
@Composable
private fun Tile(icon: ImageVector, color: Color) {
    val c = LocalBr.current
    Icon(icon, null, Modifier.size(24.dp), tint = if (color == Red) Red else c.icon)
}

/** מתג — הצורה של Chrome (Material 3: מסילה 52×32, עיגול שגדל כשפועל), ירוק של Apple כשפועל */
@Composable
private fun IosSwitch(on: Boolean, onChange: (Boolean) -> Unit) {
    val c = LocalBr.current
    val p by animateFloatAsState(if (on) 1f else 0f, label = "sw")
    Box(Modifier.size(52.dp, 32.dp).clip(RoundedCornerShape(16.dp)).background(if (on) Green else Color.Transparent)
        .border(2.dp, if (on) Green else c.mute, RoundedCornerShape(16.dp)).clickable { onChange(!on) }.padding(horizontal = 4.dp)) {
        val d = (16 + 8 * p).dp
        Box(Modifier.align(BiasAlignment(-1f + 2f * p, 0f)).padding(horizontal = ((1 - p) * 4).dp).size(d).clip(CircleShape)
            .background(if (on) Color.White else c.mute))
    }
}

/** קבוצה של Chrome (כרטיסים מקובצים): כותרת קטנה, כרטיס זכוכית ברדיוס 16, הערה מתחת */
@Composable
private fun Group(header: String? = null, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        if (header != null) Text(header, Modifier.padding(start = 32.dp, end = 32.dp, top = 8.dp, bottom = 12.dp), color = c.mute, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().glass(c, RoundedCornerShape(16.dp)), content = content)
        if (footer != null) Text(footer, Modifier.padding(start = 32.dp, end = 32.dp, top = 8.dp), color = c.mute, fontSize = 14.sp, lineHeight = 20.sp)
    }
}

/** בין שורות בקבוצה — הרווח הדק של Chrome (2dp) */
@Composable
@Suppress("UNUSED_PARAMETER")
private fun Sep(inset: Dp = 0.dp) { HorizontalDivider(thickness = 2.dp, color = LocalBr.current.screen.copy(alpha = 0.85f)) }

/** שורה של Chrome: סמל 24dp בהתחלה, כותרת 16sp ותקציר 14sp מתחת (הערך — בתקציר), ומשהו בסוף (מתג, ✓) */
@Composable
@Suppress("UNUSED_PARAMETER")
private fun IRow(title: String, sub: String? = null, lead: (@Composable () -> Unit)? = null, value: String? = null, color: Color? = null,
                 chevron: Boolean = true, ltrSub: Boolean = false, trailing: (@Composable () -> Unit)? = null, onClick: (() -> Unit)? = null) {
    val c = LocalBr.current
    val line2 = sub?.takeIf { it.isNotEmpty() } ?: value
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp)
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(horizontal = 16.dp, vertical = if (line2 != null) 12.dp else 14.dp),
        verticalAlignment = Alignment.CenterVertically) {
        if (lead != null) { lead(); Spacer(Modifier.width(16.dp)) }
        Column(Modifier.weight(1f)) {
            Text(title, color = color ?: c.fg, fontSize = 16.sp, lineHeight = 24.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (line2 != null) Text(line2, Modifier.padding(top = 2.dp), color = c.mute, fontSize = 14.sp, lineHeight = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                style = TextStyle(textDirection = if (ltrSub && sub != null) TextDirection.Ltr else TextDirection.Content))
        }
        if (trailing != null) { Spacer(Modifier.width(12.dp)); trailing() }
    }
}

/** כפתור עגול עם סמל (בסרגלים) — 48dp כמו ב־Chrome, ההדגשה בלחיצה עיגול של 40dp */
@Composable
private fun IBtn(icon: ImageVector, desc: String, size: Dp = 48.dp, iconSize: Dp = 24.dp, enabled: Boolean = true, tint: Color? = null, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(size).clip(CircleShape).clickable(enabled = enabled, onClick = on), contentAlignment = Alignment.Center) {
        Icon(icon, desc, Modifier.size(iconSize), tint = if (enabled) (tint ?: c.fg) else c.dis)
    }
}

@Composable
private fun CloseCircle(on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(32.dp).glass(c, CircleShape, c.fill).clickable(onClick = on), contentAlignment = Alignment.Center) {
        Icon(BrIcons.CClose, stringResource(R.string.brClose), Modifier.size(16.dp), tint = c.mute)
    }
}

/** עמוד של Chrome: סרגל 56dp — חץ חזרה וכותרת 22sp (ופעולות בסוף), על הרקע הרך; ותחתית קבועה אם יש */
@Composable
private fun SubPage(title: String, back: String? = null, onBack: () -> Unit = {}, done: Boolean = false, onDone: () -> Unit = {},
                    bottom: (@Composable () -> Unit)? = null, actions: (@Composable RowScope.() -> Unit)? = null, body: LazyListScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxSize().ambient(c).statusBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(start = 4.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IBtn(BrIcons.CBack, back ?: stringResource(R.string.brDone), tint = c.tint) { if (back != null) onBack() else if (done) onDone() else onBack() }
            Spacer(Modifier.width(12.dp))
            Text(title, Modifier.weight(1f), color = c.fg, fontSize = 22.sp, lineHeight = 28.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            actions?.invoke(this)
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            body()
            item { Spacer(Modifier.height(24.dp)) }
        }
        if (bottom != null) bottom() else Spacer(Modifier.navigationBarsPadding())
    }
}

/** תיבת חיפוש של Chrome (בהגדרות, בהיסטוריה, בסימניות): גלולה של 48dp מזכוכית */
@Composable
private fun SearchField(hint: String, q: String, setQ: (String) -> Unit) {
    val c = LocalBr.current
    Row(Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp).fillMaxWidth().height(48.dp)
        .glass(c, RoundedCornerShape(24.dp), if (c.dark) Color(0x8C2C2C2E) else Color(0xB8FFFFFF)).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(BrIcons.CSearch, null, Modifier.size(24.dp), tint = c.fg); Spacer(Modifier.width(12.dp))
        BasicTextField(q, setQ, Modifier.weight(1f), singleLine = true, textStyle = TextStyle(color = c.fg, fontSize = 16.sp, textDirection = TextDirection.Content),
            cursorBrush = SolidColor(c.tint), decorationBox = { inner -> Box { if (q.isEmpty()) Text(hint, color = c.mute, fontSize = 16.sp); inner() } })
        if (q.isNotEmpty()) Box(Modifier.size(28.dp).clip(CircleShape).clickable { setQ("") }, contentAlignment = Alignment.Center) {
            Icon(BrIcons.CClose, stringResource(R.string.brClear), Modifier.size(18.dp), tint = c.mute)
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
    // הסרגל למטה (הגדרה, כמו ב־Chrome) — חוזר למעלה בכרטיסייה חדשה, בהקלדה ובחיפוש בדף
    val bottom = a.barBottom && !ntp && !a.editing && !a.finding
    Column(Modifier.fillMaxSize().then(if (ntp || a.editing) Modifier.ambient(c) else Modifier.background(c.bar)).statusBarsPadding().imePadding()) {
        if (!bottom) { TopBar(a, q, { q = it }, ntp); if (!ntp && !a.editing) Line(t) }
        Box(Modifier.weight(1f).fillMaxWidth().background(if (ntp || a.editing) Color.Transparent else c.page)) {
            if (t == null || t.isNtp) Ntp(a) else {
                WebHost(a, t)
                // הכפתור שעל הנגן חי בתוך הדף (BrVideo); כאן — המצב שלו, והבדיקה ברקע כדי שהאיכויות יהיו מוכנות (DmPre)
                // ואז, כשהבדיקה מסתיימת — התפריט עם האיכויות עובר לדף (עד שתי דקות וחצי)
                // 26/10/2026: גם הכתובת (t.url, מצב של Compose) — ביוטיוב מעבר לסרטון הבא הוא בלי טעינת דף, ומספר הממצאים נשאר 1; בלי זה הסרטון
                // החדש לא נבדק מראש והפרטים חיכו לנגיעה
                LaunchedEffect(t.id, t.foundN, a.bubble, t.web, t.url) {
                    a.pushDl(t)
                    if (t.foundN > 0) {
                        delay(1500); a.prefetch(t); a.pushDl(t)
                        var last = a.menuJson(t)
                        repeat(150) {
                            delay(1000)
                            a.ytSeed(t)   // ביוטיוב: הנגן עלה — הרשימה מהדף, בלי לחכות ל־yt-dlp
                            val m = a.menuJson(t)
                            if (m != last) { last = m; a.pushDl(t) }
                            if (!m.startsWith("{\"w\"")) return@LaunchedEffect
                        }
                    }
                }
            }
            if (a.editing) Suggest(a, q) { q = it }
            a.incoming?.let { (from, st) -> if (!a.editing) IncomingBar(a, from, st, Modifier.align(Alignment.TopCenter)) }
        }
        if (bottom) { Line(t); TopBar(a, q, { q = it }, false) }
        Spacer(Modifier.navigationBarsPadding())
    }
    if (a.menu) MenuSheet(a)
    if (a.pick && t != null) PickSheet(a, t)
    if (a.info && t != null) InfoSheet(a, t)
    if (a.zoomSheet) ZoomSheet(a)
    if (a.speedSheet) SpeedSheet(a)
    if (a.sendSheet) SendSheet(a)
}

/** קו ההתקדמות של Chrome (2dp, בצבע הפעולה) על שפת הסרגל — או הקו הדק שמתחת לסרגל */
@Composable
private fun Line(t: BrTab?) {
    val c = LocalBr.current
    val p = t?.progress ?: 0
    if (p in 1..99 && t?.url?.startsWith("http") == true)
        LinearProgressIndicator(progress = { p / 100f }, modifier = Modifier.fillMaxWidth().height(2.dp), color = c.tint, trackColor = c.tint.copy(alpha = 0.18f),
            gapSize = 0.dp, drawStopIndicator = {})
    else HorizontalDivider(thickness = 0.5.dp, color = c.line)
}

/** הסרגל של Chrome לאנדרואיד: דף הבית · גלולת הכתובת · כרטיסייה חדשה · כרטיסיות · ⋮ (בעברית — מימין לשמאל) */
@Composable
private fun TopBar(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit, ntp: Boolean) {
    when {
        a.finding -> FindBar(a)
        a.editing -> Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) { EditField(a, q, setQ) }
        else -> Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
            if (a.homeBtn) IBtn(BrIcons.CHome, stringResource(R.string.brHome)) { a.goHome() } else Spacer(Modifier.width(16.dp))
            if (ntp) Spacer(Modifier.weight(1f)) else Omnibox(a)
            if (!ntp) Box(Modifier.width(52.dp), contentAlignment = Alignment.Center) {
                IBtn(BrIcons.CNewTab, stringResource(R.string.brNewTab)) { a.newTab("", private = a.cur?.private == true) }
            }
            TabsBtn(a)
            IBtn(BrIcons.More, stringResource(R.string.brMenu)) { a.menu = true }
            Spacer(Modifier.width(8.dp))
        }
    }
}

/** כפתור הכרטיסיות: ריבוע מעוגל של 18dp עם המספר (כמו ב־Chrome; מעל 99 — ":D"); לחיצה ארוכה — תפריט קצר */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TabsBtn(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    var tabMenu by remember { mutableStateOf(false) }
    val n = a.tabs.count { it.private == (t?.private == true) }
    Box {
        Box(Modifier.size(48.dp).clip(CircleShape).combinedClickable(onClick = { a.openSwitcher() }, onLongClick = { tabMenu = true }), contentAlignment = Alignment.Center) {
            Box(Modifier.size(18.dp).border(2.dp, c.fg, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
                Text(if (n > 99) (if (t?.private == true) ";)" else ":D") else "$n", color = c.fg, fontSize = if (n > 9) 9.sp else 11.sp, fontWeight = FontWeight.Bold,
                    lineHeight = 12.sp)
            }
        }
        DropdownMenu(tabMenu, { tabMenu = false }, shape = RoundedCornerShape(16.dp)) {
            DropdownMenuItem({ Text(stringResource(R.string.brNewTab)) }, { tabMenu = false; a.newTab("") }, leadingIcon = { Icon(BrIcons.CNewTab, null) })
            if (a.privOk) DropdownMenuItem({ Text(stringResource(R.string.brNewPrivate)) }, { tabMenu = false; a.newTab("", private = true) }, leadingIcon = { Icon(BrIcons.CIncognito, null) })
            if (t != null) DropdownMenuItem({ Text(stringResource(R.string.brCloseTab)) }, { tabMenu = false; a.close(t) }, leadingIcon = { Icon(BrIcons.CClose, null) })
        }
    }
}

/** הכתובת כמו ב־Chrome: בלי https:// ובלי www., הדומיין בצבע הראשי והשאר בצבע המשני, משמאל לימין */
private fun urlParts(url: String): Pair<String, String> {
    var u = url.removePrefix("https://").removePrefix("http://")
    if (u.startsWith("www.")) u = u.removePrefix("www.")
    val i = u.indexOfFirst { it == '/' || it == '?' || it == '#' }
    val host = if (i < 0) u else u.substring(0, i)
    var rest = if (i < 0) "" else u.substring(i)
    if (rest == "/") rest = ""
    return host to rest
}

/** גלולת הכתובת במנוחה (40dp, רדיוס 24): בדף מאובטח — בלי סמל (כמו ב־Chrome 159; פרטי האתר בתפריט ⋮), בדף לא מאובטח — "לא מאובטח".
 *  גרירה הצידה = הכרטיסייה הבאה, כמו ב־Chrome; ⬇ של Studio בסוף כשיש מה להוריד */
@Composable
private fun RowScope.Omnibox(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val web = t?.url?.startsWith("http") == true
    Row(
        Modifier.weight(1f).height(40.dp).glass(c, RoundedCornerShape(24.dp), c.fill)
            .pointerInput(t?.id) {
                var dx = 0f
                detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = {
                    if (kotlin.math.abs(dx) > 90f) a.swipeTab(if ((dx < 0) != rtl) 1 else -1)
                }) { ch, d -> ch.consume(); dx += d }
            }
            .clickable { a.editing = true }.padding(start = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (web && !t!!.url.startsWith("https://")) {
            Row(Modifier.clip(RoundedCornerShape(12.dp)).clickable { a.info = true }, verticalAlignment = Alignment.CenterVertically) {
                Icon(BrIcons.Warn, stringResource(R.string.brInfo), Modifier.size(20.dp), tint = c.mute)
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.brNotSecureShort2), color = c.fg, fontSize = 16.sp, maxLines = 1)
            }
            Box(Modifier.padding(horizontal = 8.dp).width(1.dp).height(24.dp).background(c.line))
        }
        if (web) {
            val (host, rest) = urlParts(t!!.url)
            Text(buildAnnotatedString { append(host); withStyle(SpanStyle(color = c.mute)) { append(rest) } }, Modifier.weight(1f), color = c.fg, fontSize = 16.sp,
                maxLines = 1, overflow = TextOverflow.Clip, textAlign = TextAlign.Left, style = TextStyle(textDirection = TextDirection.Ltr))
        } else Text(hint(a), Modifier.weight(1f), color = c.mute, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        // יש מה להוריד — ⬇ אדום של Studio בסוף הגלולה (אותה בחירה של הכפתור שעל הנגן)
        when {
            web && (t!!.foundN > 0) -> IBtn(BrIcons.Dl, stringResource(R.string.brVideos), size = 36.dp, iconSize = 20.dp, tint = Red) { a.bubbleTap() }
            else -> Spacer(Modifier.width(8.dp))
        }
    }
}

@Composable
private fun hint(a: BrowserActivity): String {
    val eng = when (a.engine) { "ddg" -> "DuckDuckGo"; "bing" -> "Bing"; else -> "Google" }
    return stringResource(R.string.brHintEngine, eng)
}

/** שורת הכתובת בהקלדה (כמו ב־Chrome): הגלולה מתרחבת עד 8dp מהשוליים, 48dp ברדיוס 16; G של Google (או זכוכית מגדלת) בהתחלה,
 *  ✕ לניקוי או 🎤 בסוף; "חזור" של המכשיר יוצא מההקלדה */
@Composable
private fun RowScope.EditField(a: BrowserActivity, q: TextFieldValue, setQ: (TextFieldValue) -> Unit) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    Row(Modifier.weight(1f).height(48.dp).glass(c, RoundedCornerShape(16.dp), if (c.dark) Color(0xD91C1C1E) else Color(0xE6FFFFFF)).padding(end = 0.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(48.dp), contentAlignment = Alignment.Center) {
            if (a.engine == "google") Image(BrIcons.GoogleG, null, Modifier.size(24.dp)) else Icon(BrIcons.CSearch, null, Modifier.size(24.dp), tint = c.mute)
        }
        BasicTextField(
            q, setQ, Modifier.weight(1f).focusRequester(fr), singleLine = true,
            textStyle = TextStyle(color = c.fg, fontSize = 16.sp, textDirection = TextDirection.Content),
            cursorBrush = SolidColor(c.tint),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onGo = { a.go(q.text) }),
            decorationBox = { inner -> Box { if (q.text.isEmpty()) Text(hint(a), color = c.mute, fontSize = 16.sp, maxLines = 1); inner() } }
        )
        if (q.text.isNotEmpty()) IBtn(BrIcons.CClose, stringResource(R.string.brClearInput)) { setQ(TextFieldValue("")) }
        else IBtn(BrIcons.CMic, stringResource(R.string.brVoiceSearch)) { a.voice() }
    }
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

/** חיפוש בדף — כמו ב־Chrome: במקום הסרגל, שדה · "3/12" · קו · ▲ ▼ · ✕ */
@Composable
private fun FindBar(a: BrowserActivity) {
    val c = LocalBr.current
    val fr = remember { FocusRequester() }
    var q by remember { mutableStateOf("") }
    Row(Modifier.fillMaxWidth().height(56.dp).background(c.bar), verticalAlignment = Alignment.CenterVertically) {
        BasicTextField(q, { q = it; a.find(it) }, Modifier.weight(1f).padding(horizontal = 16.dp).focusRequester(fr), singleLine = true,
            textStyle = TextStyle(color = c.fg, fontSize = 16.sp, textDirection = TextDirection.Content), cursorBrush = SolidColor(c.tint),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { a.findNext(true) }),
            decorationBox = { inner -> Box { if (q.isEmpty()) Text(stringResource(R.string.brFind), color = c.mute, fontSize = 16.sp); inner() } })
        if (q.isNotEmpty()) Text("${a.findRes.first}/${a.findRes.second}", Modifier.padding(end = 16.dp), color = if (a.findRes.second == 0) Color(0xFFFF3B30) else c.mute,
            fontSize = 16.sp, style = TextStyle(textDirection = TextDirection.Ltr))
        Box(Modifier.padding(vertical = 8.dp).width(1.dp).height(40.dp).background(c.line))
        IBtn(BrIcons.CExpLess, stringResource(R.string.brFindPrev)) { a.findNext(false) }
        IBtn(BrIcons.CExpMore, stringResource(R.string.brFindNext)) { a.findNext(true) }
        IBtn(BrIcons.CClose, stringResource(R.string.brClose)) { a.stopFind() }
    }
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

/* ======================= כרטיסייה חדשה — כמו ב־Chrome ======================= */

@Composable
private fun Ntp(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val priv = t?.private == true
    val sites = remember(a.markRev) { BrStore.topSites(8) }
    val recent = remember(a.markRev) { BrStore.history.asReversed().distinctBy { it.url }.filter { it.title.isNotEmpty() }.take(3) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        if (priv) {
            Spacer(Modifier.height(48.dp))
            Icon(BrIcons.CIncognito, null, Modifier.size(56.dp), tint = c.fg)
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.brPrivateTitle), color = c.fg, fontSize = 22.sp, lineHeight = 28.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.brPrivateHint), color = c.mute, fontSize = 14.sp, textAlign = TextAlign.Center, lineHeight = 20.sp)
            Spacer(Modifier.height(24.dp))
            NtpSearch(a)
            return@Column
        }
        Spacer(Modifier.height(16.dp))
        if (a.engine == "google") Image(BrIcons.GoogleLogo, "Google", Modifier.height(48.dp).width(158.dp))
        else Spacer(Modifier.height(24.dp))
        Spacer(Modifier.height(20.dp))
        NtpSearch(a)
        if (sites.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            // קיצורי הדרך: שורה אחת שגוללת הצידה, בכרטיס ברדיוס 24 (ב־Chrome — עד 8, ארבעה וחצי נראים)
            LazyRow(Modifier.fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(top = 16.dp, bottom = 18.dp),
                contentPadding = PaddingValues(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                items(sites, key = { it.url }) { s -> SiteTile(a, s) { a.go(s.url) } }
            }
        }
        ResumeCard(a)
        if (recent.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Column(Modifier.fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.brContinue), Modifier.weight(1f), color = c.fg, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    Text(stringResource(R.string.brAll), Modifier.clip(RoundedCornerShape(8.dp)).clickable { a.screen = BrowserActivity.Screen.HISTORY }.padding(4.dp), color = c.tint, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
                recent.forEach { v ->
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).clickable { a.go(v.url) }, verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, v.url, 20.dp, 10.dp) }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(v.title, color = c.fg, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(BrStore.hostOf(v.url) + " · " + DateUtils.getRelativeTimeSpanString(v.at).toString(), color = c.mute, fontSize = 14.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(30.dp))
    }
}

/** תיבת החיפוש של הכרטיסייה החדשה (כמו ב־Chrome: 56dp, גלולה מלאה; G · הרמז 18sp · 🎤) — מזכוכית */
@Composable
private fun NtpSearch(a: BrowserActivity) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(56.dp).glass(c, RoundedCornerShape(28.dp), if (c.dark) Color(0x992C2C2E) else Color(0xB8FFFFFF))
        .clickable { a.editing = true }.padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (a.engine == "google" && a.cur?.private != true) Image(BrIcons.GoogleG, null, Modifier.size(24.dp)) else Icon(BrIcons.CSearch, null, Modifier.size(24.dp), tint = c.fg)
        Spacer(Modifier.width(16.dp))
        Text(hint(a), Modifier.weight(1f), color = c.fg, fontSize = 18.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        IBtn(BrIcons.CMic, stringResource(R.string.brVoiceSearch)) { a.voice() }
    }
}

/** קיצור דרך: 80dp — עיגול של 48dp, סמל האתר 24dp, ושם בשתי שורות (12sp) */
@Composable
private fun SiteTile(a: BrowserActivity, s: BrMark, on: () -> Unit) {
    val c = LocalBr.current
    Column(Modifier.width(80.dp).clip(RoundedCornerShape(16.dp)).clickable(onClick = on).padding(vertical = 4.dp, horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(48.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) {
            Fav(a, s.url, 24.dp, 12.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text(s.title, color = c.mute, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

/* ======================= הצעות בשורת הכתובת — כרטיסים כמו ב־Chrome ======================= */

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
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 0.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (clip) item {
            SugCard { SugRow(BrIcons.Paste, stringResource(R.string.brPasteGo), stringResource(R.string.brClipLink), null) { a.pasteGo() } }
        }
        val searches = buildList { if (qq.isNotBlank()) add(qq); net.filter { !it.equals(qq, true) }.forEach { add(it) } }
        if (searches.isNotEmpty()) item {
            SugCard {
                searches.forEachIndexed { i, s ->
                    if (i > 0) SugSep()
                    if (i == 0 && s == qq) SugRow(if (isUrl) BrIcons.CGlobe else BrIcons.CSearch, qq, if (isUrl) null else stringResource(R.string.brSearchWith, eng), null) { a.go(qq) }
                    else SugRow(BrIcons.CSearch, s, null, { setQ(TextFieldValue("$s ", TextRange(s.length + 1))) }, bold = qq) { a.go(s) }
                }
            }
        }
        if (list.isNotEmpty()) item {
            SugCard {
                list.forEachIndexed { i, m ->
                    if (i > 0) SugSep()
                    SugRow(if (BrStore.isMarked(m.url)) BrIcons.CStarOn else BrIcons.CHistory, m.title.ifEmpty { m.url }, BrStore.hostOf(m.url).ifEmpty { m.url },
                        { setQ(TextFieldValue(m.url, TextRange(m.url.length))) }, ltrSub = true) { a.go(m.url) }
                }
            }
        }
    }
}

@Composable
private fun SugCard(content: @Composable ColumnScope.() -> Unit) {
    val c = LocalBr.current
    Column(Modifier.fillMaxWidth().glass(c, RoundedCornerShape(16.dp), if (c.dark) Color(0x991C1C1E) else Color(0xB8FFFFFF)), content = content)
}

@Composable
private fun SugSep() { HorizontalDivider(Modifier.padding(start = 56.dp), thickness = 0.5.dp, color = LocalBr.current.line) }

/** שורת הצעה של Chrome (56dp): סמל 24dp באזור של 56dp · הטקסט (מה שלא הוקלד — מודגש) · ↖ להעתקה לשדה בלי ללכת */
@Composable
private fun SugRow(icon: ImageVector, title: String, sub: String?, append: (() -> Unit)?, ltrSub: Boolean = false, bold: String? = null, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(onClick = on).padding(end = if (append == null) 12.dp else 0.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(56.dp), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(24.dp), tint = c.mute) }
        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
            val text = if (bold != null && bold.isNotEmpty() && title.startsWith(bold, ignoreCase = true)) buildAnnotatedString {
                append(title.substring(0, bold.length)); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(title.substring(bold.length)) }
            } else buildAnnotatedString { append(title) }
            Text(text, color = c.fg, fontSize = 16.sp, lineHeight = 24.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Content))
            if (!sub.isNullOrEmpty()) Text(sub, color = c.mute, fontSize = 14.sp, lineHeight = 20.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(textDirection = if (ltrSub) TextDirection.Ltr else TextDirection.Content))
        }
        if (append != null) IBtn(BrIcons.CRefine, stringResource(R.string.brEdit), tint = c.mute, on = append)
    }
}

/* ======================= התפריט ⋮ — כמו ב־Chrome לאנדרואיד, חלון זכוכית ======================= */

/** החלון של התפריט: בפינה של ⋮ (למעלה, ובעברית — משמאל), שקוף, בלי עמעום. הרקע מצויר בתוכו (backdrop) */
private fun glassWindow(w: android.view.Window?, rtl: Boolean, bottom: Boolean, topPx: Int, botPx: Int, dp: Float) {
    w ?: return
    w.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
    w.setDimAmount(0f)
    w.setFormat(PixelFormat.TRANSLUCENT)
    w.setLayout(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    w.setGravity((if (bottom) Gravity.BOTTOM else Gravity.TOP) or (if (rtl) Gravity.LEFT else Gravity.RIGHT))
    val p = w.attributes
    p.x = (4 * dp).toInt()
    p.y = if (bottom) botPx + (60 * dp).toInt() else topPx + (4 * dp).toInt()
    w.attributes = p
    w.setBackgroundDrawable(GradientDrawable().apply { cornerRadius = 24 * dp; setColor(AColor.TRANSPARENT) })
}

/** הדף שמאחורי התפריט, מטושטש — כמו החומר של Apple: מה שמאחור נראה רק כצבע ואור, אף פעם לא כטקסט.
 *  PixelCopy של חלון הדפדפן בשמינית מהגודל + טשטוש תיבה בשלושה מעברים. עד 27/10/2026 — הטשטוש בין חלונות של המערכת
 *, שבטלפון לא נדלק והדף נקרא דרך התפריט */
private const val BACK_SCALE = 8
private fun backdrop(w: android.view.Window, done: (Bitmap) -> Unit) {
    val v = w.decorView
    if (v.width < BACK_SCALE || v.height < BACK_SCALE) return
    val bmp = Bitmap.createBitmap(v.width / BACK_SCALE, v.height / BACK_SCALE, Bitmap.Config.ARGB_8888)
    runCatching {
        android.view.PixelCopy.request(w, bmp, { r -> if (r == android.view.PixelCopy.SUCCESS) { boxBlur(bmp, 4); done(bmp) } },
            android.os.Handler(android.os.Looper.getMainLooper()))
    }
}

/** טשטוש תיבה נפרד (אופקי ואז אנכי), שלוש פעמים ≈ גאוסיאני */
private fun boxBlur(b: Bitmap, r: Int) {
    val w = b.width; val h = b.height
    val px = IntArray(w * h); b.getPixels(px, 0, w, 0, 0, w, h)
    val tmp = IntArray(w * h)
    fun pass(src: IntArray, dst: IntArray, n: Int, lines: Int, step: Int, line: Int) {
        val d = 2 * r + 1
        for (l in 0 until lines) {
            val base = l * line
            var a = 0; var rr = 0; var g = 0; var bb = 0
            for (i in -r..r) { val c = src[base + i.coerceIn(0, n - 1) * step]
                a += c ushr 24; rr += (c shr 16) and 255; g += (c shr 8) and 255; bb += c and 255 }
            for (i in 0 until n) {
                dst[base + i * step] = ((a / d) shl 24) or ((rr / d) shl 16) or ((g / d) shl 8) or (bb / d)
                val o = src[base + (i - r).coerceIn(0, n - 1) * step]
                val ni = src[base + (i + r + 1).coerceIn(0, n - 1) * step]
                a += (ni ushr 24) - (o ushr 24); rr += ((ni shr 16) and 255) - ((o shr 16) and 255)
                g += ((ni shr 8) and 255) - ((o shr 8) and 255); bb += (ni and 255) - (o and 255)
            }
        }
    }
    repeat(3) { pass(px, tmp, w, h, 1, w); pass(tmp, px, h, w, w, 1) }
    b.setPixels(px, 0, w, 0, 0, w, h)
}

@Composable
private fun MenuSheet(a: BrowserActivity) {
    val c = LocalBr.current
    val t = a.cur
    val web = t?.url?.startsWith("http") == true
    val ntp = t == null || t.isNtp
    @Suppress("UNUSED_VARIABLE") val rev = a.markRev
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val dens = LocalDensity.current
    val topPx = WindowInsets.statusBars.getTop(dens)
    val botPx = WindowInsets.navigationBars.getBottom(dens)
    val maxH = LocalConfiguration.current.screenHeightDp.dp - with(dens) { topPx.toDp() } - 24.dp
    fun close() { a.menu = false }
    Dialog(onDismissRequest = { close() }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val view = LocalView.current
        val bottom = a.barBottom && !ntp
        remember { glassWindow((view.parent as? DialogWindowProvider)?.window, rtl, bottom, topPx, botPx, dens.density) }
        LaunchedEffect(Unit) { glassWindow((view.parent as? DialogWindowProvider)?.window, rtl, bottom, topPx, botPx, dens.density) }
        var back by remember { mutableStateOf<androidx.compose.ui.graphics.ImageBitmap?>(null) }
        LaunchedEffect(Unit) { backdrop(a.window) { back = it.asImageBitmap() } }
        var at by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
        // הכניסה של Chrome: גדל ונחשף מהפינה של ⋮ ב־250ms בעקומה "emphasized"
        val k = remember { Animatable(0f) }
        LaunchedEffect(Unit) { k.animateTo(1f, tween(250, easing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f))) }
        val shape = RoundedCornerShape(24.dp)
        Column(Modifier
            .onGloballyPositioned { at = it.positionOnScreen() }
            .graphicsLayer { scaleX = 0.6f + 0.4f * k.value; scaleY = 0.6f + 0.4f * k.value; alpha = k.value
                transformOrigin = TransformOrigin(if (rtl) 0.05f else 0.95f, if (bottom) 0.95f else 0.05f) }
            .width(IntrinsicSize.Max).widthIn(min = 220.dp, max = 330.dp).heightIn(max = maxH)
            .clip(shape)
            .drawBehind {
                // החומר: הדף מאחור מטושטש במקום המדויק שמתחת לתפריט, ומעליו שכבה כמעט אטומה (בלי תמונה — אטומה לגמרי)
                val b = back
                if (b != null) drawImage(b, dstOffset = androidx.compose.ui.unit.IntOffset(-at.x.toInt(), -at.y.toInt()),
                    dstSize = androidx.compose.ui.unit.IntSize(b.width * BACK_SCALE, b.height * BACK_SCALE))
                drawRect(if (c.dark) Color(0xFF1C1C1E).copy(alpha = if (b != null) 0.78f else 0.97f)
                         else Color(0xFFF9F9FB).copy(alpha = if (b != null) 0.74f else 0.97f))
            }
            .border(0.5.dp, Brush.verticalGradient(if (c.dark) listOf(Color.White.copy(alpha = 0.3f), Color.White.copy(alpha = 0.06f)) else listOf(Color.White, Color.White.copy(alpha = 0.5f))), shape)
            .verticalScroll(rememberScrollState()).padding(bottom = 10.dp)) {
            // שורת הכפתורים: חזרה · קדימה · סימנייה · הורדה · רענון (כמו ב־Chrome 159)
            Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val loading = (t?.progress ?: 0) in 1..99 && web
                val marked = web && BrStore.isMarked(t!!.url)
                MBtn(BrIcons.CArrowBack, stringResource(R.string.brBack), a.canGoBackHere(t)) { a.goBack() }
                MBtn(BrIcons.CArrowFwd, stringResource(R.string.brForward), t?.canFwd == true || (t?.isNtp == true && t.ntpFwd != null)) { a.forward() }
                MBtn(if (marked) BrIcons.CStarOn else BrIcons.CStar, stringResource(if (marked) R.string.brStarOff else R.string.brStar), web, selected = marked) { a.toggleMark(); close() }
                // הורדה: בדף עם סרטונים — ההורדה של Studio (אותה בחירה של ⬇); אחרת אין מה להוריד
                val vids = (t?.foundN ?: 0) > 0
                MBtn(BrIcons.Dl, stringResource(if (vids) R.string.brVideos else R.string.brDownloadPage), vids) {
                    close(); val ps = a.picks(t!!); if (ps.size == 1 && ps[0].file) a.download(ps[0]) else a.pick = true
                }
                MBtn(if (loading) BrIcons.CClose else BrIcons.CRefresh, stringResource(if (loading) R.string.brStop else R.string.brRefresh), web) { a.reload() }
            }
            MItem(R.string.brNewTab, BrIcons.CNewTab) { close(); a.newTab("") }
            if (a.privOk) MItem(R.string.brNewPrivate, BrIcons.CIncognito) { close(); a.newTab("", private = true) }
            MDiv()
            MItem(R.string.brHistory, BrIcons.CHistory) { close(); a.screen = BrowserActivity.Screen.HISTORY }
            MItem(R.string.brRecentTabs, BrIcons.CDevices) { close(); a.screen = BrowserActivity.Screen.RECENT }
            if (t?.private != true) MItem(R.string.brClearData, BrIcons.CDelete) { close(); a.clearAsk = true }
            if (web) MItem(R.string.brInfo, BrIcons.CTune) { close(); a.info = true }
            MDiv()
            MItem(R.string.brDownloads, BrIcons.CDownloads) { a.openDownloads() }
            MItem(R.string.brBookmarks, BrIcons.CStarOn) { close(); a.markFolder = 0; a.screen = BrowserActivity.Screen.BOOKMARKS }
            MItem(R.string.brSetPw, BrIcons.Key) { close(); a.screen = BrowserActivity.Screen.PASSWORDS }
            if (web) {
                MDiv()
                if (a.zoom != 100) { MItem(R.string.brTextSize, BrIcons.TextSize, badge = "${a.zoom}%") { close(); a.zoomSheet = true }; MDiv() }
                MItem(R.string.brMenuShare, BrIcons.CShare) { close(); a.share() }
                if (BrCloud.on && BrCloud.tTabs && !t!!.private) MItem(R.string.brSendDevices, BrIcons.Phone) { close(); a.sendSheet = true }
                MItem(R.string.brFind, BrIcons.CFind) { a.startFind() }
                MItem(R.string.brTranslate, BrIcons.CTranslate) { a.translate() }
                if (a.zoom == 100) MItem(R.string.brTextSize, BrIcons.TextSize) { close(); a.zoomSheet = true }
                MItem(R.string.brInstall, BrIcons.Install) { a.install() }
                MItem(R.string.brDesktop, BrIcons.CDesktop, check = t!!.desktop) { a.toggleDesktop() }
                if (t.vid != null || t.playing || a.speedOf(t) != 100) MItem(R.string.brSpeed, BrIcons.Speed, badge = speedLabel(a.speedOf(t))) { close(); a.speedSheet = true }
                if (t.foundN > 0) {
                    // התוספת של Studio: אותה בחירה של הכפתור שעל הנגן — ממצא אחד מוריד מיד, כמה — הרשימה
                    MItem(R.string.brVideos, BrIcons.Video, iconTint = Red, badge = "${t.foundN}") {
                        close(); val ps = a.picks(t); if (ps.size == 1 && ps[0].file) a.download(ps[0]) else a.pick = true
                    }
                }
            }
            MDiv()
            MItem(R.string.brSettings, BrIcons.CSettings) { close(); a.screen = BrowserActivity.Screen.SETTINGS }
        }
    }
}

/** כפתור עגול בשורה של התפריט — עיגול זכוכית של 40dp (סימנייה שמורה: אדום) בתוך 48dp */
@Composable
private fun RowScope.MBtn(icon: ImageVector, desc: String, enabled: Boolean, selected: Boolean = false, on: () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.weight(1f).height(48.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(40.dp)
            .then(if (selected) Modifier.redGlass(CircleShape) else Modifier.glass(c, CircleShape, if (c.dark) Color(0x593A3A3C) else Color(0x8CFFFFFF)))
            .clickable(enabled = enabled, onClick = on), contentAlignment = Alignment.Center) {
            Icon(icon, desc, Modifier.size(24.dp), tint = when { selected -> Color.White; enabled -> c.tint; else -> c.dis })
        }
    }
}

/** פריט בתפריט: 48dp, סמל 24dp בהתחלה ו־12dp עד הטקסט (16sp) — ובסוף ✓ / מספר */
@Composable
private fun MItem(label: Int, icon: ImageVector, iconTint: Color? = null, badge: String? = null, check: Boolean? = null, on: () -> Unit) {
    val c = LocalBr.current
    Row(Modifier.fillMaxWidth().height(48.dp).clickable(onClick = on).padding(start = 16.dp, end = if (check != null) 4.dp else 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(24.dp), tint = iconTint ?: c.icon)
        Spacer(Modifier.width(12.dp))
        Text(stringResource(label), Modifier.weight(1f), color = c.fg, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (badge != null) { Spacer(Modifier.width(12.dp)); Text(badge, color = c.mute, fontSize = 14.sp) }
        if (check != null) Box(Modifier.width(48.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.size(18.dp).clip(RoundedCornerShape(4.dp)).background(if (check) c.tint else Color.Transparent)
                .border(2.dp, if (check) c.tint else c.mute, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
                if (check) Icon(BrIcons.Check, null, Modifier.size(14.dp), tint = Color.White)
            }
        }
    }
}

@Composable
private fun MDiv() { HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 5.dp), thickness = 0.5.dp, color = LocalBr.current.line) }

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

/**
 * 26/10/2026 (בקשת המשתמש: "כמו ב־IDM — בחירת איכויות, בדיוק מה הקובץ, הסוג והמשקל, בלי פרסומות"): בראש הרשימה
 * הסרטון הראשי (BrowserActivity.mainOf — הדף או הזרם, מה שהצליח) כשורה לכל איכות: הרזולוציה, הקודקים והמשקל;
 * "שמע" — רק קול; ולהוריד ולתרגם ב־Studio. כל מה שהנגן ביקש בדרך (זרמים, קטעים) — מקופל תחת "קבצים נוספים".
 * בחירה = ההורדה מתחילה מיד (menuPick), בלי מסך נוסף
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickSheet(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val ctx = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(t.id) { a.prefetch(t); while (true) { delay(700); tick++ } }
    @Suppress("UNUSED_VARIABLE") val tk = tick
    val m = a.mainOf(t)
    val ps = a.picks(t)
    // מה שלא הסרטון הראשי: בלי המועמד שנבחר, ובלי הדף כשהוא לא נקרא (נכשל) — אותו סרטון שכבר מוצג
    val extra = ps.filter { p -> p.url != m.p?.url && !(p.page && m.info != null) && !(p.page && io.github.yishaiguedj1.snowball.dm.DmPre.state(p.url) == 3) }
    var more by remember { mutableStateOf(false) }
    val showRaw = m.st == 0 || m.st == 3
    ModalBottomSheet(onDismissRequest = { a.pick = false }, containerColor = c.screen) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            SheetHead(stringResource(R.string.brPick), BrStore.hostOf(t.url), close = { a.pick = false })
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp).fillMaxWidth().glass(c, RoundedCornerShape(16.dp)).padding(10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(112.dp, 63.dp).clip(RoundedCornerShape(8.dp)).background(Brush.linearGradient(listOf(Color(0xFF3A3A3C), Color(0xFF1C1C1E)))),
                    contentAlignment = Alignment.Center) {
                    t.thumb?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                        ?: Icon(BrIcons.Video, null, Modifier.size(26.dp), tint = Color.White.copy(alpha = 0.85f))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.title.ifEmpty { BrStore.hostOf(t.url) }, color = c.fg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 19.sp)
                    val d = m.info?.optInt("d") ?: 0
                    Text(if (d > 0) "%d:%02d".format(d / 60, d % 60) else BrStore.hostOf(t.url), color = c.mute, fontSize = 13.sp)
                }
            }
            if (m.info != null) {
                val (vs, au) = remember(m.info.toString()) { io.github.yishaiguedj1.snowball.dm.DmPre.quals(ctx, m.info) }
                @Composable fun SizeDl(sz: Long) = Row(verticalAlignment = Alignment.CenterVertically) {
                    if (sz > 0) Text(io.github.yishaiguedj1.snowball.dm.DmFmt.size(ctx, sz), color = c.mute, fontSize = 15.sp, modifier = Modifier.padding(end = 10.dp))
                    Icon(BrIcons.Dl, null, Modifier.size(22.dp), tint = c.tint)
                }
                if (vs.isNotEmpty()) Group(stringResource(R.string.dmMenuVideo)) {
                    vs.forEachIndexed { i, q ->
                        if (i > 0) Sep()
                        IRow(q.t, q.f.ifEmpty { null }, lead = { Tile(BrIcons.Video, Red) }, chevron = false, ltrSub = true, trailing = { SizeDl(q.sz) }) { a.menuPick(t, q.k) }
                    }
                }
                if (au != null) Group(stringResource(R.string.dmMenuAudio)) {
                    IRow(au.t, au.f.ifEmpty { null }, lead = { Tile(BrIcons.Headphones, Color(0xFFFF9500)) }, chevron = false, ltrSub = true, trailing = { SizeDl(au.sz) }) { a.menuPick(t, au.k) }
                }
                if (vs.isNotEmpty() && io.github.yishaiguedj1.snowball.AppRoute.studioInstalled(ctx)) Group {
                    IRow(stringResource(R.string.dmDlTr), color = Red, chevron = false) { a.menuPick(t, "t" + vs[0].k) }
                }
            } else if (m.st == 1) Group {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = c.mute)
                    Spacer(Modifier.width(10.dp))
                    Text(stringResource(R.string.brPreparing), color = c.mute, fontSize = 15.sp)
                }
            }
            if (extra.isNotEmpty()) {
                val open = showRaw || more
                if (!showRaw) Group {
                    IRow(stringResource(R.string.brMoreFiles, extra.size), chevron = false,
                        trailing = { Icon(BrIcons.Down, null, Modifier.size(22.dp).rotate(if (more) 180f else 0f), tint = c.mute) }) { more = !more }
                }
                if (open) Group(if (showRaw) stringResource(R.string.brFoundInPage) else null) {
                    extra.forEachIndexed { i, p ->
                        if (i > 0) Sep()
                        IRow(stringResource(p.label), p.host, lead = { Tile(BrIcons.Video, if (p.page) Red else Color(0xFF007AFF)) }, chevron = false, ltrSub = true,
                            trailing = { Icon(BrIcons.Dl, null, Modifier.size(22.dp), tint = c.tint) }) { a.download(p) }
                    }
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
            @Suppress("UNUSED_VARIABLE") val rv = a.sitesRev
            val host = BrStore.hostOf(t.url)
            if (a.shield) Group(footer = if (a.shieldOn(host)) stringResource(R.string.brShieldSiteOn, t.blocked) else stringResource(R.string.brShieldSiteOff)) {
                IRow(stringResource(R.string.brShieldSite), lead = { Tile(BrIcons.Shield, Color(0xFFFF9500)) }, chevron = false,
                    trailing = { IosSwitch(a.shieldOn(host)) { a.toggleSiteShield(t) } })
            }
            if (!t.private) Group {
                IRow(stringResource(R.string.brSiteSettings), lead = { Tile(BrIcons.Tune, Color(0xFF5856D6)) }) {
                    a.info = false; a.siteHost = host; a.screen = BrowserActivity.Screen.SITE
                }
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
            Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth().glass(c, RoundedCornerShape(16.dp)).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
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

/* ======================= מסך הכרטיסיות — כמו ב־Chrome לאנדרואיד ======================= */

/** הסרגל: "+" (זכוכית אדומה, 40dp) · מעבר רגיל/פרטי באמצע · ⋮; תיבת "חיפוש בכרטיסיות"; ושתי עמודות של כרטיסים */
@Composable
private fun Switcher(a: BrowserActivity) {
    val c = LocalBr.current
    var more by remember { mutableStateOf(false) }
    var ask by remember { mutableStateOf(false) }
    var q by remember(a.swPrivate) { mutableStateOf("") }
    val all = a.tabs.filter { it.private == a.swPrivate }
    val list = q.trim().lowercase().let { s -> if (s.isEmpty()) all else all.filter { it.title.lowercase().contains(s) || it.url.lowercase().contains(s) } }
    Column(Modifier.fillMaxSize().ambient(c).statusBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(56.dp)) {
            Box(Modifier.align(Alignment.CenterStart).padding(start = 16.dp).size(40.dp).redGlass(RoundedCornerShape(12.dp))
                .clickable { a.screen = BrowserActivity.Screen.PAGE; a.newTab("", private = a.swPrivate) }, contentAlignment = Alignment.Center) {
                Icon(BrIcons.CPlus, stringResource(R.string.brNewTab), Modifier.size(24.dp), tint = Color.White)
            }
            if (a.privOk) Row(Modifier.align(Alignment.Center).height(48.dp).glass(c, RoundedCornerShape(16.dp), c.fill).padding(horizontal = 2.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PaneBtn(!a.swPrivate, stringResource(R.string.brRegularTabs), { a.swPrivate = false }) {
                    val n = a.tabs.count { !it.private }
                    Box(Modifier.size(18.dp).border(2.dp, c.fg, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
                        Text(if (n > 99) ":D" else "$n", color = c.fg, fontSize = if (n > 9) 9.sp else 11.sp, fontWeight = FontWeight.Bold, lineHeight = 12.sp)
                    }
                }
                PaneBtn(a.swPrivate, stringResource(R.string.brPrivateTabs), { a.swPrivate = true }) { Icon(BrIcons.CIncognito, null, Modifier.size(24.dp), tint = c.fg) }
            }
            Box(Modifier.align(Alignment.CenterEnd).padding(end = 8.dp)) {
                IBtn(BrIcons.More, stringResource(R.string.brMenuTabs)) { more = true }
                DropdownMenu(more, { more = false }, shape = RoundedCornerShape(24.dp)) {
                    DropdownMenuItem({ Text(stringResource(R.string.brNewTab)) }, { more = false; a.screen = BrowserActivity.Screen.PAGE; a.newTab("") }, leadingIcon = { Icon(BrIcons.CNewTab, null) })
                    if (a.privOk) DropdownMenuItem({ Text(stringResource(R.string.brNewPrivate)) }, { more = false; a.screen = BrowserActivity.Screen.PAGE; a.newTab("", private = true) },
                        leadingIcon = { Icon(BrIcons.CIncognito, null) })
                    DropdownMenuItem({ Text(stringResource(if (a.swPrivate) R.string.brCloseAllPriv else R.string.brCloseAll)) }, { more = false; ask = true },
                        enabled = all.isNotEmpty(), leadingIcon = { Icon(BrIcons.CClose, null) })
                    if (!a.swPrivate) DropdownMenuItem({ Text(stringResource(R.string.brClearData)) }, { more = false; a.clearAsk = true }, leadingIcon = { Icon(BrIcons.CDelete, null) })
                    DropdownMenuItem({ Text(stringResource(R.string.brSettings)) }, { more = false; a.screen = BrowserActivity.Screen.SETTINGS }, leadingIcon = { Icon(BrIcons.CSettings, null) })
                }
            }
        }
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().height(40.dp).glass(c, RoundedCornerShape(20.dp), c.fill).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(q, { q = it }, Modifier.weight(1f), singleLine = true, textStyle = TextStyle(color = c.fg, fontSize = 16.sp, textDirection = TextDirection.Content),
                cursorBrush = SolidColor(c.tint), decorationBox = { inner ->
                    Box { if (q.isEmpty()) Text(stringResource(if (a.swPrivate) R.string.brSearchTabsPriv else R.string.brSearchTabs), color = c.mute, fontSize = 16.sp, maxLines = 1); inner() }
                })
            if (q.isNotEmpty()) Box(Modifier.size(28.dp).clip(CircleShape).clickable { q = "" }, contentAlignment = Alignment.Center) {
                Icon(BrIcons.CClose, stringResource(R.string.brClear), Modifier.size(18.dp), tint = c.mute)
            }
        }
        if (list.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(stringResource(if (a.swPrivate) R.string.brPrivateNone else R.string.brNoTabs), color = c.mute, fontSize = 18.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
            }
        } else LazyVerticalGrid(GridCells.Fixed(2), Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            items(list, key = { it.id }) { t -> TabCard(a, t) }
        }
        Spacer(Modifier.navigationBarsPadding())
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false },
        title = { Text(stringResource(if (a.swPrivate) R.string.brCloseAllPrivQ else R.string.brCloseAllQ)) },
        confirmButton = { TextButton({ ask = false; a.closeAll(a.swPrivate); if (a.swPrivate) a.swPrivate = false }) {
            Text(stringResource(if (a.swPrivate) R.string.brCloseAllPriv else R.string.brCloseAll), color = Color(0xFFFF3B30)) } },
        dismissButton = { TextButton({ ask = false }) { Text(stringResource(R.string.brCancel)) } })
}

/** כפתור במעבר רגיל/פרטי: 40dp, הנבחר — כרטיס זכוכית בהיר שמחליק אליו */
@Composable
private fun PaneBtn(on: Boolean, desc: String, click: () -> Unit, content: @Composable () -> Unit) {
    val c = LocalBr.current
    Box(Modifier.size(40.dp).then(if (on) Modifier.glass(c, RoundedCornerShape(12.dp), if (c.dark) Color(0xCC48484A) else Color(0xF2FFFFFF)) else Modifier.clip(RoundedCornerShape(12.dp)))
        .clickable(onClickLabel = desc, onClick = click), contentAlignment = Alignment.Center) { content() }
}

/** כרטיס של Chrome: רדיוס 24, כותרת של 40dp (סמל 18dp · שם 14sp · ✕), התמונה ברדיוס 12/20 בפנים; הנוכחי — מלא בצבע הפעולה */
@Composable
private fun TabCard(a: BrowserActivity, t: BrTab) {
    val c = LocalBr.current
    val on = t === a.cur
    val shape = RoundedCornerShape(24.dp)
    val fg = if (on) Color.White else c.fg
    Column(
        Modifier.fillMaxWidth().height(232.dp)
            .then(if (on) Modifier.clip(shape).background(c.tint) else Modifier.glass(c, shape))
            .clickable { a.select(t); a.screen = BrowserActivity.Screen.PAGE }
    ) {
        Row(Modifier.fillMaxWidth().height(40.dp).padding(start = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            if (t.url.startsWith("http")) Fav(a, t.url, 18.dp, 4.dp, t.icon) else Icon(BrIcons.CGlobe, null, Modifier.size(18.dp), tint = fg)
            Spacer(Modifier.width(9.dp))
            Text(t.title.ifEmpty { if (t.url.startsWith("http")) BrStore.hostOf(t.url) else stringResource(R.string.brNewTab) },
                Modifier.weight(1f), color = fg, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Box(Modifier.size(44.dp).clip(CircleShape).clickable { a.close(t) }, contentAlignment = Alignment.Center) {
                Icon(BrIcons.CClose, stringResource(R.string.brCloseTab), Modifier.size(18.dp), tint = if (on) Color.White else c.mute)
            }
        }
        Box(Modifier.fillMaxSize().padding(start = 4.dp, end = 4.dp, bottom = 4.dp)
            .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp, bottomStart = 20.dp, bottomEnd = 20.dp))
            .background(if (t.private) Color(0xFF202124) else if (c.dark) Color(0xFF1C1C1E) else Color.White)) {
            t.thumb?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = Alignment.TopCenter) }
        }
    }
}

/* ======================= היסטוריה — כמו ב־Chrome ======================= */

@Composable
private fun HistoryScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    val today = stringResource(R.string.brToday); val yday = stringResource(R.string.brYesterday)
    val days = remember(q, rev, a.markRev) {
        val t = q.trim().lowercase()
        val list = BrStore.history.asReversed().filter { t.isEmpty() || it.title.lowercase().contains(t) || it.url.lowercase().contains(t) }.take(500)
        list.groupBy { java.util.Calendar.getInstance().apply { timeInMillis = it.at }.let { k -> k.get(java.util.Calendar.YEAR) * 1000 + k.get(java.util.Calendar.DAY_OF_YEAR) } }.values.toList()
    }
    val ctx = LocalContext.current
    SubPage(stringResource(R.string.brHistory), done = true, onDone = { a.screen = BrowserActivity.Screen.PAGE }) {
        item { SearchField(stringResource(R.string.brSearchHistory), q) { q = it } }
        item {
            Text(stringResource(R.string.brClearData) + "…", Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp).clip(RoundedCornerShape(12.dp))
                .clickable { a.clearAsk = true }.padding(horizontal = 16.dp, vertical = 12.dp), color = c.tint, fontSize = 16.sp, fontWeight = FontWeight.Medium)
        }
        if (days.isEmpty()) item { Empty(R.string.brHistoryEmpty) }
        days.forEach { day ->
            item {
                val at = day[0].at
                val date = DateUtils.formatDateTime(ctx, at, DateUtils.FORMAT_SHOW_WEEKDAY or DateUtils.FORMAT_ABBREV_WEEKDAY or DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_SHOW_YEAR)
                val label = when {
                    DateUtils.isToday(at) -> "$today - $date"
                    DateUtils.isToday(at + DateUtils.DAY_IN_MILLIS) -> "$yday - $date"
                    else -> date
                }
                Group(label) {
                    day.forEachIndexed { i, v ->
                        if (i > 0) Sep()
                        IRow(v.title.ifEmpty { v.url }, BrStore.hostOf(v.url), lead = {
                            Box(Modifier.size(36.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, v.url, 16.dp, 8.dp) }
                        }, chevron = false, ltrSub = true, trailing = {
                            Box(Modifier.size(40.dp).clip(CircleShape).clickable { BrStore.removeVisit(v); rev++; a.markRev++ }, contentAlignment = Alignment.Center) {
                                Icon(BrIcons.CClose, stringResource(R.string.brDelete), Modifier.size(20.dp), tint = c.mute)
                            }
                        }) { a.screen = BrowserActivity.Screen.PAGE; a.go(v.url) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Empty(text: Int) {
    val c = LocalBr.current
    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { Text(stringResource(text), color = c.mute, fontSize = 18.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center) }
}

/* ======================= סימניות — כמו ב־Chrome ======================= */

@Composable
private fun MarksScreen(a: BrowserActivity) {
    val c = LocalBr.current
    var q by remember { mutableStateOf("") }
    var rev by remember { mutableIntStateOf(0) }
    val all = remember(rev, a.markRev) { BrStore.marks.toList() }
    val imported = all.count { it.imp }
    val folders = imported > 0
    val title = when (a.markFolder) { 1 -> stringResource(R.string.brMarksMobile); 2 -> stringResource(R.string.brImportedMarks); else -> stringResource(R.string.brBookmarks) }
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
        done = true, onDone = { a.markFolder = 0; a.screen = BrowserActivity.Screen.PAGE }) {
        item { SearchField(stringResource(R.string.brSearchMarks), q) { q = it } }
        if (a.markFolder == 0 && folders && q.isBlank()) item {
            Group {
                IRow(stringResource(R.string.brMarksMobile), lead = { Icon(BrIcons.Folder, null, Modifier.size(24.dp), tint = c.icon) }, value = "${all.size - imported}") { a.markFolder = 1 }
                Sep()
                IRow(stringResource(R.string.brImportedMarks), lead = { Icon(BrIcons.Folder, null, Modifier.size(24.dp), tint = c.icon) }, value = "$imported") { a.markFolder = 2 }
            }
        }
        if (list.isEmpty() && !(a.markFolder == 0 && folders && q.isBlank())) item { Empty(R.string.brMarksEmpty) }
        if (list.isNotEmpty()) item {
            Group {
                list.forEachIndexed { i, m ->
                    if (i > 0) Sep()
                    var open by remember { mutableStateOf(false) }
                    IRow(m.title.ifEmpty { m.url }, BrStore.hostOf(m.url), lead = {
                        Box(Modifier.size(48.dp).glass(c, RoundedCornerShape(12.dp), if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, m.url, 24.dp, 6.dp) }
                    }, chevron = false, ltrSub = true, trailing = {
                        Box {
                            IBtn(BrIcons.More, stringResource(R.string.brMenu), size = 40.dp, tint = c.mute) { open = true }
                            DropdownMenu(open, { open = false }, shape = RoundedCornerShape(16.dp)) {
                                DropdownMenuItem({ Text(stringResource(R.string.brNewTab)) }, { open = false; a.markFolder = 0; a.screen = BrowserActivity.Screen.PAGE; a.newTab(m.url) },
                                    leadingIcon = { Icon(BrIcons.CNewTab, null) })
                                DropdownMenuItem({ Text(stringResource(R.string.brDelete), color = Color(0xFFFF3B30)) }, { open = false; BrStore.removeMark(m); rev++; a.markRev++ },
                                    leadingIcon = { Icon(BrIcons.CDelete, null, tint = Color(0xFFFF3B30)) })
                            }
                        }
                    }) { a.markFolder = 0; a.screen = BrowserActivity.Screen.PAGE; a.go(m.url) }
                }
            }
        }
    }
}

/* ======================= הגדרות — המבנה של Chrome ======================= */

@Composable
private fun SettingsScreen(a: BrowserActivity) {
    val c = LocalBr.current
    val eng = when (a.engine) { "ddg" -> "DuckDuckGo"; "bing" -> "Bing"; else -> "Google" }
    var q by remember { mutableStateOf("") }
    val g0 = stringResource(R.string.brCloudTitle)
    val g1 = stringResource(R.string.brSyncTitle); val g2 = stringResource(R.string.brImportTitle)
    @Suppress("UNUSED_VARIABLE") val crev = a.cloudRev
    val g0v = if (BrCloud.on) BrCloud.email else stringResource(R.string.brSyncOffShort)
    val s1 = stringResource(R.string.brSetEngine); val s2 = stringResource(R.string.brSetBar); val s3 = stringResource(R.string.brPrivacy)
    val s4 = stringResource(R.string.brSetDefault); val s5 = stringResource(R.string.brPwTitle)
    val barV = stringResource(if (a.barBottom) R.string.brBarBottom else R.string.brBarTop)
    val defV = if (a.isDefault) stringResource(R.string.brYes) else stringResource(R.string.brSetDefaultAsk)
    val pwV = pwValue(a)
    val t1 = stringResource(R.string.brSetHome); val t2 = stringResource(R.string.brSetBubble); val t3 = stringResource(R.string.brVideoTitle)
    val t4 = stringResource(R.string.brSites); val t5 = stringResource(R.string.brDownloads); val t6 = stringResource(R.string.brAboutApp)
    val bgV = if (a.bgPlay) stringResource(R.string.brBgShort) else null
    SubPage(stringResource(R.string.brSettings), done = true, onDone = { a.screen = BrowserActivity.Screen.PAGE }) {
        item { SearchField(stringResource(R.string.brSearchSettings), q) { q = it } }
        // חיפוש בהגדרות: מסנן את השורות לפי השם
        fun show(s: String) = q.isBlank() || s.contains(q.trim(), ignoreCase = true)
        if (q.isBlank() && a.lastImport.isEmpty() && BrStore.marks.none { it.imp }) item {
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).redGlass(RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Icon(BrIcons.CStarOn, null, Modifier.size(26.dp), tint = Color.White) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.brPromoTitle), color = c.fg, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    Text(stringResource(R.string.brPromoSub), color = c.mute, fontSize = 14.sp, lineHeight = 20.sp)
                }
                Spacer(Modifier.width(8.dp))
                Box(Modifier.height(36.dp).redGlass(RoundedCornerShape(18.dp)).clickable { a.screen = BrowserActivity.Screen.IMPORT }.padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center) { Text(stringResource(R.string.brImportBtn), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium) }
            }
        }
        if (show(g0) || show(g1) || show(g2)) item {
            Group(stringResource(R.string.brYouAndGoogle)) {
                // הסנכרון בענן — בראש, כמו "סנכרון" ב־Chrome; הגשר ל־Chrome במחשב — מתחתיו
                if (show(g0)) IRow(g0, lead = { Avatar(BrCloud.name, BrCloud.email, BrCloud.on, 28.dp) }, value = g0v) { a.screen = BrowserActivity.Screen.CLOUD }
                if (show(g0) && (show(g1) || show(g2))) Sep()
                if (show(g1)) IRow(g1, lead = { Image(BrIcons.GoogleG, null, Modifier.size(24.dp)) }, value = syncValue(a)) { a.screen = BrowserActivity.Screen.CHROME }
                if (show(g1) && show(g2)) Sep()
                if (show(g2)) IRow(g2, lead = { Tile(BrIcons.CStarOn, c.icon) }) { a.screen = BrowserActivity.Screen.IMPORT }
            }
        }
        val basics = listOf<Pair<String, @Composable () -> Unit>>(
            s1 to { IRow(s1, value = eng) { a.screen = BrowserActivity.Screen.ENGINE } },
            s2 to { IRow(s2, value = barV) { a.screen = BrowserActivity.Screen.BARPOS } },
            s3 to { IRow(s3) { a.screen = BrowserActivity.Screen.PRIVACY } },
            s4 to { IRow(s4, value = defV) { if (!a.isDefault) a.makeDefault() } },
            s5 to { IRow(s5, value = pwV) { a.screen = BrowserActivity.Screen.PASSWORDS } },
        ).filter { show(it.first) }
        if (basics.isNotEmpty()) item { Group(stringResource(R.string.brBasics)) { basics.forEachIndexed { i, (_, row) -> if (i > 0) Sep(); row() } } }
        val adv = listOf<Pair<String, @Composable () -> Unit>>(
            t1 to { IRow(t1, chevron = false, trailing = { IosSwitch(a.homeBtn) { a.pickHomeBtn(it) } }) },
            t2 to { IRow(t2, chevron = false, trailing = { IosSwitch(a.bubble) { a.pickBubble(it) } }) },
            t3 to { IRow(t3, value = bgV) { a.screen = BrowserActivity.Screen.VIDEO } },
            t4 to { IRow(t4) { a.screen = BrowserActivity.Screen.SITES } },
            t5 to { IRow(t5, value = "Studio DM") { a.dlSettings() } },
            t6 to { IRow(t6, value = a.version(), chevron = false) },
        ).filter { show(it.first) }
        if (adv.isNotEmpty()) item { Group(stringResource(R.string.brAdvanced)) { adv.forEachIndexed { i, (_, row) -> if (i > 0) Sep(); row() } } }
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
        item {
            val n = remember(a.screen) { a.blockedAll() }
            Group(footer = if (a.shield) stringResource(R.string.brShieldFoot, java.text.NumberFormat.getIntegerInstance().format(n)) else stringResource(R.string.brShieldOffFoot)) {
                IRow(stringResource(R.string.brShield), lead = { Tile(BrIcons.Shield, Color(0xFFFF9500)) }, chevron = false, trailing = { IosSwitch(a.shield) { a.pickShield(it) } })
                if (a.shield) {
                    Sep()
                    IRow(stringResource(R.string.brCookies), lead = { Tile(BrIcons.Cookie, Color(0xFFA2845E)) }, chevron = false, trailing = { IosSwitch(a.cookies) { a.pickCookies(it) } })
                }
            }
        }
        item {
            val ok = a.canLock()
            Group(footer = stringResource(if (ok) R.string.brLockFoot else R.string.brLockNoScreen)) {
                IRow(stringResource(R.string.brLockPriv), lead = { Tile(BrIcons.Finger, Color(0xFF5856D6)) }, chevron = false,
                    trailing = { if (ok) IosSwitch(a.lockPriv) { a.pickLockPriv(it) } })
            }
        }
        item {
            @Suppress("UNUSED_VARIABLE") val rv = a.sitesRev
            Group {
                IRow(stringResource(R.string.brSites), lead = { Tile(BrIcons.Tune, Color(0xFF007AFF)) }, value = a.rules.size.takeIf { it > 0 }?.toString()) { a.screen = BrowserActivity.Screen.SITES }
                Sep()
                IRow(stringResource(R.string.brClearData), lead = { Tile(BrIcons.Trash, Color(0xFFFF3B30)) }) { a.clearAsk = true }
            }
        }
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
            Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(18.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(64.dp).redGlass(RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
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
                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(64.dp).redGlass(RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
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
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(horizontal = 18.dp, vertical = 20.dp),
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
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp).fillMaxWidth().glass(c, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 14.dp),
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
                IRow(stringResource(R.string.brSetPw), stringResource(R.string.brPwAlready), lead = { Tile(BrIcons.Key, Color(0xFF8E8E93)) }) { a.screen = BrowserActivity.Screen.PASSWORDS }
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

/* ======================= שלב 3: פרטיות ווידאו (26/10/2026) ======================= */

/* ======================= סנכרון בענן בין המכשירים (BrCloud) ======================= */

/** העיגול של החשבון: האות הראשונה של השם על אדום — כמו התמונה של החשבון ב־Chrome; בלי חשבון — ה־G של Google */
@Composable
private fun Avatar(name: String, email: String, on: Boolean, size: Dp) {
    if (!on) { Image(BrIcons.GoogleG, null, Modifier.size(size * 0.86f)); return }
    val ch = (name.ifEmpty { email }).trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    Box(Modifier.size(size).redGlass(CircleShape), contentAlignment = Alignment.Center) {
        Text(ch, color = Color.White, fontSize = (size.value * 0.46f).sp, fontWeight = FontWeight.Medium)
    }
}

private fun ago(at: Long): String = DateUtils.getRelativeTimeSpanString(at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()

/** עמוד "סנכרון" (כמו ב־Chrome): לא מחובר = כניסה עם Google; מחובר = החשבון, מה מסתנכרן, המכשירים, הפסקה/מחיקה */
@Composable
private fun CloudScreen(a: BrowserActivity) {
    val c = LocalBr.current
    @Suppress("UNUSED_VARIABLE") val rev = a.cloudRev
    val scope = rememberCoroutineScope()
    var wipeAsk by remember { mutableStateOf(false) }
    val back = stringResource(R.string.brSettings)
    SubPage(stringResource(R.string.brCloudTitle), back = back, onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        if (!BrCloud.on) {
            item {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 20.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(64.dp).redGlass(RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
                        Icon(BrIcons.CDevices, null, Modifier.size(34.dp), tint = Color.White)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(stringResource(R.string.brCloudHero), color = c.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.brCloudHeroSub), color = c.mute, fontSize = 15.sp, textAlign = TextAlign.Center, lineHeight = 21.sp)
                    Spacer(Modifier.height(18.dp))
                    BigBtn(stringResource(R.string.brCloudSignIn), true) { scope.launch { a.cloudSignIn(BrCloud.signIn(a)) } }
                }
            }
            item { Text(stringResource(R.string.brCloudFootOff), Modifier.padding(horizontal = 32.dp), color = c.mute, fontSize = 13.sp, lineHeight = 18.sp) }
            return@SubPage
        }
        item {
            val err = BrCloud.err
            val at = BrCloud.syncAt
            val sub = when {
                err.isNotEmpty() -> stringResource(if (err.contains("auth")) R.string.brSyncErrAuth else R.string.brSyncErrNet)
                at == 0L -> stringResource(R.string.brSyncWaitShort)
                System.currentTimeMillis() - at < 60_000 -> stringResource(R.string.brCloudJustNow)
                else -> stringResource(R.string.brCloudAt, ago(at))
            }
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(horizontal = 18.dp, vertical = 18.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Avatar(BrCloud.name, BrCloud.email, true, 52.dp)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(BrCloud.name.ifEmpty { BrCloud.email }, color = c.fg, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (BrCloud.name.isNotEmpty()) Text(BrCloud.email, color = c.mute, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(BrIcons.CLock, null, Modifier.size(14.dp), tint = Green)
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.brCloudEnc), color = c.mute, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(if (err.isEmpty()) Green else Color(0xFFFF9500)))
                        Spacer(Modifier.width(6.dp))
                        Text(if (err.isEmpty()) stringResource(R.string.brCloudOn) + " · " + sub else sub, color = c.mute, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        // החיבור לחשבון / מפתח ההצפנה חסר (התחברת בגרסה הראשונה, או שהחשבון התנתק) — כניסה מחדש
        if (BrCloud.err.contains("auth") || BrCloud.err.contains("key")) item {
            Box(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp)) {
                BigBtn(stringResource(R.string.brCloudReauth), true) { scope.launch { a.cloudSignIn(BrCloud.signIn(a)) } }
            }
        }
        item {
            Group(stringResource(R.string.brSyncWhat), stringResource(R.string.brCloudWhatFoot)) {
                IRow(stringResource(R.string.brSyncMarks), lead = { Tile(BrIcons.CStarOn, c.icon) }, chevron = false,
                    trailing = { IosSwitch(BrCloud.tMarks) { BrCloud.tMarks = it; a.cloudRev++ } })
                Sep()
                IRow(stringResource(R.string.brSyncHist), lead = { Tile(BrIcons.CHistory, c.icon) }, chevron = false,
                    trailing = { IosSwitch(BrCloud.tHist) { BrCloud.tHist = it; a.cloudRev++ } })
                Sep()
                IRow(stringResource(R.string.brCloudTabs), lead = { Tile(BrIcons.CDevices, c.icon) }, chevron = false,
                    trailing = { IosSwitch(BrCloud.tTabs) { BrCloud.tTabs = it; a.cloudRev++ } })
                Sep()
                IRow(stringResource(R.string.brCloudPrefs), lead = { Tile(BrIcons.CSettings, c.icon) }, chevron = false,
                    trailing = { IosSwitch(BrCloud.tPrefs) { BrCloud.tPrefs = it; a.cloudRev++ } })
            }
        }
        item {
            val devs = BrCloud.devices()
            Group(stringResource(R.string.brCloudDevices), if (devs.isEmpty()) stringResource(R.string.brCloudNoDevices) else null) {
                IRow(BrCloud.deviceName(), stringResource(R.string.brCloudThis), lead = { Tile(BrIcons.Phone, c.icon) }, chevron = false)
                devs.forEach { d ->
                    Sep()
                    IRow(d.name, stringResource(R.string.brCloudSeen, ago(d.at), d.tabs.size), lead = { Tile(if (d.form == "t") BrIcons.CDesktop else BrIcons.Phone, c.icon) }) {
                        a.screen = BrowserActivity.Screen.RECENT
                    }
                }
            }
        }
        item {
            Group {
                IRow(stringResource(R.string.brSyncNow), color = c.tint, chevron = false) { BrCloud.nudge(0) }
            }
        }
        item {
            Group(footer = stringResource(R.string.brCloudStopFoot)) {
                IRow(stringResource(R.string.brCloudStop), color = Color(0xFFFF3B30), chevron = false) { a.cloudOff(false) }
                Sep()
                IRow(stringResource(R.string.brCloudWipe), color = Color(0xFFFF3B30), chevron = false, value = if (a.cloudWiping) "…" else null) { wipeAsk = true }
            }
        }
    }
    if (wipeAsk) AlertDialog(onDismissRequest = { wipeAsk = false }, containerColor = c.card,
        text = { Text(stringResource(R.string.brCloudWipeQ), color = c.fg, fontSize = 15.sp, lineHeight = 21.sp) },
        confirmButton = { TextButton({ wipeAsk = false; a.cloudOff(true) }) { Text(stringResource(R.string.brDelete), color = Color(0xFFFF3B30)) } },
        dismissButton = { TextButton({ wipeAsk = false }) { Text(stringResource(R.string.brCancel), color = c.tint) } })
}

/** "כרטיסיות אחרונות" (כמו ב־Chrome): לכל מכשיר אחר — הכרטיסיות הפתוחות בו, מהפעילה לאחרונה. נגיעה = ממשיכים מאותו מקום */
@Composable
private fun RecentScreen(a: BrowserActivity) {
    val c = LocalBr.current
    @Suppress("UNUSED_VARIABLE") val rev = a.cloudRev
    LaunchedEffect(Unit) { BrCloud.nudge(0) }
    val devs = BrCloud.devices().filter { it.tabs.isNotEmpty() }
    SubPage(stringResource(R.string.brRecentTabs), onBack = { a.screen = BrowserActivity.Screen.PAGE }) {
        if (!BrCloud.on) {
            item {
                Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(BrIcons.CDevices, null, Modifier.size(40.dp), tint = c.tint)
                    Spacer(Modifier.height(10.dp))
                    Text(stringResource(R.string.brRecentSignIn), color = c.fg, fontSize = 15.sp, textAlign = TextAlign.Center, lineHeight = 21.sp)
                    Spacer(Modifier.height(16.dp))
                    BigBtn(stringResource(R.string.brCloudTitle), true) { a.screen = BrowserActivity.Screen.CLOUD }
                }
            }
            return@SubPage
        }
        if (devs.isEmpty()) { item { Empty(R.string.brRecentNone) }; return@SubPage }
        devs.forEach { d ->
            item(key = d.dev) {
                Group(d.name + " · " + ago(d.at)) {
                    d.tabs.sortedByDescending { it.la }.forEachIndexed { i, st ->
                        if (i > 0) Sep()
                        IRow(st.t.ifEmpty { BrStore.hostOf(st.u) }, BrStore.hostOf(st.u),
                            lead = { Box(Modifier.size(36.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, st.u, 18.dp, 9.dp) } },
                            chevron = false) { a.openRemote(st) }
                    }
                }
            }
        }
    }
}

/** "המשך מ־<מכשיר>" בכרטיסייה חדשה — כמו ה־tab resumption של Chrome: הכרטיסייה שהייתה פעילה לאחרונה במכשיר אחר */
@Composable
private fun ResumeCard(a: BrowserActivity) {
    val c = LocalBr.current
    @Suppress("UNUSED_VARIABLE") val rev = a.cloudRev
    LaunchedEffect(Unit) { BrCloud.nudge(0) }
    val open = remember(a.tabs.size, a.cloudRev) { a.tabs.mapTo(HashSet()) { BrSync.key(it.url) } }
    val (s, st) = BrCloud.resume(open) ?: return
    Spacer(Modifier.height(16.dp))
    Column(Modifier.fillMaxWidth().glass(c, RoundedCornerShape(24.dp)).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(BrIcons.CDevices, null, Modifier.size(20.dp), tint = c.tint)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.brResumeFrom, s.name), Modifier.weight(1f), color = c.fg, fontSize = 16.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            IBtn(BrIcons.CClose, stringResource(R.string.brClose), size = 32.dp, iconSize = 18.dp, tint = c.mute) { BrCloud.dismiss(st); a.cloudRev++ }
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(12.dp)).clickable { a.openRemote(st) }, verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, st.u, 20.dp, 10.dp) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(st.t.ifEmpty { BrStore.hostOf(st.u) }, color = c.fg, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(BrStore.hostOf(st.u) + " · " + ago(st.la), color = c.mute, fontSize = 14.sp, maxLines = 1)
            }
        }
    }
}

/** כרטיסייה שנשלחה לכאן ממכשיר אחר בזמן שהדפדפן פתוח — פס זכוכית בראש הדף (כמו ההודעה של Chrome) */
@Composable
private fun IncomingBar(a: BrowserActivity, from: String, st: BrCloudCore.STab, m: Modifier) {
    val c = LocalBr.current
    LaunchedEffect(st) { delay(12_000); if (a.incoming?.second == st) a.incoming = null }
    Row(m.padding(12.dp).fillMaxWidth().glass(c, RoundedCornerShape(20.dp)).padding(start = 14.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).glass(c, CircleShape, if (c.dark) Color(0x8C3A3A3C) else Color(0xB3FFFFFF)), contentAlignment = Alignment.Center) { Fav(a, st.u, 18.dp, 9.dp) }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(stringResource(R.string.brSentFrom, from), color = c.mute, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(st.t.ifEmpty { BrStore.hostOf(st.u) }, color = c.fg, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(stringResource(R.string.brOpenTab), Modifier.clip(RoundedCornerShape(10.dp)).clickable { a.openRemote(st) }.padding(horizontal = 10.dp, vertical = 8.dp),
            color = c.tint, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        IBtn(BrIcons.CClose, stringResource(R.string.brClose), size = 36.dp, iconSize = 18.dp, tint = c.mute) { a.incoming = null }
    }
}

/** "שליחה למכשירים שלך" (כמו ב־Chrome) — בחירת מכשיר; שם הכרטיסייה קופצת, מאותו מקום */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SendSheet(a: BrowserActivity) {
    val c = LocalBr.current
    val devs = BrCloud.devices()
    ModalBottomSheet(onDismissRequest = { a.sendSheet = false }, containerColor = c.screen) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 16.dp)) {
            SheetHead(stringResource(R.string.brSendDevices), a.cur?.title, close = { a.sendSheet = false })
            if (devs.isEmpty()) Text(stringResource(R.string.brSendNone), Modifier.padding(horizontal = 24.dp, vertical = 12.dp), color = c.mute, fontSize = 15.sp)
            else Group {
                devs.forEachIndexed { i, d ->
                    if (i > 0) Sep()
                    IRow(d.name, ago(d.at), lead = { Tile(if (d.form == "t") BrIcons.CDesktop else BrIcons.Phone, c.icon) }, chevron = false) { a.sendTo(d.dev) }
                }
            }
        }
    }
}

private fun speedLabel(p: Int): String = if (p == 100) "1×" else ((p / 100.0).toString().trimEnd('0').trimEnd('.') + "×")

/** מהירות הסרטון — לדף הזה עכשיו, ונזכרת לאתר */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SpeedSheet(a: BrowserActivity) {
    val c = LocalBr.current
    val now = a.speedOf(a.cur)
    ModalBottomSheet(onDismissRequest = { a.speedSheet = false }, containerColor = c.screen) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            SheetHead(stringResource(R.string.brSpeed), a.cur?.let { BrStore.hostOf(it.url) }, close = { a.speedSheet = false })
            Group(footer = if (a.cur?.private == true) null else stringResource(R.string.brSpeedFoot)) {
                BrShield.SPEEDS.forEachIndexed { i, p ->
                    if (i > 0) Sep(16.dp)
                    IRow(if (p == 100) stringResource(R.string.brSpeedNormal) else speedLabel(p), chevron = false,
                        trailing = { if (p == now) Icon(BrIcons.Check, null, Modifier.size(22.dp), tint = c.tint) }) { a.pickSpeed(p) }
                }
            }
        }
    }
}

/** האתרים שיש להם הגדרה משלהם (הגנה כבויה, הרשאה שזכרנו, מהירות) */
@Composable
private fun SitesScreen(a: BrowserActivity) {
    val c = LocalBr.current
    @Suppress("UNUSED_VARIABLE") val rv = a.sitesRev
    var ask by remember { mutableStateOf(false) }
    val list = a.rules.values.sortedBy { it.host }
    SubPage(stringResource(R.string.brSites), back = stringResource(R.string.brPrivacy), onBack = { a.screen = BrowserActivity.Screen.PRIVACY }) {
        if (list.isEmpty()) item { Empty(R.string.brSitesNone) }
        else {
            item {
                Group(footer = stringResource(R.string.brSitesFoot)) {
                    list.forEachIndexed { i, r ->
                        if (i > 0) Sep()
                        IRow(r.host, siteSummary(r), lead = { Fav(a, "https://" + r.host, 29.dp, 7.dp) }, ltrSub = false) { a.siteHost = r.host; a.screen = BrowserActivity.Screen.SITE }
                    }
                }
            }
            item { Group { IRow(stringResource(R.string.brSitesReset), color = Color(0xFFFF3B30), chevron = false) { ask = true } } }
        }
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false }, text = { Text(stringResource(R.string.brSitesResetQ)) },
        confirmButton = { TextButton({ ask = false; a.forgetAllSites() }) { Text(stringResource(R.string.brDelete), color = Color(0xFFFF3B30)) } },
        dismissButton = { TextButton({ ask = false }) { Text(stringResource(R.string.brCancel)) } })
}

@Composable
private fun siteSummary(r: BrShield.SiteRule): String {
    val parts = buildList {
        if (!r.shield) add(stringResource(R.string.brShieldOffShort))
        if (r.cam != 0) add(stringResource(R.string.brCam) + " · " + stringResource(if (r.cam > 0) R.string.brAllowed else R.string.brBlocked))
        if (r.mic != 0) add(stringResource(R.string.brMic) + " · " + stringResource(if (r.mic > 0) R.string.brAllowed else R.string.brBlocked))
        if (r.loc != 0) add(stringResource(R.string.brLoc) + " · " + stringResource(if (r.loc > 0) R.string.brAllowed else R.string.brBlocked))
        if (r.speed != 100) add(speedLabel(r.speed))
    }
    return parts.joinToString("   ")
}

/** אתר אחד: ההגנה, המצלמה, המיקרופון, המיקום והמהירות — כל אחד לשנות או להחזיר ל"לשאול" */
@Composable
private fun SiteScreen(a: BrowserActivity) {
    val c = LocalBr.current
    @Suppress("UNUSED_VARIABLE") val rv = a.sitesRev
    val h = a.siteHost
    val r = a.rule(h)
    SubPage(h, back = stringResource(R.string.brSites), onBack = { a.screen = BrowserActivity.Screen.SITES }) {
        item {
            Group(footer = stringResource(R.string.brShieldSiteFoot)) {
                IRow(stringResource(R.string.brShieldSite), lead = { Tile(BrIcons.Shield, Color(0xFFFF9500)) }, chevron = false,
                    trailing = { IosSwitch(r.shield) { v -> a.setRule(h) { it.copy(shield = v) } } })
            }
        }
        item {
            Group(stringResource(R.string.brPerms)) {
                PermRow(stringResource(R.string.brCam), BrIcons.Camera, Color(0xFF34C759), r.cam) { v -> a.setRule(h) { it.copy(cam = v) } }
                Sep()
                PermRow(stringResource(R.string.brMic), BrIcons.Mic, Color(0xFFFF9500), r.mic) { v -> a.setRule(h) { it.copy(mic = v) } }
                Sep()
                PermRow(stringResource(R.string.brLoc), BrIcons.Place, Color(0xFF007AFF), r.loc) { v -> a.setRule(h) { it.copy(loc = v) } }
            }
        }
        item {
            Group {
                var open by remember { mutableStateOf(false) }
                Box {
                    IRow(stringResource(R.string.brSpeed), lead = { Tile(BrIcons.Speed, Color(0xFFFF2D55)) }, value = speedLabel(r.speed)) { open = true }
                    DropdownMenu(open, { open = false }, containerColor = c.card) {
                        BrShield.SPEEDS.forEach { p -> DropdownMenuItem({ Text(if (p == 100) stringResource(R.string.brSpeedNormal) else speedLabel(p)) },
                            { open = false; a.setRule(h) { it.copy(speed = p) } }, trailingIcon = { if (p == r.speed) Icon(BrIcons.Check, null, tint = c.tint) }) }
                    }
                }
            }
        }
        if (a.rules.containsKey(h)) item { Group { IRow(stringResource(R.string.brSiteForget), color = Color(0xFFFF3B30), chevron = false) { a.forgetSite(h) } } }
    }
}

/** הרשאה אחת: לשאול / מותר / חסום (כמו ב־Chrome) */
@Composable
private fun PermRow(title: String, icon: ImageVector, color: Color, v: Int, set: (Int) -> Unit) {
    val c = LocalBr.current
    var open by remember { mutableStateOf(false) }
    val label = @Composable { x: Int -> stringResource(when (x) { 1 -> R.string.brAllowed; -1 -> R.string.brBlocked; else -> R.string.brAskEach }) }
    Box {
        IRow(title, lead = { Tile(icon, color) }, value = label(v)) { open = true }
        DropdownMenu(open, { open = false }, containerColor = c.card) {
            listOf(0, 1, -1).forEach { x -> DropdownMenuItem({ Text(label(x)) }, { open = false; set(x) }, trailingIcon = { if (x == v) Icon(BrIcons.Check, null, tint = c.tint) }) }
        }
    }
}

/** וידאו: ניגון ברקע ובמסך נעול, תמונה בתוך תמונה */
@Composable
private fun VideoScreen(a: BrowserActivity) {
    SubPage(stringResource(R.string.brVideoTitle), back = stringResource(R.string.brSettings), onBack = { a.screen = BrowserActivity.Screen.SETTINGS }) {
        item {
            Group(footer = stringResource(R.string.brBgFoot)) {
                IRow(stringResource(R.string.brBgPlay), lead = { Tile(BrIcons.Headphones, Color(0xFFFF2D55)) }, chevron = false, trailing = { IosSwitch(a.bgPlay) { a.pickBgPlay(it) } })
            }
        }
        item {
            Group(footer = stringResource(R.string.brPipFoot)) {
                IRow(stringResource(R.string.brPip), lead = { Tile(BrIcons.Pip, Color(0xFF007AFF)) }, chevron = false, trailing = { IosSwitch(a.pip) { a.pickPip(it) } })
            }
        }
    }
}

/** הטאבים הפרטיים נעולים — מעל הדף, עד טביעת אצבע / קוד המסך */
@Composable
private fun LockScreen(a: BrowserActivity) {
    Box(Modifier.fillMaxSize().background(Priv.screen).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Box(Modifier.size(72.dp).clip(CircleShape).background(Priv.fill), contentAlignment = Alignment.Center) { Icon(BrIcons.Private, null, Modifier.size(38.dp), tint = Color.White) }
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.brLockTitle), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            Box(Modifier.height(48.dp).clip(RoundedCornerShape(24.dp)).background(Priv.tint).clickable { a.unlockPriv() }.padding(horizontal = 26.dp), contentAlignment = Alignment.Center) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(BrIcons.Finger, null, Modifier.size(22.dp), tint = Color.Black); Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.brUnlock), color = Color.Black, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(Modifier.height(14.dp))
            Text(stringResource(R.string.brLockOther), Modifier.clickable { a.leavePrivate() },
                color = Priv.tint, fontSize = 16.sp)
        }
    }
    LaunchedEffect(Unit) { a.unlockPriv() }
}
