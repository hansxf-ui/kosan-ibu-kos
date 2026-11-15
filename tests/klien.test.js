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
const PESAN_GABUNG = 'Nama ini belum terdaftar — dan kosan juga sudah penuh (40 kamar terisi semua). Coba cek ejaan namamu, atau masuk sebagai tamu.';
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

const PESAN_PENUH = 'Kosan sudah penuh (40 kamar terisi semua). Tunggu episode berikutnya ya!'; /* Gedung C & D: 20 -> 40 kamar */
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
  assert.ok(!src.includes('(20 kamar terisi semua)'), 'Gedung C & D: tidak ada lagi angka 20 kamar');
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

test('Tahap 1 Tugas 0: realm dapur dikenal; realm asing tetap jadi yard', () => {
  const kenal = ambilFungsi('mpRealmDikenal');
  assert.equal(kenal('dapur'), 'dapur');
  assert.equal(kenal('living'), 'living');
  assert.equal(kenal('room-20'), 'room-20');
  assert.equal(kenal('room-40'), 'room-40'); /* Gedung C & D: K21-K40 */
  for (const r of ['room-41', 'room-0', 'Dapur', '__proto__', '', null, 7]) assert.equal(kenal(r), 'yard', String(r));
});

test('Tahap 1 Tugas 0: sceneUntukRealm menaruh pemain dapur di dapurScene', () => {
  const awal = HTML.indexOf('function sceneUntukRealm(');
  const kode = HTML.slice(awal, HTML.indexOf('\n}\n', awal) + 3);
  const f = new Function('scene', 'livingScene', 'dapurScene', 'roomScene', kode + '\nreturn sceneUntukRealm;')('Y', 'L', 'D', 'R');
  assert.equal(f('dapur'), 'D'); assert.equal(f('living'), 'L'); assert.equal(f('room-3'), 'R'); assert.equal(f('yard'), 'Y');
});

/* Tahap 1 — poseJangkar: harness kecil untuk tidur/duduk/bangun di kasur
   (perilaku kasur tidak boleh berubah) + label saat duduk. */
function harnessPose() {
  const nama = ['jangkarPose', 'terapkanPoseKamar', 'tidurDiKasur', 'dudukDiKasur', 'bangunDariKasur'];
  const ambil = (n) => { const a = HTML.indexOf('function ' + n + '('); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
  const kons = ['POSE_SLEEP', 'POSE_SIT', 'WAKE_SPOT'].map((k) => { const a = HTML.indexOf('var ' + k + ' = '); return HTML.slice(a, HTML.indexOf(';', a) + 1); }).join('\n');
  const rot = () => ({ rotation: { x: 0, y: 0 } });
  const env = {
    myRealm: 'room-3', misi: [], pos: 0, toast: [], wake: { style: { display: 'none' } },
    avatarPos: { x: 0, z: 0 }, avatar: { position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { x: 0, y: 0 } },
    avLegL: rot(), avLegR: rot(), avArmL: rot(), avArmR: rot(), avTubuh: rot(), avatarLabel: { sprite: { visible: true } }
  };
  const f = new Function('env', 'with (env) {\n' + kons + '\nvar roomPose = null, poseJangkar = null, poseDiGazebo = false;\n'
    + 'function misiSelesai(i) { env.misi.push(i); } function mpKirimPos() { env.pos++; } function closeCard() {}\n'
    + 'function toastKosan(m) { env.toast.push(m); } var document = { getElementById: function () { return env.wake; } };\n'
    + nama.map(ambil).join('\n')
    + '\nreturn { tidur: tidurDiKasur, duduk: dudukDiKasur, bangun: bangunDariKasur, terapkan: terapkanPoseKamar, pose: function () { return roomPose; }, jangkar: function () { return poseJangkar; }, set: function (j, r) { poseJangkar = j; roomPose = r; }, POSE_SIT: POSE_SIT, POSE_SLEEP: POSE_SLEEP, WAKE_SPOT: WAKE_SPOT, jangkarPose: jangkarPose }; }');
  return { env, h: f(env) };
}

test('Tahap 1 poseJangkar: duduk/tidur di kasur tetap di jangkar lama, bangun di WAKE_SPOT', () => {
  const { env, h } = harnessPose();
  h.duduk();
  assert.equal(h.pose(), 'sit');
  assert.deepEqual([env.avatarPos.x, env.avatarPos.z, env.avatar.position.y], [h.POSE_SIT.x, h.POSE_SIT.z, h.POSE_SIT.y]);
  assert.equal(env.avLegL.rotation.x, h.POSE_SIT.leg);
  assert.equal(env.avatarLabel.sprite.visible, true, 'label tampil saat duduk (keputusan Ryan)');
  h.bangun(true);
  assert.equal(h.pose(), null); assert.equal(h.jangkar(), null);
  assert.deepEqual([env.avatarPos.x, env.avatarPos.z], [h.WAKE_SPOT.x, h.WAKE_SPOT.z]);
  h.tidur();
  assert.equal(env.avatar.position.y, h.POSE_SLEEP.y);
  assert.equal(env.avatarLabel.sprite.visible, false, 'label sembunyi saat tidur');
  h.bangun(true);
  assert.equal(env.avatarLabel.sprite.visible, true);
  assert.deepEqual(env.misi, ['duduk', 'tidur']);
});

test('Tahap 1 poseJangkar: jangkar lain (kursi) dipakai terapkanPoseKamar + titik bangunnya sendiri', () => {
  const { env, h } = harnessPose();
  h.set(h.jangkarPose({ x: 11.6, z: 5.3, y: -0.31, rotX: 0, rotY: 0, leg: -0.92 }, { x: 11.6, z: 4.6, rotY: Math.PI }), 'sit');
  h.terapkan();
  assert.deepEqual([env.avatarPos.x, env.avatarPos.z], [11.6, 5.3]);
  h.bangun(true);
  assert.deepEqual([env.avatarPos.x, env.avatarPos.z, env.avatar.rotation.y], [11.6, 4.6, Math.PI]);
});

test('Tahap 1: pemain lain yang duduk tetap berlabel, yang tidur tidak', () => {
  const a = HTML.indexOf('function mpTerapkanPoseRemote(');
  const kode = HTML.slice(a, HTML.indexOf('\n}\n', a) + 3);
  const f = new Function('walkT', kode + '\nreturn mpTerapkanPoseRemote;')(0);
  const r = () => ({ rotation: { x: 0, y: 0 } });
  const entri = (pose) => ({ pose, gerak: 0, walkPhase: 0, group: { position: { y: 0 }, rotation: { x: 0 } },
    parts: { legL: r(), legR: r(), armL: r(), armR: r(), tubuh: r() }, label: { sprite: { visible: true } } });
  const duduk = entri('sit'); f(duduk); assert.equal(duduk.label.sprite.visible, true);
  const tidur = entri('sleep'); f(tidur); assert.equal(tidur.label.sprite.visible, false);
});

function blokMurni(awal, akhir, ekspor) {
  const a = HTML.indexOf('/* ==== ' + awal + ' ==== */'), b = HTML.indexOf('/* ==== ' + akhir + ' ==== */');
  assert.ok(a > 0 && b > a, awal + ' tidak ditemukan');
  return new Function(HTML.slice(a, b) + '\nreturn {' + ekspor.join(',') + '};')();
}
const GZ = () => blokMurni('GAZEBO-START', 'GAZEBO-END', ['GAZEBO_BANGKU', 'GAZEBO_JARAK', 'jarakKeKotak', 'gazeboKursiTerisi', 'gazeboPilihKursi']);

test('Tahap 1 gazebo: jarakKeKotak (di dalam 0, samping, sudut)', () => {
  const { jarakKeKotak } = GZ();
  const k = { minX: 0, maxX: 2, minZ: 0, maxZ: 1 };
  assert.equal(jarakKeKotak(1, 0.5, k), 0);
  assert.equal(jarakKeKotak(5, 0.5, k), 3);
  assert.equal(jarakKeKotak(-3, 5, k), 5); /* 3-4-5 dari sudut (0,1) */
});

test('Tahap 1 gazebo: 4 bangku x 2 kursi, kursi + titik bangun cocok dengan PLAZA_SOLIDS', () => {
  const { GAZEBO_BANGKU, gazeboPilihKursi, jarakKeKotak } = GZ();
  const a = HTML.indexOf('var PLAZA_SOLIDS = ['), solids = new Function('return ' + HTML.slice(a + 'var PLAZA_SOLIDS = '.length, HTML.indexOf('];', a) + 1))();
  assert.deepEqual(Object.keys(GAZEBO_BANGKU), ['utara', 'selatan', 'timur', 'barat']);
  for (const [nama, b] of Object.entries(GAZEBO_BANGKU)) {
    assert.ok(solids.some((s) => s.minX === b.kotak.minX && s.maxX === b.kotak.maxX && s.minZ === b.kotak.minZ && s.maxZ === b.kotak.maxZ), nama + ': kotak = AABB bangku');
    assert.equal(b.kursi.length, 2);
    for (const k of b.kursi) {
      assert.equal(jarakKeKotak(k.x, k.z, b.kotak), 0, nama + ': kursi di atas jok');
      const j = gazeboPilihKursi(nama, k.x, k.z, []);
      assert.deepEqual([j.x, j.z, j.y, j.leg], [k.x, k.z, -0.31, -0.92]);
      /* titik bangun: di dek gazebo (x 8,5..15,5, z 3,5..9,5) dan > 0,3 m dari semua benda padat */
      assert.ok(j.bangun.x > 8.5 && j.bangun.x < 15.5 && j.bangun.z > 3.5 && j.bangun.z < 9.5, nama + ': bangun di dek');
      for (const s of solids) assert.ok(jarakKeKotak(j.bangun.x, j.bangun.z, s) > 0.3, nama + ': bangun bebas ' + JSON.stringify(s));
    }
  }
});

test('Tahap 1 gazebo: kursi terdekat, lewati yang terisi, penuh -> null, bangku asing -> null', () => {
  const { gazeboPilihKursi } = GZ();
  assert.equal(gazeboPilihKursi('utara', 12.6, 4.5, []).x, 12.4);
  assert.equal(gazeboPilihKursi('utara', 11.0, 4.5, []).x, 11.6);
  assert.equal(gazeboPilihKursi('utara', 12.6, 4.5, [{ x: 12.4, z: 5.45 }]).x, 11.6, 'kursi dekat terisi -> kursi lain');
  assert.equal(gazeboPilihKursi('utara', 12.6, 4.5, [{ x: 12.4, z: 5.45 }, { x: 11.7, z: 5.4 }]), null, 'dua-duanya terisi');
  assert.equal(gazeboPilihKursi('utara', 12.6, 4.5, [{ x: 12.4, z: 6.5 }]).x, 12.4, 'pemain 1 m jauhnya tidak menghalangi');
  for (const n of ['__proto__', 'constructor', 'toString', 'tengah']) assert.equal(gazeboPilihKursi(n, 12, 6, []), null, n);
  assert.equal(gazeboPilihKursi('timur', 14, 6, []).rotY, -Math.PI / 2);
});

test('Tahap 1 gazebo: bangku bisa diketuk + pindah alam bangun dulu', () => {
  assert.match(HTML, /if \(ud\.interact === 'bangku'\) \{ showGazeboCard\(ud\.bangku\); return; \}/);
  for (const f of ['enterLiving', 'enterDapur']) {
    const a = HTML.indexOf('function ' + f + '('), blok = HTML.slice(a, HTML.indexOf('\n}\n', a));
    assert.ok(blok.indexOf('if (roomPose) bangunDariKasur(true);') < blok.indexOf('savedYard ='), f + ': bangun sebelum savedYard');
  }
});

const JM = () => blokMurni('JEMURAN-START', 'JEMURAN-END', ['JEMUR_DUR', 'JEMURAN_JARAK', 'JEMURAN_KOTAK', 'jemuranMuat', 'jemuranStatus', 'jemuranSisaDetik', 'jemuranTransisi', 'jemuranTeksSisa']);

test('Tahap 1 jemuran: keputusan Ryan (3 menit, 3 m)', () => {
  const j = JM();
  assert.equal(j.JEMUR_DUR, 180000);
  assert.equal(j.JEMURAN_JARAK, 3);
});

test('Tahap 1 jemuran: jemuranMuat aman untuk data rusak / asing / jam mundur', () => {
  const { jemuranMuat } = JM();
  const now = 1_800_000_000_000;
  for (const raw of [null, '', '{', 'null', '7', '"dijemur"', '{"status":"kering"}', '{"status":"__proto__"}',
    '{"status":"dijemur"}', '{"status":"dijemur","sejak":"1"}', '{"status":"dijemur","sejak":-5}', '{"status":"dijemur","sejak":1e999}']) {
    assert.deepEqual(jemuranMuat(raw, now), { status: 'kosong', sejak: 0 }, String(raw));
  }
  assert.deepEqual(jemuranMuat('{"status":"basah","sejak":123}', now), { status: 'basah', sejak: 0 });
  assert.deepEqual(jemuranMuat('{"status":"dijemur","sejak":' + (now - 5000) + '}', now), { status: 'dijemur', sejak: now - 5000 });
  assert.deepEqual(jemuranMuat('{"status":"dijemur","sejak":' + (now + 999999) + '}', now), { status: 'dijemur', sejak: now }, 'masa depan dipotong');
});

test('Tahap 1 jemuran: status + sisa waktu, batas tepat JEMUR_DUR', () => {
  const { jemuranStatus, jemuranSisaDetik, JEMUR_DUR } = JM();
  const st = { status: 'dijemur', sejak: 1000 };
  assert.equal(jemuranStatus(st, 1000 + JEMUR_DUR - 1, JEMUR_DUR), 'dijemur');
  assert.equal(jemuranStatus(st, 1000 + JEMUR_DUR, JEMUR_DUR), 'kering');
  assert.equal(jemuranSisaDetik(st, 1000, JEMUR_DUR), 180);
  assert.equal(jemuranSisaDetik(st, 1000 + JEMUR_DUR - 1, JEMUR_DUR), 1);
  assert.equal(jemuranSisaDetik(st, 1000 + JEMUR_DUR + 50, JEMUR_DUR), 0);
  assert.equal(jemuranStatus({ status: 'basah', sejak: 0 }, 5, JEMUR_DUR), 'basah');
  assert.equal(jemuranStatus(null, 5, JEMUR_DUR), 'kosong');
});

test('Tahap 1 jemuran: transisi sah dan tidak sah', () => {
  const { jemuranTransisi, JEMUR_DUR } = JM();
  const kosong = { status: 'kosong', sejak: 0 }, basah = { status: 'basah', sejak: 0 };
  const dijemur = { status: 'dijemur', sejak: 1000 };
  assert.deepEqual(jemuranTransisi(kosong, 'cuci_selesai', 5, JEMUR_DUR), basah);
  assert.deepEqual(jemuranTransisi(basah, 'jemur', 777, JEMUR_DUR), { status: 'dijemur', sejak: 777 });
  assert.equal(jemuranTransisi(dijemur, 'angkat', 1000 + JEMUR_DUR - 1, JEMUR_DUR), null, 'belum kering');
  assert.deepEqual(jemuranTransisi(dijemur, 'angkat', 1000 + JEMUR_DUR, JEMUR_DUR), kosong);
  /* tidak sah */
  assert.equal(jemuranTransisi(basah, 'cuci_selesai', 5, JEMUR_DUR), null);
  assert.equal(jemuranTransisi(dijemur, 'cuci_selesai', 1000 + JEMUR_DUR, JEMUR_DUR), null, 'kering di tali: belum boleh cuci lagi');
  assert.equal(jemuranTransisi(kosong, 'jemur', 5, JEMUR_DUR), null);
  assert.equal(jemuranTransisi(dijemur, 'jemur', 5, JEMUR_DUR), null);
  assert.equal(jemuranTransisi(kosong, 'angkat', 5, JEMUR_DUR), null);
  assert.equal(jemuranTransisi(kosong, 'hapus', 5, JEMUR_DUR), null);
});

test('Tahap 1 jemuran: teks sisa waktu', () => {
  const { jemuranTeksSisa } = JM();
  assert.equal(jemuranTeksSisa(180), 'kira-kira 3 menit lagi');
  assert.equal(jemuranTeksSisa(61), 'kira-kira 2 menit lagi');
  assert.equal(jemuranTeksSisa(60), 'kurang dari 1 menit lagi');
});

test('Tahap 1 jemuran: kabel ke mesin cuci, ketuk, dan cucian baru tanpa AABB', () => {
  assert.match(HTML, /if \(ud\.interact === 'jemuran'\) \{ showJemuranCard\(\); return; \}/);
  const a = HTML.indexOf('function finishWash('), fw = HTML.slice(a, HTML.indexOf('\n}\n', a));
  assert.match(fw, /which === 'wm' && jemuranAksi\('cuci_selesai'\)/);
  const b = HTML.indexOf('function startWash('), sw = HTML.slice(b, HTML.indexOf('\n}\n', b));
  assert.ok(sw.indexOf("jemuranStatusSekarang()") < sw.indexOf('st.active = true'), 'cek jemuran sebelum mesin jalan');
  assert.equal((HTML.match(/jemuranCucian = \[/g) || []).length, 1);
  assert.ok(!/var jemuranCucian\s*=/.test(HTML), 'deklarasi tanpa inisialisasi (jangan menimpa isi buildWorld)');
});

const IB = () => blokMurni('IBU-START', 'IBU-END', ['IBU_SAPAAN', 'IBU_OBROLAN', 'ibuWaktu', 'ibuPilihKalimat', 'ibuUrutan', 'ibuObrolanBerikut']);

test('Tahap 1 Ibu Kos: isi kalimat = yang disetujui Ryan (4 sapaan, 11 kalimat, nomor 12 dicoret)', () => {
  const { IBU_SAPAAN, IBU_OBROLAN } = IB();
  assert.deepEqual(Object.keys(IBU_SAPAAN), ['pagi', 'siang', 'sore', 'malam']);
  assert.equal(IBU_OBROLAN.length, 11);
  assert.ok(!HTML.includes('acara kumpul-kumpul'), 'kalimat ke-12 tidak boleh ada');
});

test('Tahap 1 Ibu Kos: sapaan per jam WIB (batas 04/10/15/18)', () => {
  const { ibuWaktu } = IB();
  const wib = (jam, menit) => new Date(Date.UTC(2026, 10, 14, jam - 7, menit || 0)); /* jam WIB -> Date */
  assert.equal(ibuWaktu(wib(3, 59)), 'malam');
  assert.equal(ibuWaktu(wib(4)), 'pagi');
  assert.equal(ibuWaktu(wib(9, 59)), 'pagi');
  assert.equal(ibuWaktu(wib(10)), 'siang');
  assert.equal(ibuWaktu(wib(15)), 'sore');
  assert.equal(ibuWaktu(wib(18)), 'malam');
  assert.equal(ibuWaktu(wib(23, 30)), 'malam');
});

test('Tahap 1 Ibu Kos: prioritas kalimat pembuka (kering > tamu > misi > sapaan)', () => {
  const { ibuPilihKalimat, IBU_SAPAAN } = IB();
  const dasar = { cucianKering: false, tamu: false, misiSisa: 0, waktu: 'sore' };
  assert.match(ibuPilihKalimat({ ...dasar, cucianKering: true, tamu: true, misiSisa: 3 }), /Cucianmu udah kering/);
  assert.match(ibuPilihKalimat({ ...dasar, tamu: true, misiSisa: 3 }), /Mau jadi penghuni/);
  assert.equal(ibuPilihKalimat({ ...dasar, misiSisa: 3 }), 'Misi hari ini masih ada 3 lagi, semangat!');
  assert.equal(ibuPilihKalimat(dasar), IBU_SAPAAN.sore);
  assert.equal(ibuPilihKalimat({ ...dasar, waktu: '__proto__' }), IBU_SAPAAN.siang);
});

test('Tahap 1 Ibu Kos: urutan acak per hari, tetap sepanjang hari, tidak berulang dalam satu putaran', () => {
  const { ibuUrutan, ibuObrolanBerikut, IBU_OBROLAN } = IB();
  const a = ibuUrutan('2026-11-14', 11), b = ibuUrutan('2026-11-14', 11), c = ibuUrutan('2026-11-15', 11);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort((x, y) => x - y), [...Array(11).keys()]);
  let simpan = null; const dilihat = new Set();
  for (let k = 0; k < 11; k++) { const r = ibuObrolanBerikut(simpan, '2026-11-14'); dilihat.add(r.teks); simpan = r.simpan; }
  assert.equal(dilihat.size, 11, '11 kali Ngobrol lagi = 11 kalimat berbeda');
  assert.equal(ibuObrolanBerikut(simpan, '2026-11-14').teks, IBU_OBROLAN[a[0]], 'putaran berikutnya mulai lagi');
  assert.deepEqual(ibuObrolanBerikut({ tanggal: '2026-11-13', i: 5 }, '2026-11-14').simpan, { tanggal: '2026-11-14', i: 1 }, 'hari baru -> mulai dari awal');
  for (const rusak of [null, 7, { tanggal: '2026-11-14', i: -3 }, { tanggal: '2026-11-14', i: 'x' }, { tanggal: '2026-11-14', i: Infinity }]) {
    assert.equal(ibuObrolanBerikut(rusak, '2026-11-14').teks, IBU_OBROLAN[a[0]], JSON.stringify(rusak));
  }
});

test('Tahap 1 misi: 10 misi Tahap 1 tetap di urutan awal (Tahap 3a menambah 3 di belakang), 3 baru tercentang sekali per hari, state lama tetap terbaca', () => {
  const m = blokMurni('MISI-START', 'MISI-END', ['MISI_LIST', 'misiStateBaru', 'misiSelesaiDiState', 'misiHitungSelesai']);
  assert.deepEqual(m.MISI_LIST.map((x) => x.id).slice(0, 10), ['kamar', 'tidur', 'duduk', 'lampu', 'living', 'jalan', 'sendal', 'gazebo', 'jemur', 'ibu']);
  assert.deepEqual(m.MISI_LIST.map((x) => x.id).slice(10), ['warung', 'kucing', 'ronda']); /* Tahap 3a — Jalan Kampung (tests/jalan.test.js) */
  const st = { done: { kamar: true, sendal: true }, jalan: 12 }; /* state lama (7 misi) */
  assert.equal(m.misiHitungSelesai(st), 2);
  for (const id of ['gazebo', 'jemur', 'ibu']) {
    assert.equal(m.misiSelesaiDiState(st, id), true, id + ' baru');
    assert.equal(m.misiSelesaiDiState(st, id), false, id + ' tidak dobel');
  }
  assert.equal(m.misiHitungSelesai(st), 5);
  assert.equal(m.misiSelesaiDiState(st, '__proto__'), false);
  for (const ikon of ['baju', 'obrol', 'chair']) assert.ok(HTML.includes('  ' + ikon + ": '<"), 'ikon ' + ikon);
});

test('Tahap 1 misi: hook gazebo / jemur / ibu terpasang di aksinya', () => {
  const blok = (f) => { const a = HTML.indexOf('function ' + f + '('); return HTML.slice(a, HTML.indexOf('\n}\n', a)); };
  assert.match(blok('gazeboDuduk'), /misiSelesai\('gazebo'\)/);
  assert.match(blok('jemuranAngkat'), /misiSelesai\('jemur'\)/);
  assert.match(blok('showIbuCard'), /misiSelesai\('ibu'\)/);
});
