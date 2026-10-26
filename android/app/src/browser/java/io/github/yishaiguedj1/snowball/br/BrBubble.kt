package io.github.yishaiguedj1.snowball.br

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 26/10/2026 (בקשת המשתמש: "שהבועה מחוברת לדפדפן שלנו באופן מלא ועובדת ממש כמו הצייד"): בועת ההורדה בתוך
 * Studio Browser — אותו עיגול אדום, אותן מחוות ואותו מקום של Studio Bubble (GrabService), אבל מחוברת ישירות לצייד של
 * הטאב (BrTab.found) ולא לשורת הכתובת: מופיעה כשהצייד מצא משהו בדף (גם באתר שאף רשימה לא מכירה, ובמסך מלא),
 * ונגיעה בה = ⬇ בשורת הכתובת (ממצא אחד — מוריד; כמה — הרשימה). לחיצה ארוכה = תמיד הרשימה. גרירה = לצד השני /
 * לגובה אחר (נשמר); גרירה לתחתית = לא עכשיו לדף הזה. מספר על העיגול = כמה אפשרויות נמצאו.
 * Studio Bubble עצמה לא מופיעה כאן (Studio Browser לא ברשימת הדפדפנים שלה) — אין שתי בועות.
 */
private val BubRed = Color(0xFFFF4656)
private const val HINTS = 3            // התווית ליד הבועה — בשלוש הפעמים הראשונות, כמו ב־Studio Bubble

@Composable
fun HuntBubble(a: BrowserActivity) {
    val t = a.cur
    val n = t?.foundN ?: 0
    val show = t != null && a.bubble && n > 0 && a.screen == BrowserActivity.Screen.PAGE &&
        !a.editing && !a.menu && !a.pick && a.permAsk == null && t.page !in a.bubbleGone
    val vis by animateFloatAsState(if (show) 1f else 0f, tween(if (show) 260 else 150), label = "bub")
    if (!show && vis == 0f) return
    val live by rememberUpdatedState(show)
    BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
        val d = LocalDensity.current
        val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
        val size = with(d) { 54.dp.toPx() }; val m = with(d) { 8.dp.toPx() }
        val top = with(d) { 24.dp.toPx() }; val bottom = max(top, h - size - with(d) { 90.dp.toPx() })
        var right by remember { mutableStateOf(a.prefs.bubRight) }
        var y by remember(h) { mutableFloatStateOf((a.prefs.bubY * h).coerceIn(top, bottom)) }
        var fy by remember { mutableFloatStateOf(0f) }        // האצבע בלי הגבולות — לזיהוי "לתחתית"
        var dx by remember { mutableFloatStateOf(0f) }
        var low by remember { mutableStateOf(false) }
        var hint by remember { mutableStateOf(false) }
        var hw by remember { mutableIntStateOf(0) }
        var hh by remember { mutableIntStateOf(0) }
        val scope = rememberCoroutineScope()
        val hap = LocalHapticFeedback.current
        val base = if (right) w - size - m else m

        LaunchedEffect(show) {
            if (show && a.prefs.bubHints < HINTS) { a.prefs.bubHints = a.prefs.bubHints + 1; hint = true; delay(2500); hint = false }
        }

        val label = stringResource(R.string.brBubble)
        val more = stringResource(R.string.brVideos)
        Box(
            Modifier.absoluteOffset { IntOffset((base + dx).roundToInt(), y.roundToInt()) }
                .size(54.dp)
                .graphicsLayer { val s = 0.6f + 0.4f * vis; scaleX = s; scaleY = s; alpha = vis * (if (low) 0.45f else 1f) }
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
                }
                .pointerInput(w, h) {
                    detectDragGestures(
                        onDragStart = { hint = false; fy = y; low = false },
                        onDrag = { ch, o ->
                            ch.consume()
                            dx += o.x; fy += o.y; y = fy.coerceIn(top, bottom)
                            val nowLow = fy + size / 2 > h * 0.86f
                            if (nowLow != low) { low = nowLow; if (low) hap.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
                        },
                        onDragCancel = { low = false; scope.launch { animate(dx, 0f, animationSpec = tween(220)) { v, _ -> dx = v } } },
                        onDragEnd = {
                            if (low) {
                                low = false; dx = 0f; y = (a.prefs.bubY * h).coerceIn(top, bottom)
                                a.bubbleDismiss()
                            } else {
                                // נצמדת לצד הקרוב; מעבר צד מתחיל מאיפה שהאצבע עזבה
                                val nowRight = base + dx + size / 2 > w / 2
                                if (nowRight != right) { dx += base - (if (nowRight) w - size - m else m); right = nowRight }
                                a.prefs.bubRight = right; a.prefs.bubY = y / h
                                scope.launch { animate(dx, 0f, animationSpec = tween(220)) { v, _ -> dx = v } }
                            }
                        },
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
            Modifier.absoluteOffset { IntOffset((base + dx + size - with(d) { 16.dp.toPx() }).roundToInt(), (y - with(d) { 2.dp.toPx() }).roundToInt()) }
                .size(20.dp).graphicsLayer { alpha = vis }.shadow(2.dp, CircleShape).clip(CircleShape).background(Color.White),
            contentAlignment = Alignment.Center,
        ) { Text(if (n > 9) "9+" else "$n", color = BubRed, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
        // התווית — בצד הפנימי של הבועה
        if (hint) Text(
            label, color = Color.White, fontSize = 14.sp,
            modifier = Modifier.onSizeChanged { hw = it.width; hh = it.height }
                .absoluteOffset { IntOffset((if (right) base - hw - m else base + size + m).roundToInt(), (y + (size - hh) / 2).roundToInt()) }
                .graphicsLayer { alpha = if (hw == 0) 0f else vis }
                .shadow(4.dp, RoundedCornerShape(999.dp)).clip(RoundedCornerShape(999.dp)).background(Color(0xE61C1C1E))
                .padding(horizontal = 12.dp, vertical = 7.dp),
        )
    }
}
