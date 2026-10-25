package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.OpenableColumns
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONObject
import java.io.File

/**
 * 24/10/2026 — תרגום בטלפון, שלב 1: החלון הקטן של Studio מעל האתר. הכתובות מהאתר שלנו (intent://…#Intent;scheme=snbstudio),
 * אבל כל ערך נבדק כאן כאילו הגיע מכל אפליקציה.
 *   snbstudio://phpick?w=<האתר>&l=he      → בחירת סרטון, העתקה לאחסון הפרטי (ffmpeg לא פותח content://), ffprobe →
 *                                            חזרה לאתר עם ‎#phpick=<pid>.<base64url> (שגיאה: ‎#phpick=!<קוד>)
 *   snbstudio://ph?pid=…&j=…&k=…&b=…&pb=…&ov=0|1[&pw=1&cell=1]   → העבודה נוצרה באתר: הקול, ההתחלה והמדידות (PhService, ברקע);
 *                                            pw=1 — גם התמלול, הדוברים והיישור בטלפון (שלב 2)
 *                                            pt=1 — גם שלבי הטקסט בטלפון (שלב 3, PhPy — job.py בפייתון של האפליקציה)
 *   snbstudio://phburn?pid=…[&j&k&b]       → הצריבה כשהתרגום מוכן
 *   snbstudio://phgo?pid=…                 → להמשיך אחרי שנעצר
 */
class PhActivity : Activity() {
    private val main = Handler(Looper.getMainLooper())
    private lateinit var titleV: TextView
    private lateinit var subV: TextView
    private lateinit var bar: ProgressBar
    private lateinit var btn: Button
    private var web = ""
    @Volatile private var cancelled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(build())
        if (savedInstanceState == null) route(intent)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); main.removeCallbacksAndMessages(null); bar.visibility = View.VISIBLE; route(intent) }

    private fun route(i: Intent?) {
        val d = i?.data
        if (d == null || d.scheme != "snbstudio") { finish(); return }
        DlLang.set(this, d.getQueryParameter("l"))
        web = webOk(d.getQueryParameter("w")) ?: s(R.string.launchUrl)
        PhStore.gc(this); PhStore.gcRemoteAsync(this)
        when (d.host) {
            "phpick" -> pick()
            "ph" -> go(d)
            "phburn" -> burn(d)
            "phgo" -> resume(d)
            else -> finish()
        }
    }

    /* ---------------------------------------------------------------- בחירה */
    private fun pick() {
        titleV.text = s(R.string.phPickT); subV.text = s(R.string.phPickS)
        btn.text = s(R.string.dlCancel); btn.setOnClickListener { cancelled = true; back("#phpick=!cancel") }
        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/*"), REQ_PICK)
    }

    @Deprecated("Activity API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PICK) return
        val u = data?.data
        if (resultCode != RESULT_OK || u == null) { back("#phpick=!cancel"); return }
        copy(u)
    }

    private fun copy(u: Uri) {
        titleV.text = s(R.string.phCopyT); subV.text = s(R.string.phCopyS)
        bar.isIndeterminate = false; bar.progress = 0
        Thread {
            val pid = PhStore.newPid()
            val res = try {
                var name = "video.mp4"; var size = -1L
                contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                    if (c.moveToFirst()) { name = c.getString(0) ?: name; if (!c.isNull(1)) size = c.getLong(1) }
                }
                val work = PhStore.work(this, pid)
                // מקום: העותק + הקול + הצריבה (בערך כמו המקור) + מרווח
                if (size > 0 && StatFs(work.absolutePath).availableBytes < size * 2 + (300L shl 20)) throw IllegalArgumentException("space")
                val ext = name.substringAfterLast('.', "").lowercase().takeIf { Regex("^[a-z0-9]{2,5}$").matches(it) } ?: "mp4"
                val f = File(work, "src.$ext")
                contentResolver.openInputStream(u)!!.use { i -> f.outputStream().use { o ->
                    val buf = ByteArray(1 shl 20); var n = 0L; var last = 0L
                    while (true) {
                        if (cancelled) throw IllegalArgumentException("cancel")
                        val k = i.read(buf); if (k < 0) break; o.write(buf, 0, k); n += k
                        val now = System.currentTimeMillis()
                        if (size > 0 && now - last > 300) { last = now; val p = (n * 100 / size).toInt(); main.post { bar.progress = p } }
                    }
                } }
                main.post { bar.isIndeterminate = true; subV.text = s(R.string.phProbe) }
                val o = PhFf.run(this, PhCore.probeArgs(f.absolutePath), probe = true)
                val probe = try { JSONObject(o.out) } catch (e: Throwable) { null } ?: throw IllegalArgumentException("probe")
                val info = PhCore.info(probe) ?: throw IllegalArgumentException("no_video")
                if (!info.hasAudio) throw IllegalArgumentException("no_audio")
                PhStore.put(this, JSONObject().put("pid", pid).put("name", name.take(200)).put("size", f.length()).put("src", f.absolutePath)
                    .put("probe", probe).put("at", System.currentTimeMillis()).put("web", web).put("st", "picked"))
                "#phpick=$pid." + DlEngine.b64(PhCore.pickJson(pid, name, f.length(), info).toString())
            } catch (e: Throwable) {
                PhStore.drop(this, pid)
                "#phpick=!" + ((e as? IllegalArgumentException)?.message ?: "copy")
            }
            main.post { if (!isFinishing) back(res) }
        }.start()
    }

    /* ---------------------------------------------------------------- העבודה */
    private fun go(d: Uri) {
        val pid = d.getQueryParameter("pid") ?: ""
        val j = d.getQueryParameter("j") ?: ""; val k = d.getQueryParameter("k") ?: ""; val b = d.getQueryParameter("b") ?: ""
        val r = PhStore.get(this, pid)
        if (r == null || !PhCore.JOB_RE.matches(j) || !PhCore.KEY_RE.matches(k) || !PhCore.hostOk(b)) { fail(R.string.phGone); return }
        if (r.optString("job").isNotEmpty() && r.optString("job") != j) { fail(R.string.phGone); return }   // סרטון אחד — עבודה אחת
        val pb = d.getQueryParameter("pb").takeIf { it == "same" || it == "small" } ?: ""
        // pw=1 — "הכל בטלפון" (שלב 2); נקבע פעם אחת לעבודה, כמו בשרתון (spec.pw). cell=1 — מותר להוריד את המודלים בחבילת גלישה
        val pw = if (r.has("pw")) r.optBoolean("pw") else d.getQueryParameter("pw") == "1"
        // pt=1 — שלב 3: גם שלבי הטקסט בטלפון (PhPy). רק עם pw, נקבע פעם אחת לעבודה (spec.pt)
        val pt = pw && (if (r.has("pt")) r.optBoolean("pt") else d.getQueryParameter("pt") == "1")
        PhStore.update(this, pid) { it.put("job", j).put("key", k).put("base", b).put("pb", pb).put("ov", d.getQueryParameter("ov") == "1").put("web", web)
            .put("pw", pw).put("pt", pt).put("cell", d.getQueryParameter("cell") == "1").remove("e") }
        PhGcJob.schedule(this)          // הסרטון נשמר עד שהפרויקט נמחק — הבדיקה ברקע
        startWork(pid, false)
    }

    private fun burn(d: Uri) {
        val pid = d.getQueryParameter("pid") ?: ""
        val r = PhStore.get(this, pid)
        if (r == null || !File(r.optString("src")).isFile) { fail(R.string.phGone); return }
        val j = d.getQueryParameter("j") ?: ""; val k = d.getQueryParameter("k") ?: ""; val b = d.getQueryParameter("b") ?: ""
        if (PhCore.KEY_RE.matches(k) && j == r.optString("job") && PhCore.hostOk(b))     // מפתח חדש מהאתר (הקודם פג)
            PhStore.update(this, pid) { it.put("key", k).put("base", b) }
        d.getQueryParameter("pb")?.takeIf { it == "same" || it == "small" }?.let { pb -> PhStore.update(this, pid) { it.put("pb", pb) } }
        startWork(pid, true)
    }

    private fun resume(d: Uri) {
        val pid = d.getQueryParameter("pid") ?: ""
        val r = PhStore.get(this, pid) ?: run { fail(R.string.phGone); return }
        startWork(pid, r.optString("est") == "burn" || r.optString("st") == "burn")
    }

    private fun startWork(pid: String, burn: Boolean) {
        if (PhService.busy) { fail(R.string.phBusy); return }
        PhService.start(this, pid, burn)
        titleV.text = s(if (burn) R.string.phBurnGo else R.string.phGoT); subV.text = s(R.string.phGoS)
        bar.isIndeterminate = true
        btn.text = s(R.string.dlClose); btn.setOnClickListener { finish() }
        main.postDelayed({ if (!isFinishing) finish() }, 1800)
    }

    private fun fail(msg: Int) {
        titleV.text = s(msg); subV.text = ""
        bar.visibility = View.GONE
        btn.text = s(R.string.dlClose); btn.setOnClickListener { finish() }
    }

    private fun back(hash: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(web + hash), this, MainActivity::class.java))
        finish()
    }

    private fun s(id: Int, vararg a: Any): String = DlLang.of(this).getString(id, *a)
    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    private fun build(): View {
        val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val fg = if (dark) Color.WHITE else Color.parseColor("#1C1C1E")
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#66000000")) }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(22f), dp(24f), dp(16f))
            background = GradientDrawable().apply { cornerRadius = dp(28f).toFloat(); setColor(if (dark) Color.parseColor("#2C2C2E") else Color.WHITE) }
        }
        titleV = TextView(this).apply { setTextColor(fg); textSize = 19f; typeface = Typeface.DEFAULT_BOLD; maxLines = 2 }
        subV = TextView(this).apply { setTextColor(if (dark) Color.parseColor("#AEAEB2") else Color.parseColor("#6C6C70")); textSize = 15f; setPadding(0, dp(6f), 0, dp(14f)) }
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; isIndeterminate = true
            progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#FF4656")); indeterminateTintList = progressTintList }
        btn = Button(this, null, android.R.attr.borderlessButtonStyle).apply { setTextColor(Color.parseColor("#FF4656")); textSize = 16f; isAllCaps = false }
        card.addView(titleV); card.addView(subV); card.addView(bar)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.END; addView(btn) }
        card.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8f) })
        root.addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            .apply { leftMargin = dp(20f); rightMargin = dp(20f) })
        return root
    }

    companion object {
        private const val REQ_PICK = 71
        /** האתר שאליו חוזרים — רק Studio (ייצור / ניסוי) */
        private val WEBS = listOf("https://studio.thesnowball.app/", "https://studio-staging.thesnowball.app/")
        fun webOk(w: String?): String? = w?.let { x -> WEBS.firstOrNull { it == x || it == "$x/" } }
    }
}
