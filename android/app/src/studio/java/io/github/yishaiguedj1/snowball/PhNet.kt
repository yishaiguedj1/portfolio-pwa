package io.github.yishaiguedj1.snowball

import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL

/**
 * 24/10/2026 — תרגום בטלפון: השרתון (פעולות ph* ב־api/studio.js, עם המפתח של העבודה — בלי התחברות ובלי Origin)
 * וההעלאה בחלקים ל־R2 בקישורים החתומים שהשרתון נותן (studior2.js). רק לכתובות ברשימה הסגורה (PhCore.HOSTS).
 */
class PhNet(private var base: String, private val job: String, private val key: String) {
    class Err(val code: String) : Exception(code)
    companion object { const val CONC = 4 }   // 29/10/2026: חלקים במקביל בהעלאת הסרטון (= R2_CONC באתר)

    init { require(PhCore.hostOk(base) && PhCore.JOB_RE.matches(job) && PhCore.KEY_RE.matches(key)) }

    /** פעולה בשרתון. אין תשובה בכלל (רשת) מהשרתון של הייצור → Vercel (כמו installFailover באתר) */
    fun call(op: String, body: JSONObject = JSONObject()): JSONObject {
        body.put("op", op).put("job", job).put("key", key)
        return try { post(base, body) } catch (e: IOException) {
            val fb = PhCore.fallback(base) ?: throw Err("net")
            try { post(fb, body).also { base = fb } } catch (x: IOException) { throw Err("net") }
        }
    }

    private fun post(b: String, body: JSONObject): JSONObject {
        val c = URL("$b/api/studio").openConnection() as HttpURLConnection
        c.connectTimeout = 20_000; c.readTimeout = 60_000
        c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("User-Agent", "snb-studio-android/1")
        c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = c.responseCode
        val txt = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        val j = try { JSONObject(txt) } catch (e: Throwable) { if (code >= 500) throw IOException("http $code"); JSONObject() }
        if (code == 403 && j.optString("error") == "bad_key") throw Err("bad_key")   // המפתח פג / הוחלף — אין טעם לנסות שוב
        return j
    }

    /** העלאת קובץ שלם לתיקייה של העבודה (חלקים, עם המשך: id/up שמורים ברשומה דרך save) → מזהה הקובץ */
    fun upload(f: File, type: String, name: String, id0: String, up0: String, save: (String, String) -> Unit,
               stop: () -> Boolean, progress: (Float) -> Unit): String {
        val size = f.length()
        var r = call("phUp", JSONObject().put("size", size).put("type", type).put("name", name).apply { if (id0.isNotEmpty()) put("id", id0) })
        var rounds = 0
        while (true) {
            if (!r.optBoolean("ok")) throw Err(r.optString("error", "up"))
            val id = r.optString("id")
            val up = r.optString("up")
            if (up.isEmpty()) { if (r.has("file")) return id; throw Err("up") }   // כבר הועלה במלואו
            save(id, up)
            val ps = r.optLong("ps")
            val done = r.optJSONArray("done")?.length() ?: 0
            val urls = r.optJSONObject("urls") ?: JSONObject()
            val total = PhCore.parts(size, maxOf(1, ps))
            var ok = done
            var broke = false
            for (k in urls.keys()) {
                if (stop()) throw Err("stopped")
                val n = k.toIntOrNull() ?: continue
                val st = put(urls.getString(k), f, PhCore.part(n, ps, size))
                if (st !in 200..299) { broke = true; break }            // קישור שפג / ניתוק — קישורים חדשים ומה שכבר הגיע
                ok++; progress(ok.toFloat() / maxOf(1, total))
            }
            if (!broke && urls.length() == 0 || !broke && ok >= total) {
                val d = call("phDone", JSONObject().put("id", id).put("up", up))
                if (d.optBoolean("ok")) return id
                if (d.optString("error") != "r2_parts") throw Err(d.optString("error", "up"))
            }
            if (++rounds > 40) throw Err("up")
            if (broke) Thread.sleep(3000)
            r = call("phParts", JSONObject().put("id", id).put("up", up))
        }
    }

    /** 29/10/2026: הסרטון לענן (spec.vc) — כמו upload, אבל CONC חלקים במקביל (בסלולרי חיבור אחד לא ממלא את קו ההעלאה),
     *  התקדמות בבתים (כולל מה שבדרך), ו־extra בכל קריאה לשרתון (v=true). עצירה — Err("stopped") אחרי שהחלקים שבדרך
     *  נגמרו; כמה סבבים בלי שום חלק — Err("net"), והמשימה מתוזמנת שוב וממשיכה מהחלקים שכבר ב־R2 */
    fun uploadPar(f: File, type: String, name: String, extra: JSONObject, id0: String, up0: String, save: (String, String) -> Unit,
                  stop: () -> Boolean, progress: (Long) -> Unit): String {
        val size = f.length()
        fun body() = JSONObject(extra.toString())
        fun start(id: String) = call("phUp", body().put("size", size).put("type", type).put("name", name).apply { if (id.isNotEmpty()) put("id", id) })
        var r = if (up0.isNotEmpty() && id0.isNotEmpty()) call("phParts", body().put("id", id0).put("up", up0)) else start(id0)
        var idle = 0
        var regone = false
        while (true) {
            if (!r.optBoolean("ok")) {
                if (r.optString("error") == "r2_gone" && !regone) { regone = true; r = start(id0); continue }   // ההעלאה פגה — מחדש, אותו קובץ
                throw Err(r.optString("error", "up"))
            }
            val id = r.optString("id").ifEmpty { id0 }
            val up = r.optString("up")
            if (up.isEmpty()) { if (r.has("file")) return id; throw Err("up") }
            save(id, up)
            val ps = maxOf(1L, r.optLong("ps"))
            val done = HashSet<Int>()
            r.optJSONArray("done")?.let { a -> for (i in 0 until a.length()) done.add(a.optInt(i)) }
            val urls = r.optJSONObject("urls") ?: JSONObject()
            val total = PhCore.parts(size, ps)
            val base = done.sumOf { n -> PhCore.part(n, ps, size).let { it.last - it.first + 1 } }
            val todo = java.util.concurrent.ConcurrentLinkedQueue<Pair<Int, String>>()
            for (k in urls.keys()) { val n = k.toIntOrNull() ?: continue; if (n !in done) todo.add(n to urls.getString(k)) }
            val live = java.util.concurrent.ConcurrentHashMap<Int, Long>()
            val sent = java.util.concurrent.atomic.AtomicLong(0)
            val ok = java.util.concurrent.atomic.AtomicInteger(0)
            val broke = java.util.concurrent.atomic.AtomicBoolean(false)
            val lock = Any()
            fun rep() = synchronized(lock) { progress(minOf(size, base + sent.get() + live.values.sum())) }
            val th = (1..minOf(CONC, maxOf(1, todo.size))).map {
                Thread {
                    while (!broke.get() && !stop()) {
                        val (n, u) = todo.poll() ?: break
                        val g = PhCore.part(n, ps, size)
                        live[n] = 0L
                        val st = put(u, f, g) { b -> live[n] = b; rep() }
                        live.remove(n)
                        if (st in 200..299) { sent.addAndGet(g.last - g.first + 1); ok.incrementAndGet(); rep() } else broke.set(true)   // קישור שפג / ניתוק
                    }
                }.apply { start() }
            }
            th.forEach { it.join() }
            if (stop()) throw Err("stopped")
            if (!broke.get() && done.size + ok.get() >= total) {
                val d = call("phDone", body().put("id", id).put("up", up))
                if (d.optBoolean("ok")) return id
                if (d.optString("error") != "r2_parts") throw Err(d.optString("error", "up"))
            }
            idle = if (ok.get() > 0) 0 else idle + 1
            if (idle > 5) throw Err("net")
            if (broke.get()) Thread.sleep(minOf(30_000L, 2000L shl minOf(idle, 4)))
            r = call("phParts", body().put("id", id).put("up", up))
        }
    }

    private fun put(url: String, f: File, range: LongRange, onBytes: ((Long) -> Unit)? = null): Int {
        require(url.startsWith("https://"))
        val len = range.last - range.first + 1
        return try {
            val c = URL(url).openConnection() as HttpURLConnection
            c.connectTimeout = 20_000; c.readTimeout = 120_000
            c.requestMethod = "PUT"; c.doOutput = true
            c.setFixedLengthStreamingMode(len)
            RandomAccessFile(f, "r").use { raf ->
                raf.seek(range.first)
                c.outputStream.use { o ->
                    val buf = ByteArray(1 shl 16); var left = len
                    var last = 0L
                    while (left > 0) {
                        val n = raf.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (n < 0) break; o.write(buf, 0, n); left -= n
                        if (onBytes != null && len - left - last >= (1L shl 20)) { last = len - left; onBytes(last) }
                    }
                }
            }
            c.responseCode.also { c.disconnect() }
        } catch (e: IOException) { 0 }
    }

    /** הורדה מקישור חתום (התוצרים — he.ass) */
    fun get(url: String, dest: File, max: Long = 64L shl 20) {
        if (!url.startsWith("https://")) throw Err("get")
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 20_000; c.readTimeout = 60_000
        try {
            if (c.responseCode != 200) throw Err("get")
            c.inputStream.use { i -> dest.outputStream().use { o ->
                val buf = ByteArray(1 shl 16); var n = 0L
                while (true) { val k = i.read(buf); if (k < 0) break; n += k; if (n > max) throw Err("get"); o.write(buf, 0, k) }
            } }
        } catch (e: IOException) { throw Err("net") } finally { c.disconnect() }
    }
}
