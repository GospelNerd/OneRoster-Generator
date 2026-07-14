// HTTP API so QA can pull sample rosters on demand. Zero dependencies: pure
// Node http, so `node src/server.js` just runs, no install step.
//
//   GET  /                          small HTML form for click-to-download
//   GET  /health                    liveness check
//   GET  /generate?type=&size=...   generate a roster
//   POST /generate  (JSON body)     same, params in the body
//
// Query / body params:
//   type    school | district        (default school)
//   size    small | medium | large   (default medium)
//   domain  email domain             (optional; derived from org name if omitted)
//   level   elementary|middle|high|k12  (optional, type=school only)
//   seed    any string/number        (optional; same seed => identical output)
//   format  zip | json               (default zip)

'use strict';

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const { buildDataset, TYPES, SIZES } = require('./generator');
const { datasetToFiles } = require('./csv');
const { createZip } = require('./zip');

const PORT = process.env.PORT || 4400;
const HOST = process.env.HOST || '0.0.0.0';
// Shared secret set on the host. Unset means auth is off (for local/CI use).
const AUTH_TOKEN = process.env.ONEROSTER_TOKEN || '';

function tokensMatch(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false; // length check first; lengths aren't secret
  return crypto.timingSafeEqual(ab, bb);
}

// Accept the token from an Authorization: Bearer header, an X-Auth-Token header,
// or a ?token= query param (the last is there so the browser form can work).
function isAuthed(req, url) {
  if (!AUTH_TOKEN) return true;
  let provided = '';
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) provided = h.slice(7).trim();
  if (!provided && req.headers['x-auth-token']) provided = String(req.headers['x-auth-token']).trim();
  if (!provided) provided = url.searchParams.get('token') || '';
  return provided.length > 0 && tokensMatch(provided, AUTH_TOKEN);
}

function datasetToZip(dataset) {
  const files = datasetToFiles(dataset);
  const entries = Object.entries(files).map(([name, data]) => ({ name, data }));
  return createZip(entries);
}

function zipFilename(meta) {
  const ts = meta.generatedAt.replace(/[:.]/g, '-');
  return `oneroster-${meta.type}-${meta.size}-${ts}.zip`;
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function handleGenerate(res, params) {
  const opts = {
    type: params.type,
    size: params.size,
    domain: params.domain,
    level: params.level,
    seed: params.seed,
    asOf: params.asOf,
  };
  const format = (params.format || 'zip').toLowerCase();

  let dataset;
  try {
    dataset = buildDataset(opts);
  } catch (err) {
    return sendJson(res, 400, { error: String(err && err.message ? err.message : err) });
  }

  if (format === 'json') {
    return sendJson(res, 200, { meta: dataset.meta, files: datasetToFiles(dataset) });
  }

  const zip = datasetToZip(dataset);
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${zipFilename(dataset.meta)}"`,
    'Content-Length': zip.length,
    'X-OneRoster-Seed': String(dataset.meta.seed),
    'X-OneRoster-Counts': JSON.stringify(dataset.meta.counts),
  });
  res.end(zip);
}

const FORM_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OneRoster Sample Generator</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 520px; margin: 6vh auto; padding: 0 20px; }
  h1 { font-size: 1.3rem; margin-bottom: 0.2rem; }
  p.sub { margin-top: 0; opacity: 0.7; }
  label { display: block; margin: 14px 0 4px; font-weight: 600; }
  select, input { width: 100%; padding: 8px; font: inherit; box-sizing: border-box; }
  .row { display: flex; gap: 12px; }
  .row > div { flex: 1; }
  button { margin-top: 20px; padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer; }
  .hint { font-size: 0.85rem; opacity: 0.65; margin-top: 4px; }
  a.json { display: inline-block; margin-top: 14px; font-size: 0.9rem; }
</style>
</head>
<body>
  <h1>OneRoster Sample Generator</h1>
  <p class="sub">OneRoster 1.1 CSV, packaged as a zip.</p>
  <form action="/generate" method="get">
    <div class="row">
      <div>
        <label for="type">Type</label>
        <select id="type" name="type">
          <option value="school">school</option>
          <option value="district">district</option>
        </select>
      </div>
      <div>
        <label for="size">Size</label>
        <select id="size" name="size">
          <option value="small">small</option>
          <option value="medium" selected>medium</option>
          <option value="large">large</option>
        </select>
      </div>
    </div>
    <label for="domain">Email domain (optional)</label>
    <input id="domain" name="domain" placeholder="derived from org name if blank">
    <label for="seed">Seed (optional)</label>
    <input id="seed" name="seed" placeholder="same seed reproduces the same roster">
    <div class="hint">Leave blank for a random roster each time.</div>
    <label for="token">Access token</label>
    <input id="token" name="token" type="password" placeholder="required only if the host set one">
    <button type="submit">Download zip</button>
  </form>
  <a class="json" id="jsonLink" href="/generate?format=json&size=small">View a JSON sample &rarr;</a>
  <script>
    // Carry whatever token is typed into the JSON sample link.
    document.getElementById('jsonLink').addEventListener('click', function (e) {
      var t = document.getElementById('token').value;
      if (t) this.href = '/generate?format=json&size=small&token=' + encodeURIComponent(t);
    });
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(FORM_HTML);
  }

  if (req.method === 'GET' && path === '/health') {
    return sendJson(res, 200, { status: 'ok', types: TYPES, sizes: SIZES });
  }

  if (path === '/generate') {
    if (!isAuthed(req, url)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return sendJson(res, 401, {
        error: 'Unauthorized. Provide the token via Authorization: Bearer <token>, X-Auth-Token, or ?token=.',
      });
    }
    if (req.method === 'GET') {
      const params = Object.fromEntries(url.searchParams.entries());
      return handleGenerate(res, params);
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy(); // guard against oversized bodies
      });
      req.on('end', () => {
        let params = {};
        if (body.trim()) {
          try {
            params = JSON.parse(body);
          } catch {
            return sendJson(res, 400, { error: 'Invalid JSON body' });
          }
        }
        handleGenerate(res, params);
      });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`OneRoster sample generator listening on http://${HOST}:${PORT}`);
    if (!AUTH_TOKEN) {
      console.warn('WARNING: ONEROSTER_TOKEN is not set; the API is unauthenticated.');
    }
  });
}

module.exports = { server };
