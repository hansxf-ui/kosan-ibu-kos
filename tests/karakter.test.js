'use strict';
/* Tes Karakter v2 — pilihan tampilan (warna kaus + rambut) + sinkron
   multiplayer. Fungsi murni diambil VERBATIM dari index.html.
   Jalankan: node --test tests/karakter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const F = new Function(antara('/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */')
  + antara('/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */')
  + '\nreturn { RUPA_BAJU, RUPA_RAMBUT, mpRupaDikenal, rupaEfektif, mpBangunPos, mpBangunPresence, mpValidasiPos, mpValidasiPresence, mpProsesPesan, MP_TOPICS };')();

test('karakter: palet 7 warna kaus + 5 warna rambut, bawaan = tampilan lama', () => {
  assert.equal(F.RUPA_BAJU.length, 7); assert.equal(F.RUPA_RAMBUT.length, 5);
  for (const w of F.RUPA_BAJU.concat(F.RUPA_RAMBUT)) { assert.ok(Number.isInteger(w.warna) && w.warna >= 0 && w.warna <= 0xffffff); assert.ok(w.nama); }
  assert.equal(F.RUPA_BAJU[0].warna, 0xf6ce7d, 'krem = kaus lama cewek');
  assert.equal(F.RUPA_BAJU[1].warna, 0x2a9d8f, 'teal = kaus lama cowok');
  assert.equal(F.RUPA_RAMBUT[0].warna, 0x3a2a1e, 'rambut lama');
  assert.deepEqual(F.rupaEfektif('cewek', null), { baju: 0, rambut: 0 });
  assert.deepEqual(F.rupaEfektif('cowok', null), { baju: 1, rambut: 0 });
  assert.deepEqual(F.rupaEfektif('cowok', { baju: 5, rambut: 3 }), { baju: 5, rambut: 3 });
  assert.deepEqual(F.rupaEfektif('cewek', { baju: 99, rambut: '2' }), { baju: 0, rambut: 0 }, 'simpanan rusak -> bawaan');
});

test('karakter: indeks tampilan divalidasi ketat (bukan bilangan bulat dalam rentang -> -1)', () => {
  for (const v of [0, 3, 6]) assert.equal(F.mpRupaDikenal(v, 7), v);
  for (const v of [7, -1, 1.5, '2', null, undefined, NaN, Infinity, '__proto__', {}, []]) assert.equal(F.mpRupaDikenal(v, 7), -1, String(v));
});

test('karakter: tampilan ikut pesan pos + presence, pulang-pergi lewat mpProsesPesan', () => {
  const pos = F.mpBangunPos('pabc1', 'rina', 'cewek', 'yard', 1, 2, 0, 0, 5, 'stand', null, 0, 5, 3);
  assert.equal(pos.baju, 5); assert.equal(pos.rambut, 3);
  const r = F.mpProsesPesan(F.MP_TOPICS.pos, JSON.stringify(pos), 'pdiri');
  assert.equal(r.msg.baju, 5); assert.equal(r.msg.rambut, 3);
  const pr = F.mpBangunPresence('pabc1', 'rina', 'cewek', 'yard', 5, 2, 4);
  const r2 = F.mpProsesPesan(F.MP_TOPICS.presence + 'pabc1', JSON.stringify(pr), 'pdiri');
  assert.equal(r2.kind, 'presence'); assert.equal(r2.msg.baju, 2); assert.equal(r2.msg.rambut, 4);
  /* nilai asing tidak dikirim */
  const asing = F.mpBangunPos('pabc1', 'rina', 'cewek', 'yard', 1, 2, 0, 0, 5, 'stand', null, 0, 42, 'x');
  assert.ok(!('baju' in asing) && !('rambut' in asing));
});

test('karakter: pesan klien lama / tampilan rusak tetap diterima, tampilan = bawaan (-1)', () => {
  const dasar = { id: 'pabc1', nama: 'rina', gender: 'cewek', realm: 'yard', x: 0, z: 0, rot: 0, gerak: 0, ts: 1 };
  const lama = F.mpValidasiPos(dasar, 'pdiri');
  assert.ok(lama); assert.equal(lama.baju, -1); assert.equal(lama.rambut, -1);
  const rusak = F.mpValidasiPos(Object.assign({}, dasar, { baju: '<b>', rambut: 1e9 }), 'pdiri');
  assert.ok(rusak); assert.equal(rusak.baju, -1); assert.equal(rusak.rambut, -1);
  const pres = F.mpValidasiPresence({ id: 'pabc1', nama: 'rina', gender: 'cowok', realm: 'yard', ts: 1, baju: 6, rambut: -3 }, 'pdiri');
  assert.equal(pres.baju, 6); assert.equal(pres.rambut, -1);
});

test('karakter: kabel — avatar sendiri, pemain lain, Ibu Kos, panel Tampilan', () => {
  assert.match(fungsi('buildVisitorAvatar'), /makeKosanAvatar\(visitorGender, rupaSaya\(\)\)/);
  /* Perabot modern: pemain lain dibangun dengan warna + GAYA mereka (field opsional potong/atasan/bawahan/alas) */
  assert.match(fungsi('mpBuatRemote'), /makeKosanAvatar\(gender, mpPasangGaya\(\{ baju: baju, rambut: rambut \}, gaya\)\)/);
  assert.match(fungsi('mpBangunUlangRemote'), /makeKosanAvatar\(entri\.gender, mpPasangGaya\(\{ baju: entri\.baju, rambut: entri\.rambut \}, entri\.gaya\)\)/);
  assert.equal((HTML.match(/m\.gender !== entri\.gender \|\| m\.baju !== entri\.baju \|\| m\.rambut !== entri\.rambut/g) || []).length, 2, 'pos + presence membangun ulang saat tampilan berubah');
  assert.match(HTML, /ibuAvatar = makeKosanAvatar\('cewek', null, \{ ibu: true \}\)\.g;/);
  assert.ok(!/function makeChibi\(/.test(HTML), 'model Ibu Kos lama dicabut');
  assert.match(fungsi('mpKirimPos'), /rupaSaya\(\)\.baju, rupaSaya\(\)\.rambut/);
  assert.match(fungsi('mpKirimPresence'), /mpBangunPresence\(playerId, visitorName, visitorGender, myRealm, Date\.now\(\), r\.baju, r\.rambut\)/);
  assert.match(fungsi('rupaSet'), /localStorage\.setItem\('kosan3d-rupa'/);
  assert.match(HTML, /id="rupaBtn"/); assert.match(HTML, /id="rupaPanel"/);
  /* proporsi + sendi tidak berubah (pose duduk/tidur tetap pas) */
  const b = fungsi('makeKosanAvatar');
  assert.match(b, /pivot\(sx \* 0\.12, 0\.72, 0\)/); assert.match(b, /pivot\(sx \* 0\.34, 1\.16, 0, sx \* 0\.2\)/);
  assert.match(b, /g\.scale\.setScalar\(ibu \? 1\.0 : 1\.1\)/);
});
