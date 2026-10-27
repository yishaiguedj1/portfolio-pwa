package io.github.yishaiguedj1.snowball.br

import android.accounts.Account
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Tasks
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.yishaiguedj1.snowball.R
import io.github.yishaiguedj1.snowball.dm.DmSync
import io.github.yishaiguedj1.snowball.br.BrCloudCore.Rec
import io.github.yishaiguedj1.snowball.br.BrCloudCore.STab
import io.github.yishaiguedj1.snowball.br.BrCloudCore.Send
import io.github.yishaiguedj1.snowball.br.BrCloudCore.Session
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * סנכרון וגיבוי בחשבון Google בין כל המכשירים (27/10/2026, בקשת המשתמש: "כמו הסנכרון בזמן אמת של Chrome בין כל המכשירים,
 * ושאם פתחתי כרטיסייה במכשיר אחד אוכל להמשיך בה במכשיר האחר מאותה נקודה בדיוק").
 *
 * הליבה (רשומות, שעון, מיזוג) — BrCloudCore. כאן: הכניסה (Credential Manager → drive.appdata לאותו חשבון, בטלפון, בלי
 * השרת שלנו), Drive, והסבב. ב־appDataFolder — לכל מכשיר שלושה קבצים שרק הוא כותב:
 *   snbc-<מכשיר>-d  סימניות, הגדרות, הגדרות אתרים
 *   snbc-<מכשיר>-h  היסטוריה (בנפרד — גדולה, עולה לכל היותר פעם ב־HIST_GAP)
 *   snbc-<מכשיר>-s  המכשיר והכרטיסיות הפתוחות בו (כולל המקום המדויק), ושליחות למכשירים אחרים
 *
 * "זמן אמת" בלי שרת: כשהדפדפן פתוח — changes.list כל FG_EVERY (רשימה ריקה זולה מאוד), ומיד בחזרה לאפליקציה, בפתיחת
 * כרטיסייה חדשה ובשינוי כאן; ברקע — משימת מערכת כל 15 דק׳ (BrCloudJob), וכתיבה מיד ביציאה מהאפליקציה.
 * התראה מיידית ברקע דורשת דחיפה מצד שרת (FCM) — שלב אפשרי בהמשך.
 *
 * הגשר ל־Chrome (BrChrome + התוסף) כותב ops.json אחד — לכן רק מכשיר אחד בחשבון מחזיק אותו (`p:chr`); השאר מקבלים את
 * הסימניות של Chrome דרך הסנכרון הזה.
 */
object BrCloud {
    const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
    /** = DmSync.WEB_CLIENT: לקוח ה־Web של פרויקט ה־Firebase (לקוח מסוג Android מחזיר "Developer console is not set up") */
    const val WEB_CLIENT = "286578855160-a5kii0glss9b883glkr698frmvekpa67.apps.googleusercontent.com"
    private const val API = "https://www.googleapis.com/drive/v3"
    private const val UP = "https://www.googleapis.com/upload/drive/v3/files"
    const val FG_EVERY = 4_000L
    private const val HIST_GAP = 20_000L
    private const val SESS_GAP = 8_000L
    private const val BEAT = 5 * 60_000L
    private const val PREFIX = "snbc-"
    private const val CH = "br_send"
    const val JOB_ID = 7311

    private lateinit var sp: android.content.SharedPreferences
    private lateinit var dir: File
    private lateinit var prefs: BrPrefs
    private lateinit var app: Context
    private val ui = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    @Volatile private var busy = false
    @Volatile private var again = false

    private val own = HashMap<String, Rec>()
    private var base = HashMap<String, String>()
    private val remote = HashMap<String, Map<String, Rec>>()      // שם הקובץ → הרשומות (d/h של מכשירים אחרים)
    val sessions = LinkedHashMap<String, Session>()                // המכשירים האחרים
    private val ids = HashMap<String, String>()                    // שם קובץ → המזהה ב־Drive
    private lateinit var hlc: BrCloudCore.Hlc
    private var sent = ArrayList<Send>()
    private val seen = HashMap<String, Long>()                     // השליחה האחרונה שקיבלתי מכל מכשיר
    private var lastD = 0; private var lastH = 0; private var lastS = 0
    private var hAt = 0L; private var sAt = 0L

    /** הדפדפן מאזין: השתנה משהו במסך (`onChange`), הוחלו נתונים מהענן (`onApplied`), הגיעה כרטיסייה (`onIncoming`) */
    var onChange: (() -> Unit)? = null
    var onApplied: ((prefs: Boolean) -> Unit)? = null
    var onIncoming: ((Session, Send) -> Boolean)? = null
    var tabsProvider: (() -> List<STab>)? = null
    /** כרטיסייה להמשך שנפתחת מהתראה — בתוך התהליך בלבד (לא extras מבחוץ) */
    val pendingOpen = HashMap<String, STab>()

    val ready get() = ::sp.isInitialized
    val on get() = ready && sp.getBoolean("on", false)
    val email: String get() = if (ready) sp.getString("em", "") ?: "" else ""
    val name: String get() = if (ready) sp.getString("nm", "") ?: "" else ""
    val dev: String get() = sp.getString("dev", "") ?: ""
    val err: String get() = if (ready) sp.getString("err", "") ?: "" else ""
    val syncAt get() = if (ready) sp.getLong("at", 0L) else 0L
    var tMarks: Boolean get() = sp.getBoolean("tm", true); set(v) { sp.edit().putBoolean("tm", v).apply(); nudge() }
    var tHist: Boolean get() = sp.getBoolean("th", true); set(v) { sp.edit().putBoolean("th", v).apply(); nudge() }
    var tTabs: Boolean get() = sp.getBoolean("tt", true); set(v) { sp.edit().putBoolean("tt", v).apply(); nudge() }
    var tPrefs: Boolean get() = sp.getBoolean("tp", true); set(v) { sp.edit().putBoolean("tp", v).apply(); nudge() }
    val dismissed: MutableSet<String> = HashSet()

    fun init(ctx: Context) {
        if (ready) return
        app = ctx.applicationContext
        sp = app.getSharedPreferences("br_cloud", Context.MODE_PRIVATE)
        if (dev.isEmpty()) sp.edit().putString("dev", java.lang.Long.toString(java.util.Random().nextLong() and Long.MAX_VALUE, 36).take(10)).apply()
        dir = File(app.filesDir, "br/cloud").apply { mkdirs() }
        prefs = BrPrefs(app)
        BrStore.init(app)
        hlc = BrCloudCore.Hlc(dev)
        load()
    }

    /* ---------------- מה נשמר בטלפון (כדי שהפעלה מחדש לא תוריד הכל שוב) ---------------- */

    private val C0 = BrCloudCore.clock(0, 0, "-")
    private fun load() {
        File(dir, "own").takeIf { it.exists() }?.readBytes()?.let { BrCloudCore.decode(it) }?.second?.let { own.putAll(it) }
        File(dir, "base").takeIf { it.exists() }?.readBytes()?.let { BrCloudCore.decode(it) }?.second?.let { m -> m.forEach { (k, r) -> r.v?.let { base[k] = it } } }
        own.values.forEach { hlc.see(it.c) }
        File(dir, "r").listFiles()?.forEach { f ->
            val b = runCatching { f.readBytes() }.getOrNull() ?: return@forEach
            if (f.name.endsWith("-s")) BrCloudCore.decodeSession(b)?.let { sessions[it.dev] = it }
            else BrCloudCore.decode(b)?.let { remote[f.name] = it.second }
        }
        runCatching { JSONObject(sp.getString("ids", "{}")!!).let { o -> o.keys().forEach { ids[it] = o.optString(it) } } }
        runCatching { JSONObject(sp.getString("seen", "{}")!!).let { o -> o.keys().forEach { seen[it] = o.optLong(it) } } }
        runCatching { JSONArray(sp.getString("dis", "[]")).let { a -> for (i in 0 until a.length()) dismissed += a.optString(i) } }
        sent = ArrayList(runCatching { JSONArray(sp.getString("sent", "[]")) }.getOrNull()?.let { a ->
            (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { o -> Send(o.optLong("id"), o.optString("to"), tabOf(o), o.optLong("at")) }
        } ?: emptyList())
    }
    private fun tabOf(o: JSONObject) = STab(o.optString("u"), o.optString("t"), o.optLong("la"), o.optDouble("sc", 0.0).toFloat(), o.optString("tx"), o.optDouble("mt", 0.0).toFloat())
    private fun tabJson(t: STab) = JSONObject().put("u", t.u).put("t", t.t).put("la", t.la).put("sc", t.sc.toDouble()).put("tx", t.tx).put("mt", t.mt.toDouble())
    private fun saveMeta() {
        sp.edit().putString("ids", JSONObject(ids as Map<*, *>).toString())
            .putString("seen", JSONObject(seen as Map<*, *>).toString())
            .putString("dis", JSONArray(dismissed.toList().takeLast(200)).toString())
            .putString("sent", JSONArray().apply { sent.forEach { put(tabJson(it.tab).put("id", it.id).put("to", it.to).put("at", it.at)) } }.toString())
            .apply()
    }
    private fun atomic(f: File, b: ByteArray) { runCatching { val t = File(f.path + ".tmp"); t.writeBytes(b); if (!t.renameTo(f)) { f.delete(); t.renameTo(f) } } }

    /* ---------------- הכניסה ---------------- */

    sealed class SignIn { object Ok : SignIn(); object Cancel : SignIn(); class Need(val s: IntentSender) : SignIn(); class Fail(val why: String) : SignIn() }

    private fun request(): AuthorizationRequest {
        val b = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(SCOPE)))
        if (email.isNotEmpty()) b.setAccount(Account(email, "com.google"))
        return b.build()
    }

    /** כניסה עם Google: החשבון (חלון המערכת), ואז הרשאה לתיקייה הפרטית של האפליקציה ב־Drive של אותו חשבון. מתוך פעולה של המשתמש */
    suspend fun signIn(a: Activity): SignIn {
        val cred = try {
            CredentialManager.create(a).getCredential(a, GetCredentialRequest(listOf(GetSignInWithGoogleOption.Builder(WEB_CLIENT).build()))).credential
        } catch (e: androidx.credentials.exceptions.GetCredentialCancellationException) { return SignIn.Cancel
        } catch (e: Throwable) { return SignIn.Fail(e.javaClass.simpleName) }
        val g = try { GoogleIdTokenCredential.createFrom(cred.data) } catch (e: Throwable) { return SignIn.Fail(e.javaClass.simpleName) }
        sp.edit().putString("em", g.id).putString("nm", g.displayName ?: "").apply()
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                // החשבון במערכת שלנו (Firebase — אותו uid בכל מכשיר עם אותו חשבון Google) ומפתח ההצפנה שלו
                firebase(g.idToken) ?: return@withContext SignIn.Fail("firebase")
                fetchKey() ?: return@withContext SignIn.Fail("key")
                val r = Tasks.await(Identity.getAuthorizationClient(a).authorize(request()), 30, TimeUnit.SECONDS)
                if (r.hasResolution()) r.pendingIntent?.intentSender?.let { SignIn.Need(it) } ?: SignIn.Fail("resolution")
                else { ui.post { enable() }; SignIn.Ok }
            } catch (e: Throwable) { SignIn.Fail(e.javaClass.simpleName) }
        }
    }

    /** חזרה מחלון ההרשאה של Google */
    fun authorized(a: Activity, data: Intent?): Boolean {
        val ok = runCatching { Identity.getAuthorizationClient(a).getAuthorizationResultFromIntent(data).accessToken != null }.getOrDefault(false)
        if (ok) enable()
        return ok
    }

    private fun enable() {
        sp.edit().putBoolean("on", true).putString("err", "").remove("pt").apply()
        schedule(app)
        nudge(0)
    }

    /** הפסקת הסנכרון: הנתונים שבמכשיר נשארים; `wipe` = גם מוחקים את כל הנתונים מ־Drive (כל המכשירים בחשבון) */
    fun signOut(wipe: Boolean, done: (Boolean) -> Unit) {
        if (!wipe) { reset(); done(true); return }
        io.execute {
            val ok = runCatching {
                val t = token() ?: throw IllegalStateException("auth")
                listAll(t).forEach { (_, id) -> http(t, "$API/files/$id", "DELETE") }
            }.isSuccess
            ui.post { if (ok) reset(); done(ok) }
        }
    }

    private fun reset() {
        sp.edit().putBoolean("on", false).remove("pt").remove("em").remove("nm").remove("ids").remove("seen").remove("sent").remove("err")
            .remove("rt").remove("kw").remove("kid").remove("enc").apply()
        cachedKey = null
        own.clear(); base.clear(); remote.clear(); sessions.clear(); ids.clear(); seen.clear(); sent.clear()
        dir.deleteRecursively(); dir.mkdirs()
        lastD = 0; lastH = 0; lastS = 0
        (app.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler)?.cancel(JOB_ID)
        onChange?.invoke()
    }

    /* ---------------- ההצפנה: המפתח מהשרת שלנו, שמור בטלפון עטוף ב־Android Keystore ---------------- */

    private fun post(url: String, body: String, type: String): Pair<Int, JSONObject> {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.connectTimeout = 15_000; c.readTimeout = 20_000; c.doOutput = true
        c.setRequestProperty("Content-Type", type)
        c.outputStream.use { it.write(body.toByteArray()) }
        val code = c.responseCode
        val txt = runCatching { (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: "" }.getOrDefault("")
        c.disconnect()
        return code to (runCatching { JSONObject(txt) }.getOrNull() ?: JSONObject())
    }

    /** Google → החשבון במערכת שלנו (Firebase). שומר רק את אסימון הרענון */
    private fun firebase(googleIdToken: String): String? = runCatching {
        val (st, j) = post("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${DmSync.FB_KEY}", JSONObject()
            .put("postBody", "id_token=" + URLEncoder.encode(googleIdToken, "UTF-8") + "&providerId=google.com")
            .put("requestUri", "http://localhost").put("returnSecureToken", true).toString(), "application/json")
        if (st != 200 || !j.has("refreshToken")) return null
        sp.edit().putString("rt", wrap(j.getString("refreshToken").toByteArray())).apply()
        j.getString("idToken")
    }.getOrNull()

    private fun fbToken(): String? = runCatching {
        // אסימון הרענון של החשבון שמור עטוף ב־Android Keystore (כמו המפתח), לא גלוי בקובץ ההגדרות
        val rt = sp.getString("rt", "").orEmpty().ifEmpty { return null }.let { w -> unwrap(w)?.toString(Charsets.UTF_8) } ?: return null
        val (st, j) = post("https://securetoken.googleapis.com/v1/token?key=${DmSync.FB_KEY}",
            "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(rt, "UTF-8"), "application/x-www-form-urlencoded")
        if (st == 400) { sp.edit().remove("rt").apply(); return null }
        j.optString("refresh_token").takeIf { it.isNotEmpty() && it != rt }?.let { sp.edit().putString("rt", wrap(it.toByteArray())).apply() }
        j.optString("id_token").takeIf { it.isNotEmpty() }
    }.getOrNull()

    /** brKey בשרת שלנו (ובגיבוי — Vercel); נשמר עטוף במפתח של Android Keystore (לא יוצא מהמכשיר) */
    private fun fetchKey(): Pair<Char, ByteArray>? {
        val it = fbToken() ?: return null
        for (u in DmSync.API) {
            val (st, j) = runCatching { post(u, JSONObject().put("op", "brKey").put("idToken", it).toString(), "application/json") }.getOrNull() ?: continue
            // 401 / wrong_app = באמת אין גישה; כל השאר (גם 403 של שרת שעוד לא מכיר את brKey) — הכתובת הבאה
            if (st != 200) { if (st == 401 || j.optString("error") == "wrong_app") return null else continue }
            val k = runCatching { android.util.Base64.decode(j.optString("k"), android.util.Base64.DEFAULT) }.getOrNull() ?: continue
            val kid = j.optString("kid").firstOrNull() ?: continue
            if (k.size != 32) continue
            sp.edit().putString("kw", wrap(k)).putString("kid", kid.toString()).apply()
            cachedKey = kid to k
            return cachedKey
        }
        return null
    }
    @Volatile private var cachedKey: Pair<Char, ByteArray>? = null
    private fun key(): Pair<Char, ByteArray>? {
        cachedKey?.let { return it }
        val w = sp.getString("kw", null); val kid = sp.getString("kid", null)?.firstOrNull()
        if (w != null && kid != null) unwrap(w)?.let { cachedKey = kid to it; return cachedKey }
        return fetchKey()
    }
    private fun ks(): javax.crypto.SecretKey {
        val st = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (st.getEntry("snb_br_sync", null) as? java.security.KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val g = javax.crypto.KeyGenerator.getInstance(android.security.keystore.KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(android.security.keystore.KeyGenParameterSpec.Builder("snb_br_sync", android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return g.generateKey()
    }
    private fun wrap(k: ByteArray): String {
        val c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding"); c.init(javax.crypto.Cipher.ENCRYPT_MODE, ks())
        return android.util.Base64.encodeToString(c.iv + c.doFinal(k), android.util.Base64.NO_WRAP)
    }
    private fun unwrap(s: String): ByteArray? = runCatching {
        val b = android.util.Base64.decode(s, android.util.Base64.NO_WRAP)
        val c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding"); c.init(javax.crypto.Cipher.DECRYPT_MODE, ks(), javax.crypto.spec.GCMParameterSpec(128, b, 0, 12))
        c.doFinal(b, 12, b.size - 12)
    }.getOrNull()

    /** קובץ מ־Drive → הבתים הפתוחים. קובץ שלא הוצפן (מהגרסה הראשונה, לפני 27/10) — נקרא כמו שהוא; מפתח אחר — מתעלמים */
    private fun openFile(name: String, b: ByteArray): ByteArray? {
        if (!BrCloudCore.isSealed(b)) return b
        val (_, k) = key() ?: return null
        return BrCloudCore.open(k, name, b)
    }
    private fun sealFile(name: String, b: ByteArray): ByteArray {
        val (kid, k) = key() ?: throw IllegalStateException("key")
        return BrCloudCore.seal(k, kid, name, b)
    }

    /** הגישה ל־Drive נשמרת בזיכרון 45 דק׳ (שעה בתוקף) — לא פנייה ל־Google Play Services בכל סבב; 401 מנקה */
    @Volatile private var tok: Pair<String, Long>? = null
    private fun token(): String? {
        tok?.let { (t, at) -> if (System.currentTimeMillis() - at < 45 * 60_000L) return t }
        return runCatching {
            val r = Tasks.await(Identity.getAuthorizationClient(app).authorize(request()), 20, TimeUnit.SECONDS)
            if (r.hasResolution()) null else r.accessToken
        }.getOrNull()?.also { tok = it to System.currentTimeMillis() }
    }

    fun deviceName(): String = runCatching { Settings.Global.getString(app.contentResolver, "device_name") }.getOrNull()?.takeIf { it.isNotBlank() }
        ?: (Build.MODEL ?: "Android")
    private fun form(): String = if (app.resources.configuration.smallestScreenWidthDp >= 600) "t" else "p"

    /* ---------------- הקצב ---------------- */

    private var fg = false
    /** קצב מסתגל (27/10/2026, מחקר היעילות — 900 בקשות בשעה החזיקו את הרדיו של הסלולר דלוק): FG_EVERY (4 שנ׳) דקה וחצי
     *  אחרי שינוי כאן / שהגיע מהענן / חזרה לאפליקציה; אחר כך 15 שנ׳, ובחבילת גלישה 30 */
    @Volatile private var lastAct = 0L
    private fun gap(): Long {
        if (System.currentTimeMillis() - lastAct < 90_000) return FG_EVERY
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
        return if (cm?.isActiveNetworkMetered == true) 30_000L else 15_000L
    }
    private val loop: Runnable = object : Runnable { override fun run() { if (fg) { cycle(); ui.postDelayed(this, gap()) } } }
    /** הדפדפן על המסך: סבב מיד ואז כל FG_EVERY */
    fun foreground(v: Boolean) {
        if (!on) { fg = v; return }
        fg = v; ui.removeCallbacks(loop)
        if (v) lastAct = System.currentTimeMillis()
        if (v) ui.post(loop) else cycle(flush = true)
    }
    private val soon = Runnable { cycle() }
    /** משהו השתנה כאן — סבב בעוד רגע (כמה שינויים ברצף = סבב אחד) */
    fun nudge(delay: Long = 1500) { if (!on) return; lastAct = System.currentTimeMillis(); ui.removeCallbacks(soon); ui.postDelayed(soon, delay) }

    fun schedule(ctx: Context) {
        val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
        if (js.getPendingJob(JOB_ID) != null) return
        runCatching {
            js.schedule(JobInfo.Builder(JOB_ID, ComponentName(ctx, BrCloudJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15 * 60_000L).setPersisted(true).build())
        }
    }

    /* ---------------- הסבב ---------------- */

    private class Down(val name: String, val bytes: ByteArray?)

    fun cycle(flush: Boolean = false, done: (() -> Unit)? = null) {
        if (!on) { done?.invoke(); return }
        if (busy) { again = true; done?.invoke(); return }
        busy = true
        io.execute {
            val r = runCatching { run(flush) }
            ui.post {
                busy = false
                r.exceptionOrNull()?.let { if (it.message == "auth") tok = null; sp.edit().putString("err", (it.message ?: "error").take(40)).apply() }
                onChange?.invoke()
                done?.invoke()
                if (again) { again = false; nudge(300) }
            }
        }
    }

    private fun run(flush0: Boolean) {
        val t = token() ?: throw IllegalStateException("auth")
        key() ?: throw IllegalStateException("key")
        // הפעם הראשונה עם הצפנה: הקבצים שלי עולים מחדש מוצפנים (גם אם לא השתנו)
        val flush = flush0 || !sp.getBoolean("enc", false)
        if (!sp.getBoolean("enc", false)) { lastD = 0; lastH = 0; lastS = 0; hAt = 0L; upVer = -1 }
        // 1) מה השתנה בענן — רק הקבצים של מכשירים אחרים שהשתנו
        val downs = ArrayList<Down>()
        var pt = sp.getString("pt", null)
        if (pt == null) {
            pt = JSONObject(http(t, "$API/changes/startPageToken").second).optString("startPageToken")
            val all = listAll(t)
            ids.clear(); ids.putAll(all)
            for ((n, id) in all) if (!mine(n)) fetchInto(t, n, id, downs)
            // קבצים שכבר אין (מכשיר שנמחק) — יוצאים מהמטמון
            (remote.keys + sessions.keys.map { "$PREFIX$it-s" }).filter { it !in all }.forEach { downs += Down(it, null) }
        } else {
            var page: String? = pt
            while (page != null) {
                val o = JSONObject(http(t, "$API/changes?pageToken=${enc(page)}&spaces=appDataFolder&pageSize=1000&fields=" +
                    enc("nextPageToken,newStartPageToken,changes(fileId,removed,file(name,trashed))")).second)
                val ch = o.optJSONArray("changes") ?: JSONArray()
                for (i in 0 until ch.length()) {
                    val c = ch.optJSONObject(i) ?: continue
                    val id = c.optString("fileId")
                    val f = c.optJSONObject("file")
                    val n = f?.optString("name") ?: ids.entries.firstOrNull { it.value == id }?.key ?: continue
                    if (!n.startsWith(PREFIX)) continue
                    if (c.optBoolean("removed") || f?.optBoolean("trashed") == true) { ids.remove(n); if (!mine(n)) downs += Down(n, null); continue }
                    ids[n] = id
                    if (!mine(n)) fetchInto(t, n, id, downs)
                }
                page = o.optString("nextPageToken").takeIf { it.isNotEmpty() }
                o.optString("newStartPageToken").takeIf { it.isNotEmpty() }?.let { pt = it }
            }
        }
        // 2) המיזוג והחלה על הדפדפן — בתהליכון הראשי (הסימניות/ההיסטוריה/ההגדרות שייכות לו)
        var up: Uploads? = null
        val latch = CountDownLatch(1)
        ui.post { try { up = stepUi(downs, flush) } finally { latch.countDown() } }
        if (!latch.await(20, TimeUnit.SECONDS)) throw IllegalStateException("ui")
        val u = up ?: throw IllegalStateException("ui")
        // 3) הקבצים שלי שהשתנו
        u.d?.let { put(t, "${PREFIX}$dev-d", sealFile("${PREFIX}$dev-d", it)) }
        u.h?.let { put(t, "${PREFIX}$dev-h", sealFile("${PREFIX}$dev-h", it)) }
        u.s?.let { put(t, "${PREFIX}$dev-s", sealFile("${PREFIX}$dev-s", it)) }
        if (u.d != null && u.h != null && u.s != null) sp.edit().putBoolean("enc", true).apply()
        sp.edit().putString("pt", pt).putLong("at", System.currentTimeMillis()).putString("err", "").apply()
        ui.post { saveMeta() }
    }

    /** הורדה ופתיחה: 404 = הקובץ נמחק; קובץ שלא נפתח (מפתח אחר / שובש) — מתעלמים ממנו, לא "נמחק" */
    private fun fetchInto(t: String, n: String, id: String, downs: MutableList<Down>) {
        val raw = httpBytes(t, "$API/files/$id?alt=media")
        if (raw == null) { downs += Down(n, null); return }
        openFile(n, raw)?.let { downs += Down(n, it) }
    }

    private fun mine(n: String) = n.startsWith("$PREFIX$dev-")

    private class Uploads(val d: ByteArray?, val h: ByteArray?, val s: ByteArray?)

    /** הסבב עצמו (בתהליכון הראשי): ההורדות למטמון → מה שהשתנה כאן → מיזוג → החלה → מה צריך לעלות */
    private fun stepUi(downs: List<Down>, flush: Boolean): Uploads {
        val now = System.currentTimeMillis()
        val rdir = File(dir, "r").apply { mkdirs() }
        var remoteChanged = false
        for (d in downs) {
            val f = File(rdir, d.name)
            if (d.bytes == null) {
                f.delete()
                if (d.name.endsWith("-s")) sessions.remove(d.name.removePrefix(PREFIX).removeSuffix("-s")) else remote.remove(d.name)
                remoteChanged = true; continue
            }
            if (d.name.endsWith("-s")) BrCloudCore.decodeSession(d.bytes)?.let { sessions[it.dev] = it; atomic(f, d.bytes) }
            else BrCloudCore.decode(d.bytes)?.let { remote[d.name] = it.second; atomic(f, d.bytes); remoteChanged = true }
            lastAct = now
        }
        // מה שבמכשיר עכשיו (רק הסוגים שמסונכרנים)
        val local = snapshot()
        // ביקור שיצא כאן רק בגלל התקרה (לא מחקת אותו) — לא מחיקה: נשאר בבסיס כמו שהוא
        val del = BrStore.takeHistDeleted()
        for ((k, v) in base) if (k.startsWith("h:") && k !in local && k !in del && tHist) local[k] = v
        val keep = enabled()
        var ownChanged = false
        if (remoteChanged || local != base || flush) {
            val rem = remote.values.map { m -> m.filterKeys { keep(it) } }
            val st = BrCloudCore.step(local, base, own, rem, hlc, now) { k, v ->
                when {
                    k.startsWith("m:") || k.startsWith("h:") -> v?.let { BrCloudCore.parts(it).getOrNull(2)?.toLongOrNull() } ?: now
                    else -> 0L
                }
            }
            ownChanged = st.ownChanged
            val view = HashMap(st.view.filterKeys { keep(it) })
            apply(view, local)
            base = view
            if (BrCloudCore.gc(own, now)) ownChanged = true
            if (ownChanged) atomic(File(dir, "own"), BrCloudCore.encode(dev, own))
            atomic(File(dir, "base"), BrCloudCore.encode("base", base.mapValues { Rec(it.value, C0) }))
        }
        // מה עולה: d/h רק כשהשתנו (h לא יותר מפעם ב־HIST_GAP, חוץ מיציאה מהאפליקציה)
        if (ownChanged) ownVer++
        var dB: ByteArray? = null; var hB: ByteArray? = null
        if (ownVer != upVer || ids["${PREFIX}$dev-d"] == null || ids["${PREFIX}$dev-h"] == null) {
            val dRecs = own.filterKeys { !it.startsWith("h:") }; val hRecs = own.filterKeys { it.startsWith("h:") }
            if (dRecs.hashCode() != lastD || ids["${PREFIX}$dev-d"] == null) { lastD = dRecs.hashCode(); dB = BrCloudCore.encode(dev, dRecs) }
            val hDue = flush || now - hAt > HIST_GAP || hAt == 0L
            if ((hRecs.hashCode() != lastH || ids["${PREFIX}$dev-h"] == null) && hDue) { lastH = hRecs.hashCode(); hAt = now; hB = BrCloudCore.encode(dev, hRecs) }
            if (hRecs.hashCode() == lastH) upVer = ownVer
        }
        // המכשיר והכרטיסיות; שליחות שהגיעו לכאן
        // ברקע (בלי הדפדפן פתוח) אין רשימת כרטיסיות — לא מעלים "אין כרטיסיות" במקום מה שהיה (רק כשהקובץ עוד לא קיים)
        val prov = tabsProvider
        val tabs = if (!tTabs) emptyList() else prov?.invoke() ?: lastTabs
        lastTabs = tabs
        for ((s, x) in BrCloudCore.inbox(sessions.values, dev, seen)) {
            seen[s.dev] = maxOf(seen[s.dev] ?: 0L, x.id)
            if (onIncoming?.invoke(s, x) != true) notifyIncoming(s, x)
        }
        sent = ArrayList(BrCloudCore.pruneSends(sent, sessions.values, dev, now))
        val sess = Session(dev, deviceName(), form(), 0L, tabs, sent, HashMap(seen))
        val sh = sess.hashCode()
        val sB = if (prov == null && tTabs && ids["${PREFIX}$dev-s"] != null) null
        else if ((sh != lastS && (flush || now - sAt > SESS_GAP)) || now - sAt > BEAT || ids["${PREFIX}$dev-s"] == null) {
            lastS = sh; sAt = now; BrCloudCore.encodeSession(sess.copy(at = now))
        } else null
        return Uploads(dB, hB, sB)
    }
    private var lastTabs: List<STab> = emptyList()
    private var ownVer = 0; private var upVer = -1

    private fun enabled(): (String) -> Boolean {
        val m = tMarks; val h = tHist; val p = tPrefs
        return { k -> (m && k.startsWith("m:")) || (h && k.startsWith("h:")) || (p && (k.startsWith("p:") || k.startsWith("s:"))) }
    }

    /* ---------------- המכשיר ↔ רשומות ---------------- */

    /** ההגדרות שמסתנכרנות (כמו ה־syncable prefs של Chrome) — לא נעילת הטאבים הפרטיים ולא מונים */
    private val PREFS: List<Triple<String, () -> String, (String) -> Unit>> by lazy { listOf(
        Triple("p:eng", { prefs.engine }, { v -> prefs.engine = v }),
        Triple("p:bottom", { b(prefs.barBottom) }, { v -> prefs.barBottom = v == "1" }),
        Triple("p:home", { b(prefs.homeBtn) }, { v -> prefs.homeBtn = v == "1" }),
        Triple("p:bub", { b(prefs.bubble) }, { v -> prefs.bubble = v == "1" }),
        Triple("p:sug", { b(prefs.suggest) }, { v -> prefs.suggest = v == "1" }),
        Triple("p:zoom", { prefs.zoom.toString() }, { v -> v.toIntOrNull()?.let { prefs.zoom = it.coerceIn(50, 300) } }),
        Triple("p:shield", { b(prefs.shield) }, { v -> prefs.shield = v == "1" }),
        Triple("p:ck", { b(prefs.cookies) }, { v -> prefs.cookies = v == "1" }),
        Triple("p:bgPlay", { b(prefs.bgPlay) }, { v -> prefs.bgPlay = v == "1" }),
        Triple("p:pip", { b(prefs.pip) }, { v -> prefs.pip = v == "1" }),
        Triple("p:chr", { sp.getString("chr", "") ?: "" }, { v -> sp.edit().putString("chr", v).apply() }),
    ) }
    private fun b(x: Boolean) = if (x) "1" else "0"

    /** הסימניות וההיסטוריה כרשומות — רק כש־BrStore השתנה (5,000 ביקורים בכל 4 שניות = עבודה מיותרת בתהליכון הראשי) */
    private var snapRev = -1L
    private var snapMH: Map<String, String> = emptyMap()
    private fun snapshot(): HashMap<String, String> {
        if (BrStore.rev != snapRev) {
            val mh = HashMap<String, String>()
            for (m in BrStore.marks) mh.putIfAbsent("m:" + BrSync.key(m.url), BrCloudCore.markVal(m.url, m.title, m.at, m.imp))
            for (v in BrStore.history) mh["h:" + BrSync.visitKey(v.url, v.at)] = BrCloudCore.visitVal(v.url, v.title, v.at)
            snapMH = mh; snapRev = BrStore.rev
        }
        val out = HashMap<String, String>()
        for ((k, v) in snapMH) if ((tMarks && k.startsWith("m:")) || (tHist && k.startsWith("h:"))) out[k] = v
        if (tPrefs) {
            for ((k, get, _) in PREFS) out[k] = get()
            for (r in BrShield.decode(prefs.sites).values) out["s:" + r.host] = BrShield.encode(listOf(r))
        }
        return out
    }

    private fun apply(view: Map<String, String>, local: Map<String, String>) {
        fun part(p: String) = view.filterKeys { it.startsWith(p) }
        fun same(p: String) = part(p) == local.filterKeys { it.startsWith(p) }
        if (tMarks && !same("m:")) {
            val old = BrStore.marks.associateBy { BrSync.key(it.url) }
            val list = part("m:").map { (k, v) ->
                val p = BrCloudCore.parts(v)
                val o = old[k.removePrefix("m:")]
                BrMark(p[0], p.getOrElse(1) { "" }, p.getOrNull(2)?.toLongOrNull() ?: 0L, p.getOrNull(3) == "1", o?.x ?: 0L, o?.sid ?: "")
            }.sortedByDescending { it.at }
            BrStore.applyCloudMarks(list)
        }
        if (tHist && !same("h:")) {
            val list = part("h:").values.map { v -> val p = BrCloudCore.parts(v); BrVisit(p[0], p.getOrElse(1) { "" }, p.getOrNull(2)?.toLongOrNull() ?: 0L) }
            BrStore.applyCloudHistory(list)
        }
        var pch = false
        if (tPrefs) {
            for ((k, get, set) in PREFS) { val v = view[k] ?: continue; if (v != get()) { set(v); pch = true } }
            if (!same("s:")) {
                val rules = part("s:").values.flatMap { BrShield.decode(it).values }
                prefs.sites = BrShield.encode(rules); pch = true
            }
        }
        onApplied?.invoke(pch)
    }

    /* ---------------- הגשר ל־Chrome: מכשיר אחד בחשבון ---------------- */

    /** האם המכשיר הזה מחזיק את הגשר ל־Chrome (בלי סנכרון בענן — תמיד כן) */
    fun chromeOwner(): Boolean = !on || (sp.getString("chr", "") ?: "").let { it.isEmpty() || it == dev }
    fun claimChrome() { if (ready) { sp.edit().putString("chr", dev).apply(); nudge() } }

    /* ---------------- כרטיסיות ממכשירים אחרים, ושליחה ---------------- */

    fun devices(): List<Session> = sessions.values.filter { it.dev != dev }.sortedByDescending { it.at }

    fun resume(openHere: Set<String>): Pair<Session, STab>? =
        if (!on || !tTabs) null else BrCloudCore.resume(sessions.values.filter { it.dev != dev }, openHere, dismissed, System.currentTimeMillis())

    fun dismiss(t: STab) { dismissed += BrCloudCore.resumeId(t); saveMeta() }

    /** "שליחה למכשירים שלך" */
    fun send(to: String, tab: STab) {
        val id = (sent.maxOfOrNull { it.id } ?: sp.getLong("sid", 0L)) + 1
        sp.edit().putLong("sid", id).apply()
        sent.add(Send(id, to, tab, System.currentTimeMillis())); saveMeta()
        sAt = 0L; nudge(0)
    }

    private fun notifyIncoming(s: Session, x: Send) {
        val nm = app.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CH, app.getString(R.string.brChSend), NotificationManager.IMPORTANCE_HIGH))
        val key = "c" + x.id + s.dev
        pendingOpen[key] = x.tab
        val i = Intent(app, BrowserActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(x.tab.u))
            .putExtra("snb_cloud", key).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(app, x.id.toInt(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(app, CH) else @Suppress("DEPRECATION") android.app.Notification.Builder(app))
            .setSmallIcon(android.R.drawable.ic_menu_share).setContentTitle(app.getString(R.string.brSentFrom, s.name))
            .setContentText(x.tab.t.ifEmpty { x.tab.u }).setContentIntent(pi).setAutoCancel(true).build()
        runCatching { nm.notify(key.hashCode(), n) }
    }

    /* ---------------- Drive ---------------- */

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun listAll(t: String): Map<String, String> {
        val out = HashMap<String, String>()
        var page: String? = null
        do {
            val q = enc("name contains '$PREFIX' and trashed=false")
            val o = JSONObject(http(t, "$API/files?spaces=appDataFolder&pageSize=1000&q=$q&fields=" + enc("nextPageToken,files(id,name)") +
                (page?.let { "&pageToken=" + enc(it) } ?: "")).second)
            o.optJSONArray("files")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { f -> f.optString("name").takeIf { it.startsWith(PREFIX) }?.let { out[it] = f.optString("id") } } }
            page = o.optString("nextPageToken").takeIf { it.isNotEmpty() }
        } while (page != null)
        return out
    }

    private fun put(t: String, name: String, b: ByteArray) {
        val id = ids[name]
        if (id != null) {
            try { http(t, "$UP/$id?uploadType=media", "PATCH", "application/octet-stream", b); return }
            catch (e: IllegalStateException) { if (e.message != "drive_404") throw e; ids.remove(name) }
        }
        val bnd = "snb" + System.nanoTime()
        val meta = JSONObject().put("name", name).put("parents", JSONArray().put("appDataFolder")).toString()
        val head = "--$bnd\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$bnd\r\nContent-Type: application/octet-stream\r\n\r\n".toByteArray()
        val body = head + b + "\r\n--$bnd--".toByteArray()
        val (_, txt) = http(t, "$UP?uploadType=multipart&fields=id", "POST", "multipart/related; boundary=$bnd", body)
        JSONObject(txt).optString("id").takeIf { it.isNotEmpty() }?.let { ids[name] = it }
    }

    private fun open(t: String, url: String, method: String, type: String?, body: ByteArray?): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = if (method == "PATCH") "POST" else method
        if (method == "PATCH") c.setRequestProperty("X-HTTP-Method-Override", "PATCH")
        c.setRequestProperty("Authorization", "Bearer $t")
        c.connectTimeout = 15_000; c.readTimeout = 30_000
        if (body != null) { c.doOutput = true; c.setRequestProperty("Content-Type", type ?: "application/json"); c.outputStream.use { it.write(body) } }
        return c
    }

    private fun check(c: HttpURLConnection): Int {
        val code = c.responseCode
        if (code == 401) { c.disconnect(); throw IllegalStateException("auth") }
        if (code >= 400) { c.disconnect(); throw IllegalStateException("drive_$code") }
        return code
    }

    private fun http(t: String, url: String, method: String = "GET", type: String? = null, body: ByteArray? = null): Pair<Int, String> {
        val c = open(t, url, method, type, body)
        val code = check(c)
        val txt = runCatching { c.inputStream.bufferedReader().use { it.readText() } }.getOrDefault("")
        c.disconnect()
        return code to txt
    }

    private fun httpBytes(t: String, url: String): ByteArray? {
        val c = open(t, url, "GET", null, null)
        return try { check(c); c.inputStream.use { it.readBytes() } } catch (e: IllegalStateException) { if (e.message == "drive_404") null else throw e } finally { c.disconnect() }
    }
}

/** הסבב ברקע — כל 15 דק׳ עם רשת (JobScheduler), כשהדפדפן לא פתוח */
class BrCloudJob : JobService() {
    override fun onStartJob(p: JobParameters): Boolean {
        BrCloud.init(this)
        if (!BrCloud.on) return false
        BrCloud.cycle(flush = true) { jobFinished(p, false) }
        return true
    }
    override fun onStopJob(p: JobParameters) = true
}
