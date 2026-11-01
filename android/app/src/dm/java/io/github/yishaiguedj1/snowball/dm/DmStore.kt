package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * הרשימה של ההורדות — קובץ JSON אחד באחסון הפרטי, נכתב אטומית (קובץ זמני + שינוי שם): גם הריגה באמצע כתיבה
 * לא משאירה רשימה פגומה. ההתקדמות נשמרת כל ~2 שנ׳ (DmFetch.onTick) — אחרי הריגה ממשיכים מהמקטעים השמורים.
 * הממשק מאזין ל־`rev` (מספר שעולה בכל שינוי).
 */
object DmStore {
    private const val FILE = "dm-tasks.json"
    private var loaded = false
    private val tasks = mutableListOf<DmTask>()
    private val _rev = MutableStateFlow(0)
    val rev: StateFlow<Int> = _rev
    private lateinit var dir: File

    @Synchronized
    fun init(ctx: Context) {
        if (loaded) return
        dir = ctx.applicationContext.filesDir
        tasks.clear()
        tasks.addAll(DmTask.listOf(runCatching { File(dir, FILE).readText() }.getOrNull()))
        loaded = true
    }

    @Synchronized fun all(): List<DmTask> = tasks.toList()
    @Synchronized fun get(id: String): DmTask? = tasks.firstOrNull { it.id == id }
    /** הקישור כבר ברשימה (כל מצב, גם הסתיים) — הלוח לא מציע אותו שוב */
    @Synchronized fun has(url: String): Boolean = tasks.any { it.url == url }

    @Synchronized
    fun add(t: DmTask) { tasks.add(0, t); save() }

    @Synchronized
    fun remove(id: String) { tasks.removeAll { it.id == id }; save() }

    /** "להוריד ראשון": התור מתחיל מהישנה (סוף הרשימה) — המשימה עוברת לסוף */
    @Synchronized
    fun moveFirst(id: String) {
        val t = tasks.firstOrNull { it.id == id } ?: return
        tasks.remove(t); tasks.add(t); save()
    }

    /** שמירה + עדכון הממשק */
    @Synchronized
    fun save() {
        val f = File(dir, FILE); val tmp = File(dir, "$FILE.tmp")
        runCatching { tmp.writeText(DmTask.listJson(tasks)); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) } }
        _rev.value = _rev.value + 1
    }

    /** רק הממשק (בלי כתיבה לדיסק) — למהירות שמתעדכנת כל שנייה */
    fun ping() { _rev.value = _rev.value + 1 }

    fun newId(): String = java.util.UUID.randomUUID().toString().replace("-", "").take(16)

    fun exportJson(): String = DmTask.listJson(all().map { t ->
        // ייצוא = רק מה שצריך כדי להוסיף שוב (בלי מקטעים, בלי קבצים בטלפון)
        DmTask(t.id, t.url, t.ref, t.kind).also { it.name = t.name; it.vf = t.vf; it.af = t.af; it.height = t.height; it.audioOnly = t.audioOnly; it.title = t.title }
    })
}

/** ההגדרות (שש שורות במסך + מתקדם) */
class DmPrefs(ctx: Context) {
    private val p = ctx.getSharedPreferences("dm", Context.MODE_PRIVATE)
    var wifiOnly: Boolean get() = p.getBoolean("wifi", false); set(v) = p.edit().putBoolean("wifi", v).apply()
    var parallel: Int get() = p.getInt("par", 3).coerceIn(1, 5); set(v) = p.edit().putInt("par", v.coerceIn(1, 5)).apply()
    var conns: Int get() = p.getInt("conns", 8).coerceIn(1, DmSegs.MAX_CONNS); set(v) = p.edit().putInt("conns", v).apply()
    /** איכות ברירת מחדל לסרטונים: best / 2160 / 1080 / 720 / 480 / audio */
    var quality: String get() = p.getString("q", "best") ?: "best"; set(v) = p.edit().putString("q", v).apply()
    /** פורמט הווידאו: small (AV1/VP9 — הקטן ביותר) / compat (H.264 — מתנגן בכל מכשיר) — DmCodec */
    var codec: String get() = (p.getString("codec", DmCodec.SMALL) ?: DmCodec.SMALL).takeIf { it in DmCodec.MODES } ?: DmCodec.SMALL; set(v) = p.edit().putString("codec", v).apply()
    /** לצרף כתוביות של היוצר כשיש (DmSubs) — הבחירה האחרונה בגיליון */
    var subs: Boolean get() = p.getBoolean("subs", true); set(v) = p.edit().putBoolean("subs", v).apply()
    /** 01/11/2026 (DmHeat): להאט כשהטלפון חם או הסוללה נמוכה — דלוק כברירת מחדל */
    var heat: Boolean get() = p.getBoolean("heat", true); set(v) = p.edit().putBoolean("heat", v).apply()
    var quick: Boolean get() = p.getBoolean("quick", false); set(v) = p.edit().putBoolean("quick", v).apply()
    var firstRun: Boolean get() = p.getBoolean("first", true); set(v) = p.edit().putBoolean("first", v).apply()
    /** הגבלת מהירות לכל ההורדות יחד, בתים לשנייה (0 = בלי הגבלה) */
    var limit: Long get() = p.getLong("lim", 0).coerceAtLeast(0); set(v) = p.edit().putLong("lim", v).apply()
    /** כללים לפי אתר (נלמדים — DmHostRules): "host=n;host=n" */
    var hostRules: String get() = p.getString("hr", "") ?: ""; set(v) = p.edit().putString("hr", v).apply()
    var lastClip: String get() = p.getString("clip", "") ?: ""; set(v) = p.edit().putString("clip", v).apply()
    /** אתרים שבהם הורדת דרך הדפדפן של DM, אחד בשורה (SiteList) — לבועה ב־Chrome */
    var brSites: String get() = p.getString("brs", "") ?: ""; set(v) = p.edit().putString("brs", v).apply()
    /** שפת הממשק: he (ברירת המחדל — כמו בשאר האפליקציות) / en / sys = כמו בטלפון */
    var lang: String get() = (p.getString("lang", "he") ?: "he").takeIf { it in DmLang.MODES } ?: "he"; set(v) = p.edit().putString("lang", v).apply()
}

/** שפה לאפליקציה בלי תלות בשפת הטלפון (minSdk 29 — לפני LocaleManager): הקשר עם locale משלו לפעילות ולהתראות */
object DmLang {
    val MODES = listOf("he", "en", "sys")
    fun wrap(ctx: Context): Context {
        val m = DmPrefs(ctx).lang
        if (m == "sys") return ctx
        val loc = java.util.Locale.forLanguageTag(m)
        val c = android.content.res.Configuration(ctx.resources.configuration)
        c.setLocale(loc); c.setLayoutDirection(loc)
        return ctx.createConfigurationContext(c)
    }
}
