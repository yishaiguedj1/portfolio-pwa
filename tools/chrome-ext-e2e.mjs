// 27/10/2026: עצי Chrome אקראיים → state.json בקוד של התוסף (android/chrome-ext/core.js) + "האמת" — מה ש־Chrome מציג בכל תיקייה.
// BrE2eTest (הטלפון) בודק שמהם נבנה בדיוק אותו עץ: אותה כמות, אותן תיקיות (גם ריקות), אותו סדר.
// שינוי ב־core.js → node tools/chrome-ext-e2e.mjs (tests/chrome-ext.test.js נכשל אם הקבצים לא מעודכנים).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'android/app/src/testBrowser/resources/chrome-e2e');
export const CASES = 12;

export function build(C, seed0) {
  let seed = seed0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let id = 100;
  const urls = ['https://a.com/', 'https://www.a.com', 'https://b.com/x?utm_source=z', 'javascript:alert(1)', 'chrome://settings', 'https://heb.co.il/דף'];
  const mk = (d) => {
    const kids = []; const n = 1 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      if (d < 3 && rnd() < 0.3) kids.push({ id: String(id++), title: (rnd() < 0.15 ? 'a/b' : 'F') + id, children: rnd() < 0.15 ? [] : mk(d + 1) });
      else kids.push({ id: String(id++), title: 'T' + id, url: rnd() < 0.3 ? urls[Math.floor(rnd() * urls.length)] : 'https://s' + Math.floor(rnd() * 40) + '.com/p' + id, dateAdded: Math.floor(rnd() * 1e6) });
    }
    return kids;
  };
  const tree = [{ id: '0', children: [{ id: '1', folderType: 'bookmarks-bar', children: mk(0) }, { id: '2', folderType: 'other', children: mk(1) }, { id: '3', folderType: 'mobile', children: mk(1) }] }];
  const dirs = []; const flat = C.flatten(tree, dirs);
  const state = C.buildState({ flat, dirs, hist: [], prev: null, ack: 0, alias: {}, vat: 0, origin: [], now: 1, hold: 0 });
  const truth = {};
  [['b', 0], ['o', 1], ['m', 2]].forEach(([r, k]) => {
    const walk = (n, p) => {
      truth[p] = (n.children || []).map((c) => (c.url ? 'L:n' + c.id : 'D:' + p + '/' + C.seg(c.title)));
      for (const c of n.children || []) if (!c.url) walk(c, p + '/' + C.seg(c.title));
    };
    walk(tree[0].children[k], r);
  });
  return JSON.stringify({ total: flat.length, truth, state }, null, 1) + '\n';
}

export async function all() {
  const C = await import(pathToFileURL(path.join(ROOT, 'android/chrome-ext/core.js')).href);
  return Array.from({ length: CASES }, (_, i) => ['case' + (i + 1) + '.json', build(C, i + 1)]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [n, t] of await all()) fs.writeFileSync(path.join(OUT, n), t);
  console.log('chrome-e2e: ' + CASES + ' עצים');
}
