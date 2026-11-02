package io.github.yishaiguedj1.snowball.dm

import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.decoder.Decoder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 02/11/2026 (סבב 4, ‏11): קוד ה־QR שהתוסף לכרום מייצר (android/chrome-ext/qr.js — נכתב לפי התקן) נקרא נכון במפענח של zxing,
 * והקישור שבו הופך לבקשת הוספה בגיליון (DmScan). המקרים: tools/chrome-ext-qr.mjs → resources/qr
 */
class DmQrExtTest {
    @Test fun extensionQrDecodes() {
        var n = 0
        while (true) {
            val txt = javaClass.classLoader!!.getResourceAsStream("qr/case${n + 1}.txt")?.bufferedReader()?.readText() ?: break
            val lines = txt.trim().lines()
            val want = String(java.util.Base64.getDecoder().decode(lines[0]), Charsets.UTF_8)
            val rows = lines.drop(1)
            val m = BitMatrix(rows.size)
            rows.forEachIndexed { y, r -> r.forEachIndexed { x, c -> if (c == '#') m.set(x, y) } }
            assertEquals("case${n + 1}", want, Decoder().decode(m).text)
            if (want.startsWith("studiodm://")) assertTrue(DmScan.parse(want)?.urls?.size == 1)
            n++
        }
        assertTrue("יש מקרים", n >= 5)
    }
}
