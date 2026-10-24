package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import io.github.yishaiguedj1.snowball.DlEngine
import java.util.concurrent.ConcurrentHashMap

/**
 * התור: עד `parallel` הורדות בבת אחת, כל אחת בתהליכון משלה. קובץ ישיר — DmFetch (בחלקים, המשך מאותו בייט);
 * דף וידאו — yt-dlp בטלפון (DlEngine, אותו מנוע של Studio). "רק Wi‑Fi" — ממתינה עד שיש רשת לא מוגבלת.
 * התהליך נשאר חי בזכות DmJob (UIDT, אנדרואיד 14+) או DmService (שירות בחזית) — DmRun מחליט.
 */
object DmEngine {
    private val running = ConcurrentHashMap<String, Runner>()
    @Volatile private var netCb: ConnectivityManager.NetworkCallback? = null
    /** מהירות לכל משימה (בתים לשנייה), לממשק בלבד */
    val speed = ConcurrentHashMap<String, Long>()
    /** yt-dlp: השלב שרץ (מתחבר / מוריד / ממזג…) והזמן שנותר לפי yt-dlp — לשורת המצב (DmYt) */
    val ytStage = ConcurrentHashMap<String, DmYt.Stage>()
    val ytEta = ConcurrentHashMap<String, Long>()

    private class Runner(val id: String) {
        @Volatile var stop = false
        @Volatile var system = false   // המערכת עצרה (Job/רשת) — חוזר לתור, לא "מושהה"
    }

    fun busy() = running.isNotEmpty()
    fun hasWork() = DmStore.all().any { it.state == DmState.QUEUED || it.state == DmState.RUNNING || it.state == DmState.WAITING }

    /** מתחיל מה שאפשר מהתור */
    @Synchronized
    fun pump(ctx: Context) {
        val app = ctx.applicationContext
        DmStore.init(app)
        val pr = DmPrefs(app)
        val okNet = netOk(app, pr.wifiOnly)
        DmLimit.bytesPerSec = pr.limit
        // הישנה קודם; עד `parallel` בבת אחת ולכל היותר DmLink.PER_HOST מאותו אתר
        val queued = DmStore.all().reversed().filter { !running.containsKey(it.id) && (it.state == DmState.QUEUED || it.state == DmState.WAITING) }
        if (!okNet) queued.forEach { t -> if (t.state != DmState.WAITING) { t.state = DmState.WAITING; t.err = if (pr.wifiOnly) "wifi" else "net"; DmStore.save() } }
        else {
            val run = running.keys.mapNotNull { DmStore.get(it)?.url }
            DmLink.pickStart(queued.map { it.url }, run, pr.parallel - running.size).forEach { start(app, queued[it], pr) }
        }
        watchNet(app)
        if (hasWork()) DmRun.ensure(app) else DmRun.idle(app)
        DmNotif.update(app)
    }

    private fun start(ctx: Context, t: DmTask, pr: DmPrefs) {
        val r = Runner(t.id)
        running[t.id] = r
        t.state = DmState.RUNNING; t.err = ""
        DmStore.save()
        Thread {
            val host = DmLink.host(t.url)
            val conns = DmHostRules.conns(hostRule(pr, host), pr.conns)
            val end = try { if (t.kind == DmKind.YTDL) runYt(ctx, t, r) else runHttp(ctx, t, r, conns, pr, host) } catch (e: Throwable) { "fail" }
            running.remove(t.id); speed.remove(t.id); ytStage.remove(t.id); ytEta.remove(t.id)
            when {
                end == null -> {
                    t.state = DmState.DONE; t.finishedAt = System.currentTimeMillis(); t.err = ""; DmNotif.done(ctx, t)
                    // "להוריד ולתרגם": DM פתוח מול המשתמש — ממשיכים ל־Studio מיד (מהרקע אנדרואיד לא מרשה; אז ההתראה)
                    if (t.tr && DmActivity.visible) android.os.Handler(android.os.Looper.getMainLooper()).post {
                        runCatching { ctx.startActivity(DmNotif.studioSend(t)) }
                    }
                }
                r.system || end == "stopped_sys" -> { t.state = DmState.QUEUED }
                end == "stopped" -> { t.state = DmState.PAUSED }
                else -> { t.state = DmState.FAILED; t.err = end; t.tries++; DmNotif.failed(ctx, t) }
            }
            DmStore.save()
            pump(ctx)
        }.apply { isDaemon = true; name = "dm-${t.id}" }.start()
    }

    /** null = הסתיים; אחרת קוד */
    private fun hostRule(pr: DmPrefs, host: String) = synchronized(this) { DmHostRules.parse(pr.hostRules)[host] ?: 0 }

    /** אחרי הורדה: האתר הגביל? פחות חיבורים בפעם הבאה; נקייה — צעד חזרה למעלה */
    private fun learnHost(pr: DmPrefs, host: String, used: Int, throttled: Boolean) = synchronized(this) {
        if (host.isEmpty()) return@synchronized
        val m = DmHostRules.parse(pr.hostRules)
        val n = DmHostRules.next(m[host] ?: 0, used, throttled, pr.conns)
        if (n == (m[host] ?: 0)) return@synchronized
        m.remove(host); if (n > 0) m[host] = n
        pr.hostRules = DmHostRules.dump(m)
    }

    private fun runHttp(ctx: Context, t: DmTask, r: Runner, conns: Int, pr: DmPrefs, host: String): String? {
        if (t.total < 0 || t.name.isEmpty() || t.segs.isEmpty()) {
            val p = try { DmFetch.probeRetry(t.url, t.ref, uaOf(t), cookies = cookiesOf(t)) } catch (e: Throwable) {
                return if (r.stop) "stopped" else (if (e is DmHttpError) DmRetry.http(e.status) else DmRetry.io(e)).code
            }
            if (t.name.isEmpty()) t.name = DmName.pick(p.disposition, p.finalUrl, p.mime)
            if (t.mime.isEmpty()) t.mime = p.mime
            t.total = p.total; t.ranges = p.ranges; t.etag = p.etag; t.lastMod = p.lastMod   // t.url נשאר המקורי (ראו DmActivity.probe)
            if (p.mime == "text/html") return "page"   // דף ולא קובץ — הגיליון מציע yt-dlp
        }
        val u = DmMedia.pending(ctx, t)
        DmStore.save()
        val sink = DmMedia.Sink(ctx, u)
        try {
            val f = DmFetch(t, sink, conns, uaOf(t), cookies = cookiesOf(t))
            var lastB = 0L; var lastT = System.currentTimeMillis()
            val res = f.run({ r.stop }) {
                val now = System.currentTimeMillis()
                speed[t.id] = ((f.bytes - lastB) * 1000 / (now - lastT).coerceAtLeast(1))
                lastB = f.bytes; lastT = now
                DmStore.save(); DmNotif.update(ctx)
            }
            if (t.ranges && res !is DmFetch.Result.Stopped) learnHost(pr, host, conns, f.throttled)
            return when (res) {
                is DmFetch.Result.Done -> { sink.close(); DmMedia.publish(ctx, t); null }
                is DmFetch.Result.Stopped -> if (r.system) "stopped_sys" else "stopped"
                is DmFetch.Result.Failed -> res.code
            }
        } finally { sink.close() }
    }

    private fun runYt(ctx: Context, t: DmTask, r: Runner): String? {
        val pick = DlEngine.Pick(t.vf, t.af, t.height.coerceAtLeast(0), 0, 0)
        val fmt = if (t.audioOnly) "ba/b" else ""
        var lastP = 0L
        val pr = DmYt.Progress(if (t.audioOnly || t.af.isEmpty()) 1 else 2, t.pctYt)
        ytStage[t.id] = pr.stage
        val stopWatch = Thread {
            while (!r.stop && running.containsKey(t.id)) Thread.sleep(300)
            if (r.stop) DlEngine.cancel("dm-" + t.id)
        }.apply { isDaemon = true; start() }
        return try {
            // כל שורה של yt-dlp → שלב ואחוז של כל ההורדה (וידאו ואחריו קול); האחוז שלו לבדו מתאפס בכל חלק
            val f = DlEngine.download(ctx, t.url, t.ref, pick, "dm-" + t.id, fmt, onLine = ln@{ line ->
                if (!pr.feed(line)) return@ln
                val now = System.currentTimeMillis()
                val moved = ytStage.put(t.id, pr.stage) != pr.stage
                if (pr.frac >= 0f) {
                    t.pctYt = pr.frac
                    t.bytesYt = if (t.total > 0) (t.total * pr.frac).toLong() else 0
                }
                if (pr.bps > 0) speed[t.id] = pr.bps else if (pr.stage != DmYt.Stage.DL) speed.remove(t.id)
                if (pr.eta >= 0) ytEta[t.id] = pr.eta else ytEta.remove(t.id)
                if (moved || now - lastP > 2000) { lastP = now; DmStore.save(); DmNotif.update(ctx) }
            }) { _, _ -> }
            DmMedia.importFile(ctx, t, f)
            null
        } catch (e: IllegalArgumentException) {
            val c = e.message ?: "fail"
            if (c == "cancel") (if (r.system) "stopped_sys" else "stopped") else c
        } finally { stopWatch.interrupt() }
    }

    fun uaOf(t: DmTask) = t.ua.ifEmpty { DmFetch.UA }

    /** עוגיות רק להורדה שהתחילה בדפדפן של DM — מה־CookieManager באותו רגע, לכל כתובת בנפרד (גם אחרי הפניה) */
    fun cookiesOf(t: DmTask): ((String) -> String?)? = if (!t.ck) null else { u -> runCatching { android.webkit.CookieManager.getInstance().getCookie(u) }.getOrNull() }

    fun pause(ctx: Context, id: String) {
        val r = running[id]
        if (r != null) r.stop = true
        else DmStore.get(id)?.let { if (it.active) { it.state = DmState.PAUSED; DmStore.save() } }
        DmNotif.update(ctx)
    }

    /** עצירה של כל מה שרץ / בתור (שורת התפריט) */
    fun pauseAll(ctx: Context) {
        running.values.forEach { it.stop = true }
        DmStore.all().forEach { if (it.state == DmState.QUEUED || it.state == DmState.WAITING) it.state = DmState.PAUSED }
        DmStore.save(); DmNotif.update(ctx)
    }

    /** המשך של כל מה שנעצר או נכשל — לפי התור, עם אותן מגבלות (במקביל, לכל אתר, רשת) */
    fun resumeAll(ctx: Context) {
        DmStore.all().forEach { if (it.state == DmState.PAUSED || it.state == DmState.FAILED) { it.state = DmState.QUEUED; it.err = "" } }
        DmStore.save(); pump(ctx)
    }

    fun startFirst(ctx: Context, id: String) {
        DmStore.moveFirst(id)
        DmStore.get(id)?.let { if (it.state == DmState.PAUSED || it.state == DmState.FAILED) { it.state = DmState.QUEUED; it.err = "" } }
        DmStore.save(); pump(ctx)
    }

    fun resume(ctx: Context, id: String) {
        DmStore.get(id)?.let { if (it.state == DmState.PAUSED || it.state == DmState.FAILED) { it.state = DmState.QUEUED; it.err = "" } }
        DmStore.save(); pump(ctx)
    }

    fun delete(ctx: Context, id: String, file: Boolean) {
        running[id]?.stop = true
        val t = DmStore.get(id) ?: return
        Thread {
            var n = 0
            while (running.containsKey(id) && n++ < 50) Thread.sleep(100)
            if (file || t.state != DmState.DONE) DmMedia.delete(ctx, t)
            DmStore.remove(id); DmNotif.update(ctx)
        }.start()
    }

    /** המערכת עוצרת (Job נעצר / זמן השירות נגמר): הכל חוזר לתור, מהמקטעים השמורים */
    fun stopAllSystem() { running.values.forEach { it.system = true; it.stop = true } }

    fun netOk(ctx: Context, wifiOnly: Boolean): Boolean {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return false
        return !wifiOnly || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }

    /** רשת חזרה / Wi‑Fi התחבר — ממשיכים לבד */
    private fun watchNet(ctx: Context) {
        if (netCb != null) return
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { if (hasWork()) pump(ctx) }
            override fun onCapabilitiesChanged(network: Network, nc: NetworkCapabilities) { if (DmStore.all().any { it.state == DmState.WAITING }) pump(ctx) }
            override fun onLost(network: Network) {
                // "רק Wi‑Fi" ועברנו לסלולר — עוצרים בלי לסמן כמושהה (DmFetch שומר וחוזר לתור)
                if (DmPrefs(ctx).wifiOnly && !netOk(ctx, true)) running.values.forEach { it.system = true; it.stop = true }
            }
        }
        runCatching { cm.registerDefaultNetworkCallback(cb); netCb = cb }
    }
}
