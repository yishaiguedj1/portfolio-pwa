package io.github.yishaiguedj1.snowball.dm

import android.app.Activity
import android.content.Context
import android.os.Build
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * מאגר הנתונים מ־DM (24/10/2026, בקשת המשתמש — שלב ב׳). **המקום היחיד ב־DM שפונה לשרת שלנו**, ורק כשהמשתמש:
 * (1) נכנס עם Google (אותו חשבון של Invest/Academy/Studio — Credential Manager ← אסימון Google ← Firebase signInWithIdp),
 * (2) השליחה דלוקה — **בתקופת הפיתוח דלוקה כברירת מחדל** (DEFAULT_ON, החלטת המשתמש 24/10/2026: כל המשתמשים הם שלו
 *     ושל חברים שיודעים על האיסוף; לכבות — false — לפני שיש משתמשים מבחוץ, ואז מסך הסכמה). CV = הנוסח שהוצג
 *     (זהה ל־DMC_V ב־ibkr-proxy/lib/dmlog.js; נוסח שמרחיב מה נאסף = מספר חדש בשניהם).
 * נשלח רק יומן ההורדות (DmLog — בלי כתובות ועוגיות), אף פעם לא הקבצים. ההורדות עצמן לא עוברות בשום שרת.
 * כיבוי = לא שולחים יותר; "מחק את הנתונים שלי" = dmForget ואז התנתקות.
 */
object DmSync {
    const val CV = 1
    const val DEFAULT_ON = true
    // מזהים ציבוריים של פרויקט ה־Firebase (כמו ב־firebase-config.js) — לא סודות
    private const val WEB_CLIENT = "286578855160-c5et32a91anfqraplk5djj9qm5soejhf.apps.googleusercontent.com"
    private const val FB_KEY = "AIzaSyDpz4owHSvJCYVzUFtZQL8V_e71HpVeffk"
    private val API = listOf("https://api.thesnowball.app/api/studio", "https://ibkr-proxy-wine.vercel.app/api/studio")
    private const val BATCH = 200
    private const val GAP_MS = 60_000L
    /** תשובות של dmLog/dmForget עצמם — אחרות (גם 403 של שרתון שעוד לא מכיר את הפעולה) עוברות לכתובת הגיבוי */
    private val DONE = setOf(200, 400, 401, 409, 429)

    private val ex = Executors.newSingleThreadExecutor()
    @Volatile private var lastRun = 0L

    private fun p(ctx: Context) = ctx.applicationContext.getSharedPreferences("dm-sync", Context.MODE_PRIVATE)

    /** השליחה דלוקה (ברירת המחדל — DEFAULT_ON; המשתמש יכול לכבות בהגדרות) */
    fun enabled(ctx: Context) = p(ctx).getBoolean("en", DEFAULT_ON)
    fun setEnabled(ctx: Context, v: Boolean) { p(ctx).edit().putBoolean("en", v).apply(); if (v) kick(ctx, true) }
    fun signedIn(ctx: Context) = p(ctx).getString("rt", "").orEmpty().isNotEmpty()
    /** שולחים: דלוק ומחובר */
    fun on(ctx: Context) = enabled(ctx) && signedIn(ctx)
    fun email(ctx: Context): String = p(ctx).getString("em", "").orEmpty()
    /** ההצעה בראש ההורדות — פעם אחת (כן / לא תודה) */
    fun asked(ctx: Context) = p(ctx).getBoolean("asked", false)
    fun setAsked(ctx: Context) = p(ctx).edit().putBoolean("asked", true).apply()

    /** Fail.why = סוג החריגה / קוד השגיאה של Google — מוצג בהודעה ונשמר ביומן (בלי אסימונים) */
    sealed class R { object Ok : R(); object Cancel : R(); data class Fail(val code: String, val why: String = "") : R() }

    private fun fail(stage: String, ex: String, msg: String?): R.Fail {
        val m = DmLog.redact(msg)
        DmLogFile.add(DmLog.Event(System.currentTimeMillis(), "fail", "auth", "http", code = stage, ex = ex, msg = m))
        return R.Fail(stage, listOf(ex, m).filter { it.isNotEmpty() }.joinToString(": ").take(160))
    }

    /** כניסה עם Google — מתוך פעולה של המשתמש (חלון המערכת של Google). רץ ב־coroutine */
    suspend fun signIn(a: Activity): R {
        val cred = try {
            CredentialManager.create(a).getCredential(a, GetCredentialRequest(listOf(GetSignInWithGoogleOption.Builder(WEB_CLIENT).build()))).credential
        } catch (e: androidx.credentials.exceptions.GetCredentialCancellationException) { return R.Cancel
        } catch (e: Throwable) { return fail("signin", e.javaClass.simpleName, e.message) }
        val gid = try { GoogleIdTokenCredential.createFrom(cred.data).idToken } catch (e: Throwable) { return fail("signin", e.javaClass.simpleName + "/" + cred.type, e.message) }
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val (st, j) = post("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=$FB_KEY", JSONObject()
                    .put("postBody", "id_token=" + URLEncoder.encode(gid, "UTF-8") + "&providerId=google.com")
                    .put("requestUri", "http://localhost").put("returnSecureToken", true).toString(), "application/json")
                if (st != 200 || !j.has("refreshToken")) return@withContext fail("firebase", "http_$st", j.optJSONObject("error")?.optString("message"))
                save(ctx = a, it = j.getString("idToken"), rt = j.getString("refreshToken"), exp = j.optString("expiresIn", "3600"))
                p(a).edit().putString("em", j.optString("email")).putBoolean("asked", true).apply()   // גם מה שנאסף לפני הכניסה נשלח (בתקופת הפיתוח)
                kick(a)
                R.Ok
            } catch (e: Throwable) { fail("firebase", e.javaClass.simpleName, e.message) }
        }
    }

    private fun save(ctx: Context, it: String, rt: String, exp: String) {
        p(ctx).edit().putString("it", it).putString("rt", rt)
            .putLong("ie", System.currentTimeMillis() + ((exp.toLongOrNull() ?: 3600) - 300) * 1000).apply()
    }

    /** אסימון Firebase בתוקף (מתחדש מאסימון הרענון). רק מתהליכון רקע */
    private fun token(ctx: Context, force: Boolean = false): String? {
        val pp = p(ctx)
        if (!force && System.currentTimeMillis() < pp.getLong("ie", 0)) pp.getString("it", null)?.let { return it }
        val rt = pp.getString("rt", "").orEmpty().ifEmpty { return null }
        val (st, j) = post("https://securetoken.googleapis.com/v1/token?key=$FB_KEY",
            "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(rt, "UTF-8"), "application/x-www-form-urlencoded")
        if (st == 400) { pp.edit().remove("it").remove("rt").apply(); return null }   // החשבון בוטל / התנתק — עוצרים
        save(ctx, j.getString("id_token"), j.optString("refresh_token", rt), j.optString("expires_in", "3600"))
        return pp.getString("it", null)
    }

    /** אחרי הורדה: שולחים את האירועים החדשים — לכל היותר פעם בדקה (כשל = מיד, כדי שלא ילך לאיבוד) */
    fun kick(ctx: Context, now: Boolean = false) {
        val app = ctx.applicationContext
        if (!on(app)) return
        if (!now && System.currentTimeMillis() - lastRun < GAP_MS) return
        lastRun = System.currentTimeMillis()
        ex.execute { runCatching { send(app) } }
    }

    private fun send(ctx: Context) {
        if (!on(ctx)) return
        val pp = p(ctx)
        val since = pp.getLong("sentT", 0)
        val evs = DmLogFile.all().filter { it.t > since && it.id != "auth" }.take(BATCH)
        if (evs.isEmpty()) return
        val v = runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: ""
        val body = { tk: String -> JSONObject().put("op", "dmLog").put("idToken", tk).put("cv", CV)
            .put("ev", JSONArray(evs.map { it.json() }))
            .put("dev", JSONObject().put("v", v).put("sdk", Build.VERSION.SDK_INT).put("model", Build.MANUFACTURER + " " + Build.MODEL)).toString() }
        val (st, _) = call(ctx, body) ?: return
        when (st) {
            200 -> pp.edit().putLong("sentT", evs.last().t).apply()
            409 -> setEnabled(ctx, false)   // השרתון דורש נוסח חדש — מכבים עד שה־APK יתעדכן
        }
    }

    /** "מחק את הנתונים שלי" — מהמאגר, ואז התנתקות. מחזיר כמה פריטים נמחקו, או null בתקלה */
    fun forget(ctx: Context): Int? {
        val r = call(ctx) { tk -> JSONObject().put("op", "dmForget").put("idToken", tk).toString() } ?: return null
        if (r.first != 200) return null
        signOut(ctx)
        return r.second.optInt("deleted", 0)
    }

    /** התנתקות: האסימונים נמחקים מהטלפון (הנתונים שכבר נשלחו נשארים עד "מחק") */
    fun signOut(ctx: Context) {
        p(ctx).edit().remove("it").remove("rt").remove("ie").remove("em").apply()
        runCatching { kotlinx.coroutines.runBlocking { CredentialManager.create(ctx).clearCredentialState(ClearCredentialStateRequest()) } }
    }

    /** לשרת שלנו (קודם הכתובת הראשית; 421 / רשת → הגיבוי), עם רענון אחד אחרי 401 */
    private fun call(ctx: Context, body: (String) -> String): Pair<Int, JSONObject>? {
        var tk = token(ctx) ?: return null
        for (attempt in 0..1) {
            var res: Pair<Int, JSONObject>? = null
            for (u in API) {
                res = runCatching { post(u, body(tk), "application/json") }.getOrNull()
                if (res != null && res.first in DONE && res.second.has("ok")) break   // שרתון ישן בלי dmLog (403), 421, 5xx, חסימה בדרך — לגיבוי
            }
            if (res == null) return null
            if (res.first != 401 || attempt == 1) return res
            tk = token(ctx, force = true) ?: return null
        }
        return null
    }

    private fun post(url: String, body: String, type: String): Pair<Int, JSONObject> {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 30000
            c.setRequestProperty("Content-Type", type)
            c.outputStream.use { it.write(body.toByteArray()) }
            val st = c.responseCode
            val txt = (if (st < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            return st to (runCatching { JSONObject(txt) }.getOrDefault(JSONObject()))
        } finally { c.disconnect() }
    }
}
