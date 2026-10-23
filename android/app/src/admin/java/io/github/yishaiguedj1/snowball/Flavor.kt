package io.github.yishaiguedj1.snowball

import android.content.Context

/* admin (23/10/2026): מרכז הניהול — בלי ווידג'ט של תיק. ‎app=1 = "בתוך האפליקציה לאנדרואיד" (כמו Academy/Studio).
   חזרה מהאתר למסך הבית → רענון מדדי השרתים (ווידג'ט הניטור). */
object Flavor {
    fun appSig(c: Context): String = "1"
    fun onReturn(c: Context) = MonRefresh.now(c)
}
