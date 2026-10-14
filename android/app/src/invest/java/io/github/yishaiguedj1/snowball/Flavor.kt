package io.github.yishaiguedj1.snowball

import android.content.Context

/* מה שמיוחד ל־Invest ב־MainActivity (14/10/2026, שלוש אפליקציות): חתימת רשימת הווידג'ט בכתובת (‎app=<חתימה>),
   ורענון הווידג'ט כשחוזרים למסך הבית. ב־Academy וב־Studio — src/lite (בלי ווידג'ט). */
object Flavor {
    fun appSig(c: Context): String = WidgetStore.sig(c)
    fun onReturn(c: Context) = WidgetRefresh.now(c)
}
