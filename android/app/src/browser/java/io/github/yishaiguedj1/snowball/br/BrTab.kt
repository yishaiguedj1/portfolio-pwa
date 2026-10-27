package io.github.yishaiguedj1.snowball.br

import android.graphics.Bitmap
import android.os.Bundle
import android.webkit.WebView
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.github.yishaiguedj1.snowball.HuntMedia
import io.github.yishaiguedj1.snowball.VideoUrl

/**
 * טאב אחד. ה־WebView נוצר רק כשהטאב נפתח, ונהרס כשיש יותר מדי טאבים חיים (BrowserActivity.LIVE_MAX) — אז נשמר
 * המצב (saveState) והוא חוזר בדיוק לאותו מקום כשבוחרים בו שוב. כל טאב — צייד משלו (HuntMedia.Found).
 */
class BrTab(val id: Long, url: String, title: String, val private: Boolean, var fromApp: Boolean = false) {
    var url by mutableStateOf(url)
    var title by mutableStateOf(title)
    var progress by mutableIntStateOf(0)
    var foundN by mutableIntStateOf(0)
    var canBack by mutableStateOf(false)
    var canFwd by mutableStateOf(false)
    var desktop by mutableStateOf(false)
    var icon by mutableStateOf<Bitmap?>(null)
    var thumb by mutableStateOf<Bitmap?>(null)
    /** הנגן שעל המסך (BrVideo): [x, y, רוחב, גובה] כחלקים מהדף הנראה; null = אין — הבועה נעלמת */
    var vid by mutableStateOf<FloatArray?>(null)
    /** שלב 3: כמה בקשות של פרסום/מעקב נחסמו בדף הזה, ואם משהו מתנגן בו עכשיו (BrShield.PLAY_JS) */
    var blocked by mutableIntStateOf(0)
    @Volatile var playing = false
    /** "חזור" כמו ב־Chrome (27/10/2026): הכרטיסייה שממנה נפתחה מקישור (‎-1 = אין) — כשאין לאן לחזור, נסגרת וחוזרים אליה;
     *  ntpBack = הדף הראשון נפתח מהכרטיסייה החדשה (שם היא רשומה בהיסטוריה) — "חזור" מהדף הראשון חוזר אליה; ntpFwd = ומשם "קדימה" */
    var parent = -1L
    var ntpBack by mutableStateOf(false)
    var ntpFwd by mutableStateOf<String?>(null)

    var web: WebView? = null
    var state: Bundle? = null
    var used = 0L

    val found = HuntMedia.Found()
    val headSeen = HashSet<String>()
    @Volatile var page = ""
    /** נפתח מהבועה ב־Chrome ("לצוד בדפדפן שלנו"): עד מתי לפתוח לבד את רשימת ההורדה כשנמצא משהו */
    var autoPick = 0L

    val isNtp get() = !url.startsWith("http") && web == null && state == null
    fun pageIsVideo() = VideoUrl.classify(page) is VideoUrl.Hit.Video
    fun recount() { foundN = found.size + (if (pageIsVideo()) 1 else 0) }
}
