'use strict';
/* Server uji LOKAL (bukan untuk produksi): file statis + /api/* asli dengan
   database palsu (tests/fake-db.js), header dari vercel.json, cookie tanpa
   Secure karena http. Penghuni + PIN di sini data UJI.
   Pakai: node tests/lokal.js [port]   lalu buka http://127.0.0.1:PORT/ */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { buatApp } = require('../api/_lib/app');
const { jalankan } = require('../api/_lib/jalankan');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
function buatServer(port) {
const db = buatFakeDb({ penghuni: [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 13, name: 'dilla', gender: 'Cewek', pin: '135790' },
  { room: 14, name: 'dil', gender: 'Cowok', pin: '135790' }
] });
const app = buatApp({ db, rahasia: 'lokal-uji-'.repeat(4), aman: false });
const rute = {
  '/api/masuk': jalankan('masuk', 'POST', () => app),
  '/api/sesi': jalankan('sesi', 'GET', () => app),
  '/api/keluar': jalankan('keluar', 'POST', () => app),
  '/api/setup/pin': jalankan('setupPin', 'POST', () => app),
  '/api/setup/password': jalankan('setupPassword', 'POST', () => app),
  '/api/kamar/masuk': jalankan('kamarMasuk', 'POST', () => app)
};
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const TIPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const DILARANG = /^\/(api|tests|supabase|docs|\.git|\.kiro)(\/|$)/;

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  for (const r of cfg.headers) if (new RegExp('^' + r.source + '$').test(p)) for (const h of r.headers) res.setHeader(h.key, h.value);
  if (rute[p]) return rute[p](req, res);
  if (p === '/__uji/db') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ akun: [...db._t.akun.values()], sesi: db._t.sesi, log: db._t.log })); }
  if (DILARANG.test(p)) { res.statusCode = 404; return res.end('404'); }
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', TIPE[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
return { server: srv, db, siap: new Promise((r) => srv.listen(port, '127.0.0.1', r)) };
}
module.exports = { buatServer };
if (require.main === module) {
  const port = +process.argv[2] || 8790;
  buatServer(port).siap.then(() => console.log('lokal http://127.0.0.1:' + port));
}
