// ת4: R2 מדומה לבדיקות (תת־קבוצה של S3) — מאמת כל חתימה ותוקף כמו R2 האמיתי. משותף ל־studio-r2*.test.js
const crypto = require('crypto');
const path = require('path');
const R2 = require(path.join(__dirname, '..', 'ibkr-proxy/lib/r2.js'));

/* ---------- R2 מדומה: תת־קבוצה של S3 + אימות חתימות ---------- */
const ACC = 'a'.repeat(32), BUCKET = 'snb-studio';
const ENV = { R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: BUCKET };
function fakeR2(o = {}) {
  const S = { objs: new Map(), ups: new Map(), now: Date.UTC(2026, 9, 10, 12), calls: [], fail: o.fail || (() => 0), seq: 0, cors: o.cors !== false };
  const host = ACC + (o.eu === false ? '' : '.eu') + '.r2.cloudflarestorage.com';
  const resp = (status, body, hd) => new Response(status === 204 || body == null ? null : body, { status, headers: hd || {} });
  const xmlErr = (status, code) => resp(status, '<Error><Code>' + code + '</Code></Error>');
  function verify(u, init) {
    const q = Object.fromEntries(u.searchParams.entries());
    const hd = {}; for (const [k, v] of Object.entries(init.headers || {})) hd[k.toLowerCase()] = v;
    const path = decodeURIComponent(u.pathname);
    if (q['X-Amz-Signature']) {
      const t = q['X-Amz-Date'];
      const now = Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15));
      if (S.now > now + Number(q['X-Amz-Expires']) * 1000) return 'expired';
      const rest = {}; for (const k of Object.keys(q)) if (!/^X-Amz-/.test(k)) rest[k] = q[k];
      const s = R2.sign({ method: init.method || 'GET', host: u.host, path, query: rest, accessKey: 'AKTEST', secret: 'sekret/xyz', now, presign: Number(q['X-Amz-Expires']) });
      return s.sig === q['X-Amz-Signature'] ? '' : 'badsig';
    }
    const auth = hd.authorization || '';
    const m = /SignedHeaders=([^,]+), Signature=([a-f0-9]+)/.exec(auth);
    if (!m) return 'nosig';
    const t = hd['x-amz-date'];
    const now = Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15));
    const extra = {}; for (const k of m[1].split(';')) if (!['host', 'x-amz-date', 'x-amz-content-sha256'].includes(k)) extra[k] = hd[k];
    const body = typeof init.body === 'string' ? init.body : '';
    const s = R2.sign({ method: init.method, host: u.host, path, query: Object.fromEntries(u.searchParams.entries()), headers: extra,
      payload: crypto.createHash('sha256').update(body).digest('hex'), accessKey: 'AKTEST', secret: 'sekret/xyz', now });
    return s.sig === m[2] ? '' : 'badsig';
  }
  S.fetch = async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET';
    S.calls.push(method + ' ' + u.pathname + u.search.slice(0, 40));
    if (u.host !== host) return xmlErr(404, 'NoSuchBucket');
    if (method === 'OPTIONS') return resp(200, '', S.cors ? { 'access-control-allow-origin': init.headers.Origin } : {});
    const bad = verify(u, init);
    if (bad === 'expired') return xmlErr(403, 'ExpiredRequest');
    if (bad) return xmlErr(403, 'SignatureDoesNotMatch');
    const f = S.fail(method, u); if (f) return f === 'net' ? Promise.reject(new TypeError('net')) : xmlErr(f, 'Injected');
    const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean);
    if (parts[0] !== BUCKET) return xmlErr(404, 'NoSuchBucket');
    const key = parts.slice(1).join('/');
    const q = u.searchParams;
    if (!key && method === 'GET') {
      const pre = q.get('prefix') || '';
      const ks = [...S.objs.keys()].filter((k) => k.startsWith(pre)).sort();
      return resp(200, '<ListBucketResult>' + ks.map((k) => '<Contents><Key>' + k + '</Key><Size>' + S.objs.get(k).length + '</Size><LastModified>2026-10-10T00:00:00.000Z</LastModified></Contents>').join('') + '<IsTruncated>false</IsTruncated></ListBucketResult>');
    }
    if (method === 'POST' && q.has('uploads')) { const id = 'up' + (++S.seq); S.ups.set(id, { key, parts: new Map() }); return resp(200, '<InitiateMultipartUploadResult><UploadId>' + id + '</UploadId></InitiateMultipartUploadResult>'); }
    if (q.has('uploadId')) {
      const up = S.ups.get(q.get('uploadId'));
      if (!up || up.key !== key) return xmlErr(404, 'NoSuchUpload');
      if (method === 'PUT') { const b = Buffer.from(await new Response(init.body).arrayBuffer()); up.parts.set(Number(q.get('partNumber')), b); return resp(200, '', { etag: '"' + crypto.createHash('md5').update(b).digest('hex') + '"' }); }
      if (method === 'GET') return resp(200, '<ListPartsResult>' + [...up.parts.entries()].sort((a, b) => a[0] - b[0]).map(([pn, b]) => '<Part><PartNumber>' + pn + '</PartNumber><ETag>&quot;' + crypto.createHash('md5').update(b).digest('hex') + '&quot;</ETag><Size>' + b.length + '</Size></Part>').join('') + '<IsTruncated>false</IsTruncated></ListPartsResult>');
      if (method === 'DELETE') { S.ups.delete(q.get('uploadId')); return resp(204); }
      if (method === 'POST') {
        const want = [...String(init.body).matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>([^<]+)<\/ETag>/g)].map((m) => [Number(m[1]), m[2].replace(/&quot;/g, '"')]);
        const sizes = want.map(([pn]) => (up.parts.get(pn) || Buffer.alloc(0)).length);
        if (sizes.slice(0, -1).some((s) => s !== sizes[0])) return xmlErr(400, 'InvalidPart');      // R2: אותו גודל לכל החלקים
        for (const [pn, et] of want) { const b = up.parts.get(pn); if (!b || '"' + crypto.createHash('md5').update(b).digest('hex') + '"' !== et) return xmlErr(400, 'InvalidPart'); }
        S.objs.set(key, Buffer.concat(want.map(([pn]) => up.parts.get(pn)))); S.ups.delete(q.get('uploadId'));
        return resp(200, '<CompleteMultipartUploadResult><Key>' + key + '</Key></CompleteMultipartUploadResult>');
      }
    }
    if (method === 'PUT') { S.objs.set(key, Buffer.from(await new Response(init.body).arrayBuffer())); return resp(200, ''); }
    if (method === 'HEAD') { const b = S.objs.get(key); return b ? resp(200, null, { 'content-length': String(b.length), etag: '"x"' }) : resp(404); }
    if (method === 'DELETE') { S.objs.delete(key); return resp(204); }
    if (method === 'GET') { const b = S.objs.get(key); if (!b) return xmlErr(404, 'NoSuchKey'); const r = /bytes=(\d+)-/.exec((init.headers || {}).Range || ''); return resp(r ? 206 : 200, r ? b.subarray(+r[1]) : b); }
    return xmlErr(400, 'Unsupported');
  };
  S.deps = { fetch: S.fetch, now: () => S.now };
  return S;
}

module.exports = { fakeR2, ENV, ACC, BUCKET };
