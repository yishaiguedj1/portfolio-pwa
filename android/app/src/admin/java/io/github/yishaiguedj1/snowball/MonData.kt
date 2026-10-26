package io.github.yishaiguedj1.snowball

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/*
 * מרכז הניהול (23/10/2026): נתוני הווידג'ט + הקריאה לשרתון. החוזה מול השרתון: POST /api/studio {"op":"adminMon"}
 * עם X-Mon-Token ו־Origin של אתר הניהול. התשובה: {ok, now, mon:{servers:[…], jobs:[…]}} — ראו MonParse.
 * הטוקן: רק ב־SharedPreferences פרטיות של האפליקציה (MODE_PRIVATE; allowBackup=false). לעולם לא בלוג או בהודעה.
 */

/** שמירה מקומית: הטוקן, המודל האחרון (JSON כמו שהגיע מהשרתון, בלי הטוקן) ושעת הקבלה האחרונה */
object MonStore {
    private const val PREFS = "snowball_admin_mon"
    private fun p(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun token(c: Context): String = p(c).getString("tok", "") ?: ""

    /** טוקן חדש = מוחקים את הנתונים של הקודם */
    fun setToken(c: Context, t: String) { p(c).edit().clear().putString("tok", t).apply() }

    /** מחיקת הטוקן וכל מה שנשמר איתו */
    fun clear(c: Context) { p(c).edit().clear().apply() }

    fun model(c: Context): String? = p(c).getString("model", null)
    fun updated(c: Context): Long = p(c).getLong("t", 0L)

    fun saveModel(c: Context, json: String, t: Long) {
        p(c).edit().putString("model", json).putLong("t", t).putBoolean("auth", false).apply()
    }

    /** 401 מהשרתון — הטוקן בוטל/לא תקף. הנתון האחרון נשמר, אבל הווידג'ט מציג "לחבר מחדש" */
    fun authBad(c: Context): Boolean = p(c).getBoolean("auth", false)
    fun setAuthBad(c: Context) { p(c).edit().putBoolean("auth", true).apply() }
}

class MonHb(
    val cu: Double,      // מעבד %
    val mem: Double,     // זיכרון %
    val disk: Double,    // דיסק %
    val free: Double,    // דיסק פנוי (GB)
    val rx: Double,      // בייטים לשנייה (קבלה)
    val tx: Double,      // בייטים לשנייה (שליחה)
    val busy: String,    // מזהה עבודה, או ""
    val psi: Double = Double.NaN,  // 26/10/2026: לחץ זיכרון %
    val up: Double = Double.NaN,   // כמה זמן השרת פועל (שניות)
    val dl: Boolean = false,       // פחות מ־8GB פנויים — לא לוקח עבודה חדשה
) // ערך שחסר/לא מספרי = NaN

/** 26/10/2026: עבודה שרצה עכשיו (mon.jobs): על איזה שרת, השלב (up/tr/al/tl/rv/bn/sv) והאחוז (0–1, NaN = לא ידוע) */
class MonJob(val sid: String, val st: String, val p: Double)

class MonServer(
    val id: String,
    val name: String,
    val online: Boolean,
    val paused: Boolean,
    val seen: Long,            // מילישניות (Date.now של השרתון) של הפעם האחרונה שדיווח, 0 = מעולם
    val warn: List<String>,    // cu / mem / disk / psi
    val hb: MonHb?,
)

/** 24/10/2026: האחסון והעלות (adminMon.sto). ערך חסר = NaN / "" */
class MonSto(
    val r2Gb: Double,     // כל הדליים של R2 (GB)
    val proj: Double,     // צפי העלות של R2 לחודש ($)
    val mtd: Double,      // עד היום ($)
    val r2Err: String,    // קוד השגיאה האחרונה במדידה, או ""
    val driveGb: Double,  // הגיבוי ב־Drive (GB)
    val driveLim: Double, // המכסה של ה־Drive (GB)
)

class MonSnap(val now: Long, val servers: List<MonServer>, val jobs: List<MonJob>, val sto: MonSto? = null)

object MonParse {
    /** מחזיר null אם ok=false או שהמבנה לא תקין (לא זורק) */
    fun parse(json: String?): MonSnap? {
        if (json.isNullOrEmpty()) return null
        return try {
            val o = JSONObject(json)
            if (!o.optBoolean("ok", false)) return null
            val m = o.optJSONObject("mon") ?: return null
            val arr = m.optJSONArray("servers") ?: JSONArray()
            MonSnap(
                now = o.optLong("now", 0L),
                servers = List(arr.length()) { arr.getJSONObject(it).toServer() },
                jobs = m.optJSONArray("jobs")?.let { a -> List(a.length()) { a.getJSONObject(it).let { j ->
                    MonJob(j.optString("sid"), j.optString("st"), if (j.isNull("p")) Double.NaN else j.optDouble("p", Double.NaN)) } } } ?: emptyList(),
                sto = o.optJSONObject("sto")?.toSto(),
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun JSONObject.toSto(): MonSto {
        val r2 = optJSONObject("r2")
        val dr = optJSONObject("drive")
        return MonSto(
            r2Gb = r2?.optDouble("gb", Double.NaN) ?: Double.NaN,
            proj = r2?.optDouble("proj", Double.NaN) ?: Double.NaN,
            mtd = r2?.optDouble("mtd", Double.NaN) ?: Double.NaN,
            r2Err = optString("r2e"),
            driveGb = dr?.optDouble("gb", Double.NaN) ?: Double.NaN,
            driveLim = dr?.optDouble("lim", Double.NaN) ?: Double.NaN,
        )
    }

    private fun JSONObject.toServer(): MonServer {
        val hbo = optJSONObject("hb")
        val w = optJSONArray("warn")
        val warn = if (w == null) emptyList() else List(w.length()) { w.optString(it) }.filter { it.isNotEmpty() }
        return MonServer(
            id = optString("id"),
            name = optString("name").ifEmpty { optString("id") },
            online = optBoolean("online", false),
            paused = optBoolean("paused", false),
            seen = optLong("seen", 0L),
            warn = warn,
            hb = hbo?.let {
                MonHb(
                    cu = it.optDouble("cu", Double.NaN),
                    mem = it.optDouble("mem", Double.NaN),
                    disk = it.optDouble("disk", Double.NaN),
                    free = it.optDouble("free", Double.NaN),
                    rx = it.optDouble("rx", Double.NaN),
                    tx = it.optDouble("tx", Double.NaN),
                    busy = it.optString("busy"),
                    psi = it.optDouble("psi", Double.NaN),
                    up = it.optDouble("up", Double.NaN),
                    dl = it.optInt("dl", 0) == 1,
                )
            },
        )
    }
}

/** הקריאה לשרתון. לא מדפיסה ולא מעבירה הודעות שגיאה חופשיות — הטוקן לא יכול להיכנס ללוג */
object MonApi {
    private const val PROXY = "https://ibkr-proxy-wine.vercel.app"   // כמו WidgetStore.PROXY ב־Invest
    private const val ORIGIN = "https://admin.thesnowball.app"       // השרתון מאשר רק Origin של אתרי האפליקציה
    private const val BODY = "{\"op\":\"adminMon\"}"

    sealed class Res {
        class Ok(val json: String) : Res()
        object NoAuth : Res()   // 401 — טוקן שגוי/בוטל
        object Fail : Res()     // רשת נפלה / 5xx / תשובה לא תקינה
    }

    fun fetch(token: String): Res {
        val conn = URL("$PROXY/api/studio").openConnection() as HttpURLConnection
        return try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Origin", ORIGIN)
            conn.setRequestProperty("X-Mon-Token", token)
            conn.outputStream.use { it.write(BODY.toByteArray(Charsets.UTF_8)) }
            when (conn.responseCode) {
                200 -> {
                    val body = conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
                    if (MonParse.parse(body) != null) Res.Ok(body) else Res.Fail
                }
                401 -> Res.NoAuth
                else -> Res.Fail
            }
        } catch (e: Exception) {
            Res.Fail
        } finally {
            conn.disconnect()
        }
    }
}
