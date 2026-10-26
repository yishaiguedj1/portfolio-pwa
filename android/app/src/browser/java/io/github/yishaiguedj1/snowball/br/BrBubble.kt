package io.github.yishaiguedj1.snowball.br

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/**
 * 26/10/2026 (בקשת המשתמש: "שהבועה מחוברת לדפדפן שלנו באופן מלא ועובדת ממש כמו הצייד", ואחר כך: "צמודה לחלק העליון
 * הימני של הנגן, ונעלמת ברגע שאין וידאו על המסך — כמו IDM"): בועת ההורדה בתוך Studio Browser. אותו עיגול אדום של
 * Studio Bubble, מחובר ישירות לצייד של הטאב (BrTab.found):
 *  · מופיעה רק כשיש נגן על המסך (BrVideo — הסקריפט מדווח את המלבן שלו) וגם הצייד מצא מה להוריד;
 *  · יושבת בפינה העליונה הימנית של הנגן וזזה איתו בגלילה; הנגן יצא מהמסך — נעלמת; במסך מלא — בפינה של המסך;
 *  · נגיעה = ⬇ בשורת הכתובת (ממצא אחד — מוריד; כמה — הרשימה), לחיצה ארוכה = תמיד הרשימה, מספר = כמה אפשרויות.
 * Studio Bubble עצמה לא מופיעה כאן (Studio Browser לא ברשימת הדפדפנים שלה) — אין שתי בועות.
 */
private val BubRed = Color(0xFFFF4656)
private const val HINTS = 3            // התווית ליד הבועה — בשלוש הפעמים הראשונות, כמו ב־Studio Bubble
private val SIZE = 46.dp
private val INSET = 8.dp

/** מתי מותר להציג (בלי קשר למיקום): הצייד מצא משהו, ואין מסך אחר מעל הדף */
private fun canShow(a: BrowserActivity, t: BrTab?) = t != null && a.bubble && t.foundN > 0 &&
    a.screen == BrowserActivity.Screen.PAGE && !a.editing && !a.menu && !a.pick && a.permAsk == null

/** בתוך אזור הדף (באותו מקום של ה־WebView): בפינה העליונה הימנית של הנגן שעל המסך */
@Composable
fun VideoBubble(a: BrowserActivity, t: BrTab) {
    val v = t.vid
    val show = canShow(a, t) && v != null && a.customView == null
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val d = LocalDensity.current
        val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
        val size = with(d) { SIZE.toPx() }; val m = with(d) { INSET.toPx() }
        // המיקום האחרון — כדי שהבועה תיעלם במקום שבו הייתה, לא תקפוץ לפינה
        val last = remember { IntArray(2) }
        var fits = false
        if (v != null) {
            val left = v[0] * w; val top = v[1] * h; val right = (v[0] + v[2]) * w; val bottom = (v[1] + v[3]) * h
            val x = (right - size - m).coerceIn(m, w - size - m)
            val y = maxOf(top, 0f) + m                     // החלק העליון של הנגן — או של המסך, כשהוא גלול למעלה
            fits = y + size + m <= minOf(bottom, h) && right - left >= size + 2 * m
            if (fits) { last[0] = x.roundToInt(); last[1] = y.roundToInt() }
        }
        Bubble(a, t, show && fits, IntOffset(last[0], last[1]))
    }
}

/** סרטון במסך מלא (WebChromeClient.onShowCustomView): בפינה העליונה הימנית של המסך */
@Composable
fun FullBubble(a: BrowserActivity) {
    val t = a.cur
    BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding()) {
        val d = LocalDensity.current
        val x = constraints.maxWidth - with(d) { (SIZE + INSET * 2).toPx() }
        Bubble(a, t, a.customView != null && canShow(a, t), IntOffset(x.roundToInt(), with(d) { (INSET * 2).toPx() }.roundToInt()))
    }
}

@Composable
private fun Bubble(a: BrowserActivity, t: BrTab?, show: Boolean, pos: IntOffset) {
    val vis by animateFloatAsState(if (show) 1f else 0f, tween(if (show) 220 else 140), label = "bub")
    if (!show && vis == 0f) return
    val live by rememberUpdatedState(show)
    val n = t?.foundN ?: 0
    val d = LocalDensity.current
    val hap = LocalHapticFeedback.current
    var hint by remember { mutableStateOf(false) }
    var hw by remember { mutableIntStateOf(0) }
    var hh by remember { mutableIntStateOf(0) }
    LaunchedEffect(show) {
        if (show && a.prefs.bubHints < HINTS) { a.prefs.bubHints = a.prefs.bubHints + 1; hint = true; delay(2500); hint = false }
    }
    val label = stringResource(R.string.brBubble)
    val more = stringResource(R.string.brVideos)
    val size = with(d) { SIZE.toPx() }
    Box(
        Modifier.absoluteOffset { pos }
            .size(SIZE)
            .graphicsLayer { val s = 0.6f + 0.4f * vis; scaleX = s; scaleY = s; alpha = vis }
            .shadow(6.dp, CircleShape)
            .clip(CircleShape)
            .background(BubRed)
            .semantics {
                role = Role.Button; contentDescription = label
                onClick { a.bubbleTap(); true }
                onLongClick(more) { a.pick = true; true }
            }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { if (live) { hap.performHapticFeedback(HapticFeedbackType.TextHandleMove); hint = false; a.bubbleTap() } },
                    onLongPress = { if (live) { hap.performHapticFeedback(HapticFeedbackType.LongPress); hint = false; a.pick = true } },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val s = this.size.width; val r = s / 2f
            val ring = s * 0.03f
            drawCircle(Color(0x40FFFFFF), radius = r - ring, style = Stroke(ring))
            val p = Path().apply {
                moveTo(r, s * 0.27f); lineTo(r, s * 0.60f)                                       // הקו
                moveTo(s * 0.35f, s * 0.46f); lineTo(r, s * 0.61f); lineTo(s * 0.65f, s * 0.46f)  // ראש החץ
                moveTo(s * 0.32f, s * 0.73f); lineTo(s * 0.68f, s * 0.73f)                       // המגש
            }
            drawPath(p, Color.White, style = Stroke(s * 0.085f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
    // כמה אפשרויות נמצאו (מעל 1) — עיגול לבן קטן בפינה
    if (n > 1) Box(
        Modifier.absoluteOffset { IntOffset(pos.x + (size - with(d) { 14.dp.toPx() }).roundToInt(), pos.y - with(d) { 4.dp.toPx() }.roundToInt()) }
            .size(18.dp).graphicsLayer { alpha = vis }.shadow(2.dp, CircleShape).clip(CircleShape).background(Color.White),
        contentAlignment = Alignment.Center,
    ) { Text(if (n > 9) "9+" else "$n", color = BubRed, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
    // התווית — משמאל לבועה, בתוך הנגן
    if (hint) Text(
        label, color = Color.White, fontSize = 14.sp,
        modifier = Modifier.onSizeChanged { hw = it.width; hh = it.height }
            .absoluteOffset { IntOffset(pos.x - hw - with(d) { 6.dp.toPx() }.roundToInt(), pos.y + ((size - hh) / 2).roundToInt()) }
            .graphicsLayer { alpha = if (hw == 0) 0f else vis }
            .shadow(4.dp, RoundedCornerShape(999.dp)).clip(RoundedCornerShape(999.dp)).background(Color(0xE61C1C1E))
            .padding(horizontal = 12.dp, vertical = 7.dp),
    )
}
