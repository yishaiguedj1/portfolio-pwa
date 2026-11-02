package io.github.yishaiguedj1.snowball.dm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.widget.RemoteViews
import androidx.core.content.FileProvider
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import io.github.yishaiguedj1.snowball.DlEngine
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.VideoUrl
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.Inet4Address
import java.security.KeyStore
import java.util.Calendar
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/*
 * 02/11/2026 — השדרוג "מקצועי", סבב 4: שכבת האנדרואיד. הכללים הטהורים ב־dmcore (DmRound4 / DmRound4b, עם בדיקות JVM).
 * כל ההורדות בטלפון בלבד — שום דבר לא עובר דרך השרת שלנו. בלי הרשאות רגישות.
 */

/** ההגדרות של סבב 4 (קובץ נפרד מ־DmPrefs — שלא יגדל עוד) */
class DmPrefs4(ctx: Context) {
    private val p = ctx.getSharedPreferences("dm4", Context.MODE_PRIVATE)
    private fun s(k: String) = p.getString(k, "") ?: ""
    private fun put(k: String, v: String) = p.edit().putString(k, v).apply()
    /** 31: פרוקסי ("host:port" / "socks://host:port"), זמני חיבור וקריאה בשניות, User-Agent לפי אתר ("host=ua" בשורה) */
    var proxy: String get() = s("proxy"); set(v) = put("proxy", v)
    var connectS: Int get() = p.getInt("cs", 20).coerceIn(5, 120); set(v) = p.edit().putInt("cs", v).apply()
    var readS: Int get() = p.getInt("rs", 30).coerceIn(5, 300); set(v) = p.edit().putInt("rs", v).apply()
    var ua: String get() = s("ua"); set(v) = put("ua", v)
    /** 30: חריגים — אתר או סיומת בשורה (לא מוצעים מהלוח) */
    var excl: String get() = s("excl"); set(v) = put("excl", v)
    /** 24: מצב חו"ל עד (0 = כבוי), החבילה כוללת נדידה, מתי שאלנו לאחרונה */
    var travelUntil: Long get() = p.getLong("tu", 0); set(v) = p.edit().putLong("tu", v).apply()
    var roamOk: Boolean get() = p.getBoolean("ro", false); set(v) = p.edit().putBoolean("ro", v).apply()
    var roamAsked: Long get() = p.getLong("ra", 0); set(v) = p.edit().putLong("ra", v).apply()
    /** 42: מצב מקצוען — השורות הטכניות בפרטים (מפת מקטעים, אבחון, סיכומים). דלוק כברירת מחדל (כמו עד היום) */
    var pro: Boolean get() = p.getBoolean("pro", true); set(v) = p.edit().putBoolean("pro", v).apply()
    /** 41: סיכום יומי */
    var dailyOn: Boolean get() = p.getBoolean("dly", true); set(v) = p.edit().putBoolean("dly", v).apply()
    var daily: String get() = s("day"); set(v) = put("day", v)
    /** 7/38: תור סנכרון; 5: פרויקטי סריקה */
    var watches: String get() = s("w"); set(v) = put("w", v)
    var crawls: String get() = s("cr"); set(v) = put("cr", v)
    /** 18: כניסות לאתרים — JSON מוצפן ב־Keystore (AES-GCM) */
    var creds: String get() = s("cred"); set(v) = put("cred", v)
    /** 28: ניקוי אוטומטי — למחוק מהרשימה (לא את הקובץ) הורדות שהסתיימו לפני N ימים (0 = כבוי) */
    var cleanDays: Int get() = p.getInt("cln", 0).coerceIn(0, 365); set(v) = p.edit().putInt("cln", v).apply()
}

object DmR4 {
    private const val WATCH_JOB = 5104
    private const val N_ROAM = 5301
    private const val N_DAILY = 5302
    private const val N_WATCH = 5303

    /** אחרי האתחול של DM (DmStore.init) — ההגדרות של הרשת והכניסות נכנסות למנוע */
    @Volatile private var ready = false
    fun init(ctx: Context) {
        if (ready) return
        ready = true
        applyNet(ctx)
        DmNet.creds = { h -> DmCreds.find(ctx.applicationContext, h) }
    }

    fun applyNet(ctx: Context) {
        val p = DmPrefs4(ctx)
        DmNet.proxy = DmNet.parseProxy(p.proxy)
        DmNet.connectMs = p.connectS * 1000
        DmNet.readMs = p.readS * 1000
        DmNet.uaRules = DmNet.parseUa(p.ua)
    }

    /* ---------- 33/34/35: מדיה ---------- */

    /** מה שנבחר בגיליון לסרטון הבא (קטע, המרה, פרקים) — נקלט כשהמשימה נוספת (DmStore.add), עד 2 דק׳ */
    data class Video(val url: String, val s0: Int, val s1: Int, val cv: String, val chm: String, val priv: Boolean, val until: Long)
    @Volatile var nextVideo: Video? = null
    /** 29: "פרטי" להורדה הבאה של קובץ (מהגיליון) */
    @Volatile var nextPriv: Pair<String, Long>? = null

    fun onAdd(t: DmTask) {
        val now = System.currentTimeMillis()
        nextVideo?.let { v ->
            if (v.until > now && v.url == t.url && t.kind == DmKind.YTDL) {
                t.s0 = v.s0; t.s1 = v.s1; t.cv = v.cv; t.chm = v.chm; t.priv = v.priv
                if (DmConv.audio(v.cv)) { t.audioOnly = true; t.subs = "" }
                nextVideo = null
            }
        }
        nextPriv?.let { (u, until) -> if (until > now && u == t.url) { t.priv = true; nextPriv = null } }
    }

    /** הבורר ל־yt-dlp: קול להמרה → הקול הטוב ביותר; MP4 תואם → H.264 (DmCodec.COMPAT); אחרת "" (לפי מה שנבחר) */
    fun ytFormat(ctx: Context, t: DmTask, def: String): String = when {
        DmConv.audio(t.cv) -> "ba/b"
        t.cv == "mp4" && !t.audioOnly -> DmPlaylist.format(t.height, false, DmCodec.COMPAT)
        else -> def
    }

    fun ytExtra(t: DmTask): List<String> = DmConv.args(t.cv) + DmChap.args(t.chm)

    /**
     * אחרי yt-dlp, לפני ההעברה לגלריה: הפרקים מה־info.json, אינדקס כתוביות לחיפוש (34/37), ובמצב "קובץ לכל פרק" —
     * כל פרק נכנס כהורדה גמורה משלו (בתיקייה של ההורדה). הקובץ הראשי נשאר לקורא.
     */
    fun afterYt(ctx: Context, t: DmTask, main: File) {
        val dir = main.parentFile ?: return
        val files = dir.listFiles()?.toList() ?: return
        files.firstOrNull { it.name.endsWith(".info.json") }?.let { f ->
            val cs = DmChap.fromInfo(runCatching { if (f.length() < 8L shl 20) f.readText() else "" }.getOrNull())
            if (cs.isNotEmpty()) t.chp = DmChap.dump(cs)
        }
        // כתוביות שנשארו בתיקייה (כשהן לא נמחקו אחרי הצירוף) — לחיפוש בתוך הכתוביות
        files.filter { it.name.endsWith(".srt") || it.name.endsWith(".vtt") }.maxByOrNull { it.length() }?.let { s ->
            if (!t.priv && s.length() < 4L shl 20) runCatching { File(subDir(ctx).apply { mkdirs() }, t.id + ".srt").writeText(s.readText()) }
        }
        if (DmChap.norm(t.chm) == "split") {
            val parts = DmChap.files(files.map { it.name })
            val now = System.currentTimeMillis()
            parts.forEachIndexed { i, n ->
                val f = File(dir, n)
                if (f == main || !f.isFile) return@forEachIndexed
                val c = DmTask(DmStore.newId(), t.url + "#chapter=" + (i + 1), t.ref, DmKind.YTDL).apply {
                    title = n.substringBeforeLast('.'); audioOnly = t.audioOnly || DmConv.audio(t.cv); priv = t.priv; this.q = t.q; this.dir = t.dir
                    created = now + i; ruled = true
                }
                runCatching {
                    c.name = DmName.clean(n); c.mime = DmName.mimeOfExt(DmName.ext(c.name))
                    val u = DmMedia.pending(ctx, c)
                    ctx.contentResolver.openOutputStream(u, "w")?.use { o -> f.inputStream().use { it.copyTo(o, 1 shl 20) } }
                    c.total = f.length(); DmMedia.publish(ctx, c)
                    c.state = DmState.DONE; c.finishedAt = now + i
                    DmStore.add(c)
                }
                f.delete()
            }
        }
    }

    fun subDir(ctx: Context) = File(ctx.filesDir, "subidx")
    fun subsOf(ctx: Context, id: String): File = File(subDir(ctx), "$id.srt")

    /** 37: חיפוש בכתוביות של כל ההורדות (קבצים קטנים, בתוך האפליקציה). רץ בתהליכון */
    fun searchSubs(ctx: Context, q: String): List<DmSubIndex.Hit> {
        val docs = HashMap<String, List<DmSubIndex.Cue>>()
        DmStore.all().filter { it.state == DmState.DONE && !it.priv }.forEach { t ->
            val f = subsOf(ctx, t.id)
            if (f.isFile) docs[t.id] = DmSubIndex.parse(runCatching { f.readText() }.getOrDefault(""))
        }
        return DmSubIndex.search(q, docs)
    }

    /* ---------- 10/47: Metalink ומראות, אימות חלקים וסיכום ---------- */

    private fun piecesFile(ctx: Context, id: String) = File(File(ctx.filesDir, "meta4").apply { mkdirs() }, "$id.txt")
    private val rounds = HashMap<String, Int>()

    /** Metalink (טקסט או קובץ שירד) → משימה לכל קובץ, עם המראות, הסיכום והחלקים. מחזיר כמה נוספו */
    fun addMetalink(ctx: Context, xml: String, later: Boolean = false): Int {
        val fs = DmMeta4.parse(xml)
        val now = System.currentTimeMillis()
        var n = 0
        fs.forEachIndexed { i, f ->
            if (f.urls.isEmpty() || DmStore.has(f.urls[0])) return@forEachIndexed
            val t = DmTask(DmStore.newId(), f.urls[0], "", DmKind.HTTP).apply {
                name = DmName.clean(f.name); total = -1; mir = f.urls.joinToString("\n"); created = now + i; this.later = later
                dg = f.hashes["sha-256"]?.let { "SHA-256:$it" } ?: f.hashes["sha-512"]?.let { "SHA-512:$it" } ?: ""
                if (f.pieces.isNotEmpty()) { pl = f.pieceLen; pa = f.pieceAlgo }
            }
            if (f.pieces.isNotEmpty()) runCatching { piecesFile(ctx, t.id).writeText(DmMeta4.dumpPieces(f)) }
            DmStore.add(t); n++
        }
        if (n > 0) DmEngine.pump(ctx)
        return n
    }

    /** Metalink מקישור (.meta4) — מוריד את הקובץ הקטן ומוסיף. רץ בתהליכון. -1 = תקלה */
    fun addMetalinkUrl(ctx: Context, url: String): Int = runCatching {
        val txt = fetchText(url, 2 shl 20) ?: return -1
        if (!DmMeta4.looks(txt)) -1 else addMetalink(ctx, txt)
    }.getOrDefault(-1)

    enum class Check { OK, REDO, BAD }

    /**
     * בסוף הורדה רגילה, לפני השחרור לגלריה: חלקים שלא תואמים את ה־Metalink — יורדים שוב (עד 3 סבבים); אחר כך הסיכום של הקובץ
     * כולו (Repr-Digest או Metalink) — t.sum ok / bad. REDO = המקטעים הוחלפו בחלקים הפגומים, וההורדה חוזרת לתור.
     */
    fun verify(ctx: Context, t: DmTask): Check {
        val u = Uri.parse(t.uri)
        val pf = piecesFile(ctx, t.id)
        if (t.pl > 0 && pf.isFile && t.total > 0) {
            val pieces = DmMeta4.parsePieces(runCatching { pf.readText() }.getOrNull())
            val bad = runCatching { ctx.contentResolver.openInputStream(u)?.use { DmMeta4.badPieces(it, t.pl, t.pa, pieces) } }.getOrNull() ?: emptyList()
            if (bad.isNotEmpty()) {
                val r = synchronized(rounds) { (rounds[t.id] ?: 0) + 1 }.also { synchronized(rounds) { rounds[t.id] = it } }
                if (r <= 3) { t.segs = DmMeta4.redo(bad, t.pl, t.total); return Check.REDO }
                t.sum = "bad"; return Check.BAD
            }
        }
        synchronized(rounds) { rounds.remove(t.id) }
        val algo = DmDigest.algo(t.dg) ?: return Check.OK
        val got = runCatching { ctx.contentResolver.openInputStream(u)?.use { DmHash.digest(it, algo) } }.getOrNull() ?: return Check.OK
        t.sum = if (DmHash.matches(got, DmDigest.value(t.dg)) == true) "ok" else "bad"
        if (t.sum == "bad") note(ctx, t.id.hashCode() + 2, R.string.dmSumBadN, t.name)
        return if (t.sum == "ok") Check.OK else Check.BAD
    }

    fun forget(ctx: Context, id: String) { runCatching { piecesFile(ctx, id).delete() }; runCatching { subsOf(ctx, id).delete() } }

    /* ---------- 7/38: תור סנכרון ---------- */

    fun watches(ctx: Context) = DmWatches.parse(DmPrefs4(ctx).watches)
    fun saveWatches(ctx: Context, ws: List<DmWatch>) { DmPrefs4(ctx).watches = DmWatches.dump(ws); scheduleWatch(ctx) }

    fun scheduleWatch(ctx: Context) {
        val js = ctx.getSystemService(JobScheduler::class.java) ?: return
        val ws = watches(ctx)
        if (ws.isEmpty()) { js.cancel(WATCH_JOB); return }
        val min = DmWatches.nextMin(ws, System.currentTimeMillis()) ?: return
        runCatching {
            js.schedule(JobInfo.Builder(WATCH_JOB, ComponentName(ctx, DmWatchJob::class.java))
                .setMinimumLatency(min * 60_000L).setOverrideDeadline(min * 60_000L + 6 * 3_600_000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build())
        }
    }

    /** בדיקה של כל מה שהגיע זמנו (או של אחד — "לבדוק עכשיו"). רץ בתהליכון. מחזיר כמה הורדות חדשות נוספו */
    fun checkWatches(ctx: Context, only: String? = null): Int {
        DmStore.init(ctx); init(ctx)
        val now = System.currentTimeMillis()
        val all = watches(ctx)
        val due = if (only != null) all.filter { it.id == only } else DmWatches.due(all, now)
        var added = 0
        val upd = all.associateBy { it.id }.toMutableMap()
        for (w in due) {
            val r = runCatching { checkOne(ctx, w) }.getOrElse { w.copy(err = "fail") to 0 }
            upd[w.id] = r.first.copy(checked = now); added += r.second
        }
        val after = upd.values.toList().sortedBy { all.indexOfFirst { o -> o.id == it.id } }
        // מי ששינה את הרשימה בזמן הבדיקה — נשמר (רק מה שנבדק מתעדכן)
        val cur = watches(ctx).associateBy { it.id }
        saveWatches(ctx, cur.values.map { c -> after.firstOrNull { it.id == c.id } ?: c })
        if (added > 0) {
            DmEngine.pump(ctx)
            note(ctx, N_WATCH, R.string.dmWatchNewN, DmLang.wrap(ctx).resources.getQuantityString(R.plurals.dmWatchNewS, added, added))
        }
        return added
    }

    private fun checkOne(ctx: Context, w: DmWatch): Pair<DmWatch, Int> = when (w.kind) {
        "file" -> {
            val p = DmFetch.probeRetry(w.url, tries = 2)
            if (!DmWatches.changed(w, p.etag, p.lastMod, p.total)) w.copy(err = "") to 0
            else {
                val first = w.checked == 0L && w.etag.isEmpty() && w.lastMod.isEmpty() && w.size < 0
                val nw = w.copy(etag = p.etag, lastMod = p.lastMod, size = p.total, err = "", changed = System.currentTimeMillis())
                if (first) nw to 0 else { addFrom(ctx, w, listOf(w.url to w.name)); nw to 1 }
            }
        }
        "feed" -> {
            val txt = fetchText(DmFeed.youtubeFeed(w.url) ?: w.url, 4 shl 20) ?: return w.copy(err = "net") to 0
            val f = DmFeed.parse(txt) ?: return w.copy(err = "feed") to 0
            val ids = f.items.map { it.id }
            val fresh = DmWatches.fresh(w, ids).toSet()
            val items = f.items.filter { it.id in fresh && it.url.startsWith("http") }
            addFrom(ctx, w, items.map { it.url to it.title })
            w.copy(name = w.name.ifEmpty { f.title.take(80) }, seen = DmWatches.markSeen(w, ids), err = "") to items.size
        }
        else -> {
            val pl = DmPlaylist.parse(DlEngine.probePlaylist(ctx, w.url, "", null)) ?: return w.copy(err = "playlist") to 0
            val ids = pl.entries.map { it.url }
            val fresh = DmWatches.fresh(w, ids).toSet()
            val items = pl.entries.filter { it.url in fresh }
            addFrom(ctx, w, items.map { it.url to it.title })
            w.copy(name = w.name.ifEmpty { pl.title.take(80) }, seen = DmWatches.markSeen(w, ids), err = "") to items.size
        }
    }

    /** ההורדות מפריט במעקב — "אחר כך" (Wi‑Fi וטעינה), ושמירה של N האחרונים בלבד */
    private fun addFrom(ctx: Context, w: DmWatch, items: List<Pair<String, String>>) {
        val now = System.currentTimeMillis()
        items.forEachIndexed { i, (u, title0) ->
            val video = w.kind == "list" || (VideoUrl.classify(u) is VideoUrl.Hit.Video && DmName.cat(DmName.fromUrl(u), "") == DmName.Cat.OTHER)
            DmStore.add(DmTask(DmStore.newId(), u, "", if (video) DmKind.YTDL else DmKind.HTTP).apply {
                title = title0.take(200); wid = w.id; later = w.kind != "file"; created = now + i
                if (video) { audioOnly = w.audio; height = if (w.audio) 0 else w.height; if (w.audio) cv = "m4a" }
            })
        }
        if (w.keep > 0) DmStore.all().filter { it.wid == w.id && it.state == DmState.DONE }.sortedByDescending { it.finishedAt }
            .drop(w.keep).forEach { DmEngine.delete(ctx, it.id, true) }
    }

    /** טקסט קטן מהרשת (פיד, Metalink, דף לסריקה) — עד max בתים, null בתקלה */
    fun fetchText(url: String, max: Int, accept: (String) -> Boolean = { true }): String? = runCatching {
        val c = DmFetch.open(url, "", DmFetch.UA)
        try {
            if (c.responseCode !in 200..299 || !accept(c.contentType ?: "")) return null
            c.inputStream.use { s ->
                val b = java.io.ByteArrayOutputStream(); val buf = ByteArray(16 * 1024)
                while (b.size() < max) { val n = s.read(buf); if (n < 0) break; b.write(buf, 0, n) }
                b.toString("UTF-8")
            }
        } finally { c.disconnect() }
    }.getOrNull()

    /* ---------- 5: סורק אתר ---------- */

    @Volatile var crawlStop = false

    fun crawl(job: DmCrawlJob, onFound: (DmCrawl.Found) -> Unit, onPage: (Int) -> Unit): List<DmCrawl.Found> {
        crawlStop = false
        val robots = HashMap<String, DmRobots>()
        return DmCrawl.run(job,
            fetch = { u ->
                val html = fetchText(u, 3 shl 20) { it.isEmpty() || it.startsWith("text/html") || it.contains("xhtml") }
                DmCrawl.Page(u, html)
            },
            robots = { h -> robots.getOrPut(h) { DmRobots.parse(fetchText("https://$h/robots.txt", 256 * 1024) { !it.startsWith("text/html") }) } },
            sleep = { Thread.sleep(it) }, stop = { crawlStop }, onFound = onFound, onPage = onPage)
    }

    /* ---------- 11/12: QR ורשת הבית ---------- */

    fun qr(text: String, px: Int = 640): Bitmap {
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, px, px, mapOf(EncodeHintType.MARGIN to 1))
        val bm = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
        for (y in 0 until px) for (x in 0 until px) bm.setPixel(x, y, if (m[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
        return bm
    }

    /** כתובת ה־IPv4 של ה־Wi‑Fi (רשת פרטית בלבד), או null — אז אין העברה למחשב */
    fun wifiIp(ctx: Context): Inet4Address? {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return null
        val n = cm.activeNetwork ?: return null
        if (cm.getNetworkCapabilities(n)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) != true) return null
        return cm.getLinkProperties(n)?.linkAddresses?.map { it.address }?.filterIsInstance<Inet4Address>()
            ?.firstOrNull { DmLanServer.lanOk(it.hostAddress ?: "") }
    }

    @Volatile var lan: DmLanServer? = null

    /** שרת זמני לקובץ אחד ברשת הבית (נסגר אחרי העברה / 10 דק׳ / 5 PIN שגויים). null = לא ב־Wi‑Fi */
    fun lanStart(ctx: Context, t: DmTask, onEnd: (Boolean) -> Unit): Pair<DmLanServer, String>? {
        lan?.stop(false)
        val ip = wifiIp(ctx) ?: return null
        val cr = ctx.applicationContext.contentResolver
        val u = Uri.parse(t.uri)
        val s = DmLanServer(t.name.ifEmpty { "file" }, t.total.takeIf { it > 0 } ?: runCatching { cr.openFileDescriptor(u, "r")?.use { it.statSize } }.getOrNull() ?: -1,
            DmMedia.mimeFor(t.name, t.mime), open = { pos -> (cr.openInputStream(u) ?: throw java.io.IOException("gone")).also { if (pos > 0) skipFully(it, pos) } },
            onEnd = { ok -> lan = null; onEnd(ok) })
        s.start(ip)
        lan = s
        return s to s.url(ip.hostAddress ?: "")
    }

    private fun skipFully(i: java.io.InputStream, n: Long) {
        var left = n
        while (left > 0) { val k = i.skip(left); if (k <= 0) { if (i.read() < 0) throw java.io.EOFException(); left-- } else left -= k }
    }

    /* ---------- 24: נדידה ומצב חו"ל ---------- */

    fun roaming(ctx: Context): Boolean {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return false
        val c = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) && !c.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_ROAMING)
    }

    /** בתוך pump: true = רק Wi‑Fi עכשיו (נדידה בלי מצב חו"ל, או מצב חו"ל בלי חבילה). מצב חו"ל שפג — כבה לבד */
    fun travelWifiOnly(ctx: Context): Boolean {
        val p = DmPrefs4(ctx); val now = System.currentTimeMillis()
        if (DmTravel.expired(p.travelUntil, now)) p.travelUntil = 0
        return when (DmTravel.act(roaming(ctx), p.travelUntil, p.roamOk, now)) {
            DmTravel.Act.OK -> false
            DmTravel.Act.WIFI_ONLY -> true
            DmTravel.Act.ASK -> {
                if (now - p.roamAsked > 12 * 3_600_000L && DmStore.all().any { it.active }) { p.roamAsked = now; askTravel(ctx) }
                true
            }
        }
    }

    val travelPrompt = mutableStateOfCompat(false)
    private fun askTravel(ctx: Context) {
        travelPrompt.value = true
        note(ctx, N_ROAM, R.string.dmRoamN, DmLang.wrap(ctx).getString(R.string.dmRoamS), Intent(ctx, DmActivity::class.java).setAction(ACTION_TRAVEL))
    }
    const val ACTION_TRAVEL = "app.thesnowball.studiodm.TRAVEL"

    /* ---------- 41: סיכום יומי ---------- */

    fun daily(ctx: Context, bytes: Long, ms: Long, ok: Boolean?) {
        val p = DmPrefs4(ctx)
        val c = Calendar.getInstance()
        val day = c.get(Calendar.YEAR) * 1000 + c.get(Calendar.DAY_OF_YEAR)
        val (_, prev) = synchronized(this) { DmDaily.add(DmDaily.parse(p.daily), day, bytes, ms, ok).also { p.daily = DmDaily.dump(it.first) } }
        if (prev != null && p.dailyOn && DmDaily.worth(prev)) {
            val x = DmLang.wrap(ctx)
            note(ctx, N_DAILY, R.string.dmDailyN, x.getString(R.string.dmDailyS, prev.done, DmFmt.size(x, prev.bytes), DmFmt.speed(x, DmDaily.avg(prev)), prev.failed))
        }
    }

    /* ---------- 28: ניקוי אוטומטי ---------- */

    fun autoClean(ctx: Context) {
        val d = DmPrefs4(ctx).cleanDays
        if (d <= 0) return
        DmLib.stale(DmStore.all().filter { !it.priv }, d, System.currentTimeMillis()).forEach { DmEngine.delete(ctx, it, false) }
    }

    /* ---------- 30: חריגים ---------- */

    fun excluded(ctx: Context, url: String) = url.isNotEmpty() && DmExcl.blocked(url, DmExcl.parse(DmPrefs4(ctx).excl))

    /* ---------- 29: מצב פרטי ---------- */

    fun vaultAuth(ctx: Context) = ctx.packageName + ".vault"
    fun isVault(ctx: Context, u: Uri) = u.authority == vaultAuth(ctx)
    private fun vaultDir(ctx: Context) = File(ctx.filesDir, "vault").apply { mkdirs() }

    /** קובץ חדש בתיקייה הנעולה (בתוך האפליקציה, לא בגלריה, לא בגיבוי) — FileProvider כדי שהמנוע יכתוב במיקום */
    fun vaultUri(ctx: Context, t: DmTask): Uri {
        val d = vaultDir(ctx)
        var f = File(d, DmName.clean(t.name.ifEmpty { "file" }))
        var i = 1
        while (f.exists()) f = File(d, DmName.clean(t.name).let { n -> n.substringBeforeLast('.', n) + " ($i)" + (DmName.ext(n).takeIf { it.isNotEmpty() }?.let { ".$it" } ?: "") }).also { i++ }
        f.createNewFile()
        return FileProvider.getUriForFile(ctx, vaultAuth(ctx), f)
    }

    /* ---------- 40: התראה עשירה ---------- */

    /** שורה מורחבת להורדה אחת: מפת המקטעים בתווים, מהירות וזמן שנותר */
    fun richText(ctx: Context, t: DmTask): String {
        val parts = ArrayList<String>()
        if (t.kind == DmKind.HTTP && t.total > 0 && t.segs.isNotEmpty()) {
            val cells = 24
            val sb = StringBuilder()
            for (i in 0 until cells) {
                val a = t.total * i / cells; val b = t.total * (i + 1) / cells
                val done = t.segs.sumOf { s -> val lo = maxOf(a, s.start); val hi = minOf(b, s.start + s.done.coerceAtMost(s.end - s.start)); (hi - lo).coerceAtLeast(0) }
                sb.append(if (done >= (b - a) * 0.95) '█' else if (done > 0) '▓' else '░')
            }
            parts.add(sb.toString())
        }
        val sp = DmEngine.speed[t.id] ?: 0L
        if (sp > 0) parts.add(DmFmt.speed(ctx, sp))
        if (sp > 0 && t.total > 0) parts.add(DmFmt.left(ctx, (t.total - t.got) / sp))
        val c = DmEngine.connsOf(t.id)
        if (c > 0) parts.add(ctx.getString(R.string.dmNConns, c))
        return parts.joinToString("  ·  ")
    }

    /** "מהר יותר": כמה שיותר חיבורים להורדה הזו — עוצרים ומתחילים מאותו בייט */
    fun faster(ctx: Context, id: String) {
        val t = DmStore.get(id) ?: return
        if (t.kind != DmKind.HTTP) return
        t.conns = DmSegs.MAX_CONNS; DmStore.save()
        DmEngine.stopSys(id)
    }

    /* ---------- 27: ווידג'ט ---------- */

    @Volatile private var lastWidget = 0L
    fun widget(ctx: Context, force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastWidget < 5000) return
        lastWidget = now
        val am = AppWidgetManager.getInstance(ctx) ?: return
        val ids = runCatching { am.getAppWidgetIds(ComponentName(ctx, DmWidget::class.java)) }.getOrNull() ?: return
        if (ids.isEmpty()) return
        val x = DmLang.wrap(ctx)
        val all = DmStore.all()
        val run = all.count { it.state == DmState.RUNNING }
        val wait = all.count { it.state == DmState.QUEUED || it.state == DmState.WAITING }
        val line = if (run + wait == 0) x.getString(R.string.dmWidgetIdle)
            else x.getString(R.string.dmWidgetLine, run, wait) + (DmEngine.speed.values.sum().takeIf { it > 0 }?.let { " · " + DmFmt.speed(x, it) } ?: "")
        val v = RemoteViews(ctx.packageName, R.layout.dm_widget)
        v.setTextViewText(R.id.dmwTitle, x.getString(R.string.app_name))
        v.setTextViewText(R.id.dmwText, line)
        v.setTextViewText(R.id.dmwPaste, x.getString(R.string.dmWidgetPaste))
        v.setTextViewText(R.id.dmwPause, x.getString(if (run > 0) R.string.dmPauseAll else R.string.dmResumeAll))
        v.setOnClickPendingIntent(R.id.dmwPaste, PendingIntent.getActivity(ctx, 61, Intent(ctx, DmActivity::class.java).setAction(DmTile.ACTION_CLIP)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE))
        v.setOnClickPendingIntent(R.id.dmwPause, PendingIntent.getBroadcast(ctx, 62, Intent(ctx, DmAct::class.java)
            .setAction(if (run > 0) DmAct.PAUSE_ALL else DmAct.RESUME_ALL), PendingIntent.FLAG_IMMUTABLE))
        v.setOnClickPendingIntent(R.id.dmwLine, PendingIntent.getActivity(ctx, 63, Intent(ctx, DmActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE))
        runCatching { am.updateAppWidget(ids, v) }
    }

    /* ---------- התראות קצרות ---------- */

    fun note(ctx0: Context, id: Int, title: Int, text: String, open: Intent? = null) {
        val ctx = DmLang.wrap(ctx0)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel("dm_done", ctx.getString(R.string.dmChDone), NotificationManager.IMPORTANCE_DEFAULT))
        val i = (open ?: Intent(ctx, DmActivity::class.java)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        nm.notify(id, android.app.Notification.Builder(ctx, "dm_done").setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(ctx.getString(title)).setContentText(text).setStyle(android.app.Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true).setContentIntent(PendingIntent.getActivity(ctx, id, i, PendingIntent.FLAG_IMMUTABLE)).build())
    }
}

/** מצב Compose שאפשר להחזיק באובייקט (בלי תלות בממשק בקבצים האחרים) */
fun <T> mutableStateOfCompat(v: T) = androidx.compose.runtime.mutableStateOf(v)

/** 7/38: משימת המערכת של תור הסנכרון — בלי שעון מדויק, המערכת בוחרת את הרגע (חלון של עד 6 שעות) */
class DmWatchJob : JobService() {
    override fun onStartJob(p: JobParameters): Boolean {
        Thread {
            runCatching { DmR4.checkWatches(applicationContext) }
            DmR4.scheduleWatch(applicationContext)
            jobFinished(p, false)
        }.apply { isDaemon = true; name = "dm-watch" }.start()
        return true
    }
    override fun onStopJob(p: JobParameters) = true
}

/** 27: ווידג'ט במסך הבית — מצב, הדבקה מהלוח, עצירה / המשך של הכל */
class DmWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, am: AppWidgetManager, ids: IntArray) { DmStore.init(ctx); DmR4.widget(ctx, true) }
}

/**
 * 18: כניסות לאתרים. הסיסמאות מוצפנות במפתח AES של Keystore (לא יוצא מהמכשיר, לא בגיבוי); בזיכרון — רק בזמן השימוש.
 * לא נכנסות ליומן, לייצוא או לסנכרון.
 */
object DmCreds {
    private const val ALIAS = "dm_creds"
    @Volatile private var cache: List<DmCred>? = null

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return g.generateKey()
    }

    fun all(ctx: Context): List<DmCred> = cache ?: runCatching {
        val s = DmPrefs4(ctx).creds
        if (s.isEmpty()) return emptyList()
        val raw = Base64.decode(s, Base64.NO_WRAP)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw.copyOfRange(0, 12)))
        val a = JSONArray(String(c.doFinal(raw.copyOfRange(12, raw.size)), Charsets.UTF_8))
        (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { o -> DmCred(o.optString("h"), o.optString("u"), o.optString("p")).takeIf { it.host.isNotEmpty() } } }
    }.getOrDefault(emptyList()).also { cache = it }

    fun save(ctx: Context, cs: List<DmCred>) {
        val a = JSONArray(); cs.take(50).forEach { a.put(JSONObject().put("h", it.host).put("u", it.user).put("p", it.pass)) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key())
        val out = c.iv + c.doFinal(a.toString().toByteArray(Charsets.UTF_8))
        DmPrefs4(ctx).creds = if (cs.isEmpty()) "" else Base64.encodeToString(out, Base64.NO_WRAP)
        cache = cs
    }

    fun find(ctx: Context, host: String): DmCred? = all(ctx).firstOrNull { it.host == host }
}

/** 29: ספק הקבצים של הכספת — מחלקה משלו (במניפסט כבר יש FileProvider אחר, של מסך הפתיחה) */
class DmVaultProvider : FileProvider()
