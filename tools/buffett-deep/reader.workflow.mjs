// גל 2 של בדיקת העומק של מכפיל באפט — קורא בלתי תלוי אחד (A, ‏B או C) על קבוצות של הודעות לעיתונות.
// מריצים דרך הכלי Workflow (רק באישור מפורש של המשתמש): scriptPath = הקובץ הזה, ‏args:
//   { who: 'A'|'B'|'C', wave: 'w2', bd: '<תיקיית העבודה>', template: '<תוכן prompt-reader.txt / prompt-reader-c.txt>',
//     dir: 'prt' (ברירת מחדל) או 'prl' (prslim.py, רק אחרי שהאימות עבר),
//     batches: <batches.json מ־batches.py, או cbatches.json מ־readcmp.py לקורא C> }
// הפלט: <bd>/read/<wave>/<who>/<id>.jsonl (שורה לכל הודעה). אחר כך: readcmp.py → (C על המחלוקות) → ledger.py.
// שני קוראים — שני Workflows נפרדים במקביל (כל אחד עד ~10 סוכנים בו־זמנית).
export const meta = {
  name: 'buffett-reader',
  description: 'גל 2 — קורא בלתי תלוי אחד (A, B או C) על ההודעות לעיתונות, לפי הרובריקה',
  phases: [{ title: 'קריאה', detail: 'סוכן אחד לכל קבוצה של הודעות (עד ~350 אלף תווים)' }],
}
const SCHEMA = {
  type: 'object',
  properties: {
    n: { type: 'integer' },
    lines: { type: 'integer' },
    er: { type: 'integer' },
    ex_true: { type: 'integer' },
    unsure: { type: 'array', items: { type: 'string' } },
    partial_read: { type: 'array', items: { type: 'string' } },
  },
  required: ['n', 'lines', 'er', 'ex_true', 'unsure'],
}
const who = args.who
const wave = args.wave || 'w2'
phase('קריאה')
const res = await parallel(args.batches.map((b) => () => {
  const out = args.bd + '/read/' + wave + '/' + who + '/' + b.id + '.jsonl'
  const work = args.bd + '/read/' + wave + '/' + who + '_work/' + b.id
  const big = b.big.length
    ? 'הקובץ ' + b.big.join(', ') + ' ארוך במיוחד (' + b.chars + ' תווים — כנראה דוח שנתי שהוגש כ־6-K/8-K). נסה לקרוא אותו במלואו. אם ההקשר לא מספיק: קרא במלואם את תחילת כל נספח (גבולות הנספחים: grep -n "^=== ") ואת כל קטע שבו מופיעים non-GAAP / adjusted / underlying / per share / share-based / stock-based / quarter / period ended (grep -n, ואז Read של 150 שורות לפני ואחרי כל מופע), והחזר את ה־acc ב־partial_read. אם זו לא הודעת תוצאות של תקופה — er=false.'
    : 'אין בקבוצה שלך קובץ חריג באורכו — כל קובץ נקרא במלואו.'
  // רשימת הקבוצה: b.list (נתיב מלא), או לפי ה־id בתיקייה של batches.py
  const list = b.list || args.bd + '/read/' + wave + '/batches/' + b.id + '.txt'
  const p = args.template.split('{LIST}').join(list).split('{DIR}').join(args.bd + '/' + (args.dir || 'prt')).split('{OUT}').join(out)
    .split('{WORK}').join(work).split('{BD}').join(args.bd).split('{BIG}').join(big)
    .split('{FIELDS}').join(JSON.stringify(b.fields || {}))
  return agent(p, { label: who + ':' + b.id + ' ' + b.syms.join(','), phase: 'קריאה', schema: SCHEMA })
    .then((r) => (r ? { id: b.id, ...r } : null))
}))
const done = res.filter(Boolean)
const failed = args.batches.filter((b) => !done.find((r) => r.id === b.id)).map((b) => b.id)
const short = done.filter((r) => r.lines !== r.n).map((r) => r.id)
log('קורא ' + who + ': ' + done.length + '/' + args.batches.length + ' קבוצות, ' + done.reduce((t, r) => t + r.lines, 0) + ' שורות; נכשלו: ' + (failed.join(',') || 'אין') + '; חסרות שורות: ' + (short.join(',') || 'אין'))
return { who, done, failed, short }
