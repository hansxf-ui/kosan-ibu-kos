'use strict';
/* Tes unit rapihin area tengah (alun-alun) — Vesper, 15 Nov 2026.
   Parkir pindah x 4..16, z 13..17 -> x 30..42, z 4..8; setapak gerbang
   x 15 diperpanjang sampai plaza z 14; 2 pohon pindah membingkai jalur.
   Jalankan: node --test tests/rapihin-tengah.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const varBaris = (n) => { const i = HTML.indexOf('var ' + n + ' = '); assert.ok(i > 0, n); return HTML.slice(i, HTML.indexOf(';', i) + 1); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + varBaris('BALCONY_Y') + '\nvar avatarLevel = 0;\n'
  + 'return { YARD, BUILDING, BUILDING_B, BUILDING_C, BUILDING_D, PLAZA_SOLIDS, STAIR_SOLIDS, JUMLAH_KAMAR, BALCONY_Y };')();

/* kotak AABB bersinggungan dengan koridor? (tumpang tindih, bukan sekadar sentuh tepi) */
const tabrak = (s, k) => s.minX < k.maxX && s.maxX > k.minX && s.minZ < k.maxZ && s.maxZ > k.minZ;

test('rapihin: parkir di timur plaza (x 38..42, z 1..13), depan barat ke jemuran, posisi lama kosong', () => {
  /* AABB parkir baru (dimundurin 1 m LAGI ke TIMUR, vonis Ryan 07:25): 6 tiang + pagar utara/selatan/timur; barat TERBUKA.
     Pagar timur (x 42) mentok di pembatas cream (tepi timur perkerasan plaza, x 42). */
  const baru = [
    { minX: 38.35, maxX: 38.65, minZ: 1.35, maxZ: 1.65 },
    { minX: 38.35, maxX: 38.65, minZ: 6.85, maxZ: 7.15 },
    { minX: 38.35, maxX: 38.65, minZ: 12.35, maxZ: 12.65 },
    { minX: 41.35, maxX: 41.65, minZ: 1.35, maxZ: 1.65 },
    { minX: 41.35, maxX: 41.65, minZ: 6.85, maxZ: 7.15 },
    { minX: 41.35, maxX: 41.65, minZ: 12.35, maxZ: 12.65 },
    { minX: 38, maxX: 42, minZ: 0.75, maxZ: 1.25 },
    { minX: 38, maxX: 42, minZ: 12.75, maxZ: 13.25 },
    { minX: 41.75, maxX: 42.25, minZ: 1, maxZ: 13 },
  ];
  for (const k of baru) assert.ok(F.PLAZA_SOLIDS.some((s) => JSON.stringify(s) === JSON.stringify(k)), JSON.stringify(k));
  /* posisi lama bersih total (x 4..16, x 30..42, x 34..38 z 0..12, x 34..38 z 1..13 ronde 3, x 35..39 z 1..13 mundur-timur 1 m, dan x 37..41 z 1..13 mundur-timur 2 m) */
  for (const k of [{ minX: 4.35, maxX: 4.65, minZ: 13.35, maxZ: 13.65 }, { minX: 4, maxX: 16, minZ: 16.75, maxZ: 17.25 }, { minX: 30.35, maxX: 30.65, minZ: 4.35, maxZ: 4.65 }, { minX: 30, maxX: 42, minZ: 7.75, maxZ: 8.25 }, { minX: 34, maxX: 38, minZ: 11.75, maxZ: 12.25 }, { minX: 34, maxX: 38, minZ: 12.75, maxZ: 13.25 }, { minX: 34.35, maxX: 34.65, minZ: 1.35, maxZ: 1.65 }, { minX: 35, maxX: 39, minZ: 12.75, maxZ: 13.25 }, { minX: 35.35, maxX: 35.65, minZ: 1.35, maxZ: 1.65 }, { minX: 38.75, maxX: 39.25, minZ: 1, maxZ: 13 }, { minX: 40.75, maxX: 41.25, minZ: 1, maxZ: 13 }]) {
    assert.ok(!F.PLAZA_SOLIDS.some((s) => JSON.stringify(s) === JSON.stringify(k)), 'lama masih ada: ' + JSON.stringify(k));
  }
  /* mesh parkir di posisi baru, diputar: atap 4x12 + papan di sisi barat hadap barat (-PI/2) */
  assert.match(HTML, /box\(M\.parkRoof, 4, 0\.08, 12, 40, 3\.09, 7\);/);
  assert.match(HTML, /parkSign\.position\.set\(37\.93, 2\.55, 7\);/);
  assert.match(HTML, /parkSign\.rotation\.y = -Math\.PI \/ 2;/);
  assert.ok(!HTML.includes('box(M.parkRoof, 12, 0.08, 4, 36, 3.09, 6);'), 'atap lama (12x4) masih ada');
});

test('rapihin: parkir TIDAK menutup pintu C/D (koridor z 13,25..16,7 lega)', () => {
  /* semua AABB parkir berada di utara z 13,25 — pintu C/D di z 16,7 punya koridor >= 3 m */
  for (const s of F.PLAZA_SOLIDS) {
    if (s.minX >= 37.75 && s.maxX <= 42.25 && s.minZ >= 0.75 && s.maxZ <= 13.25) {
      assert.ok(s.maxZ <= 13.25 + 1e-9, 'AABB parkir melewati z 13,25: ' + JSON.stringify(s));
    }
  }
  /* pintu C (x -11,-6,-1,4,9) + D (x 21,26,31,36,41) z 16,7: tidak ada AABB parkir di depannya */
  for (const x of [-11, -6, -1, 4, 9, 21, 26, 31, 36, 41]) {
    const depan = { minX: x - 0.4, maxX: x + 0.4, minZ: 13.25, maxZ: 16.7 };
    const halang = F.PLAZA_SOLIDS.filter((s) => tabrak(s, depan) && s.minX >= 34.75 && s.maxX <= 39.25);
    assert.equal(halang.length, 0, 'pintu x=' + x + ' terhalang parkir: ' + JSON.stringify(halang));
  }
});

test('rapihin: jalur gerbang x 15 tembus gerbang (z 29) sampai plaza (z 14)', () => {
  /* mesh setapak: panjang 15 (z 14..29), pusat z 21,5 */
  assert.match(HTML, /box\(M\.path, 2\.4, 0\.06, 15, 15, 0\.03, 21\.5\)\.receiveShadow = true;/);
  assert.ok(!HTML.includes('box(M.path, 2.4, 0.06, 11.7, 15, 0.03, 23.15)'), 'setapak lama masih ada');
  /* koridor setapak (x 13,8..16,2, z 14..29) bebas dari semua AABB (kanopi C/D di x 11,85..12,15 + 17,85..18,15 tidak masuk) */
  const kor = { minX: 13.8, maxX: 16.2, minZ: 14, maxZ: 29 };
  const halang = F.PLAZA_SOLIDS.filter((s) => tabrak(s, kor));
  assert.equal(halang.length, 0, 'jalur gerbang terhalang: ' + JSON.stringify(halang));
});

test('rapihin: 2 pohon pindah membingkai jalur gerbang; pohon lain + gazebo + jemuran tetap', () => {
  assert.match(HTML, /tree\(6\.5, 13\); tree\(23\.5, 13\);/);
  assert.ok(!HTML.includes('tree(-4, 15); tree(-8, 15);'), 'pohon lama masih ada');
  assert.match(HTML, /tree\(-17, 8\); tree\(17\.5, 9\); tree\(-17, -11\.5\);/);
  /* gazebo tetap (pusat 12, 6,5) + jemuran tetap (AABB tiang) */
  assert.ok(F.PLAZA_SOLIDS.some((s) => JSON.stringify(s) === JSON.stringify({ minX: 11.2, maxX: 12.8, minZ: 6.1, maxZ: 6.9 })), 'gazebo berubah');
  assert.ok(F.PLAZA_SOLIDS.some((s) => JSON.stringify(s) === JSON.stringify({ minX: -16.6, maxX: -16.4, minZ: 0.9, maxZ: 1.1 })), 'jemuran berubah');
  /* gedung + halaman + jumlah kamar tidak berubah */
  assert.deepEqual(F.BUILDING_C, { minX: -14.4, maxX: 12.4, minZ: 18.6, maxZ: 27 });
  assert.deepEqual(F.BUILDING_D, { minX: 17.6, maxX: 44.4, minZ: 18.6, maxZ: 27 });
  assert.equal(F.JUMLAH_KAMAR, 40);
  assert.equal(F.YARD.maxZ, 28);
});

test('rapihin: spawn (0,12) + area sekitarnya bersih dari AABB baru', () => {
  /* spawn avatar (0,12) tidak di dalam parkir baru (x 34..38) dan tidak di jalur setapak (x 13,8..16,2) */
  const diParkir = F.PLAZA_SOLIDS.some((s) => 0 > s.minX - 0.4 && 0 < s.maxX + 0.4 && 12 > s.minZ - 0.4 && 12 < s.maxZ + 0.4 && s.minX >= 34.75);
  assert.equal(diParkir, false, 'spawn masuk AABB parkir baru');
  /* titik tengah jalur gerbang (15, 20) bebas: avatar bisa jalan lurus gerbang -> plaza */
  const diJalur = F.PLAZA_SOLIDS.filter((s) => tabrak(s, { minX: 14.6, maxX: 15.4, minZ: 19.6, maxZ: 20.4 }));
  assert.equal(diJalur.length, 0, 'tengah jalur gerbang terhalang: ' + JSON.stringify(diJalur));
});

test('rapihin: teras luar DIHAPUS (alas merah + meja + bantal), ruang tamu dalam tetap', () => {
  /* mesh teras luar tidak ada lagi: alas (M.rug di halaman), meja + kaki, bantal c1/c2 */
  assert.ok(!HTML.includes('var rug = box(M.rug, 5.4, 0.05, 4.2, 16, 0.03, -2);'), 'alas teras masih ada');
  assert.ok(!HTML.includes('var table = box(M.wood, 1.6, 0.12, 0.9, 16, 0.45, -2);'), 'meja teras masih ada');
  assert.ok(!HTML.includes('var c1 = cyl(M.cushion, 0.42, 0.42, 0.18, 14.3, 0.09, -3.2);'), 'bantal c1 masih ada');
  assert.ok(!HTML.includes('var c2 = cyl(M.cushion2, 0.42, 0.42, 0.18, 17.7, 0.09, -0.9);'), 'bantal c2 masih ada');
  assert.match(HTML, /teras luar DIHAPUS \(vonis Ryan 15 Nov 06:16/);
  /* ruang tamu DALAM tidak ikut terhapus (rugIn + tableIn di livingScene tetap) */
  assert.match(HTML, /var rugIn = box\(M\.rugModern, 4, 0\.05, 3, 0, 0\.03, -2\.6, livingScene\);/);
  assert.match(HTML, /var tableIn = box\(M\.walnutA, 1\.6, 0\.12, 0\.9, 0, 0\.45, -3\.1, livingScene\);/);
});
