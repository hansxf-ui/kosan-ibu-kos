'use strict';
/* Tes unit Tahap 3a — Jalan Kampung. Fungsi murni diambil VERBATIM dari
   index.html (blok JALAN, PURE, MP-PURE, GAZEBO). Jalankan:
   node --test tests/jalan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + antara('/* ==== GAZEBO-START ==== */', '/* ==== GAZEBO-END ==== */')
  + antara('/* ==== JALAN-START ==== */', '/* ==== JALAN-END ==== */')
  + '\nreturn { JALAN, JALAN_GERBANG_X, JALAN_SPAWN, HALAMAN_DARI_JALAN, JALAN_SOLIDS, JALAN_TIANG_X, WARUNG_KOTAK, POS_RONDA_KOTAK,'
  + ' PALANG_TIMUR, PALANG_BARAT, JALAN_JARAK, JALAN_JARAK_KUCING, POS_RONDA_KURSI, WARUNG_MENU, JAJAN_DURASI_MS, KUCING_JALUR, KUCING_LAJU,'
  + ' jalanZonaGerbangHalaman, jalanZonaGerbangKos, jalanKursiPilih, warungBeli, kucingSiklus, kucingPosisi,'
  + ' resolveAABB, jarakKeKotak, mpRealmDikenal, mpValidasiPos, mpBangunPos, MP_BATAS_JALAN, YARD, BUILDING_C, BUILDING_D };')();
const R = 0.4; /* radius avatar (resolveAABB di animate) */
const diDalam = (x, z, k, r) => x > k.minX - r && x < k.maxX + r && z > k.minZ - r && z < k.maxZ + r;
const blok = (f) => fungsi(f);

test('Jalan: zona gerbang dua arah + titik spawn/balik di LUAR zona (tidak memantul)', () => {
  assert.equal(F.jalanZonaGerbangHalaman(15, 27.8), true);
  assert.equal(F.jalanZonaGerbangHalaman(15, 27.6), false);
  assert.equal(F.jalanZonaGerbangHalaman(13.8, 28), false);
  assert.equal(F.jalanZonaGerbangHalaman(16.2, 28), false);
  assert.ok(F.YARD.maxZ >= 27.75, 'zona halaman terjangkau (batas YARD)');
  assert.equal(F.jalanZonaGerbangKos(-12, F.JALAN.minZ), true, 'zona jalan terjangkau di batas utara');
  assert.equal(F.jalanZonaGerbangKos(-12, -6.4), false);
  assert.equal(F.jalanZonaGerbangKos(-13.2, F.JALAN.minZ), false);
  assert.equal(F.jalanZonaGerbangKos(-10.8, F.JALAN.minZ), false);
  assert.equal(F.jalanZonaGerbangKos(F.JALAN_SPAWN.x, F.JALAN_SPAWN.z), false, 'spawn jalan');
  assert.equal(F.jalanZonaGerbangHalaman(F.HALAMAN_DARI_JALAN.x, F.HALAMAN_DARI_JALAN.z), false, 'titik balik halaman');
  /* cermin: gerbang jalan x -12 = gerbang halaman x 15; geser x lewat gerbang tetap di celah kedua sisi */
  assert.equal(F.JALAN_GERBANG_X + 27, F.HALAMAN_DARI_JALAN.x);
  for (const dx of [-1.1, 0, 1.1]) {
    assert.equal(F.jalanZonaGerbangKos(F.JALAN_SPAWN.x + dx, F.JALAN_SPAWN.z), false);
    assert.equal(F.jalanZonaGerbangHalaman(F.HALAMAN_DARI_JALAN.x + dx, F.HALAMAN_DARI_JALAN.z), false);
  }
  /* titik balik halaman tidak di dalam Gedung C / D (celah C-D x 12,4..17,6) */
  for (const dx of [-1.1, 0, 1.1]) for (const B of [F.BUILDING_C, F.BUILDING_D]) assert.ok(!diDalam(F.HALAMAN_DARI_JALAN.x + dx, F.HALAMAN_DARI_JALAN.z, B, R), 'balik ' + dx);
});

test('Jalan: Oyen deterministik (jam sama = posisi sama di semua HP), di dalam batas, kontinu, tidak menembus tiang', () => {
  const siklus = F.kucingSiklus();
  assert.ok(siklus > 60 && siklus < 600, String(siklus));
  for (const t of [0, 1.5, 123.4, 1763000000.25, -42]) {
    assert.deepEqual(F.kucingPosisi(t), F.kucingPosisi(t));
    const a = F.kucingPosisi(t), b = F.kucingPosisi(t + siklus);
    assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6, 'periodik ' + t);
  }
  let jalan = 0, duduk = 0;
  for (let t = 0; t < siklus; t += 0.25) {
    const k = F.kucingPosisi(1763000000 + t), n = F.kucingPosisi(1763000000 + t + 0.25);
    assert.ok(k.x >= F.JALAN.minX && k.x <= F.JALAN.maxX && k.z >= F.JALAN.minZ && k.z <= F.JALAN.maxZ, JSON.stringify(k));
    assert.ok(Math.hypot(n.x - k.x, n.z - k.z) <= F.KUCING_LAJU * 0.25 + 1e-9, 'loncat di t ' + t);
    for (const s of F.JALAN_SOLIDS) assert.ok(!diDalam(k.x, k.z, s, 0.15), 'menembus solid ' + JSON.stringify(s));
    if (k.jalan) jalan++; else duduk++;
  }
  assert.ok(jalan > 0 && duduk > 0, 'jalan + duduk');
});

test('Jalan: jalanKursiPilih — kursi kosong terdekat, terisi dilewati, penuh = null, jangkar pola POSE_SIT', () => {
  const a = F.jalanKursiPilih(10.9, 6.2, []);
  assert.equal(a.x, 10.9); assert.equal(a.z, 7.25);
  assert.equal(a.y, -0.31); assert.equal(a.leg, -0.92); assert.equal(a.rotY, Math.PI); assert.equal(a.rotX, 0);
  const b = F.jalanKursiPilih(10.9, 6.2, [{ x: 10.9, z: 7.25 }]);
  assert.equal(b.x, 10.0);
  assert.equal(F.jalanKursiPilih(10, 6.2, F.POS_RONDA_KURSI.map((k) => ({ x: k.x, z: k.z }))), null);
  /* kursi di tepi depan bale-bale; titik bangun di trotoar, di dalam batas, bebas solid */
  for (const k of F.POS_RONDA_KURSI) {
    assert.ok(k.x > F.POS_RONDA_KOTAK.minX && k.x < F.POS_RONDA_KOTAK.maxX && Math.abs(k.z - F.POS_RONDA_KOTAK.minZ - 0.05) < 1e-9, JSON.stringify(k));
    const j = F.jalanKursiPilih(k.x, 6.2, F.POS_RONDA_KURSI.filter((q) => q !== k));
    assert.equal(j.x, k.x);
    assert.ok(j.bangun.z <= F.JALAN.maxZ && j.bangun.z >= F.JALAN.minZ, 'bangun di dalam batas');
    for (const s of F.JALAN_SOLIDS) assert.ok(!diDalam(j.bangun.x, j.bangun.z, s, R), 'bangun menembus ' + JSON.stringify(s));
    assert.ok(F.jarakKeKotak(j.bangun.x, j.bangun.z, F.POS_RONDA_KOTAK) <= F.JALAN_JARAK, 'bangun dekat pos ronda');
  }
});

test('Jalan: warungBeli — Bintang cukup / kurang / menu asing / bukan angka', () => {
  assert.deepEqual(F.warungBeli(5, 'esteh'), { ok: true, sisa: 3, item: F.WARUNG_MENU[0] });
  const kurang = F.warungBeli(1, 'eskrim');
  assert.equal(kurang.ok, false); assert.equal(kurang.alasan, 'kurang'); assert.equal(kurang.sisa, 1);
  assert.equal(F.warungBeli(2, 'esteh').sisa, 0, 'pas');
  assert.equal(F.warungBeli(5, 'kopi').alasan, 'asing');
  assert.equal(F.warungBeli(5, '__proto__').alasan, 'asing');
  assert.equal(F.warungBeli(NaN, 'gorengan').ok, false);
  assert.equal(F.warungBeli(undefined, 'gorengan').ok, false);
  const ids = F.WARUNG_MENU.map((m) => m.id);
  assert.deepEqual(ids, ['esteh', 'gorengan', 'eskrim']);
  for (const m of F.WARUNG_MENU) assert.ok(Number.isInteger(m.harga) && m.harga > 0, m.id);
  assert.equal(F.JAJAN_DURASI_MS, 90000);
});

test('Jalan: realm "jalan" dikenal + pos dari jalan (ujung barat x -25,9, duduk di bale-bale) lolos validasi; batas halaman tidak berubah', () => {
  assert.equal(F.mpRealmDikenal('jalan'), 'jalan');
  assert.equal(F.mpRealmDikenal('jalan2'), 'yard');
  assert.equal(F.mpRealmDikenal('Jalan'), 'yard');
  const titik = [[F.JALAN.minX, F.JALAN.minZ], [F.JALAN.maxX, F.JALAN.maxZ], [F.JALAN_SPAWN.x, F.JALAN_SPAWN.z]].concat(F.POS_RONDA_KURSI.map((k) => [k.x, k.z]));
  for (const [x, z] of titik) {
    const m = F.mpBangunPos('pabc123', 'rina', 'cewek', 'jalan', x, z, 0, 0, 1, 'sit', null, 0, 0, 0);
    const v = F.mpValidasiPos(JSON.parse(JSON.stringify(m)), 'plain456');
    assert.ok(v, 'tolak ' + x + ',' + z);
    assert.equal(v.realm, 'jalan'); assert.equal(v.pose, 'sit');
  }
  /* kotak validasi jalan ketat: memuat batas JALAN + dudukan, menolak koordinat halaman jauh */
  const B = F.MP_BATAS_JALAN;
  assert.ok(B.minX <= F.JALAN.minX && B.maxX >= F.JALAN.maxX && B.minZ <= F.JALAN.minZ && B.maxZ >= F.JALAN.maxZ);
  for (const k of F.POS_RONDA_KURSI) assert.ok(k.z <= B.maxZ);
  const pos = (realm, x, z) => F.mpValidasiPos(JSON.parse(JSON.stringify(F.mpBangunPos('pabc123', 'rina', 'cewek', realm, x, z, 0, 0, 1, 'stand', null, 0, 0, 0))), 'plain456');
  assert.equal(pos('jalan', 40, 0), null, 'x 40 di jalan ditolak');
  assert.equal(pos('jalan', 0, 20), null, 'z 20 di jalan ditolak');
  assert.equal(pos('yard', -25.9, 0), null, 'halaman tetap pakai batas YARD');
  assert.ok(pos('yard', 40, 20), 'halaman x 40 z 20 tetap sah');
});

test('Jalan: semua tujuan terjangkau dari spawn (BFS 0,1 m, batas + JALAN_SOLIDS r 0,4); warung/pos ronda/palang/pagar di luar badan avatar', () => {
  const J = F.JALAN, h = 0.1, nx = Math.round((J.maxX - J.minX) / h) + 1, nz = Math.round((J.maxZ - J.minZ) / h) + 1;
  const bebas = (i, k) => { const x = J.minX + i * h, z = J.minZ + k * h; return !F.JALAN_SOLIDS.some((s) => diDalam(x, z, s, R)); };
  const lihat = new Uint8Array(nx * nz), antre = [];
  const si = Math.round((F.JALAN_SPAWN.x - J.minX) / h), sk = Math.round((F.JALAN_SPAWN.z - J.minZ) / h);
  assert.ok(bebas(si, sk), 'spawn bebas');
  lihat[si * nz + sk] = 1; antre.push([si, sk]);
  while (antre.length) {
    const [i, k] = antre.pop();
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = k + dk;
      if (a < 0 || c < 0 || a >= nx || c >= nz || lihat[a * nz + c] || !bebas(a, c)) continue;
      lihat[a * nz + c] = 1; antre.push([a, c]);
    }
  }
  const ada = (syarat) => { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) if (lihat[i * nz + k] && syarat(J.minX + i * h, J.minZ + k * h)) return true; return false; };
  assert.ok(ada((x, z) => F.jarakKeKotak(x, z, F.WARUNG_KOTAK) <= F.JALAN_JARAK), 'depan warung');
  assert.ok(ada((x, z) => F.jarakKeKotak(x, z, F.POS_RONDA_KOTAK) <= F.JALAN_JARAK), 'depan pos ronda');
  assert.ok(ada((x, z) => F.jarakKeKotak(x, z, F.PALANG_TIMUR) <= F.JALAN_JARAK), 'palang timur');
  assert.ok(ada((x, z) => F.jarakKeKotak(x, z, F.PALANG_BARAT) <= F.JALAN_JARAK), 'palang barat');
  assert.ok(ada((x, z) => F.jalanZonaGerbangKos(x, z)), 'gerbang kos');
  for (const [cx, cz] of F.KUCING_JALUR) assert.ok(ada((x, z) => Math.hypot(x - cx, z - cz) <= F.JALAN_JARAK_KUCING), 'Oyen ' + cx + ',' + cz);
  /* batas menahan badan avatar di depan benda (tanpa kotak tabrakan tambahan) */
  const eps = 1e-9;
  assert.ok(J.maxZ + R <= F.WARUNG_KOTAK.minZ + eps && J.maxZ + R <= F.POS_RONDA_KOTAK.minZ + eps, 'warung + pos ronda');
  assert.ok(J.maxZ + R <= 7.0 - 0.0175 + eps, 'pagar rumah z 7,0');
  assert.ok(J.minZ - R >= -7.25 + 0.21 - eps, 'muka pilaster tembok kos');
  assert.ok(J.maxX + R <= F.PALANG_TIMUR.minX - 0.45 + eps && J.minX - R >= F.PALANG_BARAT.maxX + 0.45 - eps, 'alas kerucut palang');
  /* tiang listrik = solid di trotoar selatan */
  assert.deepEqual(F.JALAN_TIANG_X.map((x) => F.JALAN_SOLIDS.some((s) => s.minX < x && s.maxX > x && s.minZ < 6.3 && s.maxZ > 6.3)), F.JALAN_TIANG_X.map(() => true));
});

test('Jalan: kabel ke index.html (alam, tabrakan, kamera, render, ketuk, pindah alam, misi)', () => {
  assert.match(blok('sceneUntukRealm'), /realm === 'jalan'\) return jalanScene/);
  const ani = blok('animate');
  assert.match(ani, /myRealm === 'jalan' \? JALAN : YARD/);
  assert.match(ani, /JALAN_SOLIDS\.length[\s\S]*resolveAABB\(nx, nz, JALAN_SOLIDS\[ji\], 0\.4, JALAN\)/);
  assert.match(ani, /jalanZonaGerbangHalaman\(avatarPos\.x, avatarPos\.z\)\) enterJalan\(true\)/);
  assert.match(ani, /jalanZonaGerbangKos\(avatarPos\.x, avatarPos\.z\)\) exitJalan\(true\)/);
  assert.match(ani, /myRealm === 'yard' \|\| myRealm === 'jalan'\)\) \? 68 : 55/);
  assert.match(ani, /myRealm === 'jalan'\) jalanTick\(dt, Date\.now\(\)\)/);
  assert.match(ani, /jajanTick\(Date\.now\(\)\)/);
  assert.match(ani, /myRealm === 'jalan' \? jalanScene : scene/);
  const tap = blok('canvasTap');
  assert.match(tap, /myRealm === 'jalan' \? jalanClickables : clickables/);
  for (const [i, f] of [['warung', 'showWarungCard'], ['posronda', 'showPosRondaCard'], ['kentongan', 'pukulKentongan'], ['kucing', 'showKucingCard'], ['palang', 'showPalangCard'], ['gerbangKos', 'showGerbangCard\\(false\\)'], ['gerbangHalaman', 'showGerbangCard\\(true\\)']]) {
    assert.match(tap, new RegExp("ud\\.interact === '" + i + "'\\) \\{ " + f), i);
  }
  /* pindah alam: keluar jalan SEBELUM savedYard (kalau tidak, keluar ruangan mendarat di koordinat jalan) */
  for (const f of ['enterLiving', 'enterDapur', 'enterRoom']) {
    const b = blok(f), j = b.indexOf("if (myRealm === 'jalan') exitJalan();"), s = b.indexOf('savedYard = {');
    assert.ok(j > 0 && s > j, f);
  }
  assert.match(blok('flyToDoor'), /myRealm === 'jalan'\) exitJalan\(\)/);
  assert.match(HTML, /getElementById\('exitBtn'\)\.addEventListener\('click', function \(\) \{[^\n]*myRealm === 'jalan'\) exitJalan\(\)/);
  assert.match(HTML, /getElementById\('jalanBtn'\)\.addEventListener\('click', function \(\) \{ enterJalan\(\); \}\)/);
  assert.match(HTML, /<button id="jalanBtn"[^>]*>[\s\S]*?JALAN KAMPUNG<\/button>/);
  assert.match(blok('bangunDariKasur'), /jalanDiPosRonda = false/);
  assert.match(blok('buildVisitorAvatar'), /jajanPasang\(\)/);
  /* tamu boleh ke jalan (luar ruangan) — gerbang tamu hanya di ruangan */
  assert.doesNotMatch(blok('enterJalan'), /ktaIsResident/);
  /* misi: hook di aksinya; Bintang dipotong hanya kalau dekat + cukup, SEBELUM hadiah misi */
  const beli = blok('warungBeliKlik');
  assert.ok(beli.indexOf('JALAN_JARAK') < beli.indexOf('kosan3d-bintang') && beli.indexOf('if (!r.ok)') < beli.indexOf('kosan3d-bintang') && beli.indexOf('kosan3d-bintang') < beli.indexOf("misiSelesai('warung')"), 'urutan beli');
  assert.match(blok('elusKucing'), /misiSelesai\('kucing'\)/);
  assert.match(blok('posRondaDuduk'), /misiSelesai\('ronda'\)/);
  for (const ikon of ['jalan', 'warung', 'kucing', 'kentongan', 'palang', 'bintang']) assert.ok(HTML.includes('  ' + ikon + ": '<"), 'ikon ' + ikon);
  /* bahan menyala = MeshBasicMaterial (aturan tetap: tanpa emissive / bidang transparan bertumpuk) */
  assert.match(blok('jalanNyalaV'), /MeshBasicMaterial\(\{ vertexColors: true \}\)/);
  assert.match(blok('jalanPapan'), /new THREE\.MeshBasicMaterial\(\{ map: tex \}\)/);
  assert.doesNotMatch(antara('/* ==== JALAN-END ==== */', 'function jalanTick('), /emissive|transparent: true/);
});

test('17 Nov Alam Kerja: pos di alam kerja privat ikut batas alam dasarnya (realm utuh, tanpa jatuh ke yard)', () => {
  const pos = (realm, x, z) => F.mpValidasiPos(JSON.parse(JSON.stringify(F.mpBangunPos('pabc123', 'rina', 'cewek', realm, x, z, 0, 0, 1, 'stand', null, 0, 0, 0))), 'plain456');
  const r = pos('kerja-ronda-pabc123', -25, 0);
  assert.ok(r, 'ronda privat di x=-25 ditolak');
  assert.equal(r.realm, 'kerja-ronda-pabc123');
  assert.equal(r.x, -25);
  const w = pos('kerja-warung-pabc123', -4.5, 8.4);
  assert.ok(w, 'warung privat di jangkar (-4,5, 8,4) ditolak');
  assert.equal(w.realm, 'kerja-warung-pabc123');
  assert.equal(w.z, 8.4);
  const k = pos('kerja-kafe-pabc123', 3.15, 8.5);
  assert.ok(k, 'kafe privat di jangkar (3,15, 8,5) ditolak');
  assert.equal(k.realm, 'kerja-kafe-pabc123');
  const l = pos('kerja-laundry-pabc123', 2, -3.6);
  assert.ok(l, 'laundry privat di dapur ditolak');
  assert.equal(l.realm, 'kerja-laundry-pabc123');
  assert.equal(pos('kerja-ronda-pabc123', -30, 0), null, 'di luar batas jalan tetap ditolak');
  assert.equal(pos('kerja-warung-pabc123', 40, 0), null, 'di luar batas jalan tetap ditolak');
});
