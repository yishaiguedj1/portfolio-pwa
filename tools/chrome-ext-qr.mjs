// 02/11/2026 (Studio DM סבב 4, ‏11): קודי QR שהתוסף מייצר (android/chrome-ext/qr.js) — לבדיקה מול המפענח של zxing
// בטלפון (testDm: DmQrExtTest). שורה ראשונה = הטקסט (base64), ואחריה שורה לכל שורת מודולים. הרצה: node tools/chrome-ext-qr.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'android/app/src/testDm/resources/qr');

/** מקרים: קצר (גרסה 1–3), בינוני, עם עברית (UTF-8), ארוך (שתי קבוצות בלוקים), וארוך מאוד (מידע הגרסה, 7+) */
export function cases() {
  const long = 'https://example.com/files/' + 'a1b2c3d4e5'.repeat(30) + '.zip?x=1';
  return [
    'studiodm://add?url=https%3A%2F%2Fexample.com%2Fa.zip',
    'studiodm://add?url=' + encodeURIComponent('https://downloads.example.org/releases/v2.4.1/app-arm64-v8a-release.apk?token=abc123'),
    'studiodm://add?url=' + encodeURIComponent('https://example.co.il/קבצים/מסמך חשוב.pdf'),
    'studiodm://add?url=' + encodeURIComponent(long),
    'https://example.com/' + 'x'.repeat(700),
  ];
}

export async function build(qr, text) {
  const m = qr(text);
  return Buffer.from(text, 'utf8').toString('base64') + '\n' + m.map((r) => r.map((d) => (d ? '1' : '0')).join('')).join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { qr } = await import(path.join(ROOT, 'android/chrome-ext/qr.js'));
  fs.mkdirSync(OUT, { recursive: true });
  const cs = cases();
  for (let i = 0; i < cs.length; i++) fs.writeFileSync(path.join(OUT, 'case' + (i + 1) + '.txt'), await build(qr, cs[i]));
  console.log('qr: ' + cs.length + ' קודים');
}
