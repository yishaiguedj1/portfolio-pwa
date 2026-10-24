package io.github.yishaiguedj1.snowball.dm

import java.io.FilterInputStream
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * חילוץ ZIP (24/10/2026, שלב 3 בדוח): קובץ ZIP שירד → הקבצים שבו בתיקייה בשם הארכיון. טהור (InputStream → כתיבה מוזרקת).
 * הגנות: נתיב בתוך הארכיון לא יוצא מהתיקייה (zip-slip — ‎..‎ / נתיב מוחלט / אות כונן), שמות מנוקים, עד MAX_FILES קבצים
 * ועד MAX_BYTES אחרי פריסה (פצצת ZIP), נספר תוך כדי קריאה ולא לפי מה שהארכיון מצהיר.
 */
object DmZip {
    const val MAX_FILES = 5000
    const val MAX_BYTES = 16L shl 30

    class TooBig : Exception("too_big")

    /** "a/b/../c.txt" → null; "dir\\x.txt" → ["dir", "x.txt"]; שמות מנוקים; תיקייה ("x/") → null */
    fun safeParts(name: String): List<String>? {
        val n = name.replace('\\', '/')
        if (n.endsWith("/") || n.startsWith("/") || Regex("^[A-Za-z]:").containsMatchIn(n)) return null
        val parts = n.split('/').filter { it.isNotEmpty() && it != "." }
        if (parts.isEmpty() || parts.any { it == ".." } || parts.size > 12) return null
        val clean = parts.map { DmName.clean(it) }
        if (clean.any { it.isEmpty() || it.startsWith("__MACOSX") } || clean.last().startsWith("._")) return null
        return clean
    }

    /** כל קובץ בארכיון: write(תיקיות, שם, תוכן). מחזיר כמה חולצו; חריגה → TooBig */
    fun extract(input: InputStream, write: (dirs: List<String>, name: String, data: InputStream) -> Unit): Int {
        var files = 0
        var total = 0L
        ZipInputStream(input).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                if (e.isDirectory) continue
                val parts = safeParts(e.name) ?: continue
                if (++files > MAX_FILES) throw TooBig()
                val counted = object : FilterInputStream(z) {
                    override fun read(): Int { val r = super.read(); if (r >= 0) bump(1); return r }
                    override fun read(b: ByteArray, off: Int, len: Int): Int { val r = super.read(b, off, len); if (r > 0) bump(r.toLong()); return r }
                    override fun close() {}   // לא סוגרים את הארכיון באמצע
                    private fun bump(n: Long) { total += n; if (total > MAX_BYTES) throw TooBig() }
                }
                write(parts.dropLast(1), parts.last(), counted)
            }
        }
        return files
    }

    /** שם התיקייה: שם הארכיון בלי ‎.zip‎ */
    fun folderOf(zipName: String) = DmName.clean(zipName.replace(Regex("\\.zip$", RegexOption.IGNORE_CASE), "")).ifEmpty { "archive" }
}
