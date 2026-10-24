package io.github.yishaiguedj1.snowball.dm

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DmFindTest {
    @Test fun match() {
        assertTrue(DmFind.match("באפט 2023", "מכתב באפט 2023.pdf", "", "example.com"))
        assertTrue(DmFind.match("YOUTUBE", "a.mp4", "", "youtube.com"))
        assertTrue(DmFind.match("  ", "x"))
        assertFalse(DmFind.match("באפט 2024", "מכתב באפט 2023.pdf", "", ""))
    }
}
