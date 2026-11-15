'use strict';
/* Tes unit Tahap 2 (emote + duduk ruang tamu + kotak tabrakan). Fungsi
   murni diambil VERBATIM dari index.html (blok PURE, MP-PURE, TAHAP2).
   Jalankan: node --test tests/tahap2.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function antara(a, b) {
  const i = HTML.indexOf(a), j = HTML.indexOf(b, i);
  assert.ok(i > 0 && j > i, a + ' tidak ditemukan');
  return HTML.slice(i, j);
}
function varBaris(nama) {
  const i = HTML.indexOf('var ' + nama + ' = ');
  assert.ok(i > 0, nama);
  return HTML.slice(i, HTML.indexOf(';', i) + 1);
}
function muat(ekspor) {
  const kode = antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
    + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
    + antara('/* ==== GAZEBO-START ==== */', '/* ==== GAZEBO-END ==== */')
    + antara('/* ==== TAHAP2-START ==== */', '/* ==== TAHAP2-END ==== */')
    + ['LIVING', 'LIVING_TABLE', 'LIVING_SPAWN'].map(varBaris).join('\n');
  return new Function(kode + '\nreturn {' + ekspor.join(',') + '};')();
}
const F = muat(['mpPoseDikenal', 'mpEmoteDikenal', 'mpBangunPos', 'mpValidasiPos', 'mpProsesPesan', 'MP_TOPICS', 'EMOTE_IDS', 'EMOTE_DUR_MS', 'EMOTE_JEDA_MS',
  'dudukPilih', 'RUANG_TAMU_DUDUK', 'LIVING_SOFA', 'LIVING_MEJA_TV', 'LIVING_TV_POS', 'LIVING', 'LIVING_TABLE', 'LIVING_SPAWN', 'resolveAABB', 'jarakKeKotak',
  'emoteSisaMs', 'emoteMulaiBaru', 'emoteAnimasi', 'DUDUK_POSE', 'mpRealmDikenal']);
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a)); };

test('pose lesehan dikenal; pose asing tetap jadi stand', () => {
  assert.equal(F.mpPoseDikenal('lesehan'), 'lesehan');
  for (const p of ['sit', 'sleep', 'stand']) assert.equal(F.mpPoseDikenal(p), p);
  for (const p of ['LESEHAN', '__proto__', '', null, 3]) assert.equal(F.mpPoseDikenal(p), 'stand', String(p));
});

test('emote: daftar tetap 8 sesuai brief, id lain ditolak (tanpa teks bebas)', () => {
  assert.deepEqual(F.EMOTE_IDS, ['lambai', 'tawa', 'sedih', 'sayang', 'marah', 'ngantuk', 'hore', 'mantap']);
  for (const e of F.EMOTE_IDS) assert.equal(F.mpEmoteDikenal(e), e);
  for (const e of ['halo semua', 'Lambai', '__proto__', 'constructor', 'toString', '', null, 1, {}]) assert.equal(F.mpEmoteDikenal(e), null, String(e));
  assert.equal(F.EMOTE_DUR_MS, 3000);
});

test('emote: dikirim lewat pos hanya kalau sah; pulang-pergi lewat mpProsesPesan', () => {
  const ts = 1_800_000_000_000;
  const pos = (emote, emoteTs) => F.mpBangunPos('pabc123', 'rina', 'cewek', 'living', 1, -2, 0.5, 0, ts, 'sit', emote, emoteTs);
  const m = pos('hore', ts - 500);
  assert.equal(m.emote, 'hore'); assert.equal(m.emoteTs, ts - 500);
  assert.ok(!('emote' in pos('teks bebas', ts)), 'id asing tidak dikirim');
  assert.ok(!('emote' in pos('hore', 0)), 'ts tak sah tidak dikirim');
  assert.ok(!('emote' in pos(null, 0)), 'tanpa emote = pesan lama');
  const r = F.mpProsesPesan(F.MP_TOPICS.pos, JSON.stringify(m), 'pdiri99');
  assert.equal(r.kind, 'pos'); assert.equal(r.msg.emote, 'hore'); assert.equal(r.msg.emoteTs, ts - 500); assert.equal(r.msg.pose, 'sit');
});

test('emote: pesan dengan emote rusak TETAP diterima, emote-nya null', () => {
  const dasar = { id: 'pabc123', nama: 'rina', gender: 'cewek', realm: 'yard', x: 0, z: 0, rot: 0, gerak: 0, ts: 5, pose: 'stand' };
  for (const [e, t] of [['<b>halo</b>', 5], ['__proto__', 5], ['hore', 'x'], ['hore', -1], ['hore', Infinity], ['hore', undefined]]) {
    const v = F.mpValidasiPos(Object.assign({}, dasar, { emote: e, emoteTs: t }), 'pdiri99');
    assert.ok(v, 'pesan tetap sah');
    assert.equal(v.emote, null, String(e) + '/' + String(t)); assert.equal(v.emoteTs, 0);
  }
  const lama = F.mpValidasiPos(dasar, 'pdiri99');
  assert.equal(lama.emote, null, 'klien lama tanpa field emote');
});

test('emote: sisa waktu dari jam pengirim, mulai baru hanya untuk emote baru + lewat jeda', () => {
  assert.equal(F.emoteSisaMs(10_000, 9_000), 2000);
  assert.ok(F.emoteSisaMs(20_000, 9_000) <= 0, 'basi');
  assert.equal(F.emoteSisaMs(9_000, 10_000), 3000, 'ts pesan lebih tua -> anggap baru');
  const now = 100_000;
  assert.equal(F.emoteMulaiBaru(null, 'hore', 1, 3000, now), true);
  assert.equal(F.emoteMulaiBaru(null, 'hore', 1, 0, now), false, 'basi');
  assert.equal(F.emoteMulaiBaru(null, null, 1, 3000, now), false);
  assert.equal(F.emoteMulaiBaru({ emoteTs: 1, mulai: now - 2000 }, 'hore', 1, 3000, now), false, 'heartbeat emote sama tidak mengulang');
  assert.equal(F.emoteMulaiBaru({ emoteTs: 1, mulai: now - F.EMOTE_JEDA_MS + 1 }, 'tawa', 2, 3000, now), false, 'banjir: dalam jeda');
  assert.equal(F.emoteMulaiBaru({ emoteTs: 1, mulai: now - F.EMOTE_JEDA_MS }, 'tawa', 2, 3000, now), true);
});

test('emote: animasi membal masuk, pudar di akhir, selesai tepat 3 dtk', () => {
  assert.equal(F.emoteAnimasi(-0.1), null);
  assert.equal(F.emoteAnimasi(3), null);
  assert.ok(F.emoteAnimasi(0).skala < 0.05);
  assert.equal(F.emoteAnimasi(1).skala, 1); assert.equal(F.emoteAnimasi(1).alpha, 1);
  assert.ok(F.emoteAnimasi(2.9).alpha < 0.35);
  for (let t = 0; t < 3; t += 0.05) { const a = F.emoteAnimasi(t); assert.ok(a.skala >= 0 && a.skala < 1.2 && a.alpha >= 0 && a.alpha <= 1, String(t)); }
});

test('duduk bantal: lesehan menghadap TV, titik bangun di samping bantal', () => {
  for (const n of ['bantal1', 'bantal2']) {
    const j = F.dudukPilih(n, 0, -2, []);
    assert.equal(j.pose, 'lesehan'); assert.equal(j.y, F.DUDUK_POSE.lesehan.y); assert.equal(j.leg, F.DUDUK_POSE.lesehan.leg);
    const kx = Math.sin(j.rotY), kz = Math.cos(j.rotY), tx = F.LIVING_TV_POS.x - j.x, tz = F.LIVING_TV_POS.z - j.z, d = Math.hypot(tx, tz);
    assert.ok(Math.abs(kx - tx / d) < 1e-9 && Math.abs(kz - tz / d) < 1e-9, n + ' menghadap TV');
    assert.equal(F.dudukPilih(n, 0, -2, [{ x: j.x + 0.2, z: j.z }]), null, n + ' terisi');
  }
  assert.equal(F.dudukPilih('bantal1', 0, -2, [{ x: 1.7, z: -3.1 }]).x, -1.7, 'orang di bantal2 tidak memblokir bantal1');
});

test('duduk sofa: 3 dudukan, terdekat dulu, terisi dilewati, penuh -> null', () => {
  const xs = F.RUANG_TAMU_DUDUK.sofa.kursi.map((k) => k.x);
  assert.equal(xs.length, 3);
  for (const x of xs) {
    const j = F.dudukPilih('sofa', x, -0.1, []);
    assert.equal(j.x, x); assert.equal(j.pose, 'sit'); assert.equal(j.rotY, Math.PI); assert.equal(j.y, -0.31); assert.equal(j.leg, -0.92);
  }
  assert.equal(F.dudukPilih('sofa', 0.1, -0.1, [{ x: 0, z: 0.61 }]).x !== 0, true);
  assert.equal(F.dudukPilih('sofa', 0, -0.1, xs.map((x) => ({ x, z: 0.61 }))), null);
  for (const n of ['__proto__', 'constructor', 'kasur', 'gazebo']) assert.equal(F.dudukPilih(n, 0, 0, []), null, n);
});

test('tempat duduk + titik bangun + spawn: di dalam ruang tamu dan di luar semua perabot padat', () => {
  const padat = [F.LIVING_TABLE, F.LIVING_MEJA_TV, F.LIVING_SOFA];
  const r = 0.4;
  const diLuar = (x, z) => padat.every((b) => F.jarakKeKotak(x, z, b) > r - 1e-9);
  const diDalam = (x, z) => x >= F.LIVING.minX && x <= F.LIVING.maxX && z >= F.LIVING.minZ && z <= F.LIVING.maxZ;
  for (const [nama, t] of Object.entries(F.RUANG_TAMU_DUDUK)) for (const k of t.kursi) {
    assert.ok(diDalam(k.bx, k.bz) && diLuar(k.bx, k.bz), nama + ' bangun ' + k.bx + ',' + k.bz);
    assert.ok(F.jarakKeKotak(k.x, k.z, t.kotak) === 0, nama + ' kursi di atas kotaknya');
  }
  assert.ok(diLuar(F.LIVING_SPAWN.x, F.LIVING_SPAWN.z), 'spawn ruang tamu tidak di dalam perabot');
});

test('tabrakan: meja TV + sofa menahan avatar (resolveAABB) dan terpasang di cabang ruang tamu', () => {
  for (const b of [F.LIVING_MEJA_TV, F.LIVING_SOFA]) {
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const h = F.resolveAABB(cx, cz, b, 0.4, F.LIVING);
    assert.ok(h.hit && F.jarakKeKotak(h.x, h.z, b) >= 0.4 - 1e-9, JSON.stringify(h));
  }
  assert.ok(F.LIVING_MEJA_TV.minZ >= -4.5 && F.LIVING_MEJA_TV.maxX - F.LIVING_MEJA_TV.minX <= 2.1);
  assert.ok(F.LIVING_SOFA.maxZ < 4.5 - 0.8, 'sofa jauh dari pintu KELUAR (z 4,5)');
  const a = HTML.indexOf("} else if (myRealm === 'living') {"), blok = HTML.slice(a, HTML.indexOf("} else if (myRealm.indexOf('room-') === 0) {", a));
  assert.match(blok, /resolveAABB\(nx, nz, LIVING_MEJA_TV, 0\.4, LIVING\)/);
  assert.match(blok, /resolveAABB\(nx, nz, LIVING_SOFA, 0\.4, LIVING\)/);
});

test('kabel: ketuk bantal/sofa, bangun sebelum keluar ruang tamu, emote ikut pos + diterima', () => {
  assert.match(HTML, /if \(ud\.interact === 'duduk'\) \{ showDudukCard\(ud\.kursi\); return; \}/);
  assert.match(HTML, /interact: 'duduk', kursi: 'bantal1'/);
  assert.match(HTML, /interact: 'duduk', kursi: 'bantal2'/);
  assert.match(HTML, /interact: 'duduk', kursi: 'sofa'/);
  const ex = fungsi('exitLiving');
  assert.ok(ex.indexOf('if (roomPose) bangunDariKasur(true);') > 0 && ex.indexOf('if (roomPose) bangunDariKasur(true);') < ex.indexOf("myRealm = 'yard'"));
  assert.match(fungsi('mpKirimPos'), /emoteAktifSaya\(Date\.now\(\)\) \? emoteSaya\.id : null/);
  assert.match(fungsi('mpTerimaPos'), /emoteTerimaRemote\(entri, m, Date\.now\(\)\)/);
  assert.match(fungsi('mpHapusRemote'), /emoteBuang\(entri\.emote\)/);
  assert.match(fungsi('mpTerapkanPoseRemote'), /entri\.pose === 'lesehan'/);
});

test('realm tidak diubah Tahap 2 (dapur tetap dikenal)', () => {
  assert.equal(F.mpRealmDikenal('dapur'), 'dapur');
  assert.equal(F.mpRealmDikenal('room-41'), 'yard'); /* Gedung C & D: room-1..40 dikenal */
});

test('TV + AC kamar dibangun SEKALI di roomScene (dipakai room-1..20), layar = Basic', () => {
  assert.equal((HTML.match(/bangunTvDindingKamar\(\);/g) || []).length, 1);
  assert.equal((HTML.match(/bangunAcKamar\(\);/g) || []).length, 1);
  assert.match(HTML, /layar: new THREE\.MeshBasicMaterial\(\{ map: layar \}\)/);
  assert.match(fungsi('bangunAcKamar'), /roomScene\.add\(R\)/);
  /* Perabot modern (15 Nov, Ryan: TV kecil): TV kamar 1,1 -> 1,45 m (16:9) */
  assert.match(fungsi('bangunTvDindingKamar'), /buatTv\(1\.45, 0\.816, roomScene\)/);
});
