'use strict';
/* Kerja di Kota — aturan murni server. JANGAN diedit di sini: blok di bawah dirakit dari alat/frag/kk-murni.js dan
   harus SAMA PERSIS dengan blok KERJA-KOTA di index.html (tests/kerja-kota.test.js). */
/* ==== KERJA-KOTA-START ==== */
/* Kerja di Kota (27 Nov) — aturan MURNI tiga pekerjaan Kota: Barista Kafe Bulan, Resepsionis Hotel Kencana,
   Pramuniaga Maison Luna. Teks blok ini SAMA PERSIS di server (api/_lib/kerjakota.js) dan klien (index.html);
   tests/kerja-kota.test.js memastikan keduanya identik. Tanpa DOM, tanpa jaringan, tanpa jam.
   Cara kerja: server memberi BENIH per shift (turunan rahasia server + id shift). Dari benih itu soal dibangkitkan
   (klien menampilkan, server membangkitkan ULANG), klien mengirim JAWABAN mentah tiap pesanan + lama mengerjakannya,
   dan server sendiri yang menilai benar / salah / cepat lalu menghitung upah. Klien tidak pernah mengirim angka nilai. */
var KK_PEKERJAAN = {
  barista: { nama: 'Barista Kafe Bulan', tempat: 'Kafe Bulan, Kota', ruang: 'kafe', pangkat: ['Barista Magang', 'Barista Kota', 'Kepala Barista'],
    gaji: [10500, 13500, 16500], tipMaks: 6000, pesanan: 10, minDetik: 70 },
  resepsionis: { nama: 'Resepsionis Hotel Kencana', tempat: 'Hotel Kencana, Kota', ruang: 'hotel', pangkat: ['Resepsionis Magang', 'Resepsionis', 'Kepala Resepsionis'],
    gaji: [10500, 13500, 16500], tipMaks: 6000, pesanan: 10, minDetik: 70 },
  pramuniaga: { nama: 'Pramuniaga Maison Luna', tempat: 'Butik Maison Luna, Kota', ruang: 'butik', pangkat: ['Pramuniaga Magang', 'Pramuniaga', 'Penata Gaya'],
    gaji: [10500, 13500, 16500], tipMaks: 6000, pesanan: 10, minDetik: 70 }
};
var KK_IDS = Object.keys(KK_PEKERJAAN);
var KK_PANGKAT_SHIFT = [0, 5, 15]; /* sama dengan pekerjaan kampung */
var KK_SABAR_MS = [15000, 13500, 12000]; /* kesabaran tamu per pangkat: lewat dari ini pesanan hangus */
var KK_JEDA_MS = 1300; /* jeda antar tamu */
var KK_UPAH = { dasar: 0.25, pangkatMutu: 1.6, potongSalah: 0.05, potongMaks: 0.3, tipMutuMin: 0.6, tipSalahMaks: 4, tipPotong: 0.15, tipDasar: 0.2 };

/* ---- Barista: racik lapis demi lapis (bawah ke atas) lalu hentikan jarum takaran di zona hijau ---- */
var KK_BAHAN = [ /* huruf = kode jawaban */
  { k: 'e', nama: 'Espresso', warna: '#5a3520' }, { k: 's', nama: 'Susu', warna: '#f6efe2' }, { k: 'i', nama: 'Es batu', warna: '#bfe6f5' },
  { k: 'c', nama: 'Cokelat', warna: '#7b4a2d' }, { k: 'm', nama: 'Matcha', warna: '#8fbf5a' }, { k: 'b', nama: 'Busa susu', warna: '#fffaf0' }
];
var KK_MENU = [
  { nama: 'Es Kopi Susu', resep: 'ies' }, { nama: 'Latte', resep: 'esb' }, { nama: 'Mocha', resep: 'cesb' }, { nama: 'Matcha Latte', resep: 'msb' },
  { nama: 'Es Matcha', resep: 'ims' }, { nama: 'Es Cokelat', resep: 'ics' }, { nama: 'Dirty Matcha', resep: 'imse' }, { nama: 'Cappuccino', resep: 'ebc' }
];
var KK_TAKARAN = { setengah: [0.115, 0.095, 0.08], periodeMs: [1700, 1500, 1350] }; /* setengah lebar zona hijau + lama satu ayunan jarum, per pangkat */

/* ---- Resepsionis: cari kamar yang cocok (tipe + lantai + kosong) lalu pilih total tagihan yang benar ---- */
var KK_KAMAR_TIPE = [{ k: 'S', nama: 'Standar', tarif: 300 }, { k: 'D', nama: 'Deluxe', tarif: 450 }, { k: 'U', nama: 'Suite', tarif: 700 }]; /* tarif ribu rupiah per malam */
var KK_KAMAR_STATUS = ['kosong', 'terisi', 'dibersihkan'];

/* ---- Pramuniaga: hafalkan padanan tamu (4 barang berwarna) sebelum kartunya ditutup, lalu ambil dari rak ---- */
var KK_GAYA_JENIS = ['Atasan', 'Bawahan', 'Tas', 'Sepatu'];
var KK_GAYA_WARNA = [{ nama: 'Merah', hex: '#d8434f' }, { nama: 'Biru', hex: '#3f6fd8' }, { nama: 'Hijau', hex: '#3d9a63' }, { nama: 'Emas', hex: '#e2b13c' }, { nama: 'Hitam', hex: '#26262c' }, { nama: 'Putih', hex: '#f5f1e8' }];
var KK_GAYA_TAMPIL_MS = [3200, 2800, 2400];

/* waktu "cekatan" (tip kecepatan penuh) + waktu paling cepat yang masih manusiawi, per pekerjaan */
function kkCepatMs(id, pangkat) { return id === 'pramuniaga' ? KK_GAYA_TAMPIL_MS[pangkat] + 3600 : (id === 'resepsionis' ? 5200 : 5600); }
function kkMinMs(id, pangkat) { return id === 'pramuniaga' ? KK_GAYA_TAMPIL_MS[pangkat] + 900 : 1500; }

function kkPangkat(total) { var n = Number(total) || 0; return n >= KK_PANGKAT_SHIFT[2] ? 2 : (n >= KK_PANGKAT_SHIFT[1] ? 1 : 0); }
function kkPekerjaan(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(KK_PEKERJAAN, id) ? KK_PEKERJAAN[id] : null; }
function kkAcak(benih) { /* mulberry32: deret sama di server + klien */
  var s = (Number(benih) >>> 0) || 1;
  return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function kkPilih(u, n) { return Math.min(n - 1, Math.floor(u() * n)); }
function kkKocok(u, a) { for (var i = a.length - 1; i > 0; i--) { var j = kkPilih(u, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function kkSoalBarista(u, pangkat, lalu) {
  var m = kkPilih(u, KK_MENU.length);
  if (lalu && lalu.menu === m) m = (m + 1 + kkPilih(u, KK_MENU.length - 1)) % KK_MENU.length; /* tidak dua kali berturut */
  var resep = KK_MENU[m].resep, dobel = resep.indexOf('e') !== -1 && u() < 0.35; /* "dobel espresso": espresso dituang dua kali */
  if (dobel) resep = resep.replace('e', 'ee');
  return { menu: m, nama: KK_MENU[m].nama, dobel: dobel, resep: resep, zona: 0.2 + u() * 0.6, setengah: KK_TAKARAN.setengah[pangkat], periodeMs: KK_TAKARAN.periodeMs[pangkat], fase: u() };
}
function kkSoalResepsionis(u) {
  var kamar = [], l, n, i;
  for (l = 1; l <= 3; l++) for (n = 1; n <= 4; n++) kamar.push({ no: l * 100 + n, lantai: l, tipe: KK_KAMAR_TIPE[kkPilih(u, 3)].k, status: KK_KAMAR_STATUS[u() < 0.5 ? 0 : (u() < 0.6 ? 1 : 2)] });
  var t = kkPilih(u, 12), T = kamar[t]; T.status = 'kosong';
  for (i = 0; i < 12; i++) if (i !== t && kamar[i].tipe === T.tipe && kamar[i].lantai === T.lantai && kamar[i].status === 'kosong') kamar[i].status = u() < 0.5 ? 'terisi' : 'dibersihkan';
  /* pengecoh wajib: satu kamar tipe sama + kosong di lantai LAIN, satu kamar lantai sama + kosong tipe LAIN */
  var lain = [], se = [];
  for (i = 0; i < 12; i++) if (i !== t) { if (kamar[i].lantai !== T.lantai) lain.push(i); else se.push(i); }
  var a = kamar[lain[kkPilih(u, lain.length)]]; a.tipe = T.tipe; a.status = 'kosong';
  var b = kamar[se[kkPilih(u, se.length)]], tipeLain = KK_KAMAR_TIPE[(kkTipeIdx(T.tipe) + 1 + kkPilih(u, 2)) % 3].k; b.tipe = tipeLain; b.status = 'kosong';
  var malam = 2 + kkPilih(u, 3), tarif = KK_KAMAR_TIPE[kkTipeIdx(T.tipe)].tarif, benar = tarif * malam;
  var salah1 = KK_KAMAR_TIPE[kkTipeIdx(tipeLain)].tarif * malam, salah2 = tarif * (malam + (u() < 0.5 ? 1 : -1));
  if (salah2 === salah1 || salah2 === benar) salah2 = benar + 150;
  var harga = kkKocok(u, [benar, salah1, salah2]);
  return { kamar: kamar, tipe: T.tipe, lantai: T.lantai, malam: malam, harga: harga, no: T.no, total: benar };
}
function kkTipeIdx(k) { return k === 'S' ? 0 : (k === 'D' ? 1 : 2); }
function kkSoalPramuniaga(u, pangkat) {
  var g = '';
  for (var i = 0; i < KK_GAYA_JENIS.length; i++) g += String(kkPilih(u, KK_GAYA_WARNA.length));
  return { gaya: g, tampilMs: KK_GAYA_TAMPIL_MS[pangkat] };
}
/* semua soal satu shift (deterministik dari benih + pangkat) */
function kkSoal(id, benih, pangkat) {
  var p = kkPekerjaan(id); if (!p) return null;
  var pk = pangkat === 1 || pangkat === 2 ? pangkat : 0, u = kkAcak(benih), daftar = [], lalu = null;
  for (var i = 0; i < p.pesanan; i++) {
    lalu = id === 'barista' ? kkSoalBarista(u, pk, lalu) : (id === 'resepsionis' ? kkSoalResepsionis(u) : kkSoalPramuniaga(u, pk));
    daftar.push(lalu);
  }
  return daftar;
}
/* nilai satu jawaban: 1 = sempurna, 0.5 = setengah (urutan benar tapi takaran meleset / kamar benar tagihan salah / 3 dari 4 barang), 0 = salah */
function kkNilaiSatu(id, soal, jawab) {
  if (typeof jawab !== 'string' || jawab.length > 24) return 0;
  var bagian = jawab.split('|');
  if (id === 'barista') {
    if (bagian.length !== 2 || bagian[0] !== soal.resep || !/^\d{1,4}$/.test(bagian[1])) return 0;
    return Math.abs(Number(bagian[1]) / 1000 - soal.zona) <= soal.setengah + 1e-9 ? 1 : 0.5;
  }
  if (id === 'resepsionis') {
    if (bagian.length !== 2 || bagian[0] !== String(soal.no)) return 0;
    return bagian[1] === String(soal.total) ? 1 : 0.5;
  }
  if (bagian.length !== 1 || jawab.length !== soal.gaya.length) return 0;
  var cocok = 0; for (var i = 0; i < jawab.length; i++) if (jawab.charAt(i) === soal.gaya.charAt(i)) cocok++;
  return cocok === soal.gaya.length ? 1 : (cocok === soal.gaya.length - 1 ? 0.5 : 0);
}
/* nilai satu shift. jawab = larik sepanjang pesanan: [jawaban, ms] atau null (tamu tidak dilayani).
   detik = lama shift menurut JAM SERVER. Laporan yang mustahil (mengaku mengerjakan lebih lama dari umur shift) = tidak sah. */
function kkNilai(id, benih, pangkat, jawab, detik) {
  var p = kkPekerjaan(id), pk = pangkat === 1 || pangkat === 2 ? pangkat : 0, soal = kkSoal(id, benih, pk);
  var h = { sempurna: 0, setengah: 0, salah: 0, lewat: 0, mutu: 0, cepat: 0, sah: true };
  if (!p) return h;
  var a = Array.isArray(jawab) ? jawab : [], sabar = KK_SABAR_MS[pk], cepatMs = kkCepatMs(id, pk), minMs = kkMinMs(id, pk), jumlahMs = 0, q = 0, c = 0;
  for (var i = 0; i < p.pesanan; i++) {
    var e = a[i], ms = Array.isArray(e) && typeof e[1] === 'number' && isFinite(e[1]) ? Math.floor(e[1]) : -1;
    if (!Array.isArray(e) || ms < 0 || ms > sabar) { h.lewat++; jumlahMs += sabar; continue; } /* tidak dilayani / kehabisan sabar */
    jumlahMs += ms;
    var n = ms < minMs ? 0 : kkNilaiSatu(id, soal[i], e[0]); /* lebih cepat dari gerak manusia = tidak dihitung */
    if (n === 1) h.sempurna++; else if (n === 0.5) h.setengah++; else h.salah++;
    q += n;
    if (n > 0) c += n * Math.max(0, Math.min(1, (sabar - ms) / (sabar - cepatMs)));
  }
  if (typeof detik === 'number' && isFinite(detik) && jumlahMs > (detik + 4) * 1000) { h.sah = false; h.sempurna = 0; h.setengah = 0; h.salah = p.pesanan - h.lewat; q = 0; c = 0; }
  h.mutu = q / p.pesanan; h.cepat = c / p.pesanan;
  return h;
}
function kkKe500(v) { return Math.max(0, Math.floor(v / 500 + 1e-9) * 500); }
/* upah: gaji pokok pangkat x (dasar + sisanya x mutu^1,6) dipotong 5% per kesalahan (maks 30%);
   tip hanya kalau mutu >= 60% dan salah < 4: tipMaks x mutu x (1 - 15% per salah) x (20% + 80% x kecepatan) */
function kkUpah(id, shiftTotal, nilai) {
  var p = kkPekerjaan(id); if (!p) return null;
  var pangkat = kkPangkat(shiftTotal), U = KK_UPAH, n = nilai || { mutu: 0, cepat: 0, salah: 0 };
  var mutu = Math.max(0, Math.min(1, Number(n.mutu) || 0)), cepat = Math.max(0, Math.min(1, Number(n.cepat) || 0)), salah = Math.max(0, Math.floor(Number(n.salah) || 0));
  var gaji = kkKe500(p.gaji[pangkat] * (U.dasar + (1 - U.dasar) * Math.pow(mutu, U.pangkatMutu)) * (1 - Math.min(U.potongMaks, salah * U.potongSalah)));
  var tip = mutu >= U.tipMutuMin && salah < U.tipSalahMaks ? kkKe500(p.tipMaks * mutu * Math.max(0, 1 - salah * U.tipPotong) * (U.tipDasar + (1 - U.tipDasar) * cepat)) : 0;
  return { gaji: gaji, tip: tip, total: gaji + tip, pangkat: pangkat };
}
/* ==== KERJA-KOTA-END ==== */
module.exports = { KK_PEKERJAAN, KK_IDS, KK_PANGKAT_SHIFT, KK_SABAR_MS, KK_JEDA_MS, KK_UPAH, KK_BAHAN, KK_MENU, KK_TAKARAN, KK_KAMAR_TIPE, KK_KAMAR_STATUS, KK_GAYA_JENIS, KK_GAYA_WARNA, KK_GAYA_TAMPIL_MS,
  kkCepatMs, kkMinMs, kkPangkat, kkPekerjaan, kkAcak, kkSoal, kkNilaiSatu, kkNilai, kkUpah, kkKe500 };
