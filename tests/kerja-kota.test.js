'use strict';
/* Tes Kerja di Kota (27 Nov): aturan murni (api/_lib/kerjakota.js = blok KERJA-KOTA index.html), alur /api/kerja untuk
   barista / resepsionis / pramuniaga dengan database palsu, anti-curang, batas, kamar 41–60, tamu ditolak,
   kabel klien, dan pemeriksaan statis migrasi. Tanpa jaringan. Jalankan: node --test tests/kerja-kota.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../api/_lib/kerja');
const KK = require('../api/_lib/kerjakota');
const { buatApp } = require('../api/_lib/app');
const { buatFakeDb } = require('./fake-db');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const RAHASIA = 'uji-'.repeat(10);
const PENGHUNI = [
  { room: 3, name: 'rina', gender: 'Cewek', pin: '246810' },
  { room: 41, name: 'tya', gender: 'Cewek', pin: '112233' },
  { room: 60, name: 'bagas', gender: 'Cowok', pin: '135790' }
];
const H = { 'content-type': 'application/json', host: 'kosan.test', origin: 'https://kosan.test', 'sec-fetch-site': 'same-origin' };
const post = (body, token) => ({ method: 'POST', headers: Object.assign({}, H, token ? { cookie: '__Host-kosan_sesi=' + token } : {}), body, ip: '36.80.1.23' });
const get = (token) => ({ method: 'GET', headers: token ? { cookie: '__Host-kosan_sesi=' + token } : {}, ip: '36.80.1.23' });
const IDS = ['barista', 'resepsionis', 'pramuniaga'];

function siapkan() {
  let jam = Date.parse('2026-11-27T03:00:00Z'); /* 10.00 WIB */
  const db = buatFakeDb({ penghuni: PENGHUNI, sekarang: () => jam });
  const app = buatApp({ db, rahasia: RAHASIA, sekarang: () => jam });
  return { db, app, majukan: (ms) => { jam += ms; } };
}
async function login(app, username, pin) {
  const r = await app.masuk(post({ username, pin, ingat: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookies.find((c) => c.startsWith('__Host-kosan_sesi=')).split(';')[0].split('=')[1];
}
/* jawaban sempurna satu soal + waktu cekatan */
const jawabBenar = (id, s) => (id === 'barista' ? s.resep + '|' + Math.round(s.zona * 1000) : (id === 'resepsionis' ? s.no + '|' + s.total : s.gaya));
const msCepat = (id, pk) => KK.kkCepatMs(id, pk) - 300;
async function mulai(S, tok, id) {
  const d = await S.app.kerja(post({ aksi: 'daftar', pekerjaan: id }, tok)); assert.equal(d.status, 200, JSON.stringify(d.body));
  const m = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: id }, tok)); assert.equal(m.status, 200, JSON.stringify(m.body));
  return m.body;
}

/* ---------- aturan murni ---------- */
test('blok KERJA-KOTA di index.html SAMA PERSIS dengan api/_lib/kerjakota.js', () => {
  const ambil = (s) => { const a = s.indexOf('/* ==== KERJA-KOTA-START ==== */'), b = s.indexOf('/* ==== KERJA-KOTA-END ==== */'); assert.ok(a >= 0 && b > a); return s.slice(a, b); };
  assert.equal(ambil(HTML), ambil(fs.readFileSync(path.join(ROOT, 'api/_lib/kerjakota.js'), 'utf8')));
  assert.equal(HTML.split('/* ==== KERJA-KOTA-START ==== */').length, 2);
});
test('pekerjaan Kota: tiga id, tidak bentrok kampung, gaji ±1,5× kafe kampung, pangkat sama dengan kampung', () => {
  assert.deepEqual(KK.KK_IDS, IDS);
  for (const id of IDS) {
    assert.equal(K.pekerjaanDari(id), null); assert.match(id, /^[a-z0-9_]{2,30}$/);
    const p = KK.KK_PEKERJAAN[id];
    assert.deepEqual(p.gaji, K.PEKERJAAN.kafe.gaji.map((g) => g * 1.5)); assert.equal(p.tipMaks, K.PEKERJAAN.kafe.tipMaks * 1.5);
    assert.equal(p.pangkat.length, 3); assert.ok(('Gaji ' + p.nama + ' + tip').length <= 80);
    assert.ok(p.gaji[2] <= 20000 && p.tipMaks <= 20000 && p.gaji[2] + p.tipMaks <= 25000); /* batas SQL */
  }
  assert.deepEqual(KK.KK_PANGKAT_SHIFT, K.PANGKAT_SHIFT);
  for (const n of [0, 4, 5, 14, 15, 99]) assert.equal(KK.kkPangkat(n), K.pangkatDari(n));
  assert.equal(KK.kkPekerjaan('__proto__'), null); assert.equal(KK.kkPekerjaan('kafe'), null); assert.equal(KK.kkPekerjaan(null), null);
});
test('soal: deterministik per benih, beda benih beda soal, selalu punya tepat satu jawaban sempurna', () => {
  for (const id of IDS) for (const pk of [0, 1, 2]) {
    assert.deepEqual(KK.kkSoal(id, 12345, pk), KK.kkSoal(id, 12345, pk));
    assert.notDeepEqual(KK.kkSoal(id, 12345, pk), KK.kkSoal(id, 54321, pk));
    for (let b = 1; b <= 300; b++) {
      const soal = KK.kkSoal(id, b * 7919, pk); assert.equal(soal.length, 10);
      for (const s of soal) {
        assert.equal(KK.kkNilaiSatu(id, s, jawabBenar(id, s)), 1);
        if (id === 'barista') { assert.ok(s.zona - s.setengah >= 0 && s.zona + s.setengah <= 1); assert.equal(s.resep.indexOf('ee') !== -1, s.dobel); }
        if (id === 'resepsionis') {
          const cocok = s.kamar.filter((k) => k.tipe === s.tipe && k.lantai === s.lantai && k.status === 'kosong');
          assert.equal(cocok.length, 1); assert.equal(cocok[0].no, s.no); /* tepat satu kamar benar */
          assert.ok(s.kamar.some((k) => k.tipe === s.tipe && k.lantai !== s.lantai && k.status === 'kosong')); /* pengecoh lantai lain */
          assert.ok(s.kamar.some((k) => k.tipe !== s.tipe && k.lantai === s.lantai && k.status === 'kosong')); /* pengecoh tipe lain */
          assert.equal(new Set(s.harga).size, 3); assert.equal(s.harga.filter((x) => x === s.total).length, 1); assert.ok(s.harga.every((x) => x > 0));
          assert.equal(s.total, KK.KK_KAMAR_TIPE.find((t) => t.k === s.tipe).tarif * s.malam);
        }
        if (id === 'pramuniaga') assert.match(s.gaya, /^[0-5]{4}$/);
      }
    }
  }
});
test('nilai satu jawaban: sempurna / setengah / salah + bentuk aneh ditolak', () => {
  const b = KK.kkSoal('barista', 77, 0)[0], h = KK.kkSoal('resepsionis', 77, 0)[0], p = KK.kkSoal('pramuniaga', 77, 0)[0];
  const luar = Math.round((b.zona + b.setengah + 0.05 > 1 ? b.zona - b.setengah - 0.05 : b.zona + b.setengah + 0.05) * 1000);
  assert.equal(KK.kkNilaiSatu('barista', b, b.resep + '|' + luar), 0.5); /* urutan benar, takaran meleset */
  assert.equal(KK.kkNilaiSatu('barista', b, b.resep.slice(0, -1) + '|' + Math.round(b.zona * 1000)), 0); /* kurang satu lapis */
  assert.equal(KK.kkNilaiSatu('barista', b, b.resep + '|-5'), 0); assert.equal(KK.kkNilaiSatu('barista', b, b.resep), 0);
  const lain = h.harga.find((x) => x !== h.total), kamarLain = h.kamar.find((k) => k.no !== h.no).no;
  assert.equal(KK.kkNilaiSatu('resepsionis', h, h.no + '|' + lain), 0.5); assert.equal(KK.kkNilaiSatu('resepsionis', h, kamarLain + '|' + h.total), 0);
  const ganti = (g, i) => g.slice(0, i) + String((+g[i] + 1) % 6) + g.slice(i + 1);
  assert.equal(KK.kkNilaiSatu('pramuniaga', p, ganti(p.gaya, 2)), 0.5); assert.equal(KK.kkNilaiSatu('pramuniaga', p, ganti(ganti(p.gaya, 0), 3)), 0);
  for (const j of [null, undefined, 5, {}, [], '', 'x'.repeat(40)]) for (const [id, s] of [['barista', b], ['resepsionis', h], ['pramuniaga', p]]) assert.equal(KK.kkNilaiSatu(id, s, j), 0);
});
test('upah: diam = 25% gaji pokok, sempurna + cekatan = penuh (16.500 → 22.500), salah berulang memotong, tip hanya untuk yang teliti', () => {
  for (const id of IDS) {
    assert.deepEqual(KK.kkUpah(id, 0, { mutu: 0, cepat: 0, salah: 0 }), { gaji: 2500, tip: 0, total: 2500, pangkat: 0 });
    assert.deepEqual(KK.kkUpah(id, 0, { mutu: 1, cepat: 1, salah: 0 }), { gaji: 10500, tip: 6000, total: 16500, pangkat: 0 });
    assert.equal(KK.kkUpah(id, 5, { mutu: 1, cepat: 1, salah: 0 }).total, 19500);
    assert.equal(KK.kkUpah(id, 15, { mutu: 1, cepat: 1, salah: 0 }).total, 22500);
    assert.equal(KK.kkUpah(id, 0, { mutu: 0, cepat: 0, salah: 10 }).total, 1500); /* asal ketuk: di bawah yang diam */
    assert.equal(KK.kkUpah(id, 0, { mutu: 0.5, cepat: 1, salah: 0 }).tip, 0); /* di bawah 60% benar: tanpa tip */
    assert.equal(KK.kkUpah(id, 0, { mutu: 0.6, cepat: 1, salah: 4 }).tip, 0); /* 4 salah: tip hangus */
    assert.ok(KK.kkUpah(id, 0, { mutu: 1, cepat: 0, salah: 0 }).total < 16500); /* benar semua tapi lelet: tip kecil */
    assert.equal(KK.kkUpah(id, 0, { mutu: 99, cepat: 99, salah: -3 }).total, 16500); assert.equal(KK.kkUpah(id, 0, null).total, 2500);
    let lalu = -1; for (let m = 0; m <= 10; m++) { const u = KK.kkUpah(id, 0, { mutu: m / 10, cepat: m / 10, salah: 0 }).total; assert.ok(u >= lalu); assert.equal(u % 500, 0); lalu = u; }
  }
  assert.equal(KK.kkUpah('kafe', 0, { mutu: 1 }), null);
});
test('nilai shift: tamu tidak dilayani, kehabisan sabar, terlalu cepat untuk manusia, dan laporan mustahil', () => {
  const id = 'resepsionis', benih = 4242, soal = KK.kkSoal(id, benih, 0);
  const semua = soal.map((s) => [jawabBenar(id, s), msCepat(id, 0)]);
  let n = KK.kkNilai(id, benih, 0, semua, 80); assert.deepEqual([n.sempurna, n.salah, n.lewat, n.mutu, n.cepat, n.sah], [10, 0, 0, 1, 1, true]);
  n = KK.kkNilai(id, benih, 0, [], 200); assert.deepEqual([n.sempurna, n.lewat, n.mutu], [0, 10, 0]);
  n = KK.kkNilai(id, benih, 0, soal.map((s) => [jawabBenar(id, s), KK.KK_SABAR_MS[0] + 1]), 200); assert.equal(n.lewat, 10); /* lewat batas sabar = hangus */
  n = KK.kkNilai(id, benih, 0, soal.map((s) => [jawabBenar(id, s), 400]), 80); assert.deepEqual([n.sempurna, n.salah, n.mutu], [0, 10, 0]); /* 0,4 dtk per tamu: bukan manusia */
  n = KK.kkNilai(id, benih, 0, soal.map((s) => [jawabBenar(id, s), 9000]), 30); assert.deepEqual([n.sah, n.mutu, n.cepat], [false, 0, 0]); /* mengaku kerja 90 dtk padahal shift baru 30 dtk */
  n = KK.kkNilai(id, benih + 1, 0, semua, 80); assert.ok(n.mutu < 0.5); /* jawaban shift lain tidak berlaku */
  n = KK.kkNilai(id, benih, 0, soal.map((s) => [jawabBenar(id, s), KK.KK_SABAR_MS[0] - 100]), 200); assert.deepEqual([n.sempurna, n.cepat < 0.05], [10, true]); /* benar tapi lelet */
});

/* ---------- server ---------- */
test('server: shift penuh tiap pekerjaan Kota untuk kamar 41 dan 60 — gaji dihitung server, masuk dompet + riwayat', async () => {
  for (const [nama, pin, room] of [['tya', '112233', 41], ['bagas', '135790', 60]]) {
    const S = siapkan(), tok = await login(S.app, nama, pin); let saldo = 0;
    for (const id of IDS) {
      const m = await mulai(S, tok, id);
      assert.deepEqual(Object.keys(m).sort(), ['benih', 'minDetik', 'pangkat', 'pekerjaan', 'pesanan', 'shift']); assert.equal(m.pesanan, 10); assert.equal(m.minDetik, 70); assert.equal(m.pangkat, 0);
      assert.ok(Number.isInteger(m.benih) && m.benih >= 0 && m.benih <= 0xffffffff);
      const soal = KK.kkSoal(id, m.benih, m.pangkat);
      S.majukan(75000);
      const s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: soal.map((q) => [jawabBenar(id, q), msCepat(id, 0)]) }, tok));
      assert.equal(s.status, 200, JSON.stringify(s.body));
      assert.deepEqual([s.body.gaji, s.body.tip, s.body.pekerjaan, s.body.shift, s.body.pangkat, s.body.naikPangkat], [10500, 6000, id, 1, 0, false]);
      assert.deepEqual(s.body.nilai, { sempurna: 10, setengah: 0, salah: 0, lewat: 0, sah: true });
      saldo += 16500; assert.equal(s.body.saldo, saldo);
      S.majukan(11 * 60000);
    }
    const d = await S.app.dompet(get(tok)); assert.equal(d.status, 200);
    assert.equal(d.body.saldo, 49500); assert.equal(d.body.hariIni.shift, 3);
    assert.deepEqual(Object.keys(d.body.pekerjaan), ['kafe', 'warung', 'ronda', 'laundry']); /* bentuk lama tidak berubah */
    assert.deepEqual(d.body.pekerjaanKota, { barista: { terdaftar: true, shift: 1, pangkat: 0 }, resepsionis: { terdaftar: true, shift: 1, pangkat: 0 }, pramuniaga: { terdaftar: true, shift: 1, pangkat: 0 } });
    assert.deepEqual(d.body.riwayat.map((r) => r.ket), ['Gaji Pramuniaga Maison Luna + tip', 'Gaji Resepsionis Hotel Kencana + tip', 'Gaji Barista Kafe Bulan + tip']);
    assert.ok(S.db._t.shift.every((x) => x.room === room && x.status === 'selesai' && x.benar === 10 && x.salah === 0));
    /* jatah 3 shift gabungan habis: shift ke-4 (Kota maupun kampung) ditolak */
    for (const id of ['barista', 'kafe']) { await S.app.kerja(post({ aksi: 'daftar', pekerjaan: id }, tok)); const x = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: id }, tok)); assert.equal(x.status, 409); assert.equal(x.body.galat, 'batas_hari'); }
  }
});
test('server: klien tidak bisa memalsukan nilai — field hasil diabaikan, jawaban asal = gaji dasar terpotong, diam = gaji dasar', async () => {
  const S = siapkan(), tok = await login(S.app, 'tya', '112233');
  let m = await mulai(S, tok, 'barista'); S.majukan(75000);
  let s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, hasil: { benar: 10, salah: 0, cepat: 1 }, nilai: { mutu: 1, cepat: 1 }, gaji: 99999 }, tok)); /* tanpa jawaban */
  assert.deepEqual([s.status, s.body.gaji, s.body.tip], [200, 2500, 0]); assert.equal(s.body.nilai.lewat, 10);
  S.majukan(11 * 60000);
  m = await mulai(S, tok, 'resepsionis'); S.majukan(75000);
  s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: Array.from({ length: 10 }, () => ['101|900', 3000]) }, tok));
  assert.equal(s.status, 200); assert.ok(s.body.gaji + s.body.tip <= 3000, JSON.stringify(s.body)); assert.ok(s.body.nilai.salah >= 8);
  S.majukan(11 * 60000);
  /* bentuk jawaban aneh: tidak membuat server jatuh, dihitung tamu tidak dilayani */
  m = await mulai(S, tok, 'pramuniaga'); S.majukan(75000);
  s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: [null, 7, 'x', {}, [], ['0000'], ['0000', 'x'], ['0000', -1], [5, 5000], ['0000<', 5000], ['0'.repeat(30), 5000], ['0000', 1e9], ['1234', 5000, 1]] }, tok));
  assert.deepEqual([s.status, s.body.gaji, s.body.tip, s.body.nilai.lewat], [200, 2500, 0, 10]);
  assert.equal((await S.app.dompet(get(tok))).body.saldo, 2500 + s.body.gaji + (await S.db._t.shift)[1].gaji + (await S.db._t.shift)[1].tip);
});
test('server: jawaban sempurna tapi dikirim sebelum 70 detik = ditolak (terlalu_cepat), tanpa gaji; sesudahnya baru dibayar sekali', async () => {
  const S = siapkan(), tok = await login(S.app, 'bagas', '135790');
  const m = await mulai(S, tok, 'pramuniaga'), soal = KK.kkSoal('pramuniaga', m.benih, 0), jawab = soal.map((q) => [q.gaya, msCepat('pramuniaga', 0)]);
  S.majukan(20000);
  let s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab }, tok)); assert.deepEqual([s.status, s.body.galat], [409, 'terlalu_cepat']);
  assert.equal((await S.app.dompet(get(tok))).body.saldo, 0);
  S.majukan(55000);
  s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab }, tok)); assert.deepEqual([s.status, s.body.gaji + s.body.tip], [200, 16500]);
  s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab }, tok)); assert.deepEqual([s.status, s.body.galat], [409, 'shift_tidak_aktif']); /* tidak bisa dibayar dua kali */
  assert.equal((await S.app.dompet(get(tok))).body.saldo, 16500);
});
test('server: mengaku mengerjakan lebih lama dari umur shift (jam server) = laporan tidak sah, gaji dasar terpotong', async () => {
  const S = siapkan(), tok = await login(S.app, 'tya', '112233');
  const m = await mulai(S, tok, 'barista'), soal = KK.kkSoal('barista', m.benih, 0);
  S.majukan(71000);
  const s = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: soal.map((q) => [jawabBenar('barista', q), 9000]) }, tok)); /* 10 × 9 dtk = 90 dtk > 71 + 4 */
  assert.equal(s.status, 200); assert.equal(s.body.nilai.sah, false); assert.equal(s.body.tip, 0); assert.ok(s.body.gaji <= 2000);
});
test('server: jeda 10 menit + jatah gabungan dengan kampung + shift orang lain + shift kedaluwarsa', async () => {
  const S = siapkan(), tok = await login(S.app, 'tya', '112233'), tok2 = await login(S.app, 'bagas', '135790');
  let m = await mulai(S, tok, 'barista'); S.majukan(75000);
  /* penghuni lain tidak bisa menyelesaikan / membatalkan shift ini */
  let x = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: [] }, tok2)); assert.deepEqual([x.status, x.body.galat], [409, 'shift_tidak_ada']);
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: [] }, tok))).status, 200);
  x = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'resepsionis' }, tok)); assert.equal(x.status, 409); /* belum daftar */ assert.equal(x.body.galat, 'belum_daftar');
  await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'resepsionis' }, tok));
  x = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'resepsionis' }, tok)); assert.deepEqual([x.status, x.body.galat], [409, 'jeda']);
  S.majukan(10 * 60000);
  /* kampung + Kota berbagi jatah 3 shift */
  await S.app.kerja(post({ aksi: 'daftar', pekerjaan: 'kafe' }, tok));
  const k = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'kafe' }, tok)); assert.equal(k.status, 200); assert.equal(k.body.benih, undefined); /* kampung tidak berubah */
  S.majukan(105000); assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: k.body.shift, hasil: { benar: 6, salah: 0, cepat: 1 } }, tok))).body.gaji, 7000);
  S.majukan(10 * 60000);
  m = await mulai(S, tok, 'pramuniaga'); S.majukan(21 * 60000); /* > 20 menit */
  x = await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: [] }, tok)); assert.deepEqual([x.status, x.body.galat], [409, 'kedaluwarsa']);
  m = await mulai(S, tok, 'pramuniaga'); S.majukan(75000);
  assert.equal((await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: [] }, tok))).status, 200);
  S.majukan(10 * 60000);
  x = await S.app.kerja(post({ aksi: 'mulai', pekerjaan: 'barista' }, tok)); assert.deepEqual([x.status, x.body.galat], [409, 'batas_hari']);
  /* batal: tanpa gaji, tidak memakai jatah */
  m = await mulai(S, tok2, 'resepsionis'); assert.equal((await S.app.kerja(post({ aksi: 'batal', shift: m.shift }, tok2))).status, 200);
  assert.equal((await S.app.dompet(get(tok2))).body.hariIni.shift, 0);
});
test('server: tamu (tanpa sesi) ditolak di semua aksi pekerjaan Kota; pekerjaan asing ditolak', async () => {
  const S = siapkan();
  for (const id of IDS) for (const b of [{ aksi: 'daftar', pekerjaan: id }, { aksi: 'mulai', pekerjaan: id }, { aksi: 'selesai', shift: '00000000-0000-4000-8000-000000000000', jawab: [] }]) {
    const r = await S.app.kerja(post(b)); assert.equal(r.status, 401, JSON.stringify(r.body)); assert.equal(r.body.galat, 'perlu_login');
  }
  assert.equal(S.db._t.shift.length, 0);
  const tok = await login(S.app, 'rina', '246810');
  for (const pk of ['kasir', 'Barista', 'barista ', '__proto__', 'constructor', '', null, 5]) assert.equal((await S.app.kerja(post({ aksi: 'daftar', pekerjaan: pk }, tok))).status, 400);
});
test('server: naik pangkat sesudah 5 shift — gaji pokok 13.500, tamu makin tidak sabar, soal ikut pangkat', async () => {
  const S = siapkan(), tok = await login(S.app, 'tya', '112233'); let akhir;
  for (let i = 0; i < 6; i++) {
    const m = await mulai(S, tok, 'barista'); assert.equal(m.pangkat, i < 5 ? 0 : 1);
    const soal = KK.kkSoal('barista', m.benih, m.pangkat); S.majukan(75000);
    akhir = (await S.app.kerja(post({ aksi: 'selesai', shift: m.shift, jawab: soal.map((q) => [jawabBenar('barista', q), 5000]) }, tok))).body;
    assert.equal(akhir.naikPangkat, i === 4); assert.equal(akhir.gaji, i < 5 ? 10500 : 13500);
    S.majukan(24 * 3600000); /* hari berikutnya: jatah baru */
  }
  assert.deepEqual([akhir.pangkat, akhir.shift, akhir.tip], [1, 6, 6000]);
});

/* ---------- klien + migrasi (statis) ---------- */
test('klien: kabel layar kerja — tamu tidak bisa mulai, hanya jawaban mentah yang dikirim, 3D dijeda, tombol kembali, id unik', () => {
  const ui = HTML.slice(HTML.indexOf('/* ==== KERJA-KOTA-UI-START ==== */'), HTML.indexOf('/* ==== KERJA-KOTA-UI-END ==== */'));
  assert.ok(ui.length > 5000);
  assert.match(ui, /function kkMulai\(\) \{\n  if \(KK\.sibuk \|\| !ktaIsResident\(\)\) return;/); assert.match(ui, /function kkDaftar\(\) \{\n  if \(KK\.sibuk \|\| !ktaIsResident\(\)\) return;/);
  assert.match(ui, /Khusus penghuni kos/);
  assert.match(ui, /\{ aksi: 'selesai', shift: shift, jawab: KK\.jawab \}/); assert.doesNotMatch(ui, /hasil:/); assert.doesNotMatch(ui, /kkUpah\(/); /* klien tidak mengirim nilai / upah */
  assert.doesNotMatch(ui, /fetch\(|localStorage|innerHTML = [^;]*visitorName/);
  assert.match(HTML, /requestAnimationFrame\(animate\);\n  if \(ARK\.aktif\) \{ clock\.getDelta\(\); return; \}[^\n]*\n  if \(KK\.aktif\) \{ clock\.getDelta\(\); return; \}/);
  assert.match(HTML, /if \(KK\.aktif\) \{ dorongStateLagi\(\); kkKembali\(\); return; \}/);
  assert.match(HTML, /if \(KK_OBJEK\[id\] && KK_RUANG\[R\] === KK_OBJEK\[id\]\) \{[^\n]*kkBuka\(KK_OBJEK\[id\]\); return; \}/);
  for (const id of ['kkLayar', 'kkTombol', 'kkPanel', 'kkArena', 'kkHud', 'kkKeluar']) assert.equal(HTML.split('id="' + id + '"').length, 2, id);
  assert.match(HTML, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(ui, /Ryan/);
});
test('migrasi: melebarkan dua CHECK + dua fungsi, hanya service_role, idempoten, ada blok cek + uji rollback kamar 41 dan 60', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261127_kerja_kota.sql'), 'utf8');
  const daftar = "('kafe', 'warung', 'ronda', 'laundry', 'barista', 'resepsionis', 'pramuniaga')";
  assert.equal(sql.split(daftar).length - 1, 3); /* dua CHECK + kosan_kerja_daftar */
  assert.match(sql, /drop constraint if exists kosan_pekerjaan_pekerjaan_check/); assert.match(sql, /drop constraint if exists kosan_shift_pekerjaan_check/);
  assert.match(sql, /p_gaji \+ p_tip > 25000/); assert.doesNotMatch(sql.split('-- ---------- Cek')[0].split('begin;')[1], /20000/);
  assert.equal((sql.match(/security definer set search_path = ''/g) || []).length, 2);
  assert.equal((sql.match(/from public, anon, authenticated;/g) || []).length, 2); assert.equal((sql.match(/to service_role;/g) || []).length, 2);
  assert.doesNotMatch(sql, /drop table|truncate|delete from|create table/i);
  assert.match(sql, /array\[41, 60\]/); assert.match(sql, /--   rollback;/); assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m);
  /* fake-db meniru batas yang sama */
  const fake = fs.readFileSync(path.join(__dirname, 'fake-db.js'), 'utf8');
  assert.match(fake, /'barista', 'resepsionis', 'pramuniaga'\]/); assert.match(fake, /gaji \+ tip <= 25000/);
});
