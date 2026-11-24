'use strict';
/* Pengaturan (24 Nov): tombol di menu, tiga tingkat grafik, simpan/baca per perangkat, BAGUS = nilai lama persis.
   Fungsi murni diambil VERBATIM dari index.html (blok PENGATURAN). Jalankan: node --test tests/pengaturan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const P = new Function(antara('/* ==== PENGATURAN-START ==== */', '/* ==== PENGATURAN-END ==== */')
  + '\nreturn { PGT_KUNCI, PGT_URUT, PGT_TINGKAT, pgtBaca, pgtTeks, pgtWargaPilih };')();

test('Pengaturan: tombol ada di menu ☰ (ikon SVG senada), Musik + Efek suara pindah ke panel dengan id lama', () => {
  const menu = antara('<div id="menuDrop">', '<button id="exitBtn"');
  assert.match(menu, /<button id="pgtBtn" class="pillbtn" type="button"[^>]*><svg class="uicon"[\s\S]*?<\/svg> Pengaturan<\/button>/);
  assert.ok(!menu.includes('musikBtn') && !menu.includes('efekBtn'), 'menu tidak dobel');
  const panel = antara('<div id="pgtPanel"', '<div id="rupaPanel"');
  for (const k of ['id="pgtClose"', 'id="pgtJudul"', 'id="musikBtn"', 'id="musikStatus"', 'id="efekBtn"', 'id="efekStatus"', 'id="pgtNamaBtn"', 'id="pgtNamaStatus"', 'id="pgtSelesai"', 'id="pgtMuatUlang"'])
    assert.equal(panel.split(k).length, 2, k);
  assert.equal(HTML.split('id="musikBtn"').length, 2, 'musikBtn tetap satu');
  assert.ok(!/<img|https?:\/\//.test(panel), 'tanpa sumber luar');
  assert.ok(/#pgtPanel \{[^}]*display: none/.test(HTML) && /#pgtPanel\.open \{ display: block/.test(HTML), 'tertutup = tidak ada di layar');
});

test('Pengaturan: tiga tingkat grafik, urut Ringan / Sedang / Bagus', () => {
  const panel = antara('<div id="pgtPanel"', '<div id="rupaPanel"');
  const t = [...panel.matchAll(/data-grafik="(\w+)"[^>]*>[\s\S]*?<b>(\w+)<\/b>/g)].map((m) => m[1] + ':' + m[2]);
  assert.deepEqual(t, ['ringan:Ringan', 'sedang:Sedang', 'bagus:Bagus']);
  assert.deepEqual(P.PGT_URUT, ['ringan', 'sedang', 'bagus']);
  assert.deepEqual(Object.keys(P.PGT_TINGKAT).sort(), ['bagus', 'ringan', 'sedang']);
  const R = P.PGT_TINGKAT.ringan, S = P.PGT_TINGKAT.sedang, B = P.PGT_TINGKAT.bagus;
  assert.ok(R.pr < S.pr && S.pr < B.pr, 'pixel ratio menurun');
  assert.ok(R.ledMs > S.ledMs && S.ledMs > B.ledMs, 'LED makin jarang');
  assert.equal(R.bayangKota, false); assert.equal(R.aa, false); assert.equal(R.warga, 'separuh');
});

test('Pengaturan: BAGUS = nilai lama persis (pixel ratio 1,5, penghalus tepi, bayangan Kota, LED 90 ms, semua warga)', () => {
  assert.deepEqual({ pr: P.PGT_TINGKAT.bagus.pr, aa: P.PGT_TINGKAT.bagus.aa, b: P.PGT_TINGKAT.bagus.bayangKota, led: P.PGT_TINGKAT.bagus.ledMs, w: P.PGT_TINGKAT.bagus.warga },
    { pr: 1.5, aa: true, b: true, led: 90, w: 'semua' });
  assert.equal(P.pgtWargaPilih([{ jenis: 'jalan' }, { jenis: 'duduk' }], 'semua'), null, 'tanpa saringan warga');
  assert.ok(HTML.includes('var KOSAN_PIXEL_RATIO_MAX = 1.5;\nKOSAN_PIXEL_RATIO_MAX = PGT_TINGKAT[PGT.grafik].pr;'));
  assert.ok(HTML.includes('new THREE.WebGLRenderer({ antialias: PGT_AA })') && HTML.includes('var PGT_AA = PGT_TINGKAT[PGT.grafik].aa;'));
  assert.ok(HTML.includes('var KOTA_LED_SELANG = PGT_TINGKAT[PGT.grafik].ledMs;') && HTML.includes('if (now - kotaLedTerakhir > selang)') && P.PGT_TINGKAT.ringan.ledMs >= 10000 /* Ringan: LED nyaris diam, bukan sentakan berkala */);
  assert.ok(HTML.includes('sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);'), 'bayangan Kota bawaan tetap nyala');
  const k = fungsi('pgtTerapkanKota');
  assert.match(k, /if \(kotaMatahari && kotaMatahari\.castShadow !== T\.bayangKota\)/);
  assert.match(k, /if \(!pilih\) \{\s*if \(g\.userData\.pgtAsli && g\.index !== g\.userData\.pgtAsli\) g\.setIndex\(g\.userData\.pgtAsli\);/, 'semua warga = indeks asli');
  assert.match(fungsi('pgtTerapkan'), /if \(KOSAN_PIXEL_RATIO_MAX !== T\.pr\) \{ KOSAN_PIXEL_RATIO_MAX = T\.pr; kosanResize\(\); \}/);
});

test('Pengaturan: simpan + baca localStorage (pulang-pergi), simpanan rusak tidak merusak', () => {
  assert.equal(P.PGT_KUNCI, 'kosan3d-pengaturan');
  for (const g of P.PGT_URUT) for (const nama of [true, false]) {
    const s = P.pgtBaca(P.pgtTeks({ grafik: g, nama }), { mem: 8, inti: 8, sisi: 800 });
    assert.deepEqual(s, { grafik: g, nama });
  }
  for (const rusak of ['', null, undefined, '{', '[]', '42', '{"grafik":"ultra"}', '{"grafik":5}']) {
    const s = P.pgtBaca(rusak, { mem: 8, inti: 8, sisi: 800 });
    assert.equal(s.grafik, 'bagus', String(rusak)); assert.equal(s.nama, true);
  }
  assert.equal(JSON.parse(P.pgtTeks({ grafik: 'aneh', nama: true })).grafik, 'bagus');
  assert.match(fungsi('pgtSimpan'), /localStorage\.setItem\(PGT_KUNCI, pgtTeks\(PGT\)\)/);
  assert.ok(HTML.includes('teks = localStorage.getItem(PGT_KUNCI);'));
  assert.match(HTML, /localStorage\.setItem\('kosan3d-suara'/, 'musik tetap disimpan logika lama');
});

test('Pengaturan: tanpa tebak otomatis — belum pernah memilih selalu mulai dari Bagus, apa pun perangkatnya', () => {
  assert.ok(!HTML.includes('pgtTebak'), 'tebakan perangkat dicabut');
  assert.ok(!HTML.includes('deviceMemory') && !HTML.includes('Dipilih otomatis'));
  assert.equal(P.pgtBaca(null).grafik, 'bagus');
  assert.equal(P.pgtBaca(null, { mem: 2, inti: 4, sisi: 360 }).grafik, 'bagus', 'HP kecil pun tetap Bagus');
  assert.equal(P.PGT_TINGKAT.bagus.pr, 1.5); assert.equal(P.PGT_TINGKAT.bagus.aa, true);
});

test('Pengaturan: Ringan menyaring warga Kota — yang duduk + jaga tetap, pejalan selang-seling, ngobrol lima orang', () => {
  const d = [];
  for (let i = 0; i < 17; i++) d.push({ jenis: 'jalan' });
  for (let i = 0; i < 11; i++) d.push({ jenis: 'duduk' });
  for (let i = 0; i < 10; i++) d.push({ jenis: 'ngobrol' });
  d.push({ jenis: 'jaga' }, { jenis: 'jaga' });
  const p = P.pgtWargaPilih(d, 'separuh');
  assert.equal(p.length, 40);
  const n = (j) => d.filter((w, i) => w.jenis === j && p[i]).length;
  assert.deepEqual([n('jalan'), n('duduk'), n('ngobrol'), n('jaga')], [9, 11, 5, 2]);
  assert.match(fungsi('kotaNpcTick'), /if \(KOTA_NPC_PILIH && !KOTA_NPC_PILIH\[i\]\) continue;/, 'warga tersaring tidak dipose');
});

test('Pengaturan: nama pemain — bahan label ikut pilihan (terpisah dari .visible pose tidur), panel tidak bocor ke kamera', () => {
  assert.match(fungsi('makeLabel'), /spr\.material\.visible = PGT\.nama;/);
  const t = fungsi('pgtTerapkan');
  assert.match(t, /avatarLabel\.sprite\.material\.visible = tampil/);
  assert.match(t, /re\.label\.sprite\.material\.visible = tampil/);
  assert.ok(HTML.includes("document.getElementById('pgtNamaBtn').addEventListener('click', function () { PGT.nama = !PGT.nama; pgtSimpan(); pgtTerapkan(); pgtRender(); });"));
  assert.match(HTML, /\['pointerdown', 'touchstart', 'mousedown', 'wheel'\]\.forEach\(function \(n\) \{ pgtPanel\.addEventListener\(n, function \(e\) \{ e\.stopPropagation\(\); \}/);
});

test('Pengaturan: batas tidak dilanggar — fetch tetap 4, tanpa input password', () => {
  assert.equal(HTML.split('fetch(').length - 1, 4);
  assert.equal(HTML.split('type="password"').length - 1, 0);
});
