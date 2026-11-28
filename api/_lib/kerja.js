'use strict';
/* Kerja & Belanja (Ryan 16 Nov: "orang-orang bisa bekerja, seperti di cafe dan lain-lain
   dan mendapatkan uang IDR, untuk mendapatkan uangnya jangan terlalu mudah ... uangnya bisa
   dipake untuk berbelanja"). Aturan MURNI server (tanpa jaringan, tanpa DB): pekerjaan, upah,
   pangkat, katalog belanja, uang kos, jam WIB. Klien punya salinan tampilan di blok
   KERJA-START index.html; tests/kerja-server.test.js memastikan keduanya sama.
   Server yang menentukan semua angka uang: klien hanya melaporkan hasil kerja
   (benar/salah/cepat), dijepit di sini, dan durasi shift dicek di database. */

/* gaji pokok per pangkat (Rp) + tip maksimal; pesanan = jumlah tugas per shift;
   minDetik = shift tidak bisa diselesaikan lebih cepat dari ini (dicek atomik di DB) */
const PEKERJAAN = {
  kafe: { nama: 'Barista Kafe', tempat: 'Kedai Kopi, Jalan Kampung', pangkat: ['Magang Barista', 'Barista', 'Barista Senior'],
    gaji: [7000, 9000, 11000], tipMaks: 4000, pesanan: 6, minDetik: 100 },
  warung: { nama: 'Penjaga Warung', tempat: 'Warung, Jalan Kampung', pangkat: ['Magang Warung', 'Penjaga Warung', 'Kepala Warung'],
    gaji: [6000, 8000, 10000], tipMaks: 3000, pesanan: 6, minDetik: 100 },
  ronda: { nama: 'Ronda Malam', tempat: 'Pos Ronda, Jalan Kampung (20.00–04.00 WIB)', pangkat: ['Hansip Magang', 'Hansip', 'Komandan Ronda'],
    gaji: [8000, 10000, 12000], tipMaks: 3000, pesanan: 4, minDetik: 100 },
  laundry: { nama: 'Laundry Kiloan', tempat: 'Dapur kos (mesin cuci + pengering)', pangkat: ['Magang Laundry', 'Tukang Cuci', 'Ahli Laundry'],
    gaji: [7000, 9000, 11000], tipMaks: 3000, pesanan: 3, minDetik: 100 }
};
const PANGKAT_SHIFT = [0, 5, 15]; /* shift selesai yang dibutuhkan untuk tiap pangkat (per pekerjaan) */
const BATAS_KERJA = { shiftHari: 3, jedaDetik: 10 * 60, maksDetik: 20 * 60 }; /* semua pekerjaan digabung */
const RONDA_JAM = { mulai: 20, selesai: 4 }; /* WIB */
const SEWA_HARGA = 100000; /* uang kos per bulan (WIB) — sukarela, hanya cap LUNAS di KTA */

/* jenis: kafe = habis pakai (boleh beli berulang), aksesori/dekor = sekali beli */
const KATALOG = {
  kopisusu: { nama: 'Es kopi susu gula aren', harga: 4000, jenis: 'kafe' },
  americano: { nama: 'Americano panas', harga: 3000, jenis: 'kafe' },
  tehtarik: { nama: 'Teh tarik', harga: 3500, jenis: 'kafe' },
  escokelat: { nama: 'Es cokelat', harga: 4000, jenis: 'kafe' },
  topi_baseball: { nama: 'Topi baseball', harga: 15000, jenis: 'aksesori', slot: 'topi' },
  topi_bucket: { nama: 'Topi bucket', harga: 18000, jenis: 'aksesori', slot: 'topi' },
  kacamata_hitam: { nama: 'Kacamata hitam', harga: 20000, jenis: 'aksesori', slot: 'kacamata' },
  kacamata_bulat: { nama: 'Kacamata bulat', harga: 20000, jenis: 'aksesori', slot: 'kacamata' },
  tas_ransel: { nama: 'Tas ransel', harga: 30000, jenis: 'aksesori', slot: 'tas' },
  tas_selempang: { nama: 'Tas selempang', harga: 25000, jenis: 'aksesori', slot: 'tas' },
  poster: { nama: 'Poster dinding', harga: 12000, jenis: 'dekor' },
  tanaman: { nama: 'Tanaman hias', harga: 20000, jenis: 'dekor' },
  karpet: { nama: 'Karpet bulu', harga: 35000, jenis: 'dekor' },
  lampu_tumblr: { nama: 'Lampu tumblr', harga: 25000, jenis: 'dekor' },
  /* Toko Perabot (24 Nov): 6 dekor kamar baru, dijual + dipajang di Toko Perabot Jalan Kampung */
  cermin: { nama: 'Cermin berdiri', harga: 30000, jenis: 'dekor' },
  akuarium: { nama: 'Akuarium kecil', harga: 45000, jenis: 'dekor' },
  bean_bag: { nama: 'Bean bag', harga: 50000, jenis: 'dekor' },
  rak_buku: { nama: 'Rak buku', harga: 60000, jenis: 'dekor' },
  meja_belajar: { nama: 'Meja belajar', harga: 80000, jenis: 'dekor' },
  meja_rias: { nama: 'Meja rias', harga: 100000, jenis: 'dekor' }
};
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const punya = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
function pekerjaanDari(id) { return punya(PEKERJAAN, id) ? PEKERJAAN[id] : null; }
/* ==== BUTIK-LUNA-START ==== */
/* Butik Maison Luna (28 Nov: "Gas, butik Maison Luna") — busana premium yang TIDAK ada di menu Tampilan gratis. Dibeli pakai Rupiah
   di butik Kota (server yang memotong saldo + mencatat kepemilikan di kosan_barang, lewat /api/belanja {aksi:'beli'}); bisa dicoba
   gratis selama di butik. Blok ini MURNI dan sama persis di index.html dan api/_lib/kerja.js (tests/butik-luna.test.js).
   Satu slot = satu barang. Indeks slot dikirim ke pemain lain sebagai field opsional bAtasan / bBawahan / bAlas / bTopi / bTas. */
var BUSANA = {
  luna_baret: { nama: 'Baret wol', harga: 30000, jenis: 'busana', slot: 'topi' },
  luna_loafers: { nama: 'Loafers kulit', harga: 45000, jenis: 'busana', slot: 'alas' },
  luna_kulot: { nama: 'Kulot', harga: 50000, jenis: 'busana', slot: 'bawahan' },
  luna_heels: { nama: 'Heels', harga: 55000, jenis: 'busana', slot: 'alas' },
  luna_batik: { nama: 'Kemeja batik', harga: 60000, jenis: 'busana', slot: 'atasan' },
  luna_rok: { nama: 'Rok panjang', harga: 65000, jenis: 'busana', slot: 'bawahan' },
  luna_cardigan: { nama: 'Cardigan rajut', harga: 70000, jenis: 'busana', slot: 'atasan' },
  luna_blazer: { nama: 'Blazer', harga: 90000, jenis: 'busana', slot: 'atasan' },
  luna_tas: { nama: 'Tas tangan', harga: 100000, jenis: 'busana', slot: 'tas' },
  luna_jaket: { nama: 'Jaket kulit', harga: 120000, jenis: 'busana', slot: 'atasan' }
};
var BUSANA_URUT = ['luna_baret', 'luna_loafers', 'luna_kulot', 'luna_heels', 'luna_batik', 'luna_rok', 'luna_cardigan', 'luna_blazer', 'luna_tas', 'luna_jaket'];
/* indeks yang dikirim ke pemain lain = urutan di sini (JANGAN diubah urutannya: klien lama + baru harus sepakat) */
var BUSANA_SLOT = { atasan: ['luna_blazer', 'luna_jaket', 'luna_batik', 'luna_cardigan'], bawahan: ['luna_kulot', 'luna_rok'], alas: ['luna_heels', 'luna_loafers'], topi: ['luna_baret'], tas: ['luna_tas'] };
var BUSANA_KUNCI = { atasan: 'bAtasan', bawahan: 'bBawahan', alas: 'bAlas', topi: 'bTopi', tas: 'bTas' };
function busanaDari(id) { return (typeof id === 'string' && Object.prototype.hasOwnProperty.call(BUSANA, id)) ? BUSANA[id] : null; }
function busanaIndeks(id) { var b = busanaDari(id); return b ? BUSANA_SLOT[b.slot].indexOf(id) : -1; }
function busanaBaca(m) { /* -> { bAtasan, bBawahan, bAlas, bTopi, bTas }: indeks sah, selain itu -1 */
  var o = {}, ada = m && typeof m === 'object';
  Object.keys(BUSANA_SLOT).forEach(function (s) { var k = BUSANA_KUNCI[s], v = ada ? m[k] : -1; o[k] = (typeof v === 'number' && Math.floor(v) === v && v >= 0 && v < BUSANA_SLOT[s].length) ? v : -1; });
  return o;
}
function busanaSusun(pilih, milik) { /* pilihan pakai { slot: id } + daftar milik [id] -> { bAtasan: indeks, ... } (hanya yang DIMILIKI) */
  var o = {}, p = (pilih && typeof pilih === 'object') ? pilih : {}, m = Array.isArray(milik) ? milik : [];
  Object.keys(BUSANA_SLOT).forEach(function (s) {
    var id = Object.prototype.hasOwnProperty.call(p, s) ? p[s] : null, b = busanaDari(id);
    if (b && b.slot === s && m.indexOf(id) >= 0) o[BUSANA_KUNCI[s]] = BUSANA_SLOT[s].indexOf(id);
  });
  return o;
}
/* ==== BUTIK-LUNA-END ==== */
function barangDari(id) { return punya(KATALOG, id) ? KATALOG[id] : busanaDari(id); } /* Butik Maison Luna: busana butik lewat endpoint belanja yang sama */
function pangkatDari(shiftTotal) {
  const n = Number.isInteger(shiftTotal) && shiftTotal > 0 ? shiftTotal : 0;
  return n >= PANGKAT_SHIFT[2] ? 2 : (n >= PANGKAT_SHIFT[1] ? 1 : 0);
}
const bulat = (v, lo, hi) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : lo);
const pecahan = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const ke500 = (v) => Math.max(0, Math.floor(v / 500) * 500);
/* upah satu shift: gaji pokok pangkat x (0,3 + 0,7 x tugas benar) + tip (benar, tanpa salah, cepat).
   hasil = { benar: 0..pesanan, salah: 0..99, cepat: 0..1 } dari klien, dijepit. */
function upahShift(id, shiftTotal, hasil) {
  const p = pekerjaanDari(id);
  if (!p) return null;
  const h = hasil && typeof hasil === 'object' ? hasil : {};
  const pangkat = pangkatDari(shiftTotal);
  const benar = bulat(h.benar, 0, p.pesanan), salah = bulat(h.salah, 0, 99), cepat = pecahan(h.cepat);
  const mutu = benar / p.pesanan;
  const gaji = ke500(p.gaji[pangkat] * (0.3 + 0.7 * mutu));
  const tip = ke500(p.tipMaks * mutu * Math.max(0, 1 - salah * 0.1) * (0.4 + 0.6 * cepat));
  return { gaji, tip, total: gaji + tip, pangkat, benar, salah };
}
/* jam + tanggal WIB (UTC+7, tanpa DST) — sama dengan suasanaJam / misiTanggal di klien */
const WIB = 7 * 3600 * 1000;
function jamWib(ms) { return (((ms + WIB) % 86400000) + 86400000) % 86400000 / 3600000; }
function tanggalWib(ms) { return new Date(ms + WIB).toISOString().slice(0, 10); }
function bulanWib(ms) { return tanggalWib(ms).slice(0, 7); }
function bulanLabel(bulan) { const m = /^(\d{4})-(\d{2})$/.exec(String(bulan)); return m ? BULAN[+m[2] - 1] + ' ' + m[1] : ''; }
function rondaBuka(ms) { const j = jamWib(ms); return j >= RONDA_JAM.mulai || j < RONDA_JAM.selesai; }

module.exports = { PEKERJAAN, PANGKAT_SHIFT, BATAS_KERJA, RONDA_JAM, SEWA_HARGA, KATALOG, BULAN, BUSANA, BUSANA_URUT, BUSANA_SLOT, BUSANA_KUNCI, busanaDari, busanaIndeks, busanaBaca, busanaSusun,
  pekerjaanDari, barangDari, pangkatDari, upahShift, jamWib, tanggalWib, bulanWib, bulanLabel, rondaBuka };
