package io.github.yishaiguedj1.snowball.lab

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File

/**
 * Studio Lab (24/10/2026, "תרגום סרטונים בטלפון" — שלב 0): כלי מדידה בלבד. בוחרים סרטון, מורידים את המודלים
 * פעם אחת, ולוחצים "למדוד". בסוף — דוח לשיתוף. שום דבר לא נשלח לשום מקום חוץ מהורדת המודלים (Hugging Face, GitHub).
 */
class LabActivity : ComponentActivity() {
    private val picked = mutableStateOf<Pair<File, String>?>(null)
    private val copying = mutableStateOf(false)
    private val dl = mutableStateOf("")
    private val dlBusy = mutableStateOf(false)
    private val tick = mutableStateOf(0)

    private val pick = registerForActivityResult(ActivityResultContracts.OpenDocument()) { u -> if (u != null) take(u) }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent {
            val dark = isSystemInDarkTheme()
            val red = Color(0xFFFF4656)
            MaterialTheme(colorScheme = if (dark) darkColorScheme(primary = red) else lightColorScheme(primary = red)) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { Screen() }
            }
        }
    }

    private fun take(u: Uri) {
        copying.value = true
        Thread {
            try {
                var name = "video"
                contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) name = c.getString(0) ?: name }
                val dir = File(cacheDir, "lab-in").apply { deleteRecursively(); mkdirs() }
                val f = File(dir, "in." + name.substringAfterLast('.', "mp4").take(5))
                contentResolver.openInputStream(u)!!.use { i -> f.outputStream().use { i.copyTo(it, 1 shl 20) } }
                runOnUiThread { picked.value = f to name; copying.value = false }
            } catch (e: Throwable) {
                runOnUiThread { dl.value = "✕ ${e.message}"; copying.value = false }
            }
        }.start()
    }

    private fun fetch() {
        dlBusy.value = true
        Thread {
            try {
                for (g in listOf("parakeet", "aligner")) {
                    LabModels.fetch(this, g, { false }) { n, d, t ->
                        runOnUiThread { dl.value = "$n · ${d / 1048576}/${if (t > 0) t / 1048576 else "?"}MB" }
                    }
                    runOnUiThread { tick.value++ }   // ✓ ליד כל מודל ברגע שהוא מוכן, לא רק בסוף
                }
                runOnUiThread { dl.value = "המודלים מוכנים" }
            } catch (e: Throwable) {
                runOnUiThread { dl.value = "✕ ${e.javaClass.simpleName}: ${e.message}" }
            } finally { runOnUiThread { dlBusy.value = false; tick.value++ } }
        }.start()
    }

    private fun share(text: String) {
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "שיתוף הדוח"))
    }

    @Composable
    private fun Screen() {
        val running by LabRun.running
        val stage by LabRun.stage
        val report by LabRun.report
        var ff by remember { mutableStateOf(true) }
        var asr by remember { mutableStateOf(true) }
        var al by remember { mutableStateOf(true) }
        var soak by remember { mutableStateOf(false) }
        var asrMin by remember { mutableStateOf(10) }
        var alMin by remember { mutableStateOf(5) }
        val t = tick.value
        val pk = remember(t, dlBusy.value) { LabModels.ready(this, "parakeet") }
        val qa = remember(t, dlBusy.value) { LabModels.ready(this, "aligner") }

        LazyColumn(Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Spacer(Modifier.padding(top = 8.dp))
                Text("Studio Lab", fontSize = 34.sp, fontWeight = FontWeight.Bold)
                Text("מדידה: תרגום סרטונים בטלפון", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("1. סרטון לבדיקה", fontWeight = FontWeight.SemiBold)
                        Text(picked.value?.let { "${it.second} · ${it.first.length() / 1048576}MB" } ?: "הרצאה של שעה בערך — כמו עבודה אמיתית",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedButton({ pick.launch(arrayOf("video/*", "audio/*")) }, enabled = !running && !copying.value) {
                            Text(if (copying.value) "מעתיק…" else "בחירת קובץ")
                        }
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("2. המודלים (פעם אחת, ב־Wi‑Fi)", fontWeight = FontWeight.SemiBold)
                        Text("תמלול — Parakeet · ${LabModels.sizeMb("parakeet")}MB · ${if (pk) "✓" else "לא הורד"}")
                        Text("יישור — Qwen · כ־${LabModels.sizeMb("aligner")}MB · ${if (qa) "✓" else "לא הורד"}")
                        if (dl.value.isNotEmpty()) Text(dl.value, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        if (dlBusy.value) LinearProgressIndicator(Modifier.fillMaxWidth())
                        if (!(pk && qa)) OutlinedButton({ fetch() }, enabled = !dlBusy.value && !running) { Text("להוריד") }
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("3. מה למדוד", fontWeight = FontWeight.SemiBold)
                        Toggle("ffmpeg: חילוץ קול, שוטים, צריבה", ff) { ff = it }
                        Toggle("תמלול (Parakeet)", asr) { asr = it }
                        if (asr) Chips(listOf(5, 10, 20), asrMin, "דק׳") { asrMin = it }
                        Toggle("יישור (Qwen — 4 הגדרות)", al) { al = it }
                        if (al) Chips(listOf(3, 5, 10), alMin, "דק׳") { alMin = it }
                        Toggle("מבחן עומס — 20 דק׳ תמלול ברצף (חום)", soak) { soak = it }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (!running) Button({
                        picked.value?.let { (f, n) -> LabRun.start(this@LabActivity, f, n, LabRun.Opts(ff, asr, al, asrMin, alMin, 60, soak)) }
                    }, enabled = picked.value != null && !dlBusy.value) { Text("למדוד") }
                    else OutlinedButton({ LabRun.cancel() }) { Text("לעצור") }
                    if (report.isNotEmpty() && !running) OutlinedButton({ share(report) }) { Text("שיתוף הדוח") }
                }
                if (running) {
                    Spacer(Modifier.padding(top = 8.dp))
                    Text(stage, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 6.dp))
                    Text("להשאיר את המסך פתוח — הטלפון מאט כשהמסך כבוי", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            items(LabRun.log) { l ->
                SelectionContainer { Text(l, fontFamily = if (l.startsWith("   ")) FontFamily.Monospace else FontFamily.Default, fontSize = 13.sp) }
            }
            item { Spacer(Modifier.padding(bottom = 32.dp)) }
        }
    }

    @Composable
    private fun Toggle(label: String, v: Boolean, on: (Boolean) -> Unit) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, Modifier.weight(1f))
            Switch(v, on, enabled = !LabRun.running.value)
        }
    }

    @Composable
    private fun Chips(opts: List<Int>, v: Int, unit: String, on: (Int) -> Unit) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (o in opts) FilterChip(v == o, { on(o) }, { Text("$o $unit") }, enabled = !LabRun.running.value)
        }
    }
}
