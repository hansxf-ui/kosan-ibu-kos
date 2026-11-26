'use strict';
/* Tes Warna Kamar (Ryan 26 Nov): daftar putih (klien = server), simpan/baca lewat endpoint yang ada
   (/api/belanja aksi gaya + field gaya di /api/dompet) dengan database palsu — kamar 3 DAN kamar 41 + 60
   (pelajaran bug Gedung E/F), tamu/tanpa sesi ditolak, batas laju, dompet tetap jalan kalau tabel belum
   dimigrasi, migrasi SQL, logika bahan klien (bawaan identik, pulih saat keluar kamar), dan kabel ke
   index.html (LED plaza + arkade tidak tersentuh, fetch( tetap 4). Tanpa jaringan.
   Jalankan: node --test tests/warna-kamar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../api/_lib/gaya');
const { buatApp, BATAS_PENGHUNI } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const DATA = antara('/* ==== WARNA-KAMAR-START ==== */', '/* ==== WARNA-KAMAR-END ==== */');
const UI = antara('/* ==== WARNA-KAMAR-UI-START ==== */', '/* ==== WARNA-KAMAR-UI-END ==== */');
const C = new Function(DATA + '\nreturn { WARNA_KAMAR, wkBawaan, wkCari, wkRapikan, wkSama, wkAwal };')();

const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [{ room: 3, name: 'rina', gender: 'Cewek', pin: '246810' }, { room: 60, name: 'bagas', gender: 'Cowok', pin: '135790' }, { room: 41, name: 'tya', gender: 'Cewek', pin: '112233' }];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token, hdr) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}, hdr || {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
function siapkan() {
  const S = { jam: Date.parse('2026-11-26T13:30:00Z') };
  S.db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => S.jam });
  S.app = buatApp({ db: S.db, rahasia: RAHASIA, sekarang: () => S.jam });
  return S;
}
async function login(S, username, pin) {
  const r = await S.app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
const gaya = (dinding, lantai, selimut) => ({ aksi: 'gaya', dinding, lantai, selimut });

/* ---------- daftar putih ---------- */
test('daftar pilihan klien = daftar putih server; indeks 0 = bawaan; nama + warna lengkap', () => {
  assert.deepEqual(C.WARNA_KAMAR.dinding.map((o) => o.id), G.DINDING);
  assert.deepEqual(C.WARNA_KAMAR.lantai.map((o) => o.id), G.LANTAI);
  assert.deepEqual(C.WARNA_KAMAR.selimut.map((o) => o.id), G.SELIMUT);
  assert.deepEqual(C.wkBawaan(), Object.assign({}, G.BAWAAN));
  assert.equal(G.DINDING.length, 28); assert.equal(G.LANTAI.length, 9); assert.equal(G.SELIMUT.length, 19);
  assert.deepEqual([G.DINDING[0], G.DINDING[27], G.LANTAI[8], G.SELIMUT[18]], ['d0', 'd27', 'l8', 's18']);
  const hex = /^#[0-9a-f]{6}$/;
  for (const o of C.WARNA_KAMAR.dinding) { assert.match(o.cat, hex); assert.match(o.aksen, hex); assert.ok(o.nama.length >= 3 && o.nama.length <= 9, 'nama muat satu baris di 4 kolom: ' + o.nama); }
  for (const o of C.WARNA_KAMAR.lantai) { assert.match(o.rata, hex); assert.ok(['kayu', 'ubin', 'semen', 'karpet'].includes(o.jenis), o.jenis); assert.ok(o.nama.length <= 12, o.nama); }
  for (const o of C.WARNA_KAMAR.selimut) { assert.match(o.kain, hex); assert.ok(o.nama.length <= 9, o.nama); }
  for (const j of ['dinding', 'lantai', 'selimut']) {
    const nama = C.WARNA_KAMAR[j].map((o) => o.nama); assert.equal(new Set(nama).size, nama.length, 'nama unik ' + j);
    for (const id of C.WARNA_KAMAR[j].map((o) => o.id)) assert.match(id, /^[dls][0-9]{1,2}$/, 'bentuk kode = CHECK di migrasi');
  }
});
/* Koreksi Ryan 26 Nov 23:50: "nama harus sesuai warna palet, dan warnanya kasih lengkap". */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hsl = (h) => { const [r, g, b] = rgb(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let hh = mx === r ? ((g - b) / d) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4); hh = (hh * 60 + 360) % 360; return [hh, s, l]; };
test('palet lengkap + nama = warna: putih/hitam sungguhan, tiap keluarga warna ada, tidak ada dua pilihan yang nyaris kembar', () => {
  const warnaDari = (j) => (o) => (j === 'dinding' ? o.cat : o.kain);
  for (const j of ['dinding', 'selimut']) {
    const L = C.WARNA_KAMAR[j], w = warnaDari(j), cari = (n) => { const o = L.find((x) => x.nama === n); assert.ok(o, j + ' punya ' + n); return w(o); };
    const putih = rgb(cari('Putih')), hitam = rgb(cari('Hitam'));
    assert.ok(Math.min(...putih) >= 240 && Math.max(...putih) - Math.min(...putih) <= 6, 'Putih = putih netral, bukan krem: ' + putih);
    assert.ok(Math.max(...hitam) <= 45, 'Hitam = hitam: ' + hitam);
    const rona = { Kuning: [42, 62], Oranye: [18, 38], Merah: [350, 8], Pink: [330, 350], Ungu: [255, 285], Biru: [205, 225], Tosca: [168, 186], Hijau: [115, 140] };
    for (const n of Object.keys(rona)) { const [h, s2] = hsl(cari(n)), [a, b] = rona[n]; assert.ok(s2 >= 0.38, n + ' cukup pekat'); assert.ok(a < b ? (h >= a && h <= b) : (h >= a || h <= b), j + ' ' + n + ' rona ' + h.toFixed(0)); }
    for (const n of ['Abu', 'Arang']) assert.ok(hsl(cari(n))[1] <= 0.08, n + ' netral');
    for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) {
      const a = rgb(w(L[i])), b = rgb(w(L[k])), jarak = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(jarak >= 24, j + ': ' + L[i].nama + ' vs ' + L[k].nama + ' terlalu mirip (' + jarak.toFixed(0) + ')');
    }
  }
  const D = C.WARNA_KAMAR.dinding, nama = D.map((o) => o.nama);
  for (const n of ['Krem Abu', 'Putih', 'Gading', 'Krem', 'Abu Muda', 'Mustard', 'Peach', 'Terakota', 'Maroon', 'Pink Muda', 'Ungu Muda', 'Biru Muda', 'Navy', 'Mint', 'Sage', 'Kopi Susu', 'Cokelat']) assert.ok(nama.includes(n), n);
  for (const o of D.slice(1)) { /* aksen = nada lebih tua dari warna yang sama (bukan warna lain) */
    const c = hsl(o.cat), a = hsl(o.aksen); assert.ok(a[2] < c[2], o.nama + ': aksen lebih tua');
    if (c[1] > 0.2) { const dh = Math.abs(c[0] - a[0]); assert.ok(Math.min(dh, 360 - dh) <= 14, o.nama + ': aksen serona'); }
  }
  assert.match(D[0].cat, /^#[0-9a-f]{6}$/); assert.match(D[0].aksen, /^#[0-9a-f]{6}$/); /* kotak pilihan asli = warna TERUKUR di kamar (alat/ukur.js) */ assert.equal(D[0].nama, 'Krem Abu', 'pilihan asli diberi nama warna sebenarnya (krem keabuan), bukan "Putih"');
  const jenis = C.WARNA_KAMAR.lantai.map((o) => o.jenis); for (const x of ['kayu', 'ubin', 'semen', 'karpet']) assert.ok(jenis.includes(x), x);
});
test('sahkan: hanya kombinasi dari daftar; rapikan: kode tak dikenal -> bawaan (klien sama)', () => {
  assert.deepEqual(G.sahkan({ dinding: 'd27', lantai: 'l8', selimut: 's17', room: 9 }), { dinding: 'd27', lantai: 'l8', selimut: 's17' });
  for (const b of [null, 1, 'd1', {}, { dinding: 'd1' }, { dinding: 'd28', lantai: 'l0', selimut: 's0' }, { dinding: 'd1', lantai: 'l9', selimut: 's0' }, { dinding: 'd100', lantai: 'l0', selimut: 's0' }, { dinding: 'd01', lantai: 'l0', selimut: 's0' }, { dinding: 'd', lantai: 'l0', selimut: 's0' },
    { dinding: 'd1', lantai: 'l0', selimut: 's19' }, { dinding: 1, lantai: 'l0', selimut: 's0' }, { dinding: ['d1'], lantai: 'l0', selimut: 's0' },
    { dinding: 'D1', lantai: 'l0', selimut: 's0' }, { dinding: 'd1 ', lantai: 'l0', selimut: 's0' }, { dinding: '#ff0000', lantai: 'l0', selimut: 's0' },
    { dinding: 'toString', lantai: 'l0', selimut: 's0' }]) assert.equal(G.sahkan(b), null, JSON.stringify(b));
  assert.equal(G.rapikan(null), null);
  assert.deepEqual(G.rapikan({ dinding: 'd99', lantai: 'l1', selimut: 'zz' }), { dinding: 'd0', lantai: 'l1', selimut: 's0' });
  assert.deepEqual(C.wkRapikan({ dinding: 'd99', lantai: 'l1', selimut: 'zz' }), { dinding: 'd0', lantai: 'l1', selimut: 's0' });
  assert.deepEqual(C.wkRapikan(null), C.wkBawaan());
  assert.equal(C.wkAwal(C.wkBawaan()), true); assert.equal(C.wkAwal({ dinding: 'd1', lantai: 'l0', selimut: 's0' }), false);
});

/* ---------- server ---------- */
test('penghuni kamar 3, 41, dan 60: simpan -> terbaca di /api/dompet; tiap penghuni terpisah; saldo tidak berubah', async () => {
  const S = siapkan();
  const tok = { rina: await login(S, 'rina', '246810'), tya: await login(S, 'tya', '112233'), bagas: await login(S, 'bagas', '135790') };
  for (const n of Object.keys(tok)) { const d = await S.app.dompet(get(tok[n])); assert.equal(d.status, 200); assert.equal(d.body.gaya, null, 'belum memilih = null'); assert.equal(d.body.saldo, 0); }
  const r3 = await S.app.belanja(post(gaya('d4', 'l1', 's1'), tok.rina)); assert.equal(r3.status, 200, JSON.stringify(r3.body)); assert.deepEqual(r3.body, { gaya: { dinding: 'd4', lantai: 'l1', selimut: 's1' } });
  const r41 = await S.app.belanja(post(gaya('d1', 'l2', 's4'), tok.tya)); assert.equal(r41.status, 200, JSON.stringify(r41.body));
  const r60 = await S.app.belanja(post(gaya('d27', 'l8', 's17'), tok.bagas)); assert.equal(r60.status, 200, JSON.stringify(r60.body));
  assert.deepEqual((await S.app.dompet(get(tok.rina))).body.gaya, { dinding: 'd4', lantai: 'l1', selimut: 's1' });
  assert.deepEqual((await S.app.dompet(get(tok.tya))).body.gaya, { dinding: 'd1', lantai: 'l2', selimut: 's4' });
  const d60 = (await S.app.dompet(get(tok.bagas))).body; assert.deepEqual(d60.gaya, { dinding: 'd27', lantai: 'l8', selimut: 's17' }); assert.equal(d60.saldo, 0);
  assert.equal(S.db._t.mutasi.length, 0, 'gratis: tidak ada mutasi uang');
  /* balikin ke awal = simpan bawaan */
  assert.equal((await S.app.belanja(post(gaya('d0', 'l0', 's0'), tok.bagas))).status, 200);
  assert.deepEqual((await S.app.dompet(get(tok.bagas))).body.gaya, Object.assign({}, G.BAWAAN));
  assert.deepEqual((await S.app.dompet(get(tok.rina))).body.gaya, { dinding: 'd4', lantai: 'l1', selimut: 's1' }, 'kamar lain tidak ikut berubah');
  assert.deepEqual([...S.db._t.gaya.keys()].sort(), ['3|rina', '41|tya', '60|bagas']);
});
test('badan tidak bisa menunjuk kamar orang lain: kamar + nama selalu dari sesi', async () => {
  const S = siapkan(), tok = await login(S, 'rina', '246810');
  const r = await S.app.belanja(post(Object.assign(gaya('d2', 'l0', 's2'), { room: 60, nama: 'bagas', p_room: 60 }), tok));
  assert.equal(r.status, 200);
  assert.deepEqual([...S.db._t.gaya.keys()], ['3|rina']);
});
test('tamu / tanpa sesi / sesi palsu ditolak 401; lintas situs + bukan JSON ditolak; tidak ada yang tersimpan', async () => {
  const S = siapkan();
  for (const t of [undefined, 'a'.repeat(43), 'bukan-token']) { const r = await S.app.belanja(post(gaya('d1', 'l1', 's1'), t)); assert.equal(r.status, 401, String(t)); assert.equal(r.body.galat, 'perlu_login'); }
  const tok = await login(S, 'rina', '246810');
  const silang = await S.app.belanja(post(gaya('d1', 'l1', 's1'), tok, { origin: 'https://jahat.test', 'sec-fetch-site': 'cross-site' })); assert.equal(silang.status, 403);
  const bukanJson = await S.app.belanja(post(gaya('d1', 'l1', 's1'), tok, { 'content-type': 'text/plain' })); assert.ok(bukanJson.status >= 400 && bukanJson.status < 500);
  await S.app.keluar(post({}, tok));
  assert.equal((await S.app.belanja(post(gaya('d1', 'l1', 's1'), tok))).status, 401, 'sesi yang sudah keluar');
  assert.equal(S.db._t.gaya ? S.db._t.gaya.size : 0, 0);
});
test('pilihan di luar daftar ditolak 400 sebelum menyentuh database / jatah', async () => {
  const S = siapkan(), tok = await login(S, 'tya', '112233');
  const n0 = S.db._panggilan.length;
  for (const b of [gaya('d28', 'l0', 's0'), gaya('d1', 'l9', 's0'), gaya('d1', 'l0', 's19'), gaya('d100', 'l0', 's0'), gaya('#fff', 'l0', 's0'), gaya(undefined, 'l0', 's0'), gaya(3, 'l0', 's0'), { aksi: 'gaya' },
    gaya("d1'; drop table kosan_kamar_gaya;--", 'l0', 's0')]) {
    const r = await S.app.belanja(post(b, tok)); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.body.galat, 'format');
  }
  assert.equal(S.db._panggilan.slice(n0).filter((x) => x === 'gayaSimpan').length, 0);
  assert.equal(S.db._t.gaya ? S.db._t.gaya.size : 0, 0);
});
test('batas laju sendiri per kamar (gaya: 120/jam) — tidak memakan jatah belanja; kamar lain tidak kena', async () => {
  assert.equal(BATAS_PENGHUNI.gaya, 120);
  const S = siapkan(), tok = await login(S, 'bagas', '135790'), tok2 = await login(S, 'tya', '112233');
  for (let i = 0; i < 120; i++) { const r = await S.app.belanja(post(gaya(i % 2 ? 'd1' : 'd2', 'l0', 's0'), tok)); assert.equal(r.status, 200, 'ke-' + i); }
  const r = await S.app.belanja(post(gaya('d3', 'l0', 's0'), tok)); assert.equal(r.status, 429); assert.equal(r.body.galat, 'terkunci');
  assert.deepEqual(S.db._t.gaya.get('60|bagas'), { dinding: 'd1', lantai: 'l0', selimut: 's0' }, 'yang ke-121 tidak tersimpan');
  assert.equal((await S.app.belanja(post(gaya('d3', 'l0', 's0'), tok2))).status, 200, 'kamar lain tetap bisa');
  const beli = await S.app.belanja(post({ aksi: 'beli', barang: 'tidak_ada' }, tok)); assert.equal(beli.status, 400, 'aksi belanja lain tetap dilayani seperti biasa');
  S.jam += 3601 * 1000;
  assert.equal((await S.app.belanja(post(gaya('d3', 'l0', 's0'), tok))).status, 200, 'jam berikutnya boleh lagi');
});
test('tabel belum dimigrasi: /api/dompet TETAP 200 (gaya null), simpan gagal tanpa merusak aksi lain', async () => {
  const S = siapkan(), tok = await login(S, 'rina', '246810');
  S.db._t.gayaRusak = true;
  const d = await S.app.dompet(get(tok)); assert.equal(d.status, 200); assert.equal(d.body.gaya, null); assert.equal(typeof d.body.saldo, 'number'); assert.ok(d.body.pekerjaan && d.body.sewa);
  await assert.rejects(() => S.app.belanja(post(gaya('d1', 'l1', 's1'), tok)), 'galat database dilempar ke pembungkus (503 generik)');
  const beli = await S.app.belanja(post({ aksi: 'beli', barang: 'tidak_ada' }, tok)); assert.equal(beli.status, 400);
  const lama = await S.app.belanja(post({ aksi: 'xyz' }, tok)); assert.equal(lama.status, 400); assert.equal(lama.body.pesan, 'Aksi tidak dikenal.');
});
test('db.js: gayaBaca / gayaSimpan memanggil RPC dengan argumen tervalidasi (room bilangan bulat, kode pendek)', async () => {
  const jejak = [];
  const fetchFn = async (u, o) => { jejak.push({ u: String(u), body: o && o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 200, text: async () => (jejak.length === 1 ? 'null' : '{"dinding":"d1","lantai":"l1","selimut":"s1"}') }; };
  const db = buatDb({ url: 'https://x.supabase.co', kunci: 'eyJ.service', fetchFn });
  assert.equal(await db.gayaBaca({ room: 60, nama: 'bagas' }), null);
  await db.gayaSimpan({ room: 41, nama: 'tya', dinding: 'd1', lantai: 'l1', selimut: 's1' });
  assert.match(jejak[0].u, /\/rest\/v1\/rpc\/kosan_gaya_baca$/); assert.deepEqual(jejak[0].body, { p_room: 60, p_nama: 'bagas' });
  assert.match(jejak[1].u, /\/rest\/v1\/rpc\/kosan_gaya_simpan$/); assert.deepEqual(jejak[1].body, { p_room: 41, p_nama: 'tya', p_dinding: 'd1', p_lantai: 'l1', p_selimut: 's1' });
  await assert.rejects(() => db.gayaSimpan({ room: '41', nama: 'tya', dinding: 'd1', lantai: 'l1', selimut: 's1' }));
  await assert.rejects(() => db.gayaSimpan({ room: 41, nama: 'tya', dinding: "d1'--", lantai: 'l1', selimut: 's1' }));
  assert.equal(jejak.length, 2);
});
test('migrasi warna_kamar: hanya menambah, room 1..60 di SEMUA tempat, RLS tanpa policy, hanya service_role, search_path kosong, idempoten', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261127_warna_kamar.sql'), 'utf8');
  const kode = sql.split('\n').filter((b) => !/^\s*--/.test(b)).join('\n');
  assert.match(kode, /create table if not exists public\.kosan_kamar_gaya/);
  assert.match(kode, /room\s+int\s+not null check \(room between 1 and 60\)/);
  assert.match(kode, /p_room < 1 or p_room > 60/);
  assert.equal((kode.match(/\b40\b|\b20\b/g) || []).length, 0, 'tidak ada batas kamar lama (20 / 40)');
  assert.match(kode, /primary key \(room, nama_norm\)/);
  assert.match(kode, /alter table public\.kosan_kamar_gaya enable row level security/);
  assert.equal(/create policy/i.test(kode), false);
  assert.match(kode, /revoke all on table public\.kosan_kamar_gaya from public, anon, authenticated/);
  assert.match(kode, /grant select, insert, update, delete on table public\.kosan_kamar_gaya to service_role/);
  for (const f of ['kosan_gaya_baca(int, text)', 'kosan_gaya_simpan(int, text, text, text, text)']) {
    assert.ok(kode.includes('revoke all on function public.' + f + ' from public, anon, authenticated'), f);
    assert.ok(kode.includes('grant execute on function public.' + f + ' to service_role'), f);
  }
  assert.equal((kode.match(/create or replace function/g) || []).length, 2);
  assert.equal((kode.match(/security definer set search_path = ''/g) || []).length, 2);
  assert.equal(/drop |alter table public\.kosan_(?!kamar_gaya)|truncate|delete from/i.test(kode), false, 'tabel lain tidak disentuh');
  assert.match(kode, /^begin;/m); assert.match(kode, /^commit;/m);
  /* bentuk kode di CHECK = bentuk id di daftar putih */
  for (const id of [...G.DINDING, ...G.LANTAI, ...G.SELIMUT]) assert.match(id, /^(d|l|s)[0-9]{1,2}$/);
  assert.equal((kode.match(/\[0-9\]\{1,2\}\$'/g) || []).length, 6, 'CHECK tabel + validasi fungsi menerima kode dua digit (d10..d27)');
  assert.equal(/\[0-9\]\$'/.test(kode), false, 'tidak ada pola satu digit yang tertinggal');
});

/* ---------- klien: logika bahan ---------- */
function Warna(r, g, b) { this.r = r || 0; this.g = g || 0; this.b = b || 0; }
Warna.prototype.clone = function () { return new Warna(this.r, this.g, this.b); };
Warna.prototype.copy = function (o) { this.r = o.r; this.g = o.g; this.b = o.b; return this; };
Warna.prototype.multiplyScalar = function (k) { this.r *= k; this.g *= k; this.b *= k; return this; };
Warna.prototype.setRGB = function (r, g, b) { this.r = r; this.g = g; this.b = b; return this; };
Warna.prototype.set = function (hex) { const n = parseInt(String(hex).slice(1), 16), lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return this.setRGB(lin(n >> 16 & 255), lin(n >> 8 & 255), lin(n & 255)); };
function duniaKlien() {
  const el = () => ({ style: { setProperty() {} }, dataset: {}, children: [], classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null, appendChild() {}, textContent: '', innerHTML: '' });
  const els = {};
  const W = {
    THREE: { Color: Warna }, lampuKamarLevel: 1, myRealm: 'yard', visitorRoom: 41, penghuni: true, toast: [], kirim: [], tekstur: 0,
    IN: { dindingK: { color: new Warna(0.8, 0.78, 0.74), emissive: new Warna(0.41, 0.4, 0.375) }, aksenK: { color: new Warna(0.254, 0.275, 0.305), emissive: new Warna(0.17, 0.197, 0.229) },
      plafonK: { color: new Warna(1, 1, 1), emissive: new Warna(0.42, 0.405, 0.38) }, lantaiK: { map: { asli: true }, color: new Warna(1, 1, 1) }, selimut: { color: new Warna(0.58, 0.48, 0.37) }, nyalaK: {} },
    DOMPET: { untuk: 'p:tya', data: null },
    document: { getElementById: (id) => els[id] || (els[id] = el()), querySelectorAll: () => [], createElement: el },
    localStorage: { getItem: () => '1', setItem() {} }
  };
  W.IN.emisiKamar = [W.IN.dindingK, W.IN.aksenK, W.IN.plafonK].map((m) => ({ m, e: m.emissive.clone() }));
  W.interiorKamarNyala = (v) => { W.IN.emisiKamar.forEach((q) => { q.m.emissive.copy(q.e).multiplyScalar(0.22 + 0.78 * v); }); };
  W.ktaIsResident = () => W.penghuni;
  W.teksturLukis = () => { W.tekstur++; return { tek: W.tekstur }; };
  W.lukisPapanLantai = () => () => {}; W.acak = () => Math.random;
  W.toastKosan = (m) => W.toast.push(m); W.bunyi = () => {}; W.closeCard = () => {}; W.menuTutup = () => {}; W.pesanApi = () => 'x';
  W.apiKosan = (m, p, b) => { W.kirim.push({ m, p, b }); return Promise.resolve(W.jawab || { status: 200, data: { gaya: b } }); };
  W.setTimeout = (f) => { W.tunda = f; return 7; }; W.clearTimeout = () => { W.tunda = null; };
  const f = new Function('W', 'with (W) {\n' + DATA + UI + '\nreturn { WK, WK_KAL, warnaKamarPasang, warnaKamarSelaras, warnaKamarDariServer, warnaPilih, warnaBuka, warnaTutup, wkSimpan, warnaDiKamarSendiri };\n}');
  return Object.assign(W, { F: f(W), els });
}
const potret = (W) => JSON.stringify([W.IN.dindingK.color, W.IN.dindingK.emissive, W.IN.aksenK.color, W.IN.aksenK.emissive, W.IN.lantaiK.color, W.IN.lantaiK.map, W.IN.selimut.color, W.IN.emisiKamar.map((q) => q.e)]);
test('klien: bawaan = bahan asli PERSIS (tanpa tekstur baru); pilihan lain mengubah dinding + aksen + lantai + selimut; balik ke bawaan identik', () => {
  const W = duniaKlien(), asal = potret(W);
  assert.equal(W.F.warnaKamarPasang(C.wkBawaan()), true);
  assert.equal(potret(W), asal); assert.equal(W.tekstur, 0); assert.equal(W.F.WK.terpasang, false);
  W.F.warnaKamarPasang({ dinding: 'd7', lantai: 'l8', selimut: 's4' });
  assert.notEqual(potret(W), asal); assert.equal(W.F.WK.terpasang, true); assert.equal(W.tekstur, 1);
  assert.ok(W.IN.dindingK.color.r < 0.1, 'hitam = gelap'); assert.notDeepEqual(W.IN.lantaiK.map, { asli: true });
  assert.ok(W.IN.aksenK.emissive.r < 0.17, 'aksen ikut');
  W.F.warnaKamarPasang({ dinding: 'd7', lantai: 'l8', selimut: 's4' }); assert.equal(W.tekstur, 1, 'tekstur lantai dibuat sekali (cache)');
  W.F.warnaKamarPasang(C.wkBawaan());
  assert.equal(potret(W), asal, 'balik ke awal = identik'); assert.equal(W.F.WK.terpasang, false);
});
test('klien: emissive dinding baru ikut lampu tidur (basis diperbarui, lalu diredupkan pada level lampu saat itu)', () => {
  const W = duniaKlien(); W.lampuKamarLevel = 0;
  W.F.warnaKamarPasang({ dinding: 'd4', lantai: 'l0', selimut: 's0' });
  const q = W.IN.emisiKamar[0];
  assert.ok(Math.abs(W.IN.dindingK.emissive.r - q.e.r * 0.22) < 1e-9, 'lampu mati: 22% dari basis BARU');
  W.interiorKamarNyala(1);
  assert.ok(Math.abs(W.IN.dindingK.emissive.r - q.e.r) < 1e-9);
});
test('klien: warna hanya terpasang di kamar SENDIRI; keluar kamar (mis. ke Toko Dekor yang memakai aksen yang sama) = bahan pulih + tombol hilang + panel tertutup', () => {
  const W = duniaKlien(), asal = potret(W);
  W.DOMPET.data = { saldo: 0, gaya: { dinding: 'd5', lantai: 'l2', selimut: 's4' } };
  W.F.warnaKamarDariServer();
  assert.equal(potret(W), asal, 'di halaman: bahan belum disentuh'); assert.equal(W.els.warnaBtn.style.display, 'none');
  W.myRealm = 'room-41'; W.F.warnaKamarSelaras();
  assert.notEqual(potret(W), asal); assert.equal(W.els.warnaBtn.style.display, '');
  W.F.warnaBuka(); assert.equal(W.F.WK.buka, true);
  W.myRealm = 'toko'; W.F.warnaKamarSelaras();
  assert.equal(potret(W), asal, 'di toko: aksen + dinding + lantai + selimut bawaan'); assert.equal(W.F.WK.buka, false); assert.equal(W.els.warnaBtn.style.display, 'none');
  W.myRealm = 'room-41'; W.F.warnaKamarSelaras(); assert.notEqual(potret(W), asal, 'masuk lagi: warna pilihan kembali');
  /* tamu (bukan penghuni) tidak pernah dapat tombol / warna */
  W.myRealm = 'yard'; W.F.warnaKamarSelaras(); W.penghuni = false; W.myRealm = 'room-41'; W.F.warnaKamarSelaras();
  assert.equal(W.els.warnaBtn.style.display, 'none'); assert.equal(potret(W), asal);
  W.F.warnaBuka(); assert.equal(W.F.WK.buka, false, 'tamu tidak bisa membuka panel');
});
test('klien: sekali ketuk = pratinjau langsung + simpan tertunda ke /api/belanja {aksi:gaya}; data server tidak menimpa pilihan yang belum tersimpan; ganti akun = reset', async () => {
  const W = duniaKlien(); W.DOMPET.data = { saldo: 0, gaya: null }; W.myRealm = 'room-41'; W.F.warnaKamarDariServer();
  const asal = potret(W);
  W.F.warnaPilih('dinding', 'd3'); assert.notEqual(potret(W), asal, 'langsung terlihat'); assert.equal(W.kirim.length, 0, 'belum dikirim (jeda)'); assert.equal(typeof W.tunda, 'function');
  W.F.warnaPilih('selimut', 's2');
  W.DOMPET.data = { saldo: 5, gaya: null }; W.F.warnaKamarDariServer();
  assert.equal(W.F.WK.pilih.dinding, 'd3', 'dompet dimuat ulang tidak menimpa pilihan baru');
  W.tunda(); await new Promise((r) => setImmediate(r));
  assert.deepEqual(W.kirim, [{ m: 'POST', p: '/api/belanja', b: { aksi: 'gaya', dinding: 'd3', lantai: 'l0', selimut: 's2' } }]);
  assert.equal(W.F.WK.kotor, false); assert.deepEqual(W.DOMPET.data.gaya, { dinding: 'd3', lantai: 'l0', selimut: 's2' });
  W.F.warnaPilih('dinding', 'd3'); assert.equal(W.kirim.length, 1, 'pilih yang sama = tidak ada apa-apa');
  /* gagal simpan: tetap kotor, dicoba lagi saat panel ditutup */
  W.jawab = { status: 0, data: null }; W.F.warnaBuka(); W.F.warnaPilih('lantai', 'l1'); W.tunda(); await new Promise((r) => setImmediate(r));
  assert.equal(W.F.WK.kotor, true); assert.equal(W.kirim.length, 2);
  W.jawab = null; W.F.warnaTutup(); await new Promise((r) => setImmediate(r));
  assert.equal(W.kirim.length, 3); assert.equal(W.F.WK.kotor, false);
  /* pilihan di luar daftar dari mana pun -> bawaan */
  W.F.warnaPilih('dinding', 'd99'); assert.equal(W.F.WK.pilih.dinding, 'd0');
  /* ganti akun */
  W.DOMPET.untuk = 'p:lain'; W.DOMPET.data = { saldo: 0, gaya: null }; W.myRealm = 'yard'; W.F.warnaKamarDariServer();
  assert.deepEqual(W.F.WK.pilih, C.wkBawaan()); assert.equal(W.F.WK.kotor, false);
});

test('klien: putih = dinding + selimut paling terang dan netral; kode dua digit terpasang; tiap lantai punya pelukis sendiri', () => {
  const W = duniaKlien(), terang = (c) => c.r + c.g + c.b;
  W.F.warnaKamarPasang({ dinding: 'd1', lantai: 'l4', selimut: 's1' });
  const putihD = terang(W.IN.dindingK.color) + terang(W.IN.emisiKamar[0].e), putihS = terang(W.IN.selimut.color);
  for (const o of C.WARNA_KAMAR.dinding.slice(2)) { W.F.warnaKamarPasang({ dinding: o.id, lantai: 'l0', selimut: 's0' }); assert.ok(terang(W.IN.dindingK.color) + terang(W.IN.emisiKamar[0].e) < putihD, o.nama + ' lebih gelap dari Putih'); }
  for (const o of C.WARNA_KAMAR.selimut.slice(2)) { W.F.warnaKamarPasang({ dinding: 'd0', lantai: 'l0', selimut: o.id }); assert.ok(terang(W.IN.selimut.color) < putihS, o.nama); }
  const asal = potret(duniaKlien());
  W.F.warnaKamarPasang({ dinding: 'd27', lantai: 'l8', selimut: 's17' }); assert.equal(W.F.WK.terpasang, true); assert.notEqual(potret(W), asal);
  const n0 = W.tekstur; for (const o of C.WARNA_KAMAR.lantai.slice(1)) W.F.warnaKamarPasang({ dinding: 'd0', lantai: o.id, selimut: 's0' });
  assert.ok(W.tekstur >= 8 && W.tekstur - n0 <= 8, 'satu tekstur per lantai, dibuat malas + di-cache');
  W.F.warnaKamarPasang(C.wkBawaan()); assert.equal(potret(W), asal, 'balik ke asli = identik');
  for (const k of ['dinding', 'aksen']) { assert.equal(W.F.WK_KAL[k].a.length, 3); assert.equal(W.F.WK_KAL[k].e.length, 3); assert.ok(W.F.WK_KAL[k].e.every((v) => v > 0 && v < 1.2)); assert.ok(W.F.WK_KAL[k].a.every((v) => v > 0 && v <= 1), 'albedo dinding wajar (<= 1): pantulan lampu tidak meledak'); }
});

/* ---------- kabel index.html ---------- */
test('index.html: tombol + panel + kait terpasang; id unik; tanpa fetch( baru; tanpa mesh / lampu baru; LED plaza + arkade tidak disentuh', () => {
  assert.equal((HTML.match(/fetch\(/g) || []).length, 4, 'fetch( tetap 4');
  for (const id of ['warnaBtn', 'warnaPanel', 'warnaClose', 'warnaJudul', 'warnaKamarNo', 'wkIsi', 'warnaPulih', 'warnaStatus', 'warnaSelesai', 'wkTab-dinding', 'wkTab-lantai', 'wkTab-selimut'])
    assert.equal(HTML.split('id="' + id + '"').length - 1, 1, 'id unik: ' + id);
  assert.match(HTML, /<button id="warnaBtn"[^>]*style="display:none"/, 'tombol tersembunyi sampai penghuni ada di kamarnya');
  assert.match(HTML, /function mpSaatPindahAlam\(\) \{[^\n]*\n  warnaKamarSelaras\(\);/);
  assert.match(HTML, /ktaPerbaruiBila\(\);\n    if \(typeof warnaKamarDariServer === 'function'\) warnaKamarDariServer\(\);/);
  assert.match(HTML, /if \(WK\.buka\) \{ dorongStateLagi\(\); warnaTutup\(\); return; \}/);
  const blok = DATA + UI;
  assert.equal(/new THREE\.(Mesh|PointLight|SpotLight|DirectionalLight|HemisphereLight|[A-Za-z]*Geometry)\b/.test(blok), false, 'tanpa mesh / geometri / lampu baru');
  assert.equal(/fetch\(|XMLHttpRequest|innerHTML = [^'"]*\+/.test(blok.replace(/v\.innerHTML = '[^']*';/, '')), false);
  assert.equal(/kotaLed|KOTA_LED|ARK\.|arkade/i.test(blok), false, 'blok warna tidak menyentuh LED / arkade');
  assert.match(blok, /teksturLukis\(512, 512/, 'lantai = tekstur kanvas prosedural');
  assert.match(HTML, /\.wk-isi \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*overflow-y: scroll/, 'daftar digulir di dalam panel; grid minmax(0,1fr)');
  assert.match(HTML, /\.wk-isi \{[^}]*height: 127px/, 'tinggi daftar tetap: panel tidak bertambah tinggi');
  assert.match(HTML, /\.wk-isi \{[^}]*grid-auto-rows: max-content/, 'baris daftar tidak boleh menyusut (27 Nov: tombol gepeng tanpa nama saat tinggi daftar tetap)');
  for (const id of ['wkBungkus', 'wkJumlah']) assert.equal(HTML.split('id="' + id + '"').length - 1, 1, 'id unik: ' + id);
  for (const t of ['bobT', 'dpad', 'firebase', 'joyDbg', 'RESIDENTS', 'RESIDENT_PINS', 'pinCek', 'entryAdapt', 'changeCharBtn']) assert.equal(blok.includes(t), false, t);
  assert.equal(/type="password"/.test(HTML), false);
});
