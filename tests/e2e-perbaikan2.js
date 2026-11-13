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
      const catatanHilang = () => page.evaluate(() => !document.getElementById('entryNotePerangkat')
        && !document.body.innerText.includes('mencatat perangkat') && !document.body.innerText.includes('terlihat oleh semua pemain online'));
      cek('C0a mode DAFTAR: dua catatan lama tidak tampil (14 Nov #3)', await catatanHilang());
      await keModeMasuk(page);
      cek('C0b mode MASUK: dua catatan lama tidak tampil; password tanpa autocomplete', (await catatanHilang())
        && (await page.evaluate(() => !document.getElementById('entryPass').hasAttribute('autocomplete'))));
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
        cek('C6b tahap setup: dua catatan lama tidak tampil', await catatanHilang());
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
        cek('C11 kolom password tanpa atribut autocomplete di tahap buat password (14 Nov #4)', await page.evaluate(() =>
          !document.getElementById('entryPass').hasAttribute('autocomplete') && !document.getElementById('entryPass2').hasAttribute('autocomplete')));
        /* ---------- D. PIN kamar lewat keypad (14 Nov #2), klik sungguhan ---------- */
        const titik = () => page.evaluate(() => document.querySelectorAll('#pinTitik span.isi').length);
        const tap = (k) => page.click(k === 'hapus' || k === 'buka' ? '#pinPad [data-aksi="' + k + '"]' : '#pinPad [data-digit="' + k + '"]');
        const padMati = () => page.evaluate(() => [...document.querySelectorAll('#pinPad button')].every((b) => b.disabled));
        await page.evaluate(() => document.getElementById('homeBtn').click());
        await page.waitForTimeout(500);
        cek('D0 overlay PIN = keypad + 6 titik; kolom teks tidak tampil dan tidak fokus (keyboard HP tidak dipanggil)',
          (await tampil(page, '#pinPad')) && (await page.evaluate(() => document.querySelectorAll('#pinTitik span').length)) === 6
          && !(await tampil(page, '#pinInput')) && !(await tampil(page, '#pinBtn'))
          && (await page.evaluate(() => !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || ''))));
        cek('D1 tombol keypad min. 56 px', await page.evaluate(() => [...document.querySelectorAll('#pinPad button')].every((b) => b.getBoundingClientRect().height >= 56)));
        await tap('1'); await tap('2'); await tap('3');
        const t3 = await titik();
        await tap('hapus');
        cek('D2 tiap digit mengisi satu titik; ⌫ menghapus digit terakhir', t3 === 3 && (await titik()) === 2, t3 + ' -> ' + (await titik()));
        await tap('buka');
        cek('D3 ✓ dengan <6 digit -> pesan validasi lama', /Masukkan PIN kamar 6 digit/.test(await page.textContent('#pinError')));
        await tap('hapus'); await tap('hapus');
        for (const d of '111111') await tap(d);
        await page.waitForTimeout(300);
        cek('D4 digit ke-6 kirim otomatis: keypad terkunci + "Memproses…" terlihat', (await padMati()) && (await tampil(page, '#pinStatus'))
          && /Memproses/.test(await page.textContent('#pinStatus')));
        await page.waitForTimeout(JEDA + 1500);
        cek('D5 PIN salah: titik kosong + pesan error + keypad aktif lagi', (await titik()) === 0
          && /PIN salah/.test(await page.textContent('#pinError')) && (await tampil(page, '#pinError'))
          && !(await padMati()) && !(await tampil(page, '#pinStatus')));
        for (const d of '135790') await tap(d);
        await page.waitForTimeout(JEDA + 2000);
        cek('D6 PIN benar lewat keypad -> masuk kamar', await page.evaluate(() => document.getElementById('exitBtn').style.display === 'inline-block')
          && !(await tampil(page, '#pinOverlay')));
        /* muat di layar: landscape pendek (tinggi 412) + portrait */
        for (const [w, h, label] of [[915, 412, 'landscape 915x412'], [740, 360, 'landscape 740x360'], [412, 860, 'portrait 412x860']]) {
          /* halaman sudah layar penuh (14 Nov sebelumnya: auto-landscape); ukuran jendela hanya bisa diubah di luar layar penuh */
          await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : null));
          await page.waitForTimeout(300);
          await page.setViewportSize({ width: w, height: h });
          await page.evaluate(() => document.getElementById('exitBtn').click());
          await page.waitForTimeout(400);
          await page.evaluate(() => document.getElementById('homeBtn').click());
          await page.waitForTimeout(400);
          const ukur = await page.evaluate(() => {
            const c = document.getElementById('pinCard').getBoundingClientRect();
            const btn = [...document.querySelectorAll('#pinPad button')].map((b) => b.getBoundingClientRect());
            const card = document.getElementById('pinCard');
            return { top: Math.round(c.top), bawah: Math.round(c.bottom), tinggi: innerHeight, gulir: card.scrollHeight - card.clientHeight,
              tombolBawah: Math.round(Math.max(...btn.map((r) => r.bottom))), tombolAtas: Math.round(Math.min(...btn.map((r) => r.top))) };
          });
          cek('D7 keypad muat tanpa terpotong/gulir (' + label + ')', ukur.top >= 0 && ukur.bawah <= ukur.tinggi && ukur.tombolBawah <= ukur.tinggi && ukur.gulir <= 1, JSON.stringify(ukur));
          if (label.startsWith('landscape 915')) await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'kosan-keypad-landscape.png') }).catch(() => {});
          await page.click('#pinClose').catch(() => page.evaluate(() => document.getElementById('pinClose').click()));
        }
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
