"""25/10/2026: מפתח עבודה שמתחיל ב־'-' (base64url, בערך פעם ב־64) — job.py run לא נופל על argparse."""
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402

JOB = 'j' + 'A' * 20
KEY = '-' + 'b' * 42


class JoinVals(unittest.TestCase):
    def test_join(self):
        self.assertEqual(job.join_vals(['run', '--job', 'jAb', '--key', '-x_Y', '--server', 'https://a']),
                         ['run', '--job=jAb', '--key=-x_Y', '--server', 'https://a'])
        self.assertEqual(job.join_vals(['run', '--key=-x']), ['run', '--key=-x'])
        self.assertEqual(job.join_vals(['run', '--key']), ['run', '--key'])

    def test_main_accepts_dash_key(self):
        seen = {}

        def fake_run(a):
            seen['key'] = a.key
            seen['job'] = a.job
            return 0
        with mock.patch.object(job, 'run', fake_run, create=True):
            try:
                job.main(['run', '--job', JOB, '--key', KEY])
            except SystemExit as e:
                self.assertNotEqual(e.code, 2, 'argparse נפל על מפתח שמתחיל ב־-')
        self.assertEqual(seen.get('key'), KEY)
        self.assertEqual(seen.get('job'), JOB)


if __name__ == '__main__':
    unittest.main()
