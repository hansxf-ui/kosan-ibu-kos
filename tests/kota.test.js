'use strict';
/* Tes unit KOTA (destinasi baru, 22 Nov). Blok murni Kota (KOTA-START..KOTA-END) + PURE + MP-PURE
   diambil VERBATIM dari index.html. Jalankan: node --test tests/kota.test.js
   Isi: jalur ujung ke ujung bisa dilalui, semua pintu + objek interaktif + kursi terjangkau, interior
   (spawn, pintu keluar, objek, staf di balik meja), NPC (jumlah, rute bebas, deterministik, skala =
   avatar pemain), multiplayer (realm + batas), kabel ke game (tombol, scene, animate, ketuk), bahan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const MURNI = antara('/* ==== KOTA-START ==== */', '/* ==== KOTA-END ==== */');
const BLOK_KOTA = antara('/* ================= KOTA (destinasi baru, 22 Nov) ================= */', '/* ================= AKHIR KOTA ================= */');
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + MURNI
  + '\nreturn { KOTA, KOTA_SPAWN, KOTA_JALAN, KOTA_GEDUNG, KOTA_PADAT, KOTA_PINTU, KOTA_OBJEK, KOTA_KURSI, KOTA_NPC, KOTA_RUTE, KOTA_LAMPU_PLAZA, KOTA_R,'
  + ' KOTA_NPC_RANGKA, KOTA_RUANG, KOTA_RUANG_OBJEK, KOTA_RUANG_STAF, kotaBebas, kotaDorong, kotaZonaPintu, kotaDepanPintu, kotaRutePosisi, kotaRuteSiklus,'
  + ' kotaNpcKeadaan, kotaRuteCari, kotaKursiPilih, kotaKursiWarga, kotaRuangBatas, kotaPadatRuang, kotaRuangSpawn, kotaRuangZonaKeluar,'
  + ' mpRealmDikenal, mpRealmDasar, mpValidasiPos, MP_BATAS_KOTA, KOTA_POHON, KOTA_LAMPU, KOTA_HALANG_KAMERA, kotaKameraFaktor, kotaKamKotak };')();
const R = F.KOTA_R; /* radius badan avatar (kotaDorong di animate) */

/* BFS kisi: sel bebas (badan r tidak menyentuh padat, di dalam batas) yang terhubung ke titik awal */
function jangkau(batas, padat, awal, h) {
  const nx = Math.round((batas.maxX - batas.minX) / h) + 1, nz = Math.round((batas.maxZ - batas.minZ) / h) + 1;
  const bebas = new Uint8Array(nx * nz), lihat = new Uint8Array(nx * nz), antre = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) bebas[i * nz + k] = F.kotaBebas(Math.min(batas.maxX, batas.minX + i * h), Math.min(batas.maxZ, batas.minZ + k * h), R, padat, batas) ? 1 : 0;
  const s = Math.round((awal.x - batas.minX) / h) * nz + Math.round((awal.z - batas.minZ) / h);
  assert.ok(bebas[s], 'titik awal bebas ' + JSON.stringify(awal));
  lihat[s] = 1; antre.push(s);
  while (antre.length) {
    const c = antre.pop(), i = Math.floor(c / nz), k = c % nz;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = k + dk; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const q = a * nz + b; if (lihat[q] || !bebas[q]) continue; lihat[q] = 1; antre.push(q); }
  }
  let n = 0; for (let q = 0; q < nx * nz; q++) n += lihat[q];
  const ada = (f) => { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) if (lihat[i * nz + k] && f(Math.min(batas.maxX, batas.minX + i * h), Math.min(batas.maxZ, batas.minZ + k * h))) return true; return false; };
  return { luas: n * h * h, ada };
}
const JALAN_KOTA = jangkau(F.KOTA, undefined, F.KOTA_SPAWN, 0.25);

test('Kota: jaringan jalan luas, ujung ke ujung bisa dilalui (bulevar, raya, 4 jalan lingkar), spawn bebas', () => {
  assert.equal(F.kotaBebas(F.KOTA_SPAWN.x, F.KOTA_SPAWN.z, R), true);
  assert.ok(JALAN_KOTA.luas > 8000, 'luas terjangkau ' + JALAN_KOTA.luas.toFixed(0) + ' m2');
  assert.ok(JALAN_KOTA.ada((x) => x > 88), 'barat -> timur (ujung bulevar)');
  assert.ok(JALAN_KOTA.ada((x, z) => z < -54), 'ke utara');
  assert.ok(JALAN_KOTA.ada((x, z) => z > 54), 'ke selatan');
  for (const J of F.KOTA_JALAN) { /* tiap ruas jalan punya sel terjangkau di kedua ujung (jaringan menyambung + bisa memutar) */
    const panjangX = J.maxX - J.minX > J.maxZ - J.minZ, cx = (J.minX + J.maxX) / 2, cz = (J.minZ + J.maxZ) / 2;
    const ujung = panjangX ? [[J.minX + 3, cz], [J.maxX - 3, cz]] : [[cx, J.minZ + 3], [cx, J.maxZ - 3]];
    for (const [ux, uz] of ujung) assert.ok(JALAN_KOTA.ada((x, z) => Math.hypot(x - ux, z - uz) < 3.5), J.id + ' ' + ux + ',' + uz);
  }
  assert.ok(F.KOTA_GEDUNG.length >= 12, 'gedung ' + F.KOTA_GEDUNG.length);
  assert.equal(new Set(F.KOTA_GEDUNG.map((g) => g.id)).size, F.KOTA_GEDUNG.length, 'id gedung unik');
  for (const g of F.KOTA_GEDUNG) { /* tapak cembung (tabrakan poligon cembung) */
    const P = g.tapak; let tanda = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-9) continue; if (!tanda) tanda = Math.sign(cr); assert.equal(Math.sign(cr), tanda, g.id + ' cembung'); }
  }
});

test('Kota: semua pintu interior, objek interaktif, lampu plaza, dan kursi terjangkau dari spawn', () => {
  assert.ok(F.KOTA_PINTU.length >= 4, 'pintu ' + F.KOTA_PINTU.length);
  for (const p of F.KOTA_PINTU) {
    assert.ok(F.KOTA_RUANG[p.id], 'interior ' + p.id);
    assert.ok(JALAN_KOTA.ada((x, z) => F.kotaZonaPintu(x, z) === p), 'zona pintu ' + p.id);
    const luar = F.kotaDepanPintu(p, 1.5); /* titik keluar interior: bebas + di luar zona (tidak memantul masuk lagi) */
    assert.equal(F.kotaBebas(luar.x, luar.z, R), true, 'titik keluar ' + p.id);
    assert.equal(F.kotaZonaPintu(luar.x, luar.z), null, 'titik keluar di luar zona ' + p.id);
  }
  assert.equal(F.kotaZonaPintu(F.KOTA_SPAWN.x, F.KOTA_SPAWN.z), null, 'spawn bukan zona pintu');
  assert.ok(F.KOTA_OBJEK.length >= 8, 'objek ' + F.KOTA_OBJEK.length);
  for (const o of F.KOTA_OBJEK) {
    if (o.id === 'lampu') for (const L of F.KOTA_LAMPU_PLAZA) assert.ok(JALAN_KOTA.ada((x, z) => Math.hypot(x - L.x, z - L.z) <= o.jarak), 'lampu plaza ' + L.x + ',' + L.z);
    else assert.ok(JALAN_KOTA.ada((x, z) => Math.hypot(x - o.x, z - o.z) <= o.jarak * 0.8), 'objek ' + o.id);
  }
  assert.ok(F.KOTA_KURSI.length >= 40, 'kursi ' + F.KOTA_KURSI.length);
  for (const k of F.KOTA_KURSI) assert.ok(JALAN_KOTA.ada((x, z) => Math.hypot(x - k.bangun.x, z - k.bangun.z) <= 0.3), 'titik bangun kursi ' + k.id);
});

test('Kota: interior — spawn bebas, objek + pintu keluar terjangkau, staf berdiri di balik meja (tidak bisa ditabrak)', () => {
  const ids = Object.keys(F.KOTA_RUANG);
  assert.deepEqual(ids.sort(), ['arkade', 'butik', 'hotel', 'kafe']);
  for (const id of ids) {
    const B = F.kotaRuangBatas(id), P = F.kotaPadatRuang(id), sp = F.kotaRuangSpawn(id), Rg = F.KOTA_RUANG[id];
    assert.equal(F.kotaBebas(sp.x, sp.z, R, P, B), true, 'spawn ' + id);
    assert.equal(F.kotaRuangZonaKeluar(id, sp.x, sp.z), false, 'spawn di luar zona keluar ' + id);
    assert.ok(Rg.D / 2 - sp.z > 4, 'spawn jauh dari pintu (kamera di dalam ruang) ' + id);
    const J = jangkau(B, P, sp, 0.1);
    assert.ok(J.luas > 60, id + ' luas lantai ' + J.luas.toFixed(0));
    assert.ok(J.ada((x, z) => F.kotaRuangZonaKeluar(id, x, z + 0.1)), 'pintu keluar ' + id);
    const objek = F.KOTA_RUANG_OBJEK[id] || [];
    assert.ok(objek.length >= 1, 'objek interior ' + id);
    for (const o of objek) assert.ok(J.ada((x, z) => Math.hypot(x - o.x, z - o.z) <= o.jarak * 0.5), id + ' objek ' + o.id);
    for (const s of F.KOTA_RUANG_STAF[id]) assert.equal(F.kotaBebas(s.x, s.z, 0.3, P, B), false, id + ' staf di area padat meja');
  }
  let n = 0; for (const id of ids) n += F.KOTA_RUANG_OBJEK[id].length;
  assert.ok(n >= 8, 'objek interior total ' + n);
});

test('Kota: NPC >= 25 (jalan / duduk / ngobrol), rute bebas + kontinu, deterministik dari jam, duduk di kursi sungguhan', () => {
  const jenis = {}; F.KOTA_NPC.forEach((n) => { jenis[n.jenis] = (jenis[n.jenis] || 0) + 1; });
  assert.ok(F.KOTA_NPC.length >= 25, 'NPC ' + F.KOTA_NPC.length);
  assert.ok(jenis.jalan >= 10 && jenis.duduk >= 6 && jenis.ngobrol >= 6, JSON.stringify(jenis));
  for (const Rt of F.KOTA_RUTE) {
    const s = F.kotaRuteSiklus(Rt, 1.25);
    assert.ok(s > 10, Rt.id + ' siklus ' + s);
    for (let t = 0; t < s; t += 0.2) {
      const p = F.kotaRutePosisi(Rt, 1.25, t), q = F.kotaRutePosisi(Rt, 1.25, t + 0.2);
      assert.equal(F.kotaBebas(p.x, p.z, 0.35), true, Rt.id + ' bebas di t ' + t.toFixed(1) + ' ' + p.x.toFixed(2) + ',' + p.z.toFixed(2));
      assert.ok(Math.hypot(q.x - p.x, q.z - p.z) <= 1.25 * 0.2 + 1e-6, Rt.id + ' kontinu di t ' + t.toFixed(1));
    }
  }
  for (const n of F.KOTA_NPC) {
    assert.deepEqual(F.kotaNpcKeadaan(n, 1763800000.5), F.kotaNpcKeadaan(n, 1763800000.5), 'deterministik');
    if (n.jenis === 'jalan') { const Rt = F.kotaRuteCari(n.rute), s = F.kotaRuteSiklus(Rt, n.laju), a = F.kotaNpcKeadaan(n, 1000), b = F.kotaNpcKeadaan(n, 1000 + s); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6, 'periodik'); }
    if (n.jenis === 'duduk' && n.kursi) assert.ok(F.KOTA_KURSI.some((k) => Math.hypot(k.x - n.x, k.z - n.z) < 1e-6), 'duduk di kursi ' + n.kursi);
  }
  /* kursi terisi warga tidak dipilih pemain */
  const terisi = F.kotaKursiWarga();
  for (const k of F.KOTA_KURSI.slice(0, 20)) { const j = F.kotaKursiPilih(k.bangku, k.bangun.x, k.bangun.z, terisi); if (j) assert.ok(!terisi.some((t) => Math.hypot(t.x - j.x, t.z - j.z) < 0.05), 'kursi kosong ' + k.bangku); }
});

test('Kota: tinggi NPC = tinggi avatar pemain (rangka + skala sama dengan makeKosanAvatar)', () => {
  const avatar = fungsi('makeKosanAvatar'), K = F.KOTA_NPC_RANGKA;
  assert.ok(avatar.includes('pivot(sx * ' + K.pinggulX + ', ' + K.pinggulY + ', 0)'), 'sendi pinggul');
  assert.ok(avatar.includes('pivot(sx * ' + K.bahuX + ', ' + K.bahuY + ', 0, sx * ' + K.bahuRz + ')'), 'sendi bahu');
  assert.ok(avatar.includes('new THREE.SphereGeometry(' + K.kepalaR + ', 28, 18)'), 'jari-jari kepala');
  assert.ok(avatar.includes('kepala.position.set(0, ' + K.kepalaY + ', 0)'), 'tinggi kepala');
  assert.ok(avatar.includes('g.scale.setScalar(ibu ? 1.0 : ' + K.skala + ')'), 'skala akar');
  assert.ok(BLOK_KOTA.includes('akar.scale.setScalar(R.skala)'), 'NPC memakai skala rangka');
  assert.ok(BLOK_KOTA.includes('new THREE.SphereGeometry(R.kepalaR, 16, 12), M(0, R.kepalaY, 0)'), 'kepala NPC dari rangka');
});

test('Kota: multiplayer — realm Kota + interior dikenal, batas posisi Kota', () => {
  for (const r of ['kota', 'kota-hotel', 'kota-kafe', 'kota-butik', 'kota-arkade']) assert.equal(F.mpRealmDikenal(r), r);
  assert.equal(F.mpRealmDikenal('kota-bank'), 'yard');
  assert.equal(F.mpRealmDasar('kota-hotel'), 'kota');
  const pos = (realm, x, z) => F.mpValidasiPos({ id: 'pabc1', nama: 'cici', gender: 'cewek', realm: realm, x: x, z: z, rot: 0, gerak: 0, ts: 1, pose: 'stand' }, 'pdiri');
  assert.ok(pos('kota', 88, 50), 'ujung timur-selatan Kota');
  assert.ok(pos('kota', F.KOTA_SPAWN.x, F.KOTA_SPAWN.z), 'spawn Kota');
  assert.ok(pos('kota-hotel', -10.6, 7.6), 'pojok lobi hotel');
  assert.equal(pos('kota', 0, 70), null, 'di luar batas Kota');
  assert.ok(F.KOTA.minX >= F.MP_BATAS_KOTA.minX && F.KOTA.maxX <= F.MP_BATAS_KOTA.maxX && F.KOTA.minZ >= F.MP_BATAS_KOTA.minZ && F.KOTA.maxZ <= F.MP_BATAS_KOTA.maxZ, 'batas jalan Kota di dalam batas MP');
});

test('Kota: kabel ke game — tombol Pergi ke KOTA, scene per realm, animate, ketuk, keluar kembali ke asal, dibangun saat masuk', () => {
  assert.ok(/<button id="kotaBtn"[^>]*>[\s\S]{0,800}?KOTA<\/button>/.test(HTML), 'tombol KOTA di menu Pergi ke');
  assert.ok(/getElementById\('kotaBtn'\)\.addEventListener\('click', function \(\) \{[^}]*enterKota\(\)/.test(HTML), 'tombol memanggil enterKota');
  assert.ok(fungsi('sceneUntukRealm').includes('kotaSceneUntuk('), 'pemain lain di Kota tampil di scene Kota');
  const animate = fungsi('animate');
  for (const s of ['kotaBatasKini()', 'kotaDorong(', 'kotaLangkah()', 'kotaTick(dt', 'kotaSceneUntuk(myRealm)']) assert.ok(animate.includes(s), 'animate: ' + s);
  assert.ok(fungsi('canvasTap').includes('if (ud.kota) { kotaKetuk(ud); return; }'), 'ketuk objek Kota');
  /* aset dibangun HANYA saat pertama masuk */
  const panggil = HTML.split('buildKota();').length - 1; /* panggilan (definisi 'function buildKota() {' tidak dihitung) */
  assert.equal(panggil, 1, 'buildKota() dipanggil sekali (di enterKota)');
  assert.ok(fungsi('enterKota').includes('if (!KOTA_SIAP) buildKota();'));
  assert.ok(fungsi('kotaMasukRuang').includes('if (!kotaRuangSiap[id]) kotaBangunRuang(id);'), 'interior dibangun saat dimasuki');
  /* keluar = kembali ke tempat asal */
  const keluar = fungsi('exitKota');
  assert.ok(keluar.includes('myRealm = A.realm;') && keluar.includes("A.realm === 'jalan' ? jalanScene : scene"), 'kembali ke halaman / jalan asal');
  assert.ok(keluar.includes('enterLiving()') && keluar.includes('enterDapur()'), 'kembali ke ruang tamu / dapur asal');
  for (const f of ['enterLiving', 'enterDapur', 'enterRoom']) assert.ok(fungsi(f).includes('if (kotaRealmIni(myRealm)) exitKota(false);'), f + ' keluar Kota dulu');
});

test('Kota: bahan — semua yang menyala MeshBasicMaterial (tanpa emissive), anggaran cahaya tetap', () => {
  for (const k of ['nyala', 'teks', 'etalase']) assert.ok(new RegExp(k + ': new THREE\\.MeshBasicMaterial\\(').test(BLOK_KOTA), k);
  assert.ok(/kaca: \(function \(\) \{ var m = new THREE\.MeshBasicMaterial\(/.test(BLOK_KOTA), 'kaca menara (jendela malam) Basic');
  assert.ok(/KB\.led = new THREE\.MeshBasicMaterial\(|new THREE\.MeshBasicMaterial\(\{ map: KOTA_LED_TEX/.test(BLOK_KOTA), 'layar LED Basic');
  assert.ok(!/\.emissive\b|emissive\s*:/.test(BLOK_KOTA), 'tidak ada emissive di Kota');
  assert.ok(!/new THREE\.(PointLight|SpotLight)\(/.test(antara('function buildKota()', 'function kotaPetaCahaya()')), 'jalan Kota tanpa lampu titik / sorot (genangan = peta cahaya)');
  assert.ok(!/supabase|mqtt|kosan_occupants/i.test(BLOK_KOTA), 'Kota tidak menyentuh Supabase / MQTT');
});

test('Kota: kamera — garis tengah bulevar + jalan lingkar bebas batang / tiang, penghindar kamera hanya bekerja saat perlu', () => {
  /* kamera orbit bawaan (cameraPos di index.html): di belakang pemain, landscape 9 m / portrait 13 m, pitch 0,2 */
  const kam = (x, z, yaw, d) => ({ x: x + Math.sin(yaw) * d * Math.cos(0.2), y: Math.sin(0.2) * d + 1.2, z: z + Math.cos(yaw) * d * Math.cos(0.2) });
  const tengah = [ /* [x0, z0, x1, z1] garis tengah: bulevar (di luar plaza) + 4 jalan lingkar */
    [-88, 0, -13, 0], [13, 0, 90, 0], [-54, -52, -54, 52], [54, -52, 54, 52], [-54, -52, 54, -52], [-54, 52, 54, 52]];
  const tiang = F.KOTA_POHON.concat(F.KOTA_LAMPU.filter((l) => !F.KOTA_LAMPU_PLAZA.some((q) => q.x === l.x && q.z === l.z)));
  assert.equal(F.KOTA_HALANG_KAMERA.length, F.KOTA_POHON.length + F.KOTA_LAMPU.length, 'semua pohon + tiang terdaftar sebagai penghalang kamera');
  for (const [x0, z0, x1, z1] of tengah) {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (const o of tiang) { /* tidak ada pohon / tiang jalan dalam koridor 2 m kiri-kanan garis tengah */
      const s = (o.x - x0) * ux + (o.z - z0) * uz; if (s < 0 || s > L) continue;
      const d = Math.abs((o.x - x0) * uz - (o.z - z0) * ux);
      assert.ok(d >= 2, 'penghalang di garis tengah: ' + JSON.stringify(o) + ' jarak ' + d.toFixed(2));
    }
    for (const arah of [1, -1]) for (const dist of [9, 13]) for (let s = 0; s <= L; s += 0.5) { /* jalan lurus dua arah: penghindar diam (faktor 1) */
      const x = x0 + ux * s, z = z0 + uz * s, yaw = Math.atan2(-ux * arah, -uz * arah), c = kam(x, z, yaw, dist);
      const fk = F.kotaKameraFaktor(c.x, c.y, c.z, x, 1.5, z, dist);
      const K = F.kotaKamKotak(z), dalam = (q) => q.x >= K.x0 - 1e-9 && q.x <= K.x1 + 1e-9 && q.z >= K.z0 - 1e-9 && q.z <= K.z1 + 1e-9;
      if (dalam(c)) assert.equal(fk, 1, 'kamera terganggu di ' + x.toFixed(1) + ',' + z.toFixed(1));
      else { /* ujung jalan: kamera ditahan di depan fasad gedung penutup (paling dekat 1,6 m dari pemain) */
        const k2 = { x: x + (c.x - x) * fk, z: z + (c.z - z) * fk };
        assert.ok(fk < 1 && (fk * dist <= 1.6 + 1e-9 || dalam(k2)), 'kamera masuk gedung ujung di ' + x.toFixed(1) + ',' + z.toFixed(1));
      }
    }
  }
  /* tiang tepat di antara kamera dan pemain, dekat kamera -> kamera didekatkan sampai lewat tiang, tidak lebih dekat dari 60% */
  const t = F.KOTA_LAMPU.find((l) => Math.abs(l.z) === 5.7), yaw = -Math.PI / 2, px = t.x + 7, c = kam(px, t.z, yaw, 9);
  const f = F.kotaKameraFaktor(c.x, c.y, c.z, px, 1.5, t.z, 9);
  assert.ok(f < 1 && f >= 0.6, 'faktor ' + f);
  assert.ok(px - 9 * f * Math.cos(0.2) > t.x + 0.3, 'kamera baru berada di sisi pemain dari tiang');
  for (let geser = 0; geser <= 1.2; geser += 0.02) { /* mulus: geser menyamping sedikit -> faktor berubah sedikit (tanpa lompat) */
    const a = F.kotaKameraFaktor(c.x, c.y, c.z + geser, px, 1.5, t.z + geser, 9), b = F.kotaKameraFaktor(c.x, c.y, c.z + geser + 0.02, px, 1.5, t.z + geser + 0.02, 9);
    assert.ok(Math.abs(a - b) < 0.05, 'lompat di geser ' + geser.toFixed(2));
  }
  assert.equal(F.kotaKameraFaktor(c.x, c.y, c.z + 1.5, px, 1.5, t.z + 1.5, 9), 1, 'tiang di samping (1,5 m) tidak mengubah kamera');
  /* kabel: hanya di alam Kota (kotaTick cabang myRealm === "kota"), kamera alam lain tidak disentuh */
  const tick = fungsi('kotaTick');
  assert.ok(tick.indexOf('kotaKameraTick(dt)') > tick.indexOf("if (myRealm === 'kota')") && tick.indexOf('kotaKameraTick(dt)') < tick.indexOf('} else if'), 'penghindar hanya di cabang Kota');
  assert.equal(HTML.split('kotaKameraTick(').length - 1, 2, 'kotaKameraTick: definisi + satu panggilan');
});

test('Kota: tanaman — tidak ada lagi semak / pot "bola bersegi"; pagar teras menyambung; tanaman interior = helai berbentuk + pot bubut', () => {
  /* ikosahedron detail 0 (20 muka datar) + kerucut 4 sisi dulu dipakai untuk semak pot, bunga, dan daun: sekarang gugus halus */
  const iko0 = BLOK_KOTA.split('\n').filter((b) => /IcosahedronGeometry\([^)]*,\s*0\)/.test(b) && !/B\.bayang\.geo\(new THREE\.IcosahedronGeometry/.test(b));
  assert.equal(iko0.length, 0, 'tidak ada ikosahedron detail 0 di blok Kota (kecuali bayangan tajuk di tanah)');
  assert.ok(!/ConeGeometry\([^)]*,\s*4\)[^;]*kotaW\((0x3f7f3f|0x4f8a45|0x5a9a4c|KC\.daun)/.test(BLOK_KOTA), 'tidak ada daun kerucut 4 sisi');
  assert.ok(!/IcosahedronGeometry\([^)]*\)[^;]*kotaW\(KC\.daun(Muda)?\)/.test(BLOK_KOTA), 'tidak ada bola ikosahedron hijau');
  const teras = BLOK_KOTA.slice(BLOK_KOTA.indexOf('KOTA_TERAS.forEach('));
  assert.match(teras.slice(0, 900), /kotaPagarDaun\(B\.daun,/, 'pagar teras kafe = pagar tanaman menyambung di ember daun');
  /* tanaman interior (23 Nov): tanaman hias sungguhan — bukan semak gugus ("brokoli"), bukan bola / kerucut */
  const hias = antara('/* ---- tanaman hias interior "hero"', 'function kotaLampuGantung(');
  assert.ok(!/kotaSemak\(|kotaGugusDaun\(|IcosahedronGeometry|ConeGeometry/.test(hias), 'tanaman interior tanpa gugus bola / kerucut');
  for (const f of ['kotaFicus', 'kotaPalem', 'kotaStrelitzia', 'kotaKuntum', 'kotaRangkaianBunga', 'kotaTanamanGantung']) assert.match(fungsi(f), /kotaHelai\(B\.helai,/, f + ': daun / kelopak = helai berbentuk di ember helai');
  assert.match(fungsi('kotaTanamanPot'), /kotaPotMewah\(B, x, z, s, o\)/, 'tanaman pot interior berdiri di pot bubut');
  for (const m of hias.matchAll(/kotaPutar\(B\.kilap,[\s\S]*?\], (\d+), c[A-Z]\);/g)) assert.ok(+m[1] >= 24, 'pot / vas bubut minimal 24 sisi (dapat ' + m[1] + ')');
  assert.equal([...hias.matchAll(/kotaPutar\(B\.kilap,[\s\S]*?\], (\d+), c[A-Z]\);/g)].length, 3, 'pot lantai, vas lobi, pot gantung = benda putar');
  assert.ok(!/silinder\([^;]*, (\d|1\d|2[0-3]), kotaW\((0xb8644a|0xc9d6e0)\)/.test(antara('function kotaIsiHotel(', 'function kotaKabinet(')), 'tidak ada lagi pot / vas silinder bersegi di interior');
  assert.match(fungsi('kotaIsiHotel'), /kotaRangkaianBunga\(B, 0, 0\.96, 0\)/, 'vas lobi hotel = rangkaian bunga berkelopak');
  assert.match(fungsi('kotaIsiKafe'), /kotaTanamanGantung\(B, p\[0\], p\[1\], H\)/, 'tanaman gantung kafe');
  assert.match(fungsi('kotaIsiHotel'), /'palem' : 'ficus'/, 'lobi hotel: palem + ficus');
  assert.match(fungsi('kotaIsiButik'), /'strelitzia', potB\)[\s\S]*'ficus', potB\)/, 'butik: strelitzia + ficus');
  /* satu bahan helai (Lambert dua sisi, tidak menyala) dipakai semua ruang -> +1 draw call per ruang bertanaman, bukan per tanaman */
  assert.equal(BLOK_KOTA.split("helai.name = 'kota-dalam-helai'").length - 1, 1, 'satu bahan helai');
  assert.match(fungsi('kotaBahanUmum'), /var helai = new THREE\.MeshLambertMaterial\(\{ map: teksturLukis\(256, 512, kotaLukisHelai\), vertexColors: true, side: THREE\.DoubleSide \}\)/, 'bahan helai Lambert dua sisi');
  assert.equal(BLOK_KOTA.split("new KotaGeo('helai')").length - 1, 1, 'satu ember helai per ruang (kotaBangunRuang)');
  assert.match(fungsi('kotaBalkonDeret'), /kotaSemak\(B\.daun,/, 'pot balkon: semak halus di ember daun');
  assert.match(fungsi('kotaSemak'), /kotaGugusDaun\(/, 'semak memakai gugus daun yang sama dengan semak bak pohon');
});
