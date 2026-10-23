package io.github.yishaiguedj1.snowball.dm

import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/** לאן נכתבים הבתים: באנדרואיד — FileChannel של הקובץ ב־MediaStore (כתיבה במיקום), בבדיקות — קובץ רגיל */
interface DmSink {
    fun write(pos: Long, buf: ByteArray, len: Int)
    fun sync()
}

/** מה השרת אמר על הקובץ, לפני ההורדה */
data class DmProbe(
    val total: Long, val ranges: Boolean, val etag: String, val lastMod: String,
    val mime: String, val disposition: String, val finalUrl: String,
)

class DmHttpError(val status: Int, val retryAfter: Long) : IOException("http_$status")

/**
 * ההורדה של קובץ ישיר — בלי אנדרואיד (נבדקת ב־JVM מול שרת שמנתק באמצע).
 * הכללים מהמחקר (IDM):
 *  · בדיקה ב־GET עם ‎Range: bytes=0-0‎ (לא HEAD — שרתים רבים עונים על HEAD אחרת);
 *  · כל חיבור עם ‎If-Range‎ (ETag או Last-Modified): הקובץ השתנה בשרת → 200 במקום 206 → מתחילים מחדש, אף פעם לא מערבבים גרסאות;
 *  · חיבור שהתפנה חוצה את המקטע הגדול ביותר (DmSegs.split);
 *  · כל תקלה מסווגת (DmRetry): רשת/5xx — ניסיון חוזר עם המתנה; 403/404/410 — עוצרים עם קוד.
 * ההתקדמות נשמרת ע"י הקורא (onTick כל ~2 שנ׳) — אחרי הריגה ממשיכים מהמקטעים השמורים.
 */
class DmFetch(
    private val task: DmTask,
    private val sink: DmSink,
    private val conns: Int,
    private val ua: String = UA,
    private val sleep: (Long) -> Unit = { Thread.sleep(it) },
    private val minSeg: Long = DmSegs.MIN_SEG,
) {
    sealed class Result {
        object Done : Result()
        object Stopped : Result()
        data class Failed(val code: String) : Result()
    }

    private val lock = Object()
    private val written = AtomicLong(0)
    private val fail = AtomicReference<String?>(null)
    @Volatile private var restart = false
    @Volatile private var stopFlag: () -> Boolean = { false }

    /** בתים שנכתבו בהרצה הזו (למהירות) */
    val bytes get() = written.get()

    fun run(stop: () -> Boolean, onTick: () -> Unit = {}): Result {
        stopFlag = stop
        repeat(3) {   // שינוי בשרת באמצע (If-Range) → מתחילים מחדש, לכל היותר פעמיים
            val r = runOnce(onTick)
            if (r !is Result.Failed || r.code != "changed") return r
            task.segs = DmSegs.initial(task.total, task.ranges, conns)
        }
        return Result.Failed("changed")
    }

    private fun runOnce(onTick: () -> Unit): Result {
        restart = false; fail.set(null)
        if (task.segs.isEmpty()) task.segs = DmSegs.initial(task.total, task.ranges, conns)
        // בלי Range (או בלי גודל) אי אפשר להמשיך מאמצע — מתחילים מ־0 במקטע אחד
        if (!task.ranges || task.total <= 0) {
            task.segs = DmSegs.initial(task.total, false, 1)
            return worker(task.segs[0], single = true).let { if (fail.get() != null) Result.Failed(fail.get()!!) else if (stopFlag()) Result.Stopped else it }
        }
        val want = conns.coerceIn(1, DmSegs.MAX_CONNS)
        val threads = mutableListOf<Thread>()
        val busy = HashSet<Seg>()

        fun launch(s: Seg) {
            busy.add(s)
            threads.add(Thread {
                var seg: Seg? = s
                while (seg != null) {
                    worker(seg, single = false)
                    if (stopFlag() || fail.get() != null || restart) break
                    // החיבור התפנה: לוקח מקטע שאף אחד לא עובד עליו, ואם אין — חוצה את הגדול ביותר
                    seg = synchronized(lock) {
                        busy.remove(seg)
                        (task.segs.firstOrNull { !it.finished && it !in busy } ?: DmSegs.split(task.segs, minSeg))
                            ?.also { busy.add(it) }
                    }
                }
            }.apply { isDaemon = true; start() })
        }

        synchronized(lock) {
            task.segs.filter { !it.finished }.take(want).forEach { launch(it) }
            // פחות מקטעים פתוחים מחיבורים — חותכים עוד
            while (threads.size < want) {
                val n = DmSegs.split(task.segs, minSeg) ?: break
                launch(n)
            }
        }
        var last = System.currentTimeMillis()
        while (threads.any { it.isAlive }) {
            threads.forEach { it.join(250) }
            val now = System.currentTimeMillis()
            if (now - last >= TICK_MS) { last = now; synchronized(lock) { onTick() } }
        }
        synchronized(lock) { DmSegs.compact(task.segs) }
        runCatching { sink.sync() }
        onTick()
        fail.get()?.let { return Result.Failed(it) }
        if (restart) return Result.Failed("changed")
        if (stopFlag()) return Result.Stopped
        return if (DmSegs.complete(task.segs, task.total)) Result.Done else Result.Failed("incomplete")
    }

    /** חיבור אחד על מקטע אחד, עם ניסיונות חוזרים, עד שהמקטע נגמר / עצירה / תקלה סופית */
    private fun worker(seg: Seg, single: Boolean): Result {
        var attempt = 0
        val buf = ByteArray(BUF)
        while (!seg.finished && !stopFlag() && fail.get() == null && !restart) {
            var c: HttpURLConnection? = null
            try {
                if (single) { seg.done = 0 }   // בלי Range — כל ניסיון מההתחלה
                c = open(task.url, task.ref, ua)
                val ranged = !single
                if (ranged) {
                    c.setRequestProperty("Range", "bytes=${seg.pos}-${seg.end - 1}")
                    val v = task.etag.ifEmpty { task.lastMod }
                    if (v.isNotEmpty()) c.setRequestProperty("If-Range", v)
                }
                val st = c.responseCode
                if (ranged && st == 200) { restart = true; return Result.Failed("changed") }   // If-Range: הקובץ השתנה
                if (st !in 200..299) throw DmHttpError(st, c.getHeaderField("Retry-After")?.trim()?.toLongOrNull() ?: -1)
                if (ranged) {
                    val cr = c.getHeaderField("Content-Range") ?: ""
                    val start = Regex("bytes\\s+(\\d+)-").find(cr)?.groupValues?.get(1)?.toLongOrNull()
                    if (start != seg.pos) { restart = true; return Result.Failed("changed") }
                }
                read(c.inputStream, seg, buf)
                attempt = 0
                if (single && task.total <= 0) { seg.end = seg.pos; task.total = seg.pos }   // הגודל נודע בסוף
            } catch (e: Throwable) {
                val v = if (e is DmHttpError) DmRetry.http(e.status) else DmRetry.io(e)
                if (v.act == DmRetry.Act.RESTART) { restart = true; return Result.Failed("changed") }
                if (v.act == DmRetry.Act.FATAL || ++attempt > DmRetry.MAX_TRIES) { fail.compareAndSet(null, v.code); return Result.Failed(v.code) }
                val wait = DmRetry.backoffMs(attempt - 1, (e as? DmHttpError)?.retryAfter ?: -1)
                var waited = 0L
                while (waited < wait && !stopFlag()) { sleep(200); waited += 200 }
            } finally {
                runCatching { c?.disconnect() }
            }
        }
        return Result.Done
    }

    private fun read(input: InputStream, seg: Seg, buf: ByteArray) {
        input.use { inp ->
            while (!stopFlag() && !restart && fail.get() == null) {
                val end = seg.end   // יכול להתקצר באמצע (split) — קוראים בכל סבב
                if (seg.pos >= end) return
                val want = minOf(buf.size.toLong(), end - seg.pos).toInt()
                val n = inp.read(buf, 0, want)
                if (n < 0) {
                    if (end == Long.MAX_VALUE) { seg.end = seg.pos; return }   // בלי גודל ידוע — הסוף הוא הסוף
                    throw IOException("eof")
                }
                sink.write(seg.pos, buf, n)
                seg.done += n
                written.addAndGet(n.toLong())
            }
        }
    }

    companion object {
        const val UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
        const val BUF = 64 * 1024
        const val TICK_MS = 2000L

        fun open(url: String, ref: String, ua: String): HttpURLConnection {
            val c = URL(url).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = true
            c.connectTimeout = 20_000; c.readTimeout = 30_000
            c.setRequestProperty("User-Agent", ua)
            c.setRequestProperty("Accept-Encoding", "identity")   // בלי דחיסה — אחרת הטווחים לא בבתים של הקובץ
            if (ref.startsWith("http")) c.setRequestProperty("Referer", ref)
            return c
        }

        /** הבדיקה עם ניסיונות חוזרים לתקלה חולפת (503, ניתוק) — כמו ההורדה עצמה */
        fun probeRetry(url: String, ref: String = "", ua: String = UA, tries: Int = 4, sleep: (Long) -> Unit = { Thread.sleep(it) }): DmProbe {
            var n = 0
            while (true) {
                try { return probe(url, ref, ua) } catch (e: Throwable) {
                    val v = if (e is DmHttpError) DmRetry.http(e.status) else DmRetry.io(e)
                    if (v.act != DmRetry.Act.RETRY || ++n >= tries) throw e
                    sleep(DmRetry.backoffMs(n - 1, (e as? DmHttpError)?.retryAfter ?: -1))
                }
            }
        }

        /** GET עם ‎Range: bytes=0-0‎ — גודל, תמיכה בטווחים, ETag, סוג ושם, בלי לקרוא את הקובץ */
        fun probe(url: String, ref: String = "", ua: String = UA): DmProbe {
            val c = open(url, ref, ua)
            try {
                c.setRequestProperty("Range", "bytes=0-0")
                val st = c.responseCode
                if (st !in 200..299) throw DmHttpError(st, c.getHeaderField("Retry-After")?.trim()?.toLongOrNull() ?: -1)
                val cr = c.getHeaderField("Content-Range") ?: ""
                val ranged = st == 206 && cr.startsWith("bytes")
                val total = if (ranged) Regex("/(\\d+)$").find(cr.trim())?.groupValues?.get(1)?.toLongOrNull() ?: -1L
                else c.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L
                val etag = (c.getHeaderField("ETag") ?: "").takeIf { !it.startsWith("W/") } ?: ""   // ETag חלש לא מתאים ל־If-Range
                return DmProbe(total, ranged && total > 0, etag, c.getHeaderField("Last-Modified") ?: "",
                    (c.contentType ?: "").substringBefore(';').trim(), c.getHeaderField("Content-Disposition") ?: "", c.url.toString())
            } finally { runCatching { c.inputStream.close() }; c.disconnect() }
        }
    }
}
