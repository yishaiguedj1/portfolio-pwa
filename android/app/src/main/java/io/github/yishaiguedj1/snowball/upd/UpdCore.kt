package io.github.yishaiguedj1.snowball.upd

import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.security.MessageDigest

/* 08/11/2026 (בקשת המשתמש: "עדכון כמו עדכון המערכת במכשיר, ברקע, ורק הודעה בסיום"): הליבה הטהורה של העדכון העצמי —
   קריאת latest.json (נכתב ב־android.yml אחרי העלאת ה־APKים), ההחלטה אם יש עדכון, ובדיקת הקובץ שירד.
   בלי Android — נבדק ב־testStudio (UpdCoreTest). הצורה של latest.json = אותה צורה ב־android.yml (tests/apk-update.test.js) */
object UpdCore {
    /** גרסה שפורסמה לאפליקציה אחת. code = versionCode (מספר הריצה של android.yml — עולה בכל בנייה) */
    data class Rel(val code: Long, val name: String, val file: String, val size: Long, val sha: String)

    /** {"v":1,"code":812,"name":"1.0.812","apps":{"<חבילה>":{"f":"the-snowball-studio.apk","n":123,"h":"<sha256>"}}} */
    fun parse(json: String, pkg: String): Rel? = try {
        val o = JSONObject(json)
        val a = o.optJSONObject("apps")?.optJSONObject(pkg)
        val code = o.optLong("code", 0)
        val f = a?.optString("f", "") ?: ""
        val h = (a?.optString("h", "") ?: "").lowercase()
        // רק שם קובץ פשוט (בלי "/") ו־sha256 מלא — כל דבר אחר = מתעלמים מהגרסה
        if (a == null || code <= 0 || !FILE.matches(f) || !SHA.matches(h)) null
        else Rel(code, o.optString("name", "").take(40), f, a.optLong("n", 0), h)
    } catch (e: Exception) { null }

    private val FILE = Regex("^[a-z0-9][a-z0-9._-]{0,80}\\.apk$")
    private val SHA = Regex("^[0-9a-f]{64}$")

    fun newer(installed: Long, r: Rel?): Boolean = r != null && r.code > installed

    fun sha256(input: InputStream): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(1 shl 16)
        while (true) { val n = input.read(buf); if (n < 0) break; md.update(buf, 0, n) }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /** הקובץ שירד = בדיוק מה שפורסם (גודל + sha256). אנדרואיד בודק בנוסף שהחתימה זהה לאפליקציה המותקנת */
    fun verify(f: File, r: Rel): Boolean =
        f.isFile && (r.size <= 0 || f.length() == r.size) && f.inputStream().use { sha256(it) } == r.sha

    /** הורדה עם המשך (Range: bytes=<have>-): מאיפה לכתוב לפי קוד התשובה. 206 = המשך; 200 = השרת שלח הכל — מההתחלה;
        אחר = null (לא כותבים) */
    fun writeFrom(code: Int, have: Long): Long? = when {
        code == 206 && have > 0 -> have
        code == 200 -> 0L
        else -> null
    }

    /** תקלה זמנית — לנסות שוב אחר כך (ולא "נכשל"): עומס/שרת, או קובץ מקומי שלא תואם (416 — מוחקים ומתחילים מחדש) */
    fun transient(code: Int): Boolean = code == 408 || code == 416 || code == 429 || code >= 500

    /** "112 MB" / "8.4 MB" — הגודל בשורת העדכון */
    fun mb(bytes: Long): String {
        if (bytes <= 0) return ""
        val m = bytes / 1048576.0
        return if (m >= 10) "${Math.round(m)} MB" else String.format(java.util.Locale.US, "%.1f MB", m)
    }
}
