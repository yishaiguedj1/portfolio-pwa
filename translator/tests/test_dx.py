"""26/10/2026: שמירה ב״הסרטונים שלי״ ב־Drive (עבודת dx) — העובד מעתיק את התוצרים מ־R2 לתיקייה שבחרת,
קובץ אחרי קובץ, ומוחק מהדיסק. = normDx בשרתון (dx_items)."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import job  # noqa: E402

F = 'R2_jDXparentAAAAAAAAAAAA'
V, S = F + '_aaaaaaaaaaaa', F + '_bbbbbbbbbbbb'


class FakeCtx:
    def __init__(self, st):
        self.st, self.reports, self.name = st, [], 'jDXjobAAAAAAAAAAAAAAA'

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        self.reports.append(dict(extra, st=st, p=p, msg=msg))


class Dx(unittest.TestCase):
    def spec(self, it, f='vidsFold123456'):
        return {'dx': {'f': f, 'n': 'הרצאות', 'it': it}}

    def test_items_only_r2_to_drive(self):
        self.assertEqual(job.dx_items(self.spec([{'id': V, 'n': 'a.mp4'}]))[0], 'vidsFold123456')
        self.assertEqual(job.dx_items(self.spec([{'id': V, 'n': 'a.mp4'}], f='R2_jXXXXXXXXXXXXXXXXXXXX'))[0], None)   # יעד ב־R2 — לא
        self.assertEqual(job.dx_items(self.spec([{'id': 'driveFile12345', 'n': 'a.mp4'}]))[1], [])                     # רק קבצים מ־R2
        self.assertEqual(job.dx_items({})[1], [])

    def run_dx(self, it, up=None):
        ctx = FakeCtx({'job': 'jDXjobAAAAAAAAAAAAAAA', 'kind': 'dx', 'folder': F, 'spec': self.spec(it)})
        ups = []

        def fetch(c, fid, dest, size, on_progress=None):
            Path(dest).write_bytes(fid.encode())
            if on_progress:
                on_progress(1.0)

        def upload(c, path, name, kind, mime, on_progress=None, prop='snbOut', replace='', parent=''):
            if up:
                up()
            ups.append((Path(path).read_bytes(), name, mime, prop, parent))
            return 'D' + name
        with tempfile.TemporaryDirectory() as d, mock.patch.object(job, 'DX_DIR', Path(d) / '_dx'), \
                mock.patch.object(job, 'load_state', lambda: ctx.st), mock.patch.object(job, 'Ctx', lambda st: ctx), \
                mock.patch.object(job, 'fetch_input', fetch), mock.patch.object(job, 'drive_upload', upload):
            rc = job.dx_auto(None)
            left = list((Path(d) / '_dx').rglob('*'))
        return rc, ctx, ups, left

    def test_copies_each_file_to_the_folder(self):
        rc, ctx, ups, left = self.run_dx([{'id': V, 'n': 'Talk — דחוס.mp4', 's': 10}, {'id': S, 'n': 'Talk.he.srt', 's': 2}])
        self.assertEqual(rc, 0)
        self.assertEqual([(u[0], u[1], u[2], u[3], u[4]) for u in ups], [
            (V.encode(), 'Talk — דחוס.mp4', 'video/mp4', 'snbVid', 'vidsFold123456'),
            (S.encode(), 'Talk.he.srt', 'application/x-subrip', 'snbVid', 'vidsFold123456')])
        self.assertTrue(ctx.reports[-1].get('done'))
        self.assertEqual(left, [], 'הדיסק נקי בסוף')
        ps = [r['p'] for r in ctx.reports if r.get('st') == 'sv' and r.get('p') is not None]
        self.assertEqual(ps, sorted(ps), 'ההתקדמות לא חוזרת אחורה')

    def test_drive_refusal_is_a_clear_failure(self):
        def boom():
            raise job.StepError('✗ ההעלאה ל־Drive נכשלה (403).', 'store_fail')
        rc, ctx, ups, left = self.run_dx([{'id': V, 'n': 'a.mp4', 's': 1}], up=boom)
        self.assertEqual(rc, 1)
        self.assertEqual(ctx.reports[-1].get('err'), 'dx_drive')
        self.assertEqual(left, [])

    def test_nothing_to_copy(self):
        rc, ctx, ups, left = self.run_dx([])
        self.assertEqual((rc, ctx.reports[-1].get('err'), ups), (1, 'dx_bad', []))


if __name__ == '__main__':
    unittest.main()
