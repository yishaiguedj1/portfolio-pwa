# ספקי VPS, שרתים ייעודיים ואחסון אובייקטים זולים באירופה (וטורקיה) למפתח בישראל — מחירים ל־2026 ומסלולי שדרוג

> נאסף ב־08/10/2026. כל מחיר בלי מע"מ, אלא אם כתוב אחרת. "מאומת" = נלקח מהעמוד הרשמי של הספק בתאריך הזה. "משני" = מאתר סקירה או השוואה, ייתכן שאינו מעודכן.
> העומס שנבדק: תמלול של שעה בעזרת PyTorch על CPU, קידוד SVT-AV1 וצריבת כתוביות ב־ffmpeg, קבצים של כמה GB, דיסק של 100GB ומעלה. תקציב התחלתי: €10–30 לחודש.

## 1. מחירים עדכניים (2026) לתוכניות מייצגות

### Takeaway
מחירי הענן של Hetzner עלו ב־15/06/2026. ה־CX המשותף עלה בכ־35% וה־CCX הייעודי בכ־110–170%. גם ה־CPX עלה מאוד, אף שהוא בכלל משותף. בתקציב €10–30 הערך הטוב ביותר ל־CPU כבד בענן: ‏Hetzner CX43/CX53 (8–16 vCPU משותפים ב־€16–29.5), ‏OVH VPS‑3/VPS‑4 (6–8 vCores ב־€10.4–20, תעבורה בלי הגבלה) ו־Netcup RS 1000 (4 ליבות ייעודיות ב־€21.7 בחוזה שנתי). מעל ~€60 לחודש שרת ייעודי זול יותר מכל vCPU ייעודי בענן. דוגמאות: ‏Hetzner AX41/EX44 בגרסת LTD ב־€57.3 בלי דמי הקמה, ‏OVH Rise‑S ב־€65.

### Cited Findings

**Hetzner Cloud — המחירים החדשים מ־15/06/2026 (מאומת, טבלה רשמית, € בלי מע"מ, גרמניה/פינלנד)**
- תוקף: מ־15/06/2026 08:00 CEST, להזמנות חדשות **ולשינוי גודל (rescale) של שרתים קיימים**. הזמנה מלפני התאריך שסופקה אחריו שומרת על המחיר הישן. שינויים מסוימים בשרת עם תמחור ישן מעבירים אותו לתמחור הנוכחי — [Hetzner Docs: Price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- **CX (Cost‑Optimized, משותף, Intel/AMD)**, לחודש: CX23 ‏€5.49 · CX33 ‏€8.49 · CX43 ‏€15.99 · CX53 ‏€29.49 — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
  - מפרט: CX23 = 2 vCPU/4GB/40GB · CX33 = 4/8/80 · CX43 = 8/16/160 · CX53 = 16/32/320 NVMe. כל אחד כולל 20TB תעבורה, ב־NBG1/HEL1 — [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/)
- **CAX (ARM Ampere, משותף)**: CAX11 ‏€5.99 · CAX21 ‏€10.49 · CAX31 ‏€20.99 · CAX41 ‏€40.99. המפרט: 2/4/40, ‏4/8/80, ‏8/16/160, ‏16/32/320, ‏20TB — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/); [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/)
- **CPX (Regular Performance, AMD, משאבים משותפים)**: CPX22 ‏€19.49 · CPX32 ‏€35.49 · CPX42 ‏€69.49 · CPX52 ‏€100.49 · CPX62 ‏€129.99. המפרט ב־EU: CPX22 = 2/4/80 · CPX32 = 4/8/160 · CPX42 = 8/16/320 · CPX52 = 12/24/480 · CPX62 = 16/32/640. ‏20TB ב־EU — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/); [Hetzner Regular Performance](https://www.hetzner.com/cloud/regular-performance/)
  - הבהרה: לפי העמוד הרשמי Regular Performance הוא "shared resources" — [Hetzner Cloud](https://www.hetzner.com/cloud). אתרים משניים שכתבו ש־CPX הוא "dedicated vCPU" טועים — [byteiota](https://byteiota.com/hetzner-june-2026-price-shock/)
- **CCX (General Purpose, ‏vCPU ייעודי, AMD)**: CCX13 ‏€42.99 · CCX23 ‏€85.99 · CCX33 ‏€138.49 · CCX43 ‏€275.99 · CCX53 ‏€533.49 · CCX63 ‏€853.49 — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
  - מפרט: CCX13 = 2/8/80 · CCX23 = 4/16/160 · CCX33 = 8/32/240 · CCX43 = 16/64/360 · CCX53 = 32/128/600 · CCX63 = 48/192/960. תעבורה ב־EU: ‏20/20/30/40/50/60TB. ב־US וב־SIN רק 1–8TB — [Hetzner General Purpose](https://www.hetzner.com/cloud/general-purpose/)
- מחירים לפני העלייה (משני): CX23 ‏3.99→5.49 · CAX11 ‏4.49→5.99 · CCX13 ‏15.99→42.99 (‎+169%) · CCX33 ‏62.49→138.49 · CPX22 ‏7.99→19.49 · CPX52 ‏36.49→100.49 — [byteiota](https://byteiota.com/hetzner-june-2026-price-shock/); [wz‑it](https://wz-it.com/blog/hetzner-preiserhoehung-juni-2026-cpx-ccx-alternativen/); [privatedevops](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do)
- המחירים בטבלה **לא כוללים IPv4 ראשי**, שעולה כ־€0.50 לחודש. כרטיסי התוכניות באתר כוללים אותו — [agentdeals digest 2026‑w25](https://agentdeals.dev/digest/2026-w25)
- **זמינות**: ב־08/10/2026 כל תוכניות CX/CAX/CPX/CCX הופיעו באתר כ־"This product is currently unavailable. Please check back later" — [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/); [Hetzner General Purpose](https://www.hetzner.com/cloud/general-purpose/); [Hetzner Regular Performance](https://www.hetzner.com/cloud/regular-performance/)
- חיוב: לפי שעה עד תקרה חודשית. שרת כבוי ממשיך להיות מחויב — [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/)
- מיקומי הענן: פלקנשטיין, נירנברג, הלסינקי, אשבורן, הילסבורו, סינגפור — [Hetzner Cloud](https://www.hetzner.com/cloud)

**Hetzner — שרתים ייעודיים (מאומת, € בלי מע"מ ובלי IPv4, חודשי / הקמה, FSN/HEL)**
- AX42‑1 ‏€97.30 / €49 · AX102‑1 ‏€257.30 / €129 · AX162‑1 ‏€612.30 / €304 · EX63‑1 ‏€147.30 / €74 · EX131‑1 ‏€557.30 / €279 · SX65‑2 ‏€82.30 / €39 (סדרת אחסון) · GEX44‑1 (GPU, פלקנשטיין) ‏€232.30 / €114 — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- **הצעות מוגבלות (LTD)**: AX41‑1‑LTD ‏€57.30 / €0 · EX44‑1‑LTD ‏€57.30 / €0 · AX42‑1‑LTD ‏€77.30 / €39 · EX63‑1‑LTD ‏€97.30 / €39 · AX102‑1‑LTD ‏€157.30 / €39 · AX162‑1‑LTD ‏€317.30 / €39 · SX65‑1‑LTD ‏€157.30 / €39 — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- מכרז השרתים (Server Auction): לפי מקור משני הטווח הוא €25–80 לחודש, והמלאי משתנה כל יום — [valebyte](https://valebyte.com/en/blog/hetzner-cloud-vs-hetzner-auction-vs-hetzner-dedicated-which-to-choose/). לגבי דמי ההקמה המקורות סותרים: אחד כותב "אין דמי הקמה", ואחר כותב שלרוב מוותרים עליהם או מקטינים אותם — [websnp](https://www.websnp.com/blog/hetzner-dedicated-server-review); [valebyte](https://valebyte.com/en/blog/hetzner-cloud-vs-hetzner-auction-vs-hetzner-dedicated-which-to-choose/)

**Netcup — Root Server G12.5 (מאומת, AMD EPYC 9645, ליבות ייעודיות, המחיר בחוזה של 12 חודשים)**
- RS 500: 2 ליבות/4GB/64GB ב־€12.93 (€14.87 כולל 19% מע"מ) · **RS 1000: 4/8/128 ב־€21.73 (€25.00 כולל)** · RS 2000: 8/16/256 ב־€40.70 (€46.81) · RS 4000: 12/32/512 ב־€77.83 · RS 8000: 16/64/1TB ב־€148.42 · RS 12000: 20/96/1.5TB ב־€216.89 (בבקשה) · RS 16000: 24/128/2TB ב־€289.46 (בבקשה) — [netcup Root Server](https://www.netcup.com/en/server/root-server)
- חוזים של 1, 12 או 24 חודשים: הנחה של 13% על 12 חודשים ו־26% על 24 חודשים. מיקומים: וינה, נירנברג, מנסס (ארה"ב), סינגפור. העמוד לא מפרט תעבורה ודמי הקמה. סתירה בעמוד עצמו: RS 8000 מתואר כ"14 ליבות" ובכרטיס כתוב 16 — [netcup Root Server](https://www.netcup.com/en/server/root-server)

**OVHcloud — VPS (מאומת, "From", בלי מע"מ, כנראה בהתחייבות מראש ל־12 חודשים לפי פרמטר `pricing=upfront12` בקישור)**
- VPS‑1: 2 vCores/4GB/40GB, ‏500Mbps, ב־€3.81 · VPS‑2: 4/8/75, ‏1Gbps, ב־€7.21 · **VPS‑3: 6/12/100, ‏2Gbps, ב־€10.40** · **VPS‑4: 8/24/200, ‏3Gbps, ב־€19.96**. **תעבורה בלי הגבלה** בכולם. גיבוי יומי, anti‑DDoS וקונסולת KVM כלולים — [OVHcloud VPS](https://www.ovhcloud.com/en-ie/vps/)
- **OVH Eco / Rise**: ‏RISE‑S (Ryzen 7 9700X, ‏8 ליבות/16 תהליכונים, 64GB, ‏2×512GB NVMe, ‏1Gbps) ב־€64.99 לחודש + הקמה €64.99 · RISE‑M (Ryzen 9 9900X, ‏12 ליבות/24 תהליכונים, 64GB) ב־€99.99 + €99.99. שניהם סומנו "Soon available". את Kimsufi ו־So you Start לא ניתן היה לקרוא מהעמוד — [OVHcloud Eco](https://eco.ovhcloud.com/en-ie/)
- מיקומי Eco באירופה: צרפת (גרבלין, פריז, רובה, שטרסבורג), פרנקפורט, מילאנו, ורשה, לונדון — [OVHcloud Eco](https://eco.ovhcloud.com/en-ie/)

**Contabo — Cloud VPS (משני בלבד: העמוד הרשמי החזיר 403, והמקורות סותרים)**
- טבלה בדולרים ("verified against Contabo"): VPS 10 = 4 vCPU/8GB/75GB NVMe ב־$4.50 · VPS 20 = 6/12/100 ב־$7.95 · VPS 30 = 8/24/200 ב־$14.95 · VPS 40 = 12/48/250 ב־$26.95. באותו עמוד יש יומן שינויים: מחיר הכניסה עלה ב־03/08/2026 מ־€3.60 ל־€4.50 — [learnwithhasan](https://learnwithhasan.com/vps-providers/contabo-vps/)
- ביולי 2026 מקור אחר מציג: VPS 10 ב־€4.40 · VPS 20 ב־€6.00 · VPS 30 ב־€11.20 · VPS 40 ב־€20.00 — [tradingvpshub](https://tradingvpshub.com/contabo-pricing/). סקירה מספטמבר/אוקטובר 2026 מציגה: VPS 30 ב־€14 · VPS 40 ב־€25 — [afftank](https://afftank.com/blog/contabo-review)
- המחירים הנמוכים הם בחוזה של 12 חודשים. חיוב חודשי יקר יותר — [tradingvpshub](https://tradingvpshub.com/contabo-pricing/)

**ספקים אמריקאיים ואחרים — ‏8 vCPU ייעודיים (משני, מחירים בדולרים)**
- DigitalOcean CPU‑Optimized ‏8 vCPU/16GB/100GB, ‏6TB תעבורה: ‏$168 לחודש. מקור אחר מציג $244 — [whtop](https://www.whtop.com/amp/plans/digitalocean.com/137795); [cloud‑mercato](https://pcr.cloud-mercato.com/providers/digitalocean/flavors/c2-8vcpu-16gb-intel)
- Vultr CPU Optimized ‏8 vCPU/16GB: ‏$160. ‏Vultr General Purpose ‏8/32: ‏$240 (נבדק ביולי 2026) — [whtop](https://www.whtop.com/amp/plans/vultr.com/137613); [spendark](https://spendark.com/instances/voc-g-8c-32gb/)
- Linode/Akamai Dedicated G8 ‏8/16: כ־$180. ‏8/32: כ־$280 (נבדק בדצמבר 2025) — [holori](https://calculator.holori.com/linode/vm/g8-dedicated-8-4)
- UpCloud High CPU ‏8/16: ‏$0.2952 לשעה, כ־$216 לחודש. זה CPU **משותף** — [sparecores](https://sparecores.com/server/upcloud/HICPU-8xCPU-16GB)
- Scaleway POP2 (vCPU ייעודי): ‏8/32 ב־€211, ‏8/16 High Compute ב־€155. מחירון חדש לחלק מהמשפחות מ־01/06/2026 — [Scaleway pricing](https://scaleway.com/en/pricing/virtual-instances); [Scaleway blog](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/)

**טורקיה (איסטנבול)**
- Valebyte (בלוג שיווקי, מאי 2026): ‏2 vCPU/4GB/80GB NVMe מכ־$12, ‏1Gbps, השהיה דיווחית של 30–40ms לפרנקפורט. שרתים ייעודיים בטורקיה מ־$99–120 — [valebyte](https://valebyte.com/en/blog/best-vps-in-istanbul-2026-review-and-prices/)
- Hostiger מציעה תוכניות שנתיות זולות מאוד, אבל הפוסטים ישנים ולא מתוארכים — [LowEndBox](https://lowendbox.com/blog/celebrate-spring-with-hostiger-cheap-vps-offers-in-istanbul-turkey/)

### Inferences
- **מחיר לכל vCPU בחודש (בלי מע"מ)**:
  - Hetzner CX53: ‏€1.84 (משותף)
  - Hetzner CX43: ‏€2.00
  - OVH VPS‑4: ‏€2.50
  - CAX41 (ARM): ‏€2.56
  - Netcup RS 2000: ‏€5.09 לליבה ייעודית
  - CPX42: ‏€8.69
  - CCX33: ‏€17.31 לליבה ייעודית
  - ‏Hetzner CPX הפך ללא כדאי: הוא משותף ועולה פי 4 מ־CX באותו גודל. לעומס CPU רציף CX או שרת ייעודי עדיפים.
- **נקודת המעבר לשרת ייעודי**: ‏Hetzner AX42‑1 ב־€97.30 עולה פחות מ־CCX33 ב־€138.49 (8 vCPU ייעודיים), וגם AX41/EX44 בגרסת LTD ב־€57.30 בלי הקמה. מעל ~€60 לחודש של CPU ייעודי, שרת ייעודי זול יותר מהענן כמעט תמיד. את מפרט ה־AX41/EX44/AX42 (דגם המעבד וכמות הזיכרון) לא אימתתי בסשן הזה.
- בתקציב €10–30 לתמלול ולקידוד: ‏Hetzner CX43 (8 vCPU/16GB/160GB, ‏€16) או CX53 (16/32/320, ‏€29.5), ‏OVH VPS‑4 (8/24/200, ‏€20, תעבורה בלי הגבלה) ו־Netcup RS 1000 (4 ליבות ייעודיות, €21.7 בחוזה שנתי). ‏Contabo VPS 30/40 זול יותר על הנייר, אבל ראו סעיף 3.
- המחירים של DO, ‏Vultr, ‏Linode ו־Scaleway ל־vCPU ייעודי גבוהים פי 1–1.5 מ־Hetzner CCX וזהים בערך לשרת ייעודי שלם של Hetzner. הם לא רלוונטיים בתקציב הזה.

### Gaps
- לא אימתתי את המחירים כולל מע"מ ללקוח פרטי מישראל. ספק אירופי בדרך כלל לא גובה מע"מ מלקוח מחוץ לאיחוד, אבל צריך לבדוק בעגלה.
- Contabo: לא היה מחיר רשמי (403). ‏Kimsufi ו־So you Start: אין מחירים. ‏IONOS: לא נבדק.
- מחירי השרתים במכרז של Hetzner (Server Auction): לא נשלפה רשימה חיה.
- קפריסין ויוון: לא נמצא אף מקור.
- אין מקור למדידת השהיה (ping) מישראל לפלקנשטיין/נירנברג/הלסינקי/וינה/פרנקפורט/איסטנבול.
- לא ידוע אם המצב "unavailable" בכל ענן Hetzner הוא מחסור זמני במלאי או שיבוש בקריאת העמוד.

## 2. תעבורה, אחסון בלוק, גיבויים/snapshots ושינוי גודל במקום

### Takeaway
‏Hetzner כולל 20TB ומעלה ב־EU, והחריגה עולה בערך €1 ל־TB. ‏OVH VPS בלי הגבלת תעבורה, ורק מהירות הפורט מגבילה. אחסון בלוק ב־Hetzner יקר (כ־€57 ל־TB) — לקבצים גדולים עדיף object storage או דיסק של שרת ייעודי.

### Cited Findings
- Hetzner Cloud EU: ‏20TB כלולים ב־CX/CAX/CPX. ב־CCX: ‏20–60TB. בארה"ב ובסינגפור: 0.5–8TB בלבד — [Hetzner General Purpose](https://www.hetzner.com/cloud/general-purpose/); [Hetzner Regular Performance](https://www.hetzner.com/cloud/regular-performance/)
- החריגה מחויבת לפי TB נוסף. באתר הסכום עצמו לא הופיע בטקסט — [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/). מקורות משניים מציינים €1 ל־TB ב־egress של Object Storage — [bex.co](https://bex.co/blog/2026/09/11/hetzner-object-storage-tenant-backup-backend); [objectstorageprices](https://objectstorageprices.com/)
- Hetzner Volumes (אחסון בלוק): כ־€0.0572 ל־GB לחודש אחרי עליית המחיר באפריל 2026, כלומר כ־€57 ל־TB לחודש (משני, לא אומת) — [bex.co](https://bex.co/blog/2026/09/11/hetzner-object-storage-tenant-backup-backend)
- Snapshots ב־Hetzner מתומחרים לפי GB לחודש, והגיבויים לפי אחוז ממחיר השרת. הסכומים לא הופיעו בטקסט העמוד — [Hetzner Cost‑Optimized](https://www.hetzner.com/cloud/cost-optimized/)
- המחיר החדש של Hetzner חל גם על **rescale** של שרת קיים — [Hetzner Docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). כלומר שדרוג במקום קיים בענן, אבל שדרוג של שרת ישן מעביר אותו למחירון החדש — [privatedevops](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do)
- OVH VPS: ‏"Unlimited traffic", מהירות פורט 500Mbps–3Gbps, וגיבוי יומי של 24 השעות האחרונות כלול — [OVHcloud VPS](https://www.ovhcloud.com/en-ie/vps/)
- OVH Rise: ‏1Gbps ציבורי — [OVHcloud Eco](https://eco.ovhcloud.com/en-ie/)
- DigitalOcean CPU‑Optimized ‏8 vCPU: ‏6TB תעבורה כלולה — [whtop](https://www.whtop.com/amp/plans/digitalocean.com/137795)

### Inferences
- לקבצי וידאו של כמה GB בכל עבודה: 20TB בחודש ב־Hetzner מספיקים לאלפי סרטונים, ו־OVH בלי הגבלה. התעבורה לא תהיה צוואר הבקבוק אצל ספקים אירופיים. היא כן צוואר בקבוק אצל DO/Vultr/Linode ובמיקומים האמריקאיים של Hetzner.
- Volume ב־Hetzner לא כדאי לנפחים גדולים: 1TB של Volume (~€57) יקר מ־CX53 שלם. עדיף Object Storage (~€6.5 ל־TB), שרת סדרת SX (Hetzner SX65‑2 ב־€82.30), או Storage Box.
- ב־Hetzner Cloud אפשר להגדיל CPU/RAM במקום, אבל בין משפחות (CX↔CCX) ועם דיסק גדל — זה ידע כללי שלא אימתתי בסשן הזה. מעבר משרת ענן לשרת ייעודי הוא תמיד מיגרציה (התקנה מחדש והעברת נתונים).

### Gaps
- הסכומים המדויקים ב־2026 ל־snapshot (לכל GB), לגיבוי (אחוז), לחריגת תעבורה בשרתי הענן ולמחיר IPv4 — לא נקראו בעמוד הרשמי (השדות היו ריקים).
- לא אומתו: מדיניות השדרוג במקום ב־OVH VPS (בין VPS‑1..4), ב־Netcup RS ("upgrade" בתוך הקו) וב־Contabo; מחיר אחסון הבלוק ב־OVH/Netcup/Contabo; מגבלות fair use של "unlimited" ב־OVH.

## 3. vCPU ייעודי מול משותף לקידוד ממושך — ביצועים ושונות

### Takeaway
בעומס CPU של 100% במשך שעות, vCPU משותף חשוף ל"גניבת CPU" (steal) מהשכנים. במדידה של 72 שעות (מקור לא מאומת) ‏Hetzner הראה steal נמוך מאוד (0.3% באחוזון 95) לעומת 2.9% ב־OVH ו־6.2% ב־Contabo, וגם את הביצועים החזקים ביותר לליבה. ‏Contabo זול מאוד אבל איטי וחסר עקביות.

### Cited Findings
- Steal באחוזון 95 במדידה של 72 שעות: ‏Hetzner ‏0.3%, ‏OVHcloud ‏2.9%, ‏Contabo ‏6.2%. מקדם השונות (עקביות): 1.8% / 5.1% / 8.7%. ל־Hetzner גם התוצאה הגבוהה ביותר בליבה אחת. **המקור לא מזוהה, ולכן התוצאות אינדיקטיביות בלבד** — [bestusavps CPU benchmark 2026](https://bestusavps.com/benchmarks/cpu-benchmark-2026/)
- Geekbench 6, ליבה אחת: ‏Hetzner ‏1,442, ‏OVH ‏1,105, ‏Contabo ‏482 (בלי תאריך) — [experte VPS benchmark](https://www.experte.com/server/vps-benchmark). **סותר** מבחן אחר על 4 vCPU שבו Hetzner מהיר מ־Contabo רק בכ־4% בליבה אחת — [cybernews](https://cybernews.com/best-web-hosting/contabo-vs-hetzner/)
- Netcup: הנתון היחיד שנמצא הוא מבחן ישן מ־2019, ‏steal כמעט 0 במצב סרק. יש טענה (לא מאומתת) שב־Netcup הליבות ייעודיות ובענן המשותף של Hetzner הביצועים לא נשמרים לאורך זמן — [LowEndTalk](https://lowendtalk.com/discussion/comment/3000753)
- ב־Netcup RS הליבות מוגדרות במפורש כ"dedicated cores" — [netcup Root Server](https://www.netcup.com/en/server/root-server). ‏Hetzner מגדיר את CX ו־CPX כ־"shared resources" ואת ה־CCX כ"constantly high CPU usage" — [Hetzner Cloud](https://www.hetzner.com/cloud)
- ב־Droplets משותפים של DigitalOcean זמן ה־CPU לא מובטח. ב־Linode Dedicated כל vCPU ממופה לליבה פיזית — [bestusavps DO vs Vultr vs Linode](https://bestusavps.com/vs/do-vs-vultr-vs-linode/); [cloudtoolstack](https://cloudtoolstack.com/learn/linode-compute-guide)
- ההמלצה של מקור הבנצ'מרקים: להריץ sysbench/Geekbench ולנטר steal (`vmstat`/`top`) במשך 24–72 שעות לפני שמחליטים — [bestusavps](https://bestusavps.com/benchmarks/cpu-benchmark-2026/)

### Inferences
- קידוד SVT‑AV1 ותמלול ב־PyTorch מנצלים את כל הליבות לאורך זמן. בענן משותף זה עלול להאט את העבודה ואף להפר את ה־fair use של הספק. לעבודה לא דחופה (סרטון שעה, פעם בכמה זמן) CX43/CX53 של Hetzner מספיק ונותן הכי הרבה ליבות לאירו. לעבודה רציפה ויומית עדיף 4–8 ליבות ייעודיות ב־Netcup RS, או שרת ייעודי.
- ‏CAX (ARM) זול ב־~20–30% לכל ליבה, אבל צריך לוודא שגלגלי PyTorch ו־SVT‑AV1 ל־arm64 מהירים מספיק. לא נמצאה מדידה כזו.

### Gaps
- אין מדידה מ־2026 של ffmpeg/SVT‑AV1 או של Whisper/qwen‑asr על CPU בספקים האלה. אין בכלל נתוני Netcup מ־2026.
- המקור הראשי לנתוני ה־steal לא מזוהה.

## 4. אחסון אובייקטים לקבצים גדולים

### Takeaway
הזולים לאחסון: ‏Hetzner Object Storage (כ־€6.5 ל־TB ו־€1 ל־TB יציאה, באותה רשת כמו השרת), ‏Backblaze B2 ‏($6.95 ל־TB, יציאה חינם עד פי 3 מהנפח השמור), ‏Wasabi ‏($7.99, בלי חיוב על יציאה אבל עם fair use ו־90 יום מינימום). ‏Cloudflare R2 יקר לאחסון ($15 ל־TB) אבל בלי שום עלות יציאה. מתאים להפצה של תוצרים.

### Cited Findings
- Hetzner Object Storage (עמוד רשמי, הסכומים לא הופיעו בטקסט): בסיס חודשי לכל חשבון עם bucket פעיל, כולל 1TB אחסון ו־1TB יציאה. מעבר לזה תשלום לפי TB‑שעה ולפי TB יציאה. כניסה, תעבורה פנימית ב־eu‑central וקריאות S3 בחינם. אובייקט מחויב כ־64KB לפחות. מיקומים: FSN1, ‏HEL1, ‏NBG1. המחירים בלי מע"מ — [Hetzner Object Storage](https://www.hetzner.com/storage/object-storage/)
- הסכום (משני, ספטמבר 2026): אחרי העלאה באפריל 2026 הבסיס הוא €6.49 לחודש, החריגה בערך €0.0087 ל־TB‑שעה (כ־€6.47 ל־TB לחודש) ו־€1 ל־TB יציאה. לפני כן היה €4.99 — [bex.co](https://bex.co/blog/2026/09/11/hetzner-object-storage-tenant-backup-backend); [Hetzner news (ישן)](https://www.hetzner.com/news/object-storage/)
- Backblaze B2: ‏$6.95 ל־TB לחודש (עלה מ־$6.00 במרץ 2026). יציאה חינם עד פי 3 מהנפח השמור, ואחר כך $0.01 ל־GB — [Backblaze pricing](https://www.backblaze.com/cloud-storage/pricing); [cloudzat](https://cloudzat.com/object-storage/)
- Wasabi: ‏$7.99 ל־TB מ־01/07/2026 (לפני כן $6.99). בלי חיוב על יציאה, עם fair use (הורדה ≤ הנפח השמור), מינימום של 1TB ומינימום של 90 יום לאובייקט — [cloudzat](https://cloudzat.com/object-storage/); [objectstorageprices](https://objectstorageprices.com/)
- Cloudflare R2: ‏$15 ל־TB (‏$0.015 ל־GB), יציאה $0 בכל נפח. משלמים על פעולות — [tech‑insider](https://tech-insider.org/cloudflare-r2-vs-s3-vs-backblaze-b2-2026/); [cloudzat](https://cloudzat.com/object-storage/)
- IDrive e2: כ־$5 ל־TB, יציאה $0, מינימום 1TB — **לא אומת ברשמי** — [cloudstorageprices](https://cloudstorageprices.com/)
- Scaleway: המקורות סותרים. ‏$14.56 ל־TB ויציאה $11.20 ל־TB, או $18.73 ל־TB ב־Multi‑AZ — [cloudzat](https://cloudzat.com/object-storage/); [dracon](https://dracon.uk/tools/object-storage-compare)

### Inferences
- שרת ב־Hetzner יחד עם Object Storage של Hetzner = תעבורה פנימית חינם ואחסון זול. זה הצימוד הטבעי לקבצי וידאו גדולים. ‏R2 עדיף רק אם התוצרים מורדים הרבה פעמים על ידי אחרים.
- B2 ו־Wasabi התייקרו ב־2026. השוואה שמבוססת על מחירים מ־2025 תציג אותם זולים מדי.

### Gaps
- לא אומתו בעמודים הרשמיים: המחירים של Hetzner Object Storage, ‏R2, ‏Wasabi, ‏IDrive e2, ‏Scaleway ו־OVH Object Storage. רק העמוד של Backblaze הופיע כמקור רשמי בתוצאות, והתוכן שלו לא נקרא ישירות.
- המחיר של OVH Object Storage לא נמצא.

## 5. מוניטין: אימות חשבון, שימוש לרעה והשבתות

### Takeaway
‏Hetzner דוחה חשבונות חדשים "חשודים" אוטומטית, כולל ממדינות מערביות, ולא מסבירה למה. כדי לעבור: הרשמה בלי VPN, פרטים שתואמים בדיוק לתעודה ולאמצעי התשלום, ובמקרה של דחייה — פנייה לנציג הרשמי. ‏Contabo ידוע בביצועים נמוכים ולא עקביים (overselling).

### Cited Findings
- ההנחיה הרשמית של Hetzner (Reddit, 2024) לחשבון שנדחה: לשלוח הודעה פרטית ל־u/Hetzner_OL עם מספר החשבון או המייל. לא להירשם דרך proxy/VPN, ולוודא שהפרטים מלאים ותואמים לתעודה ולאמצעי התשלום — [r/hetzner](https://reddit.birdcat.cafe/r/hetzner)
- נציג Hetzner ב־LowEndTalk: הם דוחים כל יום חשבונות "חשודים" גם מגרמניה וממדינות מערביות, ולא לפי מדינה, כדי להגן מפני שימוש לרעה. משתמש אחר מתאר את זה כמודל סיכון אוטומטי שהקריטריונים שלו לא ידועים — [LowEndTalk](https://lowendtalk.com/discussion/comment/2879718/); [LowEndTalk](https://lowendtalk.com/discussion/comment/2880108/)
- דיווחים אנקדוטליים: משתמש התקבל אחרי שעבר למייל בדומיין פרטי והעלה תעודה. אחר נדחה גם אחרי שהגיש מסמכים. סקירה מ־2026 מתארת דחייה בנימוק "suspicious information" בלי פירוט — [LowEndTalk](https://lowendtalk.com/discussion/comment/4041595/); [whtop](https://www.whtop.com/plans/hetzner.com/63565)
- Contabo: steal של 6.2% באחוזון 95 ושונות של 8.7% (המקור לא מזוהה) — [bestusavps](https://bestusavps.com/benchmarks/cpu-benchmark-2026/); ‏Geekbench ליבה אחת 482 מול 1,442 ב־Hetzner — [experte](https://www.experte.com/server/vps-benchmark)

### Inferences
- למשתמש מישראל עם פרטים אמיתיים ותואמים, ובלי VPN, הסיכון לדחייה ב־Hetzner קיים אבל לא חוסם. כדאי שתהיה חלופה מוכנה (OVH/Netcup) למקרה של דחייה.
- מסלול צמיחה בלי מיגרציה מיותרת: Hetzner Cloud CX43/CX53 → (rescale במקום) → כשה־CPU רץ כל הזמן, שרת ייעודי AX/EX ב־Hetzner (LTD או מכרז), באותה רשת ועם אותו Object Storage. החלופה: Netcup RS 1000 → RS 2000/4000 (ליבות ייעודיות לאורך כל הדרך), או OVH VPS‑4 → Rise‑S/M. ל־LLM מקומי: ‏Hetzner GEX44 ‏(€232.30 + €114 הקמה) הוא השלב הבא באותו ספק.

### Gaps
- לא נמצאו דיווחים מ־2026 על השבתות גדולות אצל אף אחד מהספקים, וגם לא על מדיניות שימוש לרעה ספציפית לקידוד וידאו או לעומס CPU רציף.
- לא נמצאו דיווחים ספציפיים על הרשמה מישראל ל־Hetzner, ‏Netcup או OVH.
