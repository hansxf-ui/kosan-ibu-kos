'use strict';
/* Tes unit KLIEN (fungsi murni diambil verbatim dari index.html).
   Jalankan: node --test tests/klien.test.js
   Terpisah dari tests/server.test.js (tetap 43 tes). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function ambilFungsi(nama) {
  const awal = HTML.indexOf('function ' + nama + '(');
  assert.ok(awal > 0, nama + ' tidak ditemukan di index.html');
  const akhir = HTML.indexOf('\n}\n', awal) + 3;
  return new Function(HTML.slice(awal, akhir) + '\nreturn ' + nama + ';')();
}

test('14 Nov #1: ketuk pintu kamar sendiri (penghuni login) -> masuk, walau kamar terdaftar', () => {
  const aksi = ambilFungsi('aksiKetukPintu');
  const rina = { resident: true, sesiRoom: 10, visitorRoom: 10, visitorId: 'KOSAN-10-RINA', penghuniPintu: 'rina' };
  assert.equal(aksi(10, rina), 'masuk');
});

test('14 Nov #1: ketuk pintu kamar orang lain -> kartu (terdaftar maupun kosong)', () => {
  const aksi = ambilFungsi('aksiKetukPintu');
  const rina = { resident: true, sesiRoom: 10, visitorRoom: 10, visitorId: 'KOSAN-10-RINA' };
  assert.equal(aksi(11, Object.assign({ penghuniPintu: 'dilla' }, rina)), 'kartu');
  assert.equal(aksi(7, Object.assign({ penghuniPintu: null }, rina)), 'kartu');
});

test('14 Nov #1: tamu ketuk pintu kamar penghuni (nama sama di preview pun) -> kartu', () => {
  const aksi = ambilFungsi('aksiKetukPintu');
  /* tamu tanpa sesi: tidak ada sesiRoom; kamar preview-nya = kamar terdaftar orang */
  assert.equal(aksi(10, { resident: false, sesiRoom: 0, visitorRoom: 10, visitorId: 'KOSAN-10-BUDI', penghuniPintu: 'rina' }), 'kartu');
  /* sesi cookie ada tapi masuk sebagai tamu (resident false) -> tetap kartu */
  assert.equal(aksi(10, { resident: false, sesiRoom: 10, visitorRoom: 10, visitorId: 'KOSAN-10-RINA', penghuniPintu: 'rina' }), 'kartu');
});

test('14 Nov #1: perilaku lama dipertahankan — kamar preview yang BELUM terdaftar -> masuk (enterRoom yang menolak tamu)', () => {
  const aksi = ambilFungsi('aksiKetukPintu');
  assert.equal(aksi(5, { resident: false, sesiRoom: 0, visitorRoom: 5, visitorId: 'KOSAN-05-BUDI', penghuniPintu: null }), 'masuk');
  assert.equal(aksi(5, { resident: false, sesiRoom: 0, visitorRoom: 5, visitorId: '', penghuniPintu: null }), 'kartu');
});

test('14 Nov #1: handler ketuk pintu memakai aksiKetukPintu dengan sesi penghuni sah', () => {
  const i = HTML.indexOf("if (ud.card === 'room') {");
  const blok = HTML.slice(i, HTML.indexOf("} else if (ud.card === 'living')", i));
  assert.match(blok, /aksiKetukPintu\(ud\.room/);
  assert.match(blok, /resident: !!\(isResidentSession && sesiPenghuni\)/);
  assert.match(blok, /enterRoom\(ud\.room\)/);
});

test('14 Nov #3: dua catatan overlay masuk sudah hilang, tanpa sisa referensi JS', () => {
  assert.ok(!HTML.includes('Untuk mencegah akun ganda, kami mencatat perangkat'));
  assert.ok(!HTML.includes('Nama yang kamu ketik terlihat oleh semua pemain online'));
  assert.ok(!HTML.includes('entryNotePerangkat'));
});

test('perbaikan 9: tidak ada kolom password / sisa alur password di halaman', () => {
  assert.ok(!/type="password"/.test(HTML), 'masih ada input type=password');
  assert.ok(!/autocomplete="(current|new)-password"/.test(HTML));
  for (const id of ['entryPass', 'entryPass2', 'entryPin', 'entryPin2', 'entryLoginPertama', 'entryNotePenghuniLama']) {
    assert.ok(!HTML.includes('id="' + id + '"'), id + ' masih ada');
  }
  assert.ok(!/setup\/password|setup-password|pwnedpasswords|Buat password|Ulangi password/.test(HTML));
  assert.ok(!/sbRpc\('kosan_register'/.test(HTML), 'daftar harus lewat /api/daftar');
  for (const id of ['entryName', 'pinInput']) {
    assert.match(new RegExp('<input id="' + id + '"[^>]*>').exec(HTML)[0], /autocomplete="off"/, id);
  }
});

test('perbaikan 9: Tamu-N = N terkecil yang belum dipakai penghuni / pemain online', () => {
  const pilih = ambilFungsi('tamuPilihNomor');
  const nama = ambilFungsi('tamuNama');
  assert.equal(nama(pilih([])), 'Tamu-1');
  assert.equal(nama(pilih(['rina', 'Tamu-1'])), 'Tamu-2');
  assert.equal(nama(pilih(['tamu-1', 'TAMU-2', 'tamu-4'])), 'Tamu-3');
  /* penghuni yang kebetulan bernama tamu-1 -> tamu memakai Tamu-2 */
  assert.equal(nama(pilih(['@tamu-1'])), 'Tamu-2');
});

test('perbaikan 9: dua tamu dengan nama sama -> hanya yang id lebih besar pilih ulang', () => {
  const ganti = ambilFungsi('tamuHarusGanti');
  const pilih = ambilFungsi('tamuPilihNomor');
  const a = { id: 'pa1111111', nama: 'Tamu-1' }, b = { id: 'pb2222222', nama: 'Tamu-1' };
  assert.equal(ganti('Tamu-1', a.id, [b]), false);
  assert.equal(ganti('Tamu-1', b.id, [a]), true);
  /* simulasi dua sesi tamu: b pilih ulang -> Tamu-2, berbeda dari a */
  const namaB = 'Tamu-' + pilih([a.nama]);
  assert.equal(namaB, 'Tamu-2');
  assert.notEqual(namaB, a.nama);
  assert.equal(ganti(namaB, b.id, [a]), false);
});

test('perbaikan 9: penanda tamu hanya untuk pola Tamu-N', () => {
  const pola = ambilFungsi('namaPolaTamu');
  assert.equal(pola('Tamu-12'), true);
  assert.equal(pola('tamu-3'), true);
  assert.equal(pola('Tamu'), false);
  assert.equal(pola('rina'), false);
  assert.match(HTML, /visitorName \+ ' · tamu'/);
});

test('perbaikan 9: tombol tamu tidak membaca kolom nama', () => {
  const i = HTML.indexOf('function masukTamu() {');
  const blok = HTML.slice(i, HTML.indexOf('\n}\n', i));
  assert.ok(!/entryName/.test(blok), blok);
  assert.match(blok, /tamuPilihNomor\(tamuNamaTerpakai\(\)\)/);
});
