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
  + ' mpRealmDikenal, mpRealmDasar, mpValidasiPos, MP_BATAS_KOTA, KOTA_POHON, KOTA_LAMPU, KOTA_SOROT, KOTA_HALANG_KAMERA, kotaKameraFaktor, kotaKamKotak, KOTA_BANGKU, KOTA_RAGAM_TOKO, KOTA_MEREK_LINGKAR, kotaRagamPilih, KOTA_LINGKAR_LANTAI, KOTA_POT, kotaDiLingkar, kotaRuangKeLuar,'
  + ' KOTA_SPANDUK_TEKS, KOTA_SPANDUK_PX, kotaSpandukUkuran, KOTA_DUDUKAN, KOTA_DUDUK_Y, kotaNpcDudukY };')();
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
  assert.equal(panggil, 1, 'buildKota() dipanggil sekali (di kotaMasukSekarang: jaring pengaman)');
  assert.ok(fungsi('kotaMasukSekarang').includes('if (!KOTA_SIAP) buildKota();'));
  assert.ok(fungsi('enterKota').includes("if (!KOTA_SIAP || !kotaPanasBeres) { kotaMuatMulai(); return; }"), 'pertama masuk: bertahap di balik layar Menuju Kota');
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
  assert.equal(F.KOTA_HALANG_KAMERA.length, F.KOTA_POHON.length + F.KOTA_LAMPU.length + F.KOTA_SOROT.length, 'semua pohon + tiang (termasuk 4 tiang sorot plaza) terdaftar sebagai penghalang kamera');
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

/* ===== Paket perbaikan Kota 23 Nov: jalan lingkar, NPC duduk, papan nama, pintu, papan menu, intip, latar keluar, spanduk, kedip ===== */
const lum = (h) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(h >> 16 & 255) + 0.7152 * f(h >> 8 & 255) + 0.0722 * f(h & 255); };
const kontras = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (t) => parseInt(String(t).replace('#', '').replace('0x', ''), 16);

test('jalan lingkar: permukaan terang, >= 6 ragam toko, tidak ada tetangga kembar, pot di tepi', () => {
  const L = F.KOTA_LINGKAR_LANTAI;
  for (const k of ['trotoar', 'lajur']) assert.ok(lum(L[k]) > 0.7, k + ' terang (luminans ' + lum(L[k]).toFixed(2) + ')');
  assert.ok(L.lebarTrotoar >= 1.2, 'trotoar dua sisi >= 1,2 m');
  assert.ok(F.KOTA_RAGAM_TOKO.length >= 6, 'ragam toko >= 6');
  const G = F.KOTA_RAGAM_TOKO;
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
    assert.notEqual(G[i].id, G[j].id);
    assert.ok(G[i].tiang !== G[j].tiang && G[i].papan !== G[j].papan, 'bahan fasad beda: ' + G[i].id + ' vs ' + G[j].id);
  }
  assert.ok(new Set(G.map((g) => g.papanT)).size >= 5, 'tinggi parapet beragam');
  assert.ok(new Set(G.map((g) => String(g.tenda))).size >= 3, 'bentuk peneduh beragam (pelat / kain / tanpa)');
  for (const g of G) assert.ok(kontras(g.nama, hex(g.latar)) >= 3, 'papan toko ' + g.id + ' terbaca (kontras ' + kontras(g.nama, hex(g.latar)).toFixed(1) + ')');
  assert.equal(new Set(F.KOTA_MEREK_LINGKAR).size, F.KOTA_MEREK_LINGKAR.length, 'nama toko unik');
  /* simulasi dua deret berhadapan sepanjang 4 sisi (teluk 5 m, koridor 8 m): tidak ada ragam sama dalam 11 m */
  const daftar = [];
  for (let s = -52; s <= 52; s += 5) for (const t of [50, 58]) { F.kotaRagamPilih(daftar, s, -t); F.kotaRagamPilih(daftar, s, t); F.kotaRagamPilih(daftar, -t, s); F.kotaRagamPilih(daftar, t, s); }
  assert.ok(new Set(daftar.map((d) => d.g)).size >= 6, 'ragam terpakai >= 6');
  let kembar = 0, bentrokNama = 0;
  for (let i = 0; i < daftar.length; i++) for (let j = 0; j < i; j++) {
    const d = Math.hypot(daftar[i].x - daftar[j].x, daftar[i].z - daftar[j].z);
    if (d < 11 && daftar[i].g === daftar[j].g) kembar++;
    if (d < 11 && daftar[i].n === daftar[j].n) bentrokNama++;
  }
  assert.equal(kembar, 0, 'tidak ada dua toko berdekatan (sederet / seberang) dengan ragam sama');
  assert.equal(bentrokNama, 0, 'tidak ada dua toko berdekatan bernama sama');
  assert.match(fungsi('kotaDeretToko'), /kotaRagamPilih\(KOTA_TOKO_LINGKAR,/, 'deret toko lingkar memakai pemilih ragam');
  /* pot: di jalan lingkar, di tepi (bukan di lajur tengah), dan lajur jalan tetap bisa dilalui */
  assert.ok(F.KOTA_POT.length >= 12);
  for (const p of F.KOTA_POT) {
    assert.ok(F.kotaDiLingkar(p.x, p.z), 'pot di jalan lingkar');
    const tengah = Math.abs(Math.abs(p.x) - 54) < 2 && Math.abs(p.z) <= 46 || Math.abs(Math.abs(p.z) - 52) < 2 && Math.abs(p.x) <= 48;
    assert.ok(!tengah, 'pot tidak di lajur tengah: ' + p.x + ',' + p.z);
    assert.ok(!F.kotaBebas(p.x, p.z, 0.2), 'pot punya collider');
  }
  for (let s = -44; s <= 44; s += 1) for (const q of [[s, -52], [s, 52], [-54, s], [54, s]]) assert.ok(F.kotaBebas(q[0], q[1], R), 'lajur lingkar bebas di ' + q);
});

test('NPC + pemain duduk DI ATAS dudukan, menghadap melintang bangku', () => {
  const K = F.KOTA_NPC_RANGKA, pinggul = F.kotaNpcDudukY() + K.pinggulY * K.skala;
  assert.ok(pinggul >= F.KOTA_DUDUKAN + 0.05 && pinggul <= F.KOTA_DUDUKAN + 0.2, 'sendi pinggul warga 5-20 cm di atas dudukan (dapat ' + pinggul.toFixed(3) + ')');
  assert.ok(F.KOTA_DUDUK_Y + 0.72 >= F.KOTA_DUDUKAN + 0.05, 'pinggul pemain di atas dudukan');
  assert.ok(!/KOTA_DUDUK_Y = -0\.31/.test(BLOK_KOTA), 'tinggi duduk lama (tenggelam) sudah tidak dipakai');
  /* bangku tunggal: 3 kursi berjajar SEPANJANG bangku, hadap TEGAK LURUS jajaran itu */
  for (const b of F.KOTA_BANGKU.filter((x) => !x.ganda)) {
    const k = F.KOTA_KURSI.filter((q) => q.bangku === b.id);
    assert.equal(k.length, 3);
    const ax = k[2].x - k[0].x, az = k[2].z - k[0].z, fx = Math.sin(b.rot), fz = Math.cos(b.rot);
    assert.ok(Math.abs(ax * fx + az * fz) < 0.01, b.id + ': hadap tegak lurus sumbu bangku');
    for (const q of k) assert.ok(Math.abs(q.rot - b.rot) < 1e-9);
  }
  const bangku = fungsi('kotaBangku');
  assert.match(bangku, /b\.ganda/, 'pembangun bangku membedakan ganda / tunggal');
  /* kaki duduk dibentuk di geometri (paha mendatar + betis turun), atasan pendek: tidak ada "dasi" balok panjang */
  assert.match(BLOK_KOTA, /duduk/);
  assert.match(fungsi('kotaWargaBangun'), /duduk/, 'geometri warga tahu pose duduk');
});

test('papan nama gedung: pelat arang + huruf menyala kontras tinggi, pelat selalu lebih lebar dari huruf', () => {
  const m = /var KOTA_PAPAN_GEDUNG = \{ pelat: (0x[0-9a-f]{6}), huruf: (0x[0-9a-f]{6}), lis: (0x[0-9a-f]{6}) \}/.exec(BLOK_KOTA);
  assert.ok(m, 'KOTA_PAPAN_GEDUNG');
  assert.ok(kontras(hex(m[1]), hex(m[2])) >= 7, 'kontras huruf vs pelat >= 7 (dapat ' + kontras(hex(m[1]), hex(m[2])).toFixed(1) + ')');
  const f = fungsi('kotaPapanGedung');
  assert.match(f, /hw = lebar \/ 2 \+ tinggi \* 0\.6/, 'lebar pelat = lebar huruf terukur + napas');
  assert.match(f, /B\.nyala\.huruf\(/, 'huruf papan menyala (Basic) -> terbaca malam');
  for (const t of ['MENARA KEMBAR', 'GEDUNG KESENIAN', 'HOTEL KENCANA', 'MAISON LUNA', 'BANK NUSANTARA', 'MENARA NUSANTARA', 'STASIUN KOTA'])
    assert.ok(BLOK_KOTA.includes("kotaPapanGedung(B, F, '" + t + "'"), t + ' memakai papan kontras');
  assert.ok(!/huruf\(F, '(MENARA KEMBAR|GEDUNG KESENIAN)'/.test(BLOK_KOTA), 'huruf lama (krem di krem / di belakang pilar) dicabut');
  assert.match(BLOK_KOTA, /B\.kilap\.huruf\(F, 'TEKNO'[^;]*kotaW\(0x20242c\)/, 'TEKNO: huruf gelap di dinding terang');
});

test('pintu interior: portal MASUK seragam di 4 pintu, pemicu persis di bukaan, pintu arkade tidak lagi tertutup dinding', () => {
  const f = fungsi('kotaPortalMasuk');
  assert.match(f, /kotaPlangMasuk\(\)/, 'penanda MASUK');
  assert.match(f, /B\.nyala\.fk\(/, 'garis lampu menyala di atas pintu');
  assert.match(f, /M\.keset/, 'keset');
  assert.match(fungsi('kotaPlangMasuk'), /fillText\('MASUK'/);
  assert.equal(BLOK_KOTA.split('  kotaPortalMasuk(B, F,').length - 1 + BLOK_KOTA.split('if (depan) kotaPortalMasuk(B, F,').length - 1, 4, 'tepat 4 portal (hotel, kafe, butik, arkade)');
  for (const g of ['kotaGedungHotel', 'kotaGedungKafe', 'kotaGedungBioskop']) assert.match(fungsi(g), /kotaPortalMasuk\(B, F,/, g);
  const mk = /var KOTA_MASUK = \{ palang: (0x[0-9a-f]{6}), kusen: 0x[0-9a-f]{6}, teks: '(#[0-9a-f]{6})'/.exec(BLOK_KOTA);
  assert.ok(mk && kontras(hex(mk[1]), hex(mk[2])) >= 7, 'tulisan MASUK kontras');
  assert.ok(!fungsi('kotaGedungBioskop').includes('B.kilap.fk(F, 0.45, L - 0.45, 0, 6.0, -0.2, 0, kotaW(0x24252d), KM_PZ);'), 'dinding muka arkade tidak lagi menutup pintu + etalase');
  /* pemicu masuk: hanya di depan bukaan (<= setengah lebar pintu), tidak di dinding sebelahnya */
  for (const p of F.KOTA_PINTU) {
    const tx = p.nz, tz = -p.nx, d = R + 0.05;
    assert.ok(F.kotaZonaPintu(p.x + p.nx * d, p.z + p.nz * d), p.id + ': ambang memicu');
    for (const s of [-1, 1]) assert.equal(F.kotaZonaPintu(p.x + p.nx * d + tx * s * (p.lebar / 2 + 0.3), p.z + p.nz * d + tz * s * (p.lebar / 2 + 0.3)), null, p.id + ': dinding sebelah pintu tidak memicu');
  }
  assert.match(BLOK_KOTA, /function kotaPlangKeluar\(/, 'plang KELUAR di dalam interior');
});

test('papan menu Kafe Bulan: teks tidak sebidang dengan bingkai (jarak >= 2 cm)', () => {
  const m = /B\.teks\.fkuad\(Fb, 1\.6, 6\.4, 2\.0, 3\.6, (0\.\d+), kotaW\(0xffffff\), kotaAtlas\(320, 120,[^\n]*Kopi Susu Bulan/.exec(BLOK_KOTA);
  assert.ok(m, 'bidang teks menu ditemukan');
  assert.ok(+m[1] >= 0.05, 'teks menu >= 2 cm di depan muka bingkai 0,03 (dapat ' + m[1] + ')');
});

test('intip + pemandangan keluar: lukisan interior per tempat; dari dalam yang terlihat = Kota ASLI lewat kamera pemain (dua lintasan), bukan potret di panel', () => {
  for (const id of ['hotel', 'kafe', 'butik', 'arkade']) assert.ok(new RegExp("intip: \\{ id: '" + id + "'|IA = \\{ id: '" + id + "'").test(BLOK_KOTA), 'lukisan intip dipakai: ' + id);
  assert.match(fungsi('kotaDindingLengkung'), /if \(o\.intip\) B\.teks\.fkuad\(/, 'bukaan lengkung: lukisan (Basic) menggantikan bidang polos');
  assert.match(fungsi('kotaPintuKaca'), /if \(o\.intip\) B\.teks\.fkuad\(/);
  /* setiap interior yang bisa dimasuki punya pintu + pemetaan ke Kota */
  assert.deepEqual(F.KOTA_PINTU.map((p) => p.id).sort(), Object.keys(F.KOTA_RUANG).sort(), 'tiap ruang punya pintu di Kota');
  for (const p of F.KOTA_PINTU) {
    const D = F.KOTA_RUANG[p.id].D, a = F.kotaRuangKeLuar(p.id, 0, D / 2), b = F.kotaRuangKeLuar(p.id, 0, D / 2 + 5), c = F.kotaRuangKeLuar(p.id, 3, D / 2), o = F.kotaRuangKeLuar(p.id, 0, 0);
    assert.ok(Math.hypot(a.x - p.x, a.z - p.z) < 1e-9, p.id + ': ambang pintu ruang = titik pintu di Kota');
    assert.ok(Math.abs((b.x - a.x) - 5 * p.nx) < 1e-9 && Math.abs((b.z - a.z) - 5 * p.nz) < 1e-9, p.id + ': keluar pintu ruang = normal pintu di Kota (skala 1 : 1)');
    assert.ok(Math.abs(Math.hypot(c.x - a.x, c.z - a.z) - 3) < 1e-9 && Math.abs((c.x - a.x) * p.nx + (c.z - a.z) * p.nz) < 1e-9, p.id + ': kiri-kanan tegak lurus normal, tanpa skala');
    assert.ok(Math.abs(Math.sin(o.rot) - p.nx) < 1e-9 && Math.abs(Math.cos(o.rot) - p.nz) < 1e-9, p.id + ': sudut putar ruang');
    assert.equal(F.kotaBebas(a.x + p.nx * 1.2, a.z + p.nz * 1.2, R), true, p.id + ': 1,2 m di luar ambang = lantai jalan Kota yang bisa diinjak (lantai dalam = lantai luar, y 0)');
  }
  assert.equal(F.kotaRuangKeLuar('tidak-ada', 0, 0), null);
  /* mekanisme lama (potret render-ke-tekstur di 3 panel 14 m) harus hilang seluruhnya */
  assert.ok(!fungsi('kotaBangunRuang').includes('kotaLatarLuar('), 'latar generik (aspal bermarka) tidak dipakai');
  for (const n of ['kotaLatarPanel', 'kotaLatarPotret', 'kotaLatarBahan', 'KOTA_LATAR =', 'KOTA_PANDANG']) assert.ok(!BLOK_KOTA.includes(n), 'sisa mekanisme lama: ' + n);
  const rr = fungsi('kotaRuangRender');
  assert.match(rr, /c\.matrix\.multiplyMatrices\(L\.m, camera\.matrixWorld\)/, 'kamera Kota = kamera pemain dipindah ke koordinat Kota (sudut apa pun: mata, atas, samping)');
  assert.match(rr, /kotaRuangKeLuar\(id, 0, 0\)/);
  assert.ok(!/setY|position\.y\s*[+-]?=|scale\.set\(/.test(rr.replace(/lg\.scale\.setScalar\([^)]*\)/g, '')), 'tanpa geser tinggi / skala: lantai + ukuran warga 1 : 1');
  assert.match(rr, /L\.bidang\.distanceToPoint\(c\.position\) < -0\.05/, 'bidang potong miring hanya saat kamera di belakang fasad');
  assert.match(rr, /pe\[2\] = v\.x; pe\[6\] = v\.y; pe\[10\] = v\.z \+ 1; pe\[14\] = v\.w;/, 'gedung asli di belakang fasad tidak ikut tergambar (tidak menutup pintu / etalase dari dalam)');
  assert.match(BLOK_KOTA, /var KOTA_TEMBUS = \{ cam: null, m: null, id: null, potong: 0\.3 \};/);
  assert.match(fungsi('kotaBangunRuang'), /alas\.name = 'kota-alas-luar'/, 'sekeliling ruang = alas gelap, bukan langit');
  const i1 = rr.indexOf('renderer.render(kotaScene, c)'), i2 = rr.indexOf('renderer.clearDepth()'), i3 = rr.indexOf('renderer.render(S, camera)');
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, 'urutan: Kota asli -> bersihkan depth -> ruang di atasnya');
  assert.match(rr, /S\.background = null; renderer\.autoClear = false/, 'ruang tidak menghapus Kota di belakangnya');
  assert.match(rr, /renderer\.autoClear = ac; S\.background = bg;/, 'keadaan renderer dipulihkan');
  assert.match(HTML, /if \(kotaRuangKini && myRealm\.indexOf\('kota-'\) === 0\) kotaRuangRender\(\);/, 'animate memakai render dua lintasan di interior Kota');
  assert.match(fungsi('kotaRuangTick'), /kotaNpcTick\(dt, now\); kotaLedTick\(performance\.now\(\)\); kotaAnimTick\(performance\.now\(\)\);/, 'Kota di balik pintu tetap hidup');
});

test('teks kanvas Kota: papan MRT muat di kiri logo M; pembantu kotaTeksMuat; spanduk tegak, poster, menu kios, muka jam tidak saling timpa / meluber', () => {
  const muat = new Function(fungsi('kotaTeksMuat') + '\nreturn kotaTeksMuat;')();
  const ctx = { font: '', measureText(s) { const px = +/(\d+)px/.exec(this.font)[1]; return { width: String(s).length * px * 0.62 }; } };
  assert.equal(muat(ctx, 'ABCDEFGHIJ', 800, 48, 1000, 'X'), 48, 'cukup lebar: ukuran penuh');
  const px = muat(ctx, 'KE PERON  ·  ARAH KOSAN', 800, 48, 442, 'X');
  assert.ok(px < 48 && 23 * px * 0.62 <= 442 && 23 * (px + 1) * 0.62 > 442, 'ukuran terbesar yang muat: ' + px);
  assert.equal(muat(ctx, 'X'.repeat(500), 800, 48, 100, 'X'), 8, 'batas bawah 8 px');
  const st = fungsi('kotaGedungStasiun'), m = /kotaAtlas\((\d+), (\d+), function \(ctx, w, h\) \{ \/\* papan 12 x 2,4 m[^]*?\}\)\);/.exec(st);
  assert.ok(m, 'papan KE PERON');
  assert.equal(+m[1] / +m[2], 12 / 2.4, 'rasio kanvas = rasio papan (huruf tidak gepeng)');
  assert.match(m[0], /var rM = 42, xM = w - 28 - rM;/);
  assert.match(m[0], /kotaTeksMuat\(ctx, 'KE PERON  ·  ARAH KOSAN', 800, 48, xM - rM - 20 - 28\)/, 'teks diukur: berhenti >= 20 px di kiri lingkaran M');
  assert.ok(m[0].indexOf('ctx.arc(xM') > m[0].indexOf("fillText('KE PERON"), 'logo digambar sesudah teks, tapi teks sudah dijamin tidak sampai ke sana');
  assert.ok(!/'800 44px ' \+ KOTA_FONT; ctx\.textAlign = 'left'/.test(st), 'ukuran mati 44 px sudah hilang');
  assert.match(BLOK_KOTA, /Math\.max\(18, Math\.min\(54, Math\.floor\(\(lang - 4\) \/ 0\.66\)\)\)/, 'spanduk tegak: ukuran huruf ikut langkah');
  for (const n of [4, 5, 6, 8]) { const lang = (Math.round((n * 0.62 + 0.5) * 40) - 20) / n, f = Math.max(18, Math.min(54, Math.floor((lang - 4) / 0.66))); assert.ok(f * 0.65 <= lang - 3.5, 'huruf ' + f + ' px muat di langkah ' + lang.toFixed(1)); }
  assert.match(fungsi('kotaPoster'), /yJ = h \* 0\.76 - Math\.max\(0, kataJ\.length - 2\) \* 28/, 'poster: judul 3 kata naik, tidak menimpa baris kaki');
  assert.match(fungsi('kotaKios'), /kotaTeksMuat\(ctx, 'Sate kambing  20rb', 700, 15, w - 20/, 'menu kios diukur');
  assert.match(fungsi('kotaLukisMukaJam'), /ctx\.save\(\); ctx\.scale\(w \/ 256, w \/ 256\); w = 256;[^]*ctx\.restore\(\);/, 'muka jam diskala utuh di ukuran atlas apa pun');
  assert.match(BLOK_KOTA, /document\.fonts\.load\('700 18px "Caveat"'\)/, 'font tulisan tangan dimuat sebelum Kota dibangun');
});

test('spanduk tiang: semua teks muat di antara dua garis emas dengan napas', () => {
  const P = F.KOTA_SPANDUK_PX, aman = P.h - 2 * P.garis;
  assert.ok(F.KOTA_SPANDUK_TEKS.length >= 2);
  for (const t of F.KOTA_SPANDUK_TEKS) {
    /* lebar teks pada font maks ~ 0,62 em per huruf kapital tebal (perkiraan kasar di atas; pelukis memakai measureText) */
    const lebarMaks = t.length * 0.66 * P.maks, px = F.kotaSpandukUkuran(lebarMaks), lebar = lebarMaks * px / P.maks;
    assert.ok(px > 8 && px <= P.maks, t);
    assert.ok(lebar + px <= aman + 0.5, t + ': teks + napas setinggi huruf muat (lebar ' + lebar.toFixed(1) + ' + ' + px + ' <= ' + aman + ')');
  }
  assert.match(BLOK_KOTA, /measureText\(/, 'pelukis spanduk mengukur teks');
  assert.match(BLOK_KOTA, /kotaSpandukUkuran\(/);
});

test('anti-kedip: urutan bahan (polygonOffset) + near kamera Kota 0,3 + tanah luar tidak di bawah paving', () => {
  assert.match(BLOK_KOTA, /var KOTA_URUT_BAHAN = \{ lantai: 0, batu: 1, halus: 2, kilap: 3, kaca: 3, nyala: 4, teks: 5 \}/);
  assert.match(fungsi('kotaUrutBahan'), /polygonOffset = true/);
  assert.match(BLOK_KOTA, /var KOTA_LIHAT_DEKAT = 0\.3;/);
  assert.match(fungsi('kotaTick'), /camera\.near = dekat/);
  assert.match(fungsi('exitKota'), /camera\.near = 0\.1/, 'near dikembalikan saat keluar Kota');
  assert.ok(!BLOK_KOTA.includes('B.halus.kotakMM(-1200, 1200, -0.32, -0.05'), 'lempeng tanah raksasa 5 cm di bawah paving (sumber "aspal gelap") dicabut');
  /* memo sisi: S === depan harus benar (dulu selalu salah -> fasad ganda sebidang) */
  assert.match(fungsi('kotaSisiPoli'), /__sisi/, 'kotaSisiPoli memakai memo');
});

/* ===== RONDE 2 (23 Nov): pengunci anti-kedip SEBAHAN =====
   Geometri Kota SUNGGUHAN dibangun di node (three.module.js + kanvas tiruan), lalu diaudit: di dalam satu
   bahan (= satu mesh, polygonOffset tidak bisa menolong) tidak boleh ada dua segitiga BEDA warna yang
   sejajar-searah, berjarak < 5 mm, dan saling tumpang. Batas: huruf 3D timbul tidak ikut (rasterisasi
   butuh kanvas asli) — itu dijaga audit headless (kota-fix-lingkar-alat/r2/aud.js). */
function kotaAuditSebahan(daftar, batas) {
  /* daftar: [{ nama, pos, col, idx, ni }] -> pasangan [{ nama, mm, k, a:[x,y,z], b:[x,y,z] }] */
  const hasil = [];
  const pisah = (P, Q, eps) => {
    for (let i = 0; i < 3; i++) {
      const x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = P[(i * 2 + 2) % 6], y1 = P[(i * 2 + 3) % 6]; let nx = y1 - y0, ny = x0 - x1; const l = Math.hypot(nx, ny); if (l < 1e-9) continue; nx /= l; ny /= l;
      const o = (P[(i * 2 + 4) % 6] - x0) * nx + (P[(i * 2 + 5) % 6] - y0) * ny; if (o > 0) { nx = -nx; ny = -ny; }
      let mn = Infinity; for (let j = 0; j < 3; j++) { const s = (Q[j * 2] - x0) * nx + (Q[j * 2 + 1] - y0) * ny; if (s < mn) mn = s; }
      if (mn > -eps) return true;
    }
    return false;
  };
  for (const G of daftar) {
    const kel = new Map(), p = G.pos, c = G.col, CS = 2;
    for (let i = 0; i < G.ni; i += 3) {
      const i0 = G.idx[i] * 3, i1 = G.idx[i + 1] * 3, i2 = G.idx[i + 2] * 3;
      const ax = p[i0], ay = p[i0 + 1], az = p[i0 + 2], bx = p[i1], by = p[i1 + 1], bz = p[i1 + 2], cx = p[i2], cy = p[i2 + 1], cz = p[i2 + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const L = Math.hypot(nx, ny, nz); if (L < 4e-4) continue; nx /= L; ny /= L; nz /= L;
      const qx = Math.round(nx * 100), qy = Math.round(ny * 100), qz = Math.round(nz * 100), ql = Math.hypot(qx, qy, qz), mx = qx / ql, my = qy / ql, mz = qz / ql;
      if (mx * nx + my * ny + mz * nz < 0.99998) continue; /* hanya bidang berarah "bulat" (dinding, lantai, serong 45) */
      let ux, uz; const uy = 0; if (Math.abs(my) > 0.9) { ux = 1; uz = 0; } else { const l = Math.hypot(mx, mz); ux = mz / l; uz = -mx / l; }
      const vx = my * uz - mz * uy, vy = mz * ux - mx * uz, vz = mx * uy - my * ux;
      const P = [ax * ux + az * uz, ax * vx + ay * vy + az * vz, bx * ux + bz * uz, bx * vx + by * vy + bz * vz, cx * ux + cz * uz, cx * vx + cy * vy + cz * vz];
      const t = { d: ax * mx + ay * my + az * mz, P, c: Math.round(c[i0] * 16) * 289 + Math.round(c[i0 + 1] * 16) * 17 + Math.round(c[i0 + 2] * 16), w: [(ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3],
        bb: [Math.min(P[0], P[2], P[4]), Math.max(P[0], P[2], P[4]), Math.min(P[1], P[3], P[5]), Math.max(P[1], P[3], P[5])] };
      const k = qx + ',' + qy + ',' + qz; if (!kel.has(k)) kel.set(k, []); kel.get(k).push(t);
    }
    for (const [k, Lk] of kel) {
      Lk.sort((x, y) => x.d - y.d); const grid = new Map(), besar = [];
      for (let ti = 0; ti < Lk.length; ti++) {
        const t = Lk[ti], b = t.bb, cx0 = Math.floor(b[0] / CS), cx1 = Math.floor(b[1] / CS), cy0 = Math.floor(b[2] / CS), cy1 = Math.floor(b[3] / CS), big = (cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 100, seen = new Set();
        const uji = (o) => {
          if (seen.has(o)) return; seen.add(o); if (o.c === t.c) return; const b2 = o.bb;
          if (b2[0] > b[1] - 0.03 || b2[1] < b[0] + 0.03 || b2[2] > b[3] - 0.03 || b2[3] < b[2] + 0.03) return;
          if (pisah(t.P, o.P, 0.03) || pisah(o.P, t.P, 0.03)) return;
          hasil.push({ nama: G.nama, mm: +((t.d - o.d) * 1000).toFixed(2), k, a: t.w.map((v) => +v.toFixed(2)), b: o.w.map((v) => +v.toFixed(2)) });
        };
        for (let q = besar.length - 1; q >= 0; q--) { if (t.d - besar[q].d >= batas) break; uji(besar[q]); }
        if (big) { for (let q = ti - 1; q >= 0; q--) { if (t.d - Lk[q].d >= batas) break; uji(Lk[q]); } besar.push(t); }
        else for (let gx = cx0; gx <= cx1; gx++) for (let gy = cy0; gy <= cy1; gy++) {
          const key = gx + '_' + gy, cl = grid.get(key);
          if (cl) for (let q = cl.length - 1; q >= 0; q--) { if (t.d - cl[q].d >= batas) break; uji(cl[q]); }
          if (cl) cl.push(t); else grid.set(key, [t]);
        }
      }
    }
  }
  return hasil;
}
let kotaGeoJanji = null;
function kotaBangunDiNode() { /* -> { luar: ember, ruang: { id: ember } } dibangun oleh kode Kota asli */
  if (kotaGeoJanji) return kotaGeoJanji;
  kotaGeoJanji = (async () => {
    const THREE = await import(require('node:url').pathToFileURL(path.join(__dirname, '..', 'vendor', 'three', 'three.module.js')).href);
    const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : k === 'canvas' ? { width: 2048, height: 2048 }
      : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
      : (typeof k === 'string' ? function () {} : undefined), set: () => true });
    const dokumen = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
    const tiruan = () => { const f = function () { return f; }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === 'length' ? 0 : f), apply: () => f, construct: () => f, set: () => true }); };
    const br = fungsi('kotaBangunRuang'), oa = br.indexOf('var opsi = '), ob = br.indexOf('[id];', oa); assert.ok(oa > 0 && ob > oa, 'opsi kotaBangunRuang');
    const src = antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */') + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */') + fungsi('acak') + BLOK_KOTA
      + '\nreturn { luar: function () { KOTA_ATLAS = { cv: kotaKanvas(2048, 2048), langit: null, tinggi: 0 }; KOTA_ATLAS.ctx = KOTA_ATLAS.cv.getContext("2d"); KB = __T(); var B = kotaEmber(); KOTA_TOKO_LINGKAR.length = 0;'
      + ' kotaBangunTanah(B); kotaBangunSemuaGedung(B); kotaBangunTugu(B); kotaBangunPerabot(B); kotaBangunCakrawala(B); B.naung = KOTA_NAUNG; B.tajuk = KOTA_TAJUK; return B; },'
      + ' ruang: function (id) { var R = KOTA_RUANG[id], B = kotaEmber(); B.dinding = new KotaGeo("dinding"); B.dinding.petak = R.H; B.helai = new KotaGeo("helai");'
      + ' var opsi = (' + br.slice(oa + 11, ob) + ')[id]; kotaKulitRuang(B, id, R, opsi); ({ hotel: kotaIsiHotel, kafe: kotaIsiKafe, butik: kotaIsiButik, arkade: kotaIsiArkade })[id](B, R); return B; } };';
    const stub = []; let luar = null, ruang = null, galat = null;
    for (let it = 0; it < 40 && !ruang; it++) { /* global game di luar blok Kota (mis. BUNYI) diganti tiruan */
      try {
        const api = new Function('THREE', 'document', 'window', 'performance', '__T', stub.map((n) => 'var ' + n + ' = __T();').join('') + src)(THREE, dokumen, {}, { now: () => 0 }, tiruan);
        luar = api.luar(); const r = {}; ['hotel', 'kafe', 'butik', 'arkade'].forEach((id) => { r[id] = api.ruang(id); }); ruang = r;
      } catch (e) { const m = /^(\w+) is not defined/.exec(e.message); if (!m) { galat = e; break; } stub.push(m[1]); }
    }
    if (!ruang) throw galat || new Error('Kota tidak bisa dibangun di node');
    return { luar, ruang, stub };
  })();
  return kotaGeoJanji;
}
const kotaDaftarEmber = (B) => Object.keys(B).filter((k) => B[k] && B[k].ni && !/^(daun|bayang|helai)$/.test(k)).map((k) => ({ nama: k, pos: B[k].pos, col: B[k].col, idx: B[k].idx, ni: B[k].ni }));
const kotaRingkas = (h) => h.length + ' pasangan, mis. ' + JSON.stringify(h.slice(0, 4));

test('anti-kedip ronde 2: geometri Kota luar — 0 pasangan SEBAHAN beda warna yang berimpit (< 5 mm) dan saling tumpang', async () => {
  const K = await kotaBangunDiNode();
  assert.ok(K.stub.length <= 6 && K.stub.every((n) => !/^kota/i.test(n)), 'yang ditiru hanya global game di luar blok Kota: ' + K.stub.join(','));
  let tris = 0; kotaDaftarEmber(K.luar).forEach((g) => { tris += g.ni / 3; });
  assert.ok(tris > 250000 && tris < 445000, 'jumlah segitiga luar wajar: ' + tris);
  const h = kotaAuditSebahan(kotaDaftarEmber(K.luar), 0.005);
  assert.equal(h.length, 0, kotaRingkas(h));
});
test('anti-kedip ronde 2: tanah — jalur kaki fasad (lantai) tidak bertumpuk < 5 mm dengan trotoar / kerb lingkar (batu)', async () => {
  const K = await kotaBangunDiNode();
  const gabung = { nama: 'lantai+batu', pos: [], col: [], idx: [], ni: 0 }; let nv = 0;
  ['lantai', 'batu'].forEach((k) => { /* hanya lapisan tanah tipis: trotoar 6 mm, kerb 7 mm, jalur 8 mm (ambang pintu 10 mm hanya menjorok 2 cm = tidak ikut) */
    const G = K.luar[k];
    for (let i = 0; i < G.ni; i += 3) {
      const v = [G.idx[i], G.idx[i + 1], G.idx[i + 2]];
      if (!v.every((q) => G.pos[q * 3 + 1] > 0.001 && G.pos[q * 3 + 1] < 0.0095)) continue;
      v.forEach((q) => { gabung.pos.push(G.pos[q * 3], G.pos[q * 3 + 1], G.pos[q * 3 + 2]); gabung.col.push(k === 'lantai' ? 0 : 1, 0, 0); gabung.idx.push(nv++); }); gabung.ni += 3;
    }
  });
  assert.ok(gabung.ni / 3 > 200, 'ada trotoar + jalur yang diaudit: ' + gabung.ni / 3);
  const h = kotaAuditSebahan([gabung], 0.005);
  assert.equal(h.length, 0, kotaRingkas(h));
});
test('anti-kedip ronde 2: keempat interior — 0 pasangan SEBAHAN beda warna yang berimpit (< 5 mm) dan saling tumpang', async () => {
  const K = await kotaBangunDiNode();
  for (const id of ['hotel', 'kafe', 'butik', 'arkade']) {
    const d = kotaDaftarEmber(K.ruang[id]); let tris = 0; d.forEach((g) => { tris += g.ni / 3; });
    assert.ok(tris > 5000, id + ' terbangun: ' + tris);
    const h = kotaAuditSebahan(d, 0.005);
    assert.equal(h.length, 0, id + ': ' + kotaRingkas(h));
  }
});
test('anti-kedip ronde 2: pengaudit benar-benar menangkap muka ganda (kontrol positif) + pemotong persegi trotoar', () => {
  const buat = (dz) => ({ nama: 'uji', ni: 6, idx: [0, 1, 2, 3, 4, 5], pos: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0.2, 0.2, dz, 0.9, 0.2, dz, 0.2, 0.9, dz], col: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.equal(kotaAuditSebahan([buat(0)], 0.005).length, 1, 'sebidang beda warna tertangkap');
  assert.equal(kotaAuditSebahan([buat(0.003)], 0.005).length, 1, '3 mm tertangkap');
  assert.equal(kotaAuditSebahan([buat(0.02)], 0.005).length, 0, '2 cm lolos');
  const pk = new Function(fungsi('kotaPotongKotak') + 'return kotaPotongKotak;')();
  const sisa = pk([49.4, 50.6, -48, 48], [[50, 51.4, -48, -12], [50, 51.4, 12, 48]]);
  const luas = sisa.reduce((s, r) => s + (r[1] - r[0]) * (r[3] - r[2]), 0);
  assert.ok(Math.abs(luas - (1.2 * 96 - 0.6 * 72)) < 1e-6, 'luas sisa: ' + luas);
  sisa.forEach((r) => { assert.ok(!(r[1] > 50 + 1e-6 && (r[2] < -12 - 1e-6 || r[3] > 12 + 1e-6)), 'tidak ada sisa di dalam lubang: ' + r); });
  assert.deepEqual(pk([0, 1, 0, 1], []), [[0, 1, 0, 1]]);
});

test('pohon vs kanopi + papan nama: tajuk tidak menembus kanopi mana pun; HOTEL KENCANA terbaca utuh dari plaza; bak depan hotel = taman rendah', async () => {
  const K = await kotaBangunDiNode(), N = K.luar.naung, T = K.luar.tajuk;
  assert.ok(N.filter((n) => n.jenis === 'kanopi').length >= 20 && N.filter((n) => n.jenis === 'papan').length >= 8 && T.length >= 150, 'registri terisi: ' + N.length + ' / ' + T.length);
  /* 1) setiap gugus tajuk (elipsoid r x r*q, + 12% benjolan) berjarak >= 0,15 m dari setiap kotak kanopi / papan */
  const tabrak = [];
  for (const k of N) for (const b of T) {
    const r = b.r * 1.12, ry = r * (b.q || 1), dx = b.x - k.ox, dz = b.z - k.oz, s = dx * k.ux + dz * k.uz, w = dx * k.nx + dz * k.nz;
    const ds = Math.max(k.s0 - s, 0, s - k.s1), dw = Math.max(k.w0 - w, 0, w - k.w1), dy = Math.max(k.y0 - b.y, 0, b.y - k.y1);
    if (Math.sqrt((ds * ds + dw * dw) / ((r + 0.15) * (r + 0.15)) + dy * dy / ((ry + 0.15) * (ry + 0.15))) < 1) tabrak.push(k.gedung + ' ' + k.jenis + ' ' + k.teks + ' vs pohon ' + b.px + ',' + b.pz);
  }
  assert.deepEqual([...new Set(tabrak)], [], 'tajuk menembus / menempel kanopi');
  /* 2) bak depan hotel: rendah, tanpa tajuk; dua bak besar lain tetap berpohon */
  const bak = F.KOTA_POHON.filter((p) => p.r >= 2);
  assert.deepEqual(bak.map((p) => !!p.rendah), [true, false, false]);
  assert.equal(T.filter((b) => b.px === bak[0].x && b.pz === bak[0].z).length, 0, 'bak rendah tanpa tajuk');
  assert.match(fungsi('kotaPohon'), /if \(p\.rendah\) \{ B\.nyala\.cincin\([^]*?return; \}/, 'taman rendah berhenti sebelum batang + tajuk');
  assert.ok(F.KOTA_HALANG_KAMERA[F.KOTA_POHON.indexOf(bak[0])].h <= 2.3, 'penghalang kamera bak rendah = setinggi topiari');
  /* 3) garis pandang ke HOTEL KENCANA: dari SEMUA titik bebas di kerucut depan (<= 35 derajat, 6-30 m), kamera 1,6 m dan 3 m: 0 garis kena tajuk */
  const h = N.find((n) => n.teks === 'HOTEL KENCANA'); assert.ok(h);
  const lebar = 'HOTEL KENCANA'.length * 0.62 * 0.95, sm = (h.s0 + h.s1) / 2, ym = (h.y0 + h.y1) / 2; /* lebar atas (stub kanvas node tidak mengukur font) */
  let titik = 0, kena = 0;
  for (let x = -60; x <= 30; x += 1.5) for (let z = -60; z <= 30; z += 1.5) {
    const px = h.ox + h.ux * sm + h.nx * h.w1, pz = h.oz + h.uz * sm + h.nz * h.w1, d = Math.hypot(x - px, z - pz), dn = (x - px) * h.nx + (z - pz) * h.nz;
    if (d < 6 || d > 30 || dn / d < 0.82 || !F.kotaBebas(x, z, R)) continue;
    titik++;
    for (const e of [1.6, 3.0]) for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) for (const yy of [h.y0 + 0.1, ym, h.y1 - 0.1]) {
      const s = sm + u * lebar, qx = h.ox + h.ux * s + h.nx * h.w1, qz = h.oz + h.uz * s + h.nz * h.w1, vx = qx - x, vy = yy - e, vz = qz - z;
      for (const b of T) { const r = b.r * 1.12, k = 1 / (b.q || 1), ax = x - b.x, ay = (e - b.y) * k, az = z - b.z, by = vy * k, A = vx * vx + by * by + vz * vz, Bq = 2 * (ax * vx + ay * by + az * vz), C = ax * ax + ay * ay + az * az - r * r, Dq = Bq * Bq - 4 * A * C;
        if (Dq > 0) { const t1 = (-Bq - Math.sqrt(Dq)) / (2 * A), t2 = (-Bq + Math.sqrt(Dq)) / (2 * A); if (t2 > 0 && t1 < 1) { kena++; break; } } }
    }
  }
  assert.ok(titik >= 60, 'titik pandang di plaza: ' + titik);
  assert.equal(kena, 0, 'garis pandang ke HOTEL KENCANA yang kena tajuk');
});

/* ---- Kota malam lebih terang (Ryan 23 Nov: "gelap banget di tengah plaza kalo malam, lampunya kureng") ---- */
test('Kota malam terang: langit malam tidak lagi dipotong 60%, genangan lampu lebar + bersambung, 4 tiang sorot plaza, daun diterangi', () => {
  const redup = JSON.parse(HTML.match(/var KOTA_REDUP_MALAM = (\{[^}]+\});/)[1].replace(/(\w+):/g, '"$1":'));
  assert.ok(redup.hemi <= 0.2, 'cahaya langit malam Kota hampir setara halaman kos (dulu dipotong 0,6): ' + redup.hemi);
  assert.ok(redup.isi <= 0.4 && redup.matahari <= 0.5, 'isi + bulan tidak lebih redup dari sebelumnya');
  assert.ok(redup.hemi >= 0 && redup.matahari >= 0.3, 'malam tetap malam: bulan tetap diredupkan (genangan + etalase tetap menonjol)');
  assert.ok(fungsi('kotaLampuSalin').includes('(1 - KOTA_REDUP_MALAM[L.jenis] * m)'), 'peredupan = fungsi KOTA_U.malam (siang m = 0: lampu persis nilai siang)');
  const G = JSON.parse(HTML.match(/var KOTA_GENANG = (\{[^}]+\});/)[1].replace(/(\w+):/g, '"$1":'));
  const plaza = F.KOTA_LAMPU_PLAZA, jalan = F.KOTA_LAMPU.filter((l) => !plaza.some((q) => q.x === l.x && q.z === l.z));
  let celahPlaza = 0; plaza.forEach((p, i) => { const q = plaza[(i + 1) % plaza.length]; celahPlaza = Math.max(celahPlaza, Math.hypot(p.x - q.x, p.z - q.z)); });
  assert.ok(G.plaza[0] * 0.65 * 2 >= celahPlaza, 'genangan lampu taman plaza bertumpang (bagian terang 65% jari-jari): ' + celahPlaza.toFixed(1));
  const bul = jalan.filter((l) => Math.abs(l.z) === 5.7).map((l) => l.x).filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b);
  for (let i = 1; i < bul.length; i++) if (bul[i] - bul[i - 1] < 20) assert.ok(G.jalan[0] * 2 >= bul[i] - bul[i - 1] + 3, 'genangan lampu bulevar bersambung: celah ' + (bul[i] - bul[i - 1]));
  assert.ok(G.jalan[0] >= 5.7 + 3, 'genangan lampu bulevar menjangkau garis tengah jalan (tiang di z 5,7)');
  assert.ok(G.plaza[0] >= 6 && G.jalan[0] >= 9 && G.sorot[0] >= 12, 'jari-jari genangan lebih lebar dari dulu (4,4 / 6,0)');
  /* peta: canvas 'lighter' menjumlah — puncak di tengah plaza tidak boleh jenuh putih (kuat jumlah <= ~1) */
  assert.ok(G.plaza[1] + G.sorot[1] * 0.68 <= 1.05, 'jumlah kuat genangan di bawah lampu taman tidak jenuh');
  assert.ok(/addColorStop\(0\.3,[^;]+;\s*g\.addColorStop\(0\.65,/.test(fungsi('kotaPetaCahaya')), 'pinggir genangan lembut (gradasi 3 tahap)');
  assert.ok(fungsi('kotaPetaCahaya').includes('KOTA_SOROT.forEach'), 'tiang sorot menyumbang genangan lebar di peta cahaya');
  /* tiang sorot: 4, simetris, di ruang bebas antara kolam dan bak, jauh dari rute warga, terdaftar padat + penghalang kamera */
  const S = F.KOTA_SOROT; assert.equal(S.length, 4);
  const segJarak = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); };
  for (const p of S) {
    const r = Math.hypot(p.x, p.z);
    assert.ok(r > 8.65 + 2 && r < 15, 'tiang sorot di luar bibir kolam (+2 m) dan di dalam lingkar lampu taman: ' + r.toFixed(2));
    assert.ok(Math.abs(Math.abs(p.x) - Math.abs(p.z)) < 1e-9, 'di diagonal plaza (bulevar + Jalan Raya tetap bebas)');
    for (const t of F.KOTA_POHON) assert.ok(Math.hypot(p.x - t.x, p.z - t.z) > t.r + 1.5, 'tidak menempel bak pohon');
    for (const l of F.KOTA_LAMPU) assert.ok(Math.hypot(p.x - l.x, p.z - l.z) > 3, 'tidak menempel tiang lampu lain');
    assert.equal(F.kotaBebas(p.x, p.z, 0.2), false, 'tiang sorot padat (tidak bisa ditembus)');
    for (const R2 of F.KOTA_RUTE) for (let i = 0; i < R2.titik.length; i++) {
      const d = segJarak(p.x, p.z, R2.titik[i], R2.titik[(i + 1) % R2.titik.length]);
      assert.ok(d >= 0.3 + 0.4 + 0.25, 'rute warga ' + R2.id + ' tidak menabrak tiang sorot: ' + d.toFixed(2));
    }
    assert.ok(F.KOTA_HALANG_KAMERA.some((h) => h.x === p.x && h.z === p.z && h.h >= 9), 'terdaftar penghalang kamera');
  }
  const sorot = fungsi('kotaLampuSorot');
  assert.ok(/B\.nyala\.kotak\(/.test(sorot) && !/emissive|PointLight|SpotLight/.test(sorot), 'lensa sorot = bahan nyala (MeshBasicMaterial), tanpa lampu dinamis');
  assert.ok(fungsi('kotaPerabotTahap').includes('KOTA_SOROT.forEach(function (p) { kotaLampuSorot(B, p.x, p.z, p.rot); });'));
  /* daun: sisipan khusus benar-benar mengubah shader (string sasaran ada di kotaSuntikMalam) */
  const inti = fungsi('kotaSuntikMalam'), daun = fungsi('kotaSuntikMalamDaun');
  for (const m of daun.matchAll(/\.replace\('([^']+)',/g)) assert.ok(inti.includes(m[1]), 'sasaran sisipan daun ada di kotaSuntikMalam: ' + m[1]);
  assert.ok(/daun: \(function \(\) \{ var m = lambert\([^;]+; m\.onBeforeCompile = kotaSuntikMalamDaun; m\.customProgramCacheKey = kotaKunciSuntik\('malam-daun'\)/.test(HTML), 'bahan daun Kota memakai sisipan daun + kunci program sendiri');
  assert.ok(inti.includes('kotaMalam > 0.002'), 'sisipan malam mati total di siang (kotaMalam 0)');
});

/* ================= Masuk Kota bertahap + layar "Menuju Kota" (23 Nov) ================= */
test('Masuk Kota bertahap: tahap kecil berurutan, hasil = pembangunan serentak, layar Menuju Kota, input dikunci, batal bersih', async () => {
  /* 1) susunan tahap: urutan pekerjaan sama dengan buildKota lama */
  const tahap = fungsi('kotaTahapBangun');
  const urut = ["kotaPra(p[0])", 'kotaTahapCahaya(S)', 'KOTA_TOKO_LINGKAR.length = 0', 'kotaBangunTanah(B)', 'kotaBangunGedungSatu(B, g, pembangun)', 'kotaBangunTugu(B)', 'kotaPerabotTahap(B)', 'kotaBangunCakrawala(B)',
    'kotaMeshDaftar = []', 'kotaPasangEmberSatu(B, kunciEmber[q], S, hasilEmber, kotaMeshDaftar)', "['capit', 'kaleng', 'kilat', 'uap', 'not']", 'kotaBangunLed(S)', 'kotaJamPerbarui(S)', 'kotaNpcBangun(S)',
    'kotaPasangSasaran()', 'kotaPetaCahaya()', 'kotaSuasanaDaftar()', 'KOTA_SIAP = true'];
  let pos = -1;
  for (const u of urut) { const i = tahap.indexOf(u, pos + 1); assert.ok(i > pos, 'urutan tahap: ' + u); pos = i; }
  assert.ok(tahap.includes('KOTA_GEDUNG.forEach(function (g) { t('), 'satu gedung = satu tahap');
  assert.ok(tahap.includes('if (kotaBangunSt) return kotaBangunSt;'), 'daftar tahap dibuat sekali (dilanjutkan, bukan diulang)');
  const serentak = fungsi('buildKota');
  assert.ok(serentak.includes('if (KOTA_SIAP) return;') && serentak.includes('while (T.i < T.L.length)'), 'buildKota = jalankan tahap yang tersisa');
  /* 2) pelari: jatah waktu kecil, napas antar giliran, batal / pindah alam = tutup tanpa masuk */
  const jalan = fungsi('kotaMuatJalan');
  const jatah = +/var KOTA_MUAT_JATAH = (\d+);/.exec(HTML)[1];
  assert.ok(jatah >= 4 && jatah <= 16, 'jatah kerja per giliran <= 16 ms: ' + jatah);
  assert.ok(jalan.includes('if (performance.now() - t0 >= KOTA_MUAT_JATAH) break;') && jalan.includes('setTimeout(kotaMuatJalan, 0)'), 'napas ke browser antar giliran');
  assert.ok(jalan.includes('if (M.batal || myRealm !== M.asal) { kotaMuatTutup(false); return; }'), 'batal / pindah alam: tidak jadi masuk');
  assert.ok(jalan.indexOf('kotaMasukSekarang();') > jalan.indexOf('kotaPanasBeres = true;'), 'masuk Kota hanya sesudah bangun + pemanasan beres');
  assert.ok(!/toastKosan|exitLiving|exitDapur|exitRoom|myRealm =/.test(fungsi('kotaMuatMulai')), 'selama layar muat keadaan pemain tidak diubah');
  /* 3) kait di animate: input dikunci, alam asal tidak digambar di balik layar muat */
  const animate = fungsi('animate');
  assert.ok(animate.includes('if (kotaMuat) mag = 0;'), 'gerak dikunci selama layar Menuju Kota');
  assert.ok(animate.includes('else if (kotaMuat && !kotaMuat.masuk) {'), 'bingkai alam asal dilewati selama membangun');
  assert.ok(fungsi('enterKota').startsWith('function enterKota() {\n  if (kotaRealmIni(myRealm) || kotaMuat) return;'), 'ketuk KOTA berulang selama memuat diabaikan');
  /* 4) layar: ada, tanpa teks teknis, animasi = transform / opacity saja (kompositor) */
  const a = HTML.indexOf('<div id="kotaMuat"'), b = HTML.indexOf('<!-- Layar masuk (Ronde 10b)', a); assert.ok(a > 0 && b > a, 'elemen layar');
  const layar = HTML.slice(a, b), teksLayar = layar.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  for (const id of ['kotaMuatIsi', 'kotaMuatBar', 'kotaMuatTeks', 'kotaMuatBatal']) assert.ok(layar.includes('id="' + id + '"'), id);
  assert.ok(/Menuju Kota/.test(teksLayar));
  for (const k of ['load-awan load-awan-1', 'load-tanah', 'load-gedung', 'class="load-bar"', 'km-kereta', 'km-roda']) assert.ok(layar.includes(k), 'sekeluarga dengan layar muat awal + ada kereta: ' + k); /* v2 24 Nov */
  const semuaTeks = teksLayar + ' ' + /var KOTA_MUAT_TEKS = \[([^\]]*)\]/.exec(HTML)[1];
  assert.ok(!/\d\s*%|shader|tekstur|texture|mesh|geometri|aset|asset|loading|memuat|tahap|render|kompil|ms\b/i.test(semuaTeks), 'tanpa teks teknis: ' + semuaTeks.replace(/\s+/g, ' ').trim());
  const css = antara('/* Layar "Menuju Kota" (23 Nov)', '</style>');
  const kf = css.match(/@keyframes km\w+ \{[^@]*\}\s*\}/g) || [];
  assert.ok(kf.length >= 5, 'animasi layar: ' + kf.length);
  for (const k of kf) assert.ok(!/(^|[\s{;])(left|top|width|height|margin|background)[^:]*:/.test(k.replace(/@keyframes km\w+ \{/, '')), 'animasi hanya transform / opacity: ' + k.slice(0, 40));
  assert.ok(/#kotaMuat \{[^}]*z-index: 60/.test(css), 'di atas HUD + kartu (z 40/45), di bawah layar muat awal (100)');
  /* 5) huruf 3D: kanvas baca-balik CPU (akar macet terpanjang) */
  assert.ok(fungsi('kotaHurufBalok').includes("getContext('2d', { willReadFrequently: true })"));
  /* 6) hasil bertahap = hasil serentak (isi ember bita demi bita), dijalankan oleh kode Kota asli */
  const THREE = await import(require('node:url').pathToFileURL(path.join(__dirname, '..', 'vendor', 'three', 'three.module.js')).href);
  const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : k === 'canvas' ? { width: 2048, height: 2048 }
    : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    : (typeof k === 'string' ? function () {} : undefined), set: () => true });
  const dokumen = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
  const tiruan = () => { const f = function () { return f; }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === 'length' ? 0 : f), apply: () => f, construct: () => f, set: () => true }); };
  const awal = 'KOTA_ATLAS = { cv: kotaKanvas(2048, 2048), langit: null, tinggi: 0 }; KOTA_ATLAS.ctx = KOTA_ATLAS.cv.getContext("2d"); KB = __T(); KOTA_NAUNG.length = 0; KOTA_TAJUK.length = 0; KOTA_TOKO_LINGKAR.length = 0; var B = kotaEmber();';
  const src = antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */') + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */') + fungsi('acak') + BLOK_KOTA
    + '\nreturn { serentak: function () { ' + awal + ' kotaBangunTanah(B); kotaBangunSemuaGedung(B); kotaBangunTugu(B); kotaBangunPerabot(B); kotaBangunCakrawala(B); return B; },'
    + ' bertahap: function () { ' + awal + ' var n = 0; kotaBangunTanah(B); n++; var pb = kotaPembangunGedung(); KOTA_GEDUNG.forEach(function (g) { kotaBangunGedungSatu(B, g, pb); n++; }); kotaBangunTugu(B); n++;'
    + ' kotaPerabotTahap(B).forEach(function (f) { f(); n++; }); kotaBangunCakrawala(B); n++; B.__n = n; return B; }, nGedung: KOTA_GEDUNG.length, nPohon: KOTA_POHON.length, nPot: KOTA_POT.length };';
  const stub = []; let M = null, galat = null;
  for (let it = 0; it < 40 && !M; it++) {
    try { M = new Function('THREE', 'document', 'window', '__T', ...stub, src)(THREE, dokumen, { console }, tiruan, ...stub.map(tiruan)); M.serentak(); }
    catch (e) { M = null; galat = e; const m = /^(\w+) is not defined/.exec(e.message); if (!m || stub.includes(m[1])) break; stub.push(m[1]); }
  }
  assert.ok(M, 'kode Kota jalan di Node: ' + (galat && galat.message));
  const A = M.serentak(), Bt = M.bertahap();
  assert.ok(Bt.__n >= M.nGedung + M.nPohon + 6, 'jumlah tahap geometri: ' + Bt.__n);
  let verteks = 0;
  for (const k of Object.keys(A)) {
    const x = A[k], y = Bt[k];
    assert.equal(y.nv, x.nv, 'verteks ' + k); assert.equal(y.ni, x.ni, 'indeks ' + k); verteks += x.nv;
    for (const f of ['pos', 'nor', 'col', 'uv', 'idx']) {
      if (!x[f]) continue;
      const n = f === 'idx' ? x.ni : x.nv * (f === 'uv' ? 2 : 3);
      assert.ok(Buffer.from(x[f].buffer, x[f].byteOffset, n * x[f].BYTES_PER_ELEMENT).equals(Buffer.from(y[f].buffer, y[f].byteOffset, n * y[f].BYTES_PER_ELEMENT)), 'isi ember ' + k + '.' + f + ' identik');
    }
  }
  assert.ok(verteks > 500000, 'Kota terbangun penuh: ' + verteks + ' verteks');
});
