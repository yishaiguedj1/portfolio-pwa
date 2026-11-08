package io.github.yishaiguedj1.snowball.upd

import android.app.DownloadManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import io.github.yishaiguedj1.snowball.R
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/* 08/11/2026 (בקשת המשתמש): עדכון עצמי שקט — כמו "עדכון תוכנה" של המכשיר, בכל שבע האפליקציות (source set ראשי).
   1. בדיקה: latest.json מהקישור הקבוע (android-latest) — פעם ביום ברקע (UpdJob) או בכפתור במסך (UpdActivity).
   2. "עדכון": ההורדה ב־DownloadManager של המערכת, מוסתרת (בלי התראה ובלי קובץ בתיקיית ההורדות — בתיקייה הפרטית
      של האפליקציה), ממשיכה גם כשיוצאים מהמסך ובניתוק רשת.
   3. בסוף ההורדה (UpdDlReceiver) → UpdJob בודק גודל + sha256 + חבילה + מספר גרסה, ומעביר ל־PackageInstaller עם
      USER_ACTION_NOT_REQUIRED: באנדרואיד 12+ אפליקציה שמעדכנת את עצמה (UPDATE_PACKAGES_WITHOUT_USER_ACTION) —
      בלי חלון אישור ובלי "מקור לא ידוע". אם המערכת בכל זאת מבקשת אישור (אנדרואיד ישן) — UpdStatus מציג אותו.
   4. אחרי ההחלפה המערכת מפעילה את הגרסה החדשה ב־MY_PACKAGE_REPLACED (UpdDone) → התראה אחת: "עודכנה לגרסה X".
   אבטחה: רק קובץ שה־sha256 שלו פורסם ב־latest.json, ואנדרואיד דוחה חתימה שונה מהמותקנת. אין כאן נתוני משתמש. */
object Upd {
    const val BASE = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/"
    const val JOB_CHECK = 7351
    const val JOB_INSTALL = 7352
    private const val CH = "snb_upd"
    private const val N_ID = 7451
    private const val DAY = 24L * 60 * 60 * 1000

    // מצבים: "" — כלום, "dl" — מוריד, "inst" — מתקין, "err" — נכשל (err = סיבה)
    data class St(val phase: String, val rel: UpdCore.Rel?, val checked: Long, val err: String, val dlId: Long)

    private fun sp(c: Context) = c.getSharedPreferences("snb_upd", Context.MODE_PRIVATE)

    fun installedCode(c: Context): Long = try {
        val p = c.packageManager.getPackageInfo(c.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else @Suppress("DEPRECATION") p.versionCode.toLong()
    } catch (e: Exception) { 0L }

    fun installedName(c: Context): String = try { c.packageManager.getPackageInfo(c.packageName, 0).versionName ?: "" } catch (e: Exception) { "" }

    fun state(c: Context): St {
        val s = sp(c)
        val code = s.getLong("code", 0)
        val rel = if (code > 0) UpdCore.Rel(code, s.getString("name", "") ?: "", s.getString("file", "") ?: "",
            s.getLong("size", 0), s.getString("sha", "") ?: "") else null
        return St(s.getString("phase", "") ?: "", rel, s.getLong("checked", 0), s.getString("err", "") ?: "", s.getLong("dl", -1))
    }

    /** יש גרסה חדשה יותר ממה שמותקן (לפי הבדיקה האחרונה) */
    fun available(c: Context): Boolean = UpdCore.newer(installedCode(c), state(c).rel)

    private fun setPhase(c: Context, phase: String, err: String = "") {
        sp(c).edit().putString("phase", phase).putString("err", err).putLong("pt", System.currentTimeMillis()).apply()
    }

    /** עדכון בתהליך: הורדה שעוד קיימת ב־DownloadManager, או התקנה מהדקות האחרונות (תהליך שנהרג באמצע — אפשר לנסות שוב) */
    fun busy(c: Context): Boolean {
        val st = state(c)
        return when (st.phase) {
            "dl" -> progress(c) != null
            "inst" -> System.currentTimeMillis() - sp(c).getLong("pt", 0) < 3 * 60 * 1000L
            else -> false
        }
    }

    /** בדיקה ברשת (לא על ה־main thread). מחזיר true אם הבדיקה הצליחה */
    fun check(c: Context): Boolean {
        val txt = try {
            val u = URL(BASE + "latest.json?t=" + System.currentTimeMillis() / 60000)
            (u.openConnection() as HttpURLConnection).run {
                connectTimeout = 15000; readTimeout = 20000; instanceFollowRedirects = true
                setRequestProperty("Cache-Control", "no-cache")
                try { if (responseCode != 200) null else inputStream.bufferedReader().use { it.readText().take(64 * 1024) } } finally { disconnect() }
            }
        } catch (e: Exception) { null } ?: return false
        val r = UpdCore.parse(txt, c.packageName) ?: return false
        sp(c).edit().putLong("code", r.code).putString("name", r.name).putString("file", r.file)
            .putLong("size", r.size).putString("sha", r.sha).putLong("checked", System.currentTimeMillis()).apply()
        return true
    }

    /** "עדכון": מתחיל הורדה מוסתרת. false = אין עדכון / אין אחסון */
    fun start(c: Context): Boolean {
        val st = state(c)
        val r = st.rel ?: return false
        if (!UpdCore.newer(installedCode(c), r)) return false
        if (busy(c)) return true
        val dir = c.getExternalFilesDir("upd") ?: return false.also { setPhase(c, "err", "space") }
        dir.listFiles()?.forEach { it.delete() }
        val dm = c.getSystemService(DownloadManager::class.java) ?: return false
        val id = try {
            dm.enqueue(DownloadManager.Request(Uri.parse(BASE + r.file))
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN)
                .setDestinationInExternalFilesDir(c, "upd", "u.apk")
                .setAllowedOverMetered(true).setAllowedOverRoaming(true)
                .setTitle(c.getString(R.string.app_name)))
        } catch (e: Exception) { setPhase(c, "err", "dl"); return false }
        sp(c).edit().putLong("dl", id).putString("phase", "dl").putString("err", "").putLong("pt", System.currentTimeMillis()).apply()
        return true
    }

    /** התקדמות ההורדה: (ירד, סה״כ); null = אין הורדה פעילה */
    fun progress(c: Context): Pair<Long, Long>? {
        val id = state(c).dlId
        if (id < 0) return null
        val dm = c.getSystemService(DownloadManager::class.java) ?: return null
        return try {
            dm.query(DownloadManager.Query().setFilterById(id))?.use { q ->
                if (!q.moveToFirst()) null
                else q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)) to
                    q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            }
        } catch (e: Exception) { null }
    }

    /** מ־UpdDlReceiver: ההורדה שלנו הסתיימה → התקנה ב־UpdJob (ג'וב — העתקה ו־sha256 של קובץ גדול לא בתוך broadcast) */
    fun onDownloaded(c: Context, id: Long) {
        if (id < 0 || id != state(c).dlId) return   // לא ההורדה שלנו (ה־broadcast מגיע מספק ההורדות — לא סומכים עליו)
        val dm = c.getSystemService(DownloadManager::class.java) ?: return
        val ok = try {
            dm.query(DownloadManager.Query().setFilterById(id))?.use { q ->
                q.moveToFirst() && q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL
            } ?: false
        } catch (e: Exception) { false }
        if (!ok) { fail(c, "dl"); return }
        setPhase(c, "inst")
        val js = c.getSystemService(JobScheduler::class.java) ?: return
        js.schedule(JobInfo.Builder(JOB_INSTALL, ComponentName(c, UpdJob::class.java)).setOverrideDeadline(0).build())
    }

    /** מ־UpdJob: בדיקת הקובץ והעברה למתקין של המערכת (חוסם — רץ בתהליכון של הג'וב) */
    fun install(c: Context) {
        val st = state(c)
        val r = st.rel
        val f = File(c.getExternalFilesDir("upd") ?: run { fail(c, "space"); return }, "u.apk")
        if (r == null || !UpdCore.verify(f, r)) { fail(c, "hash"); return }
        // החבילה והגרסה שבתוך הקובץ — חייבות להיות האפליקציה הזו, חדשה יותר
        val info = try { c.packageManager.getPackageArchiveInfo(f.path, 0) } catch (e: Exception) { null }
        val code = if (info == null) 0L else if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        if (info?.packageName != c.packageName || code <= installedCode(c)) { fail(c, "hash"); return }
        try {
            val pi = c.packageManager.packageInstaller
            val p = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            p.setAppPackageName(c.packageName)
            p.setSize(f.length())
            if (Build.VERSION.SDK_INT >= 31) p.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            if (Build.VERSION.SDK_INT >= 33) p.setPackageSource(PackageInstaller.PACKAGE_SOURCE_STORE)
            val sid = pi.createSession(p)
            pi.openSession(sid).use { s ->
                s.openWrite("base.apk", 0, f.length()).use { out -> f.inputStream().use { it.copyTo(out, 1 shl 16) }; s.fsync(out) }
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val back = PendingIntent.getBroadcast(c, 1, Intent(c, UpdStatus::class.java).setPackage(c.packageName), flags)
                s.commit(back.intentSender)
            }
        } catch (e: Exception) { fail(c, "inst") }
    }

    fun fail(c: Context, why: String) {
        setPhase(c, "err", why)
        cleanup(c)
        if (!UpdActivity.shown) notify(c, c.getString(R.string.updFailTitle, c.getString(R.string.app_name)), c.getString(R.string.updFailText), true)
    }

    private fun cleanup(c: Context) {
        c.getExternalFilesDir("upd")?.listFiles()?.forEach { it.delete() }
        sp(c).edit().putLong("dl", -1).apply()
    }

    /** מ־UpdDone (MY_PACKAGE_REPLACED, כבר בגרסה החדשה) / UpdStatus (הצלחה) — פעם אחת לכל גרסה */
    fun done(c: Context) {
        val s = sp(c)
        val now = installedCode(c)
        val was = s.getString("phase", "") ?: ""
        cleanup(c)
        s.edit().putString("phase", "").putString("err", "").apply()
        if ((was == "dl" || was == "inst") && s.getLong("told", 0) != now) {
            s.edit().putLong("told", now).apply()
            notify(c, c.getString(R.string.updDoneTitle, c.getString(R.string.app_name)), c.getString(R.string.updDoneText, installedName(c)), false)
        }
    }

    /** מ־UpdJob (הבדיקה היומית): גרסה חדשה → התראה שקטה אחת לכל גרסה, כמו "עדכון מערכת זמין" */
    fun announce(c: Context) {
        val r = state(c).rel ?: return
        if (!UpdCore.newer(installedCode(c), r) || sp(c).getLong("seen", 0) == r.code) return
        sp(c).edit().putLong("seen", r.code).apply()
        notify(c, c.getString(R.string.updNewTitle, c.getString(R.string.app_name)), c.getString(R.string.updNewText, r.name), true)
    }

    /** התראה אחת (מחליפה את הקודמת). open = נגיעה פותחת את מסך העדכון; אחרת — את האפליקציה */
    fun notify(c: Context, title: String, text: String, open: Boolean) {
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        nm.createNotificationChannel(NotificationChannel(CH, c.getString(R.string.updChannel), NotificationManager.IMPORTANCE_DEFAULT))
        val tap = if (open) Intent(c, UpdActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            else c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent(c, UpdActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(c, 2, tap, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        nm.notify(N_ID, Notification.Builder(c, CH).setSmallIcon(R.drawable.ic_upd).setContentTitle(title).setContentText(text)
            .setContentIntent(pi).setAutoCancel(true).build())
    }

    fun cancelNotice(c: Context) { c.getSystemService(NotificationManager::class.java)?.cancel(N_ID) }

    /** בכל פתיחה של האפליקציה: הבדיקה היומית ברקע (פעם אחת — לא מחליפים ג'וב קיים) */
    fun schedule(c: Context) {
        try {
            val js = c.getSystemService(JobScheduler::class.java) ?: return
            if (js.getPendingJob(JOB_CHECK) != null) return
            js.schedule(JobInfo.Builder(JOB_CHECK, ComponentName(c, UpdJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(DAY).setPersisted(true).build())
        } catch (e: Exception) {}
    }

    /** לכתובת שה־TWA פותח: "<חבילה>~<גרסה>~<1 אם יש עדכון>" — שורת "עדכון תוכנה" בהגדרות של האתר (core: apkUpdRow) */
    fun hashParam(c: Context): String = "upd=" + c.packageName + "~" + installedCode(c) + "~" + (if (available(c)) "1" else "0")
}
