'use strict';
/* Playtest browser Fase A (benign — tanpa pesan racun, tanpa broker).
   Menjalankan server uji lokal (tests/lokal.js, database palsu) + Chromium
   headless dalam SATU proses. Supabase anon (kosan_occupants, kosan_login
   versi lama) di-mock lewat page.route. Broker MQTT publik diblokir.

   Pakai:
     PLAYWRIGHT_CORE=/path/ke/playwright-core CHROME_PATH=/path/ke/chrome \
       node tests/e2e-fase-a.js
   Mode RED (klien lama dari git main, harus GAGAL di cek keamanan):
     ... node tests/e2e-fase-a.js --lama                                      */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { buatServer } = require('./lokal');
const { pinHash } = require('../api/_lib/inti');

const PORT = 8792, BASE = 'http://127.0.0.1:' + PORT;
const LAMA = process.argv.includes('--lama');
const ROOT = path.join(__dirname, '..');
const OCC = [{ room: 3, name: 'rina' }, { room: 13, name: 'dilla' }, { room: 14, name: 'dil' }];
const PIN = { rina: '246810', dilla: '135790', dil: '135790' };
const GENDER = { rina: 'Cewek', dilla: 'Cewek', dil: 'Cowok' };
const PW = 'kos-rumah-kedua';
const hasil = [];
const cek = (nama, ok, info) => { hasil.push({ nama, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + nama + (info ? '  [' + info + ']' : '')); };

async function halamanBaru(browser, catatan) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    if (u.includes('supabase.co/rest/v1/rpc/kosan_occupants')) return route.fulfill({ json: OCC });
    if (u.includes('supabase.co/rest/v1/rpc/kosan_login')) { /* hanya dipakai klien LAMA */
      const b = JSON.parse(route.request().postData() || '{}');
      const n = String(b.p_name || '').trim().toLowerCase();
      return route.fulfill({ json: PIN[n] && pinHash(PIN[n]) === b.p_pin_hash ? [{ gender: GENDER[n] }] : [] });
    }
    catatan.luar.push(u);
    return route.abort();
  });
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) catatan.csp.push(m.text()); });
  page.on('pageerror', (e) => catatan.err.push(e.message));
  page.on('request', (r) => { if (/unpkg\.com/.test(r.url())) catatan.unpkg.push(r.url()); });
  await page.goto(BASE + (LAMA ? '/__lama.html' : '/'));
  await page.waitForTimeout(1500);
  return { ctx, page };
}
/* terlihat = elemen + semua leluhurnya tidak display:none, dan punya ukuran
   (offsetParent tidak dipakai: selalu null untuk position:fixed). */
const tampil = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return false;
  for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}, sel);
const klik = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
/* #exitBtn ada di menu dropdown (bisa tertutup); enterRoom men-set
   style.display = 'inline-block', exitRoom men-set 'none'. */
const diKamar = (page) => page.evaluate(() => document.getElementById('exitBtn').style.display === 'inline-block');
const sudahMasuk = (page) => page.evaluate(() => !document.getElementById('entryOverlay').classList.contains('open'));
async function keModeMasuk(page) {
  const teks = await page.textContent('#entryModeLink');
  if (/Sudah punya akun/.test(teks)) await klik(page, '#entryModeLink');
}

(async () => {
  if (LAMA) fs.writeFileSync(path.join(ROOT, '__lama.html'), execFileSync('git', ['show', 'main:index.html'], { cwd: ROOT }));
  const srv = buatServer(PORT); await srv.siap;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const catatan = { csp: [], err: [], unpkg: [], luar: [] };
  try {
    /* ---------- 1. penghuni lama: login pertama ---------- */
    const { ctx, page } = await halamanBaru(browser, catatan);
    await keModeMasuk(page);
    await page.fill('#entryName', 'dilla');
    if (LAMA) {
      /* klien lama: username + PIN saja langsung jadi penghuni */
      await page.fill('#entryPin', PIN.dilla);
      await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('login penghuni butuh password (bukan PIN saja)', !(await sudahMasuk(page)));
    } else {
      cek('mode MASUK minta password, bukan PIN', (await tampil(page, '#entryPass')) && !(await tampil(page, '#entryPin')));
      await klik(page, '#entryBtn'); await page.waitForTimeout(800);
      cek('penghuni tanpa password -> langkah PIN lama', await tampil(page, '#entryPin'));
      await page.fill('#entryPin', '000000'); await klik(page, '#entryBtn'); await page.waitForTimeout(800);
      cek('PIN lama salah ditolak', /PIN salah/.test(await page.textContent('#entryError')));
      await page.fill('#entryPin', PIN.dilla); await klik(page, '#entryBtn'); await page.waitForTimeout(800);
      cek('PIN benar -> buat password', (await tampil(page, '#entryPass2')) && !(await tampil(page, '#entryPin')));
      await page.fill('#entryPass', '12345678'); await page.fill('#entryPass2', '12345678');
      await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('password umum ditolak server', /terlalu umum/.test(await page.textContent('#entryError')));
      await page.fill('#entryPass', PW); await page.fill('#entryPass2', PW);
      await page.check('#entryIngat');
      await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('setup selesai -> masuk sebagai penghuni', await sudahMasuk(page));
      const jejak = await page.evaluate(() => JSON.stringify({ ls: Object.assign({}, localStorage), ss: Object.assign({}, sessionStorage), c: document.cookie }));
      cek('password & PIN tidak ada di localStorage/sessionStorage/document.cookie', !jejak.includes(PW) && !jejak.includes(PIN.dilla));
      cek('cookie sesi tidak terbaca JS (HttpOnly)', !/kosan_sesi/.test(jejak));
      const c = (await ctx.cookies()).find((x) => x.name === 'kosan_sesi');
      cek('cookie sesi HttpOnly + SameSite=Strict + persisten (Ingat saya)', c && c.httpOnly && c.sameSite === 'Strict' && c.expires > Date.now() / 1000 + 86400 * 29);
      const db = await (await fetch(BASE + '/__uji/db')).json();
      cek('log perangkat tercatat (HMAC IP, id perangkat)', db.log.length >= 2 && db.log.every((l) => /^[0-9a-f]{64}$/.test(l.ip_hmac || '')) && db.log.some((l) => l.perangkat));
    }

    /* ---------- 2. PIN kamar tiap kali ---------- */
    if (LAMA && !(await sudahMasuk(page))) { /* tidak mungkin di klien lama, tapi jaga-jaga */ }
    await klik(page, '#homeBtn'); await page.waitForTimeout(800);
    if (LAMA) {
      cek('masuk kamar meminta PIN (modal PIN muncul)', await tampil(page, '#pinOverlay'));
      cek('belum di dalam kamar sebelum PIN benar', !(await diKamar(page)));
    } else {
      cek('masuk kamar meminta PIN (modal PIN muncul)', await tampil(page, '#pinOverlay'));
      cek('belum di dalam kamar sebelum PIN benar', !(await diKamar(page)));
      await page.fill('#pinInput', '111111'); await klik(page, '#pinBtn'); await page.waitForTimeout(800);
      cek('PIN kamar salah ditolak server', /PIN salah/.test(await page.textContent('#pinError')) && !(await diKamar(page)));
      await page.fill('#pinInput', PIN.dilla); await klik(page, '#pinBtn'); await page.waitForTimeout(1200);
      cek('PIN benar -> masuk kamar', (await diKamar(page)) && !(await tampil(page, '#pinOverlay')));
      await klik(page, '#exitBtn'); await page.waitForTimeout(800);
      await klik(page, '#homeBtn'); await page.waitForTimeout(800);
      cek('masuk kamar lagi -> PIN diminta lagi (tidak diingat)', (await tampil(page, '#pinOverlay')) && !(await diKamar(page)) && (await page.inputValue('#pinInput')) === '');
      await klik(page, '#pinClose');

      /* ---------- 3. "Ingat saya": muat ulang ---------- */
      await page.reload(); await page.waitForTimeout(2000);
      cek('muat ulang -> "Masuk Kosan" satu ketukan tanpa password', (await tampil(page, '#entryKeluarAkun')) && !(await tampil(page, '#entryPass')) && /Masuk Kosan/.test(await page.textContent('#entryBtn')));
      await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('masuk lewat sesi tersimpan sebagai penghuni', await sudahMasuk(page));
      await klik(page, '#homeBtn'); await page.waitForTimeout(800);
      cek('sesudah muat ulang, kamar tetap minta PIN', await tampil(page, '#pinOverlay'));

      /* ---------- 4. login berikutnya pakai password; keluar akun ---------- */
      await page.reload(); await page.waitForTimeout(2000);
      await klik(page, '#entryKeluarAkun'); await page.waitForTimeout(800);
      cek('keluar akun -> kembali ke form username + password', await tampil(page, '#entryPass'));
      await page.reload(); await page.waitForTimeout(2000);
      cek('sesudah keluar akun, sesi tidak dipulihkan', !(await tampil(page, '#entryKeluarAkun')));
      await keModeMasuk(page);
      await page.fill('#entryName', 'dilla'); await page.fill('#entryPass', 'password-salah-1');
      await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('password salah ditolak', /Password salah/.test(await page.textContent('#entryError')) && !(await sudahMasuk(page)));
      await page.fill('#entryPass', PW); await klik(page, '#entryBtn'); await page.waitForTimeout(1500);
      cek('password benar -> masuk', await sudahMasuk(page));
    }
    await ctx.close();

    /* ---------- 5. tamu ---------- */
    const t = await halamanBaru(browser, catatan);
    await t.page.fill('#entryName', 'dilla'); await klik(t.page, '#entryGuestLink'); await t.page.waitForTimeout(800);
    cek('tamu dengan nama penghuni ditolak', !(await sudahMasuk(t.page)));
    await t.page.fill('#entryName', 'budi'); await klik(t.page, '#entryGuestLink'); await t.page.waitForTimeout(1500);
    cek('tamu masuk bebas tanpa login', await sudahMasuk(t.page));
    await klik(t.page, '#homeBtn'); await t.page.waitForTimeout(800);
    cek('tamu tidak bisa masuk kamar', !(await diKamar(t.page)) && !(await tampil(t.page, '#pinOverlay')));
    const tamuApi = await t.page.evaluate(async () => (await fetch('/api/kamar/masuk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: 13, pin: '135790' }) })).status);
    cek('tamu memanggil /api/kamar/masuk langsung -> 401', tamuApi === 401, 'status ' + tamuApi);
    await t.ctx.close();

    /* ---------- 6. daftar baru -> langsung buat password (review #7) ---------- */
    if (!LAMA) {
      const d = await halamanBaru(browser, catatan);
      await d.ctx.route('**/rpc/kosan_register', (route) => {
        const b = JSON.parse(route.request().postData() || '{}');
        const n = String(b.p_name).trim().toLowerCase();
        OCC.push({ room: 5, name: n });
        srv.db._lama.push({ room: 5, name: n, gender: b.p_gender, pin_hash: b.p_pin_hash, gagal: 0, kunci: 0 });
        return route.fulfill({ json: 5 });
      });
      await d.page.fill('#entryName', 'sari');
      await d.page.fill('#entryKey', 'KOSAN');
      await d.page.fill('#entryPin', '864200'); await d.page.fill('#entryPin2', '864200');
      await klik(d.page, '#entryBtn'); await d.page.waitForTimeout(2000);
      cek('sesudah daftar langsung ke "buat password" (tanpa ketik PIN lagi)', (await tampil(d.page, '#entryPass2')) && !(await tampil(d.page, '#entryPin')));
      await d.page.fill('#entryPass', PW); await d.page.fill('#entryPass2', PW);
      await klik(d.page, '#entryBtn'); await d.page.waitForTimeout(1500);
      cek('penghuni baru masuk sesudah buat password', await sudahMasuk(d.page));
      await d.ctx.close();
    }

    cek('0 error CSP', catatan.csp.length === 0, catatan.csp.slice(0, 2).join(' | '));
    cek('0 request ke unpkg', catatan.unpkg.length === 0);
    cek('0 error JavaScript halaman', catatan.err.length === 0, catatan.err.slice(0, 2).join(' | '));
    console.log('request luar yang diblokir (bukan error):', [...new Set(catatan.luar.map((u) => u.split('/').slice(0, 3).join('/')))].join(', ') || '-');
  } finally {
    await browser.close();
    srv.server.close();
    if (LAMA) fs.rmSync(path.join(ROOT, '__lama.html'), { force: true });
  }
  const gagal = hasil.filter((h) => !h.ok).length;
  console.log('\n' + (hasil.length - gagal) + '/' + hasil.length + ' PASS' + (LAMA ? ' (mode --lama: klien dari main)' : ''));
  process.exitCode = gagal ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
