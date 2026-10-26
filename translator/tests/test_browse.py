"""26/10/2026: סרטון שנבחר ברשימת הקבצים של Studio (files.v.bx) — ההורדה בגישה של הרשימה (op:'token' עם src),
וכל קובץ אחר בגישה הרגילה של הסטודיו."""
import io
import os
import sys
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import job  # noqa: E402


class FakeResp(io.BytesIO):
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Client:
    def __init__(self):
        self.calls = []

    def call(self, op, **kw):
        self.calls.append((op, kw))
        if kw.get('src'):
            return {'src': {'token': 'SRC', 'exp': 0}}
        return {'drive': {'token': 'STUDIO', 'exp': 0}}


class BrowseDownload(unittest.TestCase):
    def ctx(self, bx):
        c = job.Ctx.__new__(job.Ctx)
        c.c = Client()
        c.api = 'https://www.googleapis.com/drive/v3'
        c.tok, c.tok_at = None, 0
        c.st = {'files': {'v': {'id': 'VIDabcdefghij', 'size': 3, 'ext': True, 'bx': bx}}}
        c.event = lambda *a, **k: None
        return c

    def run_dl(self, c, fid):
        seen = []

        def fake_open(req, timeout=60):
            seen.append(req.get_header('Authorization'))
            return FakeResp(b'abc')
        with tempfile.TemporaryDirectory() as d, mock.patch.object(urllib.request, 'urlopen', fake_open):
            out = job.drive_download(c, fid, Path(d) / 'x.mp4', 3)
            self.assertEqual(out.read_bytes(), b'abc')
        return seen

    def test_bx_source_uses_browse_token(self):
        c = self.ctx(True)
        self.assertEqual(self.run_dl(c, 'VIDabcdefghij'), ['Bearer SRC'])
        self.assertEqual(c.c.calls, [('token', {'src': True})])

    def test_other_files_use_studio_token(self):
        c = self.ctx(True)
        self.assertEqual(self.run_dl(c, 'OTHERabcdefg'), ['Bearer STUDIO'])
        self.assertEqual(c.c.calls, [('token', {})])

    def test_picker_source_uses_studio_token(self):
        c = self.ctx(False)
        self.assertEqual(self.run_dl(c, 'VIDabcdefghij'), ['Bearer STUDIO'])

    def test_no_access_stops_with_store_code(self):
        c = self.ctx(True)
        c.c.call = lambda op, **kw: {'src': {'error': 'bx_engine'}}
        with self.assertRaises(job.StepError) as e:
            c.src_token()
        self.assertEqual(e.exception.err if hasattr(e.exception, 'err') else 'store_fail', 'store_fail')


if __name__ == '__main__':
    unittest.main()
