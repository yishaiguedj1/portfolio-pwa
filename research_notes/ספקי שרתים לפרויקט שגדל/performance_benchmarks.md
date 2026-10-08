# ביצועים אמיתיים (מדדים 2025–2026) של תוכניות השרת שברשימה הקצרה — לעומס וידאו כבד על המעבד

> נכתב 08/10/2026. העומס: תמלול ב־PyTorch על המעבד, קידוד ffmpeg (SVT-AV1/x264), ריצות ארוכות על כל הליבות.
> **מקרא אמינות**: ✅ מאומת = נתון גולמי מדף תוצאה ראשוני (דף YABS עם קישור ל־Geekbench, דף מוצר של הספק). ⚠️ משני = אתר אגרגטור/חדשות/פורום, או נתון של מעבד שולחני ולא של השרת עצמו.
> **הטיות שצריך לדעת**: (1) VPSBenchmarks מצהיר שחלק מהספקים המוצגים תומכים בו ושיש באתר "כפתורי שותפים" (affiliate) — הריצות עצמן (YABS) נשלחות לרוב על ידי משתמשים, ריצה בודדת, מיקום ושכנים משתנים. (2) LowEndBox — אין הצהרת שותפים בדף שנבדק, אבל יש באנרים של נותני חסות עם UTM. (3) Spare Cores — לא בדקתי את המודל העסקי שלהם; גרסת ה־Geekbench בדפים שלהם לא מצוינת. (4) byteiota / privatedevops / webhosting.today — אתרי חדשות משניים למחירים, לא דף המחירים של Hetzner.
> **כל ציוני Geekbench 6 (GB6) כאן הם ריצה בודדת** — פער של 10–15% בין ריצות של אותה תוכנית נמדד בפועל (CAX41).

## 1. דגם המעבד לכל תוכנית וציוני ליבה בודדת/ריבוי ליבות

### Takeaway
בתוכניות הענן ב־8 ליבות, GB6 ריבוי ליבות מתכנס לכ־7,300–8,700 כמעט אצל כולם (netcup RS 2000 G12, Contabo VPS 30, Hetzner CX53/CAX41/CCX33), בעוד ש־OVH VPS-3 נמוך בחצי (~4,400). השרתים הייעודיים (Hetzner AX42 / EX44) נותנים בערך פי 1.6–1.7 בריבוי ליבות ופי 1.5–2.5 בליבה בודדת — המעבדים השולחניים (Zen 4 / Raptor Lake) מנצחים כל vCPU בענן.

### Cited Findings
**Hetzner Cloud**
- ✅ CX53 (משותף, 16 vCPU, 31GB), פלקנשטיין, 26/11/2025: **AMD EPYC-Rome** @2.5GHz, GB6 **1,202 / 8,495**; fio 4k סה"כ 177MB/s (44K IOPS), 1m סה"כ 3.55GB/s; iperf לא דווח — [VPSBenchmarks YABS](https://www.vpsbenchmarks.com/yabs/hetzner-16c-31gb-20251125-8f0aa2)
- ⚠️ CX43 (משותף, 8 vCPU, 16GB): "AMD EPYC" 2.0GHz בלי דגם, Geekbench (גרסה לא מצוינת) **1,143 / 5,615**, stress-ng כל הליבות 20,253; נמדד 01/10/2026; התיאור: "פחות מתאים למשימות מתמשכות עתירות חישוב", מתויג "Burstable & Budget" — [Spare Cores CX43](https://sparecores.com/server/hcloud/cx43). (בתוצאת החיפוש אותו דף הציג ממוצע GB רב־ליבות 7,324 — סתירה פנימית בין תצוגות; לא נפתרה.)
- ⚠️ הודעת Hetzner מ־06/2024 השיקה את קו CX (CX22–CX52) כ"Intel" — אך ריצת 11/2025 של CX53 מציגה EPYC-Rome, כלומר החומרה בקו CX כיום מעורבת/השתנתה — [webhosting24 על הודעת Hetzner](https://www.webhosting24.com/?p=9215); [YABS CX53](https://www.vpsbenchmarks.com/yabs/hetzner-16c-31gb-20251125-8f0aa2)
- ✅ CAX41 (ARM, 16 vCPU Ampere Altra / Neoverse-N1, 31GB): 12/2024 פלקנשטיין GB6 **988 / 7,591**; 06/2025 נירנברג GB6 **1,096 / 8,751** — [YABS 12/2024](https://vpsbenchmarks.com/yabs/hetzner-16c-31gb-20241201-2d860c); [YABS 06/2025](https://www.vpsbenchmarks.com/yabs/hetzner-16c-31gb-20250612-59c6a5); [Spare Cores CAX41](https://sparecores.com/server/hcloud/cax41)
- ⚠️ CCX33 (ייעודי, 8 vCPU = 4 ליבות פיזיות, 31GB): "AMD EPYC", Geekbench (גרסה לא מצוינת) **2,032 / 7,798**, נמדד 22/09/2026 — [Spare Cores CCX33](https://sparecores.com/server/hcloud/ccx33). ריצת GB6 של משתמש: EPYC-Milan 2.4GHz, **1,886 / 7,254** — [Geekbench browser (משתמש)](https://browser.geekbench.com/user/xmasex)
- ⚠️ VPSBenchmarks מתאר את קו CCX כ־EPYC 7003 (Milan) ו־EPYC 9654 (Genoa) — אותה תוכנית יכולה לקבל דור אחר — [VPSBenchmarks CCX13](https://www.vpsbenchmarks.com/hosters/hetzner/plans/ccx13)

**Hetzner ייעודי**
- ✅ AX42 (Ryzen 7 PRO 8700GE, Zen 4 "Phoenix", 8C/16T, 35W, 64GB DDR5 ECC, 2×512GB NVMe), נירנברג, 06/09/2024: GB6 **2,849 / 13,063**; fio 4k סה"כ 958MB/s (240K IOPS), 1m סה"כ 2.64GB/s; iperf עד ~925Mbps — [VPSBenchmarks YABS AX42](https://vpsbenchmarks.com/yabs/hetzner-16c-62gb-20240906-fa0ea3); [דף המוצר של Hetzner](https://www.hetzner.com/de/dedicated-rootserver/ax42)
- ⚠️ EX44 (i5-13500, 14C/20T, 64GB): לא נמצאה ריצת GB6 של השרת עצמו. sysbench: ליבה בודדת 4,134 אירועים/שנ׳, 20 תהליכונים 50,235 — [DEV Community](https://dev.to/xcs/hetzner-servers-benchmarks-28f8). הפניה לשולחני (לא השרת): GB6 2,375 / 14,166 — [CPU-Monkey](https://www.cpu-monkey.com/en/compare_cpu-intel_core_i5_13500-vs-intel_core_i5_4440)
- ⚠️ LowEndBox (01/2024): EX44 "קרוב בהרבה ל־AX102 בביצועים" מ־AX41; מחירים אז AX41 37.70€, EX44 39€, AX102 104€ (הדף לא כולל מספרי בנצ'מרק) — [LowEndBox](https://lowendbox.com/blog/lowendboxtv-thinking-about-a-hetzner-ax41-consider-the-ex44-instead-nearly-ax102-performance)
- ⚠️ EX63 (Core Ultra 7 265): GB6 ריבוי ליבות 20,479 (פורום) — [LowEndSpirit](https://lowendspirit.com/discussion/10077/hetzner-launches-ex63-intel-core-ultra-7-265)

**netcup**
- ✅ RS 2000 G12 (8 ליבות ייעודיות **AMD EPYC 9645** — Zen 5c "Turin Dense", 16GB), מנסס/וירג'יניה, 17/07/2026: GB6 **1,746 / 8,483** — [VPSBenchmarks YABS](https://www.vpsbenchmarks.com/yabs/netcup-8c-16gb-20260717-76c5e8). ריצות נוספות 06/2026 בנירנברג ובמנסס, ו־"RS 2000 G12 Pro" בווינה 01/2026 — [YABS 06/2026 נירנברג](https://www.vpsbenchmarks.com/yabs/netcup-8c-15gb-20260622-db4032); [YABS Pro 01/2026](https://www.vpsbenchmarks.com/yabs/netcup-8c-16gb-20260129-aaf9dc)
- ⚠️ RS 1000 G12 (4 ליבות): ריצות 07/2026 קיימות, מספרים לא נשלפו — [YABS RS 1000 G12](https://www.vpsbenchmarks.com/yabs/netcup-4c-8gb-20260712-e17933)

**OVHcloud**
- ✅ VPS-3 (8 vCPU, 24GB, 200GB), גרבלין, 07/11/2025: המעבד מוצג כ־"Intel Core Processor (Haswell, no TSX)" @2.4GHz (תווית של ה־hypervisor — לא חושפת את החומרה), GB6 **891 / 4,381**; fio 4k סה"כ 322MB/s (80K IOPS), 1m סה"כ 4.04GB/s — [VPSBenchmarks YABS](https://www.vpsbenchmarks.com/yabs/ovhcloud-8c-23gb-20251107-d3808a)
- ✅ ניסוי VPSBenchmarks ל־VPS-3, 09/12/2025: 19.99€/חודש, Hyperthreading כבוי, ציונים יחסיים: CPU גולמי C, דיסק C, רשת C, **יציבות D**, ציון כולל 49 — [VPSBenchmarks trial](https://www.vpsbenchmarks.com/trials/ovhcloud_performance_trial_09Dec2025)
- ⚠️ "vps-2025-model1" בוורשה: אותה תווית Haswell, 4 ליבות @3.1GHz — [YABS](https://www.vpsbenchmarks.com/yabs/ovhcloud-4c-8gb-20260303-0bfc05)

**Contabo**
- ✅ Cloud VPS 30 NVMe (8 vCPU, 24GB), סנט לואיס, 19/03/2026: "AMD EPYC Processor (with IBPB)" @3.2GHz, GB6 **1,677 / 8,407**; fio 4k סה"כ 373MB/s, 1m סה"כ 12.55GB/s; iperf 280–587Mbps — [VPSBenchmarks YABS](https://www.vpsbenchmarks.com/yabs/contabo-8c-24gb-20260319-dc8015)

**Vultr**
- ✅ High Performance 8GB (4 vCPU), 01/2025: GB6 **1,294 / 4,143**; High Performance 4GB 11/2023: 1,422 / 2,553; ריצת פרנקפורט 10/2025 — EPYC-Rome — [YABS 01/2025](https://www.vpsbenchmarks.com/yabs/vultr-4c-8gb-20250118-tg6944); [YABS 11/2023](https://www.vpsbenchmarks.com/yabs/vultr-2c-4gb-tg4419); [YABS פרנקפורט](https://www.vpsbenchmarks.com/yabs/vultr-1c-1gb-20251015-138b17)

### Inferences
- הליבה הבודדת קובעת את מהירות שלבים סדרתיים (פענוח, שלבי Python, ffmpeg עם מסננים): AX42 (~2,850) ≫ CCX33/netcup/Contabo (~1,700–2,000) ≫ CX/CAX (~1,000–1,200) ≫ OVH VPS-3 (~900).
- ב־CCX33 יש רק 4 ליבות פיזיות (8 hyperthreads) — לכן ריבוי הליבות שלו (~7,300–7,800) דומה ל־netcup עם 8 ליבות "ייעודיות" של Zen 5c, למרות ליבה בודדת חזקה יותר.
- EPYC 9645 (Zen 5c) תומך ב־AVX-512 מלא — יתרון פוטנציאלי ל־SVT-AV1 ול־PyTorch על המעבד מול Rome/Milan/Haswell. (הסקה מהדור; לא מצאתי מדידת וידאו על netcup.)

### Gaps
- אין ריצת GB6 אמינה ל־EX44, ל־Hetzner Server Auction, ל־OVH Rise-S/Kimsufi, ל־Scaleway, ל־UpCloud ול־DigitalOcean CPU-Optimized — לא נאספו בזמן המחקר.
- **Vultr תל אביב — לא נמצאה אף ריצת YABS/Geekbench.**
- דגם המעבד האמיתי מאחורי OVH VPS-3 (תווית Haswell גנרית) — לא ידוע.

## 2. התנהגות בעומס מתמשך: steal, האטה, מדיניות "שימוש הוגן"

### Takeaway
אין מדיניות מספרית מפורסמת שמגבילה 100% CPU מתמשך ב־Hetzner CX, אבל אין שום הבטחת ביצועים, ויש דיווחי משתמשים על האטה בקידוד וידאו בענן המשותף. מדידות steal ל־2025–2026 תחת עומס מלא — לא נמצאו לאף ספק. לעומס של שעות ברצף, ליבות ייעודיות/שרת ייעודי הם הבחירה הבטוחה.

### Cited Findings
- ⚠️ בתנאי השירות של Hetzner Cloud (גרמנית) — זמינות 99.9% ורשימת פעולות אסורות (כריית מטבעות, סריקות), אבל אין תקרת CPU בסעיפים שנשלפו — [Hetzner Service-Vereinbarungen](https://www.hetzner.com/de/legal/cloud-server/?country=at)
- ⚠️ משתמש שפנה ל־Hetzner על עומס מלא קבוע: "זה בסדר מבחינתם, הם פשוט לא מבטיחים ביצועים" — [LowEndTalk](https://lowendtalk.com/discussion/comment/4806842/)
- ⚠️ משתמש דיווח שקידוד וידאו בענן של Hetzner "עבד טוב, אבל המעבד הואט לפעמים" ועבר לשרת ייעודי — [LowEndTalk](https://lowendtalk.com/discussion/comment/4806974/)
- ⚠️ VPSBenchmarks מריץ "endurance" של 24 שעות על Hetzner CX **מוגבל לכ־50% לליבה** "כי מיצוי המעבד עלול להיחשב שימוש לרעה"; בריצות 2019–2022 (CX11/CX31) steal = 0% — ישן, ולא בעומס מלא — [VPSBenchmarks endurance 2020](https://www.vpsbenchmarks.com/trials/hetzner_performance_trial_17Oct2020/endurance_runs); [2022](https://www.vpsbenchmarks.com/trials/hetzner_performance_trial_12May2022/endurance_runs)
- ⚠️ Spare Cores על CX43: "הקצאת CPU משותפת יוצרת תחרות על משאבים — פחות אופטימלי למשימות מרובות תהליכונים בעומס גבוה מתמשך" — [Spare Cores CX43](https://sparecores.com/server/hcloud/cx43)
- ✅ OVH VPS-3: ציון "יציבות" D בניסוי 12/2025 (מדד יחסי של תנודתיות) — [VPSBenchmarks trial](https://www.vpsbenchmarks.com/trials/ovhcloud_performance_trial_09Dec2025)
- ⚠️ Contabo: ליבות פיזיות ייעודיות מפורסמות רק לקו VDS — משתמע שב־Cloud VPS הליבות משותפות (הסקה של האגרגטור מתוך מבנה הדף) — [onedollarvps (קוריאנית)](https://onedollarvps.com/ko/pricing/contabo-pricing)
- ⚠️ netcup RS G12 מפורסם כ"ליבות EPYC 9645 ייעודיות" — [VPSBenchmarks RS 2000 G12](https://www.vpsbenchmarks.com/hosters/netcup/plans/rs-2000-g12)

### Inferences
- ציון GB6 הוא ריצה של דקות — הוא **לא** מודד מה קורה אחרי שעה של 100% על כל הליבות. ב־Contabo, ב־CX וב־OVH VPS (משותפים) הביצועים המתמשכים יכולים להיות נמוכים משמעותית מה־GB6, בעיקר בשעות עומס של השכנים. זה הסיכון העיקרי לעבודת תמלול+צריבה של סרטון ארוך.
- כדי לדעת בפועל: להריץ על המכונה שנבחרה `stress-ng`/קידוד של 30–60 דק׳ ולעקוב אחר `st` ב־`vmstat 5`/`top` — זה לא חלק מ־YABS.

### Gaps
- **אין מדידות steal/האטה ל־2025–2026 תחת עומס מלא לאף אחד מהספקים** (YABS לא מודד steal).
- לא נמצאו מסמכי "fair use" מספריים עדכניים של Contabo/OVH ל־CPU; לא נבדקו Vultr/DO/Scaleway/UpCloud בהקשר זה.

## 3. דיסק (NVMe) ורשת

### Takeaway
הדיסק לא צפוי להיות צוואר בקבוק לקידוד וידאו (קריאה/כתיבה רציפה 2.6–4GB/s כמעט בכולם); ב־IOPS אקראי השרת הייעודי (AX42) עדיף בפער גדול על הענן המשותף. ברשת: netcup עם פורט 2.5Gbps מוביל, OVH 1.5Gbps ללא הגבלת תעבורה, Contabo מוגבל ל־~600Mbps ונמדד מתחת לזה.

### Cited Findings
- ✅ Hetzner CX53: 4k ‏177MB/s (44K IOPS), 1m ‏3.55GB/s — [YABS](https://www.vpsbenchmarks.com/yabs/hetzner-16c-31gb-20251125-8f0aa2)
- ✅ Hetzner AX42: 4k ‏958MB/s (240K IOPS), 1m ‏2.64GB/s; רשת ~1Gbps (iperf עד 925Mbps) — [YABS](https://vpsbenchmarks.com/yabs/hetzner-16c-62gb-20240906-fa0ea3)
- ✅ OVH VPS-3: 4k ‏322MB/s, 1m ‏4.04GB/s; iperf ~0.8–1.5Gbps; לפי הניסוי — תעבורה ללא הגבלה, רוחב פס מרבי 1,500Mbps — [YABS](https://www.vpsbenchmarks.com/yabs/ovhcloud-8c-23gb-20251107-d3808a); [ניסוי](https://www.vpsbenchmarks.com/trials/ovhcloud_performance_trial_09Dec2025)
- ✅ Contabo VPS 30: 4k ‏373MB/s, 1m ‏12.55GB/s (גבוה באופן חשוד — כנראה מטמון); iperf 280–587Mbps — [YABS](https://www.vpsbenchmarks.com/yabs/contabo-8c-24gb-20260319-dc8015). ⚠️ פורט 600Mbit/s; תעבורה "ללא הגבלה*" (שימוש הוגן) לפי אגרגטור מול 32TB יוצא לפי whtop — סתירה — [onedollarvps](https://onedollarvps.com/de/pricing/contabo-pricing); [whtop](https://www.whtop.com/de/plans/contabo.com/133003)
- ✅ netcup RS 2000 G12: iperf עד ~2.4–2.8Gbps (ניו יורק, אמסטרדם, לוס אנג'לס); **ה־fio רץ על tmpfs — מספרי הדיסק (1.4GB/s ב־4k) לא תקפים** — [YABS](https://www.vpsbenchmarks.com/yabs/netcup-8c-16gb-20260717-76c5e8). ⚠️ פורט 2,500Mbps, 3,000GB תעבורה, 512GB דיסק — [VPSBenchmarks plan](https://www.vpsbenchmarks.com/hosters/netcup/plans/rs-2000-g12)

### Inferences
- לזרימת העבודה (העלאה מ־Drive → עיבוד → העלאה ל־Drive) רשת של 1Gbps ומעלה מספיקה; Contabo (~0.5Gbps בפועל) יאט העברה של קבצי וידאו של כמה GB אבל זה זניח לעומת זמן הקידוד.

### Gaps
- מדידות דיסק תקפות ל־netcup G12 (לא tmpfs), ל־CCX33, ל־CAX41 ול־EX44 — לא נאספו.
- מחירי תעבורה יוצאת מעבר למכסה (Hetzner Cloud 20TB לפי זיכרון — לא אומת במחקר זה) — לא נבדק.

## 4. מדדי ffmpeg / x264 / SVT-AV1 / Whisper לפי ספק

### Takeaway
**לא נמצא אף מדד קידוד וידאו או תמלול שנמדד על מכונה של ספק מהרשימה.** קיימים רק מדדים לפי מעבד (Phoronix/OpenBenchmarking) ודמואים של Ampere — ולכן ההשוואה לעומס הזה חייבת להיות הסקה מ־GB6 או ריצת ניסיון עצמית.

### Cited Findings
- ⚠️ Phoronix על Ryzen 7 8700G (29/01/2024) כולל FFmpeg libx265 ו־SVT-AV1 (preset 13, Bosphorus 4K); לפי כותרות הגרפים Ryzen 7 7700X היה המהיר — הדף חסם גישה (403) והמספרים לא נשלפו — [Phoronix 8700G](https://www.phoronix.com/review/amd-ryzen7-8700g-linux/9)
- ⚠️ OpenBenchmarking מכיל ריצות SVT-AV1 של Ampere Altra Max ושל 2×EPYC 9734 (העלאות משתמשים, בלי מספרים בשליפה) — [SVT-AV1 1.1.0](https://openbenchmarking.org/test/pts/svt-av1-1.1.0); [SVT-AV1 2.1.0](https://openbenchmarking.org/test/pts/svt-av1-2.1.0)
- ⚠️ Phoronix EPYC 4345P כולל whisper.cpp (ggml-medium.en); EPYC 4585PX היה המהיר בהשוואה — [Phoronix EPYC 4345P](https://www.phoronix.com/review/amd-epyc-4345p/3)
- ⚠️ Ampere מפרסם דמואים של Whisper על Altra עם "Ampere Optimized PyTorch" (חומר שיווקי של היצרן, בלי מקדם זמן אמת) — [Ampere Whisper PDF](https://amperecomputing.com/assets/AI_with_Whisper_Inference_Model_for_Audio_to_Text_9b097ca106.pdf); [דמו CloudFest](https://amperecomputing.com/assets/whisper_demo_cloudfest_a3bb9dba53.pdf)
- ⚠️ whisper.cpp תומך ב־ARM NEON וב־x86 AVX — [OpenBenchmarking whisper.cpp](https://openbenchmarking.org/test/pts/whisper-cpp)

### Inferences
- **ARM (CAX)**: ל־PyTorch רגיל (לא הגרסה של Ampere) ול־qwen-asr/מודלים דומים אין ראיות במחקר זה לביצועים טובים על Neoverse-N1; ל־ffmpeg/x264 יש תמיכת NEON ותיקה. בגלל אי־הוודאות — x86 עם AVX2/AVX-512 הוא ההימור הבטוח לעומס PyTorch על המעבד; CAX רק אחרי ריצת ניסיון.
- הדרך הנכונה להחליט: להריץ את אותו סרטון (תמלול + צריבה) ב־CX53 / CCX33 / netcup RS 2000 לשעה (חיוב שעתי ב־Hetzner) ולמדוד זמן קיר.

### Gaps
- מספרי FPS של SVT-AV1/x264 לכל מעבד ברשימה (EPYC 9645, Rome, Milan, 8700GE, i5-13500, Altra) — לא נשלפו (Phoronix חסום, OpenBenchmarking בלי מספרים בשליפה).
- מקדם זמן אמת (RTF) של Whisper/PyTorch על המעבד על אף אחת מהמכונות — לא נמצא.

## 5. ביצועים לאירו — דירוג לעומס הזה, ומתי ליבות ייעודיות מנצחות

### Takeaway
לפי GB6 ריבוי ליבות לאירו: Contabo VPS 30 (~600 נק׳/€) ו־netcup RS 2000 G12 (~485–580 נק׳/€) מובילים בנייר; netcup עדיף כי הליבות **ייעודיות** ו־Zen 5. אחרי העלאת המחירים של Hetzner ב־15/06/2026 קו CCX (ייעודי בענן) הפך ליקר מאוד (~56 נק׳/€) — לעומס מתמשך עדיף שרת ייעודי (AX/EX/מכירה פומבית) או netcup.

### Cited Findings
- ⚠️ Hetzner העלתה מחירים מ־15/06/2026 (הזמנות חדשות ושינוי גודל; קיימים נשארים במחיר הישן): CCX13 ‏15.99→42.99€ (+169%), CCX23 ‏31.49→85.99€ (+173%), CPX22 ‏7.99→19.49€, CPX32 ‏13.99→35.49€, CAX11 ‏4.49→5.99€ (+33%), CX23 ‏3.99→5.49€ (+38%); במכירה הפומבית ~3% — [byteiota 16/06/2026](https://byteiota.com/hetzner-june-2026-price-shock/)
- ⚠️ CCX33: ‏62.49→**138.49€** (+122%, גרמניה/פינלנד, בלי IPv4) — [privatedevops](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do); "העלאות הגיעו ל־209%" — [webhosting.today](https://webhosting.today/2026/06/18/hetzners-price-increases-reached-209-the-30-headline-applied-to-a-different-tier/embed/). Spare Cores מציג CCX33 מ־0.2482$ לשעה — [Spare Cores](https://sparecores.com/server/hcloud/ccx33)
- ⚠️ קו CX עלה ב־31–38% בסבב יוני; CX43 נמצא במחיר 12.49€ (תאריך/מטבע לא ברורים) — [comparedge](https://comparedge.com/tools/hetzner/pricing)
- ⚠️ AX42-1 מופיע ב־187.30€ בלי IPv4 (פלקנשטיין/הלסינקי) — **חשוד** (ב־2024 AX41 היה 37.70€) ולא אומת — [prismix](https://prismix.dev/news/e099eaeb0874)
- ⚠️ netcup RS 2000 G12: 17.48€/חודש, 14.58€ בהתחייבות לשנה (כנראה בלי מע"מ) — [VPSBenchmarks plan](https://www.vpsbenchmarks.com/hosters/netcup/plans/rs-2000-g12)
- ⚠️ Contabo Cloud VPS 30: 14.00€ נטו (16.66€ כולל 19% מע"מ) — [onedollarvps](https://onedollarvps.com/de/pricing/contabo-pricing); [whtop](https://www.whtop.com/de/plans/contabo.com/133003)
- ✅ OVH VPS-3: 19.99€/חודש — [ניסוי VPSBenchmarks](https://www.vpsbenchmarks.com/trials/ovhcloud_performance_trial_09Dec2025)
- ⚠️ CAX41: ריצת 06/2025 מתויגת על ידי המשתמש "28.79€" (לפני העלאת יוני) — [YABS](https://www.vpsbenchmarks.com/yabs/hetzner-16c-31gb-20250612-59c6a5)

**טבלת ביצועים לאירו (חישוב שלי מהנתונים לעיל; GB6 ריבוי ליבות ÷ מחיר חודשי נטו)**

| תוכנית | ליבות | GB6 ליבה / ריבוי | €/חודש | נק׳/€ | סוג |
|---|---|---|---|---|---|
| Contabo Cloud VPS 30 | 8 vCPU | 1,677 / 8,407 | 14.00 | ~600 | משותף, רשת ~0.5Gbps |
| netcup RS 2000 G12 | 8 ייעודיות EPYC 9645 | 1,746 / 8,483 | 17.48 (14.58 לשנה) | ~485 (~580) | ייעודי |
| Hetzner CAX41 (לפני 06/2026) | 16 ARM | ~1,000–1,100 / 7,600–8,750 | ~28.79 (תוית משתמש) | ~265–305 | משותף, ARM |
| OVH VPS-3 | 8 vCPU | 891 / 4,381 | 19.99 | ~220 | משותף |
| Hetzner CCX33 (אחרי 06/2026) | 4 פיזיות / 8 vCPU | ~1,900–2,000 / 7,250–7,800 | 138.49 | ~52–56 | ייעודי |
| Hetzner AX42 | 8C/16T Zen 4 | 2,849 / 13,063 | לא ודאי (37.70€ ב־2024 ל־AX41; 187.30€ חשוד) | — | שרת ייעודי |
| Hetzner CX53 | 16 vCPU Rome | 1,202 / 8,495 | לא נמצא מחיר אחרי 06/2026 | — | משותף |

### Inferences
- **מתי ייעודי מנצח**: בעבודה של שעה+ על כל הליבות, ציון ה־GB6 של מכונה משותפת (Contabo/CX/OVH) הוא תקרה, לא ממוצע. ליבות ייעודיות (netcup G12, CCX, שרת ייעודי) נותנות זמן עבודה צפוי — מה שחשוב ל־ETA במסך ההתקדמות של הסטודיו. ההפרש במחיר בין Contabo ל־netcup (~3.5€) קטן מהסיכון.
- **netcup RS 2000 G12** = הערך הטוב ביותר לעומס מתמשך בנתונים שנאספו (ייעודי, Zen 5 עם AVX-512, 2.5Gbps), בתנאי שזמן קיר אמיתי יאושר בריצת ניסיון. חסרון: בלי חיוב שעתי (חוזה חודשי/שנתי) — לא נבדק במחקר זה.
- **Hetzner CCX אחרי יוני 2026 לא משתלם** לעומס הזה (פי ~9–10 פחות נק׳/€ מ־netcup). שרת ייעודי של Hetzner (AX/EX/מכירה פומבית) נותן בערך פי 1.6 ריבוי ליבות ו־פי 1.6 ליבה בודדת מ־netcup — כדאי רק אם העומס מלא רוב החודש ואם המחיר העדכני אכן סביב 40–60€ (לא אומת).
- **Hetzner Cloud עם חיוב שעתי** (CX53/CCX) מתאים כשהעומס הוא כמה שעות בשבוע: משלמים רק על שעות העבודה — שם ביצועים לשעה חשובים יותר מביצועים לחודש. ההחלטה תלויה בכמה שעות עיבוד בחודש בפועל.

### Gaps
- מחירים רשמיים עדכניים (אחרי 15/06/2026) ל־CX43/CX53/CAX31/CAX41/AX42/EX44/מכירה פומבית — **לא אומתו מדף המחירים של Hetzner** (docs.hetzner.com לא נגיש בחיפוש); המספרים לעיל מאתרי חדשות.
- מחירים וביצועים של Scaleway, UpCloud, Vultr (כולל תל אביב), DigitalOcean CPU-Optimized, OVH Rise-S/Kimsufi — לא נאספו.
- אין נתון ביצועים־לאירו מבוסס קידוד/תמלול אמיתי — רק GB6, שהוא פרוקסי חלקי לעומס וידאו (רגיש לזיכרון ול־AVX-512).
