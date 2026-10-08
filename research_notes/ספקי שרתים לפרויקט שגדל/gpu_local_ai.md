# שרת GPU לסוכן AI מקומי (מודל פתוח) — עלויות, ספקים, מודלים ומתי זה משתלם (נכון ל־08/10/2026)

> מקרא: **[מאומת]** = נמשך היום (08/10/2026) ישירות ממקור רשמי של הספק (דף מחירים / קובץ JSON / API ציבורי). **[צד ג׳]** = אתר חדשות, מאגר או מחשבון, לא הספק עצמו. מחירי יורו בלי מע״מ אלא אם צוין אחרת. "24/7 בחודש" = מחיר לשעה × 730.

## 1. שרתי GPU ייעודיים בחיוב חודשי (Hetzner, OVHcloud, Scaleway, Lambda, Verda ואחרים)

### Takeaway
השרת הייעודי הזול ביותר עם GPU של 24GB הוא **Hetzner GEX45** (RTX PRO 4000 Blackwell, ‏24GB): **€212.30 לחודש + €1.70 ל־IPv4 (כ־€214), דמי הקמה €209** [מאומת]. ה־GEX44 הישן (RTX 4000 SFF Ada, ‏20GB) כבר לא מופיע בטבלת ה־GPU של Hetzner. בקפיצה הבאה, 96GB ב־**GEX63 (€997.30 לחודש + הקמה €999)** וב־**GEX131 (€1,497.30 לחודש + הקמה €1,499)**. כרטיס 24GB בענן "רגיל" (OVH L4 או Scaleway L4) עולה €540–575 לחודש, יותר מפי 2.5.

### Cited Findings
**Hetzner (קובץ המחירים החי של האתר, `live_data_prices.json`, נמשך 08/10/2026) [מאומת]:**
- טבלת ה־GPU הנוכחית כוללת שלושה דגמים בלבד, כל אחד עם GPU יחיד, ואי אפשר להרכיב שרת GEX עם כמה GPU — [Hetzner GPU matrix](https://www.hetzner.com/dedicated-rootserver/matrix-gpu/):
  - **GEX45**: ‏RTX PRO 4000 Blackwell SFF, ‏24GB GDDR7, ‏i5-13500, ‏64GB RAM, ‏770 TOPS, הלסינקי (HEL1).
  - **GEX63** (חדש): ‏RTX PRO 6000 Blackwell Max-Q, ‏96GB GDDR7, ‏Core Ultra 7 265, ‏128GB DDR5, הלסינקי.
  - **GEX131**: ‏RTX PRO 6000 Blackwell Max-Q, ‏96GB, ‏Xeon Gold 5412U (24 ליבות), ‏256GB DDR5 ECC, נירנברג/פלקנשטיין.
- המחירים לפי מזהה המוצר בקובץ — [Hetzner live prices JSON](https://www.hetzner.com/_resources/app/data/app/live_data_prices.json):
  - **GEX45 (ROBOT_1768)**: ‏€212.30 לחודש ($247.10), ‏€0.3402 לשעה, הקמה €209 ($249). זמין ב־FSN1, ‏HEL1, ‏NBG1.
  - **GEX63 (ROBOT_1767)**: ‏€997.30 לחודש ($1,197.10), ‏€1.5982 לשעה, הקמה €999 ($1,199).
  - **GEX131 (ROBOT_1747)**: ‏€1,497.30 לחודש ($1,697.10), ‏€2.3995 לשעה, הקמה €1,499 ($1,699).
  - **תוספת IPv4 (ROBOT_1266)**: ‏€1.70 לחודש.
- עיתונות מקצועית מדווחת אותם מספרים ל־GEX45 (כולל IPv4): ‏€214 לחודש והקמה €209 — [IT Brief](https://itbrief.co.uk/story/hetzner-launches-gex45-gpu-server-for-ai-workloads) [צד ג׳].
- GEX63 הוכרז ב־06/10/2026. בהכרזה הוא ממוקם בין GEX45 ל־GEX131 ומיועד ל־AI, רינדור ועיבוד דיבור — [Hetzner pressroom GEX63](https://www.hetzner.com/pressroom/hetzner-expands-gpu-portfolio-with-new-gex63-featuring-nvidia-rtx-pro-6000-blackwell-max-q/) [צד ג׳: סיכום החיפוש].
- **סתירה לגבי GEX44 ו־GEX131 בעבר:**
  - עותק של הודעת המחירים של Hetzner מ־15/06/2026: ‏GEX44-1 ב־€232.30 לחודש והקמה €114; ‏GEX131-1 ב־€1,197.30 והקמה €599 — [prismix mirror](https://prismix.dev/news/e099eaeb0874) [צד ג׳].
  - מדריך שעודכן ב־16/08/2026: ‏GEX44 ב־€184 והקמה €79, ‏GEX131 ב־€889. לטענתו מחירי ה־GPU לא השתנו ביוני — [effloow](https://effloow.com/articles/hetzner-cloud-ai-gpu-server-guide-2026) [צד ג׳, כנראה מיושן].
  - כתבה איטלקית: ‏GEX131 עלה בכ־35% בתשעה חודשים, בגלל מחירי הזיכרון — [pasqualepillitteri](https://pasqualepillitteri.it/en/news/17339/contabo-launches-gpu-vps-999-euros-hetzner-gex131) [צד ג׳].
  - **המחיר החי היום (€1,497.30) גבוה מכל הדיווחים האלה**, כלומר המחירים עלו שוב.
- הודעת המחירים של יוני: מחיר מוגדל חל על הזמנות חדשות מ־15/06/2026; הזמנה שבוצעה לפני כן נשארת במחיר הישן — [prismix mirror](https://prismix.dev/news/e099eaeb0874) [צד ג׳].

**OVHcloud Public Cloud (קטלוג ה־API הציבורי, `order/catalog/public/cloud`, חברת IE, יורו בלי מע״מ, נמשך 08/10/2026) [מאומת — [OVH API catalog](https://eu.api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=IE)]:**

| דגם | GPU | RAM | לשעה | חודשי (התחייבות) |
|---|---|---|---|---|
| ‏`l4-90` | ‏L4 24GB, ‏22 vCore | 90GB | €0.75 | €540 |
| ‏`l40s-90` | ‏L40S 48GB, ‏15 vCore | 90GB | €1.40 | €1,008 |
| ‏`a100-180` | ‏A100 80GB | 180GB | €2.75 | €1,100 |
| ‏`h100-380` | ‏H100 80GB | 380GB | €2.80 | €1,940 |
| ‏`rtx5000-28` | ‏Quadro RTX 5000 16GB | 28GB | €0.36 | — |
| ‏`t1-45` | ‏V100 16GB | 45GB | €0.70 | €504 |

- אי אפשר לעבור מחיוב חודשי לחיוב שעתי — [OVH L4 page](https://www.ovhcloud.com/en/public-cloud/gpu/l4/).

**Scaleway (פריז) [מאומת — [Scaleway GPU pricing](https://www.scaleway.com/en/pricing/gpu/)]:**
- ‏L4-1-24G (‏8 vCPU, ‏48GB RAM): ‏€0.79 לשעה, כ־€574.87 לחודש.
- ‏L40S, ‏H100 ו־B300 מסומנים "לא זמין באזור הזה" ב־PAR-1, ולכן לא נמשך מחיר עבורם.

**Lambda (on-demand, ‏GPU יחיד, דולר לשעה) [מאומת — [Lambda pricing](https://lambda.ai/pricing)]:**
- ‏A6000 48GB:‏ $1.09 (‏24/7 ≈ $796 לחודש).
- ‏A10 24GB:‏ $1.29.
- ‏GH200 96GB:‏ $2.29.
- ‏H100 PCIe:‏ $3.29.
- ‏H100 SXM:‏ $4.29.
- ‏B200:‏ $6.99.

**Verda (לשעבר DataCrunch) [צד ג׳]:**
- לפי computeprices (עדכון 04/08/2026): ‏RTX PRO 6000 ב־$1.89 לשעה on-demand או $0.661 ב־spot; ‏L40S ב־$1.37 on-demand או $0.479 ב־spot — [computeprices Verda RTX PRO 6000](https://computeprices.com/providers/verda/gpus/rtx-pro-6000), [computeprices Verda L40S](https://computeprices.com/providers/verda/gpus/l40s).
- סתירה: ‏Beam מציג RTX PRO 6000 ב־$1.98 on-demand או $0.99 ב־spot (בלי תאריך) — [Beam blog](https://www.beam.cloud/blog/nvidia-rtx-pro-6000-pricing).

**ענני ההיפר־סקיילרים בישראל:**
- Google Cloud ‏me-west1 (תל אביב), לפי טבלת ה־GPU הרשמית: ‏me-west1-a מציע A2 (‏A100), ‏me-west1-b מציע N1+T4, ‏me-west1-c מציע את שניהם — [Google GPU regions](https://cloud.google.com/compute/docs/gpus/gpu-regions-zones) [צד ג׳: סיכום החיפוש, הטבלה לא נקראה ישירות].
- AWS ‏il-central-1: לא נמצאה רשימה עדכנית של סוגי GPU באזור. בהשקה הוזכרו G5, ו־P4de בתצוגה מקדימה בלבד — [AWS launch blog](https://aws.amazon.com/blogs/aws/now-open-aws-israel-tel-aviv-region) [מיושן].

### Inferences
- מחיר שנה ראשונה עם דמי ההקמה:
  - GEX45: ‏€214×12 + €209 ≈ **€2,777** (≈ €231 לחודש).
  - GEX63: ‏€999×12 + €999 ≈ **€12,987**.
- להשוואה, ‏24GB ב־OVH L4 עולה €6,480 בשנה, ו־48GB ב־L40S עולה €12,096 בשנה.
- כלומר Hetzner GEX45 זול פי 2.5 בערך מכל ענן מוכר עם GPU דומה. החסרונות: דמי הקמה גבוהים (כמעט חודש שלם), והמיקום בהלסינקי (רחוק מישראל יותר מפרנקפורט — לא נמדד כאן).
- **GEX63 החדש (96GB ב־€999) מתחרה במחיר בשוק השעתי** (RTX PRO 6000 ב־Vast במחיר חציוני: כ־$1,032 לחודש), עם יתרון של שרת ייעודי פרטי.
- **תוכנית שדרוג**: אפשר להתחיל בשרת CPU של Hetzner ולהוסיף GEX באותה רשת. Hetzner מציעה vSwitch בין שרתים ייעודיים, ו־OVH מציעה vRack. **לא אומת כאן** ש־GEX45 ו־GEX63 תומכים ב־vSwitch, ושני ה־GEX הזולים יושבים רק בהלסינקי (GEX45 גם ב־FSN/NBG). לבדוק מול Hetzner לפני ההזמנה.

### Gaps
- לא נבדקו עמודי המחירים של Vultr, ‏Genesis Cloud, ‏Kamatera (ואם יש לה GPU בישראל), ‏Paperspace ו־TensorDock.
- המחירים של AWS ו־Azure בישראל לא נמשכו.
- לא נמצא מקור רשמי ל־GEX44: אם עדיין אפשר להזמין אותו ובאיזה מחיר.
- בשרת שמוזמן מחוץ לאיחוד: לא נבדק אם Hetzner ו־OVH גובות מע״מ מלקוח פרטי מישראל.

## 2. GPU לפי שעה ושווקים (RunPod, ‏Vast.ai, ‏Serverless)

### Takeaway
להתפרצויות של שעה־שעתיים, ה־GPU הזמין והזול ביותר הוא בשווקים:
- **RTX 4090 ב־$0.34–0.48 לשעה**.
- **RTX 5090 ב־$0.46–0.80**.
- **RTX PRO 6000 (96GB) ב־$1.1–1.7**.
- **H100 ב־$2.0–2.7**.

אבל שכירות 24/7 בשוק עולה **כמו שרת ייעודי ויותר**: RTX 4090 ב־RunPod Community עולה כ־$248 לחודש, ו־RTX PRO 6000 עולה כ־$1,000–1,230. ‏Serverless כדאי רק לעומס נמוך ולא רציף.

### Cited Findings
**RunPod Pods, ‏Community / Secure, דולר לשעה [מאומת — [RunPod pricing](https://www.runpod.io/pricing)]:**
- ‏RTX 4090:‏ $0.34 / $0.74.
- ‏RTX 5090:‏ $0.69 / $0.99.
- ‏L4:‏ $0.44 / $0.49.
- ‏L40S:‏ $0.79 / $1.09.
- ‏RTX 6000 Ada:‏ $0.74 / $0.84.
- ‏RTX PRO 6000:‏ $1.69 / $2.09.
- ‏A100 80GB PCIe:‏ $1.19 / $1.59.
- ‏A100 80GB SXM:‏ $1.39 / $1.59.
- ‏H100 PCIe:‏ $1.99 / $2.89.
- ‏H100 SXM:‏ $2.69 / $3.49.

**RunPod Serverless, דולר לשעה [מאומת, אותו מקור]:**
- ‏L4:‏ $0.69.
- ‏RTX 4090:‏ $1.10.
- ‏RTX 5090:‏ $1.58.
- ‏L40S:‏ $1.75.
- ‏RTX 6000 Ada:‏ $1.75.
- ‏A100 80GB:‏ $2.72.
- ‏RTX PRO 6000:‏ $3.49.
- ‏H100:‏ $4.79.
- הדף מאפשר תצוגה לשנייה, אבל המספרים לשנייה לא נמשכו.

**Vast.ai — הצעות חיות דרך ה־API הציבורי (`console.vast.ai/api/v0/bundles`), ‏08/10/2026 [מאומת]:**
- הסינון: ‏GPU יחיד, מארח מאומת, on-demand. המחיר הוא `dph_total` (כולל אחסון ברירת מחדל) — [Vast.ai](https://vast.ai/pricing).

| GPU | מספר הצעות | מינימום | רבעון תחתון | חציון | חציון × 730 |
|---|---|---|---|---|---|
| RTX 3090 (24GB) | 28 | $0.143 | $0.177 | $0.230 | ≈ $168 |
| RTX 4090 (24GB) | 41 | $0.377 | $0.416 | $0.482 | ≈ $352 |
| RTX 5090 (32GB) | 44 | $0.462 | $0.654 | $0.802 | ≈ $585 |
| RTX 6000 Ada (48GB) | 6 | $0.539 | $0.539 | $0.616 | ≈ $450 |
| L40S (48GB) | 1 | $0.801 | — | $0.801 | ≈ $585 |
| A100 SXM4 | 12 | $0.472 | $0.668 | $0.830 | ≈ $606 |
| RTX PRO 6000 WS (96GB) | 17 | $1.136 | $1.336 | $1.414 | ≈ $1,032 |
| H100 SXM (80GB) | 5 | $2.043 | $2.136 | $2.269 | ≈ $1,657 |

- מחירי Vast נקבעים בשוק, לא על ידי Vast — [Vast.ai pricing](https://vast.ai/pricing).
- מעקב מחירים מציג RTX PRO 4000 Blackwell ב־$176.01 לחודש (24/7) אצל הספק הזול ביותר — [flopper.io](https://flopper.io/pricing/nvidia-rtx-pro-4000-blackwell-24gb) [צד ג׳].

### Inferences
**שווה ערך חודשי ל־24/7 (× 730):**
- ‏RunPod Community:
  - 4090 ≈ $248.
  - 5090 ≈ $504.
  - L40S ≈ $577.
  - RTX PRO 6000 ≈ $1,234.
  - H100 PCIe ≈ $1,453.
- ‏RunPod Secure 4090 ≈ $540.

**מסקנות:**
- ‏GEX45 של Hetzner (‏≈ $249 לחודש, ‏24GB) **שווה ל־4090 של RunPod Community**, ובנוסף הוא שרת פרטי, יציב ובלי שכנים. לכן לסוכן שרץ כל הזמן עדיף ייעודי, ולהתפרצויות עדיף שוק שעתי.
- **התפרצויות תמלול (Whisper/Qwen ASR) או קידוד וידאו**: שעת 4090 או 5090 עולה ‎$0.35–0.80. גם 30 שעות בחודש הן ‎$10–25, הרבה פחות משרת ייעודי.
- ב־RunPod, ‏Serverless יקר פי 2–3 מ־Pod לשעה. הוא משתלם רק כשהעומס לא רציף, ואז משלמים רק על שניות העבודה.

### Gaps
- לא נבדקו המחירים העדכניים של Salad, ‏Modal ו־TensorDock.
- זמני "התנעה קרה" ב־Serverless (טעינת מודל של 20GB+) לא נמדדו.
- זמינות לאורך זמן ויציבות של מארחי Vast לא נבדקו.

## 3. אילו מודלים פתוחים (עם עברית טובה) רצים על איזה GPU, ובאיזו מהירות

### Takeaway
**‏24GB מספיק לסוכן שימושי** אם בוחרים מודל MoE בגודל ~30–35B בכימות Q4. לדוגמה:
- **Qwen 3.5/3.6 35B-A3B**: הערכה של כ־60–75 טוקנים לשנייה על 4090 (מחשבון, לא מדידה), ומדידה של משתמש: 112 טוקנים לשנייה על 3090.
- **Gemma 4 26B-A4B**.
- המודל העברי הייעודי: **DictaLM 3.0 24B**.

‏20GB (‏GEX44 הישן) צמוד מדי, ולפי מדריך אחד מגביל ל־~14B. ‏96GB (‏GEX63/GEX131) פותח מודלים צפופים של 70B+ ו־MoE של ~120B. מודלי הדגל הפתוחים הגדולים ביותר (DeepSeek V4 Flash, ‏284B) **לא נכנסים לשרת יחיד בתקציב הזה**.

### Cited Findings
**מודלים עבריים:**
- **DictaLM 3.0** (דיקטה, ישראל) ב־3 גדלים — [Gadgety](https://www.gadgety.co.il/354176/dicta-lm-3-launched/), [featherless DictaLM-3.0-24B](https://featherless.ai/models/dicta-il/DictaLM-3.0-24B-Base) [צד ג׳]:
  - ‏24B, מבוסס Mistral Small 3.1.
  - ‏12B, מבוסס Nemotron Nano V2 (‏Hybrid-SSM).
  - ‏1.7B, מבוסס Qwen3.
  - חלון ההקשר: ‏65K לפי Gadgety, אבל ‏32–40K לפי featherless — סתירה.
- **דוח DictaLM 3.0** (פברואר 2026, מדידות של דיקטה עצמה) — [arXiv 2602.02104](https://arxiv.org/abs/2602.02104v1):
  - ‏DictaLM-3.0-24B-Thinking מול gemma3-27B-it: סיכום 56.86 מול 44.54, תרגום 30.09 מול 26.73, טריוויה 60.13 מול 45.51, ניקוד 86.86 מול 60.21.
  - ‏Gemma 3 מנצח ב־Winogrande.
  - ‏Qwen3-14B (thinking) קיבל 0.90 בתרגום ו־4.73 בניקוד במבחני דיקטה.
  - לא נמצא מקור ניטרלי שמשווה את Qwen 3.5/3.6 ואת Gemma 4 בעברית.
- הלוח העברי (Hebrew LLM Leaderboard של מפא״ת ודיקטה) בודק מודלי בסיס ב־few-shot — [Hebrew leaderboard](https://hebrew-llm-leaderboard-leaderboard.hf.space/), [HF blog](https://github.com/huggingface/blog/blob/main/leaderboard-hebrew.md).

**מודלים פתוחים זמינים (לפי רשימת המודלים החיה של OpenRouter, ‏08/10/2026) [מאומת — [OpenRouter models API](https://openrouter.ai/api/v1/models)]:**
- ‏Qwen: ‏qwen3.5-35b-a3b, ‏qwen3.6-35b-a3b, ‏qwen3.5/3.6-27b, ‏qwen3.5-122b-a10b, ‏qwen3.5-397b-a17b.
- ‏Gemma: ‏gemma-4-26b-a4b-it, ‏gemma-4-31b-it.
- ‏Mistral: ‏mistral-small-2603.
- ‏Llama 4: ‏Scout, ‏Maverick.

**DeepSeek V4 Flash:**
- ‏284B פרמטרים בסך הכל, ‏13B פעילים — [Simon Willison](https://simonwillison.net/2026/apr/24/deepseek-v4) [צד ג׳].
- ‏V4.1 Flash (ספטמבר 2026): כ־748B בסך הכל, לפי מקור יחיד — [ProPakistani](https://propakistani.pk/2026/09/11/deepseek-v4-1-flash-launches-with-lower-prices-and-native-vision/) [צד ג׳].
- תיעוד DeepSeek: השמות הישנים `deepseek-v4-flash` מנותבים היום ל־DeepSeek-V4.1-Flash — [DeepSeek API docs](https://api-docs.deepseek.com/quick_start/pricing) [מאומת].

**מהירות וזיכרון:**
- **Qwen 3.5 35B-A3B על RTX 4090**:
  - מחשבון מעריך ≈ 71 טוקנים לשנייה ב־Q4_K_M (‏63–75 לפי המשימה), ולפיו צריך ~26–29GB, כלומר גלישה חלקית ל־RAM. האתר סותר את עצמו בדרישת הזיכרון — [willitrunai](https://willitrunai.com/es/can-run/qwen-3.5-35b-a3b-on-rtx-4090-24gb) [צד ג׳, הערכה].
  - אותו מחשבון: על 5090 ≈ 139 טוקנים לשנייה [צד ג׳, הערכה].
  - דיווח משתמש: 112 טוקנים לשנייה על 3090 משומש, עם הקשר מלא של 262K — [Medium](https://agentnativedev.medium.com/qwen-3-5-35b-a3b-why-your-800-gpu-just-became-a-frontier-class-ai-workstation-63cc4d4ebac1) [צד ג׳].
- **GEX44 (‏RTX 4000 SFF Ada, ‏280GB/s)** — תקרות מחושבות (רוחב פס ÷ גודל המשקלות), לא מדידות — [effloow](https://effloow.com/articles/hetzner-cloud-ai-gpu-server-guide-2026) [צד ג׳]:
  - מודל 8B: ~57 טוקנים לשנייה.
  - מודל 14B: ~31 טוקנים לשנייה.
  - מודל 32B ב־Q4 לא נכנס ל־20GB.
  - לפי המדריך, 14B הוא "נקודת האיזון" ב־20GB.
- **CPU בלבד (llama.cpp)**:
  - Qwen3-30B-A3B על EPYC 9454P (‏48 ליבות): כ־63 טוקנים לשנייה — [llama.cpp issue #19480](https://github.com/ggml-org/llama.cpp/issues/19480) [צד ג׳].
  - על i7-8700 עם DDR4 דו־ערוצי: כ־10.6 טוקנים לשנייה — [inventivehq](https://inventivehq.com/blog/moe-on-cpu-benchmark) [צד ג׳].
  - Qwen3-Coder-Next (‏80B, ‏3B פעילים) על DDR5-5600 דו־ערוצי: 7.7 טוקנים לשנייה, פי 3–4 מתחת לתחזית רוחב הפס — [llama.cpp issue #19480](https://github.com/ggml-org/llama.cpp/issues/19480) [צד ג׳].
  - הערכה: במופעי ענן עם CPU יש לצפות ל"ספרה אחת של טוקנים לשנייה" — [effloow](https://effloow.com/articles/hetzner-cloud-ai-gpu-server-guide-2026) [צד ג׳].

### Inferences
**התאמה לפי זיכרון GPU (הערכה גסה: ‏Q4 ≈ 0.55–0.6 בייט לפרמטר, ועוד זיכרון ל־KV cache):**
- **‏20GB**: מודל צפוף עד ~14B, או MoE קטן. סוכן בסיסי בלבד; הקשר ארוך יידחק.
- **‏24GB (‏GEX45, ‏4090)**: אחת מהאפשרויות הבאות:
  - ‏Gemma 4 26B-A4B ב־Q4 (~15–16GB), עם מקום להקשר.
  - ‏DictaLM 3.0 24B ב־Q4 (~14GB).
  - ‏Qwen 35B-A3B ב־Q4 — גבולי, ייתכן שיצטרך גלישה חלקית ל־RAM או Q3.
  - **זו נקודת הכניסה הסבירה לסוכן עברי שימושי.**
- **‏32GB (‏5090)**: ‏Qwen 35B-A3B ב־Q4 נכנס בנוחות עם הקשר.
- **‏48GB (‏L40S, ‏RTX 6000 Ada)**: מודלים צפופים 27–31B ב־Q8, או MoE בגודל ~35B עם הקשר ארוך.
- **‏96GB (‏GEX63/GEX131, ‏RTX PRO 6000)**: ‏Qwen 3.5 122B-A10B ב־Q4 (~65–70GB), או מודל צפוף 70B ב־Q8.
- **‏DeepSeek V4 Flash** (‏284B, כ־160GB ב־Q4) דורש כמה GPU או CPU עם RAM ענק. לא מעשי בתקציב הזה.

**איכות מול מהירות:**
- מודלים פתוחים של 24–35B **לא ברמה של Claude Sonnet** לעבודה של סוכן (כלים, תכנון ארוך). הם מתאימים למשימות שגרתיות: סיכום, סיווג, תרגום בסיסי.
- בעברית ספציפית, הנתונים הקיימים (של דיקטה עצמה) מצביעים על **DictaLM 3.0 24B כחזק מ־Gemma 3 27B**. לא נמצאה השוואה ל־Gemma 4 או ל־Qwen 3.6.
- **CPU בלבד** בשרת ייעודי עם DDR5 דו־ערוצי (כמו רוב שרתי EX של Hetzner) צפוי לתת כ־5–20 טוקנים לשנייה עם MoE בגודל ~30B. זה מספיק לסוכן אסינכרוני איטי, לא לשיחה. שרת EPYC רב־ערוצי מגיע ל־~60 טוקנים לשנייה.

### Gaps
- לא נמצאו מדידות llama.cpp או vLLM אמיתיות על RTX PRO 4000 Blackwell (‏GEX45) ועל RTX PRO 6000 Max-Q.
- לא נמצאו מדידות לתמלול עברי (Whisper large-v3 / Qwen3-ASR): פי כמה GPU מאיץ לעומת CPU, ובאיזה זמן לכל שעת אודיו.
- לא נמצא מבחן עברי עצמאי של Qwen 3.5/3.6, ‏Gemma 4 ו־Llama 4.
- לא נבדקו קובצי GGUF בפועל: גודל מדויק לכל כימות.

## 4. מחיר: שרת GPU 24/7 מול תשלום לפי טוקן ב־API (‏1–5 מיליון טוקנים ביום)

### Takeaway
בשימוש צנוע (‏1–5 מיליון טוקנים ביום), **API זול (DeepSeek V4.1 Flash, ‏Gemma 4 31B, ‏Qwen Flash, ‏Claude Haiku 5.5) עולה כ־$5–40 לחודש**. שרת GPU מינימלי (‏GEX45) עולה כ־$250 לחודש, ועוד €209 הקמה. **אירוח עצמי לא משתלם כלכלית** מול מודלים זולים. הוא משתלם רק מול מודל יקר כמו Sonnet, ורק אם מודל פתוח קטן באמת מחליף אותו באיכות, או מסיבות של פרטיות ושליטה.

### Cited Findings
**מחירי OpenRouter החיים (דולר למיליון טוקנים, קלט/פלט), ‏08/10/2026 [מאומת — [OpenRouter models API](https://openrouter.ai/api/v1/models)]:**
- ‏deepseek-v4.1-flash:‏ $0.028 / $1.00 (‏batch:‏ $0.112 / $0.336).
- ‏deepseek-v4-pro:‏ $0.292 / $0.585.
- ‏gemma-4-31b-it:‏ $0.09 / $0.34 (יש גם גרסה חינמית `:free`).
- ‏gemma-4-26b-a4b-it:‏ $0.09 / $0.30.
- ‏qwen3.6-35b-a3b:‏ $0.15 / $1.00.
- ‏qwen3.7-flash:‏ $0.03 / $0.13.
- ‏mistral-small-2603:‏ $0.15 / $0.60.
- ‏claude-haiku-5.5:‏ $0.10 / $0.50.
- ‏claude-sonnet-5.5:‏ $2.00 / $10.00.
- ‏gemini-3.8-flash:‏ $0.75 / $3.75.
- ‏gemini-3.1-flash-lite:‏ $0.25 / $1.50.

**DeepSeek ישירות:**
- ‏V4.1 Flash: מטמון $0.003, בלי מטמון $0.15, פלט $0.60 בשעות שפל; בשעות שיא — כפול — [ProPakistani](https://propakistani.pk/2026/09/11/deepseek-v4-1-flash-launches-with-lower-prices-and-native-vision/) [צד ג׳, מקור יחיד].
- ‏V4 Flash המקורי: ‏$0.14 / $0.28 — [Simon Willison](https://feeds.simonwillison.net/2026/Apr/24/deepseek-v4/) [צד ג׳].

### Inferences
**תרחיש סוכן: 5 מיליון טוקנים ביום = 4 מיליון קלט ומיליון פלט (בלי הנחת מטמון):**

| מודל (OpenRouter) | עלות ליום | עלות לחודש |
|---|---|---|
| DeepSeek V4.1 Flash | 4×0.028 + 1×1.00 ≈ $1.11 | **≈ $34** |
| Gemma 4 31B | ≈ $0.70 | **≈ $21** |
| Qwen 3.6 35B-A3B | ≈ $1.60 | **≈ $48** |
| Claude Haiku 5.5 | ≈ $0.90 | **≈ $27** |
| Claude Sonnet 5.5 | ≈ $18 | **≈ $540** (פחות עם מטמון הנחיות) |

- **בתרחיש של מיליון טוקנים ביום** כל המספרים קטנים פי 5: מודלים זולים ‎$4–10 לחודש, ‏Sonnet כ־$108.

**שרת GPU מול API:**
- **GEX45 ‏(≈ $249 לחודש + $249 הקמה)** מול אותו מודל פתוח דרך API (‏Gemma 4 או Qwen 35B-A3B, ‏$21–48 לחודש): **השרת יקר פי 5–12**.
- נקודת האיזון מול Gemma 4 31B היא בערך **‏30–60 מיליון טוקנים ביום**.
- כדי לייצר מיליון טוקני פלט ביום מספיק קצב ממוצע של כ־12 טוקנים לשנייה, ו־24GB יכול. אבל ‏10 מיליון פלט ביום דורשים כ־116 טוקנים לשנייה ברציפות, וזה כבר על גבול GPU יחיד גם עם batching.
- **מול Sonnet (≈ $540 לחודש ב־5 מיליון ביום), שרת GEX45 זול פי 2.** אבל זו לא השוואה הוגנת באיכות: מודל של 24–35B לא מחליף את Sonnet בעבודה של סוכן.

**מתי אירוח עצמי כן מוצדק:**
1. **פרטיות**: נתונים שאסור להוציא לצד ג׳. רלוונטי לפרויקט, שמקפיד על פרטיות לפי CLAUDE.md, סעיף 3.
2. עומס גדול מאוד וקבוע (עשרות מיליוני טוקנים ביום).
3. צורך במודל מותאם (fine-tune / LoRA) שאין ב־API.
4. אותו GPU משרת גם תמלול וקידוד.

**ההמלצה המעשית:**
- סוכן "תמיד דולק" על **שרת CPU זול** (התזמור, הכלים, התור) שקורא ל־API זול.
- **GPU שעתי (RunPod/Vast, ‏$0.35–0.80 לשעה)** רק להתפרצויות תמלול או קידוד.
- שדרוג ל־GEX45 או GEX63 כשהעומס או הפרטיות מצדיקים.

### Gaps
- לא נבדק מחיר התמלול ב־API (‏Whisper / ‏Gemini / ‏Deepgram) מול GPU שעתי.
- לא נבדקו ההנחות של OpenRouter על מטמון הנחיות למודלים הפתוחים.
- לא נבדקה תעריפי שעות השיא של DeepSeek מול שעון ישראל.
- לא נבדקה צריכת החשמל ותעבורת הרשת. ב־Hetzner התעבורה ללא הגבלה ב־1Gbit/s, לפי [Hetzner GEX63 page](https://www.hetzner.com/dedicated-rootserver/gex63/) [צד ג׳: סיכום החיפוש].
