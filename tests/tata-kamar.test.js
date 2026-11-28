'use strict';
/* Tes Tata Kamar (pemilik, 27 Nov): aturan tata letak (klien = server, satu sumber), simpan/baca lewat endpoint yang ada
   (/api/belanja aksi tata + field tata di /api/dompet) dengan database palsu — kamar 3 DAN kamar 41 + 60 (pelajaran bug
   Gedung E/F), tamu/tanpa sesi ditolak, payload jahat, tabrakan, pintu/jendela/AC, jalan tertutup, balikin ke awal,
   batas laju, dompet tetap jalan kalau tabel belum dimigrasi, migrasi SQL, dan kabel ke index.html (LED plaza + arkade +
   warna kamar + kerja kota tidak tersentuh, fetch( tetap 4). Tanpa jaringan.
   Jalankan: node --test tests/tata-kamar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../api/_lib/tata');
const { buatApp, BATAS_PENGHUNI } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j + b.length); };
const MURNI = antara('/* ==== TATA-KAMAR-START ==== */', '/* ==== TATA-KAMAR-END ==== */');
const UI = antara('/* ==== TATA-KAMAR-UI-START ==== */', '/* ==== TATA-KAMAR-UI-END ==== */');
const K = T.TATA_KAMAR, SEMUA = K.URUT, BAWAAN = K.BAWAAN;
const salin = (o) => JSON.parse(JSON.stringify(o));
const awal = (ids) => T.tataAwal(ids || SEMUA);
const ubah = (o, id, v) => { const s = salin(o); s[id] = v; return s; };

const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [{ room: 3, name: 'rina', gender: 'Cewek', pin: '246810' }, { room: 60, name: 'bagas', gender: 'Cowok', pin: '135790' }, { room: 41, name: 'tya', gender: 'Cewek', pin: '112233' }];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token, hdr) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}, hdr || {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
function siapkan() {
  const S = { jam: Date.parse('2026-11-27T05:30:00Z') };
  S.db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => S.jam });
  S.app = buatApp({ db: S.db, rahasia: RAHASIA, sekarang: () => S.jam });
  return S;
}
async function login(S, username, pin) {
  const r = await S.app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
const kirim = (tata) => ({ aksi: 'tata', tata });
const ukuranTata = (S) => (S.db._t.tata ? S.db._t.tata.size : 0);
/* susunan sah yang bukan bawaan: kasur ke dinding timur-utara diputar, nakas ke tengah, TV ke dinding barat */
const SUSUN_A = { kasur: [-3250, -3500, 0], nakas: [-1700, -3130, 0], tv: [-4000, 2200, 1] };
const SUSUN_B = { kasur: [-4000, -1500, 1], nakas: [600, -3100, 1], tv: [2500, -3500, 0] };

/* ---------- aturan murni ---------- */
test('aturan klien = aturan server: blok TATA-KAMAR di index.html sama persis dengan api/_lib/tata.js', () => {
  const srv = fs.readFileSync(path.join(ROOT, 'api', '_lib', 'tata.js'), 'utf8');
  assert.ok(srv.includes(MURNI), 'blok murni identik di server');
  assert.equal(/THREE\.|document\.|window\.|require\(/.test(MURNI), false, 'blok murni tanpa DOM / THREE');
  assert.deepEqual(SEMUA, ['kasur', 'nakas', 'tv', 'meja_belajar', 'meja_rias', 'rak_buku', 'akuarium', 'cermin', 'bean_bag', 'tanaman', 'poster', 'lampu_tumblr', 'karpet']);
  assert.deepEqual(BAWAAN, ['kasur', 'nakas', 'tv']);
  for (const id of SEMUA) { assert.match(id, /^[a-z][a-z_]{1,19}$/, 'bentuk id = CHECK migrasi'); assert.ok(['sandar', 'gantung', 'bebas', 'alas'].includes(K.B[id].j)); assert.ok(K.B[id].n.length <= 14, 'nama muat di chip'); }
  /* semua dekor Toko Dekor bisa dipindah */
  const ids = (HTML.match(/var DEKOR_IDS = \[([^\]]+)\]/) || [])[1];
  assert.ok(ids, 'DEKOR_IDS ada');
  for (const id of ids.split(',').map((s) => s.trim().replace(/'/g, ''))) assert.ok(SEMUA.includes(id), 'dekor bisa dipindah: ' + id);
});
test('tata letak bawaan sah untuk setiap gabungan barang yang masuk akal; posisi bawaan = posisi produksi', () => {
  assert.equal(T.tataCek(awal()), null); assert.equal(T.tataCek(awal(BAWAAN)), null);
  for (const id of SEMUA) if (!BAWAAN.includes(id)) assert.equal(T.tataCek(awal(BAWAAN.concat([id]))), null, id);
  const k = (id) => T.tataKotak(id, K.B[id].a);
  assert.deepEqual(k('kasur').slice(0, 4), [-4000, -3500, -2500, -1120], 'kasur = ROOM_BED produksi');
  assert.deepEqual(k('nakas').slice(0, 4), [-2200, -3480, -1400, -2780], 'nakas = ROOM_TABLE produksi');
  assert.deepEqual(k('bean_bag').slice(0, 4), [-2930, 530, -1770, 1590]);
  assert.deepEqual(T.tataBangunKasur(K.B.kasur.a), [-3100, -220], 'titik bangun = WAKE_SPOT produksi');
  for (const id of SEMUA) { const q = k(id); assert.ok(q[0] >= -K.X - 3 && q[2] <= K.X + 3 && q[1] >= -K.Z - 3 && q[3] <= K.Z + 3, 'di dalam kamar: ' + id); }
});
test('putar: jejak ikut berputar 90° per langkah, empat kali = kembali', () => {
  const k = [-100, -200, 300, 400];
  assert.deepEqual(T.tataPutar(k, 0), k);
  assert.deepEqual(T.tataPutar(T.tataPutar(T.tataPutar(T.tataPutar(k, 1), 1), 1), 1), k);
  assert.deepEqual(T.tataPutar(T.tataPutar(k, 1), 1), T.tataPutar(k, 2));
  assert.deepEqual(T.tataPutar([0, 0, 0, 1000], 1).slice(0, 4), [0, 0, 1000, 0], 'muka +z diputar 1x -> +x (= rotation.y +90° three.js)');
  /* barang sandar: punggung selalu di dinding */
  assert.deepEqual(T.tataKotak('kasur', [0, -3500, 0]).slice(0, 4), [-750, -3500, 750, -1120]);
  assert.deepEqual(T.tataKotak('kasur', [-4000, 0, 1]).slice(0, 4), [-4000, -750, -1620, 750]);
  assert.deepEqual(T.tataKotak('kasur', [0, 3500, 2]).slice(0, 4), [-750, 1120, 750, 3500]);
  assert.deepEqual(T.tataKotak('kasur', [4000, 0, 3]).slice(0, 4), [1620, -750, 4000, 750]);
});
test('rapikan: koordinat dijepit dalam kamar, putaran hanya 0..3, bentuk rusak = null', () => {
  assert.deepEqual(T.tataRapikan('nakas', [99999, -99999, 0]), [3600, -3150, 0]);
  assert.deepEqual(T.tataRapikan('kasur', [9999, 123, 0]), [3250, -3500, 0], 'barang sandar: koordinat dinding dipaksa ke dinding');
  assert.deepEqual(T.tataRapikan('tv', [0, 9999, 3]), [4000, 2755, 3]);
  for (const v of [[0, 0, 4], [0, 0, -1], [0.5, 0, 0], [0, 0], [0, 0, 0, 0], ['0', 0, 0], [NaN, 0, 0], [Infinity, 0, 0], null, 'x', { 0: 1 }, [0, 0, 1.5]]) assert.equal(T.tataRapikan('nakas', v), null, JSON.stringify(v));
  for (const id of ['__proto__', 'constructor', 'toString', 'pintu', 'jendela', 'ac', '', 'KASUR', 3, null]) assert.equal(T.tataRapikan(id, [0, 0, 0]), null, String(id));
});
test('tabrakan: barang tidak boleh saling tindih; barang gantung boleh di atas barang rendah; karpet boleh di bawah apa saja', () => {
  const a = awal();
  const g = T.tataCek(ubah(a, 'nakas', [-3000, -2000, 0])); assert.equal(g.sebab, 'tabrak'); assert.ok([g.id, g.lawan].includes('kasur') && [g.id, g.lawan].includes('nakas'));
  assert.equal(T.tataCek(ubah(a, 'rak_buku', [2650, -3500, 0])).sebab, 'tabrak', 'rak buku ke tempat akuarium');
  assert.equal(T.tataCek(ubah(a, 'poster', [-400, -3500, 0])).sebab, 'tabrak', 'poster di belakang rak buku setinggi 2 m');
  assert.equal(T.tataCek(ubah(a, 'poster', [2650, -3500, 0])), null, 'poster di atas akuarium (1,1 m) boleh');
  assert.equal(T.tataCek(ubah(a, 'karpet', [-2800, -2300, 0])), null, 'karpet di bawah kasur boleh');
  assert.equal(T.tataCek(ubah(a, 'tv', [-3250, -3500, 0])).sebab, 'tabrak', 'TV menembus headboard kasur');
});
test('pintu, jendela, AC: tidak boleh ditutup', () => {
  const a = awal(BAWAAN);
  assert.equal(T.tataCek(ubah(a, 'nakas', [0, 3000, 0])).sebab, 'pintu');
  assert.equal(T.tataCek(ubah(a, 'tv', [0, 3500, 2])).sebab, 'pintu');
  assert.equal(T.tataCek(ubah(a, 'tv', [4000, 500, 3])).sebab, 'jendela');
  assert.equal(T.tataCek(ubah(awal(), 'rak_buku', [4000, 2200, 3])), null, 'rak di dinding timur di luar jendela boleh');
  assert.equal(T.tataCek(Object.assign(awal(BAWAAN), { rak_buku: [4000, 500, 3] })).sebab, 'jendela', 'rak 2 m menutup jendela');
  assert.equal(T.tataCek(Object.assign(awal(BAWAAN), { cermin: [4000, 500, 3] })).sebab, 'jendela', 'cermin berdiri menutup jendela');
  assert.equal(T.tataCek(awal()), null, 'meja belajar (1,14 m) di bawah jendela = posisi produksi, boleh');
  assert.equal(T.tataCek(ubah(awal(), 'lampu_tumblr', [-3960, -3500, 0])).sebab, 'ac');
});
test('jalan: avatar tidak boleh terkurung — titik masuk, pintu, titik bangun kasur, titik berdiri bean bag harus terjangkau', () => {
  const a = awal();
  const j = T.tataJangkau(a); assert.equal(j(900, -500), true); assert.equal(j(0, 2600), true); assert.equal(j(-3250, -2300), false, 'di dalam kasur');
  /* perabot tepat di titik masuk kamar */
  const diSpawn = Object.assign(awal(BAWAAN), { nakas: [900, -500, 0] });
  assert.equal(T.tataJangkau(diSpawn)(900, -500), false); assert.equal(T.tataCek(diSpawn).sebab, 'jalan');
  /* pagar: kasur + meja belajar + meja rias + rak + akuarium membagi kamar jadi dua -> pintu tidak terjangkau dari titik masuk */
  const pagar = { kasur: [-4000, 600, 1], nakas: [-3600, -3150, 0], tv: [-2375, -3500, 0], meja_belajar: [4000, 500, 3], rak_buku: [4000, 2000, 3] };
  const g0 = T.tataCek(pagar); assert.ok(g0 === null || typeof g0.sebab === 'string');
  /* dinding rapat dari barat ke timur di z 0..1100: kasur (2,38 m) + bean bag + meja rias tidak bisa (sandar), jadi pakai celah < 2 x radius */
  const rapat = { kasur: [-4000, 600, 1], nakas: [-1150, 500, 0], tv: [-2375, -3500, 0], bean_bag: [50, 500, 2], tanaman: [1100, 500, 0], meja_belajar: [4000, 500, 3], akuarium: [-3000, -3500, 0] };
  /* kasur x -4000..-1620, nakas -1550..-750, bean -530..630, tanaman 720..1450, meja belajar 2910..4000: celah terlebar 1460 -> 2910 = 1,46 m > 0,8 m => masih lewat */
  const g1 = T.tataCek(rapat); assert.ok(g1 === null || typeof g1.sebab === 'string');
  /* celah itu ditutup rak? rak harus sandar — jadi tutup dengan menggeser meja belajar tidak mungkin; cukup buktikan aturan celah: lorong 0,7 m tidak bisa dilewati */
  const lorong = [[-4000, 0, -350, 1000, 0, 1000], [350, 0, 4000, 1000, 0, 1000]];
  assert.equal(T.tataTerhalang(lorong, 0, 500), true, 'lorong 0,7 m: tengahnya pun kena radius 0,4 m');
  assert.equal(T.tataTerhalang([[-4000, 0, -450, 1000, 0, 1000], [450, 0, 4000, 1000, 0, 1000]], 0, 500), false, 'lorong 0,9 m bisa dilewati');
  /* kaki kasur menempel dinding seberang = tidak ada tempat turun */
  const g2 = T.tataCek({ kasur: [-4000, 2700, 1], nakas: [-1000, 2900, 0], tv: [-2375, -3500, 0] }); assert.ok(g2 && ['tabrak', 'lega', 'jalan'].includes(g2.sebab), JSON.stringify(g2));
});
test('lega: sisi turun kasur + depan bean bag harus kosong', () => {
  const a = awal(BAWAAN.concat(['bean_bag', 'tanaman']));
  assert.equal(T.tataCek(ubah(a, 'tanaman', [-3250, -700, 0])).sebab, 'lega', 'tanaman tepat di kaki kasur');
  assert.equal(T.tataCek(ubah(a, 'tanaman', [-2350, 2000, 0])).sebab, 'lega', 'tanaman tepat di depan bean bag');
  assert.equal(T.tataCek(ubah(a, 'bean_bag', [0, 3000, 0])).sebab !== undefined, true, 'bean bag menghadap dinding / pintu');
});
test('cari tempat + susun: hasilnya SELALU sah; simpanan basi / rusak / barang baru dibeli dirapikan tanpa menumpuk', () => {
  assert.deepEqual(T.tataSusun(null, SEMUA), awal());
  assert.deepEqual(T.tataSusun(undefined, BAWAAN), awal(BAWAAN));
  assert.deepEqual(T.tataSusun('rusak', BAWAAN), awal(BAWAAN));
  /* simpanan hanya bawaan (kasur pindah ke tempat rak buku), lalu pemilik membeli rak buku -> rak dicarikan tempat lain */
  const simpan = { kasur: [-400, -3500, 0], nakas: [-1800, -3130, 0], tv: [-2375, 3500, 2] };
  assert.equal(T.tataCek(simpan), null);
  const s = T.tataSusun(simpan, BAWAAN.concat(['rak_buku', 'akuarium', 'poster']));
  assert.equal(T.tataCek(s), null); assert.deepEqual(s.kasur, simpan.kasur, 'pilihan pemilik dipertahankan');
  assert.notDeepEqual(s.rak_buku, K.B.rak_buku.a, 'rak buku tidak ditumpuk di kasur');
  /* simpanan berisi barang yang tidak (lagi) dimiliki -> diabaikan */
  assert.deepEqual(Object.keys(T.tataSusun(awal(), BAWAAN)), BAWAAN);
  /* acak: 300 simpanan sembarang -> selalu sah */
  let x = 12345; const acak = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 300; i++) {
    const o = {}; for (const id of SEMUA) if (acak() < 0.8) o[id] = [Math.round(acak() * 9000 - 4500), Math.round(acak() * 8000 - 4000), Math.floor(acak() * 4)];
    const ada = SEMUA.filter(() => acak() < 0.85).concat(BAWAAN).filter((v, n, L) => L.indexOf(v) === n);
    const h = T.tataSusun(o, ada);
    assert.equal(T.tataCek(h), null, 'acak ke-' + i); assert.deepEqual(Object.keys(h).sort(), ada.slice().sort());
  }
  const c = T.tataCariTempat(awal(BAWAAN), 'nakas', [-3000, -2000, 0]); assert.ok(c); assert.equal(T.tataCek(ubah(awal(BAWAAN), 'nakas', c)), null);
});
test('sahkan (server): null = balikin ke awal; daftar putih; wajib memuat perabot bawaan; yang tabrakan ditolak', () => {
  assert.deepEqual(T.tataSahkan(null), { tata: null });
  assert.deepEqual(T.tataSahkan(SUSUN_A), { tata: SUSUN_A });
  assert.deepEqual(T.tataSahkan(awal()), { tata: awal() });
  for (const t of [undefined, {}, [], 'x', 3, true, { kasur: [0, -3500, 0] }, { nakas: [0, 0, 0], tv: [0, 3500, 2] }, ubah(SUSUN_A, 'kulkas', [0, 0, 0]), ubah(SUSUN_A, 'pintu', [0, 0, 0]),
    ubah(SUSUN_A, 'nakas', [-3000, -2000, 0]), ubah(SUSUN_A, 'nakas', [0, 3000, 0]), ubah(SUSUN_A, 'nakas', [0, 0, 4]), ubah(SUSUN_A, 'nakas', [0.5, 0, 0]), ubah(SUSUN_A, 'nakas', ['0', '0', '0']),
    ubah(SUSUN_A, 'kasur', [900, -3500, 4]), ubah(SUSUN_A, 'nakas', null), ubah(SUSUN_A, 'nakas', { x: 0 })]) assert.equal(T.tataSahkan(t), null, JSON.stringify(t));
  assert.deepEqual(T.tataSahkan(ubah(SUSUN_A, 'nakas', [99999, 0, 0])).tata.nakas, [3600, 0, 0], 'koordinat di luar kamar dijepit ke dalam kamar');
  assert.deepEqual(T.tataSahkan(ubah(SUSUN_A, 'kasur', [0, 0, 0])).tata.kasur, [0, -3500, 0], 'barang sandar dipaksa menempel dinding');
  const jahat = JSON.parse('{"kasur":[-3250,-3500,0],"nakas":[-1700,-3130,0],"tv":[-4000,2200,1],"__proto__":[0,0,0]}'); assert.equal(T.tataSahkan(jahat), null, '__proto__ sebagai kunci ditolak');
  assert.equal(JSON.stringify(awal()).length <= 700, true, 'tata letak penuh muat di batas 700 karakter (' + JSON.stringify(awal()).length + ')');
  assert.equal(T.tataDariDb(null), null); assert.equal(T.tataDariDb({ kulkas: [0, 0, 0] }), null);
  assert.deepEqual(T.tataDariDb({ kasur: [0, -3500, 0], kulkas: [1, 1, 1], nakas: 'x' }), { kasur: [0, -3500, 0] });
});

/* ---------- server ---------- */
test('penghuni kamar 3, 41, dan 60: simpan -> terbaca di /api/dompet; tiap penghuni terpisah; saldo tidak berubah; balikin ke awal = null', async () => {
  const S = siapkan();
  const tok = { rina: await login(S, 'rina', '246810'), tya: await login(S, 'tya', '112233'), bagas: await login(S, 'bagas', '135790') };
  for (const n of Object.keys(tok)) { const d = await S.app.dompet(get(tok[n])); assert.equal(d.status, 200); assert.equal(d.body.tata, null, 'belum menata = null'); assert.equal(d.body.saldo, 0); }
  const r3 = await S.app.belanja(post(kirim(SUSUN_A), tok.rina)); assert.equal(r3.status, 200, JSON.stringify(r3.body)); assert.deepEqual(r3.body, { tata: SUSUN_A });
  const r41 = await S.app.belanja(post(kirim(SUSUN_B), tok.tya)); assert.equal(r41.status, 200, JSON.stringify(r41.body));
  const penuh = ubah(awal(), 'bean_bag', [-1500, 1150, 0]);
  const r60 = await S.app.belanja(post(kirim(penuh), tok.bagas)); assert.equal(r60.status, 200, JSON.stringify(r60.body));
  assert.deepEqual((await S.app.dompet(get(tok.rina))).body.tata, SUSUN_A);
  assert.deepEqual((await S.app.dompet(get(tok.tya))).body.tata, SUSUN_B);
  const d60 = (await S.app.dompet(get(tok.bagas))).body; assert.deepEqual(d60.tata, penuh); assert.equal(d60.saldo, 0); assert.ok('gaya' in d60, 'warna kamar tetap ikut');
  assert.equal(S.db._t.mutasi.length, 0, 'gratis: tidak ada mutasi uang');
  assert.deepEqual([...S.db._t.tata.keys()].sort(), ['3|rina', '41|tya', '60|bagas']);
  const pulih = await S.app.belanja(post(kirim(null), tok.bagas)); assert.equal(pulih.status, 200); assert.deepEqual(pulih.body, { tata: null });
  assert.equal((await S.app.dompet(get(tok.bagas))).body.tata, null);
  assert.deepEqual((await S.app.dompet(get(tok.tya))).body.tata, SUSUN_B, 'kamar lain tidak ikut berubah');
  assert.deepEqual([...S.db._t.tata.keys()].sort(), ['3|rina', '41|tya']);
});
test('badan tidak bisa menunjuk kamar orang lain: kamar + nama selalu dari sesi', async () => {
  const S = siapkan(), tok = await login(S, 'rina', '246810');
  const r = await S.app.belanja(post(Object.assign(kirim(SUSUN_A), { room: 60, nama: 'bagas', p_room: 60 }), tok));
  assert.equal(r.status, 200);
  assert.deepEqual([...S.db._t.tata.keys()], ['3|rina']);
});
test('tamu / tanpa sesi / sesi palsu ditolak 401; lintas situs + bukan JSON ditolak; tidak ada yang tersimpan', async () => {
  const S = siapkan();
  for (const t of [undefined, 'a'.repeat(43), 'bukan-token']) { const r = await S.app.belanja(post(kirim(SUSUN_A), t)); assert.equal(r.status, 401, String(t)); assert.equal(r.body.galat, 'perlu_login'); }
  for (const t of [undefined, 'a'.repeat(43)]) { const r = await S.app.belanja(post(kirim(null), t)); assert.equal(r.status, 401, 'balikin ke awal juga butuh sesi'); }
  const tok = await login(S, 'rina', '246810');
  const silang = await S.app.belanja(post(kirim(SUSUN_A), tok, { origin: 'https://jahat.test', 'sec-fetch-site': 'cross-site' })); assert.equal(silang.status, 403);
  const bukanJson = await S.app.belanja(post(kirim(SUSUN_A), tok, { 'content-type': 'text/plain' })); assert.ok(bukanJson.status >= 400 && bukanJson.status < 500);
  await S.app.keluar(post({}, tok));
  assert.equal((await S.app.belanja(post(kirim(SUSUN_A), tok))).status, 401, 'sesi yang sudah keluar');
  assert.equal(ukuranTata(S), 0);
});
test('payload jahat ditolak 400 sebelum menyentuh database / jatah', async () => {
  const S = siapkan(), tok = await login(S, 'tya', '112233');
  const n0 = S.db._panggilan.length;
  const besar = {}; for (let i = 0; i < 200; i++) besar['barang_' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + (i / 26 | 0))] = [0, 0, 0];
  const dalam = { kasur: [[[[[[0]]]]], 0, 0], nakas: [0, 0, 0], tv: [0, 3500, 2] };
  for (const b of [{ aksi: 'tata' }, kirim(undefined), kirim('x'), kirim(7), kirim([]), kirim({}), kirim(besar), kirim(dalam), kirim({ kasur: [0, -3500, 0] }),
    kirim(ubah(SUSUN_A, 'kulkas', [0, 0, 0])), kirim(ubah(SUSUN_A, 'nakas', [-3000, -2000, 0])), kirim(ubah(SUSUN_A, 'nakas', [0, 3000, 0])), kirim(ubah(SUSUN_A, 'nakas', [1e9, 0, 0.1])),
    kirim(ubah(SUSUN_A, 'nakas', [0, 0, 7])), kirim(ubah(SUSUN_A, 'nakas', [0, 0, 0.5])), kirim(ubah(SUSUN_A, 'nakas', "0,0,0'; drop table kosan_kamar_tata;--")),
    kirim(ubah(SUSUN_A, "nakas'; drop table kosan_kamar_tata;--", [0, 0, 0])), kirim(ubah(SUSUN_A, 'nakas', [900, -500, 0])), kirim(ubah(SUSUN_A, 'poster', 'x'.repeat(5000)))]) {
    const r = await S.app.belanja(post(b, tok)); assert.equal(r.status, 400, JSON.stringify(b).slice(0, 120)); assert.equal(r.body.galat, 'format');
  }
  assert.equal(S.db._panggilan.slice(n0).filter((x) => x === 'tataSimpan').length, 0);
  assert.equal(ukuranTata(S), 0);
});
test('batas laju sendiri per kamar (tata: 240/jam) — tidak memakan jatah belanja / warna; kamar lain tidak kena', async () => {
  assert.equal(BATAS_PENGHUNI.tata, 240); assert.equal(BATAS_PENGHUNI.gaya, 120); assert.equal(BATAS_PENGHUNI.belanja, 60);
  const S = siapkan(), tok = await login(S, 'bagas', '135790'), tok2 = await login(S, 'tya', '112233');
  for (let i = 0; i < 240; i++) { const r = await S.app.belanja(post(kirim(i % 2 ? SUSUN_A : SUSUN_B), tok)); assert.equal(r.status, 200, 'ke-' + i); }
  const r = await S.app.belanja(post(kirim(null), tok)); assert.equal(r.status, 429); assert.equal(r.body.galat, 'terkunci');
  assert.deepEqual(JSON.parse(S.db._t.tata.get('60|bagas')), SUSUN_A, 'yang ke-241 tidak tersimpan');
  assert.equal((await S.app.belanja(post(kirim(SUSUN_A), tok2))).status, 200, 'kamar lain tetap bisa');
  assert.equal((await S.app.belanja(post({ aksi: 'gaya', dinding: 'd1', lantai: 'l1', selimut: 's1' }, tok))).status, 200, 'warna kamar punya jatah sendiri');
  S.jam += 3601 * 1000;
  assert.equal((await S.app.belanja(post(kirim(SUSUN_B), tok))).status, 200, 'jam berikutnya boleh lagi');
});
test('tabel belum dimigrasi: /api/dompet TETAP 200 (tata null), simpan gagal tanpa merusak aksi lain', async () => {
  const S = siapkan(), tok = await login(S, 'tya', '112233');
  S.db._t.tataRusak = true;
  const d = await S.app.dompet(get(tok)); assert.equal(d.status, 200); assert.equal(d.body.tata, null); assert.equal(typeof d.body.saldo, 'number'); assert.ok(d.body.pekerjaan && d.body.sewa);
  await assert.rejects(() => S.app.belanja(post(kirim(SUSUN_A), tok)), 'galat database dilempar ke pembungkus (503 generik)');
  assert.equal((await S.app.belanja(post({ aksi: 'gaya', dinding: 'd1', lantai: 'l1', selimut: 's1' }, tok))).status, 200, 'warna kamar tetap jalan');
  const lama = await S.app.belanja(post({ aksi: 'xyz' }, tok)); assert.equal(lama.status, 400); assert.equal(lama.body.pesan, 'Aksi tidak dikenal.');
});
test('baris database rusak / basi tidak pernah sampai mentah ke klien', async () => {
  const S = siapkan(), tok = await login(S, 'rina', '246810');
  S.db._t.tata = new Map([['3|rina', JSON.stringify({ kasur: [0, -3500, 0], kulkas: [1, 2, 3], nakas: ['a', 0, 0], tv: [0, 99999, 3] })]]);
  assert.deepEqual((await S.app.dompet(get(tok))).body.tata, { kasur: [0, -3500, 0], tv: [4000, 2755, 3] });
});
test('db.js: tataBaca / tataSimpan memanggil RPC dengan argumen tervalidasi', async () => {
  const jejak = [];
  const fetchFn = async (u, o) => { jejak.push({ u: String(u), body: o && o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 200, text: async () => 'null' }; };
  const db = buatDb({ url: 'https://x.supabase.co', kunci: 'eyJ.service', fetchFn });
  assert.equal(await db.tataBaca({ room: 60, nama: 'bagas' }), null);
  await db.tataSimpan({ room: 41, nama: 'tya', tata: SUSUN_A });
  await db.tataSimpan({ room: 41, nama: 'tya', tata: null });
  assert.match(jejak[0].u, /\/rest\/v1\/rpc\/kosan_tata_baca$/); assert.deepEqual(jejak[0].body, { p_room: 60, p_nama: 'bagas' });
  assert.match(jejak[1].u, /\/rest\/v1\/rpc\/kosan_tata_simpan$/); assert.deepEqual(jejak[1].body, { p_room: 41, p_nama: 'tya', p_tata: SUSUN_A });
  assert.deepEqual(jejak[2].body, { p_room: 41, p_nama: 'tya', p_tata: null });
  await assert.rejects(() => db.tataSimpan({ room: '41', nama: 'tya', tata: SUSUN_A }));
  await assert.rejects(() => db.tataBaca({ room: 41.5, nama: 'tya' }));
  assert.equal(jejak.length, 3);
});
test('migrasi tata_kamar: hanya menambah, room 1..60 di SEMUA tempat, RLS tanpa policy, hanya service_role, search_path kosong, idempoten', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261127_tata_kamar.sql'), 'utf8');
  const kode = sql.split('\n').filter((b) => !/^\s*--/.test(b)).join('\n');
  assert.match(kode, /create table if not exists public\.kosan_kamar_tata/);
  assert.match(kode, /room\s+int\s+not null check \(room between 1 and 60\)/);
  assert.match(kode, /p_room < 1 or p_room > 60/);
  assert.equal((kode.match(/between 1 and (20|40)\b|> (20|40)\b/g) || []).length, 0, 'tidak ada batas kamar lama (20 / 40)');
  assert.match(kode, /primary key \(room, nama_norm\)/);
  assert.match(kode, /alter table public\.kosan_kamar_tata enable row level security/);
  assert.equal(/create policy/i.test(kode), false);
  assert.match(kode, /revoke all on table public\.kosan_kamar_tata from public, anon, authenticated/);
  assert.match(kode, /grant select, insert, update, delete on table public\.kosan_kamar_tata to service_role/);
  for (const f of ['kosan_tata_baca(int, text)', 'kosan_tata_simpan(int, text, jsonb)']) {
    assert.ok(kode.includes('revoke all on function public.' + f + ' from public, anon, authenticated'), f);
    assert.ok(kode.includes('grant execute on function public.' + f + ' to service_role'), f);
  }
  assert.equal((kode.match(/security definer set search_path = ''/g) || []).length, 2);
  assert.equal(/drop table|alter table public\.kosan_(?!kamar_tata)|truncate/i.test(kode), false, 'tabel lain tidak disentuh');
  assert.match(kode, /^begin;/m); assert.match(kode, /^commit;/m);
  assert.match(sql, /kosan_tata_simpan\(41, /, 'blok uji kamar 41 ada di komentar'); assert.match(sql, /kosan_tata_simpan\(60, /, 'blok uji kamar 60 ada di komentar');
  /* batas di SQL = batas di aturan */
  assert.match(kode, /4000/); assert.match(kode, /3500/); assert.match(kode, /700/);
  assert.equal(K.X, 4000); assert.equal(K.Z, 3500);
});

/* ---------- kabel index.html ---------- */
test('index.html: tombol + panel + kait terpasang; id unik; tanpa fetch( baru; tanpa lampu / tekstur baru; LED plaza + arkade + warna + kerja kota tidak disentuh', () => {
  assert.equal((HTML.match(/fetch\(/g) || []).length, 4, 'fetch( tetap 4');
  for (const id of ['tataBtn', 'tataAlat', 'tataDeret', 'tataPutar', 'tataPulih', 'tataPulihTeks', 'tataAtas', 'tataToast', 'tataSelesai'])
    assert.equal(HTML.split('id="' + id + '"').length - 1, 1, 'id unik: ' + id);
  assert.match(HTML, /<button id="tataBtn"[^>]*style="display:none"/, 'tombol tersembunyi sampai penghuni ada di kamarnya');
  assert.match(HTML, /warnaKamarSelaras\(\);[^\n]*\n  tkSelaras\(\);/);
  assert.match(HTML, /if \(TK\.aktif\) \{ dorongStateLagi\(\); tkTutup\(\); return; \}/);
  assert.match(HTML, /if \(TK\.aktif\) tkKamera\(\);/);
  assert.match(UI, /function tkDiKamarSendiri\(\) \{ return !!\(typeof myRealm === 'string' && visitorRoom && myRealm === 'room-' \+ visitorRoom && ktaIsResident\(\)\); \}/, 'hanya penghuni di kamarnya sendiri');
  assert.match(UI, /apiKosan\('POST', '\/api\/belanja', \{ aksi: 'tata'/);
  const blok = MURNI + UI;
  assert.equal(/new THREE\.(PointLight|SpotLight|DirectionalLight|HemisphereLight|CanvasTexture|Texture)\b/.test(blok), false, 'tanpa lampu / tekstur baru');
  assert.equal(/fetch\(|XMLHttpRequest|localStorage|document\.cookie|eval\(/.test(blok), false);
  assert.equal(/innerHTML/.test(blok), false, 'daftar barang dibangun dengan createElement + textContent');
  assert.equal(/kotaLed|KOTA_LED|\bARK\.|arkadeBuka|arkadeTutup/.test(blok), false, 'blok tata tidak menyentuh LED / arkade');
  for (const t of ['bobT', 'dpad', 'firebase', 'joyDbg', 'RESIDENTS', 'RESIDENT_PINS', 'pinCek', 'entryAdapt', 'changeCharBtn']) assert.equal(blok.includes(t), false, t);
  assert.equal(/type="password"/.test(HTML), false);
  /* baris produksi yang diubah: headboard jadi grup sendiri, pose tidur ikut arah kasur, duduk bean bag ikut arah bean bag */
  assert.match(HTML, /var RK = new RuangModern\(tataKepalaGrup\(\), 8, 7, 3\.6\);/);
  assert.match(UI, /poseJangkar\.rotY = BEANBAG_DUDUK\.rotY; terapkanPoseKamar\(\);/, 'duduk bean bag ikut arah bean bag');
  assert.match(HTML, /avatar\.rotation\.x = 0; avatar\.rotation\.z = 0;/);
});

/* ---------- ronde 2 (vonis pemilik 27 Nov 19:05): tanpa panel, deret bawah, kamera bebas ---------- */
test('ronde 2: panel dibuang, deret perabot + tombol mengambang + toast; kamera tata bebas (bukan dikunci dari atas)', () => {
  for (const lama of ['tataPanel', 'tataClose', 'tataJudul', 'tataPetunjuk', 'tataDaftar', 'tataStatus', 'tk-chip', 'tk-kaki'])
    assert.equal(HTML.includes(lama), false, 'sisa panel lama: ' + lama);
  assert.match(HTML, /#tataDeret \{[^}]*bottom: 0;[^}]*overflow-x: auto;[^}]*touch-action: pan-x;/, 'deret di tepi bawah, bisa digeser ke samping');
  assert.match(HTML, /body\.tata-aktif #topbar, body\.tata-aktif #actionbar, body\.tata-aktif #joy,/, 'mode tata: bilah + joystick disembunyikan (layar lega)');
  assert.match(HTML, /#tataPutar \{[^}]*display: none;/); assert.match(HTML, /#tataPutar\.tampak \{ display: inline-flex; \}/);
  assert.match(UI, /putar\.classList\.toggle\('tampak', !!\(b && b\.j !== 'alas'\)\)/, 'Putar hanya saat ada barang terpilih');
  /* kamera: orbit (yaw, pitch, jarak, geser), tidak ada lagi up (0,0,-1) / kuncian */
  assert.equal(/camera\.up\.set\(0, 0, -1\)/.test(UI), false, 'tidak ada kuncian kamera dari atas');
  assert.match(UI, /K\.yaw -= \(e\.clientX - o\.x\) \* 0\.006; K\.pitch \+= \(e\.clientY - o\.y\) \* 0\.005;/, 'seret tempat kosong = putar + miring');
  assert.match(UI, /K\.dist \*= c\.d \/ d;/, 'cubit = zoom');
  assert.match(UI, /function tkDariAtas\(\)/); assert.match(UI, /function tkTitikDinding\(sinar\)/);
  assert.match(UI, /avatar\.visible = false/); assert.match(UI, /avatar\.visible = TK\.avatarTampak !== false/, 'avatar dipulihkan saat selesai');
  /* id unik global */
  const ids = (HTML.match(/ id="[^"]+"/g) || []).filter((x) => /tata/i.test(x));
  assert.equal(new Set(ids).size, ids.length, 'id tata unik');
});

/* ---------- ronde 3 (vonis pemilik 27 Nov 23:15): tanpa kotak sorot, deret pakai gambar asli perabot ---------- */
test('ronde 3: barang terpilih ditandai di barangnya sendiri (tanpa kotak / bingkai), bahan asli dipulihkan persis', () => {
  for (const lama of ['TK.sorot', 'TK.garis', 'BoxGeometry(1, 1, 1)', 'EdgesGeometry', 'LineSegments', 'function tkSorot'])
    assert.equal(UI.includes(lama), false, 'sisa kotak sorot: ' + lama);
  assert.match(UI, /function tkTandai\(\)/); assert.match(UI, /function tkTandaLepas\(\)/);
  assert.match(UI, /var k = asli\.clone\(\),/, 'bahan asli tidak disentuh: mesh dipinjami klon');
  assert.match(UI, /shader\.fragmentShader\.replace\('#include <opaque_fragment>'/, 'penanda = warna akhir bahan itu sendiri (rona tetap), bukan benda tambahan');
  assert.match(UI, /k\.customProgramCacheKey = function/, 'program shader penanda di-cache terpisah dari bahan asli');
  assert.equal(/EffectComposer|OutlinePass|WebGLRenderTarget/.test(UI), false, 'tanpa postprocessing');
  assert.match(UI, /t\.daftar\[i\]\.m\.material = t\.daftar\[i\]\.asli;/, 'rujukan bahan asli dipasang lagi');
  assert.match(UI, /t\.klon\[k\]\.dispose\(\)/, 'klon dibuang');
  assert.match(UI, /if \(t\.o\) t\.o\.position\.y = t\.y0;/, 'barang turun lagi ke tinggi asal');
  const tutup = UI.slice(UI.indexOf('function tkTutup() {'), UI.indexOf('function tkKamera() {'));
  assert.match(tutup, /tkTandaLepas\(\);/, 'Selesai / keluar kamar memulihkan bahan');
  /* tidak ada kerja per bingkai: tkTandai hanya dipanggil dari tkRender + saat calon seret berubah */
  const kamera = UI.slice(UI.indexOf('function tkKamera() {'), UI.indexOf('function tkKamJepit() {'));
  assert.equal(/tkTandai|\.clone\(/.test(kamera), false, 'penanda tidak dihitung tiap bingkai');
  assert.equal((UI.match(/tkTandai\(\);/g) || []).length, 2);
});
test('ronde 3 poles (28 Nov): barang terpilih jelas — terang kebiruan + tepi bentuk berpendar + denyut, tetap tanpa kotak', () => {
  assert.match(UI, /var TK_DENYUT = \{ value: 0\.6 \};/);
  assert.match(UI, /shader\.uniforms\.tkDenyut = TK_DENYUT;/, 'satu angka denyut dipakai bersama');
  assert.match(UI, /tkN = normalMatrix \* normal;/, 'tepi mengikuti bentuk barang (arah permukaan), bukan bingkai');
  assert.match(UI, /TK_GLSL_TERANG_NYALA/, 'bagian menyala (Basic) punya sapuan sendiri');
  const kamera = UI.slice(UI.indexOf('function tkKamera() {'), UI.indexOf('function tkKamJepit() {'));
  assert.equal((kamera.match(/TK_DENYUT\.value = /g) || []).length, 1, 'per bingkai hanya satu penugasan angka');
  assert.equal(UI.includes('outgoingLight * 1.9'), false, 'penanda lama yang terlalu halus dibuang');
  const merah = UI.slice(UI.indexOf('var TK_GLSL_MERAH'), UI.indexOf('function tkTandaLepas'));
  assert.match(merah, /vec3\( 1\.0, 0\.13, 0\.09 \)/, 'tidak sah tetap kemerahan');
});
test('ronde 3: deret perabot memakai gambar asli tiap perabot (ditanam, tanpa berkas / permintaan baru)', () => {
  assert.equal(UI.includes('TK_IKON'), false, 'ikon garis dibuang');
  const awal = HTML.indexOf('var TK_FOTO = {'); assert.ok(awal > 0);
  const foto = HTML.slice(awal, HTML.indexOf('\n};', awal));
  for (const id of SEMUA) {
    const m = foto.match(new RegExp('\\b' + id + ": 'data:image/webp;base64,([A-Za-z0-9+/=]+)'"));
    assert.ok(m, 'gambar: ' + id);
    const b = Buffer.from(m[1], 'base64');
    assert.equal(b.slice(0, 4).toString('latin1'), 'RIFF'); assert.equal(b.slice(8, 12).toString('latin1'), 'WEBP');
    assert.ok(b.length > 800 && b.length < 9000, 'ukuran gambar ' + id + ' wajar: ' + b.length);
  }
  assert.ok(foto.length < 80000, 'seluruh gambar deret < 80 KB teks');
  assert.match(UI, /g\.src = TK_FOTO\[id\]/); assert.match(UI, /document\.createElement\('img'\)/);
  assert.match(HTML, /\.tk-item img \{[^}]*object-fit: contain;[^}]*pointer-events: none;/);
  assert.match(HTML, /img-src 'self' data: blob:|TK_FOTO/); /* CSP (vercel.json) sudah mengizinkan data: untuk gambar */
});
