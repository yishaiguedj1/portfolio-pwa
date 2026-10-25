"""25/10/2026 (שלב 3 של "תרגום בטלפון"): שלבי הטקסט רצים בטלפון — בפייתון של youtubedl-android (3.12, ספרייה סטנדרטית
בלבד: בלי numpy, PIL, fontTools, requests ו־anthropic). השומר: העובד (job/pipeline/llm/relay/store) נטען, וכל פקודות vt
של המסלול "הכל בטלפון" (pw) רצות מקצה לקצה בפייתון בלי site-packages (‎-I -S) — ייבוא כבד חדש באחד מהם = אדום כאן."""
import json
import os
import random
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = [sys.executable, '-I', '-S']


def bare(code, env=None):
    return subprocess.run(PY + ['-c', 'import sys; sys.path.insert(0, %r)\n' % str(ROOT) + code], capture_output=True, text=True,
                          env=env, cwd=str(ROOT), timeout=120)


class Imports(unittest.TestCase):
    def test_worker_modules(self):
        r = bare('import job, pipeline, llm, relay, store, learnmetrics, goldscore, subsimport\n'
                 'from vt import cli, hebrew, segment, translate, timing, subs, qc, review, textwidth, transcript, media\n'
                 'print("ok")')
        self.assertEqual(r.returncode, 0, r.stderr[-800:])

    def test_no_site_packages_really(self):
        r = bare('import importlib.util as u; print(u.find_spec("numpy") is None and u.find_spec("PIL") is None)')
        self.assertEqual(r.stdout.strip(), 'True', 'הבדיקה רצה בלי ספריות חיצוניות')


class TextStages(unittest.TestCase):
    def test_pw_text_path(self):
        with tempfile.TemporaryDirectory() as td:
            env = dict(os.environ, VT_WORK=td)
            vt = lambda *a: subprocess.run([sys.executable, '-S', '-E', '-m', 'vt'] + list(a), capture_output=True, text=True, env=env, cwd=str(ROOT), timeout=120)
            r = vt('new', 'demo', '--source', 'phone:demo.mp4', '--title', 'demo', '--force')
            self.assertEqual(r.returncode, 0, r.stderr[-800:])
            pd = Path(td) / 'demo'
            rnd = random.Random(3)
            voc = 'the quick brown fox jumps over the lazy dog we build great products and customers love them'.split()
            ws, t = [], 1.0
            for i in range(400):
                w = rnd.choice(voc) + ('.' if rnd.random() < 0.08 else '')
                d = 0.2 + rnd.random() * 0.2
                ws.append({'w': w, 's': round(t, 3), 'e': round(t + d, 3), 'spk': 'S1' if (i // 120) % 2 == 0 else 'S2', 'align': 'qwen3'})
                t += d + rnd.random() * 0.15 + (1.2 if rnd.random() < 0.03 else 0)
            (pd / 'asr').mkdir(exist_ok=True)
            (pd / 'asr' / 'parakeet.json').write_text(json.dumps({'engine': 'parakeet', 'language': 'en', 'words': ws, 'events': [], 'phone': 1}))
            (pd / 'media.json').write_text(json.dumps({'path': '', 'duration': t + 2, 'size': 0, 'fps': '30000/1001', 'audio': {'t0': 0.0},
                                                       'video': {'width': 1920, 'height': 1080, 'fps': '30000/1001', 't0': 0.0}}))
            (pd / 'shots.json').write_text(json.dumps({'threshold': 10.0, 'shots': [{'t': 30.0, 'score': 20}]}))
            for cmd in ('edit-export', 'edit-import', 'plan', 'tr-prep'):
                r = vt(cmd, 'demo')
                self.assertEqual(r.returncode, 0, cmd + ': ' + r.stderr[-800:])
            words = json.loads((pd / 'en.words.json').read_text())['words']
            (pd / 'en.aligned.json').write_text(json.dumps({'aligner': 'x', 'stats': {}, 'words': words}))
            cues = json.loads((pd / 'cues.en.json').read_text())
            he = 'שלום עולם, זה תרגום ארוך מספיק כדי שהשורה תישבר לשתיים בדיוק'.split()
            (pd / 'tr' / 'batch_001.he.txt').write_text('\n'.join('#%d %s' % (c['id'], ' '.join(rnd.choice(he) for _ in range(rnd.randint(3, 12)))) for c in cues) + '\n')
            for cmd in ('retime', 'tr-check', 'tr-merge', 'build', 'review-pack'):
                r = vt(cmd, 'demo')
                self.assertEqual(r.returncode, 0, cmd + ': ' + r.stderr[-800:])
            for f in ('he.ass', 'he.srt', 'he.vtt', 'cues.final.json', 'qc.md'):
                self.assertTrue((pd / 'out' / f).is_file(), f)


if __name__ == '__main__':
    unittest.main()
