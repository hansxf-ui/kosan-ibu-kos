'use strict';
/* Tata Kamar — aturan murni server. JANGAN diedit di sini: blok di bawah dirakit dari alat/frag/tata-murni.js dan
   harus SAMA PERSIS dengan blok TATA-KAMAR di index.html (tests/tata-kamar.test.js). Bukan fungsi Vercel (folder _lib). */
/* ==== TATA-KAMAR-START ==== */
/* Tata Kamar (pemilik 26 Nov: "atur tata letak sendiri ... mindah mindahin sendiri") — ATURAN MURNI tata letak perabot kamar.
   Blok ini SAMA PERSIS dengan api/_lib/tata.js (dijaga tests/tata-kamar.test.js): klien memakainya untuk menolak posisi
   tak sah saat diseret, server memakainya untuk menolak simpanan tak sah. Tanpa DOM dan tanpa pustaka 3D.
   Satuan MILIMETER (bilangan bulat). Kamar 8 x 7 m: x -4000..4000 (barat..timur), z -3500..3500 (utara..selatan).
   Simpanan: { id: [x, z, r] } — r = putaran 0..3 (rotY = r x 90 derajat). Barang di dinding: r = dinding
   (0 utara, 1 barat, 2 selatan, 3 timur), koordinat tegak lurus dinding selalu dihitung ulang (tidak dipercaya).
   Jenis: 'sandar' = berdiri di lantai, punggung menempel dinding; 'gantung' = menempel di dinding;
          'bebas' = di lantai mana saja, bisa diputar; 'alas' = karpet (boleh di bawah perabot).
   k = jejak [x0, z0, x1, z1] relatif titik pusat pada r 0 (sandar/gantung: z 0 = bidang dinding, +z = ke dalam kamar);
   y = [bawah, atas]; d = jarak titik pusat dari dinding; a = posisi awal (= kamar sebelum fitur ini);
   lega = jejak yang harus kosong (kaki kasur, depan bean bag). */
var TATA_KAMAR = {
  X: 4000, Z: 3500, R: 400, LANGKAH: 100,
  JALAN: [-3100, -2600, 3100, 2600], /* = ROOM (batas jalan avatar) */
  SPAWN: [900, -500], PINTU: [0, 2600],
  TETAP: [ /* tidak bisa dipindah: [x0, z0, x1, z1, y0, y1, sebab] */
    [-950, 2300, 950, 3500, 0, 3050, 'pintu'],
    [3780, -420, 4000, 1420, 1150, 2900, 'jendela'],
    [-4000, -3500, -2740, -3260, 2250, 3600, 'ac']
  ],
  URUT: ['kasur', 'nakas', 'tv', 'meja_belajar', 'meja_rias', 'rak_buku', 'akuarium', 'cermin', 'bean_bag', 'tanaman', 'poster', 'lampu_tumblr', 'karpet'],
  BAWAAN: ['kasur', 'nakas', 'tv'],
  B: {
    kasur: { n: 'Kasur', j: 'sandar', d: 0, k: [-750, 0, 750, 2380], y: [0, 1340], a: [-3250, -3500, 0], lega: [-750, 2380, 750, 2980] },
    nakas: { n: 'Nakas + lampu', j: 'bebas', k: [-400, -350, 400, 350], y: [0, 1130], a: [-1800, -3130, 0] },
    tv: { n: 'TV dinding', j: 'gantung', d: 37.5, k: [-745, -40, 745, 30], y: [990, 1850], a: [-2375, 3500, 2] },
    meja_belajar: { n: 'Meja belajar', j: 'sandar', d: 20, k: [-800, -20, 800, 1090], y: [0, 1140], a: [4000, 50, 3] },
    meja_rias: { n: 'Meja rias', j: 'sandar', d: 20, k: [-600, -20, 600, 950], y: [0, 1600], a: [1850, 3500, 2] },
    rak_buku: { n: 'Rak buku', j: 'sandar', d: 20, k: [-550, -20, 550, 330], y: [0, 2000], a: [-400, -3500, 0] },
    akuarium: { n: 'Akuarium', j: 'sandar', d: 20, k: [-430, -20, 430, 410], y: [0, 1100], a: [2650, -3500, 0] },
    cermin: { n: 'Cermin', j: 'sandar', d: 20, k: [-350, -20, 350, 300], y: [0, 1750], a: [-4000, 75, 1] },
    bean_bag: { n: 'Bean bag', j: 'bebas', k: [-580, -620, 580, 440], y: [0, 800], a: [-2350, 1150, 0], lega: [-300, 440, 300, 900] },
    tanaman: { n: 'Tanaman', j: 'bebas', k: [-350, -380, 380, 330], y: [0, 1730], a: [3620, -3120, 0] },
    poster: { n: 'Poster', j: 'gantung', d: 30, k: [-500, -30, 500, 30], y: [1560, 2880], a: [1600, -3500, 0] },
    lampu_tumblr: { n: 'Lampu tumblr', j: 'gantung', d: 50, k: [-40, -50, 6340, 50], y: [3050, 3330], a: [-2500, -3500, 0] },
    karpet: { n: 'Karpet', j: 'alas', k: [-1150, -1150, 1150, 1150], y: [0, 30], a: [700, 250, 0] }
  }
};
function tataPunya(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function tataBarang(id) { return (typeof id === 'string' && tataPunya(TATA_KAMAR.B, id)) ? TATA_KAMAR.B[id] : null; }
function tataBulat(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
function tataPutar(k, r) { /* jejak [x0,z0,x1,z1] diputar r x 90 derajat (rotY): (x, z) -> (z, -x) */
  if (r === 1) return [k[1], 0 - k[2], k[3], 0 - k[0]];
  if (r === 2) return [0 - k[2], 0 - k[3], 0 - k[0], 0 - k[1]];
  if (r === 3) return [0 - k[3], k[0], 0 - k[1], k[2]];
  return [k[0], k[1], k[2], k[3]];
}
function tataJepit(v, a, b) { return v < a ? a : (v > b ? b : v); }
/* posisi sungguhan titik pusat { x, z, r } (mm; koordinat tegak lurus dinding dihitung dari d) */
function tataPos(id, v) {
  var b = TATA_KAMAR.B[id], T = TATA_KAMAR, r = v[2];
  if (b.j !== 'sandar' && b.j !== 'gantung') return { x: v[0], z: v[1], r: r };
  if (r === 0) return { x: v[0], z: -T.Z + b.d, r: 0 };
  if (r === 1) return { x: -T.X + b.d, z: v[1], r: 1 };
  if (r === 2) return { x: v[0], z: T.Z - b.d, r: 2 };
  return { x: T.X - b.d, z: v[1], r: 3 };
}
/* bentuk baku [x, z, r]: dijepit supaya jejak utuh di dalam kamar; barang dinding: koordinat dinding = bidang dinding. null = bukan bentuk sah */
function tataRapikan(id, v) {
  var b = tataBarang(id), T = TATA_KAMAR;
  if (!b || !Array.isArray(v) || v.length !== 3 || !tataBulat(v[0]) || !tataBulat(v[1]) || !tataBulat(v[2]) || v[2] < 0 || v[2] > 3) return null;
  var r = v[2], k = tataPutar(b.k, r), x = v[0], z = v[1];
  if (b.j === 'sandar' || b.j === 'gantung') {
    if (r === 0 || r === 2) { x = tataJepit(x, -T.X - k[0], T.X - k[2]); z = r === 0 ? -T.Z : T.Z; }
    else { z = tataJepit(z, -T.Z - k[1], T.Z - k[3]); x = r === 1 ? -T.X : T.X; }
  } else {
    x = tataJepit(x, -T.X - k[0], T.X - k[2]); z = tataJepit(z, -T.Z - k[1], T.Z - k[3]);
  }
  return [Math.round(x), Math.round(z), r];
}
/* kotak dunia [x0, z0, x1, z1, y0, y1] */
function tataKotak(id, v, jejak) {
  var b = TATA_KAMAR.B[id], p = tataPos(id, v), k = tataPutar(jejak || b.k, p.r);
  return [p.x + k[0], p.z + k[1], p.x + k[2], p.z + k[3], b.y[0], b.y[1]];
}
function tataTindih(a, b) { /* dua kotak bertumpang lebih dari 1 mm di ketiga sumbu */
  return a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1 && a[4] < b[5] - 1 && b[4] < a[5] - 1;
}
function tataTitik(id, v, lx, lz) { /* titik lokal -> dunia, dijepit ke batas jalan */
  var p = tataPos(id, v), q = tataPutar([lx, lz, lx, lz], p.r), J = TATA_KAMAR.JALAN;
  return [tataJepit(p.x + q[0], J[0], J[2]), tataJepit(p.z + q[1], J[1], J[3])];
}
function tataBangunKasur(v) { return tataTitik('kasur', v, 0, 3280); } /* 0,9 m di depan kaki kasur (= WAKE_SPOT) */
function tataPadat(tata) { /* kotak yang menghalangi jalan avatar: semua barang lantai kecuali karpet */
  var L = [];
  for (var id in tata) if (tataPunya(tata, id)) { var b = TATA_KAMAR.B[id]; if (b.j === 'sandar' || b.j === 'bebas') L.push(tataKotak(id, tata[id])); }
  return L;
}
function tataTerhalang(L, x, z) { /* titik (x, z) di dalam kotak padat yang digembungkan radius avatar (= resolveAABB r 0,4) */
  var R = TATA_KAMAR.R;
  for (var i = 0; i < L.length; i++) if (x > L[i][0] - R && x < L[i][2] + R && z > L[i][1] - R && z < L[i][3] + R) return true;
  return false;
}
/* banjir-isi lantai yang bisa dijalani mulai dari titik masuk kamar -> fungsi sampai(x, z) */
function tataJangkau(tata) {
  var T = TATA_KAMAR, J = T.JALAN, S = T.LANGKAH, nx = Math.round((J[2] - J[0]) / S) + 1, nz = Math.round((J[3] - J[1]) / S) + 1;
  var L = tataPadat(tata), peta = new Array(nx * nz), i, j;
  for (i = 0; i < nx; i++) for (j = 0; j < nz; j++) peta[j * nx + i] = tataTerhalang(L, J[0] + i * S, J[1] + j * S) ? 0 : 1;
  var sel = function (x, z) { return [tataJepit(Math.round((x - J[0]) / S), 0, nx - 1), tataJepit(Math.round((z - J[1]) / S), 0, nz - 1)]; };
  var s = sel(T.SPAWN[0], T.SPAWN[1]), antre = [];
  if (peta[s[1] * nx + s[0]] === 1) { peta[s[1] * nx + s[0]] = 2; antre.push(s[0], s[1]); }
  for (var h = 0; h < antre.length; h += 2) {
    var cx = antre[h], cz = antre[h + 1], N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var q = 0; q < 4; q++) {
      var ax = cx + N[q][0], az = cz + N[q][1];
      if (ax < 0 || az < 0 || ax >= nx || az >= nz || peta[az * nx + ax] !== 1) continue;
      peta[az * nx + ax] = 2; antre.push(ax, az);
    }
  }
  return function (x, z) { var c = sel(x, z); return peta[c[1] * nx + c[0]] === 2; };
}
function tataBangunBean(v, sampai) { /* titik berdiri dari bean bag: 1 m di kanan, kalau tertutup 1 m di kiri; null = dua-duanya tertutup */
  var a = tataTitik('bean_bag', v, 1000, 0); if (sampai(a[0], a[1])) return a;
  var b = tataTitik('bean_bag', v, -1000, 0); if (sampai(b[0], b[1])) return b;
  return null;
}
/* periksa satu tata letak utuh. null = sah; kalau tidak { id, sebab, lawan } (sebab: format | tabrak | pintu | jendela | ac | lega | jalan) */
function tataCek(tata) {
  var T = TATA_KAMAR, ids = [], K = {}, Lg = {}, i, j, t, id;
  if (!tata || typeof tata !== 'object' || Array.isArray(tata)) return { id: null, sebab: 'format' };
  for (id in tata) if (tataPunya(tata, id)) {
    var v = tataRapikan(id, tata[id]);
    if (!v || v[0] !== tata[id][0] || v[1] !== tata[id][1] || v[2] !== tata[id][2]) return { id: id, sebab: 'format' };
    ids.push(id); K[id] = tataKotak(id, v);
    if (T.B[id].lega) Lg[id] = tataKotak(id, v, T.B[id].lega);
  }
  if (ids.length > T.URUT.length) return { id: null, sebab: 'format' };
  for (i = 0; i < ids.length; i++) {
    var a = ids[i], ba = T.B[a];
    if (ba.j === 'alas') continue;
    for (t = 0; t < T.TETAP.length; t++) if (tataTindih(K[a], T.TETAP[t])) return { id: a, sebab: T.TETAP[t][6] };
    if (Lg[a]) {
      var g = Lg[a];
      if (g[0] < -T.X || g[1] < -T.Z || g[2] > T.X || g[3] > T.Z) return { id: a, sebab: 'lega' };
      for (t = 0; t < T.TETAP.length; t++) if (T.TETAP[t][6] !== 'pintu' && tataTindih(g, T.TETAP[t])) return { id: a, sebab: 'lega' };
    }
    for (j = 0; j < ids.length; j++) {
      var c = ids[j]; if (c === a || T.B[c].j === 'alas') continue;
      if (j > i && tataTindih(K[a], K[c])) return { id: a, sebab: 'tabrak', lawan: c };
      if (Lg[a] && tataTindih([Lg[a][0], Lg[a][1], Lg[a][2], Lg[a][3], 0, 1000], K[c])) return { id: a, sebab: 'lega', lawan: c };
    }
  }
  var sampai = tataJangkau(tata);
  if (!sampai(T.SPAWN[0], T.SPAWN[1]) || !sampai(T.PINTU[0], T.PINTU[1])) return { id: null, sebab: 'jalan' };
  if (K.kasur) { var w = tataBangunKasur(tata.kasur); if (!sampai(w[0], w[1])) return { id: 'kasur', sebab: 'jalan' }; }
  if (K.bean_bag && !tataBangunBean(tata.bean_bag, sampai)) return { id: 'bean_bag', sebab: 'jalan' };
  return null;
}
function tataAwal(ada) { /* tata letak bawaan untuk daftar barang yang ada */
  var o = {}, T = TATA_KAMAR;
  for (var i = 0; i < T.URUT.length; i++) if (ada.indexOf(T.URUT[i]) >= 0) o[T.URUT[i]] = T.B[T.URUT[i]].a.slice();
  return o;
}
function tataSama(a, b) {
  var T = TATA_KAMAR;
  for (var i = 0; i < T.URUT.length; i++) {
    var id = T.URUT[i], pa = !!(a && tataPunya(a, id)), pb = !!(b && tataPunya(b, id));
    if (pa !== pb) return false;
    if (pa && (a[id][0] !== b[id][0] || a[id][1] !== b[id][1] || a[id][2] !== b[id][2])) return false;
  }
  return true;
}
/* cari tempat sah terdekat untuk satu barang di tengah tata letak yang sudah sah; null = tidak ada */
function tataCariTempat(tata, id, mulai) {
  var T = TATA_KAMAR, b = T.B[id], m = tataRapikan(id, mulai || b.a) || b.a.slice(), calon = [], r, u, x, z;
  var coba = function (v) { var o = {}; for (var k in tata) if (tataPunya(tata, k) && k !== id) o[k] = tata[k]; o[id] = v; return tataCek(o) ? null : v; };
  var jarak = function (v) { var p = tataPos(id, v), q = tataPos(id, m); return Math.abs(p.x - q.x) + Math.abs(p.z - q.z) + (v[2] === m[2] ? 0 : 1500); };
  if (b.j === 'sandar' || b.j === 'gantung') {
    for (r = 0; r < 4; r++) for (u = -4000; u <= 4000; u += 100) { var v = tataRapikan(id, (r === 0 || r === 2) ? [u, 0, r] : [0, u, r]); if (v) calon.push(v); }
  } else {
    for (r = 0; r < (b.j === 'alas' ? 1 : 4); r++) for (x = -3800; x <= 3800; x += 200) for (z = -3400; z <= 3400; z += 200) { var w = tataRapikan(id, [x, z, (m[2] + r) % 4]); if (w) calon.push(w); }
  }
  calon.sort(function (p, q) { return jarak(p) - jarak(q); });
  var h = coba(m); if (h) return h;
  for (var i = 0; i < calon.length; i++) { h = coba(calon[i]); if (h) return h; }
  return null;
}
/* simpanan (boleh null / sebagian / basi) + daftar barang yang ada -> tata letak utuh yang PASTI sah */
function tataSusun(simpanan, ada) {
  var T = TATA_KAMAR, o = {}, s = (simpanan && typeof simpanan === 'object' && !Array.isArray(simpanan)) ? simpanan : {};
  for (var i = 0; i < T.URUT.length; i++) {
    var id = T.URUT[i]; if (ada.indexOf(id) < 0) continue;
    var v = (tataPunya(s, id) && tataRapikan(id, s[id])) || T.B[id].a.slice();
    o[id] = v;
    if (tataCek(o)) { delete o[id]; var c = tataCariTempat(o, id, v); if (!c) return tataAwal(ada); o[id] = c; }
  }
  return o;
}
/* badan permintaan server -> { tata } sah, { tata: null } (balikin ke awal), atau null (ditolak) */
function tataSahkan(t) {
  if (t === null) return { tata: null };
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  var kunci = Object.keys(t), o = {};
  if (kunci.length < 1 || kunci.length > TATA_KAMAR.URUT.length) return null;
  for (var i = 0; i < kunci.length; i++) {
    var v = tataBarang(kunci[i]) ? tataRapikan(kunci[i], t[kunci[i]]) : null;
    if (!v) return null;
    o[kunci[i]] = v;
  }
  for (i = 0; i < TATA_KAMAR.BAWAAN.length; i++) if (!tataPunya(o, TATA_KAMAR.BAWAAN[i])) return null;
  if (tataCek(o)) return null;
  return { tata: tataSusun(o, kunci) };
}
/* baris database -> simpanan yang bentuknya pasti sah (barang tak dikenal / bentuk rusak dibuang); tanpa baris -> null */
function tataDariDb(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  var o = {}, n = 0;
  for (var i = 0; i < TATA_KAMAR.URUT.length; i++) { var id = TATA_KAMAR.URUT[i]; if (tataPunya(t, id)) { var v = tataRapikan(id, t[id]); if (v) { o[id] = v; n++; } } }
  return n ? o : null;
}
/* ==== TATA-KAMAR-END ==== */
module.exports = { TATA_KAMAR, tataPunya, tataBarang, tataPutar, tataPos, tataRapikan, tataKotak, tataTindih, tataTitik, tataBangunKasur, tataPadat, tataTerhalang,
  tataJangkau, tataBangunBean, tataCek, tataAwal, tataSama, tataCariTempat, tataSusun, tataSahkan, tataDariDb };
