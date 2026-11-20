package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.content.ClipData
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
 *   snbstudio://phpick?w=<האתר>&l=he&nu=1 → 1/11/2026: תרגום רגיל בשרת — בחירה בלי עותק (הרשאה קבועה ל־URI), MediaExtractor
 *                                            במקום ffprobe → ‎#phpick=<pid>.<base64url> עם "nu":1 (PhPu)
 *   snbstudio://phpick?w=<האתר>&l=he      → בחירת סרטון, העתקה לאחסון הפרטי (ffmpeg לא פותח content://), ffprobe →
 *                                            חזרה לאתר עם ‎#phpick=<pid>.<base64url> (שגיאה: ‎#phpick=!<קוד>)
 *   snbstudio://ph?pid=…&j=…&k=…&b=…&pb=…&ov=0|1[&pw=1&cell=1]   → העבודה נוצרה באתר: הקול, ההתחלה והמדידות (PhService, ברקע);
 *                                            pw=1 — גם התמלול, הדוברים והיישור בטלפון (שלב 2)
 *                                            pt=1 — גם שלבי הטקסט בטלפון (שלב 3, PhPy — job.py בפייתון של האפליקציה)
 *   snbstudio://phq?b=…&q=pid.j.k~pid.j.k… → 20/11/2026: תור עבודות — כמה בחירות nu בפתיחה אחת; הקול של כל אחת עולה
 *                                            אחרי הקודמת (PhService.enqueue), והסרטונים לענן ב־UIDT (CAP 7, studio.js PH_CAP_Q)
 *   snbstudio://phpick?…&nu=1&m=1          → 20/11/2026: בחירה מרובה לתור — כל סרטון כמו nu, חזרה עם ‎#phpicks=<pid.b64>~… (עד Q_MAX)
 *   snbstudio://phq2?b=…&q=…               → 20/11/2026: כמו phq, ופריט יכול להיות גם קישור להורדה כאן ("pid.j.k.<b64url>", PhYt —
 *                                            יוטיוב חוסם את השרת). host חדש: Studio ישן לא מכיר אותו → הדף מקבל ‎#phpick=!yqold
 *   snbstudio://phburn?pid=…[&j&k&b]       → הצריבה כשהתרגום מוכן
 *   snbstudio://phgo?pid=…                 → להמשיך אחרי שנעצר
 *   snbstudio://phpv?pid=…                 → 5/11/2026: חיתוך לפני התרגום (nu) — הסרטון שכבר נבחר עובר לדף לתצוגה בעורך
 *                                            (Web Share Target: ‎/share-file עם "snbpv:<pid>" → ‎#got=), בלי בחירה שנייה
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
            "phpick" -> pick(d.getQueryParameter("nu") == "1", d.getQueryParameter("m") == "1")
            "ph" -> go(d)
            "phq" -> goQ(d, false)
            "phq2" -> goQ(d, true)
            "phburn" -> burn(d)
            "phgo" -> resume(d)
            "phpv" -> preview(d)
            else -> finish()
        }
    }

    /* ---------------------------------------------------------------- תצוגה בעורך (5/11/2026) */
    /** הסרטון של בחירת nu (ה־URI עם ההרשאה הקבועה) נשלח ל־MainActivity כמו "שיתוף ← Studio" — Chrome שולח אותו ב־POST
     *  ל־‎/share-file, ו־sw.js מעביר לדף (‎#got=). רק לתצוגה בעורך: ההעלאה נשארת כאן (PhUpJob), מאותו URI */
    private fun preview(d: Uri) {
        val pid = d.getQueryParameter("pid") ?: ""
        val r = PhStore.get(this, pid)
        val u = r?.optString("uri", "")?.takeIf { r.optBoolean("pu") && it.startsWith("content://") }?.let { Uri.parse(it) }
        if (u == null) { back("#phpick=!probe"); return }
        startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_SEND).setType("video/*")
            .putExtra(Intent.EXTRA_STREAM, u).putExtra(Intent.EXTRA_TEXT, "snbpv:$pid")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).also { it.clipData = ClipData.newRawUri("", u) })
        finish()
    }

    /* ---------------------------------------------------------------- בחירה */
    private fun pick(pu: Boolean, many: Boolean) {
        titleV.text = s(R.string.phPickT); subV.text = s(R.string.phPickS)
        btn.text = s(R.string.dlCancel); btn.setOnClickListener { cancelled = true; back("#phpick=!cancel") }
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/*")
        if (pu) i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        if (pu && many) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)   // 20/11/2026: תור עבודות — כמה סרטונים בבחירה אחת
        startActivityForResult(i, if (pu && many) REQ_PICK_PUM else if (pu) REQ_PICK_PU else REQ_PICK)
    }

    @Deprecated("Activity API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PICK && requestCode != REQ_PICK_PU && requestCode != REQ_PICK_PUM) return
        if (requestCode == REQ_PICK_PUM) {
            val us = ArrayList<Uri>()
            data?.clipData?.let { c -> for (k in 0 until c.itemCount) c.getItemAt(k).uri?.let { if (it !in us) us.add(it) } }
            data?.data?.let { if (it !in us) us.add(it) }
            if (resultCode != RESULT_OK || us.isEmpty()) { back("#phpick=!cancel"); return }
            pickMany(us.take(PhCore.Q_MAX)); return
        }
        val u = data?.data
        if (resultCode != RESULT_OK || u == null) { back("#phpick=!cancel"); return }
        if (requestCode == REQ_PICK_PU) pickPu(u) else copy(u)
    }

    /** 20/11/2026: בחירה מרובה (תור עבודות) — כל סרטון כמו pickPu, אחד אחרי השני (בלי עותק: רק המטא־נתונים, שניות לכל אחד).
     *  חזרה עם כל מה שהצליח (‎#phpicks=); מה שנכשל — מדלגים. הכל נכשל — הקוד של הראשון */
    private fun pickMany(us: List<Uri>) {
        titleV.text = s(R.string.phPuProbe); subV.text = ""
        bar.isIndeterminate = false; bar.progress = 0
        Thread {
            val ok = ArrayList<String>(); var err = ""
            for ((n, u) in us.withIndex()) {
                if (cancelled) break
                val r = puOne(u)
                if (r.startsWith("!")) { if (err.isEmpty()) err = r.substring(1) } else ok.add(r)
                val p = (n + 1) * 100 / us.size
                main.post { bar.progress = p; subV.text = s(R.string.phPickN, n + 1, us.size) }
            }
            val res = if (ok.isNotEmpty()) "#phpicks=" + ok.joinToString("~") else "#phpick=!" + (if (cancelled) "cancel" else err.ifEmpty { "probe" })
            main.post { if (!isFinishing) back(res) }
        }.start()
    }

    /** 1/11/2026 (pu): בלי עותק — ההרשאה ל־URI נשמרת (PhUpJob קורא ממנו גם אחרי הפעלה מחדש), והמידות והאורך מ־MediaExtractor */
    private fun pickPu(u: Uri) {
        titleV.text = s(R.string.phPuProbe); subV.text = ""
        bar.isIndeterminate = true
        Thread {
            val r = puOne(u)
            val res = "#phpick=$r"
            main.post { if (!isFinishing) back(res) }
        }.start()
    }

    /** סרטון אחד (pu): "pid.base64url" או "!קוד" */
    private fun puOne(u: Uri): String {
        val pid = PhStore.newPid()
        return try {
            try { contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: Throwable) {}
            var name = "video.mp4"; var size = -1L
            contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) { name = c.getString(0) ?: name; if (!c.isNull(1)) size = c.getLong(1) }
            }
            if (size <= 0) size = contentResolver.openFileDescriptor(u, "r")?.use { it.statSize } ?: -1L
            if (size <= 0) throw IllegalArgumentException("probe")
            if (cancelled) throw IllegalArgumentException("cancel")
            val info = PhPu.probe(this, u) ?: throw IllegalArgumentException("no_video")
            if (!info.hasAudio) throw IllegalArgumentException("no_audio")
            PhStore.put(this, JSONObject().put("pid", pid).put("name", name.take(200)).put("size", size).put("uri", u.toString()).put("pu", true)
                .put("at", System.currentTimeMillis()).put("web", web).put("st", "picked"))
            val oh = try { PhPu.osHash(PhPu.UriSrc(this, u, size)) } catch (e: Throwable) { "" }
            "$pid." + DlEngine.b64(PhCore.pickJson(pid, name, size, info, oh).put("nu", 1).toString())
        } catch (e: Throwable) {
            PhStore.drop(this, pid)
            try { contentResolver.releasePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (x: Throwable) {}
            "!" + ((e as? IllegalArgumentException)?.message ?: "probe")
        }
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
                val oh = try { PhCore.osHash(f) } catch (e: Throwable) { "" }
                "#phpick=$pid." + DlEngine.b64(PhCore.pickJson(pid, name, f.length(), info, oh).toString()) + subsOf(f, probe, work).let { if (it.isEmpty()) "" else ".$it" }
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
        // vc=1 — 29/10/2026: גם הסרטון לענן, ברקע (PhUpJob); נקבע פעם אחת לעבודה, כמו בשרתון (spec.vc)
        val vc = r.optBoolean("pu") || if (r.has("vc")) r.optBoolean("vc") else d.getQueryParameter("vc") == "1"   // pu — הסרטון תמיד לענן
        PhStore.update(this, pid) { it.put("job", j).put("key", k).put("base", b).put("pb", pb).put("ov", d.getQueryParameter("ov") == "1").put("web", web)
            .put("pw", pw).put("pt", pt).put("vc", vc).put("cell", d.getQueryParameter("cell") == "1").remove("e") }
        PhGcJob.schedule(this)          // הסרטון נשמר עד שהפרויקט נמחק — הבדיקה ברקע
        startWork(pid, false)
        videoJob(pid)
    }

    /** 20/11/2026: תור עבודות — כל פריט כמו go() (בחירת nu בלבד: הסרטון לענן תמיד), ובלי "Studio עסוק": הכל נכנס לתור של
     *  PhService ועולה אחד אחרי השני. פריט שלא עבר את הבדיקות — מדלגים עליו (השאר ממשיכים) */
    private fun goQ(d: Uri, links: Boolean) {
        val b = d.getQueryParameter("b") ?: ""
        if (!PhCore.hostOk(b)) { fail(R.string.phGone); return }
        val pids = ArrayList<String>()
        for (x in (d.getQueryParameter("q") ?: "").split('~').take(PhCore.Q_MAX)) {
            val (pid, j, k, u) = PhCore.qItem(x, links) ?: continue
            // phq2: קישור — הרשומה נוצרת כאן (ה־pid מהדף), והסרטון יורד ב־PhService לפני הקול (PhYt). אותו pid שוב — רק אותו קישור
            if (u.isNotEmpty() && PhStore.get(this, pid) == null)
                PhStore.put(this, JSONObject().put("pid", pid).put("name", "").put("size", 0L).put("uri", "").put("yu", u).put("pu", true)
                    .put("at", System.currentTimeMillis()).put("web", web).put("st", "picked"))
            val r = PhStore.get(this, pid) ?: continue
            if (!r.optBoolean("pu") || r.optString("yu") != u) continue
            if (r.optString("job").isNotEmpty() && r.optString("job") != j) continue   // סרטון אחד — עבודה אחת
            PhStore.update(this, pid) { it.put("job", j).put("key", k).put("base", b).put("pb", "").put("ov", false).put("web", web)
                .put("pw", false).put("pt", false).put("vc", true).put("cell", false).remove("e") }
            pids.add(pid)
        }
        if (pids.isEmpty()) { fail(R.string.phGone); return }
        PhGcJob.schedule(this)
        videoJobs(pids)   // 20/11/2026: משימה אחת לכל הרשימה, לפי הסדר (קודם — כל תזמון החליף את הקודם)
        PhService.enqueue(this, pids)
        titleV.text = s(R.string.phGoT); subV.text = s(R.string.phGoS)
        bar.isIndeterminate = true
        btn.text = s(R.string.dlClose); btn.setOnClickListener { finish() }
        main.postDelayed({ if (!isFinishing) finish() }, 1800)
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
        videoJob(pid)
    }

    /** 29/10/2026: הסרטון לענן — משימת UIDT כל עוד החלון גלוי (רק אז מותר לתזמן אותה). לא הצליח (מתחת ל־14) — PhService
     *  מעלה אחרי הקול (vJob=false). כבר עלה / נכשל סופית — כלום */
    private fun videoJob(pid: String) = videoJobs(listOf(pid))

    private fun videoJobs(pids: List<String>) {
        val l = pids.filter { p -> PhStore.get(this, p)?.let { it.optBoolean("vc") && it.optString("vId").isEmpty() } ?: false }
        if (l.isEmpty()) return
        // והסרטונים שנתקעו (משימה שהוחלפה) — אחרי החדשים; merge ב־schedule שומר על מה שכבר מחכה במשימה ומסיר כפילויות
        val ok = PhUpJob.schedule(this, l + PhStore.lostVideos(this))
        for (pid in l) PhStore.update(this, pid) { it.put("vJob", ok).remove("vE") }
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

    /** 30/10/2026: הכתוביות שבתוך הסרטון — לטופס (רשות: תקלה = בלי) */
    private fun subsOf(f: File, probe: JSONObject, work: File): String = try {
        val L = PhCore.subs(probe)
        if (L.isEmpty()) "" else {
            val dir = File(work, "subs").apply { mkdirs() }
            PhFf.run(this, PhCore.subsArgs(f.absolutePath, L, dir.absolutePath), stop = { cancelled })
            val got = L.mapNotNull { s -> File(dir, "sub${s.idx}.srt").takeIf { it.isFile && it.length() > 0 }?.let { s to it.readText() } }
            dir.deleteRecursively()
            PhCore.packSubs(got)
        }
    } catch (e: Throwable) { "" }

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
        private const val REQ_PICK_PU = 72
        private const val REQ_PICK_PUM = 73
        /** האתר שאליו חוזרים — רק Studio (ייצור / ניסוי) */
        private val WEBS = listOf("https://studio.thesnowball.app/", "https://studio-staging.thesnowball.app/")
        fun webOk(w: String?): String? = w?.let { x -> WEBS.firstOrNull { it == x || it == "$x/" } }
    }
}
