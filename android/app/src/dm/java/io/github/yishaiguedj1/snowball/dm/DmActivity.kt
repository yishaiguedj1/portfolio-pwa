package io.github.yishaiguedj1.snowball.dm

import android.Manifest
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.VideoUrl
import org.json.JSONObject

/**
 * Studio DM — המסך היחיד (Compose). קלט מכל הכיוונים מגיע לאותו גיליון הוספה: שיתוף, "פתח באמצעות", הלוח, הדבקה.
 * בדיקת קישור: אתר וידאו מוכר → yt-dlp בטלפון; אחרת GET עם Range — קובץ → המנוע שלנו, דף (HTML) → yt-dlp (מחלץ כללי).
 */
class DmActivity : ComponentActivity() {
    val sheetUrl = mutableStateOf<String?>(null)
    val sheetRef = mutableStateOf("")
    val clipUrl = mutableStateOf("")

    override fun attachBaseContext(newBase: android.content.Context) { super.attachBaseContext(DmLang.wrap(newBase)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        DmStore.init(this)
        DmEngine.pump(this)
        handle(intent)
        setContent { DmApp(this) }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }

    private fun handle(i: Intent?) {
        i ?: return
        val u = when (i.action) {
            Intent.ACTION_SEND -> DmLink.first(i.getStringExtra(Intent.EXTRA_TEXT))
            Intent.ACTION_VIEW -> i.dataString?.takeIf { it.startsWith("http") } ?: ""
            else -> ""
        }
        if (u.isNotEmpty()) {
            sheetRef.value = DmLink.first(i.getStringExtra("snb_ref") ?: i.getStringExtra("extra_referer"))
            sheetUrl.value = u
        }
    }

    /** הלוח — רק כשהאפליקציה בפוקוס (אנדרואיד 10+), ורק קישור שעוד לא הוצע ולא ברשימה */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) return
        val cm = getSystemService(ClipboardManager::class.java) ?: return
        val txt = runCatching { cm.primaryClip?.getItemAt(0)?.coerceToText(this)?.toString() }.getOrNull()
        val u = DmLink.first(txt)
        val pr = DmPrefs(this)
        clipUrl.value = if (u.isNotEmpty() && u != pr.lastClip && !DmStore.has(u)) u else ""
    }

    fun dismissClip() { DmPrefs(this).lastClip = clipUrl.value; clipUrl.value = "" }

    fun askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }

    fun open(t: DmTask) {
        val i = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(t.uri), DmMedia.mimeFor(t.name, t.mime))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching { startActivity(i) }
    }

    fun share(t: DmTask) {
        val i = Intent(Intent.ACTION_SEND).setType(DmMedia.mimeFor(t.name, t.mime)).putExtra(Intent.EXTRA_STREAM, Uri.parse(t.uri))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching { startActivity(Intent.createChooser(i, null)) }
    }

    fun shareText(s: String) {
        runCatching { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, s), null)) }
    }

    fun batterySettings() {
        runCatching { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
    }

    /** תוצאת הבדיקה של קישור — לגיליון ההוספה */
    sealed class Found {
        data class File(val url: String, val name: String, val size: Long, val mime: String, val ranges: Boolean) : Found()
        data class Video(val url: String, val info: JSONObject) : Found()
        data class Fail(val code: String) : Found()
    }

    /** רץ בתהליכון (לא בממשק) */
    fun probe(url: String, ref: String): Found {
        val known = VideoUrl.classify(url).let { it is VideoUrl.Hit.Video && DmName.cat(DmName.fromUrl(url), "") == DmName.Cat.OTHER }
        if (!known) {
            try {
                val p = DmFetch.probeRetry(url, ref)
                if (p.mime != "text/html" && p.mime != "application/xhtml+xml")
                    // נשמרת הכתובת שהמשתמש נתן, לא זו שאחרי ההפניה: קישור הורדה (GitHub, S3…) מפנה לכתובת חתומה שפגה תוך דקות,
                    // ו"המשך" מחר היה נכשל ב־expired. כל חיבור עוקב אחרי ההפניה מחדש; If-Range (ETag) שומר שלא מערבבים קבצים
                    return Found.File(url, DmName.pick(p.disposition, p.finalUrl, p.mime), p.total, p.mime, p.ranges)
            } catch (e: Throwable) {
                if (e is DmHttpError && DmRetry.http(e.status).act == DmRetry.Act.FATAL) return Found.Fail(DmRetry.http(e.status).code)
            }
        }
        return try { Found.Video(url, DlEngine.probe(this, url, ref, DlEngine.cookiesFor(this, url, ref))) }
        catch (e: IllegalArgumentException) { Found.Fail(e.message ?: "fail") }
        catch (e: Throwable) { Found.Fail("fail") }
    }

    fun addFile(f: Found.File, name: String, ref: String) {
        val t = DmTask(DmStore.newId(), f.url, ref, DmKind.HTTP).apply {
            this.name = DmName.clean(name).ifEmpty { f.name }; mime = f.mime; total = f.size; ranges = f.ranges
            created = System.currentTimeMillis()
        }
        DmStore.add(t); askNotifications(); DmEngine.pump(this)
    }

    fun addVideo(v: Found.Video, q: JSONObject?, audio: Boolean, ref: String) {
        val t = DmTask(DmStore.newId(), v.url, ref, DmKind.YTDL).apply {
            title = v.info.optString("t"); name = title
            audioOnly = audio
            if (q != null && !audio) { vf = q.optString("v"); af = q.optString("a"); height = q.optInt("h"); total = q.optLong("sz", -1) }
            if (audio) total = v.info.optJSONObject("ao")?.optLong("sz", -1) ?: -1
            created = System.currentTimeMillis()
        }
        DmStore.add(t); askNotifications(); DmEngine.pump(this)
    }
}
