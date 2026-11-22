'use strict';
/* Tes unit Gedung E & F (Opsi D — Komplek Sebelah, K41-K60) — fungsi murni
   diambil VERBATIM dari index.html. Jalankan: node --test tests/gedung-ef.test.js */
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
  + ' setLevel: function (l) { avatarLevel = l; }, YARD, BUILDING, BUILDING_B, BUILDING_C, BUILDING_D, BUILDING_E, BUILDING_F, STAIR_SOLIDS, PLAZA_SOLIDS, JUMLAH_KAMAR, CERMIN_CD_Z, BALCONY_Y, HALAMAN_EF, HALAMAN_EF_TENGAH, CEMARA_EF, HALAMAN_EF_BANGKU, HALAMAN_EF_PLANTER, TAMAN_UTARA, LAPANGAN_EF };')();
const dekat = (a, b, eps) => Math.abs(a - b) <= (eps || 0.001);
const pos = (realm, x, z) => F.mpValidasiPos({ id: 'pabc1', nama: 'cici', gender: 'cewek', realm: realm, x: x, z: z, rot: 0, gerak: 0, ts: 1, pose: 'stand' }, 'pdiri');

test('E&F: posisi sesuai peta Opsi D ronde 4 (E/F saling berhadapan lewat halaman z 2..18 selebar plaza, jalan 20 m), YARD meluas ke barat', () => {
  assert.deepEqual(F.BUILDING_E, { minX: -66.8, maxX: -40, minZ: -7, maxZ: 2 });
  assert.deepEqual(F.BUILDING_F, { minX: -66.8, maxX: -40, minZ: 18, maxZ: 27 });
  assert.equal(F.YARD.minX, -68.4, 'minX -58,4 -> -68,4 (muka barat koridor tangga)');
  assert.equal(F.YARD.maxX, 46);
  assert.equal(F.YARD.minZ, -17); assert.equal(F.YARD.maxZ, 28);
  assert.equal(F.JUMLAH_KAMAR, 60);
  /* yard lama utuh: A/B/C/D tidak berubah */
  assert.deepEqual(F.BUILDING_C, { minX: -14.4, maxX: 12.4, minZ: 18.6, maxZ: 27 });
  assert.deepEqual(F.BUILDING_D, { minX: 17.6, maxX: 44.4, minZ: 18.6, maxZ: 27 });
});

test('E&F: STAIR_SOLIDS koridor barat + strip masuk TIDAK padat', () => {
  const ada = (k) => F.STAIR_SOLIDS.some((s) => s.minX === k.minX && s.maxX === k.maxX && s.minZ === k.minZ && s.maxZ === k.maxZ);
  assert.ok(ada({ minX: -68.4, maxX: -66.8, minZ: -6.1, maxZ: -1.6 }), 'koridor E');
  assert.ok(ada({ minX: -68.4, maxX: -66.8, minZ: 21.6, maxZ: 26.1 }), 'koridor F');
  /* strip masuk tidak padat: avatar level 0 bisa masuk lewat sana */
  assert.equal(F.lantaiY(-67.4, -6.35), F.BALCONY_Y * 0.03125, 'strip E naik bertahap');
  assert.equal(F.lantaiY(-67.4, 26.35), F.BALCONY_Y * 0.03125, 'strip F naik bertahap');
});

test('E&F: PLAZA_SOLIDS — pagar barat padat TERMASUK celah (KUNCI E&F 19 Nov), pohon penanda, lampu jalan, kanopi E/F', () => {
  const ada = (k) => F.PLAZA_SOLIDS.some((s) => s.minX === k.minX && s.maxX === k.maxX && s.minZ === k.minZ && s.maxZ === k.maxZ);
  assert.ok(ada({ minX: -20.15, maxX: -19.85, minZ: -18, maxZ: 8 }), 'pagar barat utara (padat)');
  assert.ok(ada({ minX: -20.15, maxX: -19.85, minZ: 12, maxZ: 29 }), 'pagar barat selatan (padat)');
  /* 22 Nov — palang celah dicabut: celah z 8..12 BEBAS (jalan kaki ke Komplek Tetangga dibuka; daftar tetap terkunci di server). */
  assert.ok(!ada({ minX: -20.15, maxX: -19.85, minZ: 8, maxZ: 12 }), 'celah z 8..12 bebas (palang dicabut)');
  assert.ok(ada({ minX: -17.6, maxX: -16.4, minZ: 12.4, maxZ: 13.6 }), 'pohon (-17, 13) padat ±0,6 m (pindah dari (-17, 8))');
  /* lampu jalan kiri-kanan: 4 per sisi (x -22/-27/-32/-37), utara z 7,7 + selatan z 12,3 */
  for (const lx of [-22, -27, -32, -37]) {
    assert.ok(ada({ minX: lx - 0.15, maxX: lx + 0.15, minZ: 7.55, maxZ: 7.85 }), 'lampu jalan utara x ' + lx);
    assert.ok(ada({ minX: lx - 0.15, maxX: lx + 0.15, minZ: 12.15, maxZ: 12.45 }), 'lampu jalan selatan x ' + lx);
  }
  assert.ok(ada({ minX: -66.55, maxX: -66.25, minZ: 2.45, maxZ: 2.75 }), 'kanopi E barat');
  assert.ok(ada({ minX: -40.55, maxX: -40.25, minZ: 2.45, maxZ: 2.75 }), 'kanopi E timur');
  assert.ok(ada({ minX: -66.55, maxX: -66.25, minZ: 17.25, maxZ: 17.55 }), 'kanopi F barat');
  assert.ok(ada({ minX: -40.55, maxX: -40.25, minZ: 17.25, maxZ: 17.55 }), 'kanopi F timur');
  /* lorong pendekatan strip barat (z 8..12) bebas: jemuran berakhir z 7,1 */
  assert.ok(pos('yard', -17, 10), 'lorong celah sah');
});

test('E&F: collideBuilding mendorong keluar dari footprint E/F; halaman bebas', () => {
  assert.deepEqual(F.collideBuilding(-53.4, -1), { x: -53.4, z: 2.4 }, 'di dalam E -> dorong ke muka selatan');
  assert.deepEqual(F.collideBuilding(-53.4, 18), { x: -53.4, z: 17.6 }, 'di dalam F -> dorong ke muka utara');
  assert.deepEqual(F.collideBuilding(-53.4, 10), { x: -53.4, z: 10 }, 'halaman z 2..18 bebas');
  assert.deepEqual(F.collideBuilding(-53.4, 10.5), { x: -53.4, z: 10.5 }, 'halaman bebas');
});

test('E&F: lantaiY ramp + balkon (E naik ke selatan, F naik ke utara)', () => {
  F.setLevel(0);
  assert.equal(F.lantaiY(-67.4, 0), 0, 'koridor E level 0 = 0 (tanpa teleport — pola Fix Loop C1, sama kayak koridor A/C/D)');
  assert.equal(F.lantaiY(-53.4, 2.4), 0, 'balkon E di tanah = 0 (tidak teleport)');
  F.setLevel(1);
  assert.ok(dekat(F.lantaiY(-67.4, 0), F.BALCONY_Y * 0.825), 'koridor E level 1');
  assert.equal(F.lantaiY(-67.4, 1.4), F.BALCONY_Y, 'puncak ramp E');
  assert.equal(F.lantaiY(-53.4, 2.4), F.BALCONY_Y, 'balkon E');
  assert.equal(F.lantaiY(-53.4, 17.6), F.BALCONY_Y, 'balkon F');
  assert.ok(dekat(F.lantaiY(-67.4, 22), F.BALCONY_Y * 0.575), 'koridor F level 1');
  assert.equal(F.lantaiY(-67.4, 18.6), F.BALCONY_Y, 'puncak ramp F');
  assert.equal(F.lantaiY(-53.4, 10), 0, 'halaman di level 1 = 0 (bukan balkon)');
  F.setLevel(0);
});

test('E&F: clampBalcony menjepit ke koridor/balkon E/F', () => {
  assert.deepEqual(F.clampBalcony(-67.4, 0), { x: -67.4, z: 0 }, 'koridor E');
  assert.deepEqual(F.clampBalcony(-53.4, 2.5), { x: -53.4, z: 2.5 }, 'balkon E');
  assert.deepEqual(F.clampBalcony(-67.4, 22), { x: -67.4, z: 22 }, 'koridor F');
  assert.deepEqual(F.clampBalcony(-53.4, 17.5), { x: -53.4, z: 17.5 }, 'balkon F');
  assert.deepEqual(F.clampBalcony(-67.4, 7.5), { x: -67.4, z: 2.8 }, 'halaman dekat E -> jepit ke balkon E');
  assert.deepEqual(F.clampBalcony(-67.4, 12.5), { x: -67.4, z: 17.2 }, 'halaman dekat F -> jepit ke balkon F');
});

test('E&F: bangunGedungCD — defs E/F (klon A, awal 41/51, geser -52,4; E offZ 7,4, F cermin 12,6)', () => {
  const g = fungsi('bangunGedungCD');
  assert.match(g, /nama: 'E', kotak: BUILDING_E, sumberB: false, awal: 41, doorX: doorXA/);
  assert.match(g, /nama: 'F', kotak: BUILDING_F, sumberB: false, awal: 51, doorX: doorXA/);
  assert.match(g, /cermin: 0, offX: -52\.4, offZ: 7\.4, utara: false/);
  assert.match(g, /cermin: 12\.6, offX: -52\.4, utara: true/);
  assert.match(g, /utara: d\.utara/);
});

test('E&F: sembunyi otomatis — E menghadap selatan, F menghadap utara', () => {
  const kode = varBaris('BUILDING_E') + varBaris('BUILDING_F') + '\nvar GEDUNG_CD = [];\n' + fungsi('gedungCdPerbarui')
    + '\nreturn function (cam, ax, az, lv) { GEDUNG_CD.length = 0; [{ kotak: BUILDING_E, utara: false }, { kotak: BUILDING_F, utara: true }].forEach(function (e, i) { GEDUNG_CD.push({ nama: "EF"[i], kotak: e.kotak, utara: e.utara, badan: {}, depan: {} }); });'
    + ' gedungCdPerbarui(cam, ax, az, lv); return GEDUNG_CD.map(function (G) { return G.nama + (G.badan.visible ? "B" : "-") + (G.depan.visible ? "D" : "-"); }).join(" "); };';
  const run = new Function(kode)();
  assert.equal(run({ x: -53.4, z: -9 }, -53.4, 10, 0), 'E-- FBD', 'kamera di utara E: E sembunyi, F tampil');
  assert.equal(run({ x: -53.4, z: 10 }, -53.4, 10, 0), 'EBD FBD', 'kamera di halaman: semua tampil');
  assert.equal(run({ x: -53.4, z: 29 }, -53.4, 10, 0), 'EBD F--', 'kamera di selatan F: F sembunyi, E tampil');
  assert.equal(run({ x: -53.4, z: -9 }, -53.4, 2.4, 1), 'E-D FBD', 'avatar di balkon E: depan E tetap');
  assert.equal(run({ x: -53.4, z: 29 }, -53.4, 17.6, 1), 'EBD F-D', 'avatar di balkon F: depan F tetap');
});

test('E&F: pagar barat dipecah (celah z 8..12) + gerbang barat + pagar baru', () => {
  assert.match(HTML, /fenceRun\(-20, -18, -20, 8\);/);
  assert.match(HTML, /fenceRun\(-20, 12, -20, 29\);/);
  assert.match(HTML, /fenceRun\(-69\.4, -18, -69\.4, 29\);/);
  assert.match(HTML, /fenceRun\(-69\.4, -18, 47, -18\);/);
  assert.match(HTML, /fenceRun\(-69\.4, 29, 13\.4, 29\);/);
  assert.match(HTML, /KOMPLEK TETANGGA/);
  assert.doesNotMatch(HTML, /KOMPLEK SEBELAH/, 'nama lama tidak ada lagi');
  assert.match(HTML, /papanBarat = jalanPapan\('KOMPLEK TETANGGA', 'gedung E · gedung F', '#f7f5ef', 2\.2, '#141414'\)/, 'ronde 7: papan putih + tulisan hitam (dibalik dari ronde 6)');
  assert.match(HTML, /papanBaratBarat = papanBarat\.clone\(\)/, 'papan sisi barat ada (nama terbaca dari jalan)');
  assert.match(HTML, /papanBaratBarat\.rotation\.y = -Math\.PI \/ 2/, 'papan sisi barat menghadap barat');
  assert.match(HTML, /gedung E · gedung F/);
});

test('E&F: 60 kamar — previewFor kamar kosong pertama s.d. 60; realm room-41..60; validasi posisi komplek sebelah', () => {
  assert.equal(F.JUMLAH_KAMAR, 60);
  const occ = []; for (let r = 1; r <= 40; r++) occ.push({ room: r, name: 'p' + r });
  assert.equal(F.previewFor('orangbaru', occ).room, 41);
  for (const r of ['room-41', 'room-50', 'room-51', 'room-60']) assert.equal(F.mpRealmDikenal(r), r);
  assert.equal(F.mpRealmDikenal('room-61'), 'yard');
  assert.ok(pos('yard', -30, 10), 'jalan batu komplek sebelah sah');
  assert.ok(pos('yard', -53.4, 10), 'halaman sah');
  assert.ok(pos('yard', -57, -7.3), 'lorong belakang E sah');
  assert.ok(pos('yard', -57, 27.3), 'lorong belakang F sah');
  assert.ok(!pos('yard', -70, 10), 'di luar pagar barat baru ditolak (toleransi 1 m)');
  assert.ok(pos('yard', -69, 10), 'toleransi 1 m di luar batas masih diterima (pola lama)');
});

test('Halaman E/F ronde 3+4+5: konstanta halaman tengah — halaman 16 m selebar plaza, cemara di tengah, bangku + planter', () => {
  assert.deepEqual(F.HALAMAN_EF, { minX: -66.8, maxX: -40, minZ: 2, maxZ: 18 }, 'halaman tengah 26,8x16 m (ronde 4: 8 -> 16 m)');
  assert.deepEqual(F.HALAMAN_EF_TENGAH, { minX: -58.4, maxX: -48.4, minZ: 2, maxZ: 18 }, 'paving tengah 10 m (pusat = cemara -53,4)');
  assert.deepEqual(F.CEMARA_EF, { x: -53.4, z: 10, r: 1.4 }, 'cemara di pusat halaman (ronde 5: ganti mancur)');
  /* tengah tepat di pusat halaman + cemara */
  assert.equal((F.HALAMAN_EF_TENGAH.minX + F.HALAMAN_EF_TENGAH.maxX) / 2, F.CEMARA_EF.x, 'tengah di pusat cemara (x)');
  assert.equal((F.HALAMAN_EF_TENGAH.minZ + F.HALAMAN_EF_TENGAH.maxZ) / 2, F.CEMARA_EF.z, 'tengah di pusat cemara (z)');
  assert.deepEqual(F.HALAMAN_EF_BANGKU, [
    { x: -55.9, z: 3.5, hadap: 'selatan' },
    { x: -50.9, z: 16.5, hadap: 'utara' },
  ], '2 bangku menghadap cemara (ronde 4: geser ke fasad)');
  assert.deepEqual(F.HALAMAN_EF_PLANTER, [{ x: -65.4, z: 3.5 }, { x: -41.4, z: 16.5 }], '2 planter di tepi halaman (ronde 4: geser ke fasad)');
  /* bangku di celah antar-pintu E/F (pintu x -63,4/-58,4/-53,4/-48,4/-43,4) + di tepi halaman */
  for (const b of F.HALAMAN_EF_BANGKU) {
    assert.ok([-60.9, -55.9, -50.9, -45.9].includes(b.x), 'bangku di celah antar-pintu x ' + b.x);
    assert.ok(Math.abs(b.z - 10) > 2, 'bangku di tepi halaman, bukan di sumbu jalan');
  }
  /* ronde 4: halaman SELEBAR plaza utama (16 m), luas setengah plaza */
  assert.equal(F.HALAMAN_EF.maxZ - F.HALAMAN_EF.minZ, 16, 'lebar halaman = lebar plaza (16 m)');
  assert.ok(dekat((F.HALAMAN_EF.maxX - F.HALAMAN_EF.minX) * (F.HALAMAN_EF.maxZ - F.HALAMAN_EF.minZ), 26.8 * 16), 'luas halaman 429 m2');
});

test('Halaman E/F ronde 5: PLAZA_SOLIDS — cemara + bangku + planter padat; lorong lewat cemara cukup', () => {
  const ada = (k) => F.PLAZA_SOLIDS.some((s) => s.minX === k.minX && s.maxX === k.maxX && s.minZ === k.minZ && s.maxZ === k.maxZ);
  assert.ok(ada({ minX: -54.8, maxX: -52.0, minZ: 8.6, maxZ: 11.4 }), 'cemara padat ±1,4 m');
  assert.ok(ada({ minX: -56.8, maxX: -55, minZ: 3.22, maxZ: 3.75 }), 'bangku utara padat');
  assert.ok(ada({ minX: -51.8, maxX: -50, minZ: 16.22, maxZ: 16.75 }), 'bangku selatan padat');
  assert.ok(ada({ minX: -65.85, maxX: -64.95, minZ: 3.05, maxZ: 3.95 }), 'planter barat laut padat');
  assert.ok(ada({ minX: -41.85, maxX: -40.95, minZ: 16.05, maxZ: 16.95 }), 'planter tenggara padat');
  /* lorong antara bangku dan cemara ≥1,4 m (avatar butuh 0,8 m) */
  assert.ok(8.6 - 3.75 >= 1.4, 'lorong utara cemara');
  assert.ok(16.22 - 11.4 >= 1.4, 'lorong selatan cemara');
});

test('Halaman E/F ronde 5: jalan kaki memutari cemara — tidak menembus dedaunan, sampai ujung barat lane', () => {
  const solids = F.PLAZA_SOLIDS.concat(F.STAIR_SOLIDS);
  const dorong = (x, z) => {
    const c = F.collideBuilding(x, z); x = c.x; z = c.z;
    for (const s of solids) { const r = F.resolveAABB(x, z, s, 0.4, F.YARD); x = r.x; z = r.z; }
    return { x, z };
  };
  let x = -44, z = 10, langkah = 0, lewatSisi = '';
  while (x > -60 && langkah < 600) {
    langkah++;
    const maju = dorong(x - 0.3, z);
    if (maju.x < x - 0.01) { x = maju.x; z = maju.z; }
    else { /* macet di sumbu x (cemara di depan) — geser menyamping ke sisi terdekat */
      const geser = dorong(x, z + (z <= 10 ? -0.3 : 0.3));
      z = geser.z;
    }
    if (z < 8.6) lewatSisi = lewatSisi || 'utara';
    if (z > 11.4) lewatSisi = lewatSisi || 'selatan';
    assert.ok(!(x > -54.8 && x < -52.0 && z > 8.6 && z < 11.4), 'tidak menembus cemara di langkah ' + langkah + ' (x=' + x.toFixed(2) + ', z=' + z.toFixed(2) + ')');
  }
  assert.ok(x <= -60, 'sampai ujung barat lane (x=' + x.toFixed(1) + ', ' + langkah + ' langkah)');
  assert.ok(lewatSisi, 'memutar lewat sisi cemara (' + lewatSisi + ')');
});

test('Halaman E/F ronde 4+5: jalan kaki UTARA-SELATAN melintasi halaman 16 m penuh — tidak menembus cemara/bangunan', () => {
  const solids = F.PLAZA_SOLIDS.concat(F.STAIR_SOLIDS);
  const dorong = (x, z) => {
    const c = F.collideBuilding(x, z); x = c.x; z = c.z;
    for (const s of solids) { const r = F.resolveAABB(x, z, s, 0.4, F.YARD); x = r.x; z = r.z; }
    return { x, z };
  };
  let x = -53.4, z = 3, langkah = 0, lewatSisi = '';
  while (z < 17 && langkah < 600) {
    langkah++;
    const maju = dorong(x, z + 0.3);
    if (maju.z > z + 0.01) { x = maju.x; z = maju.z; }
    else { /* macet (cemara di depan) — geser menyamping ke sisi barat */
      const geser = dorong(x - 0.3, z);
      x = geser.x;
    }
    if (x < -54.8) lewatSisi = lewatSisi || 'barat';
    if (x > -52.0) lewatSisi = lewatSisi || 'timur';
    assert.ok(!(x > -54.8 && x < -52.0 && z > 8.6 && z < 11.4), 'tidak menembus cemara di langkah ' + langkah + ' (x=' + x.toFixed(2) + ', z=' + z.toFixed(2) + ')');
  }
  assert.ok(z >= 17, 'sampai tepi selatan halaman (z=' + z.toFixed(1) + ', ' + langkah + ' langkah)');
  assert.ok(lewatSisi, 'memutar lewat sisi cemara (' + lewatSisi + ')');
});

test('Halaman E/F ronde 5: paving tengah beda motif (ubin hangat), ujung tetap andesit; medalion + cemara HERO; tanpa gazebo, tanpa mancur', () => {
  /* halaman dipecah 3: barat + timur andesit, tengah ubin tint hangat — kini selebar 16 m (ronde 4) */
  assert.match(HTML, /kt\(Kk, H\.selasar, 0xffffff, 8\.4, 0\.05, 16, -62\.6, 0\.025, 10, 1\.2\)/);
  assert.match(HTML, /kt\(Kk, H\.ubin, 0xead9b8, 10, 0\.05, 16, -53\.4, 0\.025, 10, 1\.2\)/);
  assert.match(HTML, /kt\(Kk, H\.selasar, 0xffffff, 8\.4, 0\.05, 16, -44\.2, 0\.025, 10, 1\.2\)/);
  assert.ok(!/kt\(Kk, H\.selasar, 0xffffff, 26\.8, 0\.05, 16, -53\.4, 0\.025, 10, 1\.2\)/.test(HTML), 'slab halaman tunggal sudah dipecah');
  assert.match(HTML, /RingGeometry\(1\.7, 2\.3, 32\)/, 'medalion cincin sekeliling cemara (border bedengan, dipertahankan ronde 5)');
  /* blok halaman E/F (cemara -> planter): tanpa gazebo, tanpa mancur; dengan cemara + bangku + planter */
  const awal = HTML.indexOf('/* --- Halaman Komplek Sebelah (ronde 5, 18 Nov): pohon CEMARA');
  const akhir = HTML.indexOf('[[6.5, 13], [23.5, 13], [17.5, 9]].forEach', awal);
  assert.ok(awal > 0 && akhir > awal, 'blok halaman E/F ketemu');
  const blok = HTML.slice(awal, akhir).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/gazebo/i.test(blok), 'tidak ada gazebo di halaman komplek sebelah');
  /* mancur DICABUT total (ronde 5): tidak ada basin, air biru, atau pancuran */
  assert.ok(!/0x45a5d8/.test(blok), 'tidak ada air mancur biru');
  assert.ok(!/TorusGeometry\(0\.93, 0\.05, 8, 32\)/.test(blok), 'tidak ada bibir basin mancur');
  assert.ok(!/CylinderGeometry\(0\.95, 1\.0, 0\.5, 24\)/.test(blok), 'tidak ada basin mancur');
  assert.ok(!/CylinderGeometry\(0\.85, 0\.85, 0\.02, 24\)/.test(blok), 'tidak ada cakram air mancur');
  /* cemara HERO: batang 2 tone + 5 lapis tajuk kerucut tumpuk, gradasi hijau gelap -> terang */
  assert.match(blok, /CylinderGeometry\(0\.2, 0\.28, 0\.25, 10\)/, 'pangkal batang cemara (tone gelap)');
  assert.match(blok, /CylinderGeometry\(0\.14, 0\.2, 1\.1, 10\)/, 'batang cemara (kulit kayu)');
  assert.match(blok, /ConeGeometry\(1\.3, 1\.6, 14\)/, 'tajuk cemara lapis 1 (paling lebar, paling gelap)');
  assert.match(blok, /ConeGeometry\(1\.05, 1\.45, 14\)/, 'tajuk cemara lapis 2');
  assert.match(blok, /ConeGeometry\(0\.8, 1\.3, 14\)/, 'tajuk cemara lapis 3');
  assert.match(blok, /ConeGeometry\(0\.55, 1\.15, 14\)/, 'tajuk cemara lapis 4');
  assert.match(blok, /ConeGeometry\(0\.3, 0\.7, 12\)/, 'pucuk cemara (runcing, paling terang)');
  assert.match(blok, /0x1e4d28/, 'tajuk lapis 1 hijau paling gelap');
  assert.match(blok, /0x27602f/, 'tajuk lapis 2 hijau gelap');
  assert.match(blok, /0x2e7338/, 'tajuk lapis 3 hijau tengah');
  assert.match(blok, /0x3a8a44/, 'tajuk lapis 4 hijau terang');
  assert.match(blok, /0x4a9e50/, 'pucuk hijau paling terang');
  /* tiap lapis diputar (ry) supaya natural — minimal 3 lapis punya ry != 0 */
  const putaran = [...blok.matchAll(/ConeGeometry\([^)]*\), -53\.\d+, [\d.]+, [\d.]+, 0, ([\d.]+), 0\)/g)].map((m) => parseFloat(m[1]));
  assert.ok(putaran.length >= 5, '5 lapis tajuk kerucut ketemu (' + putaran.length + ')');
  assert.ok(putaran.filter((r) => r !== 0).length >= 3, 'minimal 3 lapis diputar (ry != 0)');
  assert.match(blok, /G\.kayuA, 0xffffff, 1\.8, 0\.07, 0\.5, -55\.9, 0\.455, 3\.5/, 'bangku utara');
  assert.match(blok, /G\.kayuA, 0xffffff, 1\.8, 0\.07, 0\.5, -50\.9, 0\.455, 16\.5/, 'bangku selatan');
  assert.match(blok, /\[\[-65\.4, 3\.5\], \[-41\.4, 16\.5\]\]\.forEach/, '2 planter: barat laut + tenggara');
  assert.match(blok, /0x6b4a2f, 0\.7, 0\.02, 0\.7, p\[0\], 0\.41, p\[1\]/, 'tanah planter (warna M.soil)');
});

test('E&F: kunci KOSANE/KOSANF + pesan penuh E/F', () => {
  assert.match(HTML, /var KUNCI_KODE_LIST = \['KOSAN', 'KOSANBARU', 'KOSANC', 'KOSAND', 'KOSANE', 'KOSANF'\]/);
  assert.match(fungsi('daftarPesan'), /Gedung E penuh/);
  assert.match(fungsi('daftarPesan'), /Gedung F penuh/);
  assert.match(fungsi('daftarPesan'), /Kamar 41–50 terisi semua/);
  assert.match(fungsi('daftarPesan'), /Kamar 51–60 terisi semua/);
});

test('Ronde 8: konstanta taman utara + lapangan selatan — taman di utara jalan, lapangan standar 13,4x6,1 m di selatan jalan', () => {
  assert.deepEqual(F.TAMAN_UTARA, {
    bedeng: [{ x: -36, z: 5.3 }, { x: -30, z: 5.3 }, { x: -24, z: 5.3 }],
    pagar: { minX: -38, maxX: -22, minZ: -1.5, maxZ: -0.5 },
    pohon: [{ x: -38.5, z: -6 }, { x: -23.5, z: -10 }],
    bangku: [{ x: -33, z: 2.2, hadap: 'selatan' }, { x: -27, z: 2.2, hadap: 'selatan' }],
  }, 'taman utara: 3 bedeng + pagar hidup + 2 pohon + 2 bangku');
  assert.deepEqual(F.LAPANGAN_EF, {
    slab: { minX: -37.3, maxX: -22.7, minZ: 16.4, maxZ: 23.7 },
    garis: { minX: -36.7, maxX: -23.3, minZ: 17, maxZ: 23.1 },
    net: { x: -30, minZ: 17, maxZ: 23.1, tinggi: 1.55 },
    bangku: [{ x: -33, z: 15.2, hadap: 'selatan' }, { x: -27, z: 24.9, hadap: 'utara' }],
  }, 'lapangan selatan: slab + garis + net + 2 bangku tepi');
  /* lapangan standar: garis 13,4 x 6,1 m */
  assert.ok(dekat(F.LAPANGAN_EF.garis.maxX - F.LAPANGAN_EF.garis.minX, 13.4), 'panjang lapangan standar 13,4 m');
  assert.ok(dekat(F.LAPANGAN_EF.garis.maxZ - F.LAPANGAN_EF.garis.minZ, 6.1), 'lebar lapangan standar 6,1 m');
  /* slab = garis + apron 0,6 m di tiap sisi */
  assert.ok(dekat(F.LAPANGAN_EF.slab.minX, F.LAPANGAN_EF.garis.minX - 0.6), 'apron barat 0,6 m');
  assert.ok(dekat(F.LAPANGAN_EF.slab.maxX, F.LAPANGAN_EF.garis.maxX + 0.6), 'apron timur 0,6 m');
  assert.ok(dekat(F.LAPANGAN_EF.slab.minZ, F.LAPANGAN_EF.garis.minZ - 0.6), 'apron utara 0,6 m');
  assert.ok(dekat(F.LAPANGAN_EF.slab.maxZ, F.LAPANGAN_EF.garis.maxZ + 0.6), 'apron selatan 0,6 m');
  /* net di tengah garis (sumbu x) + tegak lurus memanjang z */
  assert.equal(F.LAPANGAN_EF.net.x, (F.LAPANGAN_EF.garis.minX + F.LAPANGAN_EF.garis.maxX) / 2, 'net di tengah lapangan (x)');
  assert.equal(F.LAPANGAN_EF.net.minZ, F.LAPANGAN_EF.garis.minZ, 'net dari batas utara');
  assert.equal(F.LAPANGAN_EF.net.maxZ, F.LAPANGAN_EF.garis.maxZ, 'net sampai batas selatan');
  /* taman di utara jalan (z < 8), lapangan di selatan jalan (z > 12) — tidak menutup jalan */
  for (const b of F.TAMAN_UTARA.bedeng) assert.ok(b.z < 7.7, 'bedeng di utara lampu jalan z 7,7 (x ' + b.x + ')');
  assert.ok(F.TAMAN_UTARA.pagar.maxZ < 7.7, 'pagar hidup di utara lampu jalan');
  assert.ok(F.LAPANGAN_EF.slab.minZ > 12.45, 'slab di selatan lampu jalan z 12,3');
  assert.ok(F.LAPANGAN_EF.slab.maxZ < 28, 'slab di dalam YARD (maxZ 28)');
  /* lapangan berpusat di strip selatan (x -40..-20, z 12..28) dengan ruang lega */
  assert.ok(F.LAPANGAN_EF.slab.minX >= -40 && F.LAPANGAN_EF.slab.maxX <= -20, 'slab di dalam strip selatan (x)');
  assert.ok(F.LAPANGAN_EF.slab.minZ - 12.45 >= 3, 'lega dari lampu jalan selatan');
});

test('Ronde 8: PLAZA_SOLIDS — bedeng/pagar/pohon/bangku taman + tiang net + bangku lapangan padat; jalan + permukaan lapangan bisa dilalui', () => {
  const ada = (k) => F.PLAZA_SOLIDS.some((s) => s.minX === k.minX && s.maxX === k.maxX && s.minZ === k.minZ && s.maxZ === k.maxZ);
  /* taman utara */
  assert.ok(ada({ minX: -38.25, maxX: -33.75, minZ: 4.2, maxZ: 6.4 }), 'bedeng bunga 1 padat');
  assert.ok(ada({ minX: -32.25, maxX: -27.75, minZ: 4.2, maxZ: 6.4 }), 'bedeng bunga 2 padat');
  assert.ok(ada({ minX: -26.25, maxX: -21.75, minZ: 4.2, maxZ: 6.4 }), 'bedeng bunga 3 padat');
  assert.ok(ada({ minX: -38, maxX: -22, minZ: -1.5, maxZ: -0.5 }), 'pagar hidup padat');
  assert.ok(ada({ minX: -39, maxX: -38, minZ: -6.5, maxZ: -5.5 }), 'pohon taman 1 padat');
  assert.ok(ada({ minX: -24, maxX: -23, minZ: -10.5, maxZ: -9.5 }), 'pohon taman 2 padat');
  assert.ok(ada({ minX: -33.9, maxX: -32.1, minZ: 1.92, maxZ: 2.45 }), 'bangku taman 1 padat');
  assert.ok(ada({ minX: -27.9, maxX: -26.1, minZ: 1.92, maxZ: 2.45 }), 'bangku taman 2 padat');
  /* lapangan selatan: hanya tiang net yang padat di atas slab */
  assert.ok(ada({ minX: -30.15, maxX: -29.85, minZ: 16.85, maxZ: 17.15 }), 'tiang net utara padat');
  assert.ok(ada({ minX: -30.15, maxX: -29.85, minZ: 22.95, maxZ: 23.25 }), 'tiang net selatan padat');
  assert.ok(ada({ minX: -33.9, maxX: -32.1, minZ: 14.92, maxZ: 15.45 }), 'bangku lapangan 1 padat');
  assert.ok(ada({ minX: -27.9, maxX: -26.1, minZ: 24.65, maxZ: 25.18 }), 'bangku lapangan 2 padat');
  /* jalan batu (x -40..-20, z 8..12) bebas — KUNCI E&F 19 Nov: yang tertutup
     hanya gerbangnya (solid palang di x -20,15..-19,85, di LUAR rentang jalan);
     permukaan jalan sendiri tetap tanpa solid. */
  assert.ok(!F.PLAZA_SOLIDS.some((s) => s.minX >= -40 && s.maxX <= -20 && s.minZ < 12 && s.maxZ > 8), 'jalan z 8..12 bebas (tidak ada solid di permukaan jalan)');
  /* permukaan lapangan bisa dilalui: satu-satunya solid di dalam slab = 2 tiang net */
  const diSlab = F.PLAZA_SOLIDS.filter((s) => s.minX < -22.7 && s.maxX > -37.3 && s.minZ < 23.7 && s.maxZ > 16.4);
  assert.equal(diSlab.length, 2, 'hanya 2 tiang net di atas slab (permukaan lapangan bebas dilalui)');
  /* posisi jalan + halaman di luar solid tetap sah; tiang net menolak via resolveAABB
     (mpValidasiPos TIDAK cek solid — hanya batas/realm — jadi uji padat pakai resolveAABB) */
  assert.ok(pos('yard', -30, 10), 'jalan batu sah');
  assert.ok(pos('yard', -30, 20.05), 'tengah lapangan sah (permukaan bisa dilalui)');
  const dorongTiang = F.resolveAABB(-30, 17, { minX: -30.15, maxX: -29.85, minZ: 16.85, maxZ: 17.15 }, 0.4, F.YARD);
  assert.ok(dorongTiang.x !== -30 || dorongTiang.z !== 17, 'tiang net utara mendorong keluar (padat)');
  const dorongTiangS = F.resolveAABB(-30, 23.1, { minX: -30.15, maxX: -29.85, minZ: 22.95, maxZ: 23.25 }, 0.4, F.YARD);
  assert.ok(dorongTiangS.x !== -30 || dorongTiangS.z !== 23.1, 'tiang net selatan mendorong keluar (padat)');
});

/* 22 Nov — palang celah dicabut: avatar jalan kaki LEWAT celah sampai halaman
   Komplek Tetangga (pendaftaran E&F tetap terkunci di server). */
test('Jalan kaki lewat celah pagar barat TEMBUS ke halaman Komplek Tetangga (palang dicabut 22 Nov)', () => {
  const solids = F.PLAZA_SOLIDS.concat(F.STAIR_SOLIDS);
  const dorong = (x, z) => {
    const c = F.collideBuilding(x, z); x = c.x; z = c.z;
    for (const s of solids) { const r = F.resolveAABB(x, z, s, 0.4, F.YARD); x = r.x; z = r.z; }
    return { x, z };
  };
  let x = -12, z = 10, langkah = 0;
  while (x > -45 && langkah < 600) {
    langkah++;
    const maju = dorong(x - 0.3, z);
    assert.ok(maju.x < x - 0.01, 'tidak macet di x=' + x.toFixed(1) + ', z=' + z.toFixed(1));
    x = maju.x; z = maju.z;
  }
  assert.ok(x <= -45, 'sampai halaman Komplek Tetangga (x=' + x.toFixed(1) + ')');
});

test('Ronde 8: jalan kaki melintasi lapangan utara-selatan — permukaan bisa dilalui, tiang net padat di samping', () => {
  const solids = F.PLAZA_SOLIDS.concat(F.STAIR_SOLIDS);
  const dorong = (x, z) => {
    const c = F.collideBuilding(x, z); x = c.x; z = c.z;
    for (const s of solids) { const r = F.resolveAABB(x, z, s, 0.4, F.YARD); x = r.x; z = r.z; }
    return { x, z };
  };
  let x = -25.5, z = 15, langkah = 0, lewatSlab = false;
  while (z < 25 && langkah < 600) {
    langkah++;
    const maju = dorong(x, z + 0.3);
    if (maju.z > z + 0.01) { x = maju.x; z = maju.z; }
    else { /* macet — geser menyamping ke barat (jauhi bangku lapangan 2) */
      const geser = dorong(x - 0.3, z);
      x = geser.x;
    }
    if (z > 16.4 && z < 23.7) lewatSlab = true;
    assert.ok(x > -26.5 && x < -24.5, 'tetap di jalur lapangan (x=' + x.toFixed(2) + ', z=' + z.toFixed(2) + ')');
  }
  assert.ok(z >= 25, 'sampai tepi selatan lapangan (z=' + z.toFixed(1) + ', ' + langkah + ' langkah)');
  assert.ok(lewatSlab, 'melewati permukaan slab lapangan');
});

test('Ronde 8: geometri taman + lapangan (detail hero) — slab hijau, garis putih lengkap, net berjaring, bunga 5 warna, pohon tajuk pipih', () => {
  const awal = HTML.indexOf('/* --- TAMAN utara jalan akses (ronde 8');
  const akhir = HTML.indexOf('[[6.5, 13], [23.5, 13], [17.5, 9]].forEach', awal);
  assert.ok(awal > 0 && akhir > awal, 'blok ronde 8 ketemu');
  const blok = HTML.slice(awal, akhir).replace(/\/\*[\s\S]*?\*\//g, '');
  /* lapangan: slab hijau beda tone dari andesit jalan + rumput */
  assert.match(blok, /kt\(Kk, G\.polos, 0x35785a, 14\.6, 0\.05, 7\.3, -30, 0\.025, 20\.05, 1\.2\)/, 'slab lapangan hijau 14,6x7,3');
  /* garis putih lengkap: batas (2 panjang + 2 pendek) + tunggal (2) + servis pendek (2) + tengah (2) */
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 13\.4, 0\.006, 0\.05, -30, 0\.053, 17, 1\)/, 'garis batas utara');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 13\.4, 0\.006, 0\.05, -30, 0\.053, 23\.1, 1\)/, 'garis batas selatan');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 0\.05, 0\.006, 6\.1, -36\.7, 0\.053, 20\.05, 1\)/, 'garis batas barat');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 0\.05, 0\.006, 6\.1, -23\.3, 0\.053, 20\.05, 1\)/, 'garis batas timur');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 13\.4, 0\.006, 0\.05, -30, 0\.053, 17\.46, 1\)/, 'garis tunggal utara');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 13\.4, 0\.006, 0\.05, -30, 0\.053, 22\.64, 1\)/, 'garis tunggal selatan');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 0\.05, 0\.006, 6\.1, -31\.98, 0\.053, 20\.05, 1\)/, 'garis servis pendek barat');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 0\.05, 0\.006, 6\.1, -28\.02, 0\.053, 20\.05, 1\)/, 'garis servis pendek timur');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 4\.72, 0\.006, 0\.05, -34\.34, 0\.053, 20\.05, 1\)/, 'garis tengah barat');
  assert.match(blok, /kt\(Kk, G\.polos, 0xffffff, 4\.72, 0\.006, 0\.05, -25\.66, 0\.053, 20\.05, 1\)/, 'garis tengah timur');
  /* net: tiang hitam 1,55 m + pita atas + 11 tali vertikal + 2 horizontal */
  assert.match(blok, /kt\(K, G\.polos, HITAM, 0\.1, 1\.55, 0\.1, -30, 0\.825, z\)/, 'tiang net 1,55 m');
  assert.match(blok, /kt\(K, G\.polos, 0xffffff, 0\.02, 0\.08, 6\.1, -30, 1\.51, 20\.05\)/, 'pita atas net');
  assert.match(blok, /17\.275 \+ ni \* 0\.55/, '11 tali vertikal jaring net');
  assert.match(blok, /\[0\.55, 1\.05\]\.forEach/, '2 tali horizontal jaring net');
  /* taman: bedeng 3x + pagar hidup + bunga 5 warna + pohon tajuk pipih */
  assert.match(blok, /\[\[-36, 5\.3\], \[-30, 5\.3\], \[-24, 5\.3\]\]\.forEach/, '3 bedeng bunga');
  assert.match(blok, /kt\(K, H\.pagar, 0xffffff, 16, 0\.9, 1, -30, 0\.6, -1, 0\.5\)/, 'pagar hidup 16 m');
  assert.match(blok, /0xe78fb3/, 'bunga pink');
  assert.match(blok, /0xf2c94c/, 'bunga kuning');
  assert.match(blok, /0xe67e22/, 'bunga oranye');
  assert.match(blok, /0x9b59b6/, 'bunga ungu');
  assert.match(blok, /CylinderGeometry\(0\.02, 0\.02, fh - 0\.36, 6\)/, 'tangkai bunga (tidak melayang; ronde 9: tebal 0,02)');
  assert.match(blok, /SphereGeometry\(1\.15, 14, 10\)\.scale\(1, 0\.55, 1\)/, 'tajuk pipih bawah pohon taman (cakram, bukan bola/kerucut)');
  assert.match(blok, /SphereGeometry\(0\.8, 12, 9\)\.scale\(1, 0\.55, 1\)/, 'tajuk pipih atas pohon taman');
  assert.match(blok, /0x2e6b34/, 'tajuk bawah hijau gelap');
  assert.match(blok, /0x4a9e50/, 'tajuk atas hijau terang');
  /* bangku: 2 taman (z 2,2) + 2 lapangan (z 15,2 / 24,9) — pola HL_BANGKU */
  assert.match(blok, /G\.kayuA, 0xffffff, 1\.8, 0\.07, 0\.5, x, 0\.455, 2\.2, 1/, 'bangku taman (dudukan)');
  assert.match(blok, /G\.kayuA, 0xffffff, 1\.8, 0\.07, 0\.5, -33, 0\.455, 15\.2, 1/, 'bangku lapangan 1 (dudukan)');
  assert.match(blok, /G\.kayuA, 0xffffff, 1\.8, 0\.07, 0\.5, -27, 0\.455, 24\.9, 1/, 'bangku lapangan 2 (dudukan)');
});

test('Ronde 9: bedeng bunga RIMBUN (bukan kotak tanah cokelat) + net TEGANG (tali bawah lurus, tidak menggantung)', () => {
  const awal = HTML.indexOf('/* --- TAMAN utara jalan akses (ronde 8');
  const akhir = HTML.indexOf('[[6.5, 13], [23.5, 13], [17.5, 9]].forEach', awal);
  assert.ok(awal > 0 && akhir > awal, 'blok ronde 8/9 ketemu');
  const blok = HTML.slice(awal, akhir).replace(/\/\*[\s\S]*?\*\//g, '');
  /* bedeng rimbun: groundcover 24 bola daun pipih per bedeng menutupi tanah */
  assert.match(blok, /for \(var gi = 0; gi < 24; gi\+\+\)/, 'groundcover 24 bola daun per bedeng');
  assert.match(blok, /SphereGeometry\(0\.24, 10, 8\)\.scale\(1, 0\.55, 1\)/, 'bola daun pipih groundcover (bukan titik)');
  /* rumpun bunga: 6 kelompok x 4 kepala besar (r 0,13, bukan titik r 0,07) + roset daun */
  assert.match(blok, /SphereGeometry\(0\.13, 10, 8\)/, 'kepala bunga besar r 0,13 (kebaca dari jalan)');
  assert.match(blok, /for \(var fi = 0; fi < 4; fi\+\+\)/, '4 kepala bunga per rumpun (bergerombol)');
  assert.match(blok, /var tinggi = g\[1\] < 0 \? 0\.66 : 0\.52/, 'rumpun belakang lebih tinggi dari depan (berlapis)');
  assert.match(blok, /SphereGeometry\(0\.24, 10, 8\)\.scale\(1, 0\.5, 1\)/, 'roset daun bawah tiap rumpun');
  assert.ok(!/SphereGeometry\(0\.07, 8, 6\)/.test(blok), 'tidak ada lagi bunga titik r 0,07');
  assert.ok(!/CylinderGeometry\(0\.015, 0\.015, 0\.35, 6\)/.test(blok), 'tidak ada lagi tangkai tipis ronde 8');
  /* 5 warna bunga tetap ada */
  for (const w of ['0xe78fb3', '0xf2c94c', '0xffffff', '0xe67e22', '0x9b59b6']) assert.ok(blok.includes(w), 'warna bunga ' + w);
  /* net tegang: pita bawah lurus + tali vertikal pita-bawah->pita-atas + horizontal tebal 0,03 */
  assert.match(blok, /kt\(K, G\.polos, 0xffffff, 0\.02, 0\.06, 6\.1, -30, 0\.13, 20\.05\)/, 'pita bawah net (tepi bawah garis lurus)');
  assert.match(blok, /kt\(K, G\.polos, 0xffffff, 0\.02, 1\.32, 0\.02, -30, 0\.81, 17\.275 \+ ni \* 0\.55\)/, 'tali vertikal 0,15..1,47 (pita bawah ke pita atas)');
  assert.match(blok, /kt\(K, G\.polos, 0xffffff, 0\.03, 0\.03, 6\.1, -30, y, 20\.05\)/, 'tali horizontal tebal 0,03 (mendatar, tidak menggantung)');
  assert.ok(!/kt\(K, G\.polos, 0xffffff, 0\.015, 0\.015, 6\.1, -30, y, 20\.05\)/.test(blok), 'tidak ada lagi tali horizontal tipis 0,015 ronde 8');
  assert.match(blok, /kt\(K, G\.polos, 0xffffff, 0\.02, 0\.08, 6\.1, -30, 1\.51, 20\.05\)/, 'pita atas net tetap');
});
