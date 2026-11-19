'use strict';
/* Tes server foto profil (18 Nov — Ryan 19:31): aksi fotoProfil via fake-db
   + validasi magic bytes + adapter Storage di db.js (fetchFn stub).
   Alur: 'minta' -> signed upload URL -> klien PUT langsung ke Storage
   (file TIDAK lewat Vercel) -> 'selesai' -> server validasi -> simpan URL.
   Jalankan: node --test tests/foto-server.test.js
   Tanpa jaringan, tanpa Supabase asli, tanpa PIN asli penghuni. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatApp, fotoValidasi } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { buatFakeDb } = require('./fake-db');

const RAHASIA = 'uji-'.repeat(10); /* rahasia UJI, bukan rahasia produksi */
const PENGHUNI = [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 13, name: 'dilla', gender: 'Cewek', pin: '135790' }
];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, extra) => ({ method: 'POST', headers: Object.assign({}, H, extra || {}), body, ip: '36.80.1.23' });
const tokenDari = (out) => {
  const c = (out.cookies || []).find((x) => x.startsWith('__Host-kosan_sesi='));
  return c ? c.split(';')[0].split('=')[1] : null;
};
const denganCookie = (ctx, token) => { ctx.headers.cookie = '__Host-kosan_sesi=' + token; return ctx; };
async function login(app, username, pin) {
  const r = await app.masuk(post({ username, pin, ingat: false }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return tokenDari(r);
}
const jpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(100, 0x11)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(100, 0x22)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(100, 0x33)]);

/* ---------- validasi magic bytes ---------- */
test('fotoValidasi: JPEG/PNG/WebP lolos; sisanya ditolak; maks 500 KB', () => {
  assert.equal(fotoValidasi(jpg).ok, true); assert.equal(fotoValidasi(jpg).tipe, 'image/jpeg');
  assert.equal(fotoValidasi(png).ok, true); assert.equal(fotoValidasi(png).tipe, 'image/png');
  assert.equal(fotoValidasi(webp).ok, true); assert.equal(fotoValidasi(webp).tipe, 'image/webp');
  assert.equal(fotoValidasi(Buffer.from('GIF89a' + 'x'.repeat(100))).ok, false, 'GIF ditolak');
  assert.equal(fotoValidasi(Buffer.from('bukan gambar')).ok, false);
  assert.equal(fotoValidasi(Buffer.alloc(0)).ok, false);
  assert.equal(fotoValidasi(null).ok, false);
  const besar = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(500 * 1024, 0)]);
  assert.equal(fotoValidasi(besar).ok, false, 'lebih dari 500 KB ditolak walau JPEG');
  const pas = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(500 * 1024 - 3, 0)]);
  assert.equal(fotoValidasi(pas).ok, true, 'tepat 500 KB lolos');
});

/* ---------- aksi fotoProfil ---------- */
test('fotoProfil: tamu ditolak (401); aksi tidak dikenal -> 400', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const r = await app.fotoProfil(post({ aksi: 'lihat' }));
  assert.equal(r.status, 401);
  const token = await login(app, 'rina', '246810');
  const r2 = await app.fotoProfil(denganCookie(post({ aksi: 'apa' }), token));
  assert.equal(r2.status, 400);
});

test('fotoProfil: tamu ditolak (401) di SEMUA aksi + cookie palsu juga 401 (Ryan 22:28)', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  for (const aksi of ['lihat', 'minta', 'selesai']) {
    const r = await app.fotoProfil(post({ aksi }));
    assert.equal(r.status, 401, aksi + ' tanpa cookie harus 401');
    assert.equal(r.body.galat, 'perlu_login', aksi);
  }
  const palsu = await app.fotoProfil(denganCookie(post({ aksi: 'minta' }), 'token-palsu-tidak-ada'));
  assert.equal(palsu.status, 401, 'cookie palsu harus 401');
  assert.equal(palsu.body.galat, 'perlu_login');
});

test('fotoProfil: lihat -> null dulu; minta -> signed URL; selesai (JPEG) -> url publik; lihat lagi -> url itu', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const token = await login(app, 'rina', '246810');
  const lihat0 = await app.fotoProfil(denganCookie(post({ aksi: 'lihat' }), token));
  assert.equal(lihat0.status, 200); assert.equal(lihat0.body.url, null);
  const minta = await app.fotoProfil(denganCookie(post({ aksi: 'minta' }), token));
  assert.equal(minta.status, 200);
  assert.ok(minta.body.unggah.startsWith('https://foto.test/unggah/3'), JSON.stringify(minta.body));
  db._fotoUnggah(3, jpg); /* seolah klien sudah PUT ke Storage */
  const selesai = await app.fotoProfil(denganCookie(post({ aksi: 'selesai' }), token));
  assert.equal(selesai.status, 200, JSON.stringify(selesai.body));
  assert.ok(selesai.body.url.startsWith('https://foto.test/foto-profil/3?v='), selesai.body.url);
  const lihat1 = await app.fotoProfil(denganCookie(post({ aksi: 'lihat' }), token));
  assert.equal(lihat1.body.url, selesai.body.url, 'lihat mengembalikan url yang sama');
});

test('fotoProfil: selesai dengan isi bukan gambar -> 400 + objek dihapus', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const token = await login(app, 'rina', '246810');
  db._fotoUnggah(3, Buffer.from('bukan gambar sama sekali'));
  const r = await app.fotoProfil(denganCookie(post({ aksi: 'selesai' }), token));
  assert.equal(r.status, 400); assert.equal(r.body.galat, 'foto_tidak_valid');
  assert.equal(db._t.fotoObjek.has(3), false, 'objek tidak valid dihapus dari Storage');
  const lihat = await app.fotoProfil(denganCookie(post({ aksi: 'lihat' }), token));
  assert.equal(lihat.body.url, null, 'DB tidak menyimpan URL foto tidak valid');
});

test('fotoProfil: selesai tanpa objek terunggah -> galat (bukan 200)', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const token = await login(app, 'rina', '246810');
  await assert.rejects(app.fotoProfil(denganCookie(post({ aksi: 'selesai' }), token)));
});

test('fotoProfil: satu foto per pemain — unggah kedua menimpa yang pertama', async () => {
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => Date.parse('2026-11-18T10:00:00Z') });
  const token = await login(app, 'rina', '246810');
  db._fotoUnggah(3, jpg);
  const s1 = await app.fotoProfil(denganCookie(post({ aksi: 'selesai' }), token));
  assert.ok(s1.body.url.startsWith('https://foto.test/foto-profil/3?v='), s1.body.url);
  db._fotoUnggah(3, png);
  const s2 = await app.fotoProfil(denganCookie(post({ aksi: 'selesai' }), token));
  assert.ok(s2.body.url.startsWith('https://foto.test/foto-profil/3?v='), s2.body.url);
  assert.equal(db._t.foto.size, 1, 'tetap 1 baris di kosan_foto_profil (menimpa, bukan baris baru)');
  const lihat = await app.fotoProfil(denganCookie(post({ aksi: 'lihat' }), token));
  assert.equal(lihat.body.url, s2.body.url, 'lihat mengembalikan foto kedua');
});

/* ---------- adapter Storage di db.js ---------- */
function stubFetch() {
  const panggilan = [];
  const fetchFn = async (u, o) => {
    panggilan.push(u + '|' + (o && o.method || 'GET'));
    const ok = (body, extra) => Object.assign({ ok: true, status: 200, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }, extra || {});
    if (u.includes('/storage/v1/bucket/foto-profil')) return ok({ id: 'foto-profil', public: true });
    if (u.includes('/storage/v1/object/upload/sign/foto-profil/41')) return ok({ url: 'object/upload/sign/foto-profil/41?token=tok123' });
    if (u.includes('/storage/v1/object/foto-profil/41')) return ok('', { arrayBuffer: async () => jpg.buffer.slice(jpg.byteOffset, jpg.byteOffset + jpg.byteLength) });
    if (u.includes('/rest/v1/kosan_foto_profil')) {
      if ((o && o.method) === 'POST') return ok('');
      return ok([{ url: 'https://sb.test/storage/v1/object/public/foto-profil/41?v=9', diperbarui: '2026-11-18T10:00:00Z' }]);
    }
    return { ok: false, status: 404, text: async () => '{"message":"tidak ada"}' };
  };
  return { fetchFn, panggilan };
}

test('db.js Storage: fotoMintaUrl -> URL PUT lengkap; fotoUnduh -> Buffer; fotoUrlPublik; fotoAmbil/fotoSimpan', async () => {
  const { fetchFn, panggilan } = stubFetch();
  const db = buatDb({ url: 'https://sb.test', kunci: 'sb_secret_uji', fetchFn });
  assert.equal(db.fotoUrlPublik(41), 'https://sb.test/storage/v1/object/public/foto-profil/41');
  const m = await db.fotoMintaUrl(41);
  assert.equal(m.unggah, 'https://sb.test/storage/v1/object/upload/sign/foto-profil/41?token=tok123');
  assert.ok(panggilan.some((p) => p.includes('/storage/v1/bucket/foto-profil')), 'cek bucket dulu');
  const buf = await db.fotoUnduh(41);
  assert.ok(Buffer.isBuffer(buf) && buf[0] === 0xFF && buf[1] === 0xD8, 'bytes JPEG kembali');
  const row = await db.fotoAmbil(41);
  assert.equal(row.url, 'https://sb.test/storage/v1/object/public/foto-profil/41?v=9');
  await db.fotoSimpan(41, 'https://sb.test/storage/v1/object/public/foto-profil/41?v=10');
  assert.ok(panggilan.some((p) => p.includes('/rest/v1/kosan_foto_profil')), 'simpan lewat PostgREST');
});
