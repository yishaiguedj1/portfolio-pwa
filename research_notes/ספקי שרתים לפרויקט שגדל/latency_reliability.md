# השהיה (latency), קישוריות ואמינות — מישראל לאתרי שרתים (מצב 08/10/2026)

> הערת שיטה: רוב המספרים כאן **נמדדו היום, 08/10/2026**, ב־Globalping (בדיקות ping/HTTP/mtr ממכשירי בדיקה בישראל, דרך ה־API הציבורי) ונשלפו מטבלת WonderNetwork (בדיקה מתמשכת משרת בתל אביב, "Last Checked" של היום). מכשירי הבדיקה של Globalping בישראל: 15, כמעט כולם בחוות שרתים (The Constant Company/Vultr, G-Core, Interhost, Datacamp, Oracle ירושלים, Amazon, Google, SmartApe, O.M.C.) ו**אחד ביתי בלבד — HOT-Net**. **אין מכשיר בדיקה סלולרי** (פרטנר/סלקום/פלאפון/הוט מובייל) — הסלולר מוסיף השהיה משלו, ראו סעיף 2.

## 1. השהיה טיפוסית מישראל לכל אתר (ms, הלוך־חזור)

### Takeaway
בתוך ישראל (AWS/Google/Oracle/Azure בתל אביב וירושלים) — **2–8ms**. מערב/מרכז אירופה מגיעים ב־**50–65ms** (פרנקפורט/נירנברג/פלקנשטיין/רובה/גרבלין/מילאנו/וינה), כי כל התעבורה של ישראל יוצאת בכבלים בים התיכון לאירופה ומשם ממשיכה. **מפתיע: קפריסין (~103ms), יוון (~80–87ms), טורקיה (~72ms), בולגריה (~82ms) ורומניה (~94–119ms) איטיות יותר מגרמניה** — אין ניתוב ישיר אליהן; התעבורה עוברת דרך מרכזי אירופה וחוזרת. הלסינקי (Hetzner) ~77–94ms. המהיר באירופה: מרסיי ~40ms.

### Cited Findings
**WonderNetwork — שרת בתל אביב → ערים (ממוצע; נבדק 08/10/2026)** — [WonderNetwork, Tel Aviv](https://wondernetwork.com/pings/Tel%20Aviv):
- מרסיי 39.7 · פרנקפורט 52.3 · שטרסבורג 54.0 · לונדון 56.6 · נירנברג 57.3 · ציריך 57.4 · פלקנשטיין 58.0 · רובה (Roubaix) 60.5 · מילאנו 62.8 (סטיית תקן 2.6) · אמסטרדם 63.0 · רומא 64.4 · פראג 64.7 · פריז 65.3 · וינה 66.0 · ורשה 68.0 · פלרמו 68.8 · **איסטנבול 72.4** · בודפשט 77.3 · **סלוניקי 79.5** · בלגרד 80.0 · **סופיה 81.7** · **הלסינקי 81.8** · **אתונה 87.5** · **בוקרשט 119.3 (מינימום 93.9, סטיית תקן 14.9 — לא יציב)** · **לימסול (קפריסין) 103.5** · ניו יורק 139.2 · דובאי 174.8.

**Globalping — 6 פינגים מכל מכשיר בישראל (08/10/2026; ממוצעים, טווח בין המכשירים)** — [Globalping API](https://api.globalping.io/v1/measurements), כתובות הבדיקה הרשמיות של הספקים:
- Hetzner נירנברג (`nbg1-speed.hetzner.com`): 53–65ms; HOT-Net ביתי: 59.2.
- Hetzner פלקנשטיין (`fsn1-speed.hetzner.com`): 57–72ms; HOT-Net: 72.0.
- Hetzner הלסינקי (`hel1-speed.hetzner.com`): 77–96ms; HOT-Net: 86.1.
- OVH רובה (`rbx.proof.ovh.net`): 57–73ms; HOT-Net: 73.3.
- OVH גרבלין (`gra.proof.ovh.net`): 53–67ms.
- 0% אובדן חבילות בכל הבדיקות.

**ענני ישראל — זמן חיבור TCP מישראל (Globalping HTTP, 08/10/2026; ICMP חסום ב־AWS)**:
- AWS `il-central-1` (תל אביב): TCP חציון 3ms (HOT-Net: 8ms) — [Globalping](https://api.globalping.io/v1/measurements).
- Oracle `il-jerusalem-1`: TCP חציון 4ms — אותו מקור.
- Google `me-west1` (תל אביב, דרך נקודת ה־gcping): תשובה ראשונה בחציון 15ms (כולל עיבוד בצד השרת; HOT-Net 19ms), לעומת `europe-west3` פרנקפורט 64.5ms — נקודות מ־[gcping endpoints](https://global.gcping.com/api/endpoints). הערה: Cloud Run של `europe-west8` (מילאנו, 108ms) ו־`europe-north1` (101ms) יצאו גבוהים מה־RTT האמיתי — המדידה הזו כוללת ניתוב פנימי של Google ולכן לא משקפת ping נקי.
- AWS פרנקפורט (`eu-central-1`): TCP חציון 59ms; AWS מילאנו (`eu-south-1`): 47.5ms.

**Azure — טבלת ה־RTT הרשמית בין אזורים (P50, חלון 30 יום; עמוד עודכן 2026-07/08)** — [Microsoft Learn, Azure network round-trip latency](https://learn.microsoft.com/en-us/azure/networking/azure-network-latency): מ־Israel Central אל: France South (מרסיי) 42 · Austria East (וינה) 48 · Italy North (מילאנו) 49 · Switzerland North 52 · France Central 54 · Spain Central 56 · Germany West Central (פרנקפורט) 57 · Poland Central 58 · UK South 59 · Germany North 60 · Belgium Central 62 · West Europe (אמסטרדם) 63 · Denmark East 67 · North Europe (דבלין) 78 · Sweden Central 79 · **Qatar Central 109 · UAE North 121** · East US 123.

**למה — הכבלים והמסלולים**:
- ישראל נשענת על **שלושה כבלים תת־ימיים בלבד, כולם קרובים לקיבולת מלאה**: MedNautilus (Telecom Italia) ~מחצית התעבורה, Tamares ~30%, Bezeq International ~20%; **אין לישראל כבל לים סוף** — כל הקישורים בים התיכון, לתחנות בקפריסין, יוון ואיטליה; התעבורה גדלה ~30% בשנה — [Globes, 21/01/2026](https://en.globes.co.il/en/article-1001532640).
- **Blue-Raman (Google)**: מקטע ישראל–אירופה והפריסה של בזק בארץ הושלמו, אבל קישור ים סוף מתעכב בחודשים (ביטוח, עלויות, התקפות החות'ים); תוכנן ל־2025 — [Globes, 21/01/2026](https://en.globes.co.il/en/article-1001532640). אתר מדריך כבלים טוען שנכנס לפעולה ב־2025 בלי מקור — סותר את Globes (מסיכום חיפוש; לא אומת).
- **TEAS** (מרסיי–מומבאי דרך ישראל וסעודיה, ~900 מיליון $) — מוקפא מאז המלחמה; **EMC** (עם יוון, קפריסין, HOT ו־Tamares, ~850 מיליון $) — עדיין בשלב סקר, ספינות טורקיות הפריעו — [Globes, 21/01/2026](https://en.globes.co.il/en/article-1001532640).
- **מסלול שנמדד (mtr, 08/10/2026)**: מ־HOT-Net ביתי — 8ms בתוך הרשת של HOT (AS12849), קפיצה ל־**55ms בפרנקפורט** (Telia/Arelion, AS1299), ואז Hetzner פלקנשטיין 68–69ms. משרת בתל אביב (דרך בזק בינלאומי, AS8551) — 0.4ms בארץ, **54ms ב־`core8.fra.hetzner.com`**, ומשם הלסינקי ב־76ms (כלומר הלסינקי = פרנקפורט + ~22ms) — [Globalping mtr](https://api.globalping.io/v1/measurements).
- **ניתוקי ים סוף**: ב־06/09/2025 נותקו SMW4 ו־IMEWE ליד ג'דה (ככל הנראה עוגן גרור); Microsoft הזהירה מהשהיה מוגברת לתעבורה שעוברת במזרח התיכון, Cloudflare מדדה עד 30% עלייה הודו–אירופה — [Al Jazeera, 07/09/2025](https://www.aljazeera.com/news/2025/9/7/internet-disruptions-in-middle-east-and-south-asia-after-red-sea-cable-cuts); [The Register, 07/09/2025](https://www.theregister.com/2025/09/07/asia_tech_news_roundup/). החות'ים פגעו בכבלי ים סוף לפחות פעמיים במלחמה — [Globes](https://en.globes.co.il/en/article-1001532640).

### Inferences
- מאחר שלישראל אין כבל לים סוף, ניתוק בים סוף כמעט לא משפיע על המסלול ישראל↔אירופה (הוא משפיע על ישראל↔המפרץ/אסיה). הסיכון הרלוונטי לישראל הוא **צוואר הבקבוק של שלושה כבלים בים התיכון** — ניתוק של MedNautilus לבד = כמחצית הקיבולת.
- "קרוב גיאוגרפית" ≠ "מהיר": קפריסין (334 ק"מ) איטית פי 2 מפרנקפורט (2,945 ק"מ). מבחינת השהיה, **מרכז/מערב אירופה (גרמניה, צרפת, איטליה, אוסטריה) הוא האזור הטבעי**; יוון/טורקיה/בולגריה/רומניה/קפריסין לא מקנות יתרון ולעיתים גרועות.
- בין ספקי אירופה ההבדל קטן (±10ms): Hetzner נירנברג/פלקנשטיין ≈ OVH רובה/גרבלין ≈ AWS פרנקפורט ≈ ~55–65ms. הלסינקי מוסיפה ~20–25ms.
- אזורי המפרץ (קטאר/איחוד האמירויות) איטיים מאירופה מישראל (109–121ms ב־Azure) — לא אופציה טובה.

### Gaps
- לא נמצאו מדידות מרשתות סלולריות ישראליות ספציפיות (אין מכשירי Globalping סלולריים בישראל).
- Kamatera (תל אביב/פתח תקווה), MedOne ו־Azure Israel Central — לא נמדדו ישירות (לא נמצאה כתובת בדיקה ציבורית); סביר שהם כמו AWS/Oracle (2–8ms), אבל זה לא נמדד.
- Contabo ו־Netcup (נירנברג), Scaleway (פריז/אמסטרדם) — לא נמדדו ישירות; לפי ערי היעד ב־WonderNetwork צפוי טווח דומה (נירנברג 57, פריז 65, אמסטרדם 63) — הסקה, לא מדידה.
- מיקום הנחיתה המדויק של כל כבל (סיציליה/בארי/כרתים וכו') לא אומת ממקור ראשוני בסבב הזה.

## 2. האם זה בכלל משנה? (משימות רקע, סוכן צ'אט, קריאות API מהאפליקציה, העלאות ל־Drive)

### Takeaway
**למשימות רקע (תמלול, קידוד, העלאה ל־Drive) — ההשהיה לא משנה כמעט כלום.** בכל האתרים שנבדקו, Google (`www.googleapis.com`, דרכו מועלים קבצים ל־Drive) נמצאת **1–6ms** מהשרת, כך שמיקום השרת לא משפיע על מהירות ההעברה שרת↔Drive. לממשק אינטראקטיבי ההבדל 10ms↔60ms מורגש מעט (≈מאות ms בחיבור חדש), אבל קטן מההשהיה **הנוכחית** של השרתון ב־Vercel, שרץ בוושינגטון (~180ms לתשובה ראשונה מישראל). לסוכן צ'אט עם LLM — זמן יצירת הטקסט (שניות) מגמד את ה־RTT.

### Cited Findings
- **Google קרובה לכל מקום**: ping ל־`www.googleapis.com` (08/10/2026): מישראל 1.2–3.8ms (מכשיר אחד, Interhost, 69.7ms — ניתוב חריג); מ־Hetzner פלקנשטיין/נירנברג/אנסבך 3.6–5.8ms; מ־Hetzner הלסינקי 1.1–1.2ms; מ־OVH רובה/דנקרק/גרבלין 4.5–4.9ms — [Globalping](https://api.globalping.io/v1/measurements).
- **השרתון הנוכחי (Vercel)**: הכותרת `x-vercel-id` של `ibkr-proxy-wine.vercel.app/api/*` = `iad1::iad1` (פונקציה באזור ברירת המחדל, וושינגטון); `vercel.json` לא מגדיר `regions`. מישראל (Globalping HTTP, 08/10/2026): TCP 2–14ms (קצה מקומי), **TLS ~120–130ms, תשובה ראשונה 174–193ms** — מדידה עצמית; קובץ התצורה: `ibkr-proxy/vercel.json` בריפו.
- AWS פרנקפורט מישראל: TCP 59ms, תשובה ראשונה 61ms; AWS תל אביב: TCP 3ms, תשובה ראשונה 4ms — [Globalping](https://api.globalping.io/v1/measurements).
- **סלולר**: אתר צד שלישי מציג השהיה ממוצעת לפי ספק — פלאפון 37ms, פרטנר 39ms, סלקום 42ms, HOT 88ms — **בלי תאריך ובלי שיטה, אינדיקטיבי בלבד** — [speedgeo.net](https://www.speedgeo.net/statistics/israel). Opensignal (דוח 12/2025, איסוף 09–11/2025) לא מפרסם השהיה כקטגוריה לישראל — [Opensignal Israel](https://insights.opensignal.com/reports/2025/12/israel/mobile-network-experience).
- **רוחב העלאה ביתי בישראל**: worlddata.info מצטט ממוצע העלאה בסיבים/כבלים של 94.4Mbps (מקום 38, נתוני Speedtest מ־05/2026) — אגרגטור, "ממוצע" ולא חציון, לא אומת מול Ookla — [worlddata.info](https://www.worlddata.info/asia/israel/telecommunication.php); speedgeo.net: ממוצע העלאה 66.9Mbps (04/2025–03/2026) — [speedgeo.net](https://www.speedgeo.net/statistics/israel).

### Inferences
- **העלאת סרטון של כמה GB מהטלפון**: בארכיטקטורה הקיימת (הסטודיו מעלה מהטלפון **ישירות ל־Drive**, והשרת מוריד מ־Drive) — מיקום השרת לא משפיע על ההעלאה מהטלפון בכלל; צוואר הבקבוק הוא רוחב ההעלאה של הסלולר/הסיב (ב־~66–94Mbps: 3GB ≈ 4.5–6.5 דקות; בסלולר יותר). ההורדה Drive→שרת עוברת ברשת של Google, 1–6ms מכל ספק שנבדק.
- אם בעתיד הטלפון יעלה ישירות לשרת: TCP מודרני (BBR/auto-tuning) ממלא קו של מאות Mbps גם ב־60ms; זרם יחיד עם חלון מוגבל עלול להיות מוגבל ב־RTT — העלאה בחתיכות במקביל מבטלת זאת. הסקה הנדסית, לא נמדד.
- **קריאת API מהאפליקציה**: חיבור חדש = TCP + TLS + בקשה ≈ 3 RTT → אירופה ~180ms, תל אביב ~15–25ms; בחיבור חם (keep-alive/HTTP2) — RTT אחד (~60 מול ~5ms). שרת באירופה עדיין **מהיר פי ~3 מה־Vercel הנוכחי (iad1)**.
- **סוכן צ'אט / LLM מקומי**: הזמן עד הטוקן הראשון ומהירות היצירה (מאות ms עד שניות) גדולים פי 10 מההבדל בין 10 ל־60ms; בהזרמה (streaming) הפער לא מורגש.
- **מחירי מניות חיים (כל 2 שניות)**: ההבדל 10↔60ms זניח ביחס למחזור של 2,000ms.

### Gaps
- לא נמדדה תפוקה בפועל (throughput) שרת↔Drive מכל ספק; רק השהיה.
- אין נתון Ookla רשמי ומאומת לחציון ההעלאה הביתית/הסלולרית בישראל ב־2026.

## 3. אמינות: SLA, תקלות 2024–2026, סיכון גאופוליטי

### Takeaway
ה־SLA של ספקי התקציב צנוע ובחלקו "מאמץ סביר": Hetzner Cloud 99.9% (בלי התחייבות קשיחה), OVH VPS 99.9% / שרת ייעודי 99.95–99.99%, Contabo — 99.9% לפי אתרי ביקורת. **הסיכון החדש והממשי של 2026 הוא פיזי־צבאי במזרח התיכון**: במרץ 2026 נפגעו פיזית מרכזי נתונים של AWS באיחוד האמירויות ובבחריין במהלך המלחמה עם איראן, ו־AWS המליצה ללקוחות להעביר עומסים מהאזור. לא נמצא דיווח על פגיעה באזורי הענן בישראל — אבל ענקיות הענן הפועלות בישראל הופיעו ברשימת "מטרות" של כלי תקשורת איראני.

### Cited Findings
- **Hetzner**: יעד זמינות חודשי 99.9% לכל Cloud Server, בניסוח "מאמצים סבירים כלכלית"; חומת אש/מאזן עומסים/גיבויים/תמונות מחוץ להסכם — [Hetzner, Service-Vereinbarung Cloud](https://www.hetzner.com/rechtliches/cloud-server/). תקלות 2025: IPv6 ב־NBG1 (04/03/2025), API/קונסולה (01/03/2025), Object Storage ב־FSN1/NBG1 (03–04/2025) — [IncidentHub](https://incidenthub.cloud/status/hetzner); תקלת עמוד־שדרה פרנקפורט–פלקנשטיין ביוני 2026 — מסיכום חיפוש של אגרגטור, לא אומת. ניטור חיצוני: 99.96% ב־90 יום — [losclouds](https://losclouds.com/status/hetzner) (צד שלישי). אגרגטור אחד סופר 67 תקלות / 178 שעות מאז 04/2025 (כולל תקלות חלקיות בשירותים משניים; מספר רופף) — [pingoru](https://pingoru.io/providers/hetzner/outage-history).
- **OVHcloud**: "כל שרתי OVHcloud — SLA של 99.95%" (Bare Metal) — [OVHcloud, Services included](https://www.ovhcloud.com/en/bare-metal/hosting/services-included/); Scale/High Grade עד 99.99% — [OVHcloud Scale](https://www.ovhcloud.com/en/bare-metal/scale/services-included/); VPS 99.9% לפי אתרי השוואה — [learnwithhasan](https://learnwithhasan.com/self-hosting-hub/vps-providers/ovh-vps/).
- **Contabo**: 99.9% לפי אתרי ביקורת (חלקם: "על חיבור הרשת"); הצהרה עצמית על 99.996% בשנה; אתרים מזהירים מהקצאת יתר (oversubscription) של CPU/RAM — [RamNode comparison](https://www.ramnode.com/ramnode-contabo); [learnwithhasan](https://learnwithhasan.com/vps-providers/contabo-vps/). לא נמצא מסמך SLA רשמי.
- **AWS במפרץ, 2026**: ב־01/03/2026 "חפצים" פגעו במרכז נתונים של AWS באיחוד האמירויות (`ME-CENTRAL-1`, אזור `mec1-az2`), שריפה, ניתוק חשמל — [heise, 02/03/2026](https://heise.de/-11194454). לפי דיווחים מאוחרים: שני מתקנים באיחוד האמירויות נפגעו ישירות, רחפן ליד מתקן בבחריין גרם "השפעה מהותית", נזק מבני + מים מהכיבוי; עד 10/05/2026 שני האזורים "משובשים" ו־AWS "ממליצה בחום" להעביר עומסים — [Capital Brief](https://www.capitalbrief.com/briefing/amazon-services-remain-disrupted-across-middle-east-after-drones-strike-data-centres-1ef13c0d-0e0d-4d30-9ffe-32105d382280/); [Euronews, 12/03/2026](https://euronews.com/next/2026/03/12/data-centres-are-the-new-target-in-modern-warfare-during-iran-war-experts-say).
- **ישראל**: לא נמצא דיווח על פגיעה ב־`il-central-1`, ‏`me-west1` או Azure Israel Central (חיפוש עד אמצע 05/2026). סוכנות Tasnim (מקורבת למשמרות המהפכה) פרסמה רשימת חברות טכנולוגיה בישראל ובמזרח התיכון כ"מטרות" אפשריות, כולל Google ו־Microsoft — [Capacity](https://capacityglobal.com/news/irans-irgc-lists-us-tech-companies-as-targets/). ביוני 2025 טיל איראני פגע ליד פארק הייטק עם משרדי Microsoft בבאר שבע (משרד, לא מרכז נתונים) — [Profit/Pakistan Today, 20/06/2025](https://profit.pakistantoday.com.pk/2025/06/20/iran-strikes-near-microsoft-office-in-beersheba-in-missile-exchange).
- **MedOne**: מצהירה על 25,000 מ"ר מבוצרים תת־קרקעיים, עמידים "בפגיעות טילים, רעידות אדמה והפסקות חשמל", ופעולה מלאה 72 שעות ברציפות בלי אספקה — הצהרת החברה, לא נבדק בעצמאות — [MedOne](https://medone.co.il/articles/built-underground-built-for-uptime-medones-data-center-leadership-in-israel); [DCD](https://www.datacenterdynamics.com/en/news/medone-to-build-two-underground-data-centers-in-israel). לא נמצא דיווח על פגיעה ב־MedOne ב־2025.
- **AWS בישראל**: נפתח ב־2023 עם 3 אזורי זמינות — [AWS blog](https://aws.amazon.com/ko/blogs/korea/now-open-aws-israel-tel-aviv-region); DCD דיווחה ש־AWS "גנזה" תוכניות הרחבה בישראל (הכתבה חסומה לקריאה; כותרת בלבד) — [DCD](https://www.datacenterdynamics.com/en/news/aws-puts-israel-expansion-plans-to-bed-report/).

### Inferences
- לשרת בישראל יש יתרון השהיה (~5 מול ~60ms) אבל חשיפה כפולה בזמן מלחמה: פגיעה פיזית/חשמל + ניתוק כבלים — ובמקרה של ניתוק כבלים גם שרת ישראלי מנותק מ־Google/Anthropic/Drive שבחו"ל. לעומת זאת, שרת באירופה ממשיך לעבוד גם כשישראל מבודדת חלקית (רק הגישה מהטלפון נפגעת).
- למשימות רקע של משתמש יחיד, 99.9% (~43 דקות בחודש) מספיק; גיבוי + יכולת להקים מחדש במהירות חשובים יותר מאחוז ה־SLA.

### Gaps
- לא נמצא SLA רשמי של Kamatera, Netcup ו־Contabo ממקור ראשוני.
- לא נמצאו תקלות גדולות מתועדות של OVH ב־2024–2026 בחיפוש הזה (השריפה הידועה בשטרסבורג היא מ־2021).
- אין מידע ציבורי על התנהגות אזורי הענן בישראל במלחמה עם איראן (06/2025, 03/2026) מעבר להיעדר דיווחי פגיעה.

## 4. חסימות, אימות זהות וסנקציות למשתמש ישראלי

### Takeaway
לא נמצאה עדות שספק אירופי מרכזי (Hetzner, OVH, Contabo, Netcup, Scaleway) חוסם לקוחות ישראלים או כתובות IP ישראליות. Hetzner ידועה בבדיקת הונאות קפדנית לכל הזמנה ראשונה (בכל מדינה) — הימנעות מ־VPN וממייל חינמי, והתאמה בין הפרטים לתעודה ולאמצעי התשלום.

### Cited Findings
- Hetzner: הזמנה ראשונה נבדקת לסבירות; ממליצים לא להירשם דרך VPN ולא עם מייל חינמי; ערעור: `cda-review@hetzner.com` — [Hetzner Fraud prevention FAQ](https://docs.hetzner.com/general/security-and-identify/fraud-prevention-faq/).
- נציג Hetzner בפורום: "איננו דוחים חשבונות רק בגלל מדינה"; דחייה שנייה סופית; לפעמים מוצע אימות בתשלום קטן ב־PayPal במקום תעודה — [LowEndTalk](https://lowendtalk.com/discussion/comment/2785241/); [LowEndTalk](https://lowendtalk.com/discussion/comment/2879718/) (פורום, אנקדוטלי).
- משתמשים ממדינות שונות מדווחים על דחייה גם אחרי הגשת תעודה — אנקדוטלי, ללא קשר מוכח לישראל — [LowEndTalk](https://lowendtalk.com/discussion/comment/2933029/).

### Inferences
- אצל משתמש ישראלי עם כרטיס אשראי בשמו ומייל קבוע (גם Gmail עלול לעורר בדיקה ב־Hetzner) — הסיכון העיקרי הוא דחייה אוטומטית "בלי הסבר", לא חסימה מדינתית. כדאי להחזיק ספק חלופי (OVH/Netcup/Contabo) למקרה כזה.

### Gaps
- לא נמצאו דיווחים ספציפיים של ישראלים על דחייה/אישור ב־Hetzner, Contabo, OVH, Netcup או Scaleway ב־2025–2026, ולא מדיניות סנקציות/חרם רלוונטית אצל ספקים אלה.
- המייל של המשתמש הוא Gmail — לא נבדק אם זה מעורר בדיקה נוספת בפועל אצל Hetzner (ההנחיה הכללית: "עדיף לא מייל חינמי").
