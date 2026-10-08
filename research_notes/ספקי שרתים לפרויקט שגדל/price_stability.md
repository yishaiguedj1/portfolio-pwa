# יציבות מחירים לטווח ארוך — ספקי VPS/שרתים ייעודיים (2019–2026)

> נכון ל־08/10/2026. מקרא: **✅ מאומת** = דף רשמי של הספק / תיעוד / הודעה רשמית שנקראה ישירות. **◐ משני** = עיתונות טכנית, פורומים (LowEndTalk), בלוגים, אגרגטורים. אחוזים שלא הופיעו במקור — מחושבים ממחירים שהמקור מסר (מצוין).

## 1. היסטוריית שינויי המחיר (תאריכים, אחוזים, סיבות)

### Takeaway
2026 היא שנת שבר: Hetzner העלתה פעמיים (אפריל: +30–37% לכולם, כולל לקוחות קיימים; יוני: עד פי 2.7–3 ל־CPX/CCX להזמנות חדשות ולשינויי גודל), netcup פעמיים (מרץ: +18.5% גם לקיימים; ספטמבר: עד +40% VPS ו־+70–110% RS לחדשים), OVH פעמיים (VPS בחידוש מאפריל; שרתים ייעודיים בממוצע +28%/+51% מ־Q3), Scaleway בררני (יוני). הסיבה המשותפת: מחירי DRAM/NAND שזינקו בגלל ביקוש AI. DigitalOcean, Vultr ו־Linode — לא נמצאה העלאת מחיר מחירון ב־2026; ההעלאות האחרונות שלהן היו ב־2022–2023.

### Cited Findings

**Hetzner**
- ◐ 2021 (01/08/2021): Floating IP חדש €1.20→€3.60; CX11 €2.988→€4.188, CPX11 €4.188→€4.788 — "existing Cloud Servers are not affected" (הודעת לקוח שצוטטה בפורום). סיבה: עלות רכישת IPv4 — [LowEndSpirit](https://lowendspirit.com/discussion/3161/hetzner-cloud-price-increase-cx11-cpx11-floating-ips)
- ◐ 2022 (הוכרז אוגוסט, בתוקף 01/09/2022): כ־10% על "מוצרים רבים" בגלל עלויות חשמל; לקוחות קיימים שילמו מחיר ישן עד סוף השנה והחדש מ־01/01/2023; חשמל לקולוקיישן בגרמניה €0.3451→€0.5355 לקוט"ש — [itreseller.ch](https://www.itreseller.ch/Artikel/96719/Hetzner_hebt_Preise_wegen_Energiekosten_an.html); בורסת השרתים (Serverbörse) הועלתה גם היא בגלל חשמל — [WinFuture](https://winfuture.de/news,127732.html)
- 2023: **לא נמצאה** העלאה כללית של Hetzner ב־2023 (מעבר לכניסת מחירי 2022 לתוקף ב־01/01/2023 ללקוחות קיימים). לא אימתתי את תאריך תחילת החיוב על Primary IPv4 בענן — ראה Gaps.
- ✅ 23/02/2026 (בתוקף 01/04/2026): "Our price changes will affect both existing products and new orders and will take effect starting on 1 April 2026." סיבה: "The costs to operate our infrastructure and to buy new hardware have both increased dramatically" — [Hetzner Pressroom](https://www.hetzner.com/pressroom/statement-price-adjustment/)
- ◐ פירוט אפריל 2026: ענן גרמניה/פינלנד +30–37% (CX23 €2.99→€3.99, CCX63 €287.99→€374.49), שרתים ייעודיים +3–21% (AX42 €47.30→€57.30 = +21%; AX41‑NVMe +3%), אחסון +30%, Object Storage בארה"ב +53%, Server Auction +3% — [webhosting.today](https://webhosting.today/2026/05/29/hetzner-has-now-raised-prices-three-times-in-2026-this-one-is-different/); CAX11 €3.29→€4.49 — [Tom's Hardware דרך חיפוש](https://www.igorslab.de/en/hetzner-to-significantly-increase-prices-for-cloud-and-dedicated-servers-from-april-2026/); Object Storage בסיס €4.99→€6.49 (Tom's Hardware, משני). Igor's Lab: "The decisive factor is not the order date, but the date of provision" — [Igor's Lab](https://www.igorslab.de/en/hetzner-to-significantly-increase-prices-for-cloud-and-dedicated-servers-from-april-2026/)
- ◐ 02/02/2026 ו־29/04/2026: העלאת דמי הקמה (setup) לשרתים ייעודיים, בציטוט "prices for key hardware components such as RAM and NVMe SSDs have continued to rise" — [webhosting.today](https://webhosting.today/2026/05/29/hetzner-has-now-raised-prices-three-times-in-2026-this-one-is-different/)
- ✅ 15/06/2026 08:00 CEST: "The price adjustment took effect for new orders and cloud instance rescales". דוגמאות מהטבלה הרשמית (גרמניה/פינלנד): CAX11 €4.49→€5.99 (+33%, מחושב), CX23 €3.99→€5.49 (+38%), CCX13 €15.99→€42.99 (+169%), CPX62 €50.49→€129.99 (+157%); ארה"ב: CPX11 €5.99→€17.49 (+192%), CPX51 €77.99→€237.99 (+205%); סינגפור ~+94–96%. הדף עודכן לאחרונה 08/07/2026 — [docs.hetzner.com price-adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- ◐ יוני 2026 — heise: ממוצע כ־+158% בארה"ב, +99% בגרמניה, ~+78% בסינגפור; CPX41 בארה"ב €38.99→€120.49; כתובות IPv4 ייעודיות לא משתנות; פטורים: אחסון אתרים, managed, exchange, IP, אחסון ו־load balancers; "stable and fair prices in the long term" — [heise, 15/06/2026](https://heise.de/-11333037)
- ◐ יוני 2026 — שרתים ייעודיים: קווי AX/EX/RX/SX/GPU עברו לסימון ‎-1/-2/-3 + שכבת "-1-Ltd"; מחיר חודשי עולה להזמנות חדשות, דמי הקמה יורדים; "Currently rented servers are not affected by the price adjustment" — [webhosting.today](https://webhosting.today/2026/05/29/hetzner-has-now-raised-prices-three-times-in-2026-this-one-is-different/). הדף הרשמי מציג רק מחירים חדשים לייעודיים — אי אפשר לחשב אחוז ממנו — [docs.hetzner.com](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- מצטבר (מחושב): CX23 €2.99 (מרץ 2026) → €5.49 (יוני 2026) = +84% בתוך 10 שבועות; CCX13 במצטבר יותר מפי 2.7.

**OVHcloud**
- ◐ 2022: כ־10% על כמה שירותים בגלל אנרגיה, גם ללקוחות קיימים; ענן ציבורי מ־01/11, bare metal מ־01/12/2022 — [The Register 23/08/2022](https://www.theregister.com/2022/08/23/ovh_inflation_price_rises/); [The Register 27/10/2022](https://www.theregister.com/2022/10/27/ovhcloud_price_energy/)
- ◐ 2022: העלאה ל־Kimsufi/So you Start (הזמנות חדשות, Eco בארה"ב) — [LowEndTalk](https://lowendtalk.com/discussion/180972/ovh-kimsufi-so-you-start-price-increase)
- 2023–2025: לא נמצא כיסוי של העלאות כלליות (ראה Gaps).
- ◐ אפריל 2026 — VPS: בתוקף בחידוש שתאריכו ב־01/04/2026 ואילך; טווח VPS 2026 (VPS‑1..6) + Local Zones + IPv4 נוסף; Kimsufi ו־So you Start לא נכללו; VPS‑1 = ‎$7.60 לחודש לפני מע"מ, IPv4 נוסף ‎$2.39; משתמשי פורום חישבו +40–67% לפי דגם — [next.ink](https://next.ink/225720/ovhcloud-augmente-fortement-le-prix-de-ses-vps-2026-et-ipv4/), [LowEndTalk](https://lowendtalk.com/discussion/214685/ovh-vps-price-hike)
- ◐ 11/08/2026 (אוקטב קלאבה ב־X): שרתים ייעודיים — Kimsufi, So you Start, Rise **ללא שינוי**; דור 2024 ממוצע +28%, דור 2026 ממוצע +51%, Game עד +87%; ללקוח קיים ההעלאה על אופציות מותקנות "נמוכה פי 3–6" מאשר בהזמנה חדשה; חוזים פעילים לא מושפעים; ענן ציבורי Gen3 — מחיר שעתי זהה אבל מ־01/10 Block Storage ו־IPv4 בשורות נפרדות = +1.4% עד +21.9% לסך המופע; קלאבה צופה לחץ עד 2028, נורמליזציה ב־2029 לכל המוקדם — [ITdaily](https://itdaily.com/news/cloud/ovhcloud-price-increase-ram/); [HostingAdvice](https://www.hostingadvice.com/blog/ovhcloud-prices-are-going-up-87-as-memory-costs-climb/)
- ◐ סתירה: דיווח צרפתי מאוחר טוען שבסבב האחרון VPS לא נכלל ושלקוחות VPS 2026 ומטה שומרים מחיר — סותר את הודעת החידוש של אפריל — [justgeek.fr](https://www.justgeek.fr/hausse-prix-ovhcloud-2026-156725/)

**netcup**
- ◐ 20/03/2026 (בתוקף לא לפני 01/05/2026 או מתקופת החיוב הבאה): **חוזים קיימים +18.51%**, חדשים +24.33%, מוצרי אחסון +21.52%; VPS, RS, אחסון נוסף, אחסון אתרים; סיבה: שוק ה־RAM, ספקים "לא כיבדו הסכמי מחיר קבוע"; לקוחות קיימים קיבלו זכות ביטול מיוחדת (Sonderkündigungsrecht) — [deskmodder.de](https://www.deskmodder.de/blog/?p=210508)
- ◐ ספטמבר 2026 (פוסט המנכ"ל אלכסנדר וינדביכלר "RAMpocalypse: We need to talk about pricing ... again", מצוטט בפורום): VPS x86 עד +40% + הקטנת דיסק (NVMe לא מובטח, flash RAID6); Root Server ‏+70% עד +110% + הקטנת דיסק; VPS Lite עד +20%; "Existing contracts remain unchanged ... and you can still upgrade them at the old price" — [LowEndTalk](https://lowendtalk.com/discussion/221336/netcup-price-increase-september-2026), [LowEndSpirit](https://lowendspirit.com/discussion/10662/netcup-price-increase-rampocalypse) (לא הצלחתי לפתוח את השרשור עצמו — 403; הציטוט מתקציר החיפוש)

**Contabo**
- ◐ 2022: ממוצע כ־+9.1%; ללקוחות קיימים רק בחידוש הראשון ב־01/11/2022 ואילך (העתק מייל בפורום) — [LowEndTalk](https://lowendtalk.com/discussion/comment/3116278)
- ◐ 2026: **לא נמצאה הודעה** על העלאה; מחירון Cloud VPS 10 ‏€4.50 (8GB) מופיע בפברואר וגם בספטמבר 2026 — [onedollarvps](https://onedollarvps.com/pricing/contabo-pricing.html), [iconpolls](https://iconpolls.com/blogs/contabo-review-2026-login-pricing-coupon-code-sign-up-vps-user-experience-and-faqs). "השמועה" על 2026 לא אומתה.

**Scaleway**
- ✅ 27/04/2026 (בתוקף 01/06/2026), בררני: PRO2/GP1/DEV1/PLAY2 ~+2%, BASIC3 +3%, STARDUST1‑S +300%, Local Storage ‏+11.4%, Object Storage ‏+6.8–10%, Flexible IPv4 ‏+25%, Load Balancer ‏+44–46%, Elastic Metal ‏+3.8–16.7%, Dedibox Core‑10 ‏+12.5–16.7% (Core‑10‑L €399.99→€449.99); "If a product is not listed here, its price remains unchanged"; סיבות: אינפלציה, משבר חומרה (RAM/אחסון), מחסור IPv4 — [Scaleway blog](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/)
- ◐ מעבר כפוי VC1/START1/X64 → DEV1 ב־31/05/2026 — [LowEndTalk](https://lowendtalk.com/discussion/216684/scaleway-price-increase-notice)

**UpCloud**
- ✅/◐ 01/01/2023: התאמת מחירים + מעבר ליורו + "שדרוגים חינם" לתוכניות — [UpCloud blog](https://upcloud.com/blog/new-cloud-server-plans-improvements-pricing-adjustments/); תוכניות General Purpose ‏+18–38% (השוואה חיצונית) — [vps-prices.com](https://vps-prices.com/blog/post/new-upcloud-pricing-jan-2023)
- ◐ 01/04/2024: egress בחינם (הוזלה) — [Elnion](https://elnion.com/2024/05/16/upcloud-shakes-up-cloud-landscape-with-zero-cost-egress-transfer/). 2026: לא נמצאה העלאה.

**DigitalOcean**
- ✅ 01/07/2022: Droplets, Snapshots, Load Balancers, Reserved IPs, Custom Images התייקרו; Spaces/backups/volumes/bandwidth ללא שינוי; נוסף Droplet ב־$4 — [DO release note](https://docs.digitalocean.com/notes/2022/pricing-changes); ◐ עד ~20%, ‏1GB ‏$5→$6 — [webscoot](https://webscoot.io/blog/digitalocean-new-pricing/)
- ◐ 2026: לפי מדריכים חיצוניים DO/Vultr/Linode "החזיקו מחירון", הלחץ עבר להקטנת דיסק ברירת מחדל ותוספות NVMe בתשלום — [vpsdex](https://vpsdex.com/en/activity/vps-price-hikes-2026-survival-guide/) (הכותרת שלו סותרת את גוף הכתבה — מקור חלש)

**Akamai/Linode**
- ✅ 01/04/2023: רוב תוכניות Shared ו־Dedicated ‏+20% (2GB ‏$10→$12, 4GB ‏$20→$24, 16GB ‏$80→$96); Nanode 1GB נשאר $5; IPv4 נוסף $1→$2; egress overage חצי (‎$0.01→$0.005/GB); פטורים: NodeBalancers, Backups, DB, Block/Object Storage, High Memory, GPU — [Linode docs](https://www.linode.com/docs/products/compute/compute-instances/guides/upcoming-pricing-changes-april-2023/); [LowEndBox](https://lowendbox.com/blog/two-weeks-after-killing-the-linode-brand-akamai-jacks-up-prices-20-and-doubles-ip-fees/)

**Vultr**
- ◐ אין עדות להעלאת מחירון כללית 2022–2026; CostBench: אותו טווח $5–$43.8 ב־04/03/2026 וב־08/07/2026 — [CostBench](https://costbench.com/software/cloud-infrastructure/vultr/price-history/); 01/10/2024: חיוב GPU עבר ל־730 שעות בחודש ($0.179→$0.165 לשעה) — [webhosting.today](https://webhosting.today/2024/09/05/vultr-announces-pricing-model-updates/); מאי 2026 — הוסרו תוכניות Optimized (Dedicated CPU) וחלק מ־shared (משני) — [ComparEdge](https://comparedge.com/tools/vultr/changelog)

### Inferences
- גל 2022 (אנרגיה, ~10%) היה מתון ורוחבי; גל 2026 (זיכרון) חריף ומרוכז במוצרים "עתירי RAM/דור חדש" — ענן עם vCPU ייעודי/AMD, דורות חומרה חדשים, RS של netcup. מוצרי "חומרה ישנה" (Kimsufi/SYS/Rise, Server Auction, VPS Lite) נפגעו הכי פחות.
- הספקים האמריקאיים (DO/Vultr/Linode) יקרים בבסיס פי 2–4 מ־Hetzner/netcup/Contabo אבל עם מרווח שספג את 2026 — העלאתם האחרונה: 2022/2023.
- מחיר בשורת החשבונית יכול לעלות גם בלי "העלאת מחיר": פיצול IPv4/Block Storage לשורות נפרדות (OVH), הקטנת דיסק (netcup), הסרת תוכניות (Vultr), מעבר דור כפוי (Scaleway).

### Gaps
- לא אימתתי ממקור רשמי מתי Hetzner החלה לחייב על Primary IPv4 בענן ומה ההיסטוריה של המחיר (נאמר רק ש־IPv4 לא השתנה ביוני 2026 — heise).
- OVH 2023–2025: לא נמצא כיסוי ברור. מחירי Storage Box של Hetzner אחרי אפריל 2026 — לא נמצאו מספרים ייעודיים (רק "אחסון +30%").
- netcup ספטמבר 2026 — הציטוט מפורום (403 על השרשור); הודעה רשמית ב־netcup-news.de לא נקראה.
- אין הודעה רשמית של DO/Vultr/Linode על 2026; "לא העלו" מבוסס על מעקבי מחירים חיצוניים.

## 2. מדיניות "סבא" (grandfathering) — מה קורה ללקוחות קיימים ובשדרוג

### Takeaway
אין אף ספק עם הבטחה כתובה ש"המחיר שלך לא יעלה לעולם". Hetzner: יוני 2026 — שרת קיים מוגן **עד שמשנים לו גודל** (rescale = מחיר חדש, לצמיתות לפי משניים), אבל באפריל 2026 העלו גם לקיימים. netcup: במרץ העלו לקיימים (+18.5%), בספטמבר לא — ואף מאפשרים שדרוג במחיר הישן. OVH: העלאה בחידוש; חוזה פעיל מוגן.

### Cited Findings
- ✅ Hetzner יוני 2026: "For orders placed before 15 June 2026, but delivered after 15 June 2026, the previous prices will apply." / "Please note that certain changes to servers with legacy pricing may trigger a switch to the current pricing." (מפנה ל־FAQ שלא הצלחתי לפתוח — 404) — [docs.hetzner.com](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- ◐ Hetzner: rescale (גם הקטנה) נחשב הזמנה חדשה ומעביר למחיר הנוכחי, "permanently"; ההמלצה: לא לגעת בשרת קיים — [wz-it](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/), [heise](https://heise.de/-11333037), [blogspan](https://www.blogspan.net/hetzner-cloud-preise-juni-2026/) ("רק כל עוד לא משנים את התצורה")
- ✅ Hetzner אפריל 2026 — ללא סבא: "for both new orders and existing products" — [Hetzner Pressroom](https://www.hetzner.com/pressroom/statement-price-adjustment/)
- ◐ Hetzner 2021 — שרתים קיימים לא הושפעו; 2022 — קיימים קיבלו כמה חודשי חסד ואז מחיר חדש מ־01/01/2023 — [LowEndSpirit](https://lowendspirit.com/discussion/3161/hetzner-cloud-price-increase-cx11-cpx11-floating-ips), [itreseller](https://www.itreseller.ch/Artikel/96719/Hetzner_hebt_Preise_wegen_Energiekosten_an.html)
- ◐ netcup מרץ 2026: הנימוק להחלה על קיימים — "תשתית רצה אינה סטטית; חלפים ושדרוגים נכנסים כל הזמן"; זכות ביטול מיוחדת — [deskmodder](https://www.deskmodder.de/blog/?p=210508)
- ◐ netcup ספטמבר 2026: "Existing contracts remain unchanged ... and you can still upgrade them at the old price" — [LowEndTalk (תקציר)](https://lowendtalk.com/discussion/221336/netcup-price-increase-september-2026)
- ◐ OVH VPS אפריל 2026: לפי תאריך החידוש; OVH שרתים ייעודיים Q3 2026: "nothing changes during an ongoing contract", בחידוש — העלאה מתונה פי 3–6 מזו של הזמנה חדשה — [ITdaily](https://itdaily.com/news/cloud/ovhcloud-price-increase-ram/)
- ◐ Contabo 2022: מחיר חדש בחידוש הראשון אחרי 01/11/2022 — [LowEndTalk](https://lowendtalk.com/discussion/comment/3116278)
- ✅ Linode 2023 / DigitalOcean 2022: ההודעות הרשמיות לא מבדילות בין קיימים לחדשים — לא נמצא סבא מפורש — [Linode docs](https://www.linode.com/docs/products/compute/compute-instances/guides/upcoming-pricing-changes-april-2023/), [DO](https://docs.digitalocean.com/notes/2022/pricing-changes)
- ✅ Scaleway 2026: ההודעה לא מתייחסת ללקוחות קיימים — [Scaleway](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/)

### Inferences
- "שדרוג" הוא נקודת הסיכון העיקרית אצל Hetzner (ענן): כל rescale מחזיר אותך למחירון של היום. אצל netcup (ספטמבר) — דווקא מותר לשדרג במחיר הישן. אצל OVH השדרוג בדרך כלל = מוצר/הזמנה חדשה (הסקה, לא נבדק).
- סבא הוא מדיניות של סבב מסוים, לא התחייבות: אותו ספק (Hetzner, netcup) נתן סבא בסבב אחד ולא בסבב אחר באותה שנה.

### Gaps
- רשימת הפעולות המדויקת של Hetzner שמעבירות למחיר נוכחי (FAQ — 404). לא ידוע אם rebuild/snapshot→שרת חדש/העברת פרויקט נחשבים.
- לא נבדק האם שדרוג באותו חוזה ב־OVH/Contabo שומר מחיר.

## 3. נעילת מחיר — התחייבות שנתית/רב־שנתית, תנאי חידוש

### Takeaway
נעילה אמיתית קיימת רק במשך תקופת חוזה פעילה (OVH commitment; ללא חוזה — שום דבר). netcup ו־Contabo: חוזה 12 חודשים לא מנע את העלאת מרץ 2026 של netcup לקיימים (עם זכות ביטול). DO/Vultr/Linode/Hetzner — חיוב חודשי/שעתי בלי נעילה.

### Cited Findings
- ✅ OVH commitments: פיצ'ר "legacy", תשלום שנתי מראש בלבד, לא כל טווחי VPS/ייעודי זכאים, מתחדש אוטומטית לאותה תקופה — [OVH docs](https://docs.ovhcloud.com/en/guides/account-and-service-management/managing-billing-payments-and-services/manage-commitments)
- ◐ OVH: נציג מארח (2023) — הצעות ייעודיות חוזרות שומרות מחיר כל עוד השרת באותה התחייבות (ייעודי, לא VPS) — [LowEndTalk](https://lowendtalk.com/discussion/comment/3309342/); ב־2026 "nothing changes during an ongoing contract" — [ITdaily](https://itdaily.com/news/cloud/ovhcloud-price-increase-ram/)
- ◐ Hetzner: לקוחות חודשיים לא יכלו לנעול מחיר לפני אפריל 2026 — [webhosting.today](https://webhosting.today/2026/05/29/hetzner-has-now-raised-prices-three-times-in-2026-this-one-is-different/)
- ◐ netcup מרץ 2026: חל "מתקופת החיוב הבאה" — כלומר גם על חוזים שמתחדשים; זכות ביטול מיוחדת — [deskmodder](https://www.deskmodder.de/blog/?p=210508)
- ◐ Contabo: "does not increase its price upon renewal" (במובן: בלי מחיר היכרות שקופץ) — [Cybernews](https://cybernews.com/best-web-hosting/contabo-review/pricing/); אך ב־2022 העלו בחידוש — [LowEndTalk](https://lowendtalk.com/discussion/comment/3116278)

### Inferences
- תשלום שנתי מראש נועל את המחיר עד סוף התקופה בפועל (הספק לא יכול לגבות שוב על תקופה ששולמה), אבל לא את מחיר החידוש. אצל ספקים גרמניים ללקוח עסקי/פרטי בדרך כלל יש זכות ביטול כשמעלים מחיר — הגנה ולא נעילה (הסקה מ־netcup).
- הנעילה הטובה ביותר שנמצאה בפועל: "מוצר שלא נוגעים בו" (Hetzner יוני, netcup ספטמבר) — לא חוזה.

### Gaps
- לא נקראו תנאי השימוש (AGB) של netcup ו־Contabo לגבי זכות הספק לשנות מחיר באמצע חוזה 12 חודשים.
- Savings plans/commitments של Scaleway ו־UpCloud — לא נבדקו.

## 4. תחזית 2026–2027 (DRAM/NAND)

### Takeaway
כל מקורות התעשייה צופים המשך עליית מחירי זיכרון לשרתים עד 2027 לפחות (קצב מתון יותר), ו־OVH צופה לחץ עד 2028. צפויות עוד העלאות — בעיקר להזמנות חדשות ולמוצרי דור חדש; ספקים שעוד לא העלו (DO/Vultr/Linode/Contabo/UpCloud) חשופים.

### Cited Findings
- ◐ TrendForce: מחירי חוזה Server DRAM ‏+13–18% ברבעון Q3 2026; ימשיכו לעלות כל רבעון מ־H2 2026 עד H2 2027 בקצב מתון; ענני ארה"ב עם הסכמים רב־שנתיים מוגנים — הלחץ עובר ללקוחות בלי הסכמים — [iconnect007 (TrendForce)](https://iconnect007.com/article/150723/server-dram-contract-prices-to-rise-1318-qoq-in-3q26-amid-longterm-price-caps/150720/pcb)
- ◐ TrendForce (דיווח משני בסינית, סוף ספטמבר 2026): DRAM קונבנציונלי +10–15% QoQ ב־Q4 2026 — [ifeng](https://tech.ifeng.com/c/8wqosax55jy); מחסור RDIMM ב־2027, גידול היצע ביטים 15–20% בלבד — [TrendForce 2027 outlook](https://www.trendforce.com/research/download/RP260728GY)
- ◐ קלאבה (OVH): לחץ עד 2028, נורמליזציה ב־2029 לכל המוקדם; OVH צופה עלייה ממוצעת 9–11% במחירי הענן 2026–2028 — [ITdaily](https://itdaily.com/news/cloud/ovhcloud-price-increase-ram/), [next.ink](https://next.ink/225720/ovhcloud-augmente-fortement-le-prix-de-ses-vps-2026-et-ipv4/)
- ◐ סקירה כללית של המחסור — [Wikipedia: 2024–present global memory supply shortage](https://en.wikipedia.org/wiki/2024%E2%80%93present_global_memory_supply_shortage)
- ◐ netcup: ספקי חומרה לא כיבדו הסכמי מחיר קבוע — [deskmodder](https://www.deskmodder.de/blog/?p=210508)

### Inferences
- ספקים זולים עם מרווח דק (Hetzner, netcup, Contabo) מגלגלים עלויות חומרה מהר ובחדות; ספקים יקרים (DO/Vultr/Linode) סופגים יותר ומשנים מבנה (דיסק קטן, תוספות). Contabo, שלא העלתה ב־2026 למרות overselling של RAM — סביר שבסיכון (הסקה, לא עובדה).
- מחיר "חומרה ישנה" (Server Auction, Kimsufi/SYS/Rise, שרתים ייעודיים קיימים) יציב יותר: החומרה כבר נקנתה.

### Gaps
- אין הודעות רשמיות של TrendForce שנקראו ישירות לרבעון Q4 2026 (רק דיווח משני).

## 5. מסקנה: דירוג "יציבות מחיר צפויה" ואסטרטגיה

### Takeaway
אין ספק שהוא גם הזול ביותר וגם היציב ביותר. היציבים ביותר (2019–2026): Vultr, DigitalOcean, Akamai/Linode (העלאה אחת בכ־7 שנים, ≤20%) — אבל יקרים פי 2–4. הזולים: Hetzner ו־netcup — שתי העלאות כל אחד ב־2026, כולל ללקוחות קיימים. אסטרטגיה: לקנות מראש את הגודל שצריך (לא rescale), להעדיף שרת ייעודי/"חומרה ישנה" לטווח ארוך, תשלום לתקופה, ולשמור ניידות (Docker/IaC + גיבוי חיצוני) כדי לעבור כשקופץ.

### Cited Findings (בסיס לדירוג)
- Vultr — אין העלאה כללית מתועדת 2022–2026 — [CostBench](https://costbench.com/software/cloud-infrastructure/vultr/price-history/)
- DigitalOcean — העלאה אחת (07/2022, עד ~20%) — [DO](https://docs.digitalocean.com/notes/2022/pricing-changes)
- Linode — העלאה אחת (04/2023, ‏20%, Nanode פטור) — [Linode docs](https://www.linode.com/docs/products/compute/compute-instances/guides/upcoming-pricing-changes-april-2023/)
- UpCloud — העלאה ב־01/2023, הוזלת egress ב־2024 — [UpCloud](https://upcloud.com/blog/new-cloud-server-plans-improvements-pricing-adjustments/)
- Contabo — העלאה ידועה אחת (2022, ~9%) — [LowEndTalk](https://lowendtalk.com/discussion/comment/3116278)
- Scaleway — 2026 בררני, מופעים בסיסיים +2–3% — [Scaleway](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/)
- OVH — 2022 (~10%), VPS 2026 בחידוש, ייעודי 2026 (+28%/+51%); Kimsufi/SYS/Rise ללא שינוי ב־2026 — [ITdaily](https://itdaily.com/news/cloud/ovhcloud-price-increase-ram/)
- netcup — 03/2026 קיימים +18.5%; 09/2026 חדשים עד +40%/+110% — [deskmodder](https://www.deskmodder.de/blog/?p=210508)
- Hetzner — 2021, 2022, 04/2026 (גם קיימים +30–37%), 06/2026 (חדשים/rescale עד ~+200%) — [Hetzner](https://www.hetzner.com/pressroom/statement-price-adjustment/), [docs.hetzner.com](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)

### Inferences
**דירוג יציבות (הסקה מהנתונים — לא מקור יחיד):**
1. Vultr — הכי מעט שינויים; סיכון: הסרת תוכניות.
2. DigitalOcean — העלאה אחת מתונה; 2026 יציב.
3. Akamai/Linode — העלאה אחת 20% + IPv4 כפול.
4. UpCloud — העלאה ב־2023, מאז יציב/הוזלות.
5. Scaleway — העלאות בררניות וקטנות על מופעים, גדולות על IP/LB/תוספות.
6. Contabo — יציב בפועל, אבל בלי שקיפות ועם סיכון גבוה בגל ה־RAM (לא העלה עדיין).
7. OVH (Kimsufi/SYS/Rise יציבים; VPS וייעודי דור חדש — תנודתי).
8. netcup — זול מאוד, אבל 2026 = שתי העלאות, אחת לקיימים.
9. Hetzner (ענן) — הכי תנודתי ב־2026; ייעודי קיים וה־Server Auction יציבים יחסית.

**"הכי זול לאורך שנים"** — גם אחרי 2026, ‏Hetzner/netcup/Contabo נשארים זולים מ־DO/Vultr/Linode ברוב המקרים (ראה קבצים אחרים בתיקייה להשוואת מחירים עדכנית); הבחירה היא בין "זול ותנודתי" ל"יקר ויציב".

**אסטרטגיה מעשית:**
- לקנות מראש את הגודל שתצטרך ל־1–2 שנים, ולא לסמוך על rescale (Hetzner: rescale = מחירון של היום, לצמיתות). אם צריך לגדול — עדיף להוסיף שרת שני על פני הגדלת הקיים.
- לטווח ארוך: שרת ייעודי שכבר רץ (או מסדרות "חומרה ישנה": Hetzner Server Auction, OVH Kimsufi/SYS/Rise) — נפגעו הכי פחות ב־2026.
- netcup: אחרי ספטמבר 2026 — שדרוג חוזה קיים עדיין במחיר הישן (לפי המנכ"ל, משני) → עדיף חוזה קיים עם מרווח שדרוג.
- תשלום שנתי מראש / OVH commitment — נועל עד סוף התקופה, לא את החידוש.
- ניידות: כל התשתית כקוד (Docker Compose/Ansible/Terraform), גיבויים אצל ספק אחר, DNS בשליטתך — כך העלאה של 30–100% היא סיבה לעבור, לא מלכודת.
- לעקוב אחרי שורות חשבונית "חדשות" (IPv4, Block Storage, דיסק קטן יותר) — שם מגיעות העלאות סמויות.

### Gaps
- אין נתונים כמותיים על משך ההודעה המוקדמת (notice period) לכל ספק; Hetzner נתנה ~5 שבועות (23/02→01/04) ו־~3 שבועות (27/05→15/06).
