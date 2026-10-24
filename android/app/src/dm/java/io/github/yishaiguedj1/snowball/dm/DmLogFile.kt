package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.File

/** היומן של DM בטלפון (DmLog — שלב א׳): שורת JSON לכל אירוע ב־filesDir, עד MAX_LINES אחרונות. לא יוצא מהטלפון בלי שיתוף מפורש */
object DmLogFile {
    private const val FILE = "dm-log.jsonl"
    private const val MAX_BYTES = 1L shl 20
    private const val MAX_LINES = 2000
    @Volatile private var dir: File? = null

    fun init(ctx: Context) { if (dir == null) dir = ctx.applicationContext.filesDir }

    @Synchronized
    fun add(e: DmLog.Event) {
        val d = dir ?: return
        runCatching {
            val f = File(d, FILE)
            f.appendText(e.json().toString() + "\n")
            if (f.length() > MAX_BYTES) {
                val keep = f.readLines().takeLast(MAX_LINES / 2)
                val tmp = File(d, "$FILE.tmp"); tmp.writeText(keep.joinToString("\n", postfix = "\n")); tmp.renameTo(f)
            }
        }
    }

    @Synchronized
    fun all(): List<DmLog.Event> {
        val f = File(dir ?: return emptyList(), FILE)
        return runCatching { f.readLines().mapNotNull { l -> runCatching { DmLog.Event.of(JSONObject(l)) }.getOrNull() } }.getOrDefault(emptyList())
    }

    @Synchronized fun clear() { dir?.let { runCatching { File(it, FILE).delete() } } }

    /** הטקסט לשיתוף: גרסה, מכשיר, אנדרואיד — ואז האירועים */
    fun exportText(ctx: Context): String {
        val v = runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "?"
        val head = "Studio DM $v · Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) · ${Build.MANUFACTURER} ${Build.MODEL}"
        return DmLog.export(head, all())
    }
}
