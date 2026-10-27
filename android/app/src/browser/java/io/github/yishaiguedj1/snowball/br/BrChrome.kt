package io.github.yishaiguedj1.snowball.br

import android.app.Activity
import android.content.Context
import android.content.IntentSender
import android.os.Handler
import android.os.Looper
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Tasks
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 26/10/2026 (בקשת המשתמש: "סנכרון אוטומטי עם Chrome, לכל המשתמשים"): הסימניות וההיסטוריה עם Chrome דרך התוסף
 * במחשב (android/chrome-ext). הקבצים ב־appDataFolder של Google Drive של המשתמש — לא בשרת שלנו; הרשאה drive.appdata בלבד.
 *
 * Chrome הוא המקור: התוסף לבד כותב את state.json. כאן כותבים רק ops.json — מה שקרה בטלפון (נוספה / נמחקה, וביקורים)
 * — והתוסף מחיל את זה על Chrome. אחרי כל סנכרון הסימניות כאן = BrSync.applyState(המצב, מה שעוד לא אושר).
 */
object BrChrome {
    const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
    private const val API = "https://www.googleapis.com/drive/v3/files"
    private const val UP = "https://www.googleapis.com/upload/drive/v3/files"
    const val EXT_ZIP = "https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/studio-browser-chrome.zip"
    private const val VIS_MAX = 500
    private const val MIN_GAP = 60_000L

    private lateinit var dir: File
    private lateinit var sp: android.content.SharedPreferences
    private val ui = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private val ops = ArrayList<BrSync.Op>()
    private val vis = ArrayList<BrVisit>()
    @Volatile private var busy = false
    private var lastRun = 0L
    var onChange: (() -> Unit)? = null

    val on get() = ::sp.isInitialized && sp.getBoolean("on", false)
    /** מתי התוסף כתב לאחרונה (0 = עוד לא הגיע ממנו כלום), מתי סנכרנו כאן, והשגיאה האחרונה (קוד) */
    val stateAt get() = sp.getLong("sat", 0L)
    val syncAt get() = sp.getLong("at", 0L)
    val err: String get() = sp.getString("err", "") ?: ""
    var marksOn: Boolean get() = sp.getBoolean("pm", true); set(v) { sp.edit().putBoolean("pm", v).apply() }
    var histOn: Boolean get() = sp.getBoolean("ph", true); set(v) { sp.edit().putBoolean("ph", v).apply() }

    fun init(ctx: Context) {
        if (::sp.isInitialized) return
        sp = BrUsers.prefs(ctx, "br_chrome")
        dir = BrUsers.dir(ctx)
        runCatching {
            val o = JSONObject(File(dir, "chrome-ops.json").readText())
            o.optJSONArray("ops")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { ops += opOf(it) } }
            o.optJSONArray("vis")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { vis += BrVisit(it.optString("u"), it.optString("t"), it.optLong("at")) } }
        }
        BrStore.onMark = { add, m -> if (on && marksOn && BrCloud.chromeOwner()) record(if (add) "add" else "del", m) }
        BrStore.onVisit = { v -> if (on && histOn && BrCloud.chromeOwner()) synchronized(vis) { vis += v; while (vis.size > VIS_MAX) vis.removeAt(0); saveLocal() } }
    }

    private fun opOf(o: JSONObject) = BrSync.Op(o.optLong("s"), o.optString("k"), o.optString("id"), o.optString("u"), o.optString("t"), o.optLong("at"))
    private fun opJson(o: BrSync.Op) = JSONObject().put("s", o.s).put("k", o.k).put("id", o.id).put("u", o.u).put("t", o.t).put("at", o.at)

    private fun saveLocal() {
        val o = JSONObject().put("ops", JSONArray().apply { synchronized(ops) { ops.forEach { put(opJson(it)) } } })
            .put("vis", JSONArray().apply { synchronized(vis) { vis.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("at", it.at)) } } })
        runCatching { val t = File(dir, "chrome-ops.json.tmp"); t.writeText(o.toString()); t.renameTo(File(dir, "chrome-ops.json")) }
    }

    private fun nextSeq(): Long { val s = sp.getLong("seq", 0L) + 1; sp.edit().putLong("seq", s).apply(); return s }

    /** סימנייה נוספה / נמחקה כאן — לתור, והסנכרון יוצא כמה שניות אחרי */
    private fun record(k: String, m: BrMark) {
        val id = m.sid.ifEmpty { if (k == "add") "a" + java.lang.Long.toString(System.nanoTime() and 0xffffffffffL, 36) else "" }
        if (k == "add" && m.sid.isEmpty()) BrStore.marks.indexOf(m).takeIf { it >= 0 }?.let { BrStore.marks[it] = m.copy(sid = id) }
        synchronized(ops) { ops += BrSync.Op(nextSeq(), k, id, m.url, m.title, m.at) }
        saveLocal()
        soon()
    }

    fun soon() { ui.removeCallbacks(tick); ui.postDelayed(tick, 6_000) }
    private val tick = Runnable { sync(null, force = true) }

    /* ---------------- ההרשאה (drive.appdata) ---------------- */

    private fun request() = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(SCOPE))).build()

    /** חיבור ראשון: אם צריך אישור של המשתמש — מחזיר את החלון של Google להצגה */
    fun connect(a: Activity, show: (IntentSender) -> Unit, done: (Boolean) -> Unit) {
        Identity.getAuthorizationClient(a).authorize(request())
            .addOnSuccessListener { r -> if (r.hasResolution()) r.pendingIntent?.intentSender?.let(show) ?: done(false) else { enable(); done(true) } }
            .addOnFailureListener { setErr("auth"); done(false) }
    }

    /** חזרה מהחלון של Google */
    fun connected(a: Activity, data: android.content.Intent?): Boolean {
        val ok = runCatching { Identity.getAuthorizationClient(a).getAuthorizationResultFromIntent(data).accessToken != null }.getOrDefault(false)
        if (ok) enable()
        return ok
    }

    private fun enable() {
        sp.edit().putBoolean("on", true).putString("err", "").apply()
        // בחשבון עם כמה מכשירים — רק מכשיר אחד מדבר עם התוסף (ops.json אחד); השאר מקבלים את Chrome דרך הסנכרון בענן
        BrCloud.claimChrome()
        // פעם ראשונה: כל הסימניות שכאן נשלחות לתוסף (הוא לא מוסיף מה שכבר יש ב־Chrome)
        if (!sp.getBoolean("seeded", false)) {
            val seeded = BrStore.marks.map { it.copy(sid = it.sid.ifEmpty { "a" + nextSeq() }) }
            synchronized(ops) { for (m in seeded) ops += BrSync.Op(nextSeq(), "add", m.sid, m.url, m.title, m.at) }
            BrStore.replaceMarks(seeded)
            sp.edit().putBoolean("seeded", true).apply(); saveLocal()
        }
        onChange?.invoke()
        sync(null, force = true)
    }

    fun disable() {
        sp.edit().putBoolean("on", false).putBoolean("seeded", false).putLong("sat", 0).apply()
        synchronized(ops) { ops.clear() }; synchronized(vis) { vis.clear() }; saveLocal()
        // הסימניות שכבר כאן נשארות — בלי המזהים של הסנכרון
        BrStore.replaceMarks(BrStore.marks.map { it.copy(sid = "") })
        onChange?.invoke()
    }

    private fun token(ctx: Context): String? = runCatching {
        val r = Tasks.await(Identity.getAuthorizationClient(ctx).authorize(request()), 20, TimeUnit.SECONDS)
        if (r.hasResolution()) null else r.accessToken
    }.getOrNull()

    /* ---------------- הסנכרון ---------------- */

    /** מכשיר אחר בחשבון מחזיק עכשיו את הגשר ל־Chrome (BrCloud.chromeOwner) */
    val otherDevice get() = on && !BrCloud.chromeOwner()

    fun sync(ctx: Context?, force: Boolean = false) {
        if (!on || busy || !BrCloud.chromeOwner()) return
        val now = System.currentTimeMillis()
        if (!force && now - lastRun < MIN_GAP) return
        val c = ctx?.applicationContext ?: appCtx ?: return
        appCtx = c
        busy = true; lastRun = now
        io.execute {
            val r = runCatching { run(c) }
            ui.post {
                busy = false
                r.exceptionOrNull()?.let { setErr(it.message ?: "error") }
                onChange?.invoke()
            }
        }
    }
    private var appCtx: Context? = null
    fun attach(ctx: Context) { appCtx = ctx.applicationContext }

    private fun setErr(e: String) { sp.edit().putString("err", e.take(40)).apply() }

    private fun run(ctx: Context) {
        val t = token(ctx) ?: throw IllegalStateException("auth")
        // 1) מה שקרה כאן → ops.json (התוסף קורא)
        val myOps = synchronized(ops) { ops.toList() }
        val myVis = synchronized(vis) { vis.toList() }
        val out = JSONObject().put("v", 1).put("dev", "app").put("at", System.currentTimeMillis())
            .put("ops", JSONArray().apply { myOps.forEach { put(opJson(it)) } })
            .put("vis", JSONArray().apply { myVis.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("at", it.at)) } })
        write(t, "ops.json", out.toString())
        // 2) המצב של Chrome ← state.json (התוסף כותב)
        val st = read(t, "state.json")?.let { runCatching { JSONObject(it) }.getOrNull() }
        if (st != null) {
            val ack = st.optLong("ack"); val vat = st.optLong("vat")
            val alias = HashMap<String, String>(); st.optJSONObject("alias")?.let { a -> a.keys().forEach { k -> alias[k] = a.optString(k) } }
            val sm = ArrayList<BrSync.SMark>()
            st.optJSONArray("marks")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { sm += BrSync.SMark(it.optString("id"), it.optString("u"), it.optString("t"), it.optLong("at"), it.optString("o"), it.optString("r"), it.optString("p")) } }
            val hist = ArrayList<BrImport.Item>()
            st.optJSONArray("hist")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { hist += BrImport.Item(it.optString("u"), it.optString("t"), it.optLong("at")) } }
            synchronized(ops) { ops.removeAll { it.s <= ack } }
            synchronized(vis) { vis.removeAll { it.at <= vat } }
            saveLocal()
            val pending = synchronized(ops) { ops.toList() }
            ui.post {
                if (marksOn) BrStore.replaceMarks(BrSync.applyState(sm, pending, alias))
                if (histOn) BrStore.addVisits(hist)
            }
            sp.edit().putLong("sat", st.optLong("at")).apply()
        }
        sp.edit().putLong("at", System.currentTimeMillis()).putString("err", "").apply()
    }

    /* ---------------- Drive (appDataFolder) ---------------- */

    private fun http(t: String, url: String, method: String = "GET", type: String? = null, body: ByteArray? = null): Pair<Int, String> {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = if (method == "PATCH") "POST" else method
        if (method == "PATCH") c.setRequestProperty("X-HTTP-Method-Override", "PATCH")
        c.setRequestProperty("Authorization", "Bearer $t")
        c.connectTimeout = 15_000; c.readTimeout = 30_000
        if (body != null) { c.doOutput = true; c.setRequestProperty("Content-Type", type ?: "application/json"); c.outputStream.use { it.write(body) } }
        val code = c.responseCode
        val txt = runCatching { (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: "" }.getOrDefault("")
        c.disconnect()
        if (code == 401) throw IllegalStateException("auth")
        if (code >= 400) throw IllegalStateException("drive_$code")
        return code to txt
    }

    private fun find(t: String, name: String): String? {
        val q = URLEncoder.encode("name='$name' and trashed=false", "UTF-8")
        val (_, txt) = http(t, "$API?spaces=appDataFolder&q=$q&fields=files(id)&pageSize=5")
        return JSONObject(txt).optJSONArray("files")?.optJSONObject(0)?.optString("id")?.takeIf { it.isNotEmpty() }
    }

    private fun read(t: String, name: String): String? = find(t, name)?.let { http(t, "$API/$it?alt=media").second }

    private fun write(t: String, name: String, json: String) {
        val id = find(t, name)
        if (id != null) { http(t, "$UP/$id?uploadType=media", "PATCH", "application/json", json.toByteArray()); return }
        val b = "snb" + System.currentTimeMillis()
        val meta = JSONObject().put("name", name).put("parents", JSONArray().put("appDataFolder")).toString()
        val multi = "--$b\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$b\r\nContent-Type: application/json\r\n\r\n$json\r\n--$b--"
        http(t, "$UP?uploadType=multipart", "POST", "multipart/related; boundary=$b", multi.toByteArray())
    }
}
