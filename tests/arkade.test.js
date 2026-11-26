'use strict';
/* Tes Arkade Ria (Ryan 26 Nov): aturan tiga game (klien = server), logika skor murni, endpoint
   /api/skor dengan database palsu (kamar 3 DAN kamar 60 — pelajaran bug Gedung E/F), papan skor
   mingguan, hadiah boneka, migrasi SQL, dan kabel ke index.html. Tanpa jaringan.
   Jalankan: node --test tests/arkade.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const A = require('../api/_lib/arkade');
const K = require('../api/_lib/kerja');
const { buatApp } = require('../api/_lib/app');
const { buatDb } = require('../api/_lib/db');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const ATURAN = antara('/* ==== ARKADE-START ==== */', '/* ==== ARKADE-END ==== */');
const UI = antara('/* ==== ARKADE-UI-START ==== */', '/* ==== ARKADE-UI-END ==== */');
const NAMA_KLIEN = ['ARK_GAME', 'ARK_CAPIT', 'ARK_BALAP', 'ARK_DANSA', 'ARK_HADIAH', 'ARK_BONEKA', 'ARK_CAPIT_MAIN', 'ARK_BALAP_MAIN',
  'arkBalapLaju', 'arkBalapJarakIdeal', 'arkDansaPeta', 'arkDansaPengali', 'arkDansaNilai', 'arkMingguWib', 'arkMingguSisaDetik', 'arkAcak', 'arkJepit',
  'arkCapitSusun', 'arkCapitSasaran', 'arkCapitPeluangLepas', 'arkCapitNilai', 'arkBalapBaris', 'arkBalapJarakBaris', 'arkBalapKena', 'arkBalapLajuNyata',
  'arkDansaDetik', 'arkDansaBaru', 'arkDansaCari', 'arkDansaKena', 'arkNamaTampil', 'arkSisaTeks'];
const C = new Function(ATURAN + '\nreturn { ' + NAMA_KLIEN.join(', ') + ' };')();

const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [{ room: 3, name: 'rina', gender: 'Cewek', pin: '246810' }, { room: 60, name: 'bagas', gender: 'Cowok', pin: '135790' }, { room: 41, name: 'tya', gender: 'Cewek', pin: '112233' }];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token, ip) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}), body, ip: ip || '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
function siapkan() {
  const S = { jam: Date.parse('2026-11-26T08:30:00Z') }; /* Kamis 26 Nov 15.30 WIB */
  S.db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => S.jam });
  S.app = buatApp({ db: S.db, rahasia: RAHASIA, sekarang: () => S.jam });
  S.maju = (detik) => { S.jam += detik * 1000; };
  return S;
}
async function login(S, username, pin) {
  const r = await S.app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
async function main(S, tok, game, detik, skor, dapat) { /* mulai -> tunggu -> kirim */
  const m = await S.app.skor(post({ aksi: 'mulai', game }, tok));
  assert.equal(m.status, 200, JSON.stringify(m.body));
  S.maju(detik);
  const badan = { aksi: 'kirim', tiket: m.body.tiket, skor }; if (dapat !== undefined) badan.dapat = dapat;
  return S.app.skor(post(badan, tok));
}

/* ---------- aturan ---------- */
test('salinan aturan klien = server: game, capit, balap, dansa, hadiah, peta not, minggu WIB', () => {
  assert.deepEqual(C.ARK_GAME, A.GAME);
  assert.deepEqual(C.ARK_CAPIT, A.CAPIT);
  assert.deepEqual(C.ARK_BALAP, A.BALAP);
  assert.deepEqual(C.ARK_DANSA, A.DANSA);
  assert.deepEqual(C.ARK_HADIAH, A.HADIAH);
  assert.deepEqual(C.arkDansaPeta(), A.dansaPeta());
  for (const t of [-3, 0, 0.5, 12, 30, 59.9, 60, 61, 500]) { assert.equal(C.arkBalapLaju(t), A.balapLaju(t)); assert.equal(C.arkBalapJarakIdeal(t), A.balapJarakIdeal(t)); }
  for (let k = -2; k <= 140; k += 3) assert.equal(C.arkDansaPengali(k), A.dansaPengali(k));
  for (const d of [0, 0.07, -0.07, 0.0701, 0.13, -0.131, 0.19, 0.1901, 1]) assert.equal(C.arkDansaNilai(d), A.dansaNilai(d));
  for (const iso of ['2026-11-22T16:59:59Z', '2026-11-22T17:00:00Z', '2026-11-26T08:30:00Z', '2026-11-29T16:59:59Z', '2026-11-29T17:00:00Z', '2026-12-31T20:00:00Z', '2027-01-03T17:00:00Z']) {
    const ms = Date.parse(iso);
    assert.equal(C.arkMingguWib(ms), A.mingguWib(ms), iso); assert.equal(C.arkMingguSisaDetik(ms), A.mingguSisaDetik(ms), iso);
  }
});

test('minggu papan = Senin 00.00 WIB s.d. Minggu 23.59 WIB; ganti tahun aman', () => {
  assert.equal(A.mingguWib(Date.parse('2026-11-26T08:30:00Z')), '2026-11-23');
  assert.equal(A.mingguWib(Date.parse('2026-11-22T16:59:59Z')), '2026-11-16', 'Minggu 23.59.59 WIB masih minggu lama');
  assert.equal(A.mingguWib(Date.parse('2026-11-22T17:00:00Z')), '2026-11-23', 'Senin 00.00 WIB = minggu baru');
  assert.equal(A.mingguWib(Date.parse('2026-11-29T16:59:59Z')), '2026-11-23');
  assert.equal(A.mingguWib(Date.parse('2027-01-01T05:00:00Z')), '2026-12-28', 'Jumat 1 Jan 2027 ikut minggu yang mulai 28 Des');
  assert.equal(A.mingguSisaDetik(Date.parse('2026-11-29T16:59:59Z')), 1);
  assert.equal(A.mingguSisaDetik(Date.parse('2026-11-22T17:00:00Z')), 7 * 86400);
  assert.equal(C.arkSisaTeks(3 * 86400 + 5 * 3600), '3 hari 5 jam lagi'); assert.equal(C.arkSisaTeks(7200), '2 jam lagi'); assert.equal(C.arkSisaTeks(30), '1 menit lagi');
});

test('batas skor server: mengikuti waktu yang berlalu, tidak bisa dilampaui, masukan aneh = 0', () => {
  assert.equal(A.skorBatas('capit', 0), 0);
  assert.equal(A.skorBatas('capit', 12), 4 * 60, '12 dtk = paling banyak 4 koin');
  assert.equal(A.skorBatas('capit', 1000), A.CAPIT.koin * (A.CAPIT.nilaiMaks + A.CAPIT.bonusPresisi));
  assert.equal(A.skorBatas('balap', 10), Math.floor(22 * 10 + 0.35 * 100) + 30);
  assert.equal(A.skorBatas('balap', 60), 2580 + 30); assert.equal(A.skorBatas('balap', 9999), 2580 + 30, 'sesudah 60 dtk tidak bertambah');
  assert.equal(A.skorBatas('dansa', 45), A.DANSA_MAKS); assert.equal(A.DANSA_MAKS, 11600);
  assert.equal(A.skorJepit('balap', 999999, 20), A.skorBatas('balap', 20));
  assert.equal(A.skorJepit('balap', 300, 20), 300);
  for (const buruk of [-1, 1.5, NaN, '100', null, undefined, Infinity]) assert.equal(A.skorJepit('capit', buruk, 100), 0, String(buruk));
  assert.equal(A.skorJepit('__proto__', 10, 100), 0); assert.equal(A.skorJepit('toString', 10, 100), 0); assert.equal(A.gameDari('constructor'), null);
  assert.ok(Math.max(...Object.keys(A.GAME).map((g) => A.skorBatas(g, 1e9))) <= 100000, 'muat di CHECK kosan_skor.skor');
  assert.equal(A.capitHadiah(60, 3), true); assert.equal(A.capitHadiah(59, 3), false); assert.equal(A.capitHadiah(360, 2), false);
  assert.equal(A.capitHadiah(360, '3'), false); assert.equal(A.capitHadiah(360, 3.5), false);
});

/* ---------- logika game murni ---------- */
test('capit: 7 boneka tidak tumpang tindih + di luar lubang; makin pas makin aman (bukan acak murni); nilai <= batas server', () => {
  for (const benih of [1, 7, 12345, 0xffffffff, 20261126]) {
    const d = C.arkCapitSusun(benih);
    assert.equal(d.length, 7);
    assert.deepEqual(d.map((b) => b.jenis).sort(), ['bebek', 'bebek', 'beruang', 'beruang', 'kelinci', 'kelinci', 'kelinci']);
    assert.deepEqual(C.arkCapitSusun(benih), d, 'deterministik per benih');
    d.forEach((b, i) => {
      assert.ok(b.x - b.r * C.ARK_CAPIT_MAIN.jangkau > C.ARK_CAPIT_MAIN.lubang, 'tidak di atas lubang hadiah');
      assert.ok(b.x >= C.ARK_CAPIT_MAIN.kiri && b.x <= C.ARK_CAPIT_MAIN.kanan, 'terjangkau capit');
      if (i) assert.ok(b.x - d[i - 1].x > (b.r + d[i - 1].r) * C.ARK_CAPIT_MAIN.jangkau, 'jangkauan dua boneka tidak tumpang tindih');
    });
    assert.ok(d.reduce((s, b) => s + C.arkCapitNilai(b, 1), 0) > 0);
  }
  const d = C.arkCapitSusun(5), b = d[2];
  assert.deepEqual(C.arkCapitSasaran(d, b.x), { i: 2, presisi: 1 });
  assert.equal(C.arkCapitSasaran(d, b.x + b.r * 0.5).i, 2); assert.ok(Math.abs(C.arkCapitSasaran(d, b.x + b.r * 0.5).presisi - 0.5) < 1e-9);
  assert.equal(C.arkCapitSasaran(d, b.x + b.r * 1.1).presisi, 0, 'di pinggir: kena tapi presisi 0');
  assert.equal(C.arkCapitSasaran(d, 0.05).i, -1, 'di atas lubang = meleset');
  b.ada = false; assert.equal(C.arkCapitSasaran(d, b.x).i, -1, 'boneka yang sudah diambil tidak bisa dijepit lagi');
  for (const berat of [0.8, 1.0, 1.3]) {
    assert.equal(C.arkCapitPeluangLepas(1, berat), 0); assert.equal(C.arkCapitPeluangLepas(0.9, berat), 0, 'presisi >= 0,9 tidak pernah lepas');
    let lalu = -1; for (let p = 1; p >= 0; p -= 0.05) { const q = C.arkCapitPeluangLepas(p, berat); assert.ok(q >= lalu, 'makin meleset makin gampang lepas'); assert.ok(q <= 0.9); lalu = q; }
  }
  assert.ok(C.arkCapitPeluangLepas(0.5, 1.3) > C.arkCapitPeluangLepas(0.5, 0.8), 'boneka mahal lebih berat');
  const maks = Math.max(...Object.values(C.ARK_BONEKA).map((x) => C.arkCapitNilai(x, 1)));
  assert.equal(maks, A.CAPIT.nilaiMaks + A.CAPIT.bonusPresisi, 'nilai tertinggi satu boneka = batas per koin di server');
  assert.equal(C.arkCapitNilai(C.ARK_BONEKA.kelinci, 0.84), 20); assert.equal(C.arkCapitNilai(C.ARK_BONEKA.kelinci, 0.85), 30);
  /* skor sempurna 6 koin tidak melebihi batas server */
  const sempurna = C.arkCapitSusun(9).map((x) => C.arkCapitNilai(x, 1)).sort((a, c) => c - a).slice(0, A.CAPIT.koin).reduce((s, n) => s + n, 0);
  assert.ok(sempurna <= A.skorBatas('capit', 75));
  assert.ok(A.capitHadiah(3 * 20, 3), '3 boneka termurah tanpa bonus sudah berhak hadiah');
});

test('balap: selalu ada jalur bebas, jeda mengecil sampai batas refleks, tabrakan + laju pulih, skor <= batas server', () => {
  for (const benih of [1, 99, 20261126]) {
    let lalu = 9;
    for (let i = 0; i < 200; i++) {
      const b = C.arkBalapBaris(benih, i), n = b.tutup.filter(Boolean).length;
      assert.equal(b.tutup.length, 3); assert.ok(n === 1 || n === 2, 'tidak pernah menutup semua jalur');
      if (i < 4) assert.equal(n, 1, 'empat baris pertama ringan');
      assert.ok(b.jeda <= lalu && b.jeda >= C.ARK_BALAP_MAIN.jedaAkhir); lalu = b.jeda;
      assert.ok(b.jeda >= C.ARK_BALAP_MAIN.pindah * 2 + 0.25, 'cukup waktu pindah dua jalur');
      assert.deepEqual(C.arkBalapBaris(benih, i), b, 'deterministik');
    }
  }
  assert.equal(C.arkBalapKena(1, 1, 0), true); assert.equal(C.arkBalapKena(1, 2, 0), false); assert.equal(C.arkBalapKena(1.5, 2, 0), true, 'sedang pindah jalur masih bisa kena');
  assert.equal(C.arkBalapKena(1, 1, C.ARK_BALAP_MAIN.panjang), false, 'sudah lewat satu badan mobil');
  assert.equal(C.arkBalapLajuNyata(10, 99), A.balapLaju(10));
  assert.ok(Math.abs(C.arkBalapLajuNyata(10, 0) - A.balapLaju(10) * C.ARK_BALAP_MAIN.anjlok) < 1e-9);
  /* ADIL: pemain yang pindah begitu lolos dari baris lama (pindah 0,12 dtk/jalur + reaksi 0,15 dtk) selesai 60 dtk tanpa
     tabrakan di semua benih — celah antar-baris selalu cukup (dulu jarak baris < dua panjang tabrak = mustahil dihindari) */
  const M = C.ARK_BALAP_MAIN, zona = M.panjang * 0.86;
  assert.ok(C.arkBalapJarakBaris(M.jedaAkhir, A.balapLaju(0)) > 2 * zona, 'zona tabrak dua baris tidak pernah bertumpuk');
  for (const benih of [1, 2, 3, 99, 4242, 20261126, 0xdeadbeef]) {
    let t = 0, rel = 0, pos = 1, jalur = 1, n = 0, sNext = 46, tabrak = 0, tunda = 0, niat = 1; const baris = [], dt = 1 / 120;
    while (t < A.BALAP.detik) {
      t += dt; const v = A.balapLaju(t); rel += v * (1 - M.lalu) * dt;
      while (sNext - rel < 64) { baris.push({ s: sNext, tutup: C.arkBalapBaris(benih, n).tutup }); n += 1; sNext += C.arkBalapJarakBaris(C.arkBalapBaris(benih, n).jeda, v); }
      const depan = baris.filter((r) => r.s - rel > -zona)[0];
      if (depan) { const bebas = [0, 1, 2].filter((l) => !depan.tutup[l]).sort((a, c) => Math.abs(a - jalur) - Math.abs(c - jalur))[0]; if (bebas !== niat) { niat = bebas; tunda = 0.15; } }
      if (tunda > 0) tunda -= dt; else jalur = niat;
      const d = jalur - pos, langkah = dt / M.pindah; pos = Math.abs(d) <= langkah ? jalur : pos + Math.sign(d) * langkah;
      for (const r of baris) for (let l = 0; l < 3; l++) if (r.tutup[l] && !r.kena && C.arkBalapKena(pos, l, r.s - rel)) { r.kena = true; tabrak += 1; }
    }
    assert.equal(tabrak, 0, 'benih ' + benih + ': ' + tabrak + ' tabrakan tak terhindarkan');
    assert.ok(n > 45 && n < 80, 'jumlah baris wajar: ' + n);
  }
  /* simulasi 60 dtk tanpa tabrakan dan dengan tabrakan: jarak tidak pernah melampaui batas server untuk waktu itu */
  for (const tabrakTiap of [0, 7]) {
    let t = 0, jarak = 0, sejak = 99; const dt = 1 / 60;
    while (t < A.BALAP.detik) { t += dt; sejak += dt; if (tabrakTiap && Math.floor(t / tabrakTiap) !== Math.floor((t - dt) / tabrakTiap)) sejak = 0; jarak += C.arkBalapLajuNyata(t, sejak) * dt; assert.ok(Math.floor(jarak) <= A.skorBatas('balap', t), 'jarak <= batas di detik ' + t.toFixed(2)); }
    if (!tabrakTiap) assert.ok(Math.abs(jarak - 2580) < 2, 'main sempurna 60 dtk = 2.580 m');
  }
});

test('dansa: main sempurna = DANSA_MAKS server, kombo + pengali, lewat memutus kombo, cari not hanya di jalurnya dan dalam jendela', () => {
  const peta = C.arkDansaPeta();
  assert.equal(peta.length, 84);
  assert.ok(peta.every((n) => n.k >= A.DANSA.mulai && n.k < A.DANSA.akhir && n.j >= 0 && n.j <= 3));
  assert.ok(C.arkDansaDetik(A.DANSA.ketuk) === 45, 'lagu 96 ketuk @128 BPM = 45 detik tepat');
  assert.ok(C.arkDansaDetik(A.DANSA.akhir) + A.DANSA.jendela[2] < 45, 'not terakhir selesai sebelum lagu habis');
  for (let i = 0; i < peta.length; i++) for (let j = i + 1; j < peta.length; j++) if (peta[i].j === peta[j].j) assert.ok(C.arkDansaDetik(peta[j].k - peta[i].k) > 2 * A.DANSA.jendela[2], 'jendela dua not sejalur tidak tumpang tindih');
  for (let i = 1; i < peta.length; i++) assert.ok(peta[i].k > peta[i - 1].k, 'tidak ada dua not bersamaan');
  const st = C.arkDansaBaru(), kena = [];
  peta.forEach((n, i) => { const t = C.arkDansaDetik(n.k) + 0.01, c = C.arkDansaCari(peta, kena, n.j, t); assert.equal(c, i); kena[c] = 1; C.arkDansaKena(st, C.arkDansaNilai(C.arkDansaDetik(n.k) - t)); });
  assert.equal(st.skor, A.DANSA_MAKS); assert.equal(st.komboMaks, 84); assert.deepEqual(st.mutu, [84, 0, 0]); assert.equal(st.lewat, 0);
  const s2 = C.arkDansaBaru();
  assert.equal(C.arkDansaKena(s2, 0), 100); assert.equal(C.arkDansaKena(s2, 1), 60); assert.equal(C.arkDansaKena(s2, 2), 30);
  for (let i = 0; i < 7; i++) C.arkDansaKena(s2, 0);
  assert.equal(s2.kombo, 10); assert.equal(C.arkDansaKena(s2, 0), 110, 'kombo 11 = x1,1');
  assert.equal(C.arkDansaKena(s2, -1), 0); assert.equal(s2.kombo, 0); assert.equal(s2.lewat, 1); assert.equal(s2.komboMaks, 11);
  assert.equal(C.arkDansaKena(s2, 0), 100, 'sesudah putus pengali kembali x1');
  const n0 = peta[0], t0 = C.arkDansaDetik(n0.k);
  assert.equal(C.arkDansaCari(peta, [], (n0.j + 1) % 4, t0), -1, 'jalur lain tidak kena');
  assert.equal(C.arkDansaCari(peta, [], n0.j, t0 - 0.2), -1, 'terlalu cepat'); assert.equal(C.arkDansaCari(peta, [], n0.j, t0 + 0.2), -1, 'terlalu telat');
  assert.equal(C.arkDansaCari(peta, [1], n0.j, t0), -1, 'not yang sudah kena tidak dihitung dua kali');
  /* ngawur menekan semua jalur terus-menerus tidak bisa melampaui batas server */
  const s3 = C.arkDansaBaru(), k3 = [];
  for (let t = 0; t < 45; t += 0.05) for (let j = 0; j < 4; j++) { const c = C.arkDansaCari(peta, k3, j, t); if (c >= 0) { k3[c] = 1; C.arkDansaKena(s3, C.arkDansaNilai(C.arkDansaDetik(peta[c].k) - t)); } }
  assert.ok(s3.skor <= A.DANSA_MAKS);
  assert.equal(C.arkNamaTampil('budi santoso'), 'Budi Santoso'); assert.equal(C.arkNamaTampil('<b>x</b>'), '<b>x</b>', 'nama ditampilkan lewat textContent, tidak diubah jadi HTML');
});

/* ---------- endpoint /api/skor ---------- */
test('skor: tamu boleh lihat papan, tapi mulai/kirim butuh sesi penghuni (401); aksi/game/tiket aneh ditolak', async () => {
  const S = siapkan();
  const p = await S.app.skor(post({ aksi: 'papan' }));
  assert.equal(p.status, 200); assert.deepEqual(p.body, { minggu: '2026-11-23', sisaDetik: A.mingguSisaDetik(S.jam), papan: { capit: [], balap: [], dansa: [] } });
  assert.equal((await S.app.skor(post({ aksi: 'mulai', game: 'capit' }))).status, 401);
  assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: 'capit.' + S.jam + '.' + '0'.repeat(32), skor: 10 }))).status, 401);
  const tok = await login(S, 'rina', '246810');
  for (const badan of [{}, { aksi: 'hapus' }, { aksi: 'mulai' }, { aksi: 'mulai', game: 'catur' }, { aksi: 'mulai', game: '__proto__' }, { aksi: 'mulai', game: 'toString' },
    { aksi: 'kirim', skor: 10 }, { aksi: 'kirim', tiket: 'x', skor: 10 }, { aksi: 'kirim', tiket: 12, skor: 10 }, { aksi: 'kirim', tiket: 'capit.' + S.jam + '.' + 'g'.repeat(32), skor: 10 }]) {
    assert.equal((await S.app.skor(post(badan, tok))).status, 400, JSON.stringify(badan));
  }
  const m = await S.app.skor(post({ aksi: 'mulai', game: 'balap' }, tok));
  S.maju(30);
  for (const skor of [-1, 1.5, '100', null, undefined, 1e9, NaN]) assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: m.body.tiket, skor }, tok))).status, 400, String(skor));
  assert.equal(S.db._t.skor.size, 0, 'tidak ada yang tersimpan dari permintaan yang ditolak');
});

test('skor: mulai -> kirim; terlalu cepat 409, kedaluwarsa 409, skor dijepit, hanya yang terbaik tersimpan, papan terurut', async () => {
  const S = siapkan();
  const rina = await login(S, 'rina', '246810'), bagas = await login(S, 'bagas', '135790'), tya = await login(S, 'tya', '112233');
  let r = await main(S, rina, 'balap', 3, 500);
  assert.equal(r.status, 409); assert.equal(r.body.galat, 'terlalu_cepat');
  r = await main(S, rina, 'balap', 241, 500);
  assert.equal(r.status, 409); assert.equal(r.body.galat, 'kedaluwarsa');
  r = await main(S, rina, 'dansa', 39, 5000);
  assert.equal(r.status, 409, 'dansa butuh 40 dtk (lagunya 45 dtk)');
  assert.equal(S.db._t.skor.size, 0);
  r = await main(S, rina, 'balap', 30, 900);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ game: r.body.game, skor: r.body.skor, terbaik: r.body.terbaik, rekor: r.body.rekor, hadiah: r.body.hadiah, minggu: r.body.minggu }, { game: 'balap', skor: 900, terbaik: 900, rekor: true, hadiah: null, minggu: '2026-11-23' });
  assert.deepEqual(r.body.papan.balap, [{ nama: 'rina', skor: 900 }]);
  r = await main(S, rina, 'balap', 30, 400);
  assert.deepEqual([r.body.skor, r.body.terbaik, r.body.rekor], [400, 900, false], 'skor lebih rendah tidak menggantikan');
  r = await main(S, rina, 'balap', 20, 999999);
  assert.equal(r.body.skor, A.skorBatas('balap', 20), 'skor palsu dijepit ke batas 20 detik');
  assert.ok(r.body.skor < 900 && r.body.terbaik === 900);
  /* penghuni Gedung F (kamar 60) dan E (41): rentang kamar baru wajib jalan (pelajaran bug E/F) */
  r = await main(S, bagas, 'balap', 60, 2400);
  assert.equal(r.status, 200); assert.equal(r.body.skor, 2400);
  r = await main(S, tya, 'balap', 45, 900);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.papan.balap, [{ nama: 'bagas', skor: 2400 }, { nama: 'rina', skor: 900 }, { nama: 'tya', skor: 900 }], 'seri: yang lebih dulu mencapai di atas');
  r = await main(S, bagas, 'dansa', 46, 20000);
  assert.equal(r.body.skor, A.DANSA_MAKS);
  r = await main(S, tya, 'capit', 12, 9999);
  assert.equal(r.body.skor, 240, '12 detik = paling banyak 4 koin x 60');
  const baris = [...S.db._t.skor.values()];
  assert.equal(baris.length, 5); assert.ok(baris.every((b) => b.room >= 1 && b.room <= 60 && b.minggu === '2026-11-23'));
  assert.equal(baris.find((b) => b.nama_norm === 'rina' && b.game === 'balap').main, 3, 'jumlah main dihitung');
  /* yang keluar ke klien hanya nama + skor */
  const p = await S.app.skor(post({ aksi: 'papan' }));
  for (const g of Object.keys(p.body.papan)) for (const x of p.body.papan[g]) assert.deepEqual(Object.keys(x).sort(), ['nama', 'skor']);
  assert.ok(!JSON.stringify(p.body).includes('room'));
});

test('skor: tiket tidak bisa dipalsukan / dipinjam / diubah game atau waktunya', async () => {
  const S = siapkan();
  const rina = await login(S, 'rina', '246810'), bagas = await login(S, 'bagas', '135790');
  const m = await S.app.skor(post({ aksi: 'mulai', game: 'balap' }, rina));
  assert.match(m.body.tiket, /^balap\.\d{13}\.[0-9a-f]{32}$/); assert.equal(m.body.minDetik, 5);
  S.maju(60);
  const [g, mulai, mac] = m.body.tiket.split('.');
  assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: m.body.tiket, skor: 100 }, bagas))).status, 400, 'tiket orang lain');
  assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: ['dansa', mulai, mac].join('.'), skor: 100 }, rina))).status, 400, 'game diganti');
  assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: [g, String(+mulai - 30000), mac].join('.'), skor: 100 }, rina))).status, 400, 'waktu mulai dimundurkan');
  assert.equal((await S.app.skor(post({ aksi: 'kirim', tiket: [g, mulai, crypto.createHash('sha256').update(mulai).digest('hex').slice(0, 32)].join('.'), skor: 100 }, rina))).status, 400, 'mac karangan');
  assert.equal(S.db._t.skor.size, 0);
  const ok = await S.app.skor(post({ aksi: 'kirim', tiket: m.body.tiket, skor: 100 }, rina));
  assert.equal(ok.status, 200);
  /* tiket yang sama dikirim ulang dengan angka lebih besar: tetap dijepit, tidak menambah apa pun selain "terbaik" */
  const lagi = await S.app.skor(post({ aksi: 'kirim', tiket: m.body.tiket, skor: 5000 }, rina));
  assert.equal(lagi.body.skor, A.skorBatas('balap', 60));
  /* aplikasi dengan rahasia lain menolak tiket ini */
  const lain = buatApp({ db: S.db, rahasia: 'lain-'.repeat(8), sekarang: () => S.jam });
  const tokLain = (await lain.masuk(post({ username: 'rina', pin: '246810', ingat: true }))).cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
  assert.equal((await lain.skor(post({ aksi: 'kirim', tiket: m.body.tiket, skor: 100 }, tokLain))).status, 400);
});

test('hadiah: boneka beruang sekali per penghuni (capit >= 3 boneka), muncul di dompet, TIDAK bisa dibeli, tanpa uang', async () => {
  const S = siapkan();
  const rina = await login(S, 'rina', '246810'), bagas = await login(S, 'bagas', '135790');
  assert.equal(K.barangDari(A.HADIAH.barang), null, 'boneka bukan barang katalog');
  let r = await main(S, rina, 'capit', 40, 100, 2);
  assert.equal(r.body.hadiah, null, '2 boneka belum cukup');
  r = await main(S, rina, 'capit', 40, 100);
  assert.equal(r.body.hadiah, null, 'tanpa jumlah boneka = tanpa hadiah');
  r = await main(S, rina, 'capit', 5, 9999, 6);
  assert.equal(r.status, 409, 'terlalu cepat: tidak ada hadiah');
  r = await main(S, rina, 'balap', 40, 900, 6);
  assert.equal(r.body.hadiah, null, 'hadiah hanya dari capit');
  r = await main(S, rina, 'capit', 40, 110, 3);
  assert.equal(r.body.hadiah, 'boneka_capit');
  r = await main(S, rina, 'capit', 40, 200, 5);
  assert.equal(r.body.hadiah, null, 'kedua kali: sudah punya');
  r = await main(S, bagas, 'capit', 40, 90, 3); /* kamar 60 */
  assert.equal(r.body.hadiah, 'boneka_capit');
  assert.deepEqual([...S.db._t.barang.get('3|rina')], ['boneka_capit']);
  const d = await S.app.dompet(get(rina));
  assert.equal(d.status, 200); assert.deepEqual(d.body.barang, ['boneka_capit']); assert.equal(d.body.saldo, 0, 'tidak ada uang dari arkade');
  assert.equal(S.db._t.mutasi.length, 0, 'tidak ada mutasi dompet');
  const beli = await S.app.belanja(post({ aksi: 'beli', barang: 'boneka_capit' }, rina));
  assert.equal(beli.status, 400, 'boneka tidak dijual');
});

test('skor: CSRF ditolak; batas laju per kamar (skor) dan per jaringan (papan)', async () => {
  const S = siapkan();
  const rina = await login(S, 'rina', '246810');
  const jahat = { method: 'POST', headers: Object.assign({}, H, { origin: 'https://jahat.test', cookie: '__Host-kosan_sesi=' + rina }), body: { aksi: 'mulai', game: 'capit' }, ip: '36.80.1.23' };
  assert.equal((await S.app.skor(jahat)).status, 403);
  assert.equal((await S.app.skor({ method: 'POST', headers: Object.assign({}, H, { 'content-type': 'text/plain', cookie: '__Host-kosan_sesi=' + rina }), body: { aksi: 'mulai', game: 'capit' }, ip: '36.80.1.23' })).status, 415);
  let terakhir = 200, n = 0;
  for (let i = 0; i < 260 && terakhir === 200; i++) { terakhir = (await S.app.skor(post({ aksi: 'mulai', game: 'capit' }, rina))).status; if (terakhir === 200) n += 1; }
  assert.equal(terakhir, 429); assert.equal(n, 240, 'BATAS_PENGHUNI.skor per jam');
  terakhir = 200; n = 0;
  for (let i = 0; i < 260 && terakhir === 200; i++) { terakhir = (await S.app.skor(post({ aksi: 'papan' }, null, '103.10.10.10'))).status; if (terakhir === 200) n += 1; }
  assert.equal(terakhir, 429); assert.equal(n, 240, 'BATAS.papan per jaringan per jam');
});

test('papan mingguan: minggu baru = papan kosong lagi, skor minggu lalu tetap tersimpan; paling banyak 5 per game', async () => {
  const S = siapkan();
  const rina = await login(S, 'rina', '246810');
  await main(S, rina, 'dansa', 46, 7000);
  for (let i = 0; i < 7; i++) await S.db.skorKirim({ room: 10 + i, nama: 'uji ' + i, game: 'dansa', minggu: '2026-11-23', skor: 1000 + i * 100, hadiah: null });
  await S.db.skorKirim({ room: 20, nama: 'nol', game: 'dansa', minggu: '2026-11-23', skor: 0, hadiah: null });
  let p = await S.app.skor(post({ aksi: 'papan' }));
  assert.deepEqual(p.body.papan.dansa.map((x) => x.skor), [7000, 1600, 1500, 1400, 1300], '5 teratas, skor 0 tidak tampil');
  S.jam = Date.parse('2026-11-29T17:00:01Z'); /* Senin 30 Nov 00.00 WIB */
  p = await S.app.skor(post({ aksi: 'papan' }));
  assert.equal(p.body.minggu, '2026-11-30'); assert.deepEqual(p.body.papan, { capit: [], balap: [], dansa: [] });
  assert.equal([...S.db._t.skor.values()].filter((b) => b.minggu === '2026-11-23').length, 9);
});

test('db.js: RPC skor memakai nama + argumen p_*, input diperiksa sebelum dikirim', async () => {
  const log = [];
  const fetchFn = async (url, o) => { log.push({ url, body: o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 200, text: async () => '[]' }; };
  const db = buatDb({ url: 'https://x.supabase.co', kunci: 'eyJ.service', fetchFn });
  await db.skorKirim({ room: 60, nama: 'bagas', game: 'capit', minggu: '2026-11-23', skor: 120, hadiah: 'boneka_capit' });
  await db.skorKirim({ room: 3, nama: 'rina', game: 'balap', minggu: '2026-11-23', skor: 900, hadiah: null });
  await db.skorPapan({ minggu: '2026-11-23', batas: 5 });
  assert.deepEqual(log.map((l) => l.url.split('/rpc/')[1]), ['kosan_skor_kirim', 'kosan_skor_kirim', 'kosan_skor_papan']);
  assert.deepEqual(log[0].body, { p_room: 60, p_nama: 'bagas', p_game: 'capit', p_minggu: '2026-11-23', p_skor: 120, p_hadiah: 'boneka_capit' });
  assert.equal(log[1].body.p_hadiah, null);
  assert.deepEqual(log[2].body, { p_minggu: '2026-11-23', p_batas: 5 });
  await assert.rejects(() => db.skorKirim({ room: 3, nama: 'rina', game: 'capit; drop', minggu: '2026-11-23', skor: 1, hadiah: null }));
  await assert.rejects(() => db.skorKirim({ room: 3, nama: 'rina', game: 'capit', minggu: '23-11-2026', skor: 1, hadiah: null }));
  await assert.rejects(() => db.skorKirim({ room: 3, nama: 'rina', game: 'capit', minggu: '2026-11-23', skor: -5, hadiah: null }));
  assert.equal(log.length, 3, 'masukan buruk tidak pernah sampai ke jaringan');
});

test('migrasi arkade_skor: hanya menambah, room 1..60 di SEMUA tempat, RLS tanpa policy, hanya service_role, search_path kosong', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261126_arkade_skor.sql'), 'utf8');
  const kode = sql.replace(/--.*$/gm, '');
  assert.deepEqual([...kode.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]), ['kosan_skor']);
  assert.match(kode, /alter table public\.kosan_skor enable row level security/);
  assert.doesNotMatch(kode, /create policy/i, 'tanpa policy = anon/authenticated tidak bisa apa-apa');
  assert.match(kode, /revoke all on table public\.kosan_skor from public, anon, authenticated/);
  assert.match(kode, /check \(room between 1 and 60\)/); assert.match(kode, /p_room < 1 or p_room > 60/);
  /* tidak ada angka batas kamar selain 60 (pelajaran bug E/F: 40 tertinggal di 6 tabel) */
  assert.deepEqual([...new Set([...kode.matchAll(/room[^;\n]*?(?:between 1 and|>) (\d+)/g)].map((m) => m[1]))], ['60']);
  assert.doesNotMatch(kode, /\b40\b/);
  assert.match(kode, /check \(game in \('capit', 'balap', 'dansa'\)\)/); assert.deepEqual(A.GAME_ID, ['capit', 'balap', 'dansa']);
  assert.match(kode, /check \(skor between 0 and 100000\)/);
  const fungsi = [...kode.matchAll(/create or replace function public\.(kosan_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fungsi, ['kosan_skor_kirim', 'kosan_skor_papan']);
  for (const f of fungsi) {
    assert.match(kode, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon, authenticated'), f);
    assert.match(kode, new RegExp('grant execute on function public\\.' + f + '\\([^)]*\\) to service_role'), f);
  }
  assert.equal((kode.match(/security definer set search_path = ''/g) || []).length, 2);
  assert.doesNotMatch(kode, /\b(drop|truncate|alter table public\.(?!kosan_skor)|delete from|update public\.(?!kosan_skor))/i, 'tidak mengubah/menghapus tabel lain');
  assert.doesNotMatch(kode, /kosan_dompet|kosan_mutasi|saldo/, 'tidak menyentuh uang');
  assert.match(kode, /insert into public\.kosan_barang \(room, nama_norm, barang\) values \(p_room, p_nama, p_hadiah\) on conflict do nothing/);
  assert.match(kode, /greatest\(public\.kosan_skor\.skor, excluded\.skor\)/, 'hanya skor terbaik');
  assert.match(sql, /20261124_kerja_ef_room60\.sql/, 'prasyarat kosan_barang room 1..60 dicatat');
  assert.match(kode.trim(), /^begin;[\s\S]*commit;$/);
  assert.equal(fs.readFileSync(path.join(ROOT, 'api', 'skor.js'), 'utf8').includes("jalankan('skor', 'POST')"), true);
  assert.ok(fs.readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js')).length <= 12, 'batas 12 fungsi Vercel Hobby');
});

/* ---------- kabel ke index.html ---------- */
test('kabel klien: mesin membuka game, 3D dijeda, lagu = file (bukan sintesis), bunyi terdefinisi, id unik, skor lewat apiKosan', () => {
  const ketuk = antara('function kotaKetukRuang(id) {', '\nfunction kotaRuangTick');
  for (const [id, g] of [['capitDalam', 'capit'], ['balap', 'balap'], ['dansa', 'dansa']]) assert.match(ketuk, new RegExp("id === '" + id + "'\\) \\{[^}]*arkadeBuka\\('" + g + "'\\)"), id);
  assert.match(ketuk, /Math\.hypot\(avatarPos\.x - o\.x, avatarPos\.z - o\.z\) > o\.jarak/, 'tetap harus mendekat dulu');
  assert.ok(ketuk.indexOf('o.jarak') < ketuk.indexOf('arkadeBuka'), 'cek jarak sebelum membuka game');
  assert.match(HTML, /function animate\(\) \{\n  requestAnimationFrame\(animate\);\n  if \(ARK\.aktif\) \{ clock\.getDelta\(\); return; \}/, '3D tidak digambar selama layar arkade terbuka');
  /* lagu: file MP3 pra-render lewat pemuat bersama; tidak ada osilator/penjadwalan nada musik di blok arkade */
  assert.match(UI, /var ARK_MUSIK_FILE = 'assets\/musik\/arkade\.mp3';/);
  assert.match(UI, /musikAmbil\(ARK_MUSIK_FILE\)/); assert.match(UI, /createBufferSource\(\)/); assert.match(UI, /g\.connect\(SUARA\.musik\)/, 'ikut sakelar Musik');
  assert.match(UI, /!SUARA\.setel\.musik/);
  assert.doesNotMatch(UI, /createOscillator|setInterval|new Audio\(/, 'tanpa sintesis/penjadwalan live di blok arkade (efek lewat BUNYI)');
  assert.doesNotMatch(UI, /fetch\(|XMLHttpRequest|sbRpc\(|localStorage\.setItem\('(?!kosan3d-arkade')/);
  assert.equal(HTML.split('fetch(').length - 1, 4, 'jumlah fetch( tidak bertambah');
  assert.equal((HTML.match(/function musikAmbil\(url\)/g) || []).length, 1);
  const mp3 = fs.statSync(path.join(ROOT, 'assets', 'musik', 'arkade.mp3'));
  assert.ok(mp3.size > 200000 && mp3.size < 800000, 'lagu arkade ' + mp3.size + ' byte');
  const kepala = fs.readFileSync(path.join(ROOT, 'assets', 'musik', 'arkade.mp3')).subarray(0, 3);
  assert.ok(kepala.toString('latin1') === 'ID3' || (kepala[0] === 0xff && (kepala[1] & 0xe0) === 0xe0), 'berkas MP3');
  /* semua bunyi('ark...') yang dipanggil punya definisi; semua yang didefinisikan dipakai */
  const dipanggil = new Set([...UI.matchAll(/bunyi\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1])));
  const didefinisikan = new Set([...HTML.matchAll(/BUNYI\.(\w+) = function/g)].map((m) => m[1]).concat([...antara('var BUNYI = {', '\nfunction bunyi(').matchAll(/^\s{2}(\w+): function/gm)].map((m) => m[1])));
  assert.ok(dipanggil.size >= 10);
  for (const b of dipanggil) assert.ok(didefinisikan.has(b), 'bunyi ' + b + ' terdefinisi');
  for (const b of [...UI.matchAll(/BUNYI\.(ark\w+) = function/g)].map((m) => m[1])) assert.ok(dipanggil.has(b), 'bunyi ' + b + ' dipakai');
  /* id elemen unik di seluruh dokumen (pelajaran Tetris "br" dobel) */
  const ids = [...HTML.slice(0, HTML.indexOf('<script type="module">')).matchAll(/<[a-zA-Z][^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  const dobel = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dobel, [], 'id dobel');
  for (const id of ['arkade', 'arkKanvas', 'arkAtas', 'arkMerek', 'arkJudul', 'arkKeluar', 'arkGugusKiri', 'arkGugusKanan', 'arkPanel']) assert.equal(ids.filter((x) => x === id).length, 1, id);
  assert.doesNotMatch(UI, /\.id = |setAttribute\('id'/, 'tombol dinamis tanpa id');
  /* skor: tiket saat mulai, kirim saat selesai, hanya penghuni; tamu = lokal */
  assert.match(UI, /apiKosan\('POST', '\/api\/skor', \{ aksi: 'mulai', game: game \}\)/);
  assert.match(UI, /\{ aksi: 'kirim', tiket: tk, skor: skor \}/); assert.match(UI, /apiKosan\('POST', '\/api\/skor', \{ aksi: 'papan' \}\)/);
  assert.match(UI, /ARK\.tiket = arkPenghuni\(\) \? /); assert.match(UI, /if \(!penghuni\) \{ arkPapanMuat\(false\)\.then\(segar\); return; \}/);
  assert.match(UI, /localStorage\.setItem\('kosan3d-arkade'/);
  /* data dari server (nama penghuni) hanya lewat textContent: innerHTML hanya untuk teks tetap */
  const inner = [...UI.matchAll(/(\w+)\.innerHTML = ([^;]+);/g)].map((m) => m[2]);
  assert.deepEqual(inner.sort(), ['I.cara', 'b.svg']);
  assert.match(antara('function dekorTerapkan() {', '\nfunction dekorPadatKamar'), /bonekaTerapkan\(\);/);
  assert.doesNotMatch(antara('var DEKOR_IDS = [', '];'), /boneka/, 'boneka hadiah tidak masuk daftar barang toko');
  assert.doesNotMatch(antara('/* ==== KERJA-START ==== */', '/* ==== KERJA-END ==== */'), /boneka_capit/);
});

test('layar LED plaza TIDAK disentuh (Ryan 26 Nov 16:29): blok LED + semua baris LED identik produksi', () => {
  const a = HTML.indexOf('var KOTA_LED_KANVAS = null'), b = HTML.indexOf('\n', HTML.indexOf('function kotaLedBerikut()', a));
  assert.ok(a > 0 && b > a);
  const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
  assert.equal(b - a > 9000, true);
  assert.equal(h(HTML.slice(a, b)), 'd27ae60266b75fc56a5417c6b52e41e4c08dd3beeb1d57f8a078211a5694fda5', 'blok kotaLed* (kanvas, acara, tick, lukis)');
  assert.equal(h(HTML.split('\n').filter((l) => /KOTA_LED|kotaLed/.test(l)).join('\n')), '589b27ad08bef161293e70ac0ce8ee53e4e751c6dd222ef2def414fd4783adfa', 'semua baris yang menyebut LED');
  assert.doesNotMatch(UI + ATURAN, /KOTA_LED|kotaLed|\bled\b/i, 'blok arkade tidak menyebut LED sama sekali');
});
