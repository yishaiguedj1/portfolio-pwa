package io.github.yishaiguedj1.snowball.br

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.github.yishaiguedj1.snowball.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * 65 מעקב אחרי שינוי בדף (הגל השלישי, 01/11/2026): WorkManager בודק כל שעה מה הגיע הזמן לבדוק (BrDev.due),
 * מוריד את הדף **בלי העוגיות שלך** (מה שרואה מי שלא מחובר — נאמר במסך), משווה את הטקסט (BrDev.pageText/hash)
 * ומתריע כשהשתנה. הרשימה בהעדפות של המשתמש הנוכחי, הטקסט האחרון בתיקייה שלו (watch/<id>.txt) — לא בענן.
 */
object BrWatch {
    private const val WORK = "snb-br-watch"
    private const val CH = "brWatch"

    private fun sp(ctx: Context) = BrUsers.prefs(ctx, "brw")
    fun load(ctx: Context): List<BrDev.Watch> = BrDev.watchDecode(sp(ctx).getString("l", null))
    @Synchronized fun save(ctx: Context, l: List<BrDev.Watch>) {
        sp(ctx).edit().putString("l", BrDev.watchEncode(l)).apply()
        schedule(ctx, l.isNotEmpty())
    }
    private fun txt(ctx: Context, id: String) = File(File(BrUsers.dir(ctx), "watch").apply { mkdirs() }, id.filter { it.isLetterOrDigit() } + ".txt")

    fun add(ctx: Context, url: String, title: String, every: Int = 6): Boolean {
        val l = load(ctx)
        if (l.any { it.url == url } || l.size >= BrDev.WATCH_MAX) return false
        save(ctx, l + BrDev.Watch(System.currentTimeMillis().toString(36), url, title.take(120), every))
        checkNow(ctx)
        return true
    }
    fun remove(ctx: Context, id: String) { save(ctx, load(ctx).filter { it.id != id }); txt(ctx, id).delete() }
    fun update(ctx: Context, id: String, f: (BrDev.Watch) -> BrDev.Watch) = save(ctx, load(ctx).map { if (it.id == id) f(it) else it })
    fun clearAll(ctx: Context) { load(ctx).forEach { txt(ctx, it.id).delete() }; save(ctx, emptyList()) }

    private fun schedule(ctx: Context, on: Boolean) = runCatching {
        val wm = WorkManager.getInstance(ctx.applicationContext)
        if (!on) { wm.cancelUniqueWork(WORK); return@runCatching }
        val c = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<Job>(1, TimeUnit.HOURS).setConstraints(c).build())
    }

    /** "לבדוק עכשיו" (וגם מיד אחרי הוספה — כדי לשמור את המצב ההתחלתי) */
    fun checkNow(ctx: Context) = runCatching {
        WorkManager.getInstance(ctx.applicationContext).enqueueUniqueWork("$WORK-now", ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<Job>().setInputData(androidx.work.workDataOf("all" to true)).build())
    }

    private fun fetch(url: String): String? = runCatching {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 20_000; c.readTimeout = 20_000; c.instanceFollowRedirects = true
        c.setRequestProperty("Accept", "text/html,*/*;q=0.8")
        c.setRequestProperty("Accept-Language", "he,en;q=0.8")
        try {
            if (c.responseCode !in 200..299) return null
            c.inputStream.use { s -> val b = s.readNBytesCompat(3 shl 20); String(b, Charsets.UTF_8) }
        } finally { c.disconnect() }
    }.getOrNull()

    private fun java.io.InputStream.readNBytesCompat(max: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(16 shl 10); var n = 0
        while (n < max) { val r = read(buf, 0, minOf(buf.size, max - n)); if (r < 0) break; out.write(buf, 0, r); n += r }
        return out.toByteArray()
    }

    /** בדיקה אחת של כל מה שהגיע זמנו (all = הכל, מ"לבדוק עכשיו") */
    fun run(ctx: Context, all: Boolean) {
        val now = System.currentTimeMillis()
        for (w in load(ctx)) {
            if (!all && !BrDev.due(w, now)) continue
            val html = fetch(w.url)
            if (html == null) { update(ctx, w.id) { it.copy(at = now) }; continue }
            val text = BrDev.pageText(html); val h = BrDev.hash(text)
            val f = txt(ctx, w.id)
            if (w.hash.isNotEmpty() && h != w.hash) {
                val d = BrDev.diff(f.takeIf { it.exists() }?.readText() ?: "", text)
                update(ctx, w.id) { it.copy(hash = h, at = now, changed = now, diff = d) }
                notify(ctx, w, d)
            } else update(ctx, w.id) { it.copy(hash = h, at = now) }
            runCatching { f.writeText(text.take(400_000)) }
        }
    }

    private fun notify(ctx: Context, w: BrDev.Watch, d: String) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CH, ctx.getString(R.string.brWatchCh), NotificationManager.IMPORTANCE_DEFAULT))
        val i = Intent(ctx, BrowserActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(w.url))
            .putExtra("snb_watch", w.id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(ctx, w.id.hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CH) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(ctx.getString(R.string.brWatchChanged, w.title.ifEmpty { BrStore.hostOf(w.url) }))
            .setContentText(d.ifEmpty { w.url }).setStyle(android.app.Notification.BigTextStyle().bigText(d.ifEmpty { w.url }))
            .setContentIntent(pi).setAutoCancel(true).build()
        runCatching { nm.notify(("w" + w.id).hashCode(), n) }
    }

    class Job(ctx: Context, p: WorkerParameters) : CoroutineWorker(ctx, p) {
        override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
            runCatching { run(applicationContext, inputData.getBoolean("all", false)) }
            Result.success()
        }
    }
}
