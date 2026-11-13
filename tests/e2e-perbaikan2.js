'use strict';
/* Playtest perbaikan ronde 2 (hasil tes HP Ryan di preview). Benign: tanpa
   pesan racun, broker diblokir, Supabase anon di-mock.
   - Jaringan diperlambat (JEDA ms per panggilan /api/* + kosan_occupants)
     supaya rantai login → muatOccupants keluar dari jendela gestur
     browser (Chrome ±5 detik), seperti di HP.
   - requestFullscreen disadap: dicatat apakah navigator.userActivation
     masih aktif saat dipanggil (= browser mengizinkan layar penuh).
   - Klik memakai page.click (input sungguhan), bukan el.click(), supaya
     dihitung sebagai gestur pengguna.
   Pakai:
     PLAYWRIGHT_CORE=... CHROME_PATH=... node tests/e2e-perbaikan2.js
     ... node tests/e2e-perbaikan2.js --ref=<git-ref>   (klien dari commit lain, untuk bukti RED) */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { buatServer } = require('./lokal');

const PORT = 8794, BASE = 'http://127.0.0.1:' + PORT;
const JEDA = 3000;
const ROOT = path.join(__dirname, '..');
const refArg = process.argv.find((a) => a.startsWith('--ref='));
const REF = refArg ? refArg.slice(6) : null;
const HALAMAN = REF ? '/__ref.html' : '/';
const OCC = [{ room: 3, name: 'rina' }, { room: 13, name: 'dilla' }, { room: 14, name: 'dil' }];
const PW = 'kos-rumah-kedua';
const hasil = [];
const cek = (nama, ok, info) => { hasil.push({ nama, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + nama + (info ? '  [' + info + ']' : '')); };
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function halamanBaru(browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: false });
  await ctx.addInitScript(() => {
    window.__fs = [];
    const asli = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () {
      window.__fs.push({ t: performance.now(), aktif: !!(navigator.userActivation && navigator.userActivation.isActive) });
      return asli ? asli.apply(this, arguments) : Promise.reject(new Error('tidak didukung'));
    };
    window.__keluarFs = 0;
    const asliK = Document.prototype.exitFullscreen;
    Document.prototype.exitFullscreen = function () { window.__keluarFs++; return asliK ? asliK.apply(this, arguments) : Promise.resolve(); };
  });
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE + '/api/')) { await tidur(JEDA); return route.continue(); }
    if (u.startsWith(BASE)) return route.continue();
    if (u.includes('supabase.co/rest/v1/rpc/kosan_occupants')) { await tidur(JEDA); return route.fulfill({ json: OCC }); }
    return route.abort();
  });
  const page = await ctx.newPage();
  const galat = [];
  page.on('pageerror', (e) => galat.push(e.message));
  await page.goto(BASE + HALAMAN);
  await page.waitForTimeout(JEDA + 1500); /* daftar penghuni boot (diperlambat) */
  return { ctx, page, galat };
}
const tampil = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return false;
  for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}, sel);
const ada = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const sudahMasuk = (page) => page.evaluate(() => !document.getElementById('entryOverlay').classList.contains('open'));
const tungguMasuk = async (page, ms) => { const batas = Date.now() + ms; while (Date.now() < batas) { if (await sudahMasuk(page)) return true; await page.waitForTimeout(250); } return false; };
const tombol = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); return { teks: b.textContent.trim(), mati: b.disabled }; }, sel);
async function keModeMasuk(page) {
  if (/Sudah punya akun/.test(await page.textContent('#entryModeLink'))) await page.click('#entryModeLink');
}

(async () => {
  if (REF) fs.writeFileSync(path.join(ROOT, '__ref.html'), execFileSync('git', ['show', REF + ':index.html'], { cwd: ROOT }));
  const srv = buatServer(PORT); await srv.siap;
  /* rina sudah punya password (lewat API langsung, tanpa jeda) */
  const api = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
  const tk = await api('/api/setup/pin', { username: 'rina', pin: '246810' });
  await api('/api/setup/password', { tiket: tk.tiket, password: PW });

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    /* ---------- A. login password: tombol sibuk + layar penuh di dalam gestur ---------- */
    {
      const { ctx, page, galat } = await halamanBaru(browser);
      await keModeMasuk(page);
      await page.fill('#entryName', 'rina'); await page.fill('#entryPass', PW);
      const t0 = await page.evaluate(() => performance.now());
      await page.click('#entryBtn');
      await page.waitForTimeout(300);
      const b = await tombol(page, '#entryBtn');
      cek('A1 login: tombol "Memproses…" + disabled selama menunggu server', b.mati && /Memproses/.test(b.teks), JSON.stringify(b));
      const masuk = await tungguMasuk(page, 4 * JEDA + 4000);
      cek('A2 login: akhirnya masuk dunia', masuk);
      const fsLog = await page.evaluate(() => window.__fs);
      const awal = fsLog.find((x) => x.aktif);
      cek('A3 layar penuh diminta selagi gestur masih aktif (sinkron di ketukan)', !!awal && awal.t - t0 < 1000,
        fsLog.map((x) => Math.round(x.t - t0) + 'ms/' + (x.aktif ? 'aktif' : 'basi')).join(', ') || 'tidak dipanggil');
      cek('A4 masukSebagai tetap mencoba lagi (percobaan kedua)', fsLog.length >= 2 || (await page.evaluate(() => !!document.fullscreenElement)));
      cek('A5 tanpa error JavaScript', galat.length === 0, galat.join(' | '));
      await ctx.close();
    }
    /* ---------- B. password salah: layar penuh dibatalkan, form normal ---------- */
    {
      const { ctx, page } = await halamanBaru(browser);
      await keModeMasuk(page);
      await page.fill('#entryName', 'rina'); await page.fill('#entryPass', 'password-salah-1');
      await page.click('#entryBtn');
      await page.waitForTimeout(JEDA + 1500);
      const st = await page.evaluate(() => ({ err: document.getElementById('entryError').textContent, fs: !!document.fullscreenElement, keluar: window.__keluarFs, minta: window.__fs.length }));
      cek('B1 password salah: tetap di form + pesan salah', /Password salah/.test(st.err) && !(await sudahMasuk(page)), st.err);
      cek('B2 password salah: tidak tertinggal di layar penuh', !st.fs, JSON.stringify(st));
      const b = await tombol(page, '#entryBtn');
      cek('B3 sesudah gagal, tombol aktif lagi dengan label semula', !b.mati && /Masuk sebagai penghuni/.test(b.teks), JSON.stringify(b));
      await ctx.close();
    }
    /* ---------- C. penghuni lama: catatan + tautan langsung ke langkah PIN ---------- */
    {
      const { ctx, page, galat } = await halamanBaru(browser);
      await keModeMasuk(page);
      cek('C1 mode MASUK menampilkan catatan untuk penghuni lama', await tampil(page, '#entryNotePenghuniLama'));
      const punyaTautan = await ada(page, '#entryLoginPertama');
      cek('C2 ada tautan "Login pertama kali? Buat password"', punyaTautan && /Login pertama kali/.test(await page.textContent('#entryLoginPertama')));
      if (punyaTautan) {
        await page.fill('#entryName', 'dilla');
        await page.click('#entryLoginPertama');
        cek('C3 tautan lompat ke langkah PIN kamar (tanpa ketuk Masuk dulu)', (await tampil(page, '#entryPin')) && !(await tampil(page, '#entryPass')));
        await page.fill('#entryPin', '135790');
        const nFs = await page.evaluate(() => window.__fs.length);
        await page.click('#entryBtn');
        await page.waitForTimeout(300);
        const b = await tombol(page, '#entryBtn');
        cek('C4 setup PIN: tombol "Memproses…" + disabled', b.mati && /Memproses/.test(b.teks), JSON.stringify(b));
        await page.waitForTimeout(JEDA + 1000);
        cek('C5 ketukan langkah PIN tidak memicu layar penuh (form boleh portrait)', (await page.evaluate(() => window.__fs.length)) === nFs);
        cek('C6 lanjut ke buat password', await tampil(page, '#entryPass2'));
        await page.fill('#entryPass', PW); await page.fill('#entryPass2', PW);
        const t0 = await page.evaluate(() => performance.now());
        await page.click('#entryBtn');
        await page.waitForTimeout(300);
        const b2 = await tombol(page, '#entryBtn');
        cek('C7 simpan password: tombol "Memproses…" + disabled', b2.mati && /Memproses/.test(b2.teks), JSON.stringify(b2));
        cek('C8 masuk dunia sesudah buat password', await tungguMasuk(page, 4 * JEDA + 4000));
        const fsLog = await page.evaluate((n) => window.__fs.slice(n), nFs);
        const awal = fsLog.find((x) => x.aktif);
        cek('C9 layar penuh diminta selagi gestur aktif saat simpan password', !!awal && awal.t - t0 < 1000,
          fsLog.map((x) => Math.round(x.t - t0) + 'ms/' + (x.aktif ? 'aktif' : 'basi')).join(', ') || 'tidak dipanggil');
        /* ---------- D. PIN kamar: tombol sibuk ---------- */
        await page.evaluate(() => document.getElementById('homeBtn').click());
        await page.waitForTimeout(500);
        await page.fill('#pinInput', '135790');
        await page.click('#pinBtn');
        await page.waitForTimeout(300);
        const b3 = await tombol(page, '#pinBtn');
        cek('D1 PIN kamar: tombol "Memproses…" + disabled', b3.mati && /Memproses/.test(b3.teks), JSON.stringify(b3));
        await page.waitForTimeout(JEDA + 1500);
        const b4 = await tombol(page, '#pinBtn');
        cek('D2 PIN kamar: tombol kembali "Buka pintu" sesudah selesai', !b4.mati && /Buka pintu/.test(b4.teks), JSON.stringify(b4));
      }
      cek('C10 tanpa error JavaScript', galat.length === 0, galat.join(' | '));
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.server.close();
    if (REF) fs.rmSync(path.join(ROOT, '__ref.html'), { force: true });
  }
  const gagal = hasil.filter((h) => !h.ok).length;
  console.log('\n' + (hasil.length - gagal) + '/' + hasil.length + ' PASS' + (REF ? ' (klien dari ' + REF + ')' : ''));
  process.exitCode = gagal ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
