# סולם שדרוג הדרגתי ושכבות אחסון — המתחרים של Hetzner (מצב 08/10/2026)

> **הערת שיטה.** **[רשמי]** = נשלף היום (08/10/2026) מ־API ציבורי או מעמוד רשמי של הספק:
> - Vultr: `api.vultr.com/v2/plans`, ‏`plans-metal`, ‏`plans?type=vcg`
> - Linode: `api.linode.com/v4/linode/types`, ‏`volumes/types`, ‏`object-storage/types`, ‏`network-transfer/prices`, ‏`regions`
> - OVH: קטלוג ההזמנות הציבורי `api.ovh.com/1.0/order/catalog/public/{cloud,vps,eco}?ovhSubsidiary=DE`. המחירים באירו, **בלי מע"מ** (‏taxRate 19).
> - Scaleway: קטלוג המוצרים הציבורי `api.scaleway.com/product-catalog/v2alpha1/public-catalog/products`
> - DigitalOcean: עמודי המחירים הרשמיים
> - netcup: עמוד ה־VPS הרשמי
>
> **[משני]** = אתר צד ג׳ או קטע מתוצאת חיפוש.
> **[ידע]** = מהידע שלי בלבד, לא אומת היום.
>
> **אין לי מחירים רשמיים לשלושה ספקים.** העמודים של UpCloud ושל Contabo החזירו 403 (Cloudflare), וכך גם עמוד המחירים של vultr.com (ה־API שלו כן עבד). לכן המחירים שלהם כאן משניים.
>
> **חודשי מתוך שעתי.** "≈ לחודש" = מחיר לשעה × 730, וזה החישוב שלי. ההמרה לא מביאה בחשבון תקרה חודשית, אם יש לספק כזאת.

---

## 1. חיוב: לפי שעה או לפי חודש, התחייבות, דמי הקמה והנחות על תשלום מראש

### Takeaway
הספקים מתחלקים לשתי קבוצות:
- **חיוב לפי שימוש**, כמו Hetzner: DigitalOcean (לפי שנייה מ־01/01/2026), ‏Vultr, ‏Linode, ‏Scaleway ו־OVH Public Cloud.
- **חוזה חודשי, עם הנחה על התחייבות ארוכה**: netcup (1/12/24 חודשים, ‏−13% / −26%), ‏OVH VPS (‏6/12 חודשים מראש, ‏−5% / −15%) ו־Contabo.

הקבוצה השנייה זולה יותר לשרת שרץ כל הזמן, אבל אין בה "שעה אחת של שרת חזק".

### Cited Findings
- **DigitalOcean**: "Effective January 1, 2026… per-second billing (with a minimum charge of 60 seconds or $0.01)". לתוכניות Bundled יש תקרה חודשית ("never pay more than the flat monthly price"). ‏Droplets מסוג v5 "not capped at 672 hours" — [DO Droplet pricing](https://www.digitalocean.com/pricing/droplets) **[רשמי]**
- **Vultr**: כל תוכנית ב־API מופיעה עם `hourly_cost` ו־`monthly_cost`. דוגמה: ‏vc2-4c-8gb עולה ‏$0.055 לשעה או ‏$40 לחודש — [Vultr API plans](https://api.vultr.com/v2/plans) **[רשמי]**. שאלת התקרה החודשית — **[משני/ידע]**: "hourly billing with monthly caps" לפי רישום של צד ג׳ — [softwareone](https://platform.softwareone.com/product/block-storage/PCP-7184-5846)
- **Linode/Akamai**: כל סוג מופיע עם `price.hourly` ו־`price.monthly`. דוגמה: ‏g6-standard-4 עולה ‏$0.072 לשעה או ‏$48 לחודש. יש תמחור אזורי שונה רק בג׳קרטה ובסאו פאולו — [Linode API types](https://api.linode.com/v4/linode/types) **[רשמי]**. ‏**סוגי G8 Dedicated מופיעים ב־API רק עם מחיר לשעה** (`monthly: null`) — אותו מקור.
- **OVH Public Cloud**: לכל דגם יש מחיר `consumption` (לשעה) ומחיר `monthly.postpaid`. דוגמה: ‏d2-8 עולה ‏€0.0372 לשעה (≈€27 לחודש) או **€20.60 בחיוב חודשי**, הנחה של כ־24% — [OVH catalog cloud](https://api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=DE) **[רשמי]**
- **OVH VPS (דור "2027")**: בלי דמי התקנה (installation €0) בכל המצבים. המחיר החודשי לפי תקופת ההתחייבות — [OVH catalog vps](https://api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=DE) **[רשמי]**:

  | דגם | חודש־חודש | התחייבות ל־6 חודשים | 12 חודשים מראש |
  |---|---|---|---|
  | VPS‑1 | €4.49 | €4.26 | €3.81 |
  | VPS‑2 | €8.49 | €8.06 | €7.21 |
  | VPS‑3 | €12.24 | €11.62 | €10.40 |
  | VPS‑4 | €23.49 | €22.31 | €19.96 |

- **OVH Eco (Kimsufi/SYS)**: **דמי ההקמה = מחיר של חודש אחד**. ‏KS‑B עולה ‏€10.08 לחודש, ועוד ‏€10.08 הקמה — [OVH catalog eco](https://api.ovh.com/1.0/order/catalog/public/eco?ovhSubsidiary=DE) **[רשמי]**
- **netcup VPS G12.5**: "1M 1 month · 12M 12 months −13% · 24M 24 months −26%". המחיר שמוצג הוא "12 months contract period" — [netcup VPS](https://www.netcup.com/en/server/vps) **[רשמי]**. לא מצאתי חיוב לפי שעה. דמי ההקמה לא מופיעים בעמוד.
- **Scaleway**: מחירי Instances בקטלוג הם **לשעה** (‏GPU — **לדקה**), ו־Elastic Metal לשעה — [Scaleway public catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products) **[רשמי]**. לא בדקתי אם יש תקרה חודשית.
- **Contabo**: לפי מקורות משניים, "No setup fee" ברוב התוכניות, ורישום אחד מציג €9.90. המחירים הנמוכים הם בחוזה של 12 חודשים — [onedollarvps](https://onedollarvps.com/de/pricing/contabo-pricing); [tradingvpshub](https://tradingvpshub.com/contabo-pricing/) **[משני, סותר]**
- **UpCloud**: לא אומת. ‏**[ידע]**: חיוב לפי שעה עם תקרה חודשית.

### Inferences
- הדפוס של Hetzner, "שעתי עם תקרה חודשית, בלי התחייבות", קיים במלואו ב־DO, ‏Vultr ו־Linode. אצלם אפשר להגדיל ל־16 vCPU לכמה שעות ולחזור בחזרה. ב־netcup וב־Contabo אי אפשר: כל שלב הוא חוזה חודשי לפחות.
- ב־OVH Public Cloud החיוב החודשי זול בכ־24% מהשעתי. מכונה שרצה כל החודש עדיף לקבע לחודש, ולהשתמש בשעתי רק לפרצי עבודה.

### Gaps
- לא אימתתי ממקור ראשוני: התקרה החודשית של Vultr, ‏Linode, ‏Scaleway ו־UpCloud; דמי ההקמה של Contabo ו־netcup בחוזה של חודש אחד.

---

## 2. התוכנית השימושית הקטנה, גודל המדרגות עד ~16 vCPU/32GB, שינוי גודל במקום, השבתה, והאם הגדלת דיסק חוסמת הקטנה

### Takeaway
**אף ספק לא מציע את מה ש־Hetzner מציעה ב"rescale רק של CPU/RAM": לעלות ולרדת חופשי, בתנאי שלא מגדילים את הדיסק.**

- **הכי קרובים**: DigitalOcean (אפשרות "CPU and RAM only" הפיכה; הגדלת דיסק קבועה) ו־Linode (עלייה וירידה; לירידה צריך קודם לכווץ את הדיסק).
- **רק עלייה**: OVH VPS, ‏netcup, ‏Contabo. הקטנה = הזמנה חדשה והעברת הנתונים.

**המדרגות הזולות ביותר עד 16/32:**
- OVH VPS: ‏€4.5 → €8.5 → €12 → €23.5 (עד 8 vCPU/24GB).
- netcup: ‏€8 → €14.5 → €27 → €45 (עד 12/32 בחוזה שנתי).
- Contabo: ‏€4.5 → €7 → €14 → ~€20–27 (מקורות משניים).

**בענני ה"היפר־סקיילר הקטן"** (DO, ‏Vultr, ‏Linode) ‏8/16 עולה כ־$96 והמדרגה הבאה כ־$160–192. זה פי 6–10 מ־Hetzner CX43/CX53.

### Cited Findings
**DigitalOcean** [רשמי]:
- Basic (משותף):

  | vCPU/RAM | 1/1 | 1/2 | 2/2 | 2/4 | 4/8 | 8/16 |
  |---|---|---|---|---|---|---|
  | $/חודש | 6 | 12 | 18 | 24 | 48 | 96 |

  תעבורה כלולה: 1–6TB.
- CPU‑Optimized (ייעודי): ‏2/4 ב־$42, ‏4/8 ב־$84, ‏8/16 ב־$168, **‏16/32 ב־$336**. ‏General Purpose: ‏8/32 ב־$252 — [DO pricing](https://www.digitalocean.com/pricing/droplets)
- שינוי גודל: "CPU and RAM only… increases or decreases"; ‏"Disk, CPU, and RAM… permanently increases the size of a Droplet's disk"; ‏"You cannot decrease the size of a Droplet's disk"; ‏"You cannot resize GPU Droplets" — [DO docs, resize](https://docs.digitalocean.com/products/droplets/how-to/resize/)

**Vultr** [רשמי, API]:
- vc2 (משותף):

  | vCPU/RAM | 1/1 | 2/4 | 4/8 | 6/16 | 8/32 | 16/64 |
  |---|---|---|---|---|---|---|
  | $/חודש | 5 | 20 | 40 | 80 | 160 | 320 |

- vhp (‏High Performance AMD/Intel): ‏4/8 ב־$48, **‏8/16 ב־$96**, ‏12/24 ב־$144.
- voc‑c (ייעודי, CPU): ‏8/16 ב־$160, **‏16/32 ב־$320–360**.
- מקור: [Vultr API plans](https://api.vultr.com/v2/plans)
- שינוי גודל — **[ידע]**: רק עלייה (הדיסק גדל), עם הפעלה מחדש. לא נמצא מסמך רשמי: דף ה־resize בתיעוד החזיר 404.

**Linode/Akamai** [רשמי, API]:
- Shared:

  | vCPU/RAM | 1/1 | 1/2 | 2/4 | 4/8 | 6/16 | 8/32 | 16/64 |
  |---|---|---|---|---|---|---|---|
  | $/חודש | 5 | 12 | 24 | 48 | 96 | 192 | 384 |

- Dedicated G6: ‏8/16 ב־$144, ‏16/32 ב־$288. ‏G7: ‏$173 / $346.
- **Dedicated G8** (שעתי בלבד): ‏4/8 ב־$0.14 לשעה (≈$102), ‏8/16 ב־$0.27 (≈$197), ‏16/32 ב־$0.54 (≈$394).
- מקור: [Linode API types](https://api.linode.com/v4/linode/types)
- שינוי גודל: "warm resize" (נשאר פעיל ומופעל מחדש בסוף) או "cold resize" (כיבוי והעברה למארח אחר). ‏"Select a smaller plan. First, resize the Linode's disks". הכתובות נשמרות — [Akamai TechDocs, resize](https://techdocs.akamai.com/cloud-computing/docs/resize-a-compute-instance)

**OVHcloud**:
- **VPS (דור 2027)**: ‏VPS‑1..4 = ‏2/4/40, ‏4/8/75, ‏6/12/100, ‏8/24/200 — [OVH VPS](https://www.ovhcloud.com/en-ie/vps/) (דרך המחקר המקביל `europe_budget_providers.md`). המחירים בסעיף 1. בקטלוג יש גם VPS‑5/6 מהדור הקודם ב־€54.99/€72.99 חודש־חודש — [OVH catalog vps](https://api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=DE) **[רשמי]**.
- **שדרוג VPS** [רשמי]: מוסיפים vCores ("upgrading to the higher range"), ‏RAM או אחסון מהפאנל. ‏"The upgrade will be effective immediately, keeping all of your data", ‏"you will keep the same IP address". אחרי הגדלת אחסון צריך להרחיב את המחיצה — [OVH docs, upgrade VPS](https://docs.ovhcloud.com/en/guides/bare-metal-cloud/virtual-private-servers/upgrade-resources.md) (עודכן 2025‑09‑08)
- **הקטנת VPS** [משני]: לפי פורום הקהילה, התמיכה כתבה "it will not be possible to downgrade a VPS". הפתרון הוא ביטול והזמנה חדשה — [OVH community](https://community.ovhcloud.com/t/pour-quand-loption-de-downgrade-dans-les-vps/1944)
- **Public Cloud** [רשמי, קטלוג], לשעה:

  | דגם | vCPU/RAM | €/שעה | ≈ €/חודש |
  |---|---|---|---|
  | d2‑8 | 4/8 | 0.0372 | 20.6 (בחיוב חודשי) |
  | b3‑8 | 2/8 | 0.0512 | 37 |
  | b3‑16 | 4/16 | 0.1023 | 75 |
  | b3‑32 | 8/32 | 0.2046 | 149 |
  | c3‑16 | 8/16 | 0.1825 | 133 |
  | c3‑32 | 16/32 | 0.365 | 266 |

  מקור: [OVH catalog cloud](https://api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=DE). ‏**[ידע]**: ‏resize של Public Cloud הוא רק לדגם גדול יותר, כי הדיסק המקומי לא מתכווץ. דגמי "flex" מאפשרים לרדת.

**netcup** [רשמי]:
- VPS G12.5, מחיר בחוזה של 12 חודשים, בלי מע"מ:

  | דגם | vCore/RAM/דיסק | €/חודש |
  |---|---|---|
  | 500 | 2/4/64 | 8.26 |
  | 1000 | 4/8/128 | 14.50 |
  | 2000 | 8/16/256 | 26.92 |
  | 4000 | 12/32/512 | 45.36 |
  | 8000 | 16/64/1TB | 67.11 |

- "you can upgrade to a bigger plan within the same generation… use the upgrade feature in the CCP". ‏"Upgrades to or from promotional or special products are not possible". מ־G12 ל־G12.5 אין שדרוג ישיר — מזמינים חדש, מבטלים בסוף התקופה ומעבירים. העמוד לא מזכיר הקטנה.
- מקור: [netcup VPS](https://www.netcup.com/en/server/vps)

**Scaleway** [רשמי, קטלוג, fr‑par‑1], ≈ לחודש לפי 730 שעות:
- DEV1: ‏‑S ב־€6.6, ‏‑M (3/4) ב־€14.7, ‏‑L (4/8) ב־€31.3
- PLAY2: ‏‑MICRO (4/8) ב־€40
- POP2 (vCPU ייעודי): ‏2/8 ב־€54, ‏4/16 ב־€107, ‏8/32 ב־€212, ‏16/64 ב־€431
- PRO2: ‏‑S (8/32) ב־€163
- מקור: [Scaleway catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products)
- שינוי גודל: עוצרים את המכונה ← משנים `commercial-type` ← מפעילים. ‏"Downgrading… may not be possible if the smaller Instance type cannot support the existing Local Storage". הדרישה: מכונה עם Block Storage — [Scaleway docs, resize](https://www.scaleway.com/en/docs/instances/how-to/resize-instances/) **[משני — דרך סיכום החיפוש]**

**Contabo** [משני]:
- Cloud VPS 10 (4/8/75): ‏€4.50–$4.95
- VPS 20 (6/12/100): ‏€7
- VPS 30 (8/24/200): ‏€14
- VPS 40 (12/48/250): ‏€20–27
- מקורות: [onedollarvps](https://onedollarvps.com/de/pricing/contabo-pricing); [tradingvpshub](https://tradingvpshub.com/contabo-pricing/)
- שדרוג, לפי KB של Contabo (מצוטט בתוצאות החיפוש; העמוד עצמו 403): שתי דרכים.
  - "New deployment": מוחק את כל הנתונים, מקבלים IP חדש, בחינם.
  - "Live migration": בתשלום, עם השבתה ושינוי ה־IP הראשי.
  - הקטנה: "buy the smaller plan… transfer all the data… mark the old VPS for cancellation".
  - מקור: [Contabo KB](https://contabo.com/blog/kb/103000269722-can-i-change-my-virtual-private-server-vps-plan/)

**UpCloud** [משני]:
- מ־05/2026 הקווים Developer/General Purpose/High CPU כבר לא זמינים לפריסות חדשות. ‏**Starter**: מ־€3 (‏1/1/10) עד €28 (‏4/16). ‏**Premium**: ‏MaxIOPS, ‏EPYC Turin, ‏"99.999% SLA"; מחירים לא נמצאו.
- מקורות: [vpsranking, 02/04/2026](https://vpsranking.com/news/vps/vps-2026-04-02-upcloud-starter-premium-plans/); ההודעה הרשמית (403): [UpCloud blog](https://upcloud.com/blog/building-european-cloud-provider-choice-introducing-new-starter-premium-cloud-servers/)
- מדרגות Starter נוספות: ‏2/1 ב־€6, ‏2/2 ב־€8, ‏4/2 ב־€12, ‏8/2 ב־€18 — [whtop](https://www.whtop.com/plans/upcloud.com/93448) **[משני]**

### Inferences
- **הסולם החלק והזול ביותר** בטווח €5–30 הוא OVH VPS (שדרוג מיידי עם אותו IP, אבל בלי חזרה למטה), ואחריו netcup (שדרוג בתוך הדור, בחוזה).
  - שניהם מגיעים ל־8 vCPU בכ־€20–27 לחודש, כמו Hetzner CX43 (€16), אבל לא מאפשרים לרדת.
  - ב־netcup שדרוג מחייב להישאר באותו דור. כשיוצא דור חדש (G13) צריך מיגרציה.
- **ירידה אמיתית**:
  - DO: ‏"CPU/RAM only" — בדיוק כמו Hetzner: אם לא מגדילים את הדיסק, אפשר לחזור למטה. לנתונים להוסיף Volume.
  - Linode: ירידה דורשת לכווץ את הדיסק ידנית.
  - Scaleway: ירידה אפשרית רק עם Block Storage, לא Local.
- ב־Contabo, "שדרוג" בחינם = מכונה חדשה ריקה עם IP חדש. בפועל זה בדיוק כמו מיגרציה.

### Gaps
- לא נמצא תיעוד רשמי לשינוי גודל ב־Vultr (404) וב־UpCloud (403).
- לא נמצא תיעוד רשמי להקטנה ב־netcup.
- משך ההשבתה בפועל לא נמדד אצל אף ספק.
- אין מחירי UpCloud Premium.
- אין מחירי Contabo רשמיים (403).

---

## 3. מעבר לשרת ייעודי / bare metal ו־GPU באותו חשבון ובאותה רשת, ומחירי הכניסה

### Takeaway
- **OVH**: הנתיב המלא ביותר — VPS/Public Cloud → Eco/Rise → Advance, ‏GPU בענן, ו־vRack שמחבר ביניהם. ‏Kimsufi מ־€10 לחודש, ‏GPU L4 ב־€0.75 לשעה.
- **Scaleway**: ‏Instances + Elastic Metal **לפי שעה** (מכונה ייעודית מ־≈€56–66 לחודש) + GPU ‏L4 ב־€0.79 לשעה.
- **Vultr**: ‏Bare Metal גם **בתל אביב**, מ־$185.
- **Linode, ‏DO, ‏UpCloud**: אין bare metal לשימוש כללי (ב־DO יש רק GPU bare metal).
- **netcup ו־Contabo**: יש ייעודי, אבל בלי רשת פרטית משותפת מתועדת.

### Cited Findings
**OVH** [רשמי]:
- Eco, חודשי בלי מע"מ, הקמה = חודש:

  | דגם | מעבד | €/חודש |
  |---|---|---|
  | KS‑B | Xeon E5‑1620v2 | 10.08 |
  | KS‑C | E5‑1650v2 | 12.60 |
  | KS‑1 | Xeon‑D 1520 | 17.64 |
  | KS‑STOR | Xeon‑D 1521 | 24.36 |
  | SYS‑1 | Xeon‑E 2136 | 30.24 |

  מקור: [OVH catalog eco](https://api.ovh.com/1.0/order/catalog/public/eco?ovhSubsidiary=DE)
- RISE‑S (‏Ryzen 7 9700X, ‏64GB) ב־€64.99 — מהמחקר המקביל, [OVH Eco](https://eco.ovhcloud.com/en-ie/)
- GPU ב־Public Cloud — [OVH catalog cloud](https://api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=DE):

  | דגם | GPU | €/שעה | €/חודש |
  |---|---|---|---|
  | rtx5000‑28 | Quadro RTX 5000 | 0.36 | — |
  | t1‑45 | V100 | 0.70 | 504 |
  | l4‑90 | L4 24GB | 0.75 | 540 |
  | a10‑45 | A10 | 0.76 | — |
  | l40s‑90 | L40S 48GB | 1.40 | 1,008 |
  | h100‑380 | H100 | 2.80 | 1,940 |

- התעבורה הפנימית ב־vRack בחינם: `bandwidth_instance_vrack_out` = €0 — אותו קטלוג.
- **[ידע]**: ‏Kimsufi ו־So you Start לא תומכים ב־vRack. ‏Rise/Advance ו־Public Cloud כן.

**Scaleway** [רשמי, קטלוג]:
- Elastic Metal לשעה:
  - EM‑A116X‑SSD: ‏€0.077 (≈€56)
  - EM‑A115X‑SSD: ‏€0.091 (≈€66) — ‏nl‑ams‑1
  - EM‑A210R‑SATA: ‏€0.083 (≈€61) — ‏fr‑par‑2
  - EM‑B111X: ‏€0.263
- רשת פרטית ל־Elastic Metal: ‏€0.03 לשעה (1Gbps)
- GPU, לפי דקה (≈ לשעה): ‏L4‑1‑24G ב־€0.013125 (≈€0.79), ‏L40S‑1‑48G ב־€0.0245 (≈€1.47). ‏Elastic Metal L40S: ‏€4.11 לשעה. ‏H100: ‏€9.59 לשעה.
- מקור: [Scaleway catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products)

**Vultr** [רשמי, API]:
- Bare Metal:

  | דגם | מעבד | RAM | $/חודש | בפרנקפורט | בתל אביב |
  |---|---|---|---|---|---|
  | vbm‑6c‑32gb | E‑2286G | 32GB | 185 | ✓ | ✓ |
  | vbm‑8c‑132gb‑v2 | E‑2388G | 128GB | 350 | ✓ | ✓ |
  | vbm‑6c‑32gb‑amd | EPYC 4245P | — | 295 | ✓ | — |
  | vbm‑24c‑384gb‑amd | EPYC 9254 | 384GB | 825 | ✓ | ✓ |

  מקור: [Vultr API plans-metal](https://api.vultr.com/v2/plans-metal)
- GPU ‏(vcg): הזולים הם A16 ‏2GB ב־$43 ו־A40 ‏2GB ב־$55, אבל **אף אחת מתוכניות ה־vcg לא מופיעה היום עם מיקום זמין** ב־API — [Vultr API vcg](https://api.vultr.com/v2/plans?type=vcg)

**Linode/Akamai** [רשמי, API]:
- אין bare metal.
- GPU:
  - RTX 4000 Ada ×1, ‏4/16: ‏$0.52 לשעה (≈$380)
  - RTX 6000 ×1, ‏8/32: ‏$1.50 לשעה
  - **Accelerated NETINT VPU** (שבב קידוד וידאו), ‏8/16: ‏$280 לחודש
- מקור: [Linode API types](https://api.linode.com/v4/linode/types)

**DigitalOcean**: בתפריט המוצרים יש "GPU Droplets" ו־"Bare Metal GPUs" — [DO pricing](https://www.digitalocean.com/pricing/droplets) **[רשמי]**. ‏GPU Droplets לא ניתנים לשינוי גודל — [DO docs](https://docs.digitalocean.com/products/droplets/how-to/resize/). המחירים לא נשלפו.

**netcup**:
- Root Server (ליבות ייעודיות) מ־RS 500 ב־€12.93 — מהמחקר המקביל.
- בתפריט מופיע "vGPU" — [netcup VPS](https://www.netcup.com/en/server/vps). המחיר לא נשלף.

### Inferences
- **"גדל בלי לעבור ספק"**:
  - **OVH**: הסולם השלם ביותר במחירים נמוכים: VPS €4.5 → Public Cloud לשעה → Eco €10–30 → Rise €65 → GPU ‏L4 ‏€0.75 לשעה. זה כמו Hetzner, ויש GPU זמין לפי שעה (ב־Hetzner יש רק GEX45 חודשי).
  - **Scaleway**: הסולם הגמיש ביותר — גם bare metal לפי שעה.
- **Vultr** הוא היחיד עם bare metal בתל אביב ($185). ענן ו־bare metal באותו חשבון.
- ל־**Linode** אין bare metal. לעומת זאת, ה־**VPU ‏NETINT** שלה ($280) הוא מוצר נדיר שמיועד בדיוק לקידוד וידאו. כדאי לבדוק אם הוא תומך ב־AV1 לפני שמסתמכים עליו (לא בדקתי).

### Gaps
- מחירי GPU של DO ו־UpCloud לא נשלפו.
- לא מצאתי אם יש ל־Vultr GPU זמין באירופה היום (ב־API כל המיקומים ריקים).
- המפרט של Kimsufi KS‑B (RAM/דיסק) לא בקטלוג שנשלף.
- vRack עם VPS ב־OVH — לא אומת.
- רשת פרטית בין VPS ל־Root Server ב־netcup — לא נבדקה.

---

## 4. שכבות אחסון: בלוק (מחיר ל־TB ומדרגות), אובייקטים (מחיר ל־TB ויציאה כלולה), קופסאות גיבוי, גדלים מקסימליים

### Takeaway
**הבלוק הזול**:
- netcup: ‏€0.012 ל־GB (≈€12 ל־TB), עד 8TB, בלי התחייבות.
- Vultr HDD: ‏$25 ל־TB, עד 40TB.
- OVH classic: ‏€42 ל־TB.
- **SSD "רגיל"** אצל DO, ‏Linode ו־Vultr NVMe: ‏$100 ל־TB — פי 2 מ־Hetzner Volumes (€57).

**אובייקטים**:
- OVH Standard: **€7 ל־TB, בלי תשלום על יציאה** לפי הקטלוג.
- Scaleway: ≈€8 (One Zone) או ≈€16 (Multi‑AZ) ל־TB, ויציאה ב־€10 ל־TB.
- DO, ‏Linode: ‏$5 ל־250GB + 1TB יציאה, ‏$20 ל־TB נוסף.
- Contabo: ~€2.5 ל־250GB, "בלי עלות תעבורה" (משני).

**שום ספק לא מציע "Storage Box" במחיר של Hetzner.** הקרובים: OVH KS‑STOR (שרת אחסון ב־€24) ו־netcup Local Block.

### Cited Findings
**OVH** [רשמי, קטלוג; מחיר ל־GB לחודש, בלי מע"מ]:
- Block: ‏`volume.classic` ‏€0.042, ‏`volume.high-speed` ‏€0.086, Snapshot ‏€0.042
- Object: ‏`storage-standard` ‏€0.007 (S3 Standard), ‏`storage-high-perf` ‏€0.018, ‏`storage` ‏(Swift הישן) ‏€0.011, ‏`archive` ‏€0.0024
- **יציאה מ־Object Storage** (`bandwidth_storage-standard_out`): **€0**
- מקור: [OVH catalog cloud](https://api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=DE)

**netcup** [רשמי]: "Local Block Storage… up to 8 TB… flexibly and without fixed terms. The price per GB is €0.012" (‏1TB = 1024GB). ‏VPS Lite: עד 4TB — [netcup VPS](https://www.netcup.com/en/server/vps)

**Vultr**:
- NVMe: ‏"$1 per 10 GB"
- HDD: ‏$25 ל־TB, ו־NVMe ‏$100 ל־TB, לפי דף נתונים
- "up to 40 TB… HDD, or up to 10 TB… NVMe"
- מקורות: [Vultr block storage](https://www.vultr.com/products/block-storage/); [Vultr datasheet](https://discover.vultr.com/block-storage-datasheet) **[משני — דרך סיכום החיפוש; העמוד 403]**
- ביצועים: NVMe "7500 IOPS and 300 MiB/sec", ‏HDD "500 IOPS and 100 MiB/sec" — [Vultr docs](https://docs.vultr.com/support/products/storage/what-are-the-performance-expectations-for-block-storage)
- Object: ‏$18 לחודש ל־1TB עם 1TB יציאה — [vpsranking](https://vpsranking.com/object-storage/vultr/) **[משני]**

**DigitalOcean** [רשמי]:
- Volumes: ‏100GiB ב־$10, ‏1,000GiB ב־$100. Snapshot: ‏$0.06 ל־GiB — [DO volumes](https://www.digitalocean.com/pricing/volumes)
- Spaces: ‏"$5 per month… 250 GiB storage, 1 TiB outbound transfer, $0.02/GiB additional storage, $0.01/GiB additional transfer, $0.007/GiB cold storage" — [DO Spaces](https://www.digitalocean.com/pricing/spaces-object-storage)

**Linode** [רשמי, API]:
- Volume: ‏$0.10 ל־GB לחודש — [volumes/types](https://api.linode.com/v4/volumes/types)
- Object Storage: ‏$5 לחודש עם 1,000GB תעבורה; חריגת אחסון ‏$0.02 — [object-storage/types](https://api.linode.com/v4/object-storage/types)

**Scaleway** [רשמי, קטלוג]:
- היחידה בקטלוג היא "gigabyte", בלי ציון זמן. ההנחה שלי: **ל־GB לשעה**. לפיה:
  - Object Standard / One Zone ‏€0.000011 → ≈€8 ל־TB לחודש
  - Multi‑AZ ‏€0.000022 → ≈€16
  - Glacier ‏€0.0000035 → ≈€2.5
- יציאה מ־Object Storage: ‏**€0.01 ל־GB**
- Block SSD ‏€0.00013 → ≈€95 ל־TB לחודש. ‏Performance SSD ‏€0.000118 → ≈€86.
- מקור: [Scaleway catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products)
- במחקר המקביל: Multi‑AZ ב־$14.56–18.73 ל־TB — [europe_budget_providers.md](./europe_budget_providers.md). זה מתיישב עם ההנחה.

**Contabo** [משני, סותר]: ‏Object Storage ב־€1.99–$2.99 ל־250GB, "no charge for data traffic" — [european-alternatives](https://european-alternatives.eu/product/contabo-object-storage); [trustradius](https://www.trustradius.com/products/contabo/reviews)

**UpCloud** [משני]:
- Block Standard ‏€0.085 ל־GB, ‏MaxIOPS ‏€0.22 ל־GB (בלי תאריך) — [getpulsesignal](https://getpulsesignal.com/pricing/upcloud)
- Object Storage: "no egress or API fees" (הלסינקי/אמסטרדם/פרנקפורט) — [vpsranking](https://vpsranking.com/object-storage/upcloud/)

### Inferences
- **ספריית וידאו גדולה**, מהזול ליקר:
  - OVH Object Standard: ‏€7 ל־TB **בלי תשלום על יציאה** — הכי זול, **אם** ה־0 בקטלוג נכון בפועל.
  - netcup Local Block: ‏€12 ל־TB, צמוד ל־VPS, עד 8TB.
  - Vultr HDD Block: ‏$25 ל־TB.
- **DO, ‏Linode ו־Vultr NVMe** (‏$100 ל־TB בלוק) יקרים ל־TB גולמי פי ~8 מ־Hetzner Storage Box.
- **מדרגות קטנות**: כמו Hetzner (1GB) יש ב־netcup (GB), ‏OVH (GB), ‏Vultr (10GB). ‏DO מתמחר לפי GiB. ‏Scaleway — לפי GB.

### Gaps
- לא אומת בעמוד שיווקי של OVH שיציאה מ־Object Storage באמת חינם (רק בקטלוג).
- יחידת הזמן במחירי האחסון של Scaleway לא מפורשת בקטלוג — הנחה.
- הגודל המקסימלי של Volume ב־DO, ‏Linode, ‏OVH ו־Scaleway — לא נבדק. **[ידע]**: ‏DO ו־Linode עד 16TiB/10TB.
- מחיר Object Storage רשמי של Vultr, ‏Contabo ו־UpCloud — לא נשלף (403).
- המפרט של OVH KS‑STOR — לא נשלף.

---

## 5. תעבורה כלולה ומחיר חריגה (קריטי לספריית וידאו)

### Takeaway
- **בלי מונה בכלל**: OVH (VPS ו־Public Cloud), ‏netcup ("Traffic flat rate"), ‏Contabo (fair use, משני), ‏UpCloud ("no egress fees", משני).
- **עם מכסה וחריגה**:
  - Linode: ‏$5 ל־TB
  - Vultr ו־DO: ‏$10 ל־TB
- Hetzner (20TB ומעלה, ואז ~€1 ל־TB) עדיין זולה מכל בעלי המונה.

### Cited Findings
- **Vultr**: ‏"Bandwidth usage exceeding your plan's allocated quota is billed at an overage rate of $0.01 per GB" (עודכן 16/12/2025) — [Vultr docs, overage](https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate) **[רשמי]**
  - כלולה לפי תוכנית: ‏vc2‑8c‑32gb ‏6,144GB, ‏vc2‑16c‑64gb ‏10,240GB. ‏Bare Metal: ‏5–10TB — [Vultr API](https://api.vultr.com/v2/plans) **[רשמי]**
  - בריכה חינמית של 2TB לחשבון — [egresscost](https://egresscost.com/vultr) **[משני]**
- **Linode**: ‏`network_transfer` ‏$0.005 ל־GB ($5 ל־TB). ‏`distributed_network_transfer` ‏$0.01 — [Linode API network-transfer](https://api.linode.com/v4/network-transfer/prices) **[רשמי]**
  - כלולה (`transfer`, GB): ‏Nanode 1,000, ‏4/8 ‏5,000, ‏8/32 ‏16,000, ‏16/64 ‏20,000. ‏G8 Dedicated: ‏0 — [Linode API types](https://api.linode.com/v4/linode/types) **[רשמי]**
- **DigitalOcean**: ‏"starting from 500 GiB/month", ‏Basic 8/16 = ‏6,000GiB — [DO pricing](https://www.digitalocean.com/pricing/droplets) **[רשמי]**. חריגה ב־Spaces ‏$0.01 ל־GiB — [DO Spaces](https://www.digitalocean.com/pricing/spaces-object-storage) **[רשמי]**. חריגת Droplet ‏$0.01 ל־GiB — **[ידע]** (דף ה־bandwidth הפנה לכתובת אחרת).
- **OVH**: ‏`bandwidth_instance_out` = €0 ו־`bandwidth_storage-standard_out` = €0 בקטלוג Public Cloud — [OVH catalog cloud](https://api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=DE) **[רשמי]**. ‏VPS: ‏"Unlimited traffic", ‏500Mbps–3Gbps — [OVH VPS](https://www.ovhcloud.com/en-ie/vps/) (מהמחקר המקביל). ‏Public Cloud: רוחב הפס לפי דגם — d2‑2 ‏100Mbps, ‏d2‑8 ‏500Mbps, ‏b3‑32 ‏2Gbps — אותו קטלוג.
- **Scaleway**: יציאה מ־Object Storage ‏€0.01 ל־GB ($10.9 ל־TB) — [Scaleway catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products) **[רשמי]**. תעבורה מ־Instances — **[ידע]**: בלי מונה; לא אומת.
- **netcup**: ‏"With Traffic flat rate…", ‏"Traffic included" — [netcup VPS](https://www.netcup.com/en/server/vps) **[רשמי]**
- **Contabo**: ‏"unlimited traffic under a fair-use policy", פורט 200–600Mbit/s לפי תוכנית — [onedollarvps](https://onedollarvps.com/de/pricing/contabo-pricing) **[משני]**
- **UpCloud**: ‏"No Egress Fees, No Surprises" (כותרת עמוד רשמי שלא נקרא, 403) — [UpCloud fair transfer](https://upcloud.com/fair-transfer-policy); ‏"zero-cost egress" — [datacentremagazine](https://datacentremagazine.com/data-centres/upcloud-offers-fastest-cloud-servers-with-zero-cost-egress) **[משני]**. סתירה: ‏vpsbenchmarks מציג "Data Transfer 500GB" לתוכנית של €3.

### Inferences
- **לשרת 50TB בחודש**, כחישוב שלי:
  - Vultr או DO: ~$440–490 רק על תעבורה (‏50TB פחות ~5–6TB כלולים, × $10).
  - Linode: ~$170–220.
  - OVH, ‏netcup ו־Hetzner: כמעט אפס.
- **לספריית וידאו פתוחה**, ענני ה־$ האמריקאיים לא מתאימים. ‏OVH Object Storage, עם יציאה בחינם ו־€7 ל־TB, הוא כנראה המתחרה הכי חזק ל־Hetzner + CDN.

### Gaps
- לא נמצא ממקור ראשוני מה המגבלות של "unlimited" ב־OVH, ‏netcup ו־Contabo (fair use / האטה). זה לא נקרא בתנאי השימוש.
- ה־fair use של UpCloud לא נקרא (403).
- חריגת תעבורה של Droplets ב־DO — לא אומתה בעמוד רשמי היום.

---

## 6. אתרי שרתים קרובים לישראל והשהיה לתל אביב

### Takeaway
- **Vultr**: היחיד ברשימה עם אתר **בתל אביב** (`tlv`), עם ענן ו־bare metal.
- **לכל השאר**: פרנקפורט / מילאנו / וינה / נירנברג / פריז / אמסטרדם, ב־~50–66ms.
- **מרסיי** (‏39.7ms לפי WonderNetwork) היא הקרובה ביותר. ממה שבדקתי, רק ל־OVH יש שם משהו, וגם זה לא אומת.

### Cited Findings
- **Vultr**: כל ה־vc2 וה־vhp, ‏vhf עד 8/32, ו־bare metal (‏$185/$350/$825) זמינים ב־`tlv` לפי השדה `locations`. רוב התוכניות זמינות גם ב־`fra` — [Vultr API plans](https://api.vultr.com/v2/plans); [plans-metal](https://api.vultr.com/v2/plans-metal) **[רשמי]**
- **Linode**: אזורים באירופה — Frankfurt (`eu-central`, ‏`de-fra-2`), **Milan** (`it-mil`), Paris ×2, Amsterdam, Madrid, Stockholm, London. אין ישראל — [Linode API regions](https://api.linode.com/v4/regions) **[רשמי]**
- **netcup**: ‏"Vienna (VIE), Nuremberg (NUE), Amsterdam (AMS), Manassas/USA, Singapore" — [netcup VPS](https://www.netcup.com/en/server/vps) **[רשמי]**
- **OVH Eco**: צרפת (גרבלין, פריז, רובה, שטרסבורג), פרנקפורט, מילאנו, ורשה, לונדון — [OVH Eco](https://eco.ovhcloud.com/en-ie/) (מהמחקר המקביל)
- **Scaleway**: ‏fr‑par‑1/2/3, ‏nl‑ams‑1/2, ‏pl‑waw‑2, ו־it‑mil בקטלוג — [Scaleway catalog](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products) **[רשמי]**
- **השהיה מתל אביב** (WonderNetwork, ‏08/10/2026): מרסיי 39.7 · פרנקפורט 52.3 · נירנברג 57.3 · מילאנו 62.8 · אמסטרדם 63.0 · פריז 65.3 · וינה 66.0 · ורשה 68.0. ‏Globalping: ‏OVH גרבלין 53–67ms, רובה 57–73ms. ‏Azure Israel Central → France South (מרסיי) 42, ‏Austria East 48, ‏Italy North 49 — [latency_reliability.md](./latency_reliability.md) (מחקר מקביל, מדידה מהיום)

### Inferences
- **השהיה**: ההבדל בין ספקי אירופה זניח (±10ms). ‏Vultr בתל אביב חוסך ~50ms, וזה משנה בעיקר לממשק אינטראקטיבי, לא לעיבוד וידאו ברקע.

### Gaps
- לא מצאתי מדידה ישירה מישראל לכתובות הבדיקה של Vultr, ‏Linode, ‏DO, ‏Scaleway, ‏netcup, ‏Contabo ו־UpCloud. ההערכה לפי עיר.
- האם ל־DO, ‏Contabo או UpCloud יש מילאנו או וינה — לא נבדק. **[ידע]**: ‏DO — פרנקפורט, אמסטרדם, לונדון. ‏UpCloud — פרנקפורט, הלסינקי, אמסטרדם ועוד.

---

## 7. שורה תחתונה: כמה חלק וזול כל סולם לעומת Hetzner

### Takeaway
**Hetzner עדיין מובילה בצירוף של חמש תכונות:**
1. חיוב שעתי עם תקרה חודשית
2. rescale הפיך (לעלות ולרדת)
3. 20TB תעבורה
4. Storage Box זול
5. ייעודי באותה רשת

**אף מתחרה לא מנצח בכל החמש.**

**החלופות הכי שקולות:**
- **OVH**: הסולם הכי ארוך והכי זול, ותעבורה בלי מונה. החסרונות: אין ירידה ב־VPS, ו־Public Cloud יקר כשהוא לפי שעה.
- **netcup**: הכי זול לאחסון בלוק, ותעבורה בלי מונה. החסרונות: חוזים, ושדרוג רק בתוך הדור.

**בעלי הסולם הכי "חלק" טכנית, אבל יקר פי 5–10 ועם תעבורה בתשלום**: DO (שינוי CPU/RAM הפיך), ‏Linode (עלייה וירידה) ו־Vultr (ת״א).

### Cited Findings
סינתזה של סעיפים 1–5. כל המספרים מצוטטים שם.

| ספק | חיוב | 8 vCPU / 16GB, ≈ לחודש | ירידה במקום | ייעודי / GPU באותו חשבון | בלוק / TB | אובייקטים / TB | חריגת תעבורה |
|---|---|---|---|---|---|---|---|
| **Hetzner** (בסיס) | שעתי עם תקרה | CX43 ‏€16 | כן, אם הדיסק לא הוגדל | ‏~€57 / GEX45 ‏€212 | ~€57 | (נכוסה במחקר אחר) | ~€1 |
| **OVH** | VPS חודשי / שעתי (Public Cloud) | VPS‑4 ‏(8/24) ‏€20–23.5; ‏c3‑16 ≈€133 | VPS לא (משני); PC — רק flex (ידע) | Kimsufi מ־€10, ‏Rise €65, ‏L4 ‏€0.75 לשעה | €42 | **€7, בלי עלות יציאה** | אין מונה |
| **netcup** | חוזה 1/12/24 חודשים | VPS 2000 ‏€27 (12 חודשים) | לא מתועד; שדרוג רק בתוך הדור | RS מ־€13, ‏vGPU (מחיר לא נבדק) | **€12, עד 8TB** | — | Flat |
| **Contabo** | חוזה (משני) | VPS 30 ‏(8/24) ~€14 | לא — "שדרוג" = פריסה חדשה עם IP חדש, או מיגרציה בתשלום | לא נבדק | — | ~€10 (‏4×250GB) | fair use |
| **Scaleway** | שעתי | POP2‑8C (‏8/32) ≈€212; ‏DEV1‑L (‏4/8) ≈€31 | כן, רק עם Block Storage | Elastic Metal לשעה (≈€56+), ‏L4 ≈€0.79 לשעה | ≈€86–95 | ≈€8–16 + יציאה €10 | ל־Instances לא אומת |
| **UpCloud** | שעתי (ידע) | Starter עוצר ב־4/16 ‏€28; ‏Premium — לא ידוע | לא אומת | אין bare metal (ידע) | €85 / €220 (משני) | ללא יציאה (משני) | "No egress fees" (משני) |
| **Vultr** | שעתי עם תקרה (משני) | vhp ‏$96; ‏voc‑c ‏$160 | **[ידע]** לא | bare metal מ־$185, **גם בת״א**; ‏GPU — אין מיקום זמין היום | HDD ‏$25 / NVMe ‏$100 | ‏$18 ל־1TB (משני) | $10 |
| **DigitalOcean** | לפי שנייה עם תקרה | Basic ‏$96 / CPU‑Opt ‏$168 | **כן** ("CPU and RAM only") | GPU Droplets / Bare Metal GPU (מחיר לא נבדק) | $100 | $20 + ‏$5 בסיס | $10 |
| **Linode** | שעתי (API) | Shared ‏$96 / Dedicated ‏$144–197 | **כן**, אחרי כיווץ הדיסק | אין bare metal; GPU מ־$0.52 לשעה; **VPU וידאו ‏$280** | $100 | $20 + ‏$5 בסיס | **$5** |

### Inferences
- **התחלה בזול וגדילה בלי לשלם על קיבולת שלא בשימוש**:
  - **OVH VPS‑1 ← VPS‑4** מקביל ל־Hetzner במחיר ובחלקות, אבל **חד־כיווני**.
  - **netcup**: אותו דבר, עם חוזה.
  - ב־Hetzner אפשר לחזור למטה. זה היתרון הממשי שלה לעבודה שבאה בפרצים, כמו תמלול וקידוד.
- **לפרצים קצרים של CPU כבד** (שעה של 16 vCPU):
  - Hetzner CX53: בערך €0.04–0.05 לשעה.
  - Scaleway POP2‑16C: ‏€0.59 לשעה.
  - DO CPU‑Opt 16: ‏$0.50 לשעה.
  - OVH c3‑32: ‏€0.365 לשעה.
  - כלומר, פי ~8–12 יקר מ־Hetzner. בצד השני, GPU לפי שעה: OVH ו־Scaleway (‏L4 ב־~€0.75–0.79) זולים בהרבה מ־GEX45 החודשי של Hetzner, למי שצריך GPU רק כמה שעות בחודש.
- **לספריית וידאו**: הצירוף **OVH** (VPS/Eco + Object Storage ב־€7 ל־TB בלי עלות יציאה) הוא היחיד שמתקרב ל־Hetzner (Storage Box + 20TB), ואולי אף זול ממנו, אם "בלי עלות יציאה" נכון בפועל. ענני ה־$ (DO, ‏Vultr, ‏Linode) מתאימים רק עם CDN חיצוני.
- **ישראל**: ‏Vultr ת״א הוא היחיד שנותן גם ענן וגם bare metal בתוך ישראל ($185 ומעלה). אבל המחיר ל־vCPU והתעבורה הם הגבוהים ברשימה.

### Gaps
- לא נמצא מקור רשמי שמשווה זמני השבתה ב־resize.
- המחירים של Contabo ו־UpCloud **לא אומתו מול הספק** (חסימת 403). כדאי לאמת לפני החלטה.
- תנאי ה־fair use של "unlimited" (OVH, ‏netcup, ‏Contabo, ‏UpCloud) לא נקראו. בספריית וידאו פתוחה זה עלול להיות המגבלה האמיתית.
