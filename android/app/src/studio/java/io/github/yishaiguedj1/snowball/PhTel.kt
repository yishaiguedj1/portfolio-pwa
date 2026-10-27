package io.github.yishaiguedj1.snowball

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import org.json.JSONObject
import java.io.File

/**
 * 27/10/2026 (מאגר הלמידה, סבב 2) — מדידה אוטומטית של "הכל בטלפון": לכל שלב (wav/asr/diar/align) כמה זמן לקח, כמה
 * סוללה ירדה, כמה התחמם, אם היה בטעינה ומה מצב החום של המערכת (0 תקין … 6 כיבוי). רק מספרים — בלי דגם, בלי מזהה.
 * נשמר ב־tel.json בתיקיית העבודה (מצטבר: הפעלה מחדש באמצע שלב מוסיפה זמן ו־n), ונכנס ל־words.json ("tel") —
 * בשרת `job.pw_tel` בודק את הצורה, ו־learn_facts מוסיף אותו לרשומה (`lx.ph`). **השלבים והמפתחות = PW_TEL_* ב־job.py.**
 */
class PhTel(private val f: File, private val snap: () -> Snap) {
    /** b = סוללה באחוזים, c = חום הסוללה ב־°C, ch = בטעינה, th = מצב החום של המערכת (PowerManager, ‎-1 = לא ידוע) */
    data class Snap(val b: Int, val c: Double, val ch: Boolean, val th: Int)

    private val st: JSONObject = try { JSONObject(f.readText()).optJSONObject("st") ?: JSONObject() } catch (e: Exception) { JSONObject() }
    private var cur: String? = null
    private var t0 = 0L

    /** מתחיל שלב (וסוגר את הקודם). שלב שכבר נמדד בהפעלה קודמת — ממשיך לצבור. */
    fun stage(name: String) {
        if (name == cur) return
        end()
        cur = name; t0 = System.currentTimeMillis()
        val s = snapSafe()
        val o = st.optJSONObject(name) ?: JSONObject().also { st.put(name, it) }
        o.put("n", o.optInt("n", 0) + 1)
        if (s != null && !o.has("b0") && s.b >= 0) o.put("b0", s.b)
        if (s != null && !o.has("c0") && !s.c.isNaN()) o.put("c0", round1(s.c))
        save()
    }

    /** סוגר את השלב הנוכחי (בסוף, בעצירה או בשגיאה). */
    fun end() {
        val name = cur ?: return
        cur = null
        val o = st.optJSONObject(name) ?: return
        o.put("t", round1(o.optDouble("t", 0.0) + (System.currentTimeMillis() - t0) / 1000.0))
        snapSafe()?.let { s ->
            if (s.b >= 0) o.put("b1", s.b)
            if (!s.c.isNaN()) o.put("c1", round1(s.c))
            o.put("ch", if (s.ch) 1 else 0)
            if (s.th >= 0) o.put("th", maxOf(o.optInt("th", -1), s.th))
        }
        save()
    }

    /** מה שנכנס ל־words.json */
    fun json(cores: Int, memGb: Int, sdk: Int): JSONObject =
        JSONObject().put("v", 1).put("st", st).put("dev", JSONObject().put("cores", cores).put("mem", memGb).put("sdk", sdk))

    private fun snapSafe(): Snap? = try { snap() } catch (e: Throwable) { null }
    private fun save() { try { val t = File(f.path + ".tmp"); t.writeText(JSONObject().put("st", st).toString()); t.renameTo(f) } catch (e: Exception) { } }
    private fun round1(x: Double) = Math.round(x * 10) / 10.0

    companion object {
        /** המצב של הטלפון עכשיו — בלי הרשאות (ACTION_BATTERY_CHANGED דביק, ‏PowerManager מ־API 29) */
        fun snapOf(ctx: Context): Snap {
            val i: Intent? = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val lv = i?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val sc = i?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val tc = i?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
            val pl = i?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
            val th = if (Build.VERSION.SDK_INT >= 29) (ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.currentThermalStatus ?: -1 else -1
            return Snap(if (lv >= 0 && sc > 0) lv * 100 / sc else -1, if (tc == Int.MIN_VALUE) Double.NaN else tc / 10.0, pl != 0, th)
        }
    }
}
