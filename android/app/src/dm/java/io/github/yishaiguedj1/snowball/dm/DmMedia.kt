package io.github.yishaiguedj1.snowball.dm

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.channels.FileChannel

/**
 * הקבצים — ישר ל־MediaStore (בלי הרשאות, בלי עותק כפול של 4GB): קובץ "ממתין" (IS_PENDING) שכותבים אליו במיקום
 * מכמה חיבורים, ובסוף משחררים אותו לגלריה / לתיקיית ההורדות. התיקייה לפי הסוג: Movies · Music · Download ← Studio DM.
 */
object DmMedia {
    const val DIR = "Studio DM"

    private fun where(name: String, mime: String): Pair<Uri, String> = when (DmName.cat(name, mime)) {
        DmName.Cat.VIDEO -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI to "Movies/$DIR"
        DmName.Cat.AUDIO -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI to "Music/$DIR"
        DmName.Cat.IMAGE -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "Pictures/$DIR"
        else -> MediaStore.Downloads.EXTERNAL_CONTENT_URI to "Download/$DIR"
    }

    const val APK = "application/vnd.android.package-archive"

    /** התיקייה שבה הקובץ יישמר (לתצוגה לפני ההורדה) */
    fun folderOf(name: String, mime: String) = where(name, mime).second

    /** קובץ חדש ב־Download (‏rel = נתיב יחסי) שנכתב מזרם — הצצה ל־ZIP. כישלון = הקובץ החלקי נמחק */
    fun saveStream(ctx: Context, rel: String, name: String, write: (java.io.OutputStream) -> Unit): Uri {
        val cr = ctx.contentResolver
        val cv = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeFor(name, ""))
            put(MediaStore.MediaColumns.RELATIVE_PATH, rel)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv) ?: throw DmSpace()
        try {
            cr.openOutputStream(u, "w")?.use { o -> write(o) } ?: throw DmSpace()
            cr.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        } catch (e: Throwable) { runCatching { cr.delete(u, null, null) }; throw e }
        return u
    }

    /** קובץ .apk = תמיד הסוג של חבילת אנדרואיד (גם כשהשרת שלח octet-stream — אחרת מתקין החבילות לא מזהה אותו) */
    fun mimeFor(name: String, mime: String) = if (DmName.ext(name).equals("apk", true)) APK
        else mime.ifEmpty { DmName.mimeOfExt(DmName.ext(name)) }.ifEmpty { "application/octet-stream" }

    /** קובץ ממתין חדש (או הקיים, אם עוד שלנו) */
    fun pending(ctx: Context, t: DmTask): Uri {
        if (t.uri.isNotEmpty()) {
            val u = Uri.parse(t.uri)
            if (exists(ctx, u)) return u
            t.segs.clear()   // הקובץ נמחק בינתיים (או פג אחרי שבוע) — מתחילים מחדש
        }
        val (coll, rel) = where(t.name, t.mime)
        val cv = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, t.name)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeFor(t.name, t.mime))
            put(MediaStore.MediaColumns.RELATIVE_PATH, rel)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val u = ctx.contentResolver.insert(coll, cv) ?: throw DmSpace()
        t.uri = u.toString()
        return u
    }

    private fun exists(ctx: Context, u: Uri): Boolean = try {
        ctx.contentResolver.openFileDescriptor(u, "r")?.use { true } ?: false
    } catch (e: Throwable) { false }

    /** כתיבה במיקום (FileChannel) — כמה חיבורים לאותו קובץ */
    class Sink(ctx: Context, u: Uri) : DmSink {
        private val pfd: ParcelFileDescriptor = ctx.contentResolver.openFileDescriptor(u, "rw") ?: throw DmSpace()
        private val ch: FileChannel = FileOutputStream(pfd.fileDescriptor).channel

        override fun write(pos: Long, buf: ByteArray, len: Int) {
            val b = ByteBuffer.wrap(buf, 0, len)
            var p = pos
            try {
                while (b.hasRemaining()) p += ch.write(b, p)
            } catch (e: java.io.IOException) {
                if ((e.message ?: "").contains("ENOSPC") || (e.message ?: "").contains("No space")) throw DmSpace()
                throw e
            }
        }

        override fun sync() { runCatching { ch.force(false) } }
        fun close() { runCatching { ch.close() }; runCatching { pfd.close() } }
    }

    /** הסוף: חותכים לגודל המדויק ומשחררים לגלריה */
    fun publish(ctx: Context, t: DmTask) {
        val u = Uri.parse(t.uri)
        if (t.total > 0) runCatching {
            ctx.contentResolver.openFileDescriptor(u, "rw")?.use { FileOutputStream(it.fileDescriptor).channel.truncate(t.total) }
        }
        ctx.contentResolver.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
    }

    /** yt-dlp כותב לקובץ רגיל (צריך נתיב) — בסוף מעתיקים פנימה */
    fun importFile(ctx: Context, t: DmTask, f: File) {
        t.name = DmName.titled(t.title, f.name)
        t.mime = DmName.mimeOfExt(DmName.ext(t.name))
        t.uri = ""
        val u = pending(ctx, t)
        ctx.contentResolver.openOutputStream(u, "w")?.use { o -> f.inputStream().use { it.copyTo(o, 1 shl 20) } } ?: throw DmSpace()
        t.total = f.length()
        publish(ctx, t)
        f.parentFile?.deleteRecursively()
    }

    /** חילוץ ZIP (DmZip) ל־Download/Studio DM/<שם הארכיון>/… — כל קובץ דרך MediaStore (בלי הרשאות אחסון). מחזיר כמה חולצו */
    fun extractZip(ctx: Context, t: DmTask): Int {
        val root = "Download/$DIR/" + DmZip.folderOf(t.name)
        val cr = ctx.contentResolver
        val inp = cr.openInputStream(Uri.parse(t.uri)) ?: throw java.io.FileNotFoundException()
        return inp.use { s ->
            DmZip.extract(s) { dirs, name, data ->
                val cv = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeFor(name, ""))
                    put(MediaStore.MediaColumns.RELATIVE_PATH, (listOf(root) + dirs).joinToString("/"))
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv) ?: throw DmSpace()
                try {
                    cr.openOutputStream(u, "w")?.use { o -> data.copyTo(o, 1 shl 16) } ?: throw DmSpace()
                    cr.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                } catch (e: Throwable) { runCatching { cr.delete(u, null, null) }; throw e }
            }
        }
    }

    fun delete(ctx: Context, t: DmTask) {
        if (t.uri.isNotEmpty()) runCatching { ctx.contentResolver.delete(Uri.parse(t.uri), null, null) }
    }
}
