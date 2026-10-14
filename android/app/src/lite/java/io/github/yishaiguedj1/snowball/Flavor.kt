package io.github.yishaiguedj1.snowball

import android.content.Context

/* Academy ו־Studio (14/10/2026): בלי ווידג'ט. ‎app=1 בכתובת = "בתוך האפליקציה לאנדרואיד" (core.js → snbApkHash) —
   כך המעבר בתפריט פותח את האפליקציה המותקנת של השנייה. */
object Flavor {
    fun appSig(c: Context): String = "1"
    fun onReturn(c: Context) {}
}
