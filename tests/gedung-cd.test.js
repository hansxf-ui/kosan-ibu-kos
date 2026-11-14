'use strict';
/* Tes unit Gedung C & D (K21-K40) — fungsi murni diambil VERBATIM dari
   index.html. Jalankan: node --test tests/gedung-cd.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const varBaris = (n) => { const i = HTML.indexOf('var ' + n + ' = '); assert.ok(i > 0, n); return HTML.slice(i, HTML.indexOf(';', i) + 1); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + varBaris('BALCONY_Y') + '\nvar avatarLevel = 0;\n' + fungsi('lantaiY') + fungsi('clampBalcony')
  + '\nreturn { previewFor, roomFor, collideBuilding, resolveAABB, mpRealmDikenal, mpValidasiPos, lantaiY, clampBalcony,'
  + ' setLevel: function (l) { avatarLevel = l; }, YARD, BUILDING, BUILDING_B, BUILDING_C, BUILDING_D, STAIR_SOLIDS, PLAZA_SOLIDS, JUMLAH_KAMAR, CERMIN_CD_Z, BALCONY_Y };')();
const cermin = (b) => ({ minX: b.minX, maxX: b.maxX, minZ: +(F.CERMIN_CD_Z - b.maxZ).toFixed(3), maxZ: +(F.CERMIN_CD_Z - b.minZ).toFixed(3) });

test('C&D: posisi sesuai brief (cermin A/B terhadap z 6,3), muka utara di dinding sebenarnya z 18,6', () => {
  assert.deepEqual(F.BUILDING_C, { minX: -14.4, maxX: 12.4, minZ: 18.6, maxZ: 27 });
  assert.deepEqual(F.BUILDING_D, { minX: 17.6, maxX: 44.4, minZ: 18.6, maxZ: 27 });
  assert.equal(F.CERMIN_CD_Z, 12.6);
  assert.equal(cermin(F.BUILDING).maxZ, F.BUILDING_C.maxZ);
  assert.equal(F.YARD.maxZ, 28);
  /* tidak pindah: gazebo, parkiran, jemuran (kotak AABB lama masih ada persis) */
  for (const k of [{ minX: 11.2, maxX: 12.8, minZ: 6.1, maxZ: 6.9 }, { minX: 4, maxX: 16, minZ: 16.75, maxZ: 17.25 }, { minX: -16.6, maxX: -16.4, minZ: 0.9, maxZ: 1.1 }]) {
    assert.ok(F.PLAZA_SOLIDS.some((s) => JSON.stringify(s) === JSON.stringify(k)), JSON.stringify(k));
  }
  assert.ok(!F.PLAZA_SOLIDS.some((s) => s.minX === -18 && s.maxX === -2 && s.minZ === 16), 'bedeng selatan lama dibongkar');
});

test('C&D: kolong tangga C/D = cermin A/B (brief), strip masuk tidak padat', () => {
  const [a, b, c, d] = F.STAIR_SOLIDS;
  assert.deepEqual(c, cermin(a)); assert.deepEqual(d, cermin(b));
  assert.deepEqual(c, { minX: -16.0, maxX: -14.4, minZ: 21.6, maxZ: 26.1 });
});

test('C&D: gedung tidak bisa ditembus dari utara, selatan, dan samping', () => {
  for (const B of [F.BUILDING_C, F.BUILDING_D]) {
    const cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2;
    const r = F.collideBuilding(cx, B.minZ + 0.1);
    assert.ok(r.z <= B.minZ - 0.4 + 1e-9, 'dorong ke utara ' + JSON.stringify(r));
    const r2 = F.collideBuilding(cx, cz);
    assert.ok(r2.x <= B.minX - 0.4 || r2.x >= B.maxX + 0.4 || r2.z <= B.minZ - 0.4 || r2.z >= B.maxZ + 0.4, JSON.stringify(r2));
  }
  /* gedung A/B tetap sama */
  assert.ok(F.collideBuilding(-1, -5.5).z >= -5.0 - 1e-9);
});

test('C&D: naik tangga dari strip selatan (26,1..26,6), koridor + balkon hanya level 1', () => {
  F.setLevel(0);
  for (const x of [-15.0, 45.0]) {
    assert.ok(F.lantaiY(x, 26.3) > 0, 'strip masuk ' + x);
    assert.equal(F.lantaiY(x, 26.6), 0, 'tepi selatan = tanah');
    assert.equal(F.lantaiY(x, 22), 0, 'koridor di level 0 tetap tanah (tidak teleport)');
    assert.equal(F.lantaiY(0, 17.5), 0, 'di bawah balkon C tetap tanah');
  }
  F.setLevel(1);
  for (const x of [-15.0, 45.0]) {
    assert.ok(Math.abs(F.lantaiY(x, 18.6) - F.BALCONY_Y) < 1e-9, 'puncak tangga = balkon');
    const t = F.lantaiY(x, 22.6);
    assert.ok(t > 0 && t < F.BALCONY_Y, 'tengah tangga');
  }
  assert.equal(F.lantaiY(0, 17.5), F.BALCONY_Y);
  assert.equal(F.lantaiY(30, 17.5), F.BALCONY_Y);
  F.setLevel(0);
});

test('C&D: jepit balkon C/D sadar radius (tidak jatuh / tidak menembus pagar kaca z 16,82)', () => {
  const j = F.clampBalcony(0, 16.5);
  assert.deepEqual(j, { x: 0, z: 17.2 });
  assert.deepEqual(F.clampBalcony(30, 18.5), { x: 30, z: 17.7 }, 'tidak masuk dinding');
  assert.deepEqual(F.clampBalcony(-15.0, 22), { x: -15.0, z: 22 }, 'koridor C');
  assert.deepEqual(F.clampBalcony(45.0, 22), { x: 45.0, z: 22 }, 'koridor D');
  assert.equal(F.clampBalcony(-16, 22).x, -15.25, 'badan 0,3 m dari handrail');
});

test('C&D: 40 kamar — previewFor kamar kosong pertama s.d. 40, roomFor hash TETAP 1..10', () => {
  assert.equal(F.JUMLAH_KAMAR, 40);
  const occ = []; for (let r = 1; r <= 20; r++) occ.push({ room: r, name: 'p' + r });
  assert.equal(F.previewFor('orangbaru', occ).room, 21);
  occ.push({ room: 21, name: 'p21' });
  assert.equal(F.previewFor('orangbaru', occ).room, 22);
  for (let r = 22; r <= 40; r++) occ.push({ room: r, name: 'p' + r });
  assert.equal(F.previewFor('orangbaru', occ), null);
  assert.deepEqual(F.previewFor('p33', occ), { room: 33, resident: true, moved: false });
  for (const n of ['rina', 'cici', 'Budi Santoso']) { const h = F.roomFor(n); assert.ok(h >= 1 && h <= 10, n); }
});

test('C&D: realm room-1..40 dikenal; posisi di halaman selatan baru lolos validasi', () => {
  for (const r of ['room-1', 'room-20', 'room-21', 'room-39', 'room-40']) assert.equal(F.mpRealmDikenal(r), r);
  for (const r of ['room-0', 'room-41', 'room-400']) assert.equal(F.mpRealmDikenal(r), 'yard');
  const m = { id: 'pabc1', nama: 'cici', gender: 'cewek', realm: 'yard', x: 0, z: 27.7, rot: 0, gerak: 0, ts: 1, pose: 'stand' };
  assert.ok(F.mpValidasiPos(m, 'pdiri'), 'z 27,7 (lorong belakang C/D) sah');
});

test('C&D: pintu K21-K40 dibuat dengan pola A/B (5 bawah lalu 5 atas), kunci + pesan + header', () => {
  const g = fungsi('bangunGedungCD');
  assert.match(g, /awal: 21, doorX: doorXA/); assert.match(g, /awal: 31, doorX: doorXB/);
  assert.match(g, /floor2 = k >= 5, x = d\.doorX\[k % 5\]/);
  assert.match(g, /door\.userData = \{ card: 'room', room: n \}/);
  assert.match(HTML, /bangunGedungCD\(scene\.children\.slice\(awalGedungAB\), doorXA, doorXB\);/);
  assert.match(HTML, /var KUNCI_KODE_LIST = \['KOSAN', 'KOSANBARU', 'KOSANC', 'KOSAND'\]/);
  assert.match(fungsi('daftarPesan'), /Gedung C penuh/); assert.match(fungsi('daftarPesan'), /Gedung D penuh/);
  assert.match(fungsi('updateRoomCount'), /JUMLAH_KAMAR \+ ' kamar · '/);
  assert.match(HTML, /hits = hits\.filter\(function \(h\) \{ return gedungCdTerlihat\(h\.object\); \}\);/);
});

test('C&D: sembunyi otomatis saat kamera di dalam/belakang gedung; balkon tetap kalau avatar di atasnya', () => {
  const kode = varBaris('BUILDING_C') + varBaris('BUILDING_D') + '\nvar GEDUNG_CD = [];\n' + fungsi('gedungCdPerbarui')
    + '\nreturn function (cam, ax, az, lv) { GEDUNG_CD.length = 0; [BUILDING_C, BUILDING_D].forEach(function (k, i) { GEDUNG_CD.push({ nama: "CD"[i], kotak: k, badan: {}, depan: {} }); });'
    + ' gedungCdPerbarui(cam, ax, az, lv); return GEDUNG_CD.map(function (G) { return G.nama + (G.badan.visible ? "B" : "-") + (G.depan.visible ? "D" : "-"); }).join(" "); };';
  const run = new Function(kode)();
  assert.equal(run({ x: 0, z: 21.2 }, 0, 12, 0), 'C-- DBD', 'spawn landscape: kamera di dalam C');
  assert.equal(run({ x: 0, z: 27.5 }, 0, 12, 0), 'C-- DBD', 'spawn portrait: kamera di belakang C');
  assert.equal(run({ x: 0, z: 6 }, 0, 12, 0), 'CBD DBD', 'kamera di utara: semua tampil');
  assert.equal(run({ x: 0, z: 23 }, 0, 17.4, 1), 'C-D DBD', 'avatar di balkon C: balkon tetap');
  assert.equal(run({ x: 30, z: 23 }, 30, 17.4, 1), 'CBD D-D');
});
