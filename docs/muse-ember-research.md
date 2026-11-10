# Muse Ember (Meta) — מחקר: חיבור כספק API נוסף לצד Claude (10/11/2026)

> נבדק יום אחרי ההכרזה (9/11/2026). המודל חדש מאוד, ונתונים עלולים להשתנות. מספרים שלא מצוינים כ"רשמי" הם מדידות של צד שלישי או הערכות.

## השורה התחתונה
1. **אפשר, והחיבור בקוד זול.** ל־Meta Model API יש נקודת קצה תואמת ל־Messages של Anthropic (‏`POST /v1/messages`). העובד יכול להמשיך עם אותה ספריית `anthropic`: ‏`Anthropic(base_url='https://api.meta.ai', auth_token=MODEL_API_KEY)`. הכלל ב־`translator/llm.py` ("ספק חדש = מתודה אחת ב־Engine") מתקיים כמעט כלשונו, חוץ מכמה שדות שצריך לסנן (הטבלה למטה).
2. **השער הוא העברית, לא הקוד.** אין שום מדידה פומבית של המודל בעברית או בתרגום, ו־Meta לא פרסמה רשימת שפות. לפי הכלל שב־`llm.py`, ספק חדש נכנס רק אחרי מבחן TED (‏DeepSeek V4 Pro נכשל ב־8/10). גם למשפחה הקודמת של Meta, ‏Llama 4, אין תמיכה רשמית בעברית (`translator/research/Llama 4 מול DeepSeek לתרגום לעברית.md`).
3. **החיסכון אמיתי אבל קטן בכסף.** המחיר לטוקן **זהה** ל־Haiku 5.5 (‏$0.10 קלט, ‏$0.50 פלט). היתרון בא רק מכך שהמודל חושב פחות: לפי Artificial Analysis הוא מוציא כשליש מטוקני הפלט של Haiku 5.5 במאמץ max. אצלנו **הפלט הוא בעיקר חשיבה** (‏tl ‏80–89%, ‏rv ‏98–99% — `docs/studio-learning.md`). לכן, אם היחס נשמר גם בעברית ובמאמץ medium/high, פרק שעולה היום $0.084–0.112 עשוי לרדת לבערך $0.03–0.05. זו הערכה שלא נמדדה. מול תור החיסכון של Haiku (חצי מחיר) הפער קטן יותר, כי ל־Meta אין תור מנות. מצד שני, Ember עונה בזמן אמת, בלי ההמתנה של התור.

## עובדות המודל
| נושא | ערך |
|---|---|
| מזהה | `muse-ember-1.0` (רשמי). ב־OpenRouter: ‏`meta/muse-ember` |
| סוג | קנייני, המשקולות וגודל המודל לא פורסמו. ‏Meta Superintelligence Labs |
| הקשר / פלט | ‏1,048,576 / ‏524,288 טוקנים (חלק מהמקורות כותבים 512K) |
| קלט | טקסט, תמונה, אודיו, וידאו, PDF (‏AA מאשרת רק טקסט ותמונה). פלט — טקסט |
| מאמץ חשיבה | ‏minimal עד max, וברירת המחדל max. ב־Messages עוברים ‏low/medium/high/xhigh, ולכן **תמיד לקבע effort מפורשות** (כמו היום) |
| מחיר עד 200K קלט | קלט $0.10 · מטמון $0.004 · פלט $0.50 למיליון (רשמי) |
| מחיר מעל 200K | ‏$0.30 · ‏$0.012 · ‏$1.50. **כל הבקשה** עוברת לכרטיס היקר, והמטמון נספר בסף (רשמי). אצל Haiku 5.5 הסף הוא 100K, והכרטיס היקר פי 5 |
| הנחות | אין תור מנות (batch) ואין flex. מצב Contributor (זול, שבו Meta משתמשת בתוכן) **לא קיים ל־Ember** |
| מגבלות קצב | ‏3,000 בקשות ו־4M טוקנים לדקה, לכל צוות (רשמי) |
| גישה | ‏Meta Model API (‏dev.meta.ai), ‏Muse Code, ‏OpenRouter, ‏Oracle Cloud, ‏Google Vertex (תצוגה מקדימה) |

## ביצועים — מה הגרף מהציוץ אומר ומה לא
- **מדד האינטליגנציה של AA (גרסה 5)**: ב־max ‏36 ב־$0.14 למשימה, ב־xhigh ‏34 ב־$0.12. ‏Haiku 5.5 ב־max: ‏36 ב־$0.41. בלי עיגול Haiku מעט גבוה יותר (36.2 מול 35.8, לפי הגרף של Meta עצמה).
- **טוקני פלט בהרצת המדד**: ‏115M מול 298M של Haiku. ‏AA מגדירה אותו "קצת מפטפט" ביחס לחציון של קבוצת המחיר שלו (97M).
- **חוזקות**: AutomationBench ‏37.8 מול 13.9 (Haiku); ‏Terminal-Bench 4.0 ‏40.9 מול 32.8; שיעור הזיות 17.4%, חצי משל Haiku.
- **חולשות**: **ידע עולם** — ב־AA-Omniscience ‏21.1% מול 34.7% של Haiku, ומסרב לענות על 64% מהשאלות. זה רלוונטי לתרגום של שמות, ניבים והקשר תרבותי. ‏FrontierCode ‏27.2 מול 34.9. שותף בגישה מוקדמת (Arnica) דיווח על "מכריז שסיים מוקדם מדי" ועל 4 קריאות שנכשלו מתוך 24,416. במבחן של Simon Willison רמת high לא החזירה SVG שלם.
- **מה הגרף לא מודד**: הוא ממוצע של סוכנים, קוד וידע. אין בו תרגום ואין בו עברית, ולכן הוא לא מנבא את האיכות אצלנו.

## התאימות ל־`translator/llm.py` — מה עובר ומה צריך לשנות
| מה אנחנו שולחים היום | ב־Meta (‏`/v1/messages`) | מה לעשות |
|---|---|---|
| ‏`system` כמערך text עם `cache_control` (ttl) | ‏system נתמך. ‏`cache_control` לא מתועד | לבדוק בקריאה אחת. אם נדחה — לא לשלוח אותו. המטמון נראה אוטומטי: יש מחיר cached ושדה `cache_read_input_tokens` |
| ‏`thinking: adaptive` | נתמך | — |
| ‏`thinking: disabled` (‏`no_think`, שבירת שורות) | **HTTP 400** | במקום זה `effort: low` |
| ‏`output_config.effort` / ‏`format` (‏json_schema) | נתמכים | — |
| ‏`extra_body.diagnostics` | שדה עליון לא מוכר → **400** | לא לשלוח לספק הזה |
| ‏Message Batches (‏`BATCH_KEYS`) | לא קיים | זמן אמת בלבד |
| ‏`count_tokens` | ‏`POST /v1/messages/count_tokens` | — |
| ‏citations | לא מתועד | לבדוק לפני שימוש |
| שגיאות | אותה מעטפה ואותם סוגים (400/401/403/404/429/503) | המיפוי הקיים עובד |
| ‏usage | ‏input/output/cache_read + `output_tokens_details.thinking_tokens`, בלי cache_creation | פונקציית עלות חדשה. ‏`CARD_LIMIT` ‏200K |
| אימות | ‏`Authorization: Bearer` (לא `x-api-key`) | ‏`auth_token=` בספרייה |

## פרטיות ותנאים
- **Standard**: לפי Meta התוכן לא משמש לאימון. Contributor לא קיים ל־Ember, וזה טוב.
- **תקופת השמירה לא פורסמה.** ‏ZDR ניתן רק דרך מכירות, לחשבונות שמתאימים. דרך OpenRouter חלה המדיניות של OpenRouter.
- מה יעבור ל־Meta: תמלולים של הסרטונים וההרצאות שהמשתמש מתרגם. **אף פעם לא נתוני Invest.**
- המפתח (`MODEL_API_KEY`) מטופל כמו `ANTHROPIC_API_KEY`: רק במשתני הסביבה של המכונה או בכספת. לא בריפו, לא בלוג ולא בדיווח לשרתון.
- זמינות בישראל ואמצעי התשלום לא פורסמו — לבדוק בהרשמה. פתיחת חשבון בתשלום = אישור כסף (CLAUDE.md סעיף 10).

## התוכנית המומלצת (כל שלב מותנה בקודם)
0. **מבחן TED** (צריך אישור כסף, תקרה של כ־$2): ‏`translator/tools/mt_bench.py` דרך OpenRouter — ‏`run meta/muse-ember --effort medium` ואז `--effort high`, ‏`check`, שני השופטים, ‏`report`, ו־`sample` (20 שורות עיוורות שהמשתמש בודק בעין). **קריטריון**: לא יותר שגיאות מהותיות מ־Haiku 5.5 באותו מאמץ, אפס תווים זרים ו־tr-check נקי.
1. **עבר** → חיבור במצב "לבדיקות" (למנהל בלבד, כמו `sonnet-low`):
   - ‏provider ‏`meta` ב־`Engine`.
   - מצבים `ember-medium`/`ember-high` **בשלושת הקטלוגים** (‏`llm.py` ↔ השרתון ↔ `studio.js`), ובנוסף STRINGS he/en.
   - השופט נשאר Haiku High, כדי שהציונים יישארו ברי השוואה.
   - העיקרון "מודל אחד לכל עבודה" נשמר: Ember הוא מצב נפרד, לא נפילה מ־Claude.
2. **סט הזהב והשוואה במאגר הלמידה** (`tools/learn-vs-human.py`) על 5–10 פרקים אמיתיים.
3. רק אחרי זה — אופציה למשתמשים, או ברירת מחדל.
- **הזדמנות נוספת**: לשונית ניתוח הסרטונים משתמשת באותו בורר מודלים, ו־Ember מקבל וידאו ואודיו ישירות. זה דורש מבחן נפרד.

## מקורות
- רשמי: [הבלוג למפתחים](https://dev.meta.ai/resources/blog/build-with-muse-ember) · [מחירים ומגבלות](https://dev.meta.ai/docs/pricing-rate-limits) · [Messages API](https://dev.meta.ai/docs/protocols/messages) · [API reference](https://dev.meta.ai/docs/api-reference) · [ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) · [הכרזת המחקר](https://research.meta.ai/blog/muse-ember) · [הציוץ](https://x.com/alexandr_wang/status/2119853374158032950)
- מדידות: [Artificial Analysis](https://artificialanalysis.ai/articles/meta-s-muse-ember-is-the-cheapest-model-scoring-36-on-the-intelligence-index) · [Simon Willison](https://simonwillison.net/2026/Nov/10/muse-ember/) · [Arnica](https://www.arnica.io/blog/muse-ember-agentic-pentesting-early-access) · [OpenRouter](https://openrouter.ai/meta/muse-ember)
- כתבות: [VentureBeat](https://venturebeat.com/technology/metas-proprietary-muse-ember-nearly-matches-claude-haiku-5-5-at-1-3-the-estimated-per-task-cost) · [Fello AI](https://felloai.com/muse-ember/) · [TheNextWeb](https://thenextweb.com/news/meta-muse-ember-small-ai-model-haiku-luna) · [TestingCatalog](https://www.testingcatalog.com/meta-launches-muse-ember-for-low-cost-agentic-tasks/)
