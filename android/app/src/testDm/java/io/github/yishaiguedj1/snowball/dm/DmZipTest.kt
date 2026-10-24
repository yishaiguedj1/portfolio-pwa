package io.github.yishaiguedj1.snowball.dm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class DmZipTest {
    private fun zip(vararg files: Pair<String, ByteArray>): ByteArray {
        val bo = ByteArrayOutputStream()
        ZipOutputStream(bo).use { z -> for ((n, d) in files) { z.putNextEntry(ZipEntry(n)); z.write(d); z.closeEntry() } }
        return bo.toByteArray()
    }

    @Test fun safeParts() {
        assertNull(DmZip.safeParts("../../etc/passwd"))
        assertNull(DmZip.safeParts("/abs.txt"))
        assertNull(DmZip.safeParts("C:\\x.txt"))
        assertNull(DmZip.safeParts("dir/"))
        assertNull(DmZip.safeParts("__MACOSX/._a.jpg"))
        assertEquals(listOf("docs", "a.txt"), DmZip.safeParts("docs\\a.txt"))
        assertEquals(listOf("b.txt"), DmZip.safeParts("./b.txt"))
    }

    @Test fun extractsAndSkipsEvil() {
        val got = mutableMapOf<String, String>()
        val n = DmZip.extract(ByteArrayInputStream(zip("a/b.txt" to "שלום".toByteArray(), "../evil.sh" to "x".toByteArray(), "c.txt" to "ok".toByteArray()))) { d, name, data ->
            got[(d + name).joinToString("/")] = data.readBytes().toString(Charsets.UTF_8)
        }
        assertEquals(2, n); assertEquals("שלום", got["a/b.txt"]); assertEquals("ok", got["c.txt"])
    }

    @Test fun folderName() { assertEquals("מכתבים 2023", DmZip.folderOf("מכתבים 2023.ZIP")) }
}
