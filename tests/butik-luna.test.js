'use strict';
/* Tes Butik Maison Luna (28 Nov): 10 busana premium (jenis 'busana') di server + klien (blok BUTIK-LUNA sama persis), beli lewat
   /api/belanja (database palsu) dari kamar 41 DAN kamar 60 (rentang baru) + tamu ditolak, field multiplayer opsional
   (nilai asing ditolak, klien lama aman), kabel ke runtime dicek lewat teks. Tanpa jaringan. Jalankan: node --test tests/butik-luna.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../api/_lib/kerja');
const { buatApp } = require('../api/_lib/app');
const { buatFakeDb } = require('./fake-db');
const { normalize } = require('../api/_lib/inti');

const AKAR = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
const KERJA_JS = fs.readFileSync(path.join(AKAR, 'api', '_lib', 'kerja.js'), 'utf8');
const antara = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return s.slice(i, j + b.length); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const MURNI = antara(HTML, '/* ==== BUTIK-LUNA-START ==== */', '/* ==== BUTIK-LUNA-END ==== */');
const UI = antara(HTML, '/* ==== BUTIK-LUNA-UI-START ==== */', '/* ==== BUTIK-LUNA-UI-END ==== */');
const GEO = antara(HTML, '/* ==== BUTIK-LUNA-GEO-START ==== */', '/* ==== BUTIK-LUNA-GEO-END ==== */');
const F = new Function(antara(HTML, '/* ==== PURE-START ==== */', '/* ==== PURE-END ==== */') + antara(HTML, '/* ==== MP-PURE-START ==== */', '/* ==== MP-PURE-END ==== */') + MURNI
  + '\nreturn { BUSANA, BUSANA_URUT, BUSANA_SLOT, BUSANA_KUNCI, busanaDari, busanaIndeks, busanaBaca, busanaSusun, MP_BUSANA_KUNCI, mpBacaBusana, mpPasangBusana, mpBusanaSama,'
  + ' mpValidasiPos, mpValidasiPresence, mpBacaAksesori, mpBacaGaya, GAYA_ATASAN, GAYA_BAWAHAN, GAYA_ALAS };')();
const polos = (o) => JSON.parse(JSON.stringify(o));

const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [{ room: 41, name: 'tya', gender: 'Cewek', pin: '112233' }, { room: 60, name: 'bagas', gender: 'Cowok', pin: '135790' }, { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' }];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
function siapkan() {
  const jam = Date.parse('2026-11-28T10:00:00Z');
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  return { db, app: buatApp({ db, rahasia: RAHASIA, sekarang: () => jam }) };
}
async function login(app, username, pin) {
  const r = await app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
const isiSaldo = (S, room, nama, jumlah) => S.db._t.dompet.set(room + '|' + normalize(nama), jumlah);

test('blok BUTIK-LUNA sama persis di klien dan server; katalog lama (KATALOG) tidak disentuh', () => {
  assert.equal(antara(KERJA_JS, '/* ==== BUTIK-LUNA-START ==== */', '/* ==== BUTIK-LUNA-END ==== */'), MURNI);
  assert.deepEqual(polos(F.BUSANA), polos(K.BUSANA));
  assert.deepEqual(F.BUSANA_URUT, K.BUSANA_URUT);
  for (const id of Object.keys(K.BUSANA)) assert.ok(!Object.prototype.hasOwnProperty.call(K.KATALOG, id), 'id busana tidak bentrok katalog lama: ' + id);
  assert.equal(Object.keys(K.KATALOG).filter((k) => K.KATALOG[k].jenis === 'busana').length, 0);
});

test('10 busana: id cocok CHECK kosan_barang, harga Rp30.000-Rp120.000 terurut naik, keterangan mutasi muat, satu barang satu slot', () => {
  const ids = Object.keys(K.BUSANA);
  assert.equal(ids.length, 10);
  assert.deepEqual(K.BUSANA_URUT.slice().sort(), ids.slice().sort());
  let lalu = 0;
  for (const id of K.BUSANA_URUT) {
    const b = K.BUSANA[id];
    assert.match(id, /^[a-z0-9_]{2,30}$/, 'cocok CHECK kosan_barang');
    assert.equal(b.jenis, 'busana');
    assert.ok(Number.isInteger(b.harga) && b.harga >= 30000 && b.harga <= 120000, id + ' harga ' + b.harga);
    assert.ok(b.harga >= lalu, 'deret toko terurut harga'); lalu = b.harga;
    assert.ok(('Beli ' + b.nama).length <= 80);
    assert.ok(K.BUSANA_SLOT[b.slot].includes(id), id + ' di slot ' + b.slot);
    assert.deepEqual(K.barangDari(id), b);
    assert.equal(K.busanaIndeks(id), K.BUSANA_SLOT[b.slot].indexOf(id));
  }
  assert.equal(K.BUSANA_URUT[0], 'luna_baret'); assert.equal(K.BUSANA.luna_baret.harga, 30000);
  assert.equal(K.BUSANA.luna_jaket.harga, 120000);
  assert.deepEqual(Object.values(K.BUSANA_SLOT).flat().sort(), ids.slice().sort());
  assert.deepEqual(Object.keys(K.BUSANA_SLOT), Object.keys(K.BUSANA_KUNCI));
  /* nama tidak menabrak model gratis menu Tampilan */
  const gratis = [].concat(F.GAYA_ATASAN, F.GAYA_BAWAHAN, F.GAYA_ALAS).map((g) => g.nama.toLowerCase());
  for (const id of ids) assert.ok(!gratis.includes(K.BUSANA[id].nama.toLowerCase()), K.BUSANA[id].nama);
  for (const x of [null, undefined, 7, {}, '__proto__', 'constructor', 'toString', 'luna_', 'LUNA_BLAZER', 'luna_blazer ']) assert.equal(K.busanaDari(x), null, String(x));
  assert.equal(K.barangDari('topi_baseball').jenis, 'aksesori');
  assert.equal(K.barangDari('constructor'), null);
});

test('field multiplayer: jumlah indeks = isi slot; nilai asing ditolak (-1); klien lama (tanpa field) aman; pos + presence membawa busana', () => {
  assert.deepEqual(F.MP_BUSANA_KUNCI.map((k) => [k[0], k[1]]), Object.keys(F.BUSANA_SLOT).map((s) => [F.BUSANA_KUNCI[s], F.BUSANA_SLOT[s].length]));
  for (const x of [null, {}, { bAtasan: 3, bBawahan: 1, bAlas: 0, bTopi: 0, bTas: 0 }, { bAtasan: 4, bTopi: 1, bTas: '0', bAlas: 1.5, bBawahan: -1 }]) assert.deepEqual(F.busanaBaca(x), F.mpBacaBusana(x), 'pembaca avatar = pembaca pesan');
  assert.deepEqual(F.mpBacaBusana(null), { bAtasan: -1, bBawahan: -1, bAlas: -1, bTopi: -1, bTas: -1 });
  assert.deepEqual(F.mpBacaBusana({ bAtasan: 3, bBawahan: 1, bAlas: 0, bTopi: 0, bTas: 0 }), { bAtasan: 3, bBawahan: 1, bAlas: 0, bTopi: 0, bTas: 0 });
  for (const x of [4, -1, 1.5, '1', null, NaN, Infinity, true, [0], {}]) assert.equal(F.mpBacaBusana({ bAtasan: x }).bAtasan, -1, String(x));
  assert.equal(F.mpBacaBusana({ bTopi: 1 }).bTopi, -1); assert.equal(F.mpBacaBusana({ bTas: 1 }).bTas, -1); assert.equal(F.mpBacaBusana({ bBawahan: 2 }).bBawahan, -1);
  assert.deepEqual(F.mpPasangBusana({ a: 1 }, { bAtasan: 0, bTas: 9, bAlas: -1 }), { a: 1, bAtasan: 0 });
  assert.ok(F.mpBusanaSama({ bAtasan: 1 }, { bAtasan: 1, bTas: 5 })); assert.ok(!F.mpBusanaSama({ bAtasan: 1 }, { bAtasan: 2 })); assert.ok(F.mpBusanaSama(null, {}));
  const dasar = { id: 'pabc1', nama: 'tya', gender: 'cewek', realm: 'yard', x: 0, z: 12, rot: 0, gerak: 0, ts: 1, pose: 'stand' };
  const lama = F.mpValidasiPos(dasar, 'pdiri');
  assert.ok(lama, 'pesan klien lama tetap diterima'); assert.equal(lama.bAtasan, -1); assert.equal(lama.bTas, -1);
  const baru = F.mpValidasiPos(Object.assign({}, dasar, { bAtasan: 1, bBawahan: 1, bAlas: 1, bTopi: 0, bTas: 0, topi: 1 }), 'pdiri');
  assert.deepEqual([baru.bAtasan, baru.bBawahan, baru.bAlas, baru.bTopi, baru.bTas, baru.topi], [1, 1, 1, 0, 0, 1]);
  const asing = F.mpValidasiPos(Object.assign({}, dasar, { bAtasan: 99, bBawahan: 'x', bAlas: {}, bTopi: 3, bTas: -2 }), 'pdiri');
  assert.ok(asing, 'nilai asing tidak menjatuhkan pesan'); assert.deepEqual([asing.bAtasan, asing.bBawahan, asing.bAlas, asing.bTopi, asing.bTas], [-1, -1, -1, -1, -1]);
  const pr = F.mpValidasiPresence({ id: 'pabc1', nama: 'tya', gender: 'cewek', realm: 'yard', ts: 1, bAtasan: 2, bTopi: 7 }, 'pdiri');
  assert.equal(pr.bAtasan, 2); assert.equal(pr.bTopi, -1);
  assert.equal(F.mpValidasiPresence({ id: 'pabc1', nama: 'tya', gender: 'cewek', realm: 'yard', ts: 1 }, 'pdiri').bAtasan, -1);
});

test('busanaSusun: hanya barang yang DIMILIKI + slotnya benar yang disiarkan', () => {
  assert.deepEqual(F.busanaSusun({ atasan: 'luna_blazer', bawahan: 'luna_rok', topi: 'luna_baret' }, ['luna_blazer', 'luna_baret']), { bAtasan: 0, bTopi: 0 });
  assert.deepEqual(F.busanaSusun({ atasan: 'luna_jaket' }, []), {});
  assert.deepEqual(F.busanaSusun({ atasan: 'luna_kulot' }, ['luna_kulot']), {}, 'barang di slot yang salah diabaikan');
  assert.deepEqual(F.busanaSusun({ alas: 'luna_loafers', tas: 'luna_tas', bawahan: 'luna_kulot', atasan: 'luna_cardigan' }, K.BUSANA_URUT), { bAtasan: 3, bBawahan: 0, bAlas: 1, bTas: 0 });
  for (const x of [null, undefined, 5, 'x', []]) assert.deepEqual(F.busanaSusun(x, x), {});
  assert.deepEqual(F.busanaSusun({ __proto__: { atasan: 'luna_blazer' } }, ['luna_blazer']), {});
});

test('beli: kamar 41 + kamar 60 berhasil (saldo terpotong, jadi milik, tercatat di mutasi), dobel ditolak, saldo kurang ditolak, tamu 401, id asing 400', async () => {
  const S = siapkan();
  for (const [room, nama, pin] of [[41, 'tya', '112233'], [60, 'bagas', '135790']]) {
    const t = await login(S.app, nama, pin);
    isiSaldo(S, room, nama, 300000);
    let saldo = 300000;
    for (const id of ['luna_baret', 'luna_blazer', 'luna_jaket']) {
      const r = await S.app.belanja(post({ aksi: 'beli', barang: id }, t));
      assert.equal(r.status, 200, id + ' ' + JSON.stringify(r.body));
      saldo -= K.BUSANA[id].harga;
      assert.deepEqual(r.body, { saldo, barang: id });
    }
    assert.equal(saldo, 60000);
    const dobel = await S.app.belanja(post({ aksi: 'beli', barang: 'luna_blazer' }, t));
    assert.equal(dobel.status, 409); assert.equal(dobel.body.galat, 'sudah_punya');
    const kurang = await S.app.belanja(post({ aksi: 'beli', barang: 'luna_tas' }, t)); /* sisa Rp60.000 < Rp100.000 */
    assert.equal(kurang.status, 409); assert.equal(kurang.body.galat, 'saldo_kurang');
    const d = await S.app.dompet(get(t));
    assert.equal(d.status, 200); assert.equal(d.body.saldo, saldo);
    assert.deepEqual(d.body.barang.slice().sort(), ['luna_baret', 'luna_blazer', 'luna_jaket'].sort(), 'dompet mengembalikan busana milik (muat ulang = tetap)');
    assert.ok(S.db._t.mutasi.some((m) => m.room === room && m.keterangan === 'Beli Blazer' && m.jumlah === -90000 && m.jenis === 'beli'));
  }
  /* saldo persis kurang 1 rupiah ditolak, saldo pas diterima */
  const t3 = await login(S.app, 'rina', '246810');
  isiSaldo(S, 3, 'rina', 29999);
  assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: 'luna_baret' }, t3))).body.galat, 'saldo_kurang');
  isiSaldo(S, 3, 'rina', 30000);
  assert.deepEqual((await S.app.belanja(post({ aksi: 'beli', barang: 'luna_baret' }, t3))).body, { saldo: 0, barang: 'luna_baret' });
  const tamu = await S.app.belanja(post({ aksi: 'beli', barang: 'luna_baret' }));
  assert.equal(tamu.status, 401);
  for (const x of ['luna_gaun', 'LUNA_BARET', '', null, 7, '__proto__']) assert.equal((await S.app.belanja(post({ aksi: 'beli', barang: x }, t3))).status, 400, String(x));
});

test('kabel klien: avatar, pemain lain, siaran, toko, panel Tampilan, tamu, keluar butik', () => {
  const avatar = fungsi('makeKosanAvatar');
  for (const s of ['busanaBaca(ibu ? null : (busanaTitip || rupa)); busanaTitip = null;', 'parts.busKini = bus', 'lunaAtasan(bus.bAtasan', 'lunaBawahan(bus.bBawahan', 'lunaAlas(bus.bAlas', 'busanaPasang(parts)']) assert.ok(avatar.includes(s), s);
  assert.ok(fungsi('rupaSaya').includes('busanaSayaTampil())') || HTML.includes('gayaEfektif(visitorGender, rupaMentah())), busanaSayaTampil()); }'));
  assert.ok(fungsi('mpBuatRemote').includes('busanaTitip = gaya;') && fungsi('mpBuatRemote').includes('bus: mpBacaBusana(gaya)'));
  assert.ok(fungsi('mpBangunUlangRemote').includes('busanaTitip = entri.bus;'));
  for (const n of ['mpTerimaPos', 'mpTerimaPresence']) assert.ok(fungsi(n).includes('!mpBusanaSama(m, entri.bus)') && fungsi(n).includes('entri.bus = mpBacaBusana(m)'), n);
  for (const n of ['mpKirimPos', 'mpKirimPresence']) assert.ok(fungsi(n).includes('mpPasangBusana(msg, busanaSayaMp())'), n + ' menyiarkan busana MILIK saja');
  assert.ok(!/mpPasangBusana\(msg, busanaSayaTampil/.test(HTML), 'barang yang sedang dicoba tidak disiarkan');
  assert.ok(fungsi('aksesoriPasang').includes('parts.busKini.bTopi >= 0') && fungsi('aksesoriPasang').includes('parts.busKini.bTas >= 0'), 'satu slot satu barang');
  assert.ok(fungsi('aksesoriPakai').includes('busanaLepasSlot(it.slot)'));
  assert.ok(fungsi('gayaSet').includes('busanaLepasSlot(bagian)'));
  assert.ok(fungsi('rupaRender').includes('lunaRupaRender()'));
  assert.ok(fungsi('kotaKetukRuang').includes("id === 'cermin' || id === 'manekinA' || id === 'manekinB'") && fungsi('kotaKetukRuang').includes('lunaBuka()'));
  assert.ok(fungsi('kotaKetukRuang').includes("KK_OBJEK[id] && KK_RUANG[R] === KK_OBJEK[id]"), 'tas pajangan tetap pintu kerja Pramuniaga');
  assert.ok(UI.includes("'Khusus penghuni kos'") && UI.includes("apiKosan('POST', '/api/belanja', { aksi: 'beli', barang: id })"));
  assert.ok(fungsi('busanaSayaMp').includes('busanaSusun(busanaPilihan(), busanaMilik())'));
  assert.ok(fungsi('busanaMilik').includes('ktaIsResident()'), 'tamu tidak pernah punya busana');
  assert.ok(fungsi('lunaSegar').includes('lunaLepasCoba()'), 'keluar butik = barang cobaan lepas');
  assert.ok(fungsi('lunaAksi').includes('d.saldo < b.harga'));
  assert.ok(HTML.includes('if (LUNA.aktif) { dorongStateLagi(); lunaTutup(); return; }'));
  /* gambar barang = data URI WebP (render model 3D game), satu per barang, tanpa berkas / permintaan baru */
  for (const id of K.BUSANA_URUT) assert.match(HTML, new RegExp("\\n  " + id + ": 'data:image/webp;base64,[A-Za-z0-9+/=]{400,}'"), 'gambar ' + id);
  assert.ok(!/<svg/.test(antara(HTML, 'function lunaRender()', 'function lunaKamera()')), 'deret toko tanpa ikon garis');
  assert.ok(GEO.includes('function lunaTempel(') && GEO.includes('function lunaRokTick('));
});

test('yang tidak boleh berubah: fetch( tetap 4, fungsi Vercel tetap 11, id baru tidak ganda, tombol toko ada', () => {
  assert.equal(HTML.split('fetch(').length - 1, 4);
  const jalan = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === '_lib' ? [] : jalan(path.join(d, e.name))) : (e.name.endsWith('.js') ? [e.name] : []));
  assert.equal(jalan(path.join(AKAR, 'api')).length, 11);
  const ids = [...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i && /^(luna|rupaLuna)/.test(x)), [], 'id baru tidak ganda');
  for (const id of ['lunaTombol', 'lunaAlat', 'lunaDeret', 'lunaAksi', 'lunaKet', 'lunaSaldo', 'lunaSelesai', 'rupaLuna', 'rupaLunaDeret']) assert.ok(ids.includes(id), id);
});
