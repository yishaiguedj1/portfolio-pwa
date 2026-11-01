package io.github.yishaiguedj1.snowball.dm

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import java.io.FileInputStream
import java.io.IOException
import java.net.URL
import java.nio.ByteBuffer
import java.util.TimeZone
import java.util.concurrent.ConcurrentHashMap

/*
 * 01/11/2026 — השדרוג "מקצועי", סבב 2: השכבה של אנדרואיד. החלק הטהור (הכללים) ב־dmcore/DmRound2.kt.
 */

/**
 * Wi‑Fi וסלולר יחד (פריט 1, לפי ת־הורדות): כשההגדרה דלוקה והטלפון ב־Wi‑Fi — מבקשים מהמערכת גם את הרשת הסלולרית
 * (requestNetwork — בלי לנתק את ה־Wi‑Fi), וכל חיבור שני של ההורדה נפתח דרכה (Network.openConnection).
 * נספר נפח סלולרי יומי, ובתקרה — חוזרים ל־Wi‑Fi בלבד. הרשת משוחררת כשאין הורדה שמשתמשת בה.
 */
object DmBondNet {
    @Volatile private var net: Network? = null
    @Volatile private var cb: ConnectivityManager.NetworkCallback? = null
    private var users = 0

    fun onWifi(ctx: Context): Boolean = runCatching {
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        cm.getNetworkCapabilities(cm.activeNetwork)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }.getOrDefault(false)

    @Synchronized fun acquire(ctx: Context) {
        users++
        if (cb != null) return
        val cm = ctx.applicationContext.getSystemService(ConnectivityManager::class.java) ?: return
        val c = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { net = network }
            override fun onLost(network: Network) { if (net == network) net = null }
        }
        cb = c
        runCatching {
            cm.requestNetwork(NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), c)
        }.onFailure { cb = null }
    }

    @Synchronized fun release(ctx: Context) {
        users = (users - 1).coerceAtLeast(0)
        if (users > 0) return
        val c = cb ?: return
        cb = null; net = null
        runCatching { ctx.applicationContext.getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(c) }
    }

    /** הנפח הסלולרי היום (מאופס בכל יום חדש) */
    fun usedToday(pr: DmPrefs): Long {
        val d = DmBond.day(System.currentTimeMillis(), TimeZone.getDefault().getOffset(System.currentTimeMillis()).toLong())
        if (pr.bondDay != d) { pr.bondDay = d; pr.bondUsed = 0 }
        return pr.bondUsed
    }

    fun add(pr: DmPrefs, bytes: Long) { if (bytes > 0) { usedToday(pr); pr.bondUsed = pr.bondUsed + bytes } }

    /** ל־DmFetch: החיבור הזה ברשת הסלולרית, או null = הרגילה */
    fun route(ctx: Context, pr: DmPrefs, conns: Int): (Int) -> ((URL) -> java.net.URLConnection)? = { slot ->
        val n = net
        if (n != null && DmBond.cellular(slot, conns, pr.bond, onWifi(ctx), usedToday(pr), pr.bondCapMb)) { u: URL -> n.openConnection(u) } else null
    }
}

/**
 * רענון אוטומטי של קישור שפג (פריט 8): הורדה שנכשלה ב־"פג תוקף" ויש לה דף — הדף נטען ברקע ב־WebView בלי מסך
 * (עם העוגיות של DM), נאספים הקישורים שהדף מבקש ומקשר אליהם, וכל אחד נבדק. אותו גודל בדיוק (DmRefresh.pick) = אותו קובץ:
 * הכתובת מוחלפת וההורדה ממשיכה מאותו בייט. עד פעמיים להורדה; אחרי זה — "רענון קישור" ידני.
 */
object DmAutoRefresh {
    private const val WAIT_MS = 14_000L
    private const val MAX_CANDS = 30
    private val busy = ConcurrentHashMap.newKeySet<String>()

    fun busy(id: String) = id in busy

    @SuppressLint("SetJavaScriptEnabled")
    fun start(ctx: Context, t: DmTask) {
        if (!DmRefresh.worth(t) || !busy.add(t.id)) return
        t.autoRefresh++; DmStore.save(); DmStore.ping()
        val app = ctx.applicationContext
        val seen = java.util.Collections.synchronizedSet(LinkedHashSet<String>())
        val main = Handler(Looper.getMainLooper())
        main.post {
            val w = runCatching { WebView(app) }.getOrNull() ?: run { busy.remove(t.id); return@post }
            w.settings.javaScriptEnabled = true
            w.settings.domStorageEnabled = true
            w.settings.mediaPlaybackRequiresUserGesture = true
            if (t.ua.isNotEmpty()) w.settings.userAgentString = t.ua
            w.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? {
                    r.url?.toString()?.takeIf { it.startsWith("http") }?.let { if (seen.size < 2000) seen.add(it) }
                    return null
                }
            }
            val js = "(function(){try{return JSON.stringify(Array.from(document.querySelectorAll('a[href],video[src],source[src],audio[src]')).map(function(e){return e.href||e.src}).slice(0,2000))}catch(x){return '[]'}})()"
            fun grab() = w.evaluateJavascript(js) { s ->
                runCatching { org.json.JSONArray(org.json.JSONArray("[$s]").optString(0)) }.getOrNull()?.let { a -> for (i in 0 until a.length()) a.optString(i).takeIf { it.startsWith("http") }?.let { seen.add(it) } }
            }
            w.loadUrl(t.ref)
            main.postDelayed({ grab() }, WAIT_MS / 2)
            main.postDelayed({
                grab()
                main.postDelayed({
                    runCatching { w.stopLoading(); w.destroy() }
                    Thread { finish(app, t, seen.toList()) }.apply { isDaemon = true; name = "dm-refresh" }.start()
                }, 400)
            }, WAIT_MS)
        }
    }

    private fun finish(ctx: Context, t: DmTask, all: List<String>) {
        try {
            val e = DmName.ext(t.name)
            val cat = DmName.cat(t.name, t.mime)
            val cands = all.asSequence().filter { it != t.url }.filter { u ->
                val n = DmName.fromUrl(u); val x = DmName.ext(n)
                x.isEmpty() || x == e || DmName.cat(n, "") == cat
            }.distinct().take(MAX_CANDS).toList()
            val ck = DmEngine.cookiesOf(t)
            val probed = ArrayList<Pair<String, DmProbe>>()
            for (u in cands) {
                val p = runCatching { DmFetch.probe(u, t.ref, t.ua.ifEmpty { DmFetch.UA }, ck) }.getOrNull() ?: continue
                probed.add(u to p)
                if (DmRefresh.pick(t, probed) != null && p.ranges) break
            }
            val hit = DmRefresh.pick(t, probed) ?: run { DmNotif.failed(ctx, t); return }
            if (t.state != DmState.FAILED) return
            t.url = hit.first
            if (hit.second.etag.isNotEmpty()) t.etag = hit.second.etag
            t.err = ""; t.state = DmState.QUEUED
            DmStore.save(); DmEngine.pump(ctx)
        } catch (e: Throwable) { runCatching { DmNotif.failed(ctx, t) }
        } finally { busy.remove(t.id); DmStore.ping() }
    }
}

/**
 * צפייה תוך כדי הורדה (פריט 9): מקור לנגן (Media3) שקורא מהקובץ שבכתיבה — רק בתים שכבר ירדו (DmGrow). כשהנגן צריך נקודה
 * שעוד לא ירדה (קפיצה קדימה, או מידע של MP4 שבסוף הקובץ), ההורדה מקבלת את הנקודה (DmEngine.want) ופותחת חיבור משם.
 */
@OptIn(markerClass = [UnstableApi::class])
class DmGrowSource(private val ctx: Context, private val id: String) : BaseDataSource(false) {
    private var pfd: ParcelFileDescriptor? = null
    private var ch: java.nio.channels.FileChannel? = null
    private var pos = 0L
    private var left = 0L
    private var uri: Uri? = null

    private fun task() = DmStore.get(id)

    override fun open(spec: DataSpec): Long {
        transferInitializing(spec)
        val t = task() ?: throw IOException("gone")
        val u = Uri.parse(t.uri.ifEmpty { throw IOException("no_file") })
        uri = u
        pfd = ctx.contentResolver.openFileDescriptor(u, "r") ?: throw IOException("no_file")
        ch = FileInputStream(pfd!!.fileDescriptor).channel
        pos = spec.position
        val total = t.total
        left = if (spec.length != C.LENGTH_UNSET.toLong()) spec.length else if (total > 0) total - pos else C.LENGTH_UNSET.toLong()
        if (total in 1..pos) throw IOException("eof")
        transferStarted(spec)
        return left
    }

    override fun read(buf: ByteArray, off: Int, len: Int): Int {
        if (len == 0) return 0
        if (left == 0L) return C.RESULT_END_OF_INPUT
        val t = task() ?: throw IOException("gone")
        val c = ch ?: throw IOException("closed")
        var waited = 0L
        while (true) {
            val a = runCatching { DmGrow.avail(ArrayList(t.segs), t.total, pos) }.getOrDefault(0L)
                .let { if (t.state == DmState.DONE && t.total > 0) t.total - pos else it }
            if (a > 0) {
                DmEngine.want.remove(id)
                var n = minOf(len.toLong(), a).toInt()
                if (left > 0) n = minOf(n.toLong(), left).toInt()
                val r = c.read(ByteBuffer.wrap(buf, off, n), pos)
                if (r <= 0) { Thread.sleep(50); waited += 50; if (waited > 60_000) throw IOException("stall"); continue }
                pos += r; if (left > 0) left -= r
                bytesTransferred(r)
                return r
            }
            if (t.total in 1..pos) return C.RESULT_END_OF_INPUT
            // עוד לא ירד: מבקשים מההורדה להתחיל מכאן, ומחכים (עצרו את ההורדה — ממשיכים אותה)
            DmEngine.want[id] = pos
            if (t.state == DmState.PAUSED) DmEngine.resume(ctx, id)
            if (t.state == DmState.FAILED) throw IOException("failed")
            Thread.sleep(120); waited += 120
            if (waited > 90_000) throw IOException("stall")
        }
    }

    override fun getUri(): Uri? = uri

    override fun close() {
        DmEngine.want.remove(id)
        runCatching { ch?.close() }; runCatching { pfd?.close() }
        ch = null; pfd = null
        if (uri != null) { uri = null; transferEnded() }
    }

    class Factory(private val ctx: Context, private val id: String) : DataSource.Factory {
        override fun createDataSource(): DataSource = DmGrowSource(ctx, id)
    }
}
