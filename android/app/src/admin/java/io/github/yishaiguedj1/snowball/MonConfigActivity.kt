package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/*
 * מסך הטוקן של מרכז הניהול (נפתח מהווידג'ט). הטוקן נכנס לשדה סיסמה (נקודות), לא נשמר בהגדרות אוטומטיות
 * (autofill כבוי), ונשמר רק ב־MonStore. "בדוק חיבור" משתמש בטוקן שבשדה (או השמור) בלי לשמור אותו.
 * הטקסטים לא מציגים את הטוקן עצמו; שגיאות = קוד מוגדר, לא הודעת חריגה.
 */
class MonConfigActivity : Activity() {
    private lateinit var input: EditText
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = getString(R.string.mon_cfg_title)
        setContentView(build())
        status.text = getString(if (MonStore.token(this).isEmpty()) R.string.mon_cfg_hint else R.string.mon_cfg_stored)
    }

    private fun build(): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#101613"))
            setPadding(dp(20), dp(20), dp(20), dp(20))
        }
        val ink = Color.parseColor("#F3F5F4")
        val muted = Color.parseColor("#A3A9A6")

        status = TextView(this).apply { setTextColor(muted); textSize = 15f }
        root.addView(status, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
            setTextColor(ink)
            setHintTextColor(muted)
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO   // הטוקן לא נשמר בשירות מילוי אוטומטי
        }
        root.addView(input, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) })

        root.addView(Button(this).apply { text = getString(R.string.mon_cfg_save); setOnClickListener { save() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16) })
        root.addView(Button(this).apply { text = getString(R.string.mon_cfg_check); setOnClickListener { check() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        root.addView(Button(this).apply { text = getString(R.string.mon_cfg_clear); setOnClickListener { clear() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        return root
    }

    private fun save() {
        val t = input.text.toString().trim()
        if (t.isEmpty()) { status.text = getString(R.string.mon_cfg_empty); return }
        MonStore.setToken(this, t)
        input.setText("")   // מנקים את השדה — הטוקן נשאר רק במכשיר
        status.text = getString(R.string.mon_cfg_saved)
        MonRefresh.now(this)
    }

    private fun check() {
        val typed = input.text.toString().trim()
        val t = typed.ifEmpty { MonStore.token(this) }
        if (t.isEmpty()) { status.text = getString(R.string.mon_cfg_empty); return }
        status.text = getString(R.string.mon_loading_check)
        Thread {
            val msg = when (val r = MonApi.fetch(t)) {
                is MonApi.Res.Ok -> {
                    val snap = MonParse.parse(r.json)
                    if (snap == null) getString(R.string.mon_cfg_fail)
                    else getString(R.string.mon_cfg_ok, snap.servers.size, snap.jobs)
                }
                MonApi.Res.NoAuth -> getString(R.string.mon_cfg_noauth)
                MonApi.Res.Fail -> getString(R.string.mon_cfg_fail)
            }
            runOnUiThread { status.text = msg }
        }.start()
    }

    private fun clear() {
        MonStore.clear(this)
        input.setText("")
        status.text = getString(R.string.mon_cfg_cleared)
        MonRefresh.now(this)   // הווידג'ט מתרוקן ל"הגדר טוקן"
    }

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
}
