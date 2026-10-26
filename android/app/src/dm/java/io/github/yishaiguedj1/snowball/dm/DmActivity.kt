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
import io.github.yishaiguedj1.snowball.AppRoute
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.SiteList
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
    /** מהדפדפן של DM: אותו User-Agent, עוגיות מהדפדפן, ו"רענון קישור" למשימה קיימת (מזהה) */
    var sheetUa = ""
    /** כותרת הסרטון מהדף בדפדפן (רק ממסירה) — גוברת על playlist של yt-dlp */
    var sheetTitle = ""
    var sheetCk = false
    val refreshId = mutableStateOf("")

    override fun attachBaseContext(newBase: android.content.Context) { super.attachBaseContext(DmLang.wrap(newBase)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        DmStore.init(this)
        DmEngine.pump(this)
        handle(intent)
        setContent { DmApp(this) }
    }

    override fun onResume() {
        super.onResume(); visible = true
        // חזרה מ"התקנת אפליקציות לא מוכרות": אושר — ממשיכים להתקנה; לא אושר — לא שואלים שוב
        apkWait?.let { t -> apkWait = null; if (canInstall()) install(t) }
    }
    override fun onPause() { visible = false; super.onPause() }

    companion object {
        @Volatile var visible = false
        const val FULL_BROWSER = "io.github.yishaiguedj1.snowball.br.BrowserActivity"
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }

    /** מהאריח: לפתוח את גיליון ההוספה עם הקישור שבלוח — כשהחלון יקבל פוקוס (רק אז מותר לקרוא את הלוח) */
    private var clipOnFocus = false

    private fun handle(i: Intent?) {
        i ?: return
        if (i.action == DmTile.ACTION_CLIP) { clipOnFocus = true; return }
        val u = when (i.action) {
            Intent.ACTION_SEND -> DmLink.first(i.getStringExtra(Intent.EXTRA_TEXT))
            Intent.ACTION_VIEW -> i.dataString?.takeIf { it.startsWith("http") } ?: ""
            else -> ""
        }
        // 26/10/2026: הבועה ב־Chrome באתר שכבר הורדת ממנו דרך הדפדפן — הדף עצמו לדפדפן של DM (שם ההתחברות), לא להורדה.
        // רק פתיחת כתובת בדפדפן שלנו — בלי עוגיות, User-Agent או רענון מה־extras
        if (u.isNotEmpty() && i.action == Intent.ACTION_SEND && i.getBooleanExtra(AppRoute.EXTRA_BR, false)) { openBrowser(u); return }
        if (u.isNotEmpty()) {
            sheetRef.value = DmLink.first(i.getStringExtra("snb_ref") ?: i.getStringExtra("extra_referer"))
            // עוגיות, User-Agent ורענון — רק ממסירה בתוך התהליך (DmBrowser.take עם אסימון חד־פעמי). אפליקציה אחרת
            // יכולה לשלוח לנו intent עם כל extra, ואסור שתגרום ל־DM לשלוח את העוגיות של הדפדפן לכתובת שהיא בחרה
            val h = DmBrowser.take(i.getStringExtra(DmBrowser.EXTRA_TOKEN), u)
            sheetCk = h?.ck ?: false
            sheetUa = h?.ua ?: ""
            sheetTitle = h?.title ?: ""
            refreshId.value = h?.refresh ?: ""
            if (h != null) sheetRef.value = h.ref
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
        if (clipOnFocus) {
            clipOnFocus = false
            sheetRef.value = ""; sheetCk = false; sheetUa = ""; sheetTitle = ""; refreshId.value = ""
            sheetUrl.value = u   // ריק = הגיליון פתוח להדבקה
            clipUrl.value = ""
            return
        }
        clipUrl.value = if (u.isNotEmpty() && u != pr.lastClip && !DmStore.has(u)) u else ""
    }

    fun dismissClip() { DmPrefs(this).lastClip = clipUrl.value; clipUrl.value = "" }

    fun askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }

    fun open(t: DmTask) {
        // סרטון וקול — בנגן שלנו (DmPlayer); APK — התקנה; כל השאר — באפליקציה שמתאימה לסוג
        val cat = if (t.kind == DmKind.YTDL) (if (t.audioOnly) DmName.Cat.AUDIO else DmName.Cat.VIDEO) else DmName.cat(t.name, t.mime)
        if (cat == DmName.Cat.APK && t.uri.startsWith("content://")) { install(t); return }
        if ((cat == DmName.Cat.VIDEO || cat == DmName.Cat.AUDIO) && t.uri.startsWith("content://")) {
            if (runCatching { startActivity(Intent(this, DmPlayer::class.java).setData(Uri.parse(t.uri)).putExtra(DmPlayer.EXTRA_TITLE, t.title.ifEmpty { t.name })) }.isSuccess) return
        }
        openWith(t)
    }

    /* 26/10/2026 (בקשת המשתמש: "לא מצליח להתקין APK שירד דרך DM"): עד היום DM לא ביקש את ההרשאה להתקין, ולכן
       מתקין החבילות של אנדרואיד סירב בלי אפשרות לאשר. עכשיו (REQUEST_INSTALL_PACKAGES במניפסט): פעם ראשונה — מסך
       ההגדרה "התקנת אפליקציות לא מוכרות" של DM, ובחזרה ההתקנה ממשיכה לבד. מתקין החבילות עצמו מבקש אישור על כל
       התקנה — DM לא מתקין שום דבר בלי שתאשר. הסוג תמיד APK (שרת ששולח octet-stream — המתקין לא היה מזהה). */
    private var apkWait: DmTask? = null

    private fun canInstall() = Build.VERSION.SDK_INT < 26 || packageManager.canRequestPackageInstalls()

    fun install(t: DmTask) {
        if (!canInstall()) {
            apkWait = t
            android.widget.Toast.makeText(this, R.string.dmApkAllow, android.widget.Toast.LENGTH_LONG).show()
            if (runCatching { startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }.isFailure) apkWait = null
            return
        }
        val i = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(t.uri), DmMedia.APK)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (runCatching { startActivity(i) }.isFailure) android.widget.Toast.makeText(this, R.string.dmApkFail, android.widget.Toast.LENGTH_LONG).show()
    }

    /** חילוץ ZIP ברקע — בסוף הודעה עם מספר הקבצים / הסיבה */
    fun unzip(t: DmTask) {
        android.widget.Toast.makeText(this, R.string.dmUnzipping, android.widget.Toast.LENGTH_SHORT).show()
        Thread {
            val msg = try { getString(R.string.dmUnzipped, DmMedia.extractZip(this, t), "Download/" + DmMedia.DIR + "/" + DmZip.folderOf(t.name)) }
                catch (e: DmZip.TooBig) { getString(R.string.dmUnzipBig) } catch (e: DmSpace) { getString(R.string.dmErrSpace) } catch (e: Throwable) { getString(R.string.dmUnzipFail) }
            runOnUiThread { android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_LONG).show() }
        }.apply { isDaemon = true }.start()
    }

    /** "פתיחה באפליקציה אחרת" */
    fun openWith(t: DmTask) {
        val i = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(t.uri), DmMedia.mimeFor(t.name, t.mime))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching { startActivity(i) }
    }

    /** "לתרגם ב־Studio": הקובץ שירד עובר ל־Studio (כמו שיתוף מהגלריה) — נשאר גם כאן */
    fun translate(t: DmTask) {
        if (!AppRoute.fileToStudio(this, Uri.parse(t.uri), DmMedia.mimeFor(t.name, t.mime), t.title.ifEmpty { t.name }))
            android.widget.Toast.makeText(this, R.string.dmNoStudio, android.widget.Toast.LENGTH_LONG).show()
    }

    /** "ישר לענן של Studio": בלי להוריד לטלפון — Studio בוחר את הענן כשהמקור מאפשר */
    fun toCloud(url: String, ref: String) {
        if (!AppRoute.toStudio(this, url, ref, cloud = true))
            android.widget.Toast.makeText(this, R.string.dmNoStudio, android.widget.Toast.LENGTH_LONG).show()
    }

    fun studioHere() = AppRoute.studioInstalled(this)

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
        data class Playlist(val url: String, val pl: DmPlaylist.Playlist) : Found()
    }

    /** רשימת השמעה — כל הכותרות בבקשה אחת (DlEngine.probePlaylist). רץ בתהליכון */
    fun probeList(url: String, ref: String): Found = try {
        DmPlaylist.parse(DlEngine.probePlaylist(this, url, ref, DlEngine.cookiesFor(this, url, ref)))?.let { Found.Playlist(url, it) } ?: Found.Fail("playlist")
    } catch (e: IllegalArgumentException) { Found.Fail(e.message ?: "fail") } catch (e: Throwable) { Found.Fail("fail") }

    /** הסרטונים שנבחרו מהרשימה → משימות yt-dlp (כל אחת נבדקת כשהיא מתחילה; הבורר לפי הגובה ופורמט הווידאו — DmPlaylist.format) */
    fun addPlaylist(entries: List<DmPlaylist.Entry>, h: Int, audio: Boolean, later: Boolean) {
        val now = System.currentTimeMillis()
        entries.forEachIndexed { i, e ->
            DmStore.add(DmTask(DmStore.newId(), e.url, "", DmKind.YTDL).apply {
                title = e.title; name = e.title; audioOnly = audio; height = if (audio) 0 else h
                this.later = later; created = now + i
            })
        }
        askNotifications(); DmEngine.pump(this)
    }

    /** רץ בתהליכון (לא בממשק) */
    /** הגיליון נסגר — מה שהגיע מהדפדפן לא עובר להוספה הבאה */
    fun sheetDone() { sheetUrl.value = null; sheetCk = false; sheetUa = ""; sheetTitle = ""; refreshId.value = "" }

    private fun ckFn(): ((String) -> String?)? = if (!sheetCk) null else { u -> runCatching { android.webkit.CookieManager.getInstance().getCookie(u) }.getOrNull() }

    fun openBrowser(start: String, refresh: String = "") {
        // 26/10/2026: ב־Studio Browser (אותו קוד) — הדפדפן המלא. רענון קישור של הורדה נשאר בדפדפן הקטן של DM
        val full = if (refresh.isEmpty()) runCatching { Class.forName(FULL_BROWSER) }.getOrNull() else null
        if (full != null && runCatching { startActivity(Intent(this, full).putExtra(DmBrowser.EXTRA_START, start)) }.isSuccess) return
        runCatching { startActivity(Intent(this, DmBrowser::class.java).putExtra(DmBrowser.EXTRA_START, start).putExtra(DmBrowser.EXTRA_REFRESH, refresh)) }
    }

    fun probe(url: String, ref: String): Found {
        // Studio Browser כבר בדק את הסרטון ברקע (DmPre) — האיכויות מוכנות מיד
        DmPre.await(url)?.let { return Found.Video(url, it.also { if (sheetTitle.isNotEmpty()) it.put("t", sheetTitle) }) }
        val known = VideoUrl.classify(url).let { it is VideoUrl.Hit.Video && DmName.cat(DmName.fromUrl(url), "") == DmName.Cat.OTHER }
        if (!known) {
            try {
                val p = DmFetch.probeRetry(url, ref, sheetUa.ifEmpty { DmFetch.UA }, cookies = ckFn())
                if (p.mime != "text/html" && p.mime != "application/xhtml+xml")
                    // נשמרת הכתובת שהמשתמש נתן, לא זו שאחרי ההפניה: קישור הורדה (GitHub, S3…) מפנה לכתובת חתומה שפגה תוך דקות,
                    // ו"המשך" מחר היה נכשל ב־expired. כל חיבור עוקב אחרי ההפניה מחדש; If-Range (ETag) שומר שלא מערבבים קבצים
                    return Found.File(url, DmName.pick(p.disposition, p.finalUrl, p.mime).let { if (sheetTitle.isEmpty()) it else DmName.titled(sheetTitle, it) }, p.total, p.mime, p.ranges)
            } catch (e: Throwable) {
                if (e is DmHttpError && DmRetry.http(e.status).act == DmRetry.Act.FATAL) return Found.Fail(DmRetry.http(e.status).code)
            }
        }
        return try { Found.Video(url, DlEngine.probe(this, url, ref, DlEngine.cookiesFor(this, url, ref)).also { if (sheetTitle.isNotEmpty()) it.put("t", sheetTitle) }) }
        catch (e: IllegalArgumentException) { if (e.message == "playlist") probeList(url, ref) else Found.Fail(e.message ?: "fail") }
        catch (e: Throwable) { Found.Fail("fail") }
    }

    fun addFile(f: Found.File, name: String, ref: String, tr: Boolean = false, later: Boolean = false) {
        val t = DmTask(DmStore.newId(), f.url, ref, DmKind.HTTP).apply {
            this.tr = tr; this.later = later
            this.name = DmName.clean(name).ifEmpty { f.name }; mime = f.mime; total = f.size; ranges = f.ranges
            created = System.currentTimeMillis(); ua = sheetUa; ck = sheetCk
        }
        DmStore.add(t); rememberSite(ref); askNotifications(); DmEngine.pump(this)
    }

    /* הורדה שהגיעה מהדפדפן של DM (עם העוגיות שלו) — האתר נשמר לבועה ב־Chrome (DmPre.rememberSite) */
    private fun rememberSite(ref: String) = DmPre.rememberSite(this, ref, sheetCk)

    fun addVideo(v: Found.Video, q: JSONObject?, audio: Boolean, ref: String, tr: Boolean = false, later: Boolean = false, subs: List<DmSubs.Sub> = emptyList()) {
        DmPre.enqueue(this, v.url, v.info, q, audio, ref, sheetCk, tr, later, subs)
        askNotifications()
    }

    /**
     * רענון קישור (כמו ב־IDM): הקישור של משימה פג (403/410 — כתובת חתומה), והמשתמש מצא אותו שוב בדפדפן. אותו קובץ =
     * אותו גודל → מחליפים את הכתובת ושומרים את מה שכבר ירד (If-Range עם ה־ETag הישן עדיין שומר שלא מערבבים).
     * null = הוחלף; אחרת קוד לגיליון
     */
    fun refresh(id: String, f: Found.File, ref: String): String? {
        val t = DmStore.get(id) ?: return "fail"
        if (t.kind != DmKind.HTTP) return "refresh_kind"
        if (t.total > 0 && f.size != t.total) return "refresh_size"
        DmEngine.pause(this, id)
        t.url = f.url; if (ref.isNotEmpty()) t.ref = ref
        t.ua = sheetUa; t.ck = sheetCk
        t.err = ""; if (t.state != DmState.DONE) t.state = DmState.PAUSED
        DmStore.save()
        DmEngine.resume(this, id)
        return null
    }

    /* ---------- שלב 3: הרבה הורדות בבת אחת ---------- */

    /** הוספה של רשימה (הדבקה) — בודקים אחד־אחד ברקע; `batch` = ההתקדמות לגיליון */
    data class Batch(val total: Int, val done: Int, val ok: Int, val failed: List<String>, val finished: Boolean)
    val batch = mutableStateOf<Batch?>(null)
    @Volatile private var batchStop = false

    fun addBatch(urls: List<String>, ref: String) {
        if (batch.value?.finished == false) return
        batchStop = false
        val pr = DmPrefs(this)
        batch.value = Batch(urls.size, 0, 0, emptyList(), false)
        Thread {
            var ok = 0; val bad = ArrayList<String>()
            for ((i, u) in urls.withIndex()) {
                if (batchStop) break
                if (DmStore.has(u)) { ok++; batch.value = Batch(urls.size, i + 1, ok, bad.toList(), false); continue }
                when (val f = probe(u, ref)) {
                    is Found.File -> { runOnUiThread { addFile(f, f.name, ref) }; ok++ }
                    is Found.Video -> {
                        val audio = pr.quality == "audio"
                        runOnUiThread { addVideo(f, pickQuality(f.info, pr.quality), audio, ref) }; ok++
                    }
                    is Found.Playlist -> { runOnUiThread { addPlaylist(f.pl.entries, pr.quality.toIntOrNull() ?: 0, pr.quality == "audio", false) }; ok++ }
                    is Found.Fail -> bad.add(u)
                }
                batch.value = Batch(urls.size, i + 1, ok, bad.toList(), false)
            }
            batch.value = Batch(urls.size, batch.value?.done ?: 0, ok, bad.toList(), true)
        }.apply { isDaemon = true; name = "dm-batch" }.start()
    }

    fun stopBatch() { batchStop = true }

    /** האיכות לפי ברירת המחדל בהגדרות: הגבוהה ביותר שלא עוברת את הגובה שנבחר */
    fun pickQuality(info: JSONObject, quality: String): JSONObject? {
        val qs = info.optJSONArray("q") ?: return null
        val want = quality.toIntOrNull()
        if (want != null) for (i in 0 until qs.length()) qs.optJSONObject(i)?.let { if (it.optInt("h") <= want) return it }
        return qs.optJSONObject(0)
    }

    /** שחזור מגיבוי (הטקסט של "ייצוא הרשימה"): רק מה שעוד לא ברשימה, בתור */
    fun importBackup(tasks: List<DmTask>): Int {
        val all = DmStore.all()
        val add = DmImport.fresh(tasks, all.map { it.url }.toSet(), all.map { it.id }.toSet()) { DmStore.newId() }
        val now = System.currentTimeMillis()
        add.forEach { it.created = now; DmStore.add(it) }
        if (add.isNotEmpty()) { askNotifications(); DmEngine.pump(this) }
        return add.size
    }

    /** בדיקת שלמות: סיכום של הקובץ שבטלפון (MediaStore) — ברקע; onDone(hex או null) בחוט הראשי */
    fun hashFile(t: DmTask, algo: String, onBytes: (Long) -> Unit, onDone: (String?) -> Unit) {
        Thread {
            val r = try {
                contentResolver.openInputStream(Uri.parse(t.uri))?.let { DmHash.digest(it, algo, onBytes) }
            } catch (e: Throwable) { null }
            runOnUiThread { onDone(r) }
        }.apply { isDaemon = true; name = "dm-hash" }.start()
    }
}
