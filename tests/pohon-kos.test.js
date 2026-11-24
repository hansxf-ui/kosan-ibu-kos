'use strict';
/* Pohon area kos bergaya pohon Kota (Ryan 24 Nov): tekstur daun + batang Kota, posisi / ukuran / kotak padat tetap,
   tajuk tidak pernah keluar dari amplop pohon lama, 2 mesh per alam, cemara Komplek Tetangga tidak disentuh. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const BLOK = antara('/* ==== POHON-KOS-START ==== */', '/* ==== POHON-KOS-END ==== */');
const P = new Function(fungsi('acak') + BLOK + '\nreturn { KOS_POHON_GAYA, KOS_POHON_BENJOL, KOS_POHON_HIJAU, kosPohonLama, kosPohonRancang };')();
const HALAMAN = [[6.5, 13], [23.5, 13], [-17, 13], [17.5, 9], [-17, -11.5]].map(([x, z]) => ({ jenis: 'bulat', x, z, s: 1, alam: 'halaman' }));
const TAMAN = [[-38.5, -6], [-23.5, -10]].map(([x, z]) => ({ jenis: 'pipih', x, z, alam: 'halaman' }));
const JALAN = [{ jenis: 'bulat', x: 10, z: 10.9, s: 0.85, alam: 'jalan', latar: true }, { jenis: 'bulat', x: -20.5, z: -23.25, s: 1, alam: 'jalan' }, { jenis: 'bulat', x: -3.5, z: -23.25, s: 1, alam: 'jalan' }];
const SEMUA = [...HALAMAN, ...TAMAN, ...JALAN];

test('pohon kos: semua pohon didaftarkan (posisi + ukuran lama), bentuk bola / silinder lama tidak dibuat lagi', () => {
  assert.match(HTML, /function tree\(x, z\) \{ KOS_POHON\.push\(\{ jenis: 'bulat', x: x, z: z, s: 1, alam: 'halaman' \}\); \}/);
  assert.match(HTML, /tree\(6\.5, 13\); tree\(23\.5, 13\);/); assert.match(HTML, /tree\(-17, 13\); tree\(17\.5, 9\); tree\(-17, -11\.5\);/);
  assert.match(HTML, /function jalanPohon\(x, z, s, latar\) \{ KOS_POHON\.push\(\{ jenis: 'bulat', x: x, z: z, s: s \|\| 1, alam: 'jalan', latar: !!latar \}\); \}/);
  assert.ok(HTML.includes('jalanPohon(10, 10.9, 0.85, true);') && HTML.includes('jalanPohon(-20.5, -23.25); jalanPohon(-3.5, -23.25);'));
  assert.ok(!HTML.includes('ball(M.leaf, 1.5, x, 3.1, z)') && !HTML.includes('cyl(M.trunk, 0.22, 0.3, 2.2'), 'bola + silinder lama dicabut');
  assert.ok(HTML.indexOf('var KOS_POHON = [];') < HTML.indexOf('\nbuildWorld();'), 'daftar siap sebelum buildWorld()');
  assert.ok(HTML.indexOf('\nkosPohonBangun();') > HTML.indexOf('\nbuildJalan();') && HTML.indexOf('\nkosPohonBangun();') > HTML.indexOf('function kotaTabung('), 'dibangun sesudah halaman + jalan + generator Kota siap');
  assert.equal(HTML.split('\nkosPohonBangun();').length, 2, 'dibangun sekali');
});

test('pohon kos: memakai generator + tekstur pohon Kota, bahan Lambert biasa (ikut lampu area kos), 2 mesh per alam', () => {
  const tulis = fungsi('kosPohonTulis'), bangun = fungsi('kosPohonBangun');
  assert.match(tulis, /kotaGugusDaun\(E\.daun,/); assert.match(tulis, /kotaTabung\(E\.batang,/);
  assert.match(bangun, /new THREE\.MeshLambertMaterial\(\{ map: kotaPra\('daun'\), vertexColors: true, name: 'kos-pohon-daun' \}\)/, 'tekstur daun Kota (objek tekstur yang sama)');
  assert.match(bangun, /new THREE\.MeshLambertMaterial\(\{ map: kotaPra\('halus'\), vertexColors: true, name: 'kos-pohon-batang' \}\)/, 'tekstur batang Kota');
  assert.ok(!/onBeforeCompile|MeshBasicMaterial|emissive/.test(BLOK), 'tidak menyala sendiri, tanpa suntikan malam Kota');
  assert.match(bangun, /\['halaman', 'jalan'\]\.forEach[\s\S]*\['daun', 'batang'\]\.forEach/, 'hanya 2 mesh (daun + batang) per alam');
  assert.match(bangun, /m\.castShadow = true; m\.matrixAutoUpdate = false;/);
  assert.match(bangun, /if \(p\.latar\) kosPohonTulis\(ember\.halaman, R, 27, 0\.015, 36\.25\);/, 'pohon pos ronda tetap terlihat dari halaman (cermin latar)');
  assert.deepEqual(P.KOS_POHON_HIJAU, [0x3d7d3a, 0x4a8f3f, 0x5aa047, 0x6db053, 0x82bd5c, 0x4f9358], 'palet hijau pohon Kota');
  assert.match(fungsi('kotaPohon'), /var hijau = \[kotaW\(0x3d7d3a\), kotaW\(0x4a8f3f\), kotaW\(0x5aa047\), kotaW\(0x6db053\), kotaW\(0x82bd5c\), kotaW\(0x4f9358\)\]/, 'palet Kota tidak berubah');
  assert.match(HTML, /new THREE\.ConeGeometry\(1\.3, 1\.6, 14\), -53\.35, 1\.85, 10/, 'cemara Komplek Tetangga tidak disentuh');
});

test("pohon kos gaya 'tekstur' (bawaan): tiap gugus = bola lama, tidak pernah keluar dari bola lama (benjolan 12% sudah dihitung)", () => {
  assert.equal(P.KOS_POHON_GAYA, 'tekstur'); assert.equal(P.KOS_POHON_BENJOL, 1.12);
  assert.match(fungsi('kotaGugusDaun'), /var AMP = 0\.12,/, 'benjolan generator Kota tetap 12%');
  for (const p of SEMUA) {
    const R = P.kosPohonRancang(p, 'tekstur'), L = P.kosPohonLama(p);
    assert.equal(R.tajuk.length, L.length);
    R.tajuk.forEach((g, i) => {
      assert.deepEqual([g.x, g.y, g.z, g.q], [L[i].x, L[i].y, L[i].z, L[i].q]);
      assert.ok(g.r * P.KOS_POHON_BENJOL <= L[i].r + 1e-9 && g.r > L[i].r * 0.88, 'jari gugus');
      assert.ok(g.detail >= 2 && g.warna >= 0 && g.warna < 6 && g.f.length === 5);
    });
    assert.equal(R.tabung.length, 1, 'satu batang');
    const T = R.tabung[0].T, J = R.tabung[0].J, s = p.s || 1;
    assert.equal(T[0][1], 0, 'batang dari tanah'); assert.ok(J[0] <= 0.45 && J[0] > J[J.length - 1], 'pangkal melebar, di dalam kotak padat +-0,5 / bingkai 1,3 m');
    const pucuk = T[T.length - 1], g0 = R.tajuk[0];
    assert.ok(pucuk[1] > g0.y - g0.r * g0.q * 0.88 + 0.1 * s, 'ujung batang terbenam di tajuk');
    assert.deepEqual(P.kosPohonRancang(p, 'tekstur'), R, 'deterministik');
  }
});

test("pohon kos gaya 'rimbun': tajuk bergugus tetap di dalam jangkauan pohon lama (datar <= 1,65 s, puncak <= 4,6 s; pipih di dalam cakram lama)", () => {
  for (const p of SEMUA) {
    const R = P.kosPohonRancang(p, 'rimbun'), s = p.s || 1, B = P.KOS_POHON_BENJOL;
    assert.ok(R.tajuk.length >= 9);
    for (const g of R.tajuk) {
      const datar = Math.hypot(g.x - p.x, g.z - p.z) + g.r * B, atas = g.y + g.r * g.q * B, bawah = g.y - g.r * g.q * B;
      if (p.jenis === 'pipih') { const lapis = g.y > 2.3 ? 0.8 : 1.15; assert.ok(datar <= lapis + 0.13, 'di dalam cakram lama ' + datar); assert.ok(atas <= 3.05 && bawah >= 1.36); }
      else { assert.ok(datar <= 1.65 * s, 'jangkauan datar ' + datar); assert.ok(atas <= 4.6 * s + 1e-9, 'puncak ' + atas); assert.ok(bawah >= 1.5 * s, 'sisi bawah ' + bawah); }
    }
    assert.ok(R.tabung.length === (p.jenis === 'pipih' ? 1 : 4), 'batang + 3 cabang');
    assert.deepEqual(P.kosPohonRancang(p, 'rimbun'), R, 'deterministik');
  }
});
