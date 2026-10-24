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

    private fun put(url: String, f: File, range: LongRange): Int {
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
                    while (left > 0) { val n = raf.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (n < 0) break; o.write(buf, 0, n); left -= n }
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
