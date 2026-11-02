package io.github.yishaiguedj1.snowball.dm

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * Studio DM בזכוכית של Studio (01/11/2026, בקשת המשתמש: "שירגיש המשך של אותה אפליקציה מבחינה עיצובית"), לפי ת־עיצוב.
 * אותם ערכים של האתר — styles.css (‏--gl-*, ‏data-app="studio") ו־glass-btn.css — מתורגמים ל־Compose:
 *  · הרקע: בסיס ‎#F2F2F7 / ‎#000 ושלוש הילות — האדום של Studio למעלה בסוף, כתום בצד, סגול למטה (‏--gl-ambient);
 *  · כרטיס: הבסיס ב־58% (כהה 55%) עם קו אור פנימי וקו שיער (‏--gl-card / --gl-card-sh);
 *  · כפתור משני: לבן חצי־שקוף בשיפוע (‏--gb-body), צבעוני: האדום ב־84% (כהה 80%) עם ברק עליון (סעיף 3 ב־glass-btn.css);
 *  · גיליון/חלון: הבסיס ב־74% (‏--gl-panel) — והתוכן שמאחור מטושטש (‏--gl-veil, ‏Modifier.blur ב־DmApp).
 * צבע חדש / משטח חדש — דרך DmG, לא ערך מקומי.
 */
val StRed = Color(0xFFFF4656)
val StGreen = Color(0xFF30D158)

data class DmG(
    val dark: Boolean,
    val bg: Color, val base: Color, val fg: Color, val mute: Color,
    val card: Color, val panel: Color, val dialog: Color, val fill: Color, val hair: Color,
    val orange: Color, val purple: Color, val teal: Color, val indigo: Color, val veil: Color,
)

val GlassLight = DmG(false, Color(0xFFF2F2F7), Color.White, Color.Black, Color(0x993C3C43),
    Color.White.copy(alpha = 0.58f), Color.White.copy(alpha = 0.80f), Color.White.copy(alpha = 0.94f), Color(0x1F767680), Color(0x14000000),
    Color(0xFFFF9500), Color(0xFFAF52DE), Color(0xFF5AC8FA), Color(0xFF5856D6), Color(0x47F2F2F7))
val GlassDark = DmG(true, Color.Black, Color(0xFF1C1C1E), Color.White, Color(0x99EBEBF5),
    Color(0xFF1C1C1E).copy(alpha = 0.55f), Color(0xFF1C1C1E).copy(alpha = 0.80f), Color(0xFF1C1C1E).copy(alpha = 0.95f), Color(0x3D767680), Color(0x1AFFFFFF),
    Color(0xFFFF9F0A), Color(0xFFBF5AF2), Color(0xFF64D2FF), Color(0xFF5E5CE6), Color(0x52000000))

val LocalDmG = staticCompositionLocalOf { GlassLight }

/** הרקע של Studio מאחורי הזכוכית (‏--gl-ambient) */
fun Modifier.dmAmbient(g: DmG): Modifier = drawBehind {
    val w = size.width; val h = size.height
    drawRect(g.bg)
    val r1 = if (g.dark) 0.36f else 0.32f; val r2 = if (g.dark) 0.26f else 0.24f; val r3 = if (g.dark) 0.26f else 0.20f
    fun glow(x: Float, y: Float, r: Float, c: Color) = drawRect(Brush.radialGradient(listOf(c, c.copy(alpha = 0f)), Offset(x, y), r))
    drawRect(Brush.verticalGradient(listOf(StRed.copy(alpha = if (g.dark) 0.12f else 0.08f), (if (g.dark) g.purple else StRed).copy(alpha = if (g.dark) 0.08f else 0.05f))))
    glow(w * 0.96f, h * 0.02f, maxOf(w * 0.95f, h * 0.42f), StRed.copy(alpha = r1))
    glow(w * 0.02f, h * 0.46f, maxOf(w * 0.85f, h * 0.36f), g.orange.copy(alpha = r2))
    glow(w * 0.86f, h * 0.98f, maxOf(w * 0.95f, h * 0.42f), g.purple.copy(alpha = r3))
}

/** כרטיס זכוכית (‏--gl-card): מילוי חצי־שקוף, קו אור פנימי בשיפוע וקו שיער */
// בלי צל גובה: באנדרואיד הצל נראה דרך משטח חצי־שקוף ומאפיר אותו — את ההפרדה נותנים קו השיער וקו האור, כמו ב־--gl-card
fun Modifier.glassCard(g: DmG, shape: Shape, fill: Color = g.card): Modifier = this
    .clip(shape).background(fill)
    .border(0.5.dp, g.hair, shape)
    .padding(0.5.dp)
    .border(1.dp, Brush.linearGradient(if (g.dark) listOf(Color.White.copy(alpha = 0.16f), Color.White.copy(alpha = 0.04f))
        else listOf(Color.White.copy(alpha = 0.9f), Color.White.copy(alpha = 0.35f))), shape)

/** כפתור זכוכית משני (‏--gb-body / --gb-sh) */
fun Modifier.glassBtn(g: DmG, shape: Shape): Modifier = this
    .clip(shape)
    .background(Brush.verticalGradient(if (g.dark) listOf(Color.White.copy(alpha = 0.17f), Color.White.copy(alpha = 0.08f))
        else listOf(Color.White.copy(alpha = 0.72f), Color.White.copy(alpha = 0.48f))))
    .border(0.5.dp, if (g.dark) Color.White.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.85f), shape)

/** זכוכית צבעונית — ראשי / נבחר (סעיף 3 ב־glass-btn.css): הצבע ב־84%/80% וברק בחצי העליון */
fun Modifier.toneGlass(g: DmG, shape: Shape, tone: Color = StRed): Modifier = this
    .shadow(5.dp, shape, ambientColor = tone, spotColor = tone)
    .clip(shape)
    .background(tone.copy(alpha = if (g.dark) 0.80f else 0.84f))
    .background(Brush.verticalGradient(0f to Color.White.copy(alpha = 0.28f), 0.5f to Color.White.copy(alpha = 0.06f), 0.56f to Color.Transparent))
    .border(0.5.dp, Color.White.copy(alpha = 0.42f), shape)

private val Pill = RoundedCornerShape(50)

/** כפתור — ראשי (אדום) או משני (זכוכית). אותה חתימה כמו Button של Material, כדי להחליף אחד לאחד */
@Composable
private fun GBtn(onClick: () -> Unit, modifier: Modifier, enabled: Boolean, primary: Boolean, tone: Color, content: @Composable RowScope.() -> Unit) {
    val g = LocalDmG.current
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    Row(modifier.defaultMinSize(minHeight = 46.dp).scale(if (pressed) 0.97f else 1f).alpha(if (enabled) 1f else 0.45f)
        .then(if (primary) Modifier.toneGlass(g, Pill, tone) else Modifier.glassBtn(g, Pill))
        .clickable(src, null, enabled = enabled, onClick = onClick).padding(PaddingValues(horizontal = 20.dp, vertical = 10.dp)),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        CompositionLocalProvider(LocalContentColor provides if (primary) Color.White else g.fg) {
            ProvideTextStyle(TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp)) { content() }
        }
    }
}

@Composable
fun GButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, tone: Color = StRed, content: @Composable RowScope.() -> Unit) =
    GBtn(onClick, modifier, enabled, true, tone, content)

@Composable
fun GTonal(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) =
    GBtn(onClick, modifier, enabled, false, StRed, content)

/** כפתור עגול בזכוכית (סרגל עליון); tone = אדום מלא (הוספה) */
@Composable
fun GRound(icon: ImageVector, desc: String?, tone: Boolean = false, onClick: () -> Unit) {
    val g = LocalDmG.current
    Box(Modifier.padding(horizontal = 4.dp).size(42.dp).then(if (tone) Modifier.toneGlass(g, CircleShape) else Modifier.glassBtn(g, CircleShape))
        .clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, desc, Modifier.size(22.dp), tint = if (tone) Color.White else g.fg)
    }
}

/** מתג — הירוק של המערכת כשדלוק */
@Composable
fun GSwitch(checked: Boolean, onCheckedChange: ((Boolean) -> Unit)?, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val g = LocalDmG.current
    Switch(checked, onCheckedChange, modifier, enabled = enabled, colors = SwitchDefaults.colors(
        checkedTrackColor = StGreen, checkedThumbColor = Color.White, checkedBorderColor = Color.Transparent,
        uncheckedTrackColor = g.fill, uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
}

/** צ'יפ: נבחר = זכוכית אדומה (כמו "צ'יפ נבחר" באתר), אחר — זכוכית משנית */
@Composable
fun GChip(selected: Boolean, onClick: () -> Unit, label: @Composable () -> Unit, modifier: Modifier = Modifier) {
    val g = LocalDmG.current
    Box(modifier.defaultMinSize(minHeight = 38.dp).padding(vertical = 3.dp)
        .then(if (selected) Modifier.toneGlass(g, Pill) else Modifier.glassBtn(g, Pill))
        .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        CompositionLocalProvider(LocalContentColor provides if (selected) Color.White else g.fg) {
            ProvideTextStyle(TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp)) { label() }
        }
    }
}

/** שדה טקסט: מילוי זכוכית בלי מסגרת, אדום בפוקוס */
@Composable
fun GField(
    value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier, singleLine: Boolean = false, maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    label: (@Composable () -> Unit)? = null, placeholder: (@Composable () -> Unit)? = null, leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null, shape: Shape = RoundedCornerShape(16.dp),
) {
    val g = LocalDmG.current
    OutlinedTextField(value, onValueChange, modifier, singleLine = singleLine, maxLines = maxLines, label = label, placeholder = placeholder,
        leadingIcon = leadingIcon, trailingIcon = trailingIcon, shape = shape,
        colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = g.fill, unfocusedContainerColor = g.fill,
            focusedBorderColor = StRed.copy(alpha = 0.7f), unfocusedBorderColor = Color.Transparent, cursorColor = StRed, focusedLabelColor = StRed))
}

/** אריח סמל של סוג הקובץ — גוון שקוף בצבע הסוג (וידאו אדום, קול סגול, ארכיון כתום…) */
fun catTone(g: DmG, c: DmName.Cat): Color = when (c) {
    DmName.Cat.VIDEO -> StRed; DmName.Cat.AUDIO -> g.purple; DmName.Cat.ARCHIVE -> g.orange; DmName.Cat.DOC -> g.teal
    DmName.Cat.IMAGE -> StGreen; DmName.Cat.APK -> g.indigo; DmName.Cat.OTHER -> g.mute
}

fun Modifier.toneTile(c: Color, shape: Shape): Modifier = this.clip(shape)
    .background(Brush.linearGradient(listOf(c.copy(alpha = 0.30f), c.copy(alpha = 0.12f))))

/** המעגן התחתון של Studio: בועות זכוכית עגולות עם כיתוב; הנבחרת — זכוכית אדומה עם סמל לבן */
@Composable
fun GlassDock(items: List<Pair<ImageVector, String>>, selected: Int, modifier: Modifier = Modifier, onPick: (Int) -> Unit) {
    val g = LocalDmG.current
    Box(modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, g.bg.copy(alpha = 0.55f), g.bg.copy(alpha = 0.8f))))
        .navigationBarsPadding().padding(top = 14.dp, bottom = 8.dp)) {
        Row(Modifier.align(Alignment.Center), horizontalArrangement = Arrangement.spacedBy(30.dp)) {
            items.forEachIndexed { i, (ic, label) ->
                val on = i == selected
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable(remember { MutableInteractionSource() }, null) { onPick(i) }) {
                    Box(Modifier.size(62.dp).then(if (on) Modifier.toneGlass(g, CircleShape) else Modifier.glassBtn(g, CircleShape)), contentAlignment = Alignment.Center) {
                        Icon(ic, label, Modifier.size(28.dp), tint = if (on) Color.White else g.fg)
                    }
                    Text(label, Modifier.padding(top = 5.dp), fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = g.fg)
                }
            }
        }
    }
}
