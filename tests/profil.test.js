'use strict';
/* Tes unit kartu profil (18 Nov — ketuk avatar pemain): isi hanya dari data
   yang klien punya (presence + daftar penghuni) + gaya SENGAJA BEDA dari
   KTA/room card (koreksi Ryan 19:08). Jalankan:
   node --test tests/profil.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + '\nreturn { profilDataUntuk, gedungDariKamar, petaLabelLokasi, fotoUrlSah };')();
const OCC = [
  { room: 10, name: 'rina' }, { room: 32, name: 'lutviupikk' },
  { room: 41, name: 'tes ef e' }, { room: 51, name: 'tes ef f' }
];

test('Profil: penghuni dikenali dari daftar (nama -> kamar + gedung)', () => {
  const d = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(d.nama, 'lutviupikk');
  assert.equal(d.kamar, 32); assert.equal(d.gedung, 'D');
  assert.equal(d.gender, 'Cowok'); assert.equal(d.realm, 'yard');
  assert.equal(d.kerja, null); assert.equal(d.saya, false);
  const e = F.profilDataUntuk({ nama: 'tes ef e', gender: 'Cewek', realm: 'jalan', aks: { kerja: null } }, OCC);
  assert.equal(e.kamar, 41); assert.equal(e.gedung, 'E');
  const f = F.profilDataUntuk({ nama: 'tes ef f', gender: 'Cowok', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(f.kamar, 51); assert.equal(f.gedung, 'F');
  const r = F.profilDataUntuk({ nama: 'rina', gender: 'Cewek', realm: 'room-10', aks: { kerja: null } }, OCC);
  assert.equal(r.kamar, 10); assert.equal(r.gedung, 'A');
});

test('Profil: nama tidak peduli huruf besar + @ depan (normalize)', () => {
  const d = F.profilDataUntuk({ nama: 'LutviUpikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(d.kamar, 32);
  const e = F.profilDataUntuk({ nama: '@lutviupikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(e.kamar, 32);
});

test('Profil: tamu (tidak terdaftar) -> kamar 0, bukan karangan', () => {
  const d = F.profilDataUntuk({ nama: 'tamu-7', gender: 'Cewek', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(d.kamar, 0); assert.equal(d.gedung, null);
  assert.equal(d.nama, 'tamu-7');
});

test('Profil: sedang kerja -> id pekerjaan ikut; kalau tidak kerja -> null', () => {
  const d = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'kerja-kafe-xyz', aks: { kerja: 'kafe' } }, OCC);
  assert.equal(d.kerja, 'kafe');
  assert.equal(F.petaLabelLokasi(d.realm), 'Kedai Kopi — sedang kerja');
  const e = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard', aks: {} }, OCC);
  assert.equal(e.kerja, null);
  const g = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard' }, OCC);
  assert.equal(g.kerja, null, 'tanpa aks = tidak kerja');
});

test('Profil: foto — URL sah lolos, sisanya fallback inisial (18 Nov)', () => {
  assert.equal(F.fotoUrlSah('https://lpuvkrbdctankydvmzpy.supabase.co/storage/v1/object/public/foto-profil/32?v=1'), true);
  assert.equal(F.fotoUrlSah('http://x.test/f.jpg'), false, 'http ditolak');
  assert.equal(F.fotoUrlSah('https://x.test/foto dengan spasi.jpg'), false, 'spasi ditolak');
  assert.equal(F.fotoUrlSah(''), false);
  assert.equal(F.fotoUrlSah(null), false);
  assert.equal(F.fotoUrlSah('https://x.test/' + 'a'.repeat(300)), false, 'lebih dari 300 karakter ditolak');
  const d = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null }, foto: 'https://foto.test/foto-profil/32' }, OCC);
  assert.equal(d.foto, 'https://foto.test/foto-profil/32', 'foto pemain lain ikut');
  const e = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null }, foto: 'javascript:alert(1)' }, OCC);
  assert.equal(e.foto, null, 'URL jahat -> fallback inisial');
  const g = F.profilDataUntuk({ nama: 'lutviupikk', gender: 'Cowok', realm: 'yard', aks: { kerja: null } }, OCC);
  assert.equal(g.foto, null, 'tanpa foto -> null (inisial)');
});

test('Profil: tamu TIDAK BISA pasang foto — guard di fotoUnggah + reset saat masuk tamu (Ryan 22:28)', () => {
  const iF = HTML.indexOf('function fotoUnggah');
  const blokFoto = HTML.slice(iF, HTML.indexOf('function profilBuka', iF));
  assert.ok(blokFoto.includes('if (!ktaIsResident())'), 'fotoUnggah menolak tamu sebelum menyentuh server');
  assert.ok(blokFoto.includes('Hanya penghuni yang bisa pasang foto profil.'), 'pesan penolakan tamu');
  const iM = HTML.indexOf('function masukSebagai');
  const blokMasuk = HTML.slice(iM, HTML.indexOf('function masukTamu', iM));
  assert.ok(blokMasuk.includes('fotoSaya = null'), 'masuk tamu membersihkan foto basi');
  assert.ok(blokMasuk.includes("localStorage.removeItem('kosan3d-foto')"), 'localStorage foto ikut dibersihkan saat masuk tamu');
});

test('Profil: tombol Pasang/Ganti foto hanya di kartu sendiri + img bundar (18 Nov)', () => {
  const iO = HTML.indexOf('id="profilOverlay"'), iK = HTML.indexOf('id="ktaOverlay"');
  const blok = HTML.slice(iO, iK);
  assert.ok(blok.includes('id="profilFoto"'), 'img foto di avatar');
  assert.ok(blok.includes('id="profilFotoBtn"'), 'tombol foto');
  assert.ok(blok.includes('id="profilFileInput"'), 'input file tersembunyi');
  assert.ok(blok.includes('accept="image/jpeg,image/png,image/webp"'), 'accept JPEG/PNG/WebP');
  assert.ok(HTML.includes('var bisa = !!data.saya && data.kamar > 0;'), 'tombol hanya kartu sendiri + penghuni');
  assert.ok(HTML.includes("fbt.textContent = (data.foto && fotoUrlSah(data.foto)) ? 'Ganti foto' : 'Pasang foto';"), 'teks tombol Pasang/Ganti');
  assert.ok(HTML.includes('#profilAvatar.punya-foto #profilFoto { display: block; }'), 'foto menggantikan inisial');
  assert.ok(HTML.includes("img.onerror = function () { if (av) av.classList.remove('punya-foto'); };"), 'URL mati -> fallback inisial');
  assert.ok(HTML.includes('foto: fotoSaya, saya: true'), 'kartu sendiri membawa fotoSaya');
  assert.ok(HTML.includes('if (file.size > 500 * 1024)'), 'validasi ukuran 500 KB di klien');
  assert.ok(HTML.includes("if (fotoSaya) msg.foto = fotoSaya;"), 'foto ikut presence');
});

test('Profil: gaya SENGAJA BEDA dari KTA/room card (pita gradien + avatar menumpang + pil)', () => {
  const iO = HTML.indexOf('id="profilOverlay"'), iK = HTML.indexOf('id="ktaOverlay"');
  assert.ok(iO > 0 && iK > iO, 'overlay profil ada sebelum KTA');
  const blok = HTML.slice(iO, iK);
  assert.ok(blok.includes('class="profil-head"'), 'pita header');
  assert.ok(blok.includes('class="profil-avatar'), 'avatar bulat');
  assert.ok(blok.includes('class="profil-pill"'), 'pil kamar');
  assert.ok(blok.includes('id="profilNama"') && blok.includes('id="profilBaris"'), 'nama + baris');
  assert.ok(!blok.includes('kta-'), 'tidak pakai kelas kta apa pun');
  assert.ok(!blok.includes('cardHead') && !blok.includes('cardBody'), 'tidak pakai struktur room card');
  assert.ok(HTML.includes('.profil-head { height: 86px; background: linear-gradient(135deg, #1B5FA8 0%, #1f8f6b 100%); }'), 'pita gradien biru->hijau');
  assert.ok(HTML.includes('.profil-avatar { width: 84px; height: 84px; margin: -42px auto 0;'), 'avatar 84px menumpang pita (-42px)');
  assert.ok(HTML.includes('#profilCard { position: relative; width: 100%; max-width: 340px;'), 'lebar kartu 340 (KTA 420)');
});

test('Profil: wiring ketuk avatar + tutup', () => {
  assert.ok(HTML.includes('var kenaPemain = ketukPemain();'), 'canvasTap cek pemain dulu');
  assert.ok(HTML.includes('if (kenaPemain) { profilBukaUntuk(kenaPemain); return; }'), 'kena pemain -> kartu profil');
  assert.ok(HTML.includes('raycaster.intersectObjects(grup, true)'), 'raycast rekursif grup pemain');
  assert.ok(HTML.includes("profilCloseEl.addEventListener('click'"), 'tombol tutup');
  assert.ok(HTML.includes("profilOverlayEl.addEventListener('click'"), 'ketuk luar menutup');
  assert.ok(HTML.includes("profilO && profilO.classList.contains('open')"), 'tombol back menutup kartu profil');
});
