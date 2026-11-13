'use strict';
/* Pembungkus Vercel Functions (runtime Node, CommonJS). Membaca rahasia
   HANYA dari env var Vercel:
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KOSAN_SECRET
   Kalau ada yang belum diisi -> 503 (gagal aman, bukan jalan tanpa kunci). */
const { buatApp } = require('./app');
const { buatDb } = require('./db');

let appCache = null;
function appDariEnv() {
  if (appCache) return appCache;
  const db = buatDb({ url: process.env.SUPABASE_URL, kunci: process.env.SUPABASE_SERVICE_ROLE_KEY });
  appCache = buatApp({ db, rahasia: process.env.KOSAN_SECRET || '' });
  return appCache;
}

/* IP klien: di Vercel, X-Forwarded-For ditimpa platform (tidak bisa
   dipalsukan klien). Nilai pertama = IP klien. */
function ipDari(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  const xr = req.headers['x-real-ip'];
  if (typeof xr === 'string' && xr) return xr.trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function bacaBody(req) {
  if (req.body !== undefined) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    try { return Promise.resolve(JSON.parse(String(req.body || ''))); } catch (e) { return Promise.resolve(null); }
  }
  return new Promise((res) => {
    let n = 0; const b = [];
    req.on('data', (c) => { n += c.length; if (n > 8192) { req.destroy(); res(null); } else b.push(c); });
    req.on('end', () => { try { res(b.length ? JSON.parse(Buffer.concat(b).toString()) : null); } catch (e) { res(null); } });
    req.on('error', () => res(null));
  });
}

function kirim(res, status, body, cookies) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (cookies && cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(JSON.stringify(body || {}));
}

function jalankan(nama, metode, ambilApp = appDariEnv) {
  return async function handler(req, res) {
    if (req.method !== metode) { res.setHeader('Allow', metode); return kirim(res, 405, { galat: 'metode' }); }
    let app;
    try { app = ambilApp(); } catch (e) {
      console.error('[kosan] konfigurasi server belum lengkap:', e.message);
      return kirim(res, 503, { galat: 'server', pesan: 'Server belum siap.' });
    }
    const body = metode === 'POST' ? await bacaBody(req) : null;
    let out;
    try {
      out = await app[nama]({ method: req.method, headers: req.headers, body, ip: ipDari(req) });
    } catch (e) {
      console.error('[kosan]', nama, 'gagal:', e && e.status, e && e.message);
      out = { status: 503, body: { galat: 'server', pesan: 'Server lagi sibuk, coba lagi ya.' } };
    }
    return kirim(res, out.status, out.body, out.cookies);
  };
}

module.exports = { jalankan, ipDari, bacaBody };
