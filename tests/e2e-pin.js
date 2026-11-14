'use strict';
/* Playtest browser perbaikan 9 (PIN saja, tanpa password). Benign: tanpa
   pesan racun, broker MQTT diblokir, daftar penghuni Supabase di-mock dari
   database palsu server uji lokal (tests/lokal.js). Klik memakai page.click
   (input sungguhan, dihitung gestur pengguna).
   Menggantikan tests/e2e-fase-a.js + tests/e2e-perbaikan2.js (keduanya
   menguji alur password yang sudah dicabut).
   Pakai:
     PLAYWRIGHT_CORE=/path/ke/playwright-core CHROME_PATH=/path/ke/chrome node tests/e2e-pin.js */
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { buatServer } = require('./lokal');

const PORT = 8795, BASE = 'http://127.0.0.1:' + PORT;
const hasil = [];
const cek = (nama, ok, info) => { hasil.push({ nama, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + nama + (info ? '  [' + info + ']' : '')); };

(async () => {
  const srv = buatServer(PORT); await srv.siap;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const catatan = { csp: [], err: [], unpkg: [], anon: [] };

  async function halamanBaru(viewport) {
    const ctx = await browser.newContext({ viewport: viewport || { width: 900, height: 700 } });
    await ctx.addInitScript(() => {
      window.__fs = [];
      const asli = Element.prototype.requestFullscreen;
      Element.prototype.requestFullscreen = function () {
        window.__fs.push({ t: performance.now(), aktif: !!(navigator.userActivation && navigator.userActivation.isActive) });
        return asli ? asli.apply(this, arguments) : Promise.reject(new Error('tidak didukung'));
      };
    });
    await ctx.route('**/*', async (route) => {
      const u = route.request().url();
      if (u.startsWith(BASE)) return route.continue();
      if (u.includes('supabase.co/rest/v1/rpc/kosan_occupants')) {
        return route.fulfill({ json: await (await fetch(BASE + '/__uji/occupants')).json() });
      }
      if (u.includes('supabase.co/rest/v1/rpc/')) catatan.anon.push(u.split('/rpc/')[1]);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) catatan.csp.push(m.text()); });
    page.on('pageerror', (e) => catatan.err.push(e.message));
    page.on('request', (r) => { if (/unpkg\.com/.test(r.url())) catatan.unpkg.push(r.url()); });
    await page.goto(BASE + '/');
    await page.waitForTimeout(1500);
    return { ctx, page };
  }
  const tampil = (page, sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return false;
    for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
  const sudahMasuk = (page) => page.evaluate(() => !document.getElementById('entryOverlay').classList.contains('open'));
  const diKamar = (page) => page.evaluate(() => document.getElementById('exitBtn').style.display === 'inline-block');
  const keypadTampil = (page) => tampil(page, '#pinPad');
  const titik = (page) => page.evaluate(() => document.querySelectorAll('#pinTitik span.isi').length);
  const ketikPin = async (page, pin) => { for (const d of pin) await page.click('#pinPad [data-digit="' + d + '"]'); };
  const teks = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);
  const klikJs = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  async function keModeMasuk(page) { if (/Sudah punya akun/.test(await teks(page, '#entryModeLink'))) await page.click('#entryModeLink'); }

  try {
    /* ---------- A. tidak ada kolom password ---------- */
    let { ctx, page } = await halamanBaru();
    cek('A1 tidak ada input type=password di halaman (mode DAFTAR)', await page.evaluate(() => !document.querySelector('input[type="password"]')));
    await keModeMasuk(page);
    cek('A2 mode MASUK: hanya username + tombol "Masuk", tanpa kolom PIN/password', (await tampil(page, '#entryName'))
      && /^Masuk$/.test((await teks(page, '#entryBtn')).trim()) && (await page.evaluate(() => !document.querySelector('input[type="password"]'))));

    /* ---------- B. nama bukan penghuni ---------- */
    await page.fill('#entryName', 'orang-asing');
    await page.click('#entryBtn'); await page.waitForTimeout(500);
    cek('B1 nama bukan penghuni -> pesan belum-terdaftar, keypad TIDAK muncul',
      /belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu/.test(await teks(page, '#entryError')) && !(await keypadTampil(page)));

    /* ---------- C. login rina: username -> keypad PIN ---------- */
    await page.fill('#entryName', 'rina');
    await page.check('#entryIngat');
    await page.click('#entryBtn'); await page.waitForTimeout(400);
    cek('C1 username penghuni -> keypad PIN muncul', (await keypadTampil(page)) && /@rina/.test(await teks(page, '#pinJudul')));
    await ketikPin(page, '000000'); await page.waitForTimeout(1500);
    cek('C2 PIN salah -> error, titik kosong, belum masuk', /PIN salah/.test(await teks(page, '#pinError')) && (await titik(page)) === 0 && !(await sudahMasuk(page)));
    const db1 = await (await fetch(BASE + '/__uji/db')).json();
    cek('C3 PIN salah tidak membuat sesi', db1.sesi.filter((x) => x.room === 3).length === 0);
    const fsSesudahSalah = await page.evaluate(() => ({ fs: !!document.fullscreenElement, n: window.__fs.length }));
    const t0 = await page.evaluate(() => performance.now());
    await ketikPin(page, '246810'); await page.waitForTimeout(1500);
    cek('C4 PIN benar -> masuk sebagai penghuni', (await sudahMasuk(page)) && /@rina/.test(await teks(page, '#whoami')) && !(await keypadTampil(page)));
    const fsLog = (await page.evaluate(() => window.__fs)).filter((x) => x.t >= t0); /* hanya sesudah PIN benar mulai diketik */
    const awal = fsLog.find((x) => x.aktif);
    cek('C2b PIN salah: layar penuh dari ketukan itu dibatalkan (form tidak tertinggal di layar penuh)', !fsSesudahSalah.fs && fsSesudahSalah.n >= 1, JSON.stringify(fsSesudahSalah));
    cek('C5 layar penuh diminta lagi selagi gestur aktif (ketukan digit ke-6 PIN benar)', !!awal && awal.t - t0 < 2000,
      fsLog.map((x) => Math.round(x.t - t0) + 'ms/' + (x.aktif ? 'aktif' : 'basi')).join(', ') || 'tidak dipanggil');
    const jejak = await page.evaluate(() => JSON.stringify({ ls: Object.assign({}, localStorage), ss: Object.assign({}, sessionStorage), c: document.cookie }));
    cek('C6 PIN tidak ada di localStorage/sessionStorage/document.cookie; cookie sesi tidak terbaca JS', !jejak.includes('246810') && !/kosan_sesi/.test(jejak));
    const c = (await ctx.cookies()).find((x) => x.name === 'kosan_sesi');
    cek('C7 cookie sesi HttpOnly + SameSite=Strict + persisten (Ingat saya)', c && c.httpOnly && c.sameSite === 'Strict' && c.expires > Date.now() / 1000 + 86400 * 29);

    /* ---------- D. PIN kamar tetap tiap kali ---------- */
    await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : null));
    await klikJs(page, '#homeBtn'); await page.waitForTimeout(500);
    cek('D1 masuk kamar -> keypad PIN kamar', (await keypadTampil(page)) && /Masuk Kamar 3/.test(await teks(page, '#pinJudul')) && !(await diKamar(page)));
    await ketikPin(page, '111111'); await page.waitForTimeout(800);
    cek('D2 PIN kamar salah ditolak', /PIN salah/.test(await teks(page, '#pinError')) && !(await diKamar(page)));
    await ketikPin(page, '246810'); await page.waitForTimeout(1200);
    cek('D3 PIN kamar benar -> masuk kamar', await diKamar(page));
    await klikJs(page, '#exitBtn'); await page.waitForTimeout(500);
    await klikJs(page, '#homeBtn'); await page.waitForTimeout(500);
    cek('D4 masuk kamar lagi -> PIN diminta lagi (tidak diingat)', (await keypadTampil(page)) && (await titik(page)) === 0 && !(await diKamar(page)));
    await page.click('#pinClose');

    /* ---------- E. Ingat saya + keluar akun ---------- */
    await page.reload(); await page.waitForTimeout(2000);
    cek('E1 muat ulang -> "Masuk Kosan" satu ketukan (sesi tersimpan)', (await tampil(page, '#entryKeluarAkun')) && /Masuk Kosan/.test(await teks(page, '#entryBtn')));
    await page.click('#entryBtn'); await page.waitForTimeout(1500);
    cek('E2 masuk lewat sesi tersimpan sebagai penghuni', (await sudahMasuk(page)) && /@rina/.test(await teks(page, '#whoami')));
    await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : null));
    await klikJs(page, '#homeBtn'); await page.waitForTimeout(500);
    cek('E3 sesudah muat ulang, kamar tetap minta PIN', await keypadTampil(page));
    await page.reload(); await page.waitForTimeout(2000);
    await page.click('#entryKeluarAkun'); await page.waitForTimeout(800);
    await page.reload(); await page.waitForTimeout(2000);
    cek('E4 sesudah keluar akun, sesi tidak dipulihkan', !(await tampil(page, '#entryKeluarAkun')));
    await ctx.close();

    /* ---------- F. tamu sekali ketuk ---------- */
    ({ ctx, page } = await halamanBaru());
    await page.fill('#entryName', 'rina'); /* diabaikan: tamu tidak memilih nama */
    await page.click('#entryGuestLink'); await page.waitForTimeout(1200);
    const who = await teks(page, '#whoami');
    cek('F1 tamu sekali ketuk -> masuk sebagai "Tamu-1 · tamu"', (await sudahMasuk(page)) && /Tamu-1 · tamu/.test(who), who.trim());
    await klikJs(page, '#homeBtn'); await page.waitForTimeout(500);
    cek('F2 tamu tidak bisa masuk kamar (tanpa keypad)', !(await diKamar(page)) && !(await keypadTampil(page)));
    const st = await page.evaluate(async () => (await fetch('/api/kamar/masuk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: 3, pin: '246810' }) })).status);
    cek('F3 tamu memanggil /api/kamar/masuk langsung -> 401', st === 401, 'status ' + st);
    cek('F4 nama tamu tidak disimpan sebagai username', await page.evaluate(() => localStorage.getItem('kosan3d-nama') !== 'Tamu-1'));
    await ctx.close();

    /* ---------- G. daftar: buat PIN di keypad, PIN != username ---------- */
    ({ ctx, page } = await halamanBaru({ width: 740, height: 360 }));
    await page.fill('#entryName', '135799');
    await page.fill('#entryKey', 'KOSAN');
    await page.click('#entryBtn'); await page.waitForTimeout(400);
    cek('G1 daftar -> keypad "Buat PIN"', (await keypadTampil(page)) && /Buat PIN/.test(await teks(page, '#pinJudul')));
    const ukur = await page.evaluate(() => { const r = document.getElementById('pinCard').getBoundingClientRect(); const k = document.getElementById('pinCard'); return { top: r.top, bawah: r.bottom, h: innerHeight, gulir: k.scrollHeight - k.clientHeight }; });
    cek('G2 keypad muat di landscape pendek 740x360 tanpa gulir', ukur.top >= 0 && ukur.bawah <= ukur.h && ukur.gulir <= 1, JSON.stringify(ukur));
    await ketikPin(page, '135799'); await page.waitForTimeout(400);
    cek('G3 PIN == username ditolak di klien (sebelum kirim)', /PIN tidak boleh sama dengan username/.test(await teks(page, '#pinError')) && /Buat PIN/.test(await teks(page, '#pinJudul')));
    await ketikPin(page, '246802'); await page.waitForTimeout(300);
    cek('G4 PIN pertama diterima -> "Ulangi PIN"', /Ulangi PIN/.test(await teks(page, '#pinJudul')));
    await ketikPin(page, '246803'); await page.waitForTimeout(300);
    cek('G5 PIN kedua beda -> kembali ke "Buat PIN" + pesan', /Buat PIN/.test(await teks(page, '#pinJudul')) && /tidak sama/.test(await teks(page, '#pinError')));
    await ketikPin(page, '246802'); await page.waitForTimeout(300);
    await ketikPin(page, '246802'); await page.waitForTimeout(1800);
    cek('G6 daftar selesai -> langsung masuk sebagai penghuni baru', (await sudahMasuk(page)) && /@135799/.test(await teks(page, '#whoami')));
    const occ = await (await fetch(BASE + '/__uji/occupants')).json();
    cek('G7 penghuni baru tercatat (lewat /api/daftar)', occ.some((x) => x.name === '135799'));
    await ctx.close();

    /* ---------- H. tamu saat kosan PENUH (perbaikan 10) ---------- */
    {
      const penuh = Array.from({ length: 20 }, (_, i) => ({ room: i + 1, name: 'penghuni' + (i + 1) }));
      const ctxH = await browser.newContext({ viewport: { width: 900, height: 700 } });
      await ctxH.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(BASE)) return route.continue();
        if (u.includes('supabase.co/rest/v1/rpc/kosan_occupants')) return route.fulfill({ json: penuh });
        return route.abort();
      });
      const pg = await ctxH.newPage();
      pg.on('pageerror', (e) => catatan.err.push(e.message));
      await pg.goto(BASE + '/'); await pg.waitForTimeout(1500);
      await pg.click('#entryGuestLink'); await pg.waitForTimeout(1200);
      const w = await teks(pg, '#whoami');
      cek('H1 tamu saat penuh -> HUD "Tamu-1 · tamu" (bukan "kamu")', /Tamu-1 · tamu/.test(w) && !/kamu · tamu/.test(w), w.trim());
      cek('H2 kartu "Kosan penuh" tetap muncul', /Kosan penuh/.test(await teks(pg, '#cardTitle')));
      await klikJs(pg, '#homeBtn'); await pg.waitForTimeout(400);
      cek('H3 KAMAR KAMU saat tamu penuh -> toast, tidak masuk kamar', /Tamu tidak punya kamar/.test(await teks(pg, '#toast')) && !(await diKamar(pg)) && !(await keypadTampil(pg)));
      await ctxH.close();
    }

    cek('Z1 0 error CSP', catatan.csp.length === 0, catatan.csp.slice(0, 2).join(' | '));
    cek('Z2 0 request ke unpkg', catatan.unpkg.length === 0);
    cek('Z3 0 error JavaScript halaman', catatan.err.length === 0, catatan.err.slice(0, 2).join(' | '));
    cek('Z4 klien tidak memanggil kosan_login / kosan_register anon (hanya kosan_occupants)', catatan.anon.length === 0, catatan.anon.join(','));
  } finally {
    await browser.close();
    srv.server.close();
  }
  const gagal = hasil.filter((h) => !h.ok).length;
  console.log('\n' + (hasil.length - gagal) + '/' + hasil.length + ' PASS');
  process.exitCode = gagal ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
