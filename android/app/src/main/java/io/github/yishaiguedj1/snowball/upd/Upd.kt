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
import android.os.Build
import io.github.yishaiguedj1.snowball.R
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/* 08/11/2026 (בקשת המשתמש): עדכון עצמי שקט — כמו "עדכון תוכנה" של המכשיר, בכל שבע האפליקציות (source set ראשי).
   1. בדיקה: latest.json מהקישור הקבוע (android-latest) — פעם ביום ברקע (UpdJob) או בכפתור במסך (UpdActivity).
   2. "עדכון": ההורדה בג'וב שלנו (UpdJob, ‏JOB_DL) לתיקייה הפרטית של האפליקציה, ממשיכה גם כשיוצאים מהמסך,
      ובניתוק / עצירה של הג'וב — ממשיכה מהמקום שנעצר (Range).
      09/11/2026: לא DownloadManager — הוא עוצר הורדה גדולה ברשת סלולרית "עד Wi‑Fi" (המגבלה המומלצת של המפעיל/היצרן),
      ועם הורדה מוסתרת המשתמש לא רואה את השאלה: Studio (77MB) נתקע על 0% יותר משעה ב־5G, והקטנות עברו.
   3. בסוף ההורדה (באותו ג'וב) → בדיקת גודל + sha256 + חבילה + מספר גרסה, והעברה ל־PackageInstaller עם
      USER_ACTION_NOT_REQUIRED: באנדרואיד 12+ אפליקציה שמעדכנת את עצמה (UPDATE_PACKAGES_WITHOUT_USER_ACTION) —
      בלי חלון אישור ובלי "מקור לא ידוע". אם המערכת בכל זאת מבקשת אישור (אנדרואיד ישן) — UpdStatus מציג אותו.
   4. אחרי ההחלפה המערכת מפעילה את הגרסה החדשה ב־MY_PACKAGE_REPLACED (UpdDone) → התראה אחת: "עודכנה לגרסה X".
   אבטחה: רק קובץ שה־sha256 שלו פורסם ב־latest.json, ואנדרואיד דוחה חתימה שונה מהמותקנת. אין כאן נתוני משתמש. */
object Upd {
    const val BASE = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/"
    const val JOB_CHECK = 7351
    const val JOB_DL = 7353
    private const val CH = "snb_upd"
    private const val N_ID = 7451
    private const val DAY = 24L * 60 * 60 * 1000

    // מצבים: "" — כלום, "dl" — מוריד, "inst" — מתקין, "err" — נכשל (err = סיבה)
    data class St(val phase: String, val rel: UpdCore.Rel?, val checked: Long, val err: String)

    private fun sp(c: Context) = c.getSharedPreferences("snb_upd", Context.MODE_PRIVATE)

    /** שפת המסך וההתראות = שפת הממשק (האתר מעביר ‎?l=he|en, ‏DM/הדפדפן — את השפה שלהם), לא שפת הטלפון. ברירת מחדל: עברית */
    fun lang(c: Context): String = if (sp(c).getString("lang", "he") == "en") "en" else "he"
    fun setLang(c: Context, l: String?) {
        val v = when { l == null -> return; l.startsWith("he") || l.startsWith("iw") -> "he"; l.startsWith("en") -> "en"; else -> return }
        sp(c).edit().putString("lang", v).apply()
    }
    /** מ־DM/הדפדפן: השפה שבה הממשק שלהם מוצג עכשיו (iw = עברית בגרסאות ישנות של Java) */
    fun open(c: Context) {
        val l = if (Build.VERSION.SDK_INT >= 24) c.resources.configuration.locales[0].language else @Suppress("DEPRECATION") c.resources.configuration.locale.language
        c.startActivity(Intent(c, UpdActivity::class.java).putExtra("l", l))
    }
    fun res(c: Context): Context {
        val conf = android.content.res.Configuration(c.resources.configuration)
        conf.setLocale(java.util.Locale(lang(c)))
        return c.createConfigurationContext(conf)
    }

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
        return St(s.getString("phase", "") ?: "", rel, s.getLong("checked", 0), s.getString("err", "") ?: "")
    }

    /** יש גרסה חדשה יותר ממה שמותקן (לפי הבדיקה האחרונה) */
    fun available(c: Context): Boolean = UpdCore.newer(installedCode(c), state(c).rel)

    private fun setPhase(c: Context, phase: String, err: String = "") {
        sp(c).edit().putString("phase", phase).putString("err", err).putLong("pt", System.currentTimeMillis()).apply()
    }

    /** עדכון בתהליך: ג'וב ההורדה עוד קיים (רץ או מחכה לרשת), או התקנה מהדקות האחרונות (תהליך שנהרג באמצע — אפשר לנסות שוב) */
    fun busy(c: Context): Boolean {
        val st = state(c)
        return when (st.phase) {
            "dl" -> try { c.getSystemService(JobScheduler::class.java)?.getPendingJob(JOB_DL) != null } catch (e: Exception) { false }
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

    /** "עדכון": מתחיל את ג'וב ההורדה. false = אין עדכון / אין אחסון */
    fun start(c: Context): Boolean {
        val st = state(c)
        val r = st.rel ?: return false
        if (!UpdCore.newer(installedCode(c), r)) return false
        if (busy(c)) return true
        val dir = c.getExternalFilesDir("upd") ?: return false.also { setPhase(c, "err", "space") }
        cleanup(c)
        dir.listFiles()?.forEach { it.delete() }
        sp(c).edit().putString("phase", "dl").putString("err", "").putLong("pt", System.currentTimeMillis())
            .putLong("got", 0).putInt("tries", 0).apply()
        val js = c.getSystemService(JobScheduler::class.java) ?: return false.also { setPhase(c, "err", "dl") }
        val ok = try {
            js.schedule(JobInfo.Builder(JOB_DL, ComponentName(c, UpdJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build()) == JobScheduler.RESULT_SUCCESS
        } catch (e: Exception) { false }
        if (!ok) setPhase(c, "err", "dl")
        return ok
    }

    /** התקדמות ההורדה: (ירד, סה״כ); null = אין הורדה */
    fun progress(c: Context): Pair<Long, Long>? {
        val st = state(c)
        if (st.phase != "dl") return null
        return sp(c).getLong("got", 0) to (st.rel?.size ?: 0)
    }

    /** מ־UpdJob (JOB_DL, בתהליכון): ההורדה, מהמקום שנעצר; בסוף — התקנה. מחזיר true = לנסות שוב אחר כך (הג'וב מתוזמן מחדש) */
    fun download(c: Context, stop: () -> Boolean): Boolean {
        val st = state(c)
        val r = st.rel
        if (st.phase != "dl" || r == null || !UpdCore.newer(installedCode(c), r)) return false
        val f = File(c.getExternalFilesDir("upd") ?: run { fail(c, "space"); return false }, "u.apk")
        var have = if (f.isFile) f.length() else 0L
        if (r.size > 0 && have > r.size) { f.delete(); have = 0 }
        val before = have
        var lastSave = 0L
        fun save() { sp(c).edit().putLong("got", have).apply() }
        try {
            if (r.size <= 0 || have < r.size) {
                val conn = URL(BASE + r.file).openConnection() as HttpURLConnection
                try {
                    conn.connectTimeout = 20000; conn.readTimeout = 30000; conn.instanceFollowRedirects = true
                    if (have > 0) conn.setRequestProperty("Range", "bytes=$have-")
                    val code = conn.responseCode
                    val at = UpdCore.writeFrom(code, have)
                    if (at == null) {
                        if (code == 416) { f.delete(); sp(c).edit().putLong("got", 0).apply() }   // הקובץ המקומי לא תואם — מההתחלה
                        return if (UpdCore.transient(code)) retry(c, false) else { fail(c, "dl"); false }
                    }
                    have = at
                    java.io.FileOutputStream(f, at > 0).use { out ->
                        conn.inputStream.use { inp ->
                            val buf = ByteArray(1 shl 16)
                            while (true) {
                                if (stop()) { save(); return true }
                                val n = inp.read(buf)
                                if (n < 0) break
                                out.write(buf, 0, n); have += n
                                val now = System.currentTimeMillis()
                                if (now - lastSave > 400) { lastSave = now; save() }
                            }
                        }
                    }
                } finally { conn.disconnect() }
            }
        } catch (e: Exception) { save(); return retry(c, have > before) }
        save()
        if (r.size > 0 && have != r.size) return retry(c, have > before)   // נקטע באמצע — ממשיכים בפעם הבאה
        setPhase(c, "inst")
        install(c)
        return false
    }

    /** ניסיון חוזר (הג'וב מתוזמן מחדש עם המתנה שגדלה). ניסיון שהתקדם מאפס את הספירה; 8 ניסיונות בלי התקדמות = נכשל */
    private fun retry(c: Context, progressed: Boolean): Boolean {
        val n = if (progressed) 0 else sp(c).getInt("tries", 0) + 1
        sp(c).edit().putInt("tries", n).apply()
        if (n > 8) { fail(c, "dl"); return false }
        return true
    }

    /** מ־download: בדיקת הקובץ והעברה למתקין של המערכת (חוסם — רץ בתהליכון של הג'וב) */
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
        val r = res(c)
        if (!UpdActivity.shown) notify(c, r.getString(R.string.updFailTitle, c.getString(R.string.app_name)), r.getString(R.string.updFailText), true)
    }

    private fun cleanup(c: Context) {
        c.getExternalFilesDir("upd")?.listFiles()?.forEach { it.delete() }
        // גרסאות עד 09/11/2026 הורידו ב־DownloadManager — הורדה ישנה שנשארה תקועה "עד Wi‑Fi" נמחקת
        val old = sp(c).getLong("dl", -1)
        if (old >= 0) try { c.getSystemService(DownloadManager::class.java)?.remove(old) } catch (e: Exception) {}
        sp(c).edit().putLong("dl", -1).putLong("got", 0).apply()
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
            val r = res(c)
            notify(c, r.getString(R.string.updDoneTitle, c.getString(R.string.app_name)), r.getString(R.string.updDoneText, installedName(c)), false)
        }
    }

    /** מ־UpdJob (הבדיקה היומית): גרסה חדשה → התראה שקטה אחת לכל גרסה, כמו "עדכון מערכת זמין" */
    fun announce(c: Context) {
        val r = state(c).rel ?: return
        if (!UpdCore.newer(installedCode(c), r) || sp(c).getLong("seen", 0) == r.code) return
        sp(c).edit().putLong("seen", r.code).apply()
        val x = res(c)
        notify(c, x.getString(R.string.updNewTitle, c.getString(R.string.app_name)), x.getString(R.string.updNewText, r.name), true)
    }

    /** התראה אחת (מחליפה את הקודמת). open = נגיעה פותחת את מסך העדכון; אחרת — את האפליקציה */
    fun notify(c: Context, title: String, text: String, open: Boolean) {
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        nm.createNotificationChannel(NotificationChannel(CH, res(c).getString(R.string.updChannel), NotificationManager.IMPORTANCE_DEFAULT))
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
