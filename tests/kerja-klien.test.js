'use strict';
/* Tes klien Kerja & Belanja (16 Nov). Fungsi murni diambil VERBATIM dari index.html
   (blok KERJA, PURE, MP-PURE, GAZEBO, JALAN, IBU) + kabel ke runtime dicek lewat teks.
   Salinan aturan di klien harus SAMA dengan server (api/_lib/kerja.js): server yang
   menghitung uang, klien hanya menampilkan perkiraan. Jalankan:
   node --test tests/kerja-klien.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../api/_lib/kerja');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + antara('/* ==== GAZEBO-START ==== */', '/* ==== GAZEBO-END ==== */')
  + antara('/* ==== KERJA-START ==== */', '/* ==== KERJA-END ==== */')
  + antara('/* ==== JALAN-START ==== */', '/* ==== JALAN-END ==== */')
  + antara('/* ==== IBU-START ==== */', '/* ==== IBU-END ==== */')
  + antara('/* ==== MISI-START ==== */', '/* ==== MISI-END ==== */')
  + '\nreturn { KERJA_PEKERJAAN, KERJA_IDS, KERJA_PANGKAT_SHIFT, KERJA_BATAS, KERJA_RONDA_JAM, SEWA_HARGA, KATALOG, AKS_SLOT, DEKOR_IDS, KAFE_MENU_IDS,'
  + ' kerjaPunya, rupiah, kerjaPangkat, kerjaSisaPangkat, kerjaUpah, kerjaRondaBuka, kerjaHasil, KERJA_TIBA_MS, KERJA_SABAR_MS, kerjaWaktuTiba, kerjaSkorCepat, kerjaAcakUrut,'
  + ' KAFE_BAHAN, KAFE_BAHAN_URUT, KAFE_RESEP, kafeLangkah, WARUNG_KERJA_BARANG, WARUNG_KERJA_UANG, WARUNG_KERJA_PECAHAN, warungKerjaBarang, warungPesananAcak, warungAmbil, warungUang,'
  + ' RONDA_TITIK, RONDA_KETUK, RONDA_PERIODE, RONDA_JARAK, rondaKursor, rondaNilai, LAUNDRY_HARGA_KG, LAUNDRY_MESIN_DETIK, LAUNDRY_ARAH, LAUNDRY_BAJU, laundryKantongAcak, laundryKgTeks, laundryLipat,'
  + ' KAFE_KOTAK, KAFE_LOWONGAN_KOTAK, KAFE_BARISTA, KAFE_PELANGGAN, WARUNG_PENJAGA, WARUNG_PELANGGAN, KERJA_TROTOAR_Z, KAFE_PLOT,'
  + ' DAPUR, DAPUR_LAUNDRY, DAPUR_COUNTER, DAPUR_KILOAN, DAPUR_KILOAN_HARGA_KG, jarakKeKotak, resolveAABB,'
  + ' MP_KERJA_IDS, MP_AKS_KUNCI, mpKerjaDikenal, mpBacaAksesori, mpPasangAksesori, mpAksesoriSama, mpValidasiPos, mpValidasiPresence, MP_BATAS_JALAN,'
  + ' JALAN, JALAN_SOLIDS, JALAN_TIANG_X, WARUNG_KOTAK, POS_RONDA_KOTAK, JALAN_JARAK, MISI_LIST,'
  + ' IBU_OBROLAN, IBU_OBROLAN_MALAM, IBU_OBROLAN_HUJAN, IBU_SEWA, ibuDaftarObrolan };')();
const acakBenih = (seed) => { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; };
const polos = (o) => JSON.parse(JSON.stringify(o));
/* blok runtime klien (dompet, toko, kerja, NPC, ronda, laundry) + pembangun Kedai Kopi */
const RUNTIME = antara('/* ================= Kerja & Belanja (runtime)', '/* ---------- kartu ---------- */');
const KAFE_BANGUN = antara('/* ================= Kedai Kopi (Kerja & Belanja', '/* ================= Kerja & Belanja (runtime)');

test('salinan aturan klien = server: pekerjaan, pangkat, batas, jam ronda, uang kos, katalog, harga laundry papan', () => {
  assert.deepEqual(polos(F.KERJA_PEKERJAAN), polos(S.PEKERJAAN));
  assert.deepEqual(F.KERJA_IDS, Object.keys(S.PEKERJAAN));
  assert.deepEqual(polos(F.KERJA_PANGKAT_SHIFT), S.PANGKAT_SHIFT);
  assert.deepEqual(polos(F.KERJA_BATAS), S.BATAS_KERJA);
  assert.deepEqual(polos(F.KERJA_RONDA_JAM), S.RONDA_JAM);
  assert.equal(F.SEWA_HARGA, S.SEWA_HARGA);
  assert.deepEqual(polos(F.KATALOG), polos(S.KATALOG));
  assert.equal(F.DAPUR_KILOAN_HARGA_KG, F.LAUNDRY_HARGA_KG, 'papan harga meja kiloan = harga hitungan');
  /* id multiplayer + slot aksesori sama dengan katalog */
  assert.deepEqual(F.MP_KERJA_IDS, F.KERJA_IDS);
  assert.deepEqual(F.MP_AKS_KUNCI.map((k) => [k[0], k[1]]), Object.keys(F.AKS_SLOT).map((s) => [s, F.AKS_SLOT[s].length]));
  for (const [id, b] of Object.entries(S.KATALOG)) {
    if (b.jenis === 'aksesori') assert.ok(F.AKS_SLOT[b.slot].includes(id), id + ' di slot ' + b.slot);
  }
  assert.deepEqual(Object.values(F.AKS_SLOT).flat().sort(), Object.keys(S.KATALOG).filter((k) => S.KATALOG[k].jenis === 'aksesori').sort());
  assert.deepEqual(F.DEKOR_IDS, Object.keys(S.KATALOG).filter((k) => S.KATALOG[k].jenis === 'dekor'));
  assert.deepEqual(F.KAFE_MENU_IDS, Object.keys(S.KATALOG).filter((k) => S.KATALOG[k].jenis === 'kafe'));
});

test('perkiraan gaji klien = upahShift server (semua pekerjaan, pangkat, hasil acak + nilai pinggir)', () => {
  const r = acakBenih(16);
  const pinggir = [undefined, null, 'x', {}, { benar: -3, salah: -1, cepat: -2 }, { benar: 99, salah: 999, cepat: 9 }, { benar: 2.5, salah: 1.5, cepat: NaN }, { benar: '6', salah: '0', cepat: '1' }];
  for (const id of F.KERJA_IDS) {
    for (const n of [0, 4, 5, 14, 15, 99, -1, 2.5]) {
      for (const h of pinggir) {
        const a = F.kerjaUpah(id, n, h), b = S.upahShift(id, n, h);
        assert.deepEqual([a.gaji, a.tip, a.total, a.pangkat], [b.gaji, b.tip, b.total, b.pangkat], id + ' ' + n + ' ' + JSON.stringify(h));
      }
      for (let i = 0; i < 60; i++) {
        const h = { benar: Math.floor(r() * 8), salah: Math.floor(r() * 12), cepat: r() };
        const a = F.kerjaUpah(id, n, h), b = S.upahShift(id, n, h);
        assert.deepEqual([a.gaji, a.tip, a.total], [b.gaji, b.tip, b.total]);
      }
    }
  }
  assert.equal(F.kerjaUpah('maling', 0, {}), null);
  assert.equal(F.kerjaUpah('__proto__', 0, {}), null);
  for (const n of [-5, 0, 1, 4, 5, 6, 14, 15, 16, 300]) assert.equal(F.kerjaPangkat(n), S.pangkatDari(n), 'pangkat ' + n);
  assert.deepEqual([0, 3, 4, 5, 14, 15, 40].map(F.kerjaSisaPangkat), [5, 2, 1, 10, 1, 0, 0]);
  /* jam ronda klien (jam WIB pecahan) = server (epoch ms) */
  for (let m = 0; m < 24 * 60; m += 7) {
    const ms = Date.UTC(2026, 10, 16, 0, 0) - 7 * 3600e3 + m * 60e3; /* m menit sesudah 00.00 WIB */
    assert.equal(F.kerjaRondaBuka(m / 60), S.rondaBuka(ms), 'jam ' + (m / 60).toFixed(2));
  }
});

test('rupiah(): titik ribuan, tanpa desimal, tanda minus, masukan aneh = Rp0', () => {
  assert.equal(F.rupiah(0), 'Rp0');
  assert.equal(F.rupiah(500), 'Rp500');
  assert.equal(F.rupiah(12500), 'Rp12.500');
  assert.equal(F.rupiah(100000), 'Rp100.000');
  assert.equal(F.rupiah(1234567), 'Rp1.234.567');
  assert.equal(F.rupiah(-4000), '−Rp4.000');
  assert.equal(F.rupiah(1999.6), 'Rp2.000');
  assert.equal(F.rupiah('abc'), 'Rp0');
  assert.equal(F.rupiah(undefined), 'Rp0');
});

test('hasil shift yang dilaporkan dijepit; durasi shift kafe/warung >= durasi minimum server walau pemain sangat cepat', () => {
  assert.deepEqual(polos(F.kerjaHasil({ pesanan: 6, benar: 9, salah: -2, cepatJumlah: 9, cepatN: 3 })), { benar: 6, salah: 0, cepat: 1 });
  assert.deepEqual(polos(F.kerjaHasil({ pesanan: 6, benar: 4, salah: 2, cepatJumlah: 1.5, cepatN: 3 })), { benar: 4, salah: 2, cepat: 0.5 });
  assert.deepEqual(polos(F.kerjaHasil(null)), { benar: 0, salah: 0, cepat: 0 });
  for (const id of ['kafe', 'warung']) {
    const p = F.KERJA_PEKERJAAN[id];
    /* pembeli terakhir paling cepat datang (dibuat) di (pesanan-1) x jeda tiba */
    assert.ok(F.kerjaWaktuTiba(p.pesanan - 1, 0, 0) >= 80000, id);
    assert.ok(F.KERJA_SABAR_MS.every((s, i) => i === 0 || s < F.KERJA_SABAR_MS[i - 1]), 'pangkat lebih tinggi = pembeli lebih buru-buru');
  }
  assert.equal(F.kerjaWaktuTiba(2, 1000, 0), 1000 + 2 * F.KERJA_TIBA_MS);
  assert.equal(F.kerjaWaktuTiba(1, 0, 40000), 42500, 'jeda 2,5 dtk sesudah pembeli terakhir dilayani');
  assert.equal(F.kerjaSkorCepat(0, 30000), 1); assert.equal(F.kerjaSkorCepat(45000, 30000), 0); assert.equal(F.kerjaSkorCepat(15000, 30000), 0.5);
});

test('barista: resep pakai bahan yang dikenal, mulai gelas, akhir sajikan; es = gelas es + es batu; kafeLangkah', () => {
  assert.deepEqual(Object.keys(F.KAFE_RESEP), F.KAFE_MENU_IDS);
  assert.deepEqual([...F.KAFE_BAHAN_URUT].sort(), Object.keys(F.KAFE_BAHAN).sort());
  const unik = new Set();
  for (const [id, r] of Object.entries(F.KAFE_RESEP)) {
    assert.ok(r.every((b) => F.kerjaPunya(F.KAFE_BAHAN, b)), id);
    assert.ok(r[0] === 'gelasPanas' || r[0] === 'gelasEs', id + ' mulai gelas');
    assert.equal(r[r.length - 1], 'sajikan', id);
    assert.equal(r[0] === 'gelasEs', r.includes('esBatu'), id + ': es batu hanya di gelas es');
    assert.equal(r.filter((b) => b === 'gelasPanas' || b === 'gelasEs').length, 1);
    assert.equal(r[0] === 'gelasEs', /^Es /.test(S.KATALOG[id].nama), id + ': nama "Es ..." = minuman dingin');
    unik.add(r.join());
    for (let i = 0; i < r.length; i++) assert.equal(F.kafeLangkah(r, i, r[i]), i === r.length - 1 ? 'selesai' : 'benar');
    assert.equal(F.kafeLangkah(r, 0, 'sajikan'), 'salah');
    assert.equal(F.kafeLangkah(r, r.length, 'sajikan'), 'salah');
    assert.equal(F.kafeLangkah(r, -1, r[0]), 'salah');
  }
  assert.equal(unik.size, 4, 'resep berbeda semua');
  assert.equal(F.kafeLangkah(null, 0, 'x'), 'salah');
});

test('jaga warung: pesanan acak (total <= Rp15.000, dibayar pecahan terkecil di atas total, kembalian bisa disusun), ambil + kembalian', () => {
  const r = acakBenih(7), harga = Object.fromEntries(F.WARUNG_KERJA_BARANG.map((b) => [b.id, b.harga]));
  for (let i = 0; i < 3000; i++) {
    const p = F.warungPesananAcak(r), ids = Object.keys(p.isi);
    assert.ok(ids.length >= 1 && ids.length <= 3, JSON.stringify(p));
    assert.ok(ids.every((id) => p.isi[id] >= 1 && p.isi[id] <= 3 && harga[id]));
    assert.equal(p.total, ids.reduce((a, id) => a + p.isi[id] * harga[id], 0));
    assert.ok(p.total > 0 && p.total <= 15000);
    assert.ok(F.WARUNG_KERJA_PECAHAN.includes(p.bayar) && p.bayar > p.total);
    assert.ok(F.WARUNG_KERJA_PECAHAN.filter((x) => x > p.total).every((x) => x >= p.bayar), 'pecahan terkecil di atas total');
    assert.equal(p.kembali, p.bayar - p.total);
    assert.ok(p.kembali > 0 && p.kembali % 500 === 0, 'kembalian kelipatan Rp500 (pecahan terkecil)');
  }
  const pes = { isi: { esteh: 2, gorengan: 1 }, total: 7000, bayar: 10000, kembali: 3000 }, ambil = {};
  assert.equal(F.warungAmbil(pes, ambil, 'eskrim'), 'salah');
  assert.equal(F.warungAmbil(pes, ambil, 'esteh'), 'benar');
  assert.equal(F.warungAmbil(pes, ambil, 'gorengan'), 'benar');
  assert.equal(F.warungAmbil(pes, ambil, 'gorengan'), 'salah', 'kelebihan barang');
  assert.equal(F.warungAmbil(pes, ambil, 'esteh'), 'lengkap');
  assert.equal(F.warungAmbil(pes, ambil, '__proto__'), 'salah');
  assert.deepEqual(F.warungUang(3000, 0, 2000), { hasil: 'kurang', terkumpul: 2000 });
  assert.deepEqual(F.warungUang(3000, 2000, 1000), { hasil: 'pas', terkumpul: 3000 });
  assert.deepEqual(F.warungUang(3000, 2000, 2000), { hasil: 'lebih', terkumpul: 0 });
  assert.equal(F.warungKerjaBarang('permen').harga, 500); assert.equal(F.warungKerjaBarang('x'), null);
});

test('ronda: 4 titik di Jalan Kampung (terjangkau, berjauhan, tidak di dalam benda padat), kursor irama + zona = bilah di CSS', () => {
  const T = F.RONDA_TITIK;
  assert.equal(T.length, F.KERJA_PEKERJAAN.ronda.pesanan);
  for (const t of T) {
    /* ada titik berdiri sah (di batas JALAN, di luar tiang/tong sampah) dalam jarak ketuk */
    const nx = Math.max(F.JALAN.minX, Math.min(F.JALAN.maxX, t.x)), nz = Math.max(F.JALAN.minZ, Math.min(F.JALAN.maxZ, t.z));
    assert.ok(Math.hypot(nx - t.x, nz - t.z) < F.RONDA_JARAK - 0.2, t.nama + ' terjangkau');
    for (const s of F.JALAN_SOLIDS) assert.ok(F.jarakKeKotak(t.x, t.z, s) > 0.6, t.nama + ' bebas solid');
    assert.ok(typeof t.nama === 'string' && t.nama.length > 3);
  }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) assert.ok(Math.hypot(T[i].x - T[j].x, T[i].z - T[j].z) > 10, 'berjauhan');
  for (let d = 0; d < 5; d += 0.05) { const k = F.rondaKursor(d); assert.ok(k >= 0 && k <= 1); assert.ok(Math.abs(F.rondaKursor(d + F.RONDA_PERIODE) - k) < 1e-9); }
  assert.equal(F.rondaKursor(F.RONDA_PERIODE / 2), 1); assert.equal(F.rondaKursor(0), 0); assert.ok(Math.abs(F.rondaKursor(F.RONDA_PERIODE / 4) - 0.5) < 1e-9);
  assert.equal(F.rondaNilai(0.5), 'pas'); assert.equal(F.rondaNilai(0.58), 'pas'); assert.equal(F.rondaNilai(0.6), 'oke'); assert.equal(F.rondaNilai(0.31), 'oke');
  assert.equal(F.rondaNilai(0.25), 'meleset'); assert.equal(F.rondaNilai(0.95), 'meleset');
  /* bilah irama di CSS sama dengan zona: pas 0,42-0,58 (left 42% width 16%), oke 0,3-0,7 (left 30% width 40%) */
  assert.match(HTML, /\.rd-bar \.rd-oke \{ position: absolute; left: 30%; width: 40%;/);
  assert.match(HTML, /\.rd-bar \.rd-pas \{ position: absolute; left: 42%; width: 16%;/);
});

test('laundry kiloan: kantong acak (2-5 kg, 3 pilihan ongkos berbeda termasuk yang benar, 3 baju x urutan lipat), teks kg', () => {
  const r = acakBenih(99);
  for (let i = 0; i < 2000; i++) {
    const k = F.laundryKantongAcak(r);
    assert.ok(k.kg >= 2 && k.kg <= 5 && Math.round(k.kg * 10) === k.kg * 10, String(k.kg));
    assert.equal(k.harga, Math.round(k.kg * F.LAUNDRY_HARGA_KG));
    assert.equal(k.pilihan.length, 3); assert.equal(new Set(k.pilihan).size, 3, JSON.stringify(k.pilihan));
    assert.ok(k.pilihan.includes(k.harga) && k.pilihan.every((v) => v > 0 && Number.isInteger(v)));
    assert.equal(k.lipat.length, F.LAUNDRY_BAJU);
    for (const u of k.lipat) assert.deepEqual([...u].sort(), [...F.LAUNDRY_ARAH].sort());
  }
  assert.equal(F.laundryKgTeks(3.4), '3,4 kg'); assert.equal(F.laundryKgTeks(2), '2 kg');
  assert.equal(F.laundryLipat(['kiri', 'kanan', 'bawah'], 2, 'bawah'), 'selesai');
  assert.equal(F.laundryLipat(['kiri', 'kanan', 'bawah'], 0, 'kanan'), 'salah');
  /* satu shift laundry selalu > durasi minimum: 3 kantong x (cuci + kering) memakai mesin bergantian */
  assert.ok(F.KERJA_PEKERJAAN.laundry.pesanan * F.LAUNDRY_MESIN_DETIK + 2 * F.LAUNDRY_MESIN_DETIK < F.KERJA_PEKERJAAN.laundry.minDetik + 60);
});

test('tempat kerja: Kedai Kopi di kavling rumah krem (bukan area palang), penjaga ditambat di luar batas jalan tapi lolos validasi multiplayer, jalur pembeli bebas tiang', () => {
  assert.ok(F.KAFE_PLOT.x0 >= -1 && F.KAFE_PLOT.x1 <= 7, 'kavling rumah krem x -1..7');
  for (const k of [F.KAFE_KOTAK, F.KAFE_LOWONGAN_KOTAK]) {
    assert.ok(k.minX >= F.KAFE_PLOT.x0 && k.maxX <= F.KAFE_PLOT.x1 && k.minZ > F.JALAN.maxZ, JSON.stringify(k));
    assert.ok(F.jarakKeKotak(Math.max(k.minX, Math.min(k.maxX, 3)), F.JALAN.maxZ, k) <= F.JALAN_JARAK, 'bisa diketuk dari trotoar');
  }
  /* tidak menimpa warung / pos ronda */
  const tumpang = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  assert.ok(!tumpang(F.KAFE_KOTAK, F.WARUNG_KOTAK) && !tumpang(F.KAFE_KOTAK, F.POS_RONDA_KOTAK));
  /* penjaga di balik meja: di luar batas jalan avatar (tidak bisa dicapai dengan berjalan), lolos validasi pos multiplayer */
  for (const [nama, j] of [['barista', F.KAFE_BARISTA], ['penjaga warung', F.WARUNG_PENJAGA]]) {
    assert.ok(j.z > F.JALAN.maxZ, nama);
    const m = F.mpValidasiPos({ id: 'p1234567', realm: 'jalan', x: j.x, z: j.z, rot: j.rot, gerak: 0, gender: 'cewek', nama: 'a', kerja: 'kafe' }, 'p7654321');
    assert.ok(m && m.z === j.z && m.kerja === 'kafe', nama + ' lolos validasi');
  }
  assert.ok(F.jarakKeKotak(F.KAFE_BARISTA.x, F.KAFE_BARISTA.z, F.KAFE_KOTAK) === 0 && F.jarakKeKotak(F.WARUNG_PENJAGA.x, F.WARUNG_PENJAGA.z, F.WARUNG_KOTAK) === 0);
  /* pembeli: jalan di trotoar (z KERJA_TROTOAR_Z) lalu belok lurus ke depan meja — tidak menyerempet tiang listrik (badan r 0,3) */
  for (const s of F.JALAN_SOLIDS.filter((q) => q.minZ > 0)) assert.ok(F.KERJA_TROTOAR_Z + 0.3 < s.minZ, 'trotoar di utara tiang');
  for (const P of [F.KAFE_PELANGGAN, F.WARUNG_PELANGGAN]) {
    for (const s of F.JALAN_SOLIDS) assert.ok(P.x + 0.3 < s.minX || P.x - 0.3 > s.maxX || Math.max(P.z, F.KERJA_TROTOAR_Z) < s.minZ - 0.3, 'belok bebas tiang ' + JSON.stringify(s));
  }
  /* pembeli berdiri di samping garis pandang kamera kerja (kamera dari timur laut) */
  assert.ok(F.KAFE_PELANGGAN.x < F.KAFE_BARISTA.x - 0.3 && F.WARUNG_PELANGGAN.x < F.WARUNG_PENJAGA.x - 0.3);
});

test('meja laundry kiloan: di dalam dapur, tidak menimpa mesin cuci / meja dapur, padat, terjangkau', () => {
  const k = F.DAPUR_KILOAN, tumpang = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  assert.ok(!tumpang(k, F.DAPUR_LAUNDRY) && !tumpang(k, F.DAPUR_COUNTER));
  assert.ok(k.minX >= -4.5 && k.maxX <= 4.5 && k.minZ >= -4 && k.maxZ <= 4, 'di dalam dinding dapur 9 x 8');
  const c = F.resolveAABB((k.minX + k.maxX) / 2, k.maxZ + 0.1, k, 0.4, F.DAPUR);
  assert.ok(c.z >= k.maxZ + 0.4 - 1e-9, 'avatar didorong keluar meja');
  assert.ok(F.jarakKeKotak(c.x, c.z, k) <= 1.4, 'berdiri di depan meja = cukup dekat untuk menimbang / melipat');
  /* mesin cuci (x -0,7) + pengering (x 0,7): berdiri di depan mesin (didorong AABB) masih dalam jangkauan laundryDekat (<= 1,7 dari x, -3,1) */
  for (const x of [-0.7, 0.7]) { const d = F.resolveAABB(x, F.DAPUR_LAUNDRY.maxZ, F.DAPUR_LAUNDRY, 0.4, F.DAPUR); assert.ok(Math.hypot(d.x - x, d.z + 3.1) <= 1.7, String(x)); }
});

test('aksesori multiplayer: field opsional (indeks sah / id kerja dikenal), klien lama aman, pesan tanpa aksesori tidak berubah', () => {
  assert.deepEqual(polos(F.mpBacaAksesori({ topi: 1, kacamata: 0, tas: 1, kerja: 'warung' })), { topi: 1, kacamata: 0, tas: 1, kerja: 'warung' });
  assert.deepEqual(polos(F.mpBacaAksesori({ topi: 2, kacamata: -1, tas: '1', kerja: 'maling' })), { topi: -1, kacamata: -1, tas: -1, kerja: null });
  assert.deepEqual(polos(F.mpBacaAksesori(null)), { topi: -1, kacamata: -1, tas: -1, kerja: null });
  assert.deepEqual(polos(F.mpBacaAksesori({ topi: 0.5, kerja: '__proto__' })), { topi: -1, kacamata: -1, tas: -1, kerja: null });
  assert.deepEqual(polos(F.mpPasangAksesori({ x: 1 }, { topi: -1, kacamata: -1, tas: -1, kerja: null })), { x: 1 }, 'tanpa aksesori = tanpa field');
  assert.deepEqual(polos(F.mpPasangAksesori({}, { topi: 0, kacamata: -1, tas: 1, kerja: 'ronda' })), { topi: 0, tas: 1, kerja: 'ronda' });
  assert.equal(F.mpAksesoriSama({ topi: 0 }, { topi: 0, kacamata: 7 }), true, 'nilai tidak sah = -1 (sama dengan tidak ada)');
  assert.equal(F.mpAksesoriSama({ kerja: 'kafe' }, {}), false);
  const dasar = { id: 'p1234567', realm: 'yard', x: 1, z: 2, rot: 0, gerak: 0, gender: 'cowok', nama: 'b' };
  const lama = F.mpValidasiPos(dasar, 'p0000000'), baru = F.mpValidasiPos(Object.assign({ topi: 1, kerja: 'laundry' }, dasar), 'p0000000');
  assert.ok(lama && baru);
  assert.deepEqual([lama.topi, lama.kacamata, lama.tas, lama.kerja], [-1, -1, -1, null]);
  assert.deepEqual([baru.topi, baru.kerja], [1, 'laundry']);
  const pr = F.mpValidasiPresence(Object.assign({ kacamata: 1, kerja: 'x' }, dasar), 'p0000000');
  assert.deepEqual([pr.kacamata, pr.kerja], [1, null]);
});

test('misi + kalimat Ibu: misi kerja & kafe; draf malam/hujan/uang kos (menunggu persetujuan) tidak mengubah kalimat lama', () => {
  const id = F.MISI_LIST.map((m) => m.id);
  assert.ok(id.includes('kerja') && id.includes('kafe'));
  assert.equal(F.IBU_OBROLAN_MALAM.length, 4); assert.equal(F.IBU_OBROLAN_HUJAN.length, 4);
  assert.deepEqual(Object.keys(F.IBU_SEWA), ['makasih', 'lunas', 'kurang']);
  for (const k of [].concat(F.IBU_OBROLAN_MALAM, F.IBU_OBROLAN_HUJAN, Object.values(F.IBU_SEWA))) assert.ok(typeof k === 'string' && k.length > 10 && k.length < 120, k);
  assert.equal(F.ibuDaftarObrolan({ hujan: 0.8, malam: 1 }).nama, 'hujan');
  assert.equal(F.ibuDaftarObrolan({ hujan: 0, malam: 1 }).nama, 'malam');
  assert.equal(F.ibuDaftarObrolan({ hujan: 0, malam: 0 }).daftar, F.IBU_OBROLAN);
  assert.equal(F.ibuDaftarObrolan(null).daftar, F.IBU_OBROLAN);
  assert.match(HTML, /MENUNGGU persetujuan\s+Ryan SATU PER SATU/, 'penanda draf tetap ada sampai disetujui');
});

test('kabel runtime: ketuk, animate (tambat, pose, tick, lensa), dapur, avatar, masuk, back, Ibu, kamar, KTA, cuci, genangan', () => {
  const tap = fungsi('canvasTap');
  for (const [i, f] of [['kafe', 'showKafeCard\\(\\)'], ['lowongan', "dompetBuka\\('kerja'\\)"], ['kiloan', 'laundryKetukMeja\\(\\)'], ['lampuHias', 'lampuHiasToggle\\(\\)']]) {
    assert.match(tap, new RegExp("ud\\.interact === '" + i + "'\\) \\{[^\\n]*" + f), i);
  }
  const ani = fungsi('animate');
  assert.ok(ani.indexOf('if (roomPose) mag = 0;') < ani.indexOf('if (kerjaJangkar) mag = 0;'), 'tambat mematikan gerak jalan');
  assert.ok(ani.indexOf('jemuranPoseBawa(dt);') < ani.indexOf('kerjaPoseTick(dt);'));
  assert.ok(ani.indexOf('kerjaTick(dt, Date.now());') > 0 && ani.indexOf('kerjaTick(dt, Date.now());') < ani.indexOf('suasanaTick(dt, Date.now());'));
  assert.ok(ani.indexOf('kerjaLensaTick(dt);') > ani.indexOf('camera.updateProjectionMatrix(); }') && ani.indexOf('kerjaLensaTick(dt);') < ani.indexOf('renderer.render('));
  assert.match(ani, /if \(kerjaJangkar && KERJA && myRealm === KERJA\.realm\) \{[^}]*groundY = kerjaJangkar\.y;/);
  assert.match(ani, /resolveAABB\(nx, nz, DAPUR_KILOAN, 0\.4, DAPUR\)/);
  assert.match(fungsi('buildDapur'), /bangunMejaKiloan\(\);/);
  assert.match(fungsi('buildVisitorAvatar'), /avPartsSaya = avParts; aksesoriPasang\(avParts, aksesoriSayaMp\(\)\);/);
  assert.match(fungsi('masukSebagai'), /if \(typeof dompetSaatMasuk === 'function'\) dompetSaatMasuk\(\);/);
  assert.match(fungsi('showIbuCard'), /openCard\(\);[\s\S]*ibuSewaTombol\(\);/);
  assert.match(fungsi('enterRoom'), /dekorTerapkan\(\);/);
  assert.match(fungsi('ktaRender'), /kta-lunas/);
  const sw = fungsi('startWash'), fw = fungsi('finishWash');
  assert.ok(sw.indexOf('laundryKetukMesin(which)') > 0 && sw.indexOf('laundryKetukMesin(which)') < sw.indexOf('st.active = true'));
  assert.ok(fw.indexOf('laundryMesinSelesai(which)') > 0 && fw.indexOf('laundryMesinSelesai(which)') < fw.indexOf("jemuranAksi('cuci_selesai')"));
  assert.match(fungsi('suasanaSiapkan'), /gj\.push\(\[3\.0, 7\.4,/);
  const pop = antara("window.addEventListener('popstate'", '/* Tidak ada UI yang terbuka');
  assert.ok(pop.indexOf('dompetTutup()') > 0 && pop.indexOf('kerjaBersihkan()') > 0);
  assert.ok(pop.indexOf("cardEl.classList.contains('open')") < pop.indexOf('if (KERJA)'), 'back menutup kartu dulu, baru urusan kerja');
  for (const idEl of ['dompetPill', 'dompetPanel', 'kerjaPanel', 'rondaHud', 'kerjaBtn', 'tokoBtn']) assert.equal(HTML.split('id="' + idEl + '"').length - 1, 1, idEl);
  /* variabel yang diisi buildDapur / buildVisitorAvatar SEBELUM blok runtime dieksekusi: tanpa nilai awal (jangan menimpa) */
  assert.match(RUNTIME, /\nvar avPartsSaya;/);
  assert.match(RUNTIME, /\nvar KILOAN;/);
  assert.doesNotMatch(RUNTIME, /\nvar (KILOAN|avPartsSaya)\s*=/);
  /* kartu tempat kerja: tombol kerja ada di warung, pos ronda, kafe, meja kiloan */
  for (const f of ['warungRender', 'showPosRondaCard', 'showKafeCard', 'showKiloanCard']) assert.match(fungsi(f), /kerjaTombolKartu\('/, f);
  /* jalur lama tetap (tes jalan.test.js memaku pola ini) */
  assert.match(tap, /if \(ud\.interact === 'warung'\) \{ showWarungCard\(\); return; \}/);
});

test('aturan tetap: tanpa lampu baru, tanpa bidang transparan / emissive, menyala = Basic, tanpa naik-turun badan, klien tidak mengirim angka uang', () => {
  for (const [nama, src] of [['runtime', RUNTIME], ['Kedai Kopi', KAFE_BANGUN]]) {
    assert.doesNotMatch(src, /new THREE\.\w*Light\(/, nama + ': jumlah lampu tidak berubah');
    assert.doesNotMatch(src, /transparent: true|emissive|opacity:/, nama + ': tanpa bidang transparan / emissive');
  }
  assert.match(fungsi('rondaPenandaSiapkan'), /MeshBasicMaterial\(\{ color: 0xffc56b \}\)/);
  assert.match(fungsi('bangunDekorKamar'), /D\.lampuMat = new THREE\.MeshBasicMaterial/);
  assert.match(KAFE_BANGUN, /new THREE\.MeshBasicMaterial\(\{ map: texKaca, vertexColors: true \}\)/);
  /* pose kerja hanya memutar lengan / badan: posisi y avatar tidak disentuh; NPC pembeli y tetap per lantai */
  assert.doesNotMatch(fungsi('kerjaPoseTick'), /position/);
  assert.doesNotMatch(fungsi('kerjaPoseRemote'), /Math\.sin[^;]*position\.y|position\.y[^;]*Math\.sin/);
  assert.match(fungsi('pelangganTick'), /p\.g\.position\.y = p\.g\.position\.z > 6\.8 \? 0\.12 : 0\.1;/);
  /* badan permintaan ke server: hanya aksi + id + hasil kerja (server yang menentukan uang) */
  const kirim = RUNTIME.match(/apiKosan\('POST', '\/api\/(kerja|belanja)', \{[^}]*\}/g) || [];
  assert.ok(kirim.length >= 6, String(kirim.length));
  for (const k of kirim) assert.doesNotMatch(k, /saldo|gaji|tip|harga|jumlah|total/, k);
  /* hasil yang dikirim = kerjaHasil (dijepit) */
  assert.match(fungsi('kerjaSelesai'), /aksi: 'selesai', shift: K\.shift, hasil: hasil/);
});

test('teks UI kerja tanpa glyph yang tidak ada di font lokal (panah, centang): tampil sama di semua HP', () => {
  const ui = RUNTIME.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(ui, /[→✓✔]/);
});
