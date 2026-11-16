"""peaks.py — הדוברים בקובץ הציר של העורך (16/11/2026, "דוברים בכל תמליל"): שם, תפקיד ומגדר מטבלת ההגהה,
ומגדר מגובה הקול כשהטבלה לא אמרה. בלי numpy (רק speakers / main בלי קול)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import peaks as P  # noqa: E402


def write(pd, rel, obj):
    p = Path(pd) / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False), encoding='utf-8')


class TestSpeakers(unittest.TestCase):
    def test_brief_and_voice(self):
        with tempfile.TemporaryDirectory() as d:
            write(d, 'project.json', {'speakers': {
                'S1': {'name': 'דנה לוי', 'role': 'מנחה', 'gender': 'נקבה'},
                'S2': {'name': 'לא ידוע', 'role': 'אורח', 'gender': ''},
                'S3': {'name': 'S3', 'role': '', 'gender': 'זכר (לפי השם)'},
                'bad': {'name': 'x'},
            }})
            write(d, 'asr/parakeet.json', {'diarize': {'voice': {
                'S1': {'g': 'm', 'hz': 120.0},      # התדריך אמר אישה — הוא גובר
                'S2': {'g': 'f', 'hz': 210.0},      # התדריך לא אמר — הקול
                'S4': {'g': '?', 'hz': 175.0},      # לא חד־משמעי — בלי מגדר, ובלי שום פרט — בחוץ
                'S5': {'g': 'm', 'hz': 110.0},
            }}})
            sp = P.speakers(d)
        self.assertEqual(sp['S1'], {'n': 'דנה לוי', 'r': 'מנחה', 'g': 'f', 'gs': 'text'})
        self.assertEqual(sp['S2'], {'r': 'אורח', 'g': 'f', 'gs': 'voice'})   # "לא ידוע" — בלי שם
        self.assertEqual(sp['S3'], {'g': 'm', 'gs': 'text'})                  # שם שהוא התווית — בלי שם
        self.assertEqual(sp['S5'], {'g': 'm', 'gs': 'voice'})
        self.assertNotIn('S4', sp)
        self.assertNotIn('bad', sp)
        self.assertEqual(list(sp), ['S1', 'S2', 'S3', 'S5'])

    def test_limits_and_missing(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(P.speakers(d), {})                 # עבודה בלי תדריך ובלי קול
            write(d, 'project.json', {'speakers': {f'S{i}': {'name': 'N' * 90, 'role': 'R' * 90, 'gender': 'גבר'} for i in range(1, 30)}})
            sp = P.speakers(d)
        self.assertEqual(len(sp), P.SP_MAX)
        self.assertTrue(all(len(x['n']) <= P.SP_LEN and len(x['r']) <= P.SP_LEN for x in sp.values()))

    def test_main_without_audio_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'out' / 'timeline.json'
            self.assertEqual(P.main(['--project', d, '--out', str(out)]), 0)
            self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
