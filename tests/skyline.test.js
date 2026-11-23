'use strict';
/* Tes pengunci "skyline Kota terlihat dari area kos" (Ryan 23 Nov). Blok murni SKYLINE-KOS (+ SUASANA untuk acak bersemai)
   diambil VERBATIM dari index.html. Jalankan: node --test tests/skyline.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const SUASANA = antara('/* ==== SUASANA-START ==== */', '/* ==== SUASANA-END ==== */');
const BLOK = antara('/* ==== SKYLINE-KOS-START ==== */', '/* ==== SKYLINE-KOS-END ==== */');
const M = new Function(SUASANA + BLOK + '\nreturn { D: skylineKosData(), D2: skylineKosData(), S: SKYLINE_KOS };')();
const { A, B, menara } = M.D, S = M.S;
const derajat = (G, v) => Math.atan2(G.pos[v * 3], -G.pos[v * 3 + 2]) * 180 / Math.PI;

function terbalik(G) { /* segitiga yang TIDAK menghadap pusat (kamera ada di pusat grup langit) */
  let n = 0;
  for (let i = 0; i < G.idx.length; i += 3) {
    const a = G.idx[i] * 3, b = G.idx[i + 1] * 3, c = G.idx[i + 2] * 3, p = G.pos;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * p[a] + ny * p[a + 1] + nz * p[a + 2] >= -1e-9) n++;
  }
  return n;
}
function tumpang(G) { /* pasangan segitiga satu lapis (jari-jari sama) yang saling menutupi di bidang (arah, tinggi) = bidang berimpit */
  const T = [];
  for (let i = 0; i < G.idx.length; i += 3) {
    const v = [G.idx[i], G.idx[i + 1], G.idx[i + 2]], P = v.map((k) => [derajat(G, k) * 2.2, G.pos[k * 3 + 1]]); /* 1 derajat ~ 2,2 m */
    const luas = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1])) / 2;
    if (luas < 1e-6) continue;
    T.push({ P, l: G.lapis[v[0]], x0: Math.min(P[0][0], P[1][0], P[2][0]), x1: Math.max(P[0][0], P[1][0], P[2][0]), y0: Math.min(P[0][1], P[1][1], P[2][1]), y1: Math.max(P[0][1], P[1][1], P[2][1]) });
  }
  const pisah = (P, Q, eps) => { /* ada sisi P yang memisahkan Q (dengan kelonggaran eps) */
    for (let i = 0; i < 3; i++) {
      const a = P[i], b = P[(i + 1) % 3], c = P[(i + 2) % 3]; let nx = b[1] - a[1], ny = a[0] - b[0]; const L = Math.hypot(nx, ny); nx /= L; ny /= L;
      const sisi = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny > 0 ? 1 : -1; let semuaLuar = true;
      for (const q of Q) if (((q[0] - a[0]) * nx + (q[1] - a[1]) * ny) * sisi > eps) { semuaLuar = false; break; }
      if (semuaLuar) return true;
    }
    return false;
  };
  const hasil = [];
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j]; if (a.l !== b.l) continue;
    if (a.x0 > b.x1 - 0.01 || b.x0 > a.x1 - 0.01 || a.y0 > b.y1 - 0.01 || b.y0 > a.y1 - 0.01) continue;
    if (pisah(a.P, b.P, 0.01) || pisah(b.P, a.P, 0.01)) continue;
    hasil.push([a.P, b.P]);
  }
  return { n: T.length, hasil };
}

test('skyline kos: ringan — total <= 3.000 segitiga, 2 mesh (<= 3 draw call), deterministik', () => {
  const tris = (A.idx.length + B.idx.length) / 3;
  assert.ok(tris > 600 && tris <= 3000, 'segitiga skyline: ' + tris);
  assert.deepEqual(M.D.A.pos, M.D2.A.pos, 'sama di semua HP (acak bersemai)');
  const bangun = fungsi('skylineKosBangun');
  assert.equal((bangun.match(/new THREE\.Mesh\(/g) || []).length, 2, 'tepat 2 mesh = 2 draw call');
  assert.equal((bangun.match(/induk\.add\(/g) || []).length, 2);
  for (const k of ['pos', 'uv', 'cat', 'kabut', 'lapis']) assert.ok(A[k].every(Number.isFinite), 'A.' + k + ' angka sah');
  for (const k of ['pos', 'uv', 'warna']) assert.ok(B[k].every(Number.isFinite), 'B.' + k + ' angka sah');
  assert.equal(A.pos.length / 3, A.kabut.length); assert.equal(A.pos.length, A.cat.length); assert.equal(A.pos.length / 3 * 2, A.uv.length);
  assert.ok(Math.max(...A.idx) < A.pos.length / 3 && Math.max(...B.idx) < B.pos.length / 3);
});

test('skyline kos: winding 0 terbalik + 0 bidang berimpit / bertumpang dalam satu lapis (kedip di HP = bidang berimpit)', () => {
  assert.equal(terbalik(A), 0, 'badan: semua segitiga menghadap kamera');
  assert.equal(terbalik(B), 0, 'jendela: semua segitiga menghadap kamera');
  const a = tumpang(A), b = tumpang(B);
  assert.ok(a.n > 500);
  assert.equal(a.hasil.length, 0, 'badan bertumpang: ' + JSON.stringify(a.hasil.slice(0, 2)));
  assert.equal(b.hasil.length, 0, 'jendela / lampu bertumpang: ' + JSON.stringify(b.hasil.slice(0, 2)));
  /* kontrol positif: pengaudit menangkap bidang ganda */
  const G = { pos: A.pos.slice(0, 12).concat(A.pos.slice(0, 12)), idx: [0, 1, 2, 4, 5, 6], lapis: [0, 0, 0, 0, 0, 0, 0, 0] };
  assert.equal(tumpang(G).hasil.length, 1, 'kontrol: dua segitiga berimpit tertangkap');
  /* lapis terpisah >= 8 m; jendela 1,5 m di depan badannya (bukan berimpit), searah sinar yang sama */
  const R = S.lapis.map((l) => l.R).sort((x, y) => x - y);
  for (let i = 1; i < R.length; i++) assert.ok(R[i] - R[i - 1] >= 8, 'jarak antar lapis');
  assert.ok(S.maju >= 1 && S.maju < 8);
  for (let v = 0; v < B.pos.length / 3; v++) { const r = Math.hypot(B.pos[v * 3], B.pos[v * 3 + 2]), L = S.lapis[B.lapis[v]]; assert.ok(Math.abs(r - (L.R - S.maju)) < 1e-6, 'jendela di R - maju'); }
});

test('skyline kos: masuk akal — Kota di TIMUR (halaman + Jalan Kampung sama), di luar kabut, di depan bintang + kubah, kaki menyatu', () => {
  assert.equal(S.arah, 90, 'pusat skyline = timur (+x)');
  const b = []; for (let v = 0; v < A.pos.length / 3; v++) b.push(derajat(A, v));
  assert.ok(Math.min(...b) >= 20 && Math.max(...b) <= 160, 'busur di sisi timur saja: ' + Math.min(...b).toFixed(0) + '..' + Math.max(...b).toFixed(0));
  for (const L of S.lapis) { assert.ok(L.R > 110, 'di luar jarak kabut halaman (110 m) -> digambar tanpa kabut scene, pudar manual'); assert.ok(L.R < 140, 'di depan bintang (r 140) + kubah langit (r 150)'); assert.ok(L.R < 200, 'di dalam far kamera'); }
  const kabut = S.lapis.map((l) => l.kabut); assert.ok(kabut[0] > kabut[1] && kabut[1] > kabut[2] && S.lapis[0].R > S.lapis[1].R && S.lapis[1].R > S.lapis[2].R, '3 lapis: makin jauh makin berkabut');
  assert.equal(new Set(A.lapis).size, 3);
  /* kabut per verteks: kaki (y <= 0) hampir penuh, puncak = kabut lapisnya; dasar rok = penuh (menyatu dengan langit) */
  for (let v = 0; v < A.kabut.length; v++) {
    const y = A.pos[v * 3 + 1], K = S.lapis[A.lapis[v]].kabut;
    assert.ok(A.kabut[v] >= K - 1e-9 && A.kabut[v] <= 1 + 1e-9);
    if (y <= S.dasar + 1e-6) assert.ok(A.kabut[v] >= 0.999, 'dasar rok kabut penuh');
    if (y <= 0) assert.ok(A.kabut[v] >= K + (1 - K) * 0.89, 'kaki menara tenggelam kabut');
  }
  const fn = fungsi('kotaLangitSkala'); assert.ok(fn.length > 0);
  assert.ok(/KE PERON/.test(HTML) && /KOTA_SPAWN = \{ x: -79, z: 0, rot: Math\.PI \/ 2 \}/.test(HTML), 'petunjuk arah: stasiun di ujung barat Kota, pemain tiba menghadap timur');
});

test('skyline kos: terbaca sebagai Kota yang sama — Menara Kembar berjembatan di tengah, menara bermahkota, menara TV, ragam bentuk + tinggi', () => {
  const dekat = menara.filter((m) => m.lapis === 'dekat'), jenis = new Set(menara.map((m) => m.jenis));
  const kembar = dekat.find((m) => m.jenis === 'kembar'), mahkota = dekat.find((m) => m.jenis === 'mahkota'), tv = dekat.find((m) => m.jenis === 'tv');
  assert.ok(kembar && mahkota && tv);
  assert.ok(Math.abs((kembar.b0 + kembar.b1) / 2 - 90) < 0.01, 'Menara Kembar tepat di timur');
  assert.ok(kembar.tinggi >= Math.max(...menara.filter((m) => m.jenis !== 'tv').map((m) => m.tinggi)), 'Menara Kembar = gedung tertinggi (selain menara TV)');
  assert.ok(jenis.size >= 8, 'ragam bentuk: ' + [...jenis].join(', '));
  assert.ok(menara.length >= 45, 'jumlah menara: ' + menara.length);
  for (const m of menara) assert.ok(m.tris >= 6, m.jenis + ' bukan kotak polos (>= 6 segitiga badan): ' + m.tris);
  const rata = menara.reduce((s, m) => s + m.tris, 0) / menara.length; assert.ok(rata >= 9, 'rata-rata segitiga per menara: ' + rata.toFixed(1));
  const t = menara.map((m) => m.tinggi); assert.ok(Math.max(...t) / Math.min(...t) >= 4, 'variasi tinggi');
  /* tinggi sudut: terlihat di atas pagar / tembok dari kamera bawaan, tapi tidak menjulang tak wajar */
  for (const m of dekat) { const L = S.lapis[2], el = Math.atan2(m.tinggi, L.R) * 180 / Math.PI; assert.ok(el >= 4 && el <= 18, m.jenis + ' elevasi ' + el.toFixed(1)); }
  /* amplop: tepi busur lebih rendah daripada tengah (skyline memuncak di pusat kota) */
  const tengah = menara.filter((m) => m.lapis !== 'dekat' && Math.abs((m.b0 + m.b1) / 2 - 90) < 20), tepi = menara.filter((m) => m.lapis !== 'dekat' && Math.abs((m.b0 + m.b1) / 2 - 90) > 45);
  const avg = (a) => a.reduce((s, m) => s + m.tinggi, 0) / a.length; assert.ok(avg(tengah) > avg(tepi) * 1.5);
  /* kisi jendela: badan memakai uv kisi (bukan polos) + ada jendela menyala per lapis + suar merah */
  let kisi = 0; for (let v = 0; v < A.uv.length / 2; v++) if (!(A.uv[v * 2] === 0.02 && A.uv[v * 2 + 1] === 0.02)) kisi++;
  assert.ok(kisi > A.uv.length / 2 * 0.4, 'verteks ber-kisi jendela: ' + kisi);
  assert.equal(new Set(B.lapis).size, 3, 'jendela menyala di ketiga lapis');
  let merah = 0; for (let v = 0; v < B.warna.length / 3; v++) if (B.warna[v * 3] > B.warna[v * 3 + 1] * 2.5) merah++;
  assert.ok(merah >= 4 * 6, 'suar merah puncak menara: ' + merah / 4);
});

test('skyline kos: bahan — yang menyala MeshBasicMaterial, opak (tanpa bidang transparan), tanpa kabut scene, tanpa lampu', () => {
  const bangun = fungsi('skylineKosBangun');
  assert.equal((bangun.match(/new THREE\.MeshBasicMaterial\(/g) || []).length, 2, 'badan + jendela = MeshBasicMaterial');
  assert.ok(!/Lambert|Phong|Standard|emissive|transparent|opacity|Light\(/.test(bangun), 'tanpa bahan berlampu / transparan / lampu');
  assert.equal((bangun.match(/fog: false/g) || []).length, 2, 'pudar manual (warna langit), bukan kabut scene');
  assert.ok(/alphaTest: 0\.5/.test(bangun), 'jendela: alphaTest (opak), bukan blending');
  assert.ok(/frustumCulled = false/.test(bangun));
  assert.ok(!/depthWrite: false|depthTest: false/.test(bangun), 'menulis kedalaman: kubah langit + bintang (digambar belakangan) tertolak di belakang menara');
});

function tiruan(realm) { /* jalankan fungsi runtime skyline dengan stub (tanpa THREE) */
  const Q = { badan: { visible: null, geometry: { attributes: { color: { count: 2, d: [], setXYZ(i, r, g, b) { this.d[i] = [r, g, b]; }, needsUpdate: false } } } },
    lampu: { visible: null, material: { color: { v: null, setScalar(x) { this.v = x; } } } }, cat: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], arah: [1, 0, 0, 1, 0.1, 0], kabut: [1, 0.6], nyala: 0 };
  const f = new Function('skylineKos', 'myRealm', 'suTmp', 'suasanaWarnaLangit', 'suasanaHalus', fungsi('skylineKosWarnai') + fungsi('skylineKosTampil') + '\nreturn { warnai: skylineKosWarnai, tampil: skylineKosTampil };');
  const halus = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); };
  return { Q, F: f(Q, realm, { c: { r: 0, g: 0, b: 0 } }, (k, y, x, z, h) => { h.r = 0.2; h.g = 0.4; h.b = 0.8; return h; }, halus) };
}
const K = (o) => Object.assign({ jam: 10, terang: 1, surya: 1, jingga: 0, malam: 0, hujan: 0, mendung: 0, pelangi: 0 }, o);

test('skyline kos: hanya tampil di halaman + Jalan Kampung; tidak di Kota / kamar / ruang tamu / dapur; tidak dibangun di blok Kota', () => {
  for (const [realm, harap] of [['yard', true], ['jalan', true], ['kota', false], ['kota-hotel', false], ['room-7', false], ['living', false], ['dapur', false]]) {
    const T = tiruan(realm); T.F.warnai(K({ jam: 21, terang: 0, malam: 1 })); T.F.tampil();
    assert.equal(T.Q.badan.visible, harap, 'badan di ' + realm); assert.equal(T.Q.lampu.visible, harap, 'jendela malam di ' + realm);
  }
  const kota = antara('/* ================= KOTA (destinasi baru, 22 Nov) ================= */', '/* ================= AKHIR KOTA ================= */');
  assert.ok(!/skylineKos|SKYLINE_KOS/.test(kota), 'blok Kota tidak menyentuh skyline kos');
  assert.ok(!/kota[A-Z]\w*\(|KOTA_|KB\./.test(BLOK + fungsi('skylineKosBangun')), 'skyline kos TIDAK memuat geometri / bahan Kota asli');
  /* kabel: dibangun sekali di suasanaSiapkan (anak grup langit), diwarnai di suasanaTerapkan, tampil diatur di suasanaTick */
  assert.equal(HTML.split('skylineKosBangun(').length - 1, 2); assert.ok(fungsi('suasanaSiapkan').includes('skylineKosBangun(L);'));
  assert.equal(HTML.split('skylineKosWarnai(').length - 1, 2); assert.ok(fungsi('suasanaTerapkan').includes('skylineKosWarnai(k);'));
  assert.equal(HTML.split('skylineKosTampil(').length - 1, 2); assert.ok(fungsi('suasanaTick').includes('skylineKosTampil();'));
  assert.ok(/myRealm === 'yard' \? scene : \(myRealm === 'jalan' \? jalanScene/.test(fungsi('suasanaPasangLangit')), 'grup langit (induk skyline) ikut scene halaman / jalan');
});

test('skyline kos: siang-malam + hujan — kabut penuh = warna langit persis, jendela menyala malam (bertahap), hujan menipiskan siluet', () => {
  let T = tiruan('yard'); T.F.warnai(K({})); T.F.tampil();
  let c = T.Q.badan.geometry.attributes.color.d;
  assert.deepEqual(c[0].map((v) => +v.toFixed(6)), [0.2, 0.4, 0.8], 'verteks berkabut penuh = warna langit di arah itu (tak terlihat)');
  assert.ok(Math.abs(c[1][0] - 0.2) > 0.05, 'badan menara berbeda dari langit (terlihat) di siang kering');
  assert.equal(T.Q.lampu.material.color.v, 0, 'siang: jendela padam'); assert.equal(T.Q.lampu.visible, false, 'siang: mesh jendela tidak digambar (hemat 1 draw call)');
  const siangJarak = Math.abs(c[1][0] - 0.2);
  T = tiruan('yard'); T.F.warnai(K({ hujan: 1, mendung: 1, terang: 0.7 })); c = T.Q.badan.geometry.attributes.color.d;
  assert.ok(Math.abs(c[1][0] - 0.2) < siangJarak * 0.35, 'hujan deras: siluet nyaris hilang di balik hujan');
  T = tiruan('jalan'); T.F.warnai(K({ jam: 21, terang: 0, malam: 1 })); T.F.tampil(); c = T.Q.badan.geometry.attributes.color.d;
  assert.ok(T.Q.lampu.material.color.v > 0.95 && T.Q.lampu.visible === true, 'malam: jendela menyala penuh');
  assert.ok(c[1][0] < 0.2 && c[1][1] < 0.4, 'malam: badan lebih gelap dari langit (siluet)');
  T = tiruan('yard'); T.F.warnai(K({ jam: 18, terang: 0.3, jingga: 0.8 })); const senja = T.Q.lampu.material.color.v;
  assert.ok(senja > 0.02 && senja < 0.95, 'senja: jendela mulai menyala bertahap: ' + senja);
  T = tiruan('yard'); T.F.warnai(K({ jam: 21, terang: 0, malam: 1, hujan: 1 })); assert.ok(T.Q.lampu.material.color.v < 0.6 && T.Q.lampu.material.color.v > 0.2, 'hujan malam: lampu kota meredup, tidak padam');
  assert.ok(T.Q.badan.geometry.attributes.color.needsUpdate === true);
});
