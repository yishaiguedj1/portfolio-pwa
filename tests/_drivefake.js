// Drive מדומה בזיכרון — משותף לבדיקות הגיבוי (הספרייה הפרטית v318, Invest 14/10/2026)
function fakeDrive() {
  const files = new Map(); let seq = 0; const log = [];
  const mk = (o) => { const id = 'F' + (++seq); files.set(id, Object.assign({ id, parents: [], appProperties: {}, trashed: false, data: '' }, o)); return files.get(id); };
  const resp = (status, body, headers) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => (headers || {})[k] || null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body || {})),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    blob: async () => new Blob([body && body.data != null ? body.data : body]),
  });
  const pub = (f) => ({ id: f.id, name: f.name, size: String(Buffer.byteLength(f.data || '')), md5Checksum: 'm' + f.id + '-' + (f.v || 0), appProperties: f.appProperties, parents: f.parents, trashed: f.trashed });
  function matchQ(f, q) {
    if (/trashed=false/.test(q) && f.trashed) return false;
    const ap = q.match(/appProperties has \{ key='(\w+)' and value='1' \}/); if (ap && f.appProperties[ap[1]] !== '1') return false;
    if (/mimeType='application\/vnd.google-apps.folder'/.test(q) && f.mimeType !== 'application/vnd.google-apps.folder') return false;
    const ps = [...q.matchAll(/'(\w+)' in parents/g)].map((m) => m[1]);
    if (ps.length && !ps.some((p) => f.parents.includes(p))) return false;
    return true;
  }
  async function parseMultipart(body) {
    const t = await body.text();
    const parts = t.split(/--snb\w+/).filter((x) => x.includes('Content-Type'));
    const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
    const data = parts[1].slice(parts[1].indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
    return { meta, data };
  }
  async function fetch(url, opt = {}) {
    const m = opt.method || 'GET';
    log.push(m + ' ' + url.replace(/\?.*/, ''));
    const u = new URL(url);
    if (u.pathname === '/drive/v3/about') return resp(200, { storageQuota: { limit: '16106127360', usage: '3435973836' }, user: { emailAddress: 'me@example.com' } });
    let mm = u.pathname.match(/^\/(upload\/)?drive\/v3\/files(?:\/(\w+))?$/);
    if (!mm) return resp(404, {});
    const [, up, id] = mm;
    if (up) {
      if (u.searchParams.get('uploadType') === 'resumable') {
        const meta = JSON.parse(opt.body || '{}');
        return resp(200, '', { Location: 'https://upload.example/session?' + encodeURIComponent(JSON.stringify({ id: id || '', meta })) });
      }
      const { meta, data } = await parseMultipart(opt.body);
      let f = id ? files.get(id) : mk({ name: meta.name, parents: meta.parents || [], appProperties: meta.appProperties || {} });
      if (!f) return resp(404, {});
      if (meta.name) f.name = meta.name;
      f.data = data; f.v = (f.v || 0) + 1;
      return resp(200, pub(f));
    }
    if (!id && m === 'GET') return resp(200, { files: [...files.values()].filter((f) => matchQ(f, u.searchParams.get('q') || '')).map(pub) });
    if (!id && m === 'POST') { const meta = JSON.parse(opt.body); return resp(200, pub(mk({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents || [], appProperties: meta.appProperties || {} }))); }
    const f = files.get(id);
    if (!f) return resp(404, {});
    if (m === 'GET' && u.searchParams.get('alt') === 'media') return resp(200, { data: f.data });
    if (m === 'GET') return resp(200, pub(f));
    if (m === 'PATCH') { const b = JSON.parse(opt.body || '{}'); Object.assign(f, b); if (b.trashed) for (const c of files.values()) if (c.parents.includes(f.id)) c.trashed = true; return resp(200, pub(f)); }
    return resp(400, {});
  }
  // סשן resumable
  const outer = async (url, opt) => {
    if (url.startsWith('https://upload.example/session?')) {
      const { id, meta } = JSON.parse(decodeURIComponent(url.split('?')[1]));
      const data = await opt.body.text();
      let f = id ? files.get(id) : mk({ name: meta.name, parents: meta.parents || [], appProperties: meta.appProperties || {} });
      f.data = data; f.v = (f.v || 0) + 1; if (meta.name) f.name = meta.name;
      return resp(200, pub(f));
    }
    return fetch(url, opt);
  };
  return { fetch: outer, files, log };
}

module.exports = { fakeDrive };
