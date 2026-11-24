'use strict';
/* Tes Toko Perabot (Ryan 24 Nov): 6 dekor kamar baru di katalog server + klien, beli lewat
   /api/belanja (database palsu) dari kamar 1 DAN kamar 59 (Gedung F), fasad + alam 'toko' +
   kabel ke runtime dicek lewat teks. Tanpa jaringan. Jalankan: node --test tests/toko-perabot.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../api/_lib/kerja');
const { buatApp } = require('../api/_lib/app');
const { buatFakeDb } = require('./fake-db');
const { normalize } = require('../api/_lib/inti');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const blok = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const DEKOR = { poster: 12000, tanaman: 20000, karpet: 35000, lampu_tumblr: 25000,
  cermin: 30000, akuarium: 45000, bean_bag: 50000, rak_buku: 60000, meja_belajar: 80000, meja_rias: 100000 };
const NAMA = { cermin: 'Cermin berdiri', akuarium: 'Akuarium kecil', bean_bag: 'Bean bag', rak_buku: 'Rak buku', meja_belajar: 'Meja belajar', meja_rias: 'Meja rias' };
const BARU = Object.keys(NAMA);
const TOKO = antara('/* ================= TOKO PERABOT (24 Nov)', '/* ==== KERJA-START ==== */');
const DEKOR_BLOK = antara('/* ================= Toko Perabot (24 Nov) — dekor kamar', '/* ================= TOKO PERABOT (24 Nov)');

const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [{ room: 1, name: 'sari', gender: 'Cewek', pin: '246810' }, { room: 59, name: 'bagas', gender: 'Cowok', pin: '135790' }];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
function siapkan() {
  const jam = Date.parse('2026-11-24T03:00:00Z');
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  return { db, app: buatApp({ db, rahasia: RAHASIA, sekarang: () => jam }) };
}
async function login(app, username, pin) {
  const r = await app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
const isiSaldo = (S, room, nama, jumlah) => S.db._t.dompet.set(room + '|' + normalize(nama), jumlah);

test('katalog: 10 dekor (4 lama tidak berubah + 6 baru), harga + nama + urutan sama di server dan klien', () => {
  const dekorServer = Object.keys(K.KATALOG).filter((k) => K.KATALOG[k].jenis === 'dekor');
  assert.deepEqual(dekorServer, Object.keys(DEKOR));
  for (const [id, harga] of Object.entries(DEKOR)) assert.equal(K.KATALOG[id].harga, harga, id);
  for (const id of BARU) {
    assert.equal(K.KATALOG[id].nama, NAMA[id]);
    assert.match(id, /^[a-z0-9_]{2,30}$/, 'cocok CHECK kosan_barang');
    assert.ok(('Beli ' + K.KATALOG[id].nama).length <= 80, 'keterangan mutasi muat');
    assert.ok(HTML.includes("  " + id + ": { nama: '" + NAMA[id] + "', harga: " + DEKOR[id] + ", jenis: 'dekor' }"), 'klien ' + id);
    assert.ok(K.barangDari(id), id);
  }
  assert.match(HTML, /var DEKOR_IDS = \['poster', 'tanaman', 'karpet', 'lampu_tumblr', 'cermin', 'akuarium', 'bean_bag', 'rak_buku', 'meja_belajar', 'meja_rias'\];/);
  for (const ikon of ['cermin', 'akuarium', 'beanbag', 'rakbuku', 'mejabelajar', 'mejarias']) assert.ok(HTML.includes('  ' + ikon + ": '<"), 'ikon ' + ikon);
  for (const id of BARU) { assert.match(HTML, new RegExp(id + ": '[a-z]+'"), 'BARANG_IKON ' + id); assert.match(DEKOR_BLOK, new RegExp('\\n  ' + id + ': function \\(R'), 'pembangun ' + id); assert.match(DEKOR_BLOK, new RegExp('\\n  ' + id + ": '"), 'keterangan ' + id); }
});

test('beli dekor baru lewat /api/belanja: kamar 1 dan kamar 59 (Gedung F), harga dari server, saldo kurang + sudah punya ditolak', async () => {
  for (const p of PENGHUNI) {
    const S = siapkan();
    const tok = await login(S.app, p.name, p.pin);
    assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'cermin' }, tok))).body.galat, 'saldo_kurang', 'kamar ' + p.room + ': dompet kosong');
    const total = BARU.reduce((n, id) => n + DEKOR[id], 0);
    isiSaldo(S, p.room, p.name, total - 1); /* kurang Rp1 untuk barang terakhir */
    let sisa = total - 1;
    for (const id of BARU.slice(0, 5)) {
      const r = await S.app.belanja(post({ aksi: 'beli', barang: id, harga: 1 }, tok)); /* harga dari klien diabaikan */
      assert.equal(r.status, 200, 'kamar ' + p.room + ' ' + id + ' ' + JSON.stringify(r.body));
      sisa -= DEKOR[id]; assert.equal(r.body.saldo, sisa, id);
      assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: id }, tok))).body.galat, 'sudah_punya', id);
    }
    const kurang = await S.app.belanja(post({ aksi: 'beli', barang: 'meja_rias' }, tok));
    assert.equal(kurang.body.galat, 'saldo_kurang'); assert.notEqual(kurang.status, 200);
    isiSaldo(S, p.room, p.name, sisa + 1);
    assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'meja_rias' }, tok))).body.saldo, 0);
    const d = await S.app.dompet(get(tok));
    assert.deepEqual(d.body.barang.slice().sort(), BARU.slice().sort(), 'kamar ' + p.room);
    assert.equal(d.body.saldo, 0);
    const m = S.db._t.mutasi.filter((x) => x.room === p.room);
    assert.equal(m.length, 6); assert.ok(m.every((x) => x.jenis === 'beli' && x.saldo_sesudah >= 0));
    assert.ok(m.some((x) => x.keterangan === 'Beli Meja belajar' && x.jumlah === -80000));
  }
});

test('tanpa login tidak bisa beli; barang di luar katalog ditolak', async () => {
  const S = siapkan();
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'meja_rias' }))).status, 401);
  const tok = await login(S.app, 'sari', '246810');
  isiSaldo(S, 1, 'sari', 500000);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'sofa' }, tok))).status, 400);
});

test('fasad: rumah hijau diganti Toko Perabot, papan + kotak ketuk + latar halaman terkunci', () => {
  const jalan = blok('buildJalan');
  assert.match(jalan, /if \(rm\[2\] === 0xc9e7d3\) return;/);
  assert.match(jalan, /if \(rm\[2\] === 0xf3e3b5\) return;/, 'Kedai Kopi tetap');
  assert.match(jalan, /var tokoLatar = bangunToko\(S, K, KD, \{/);
  assert.match(jalan, /\[TOKO_KOTAK, 'toko', 3\.0\]/);
  assert.match(jalan, /\.concat\(kafeLatar\)\.concat\(tokoLatar\)\)/);
  assert.match(TOKO, /var TOKO_KOTAK = \{ minX: -15\.5, maxX: -8\.5, minZ: 6\.85, maxZ: 9\.3 \};/);
  assert.match(TOKO, /var TOKO_NAMA = 'TOKO PERABOT';/);
  const b = blok('bangunToko');
  assert.match(b, /jalanPapan\(TOKO_NAMA, 'dekor kamar · bisa dimasukin', '#f7f5ef', 2\.9, '#141414'\)/); /* jalanPapan menyusutkan font dengan measureText */
  assert.match(b, /papan\.position\.set\(cx, 3\.34, 8\.95\); papan\.rotation\.y = Math\.PI;/);
  assert.match(blok('jalanPapan'), /measureText\(teks\)\.width > w - 44/);
  assert.match(b, /new THREE\.MeshBasicMaterial\(\{ map: texKaca, vertexColors: true \}\)/, 'kaca = satu mesh Basic');
  assert.doesNotMatch(b, /transparent: true|emissive|opacity:|new THREE\.\w*Light\(/);
  /* kavling: tidak menabrak warung (dinding barat x -7,75) maupun rumah pink (x <= -16,5) */
  assert.match(b, /kt\(K, teras, 0xd9d2c4, 7\.4, 0\.12, 2\.4, cx, 0\.06, 8\.0, 0, 0\.6\);/);
});

test("alam 'toko': dikenal multiplayer, scene + batas + ketuk + keluar terpasang, tamu boleh masuk, pindah alam lain keluar toko dulu", () => {
  assert.match(blok('mpRealmDikenal'), /if \(realm === 'toko'\) return realm;/);
  assert.match(blok('sceneUntukRealm'), /if \(realm === 'toko'\) return tokoScene;/);
  assert.match(blok('petaLabelLokasi'), /if \(realm === 'toko'\) return 'Toko Perabot';/);
  const ani = blok('animate');
  assert.match(ani, /var bounds = myRealm === 'toko' \? TOKO : /);
  assert.match(ani, /\} else if \(myRealm === 'toko'\) \{\n      var ctk = tokoPadat\(nx, nz\);/);
  assert.match(ani, /renderer\.render\(myRealm === 'toko' \? tokoScene : /);
  assert.match(ani, /dekorPadatKamar\(nx, nz\)/);
  assert.match(ani, /dekorTick\(dt, performance\.now\(\) \/ 1000\)/);
  const tap = blok('canvasTap');
  assert.match(tap, /var targets = myRealm === 'toko' \? tokoClickables : /);
  assert.match(tap, /if \(ud\.interact === 'toko'\) \{ showTokoCard\(\); return; \}/);
  assert.match(tap, /if \(ud\.interact === 'tokoBarang'\) \{ showBarangTokoCard\(ud\.barang\); return; \}/);
  assert.match(tap, /if \(ud\.interact === 'beanBag'\) \{ showBeanBagCard\(\); return; \}/);
  assert.match(tap, /ud\.card === 'exit-toko'\) \{\n    exitToko\(\);/);
  assert.match(HTML, /getElementById\('exitBtn'\)\.addEventListener\('click', function \(\) \{[^\n]*myRealm === 'toko'\) exitToko\(\)/);
  const masuk = blok('enterToko');
  assert.doesNotMatch(masuk, /ktaIsResident\(\)\) \{ toastKosan\([^)]*\); return; \}/, 'tamu boleh masuk + lihat');
  assert.match(masuk, /if \(myRealm !== 'jalan'\) return;/);
  assert.match(masuk, /mpSaatPindahAlam\(\);/);
  assert.match(blok('exitToko'), /myRealm = 'jalan';[\s\S]*jalanScene\.add\(avatar\);[\s\S]*mpSaatPindahAlam\(\);/);
  for (const f of ['enterLiving', 'enterDapur', 'enterRoom']) {
    const s = blok(f), t = s.indexOf("if (myRealm === 'toko') exitToko();"), j = s.indexOf("if (myRealm === 'jalan') exitJalan();");
    assert.ok(t > 0 && j > t && s.indexOf('savedYard = {') > j, f);
  }
  for (const f of ['flyToDoor', 'kotaMasukSekarang', 'enterJalan']) assert.match(blok(f), /myRealm === 'toko'\) \{? ?exitToko\(\)/, f);
});

test('interior: 10 barang dipajang (id = DEKOR_IDS), label harga dari katalog, beli lewat alur lama, tamu tanpa tombol beli', () => {
  const pajang = [...TOKO.matchAll(/\{ id: '([a-z_]+)', di: \[/g)].map((m) => m[1]);
  assert.deepEqual(pajang.slice().sort(), Object.keys(DEKOR).sort());
  assert.match(blok('lukisLabelToko'), /KATALOG\[p\.id\][\s\S]*rupiah\(it\.harga\)/);
  assert.match(blok('lukisLabelToko'), /tokoTeksMuat\(ctx, it\.nama, cw - 30/);
  assert.match(blok('tokoTeksMuat'), /measureText\(teks\)\.width > lebarMaks/);
  const kartu = blok('showBarangTokoCard');
  assert.match(kartu, /Sudah punya/);
  assert.match(kartu, /if \(res && d && !punya && dekat\) \{/);
  assert.match(kartu, /Toko khusus penghuni \(bayar pakai Rupiah dari kerja\)/);
  assert.match(blok('tokoBeliDiToko'), /var janji = tokoBeli\(id\);/);
  assert.equal((TOKO + DEKOR_BLOK).split('apiKosan(').length, 1, 'tanpa panggilan API baru: beli lewat tokoBeli');
  assert.equal(HTML.split('fetch(').length - 1, 4);
  /* menu belanja lama tetap memuat semua dekor */
  assert.match(blok('dompetHtmlToko'), /DEKOR_IDS\.forEach\(function \(id\) \{/);
});

test('dekor kamar: 6 titik pasang di dalam dinding kamar, tampil hanya bila dimiliki, akuarium kaca satu lapis, menyala = Basic', () => {
  const m = DEKOR_BLOK.match(/var DEKOR_TITIK = \{([\s\S]*?)\};/);
  assert.ok(m);
  const titik = {};
  for (const t of m[1].matchAll(/([a-z_]+): \[(-?[\d.]+), (-?[\d.]+), /g)) titik[t[1]] = [Number(t[2]), Number(t[3])];
  assert.deepEqual(Object.keys(titik).sort(), BARU.slice().sort());
  for (const [id, p] of Object.entries(titik)) assert.ok(Math.abs(p[0]) <= 4 && Math.abs(p[1]) <= 3.5, id + ' di dalam kamar');
  assert.deepEqual(titik.bean_bag, [-2.35, 1.15]);
  const terap = blok('dekorTerapkan');
  assert.match(terap, /DEKOR_IDS\.forEach\(function \(id\) \{ dekorObjek\(id\)\.visible = punya\(id\); \}\);/);
  assert.match(terap, /ktaIsResident\(\)/);
  assert.equal(DEKOR_BLOK.split('transparent: true').length - 1, 1, 'hanya kaca akuarium yang transparan');
  assert.match(DEKOR_BLOK, /geoKotakSisi\(0\.7, 0\.36, 0\.3, \['px', 'nx', 'pz'\]\), A\.kaca\)/, 'kaca: 3 muka luar, satu lapis');
  assert.doesNotMatch(DEKOR_BLOK, /emissive|new THREE\.\w*Light\(/);
  assert.match(DEKOR_BLOK, /nyala: new THREE\.MeshBasicMaterial\(/);
  assert.match(blok('dekorPadatKamar'), /if \(DEKOR\[id\]\.visible\)/);
});

test('bean bag: duduk DI ATAS (pinggul di cekungan, kaki di atas kain), pemain lain sama; plafon toko timbul tanpa mengubah kamar', () => {
  const a = DEKOR_BLOK.indexOf('/*BEAN-A*/'), b = DEKOR_BLOK.indexOf('/*BEAN-B*/');
  assert.ok(a >= 0 && b > a);
  const { BEAN, dekorBeanTinggi } = new Function(DEKOR_BLOK.slice(a, b) + '; return { BEAN, dekorBeanTinggi };')();
  const K = 0.792, sudut = Math.acos(BEAN.s / K), maju = K * Math.sin(sudut);
  /* dudukan tepat di bawah paha (sendi pinggul - jari-jari paha), bukan lantai */
  const dudukan = dekorBeanTinggi(0, BEAN.zh);
  assert.ok(dudukan >= 0.17 && dudukan <= BEAN.s - 0.11, 'dudukan ' + dudukan); /* ronde 3: lekuk pinggul 5 cm (panggul celana tidak masuk kain) */
  /* paha + betis (jari-jari 0,10 m, sisi bawah = sumbu - 0,112) selalu di atas kain */
  for (let d = 0.14; d <= 0.36; d += 0.02) for (const x of [-0.24, -0.132, 0, 0.132, 0.24]) {
    assert.ok(BEAN.s * (1 - d / maju) - 0.112 - dekorBeanTinggi(x, BEAN.zh + d) >= 0.005, 'kaki menembus kain di d ' + d.toFixed(2) + ' x ' + x);
  }
  /* sandaran lebih tinggi dari dudukan tapi di belakang punggung (badan r 0,31 dari pinggul) */
  assert.ok(dekorBeanTinggi(0, -0.4) >= 0.6);
  assert.ok(dekorBeanTinggi(0, BEAN.zh - 0.31) <= 0.5);
  /* ronde 3: tidak ada lengan empuk di samping pinggul — tangan avatar (x 0,46; y 0,23) menggantung DI ATAS tepi dudukan */
  assert.ok(dekorBeanTinggi(0.457, BEAN.zh) <= 0.24 && dekorBeanTinggi(0.457, BEAN.zh - 0.06) <= 0.24, 'tepi dudukan tidak naik di samping pinggul (tinggi kain sebenarnya diuji di tes rok)');
  assert.match(DEKOR_BLOK, /var BEANBAG_DUDUK = \{ x: -2\.35, z: 1\.15 \+ BEAN\.zh, y: BEAN\.s - 0\.792, leg: -Math\.acos\(BEAN\.s \/ 0\.792\), bangun: \{ x: -1\.35, z: 1\.15, rotY: 0 \} \};/);
  assert.match(blok('dudukBeanBag'), /y: BEANBAG_DUDUK\.y, rotX: 0, rotY: 0, leg: BEANBAG_DUDUK\.leg, pose: 'lesehan'/);
  const jauh = blok('mpTerapkanPoseRemote');
  assert.match(jauh, /g\.position\.y = diBean \? BEANBAG_DUDUK\.y : DUDUK_POSE\.lesehan\.y;/);
  assert.match(jauh, /p\.legL\.rotation\.x = p\.legR\.rotation\.x = diBean \? BEANBAG_DUDUK\.leg : DUDUK_POSE\.lesehan\.leg;/);
  /* titik bangun di luar kotak padat bean bag */
  const pd = DEKOR_BLOK.match(/bean_bag: \{ minX: (-?[\d.]+), maxX: (-?[\d.]+), minZ: (-?[\d.]+), maxZ: (-?[\d.]+) \}/).slice(1).map(Number);
  assert.ok(-1.35 > pd[1] + 0.3);
  assert.ok(pd[0] <= -2.35 - 0.58 + 1e-9 && pd[1] >= -2.35 + 0.58 - 1e-9 && pd[2] <= 1.15 - 0.62 + 1e-9 && pd[3] >= 1.15 + 0.44 - 1e-9);
  /* plafon: parameter opsional; cabang lama (2 mm / 3 mm) utuh untuk kamar, hanya toko yang memakai timbul */
  assert.match(HTML, /RuangModern\.prototype\.plafon = function \(mat, nyala, b, t, lampu, opsi\) \{/);
  assert.match(HTML, /var S = self\.sisi\(q\[0\]\), p = S\.titik\(0, b \+ 0\.002\);/);
  assert.match(HTML, /new THREE\.CircleGeometry\(0\.065, 18\), p\[0\], H - 0\.003, p\[1\]/);
  assert.equal(HTML.split('{ timbul: 0.02 }').length - 1, 1);
});

/* Ronde 3 (24 Nov): rok tidak menembus bean bag. Avatar ASLI (makeKosanAvatar dari index.html, kanvas dipalsukan) dipasang
   di pose bean bag, tiap segitiga tiap bagian dicuplik +-1,2 cm, lalu dihitung titik yang berada DI DALAM kain bean bag
   (kain dibangun persis pembangun DEKOR_BUAT.bean_bag). Tanpa browser. */
test('bean bag: rok (dan seluruh avatar) tidak menembus kain saat duduk; rok kaku hanya diganti di bean bag', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const baris = HTML.split('\n');
  const fungsi = (n) => { const a = baris.findIndex((l) => l.startsWith('function ' + n + '(')); assert.ok(a >= 0, n); let b = a; while (!baris[b].startsWith('}')) b++; return baris.slice(a, b + 1).join('\n'); };
  const peubah = (n) => { const a = baris.findIndex((l) => l.startsWith('var ' + n + ' =')); assert.ok(a >= 0, n); let b = a; while (!/;\s*(\/\*.*\*\/\s*)?$/.test(baris[b])) b++; return baris.slice(a, b + 1).join('\n'); };
  const palsu = () => { const f = function () { return palsu(); }; return new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'width' || k === 'height' ? 64 : k === 'data' ? new Uint8ClampedArray(64 * 64 * 4) : (k in t ? t[k] : (t[k] = palsu()))), set: (t, k, v) => { t[k] = v; return true; } }); };
  const a0 = baris.findIndex((l) => l.startsWith('var KR_SKIN'));
  const kode = [peubah('RUPA_BAJU'), peubah('RUPA_RAMBUT'), fungsi('mpRupaDikenal'), fungsi('rupaEfektif'),
    peubah('GAYA_RAMBUT'), peubah('GAYA_ATASAN'), peubah('GAYA_BAWAHAN'), peubah('GAYA_ALAS'), peubah('GAYA_KUNCI'),
    fungsi('mpBacaGaya'), fungsi('gayaEfektif'), fungsi('geoEmpukBaru'), fungsi('acak'),
    baris.slice(a0, baris.findIndex((l) => l.startsWith('function makeKosanAvatar('))).join('\n'), fungsi('makeKosanAvatar'),
    antara('/*BEAN-A*/', '/*BEAN-B*/'), antara('/*ROKBEAN-A*/', '/*ROKBEAN-B*/'), peubah('BEANBAG_DUDUK')].join('\n');
  const M = new Function('THREE', 'document', 'window', 'devicePixelRatio', 'renderer', 'teksturLukis', 'teksturKanvas', 'lukisUlangSetelahFont',
    kode + '\nreturn { makeKosanAvatar, BEAN, dekorBeanBentuk, dekorBeanProfil, BEANBAG_DUDUK, avatarRokBean, ROK_BEAN };')(
    THREE, { createElement: () => palsu() }, {}, 1, palsu(), () => new THREE.Texture(), () => new THREE.Texture(), () => {});
  /* kain bean bag */
  const gb = new THREE.LatheGeometry(M.dekorBeanProfil(), 32); gb.rotateY(Math.PI);
  const PB = gb.attributes.position, IB = gb.index.array, kisi = new Map(), SEL = 0.06;
  for (let i = 0; i < PB.count; i++) { const q = M.dekorBeanBentuk(PB.getX(i), PB.getY(i), PB.getZ(i)); PB.setXYZ(i, q[0], q[1], q[2]); }
  for (let t = 0; t < IB.length; t += 3) {
    const tr = [0, 1, 2].map((k) => [PB.getX(IB[t + k]), PB.getY(IB[t + k]), PB.getZ(IB[t + k])]);
    const xs = tr.map((v) => v[0]), zs = tr.map((v) => v[2]);
    for (let i = Math.floor(Math.min(...xs) / SEL); i <= Math.floor(Math.max(...xs) / SEL); i++) for (let j = Math.floor(Math.min(...zs) / SEL); j <= Math.floor(Math.max(...zs) / SEL); j++) {
      const k = i + ',' + j; if (!kisi.has(k)) kisi.set(k, []); kisi.get(k).push(tr);
    }
  }
  const dalamKain = (x, y, z) => { /* kedalaman (m) titik di dalam kain; 0 = di luar */
    const L = kisi.get(Math.floor(x / SEL) + ',' + Math.floor(z / SEL)); if (!L) return 0;
    let at = -9, bw = 9, n = 0;
    for (const [a, b, c] of L) {
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      const y1 = u * a[1] + v * b[1] + w * c[1]; n++; if (y1 > at) at = y1; if (y1 < bw) bw = y1;
    }
    return n < 2 || y >= at || y <= bw ? 0 : Math.min(at - y, y - bw);
  };
  const ukur = (parts, hanya) => { /* { titik, tembus, maks, terendah } semua mesh terlihat (atau satu mesh) */
    const out = { titik: 0, tembus: 0, maks: 0, terendah: 9 }, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], q = new THREE.Vector3();
    parts.g.updateMatrixWorld(true);
    parts.g.traverse((m) => {
      if (!m.isMesh || !m.visible || (hanya && m !== hanya)) return;
      const P = m.geometry.attributes.position, I = m.geometry.index ? m.geometry.index.array : null, n = I ? I.length : P.count;
      for (let t = 0; t < n; t += 3) {
        for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, I ? I[t + k] : t + k).applyMatrix4(m.matrixWorld);
        const luas = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).length() / 2;
        const N = Math.max(1, Math.min(14, Math.ceil(Math.sqrt(luas) / 0.012)));
        for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
          q.set(0, 0, 0).addScaledVector(v[0], i / N).addScaledVector(v[1], j / N).addScaledVector(v[2], 1 - i / N - j / N);
          out.titik++; if (q.y < out.terendah) out.terendah = q.y;
          const d = dalamKain(q.x, q.y, q.z); if (d > 0.002) { out.tembus++; if (d > out.maks) out.maks = d; }
        }
      }
    });
    return out;
  };
  const duduk = (gender, gaya) => { const p = M.makeKosanAvatar(gender, Object.assign({}, gaya)); p.g.position.set(0, M.BEANBAG_DUDUK.y, M.BEAN.zh); p.legL.rotation.x = p.legR.rotation.x = M.BEANBAG_DUDUK.leg; return p; };
  /* 1) alat ukurnya sendiri: rok kaku lama (tanpa bentuk duduk) MEMANG menembus kain dan jatuh di bawah lantai */
  for (const [gaya, jenis] of [[{}, 0], [{ bawahan: 3 }, 3]]) {
    const p = duduk('cewek', gaya);
    assert.ok(p.rok && p.rok.isMesh && p.rokJenis === jenis, 'parts.rok dicatat');
    const kaku = ukur(p, p.rok);
    assert.ok(kaku.tembus > 500 && kaku.maks > 0.15 && kaku.terendah < 0, 'rok kaku seharusnya menembus: ' + JSON.stringify(kaku));
    /* 2) bentuk duduk: 0 titik di dalam kain, di atas lantai, rok kaku disembunyikan */
    M.avatarRokBean(p, true);
    assert.equal(p.rok.visible, false); assert.equal(p.rokBean.visible, true); assert.equal(p.rokBean.material, p.rok.material);
    const rebah = ukur(p, p.rokBean);
    assert.ok(rebah.titik > 3000, 'cuplikan rok duduk ' + rebah.titik);
    assert.equal(rebah.tembus, 0, 'rok duduk menembus kain: ' + JSON.stringify(rebah));
    assert.ok(rebah.terendah > 0.05, 'rok duduk di atas lantai: ' + rebah.terendah);
    /* keliman tidak lewat tepi bean bag / keliman rok asli, dan kaki tidak mencuat menembus kain rok */
    const R = p.rokBean.geometry.attributes.position; let rMaks = 0;
    for (let i = 0; i < R.count; i++) rMaks = Math.max(rMaks, Math.hypot(R.getX(i), R.getZ(i)) * 1.1);
    assert.ok(rMaks <= M.ROK_BEAN.jenis[jenis].rb * 1.1 + 1e-6, 'keliman ' + rMaks);
    assert.ok(p.rokBean.geometry.index.count / 3 <= 1100, 'beban rok duduk');
    /* 3) seluruh avatar (badan, lengan, tangan, kaki, sepatu, rambut, ban pinggang) 0 titik di dalam kain */
    const semua = ukur(p);
    assert.equal(semua.tembus, 0, 'avatar menembus kain: ' + JSON.stringify(semua));
    /* 4) bangun: rok kaku kembali, bentuk duduk sembunyi */
    M.avatarRokBean(p, false);
    assert.equal(p.rok.visible, true); assert.equal(p.rokBean.visible, false);
  }
  /* 5) celana (cowok + cewek): tanpa parts.rok, avatarRokBean tidak berbuat apa-apa, dan 0 titik di dalam kain */
  for (const [gender, gaya] of [['cowok', {}], ['cowok', { bawahan: 2 }], ['cowok', { bawahan: 4 }], ['cewek', { bawahan: 1 }]]) {
    const p = duduk(gender, gaya);
    assert.equal(p.rok, undefined);
    M.avatarRokBean(p, true); assert.equal(p.rokBean, undefined);
    const semua = ukur(p);
    assert.equal(semua.tembus, 0, gender + ' ' + JSON.stringify(gaya) + ' menembus kain: ' + JSON.stringify(semua));
  }
  /* 6) kabel: pose lokal + pemain lain; rok kaku tidak diubah di tempat lain */
  assert.match(HTML, /avatarRokBean\(avPartsSaya, !!roomPose && poseTempat === 'beanbag'\);/);
  const jauh = blok('mpTerapkanPoseRemote');
  assert.match(jauh, /avatarRokBean\(p, diBean\);/);
  assert.equal((jauh.match(/if \(p\.rokBeanAktif\) avatarRokBean\(p, false\);/g) || []).length, 3);
  assert.equal((HTML.match(/avatarRokBean\(/g) || []).length, 6);
  assert.match(HTML, /parts\.rok = pasang\(\[krBagian\(new THREE\.CylinderGeometry\(0\.30, 0\.46, 0\.52, 16, 1, false, Math\.PI, Math\.PI \* 2\), 0, 0\.6, 0\)\], krRok\(\)\); parts\.rokJenis = 0;/);
  assert.match(HTML, /parts\.rok = pasang\(\[krBagian\(new THREE\.CylinderGeometry\(0\.29, 0\.45, 0\.66, 28, 1, false, Math\.PI, Math\.PI \* 2\), 0, 0\.53, 0\)\], krPlisket\(\)\); parts\.rokJenis = 3;/);
});
