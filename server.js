// ═══════════════════════════════════════════════════════════════
//  NETSCOUT Africa — Local Proxy Server
//  Serves the app AND proxies Anthropic API calls (bypasses CORS)
//
//  Usage:
//    1. Set your API key:  export ANTHROPIC_API_KEY=sk-ant-...
//    2. Run:               node server.js
//    3. Open:              http://localhost:3000
// ═══════════════════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT   = 3000;
const APIKEY = process.env.ANTHROPIC_API_KEY || '';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,anthropic-version');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Proxy Anthropic API ──────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/claude') {
    if (!APIKEY) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=sk-ant-...'}));
      return;
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const opts = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': APIKEY,
          'anthropic-version': '2023-06-01',
        },
      };
      const pr = https.request(opts, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { res.writeHead(r.statusCode, {'Content-Type':'application/json'}); res.end(d); });
      });
      pr.on('error', e => { res.writeHead(502, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:e.message})); });
      pr.write(body);
      pr.end();
    });
    return;
  }

  // ── Serve static files ───────────────────────────────────────
  let fp = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'text/plain'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NETSCOUT Africa · Sales Intelligence App   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  App:     http://localhost:${PORT}`);
  console.log(`  API key: ${APIKEY ? '✓ set (' + APIKEY.slice(0,14) + '...)' : '✗ NOT SET'}`);
  if (!APIKEY) console.log('\n  Fix: export ANTHROPIC_API_KEY=sk-ant-... then restart\n');
  else console.log('\n  Open http://localhost:3000 in your browser\n');
});
