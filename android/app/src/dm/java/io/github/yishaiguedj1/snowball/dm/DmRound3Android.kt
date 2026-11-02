package io.github.yishaiguedj1.snowball.dm

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.VideoUrl
import java.io.File
import java.security.MessageDigest
import java.util.Calendar
import java.util.concurrent.atomic.AtomicLong

/*
 * 01/11/2026 — השדרוג "מקצועי", סבב 3: השכבה של אנדרואיד (הכללים הטהורים ב־dmcore/DmRound3.kt).
 * תורים וחלונות זמן בתוך DmEngine.pump (בלי הרשאת שעון מדויק — משימת מערכת עם השהיה מינימלית), חוקים בהוספה,
 * פעולות בסיום, מגבלות ומכסות, בודק ה־APK, ההוספה מאפליקציות אחרות והאריח "לעצור/להמשיך הכל".
 */
object DmR3 {
    private const val WIN_ID = 5102
    const val PERM_ADD = "app.thesnowball.permission.DM_ADD"
    /** ממתינות שלא מחזיקות שירות/משימה פעילים (עלולות לחכות שעות) — מתעוררות במשימת המערכת WIN_ID */
    val PARKED = setOf("window", "quota")

    /** מה שאפליקציה אחרת / deep link ביקשו לקישורים האלה (תור, תיקייה, שם) — נקלט כשהמשימה נוספת, עד 10 דק׳ */
    data class Hint(val urls: Set<String>, val q: String, val dir: String, val name: String, val later: Boolean, val until: Long)
    @Volatile var hint: Hint? = null

    fun now(): Pair<Int, Int> {
        val c = Calendar.getInstance()
        return (c.get(Calendar.DAY_OF_WEEK) - 1) to (c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE))
    }

    fun queues(pr: DmPrefs) = DmQueues.parse(pr.queues)
    private fun queueOf(qs: List<DmQueue>, t: DmTask) = if (t.q.isEmpty()) null else qs.firstOrNull { it.id == t.q }
    /** המזהה של התור שקיים בפועל (תור שנמחק = הראשי) */
    private fun qid(qs: List<DmQueue>, t: DmTask) = queueOf(qs, t)?.id ?: DmQueues.MAIN

    /* ---------- הוספה: חוקים ובקשות מבחוץ ---------- */

    fun onAdd(ctx: Context, t: DmTask) {
        val pr = DmPrefs(ctx); val qs = queues(pr)
        hint?.let { h ->
            if (h.until > System.currentTimeMillis() && t.url in h.urls) {
                if (h.q.isNotEmpty()) DmQueues.find(qs, h.q)?.let { t.q = it.id }
                if (h.dir.isNotEmpty() && t.dir.isEmpty()) t.dir = DmFolders.norm(DmFolders.SUB + h.dir)
                if (h.name.isNotEmpty() && t.kind == DmKind.HTTP) t.name = DmName.clean(h.name)
                if (h.later) t.later = true
            }
        }
        if (t.name.isNotEmpty() || t.kind == DmKind.YTDL) applyRules(ctx, t)
    }

    /** החוק הראשון שמתאים — פעם אחת לכל משימה (בהוספה, או אחרי הבדיקה כשהשם עוד לא היה ידוע) */
    fun applyRules(ctx: Context, t: DmTask) {
        if (t.ruled) return
        t.ruled = true
        val pr = DmPrefs(ctx)
        val r = DmRules.match(DmRules.parse(pr.rules), t.url, t.name.ifEmpty { t.title }) ?: return
        if (t.q.isEmpty() && r.queue.isNotEmpty() && queues(pr).any { it.id == r.queue }) t.q = r.queue
        if (t.dir.isEmpty()) t.dir = r.dir
        if (t.conns == 0) t.conns = r.conns
        if (t.lim == 0L) t.lim = r.lim
        if (t.onDone.isEmpty()) t.onDone = r.done
        if (DmOnDone.A.STUDIO in DmOnDone.parse(t.onDone)) t.tr = true
        if (r.name.isNotEmpty() && t.kind == DmKind.HTTP && t.name.isNotEmpty())
            t.name = DmRules.rename(r.name, t.name, t.url, String.format(java.util.Locale.US, "%tF", Calendar.getInstance()))
    }

    /* ---------- התור: חלונות, רשת, מכסה, כמה במקביל לכל תור ---------- */

    /** מה מהתור מותר להתחיל עכשיו (לפי הסדר). מה שנחסם — WAITING עם הסיבה (window / wifi / quota) */
    fun gate(ctx: Context, queued: List<DmTask>, running: Collection<String>): List<DmTask> {
        val pr = DmPrefs(ctx); val qs = queues(pr)
        val (dow, min) = now()
        val unmetered = DmEngine.netOk(ctx, true)
        val over = if (overNow(pr, !unmetered) != null) "quota" else null
        var changed = false
        val ok = ArrayList<DmTask>()
        for (t in queued) {
            val why = over ?: DmQueues.block(queueOf(qs, t), unmetered, dow, min)
            if (why == null) { ok.add(t); continue }
            if (t.state != DmState.WAITING || t.err != why) { t.state = DmState.WAITING; t.err = why; changed = true }
        }
        if (changed) DmStore.save()
        val runQ = running.mapNotNull { DmStore.get(it) }.groupingBy { qid(qs, it) }.eachCount()
        return DmQueues.gate(ok.map { qid(qs, it) }, runQ, qs.associate { it.id to it.parallel }).map { ok[it] }
    }

    /** חלון ייפתח — משימת מערכת עם השהיה מינימלית (לא שעון מדויק; המערכת מריצה בערך בזמן) */
    fun scheduleWake(ctx: Context, replace: Boolean = false) {
        val js = ctx.getSystemService(JobScheduler::class.java) ?: return
        if (replace) js.cancel(WIN_ID)
        val pr = DmPrefs(ctx); val qs = queues(pr)
        val (dow, min) = now()
        val all = DmStore.all()
        val waits = all.filter { it.state == DmState.WAITING && it.err == "window" }.mapNotNull { queueOf(qs, it) }
        // מכסה שנגמרה — היום הבא (מכסה חודשית נבדקת שוב באותה שעה כל יום)
        val quota = if (all.any { it.state == DmState.WAITING && it.err == "quota" }) DmWindow.DAY - min + 1 else null
        val mins = (waits.map { it.win.untilOpen(dow, min) } + listOfNotNull(quota)).filter { it > 0 }.minOrNull() ?: return
        if (!replace && js.getPendingJob(WIN_ID) != null) return
        fun build(ui: Boolean) = JobInfo.Builder(WIN_ID, ComponentName(ctx, DmJob::class.java)).apply {
            if (ui && Build.VERSION.SDK_INT >= 34) setUserInitiated(true)
            setMinimumLatency(mins * 60_000L)
            setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            setPersisted(true)
        }.build()
        val ok = Build.VERSION.SDK_INT >= 34 && DmActivity.visible && runCatching { js.schedule(build(true)) == JobScheduler.RESULT_SUCCESS }.getOrDefault(false)
        if (!ok) runCatching { js.schedule(build(false)) }
    }

    /* ---------- מגבלות ומכסות: נבדק לכל היותר פעם ב־10 שנ׳ ---------- */

    private val pendCell = AtomicLong(0)
    private val pendWifi = AtomicLong(0)
    @Volatile private var tickAt = 0L

    /** בתים שירדו (לספירת המכסה) */
    fun count(bytes: Long, cell: Boolean) { if (bytes > 0) (if (cell) pendCell else pendWifi).addAndGet(bytes) }

    private fun keys(): Pair<Int, Int> {
        val c = Calendar.getInstance()
        val y = c.get(Calendar.YEAR); val m = c.get(Calendar.MONTH) + 1
        return (y * 10000 + m * 100 + c.get(Calendar.DAY_OF_MONTH)) to (y * 100 + m)
    }

    @Synchronized
    fun usage(pr: DmPrefs): DmQuota.Use {
        val (d, m) = keys()
        var u = DmQuota.roll(DmQuota.parseUse(pr.quotaUse), d, m)
        u = DmQuota.add(u, pendCell.getAndSet(0), true)
        u = DmQuota.add(u, pendWifi.getAndSet(0), false)
        pr.quotaUse = DmQuota.dumpUse(u)
        return u
    }

    fun overNow(pr: DmPrefs, cell: Boolean): String? {
        val c = DmQuota.parseCaps(pr.quotaCaps)
        return if (!c.any) null else DmQuota.over(usage(pr), c, cell)
    }

    /** הקצב הכולל עכשיו: לפי השעה, ובסלולר — גם מגבלת הסלולר */
    fun limitNow(ctx: Context, pr: DmPrefs): Long {
        val (dow, min) = now()
        return DmSpeed.now(pr.limit, DmSpeed.parse(pr.speedPlan), !DmEngine.netOk(ctx, true), pr.cellLimit, dow, min)
    }

    /** כל 10 שנ׳ (מהמנוע): הקצב לפי השעה, ספירת המכסה, ועצירה (חזרה לתור) של מה שהחלון שלו נסגר או שהמכסה נגמרה */
    fun tick(ctx: Context, force: Boolean = false) {
        val t0 = System.currentTimeMillis()
        if (!force && t0 - tickAt < 10_000) return
        tickAt = t0
        val pr = DmPrefs(ctx)
        val lim = limitNow(ctx, pr)
        if (lim != DmLimit.bytesPerSec) DmLimit.bytesPerSec = lim
        val unmetered = DmEngine.netOk(ctx, true)
        val over = overNow(pr, !unmetered)
        val qs = queues(pr); val (dow, min) = now()
        DmEngine.runningIds().forEach { id ->
            val t = DmStore.get(id) ?: return@forEach
            if (over != null || DmQueues.block(queueOf(qs, t), unmetered, dow, min) != null) DmEngine.stopSys(id)
        }
    }

    /* ---------- בסיום ---------- */

    fun silent(t: DmTask) = DmOnDone.A.SILENT in DmOnDone.parse(t.onDone)

    /** הורדה שנכשלה בתור עם ניסיונות — חוזרת לסוף התור. true = חזרה */
    fun retryInQueue(ctx: Context, t: DmTask, code: String): Boolean {
        val q = queueOf(queues(DmPrefs(ctx)), t) ?: return false
        if (!DmQueues.retry(q, t.tries, code)) return false
        t.state = DmState.QUEUED; t.err = ""
        DmStore.moveLast(t.id)
        return true
    }

    /** אחרי שהורדה הסתיימה או נכשלה סופית: פעולות בסיום, וסוף התור */
    fun after(ctx: Context, t: DmTask) {
        if (t.state == DmState.DONE) runActions(ctx, t)
        if (t.q.isNotEmpty()) queueEnd(ctx, t.q)
    }

    private fun runActions(ctx: Context, t: DmTask) {
        val a = DmOnDone.parse(t.onDone)
        if (a.isEmpty() || t.uri.isEmpty()) return
        val main = android.os.Handler(android.os.Looper.getMainLooper())
        val cat = DmName.cat(t.name, t.mime)
        if (DmOnDone.A.HASH in a && t.kind == DmKind.HTTP) Thread { checkSum(ctx, t) }.apply { isDaemon = true; name = "dm-sum" }.start()
        if (DmOnDone.A.UNZIP in a && DmName.ext(t.name) == "zip") Thread { runCatching { DmMedia.extractZip(ctx, t) } }.apply { isDaemon = true }.start()
        // פתיחה ושיתוף — רק כש־DM מול המשתמש (מהרקע אנדרואיד לא מרשה, ו־APK לעולם לא נפתח לבד)
        if (!DmActivity.visible) return
        if (DmOnDone.A.OPEN in a && cat != DmName.Cat.APK) main.post {
            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(t.uri), DmMedia.mimeFor(t.name, t.mime))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)) }
        } else if (DmOnDone.A.SHARE in a) main.post {
            runCatching { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(DmMedia.mimeFor(t.name, t.mime))
                .putExtra(Intent.EXTRA_STREAM, Uri.parse(t.uri)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    /** הסיכום שהאתר מפרסם ליד הקישור (.sha256 / SHA256SUMS…) מול הקובץ שבטלפון. רק אותו אתר, עד 256KB לקובץ סיכום */
    fun checkSum(ctx: Context, t: DmTask) {
        var want: String? = null
        val host = DmLink.host(t.url)
        for (u in DmOnDone.sidecars(t.url)) {
            if (DmLink.host(u) != host) continue
            val txt = runCatching {
                val c = DmFetch.open(u, t.ref, DmEngine.uaOf(t), emptyMap(), DmEngine.cookiesOf(t))
                try {
                    if (c.responseCode != 200 || (c.contentType ?: "").startsWith("text/html")) null
                    else c.inputStream.use { s ->
                        val b = java.io.ByteArrayOutputStream(); val buf = ByteArray(16 * 1024)
                        while (b.size() < 256 * 1024) { val n = s.read(buf); if (n < 0) break; b.write(buf, 0, n) }
                        b.toString("UTF-8")
                    }
                } finally { c.disconnect() }
            }.getOrNull() ?: continue
            want = DmOnDone.sumFor(txt, t.name) ?: continue
            break
        }
        val w = want
        t.sum = if (w == null) "none" else {
            val algo = DmHash.algoOf(w)
            val got = runCatching { ctx.contentResolver.openInputStream(Uri.parse(t.uri))?.use { DmHash.digest(it, algo ?: "SHA-256") } }.getOrNull()
            if (algo == null || got == null) "none" else if (DmHash.matches(got, w) == true) "ok" else "bad"
        }
        DmStore.save()
        if (t.sum == "bad") notify(ctx, t.id.hashCode() + 2, ctx.getString(R.string.dmSumBadN), t.name)
    }

    private val ended = HashMap<String, String>()

    /** תור שנגמר: התראה ו/או שידור לאפליקציות עם ההרשאה (פעם אחת לכל מצב סופי) */
    private fun queueEnd(ctx: Context, qId: String) {
        val q = queues(DmPrefs(ctx)).firstOrNull { it.id == qId } ?: return
        val mine = DmStore.all().filter { it.q == qId }
        val e = DmQueues.ended(mine.map { it.state }) ?: return
        val sig = mine.joinToString(",") { it.id + it.state.name }
        synchronized(ended) { if (ended[qId] == sig) return; ended[qId] = sig }
        val acts = q.done.split(',').map { it.trim() }
        if ("notify" in acts) notify(ctx, 900 + qId.hashCode() % 90, DmLang.wrap(ctx).getString(R.string.dmQueueDoneN, q.name),
            DmLang.wrap(ctx).getString(R.string.dmQueueDoneS, e.done, e.failed))
        if ("intent" in acts) runCatching {
            ctx.sendBroadcast(Intent(DmApi.QUEUE_DONE).putExtra("queue", q.name).putExtra("done", e.done).putExtra("failed", e.failed), PERM_ADD)
        }
    }

    private fun notify(ctx0: Context, id: Int, title: String, text: String) {
        val ctx = DmLang.wrap(ctx0)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel("dm_done", ctx.getString(R.string.dmChDone), NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(ctx, id, Intent(ctx, DmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        nm.notify(id, android.app.Notification.Builder(ctx, "dm_done").setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(open).build())
    }

    /* ---------- הוספה מבחוץ (45) ---------- */

    /** בקשה מאפליקציה אחרת / deep link: בשקט — ישר לתור; אחרת — גיליון ההוספה עם הקישורים */
    fun take(ctx: Context, r: DmApi.Req) {
        hint = Hint(r.urls.toSet(), r.queue, r.folder, r.name, r.later, System.currentTimeMillis() + 10 * 60_000)
        if (!r.quiet) {
            ctx.startActivity(Intent(ctx, DmActivity::class.java).setAction(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, r.urls.joinToString("\n")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        DmStore.init(ctx)
        val pr = DmPrefs(ctx); val now = System.currentTimeMillis()
        r.urls.forEachIndexed { i, u ->
            if (DmStore.has(u)) return@forEachIndexed
            // אתר וידאו מוכר (לא קובץ) → yt-dlp לפי האיכות שבהגדרות; אחרת המנוע שלנו (בודק בהתחלה)
            val video = VideoUrl.classify(u) is VideoUrl.Hit.Video && DmName.cat(DmName.fromUrl(u), "") == DmName.Cat.OTHER
            DmStore.add(DmTask(DmStore.newId(), u, "", if (video) DmKind.YTDL else DmKind.HTTP).apply {
                created = now + i
                if (video) { audioOnly = pr.quality == "audio"; height = if (audioOnly) 0 else pr.quality.toIntOrNull() ?: 0; if (!audioOnly) subs = DmSubs.langs(DmSubs.ANY) }
            })
        }
        DmEngine.pump(ctx)
    }
}

/**
 * הממשק לאפליקציות אחרות (45): ADD (‏url / urls, name, queue, folder, later, quiet), API_PAUSE_ALL, API_RESUME_ALL, STATUS.
 * מיוצא רק בהרשאה DM_ADD (‏dangerous — המשתמש מאשר לכל אפליקציה בנפרד). בלי עוגיות ובלי כותרות מבחוץ.
 */
class DmApiActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DmStore.init(this)
        val i = intent
        when (i?.action) {
            DmApi.ADD -> {
                val r = DmApi.parse({ k -> i.getStringExtra(k) ?: i.getStringArrayExtra(k)?.joinToString("\n") }, true)
                setResult(if (r == null) RESULT_CANCELED else RESULT_OK)
                r?.let { DmR3.take(this, it) }
            }
            DmApi.PAUSE_ALL -> { DmEngine.pauseAll(this); setResult(RESULT_OK) }
            DmApi.RESUME_ALL -> { DmEngine.resumeAll(this); setResult(RESULT_OK) }
            DmApi.STATUS -> {
                val all = DmStore.all()
                setResult(RESULT_OK, Intent().putExtra("running", all.count { it.state == DmState.RUNNING })
                    .putExtra("queued", all.count { it.state == DmState.QUEUED || it.state == DmState.WAITING })
                    .putExtra("failed", all.count { it.state == DmState.FAILED }).putExtra("speed", DmEngine.speed.values.sum()))
            }
            else -> setResult(RESULT_CANCELED)
        }
        finish()
    }
}

/** אריח שני בהגדרות המהירות: לעצור הכל / להמשיך הכל (דלוק = משהו רץ) */
class DmTileAll : TileService() {
    override fun onStartListening() { super.onStartListening(); paint() }

    override fun onClick() {
        super.onClick()
        DmStore.init(this)
        if (DmStore.all().any { it.active }) DmEngine.pauseAll(this) else DmEngine.resumeAll(this)
        paint()
    }

    private fun paint() {
        DmStore.init(this)
        val t = qsTile ?: return
        val on = DmStore.all().any { it.active }
        t.state = if (on) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        t.label = getString(if (on) R.string.dmTileAllPause else R.string.dmTileAllGo)
        t.updateTile()
    }
}

/** בודק APK לפני התקנה (23): חבילה, גרסה, חתימה, הרשאות רגישות, והשוואה לאפליקציה שכבר מותקנת */
object DmApkInspect {
    data class Res(
        val pkg: String, val label: String, val vName: String, val code: Long, val certs: List<String>,
        val risky: List<String>, val oldVName: String?, val oldCode: Long, val verdict: DmApkCheck.V,
    )

    @Suppress("DEPRECATION")
    fun inspect(ctx: Context, uri: Uri): Res? {
        // getPackageArchiveInfo צריך נתיב — עותק זמני בתיקיית המטמון (נמחק מיד)
        val tmp = File(ctx.cacheDir, "apk-check.apk")
        try {
            ctx.contentResolver.openInputStream(uri)?.use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } } ?: return null
            val pm = ctx.packageManager
            val flags = PackageManager.GET_PERMISSIONS or (if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
            val pi = pm.getPackageArchiveInfo(tmp.path, flags) ?: return null
            pi.applicationInfo?.let { it.sourceDir = tmp.path; it.publicSourceDir = tmp.path }
            val label = runCatching { pi.applicationInfo?.loadLabel(pm)?.toString() }.getOrNull() ?: ""
            val certs = certsOf(pi)
            val old = runCatching { pm.getPackageInfo(pi.packageName, if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES) }.getOrNull()
            val code = if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else pi.versionCode.toLong()
            val oldCode = old?.let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode else it.versionCode.toLong() } ?: 0
            return Res(pi.packageName, label, pi.versionName ?: "", code, certs, DmApkCheck.risky(pi.requestedPermissions?.toList() ?: emptyList()),
                old?.versionName, oldCode, DmApkCheck.verdict(certs.toSet(), code, old?.let { certsOf(it).toSet() }, oldCode))
        } catch (e: Throwable) { return null } finally { tmp.delete() }
    }

    @Suppress("DEPRECATION")
    private fun certsOf(pi: PackageInfo): List<String> {
        val sigs = if (Build.VERSION.SDK_INT >= 28) pi.signingInfo?.let { if (it.hasMultipleSigners()) it.apkContentsSigners else it.signingCertificateHistory } else pi.signatures
        return (sigs ?: emptyArray()).map { DmApkCheck.hex(MessageDigest.getInstance("SHA-256").digest(it.toByteArray())) }.distinct()
    }
}
