package io.github.yishaiguedj1.snowball

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 22/10/2026: בועת ההורדה — מתי מציעים (VideoUrl) והתאמה בין רשימת הדפדפנים בקוד לזו של שירות הנגישות */
class VideoUrlTest {
    private fun video(s: String) = assertTrue(s, VideoUrl.classify(s) is VideoUrl.Hit.Video)
    private fun none(s: String) = assertEquals(s, VideoUrl.Hit.None, VideoUrl.classify(s))

    @Test fun videoPages() {
        listOf(
            "youtube.com/watch?v=dQw4w9WgXcQ", "m.youtube.com/watch?v=dQw4w9WgXcQ&t=30", "https://www.youtube.com/shorts/abcDEF123",
            "youtu.be/dQw4w9WgXcQ", "music.youtube.com/watch?v=dQw4w9WgXcQ", "vimeo.com/76979871", "player.vimeo.com/video/76979871",
            "ted.com/talks/some_talk", "tiktok.com/@user/video/7123456789012345678", "instagram.com/reel/Cabc123",
            "x.com/user/status/1234567890", "twitter.com/user/status/1234567890", "facebook.com/watch?v=123",
            "dailymotion.com/video/x8abc", "twitch.tv/videos/123456", "reddit.com/r/videos/comments/abc12/title",
            "cdn.example.com/files/clip.MP4", "example.org/live/master.m3u8", "archive.org/details/some-film",
        ).forEach(::video)
    }

    @Test fun notVideo() {
        listOf(
            "youtube.com/feed/subscriptions", "youtube.com/watch", "youtube.com/@channel", "vimeo.com/about", "google.com/search?q=x",
            "ynet.co.il/news/article/abc", "", "חיפוש בגוגל", "search terms with spaces", "localhost", "youtube.com/?app=desktop",
        ).forEach(::none)
    }

    @Test fun siteOnly() {
        assertEquals(VideoUrl.Hit.SiteOnly("youtube.com"), VideoUrl.classify("m.youtube.com"))
        assertEquals(VideoUrl.Hit.SiteOnly("vimeo.com"), VideoUrl.classify("https://vimeo.com/"))
    }

    @Test fun schemeAdded() {
        assertEquals(VideoUrl.Hit.Video("https://youtu.be/dQw4w9WgXcQ"), VideoUrl.classify("  youtu.be/dQw4w9WgXcQ "))
    }

    /** הניסוי: דף רגיל באתר לא מוכר → הכתובת; דף בית/חיפוש — לא. וזיהוי נגן לפי התפקיד שכרום מעביר */
    @Test fun deepPage() {
        assertEquals("https://news.example.co.il/article/123", VideoUrl.page("news.example.co.il/article/123"))
        listOf("news.example.co.il", "google.com/search?q=x", "https://www.google.com/search?q=x", "חדשות", "a b/c").forEach { assertEquals(it, null, VideoUrl.page(it)) }
        assertTrue(VideoUrl.isVideoNode("android.view.View", "video", null))
        assertTrue(VideoUrl.isVideoNode("android.widget.VideoView", null, null))
        assertTrue(VideoUrl.isVideoNode("android.view.View", null, "סרטון"))
        assertTrue(!VideoUrl.isVideoNode("android.widget.Button", "button", "button"))
        assertTrue(!VideoUrl.isVideoNode(null, null, null))
    }

    /** כל דפדפן שהשירות מקבל ממנו אירועים — יודעים איפה שורת הכתובת שלו, ולהפך */
    @Test fun browserListsMatch() {
        val xml = File("src/bubble/res/xml/grab_service.xml").readText()
        val pk = Regex("""packageNames="([^"]+)"""").find(xml)!!.groupValues[1].split(',').map { it.trim() }.toSet()
        assertEquals(GrabService.URL_BAR.keys, pk)
    }
}
