"""5/11/2026 (ת3 שלב 4 — Vercel רק גיבוי): העובד פונה לשרתון שלנו, ועובר ל־Vercel רק כשהראשי לא עונה / 5xx / 421."""
import os
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import job as J  # noqa: E402


class FailoverTests(unittest.TestCase):
    def setUp(self):
        J._fo['until'] = 0.0
        self.calls = []

    def run_with(self, answers):
        def fake(method, url, body=None, headers=None, timeout=30):
            self.calls.append(url)
            a = answers.pop(0)
            if isinstance(a, Exception):
                raise a
            return a, {'ok': a == 200}, {}
        with mock.patch.object(J, '_http1', side_effect=fake):
            return J.http('POST', J.SERVER + '/api/studio', {'op': 'claim'})

    def test_primary_is_ours(self):
        self.assertEqual(J.SERVER, 'https://api.thesnowball.app')
        self.assertIn(J.BACKUP, J.SERVERS)
        self.assertIn('https://api-staging.thesnowball.app', J.SERVERS)

    def test_ok_stays_on_primary(self):
        st, _, _ = self.run_with([200])
        self.assertEqual(st, 200)
        self.assertEqual(self.calls, [J.SERVER + '/api/studio'])

    def test_4xx_is_not_failover(self):
        st, _, _ = self.run_with([401])
        self.assertEqual(st, 401)
        self.assertEqual(len(self.calls), 1)

    def test_network_error_goes_to_backup_and_sticks(self):
        st, _, _ = self.run_with([urllib.error.URLError('down'), 200])
        self.assertEqual(st, 200)
        self.assertEqual(self.calls, [J.SERVER + '/api/studio', J.BACKUP + '/api/studio'])
        self.calls.clear()
        self.run_with([200])                      # 5 דק׳ — ישר לגיבוי
        self.assertEqual(self.calls, [J.BACKUP + '/api/studio'])

    def test_5xx_and_530_go_to_backup(self):
        for code in (502, 530):
            J._fo['until'] = 0.0
            self.calls.clear()
            st, _, _ = self.run_with([code, 200])
            self.assertEqual(st, 200)
            self.assertEqual(self.calls[-1], J.BACKUP + '/api/studio')

    def test_421_goes_to_backup_without_sticking(self):
        st, _, _ = self.run_with([421, 200])
        self.assertEqual(st, 200)
        self.assertEqual(J._fo['until'], 0.0, '421 = רק הפעולה הזו (learn_remote)')

    def test_both_down_returns_primary_answer(self):
        st, _, _ = self.run_with([502, urllib.error.URLError('down')])
        self.assertEqual(st, 502)
        with self.assertRaises(OSError):
            J._fo['until'] = 0.0
            self.run_with([urllib.error.URLError('a'), urllib.error.URLError('b')])

    def test_other_hosts_untouched(self):
        with mock.patch.object(J, '_http1', return_value=(502, {}, {})) as m:
            J.http('POST', 'https://api-staging.thesnowball.app/api/studio', {})
            J.http('GET', 'https://www.googleapis.com/drive/v3/files', None)
        self.assertEqual(m.call_count, 2)


if __name__ == '__main__':
    unittest.main()
