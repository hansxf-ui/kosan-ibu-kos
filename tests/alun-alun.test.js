'use strict';
/* Tes layout alun-alun (Rapihin area tengah, 15 Nov). Data + fungsi tabrakan
   diambil VERBATIM dari index.html; jalur dicek dengan BFS di grid 0,2 m
   memakai aturan tabrakan avatar tanah yang sama dengan animate()
   (collideBuilding + TABLE_BOX + PLAZA_SOLIDS + STAIR_SOLIDS, radius 0,4).
   Jalankan: node --test tests/alun-alun.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + '\nreturn { YARD, BUILDING, BUILDING_B, BUILDING_C, BUILDING_D, TABLE_BOX, STAIR_SOLIDS, PLAZA_SOLIDS, PARKIR_POS, POHON_SELATAN, LAMPU_SELATAN, BEDENG_SELATAN_PAGAR, collideBuilding };')();
const R = 0.4;
const dalam = (x, z, k, r) => x > k.minX - r && x < k.maxX + r && z > k.minZ - r && z < k.maxZ + r;
const jarakKotak = (a, b) => Math.hypot(Math.max(0, a.minX - b.maxX, b.minX - a.maxX), Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ));
/* titik bebas untuk avatar tanah: di dalam halaman, tidak di dalam gedung/perabot (+ radius) */
function bebas(x, z) {
  const Y = F.YARD;
  if (x < Y.minX || x > Y.maxX || z < Y.minZ || z > Y.maxZ) return false;
  for (const B of [F.BUILDING, F.BUILDING_B, F.BUILDING_C, F.BUILDING_D, F.TABLE_BOX]) if (dalam(x, z, B, R)) return false;
  for (const s of F.PLAZA_SOLIDS.concat(F.STAIR_SOLIDS)) if (dalam(x, z, s, R)) return false;
  return true;
}
const STEP = 0.2;
const sel = (v, o) => Math.round((v - o) / STEP);
function bfs(x0, z0) {
  const Y = F.YARD, nx = sel(Y.maxX, Y.minX) + 1, nz = sel(Y.maxZ, Y.minZ) + 1;
  const sudah = new Uint8Array(nx * nz), antre = [];
  const pos = (i, j) => [Y.minX + i * STEP, Y.minZ + j * STEP];
  const i0 = sel(x0, Y.minX), j0 = sel(z0, Y.minZ);
  assert.ok(bebas(...pos(i0, j0)), 'titik awal bebas ' + x0 + ',' + z0);
  sudah[j0 * nx + i0] = 1; antre.push(i0, j0);
  for (let h = 0; h < antre.length; h += 2) {
    const i = antre[h], j = antre[h + 1];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || sudah[b * nx + a]) continue;
      if (!bebas(...pos(a, b))) continue;
      sudah[b * nx + a] = 1; antre.push(a, b);
    }
  }
  return (x, z) => sudah[sel(z, Y.minZ) * nx + sel(x, Y.minX)] === 1;
}
const dariSpawn = bfs(0, 12);
const kodeTree = [...antara('function buildWorld() {', '/* ---------- ruang tamu DALAM').matchAll(/\btree\((-?[\d.]+), (-?[\d.]+)\)/g)].map((m) => [+m[1], +m[2]]);
const lampu = JSON.parse(HTML.match(/(\[\[-11, -3\], \[41, -3\]\])\.concat\(LAMPU_SELATAN\)\.forEach\(function \(p\) \{\s*cyl\(M\.steelDark, 0\.09/)[1]);
const bedengSelatan = F.PLAZA_SOLIDS.filter((s) => s.minZ === 12 && s.maxZ === 14);

/* susunan asli parkiran (pusat 10, 15, terbuka ke utara) -> diputar +90 deg di (40, 6) */
const putar = (k) => { const P = F.PARKIR_POS;
  const xs = [k.minZ - P.asalZ, k.maxZ - P.asalZ].map((dz) => P.x + dz), zs = [k.minX - P.asalX, k.maxX - P.asalX].map((dx) => P.z - dx);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }; };
const sama = (a, b) => ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const PARKIR_ASLI = [
  { minX: 4.35, maxX: 4.65, minZ: 13.35, maxZ: 13.65 }, { minX: 9.85, maxX: 10.15, minZ: 13.35, maxZ: 13.65 }, { minX: 15.35, maxX: 15.65, minZ: 13.35, maxZ: 13.65 },
  { minX: 4.35, maxX: 4.65, minZ: 16.35, maxZ: 16.65 }, { minX: 9.85, maxX: 10.15, minZ: 16.35, maxZ: 16.65 }, { minX: 15.35, maxX: 15.65, minZ: 16.35, maxZ: 16.65 },
  { minX: 3.75, maxX: 4.25, minZ: 13, maxZ: 17 }, { minX: 15.75, maxX: 16.25, minZ: 13, maxZ: 17 }, { minX: 4, maxX: 16, minZ: 16.75, maxZ: 17.25 }];

test('alun-alun: parkiran di ujung TIMUR plaza, terbuka MENGHADAP BARAT (jemuran), pas di antara sudut bedeng utara + selatan', () => {
  assert.deepEqual(F.PARKIR_POS, { x: 40, z: 6, asalX: 10, asalZ: 15, rotY: Math.PI / 2 });
  for (const k of PARKIR_ASLI) {
    assert.ok(!F.PLAZA_SOLIDS.some((s) => sama(s, k)), 'posisi lama hilang ' + JSON.stringify(k));
    assert.ok(F.PLAZA_SOLIDS.some((s) => sama(s, putar(k))), 'posisi baru ' + JSON.stringify(putar(k)));
  }
  /* sisi terbuka asli = utara (z 13) -> sesudah diputar = barat (x 38): tidak ada pagar tanaman di x 38 sepanjang z 0..12 */
  const pagar = PARKIR_ASLI.slice(6).map(putar);
  assert.ok(!pagar.some((k) => k.maxX - k.minX < 1 && k.minX < 38.5), 'sisi barat terbuka');
  assert.ok(pagar.some((k) => k.minX === 41.75 && k.minZ === 0 && k.maxZ === 12), 'punggung di timur (x 42)');
  /* pas di antara sudut: pagar ujung menempel bedeng utara (z 0) + bedeng selatan (z 12) */
  const zs = pagar.filter((k) => k.maxX - k.minX > 3).map((k) => (k.minZ + k.maxZ) / 2).sort((a, b) => a - b);
  assert.deepEqual(zs, [0, 12]);
  /* menghadap jemuran: jemuran di ujung barat plaza, segaris dengan bukaan parkiran */
  assert.ok(F.PLAZA_SOLIDS.some((s) => s.minX === -16.6 && s.minZ === 0.9), 'jemuran tetap');
  /* grup diputar di kode (papan PARKIR ikut menghadap barat) */
  assert.match(HTML, /parkirGrup\.rotation\.y = PARKIR_POS\.rotY;/);
  assert.match(HTML, /scene\.children\.slice\(awalParkir\)\.forEach\(function \(m\) \{\s*m\.position\.x -= PARKIR_POS\.asalX; m\.position\.z -= PARKIR_POS\.asalZ;\s*parkirGrup\.add\(m\);/);
});

test('alun-alun: parkiran tidak nempel gedung dan tidak di sumbu gerbang -> gazebo', () => {
  const parkir = { minX: 38, maxX: 42.25, minZ: -0.25, maxZ: 12.25 };
  assert.ok(jarakKotak(parkir, F.BUILDING_D) >= 6, 'ke D ' + jarakKotak(parkir, F.BUILDING_D));
  assert.ok(jarakKotak(parkir, F.BUILDING_B) >= 5, 'ke dinding B ' + jarakKotak(parkir, F.BUILDING_B));
  const balkonB = { minX: 18, maxX: 45.6, minZ: -6, maxZ: -4.2 };
  assert.ok(jarakKotak(parkir, balkonB) >= 3.9, 'ke balkon B ' + jarakKotak(parkir, balkonB));
  assert.ok(parkir.minX > 18, 'jauh dari sumbu x 12..16');
});

test('alun-alun: jalur gerbang x 15 TEMBUS dari gerbang sampai plaza/gazebo (jalan lurus ke utara)', () => {
  let x = 15, z = 28;
  for (let k = 0; k < 400; k++) {
    let nz = z - 0.05, nx = x;
    const c = F.collideBuilding(nx, nz); nx = c.x; nz = c.z;
    for (const s of [F.TABLE_BOX].concat(F.PLAZA_SOLIDS, F.STAIR_SOLIDS)) if (dalam(nx, nz, s, R)) { nz = z; nx = x; }
    if (nz === z) break;
    z = nz;
  }
  assert.ok(Math.abs(x - 15) < 1e-9 && z <= 10.1, 'berhenti di z ' + z + ' (kolom tenggara gazebo z 9,65 + radius)');
  assert.match(HTML, /box\(M\.path, 2\.4, 0\.06, 15\.1, 15, 0\.03, 21\.45\)/, 'setapak gerbang z 13,9..29');
  assert.ok(dariSpawn(15, 28), 'gerbang terhubung ke spawn');
});

test('alun-alun: semua pintu lantai dasar C (K21-K25) + D (K31-K35) terjangkau dari spawn dan dari gerbang', () => {
  const dariGerbang = bfs(15, 28);
  for (const x of [-11, -6, -1, 4, 9, 21, 26, 31, 36, 41]) {
    assert.ok(dariSpawn(x, 18.2) && dariGerbang(x, 18.2), 'depan pintu x ' + x);
  }
  /* lorong depan C/D sekarang lebar (bedeng selatan z 14 + r .. dinding 18,6 - r) */
  for (const x of [-11, 4, 9, 21, 41]) for (let z = 14.6; z <= 18.2; z += 0.4) assert.ok(bebas(x, z), 'lorong depan ' + x + ',' + z.toFixed(1));
});

test('alun-alun: tidak ada kantong terjebak — tempat penting saling terhubung', () => {
  const tempat = { 'pintu A K1': [-11, -5], 'pintu B K11': [21, -5], 'tengah gazebo timur': [16.2, 6.5], 'jemuran': [-15.5, 4], 'dalam parkiran': [40, 6], 'bukaan parkiran (barat)': [37.4, 6],
    'timur parkiran': [44, 7], 'kaki tangga C': [-15.0, 26.9], 'lorong belakang D': [40, 27.7], 'depan Ibu Kos (jalur depan A)': [10.5, -3.4], 'sisi selatan plaza': [20, 11] };
  for (const [n, p] of Object.entries(tempat)) assert.ok(dariSpawn(p[0], p[1]), n);
});

test('alun-alun: bedeng tepi selatan (cermin utara) membingkai plaza, celah di jalan tengah + jalur gerbang', () => {
  assert.equal(bedengSelatan.length, 3);
  assert.deepEqual(bedengSelatan.map((s) => [s.minX, s.maxX]), [[-12, -1.2], [1.2, 13.3], [16.7, 42]]);
  const utara = F.PLAZA_SOLIDS.filter((s) => s.minZ === -2 && s.maxZ === 0);
  assert.equal(utara.length, 3, 'bedeng utara tidak berubah');
  assert.ok(!F.PLAZA_SOLIDS.some((s) => s.minX === -18 && s.minZ === 16), 'bedeng pagar selatan lama tetap tidak ada');
  for (const x of [-0.7, 0, 0.7, 13.9, 15, 16.1]) assert.ok(bebas(x, 13), 'celah x ' + x);
});

test('alun-alun: pohon + lampu tertata — batang/tiang di CELAH pagar tanaman, tidak menembus; tajuk bebas balkon + atap parkir', () => {
  assert.ok(!kodeTree.some(([x, z]) => z === 15), 'pohon (-4,15) + (-8,15) sudah dipindah');
  assert.match(HTML, /POHON_SELATAN\.forEach\(function \(t\) \{ tree\(t\[0\], t\[1\]\); \}\);/);
  assert.deepEqual(F.POHON_SELATAN, [[-6, 13], [6, 13], [24, 13], [34, 13]]);
  assert.deepEqual(F.LAMPU_SELATAN, [[-11.6, 13], [12.9, 13], [17.1, 13], [41.6, 13]]);
  const pagar = F.BEDENG_SELATAN_PAGAR;
  for (const [x, z] of F.POHON_SELATAN) {
    assert.ok(bedengSelatan.some((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ), 'pohon di tanah bedeng ' + x);
    assert.ok(pagar.every(([a, b]) => x + 0.3 + 0.35 <= a || x - 0.3 - 0.35 >= b), 'batang (r 0,3) bebas pagar tanaman >= 0,35 m: ' + x);
    assert.ok(z + 1.5 < 16.8 - 2, 'tajuk jauh dari pagar kaca balkon');
    assert.ok(x + 1.5 <= 38 - 0.4 || x - 1.5 >= 42, 'tajuk bebas atap parkiran: ' + x);
  }
  for (const [x] of F.LAMPU_SELATAN) {
    assert.ok(bedengSelatan.some((s) => x > s.minX + 0.3 && x < s.maxX - 0.3), 'lampu di tanah bedeng ' + x);
    assert.ok(pagar.every(([a, b]) => x + 0.09 + 0.3 <= a || x - 0.09 - 0.3 >= b), 'tiang lampu bebas pagar tanaman: ' + x);
  }
  /* pagar tanaman tetap di dalam tanah bedeng + celah jalan tengah / jalur gerbang tetap terbuka */
  for (const [a, b] of pagar) assert.ok(bedengSelatan.some((s) => a >= s.minX - 1e-9 && b <= s.maxX + 1e-9), 'pagar ' + a + '..' + b);
  assert.ok(lampu.length === 2 && lampu[0][0] === -11 && lampu[1][0] === 41, 'lampu utara tetap');
  /* gazebo, jemuran, spawn tidak berubah */
  assert.ok(F.PLAZA_SOLIDS.some((s) => s.minX === 11.2 && s.maxX === 12.8 && s.minZ === 6.1 && s.maxZ === 6.9), 'meja gazebo');
  assert.ok(F.PLAZA_SOLIDS.some((s) => s.minX === -16.6 && s.minZ === 0.9), 'jemuran');
  assert.match(HTML, /var avatar, avatarLabel, avatarPos = \{ x: 0, z: 12 \};/);
});
