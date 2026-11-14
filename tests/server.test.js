'use strict';
/* Tes Fase A (docs/RASA-AMAN-DESAIN.md §12.1). Jalankan: node --test tests/
   Tanpa jaringan, tanpa Supabase asli, tanpa PIN asli penghuni. */
const test = require('node:test');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../api/_lib/inti');
const { buatApp, UMUR_INGAT } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { jalankan } = require('../api/_lib/jalankan');
const { buatFakeDb } = require('./fake-db');
const { buatFakeHibp } = require('./fake-hibp');

const RAHASIA = 'uji-'.repeat(10); /* rahasia UJI, bukan rahasia produksi */
const PW = 'kos-rumah-kedua';
const PENGHUNI = [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 13, name: 'dilla', gender: 'Cewek', pin: '135790' },
  { room: 14, name: 'dil', gender: 'Cowok', pin: '135790' }
];

function siapkan(opsiHibp) {
  let jam = Date.parse('2026-11-14T03:00:00Z');
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  const hibp = buatFakeHibp(opsiHibp); /* tidak pernah ke jaringan asli */
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => jam, hibpFetch: hibp.fetchFn, hibpTimeoutMs: 200 });
  const majukan = (ms) => { jam += ms; };
  return { db, app, majukan, hibp };
}
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, extra) => ({ method: 'POST', headers: Object.assign({}, H, extra || {}), body, ip: '36.80.1.23' });
const tokenDari = (out) => {
  const c = (out.cookies || []).find((x) => x.startsWith('__Host-kosan_sesi='));
  return c ? c.split(';')[0].split('=')[1] : null;
};
const denganCookie = (ctx, token) => { ctx.headers.cookie = '__Host-kosan_sesi=' + token; return ctx; };

async function setupLengkap(app, username, pin, ingat) {
  const a = await app.setupPin(post({ username, pin }));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: PW, ingat: !!ingat }));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return b;
}

/* ---------- inti ---------- */
test('pinHash server = pinHash di index.html (salinan verbatim)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const awal = html.indexOf("var PIN_SALT = 'kosan-ibu-kos-pin-v1';");
  const akhir = html.indexOf('\n}\n', html.indexOf('function pinHash', awal)) + 3;
  assert.ok(awal > 0 && akhir > awal, 'pinHash tidak ditemukan di index.html');
  const klien = new Function(html.slice(awal, akhir) + '\nreturn pinHash;')();
  for (const v of ['000000', '123456', '999999', '024680', '', 'abc']) assert.equal(I.pinHash(v), klien(v), v);
});

test('scrypt: cocok, salah, format rusak, salt beda tiap hash', async () => {
  const h1 = await I.hashPassword(PW), h2 = await I.hashPassword(PW);
  assert.match(h1, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(h1, h2);
  assert.equal(await I.cekPassword(PW, h1), true);
  assert.equal(await I.cekPassword(PW + 'x', h1), false);
  assert.equal(await I.cekPassword(PW, 'scrypt$1$1$1$aa$bb'), false);
  assert.equal(await I.cekPassword(PW, PW), false);
  assert.ok(!h1.includes(PW));
});

test('aturan password', () => {
  assert.match(I.cekAturanPassword('pendek', 'rina'), /minimal 8/);
  assert.match(I.cekAturanPassword('aaaaaaaaa', 'rina'), /gampang/);
  assert.match(I.cekAturanPassword('Bismillah', 'rina'), /umum/);
  assert.match(I.cekAturanPassword('kosanibukos', 'rina'), /umum/);
  assert.match(I.cekAturanPassword('dilla.cantik', 'dilla.cantik'), /username/);
  assert.match(I.cekAturanPassword('x'.repeat(129), 'rina'), /maksimal/);
  assert.equal(I.cekAturanPassword(PW, 'rina'), null);
});

test('tiket setup: tanda tangan, kedaluwarsa, diubah', () => {
  const t = I.buatTiket(RAHASIA, { room: 13, nama_norm: 'dilla', gender: 'cewek', exp: 2000 });
  assert.deepEqual(I.bacaTiket(RAHASIA, t, 1000), { room: 13, nama_norm: 'dilla', gender: 'cewek', exp: 2000 });
  assert.equal(I.bacaTiket(RAHASIA, t, 2000), null);
  assert.equal(I.bacaTiket('lain-'.repeat(10), t, 1000), null);
  const [json, sig] = t.split('.');
  const palsu = Buffer.from(JSON.stringify({ room: 3, nama_norm: 'rina', gender: 'cewek', exp: 2000 })).toString('base64url');
  assert.equal(I.bacaTiket(RAHASIA, palsu + '.' + sig, 1000), null);
  assert.equal(I.bacaTiket(RAHASIA, json + '.', 1000), null);
});

test('IP disimpan sebagai HMAC + prefiks, bukan IP mentah', () => {
  const a = I.ipHmac(RAHASIA, '36.80.1.23'), b = I.ipHmac(RAHASIA, '36.80.1.99');
  assert.match(a.ip_hmac, /^[0-9a-f]{64}$/);
  assert.notEqual(a.ip_hmac, b.ip_hmac);
  assert.equal(a.ip_prefiks_hmac, b.ip_prefiks_hmac);
  assert.ok(!JSON.stringify(a).includes('36.80'));
  assert.equal(I.prefiksIp('2001:db8:abcd:12::1'), '2001:db8:abcd::/48');
  assert.equal(I.prefiksIp('2001:db8::1'), '2001:db8:0::/48');
});

test('cookie sesi: HttpOnly, Secure, SameSite=Strict, __Host-, Max-Age hanya kalau ingat', () => {
  const c1 = I.cookieSesi('a'.repeat(43), { ingat: true, aman: true, maxAgeDetik: 2592000 });
  assert.match(c1, /^__Host-kosan_sesi=a{43}; Path=\/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000$/);
  const c2 = I.cookieSesi('a'.repeat(43), { ingat: false, aman: true, maxAgeDetik: 2592000 });
  assert.ok(!/Max-Age/.test(c2));
  assert.equal(I.bacaCookie('x=1; __Host-kosan_sesi=' + 'b'.repeat(43), '__Host-kosan_sesi'), 'b'.repeat(43));
  assert.equal(I.bacaCookie('__Host-kosan_sesi=<script>', '__Host-kosan_sesi'), null);
});

/* ---------- alur penghuni ---------- */
test('penghuni lama: perlu setup -> PIN lama -> buat password -> sesi', async () => {
  const { app, db } = siapkan();
  const a = await app.masuk(post({ username: '@Dilla', password: 'apa-saja-123' }));
  assert.equal(a.status, 200); assert.deepEqual(a.body, { perlu_setup: true });
  const b = await app.setupPin(post({ username: 'dilla', pin: '000000' }));
  assert.equal(b.status, 401); assert.equal(b.body.galat, 'pin_salah');
  const c = await setupLengkap(app, 'dilla', '135790', true);
  assert.deepEqual(c.body, { room: 13, name: 'dilla', gender: 'cewek' });
  assert.ok(tokenDari(c));
  const akun = await db.akunAmbil(13);
  assert.match(akun.password_hash, /^scrypt\$/);
  assert.deepEqual(db._t.log.map((x) => x.peristiwa), ['setup_pin', 'setup']);
});

test('data penghuni lama tidak diubah (nama, kamar, gender, pin_hash)', async () => {
  const { app, db } = siapkan();
  const sebelum = JSON.stringify(db._lama.map(({ room, name, gender, pin_hash }) => ({ room, name, gender, pin_hash })));
  await setupLengkap(app, 'dilla', '135790');
  await app.masuk(post({ username: 'dilla', password: PW }));
  const sesudah = JSON.stringify(db._lama.map(({ room, name, gender, pin_hash }) => ({ room, name, gender, pin_hash })));
  assert.equal(sesudah, sebelum);
});

test('RED->GREEN: akun dengan password tidak bisa dibuka lagi lewat PIN saja', async () => {
  const { app } = siapkan();
  await setupLengkap(app, 'dilla', '135790');
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal(a.status, 409); assert.equal(a.body.galat, 'sudah_setup');
  assert.equal(a.body.tiket, undefined);
});

test('tiket setup sekali pakai: dipakai dua kali -> ditolak', async () => {
  const { app } = siapkan();
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  const b1 = await app.setupPassword(post({ tiket: a.body.tiket, password: PW }));
  const b2 = await app.setupPassword(post({ tiket: a.body.tiket, password: 'password-penyusup' }));
  assert.equal(b1.status, 200); assert.equal(b2.status, 409);
});

test('tiket setup kedaluwarsa 5 menit', async () => {
  const { app, majukan } = siapkan();
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  majukan(5 * 60000 + 1);
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: PW }));
  assert.equal(b.status, 401); assert.equal(b.body.galat, 'tiket_habis');
});

test('password lemah ditolak saat setup', async () => {
  const { app } = siapkan();
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: '12345678' }));
  assert.equal(b.status, 400); assert.equal(b.body.galat, 'password_lemah');
});

test('login: password benar -> sesi; salah -> 401; 5x salah -> terkunci 15 menit', async () => {
  const { app, majukan } = siapkan();
  await setupLengkap(app, 'rina', '246810');
  const ok = await app.masuk(post({ username: 'rina', password: PW }));
  assert.equal(ok.status, 200); assert.ok(tokenDari(ok));
  for (let i = 0; i < 5; i++) assert.equal((await app.masuk(post({ username: 'rina', password: 'salah-salah-' + i }))).status, 401);
  const kunci = await app.masuk(post({ username: 'rina', password: PW }));
  assert.equal(kunci.status, 429);
  majukan(15 * 60000 + 1);
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }))).status, 200);
});

test('password kosong: perlu_setup kalau belum punya password, 400 (tanpa hitung gagal) kalau sudah', async () => {
  const { app, db } = siapkan();
  assert.deepEqual((await app.masuk(post({ username: 'rina', password: '' }))).body, { perlu_setup: true });
  await setupLengkap(app, 'rina', '246810');
  const r = await app.masuk(post({ username: 'rina', password: '' }));
  assert.equal(r.status, 400); assert.equal((await db.akunAmbil(3)).gagal_count, 0);
});

test('username tidak terdaftar -> 401 tanpa sesi', async () => {
  const { app } = siapkan();
  const a = await app.masuk(post({ username: 'orang-asing', password: PW }));
  assert.equal(a.status, 401); assert.equal(a.cookies, undefined);
});

test('batas 20 percobaan masuk per IP per jam', async () => {
  const { app } = siapkan();
  let terakhir;
  for (let i = 0; i < 21; i++) terakhir = await app.masuk(post({ username: 'orang-asing', password: 'x' }));
  assert.equal(terakhir.status, 429);
});

test('tidak ada password mentah di database, respons, atau cookie', async () => {
  const { app, db } = siapkan();
  const outs = [];
  outs.push(await app.setupPin(post({ username: 'dilla', pin: '135790' })));
  outs.push(await app.setupPassword(post({ tiket: outs[0].body.tiket, password: PW, ingat: true })));
  outs.push(await app.masuk(post({ username: 'dilla', password: PW, ingat: true })));
  const semua = JSON.stringify({ akun: [...db._t.akun.values()], sesi: db._t.sesi, log: db._t.log, outs });
  assert.ok(!semua.includes(PW), 'password mentah bocor');
  assert.ok(!semua.includes('135790'), 'PIN mentah bocor');
  const token = tokenDari(outs[2]);
  assert.ok(!JSON.stringify(db._t.sesi).includes(token), 'token sesi mentah tersimpan');
  assert.equal(db._t.sesi[1].token_sha256, I.sha256hex(token));
});

/* ---------- sesi ("Ingat saya") ---------- */
test('sesi: cookie sah -> identitas; tanpa cookie -> 401', async () => {
  const { app } = siapkan();
  const s = await setupLengkap(app, 'rina', '246810', true);
  const r = await app.sesi(denganCookie({ method: 'GET', headers: {} }, tokenDari(s)));
  assert.equal(r.status, 200); assert.deepEqual(r.body, { room: 3, name: 'rina', gender: 'cewek' });
  assert.equal((await app.sesi({ method: 'GET', headers: {} })).status, 401);
});

test('sesi Ingat saya diperpanjang (sliding) dan habis sesudah 30 hari tanpa dipakai', async () => {
  const { app, majukan } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'rina', '246810', true));
  majukan(2 * 3600000);
  const r = await app.sesi(denganCookie({ method: 'GET', headers: {} }, tok));
  assert.equal(r.status, 200); assert.ok(r.cookies && /Max-Age=2592000/.test(r.cookies[0]));
  majukan(UMUR_INGAT + 1);
  const habis = await app.sesi(denganCookie({ method: 'GET', headers: {} }, tok));
  assert.equal(habis.status, 401); assert.match(habis.cookies[0], /Max-Age=0/);
});

test('sesi tanpa Ingat saya dibatasi 12 jam di server', async () => {
  const { app, majukan } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'rina', '246810', false));
  majukan(12 * 3600000 + 1);
  assert.equal((await app.sesi(denganCookie({ method: 'GET', headers: {} }, tok))).status, 401);
});

test('keluar mencabut sesi', async () => {
  const { app } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'rina', '246810', true));
  const k = await app.keluar(denganCookie(post({}), tok));
  assert.equal(k.status, 200); assert.match(k.cookies[0], /Max-Age=0/);
  assert.equal((await app.sesi(denganCookie({ method: 'GET', headers: {} }, tok))).status, 401);
});

test('reset password oleh pemilik mencabut sesi lama', async () => {
  const { app, db } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'rina', '246810', true));
  await db.akunReset(3);
  assert.equal((await app.sesi(denganCookie({ method: 'GET', headers: {} }, tok))).status, 401);
  assert.deepEqual((await app.masuk(post({ username: 'rina', password: PW }))).body, { perlu_setup: true });
});

/* ---------- PIN kamar ---------- */
test('RED->GREEN: masuk kamar butuh sesi penghuni + PIN benar, tiap kali', async () => {
  const { app } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  const tamu = await app.kamarMasuk(post({ room: 13, pin: '135790' }));
  assert.equal(tamu.status, 401); assert.equal(tamu.body.galat, 'perlu_login');
  const lain = await app.kamarMasuk(denganCookie(post({ room: 14, pin: '135790' }), tok));
  assert.equal(lain.status, 403); assert.equal(lain.body.galat, 'bukan_kamarmu');
  const salah = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '000000' }), tok));
  assert.equal(salah.status, 401); assert.equal(salah.body.galat, 'pin_salah');
  const ok = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok));
  assert.equal(ok.status, 200);
  const lagi = await app.kamarMasuk(denganCookie(post({ room: 13 }), tok));
  assert.equal(lagi.status, 400);
});

test('PIN kamar ikut kunci PIN lama (5x salah)', async () => {
  const { app } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  for (let i = 0; i < 5; i++) await app.kamarMasuk(denganCookie(post({ room: 13, pin: '00000' + i }), tok));
  const r = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok));
  assert.equal(r.status, 429);
});

test('dua penghuni dengan PIN sama tetap terpisah (PIN tidak dipaksa unik)', async () => {
  const { app } = siapkan();
  const tokDil = tokenDari(await setupLengkap(app, 'dil', '135790', true));
  const r = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tokDil));
  assert.equal(r.status, 403);
});

/* ---------- temuan review independen ---------- */
test('review #1: saat terkunci, PIN benar dan salah dapat jawaban sama (bukan penunjuk PIN)', async () => {
  const { app } = siapkan();
  for (let i = 0; i < 5; i++) await app.setupPin(post({ username: 'dilla', pin: '00000' + i }, { 'x-uji': String(i) }));
  const salah = await app.setupPin(post({ username: 'dilla', pin: '999999' }));
  const benar = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal(salah.status, 429); assert.equal(benar.status, 429);
  assert.deepEqual(salah.body, benar.body); assert.equal(benar.body.tiket, undefined);
});

test('review #1: gerbang PIN berlaku juga untuk PIN kamar, dan kosan_login tidak dipanggil saat terkunci', async () => {
  const { app, db } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  for (let i = 0; i < 5; i++) await app.kamarMasuk(denganCookie(post({ room: 13, pin: '00000' + i }), tok));
  const n = db._panggilan.filter((x) => x === 'loginPin').length;
  const a = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '999999' }), tok));
  const b = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok));
  assert.equal(a.status, 429); assert.equal(b.status, 429); assert.deepEqual(a.body, b.body);
  assert.equal(db._panggilan.filter((x) => x === 'loginPin').length, n);
});

test('review #1: PIN benar tidak menghabiskan jatah (penghuni asli tidak terkunci karena dirinya sendiri)', async () => {
  const { app } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  for (let i = 0; i < 12; i++) assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
});

test('review 2 #2: tebakan dicicil (5 dalam 15 menit) tidak membuka celah penunjuk PIN', async () => {
  const { app, majukan } = siapkan();
  for (let i = 0; i < 5; i++) { await app.setupPin(post({ username: 'dilla', pin: '00000' + i })); majukan(3 * 60000); }
  majukan(10 * 1000); /* t = 15:10 sejak tebakan pertama */
  const salah = await app.setupPin(post({ username: 'dilla', pin: '999999' }));
  const benar = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal(salah.status, benar.status); assert.deepEqual(salah.body, benar.body);
  assert.equal(benar.body.tiket, undefined);
});

test('review 2 #1: pemilik bisa membuka kunci tanpa reset password; reset juga membuka', async () => {
  const { app, db, majukan } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  for (let i = 0; i < 6; i++) await app.kamarMasuk(denganCookie(post({ room: 13, pin: '00000' + i }), tok));
  for (let i = 0; i < 6; i++) await app.masuk(post({ username: 'dilla', password: 'salah-salah-' + i }));
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 429);
  assert.equal((await app.masuk(post({ username: 'dilla', password: PW }))).status, 429);
  await db.akunBuka(13);
  /* password langsung terbuka */
  assert.equal((await app.masuk(post({ username: 'dilla', password: PW }))).status, 200);
  /* PIN juga langsung terbuka: kosan_akun_buka ikut menghapus baris
     kosan_login_attempts kamar itu (temuan verifikasi #2) */
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
  void majukan;
  /* reset juga membuka gerbang */
  for (let i = 0; i < 6; i++) await app.masuk(post({ username: 'dilla', password: 'salah-lagi-' + i }));
  await db.akunReset(13);
  assert.deepEqual((await app.masuk(post({ username: 'dilla', password: '' }))).body, { perlu_setup: true });
});

test('review 2 #6: alamat IPv4-mapped (::ffff:) dihitung sebagai IPv4 masing-masing', () => {
  assert.equal(I.kunciBatasIp(RAHASIA, '::ffff:36.80.1.23'), I.kunciBatasIp(RAHASIA, '36.80.1.23'));
  assert.notEqual(I.kunciBatasIp(RAHASIA, '::ffff:36.80.1.23'), I.kunciBatasIp(RAHASIA, '::ffff:36.80.1.24'));
});

/* ---------- temuan verifikasi Postgres (Vesper) ---------- */
test('verifikasi #1: sepi 20 menit menghapus juga hitungan kosan_login (tidak dobel-hitung)', async () => {
  const { app, majukan } = siapkan();
  const pin = (p) => app.setupPin(post({ username: 'dilla', pin: p }));
  for (let i = 0; i < 3; i++) assert.equal((await pin('00000' + i)).status, 401);
  majukan(20 * 60000);
  for (let i = 0; i < 2; i++) assert.equal((await pin('10000' + i)).status, 401);
  const benar = await pin('135790');
  assert.equal(benar.status, 200, 'penghuni terkunci oleh hitungan lama kosan_login');
  assert.ok(benar.body.tiket);
  /* masih dalam jendela: 2 salah + 1 benar (jatahnya dikembalikan) + 3 salah = 5 jatah terpakai */
  for (let i = 0; i < 3; i++) assert.equal((await pin('20000' + i)).status, 401);
  const keenam = await pin('135790');
  assert.equal(keenam.status, 429, 'percobaan ke-6 dalam jendela harus terkunci');
});

test('verifikasi #1: gerbang pw: tidak menyentuh hitungan PIN kosan_login', async () => {
  const { app, db, majukan } = siapkan();
  await setupLengkap(app, 'rina', '246810');
  for (let i = 0; i < 4; i++) await db.loginPin('rina', 'x' + i); /* 4 PIN salah lewat jalur lama */
  majukan(20 * 60000);
  await app.masuk(post({ username: 'rina', password: 'salah-salah-1' })); /* gerbang pw: reset karena sepi */
  assert.equal(db._lama.find((p) => p.name === 'rina').gagal, 4);
});

test('verifikasi #2: kunci lama kosan_login (5x PIN salah) dibuka kosan_akun_buka', async () => {
  const { app, db } = siapkan();
  const tok = tokenDari(await setupLengkap(app, 'dilla', '135790', true));
  for (let i = 0; i < 5; i++) await db.loginPin('dilla', 'salah' + i); /* kunci lewat sistem lama */
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 429);
  await db.akunBuka(13);
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
});

test('verifikasi #2: kunci lama kosan_login dibuka kosan_akun_reset, lalu setup ulang berhasil', async () => {
  const { app, db } = siapkan();
  await setupLengkap(app, 'dilla', '135790', true);
  for (let i = 0; i < 5; i++) await db.loginPin('dilla', 'salah' + i);
  await db.akunReset(13);
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: 'password-baru-kos' }));
  assert.equal(b.status, 200);
});

test('review #2: 40 password paralel tidak bisa melewati kunci akun', async () => {
  const { app } = siapkan();
  await setupLengkap(app, 'rina', '246810');
  const tebak = Array.from({ length: 39 }, (_, i) => 'tebakan-salah-' + i).concat([PW]);
  const out = await Promise.all(tebak.map((pw, i) => app.masuk(post({ username: 'rina', password: pw }, { 'x-forwarded-for': '10.0.' + i + '.1' }))));
  const benar = out[39];
  assert.ok(out.filter((o) => o.status === 401).length <= 5, 'lebih dari 5 tebakan sempat diverifikasi');
  assert.equal(benar.status, 429, 'password benar lolos di tengah banjir paralel');
});

test('review #3: batas IP memakai /64 untuk IPv6', () => {
  assert.equal(I.kunciBatasIp(RAHASIA, '2001:db8:1:2::a'), I.kunciBatasIp(RAHASIA, '2001:db8:1:2:ffff::b'));
  assert.notEqual(I.kunciBatasIp(RAHASIA, '2001:db8:1:2::a'), I.kunciBatasIp(RAHASIA, '2001:db8:1:3::a'));
  assert.notEqual(I.kunciBatasIp(RAHASIA, '36.80.1.23'), I.kunciBatasIp(RAHASIA, '36.80.1.24'));
});

test('review #3: memutar alamat IPv6 dalam satu /64 tidak memberi jatah baru', async () => {
  const { app } = siapkan();
  let terakhir;
  for (let i = 0; i < 21; i++) {
    const ctx = post({ username: 'orang-asing', password: 'x' }); ctx.ip = '2001:db8:1:2::' + (i + 1).toString(16);
    terakhir = await app.masuk(ctx);
  }
  assert.equal(terakhir.status, 429);
});

test('review #5: tiket bekas ditolak sebelum scrypt + dibatasi per IP', async () => {
  const { app } = siapkan();
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  await app.setupPassword(post({ tiket: a.body.tiket, password: PW }));
  const asli = I.hashPassword; let dipanggil = 0;
  I.hashPassword = async (pw) => { dipanggil++; return asli(pw); };
  let ulang;
  try { ulang = await app.setupPassword(post({ tiket: a.body.tiket, password: 'password-penyusup' })); } finally { I.hashPassword = asli; }
  assert.equal(ulang.status, 409);
  assert.equal(dipanggil, 0, 'scrypt masih dijalankan untuk tiket bekas');
  let terakhir;
  for (let i = 0; i < 25; i++) terakhir = await app.setupPassword(post({ tiket: a.body.tiket, password: 'password-penyusup' }));
  assert.equal(terakhir.status, 429);
});

/* ---------- CSRF / format ---------- */
test('POST dari origin lain / bukan JSON ditolak', async () => {
  const { app } = siapkan();
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }, { origin: 'https://jahat.example' }))).status, 403);
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await app.masuk(Object.assign(post(null)))).status, 400);
});

test('app menolak jalan tanpa KOSAN_SECRET yang cukup panjang', () => {
  assert.throws(() => buatApp({ db: {}, rahasia: '' }));
  assert.throws(() => buatApp({ db: {}, rahasia: 'pendek' }));
});

/* ---------- adapter Supabase + pembungkus Vercel ---------- */
test('db.js: header service role, path aman, kunci PIN dipetakan', async () => {
  const log = [];
  const fetchFn = async (url, o) => {
    log.push({ url, o });
    if (url.endsWith('rpc/kosan_login')) return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'Terlalu banyak percobaan' }) };
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const db = buatDb({ url: 'https://x.supabase.co/', kunci: 'eyJ.service', fetchFn });
  assert.deepEqual(await db.loginPin('rina', 'abcd1234'), { ok: false, terkunci: true });
  assert.equal(await db.akunAmbil(3), null);
  await assert.rejects(db.akunAmbil('3;drop'));
  await assert.rejects(db.sesiAmbil('bukan-hex'));
  assert.equal(log[0].url, 'https://x.supabase.co/rest/v1/rpc/kosan_login');
  assert.equal(log[0].o.headers.Authorization, 'Bearer eyJ.service');
  const db2 = buatDb({ url: 'https://x.supabase.co', kunci: 'sb_secret_abc', fetchFn });
  await db2.akunAmbil(3);
  assert.equal(log[log.length - 1].o.headers.Authorization, undefined);
});

test('pembungkus Vercel: env kosong -> 503, metode salah -> 405, Set-Cookie diteruskan', async () => {
  const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(b) { r.body = b; } }; return r; };
  const r1 = res();
  await jalankan('masuk', 'POST', () => { throw new Error('KOSAN_SECRET kosong'); })({ method: 'POST', headers: {} }, r1);
  assert.equal(r1.statusCode, 503);
  const r2 = res();
  await jalankan('masuk', 'POST', () => ({}))({ method: 'GET', headers: {} }, r2);
  assert.equal(r2.statusCode, 405);
  const r3 = res();
  const palsu = { masuk: async () => ({ status: 200, body: { ok: 1 }, cookies: ['a=b'] }) };
  await jalankan('masuk', 'POST', () => palsu)({ method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, body: {} }, r3);
  assert.equal(r3.statusCode, 200); assert.deepEqual(r3.headers['Set-Cookie'], ['a=b']);
  assert.equal(r3.headers['Cache-Control'], 'no-store');
});

/* ---------- 14 Nov perbaikan 7: tolak password bocor saat setup (HIBP di-mock) ---------- */
const { PESAN_BOCOR, PESAN_CEK_GAGAL } = require('../api/_lib/app');
async function cobaSetup(app, password) {
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal(a.status, 200);
  return app.setupPassword(post({ tiket: a.body.tiket, password }));
}

test('bocor #1: password yang pernah bocor ditolak 400 dengan pesan, akun tetap tanpa password', async () => {
  const { app, db } = siapkan();
  const r = await cobaSetup(app, 'password123');
  assert.equal(r.status, 400); assert.equal(r.body.galat, 'password_bocor'); assert.equal(r.body.pesan, PESAN_BOCOR);
  assert.equal(r.cookies, undefined);
  assert.equal(await db.akunAmbil(13), null);
});

test('bocor #2: password lolos daftar umum tapi ada di HIBP tetap ditolak', async () => {
  const { app } = siapkan();
  assert.equal(I.cekAturanPassword('kosrumahkedua2024', 'dilla'), null); /* bukan di PASSWORD_UMUM */
  const r = await cobaSetup(app, 'kosrumahkedua2024');
  assert.equal(r.status, 400); assert.equal(r.body.galat, 'password_bocor');
});

test('bocor #3: password acak yang kuat diterima seperti biasa', async () => {
  const { app, db } = siapkan();
  const r = await cobaSetup(app, 'Jemuran-Lantai2-Gazebo!' + crypto.randomBytes(4).toString('hex'));
  assert.equal(r.status, 200); assert.ok((r.cookies || [])[0]);
  assert.match((await db.akunAmbil(13)).password_hash, /^scrypt\$/);
});

test('bocor #4: hanya 5 karakter prefix SHA-1 yang dikirim (k-anonymity), tanpa password/hash utuh', async () => {
  const { app, hibp } = siapkan();
  const pw = 'Rahasia-Kos-' + crypto.randomBytes(4).toString('hex');
  await cobaSetup(app, pw);
  assert.equal(hibp.log.length, 1);
  const sha = crypto.createHash('sha1').update(pw).digest('hex').toUpperCase();
  const { url, opt } = hibp.log[0];
  assert.equal(url, 'https://api.pwnedpasswords.com/range/' + sha.slice(0, 5));
  assert.equal(opt.method, 'GET'); assert.equal(opt.body, undefined);
  const semua = JSON.stringify({ url, headers: opt.headers });
  assert.ok(!semua.includes(pw)); assert.ok(!semua.includes(sha.slice(5))); assert.ok(!semua.toLowerCase().includes(sha.slice(5).toLowerCase()));
  assert.equal(opt.headers['Add-Padding'], 'true');
});

test('bocor #5 (perbaikan 8): HIBP mati / lambat / 500 -> setup DITOLAK (fail closed), pesan coba lagi, tanpa simpan password', async () => {
  for (const mode of ['mati', 'lambat', '500']) {
    for (const pw of ['Jemuran-Lantai2-Gazebo!' + crypto.randomBytes(4).toString('hex'), 'kosrumahkedua2024']) {
      const { app, db } = siapkan({ mode });
      const t0 = Date.now();
      const r = await cobaSetup(app, pw);
      assert.equal(r.status, 400, mode + ': ' + JSON.stringify(r.body));
      assert.equal(r.body.galat, 'cek_bocor_gagal'); assert.equal(r.body.pesan, PESAN_CEK_GAGAL);
      assert.notEqual(r.body.pesan, PESAN_BOCOR);
      assert.equal(r.cookies, undefined);
      assert.equal(await db.akunAmbil(13), null, mode + ': password tersimpan padahal belum terverifikasi');
      assert.ok(Date.now() - t0 < 3000, mode + ' terlalu lama');
    }
    /* password yang juga melanggar aturan lama: pesan aturan lama (coba lagi tidak menolong) */
    const { app: app2 } = siapkan({ mode });
    const r2 = await cobaSetup(app2, 'password123');
    assert.equal(r2.status, 400); assert.equal(r2.body.galat, 'password_lemah');
  }
});

test('bocor #9 (perbaikan 8): HIBP pulih -> tiket yang sama bisa dipakai lagi, password bersih diterima', async () => {
  const { app, hibp, db } = siapkan({ mode: 'mati' });
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  const pw = 'Kunci-Kamar-13-' + crypto.randomBytes(3).toString('hex');
  assert.equal((await app.setupPassword(post({ tiket: a.body.tiket, password: pw }))).body.galat, 'cek_bocor_gagal');
  hibp.mode = 'normal';
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: pw }));
  assert.equal(b.status, 200); assert.match((await db.akunAmbil(13)).password_hash, /^scrypt\$/);
});

test('bocor #10 (perbaikan 8): HIBP mati tidak memengaruhi login penghuni yang sudah punya password', async () => {
  const { app, hibp } = siapkan();
  await setupLengkap(app, 'rina', '246810');
  hibp.mode = 'mati';
  const n = hibp.log.length;
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }))).status, 200);
  assert.equal(hibp.log.length, n);
});

test('bocor #6: login TIDAK memanggil HIBP (bersih maupun salah password)', async () => {
  const { app, hibp } = siapkan();
  await setupLengkap(app, 'rina', '246810');
  const n = hibp.log.length;
  assert.equal((await app.masuk(post({ username: 'rina', password: PW }))).status, 200);
  assert.equal((await app.masuk(post({ username: 'rina', password: 'password123' }))).status, 401);
  assert.equal((await app.masuk(post({ username: 'dilla', password: 'password123' }))).status, 200); /* perlu_setup */
  assert.equal(hibp.log.length, n);
});

test('bocor #7: ditolak karena bocor tidak memakai gerbang percobaan (tiket masih bisa dipakai ulang dengan password lain)', async () => {
  const { app } = siapkan();
  const a = await app.setupPin(post({ username: 'dilla', pin: '135790' }));
  assert.equal((await app.setupPassword(post({ tiket: a.body.tiket, password: 'password123' }))).status, 400);
  const b = await app.setupPassword(post({ tiket: a.body.tiket, password: 'Kunci-Kamar-13-' + crypto.randomBytes(3).toString('hex') }));
  assert.equal(b.status, 200);
});

test('bocor #8: passwordBocor murni — bocor/bersih/tak-terjangkau + baris padding count 0 diabaikan', async () => {
  const hibp = buatFakeHibp({ bocor: ['abc12345'] });
  assert.equal(await I.passwordBocor('abc12345', hibp.fetchFn, 200), true);
  assert.equal(await I.passwordBocor('belum-pernah-bocor-' + crypto.randomBytes(4).toString('hex'), hibp.fetchFn, 200), false);
  const sha = crypto.createHash('sha1').update('padding-saja').digest('hex').toUpperCase();
  const padOnly = async () => ({ ok: true, text: async () => sha.slice(5) + ':0\r\n' });
  assert.equal(await I.passwordBocor('padding-saja', padOnly, 200), false);
  assert.equal(await I.passwordBocor('apa', undefined, 200), null);
  assert.equal(await I.passwordBocor('apa', buatFakeHibp({ mode: 'lambat' }).fetchFn, 100), null);
});
