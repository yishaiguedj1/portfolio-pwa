package io.github.yishaiguedj1.snowball

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 22/10/2026: דפדפן הציד — אילו בקשות הן סרטון, ובלי כפולים / קטעים / פרסומות */
class HuntMediaTest {
    @Test fun kinds() {
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.classify("https://cdn.site.com/v/master.m3u8?token=1")!!.kind)
        assertEquals(HuntMedia.Kind.DASH, HuntMedia.classify("https://cdn.site.com/v/manifest.mpd")!!.kind)
        assertEquals(HuntMedia.Kind.FILE, HuntMedia.classify("https://cdn.site.com/clip.MP4")!!.kind)
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.classify("https://x.akamaized.net/i/v/index.ism/manifest(format=m3u8-aapl)")!!.kind)
    }

    @Test fun ignored() {
        listOf("https://cdn.site.com/v/seg-001.ts", "https://cdn.site.com/v/chunk-5.m4s", "https://cdn.site.com/page.html",
            "https://pubads.g.doubleclick.net/ad.mp4", "https://cdn.site.com/preview/clip.mp4", "blob:https://site.com/abc",
            "javascript:void(0)", "https://cdn.site.com/thumb.jpg").forEach { assertNull(it, HuntMedia.classify(it)) }
    }

    @Test fun found() {
        val f = HuntMedia.Found()
        assertTrue(f.add(HuntMedia.classify("https://c.com/a/clip.mp4?sig=1")!!))
        assertTrue(!f.add(HuntMedia.classify("https://c.com/a/clip.mp4?sig=2")!!))          // אותו קובץ, חתימה אחרת
        assertTrue(f.add(HuntMedia.classify("https://c.com/h/master.m3u8")!!))
        assertTrue(!f.add(HuntMedia.classify("https://c.com/h/720p.m3u8")!!))              // רשימת משנה של אותה ראשית
        assertEquals(HuntMedia.Kind.HLS, f.list.first().kind)                               // הזרם לפני הקובץ
        assertEquals(2, f.size)
    }
}
