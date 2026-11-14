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

/* ---------- perbaikan 9b (Ryan 14 Nov 15:37): pesan gabungan kosan penuh ---------- */
const PESAN_GABUNG = 'Nama ini belum terdaftar — dan kosan juga sudah penuh (20 kamar terisi semua). Coba cek ejaan namamu, atau masuk sebagai tamu.';
/* jalankan masukKosan() ASLI dari index.html dengan dunia tiruan */
function jalankanMasukKosan({ nama, preview, loginView }) {
  const awal = HTML.indexOf('function masukKosan() {');
  const src = HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3);
  const jejak = { error: [], login: 0, daftar: 0 };
  const dunia = {
    entryName: { value: nama, focus() {} }, normalize: (n) => String(n).trim().replace(/^@+/, '').toLowerCase(),
    entryBusy: false, entered: false, visitorName: 'kamu', entryOverlay: { classList: { remove() {} } },
    OCCUPANTS_OK: true, toastKosan() {}, masukTamu() {}, previewFor: () => preview,
    entryShowError: (m) => jejak.error.push(m), entryLoginView: loginView,
    entryLogin: () => { jejak.login++; }, entryDaftar: () => { jejak.daftar++; },
    entryTahap: 'masuk', sesiPenghuni: null, layarPenuhSaatKetuk() {}, entrySetBusy() {},
    muatOccupants: () => Promise.resolve(), entryModeManual: false, entryNameTouched: false, entryDecideInitialMode() {}
  };
  const k = Object.keys(dunia);
  new Function(...k, src + '\nmasukKosan();')(...k.map((x) => dunia[x]));
  return jejak;
}

const PESAN_PENUH = 'Kosan sudah penuh (20 kamar terisi semua). Tunggu episode berikutnya ya!';
test('9c: preview null di mode MASUK -> pesan gabungan, entryLogin tidak jalan', () => {
  const j = jalankanMasukKosan({ nama: 'rinna', preview: null, loginView: true });
  assert.deepEqual(j.error, [PESAN_GABUNG]);
  assert.equal(j.login + j.daftar, 0);
});

test('9c: preview null di mode DAFTAR -> pesan penuh polos (tanpa "belum terdaftar"), entryDaftar tidak jalan', () => {
  const j = jalankanMasukKosan({ nama: 'sari', preview: null, loginView: false });
  assert.deepEqual(j.error, [PESAN_PENUH]);
  assert.ok(!j.error[0].includes('belum terdaftar'));
  assert.equal(j.login + j.daftar, 0);
  /* konsisten dengan pesan galat daftar dari server */
  const i = HTML.indexOf('function daftarPesan(');
  assert.ok(HTML.slice(i, HTML.indexOf('\n}\n', i)).includes(PESAN_PENUH));
});

test('9b: preview ada -> lanjut ke entryLogin/entryDaftar seperti biasa (tanpa pesan gabungan)', () => {
  const a = jalankanMasukKosan({ nama: 'rina', preview: { room: 3, resident: true }, loginView: true });
  assert.deepEqual(a.error, []); assert.equal(a.login, 1);
  const b = jalankanMasukKosan({ nama: 'sari', preview: { room: 5, resident: false }, loginView: false });
  assert.deepEqual(b.error, []); assert.equal(b.daftar, 1);
});

test('9b: string lama hilang dari masukKosan; pesan belum-terdaftar entryLogin + kartu showKosanPenuh tidak berubah', () => {
  const awal = HTML.indexOf('function masukKosan() {');
  const src = HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3);
  assert.ok(src.includes(PESAN_GABUNG) && src.includes(PESAN_PENUH));
  assert.ok(!src.includes("entryShowError('Kosan sudah penuh (20 kamar terisi semua).')"));
  assert.ok(HTML.includes("entryShowError('Nama ini belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu.')"));
  assert.match(HTML, /function showKosanPenuh\(/);
});

/* ---------- perbaikan 10 (tes produksi 14 Nov 16:02): tamu saat kosan penuh ---------- */
function ambilBlok(nama) {
  const awal = HTML.indexOf('function ' + nama + '(');
  assert.ok(awal > 0, nama);
  return HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3);
}
/* jalankan masukTamu -> masukSebagai -> setIdentity -> spawnAvatar ASLI dari
   index.html dengan dunia tiruan; previewFor bisa dibuat null (kosan penuh). */
function duniaTamu({ preview, online }) {
  const jejak = { label: [], kartuPenuh: 0, kartuKamar: 0 };
  const stub = {
    previewFor: () => preview, showKosanPenuh: () => { jejak.kartuPenuh++; }, showRoomCard: () => { jejak.kartuKamar++; },
    makeId: (n, r) => 'KOSAN-' + r + '-' + n, setLabel: (_l, t) => jejak.label.push(t), avatarLabel: {},
    usernameValid: () => true, entryShowError: (m) => { throw new Error('error: ' + m); },
    normalize: (n) => String(n).trim().replace(/^@+/, '').toLowerCase(),
    masukLayarPenuh() {}, ensurePlayerId() {}, camDistAwalHalaman: () => 9, pasangBackGuard() {},
    entryOverlay: { classList: { remove() {} } }, updateWhoami() {}, mpMulai() {}, mpKirimPresence() {}, mpKirimPos() {},
    OCCUPANTS: [{ room: 3, name: 'rina' }], remotePlayers: Object.assign(Object.create(null), online || {}), entryBusy: false,
    localStorage: { setItem() { throw new Error('nama tamu tidak boleh disimpan'); } }
  };
  const k = Object.keys(stub);
  const src = "var visitorName = 'kamu', visitorRoom = 0, visitorId = '', isResidentSession = false, entered = false, layarPenuhDariKetuk = false;\n"
    + "var myRealm = 'yard', camYaw = 0, camPitch = 0, camDist = 0;\n"
    + ['spawnAvatar', 'setIdentity', 'masukSebagai', 'tamuNama', 'tamuPilihNomor', 'tamuNamaTerpakai', 'masukTamu'].map(ambilBlok).join('')
    + '\nmasukTamu();\nreturn { visitorName: visitorName, visitorRoom: visitorRoom, visitorId: visitorId, entered: entered };';
  const hasil = new Function(...k, src)(...k.map((x) => stub[x]));
  return Object.assign(hasil, jejak);
}

test('10 (a): tamu saat kosan penuh (preview null) -> nama Tamu-1, label "Tamu-1 · tamu", visitorRoom 0, kartu penuh', () => {
  const h = duniaTamu({ preview: null });
  assert.equal(h.visitorName, 'Tamu-1');
  assert.equal(h.label[h.label.length - 1], 'Tamu-1 · tamu');
  assert.ok(!h.label.includes('kamu · tamu'));
  assert.equal(h.visitorRoom, 0); assert.equal(h.visitorId, '');
  assert.equal(h.kartuPenuh, 1); assert.equal(h.kartuKamar, 0);
  assert.equal(h.entered, true);
});

test('10 (a): tamu kedua saat penuh (Tamu-1 sudah online) -> Tamu-2', () => {
  const h = duniaTamu({ preview: null, online: { pa1111111: { nama: 'Tamu-1' } } });
  assert.equal(h.visitorName, 'Tamu-2');
  assert.equal(h.label[h.label.length - 1], 'Tamu-2 · tamu');
});

test('10 (a): saat ada kamar kosong perilaku tetap (preview ada -> visitorRoom terisi, kartu preview)', () => {
  const h = duniaTamu({ preview: { room: 5, resident: false } });
  assert.equal(h.visitorName, 'Tamu-1'); assert.equal(h.visitorRoom, 5); assert.equal(h.kartuKamar, 1); assert.equal(h.kartuPenuh, 0);
});

function klikHomeBtn(visitorRoom) {
  const awal = HTML.indexOf("document.getElementById('homeBtn').addEventListener('click', function () {");
  assert.ok(awal > 0);
  const badan = HTML.slice(HTML.indexOf('{', awal) + 1, HTML.indexOf('\n});', awal));
  const jejak = { masuk: [], toast: [] };
  new Function('visitorRoom', 'enterRoom', 'toastKosan', badan)(visitorRoom, (n) => jejak.masuk.push(n), (m) => jejak.toast.push(m));
  return jejak;
}

test('10 (b): KAMAR KAMU saat visitorRoom 0 -> toast, tanpa navigasi', () => {
  const j = klikHomeBtn(0);
  assert.deepEqual(j.masuk, []);
  assert.deepEqual(j.toast, ['Tamu tidak punya kamar — daftar dulu jadi penghuni ya!']);
});

test('10 (b): KAMAR KAMU penghuni (visitorRoom > 0) tetap masuk kamar, tanpa toast', () => {
  const j = klikHomeBtn(13);
  assert.deepEqual(j.masuk, [13]); assert.deepEqual(j.toast, []);
});

/* ---------- perbaikan 11 (audit cb21617) ---------- */
function blokFungsi(nama) {
  const awal = HTML.indexOf('function ' + nama + '(');
  assert.ok(awal > 0, nama);
  return HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3);
}
function jalankanDenganStub(stub, namaFungsi, prolog, epilog) {
  const k = Object.keys(stub);
  return new Function(...k, (prolog || '') + namaFungsi.map(blokFungsi).join('') + (epilog || ''))(...k.map((x) => stub[x]));
}

function duniaDaftar({ nama, terdaftar }) {
  const j = { error: [], keypad: 0 };
  jalankanDenganStub({
    entryName: { value: nama, focus() {} }, entryKey: { value: 'KOSAN', focus() {} },
    normalize: (n) => String(n).trim().replace(/^@+/, '').trim().toLowerCase(), usernameValid: () => true,
    entryIsRegistered: () => terdaftar, kunciKodeCek: () => true, entryShowError: (m) => j.error.push(m),
    entryBusy: false, pinBukaMode: () => { j.keypad++; }
  }, ['namaPolaTamu', 'entryDaftar'], '', '\nentryDaftar();');
  return j;
}
test('11 M3: mode DAFTAR, nama terdaftar (rina) -> langsung ditolak, keypad tidak dibuka', () => {
  const j = duniaDaftar({ nama: 'rina', terdaftar: true });
  assert.deepEqual(j.error, ['Username @rina sudah dipakai, pilih username lain ya.']);
  assert.equal(j.keypad, 0);
  assert.equal(duniaDaftar({ nama: 'sari', terdaftar: false }).keypad, 1);
});
test('11 M4: mode DAFTAR, tamu-3 -> diblokir klien sebelum keypad', () => {
  for (const n of ['tamu-3', 'Tamu-12', '@TAMU-1']) {
    const j = duniaDaftar({ nama: n, terdaftar: false });
    assert.deepEqual(j.error, ['Nama itu dipakai untuk tamu — pilih nama lain.'], n);
    assert.equal(j.keypad, 0);
  }
  assert.equal(duniaDaftar({ nama: 'tamuku', terdaftar: false }).keypad, 1);
});

test('11 M2: keypad ditutup saat "Memproses…" -> jawaban PIN benar diabaikan, tidak masuk kamar', async () => {
  let selesai;
  const j = { masuk: [], izin: null };
  const kelas = new Set(['open']);
  const api = jalankanDenganStub({
    pinOverlay: { classList: { contains: (c) => kelas.has(c), remove: (c) => kelas.delete(c), add: (c) => kelas.add(c) } },
    apiKosan: () => new Promise((r) => { selesai = r; }), enterRoom: (n) => j.masuk.push(n), pinTampilError() {},
    pinRender() {}, entered: true, batalLayarPenuhKetuk() {}
  }, ['pinMasihAktif', 'pinTutup', 'pinMulaiSibuk', 'pinSelesaiSibuk', 'pinKirimKamar'],
  "var pinMode = { jenis: 'kamar', room: 13 }, pinBusy = false, pinDigit = '135790', kamarIzin = null;\n",
  '\nreturn { kirim: function () { pinKirimKamar(pinDigit); }, tutup: pinTutup, busy: function () { return pinBusy; }, mode: function () { return pinMode; } };');
  api.kirim();
  assert.equal(api.busy(), true);
  api.tutup();
  assert.equal(api.busy(), false); assert.equal(api.mode(), null);
  selesai({ status: 200, data: { ok: true } });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(j.masuk, []);
});
test('11 M2: pinKirimMasuk dan daftar juga memeriksa keypad masih aktif sebelum memakai jawaban', () => {
  assert.match(blokFungsi('pinKirimMasuk'), /if \(!pinMasihAktif\(m\)\) return;/);
  assert.match(blokFungsi('entryDaftar'), /if \(!pinMasihAktif\(m\)\) return;/);
});

test('11 M5: login berhasil tapi daftar penghuni gagal dimuat -> pesan "Login berhasil…", tidak "gagal total"', async () => {
  const j = { error: [], masuk: 0, sesi: 0 };
  jalankanDenganStub({
    entryKosongkanRahasia() {}, setGender() {}, entryName: {}, entrySetBusy() {},
    muatOccupants: () => Promise.resolve(), entryShowError: (m) => j.error.push(m), entryTerapkanSesi: () => { j.sesi++; },
    masukSebagai: () => { j.masuk++; }, kunciKlaim: () => false, toastKosan() {}
  }, ['selesaiMasukPenghuni'], 'var sesiPenghuni = null, OCCUPANTS_OK = false;\n', "\nselesaiMasukPenghuni({ room: 3, name: 'rina', gender: 'cewek' });");
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(j.error, ['Login berhasil, tapi daftar kamar belum termuat — coba ketuk Masuk lagi.']);
  assert.equal(j.sesi, 1); assert.equal(j.masuk, 0);
});

test('11 P3: login nama di luar charset yang bukan penghuni -> pesan belum-terdaftar, keypad tidak dibuka', () => {
  const j = { error: [], keypad: 0 };
  jalankanDenganStub({
    entryTahap: 'masuk', sesiPenghuni: null, entryName: { value: 'rína😊', focus() {} },
    normalize: (n) => String(n).trim().toLowerCase(), entryBusy: false,
    entryIsRegistered: () => false, entryShowError: (m) => j.error.push(m), pinBukaMode: () => { j.keypad++; }
  }, ['entryLogin'], '', '\nentryLogin();');
  assert.deepEqual(j.error, ['Nama ini belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu.']);
  assert.equal(j.keypad, 0);
});

test('11 M6: frasa basi sudah hilang', () => {
  for (const f of ['cuma hash yang dikirim', 'nama terdaftar -> PIN saja -> kosan_login', 'keluar dulu untuk ganti', 'cuma HASH-nya (pinHash di bawah, dikirim']) {
    assert.ok(!HTML.includes(f), f);
  }
});
