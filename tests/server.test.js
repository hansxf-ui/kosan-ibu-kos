'use strict';
/* Tes server Fase A, versi PIN saja (perbaikan 9 — lapisan password dicabut).
   Jalankan: node --test tests/server.test.js
   Tanpa jaringan, tanpa Supabase asli, tanpa PIN asli penghuni. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../api/_lib/inti');
const { buatApp, UMUR_INGAT, PESAN } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { jalankan } = require('../api/_lib/jalankan');
const { buatFakeDb } = require('./fake-db');

const RAHASIA = 'uji-'.repeat(10); /* rahasia UJI, bukan rahasia produksi */
const PENGHUNI = [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 13, name: 'dilla', gender: 'Cewek', pin: '135790' },
  { room: 14, name: 'dil', gender: 'Cowok', pin: '135790' },
  { room: 7, name: '864200', gender: 'Cowok', pin: '864200' } /* penghuni lama: PIN kebetulan = username */
];
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function siapkan() {
  let jam = Date.parse('2026-11-14T03:00:00Z');
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => jam });
  const majukan = (ms) => { jam += ms; };
  return { db, app, majukan };
}
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, extra) => ({ method: 'POST', headers: Object.assign({}, H, extra || {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {} });
const tokenDari = (out) => {
  const c = (out.cookies || []).find((x) => x.startsWith('__Host-kosan_sesi='));
  return c ? c.split(';')[0].split('=')[1] : null;
};
const denganCookie = (ctx, token) => { ctx.headers.cookie = '__Host-kosan_sesi=' + token; return ctx; };
async function login(app, username, pin, ingat) {
  const r = await app.masuk(post({ username, pin, ingat: !!ingat }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return tokenDari(r);
}
const daftarBody = (o) => Object.assign({ username: 'sari', gender: 'cewek', kunci: 'KOSAN', pin: '975310', ingat: false }, o || {});

/* ---------- inti ---------- */
test('pinHash server = pinHash di index.html (salinan verbatim)', () => {
  const awal = HTML.indexOf("var PIN_SALT = 'kosan-ibu-kos-pin-v1';");
  const akhir = HTML.indexOf('\n}\n', HTML.indexOf('function pinHash', awal)) + 3;
  assert.ok(awal > 0 && akhir > awal, 'pinHash tidak ditemukan di index.html');
  const klien = new Function(HTML.slice(awal, akhir) + '\nreturn pinHash;')();
  for (const v of ['000000', '123456', '999999', '024680', '', 'abc']) assert.equal(I.pinHash(v), klien(v), v);
});

test('roomFor server = roomFor di index.html (salinan verbatim)', () => {
  const a = HTML.indexOf('function normalize(nama) {');
  const normalizeKlien = HTML.slice(a, HTML.indexOf('\n}\n', a) + 3);
  const b = HTML.indexOf('function roomFor(nama) {');
  const roomForKlien = HTML.slice(b, HTML.indexOf('\n}\n', b) + 3);
  const klien = new Function(normalizeKlien + roomForKlien + '\nreturn roomFor;')();
  for (const n of ['rina', '@Dilla ', 'Budi  Santoso', 'sari', '123456']) assert.equal(I.roomFor(n), klien(n), n);
});

test('IP disimpan sebagai HMAC + prefiks, bukan IP mentah', () => {
  const a = I.ipHmac(RAHASIA, '36.80.1.23'), b = I.ipHmac(RAHASIA, '36.80.1.99');
  assert.match(a.ip_hmac, /^[0-9a-f]{64}$/);
  assert.notEqual(a.ip_hmac, b.ip_hmac);
  assert.equal(a.ip_prefiks_hmac, b.ip_prefiks_hmac);
  assert.ok(!JSON.stringify(a).includes('36.80'));
  assert.equal(I.prefiksIp('2001:db8:abcd:12::1'), '2001:db8:abcd::/48');
});

test('cookie sesi: HttpOnly, Secure, SameSite=Strict, __Host-, Max-Age hanya kalau ingat', () => {
  const c1 = I.cookieSesi('a'.repeat(43), { ingat: true, aman: true, maxAgeDetik: 2592000 });
  assert.match(c1, /^__Host-kosan_sesi=a{43}; Path=\/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000$/);
  assert.ok(!/Max-Age/.test(I.cookieSesi('a'.repeat(43), { ingat: false, aman: true, maxAgeDetik: 2592000 })));
  assert.equal(I.bacaCookie('x=1; __Host-kosan_sesi=' + 'b'.repeat(43), '__Host-kosan_sesi'), 'b'.repeat(43));
  assert.equal(I.bacaCookie('__Host-kosan_sesi=<script>', '__Host-kosan_sesi'), null);
});

test('kode password/scrypt/HIBP/tiket sudah tidak ada di server', () => {
  for (const f of ['inti.js', 'app.js', 'db.js', 'jalankan.js']) {
    const s = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', f), 'utf8');
    assert.ok(!/crypto\.scrypt|pwnedpasswords|passwordBocor|hashPassword|cekPassword|bacaTiket|setupPassword/.test(s), f);
  }
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'setup', 'password.js')));
  assert.equal(I.hashPassword, undefined);
});

/* ---------- login nama + PIN ---------- */
test('login: nama + PIN benar -> sesi langsung (cookie), gender dari data penghuni', async () => {
  const { app, db } = siapkan();
  const r = await app.masuk(post({ username: '@Dilla', pin: '135790', ingat: true, perangkat: 'perangkat-uji-01' }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { room: 13, name: 'dilla', gender: 'cewek' });
  assert.ok(tokenDari(r));
  assert.equal(db._t.log[0].peristiwa, 'masuk');
  assert.match(db._t.log[0].ip_hmac, /^[0-9a-f]{64}$/);
});

test('login: PIN salah -> 401 pin_salah + gerbang menghitung', async () => {
  const { app, db } = siapkan();
  const r = await app.masuk(post({ username: 'rina', pin: '000000' }));
  assert.equal(r.status, 401); assert.equal(r.body.galat, 'pin_salah'); assert.equal(r.body.pesan, PESAN.pinSalah);
  assert.equal(r.cookies, undefined);
  assert.equal(db._t.gerbang.get('pin:3').n, 1);
});

test('login: 5x PIN salah -> percobaan ke-6 terkunci 429 (PIN benar pun), jawaban sama', async () => {
  const { app, majukan } = siapkan();
  for (let i = 0; i < 5; i++) assert.equal((await app.masuk(post({ username: 'rina', pin: '00000' + i }))).status, 401);
  const salah = await app.masuk(post({ username: 'rina', pin: '999999' }));
  const benar = await app.masuk(post({ username: 'rina', pin: '246810' }));
  assert.equal(salah.status, 429); assert.equal(benar.status, 429); assert.deepEqual(salah.body, benar.body);
  majukan(20 * 60000 + 1);
  assert.equal((await app.masuk(post({ username: 'rina', pin: '246810' }))).status, 200);
});

test('login: nama bukan penghuni -> 401 pesan belum-terdaftar, tanpa sesi, tanpa cek PIN', async () => {
  const { app, db } = siapkan();
  const r = await app.masuk(post({ username: 'orang-asing', pin: '123456' }));
  assert.equal(r.status, 401); assert.equal(r.body.galat, 'tidak_terdaftar');
  assert.equal(r.body.pesan, 'Nama ini belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu.');
  assert.equal(r.cookies, undefined);
  assert.ok(!db._panggilan.includes('loginPin'));
});

test('login: PIN yang kebetulan sama dengan username TIDAK ditolak (aturan hanya saat daftar)', async () => {
  const { app } = siapkan();
  assert.ok(await login(app, '864200', '864200'));
});

test('login: format salah (password lama / PIN bukan 6 digit) -> 400', async () => {
  const { app } = siapkan();
  assert.equal((await app.masuk(post({ username: 'rina', password: 'apa-saja-123' }))).status, 400);
  assert.equal((await app.masuk(post({ username: 'rina', pin: '12345' }))).status, 400);
  assert.equal((await app.masuk(post({ username: 'rina', pin: 'abcdef' }))).status, 400);
});

test('setup/pin (alias) langsung membuat sesi — tanpa tahap password / tiket', async () => {
  const { app } = siapkan();
  const r = await app.setupPin(post({ username: 'dilla', pin: '135790', ingat: true }));
  assert.equal(r.status, 200); assert.deepEqual(r.body, { room: 13, name: 'dilla', gender: 'cewek' });
  assert.ok(tokenDari(r)); assert.equal(r.body.tiket, undefined);
  assert.equal((await app.sesi(get(tokenDari(r)))).status, 200);
});

test('data penghuni lama tidak diubah oleh login (nama, kamar, gender, pin_hash)', async () => {
  const { app, db } = siapkan();
  const ambil = () => JSON.stringify(db._lama.map(({ room, name, gender, pin_hash }) => ({ room, name, gender, pin_hash })));
  const sebelum = ambil();
  await login(app, 'dilla', '135790');
  await app.masuk(post({ username: 'rina', pin: '000000' }));
  assert.equal(ambil(), sebelum);
});

test('tidak ada PIN mentah di database, respons, log, atau cookie; token sesi disimpan sebagai SHA-256', async () => {
  const { app, db } = siapkan();
  const r = await app.masuk(post({ username: 'rina', pin: '246810', ingat: true }));
  const semua = JSON.stringify({ akun: [...db._t.akun.values()], sesi: db._t.sesi, log: db._t.log, r });
  assert.ok(!semua.includes('246810'));
  const token = tokenDari(r);
  assert.ok(!JSON.stringify(db._t.sesi).includes(token));
  assert.equal(db._t.sesi[0].token_sha256, I.sha256hex(token));
});

test('batas 20 percobaan masuk per IP per jam', async () => {
  const { app } = siapkan();
  let terakhir;
  for (let i = 0; i < 21; i++) terakhir = await app.masuk(post({ username: 'orang-asing', pin: '123456' }));
  assert.equal(terakhir.status, 429);
});

/* ---------- daftar ---------- */
test('daftar: username baru + kode + PIN -> terdaftar + sesi langsung', async () => {
  const { app, db } = siapkan();
  const r = await app.daftar(post(daftarBody({ ingat: true })));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.name, 'sari'); assert.equal(r.body.gender, 'cewek');
  assert.ok(tokenDari(r));
  const baru = db._lama.find((x) => x.name === 'sari');
  assert.equal(baru.pin_hash, I.pinHash('975310'));
  assert.ok(await login(app, 'sari', '975310'));
});

test('RED->GREEN daftar: PIN sama dengan username -> 400 pin_sama_username, tidak memanggil kosan_register', async () => {
  const { app, db } = siapkan();
  const r = await app.daftar(post(daftarBody({ username: '135799', pin: '135799' })));
  assert.equal(r.status, 400); assert.equal(r.body.galat, 'pin_sama_username'); assert.equal(r.body.pesan, PESAN.pinSamaUsername);
  assert.ok(!db._panggilan.includes('register'));
  assert.ok(!db._lama.some((x) => x.name === '135799'));
  /* "@135799 " dinormalisasi -> tetap ditolak */
  assert.equal((await app.daftar(post(daftarBody({ username: ' @135799 ', pin: '135799' })))).body.galat, 'pin_sama_username');
  /* PIN lain untuk username angka -> boleh */
  assert.equal((await app.daftar(post(daftarBody({ username: '135799', pin: '246802' })))).status, 200);
});

test('daftar: galat kosan_register diteruskan (nama terpakai, kunci salah), tanpa sesi', async () => {
  const { app } = siapkan();
  const a = await app.daftar(post(daftarBody({ username: 'Rina' })));
  assert.equal(a.status, 400); assert.match(a.body.pesan, /nama sudah terdaftar/); assert.equal(a.cookies, undefined);
  const b = await app.daftar(post(daftarBody({ kunci: 'SALAH' })));
  assert.equal(b.status, 400); assert.match(b.body.pesan, /kunci salah/);
});

test('daftar: validasi format (username, gender, PIN)', async () => {
  const { app } = siapkan();
  assert.equal((await app.daftar(post(daftarBody({ username: 'rіna' })))).status, 400); /* homoglyph Cyrillic */
  assert.equal((await app.daftar(post(daftarBody({ gender: 'x' })))).status, 400);
  assert.equal((await app.daftar(post(daftarBody({ pin: '12345' })))).status, 400);
});

test('klien juga menolak PIN == username saat daftar (pinSamaUsername)', () => {
  const awal = HTML.indexOf('function pinSamaUsername(');
  assert.ok(awal > 0, 'pinSamaUsername tidak ada di index.html');
  const f = new Function(HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3) + '\nreturn pinSamaUsername;')();
  assert.equal(f('135799', '135799'), true);
  assert.equal(f('135799', ' @135799 '), true);
  assert.equal(f('246802', '135799'), false);
  assert.equal(f('135799', 'rina'), false);
});

/* ---------- sesi ("Ingat saya") ---------- */
test('sesi: cookie sah -> identitas + gender; tanpa cookie -> 401', async () => {
  const { app } = siapkan();
  const tok = await login(app, 'dil', '135790', true);
  const r = await app.sesi(get(tok));
  assert.equal(r.status, 200); assert.deepEqual(r.body, { room: 14, name: 'dil', gender: 'cowok' });
  assert.equal((await app.sesi(get())).status, 401);
});

test('sesi Ingat saya diperpanjang (sliding) dan habis sesudah 30 hari tanpa dipakai', async () => {
  const { app, majukan } = siapkan();
  const tok = await login(app, 'rina', '246810', true);
  majukan(2 * 3600000);
  const r = await app.sesi(get(tok));
  assert.equal(r.status, 200); assert.ok(r.cookies && /Max-Age=2592000/.test(r.cookies[0]));
  majukan(UMUR_INGAT + 1);
  const habis = await app.sesi(get(tok));
  assert.equal(habis.status, 401); assert.match(habis.cookies[0], /Max-Age=0/);
});

test('sesi tanpa Ingat saya dibatasi 12 jam di server', async () => {
  const { app, majukan } = siapkan();
  const tok = await login(app, 'rina', '246810', false);
  majukan(12 * 3600000 + 1);
  assert.equal((await app.sesi(get(tok))).status, 401);
});

test('keluar mencabut sesi', async () => {
  const { app } = siapkan();
  const tok = await login(app, 'rina', '246810', true);
  const k = await app.keluar(denganCookie(post({}), tok));
  assert.equal(k.status, 200); assert.match(k.cookies[0], /Max-Age=0/);
  assert.equal((await app.sesi(get(tok))).status, 401);
});

test('kosan_akun_reset oleh pemilik mencabut sesi lama', async () => {
  const { app, db } = siapkan();
  const tok = await login(app, 'rina', '246810', true);
  await db.akunReset(3);
  assert.equal((await app.sesi(get(tok))).status, 401);
  assert.ok(await login(app, 'rina', '246810'));
});

/* ---------- PIN kamar ---------- */
test('masuk kamar butuh sesi penghuni + PIN benar, TIAP KALI', async () => {
  const { app } = siapkan();
  const tok = await login(app, 'dilla', '135790', true);
  const tamu = await app.kamarMasuk(post({ room: 13, pin: '135790' }));
  assert.equal(tamu.status, 401); assert.equal(tamu.body.galat, 'perlu_login');
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 14, pin: '135790' }), tok))).status, 403);
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '000000' }), tok))).status, 401);
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13 }), tok))).status, 400); /* tanpa PIN: tidak diingat */
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
});

test('gerbang PIN berlaku juga untuk PIN kamar; saat terkunci kosan_login tidak dipanggil', async () => {
  const { app, db } = siapkan();
  const tok = await login(app, 'dilla', '135790', true);
  for (let i = 0; i < 5; i++) await app.kamarMasuk(denganCookie(post({ room: 13, pin: '00000' + i }), tok));
  const n = db._panggilan.filter((x) => x === 'loginPin').length;
  const a = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '999999' }), tok));
  const b = await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok));
  assert.equal(a.status, 429); assert.equal(b.status, 429); assert.deepEqual(a.body, b.body);
  assert.equal(db._panggilan.filter((x) => x === 'loginPin').length, n);
});

test('PIN benar tidak menghabiskan jatah gerbang', async () => {
  const { app } = siapkan();
  const tok = await login(app, 'dilla', '135790', true);
  for (let i = 0; i < 12; i++) assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tok))).status, 200);
});

test('dua penghuni dengan PIN sama tetap terpisah', async () => {
  const { app } = siapkan();
  const tokDil = await login(app, 'dil', '135790', true);
  assert.equal((await app.kamarMasuk(denganCookie(post({ room: 13, pin: '135790' }), tokDil))).status, 403);
});

/* ---------- gerbang (temuan review + verifikasi Postgres, versi PIN) ---------- */
test('tebakan dicicil (5 dalam 15 menit) tidak membuka celah penunjuk PIN', async () => {
  const { app, majukan } = siapkan();
  for (let i = 0; i < 5; i++) { await app.masuk(post({ username: 'dilla', pin: '00000' + i })); majukan(3 * 60000); }
  majukan(10 * 1000);
  const salah = await app.masuk(post({ username: 'dilla', pin: '999999' }));
  const benar = await app.masuk(post({ username: 'dilla', pin: '135790' }));
  assert.equal(salah.status, benar.status); assert.deepEqual(salah.body, benar.body);
});

test('sepi 20 menit menghapus juga hitungan kosan_login (tidak dobel-hitung)', async () => {
  const { app, majukan } = siapkan();
  const pin = (p) => app.masuk(post({ username: 'dilla', pin: p }));
  for (let i = 0; i < 3; i++) assert.equal((await pin('00000' + i)).status, 401);
  majukan(20 * 60000);
  for (let i = 0; i < 2; i++) assert.equal((await pin('10000' + i)).status, 401);
  assert.equal((await pin('135790')).status, 200, 'penghuni terkunci oleh hitungan lama kosan_login');
  for (let i = 0; i < 3; i++) assert.equal((await pin('20000' + i)).status, 401);
  assert.equal((await pin('135790')).status, 429, 'percobaan ke-6 dalam jendela harus terkunci');
});

test('kunci lama kosan_login (5x PIN salah) dibuka kosan_akun_buka / kosan_akun_reset', async () => {
  for (const buka of ['akunBuka', 'akunReset']) {
    const { app, db } = siapkan();
    await app.masuk(post({ username: 'dilla', pin: '000000' })); /* baris gerbang sudah ada (1 percobaan) */
    for (let i = 0; i < 5; i++) await db.loginPin('dilla', 'salah' + i); /* kunci lewat jalur lama (anon) */
    assert.equal((await app.masuk(post({ username: 'dilla', pin: '135790' }))).status, 429);
    await db[buka](13);
    assert.equal((await app.masuk(post({ username: 'dilla', pin: '135790' }))).status, 200, buka);
  }
});

test('40 PIN paralel tidak bisa melewati gerbang', async () => {
  const { app } = siapkan();
  const tebak = Array.from({ length: 39 }, (_, i) => String(100000 + i)).concat(['246810']);
  const out = await Promise.all(tebak.map((pin, i) => app.masuk(post({ username: 'rina', pin }, { 'x-uji': String(i) }))));
  assert.ok(out.filter((o) => o.status === 401).length <= 5);
  assert.equal(out[39].status, 429);
});

test('batas IP: IPv6 per /64, IPv4-mapped = IPv4', async () => {
  assert.equal(I.kunciBatasIp(RAHASIA, '2001:db8:1:2::a'), I.kunciBatasIp(RAHASIA, '2001:db8:1:2:ffff::b'));
  assert.notEqual(I.kunciBatasIp(RAHASIA, '2001:db8:1:2::a'), I.kunciBatasIp(RAHASIA, '2001:db8:1:3::a'));
  assert.equal(I.kunciBatasIp(RAHASIA, '::ffff:36.80.1.23'), I.kunciBatasIp(RAHASIA, '36.80.1.23'));
  const { app } = siapkan();
  let terakhir;
  for (let i = 0; i < 21; i++) {
    const ctx = post({ username: 'orang-asing', pin: '123456' }); ctx.ip = '2001:db8:1:2::' + (i + 1).toString(16);
    terakhir = await app.masuk(ctx);
  }
  assert.equal(terakhir.status, 429);
});

/* ---------- CSRF / konfigurasi / adapter ---------- */
test('POST dari origin lain / bukan JSON ditolak', async () => {
  const { app } = siapkan();
  const b = { username: 'rina', pin: '246810' };
  assert.equal((await app.masuk(post(b, { origin: 'https://jahat.example' }))).status, 403);
  assert.equal((await app.masuk(post(b, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await app.masuk(post(b, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await app.daftar(post(daftarBody(), { origin: 'https://jahat.example' }))).status, 403);
  assert.equal((await app.masuk(post(null))).status, 400);
});

test('app menolak jalan tanpa KOSAN_SECRET yang cukup panjang', () => {
  assert.throws(() => buatApp({ db: {}, rahasia: '' }));
  assert.throws(() => buatApp({ db: {}, rahasia: 'pendek' }));
});

test('db.js: header service role, path aman, kunci PIN dipetakan, upsert akun + register', async () => {
  const log = [];
  const fetchFn = async (url, o) => {
    log.push({ url, o });
    if (url.endsWith('rpc/kosan_login')) return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'Terlalu banyak percobaan' }) };
    if (url.endsWith('rpc/kosan_register')) return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'nama sudah terdaftar' }) };
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const db = buatDb({ url: 'https://x.supabase.co/', kunci: 'eyJ.service', fetchFn });
  assert.deepEqual(await db.loginPin('rina', 'abcd1234'), { ok: false, terkunci: true });
  assert.equal(await db.akunAmbil(3), null);
  await assert.rejects(db.akunAmbil('3;drop'));
  await assert.rejects(db.sesiAmbil('bukan-hex'));
  assert.equal(log[0].url, 'https://x.supabase.co/rest/v1/rpc/kosan_login');
  assert.equal(log[0].o.headers.Authorization, 'Bearer eyJ.service');
  await db.akunSimpan({ room: 3, nama_norm: 'rina', gender: 'cewek' });
  const up = log[log.length - 1];
  assert.equal(up.url, 'https://x.supabase.co/rest/v1/kosan_akun'); assert.match(up.o.headers.Prefer, /merge-duplicates/);
  assert.deepEqual(JSON.parse(up.o.body), { room: 3, nama_norm: 'rina', gender: 'cewek' });
  await assert.rejects(db.register({ p_name: 'rina' }), (e) => e.status === 400 && /nama sudah terdaftar/.test(e.message));
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
