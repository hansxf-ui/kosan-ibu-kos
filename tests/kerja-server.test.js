'use strict';
/* Tes server Kerja & Belanja (Ryan 16 Nov): aturan upah/pangkat/katalog (api/_lib/kerja.js),
   endpoint /api/dompet, /api/kerja, /api/belanja (api/_lib/app.js) dengan database palsu
   (tests/fake-db.js meniru supabase/migrations/20261116_kerja_belanja.sql), adapter db.js,
   dan pemeriksaan statis migrasi SQL. Tanpa jaringan. Jalankan: node --test tests/kerja-server.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../api/_lib/kerja');
const { buatApp, BATAS_PENGHUNI } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 13, name: 'dilla', gender: 'Cewek', pin: '135790' }
];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token, extra) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}, extra || {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
const MENIT = 60000;

function siapkan(awal) {
  let jam = Date.parse(awal || '2026-11-14T03:00:00Z'); /* 10.00 WIB */
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => jam });
  return { db, app, majukan: (ms) => { jam += ms; }, setel: (iso) => { jam = Date.parse(iso); } };
}
async function login(app, username, pin) {
  const r = await app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
async function shiftLengkap(S, tok, pekerjaan, hasil) { /* daftar (idempoten) + mulai + tunggu minDetik + selesai */
  await S.app.kerja(post({ aksi: 'daftar', pekerjaan }, tok));
  const m = await S.app.kerja(post({ aksi: 'mulai', pekerjaan }, tok));
  assert.equal(m.status, 200, JSON.stringify(m.body));
  S.majukan(K.PEKERJAAN[pekerjaan].minDetik * 1000 + 5000);
  const s = await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: hasil || { benar: 6, salah: 0, cepat: 1 } }, tok));
  assert.equal(s.status, 200, JSON.stringify(s.body));
  return s.body;
}

/* ---------- aturan murni ---------- */
test('upah: server yang menghitung, dijepit, kelipatan Rp500, maks Rp15.000 per shift', () => {
  assert.deepEqual(K.upahShift('kafe', 0, { benar: 6, salah: 0, cepat: 1 }), { gaji: 7000, tip: 4000, total: 11000, pangkat: 0, benar: 6, salah: 0 });
  assert.equal(K.upahShift('kafe', 15, { benar: 6, salah: 0, cepat: 1 }).total, 15000);
  assert.deepEqual(K.upahShift('kafe', 0, { benar: 0, salah: 0, cepat: 1 }), { gaji: 2000, tip: 0, total: 2000, pangkat: 0, benar: 0, salah: 0 });
  /* nilai aneh dari klien: dijepit, bukan dipercaya */
  assert.equal(K.upahShift('kafe', 0, { benar: 999, salah: -5, cepat: 7 }).total, 11000);
  assert.equal(K.upahShift('kafe', 0, { benar: '6', salah: 'x', cepat: NaN }).total, 2000);
  assert.equal(K.upahShift('kafe', 0, null).total, 2000);
  assert.equal(K.upahShift('kafe', 0, { benar: 6, salah: 10, cepat: 1 }).tip, 0);
  assert.equal(K.upahShift('__proto__', 0, {}), null);
  for (const id of Object.keys(K.PEKERJAAN)) {
    const p = K.PEKERJAAN[id], maks = K.upahShift(id, 99, { benar: p.pesanan, salah: 0, cepat: 1 });
    assert.ok(maks.total <= 15000 && maks.total <= 20000, id + ' maks ' + maks.total); /* 20000 = batas SQL */
    assert.ok(p.minDetik >= 90, id + ' shift minimal 90 dtk');
    for (let pk = 0; pk < 3; pk++) assert.equal(K.upahShift(id, K.PANGKAT_SHIFT[pk], { benar: p.pesanan, salah: 0, cepat: 1 }).total % 500, 0);
  }
});

test('pangkat per jumlah shift selesai; jam/tanggal/bulan WIB; jam ronda 20.00-04.00', () => {
  assert.deepEqual([0, 4, 5, 14, 15, 200, -3, '9', null].map(K.pangkatDari), [0, 0, 1, 1, 2, 2, 0, 0, 0]);
  assert.equal(K.tanggalWib(Date.parse('2026-11-16T17:30:00Z')), '2026-11-17'); /* 00.30 WIB */
  assert.equal(K.bulanWib(Date.parse('2026-11-30T17:00:00Z')), '2026-12');
  assert.equal(K.bulanLabel('2026-11'), 'November 2026');
  assert.equal(K.bulanLabel('xx'), '');
  assert.equal(K.rondaBuka(Date.parse('2026-11-16T12:59:00Z')), false); /* 19.59 */
  assert.equal(K.rondaBuka(Date.parse('2026-11-16T13:00:00Z')), true); /* 20.00 */
  assert.equal(K.rondaBuka(Date.parse('2026-11-16T20:59:00Z')), true); /* 03.59 */
  assert.equal(K.rondaBuka(Date.parse('2026-11-16T21:00:00Z')), false); /* 04.00 */
});

test('katalog: id aman, harga bulat positif, aksesori punya slot; __proto__ bukan barang', () => {
  for (const [id, b] of Object.entries(K.KATALOG)) {
    assert.match(id, /^[a-z0-9_]{2,30}$/);
    assert.ok(Number.isInteger(b.harga) && b.harga > 0 && b.harga <= 1000000, id);
    assert.ok(['kafe', 'aksesori', 'dekor'].includes(b.jenis), id);
    if (b.jenis === 'aksesori') assert.ok(['topi', 'kacamata', 'tas'].includes(b.slot), id);
  }
  assert.equal(K.barangDari('__proto__'), null);
  assert.equal(K.barangDari('constructor'), null);
  assert.equal(K.pekerjaanDari('toString'), null);
  assert.ok(Number.isInteger(K.SEWA_HARGA) && K.SEWA_HARGA > 0);
});

/* ---------- /api/dompet + /api/kerja ---------- */
test('dompet: hanya penghuni (tanpa sesi 401); dompet baru kosong + semua pekerjaan belum terdaftar', async () => {
  const S = siapkan();
  assert.equal((await S.app.dompet(get(null))).status, 401);
  assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kafe' }, null))).status, 401);
  assert.equal((await S.app.belanja(post({ aksi: 'sewa' }, null))).status, 401);
  const tok = await login(S.app, 'rina', '246810');
  const d = await S.app.dompet(get(tok));
  assert.equal(d.status, 200);
  assert.equal(d.body.saldo, 0);
  assert.deepEqual(Object.keys(d.body.pekerjaan), ['kafe', 'warung', 'ronda', 'laundry']);
  assert.ok(Object.values(d.body.pekerjaan).every((p) => p.terdaftar === false && p.shift === 0));
  assert.deepEqual(d.body.hariIni, { shift: 0, maks: 3 });
  assert.deepEqual(d.body.sewa, { bulan: '2026-11', label: 'November 2026', lunas: false, harga: K.SEWA_HARGA });
  assert.equal(d.body.shiftAktif, null);
  assert.equal(d.body.rondaBuka, false);
});

test('kerja: daftar -> mulai -> selesai terlalu cepat ditolak -> sesudah durasi minimum dibayar upah server', async () => {
  const S = siapkan();
  const tok = await login(S.app, 'rina', '246810');
  assert.equal((await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok))).body.galat, 'belum_daftar');
  assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kolam' }, tok))).status, 400);
  assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: '__proto__' }, tok))).status, 400);
  assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kafe' }, tok))).status, 200);
  assert.equal((await S.app.dompet(get(tok))).body.pekerjaan.kafe.terdaftar, true);
  const m = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok));
  assert.equal(m.status, 200);
  assert.match(m.body.shift, /^[0-9a-f-]{36}$/);
  assert.deepEqual([m.body.pesanan, m.body.minDetik], [6, 100]);
  S.majukan(30000);
  const cepat = await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: { benar: 6, salah: 0, cepat: 1 } }, tok));
  assert.equal(cepat.status, 409); assert.equal(cepat.body.galat, 'terlalu_cepat');
  S.majukan(75000);
  /* field uang dari klien diabaikan: upah dihitung server */
  const r = await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: { benar: 5, salah: 1, cepat: 0.5, gaji: 999999 }, gaji: 999999 }, tok));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const u = K.upahShift('kafe', 0, { benar: 5, salah: 1, cepat: 0.5 });
  assert.deepEqual([r.body.gaji, r.body.tip, r.body.saldo, r.body.shift, r.body.pangkat], [u.gaji, u.tip, u.total, 1, 0]);
  const d = await S.app.dompet(get(tok));
  assert.equal(d.body.saldo, u.total);
  assert.equal(d.body.hariIni.shift, 1);
  assert.equal(d.body.riwayat[0].jenis, 'gaji');
  assert.equal(d.body.riwayat[0].jumlah, u.total);
  /* shift yang sama tidak bisa dibayar dua kali */
  const dua = await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: { benar: 6 } }, tok));
  assert.equal(dua.body.galat, 'shift_tidak_aktif');
  assert.equal((await S.app.dompet(get(tok))).body.saldo, u.total);
});

test('kerja: jeda 10 menit antar shift, jatah 3 shift per hari WIB (semua pekerjaan), besok bisa lagi', async () => {
  const S = siapkan();
  const tok = await login(S.app, 'rina', '246810');
  await shiftLengkap(S, tok, 'kafe');
  const j = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok));
  assert.equal(j.status, 409); assert.equal(j.body.galat, 'jeda'); assert.ok(j.body.detik > 590 && j.body.detik <= 600);
  assert.ok((await S.app.dompet(get(tok))).body.jedaDetik > 590);
  S.majukan(10 * MENIT);
  await shiftLengkap(S, tok, 'warung', { benar: 6, salah: 0, cepat: 1 });
  S.majukan(10 * MENIT);
  await shiftLengkap(S, tok, 'laundry', { benar: 3, salah: 0, cepat: 1 });
  S.majukan(10 * MENIT);
  const habis = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok));
  assert.equal(habis.body.galat, 'batas_hari');
  assert.deepEqual((await S.app.dompet(get(tok))).body.hariIni, { shift: 3, maks: 3 });
  S.setel('2026-11-14T17:05:00Z'); /* 00.05 WIB 15 Nov */
  assert.equal((await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok))).status, 200);
});

test('kerja: ronda hanya 20.00-04.00 WIB; shift baru membatalkan shift lama; shift > 20 menit kedaluwarsa', async () => {
  const S = siapkan(); /* 10.00 WIB */
  const tok = await login(S.app, 'rina', '246810');
  await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'ronda' }, tok));
  const siang = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'ronda' }, tok));
  assert.equal(siang.status, 409); assert.equal(siang.body.galat, 'belum_buka');
  S.setel('2026-11-14T14:00:00Z'); /* 21.00 WIB */
  const m1 = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'ronda' }, tok));
  assert.equal(m1.status, 200);
  assert.equal((await S.app.dompet(get(tok))).body.shiftAktif.id, m1.body.shift);
  const m2 = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'ronda' }, tok)); /* muat ulang HP: mulai lagi */
  S.majukan(120000);
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: m1.body.shift, hasil: {} }, tok))).body.galat, 'shift_tidak_aktif');
  S.majukan(21 * MENIT);
  const telat = await S.app.kerja(post({ aksi: 'selesai', shift: m2.body.shift, hasil: { benar: 4 } }, tok));
  assert.equal(telat.status, 409); assert.equal(telat.body.galat, 'kedaluwarsa');
  assert.equal((await S.app.dompet(get(tok))).body.shiftAktif, null);
  assert.equal((await S.app.dompet(get(tok))).body.saldo, 0);
});

test('kerja: penghuni lain tidak bisa menyelesaikan / membatalkan shift orang; batal = tanpa upah', async () => {
  const S = siapkan();
  const a = await login(S.app, 'rina', '246810'), b = await login(S.app, 'dilla', '135790');
  await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kafe' }, a));
  const m = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, a));
  S.majukan(120000);
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: { benar: 6 } }, b))).body.galat, 'shift_tidak_ada');
  assert.equal((await S.app.kerja(post({ aksi: 'batal', shift: m.body.shift }, b))).status, 200); /* no-op untuk orang lain */
  assert.equal((await S.app.dompet(get(a))).body.shiftAktif.id, m.body.shift);
  assert.equal((await S.app.kerja(post({ aksi: 'batal', shift: m.body.shift }, a))).status, 200);
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: m.body.shift, hasil: { benar: 6 } }, a))).body.galat, 'shift_tidak_aktif');
  assert.equal((await S.app.dompet(get(a))).body.saldo, 0);
  assert.equal((await S.app.dompet(get(a))).body.hariIni.shift, 0); /* batal tidak memakai jatah */
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: 'bukan-uuid' }, a))).status, 400);
  assert.equal((await S.app.kerja(post({ aksi: 'curang' }, a))).status, 400);
});

test('kerja: naik pangkat sesudah 5 shift (per pekerjaan), gaji pokok ikut naik', async () => {
  const S = siapkan('2026-11-01T01:00:00Z');
  const tok = await login(S.app, 'rina', '246810');
  let r;
  for (let i = 0; i < 5; i++) {
    r = await shiftLengkap(S, tok, 'kafe');
    assert.equal(r.naikPangkat, i === 4, 'shift ke-' + (i + 1));
    S.majukan(24 * 60 * MENIT); /* 1 shift per hari: tidak kena jatah / jeda */
  }
  assert.equal(r.pangkat, 1);
  const enam = await shiftLengkap(S, tok, 'kafe');
  assert.equal(enam.gaji, K.PEKERJAAN.kafe.gaji[1]);
  assert.equal((await S.app.dompet(get(tok))).body.pekerjaan.kafe.pangkat, 1);
  assert.equal((await S.app.dompet(get(tok))).body.pekerjaan.warung.pangkat, 0);
});

/* ---------- /api/belanja ---------- */
test('belanja: harga dari server, saldo tidak pernah negatif, aksesori/dekor sekali beli, minuman kafe berulang', async () => {
  const S = siapkan();
  const tok = await login(S.app, 'rina', '246810');
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok))).body.galat, 'saldo_kurang');
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'mobil' }, tok))).status, 400);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'toString' }, tok))).status, 400);
  await shiftLengkap(S, tok, 'kafe'); /* +Rp11.000 */
  const kopi = await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu', harga: 1 }, tok)); /* harga klien diabaikan */
  assert.equal(kopi.status, 200); assert.equal(kopi.body.saldo, 11000 - K.KATALOG.kopisusu.harga);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok))).status, 200);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'topi_baseball' }, tok))).body.galat, 'saldo_kurang');
  const d0 = await S.app.dompet(get(tok));
  assert.equal(d0.body.saldo, 3000);
  assert.deepEqual(d0.body.barang, []);
  S.majukan(10 * MENIT); await shiftLengkap(S, tok, 'kafe');
  S.majukan(10 * MENIT); await shiftLengkap(S, tok, 'kafe'); /* 3000 + 22000 = 25000 */
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'topi_baseball' }, tok))).body.saldo, 10000);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'topi_baseball' }, tok))).body.galat, 'sudah_punya');
  const d = await S.app.dompet(get(tok));
  assert.deepEqual(d.body.barang, ['topi_baseball']);
  assert.equal(d.body.saldo, 10000);
  assert.deepEqual(d.body.riwayat.map((x) => x.jenis), ['beli', 'gaji', 'gaji', 'beli', 'beli', 'gaji']);
  assert.ok(S.db._t.mutasi.every((m) => m.saldo_sesudah >= 0));
});

test('uang kos: sekali per bulan WIB, perlu saldo cukup, bulan depan bisa bayar lagi', async () => {
  const S = siapkan('2026-11-01T01:00:00Z');
  const tok = await login(S.app, 'rina', '246810');
  assert.equal((await S.app.belanja(post({ aksi: 'sewa' }, tok))).body.galat, 'saldo_kurang');
  for (let i = 0; i < 10; i++) { await shiftLengkap(S, tok, 'kafe'); S.majukan(24 * 60 * MENIT); } /* 11 Nov, saldo >= 100rb */
  const bayar = await S.app.belanja(post({ aksi: 'sewa', jumlah: 1 }, tok));
  assert.equal(bayar.status, 200, JSON.stringify(bayar.body));
  assert.deepEqual([bayar.body.bulan, bayar.body.label], ['2026-11', 'November 2026']);
  assert.equal((await S.app.dompet(get(tok))).body.sewa.lunas, true);
  assert.equal((await S.app.belanja(post({ aksi: 'sewa' }, tok))).body.galat, 'sudah_lunas');
  S.setel('2026-12-01T00:00:00Z'); /* 07.00 WIB 1 Des */
  const des = await S.app.dompet(get(tok));
  assert.deepEqual([des.body.sewa.bulan, des.body.sewa.lunas], ['2026-12', false]);
});

test('kerja + belanja: CSRF (origin lain / bukan JSON) ditolak; batas per kamar per jam', async () => {
  const S = siapkan();
  const tok = await login(S.app, 'rina', '246810');
  assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kafe' }, tok, { origin: 'https://jahat.example' }))).status, 403);
  assert.equal((await S.app.belanja(post({ aksi: 'sewa' }, tok, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  for (let i = 0; i < BATAS_PENGHUNI.belanja; i++) assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok))).status, 409);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok))).status, 429);
  /* batas per KAMAR: penghuni lain (IP sama, CGNAT) tidak ikut terkunci */
  const b = await login(S.app, 'dilla', '135790');
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, b))).status, 409);
  S.majukan(61 * MENIT);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok))).status, 409);
});

test('galat database yang tidak dikenal = dilempar (pembungkus menjawab 503), bukan diam-diam sukses', async () => {
  const S = siapkan();
  const tok = await login(S.app, 'rina', '246810');
  S.db.beli = async () => { const e = new Error('function public.kosan_beli does not exist'); e.status = 404; throw e; };
  await assert.rejects(S.app.belanja(post({ aksi: 'beli', barang: 'kopisusu' }, tok)));
  S.db.dompetBaca = async () => { throw new Error('timeout'); };
  await assert.rejects(S.app.dompet(get(tok)));
});

/* ---------- db.js + migrasi + berkas deploy ---------- */
test('db.js: RPC kerja/belanja memakai nama + argumen p_*, input diperiksa sebelum dikirim', async () => {
  const log = [];
  const fetchFn = async (url, o) => { log.push({ url, body: o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 200, text: async () => '{"saldo":1}' }; };
  const db = buatDb({ url: 'https://x.supabase.co', kunci: 'eyJ.service', fetchFn });
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  await db.dompetBaca({ room: 3, nama: 'rina', tanggal: '2026-11-16', bulan: '2026-11', maksDetik: 1200 });
  await db.kerjaMulai({ room: 3, nama: 'rina', pekerjaan: 'kafe', tanggal: '2026-11-16', maksHari: 3, jedaDetik: 600, maksDetik: 1200 });
  await db.kerjaSelesai({ room: 3, nama: 'rina', shift: id, gaji: 7000, tip: 2000, benar: 6, salah: 0, minDetik: 100, maksDetik: 1200, keterangan: 'Gaji' });
  await db.beli({ room: 3, nama: 'rina', barang: 'poster', harga: 12000, unik: true, keterangan: 'Beli Poster' });
  await db.sewaBayar({ room: 3, nama: 'rina', bulan: '2026-11', jumlah: 100000, keterangan: 'Uang kos' });
  assert.deepEqual(log.map((l) => l.url.split('/rpc/')[1]), ['kosan_dompet_baca', 'kosan_kerja_mulai', 'kosan_kerja_selesai', 'kosan_beli', 'kosan_sewa_bayar']);
  assert.deepEqual(Object.keys(log[2].body), ['p_room', 'p_nama', 'p_shift', 'p_gaji', 'p_tip', 'p_benar', 'p_salah', 'p_min_detik', 'p_maks_detik', 'p_keterangan']);
  assert.equal(log[3].body.p_unik, true);
  await assert.rejects(db.kerjaShift({ room: '3', nama: 'rina', shift: id }));
  await assert.rejects(db.kerjaShift({ room: 3, nama: 'rina', shift: "x' or 1=1" }));
  await assert.rejects(db.beli({ room: 3, nama: 'rina', barang: 'Poster;drop', harga: 1, unik: true }));
  await assert.rejects(db.beli({ room: 3, nama: 'rina', barang: 'poster', harga: -5, unik: true }));
  await assert.rejects(db.dompetBaca({ room: 3, nama: '', tanggal: '2026-11-16', bulan: '2026-11', maksDetik: 1 }));
});

test('migrasi kerja_belanja: hanya menambah, RLS + revoke + grant service_role, search_path kosong, tanpa menyentuh penghuni', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261116_kerja_belanja.sql'), 'utf8');
  const kode = sql.replace(/--.*$/gm, '');
  const tabel = ['kosan_dompet', 'kosan_mutasi', 'kosan_pekerjaan', 'kosan_shift', 'kosan_barang', 'kosan_sewa'];
  for (const t of tabel) {
    assert.match(kode, new RegExp('create table if not exists public\\.' + t + ' \\('), t);
    assert.match(kode, new RegExp('alter table public\\.' + t + '\\s+enable row level security'), t);
  }
  const fungsi = [...kode.matchAll(/create or replace function public\.(kosan_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fungsi, ['kosan_dompet_baca', 'kosan_kerja_daftar', 'kosan_kerja_mulai', 'kosan_kerja_shift', 'kosan_kerja_selesai', 'kosan_kerja_batal', 'kosan_beli', 'kosan_sewa_bayar']);
  for (const f of fungsi) {
    assert.match(kode, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon, authenticated'), f);
    assert.match(kode, new RegExp('grant execute on function public\\.' + f + '\\([^)]*\\) to service_role'), f);
  }
  assert.equal((kode.match(/security definer set search_path = ''/g) || []).length, fungsi.length);
  assert.ok(!/\b(insert into|update|delete from|truncate|drop table|alter table)\s+public\.kosan_(residents|akun|sesi|login)/i.test(kode), 'tidak menyentuh penghuni / akun / sesi');
  assert.ok(!/function public\.kosan_(register|login|occupants)\b/.test(kode));
  assert.match(kode, /check \(saldo >= 0/);
  assert.match(kode, /where status = 'aktif'/); /* satu shift aktif */
  /* setiap pesan RAISE yang ramah dikenal server */
  const { PESAN_KERJA } = require('../api/_lib/app');
  for (const m of kode.matchAll(/raise exception '([a-z_]+)(?::%)?'/g)) {
    if (/ tidak valid$/.test(m[1])) continue;
    assert.ok(Object.prototype.hasOwnProperty.call(PESAN_KERJA, m[1]), 'pesan ' + m[1]);
  }
});

test('migrasi kerja_kunci: 3 fungsi kerja diganti dengan isi SAMA + kunci per penghuni sebagai pernyataan pertama', () => {
  const baca = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8').replace(/--.*$/gm, '');
  const lama = baca('20261116_kerja_belanja.sql'), baru = baca('20261117_kerja_kunci.sql');
  const ambil = (sql, f) => { const m = new RegExp('create or replace function public\\.' + f + '\\([\\s\\S]*?end \\$\\$;').exec(sql); assert.ok(m, f); return m[0]; };
  const KUNCI = "  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kosan_kerja:' || p_room::text || ':' || p_nama));\n";
  const fungsi = [...baru.matchAll(/create or replace function public\.(kosan_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fungsi, ['kosan_kerja_mulai', 'kosan_kerja_selesai', 'kosan_kerja_batal']);
  for (const f of fungsi) {
    const b = ambil(baru, f);
    assert.ok(b.includes('\nbegin\n' + KUNCI), f + ': kunci = pernyataan pertama');
    assert.equal(b.replace(KUNCI, ''), ambil(lama, f), f + ': isi lain SAMA PERSIS dengan migrasi 16 Nov');
    assert.match(baru, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon, authenticated'), f);
    assert.match(baru, new RegExp('grant execute on function public\\.' + f + '\\([^)]*\\) to service_role'), f);
  }
  assert.equal((baru.match(/security definer set search_path = ''/g) || []).length, 3);
  assert.doesNotMatch(baru, /create table|alter table|drop |truncate|delete from|create index/i, 'tidak menyentuh tabel / data');
  assert.match(baru, /^begin;$/m); assert.match(baru, /^commit;$/m);
});

test('berkas deploy: 3 endpoint baru (dompet GET, kerja POST, belanja POST), total endpoint <= 12 (batas Vercel Hobby), README', () => {
  const isi = (f) => fs.readFileSync(path.join(ROOT, 'api', f), 'utf8');
  assert.match(isi('dompet.js'), /jalankan\('dompet', 'GET'\)/);
  assert.match(isi('kerja.js'), /jalankan\('kerja', 'POST'\)/);
  assert.match(isi('belanja.js'), /jalankan\('belanja', 'POST'\)/);
  const endpoint = [];
  (function jelajah(d) {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      if (f === '_lib') continue;
      const p = path.join(d, f);
      if (fs.statSync(path.join(ROOT, p)).isDirectory()) jelajah(p); else if (f.endsWith('.js')) endpoint.push(p);
    }
  })('api');
  assert.ok(endpoint.length <= 12, endpoint.join(','));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const f of ['api/dompet.js', 'api/kerja.js', 'api/belanja.js', 'api/_lib/kerja.js', '20261116_kerja_belanja.sql']) assert.ok(readme.includes(f), 'README menyebut ' + f);
});
