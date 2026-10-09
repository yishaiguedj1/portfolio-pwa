"""warm.py: מודל שהורד חלקית מתגלה ומורד מחדש לפני עבודה (09/10/2026 — קובץ CTC קטוע במטמון הפיל את היישור)."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import warm  # noqa: E402


class FakeResp:
    def __init__(self, size):
        self.headers = {'Content-Length': str(size)}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class EnsureFile(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.dest = self.tmp / 'checkpoints' / 'model.pt'
        self.calls = []

    def dl(self, data):
        def f(url, p):
            self.calls.append(url)
            Path(p).write_bytes(data)
        return f

    def run_it(self, want, data):
        return warm.ensure_file('https://x/model.pt', self.dest, opener=lambda req, timeout: FakeResp(want), download=self.dl(data))

    def test_complete_file_untouched(self):
        self.dest.parent.mkdir(parents=True)
        self.dest.write_bytes(b'x' * 10)
        self.assertEqual(self.run_it(10, b'y' * 10), 'ok')
        self.assertEqual(self.calls, [], 'קובץ שלם — בלי הורדה')

    def test_truncated_file_replaced(self):
        self.dest.parent.mkdir(parents=True)
        self.dest.write_bytes(b'x' * 7)
        self.assertEqual(self.run_it(10, b'y' * 10), 'fixed')
        self.assertEqual(self.dest.read_bytes(), b'y' * 10)

    def test_missing_file_downloaded(self):
        self.assertEqual(self.run_it(10, b'y' * 10), 'fixed')
        self.assertTrue(self.dest.exists())

    def test_truncated_download_not_installed(self):
        with self.assertRaises(OSError):
            self.run_it(10, b'y' * 6)
        self.assertFalse(self.dest.exists(), 'הורדה קטועה לא נכנסת למטמון')
        self.assertFalse(self.dest.with_name('model.pt.part').exists())


class AgentStartsWarm(unittest.TestCase):
    def test_agent_wires_warm(self):
        src = (Path(warm.__file__).with_name('agent.py')).read_text(encoding='utf-8')
        self.assertIn("with_name('warm.py')", src)
        self.assertIn('warm.join(WARM_WAIT_S)', src, 'עבודה שמגיעה בזמן ההורדה מחכה לה, לא מורידה במקביל')

    def test_model_id_matches_vt(self):
        vt_align = (Path(warm.__file__).parent / 'vt' / 'align.py').read_text(encoding='utf-8')
        self.assertIn('MODEL_ID = "' + warm.QWEN_ALIGNER + '"', vt_align)


if __name__ == '__main__':
    unittest.main()
