'use strict';
/* Tes ALUR klien Kerja & Belanja (audit 16 Nov): fungsi runtime diambil VERBATIM dari index.html lalu
   dijalankan dengan server palsu yang jawabannya diatur tes (urutan + waktu jawaban bisa dipilih).
   Menutup celah "tidak ada tes alur": jeda / jatah basi, batal saat "Mencatat gaji…", Coba lagi,
   terlalu_cepat, GET dompet basi, ketuk dua kali, jawaban mulai yang terlambat, layar mesin laundry,
   barista pemain lain, lensa kamera. Jalankan: node --test tests/kerja-alur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const baris = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n', a) + 1); }; /* fungsi satu baris */
const DEKLARASI_DOMPET = antara('var DOMPET = {', '\nvar avPartsSaya;');

const BLOK = antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== GAZEBO-START ==== */', '/* ==== GAZEBO-END ==== */')
  + antara('/* ==== SUASANA-START ==== */', '/* ==== SUASANA-END ==== */')
  + antara('/* ==== KERJA-START ==== */', '/* ==== KERJA-END ==== */')
  + antara('/* ==== JALAN-START ==== */', '/* ==== JALAN-END ==== */');
const SATU_BARIS = ['dompetBerubah', 'dompetJedaDetik', 'dompetJatahHabis', 'sewaLunasKini', 'dompetSetSaldo', 'ktaLunasLabel'];
const BANYAK_BARIS = ['pesanApi', 'dompetMuat', 'dompetBuka', 'tokoBeli', 'tokoTombolBeli', 'sewaBayar', 'kerjaBoleh', 'kerjaMulai', 'kerjaPenutup', 'kerjaSelesai',
  'kerjaTampilHasil', 'kerjaBersihkan', 'kerjaBerhenti', 'kerjaTick', 'kerjaKlik', 'kerjaHasilHtml', 'kerjaKepalaHtml', 'laundryBersihkan', 'kerjaAngkatRemote'];

/* dunia palsu: semua yang dipanggil fungsi di atas tapi bukan bagian alur (render, suara, 3D, MQTT) dicatat saja */
function buatDunia() {
  const kode = `
var jam = { t: globalThis.Date.UTC(2026, 10, 16, 5, 0) }; /* 12:00 WIB */
var Date = (function (D) { function F(a) { return arguments.length ? new D(a) : new D(jam.t); } F.now = function () { return jam.t; }; F.UTC = D.UTC; F.parse = D.parse; return F; })(globalThis.Date);
var catat = { toast: [], api: [], render: 0, misi: [], bunyi: [], layar: [] };
function apiKosan(metode, p, body) { return new Promise(function (res) { catat.api.push({ metode: metode, path: p, body: body, jawab: res }); }); }
function toastKosan(t) { catat.toast.push(t); }
function bunyi(n) { catat.bunyi.push(n); }
function misiSelesai(id) { catat.misi.push(id); }
function kerjaRender() { catat.render++; }
function kerjaJalankan(id, shift) { KERJA = { id: id, shift: shift, latihan: !shift, realm: id === 'laundry' ? 'dapur' : 'jalan', mulai: Date.now(), pangkat: 0,
  pesanan: KERJA_PEKERJAAN[id].pesanan, benar: 6, salah: 0, cepatJumlah: 3, cepatN: 6, ke: 6, fase: 'kerja', beres: false, sibuk: false, hasil: null, tTampil: 0 }; }
var entered = true, penghuni = true, myRealm = 'jalan', myRealmLihat = 'jalan', avatarPos = { x: 3.1, z: 6.2 }, avatar = { rotation: {} }, suasanaKini = { jam: 12 }; /* Alam Kerja (17 Nov): myRealmLihat = alam filter tampil (kerjaBersihkan meresetnya ke myRealm) */
function ktaIsResident() { return penghuni; }
var KERJA = null, kerjaJangkar = null, kerjaMemulai = false, PELANGGAN = [], kerjaGerak = { jenis: null };
var KERJA_IKON = { kafe: 'kafe', warung: 'warung', ronda: 'kentongan', laundry: 'laundry' };
var KERJA_SATUAN = { kafe: 'pesanan', warung: 'pembeli', ronda: 'titik patroli', laundry: 'kantong' };
var IBU_SEWA = { makasih: 'makasih', lunas: 'lunas', kurang: 'kurang' };
var elemen = function () { return { classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } }, style: { setProperty: function () {} } }; };
var document = { getElementById: function () { return elemen(); } };
var cardEl = elemen(), rupaPanel = null;
var washWM = { active: false, t: 0 }, washDR = { active: false, t: 0 }, wmLed = { visible: false }, drLed = { visible: true }, wmMesin = { layar: { nama: 'wm' } }, drMesin = { layar: { nama: 'dr' } }, KILOAN = null;
function layarMesinTulis(L, teks, warna) { catat.layar.push([L.nama, teks, warna]); }
function dompetHudPerbarui() {} function dekorTerapkan() {} function aksesoriSayaTerapkan() {} function ktaPerbaruiBila() {} function mpKirimPresence() {} function mpKirimPos() {}
function dompetRender() {} function ibuSewaTombol() {} function pelangganPergi() {} function pelangganBuang() {} function kafeGelasBuang() {} function warungBarangBuang() {}
function mpTerapkanRender() {} /* Alam Kerja (17 Nov): filter tampil pemain lain (kerjaBersihkan memanggilnya saat mereset myRealmLihat) */
function rondaPenandaSembunyi() {} function kerjaLensaHitung() {} function pelangganTick() {} function kafeTick() {} function warungKerjaTick() {} function rondaTick() {}
function laundryTick() {} function rondaKursorTampil() {} function rondaPanahTampil() {} function kerjaRenderWaktu() {} function kerjaAyun() {} function menuTutup() {}
function closeCard() {} function rupaTutup() {} function kiloanAwal() {} function kiloanLayar() {} function dompetTerbuka() { return false; } function aksesoriSayaMp() { return {}; } function aksesoriPakai() {}
function ibuTampilKalimat(k) { catat.ibu = (catat.ibu || []).concat(k); }
function iconSvg() { return ''; } function escapeHtml(s) { return String(s); }
var WASH_DUR = 30;
` + BLOK + DEKLARASI_DOMPET + '\n' + SATU_BARIS.map(baris).join('') + BANYAK_BARIS.map(fungsi).join('') + `
DOMPET.untuk = 'p:rina';
return { catat: catat, jam: jam, ev: function (s) { return eval(s); } };`;
  return new Function(kode)();
}
const tunggu = () => new Promise((r) => setImmediate(r));
const DATA = (lebih) => Object.assign({ saldo: 20000, pekerjaan: { kafe: { terdaftar: true, shift: 1, pangkat: 0 }, warung: { terdaftar: false, shift: 0, pangkat: 0 },
  ronda: { terdaftar: false, shift: 0, pangkat: 0 }, laundry: { terdaftar: false, shift: 0, pangkat: 0 } }, hariIni: { shift: 1, maks: 3 }, jedaDetik: 0,
  shiftAktif: null, sewa: { bulan: '2026-11', label: 'November 2026', lunas: false, harga: 100000 }, barang: [], riwayat: [] }, lebih || {});
async function muatDompet(W, data) {
  const p = W.ev('dompetMuat()');
  const c = W.catat.api.pop(); assert.equal(c.path, '/api/dompet');
  c.jawab({ status: 200, data: data });
  await p;
}
const klik = (W, k) => W.ev('kerjaKlik')({ target: { closest: () => ({ disabled: false, getAttribute: () => k }) } });

test('jeda 10 menit dari potret dompet berkurang mengikuti jam (dulu "10 menit lagi" selamanya)', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA({ jedaDetik: 600, hariIni: { shift: 1, maks: 3 } }));
  assert.match(W.ev("kerjaBoleh('kafe')"), /10 menit lagi/);
  W.jam.t += 4 * 60000;
  assert.match(W.ev("kerjaBoleh('kafe')"), /6 menit lagi/);
  W.jam.t += 6 * 60000 + 1000;
  assert.equal(W.ev("kerjaBoleh('kafe')"), '', 'sesudah 10 menit boleh mulai tanpa membuka Dompet');
});

test('jatah 3 shift dari potret kemarin tidak menolak sesudah tengah malam WIB; uang kos lunas bulan lalu = belum lunas', async () => {
  const W = buatDunia();
  W.jam.t = Date.UTC(2026, 10, 30, 16, 30); /* 23:30 WIB 30 Nov */
  await muatDompet(W, DATA({ hariIni: { shift: 3, maks: 3 }, sewa: { bulan: '2026-11', label: 'November 2026', lunas: true, harga: 100000 } }));
  assert.match(W.ev("kerjaBoleh('kafe')"), /Jatah kerja hari ini sudah habis/);
  assert.equal(W.ev('sewaLunasKini(DOMPET.data)'), true);
  assert.equal(W.ev('ktaLunasLabel()'), 'NOVEMBER 2026');
  W.jam.t += 60 * 60000; /* 00:30 WIB 1 Des */
  assert.equal(W.ev("kerjaBoleh('kafe')"), '', 'hari baru: server yang menghitung jatah');
  assert.equal(W.ev('sewaLunasKini(DOMPET.data)'), false, 'bulan baru: tombol bayar muncul lagi');
  assert.equal(W.ev('ktaLunasLabel()'), '');
  W.ev('sewaBayar()');
  assert.equal(W.catat.api.length, 0, 'saldo 20.000 < 100.000: tidak ada permintaan');
  assert.deepEqual(W.catat.ibu, ['kurang'], 'Ibu bilang saldo kurang, bukan "udah lunas"');
});

test('Berhenti / keluar saat "Mencatat gaji…" tidak membatalkan shift; gaji yang datang tetap dicatat', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaJalankan('kafe', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')");
  W.ev('kerjaSelesai()');
  assert.equal(W.ev('KERJA.sibuk'), true);
  const selesai = W.catat.api.pop(); assert.equal(selesai.body.aksi, 'selesai');
  klik(W, 'berhenti');
  W.ev('kerjaBerhenti()');
  W.ev("myRealm = 'yard'");
  W.ev('kerjaTick(0.016, Date.now())');
  assert.equal(W.catat.api.length, 0, 'tidak ada batal');
  assert.ok(W.ev('KERJA !== null'), 'shift masih menunggu jawaban');
  assert.match(W.ev('kerjaKepalaHtml(KERJA)'), /data-k="berhenti" disabled/);
  selesai.jawab({ status: 200, data: { gaji: 7000, tip: 1500, saldo: 28500, pekerjaan: 'kafe', shift: 2, pangkat: 0, naikPangkat: false } });
  await tunggu();
  assert.equal(W.ev('DOMPET.data.saldo'), 28500);
  assert.deepEqual(W.catat.misi, ['kerja']);
  assert.ok(W.catat.toast.some((t) => /Gaji Barista Kafe tercatat: \+Rp8\.500/.test(t)), W.catat.toast.join(' | '));
  W.ev('kerjaTick(0.016, Date.now())');
  assert.equal(W.ev('KERJA'), null, 'sudah di luar: layar hasil ditutup');
  assert.ok(!W.catat.toast.some((t) => /dibatalkan/.test(t)), 'tidak ada toast "dibatalkan — tanpa gaji"');
});

test('selesai gagal (sinyal) = Coba lagi dengan id shift + hasil yang sama; percobaan kedua dibayar', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaJalankan('kafe', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')");
  W.ev('kerjaSelesai()');
  const a = W.catat.api.pop();
  a.jawab({ status: 0, data: null });
  await tunggu();
  assert.equal(W.ev('KERJA.hasil.ulang'), true);
  assert.match(W.ev('kerjaHasilHtml(KERJA)'), /data-k="cobaLagi"/);
  const muatUlang = W.catat.api.pop(); assert.equal(muatUlang.path, '/api/dompet', 'gagal = dompet dimuat ulang (gaji mungkin sudah masuk)');
  W.ev("myRealm = 'yard'"); W.ev('kerjaTick(0.016, Date.now())');
  assert.ok(W.ev('KERJA !== null'), 'panel Coba lagi tetap ada walau keluar');
  klik(W, 'cobaLagi');
  const b = W.catat.api.pop();
  assert.deepEqual(b.body, a.body, 'laporan yang sama');
  assert.equal(W.ev('KERJA.sibuk'), true);
  klik(W, 'tutup'); klik(W, 'cobaLagi');
  assert.equal(W.catat.api.length, 0, 'selama mencoba: tombol menunggu');
  b.jawab({ status: 200, data: { gaji: 7000, tip: 0, saldo: 27000, pekerjaan: 'kafe', shift: 2, pangkat: 0, naikPangkat: false } });
  await tunggu();
  assert.equal(W.ev('KERJA.hasil.saldo'), 27000);
  assert.equal(W.ev('KERJA.hasil.galat'), undefined);
});

test('Coba lagi dijawab shift_tidak_aktif = percobaan pertama mungkin sudah tercatat (tanpa "tidak dihitung"); 401 tanpa Coba lagi', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaJalankan('kafe', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')");
  W.ev('kerjaSelesai()');
  W.catat.api.pop().jawab({ status: 503, data: null }); await tunggu(); W.catat.api.length = 0;
  klik(W, 'cobaLagi');
  W.catat.api.pop().jawab({ status: 409, data: { galat: 'shift_tidak_aktif', pesan: 'Shift ini sudah tidak aktif.' } }); await tunggu();
  assert.match(W.ev('KERJA.hasil.galat'), /sudah ditutup server/);
  assert.ok(!W.ev('KERJA.hasil.ulang'));
  const W2 = buatDunia();
  await muatDompet(W2, DATA());
  W2.ev("kerjaJalankan('kafe', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')");
  W2.ev('kerjaSelesai()');
  W2.catat.api.pop().jawab({ status: 401, data: null }); await tunggu();
  assert.match(W2.ev('KERJA.hasil.galat'), /Sesi login-mu sudah habis/);
  assert.ok(!W2.ev('KERJA.hasil.ulang'), 'sesi habis: Coba lagi tidak menolong');
});

test('terlalu_cepat: satu kiriman ulang sesudah 2,5 dtk (dulu tiap bingkai)', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaJalankan('kafe', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')");
  W.jam.t += 200000;
  W.ev('kerjaPenutup(Date.now())');
  W.catat.api.pop().jawab({ status: 409, data: { galat: 'terlalu_cepat', pesan: 'Shift belum selesai.' } }); await tunggu();
  for (let i = 0; i < 60; i++) { W.jam.t += 16; W.ev('kerjaPenutup(Date.now())'); W.ev('kerjaTick(0.016, Date.now())'); }
  assert.equal(W.catat.api.length, 0, 'tidak mengirim selama menunggu');
  W.jam.t += 2500;
  W.ev('kerjaTick(0.016, Date.now())'); W.ev('kerjaPenutup(Date.now())'); W.ev('kerjaTick(0.016, Date.now())');
  assert.equal(W.catat.api.length, 1, 'tepat satu kiriman ulang');
  assert.equal(W.catat.api[0].body.aksi, 'selesai');
});

test('GET dompet yang mulai sebelum pembelian tidak menimpa saldo + barang baru; ketuk Beli dua kali = satu permintaan', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA({ saldo: 20000 }));
  const basi = W.ev('dompetMuat()'); /* mis. dibuka saat toko dibuka */
  const getLama = W.catat.api.pop();
  W.ev("tokoBeli('topi_baseball')"); W.ev("tokoBeli('topi_baseball')"); W.ev("tokoBeli('kacamata_hitam')");
  assert.equal(W.catat.api.length, 1, 'satu POST beli');
  const beli = W.catat.api.pop();
  assert.match(W.ev("tokoTombolBeli(DOMPET.data, 'kacamata_hitam', KATALOG.kacamata_hitam)"), /disabled/);
  beli.jawab({ status: 200, data: { saldo: 5000, barang: 'topi_baseball' } }); await tunggu();
  assert.equal(W.catat.api.length, 0, 'GET lama masih berjalan: belum ada GET baru');
  getLama.jawab({ status: 200, data: DATA({ saldo: 20000, barang: [] }) }); await tunggu();
  assert.equal(W.ev('DOMPET.data.saldo'), 5000, 'jawaban basi dibuang');
  assert.deepEqual(W.ev('DOMPET.data.barang'), ['topi_baseball']);
  const getBaru = W.catat.api.pop(); assert.equal(getBaru.path, '/api/dompet', 'GET baru sesudah pembelian');
  getBaru.jawab({ status: 200, data: DATA({ saldo: 5000, barang: ['topi_baseball'] }) }); await basi; await tunggu();
  assert.equal(W.ev('DOMPET.data.saldo'), 5000);
  assert.equal(W.catat.api.length, 0, 'tidak ada GET dobel');
});

test('bayar uang kos ketuk dua kali = satu permintaan, Ibu bilang makasih (bukan "udah lunas")', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA({ saldo: 150000 }));
  W.ev('sewaBayar()'); W.ev('sewaBayar()');
  assert.equal(W.catat.api.length, 1);
  W.catat.api.pop().jawab({ status: 200, data: { saldo: 50000, bulan: '2026-11', label: 'November 2026' } }); await tunggu();
  assert.deepEqual(W.catat.ibu, ['makasih']);
  assert.equal(W.ev('sewaLunasKini(DOMPET.data)'), true);
});

test('jawaban mulai yang datang sesudah pindah tempat: shift dibatalkan di server, tidak dijalankan', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaMulai('kafe')");
  const mulai = W.catat.api.pop(); assert.equal(mulai.body.aksi, 'mulai');
  W.ev("myRealm = 'yard'");
  mulai.jawab({ status: 200, data: { shift: 'ffffffff-ffff-4fff-8fff-ffffffffffff', pekerjaan: 'kafe', pesanan: 6, minDetik: 150 } }); await tunggu();
  assert.equal(W.ev('KERJA'), null);
  const batal = W.catat.api.pop();
  assert.deepEqual(batal.body, { aksi: 'batal', shift: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
  /* ganti akun: tidak dijalankan, batal TIDAK dikirim dengan sesi akun baru */
  const W2 = buatDunia();
  await muatDompet(W2, DATA());
  W2.ev("kerjaMulai('kafe')");
  const m2 = W2.catat.api.pop();
  W2.ev("DOMPET.untuk = 'p:budi'");
  m2.jawab({ status: 200, data: { shift: 'ffffffff-ffff-4fff-8fff-fffffffffff0', pekerjaan: 'kafe', pesanan: 6, minDetik: 150 } }); await tunggu();
  assert.equal(W2.ev('KERJA'), null);
  assert.equal(W2.catat.api.length, 0);
});

test('dompet tidak terbuka di bawah layar hasil shift: hasil ditutup dulu (kecuali gaji belum tercatat)', async () => {
  const W = buatDunia();
  await muatDompet(W, DATA());
  W.ev("kerjaJalankan('kafe', '11111111-1111-4111-8111-111111111111')");
  W.ev("kerjaTampilHasil({ gaji: 7000, tip: 0, saldo: 27000, hasil: { benar: 6, salah: 0, cepat: 0.5 } })");
  W.ev("dompetBuka('riwayat')");
  assert.equal(W.ev('KERJA'), null, 'layar hasil ditutup sebelum dompet dibuka');
  W.ev("kerjaJalankan('kafe', '22222222-2222-4222-8222-222222222222')");
  W.ev("kerjaTampilHasil({ galat: 'x', ulang: true })");
  W.ev("dompetBuka('riwayat')");
  assert.ok(W.ev('KERJA !== null'), 'Coba lagi tidak hilang diam-diam');
  assert.ok(W.catat.toast.some((t) => /Coba lagi/.test(t)));
});

test('siklus laundry kiloan dihentikan: LED + layar mesin kembali diam (dulu membeku "0:07")', () => {
  const W = buatDunia();
  W.ev('washWM.active = true; washWM.t = 7; washWM.kiloan = 1; wmLed.visible = false');
  W.ev('laundryBersihkan()');
  assert.equal(W.ev('washWM.active'), false);
  assert.equal(W.ev('wmLed.visible'), true);
  assert.deepEqual(W.catat.layar, [['wm', '0:30', '#3f7f88']], 'hanya mesin yang dipakai shift');
});

test('barista pemain lain berdiri di lantai teras menurut posisi (juga di layar hasil, field kerja sudah tidak dikirim)', () => {
  const W = buatDunia();
  const e = (tx, tz, kerja) => ({ pose: 'stand', realm: 'jalan', tx, tz, aks: { kerja }, group: { position: { y: 0 } } });
  const barista = e(3.15, 8.5, null), penjaga = e(-4.5, 8.4, 'warung'), jalan = e(3.15, 5.0, null);
  [barista, penjaga, jalan].forEach((x) => W.ev('kerjaAngkatRemote')(x));
  assert.equal(barista.group.position.y, 0.12);
  assert.equal(penjaga.group.position.y, 0, 'warung: lantai biasa');
  assert.equal(jalan.group.position.y, 0);
});

test('lensa kerja memakai ukuran kanvas (aspect kamera tidak ditimpa ukuran jendela)', () => {
  const f = fungsi('kerjaLensaTick');
  assert.match(f, /renderer\.getSize\(kerjaLensaUkuran\)/);
  assert.match(f, /camera\.setViewOffset\(W, H, L\.x, L\.y, W, H\)/);
  assert.match(f, /camera\.clearViewOffset\(\); camera\.aspect = W \/ H; camera\.updateProjectionMatrix\(\);/);
  assert.doesNotMatch(f, /innerWidth|innerHeight/);
});

test('17 Nov Alam Kerja: kerjaBersihkan mengembalikan alam lihat ke alam utama (tanpa ini myRealmLihat basi)', () => {
  const W = buatDunia();
  W.ev("myRealmLihat = 'kerja-warung-pabc123';");
  W.ev('kerjaBersihkan();');
  assert.equal(W.ev('myRealmLihat'), 'jalan');
});
