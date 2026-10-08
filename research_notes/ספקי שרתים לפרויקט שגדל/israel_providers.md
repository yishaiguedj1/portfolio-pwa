# שרתים שנמצאים פיזית בישראל — ענני ענק, ספקים בינלאומיים עם אתר בת״א וספקים ישראליים (נכון ל־08/10/2026)

> מקרא אמינות: **[רשמי]** = נשלף היום (08/10/2026) ממקור רשמי או מ־API ציבורי של הספק. **[צד ג׳]** = אתר השוואה או מאמר. **[ידע / לא אומת]** = ידע כללי שלא אומת בסשן הזה.
> חישוב חודשי = מחיר לשעה × 730 שעות. כל המחירים בדולר, **לפני מע״מ**.
> המרה גסה ליורו: 1$ ≈ 0.9€. זו הנחה ולא שער שנבדק.

## 1. ענני הענק עם אזור בישראל (Google me-west1, AWS il-central-1, Azure Israel Central, Oracle Jerusalem)

### Takeaway
בכל ארבעת הענקים יש אזור בישראל. כאן מכונה של 4 vCPU/16GB על דרישה עולה כ־$108–$172 לחודש, ו־8 vCPU/32GB עולה כ־$215–$345. זה פי 4–10 מהתקציב (€10–30).
"פרמיית ישראל" כמעט לא קיימת מול אירופה. ב־AWS תל אביב אפילו זול מעט מפרנקפורט. ב־Azure ישראל שווה למערב אירופה ויקר בכ־10–17% ממזרח ארה״ב.
GPU בישראל: Google (T4, A100), AWS (A10G ב־g5, A100 ב־p4de) ו־Azure (T4, A10 חלקי, V100). הזול ביותר שנמצא עולה כ־$470–$530 לחודש ברציפות.
הדרך היחידה לחודש ב"אפס" היא Oracle Always Free בירושלים, אבל הדף הרשמי מציג היום רק 2 OCPU ו־12GB, ויש בעיות קיבולת ידועות.

### Cited Findings

**Google Cloud — me-west1 (תל אביב)** (הנתונים מ־gcloud-compute.com, עודכנו 04/10/2026, מבוססים על מחירון Google) **[צד ג׳ שמשקף את הקטלוג הרשמי]**:
- e2-standard-4 (4/16): $0.1474 לשעה, **$107.62 לחודש**. Spot: $0.0797 לשעה (כ־$58 לחודש). התחייבות לשנה: $67.80. התחייבות ל־3 שנים: $48.43 — [gcloud-compute me-west1](https://gcloud-compute.com/me-west1.html)
- e2-standard-8 (8/32): $0.2949 לשעה, **$215.24 לחודש**. התחייבות לשנה: $135.60 — [gcloud-compute me-west1](https://gcloud-compute.com/me-west1.html)
- n2d-standard-4: $108.58 לחודש. n2d-standard-8: $217.16 לחודש (כולל הנחת שימוש רציף). n2-standard-4: $124.81. t2d-standard-4: $135.69. c3-standard-4: $161.89. c4-standard-4: $158.73. c4d-standard-4: $150.25. אין c4a (Arm) ב־me-west1 — [gcloud-compute me-west1](https://gcloud-compute.com/me-west1.html)
- דיסקים ב־me-west1 (לחודש): pd-standard $0.044/GB (כ־$44 ל־TB), pd-balanced $0.11/GB (כ־$110 ל־TB), pd-ssd $0.187/GB — [gcloud-compute me-west1](https://gcloud-compute.com/me-west1.html)
- GPU ב־me-west1: T4 (N1) באזורים b ו־c, A2 (A100) באזורים a ו־c. אין L4 (G2) ואין A3/A4 — [Google GPU regions](https://cloud.google.com/compute/docs/gpus/gpu-regions-zones). a2-highgpu-1g (A100 אחד): $2,949.73 לחודש — [gcloud-compute me-west1](https://gcloud-compute.com/me-west1.html)
- יציאה לאינטרנט (Premium, יעד במזרח התיכון): 1GiB הראשון חינם, ואחר כך $0.15/GiB עד 1TiB. נלקח מקטע חיפוש. לא אומת שישראל נכללת בקבוצה הזו — [Network Service Tiers pricing](https://cloud.google.com/network-tiers/pricing). בין אזורים: מזרח תיכון ↔ צפון אמריקה כ־$0.11/GiB (הטבלה במקור משובשת) — [VPC network pricing](https://cloud.google.com/vpc/network-pricing)

**AWS — il-central-1 (תל אביב)** — **[רשמי]**, מקובץ המחירים הציבורי של AWS (awsstatic, Linux, על דרישה), נשלף 08/10/2026 — [AWS EC2 On-Demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/)

| סוג | מפרט | ת״א $/שעה | ת״א $/חודש | פרנקפורט $/שעה |
|---|---|---|---|---|
| t4g.xlarge (Arm, burst) | 4/16 | 0.1546 | **112.86** | 0.1536 |
| t3.xlarge (burst) | 4/16 | 0.1917 | 139.94 | 0.1920 |
| m7g.xlarge (Graviton3) | 4/16 | 0.1910 | 139.43 | 0.1955 |
| m7i.xlarge | 4/16 | 0.23594 | 172.24 | 0.2415 |
| t4g.2xlarge | 8/32 | 0.3091 | 225.64 | 0.3072 |
| m7g.2xlarge | 8/32 | 0.3820 | 278.86 | 0.3910 |
| m7i.2xlarge | 8/32 | 0.47188 | 344.47 | 0.4830 |

- GPU ב־il-central-1: רק משפחת **g5** (NVIDIA A10G, ‏24GB) ו־**p4de.24xlarge**. g5.xlarge עולה $1.17915 לשעה (כ־$861 לחודש), זול מפרנקפורט ($1.258). p4de.24xlarge עולה $35.57 לשעה. **אין g4dn/g6/g5g בתל אביב**, אף שבפרנקפורט יש 51 סוגי GPU — [AWS EC2 On-Demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/) (קובץ המחירים, נשלף 08/10/2026)

**Azure — Israel Central** — **[רשמי]**, מה־Retail Prices API של Microsoft, נשלף 08/10/2026 — [Azure Retail Prices API](https://prices.azure.com/api/retail/prices)
- D4s_v5 (4/16): $0.224 לשעה, **$163.52 לחודש**. מערב אירופה: $0.230. מזרח ארה״ב: $0.192
- D4as_v5 (AMD 4/16): $0.212 לשעה, $154.76 לחודש. מערב אירופה: $0.208. מזרח ארה״ב: $0.172
- B4ms (burst 4/16): $0.192 לשעה, $140.16 לחודש. זהה למערב אירופה. מזרח ארה״ב: $0.166
- D8s_v5 (8/32): $0.448 לשעה, **$327.04 לחודש**. D8as_v5: $0.424, ‏$309.52
- דיסק Premium SSD P10 (128GB, LRS): $21.504 לחודש (כ־$0.168/GB). במערב אירופה: $21.68
- GPU ב־Israel Central (14 מידות):
  - NV6ads_A10_v5 (שישית A10): $0.649 לשעה, כ־$474 לחודש
  - NC4as_T4_v3 (T4): $0.724 לשעה, כ־$529 לחודש
  - NC8as_T4_v3: $1.034 לשעה
  - NV36ads_A10_v5 (A10 מלא): $4.576 לשעה
  - NC6s_v3 (V100): $4.205 לשעה
  - אין H100/A100 ברשימה

**Oracle — Israel Central (Jerusalem, il-jerusalem-1)**
- האזור פעיל מ־11/10/2021, מפתח MTZ, **Availability Domain אחד בלבד** — [Oracle release note](https://docs.oracle.com/iaas/releasenotes/changes/42075bb1-29a3-4ae2-96a1-588001665b3e/index.htm)
- Always Free כפי שמופיע **היום** בדף הרשמי:
  - A1 (Ampere Arm): 1,500 שעות OCPU ו־9,000 שעות GB בחודש, "equivalent to **2 OCPUs and 12 GB**" (לא 4/24 כמו בעבר)
  - 200GB Block Volume
  - 10TB יציאה בחודש
  - חייבים ליצור באזור הבית
  - תקלת "out of host capacity" = מחסור זמני
  - ישראל או ירושלים לא מוזכרות כחריג (החריג היחיד: Chuncheon)

  [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- מדריך מצד ג׳ מ־2026 מתאר מחסור קיבולת ב־A1 באזורים מבוקשים (דוגמה: יוהנסבורג, ינואר 2026) — [cnx-software / Grokipedia via search](https://grokipedia.com/page/Oracle_Cloud_Always_Free_Tier) **[צד ג׳]**

### Inferences
- **ענני הענק לא מתאימים לתקציב €10–30 במכונה שפועלת כל הזמן.** הזול ביותר שנמצא (4/16): GCP e2-standard-4 ב־$108, או AWS t4g.xlarge ב־$113. בהתחייבות ל־3 שנים GCP יורד ל־$48, ו־Spot יוצא כ־$58, אבל Spot עלול להיעצר. זה יכול להתאים לעבודות תמלול או צריבה שאפשר להמשיך אחרי הפסקה.
- **מכונה שמופעלת רק לפי דרישה** (למשל תמלול של שעת וידאו: כמה עשרות דקות של 8 vCPU) עולה סנטים לעבודה גם בענק. העלות האמיתית היא בדיסק הקבוע (כ־$0.044–$0.11/GB) ובתעבורת יציאה ($0.15/GiB ב־GCP).
- הגדלת מכונה בענקים = עצירה, שינוי סוג והפעלה. בלי מעבר שרת ובלי העברת דיסק. **[ידע / לא אומת]**
- ל־GPU שפועל 24/7 בישראל המינימום הוא כ־$470–$530 לחודש (Azure A10 חלקי / T4) או כ־$861 (AWS g5.xlarge). זה רחוק מהתקציב. GPU זמני לפי שעה (כ־$0.65–$1.18) יכול להתאים לעבודות קצרות.
- ב־Oracle ירושלים: אזור הבית נבחר בהרשמה ואי אפשר לשנות אותו. עם AD יחיד אין דרך לעקוף מחסור ב־A1. ‏2 OCPU/12GB של Arm מספיקים לתמלול על CPU באיטיות, אבל לא ל־LLM.

### Gaps
- מחירי Oracle בתשלום (E5/A1 Flex לכל OCPU ול־GB) — לא נשלפו בסשן. ידוע ש־Oracle מפרסמת מחיר אחיד לכל האזורים **[ידע / לא אומת]**.
- לא אומת היום אם יש קיבולת A1 חינמית בירושלים.
- מחיר יציאה לאינטרנט מ־AWS il-central-1 ומ־Azure Israel Central — לא נשלף.
- מחיר EBS gp3 בתל אביב — לא נשלף.
- מחיר GCP ב־us-central1 להשוואה ישירה — לא נשלף בסשן. מזיכרון, e2-standard-4 שם עולה כ־$0.134 לשעה, כלומר ת״א יקר בכ־10% **[ידע / לא אומת]**.
- מחיר GPU של T4 ב־GCP me-west1 לבד — לא נמצא.
- מע״מ על חשבוניות של הענקים ללקוח פרטי ישראלי — לא אומת.

## 2. ספקים בינלאומיים עם מרכז נתונים בתל אביב (Vultr, Kamatera ואחרים) — ומי בכלל לא בישראל

### Takeaway
**Vultr תל אביב (`tlv`)** הוא האפשרות הזולה והשקופה ביותר בתוך ישראל, לפי ה־API הציבורי היום:
- 2 vCPU/4GB: $20
- 4 vCPU/8GB: $40
- 6 vCPU/16GB: $80
- 8 vCPU/32GB: $160
- שרת ייעודי (bare metal) מ־$185
- **אין GPU בתל אביב**

**Kamatera** (חברה ישראלית, כמה אתרים בישראל): 4 vCPU/8GB מסוג A עולה כ־$36 לפי מקור צד ג׳. יש 5TB תעבורה כלולה ו־$0.05 לכל GB נוסף של SSD.

ל־Hostinger ול־Linode/Akamai **אין** ישראל. DigitalOcean ו־Contabo לא נמצאו בישראל.

### Cited Findings

**Vultr — Tel Aviv** **[רשמי]**, API ציבורי `api.vultr.com/v2`, נשלף 08/10/2026:
- האזור `tlv`, Tel Aviv, IL. אפשרויות: הגנת DDoS, Block Storage, Load Balancer, Kubernetes — [Vultr API regions](https://api.vultr.com/v2/regions)
- תוכניות זמינות ב־tlv (מחיר לחודש, דיסק כלול, תעבורה כלולה) — [Vultr API plans](https://api.vultr.com/v2/plans):

| קבוצה | תוכנית | מפרט | דיסק | תעבורה | מחיר |
|---|---|---|---|---|---|
| vc2 (Regular) | vc2-2c-4gb | 2/4GB | 80GB | 3TB | **$20** |
| vc2 | vc2-4c-8gb | 4/8GB | 160GB | 4TB | **$40** |
| vc2 | vc2-6c-16gb | 6/16GB | 320GB | 5TB | **$80** |
| vc2 | vc2-8c-32gb | 8/32GB | 640GB | 6TB | **$160** |
| High Performance (vhp, NVMe) | vhp-4c-8gb | 4/8GB | 180GB | 6TB | $48 |
| vhp | vhp-4c-12gb | 4/12GB | — | — | $72 |
| vhp | vhp-8c-16gb | 8/16GB | 350GB | 8TB | $96 |
| High Frequency (vhf) | vhf-4c-16gb | 4/16GB | — | — | $96 |
| vhf | vhf-8c-32gb | 8/32GB | — | — | $192 |
| Optimized (voc, ליבות ייעודיות) | voc-g-4c-16gb | 4/16GB | — | — | $120 |
| voc | voc-g-8c-32gb | 8/32GB | — | — | $240 |
| voc | voc-m-4c-32gb | 4/32GB | — | — | $160 |

- שרתים ייעודיים (Bare Metal) בתל אביב — [Vultr API plans-metal](https://api.vultr.com/v2/plans-metal):
  - vbm-6c-32gb (Xeon E-2286G, ‏960GB): **$185 לחודש**
  - vbm-8c-132gb (E-2388G, ‏1.92TB): $350
  - vbm-24c-384gb (EPYC 9254): $825
- GPU (סוג vcg): 0 תוכניות זמינות ב־tlv מתוך 15 בסך הכול — [Vultr API plans?type=vcg](https://api.vultr.com/v2/plans?type=vcg)
- Vultr פתחה את תל אביב ב־2023. בהודעה נכתב "cloud and GPU compute… bare metal", אבל היום אין GPU באתר הזה — [Vultr blog](https://blogs.vultr.com/vultr-tel-aviv); [BusinessWire](https://www.businesswire.com/news/home/20230501005629/en)

**Kamatera**
- דף המחירים הרשמי **[רשמי]** — [Kamatera pricing](https://www.kamatera.com/pricing/):
  - תוכניות לדוגמה: $4 (1 vCPU A / 1GB / 20GB SSD / 5TB), $25 (2 vCPU B / 2GB), $39 (2 vCPU B / 4GB)
  - "Additional storage is only $0.05 per GB per month"
  - "Additional traffic is only $0.01 per GB"
  - 5TB תעבורה כלולה
  - אם התעבורה הנכנסת עולה על 33% מהסך — כל התעבורה מחויבת
  - GPU לא מוזכר
  - ברשימת המיקומים שבדף מופיע רק "Israel, Tel Aviv"
- לפי Cloud Mercato **[צד ג׳]** — [Cloud Mercato 4A-8192](https://pcr.cloud-mercato.com/providers/kamatera/flavors/4A-8192):
  - האזורים בישראל: Tel Aviv, Jerusalem, Petach Tikva, Rosh Haayin (ו־Rosh Haayin 2), Haifa
  - 4 vCPU A / 8GB = **$36 לחודש** ($0.049 לשעה), אותו מחיר בכל אזורי ישראל
  - 16 vCPU A / 64GB = $288
  - 8 vCPU D (ייעודי) / 16GB = $302
  - בטבלה שנייה ירושלים יקרה יותר (למשל $0.073 מול $0.062 לשעה), בלי הסבר
- ב־Kamatera אפשר לבחור 1–104 vCPU ו־256MB–512GB RAM, בחיוב שעתי או חודשי — [learnwithhasan](https://learnwithhasan.com/self-hosting-hub/vps-providers/kamatera/) **[צד ג׳]**
- לא נמצאה עדות ל־GPU של Kamatera בישראל (חיפוש באתרי צד ג׳ בלבד)

**ספקי VPS קטנים עם מיקום בתל אביב** **[צד ג׳ / דפי ספק]**:
- Edis Global: יושבים ב־Shacham Data Center של בזק בינלאומי בת״א. KVM מ־€7.49 לחודש — [Edis Tel Aviv](https://edisglobal.com/vps-hosting/israel-tel-aviv)
- Hostease: Tel Aviv VPS מ־$5.54 (1 vCPU / 1GB / 25GB NVMe / 2TB). שדרוג דרך פנייה לתמיכה — [Hostease](https://hostease.com/middle-east-vps.html)
- Caasify: VPS ישראל מ־€6.59 (1/1GB/25GB), ‏€13.18 ל־2GB — [Caasify](https://caasify.com/cloud-vps/israel)
- HostZealot ו־Just.Hosting: הודיעו על מיקום בישראל — [HostZealot](https://www.hostzealot.com/blog/news/we-are-in-israel-now-a-new-vps-offer-from-hostzealot-is-on-its-way)

**מי לא בישראל:**
- Hostinger: מיקומי VPS בצרפת, גרמניה, ליטא, בריטניה, הודו, אינדונזיה, מלזיה וארה״ב — **אין ישראל** — [Hostinger support](https://www.hostinger.com/support/1583267-where-are-your-servers-located)
- Akamai/Linode: באזורים שהוכרזו לא נמצאה ישראל (תל אביב מופיעה רק כמשרד של Guardicore) — [DCD](https://datacenterdynamics.com/en/news/akamai-plans-seven-new-cloud-regions)
- DigitalOcean: בפורום שלהם משתמש מישראל מופנה לבדיקות מהירות לאזורים אחרים — [DO community](https://www.digitalocean.com/community/questions/which-region-i-need-to-choose-if-im-live-in-israel). לפי הידע שלי אין אזור בישראל **[ידע / לא אומת]**

### Inferences
- **בטווח של €10–30 בתוך ישראל:**
  - Vultr vc2-2c-4gb ($20) — מתאים לבוטים, תורים ומתזמנים
  - Kamatera 2–4 vCPU A — כ־$20–36 (הערכה)
  - VPS קטן של Edis/Hostease
  - 4/8GB ב־$36–40 עובר מעט את התקרה
  - 4/16GB עולה כ־$80–96 ב־Vultr. ב־Kamatera, לפי ההערכה של כ־$3 לכל GB של RAM מעל, זה בערך $55–60 — **הערכה שלי, לא מחיר שנמצא**
- **מסלול שדרוג בלי מעבר בתוך ישראל:**
  - Vultr: תוכנית גדולה יותר באותו מכונה (רק למעלה) → Optimized → Bare Metal ($185–825)
  - Kamatera: שינוי CPU ו־RAM לכל יחידה
  - שניהם **[ידע / לא אומת]** לגבי הגדלה בלי מעבר
- **צוואר בקבוק עיקרי: GPU.** אף ספק "זול" בישראל לא מציע GPU. GPU בישראל = רק ענני הענק, במחיר של מאות דולרים לחודש.
- Vultr ‏vc2 = מעבד משותף (Regular). לקידוד AV1 ולתמלול על CPU עדיפים vhp/voc, או bare metal (6 ליבות E-2286G ב־$185).

### Gaps
- מחירי Vultr לפי אזור: ה־API מחזיר מחיר בסיס. לא אומת אם ל־tlv יש מחיר אזורי שונה, או מחיר תעבורה עודפת (המחיר הכללי שידוע לי: $0.01/GB) **[ידע / לא אומת]**.
- מחירון היחידות הרשמי של Kamatera (לכל vCPU ולכל GB של RAM) — לא נשלף, הדף מציג מחשבון בלבד.
- מחיר Kamatera ל־8 vCPU / 32GB — לא נמצא.
- Contabo ו־Hetzner — לא נבדקו בסשן. לפי הידע שלי אין להם ישראל **[ידע / לא אומת]**.

## 3. ספקים ישראליים מקומיים (MedOne, Triple C, Interhost, בזק, פרטנר, סלקום, uPress ועוד) — מחיר, תשלום בשקלים, מע״מ, תמיכה

### Takeaway
הספקים המקומיים (MedOne, Triple C, Interhost, חוות התקשורת) מכוונים לעסקים. **אין להם מחירון ציבורי** לשרת ענן — רק הצעת מחיר. ביקורת מצד ג׳ מתארת את Interhost כיקרה מהמתחרים.
מה שהם נותנים: תמיכה בעברית, חשבונית ישראלית בשקלים, SLA של 99.99%. לא נמצאו אצלם מחירים שמתאימים לתקציב של מפתח יחיד.

### Cited Findings
- **MedOne Cloud**: ענן ציבורי ישראלי (IaaS/PaaS/SaaS) עם SLA של 99.99% ב־IaaS. הלקוחות בעיקר ארגונים — [MedOne Cloud](https://medone.co.il/medonecloud). 49% מ־MedOne נמכרו ל־Berkshire Partners (התאריך לא נבדק) — [MedOne news](https://medone.co.il/news-events/the-livnat-family-has-sold-49-of-medone-to-us-private-equity-firm-berkshire-partners)
- **Triple C (טריפל סי)**:
  - vCloud ו־pCloud: VLAN פרטי, VPN, משאבים ביחידות קטנות, תשלום לפי שימוש, הגדלה והקטנה בלי התחייבות — [Triple C vCloud](https://www.ccc.co.il/?p=13688)
  - בתנאים הכלליים (08/2025) נכתב שהמחיר מופיע ב"הזמנת השירות" — [General conditions PDF](https://www.ccc.co.il/wp-content/uploads/2025/08/General-conditions-for-hosting-services.pdf)
- **Interhost**: שרתים ייעודיים, שרתים מנוהלים, קולוקיישן וענן, 99.99%. ביקורת מ־2024 מציינת מחירים גבוהים מהמתחרים — [WebsitePlanet](https://websiteplanet.com/web-hosting/interhost) **[צד ג׳]**
- **HostCenter** (רחובות): חבילות "מ־50 ש״ח לחודש", תמיכה בעברית. דף שיווקי של הספק, בלי מפרט — [HostCenter](https://www.hostcenter.co.il/en/wp-json/wp/v2/posts/15157) **[צד ג׳ / דף ספק]**
- **שרתים ייעודיים בת״א**: הערכה כללית של $150–250 לחודש לתצורה עם 2×1TB NVMe ב־RAID1 — [Valebyte](https://valebyte.com/en/blog/servidor-dedicado-en-israel-tel-aviv-para-startups/) **[צד ג׳, הערכה]**. מחיר מאומת לשרת ייעודי בישראל: Vultr מ־$185 (סעיף 2)

### Inferences
- למפתח יחיד עם €10–30, ספק ישראלי מקומי שווה בדיקה רק אם חשובים חשבונית בשקלים או תמיכה בעברית. מחיר ותפעול בשירות עצמי — Vultr ו־Kamatera מקדימים.
- מע״מ בישראל: **18% מ־01/01/2025** **[ידע / לא אומת בסשן]**. ספק ישראלי יוסיף אותו לחשבונית. אצל ספק זר זה תלוי ברישום שלו למע״מ בישראל — לבדוק בחשבון.

### Gaps
- **לא נמצא מחירון ציבורי** לשרת ענן אצל: MedOne, Triple C, Interhost, בזק בינלאומי ובזק עסקים, פרטנר, סלקום. כולם עובדים בהצעת מחיר.
- uPress, BeeHost ו־HostGator IL — לא נבדקו. לפי הידע שלי הם מתמקדים באחסון אתרים ו־WordPress, לא ב־VPS כללי **[ידע / לא אומת]**.
- SLA ותמיכה בעברית של Vultr ו־Kamatera — לא אומתו. Kamatera ישראלית במקור, וסביר שיש לה תמיכה בעברית, אבל זו הסקה.
- לא נמצא דיווח בעיתונות הישראלית (2025–2026) על ענן מקומי חדש או זול. לא בוצע חיפוש ייעודי ב־Geektime או בכלכליסט.
