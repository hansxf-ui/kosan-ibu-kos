'use strict';
/* Tes unit Suasana — siang/malam ikut jam WIB, jadwal hujan bersemai tanggal, pelangi,
   jemuran berhenti kering saat hujan, helper musik generatif. Fungsi murni diambil VERBATIM
   dari index.html (blok SUASANA, JEMURAN, MUSIK). Jalankan: node --test tests/suasana.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const antara = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); assert.ok(i > 0 && j > i, a); return HTML.slice(i, j); };
const fungsi = (n) => { const a = HTML.indexOf('function ' + n + '('); assert.ok(a > 0, n); return HTML.slice(a, HTML.indexOf('\n}\n', a) + 3); };
const S = new Function(antara('/* ==== SUASANA-START ==== */', '/* ==== SUASANA-END ==== */')
  + antara('/* ==== JEMURAN-START ==== */', '/* ==== JEMURAN-END ==== */')
  + antara('/* ==== MUSIK-START ==== */', '/* ==== MUSIK-END ==== */')
  + '\nreturn { SUASANA_WIB, HUJAN_PUDAR_MS, PELANGI_MS, suasanaJam, suasanaTanggal, suasanaAwalHari, suasanaTerang, suasanaSurya, suasanaJingga,'
  + ' suasanaJadwalHujan, suasanaCuaca, suasanaHujanTumpang, suasanaKeadaan, suasanaAcak,'
  + ' JEMUR_DUR, jemuranStatus, jemuranSisaDetik, jemuranTransisi,'
  + ' MUSIK_AKOR, MUSIK_PROGRESI, MUSIK_PENTATONIK, MUSIK_TEMPO, musikSuasana, musikVoicing, musikMotif, musikHz };')();
const WIB = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 7, mi || 0); /* jam WIB -> ms */
const hari = (n) => { const t = new Date(Date.UTC(2026, 0, 1) + n * 86400000); return t.toISOString().slice(0, 10); };

test('Suasana: jam + tanggal WIB (UTC+7), bukan zona HP', () => {
  assert.equal(S.suasanaJam(Date.UTC(2026, 10, 15, 0, 0)), 7);
  assert.equal(S.suasanaJam(WIB(2026, 11, 15, 21, 30)), 21.5);
  assert.equal(S.suasanaTanggal(Date.UTC(2026, 10, 15, 17, 30)), '2026-11-16', '00:30 WIB sudah besok');
  assert.equal(S.suasanaTanggal(Date.UTC(2026, 10, 15, 16, 59)), '2026-11-15');
  assert.equal(S.suasanaAwalHari(WIB(2026, 11, 15, 13, 45)), WIB(2026, 11, 15, 0, 0));
});

test('Suasana: siang terang, malam gelap, subuh/senja bertahap (tidak tiba-tiba)', () => {
  assert.equal(S.suasanaTerang(12), 1);
  assert.equal(S.suasanaTerang(21), 0);
  assert.equal(S.suasanaTerang(2), 0);
  assert.equal(S.suasanaSurya(12), 1);
  assert.equal(S.suasanaSurya(0), 0);
  let lalu = S.suasanaTerang(4.5), naikMaks = 0;
  for (let j = 4.55; j <= 7; j += 0.05) { const t = S.suasanaTerang(j); assert.ok(t >= lalu - 1e-12, 'subuh naik ' + j); naikMaks = Math.max(naikMaks, t - lalu); lalu = t; }
  assert.ok(naikMaks < 0.07, 'per 3 menit berubah < 7%');
  lalu = 2;
  for (let j = 17; j <= 19.5; j += 0.05) { const t = S.suasanaTerang(j); assert.ok(t <= lalu + 1e-12, 'senja turun ' + j); lalu = t; }
  assert.ok(S.suasanaJingga(17.9) > 0.95 && S.suasanaJingga(12) < 1e-6 && S.suasanaJingga(0) < 1e-6, 'jingga hanya fajar/senja');
  assert.ok(S.suasanaSurya(18.2) === 0 && S.suasanaTerang(18.2) > 0.3, 'sesudah terbenam: langit masih remang (senja)');
});

test('Suasana: jadwal hujan sama untuk tanggal yang sama (semua pemain), rapi, wajar', () => {
  assert.deepEqual(S.suasanaJadwalHujan('2026-11-15'), S.suasanaJadwalHujan('2026-11-15'));
  let basah = 0, nBasah = 0, kering = 0, nKering = 0, siangSore = 0, total = 0;
  for (let n = 0; n < 730; n++) {
    const tgl = hari(n), j = S.suasanaJadwalHujan(tgl), bulan = +tgl.slice(5, 7), musimHujan = bulan >= 11 || bulan <= 3;
    assert.ok(j.length <= 3, tgl);
    j.forEach((s, i) => {
      assert.ok(s.selesai - s.mulai >= 15 && s.selesai - s.mulai <= 40, tgl + ' lama');
      assert.ok(s.mulai >= 0 && s.selesai <= 23 * 60 + 55, tgl + ' dalam satu hari');
      assert.ok(s.kuat >= 0.55 && s.kuat <= 1, tgl + ' kuat');
      if (i > 0) assert.ok(s.mulai >= j[i - 1].selesai + 45, tgl + ' berjarak >= 45 menit');
      total++; if (s.mulai >= 13 * 60 && s.mulai < 18 * 60) siangSore++;
    });
    if (musimHujan) { nBasah++; if (j.length) basah++; } else { nKering++; if (j.length) kering++; }
  }
  assert.ok(basah / nBasah > 0.65 && basah / nBasah < 0.85, 'musim hujan ~75%: ' + (basah / nBasah).toFixed(2));
  assert.ok(kering / nKering > 0.25 && kering / nKering < 0.45, 'kemarau ~35%: ' + (kering / nKering).toFixed(2));
  assert.ok(siangSore / total > 0.45, 'paling sering siang-sore');
});

test('Suasana: hujan menderas 3 menit, mendung sebelum/sesudah, pelangi sesudah hujan siang', () => {
  /* cari hari dengan hujan siang yang cukup deras */
  let tgl = null, s = null;
  for (let n = 300; n < 800 && !s; n++) { const j = S.suasanaJadwalHujan(hari(n)); const c = j.find((q) => q.kuat >= 0.6 && q.selesai < 15 * 60 && q.mulai > 9 * 60); if (c) { tgl = hari(n); s = c; } }
  assert.ok(s, 'ada contoh hujan siang');
  const d0 = Date.UTC(+tgl.slice(0, 4), +tgl.slice(5, 7) - 1, +tgl.slice(8, 10)) - S.SUASANA_WIB, t0 = d0 + s.mulai * 60000, t1 = d0 + s.selesai * 60000;
  assert.equal(S.suasanaCuaca(t0 - 20 * 60000).hujan, 0);
  assert.equal(S.suasanaCuaca(t0).hujan, 0, 'mulai pelan');
  assert.ok(Math.abs(S.suasanaCuaca(t0 + S.HUJAN_PUDAR_MS).hujan - s.kuat) < 1e-9, 'deras penuh sesudah 3 menit');
  assert.ok(S.suasanaCuaca((t0 + t1) / 2).mendung > 0.59, 'mendung saat hujan');
  assert.ok(S.suasanaCuaca(t0 - 4 * 60000).mendung > 0, 'mendung dulu sebelum hujan');
  assert.equal(S.suasanaCuaca(t1 + 60000).hujan, 0, 'reda');
  assert.ok(S.suasanaCuaca(t1 + 3 * 60000).pelangi > 0.5, 'pelangi sesudah hujan siang');
  assert.equal(S.suasanaCuaca(t1 + S.PELANGI_MS + 60000).pelangi, 0, 'pelangi hilang');
});

test('Suasana: waktu hujan untuk jemuran = jumlah selang hujan (tanpa pudar), lebih dari 30 hari = 0', () => {
  for (let n = 300; n < 340; n++) {
    const tgl = hari(n), j = S.suasanaJadwalHujan(tgl), d0 = Date.UTC(+tgl.slice(0, 4), +tgl.slice(5, 7) - 1, +tgl.slice(8, 10)) - S.SUASANA_WIB;
    const total = j.reduce((a, q) => a + (q.selesai - q.mulai) * 60000, 0);
    assert.equal(S.suasanaHujanTumpang(d0, d0 + 86400000), total, tgl);
    if (j.length) {
      const q = j[0], tengah = d0 + (q.mulai + 5) * 60000;
      assert.equal(S.suasanaHujanTumpang(tengah, tengah + 60000), 60000, 'satu menit di tengah hujan');
      assert.equal(S.suasanaHujanTumpang(d0 + (q.mulai - 10) * 60000, d0 + (q.mulai + 10) * 60000), 10 * 60000, 'separuh tumpang');
    }
  }
  assert.equal(S.suasanaHujanTumpang(5, 5), 0);
  assert.equal(S.suasanaHujanTumpang(0, 31 * 86400000), 0);
});

test('Suasana: jemuran berhenti kering saat hujan (waktu tidak diulang), tanpa hujan = perilaku lama', () => {
  const dur = S.JEMUR_DUR, st = { status: 'dijemur', sejak: 1000 };
  const hujanSemenit = () => 60000;
  assert.equal(S.jemuranStatus(st, 1000 + dur, dur), 'kering', 'tanpa fungsi hujan: 3 menit');
  assert.equal(S.jemuranStatus(st, 1000 + dur, dur, hujanSemenit), 'dijemur', 'hujan 1 menit: belum');
  assert.equal(S.jemuranStatus(st, 1000 + dur + 60000, dur, hujanSemenit), 'kering', 'sesudah ditambah 1 menit');
  assert.equal(S.jemuranSisaDetik(st, 1000 + 120000, dur, hujanSemenit), 120, 'sisa = 3 menit - (2 menit - 1 menit hujan)');
  assert.equal(S.jemuranTransisi(st, 'angkat', 1000 + dur, dur, hujanSemenit), null, 'belum kering: tidak bisa diangkat');
  assert.deepEqual(S.jemuranTransisi(st, 'angkat', 1000 + dur + 60000, dur, hujanSemenit), { status: 'kosong', sejak: 0 });
  /* pakai jadwal asli: waktu efektif tidak pernah turun (sudah kering = tetap kering) */
  const a = Date.UTC(2026, 10, 1), hujan = S.suasanaHujanTumpang;
  let lalu = -1;
  for (let t = a; t < a + 3 * 86400000; t += 7 * 60000) { const e = (t - a) - hujan(a, t); assert.ok(e >= lalu, 'monoton'); lalu = e; }
});

test('Suasana: pratinjau ?jam= / ?hujan= / ?pelangi= (keadaan dipaksa, jam HUD tidak ikut)', () => {
  const k = S.suasanaKeadaan(WIB(2026, 11, 15, 12), { jam: 21 });
  assert.equal(k.jam, 21); assert.equal(k.terang, 0); assert.equal(k.malam, 1); assert.equal(k.surya, 0);
  const h = S.suasanaKeadaan(WIB(2026, 11, 15, 12), { hujan: 1 });
  assert.equal(h.hujan, 0.85); assert.equal(h.mendung, 1);
  const c = S.suasanaKeadaan(WIB(2026, 11, 15, 12), { hujan: 0, pelangi: 1, jam: 15.5 });
  assert.equal(c.hujan, 0); assert.equal(c.pelangi, 1);
  assert.equal(S.suasanaKeadaan(WIB(2026, 11, 15, 12), { hujan: 0, pelangi: 1, jam: 21 }).pelangi, 0, 'malam: tanpa pelangi');
  for (const salah of [{ jam: 24 }, { jam: -1 }, { jam: 'x' }, {}]) assert.equal(S.suasanaKeadaan(WIB(2026, 11, 15, 13), salah).jam, 13);
});

test('Musik: voicing rapat di rentang, kelas nada akor utuh; motif kalimba di pentatonik F', () => {
  const r = S.suasanaAcak(9);
  for (const [nama, akor] of Object.entries(S.MUSIK_AKOR)) {
    const v = S.musikVoicing(akor.nada, 62, 52, 74);
    assert.deepEqual([...new Set(v.map((n) => n % 12))].sort(), [...new Set(akor.nada)].sort(), nama);
    assert.ok(v.every((n) => n >= 52 && n <= 74), nama + ' rentang');
    assert.deepEqual(v, [...v].sort((a, b) => a - b), nama + ' urut');
    for (let i = 0; i < 20; i++) {
      for (const n of S.musikMotif(r, akor.nada, 0.8)) {
        assert.ok(n.midi >= 72 && n.midi <= 88 && S.MUSIK_PENTATONIK.includes(n.midi % 12), nama + ' nada ' + n.midi);
        assert.ok(n.ketuk >= 0 && n.ketuk < 8, 'ketuk');
      }
    }
  }
  for (const daftar of Object.values(S.MUSIK_PROGRESI)) for (const p of daftar) assert.ok(p.every((a) => S.MUSIK_AKOR[a]), p.join());
  assert.equal(S.musikSuasana({ hujan: 0.5, malam: 0, jingga: 0 }), 'hujan');
  assert.equal(S.musikSuasana({ hujan: 0, malam: 1, jingga: 0 }), 'malam');
  assert.equal(S.musikSuasana({ hujan: 0, malam: 0.2, jingga: 0.8 }), 'senja');
  assert.equal(S.musikSuasana({ hujan: 0, malam: 0, jingga: 0 }), 'siang');
  assert.ok(Math.abs(S.musikHz(69) - 440) < 1e-9);
  assert.ok(S.MUSIK_TEMPO.malam < S.MUSIK_TEMPO.siang, 'malam lebih pelan');
});

test('Suasana: kabel ke index.html (tick sebelum render, langkah, menu, tanpa file audio, tanpa lampu baru)', () => {
  const ani = fungsi('animate');
  assert.ok(ani.indexOf('suasanaTick(dt, Date.now());') > 0 && ani.indexOf('suasanaTick(dt, Date.now());') < ani.indexOf('renderer.render('), 'tick sebelum render');
  assert.match(ani, /suaraLangkah\(sw, gerak\)/);
  assert.match(HTML, /<button id="musikBtn"[^>]*>[\s\S]*?Musik <span id="musikStatus"/);
  assert.match(HTML, /<button id="efekBtn"[^>]*>[\s\S]*?Efek suara <span id="efekStatus"/);
  assert.match(HTML, /localStorage\.setItem\('kosan3d-suara'/);
  assert.doesNotMatch(HTML, /new Audio\(|<audio|\.mp3|\.ogg|\.wav['"]/, 'semua bunyi dibuat Web Audio (tanpa file)');
  const rt = antara('/* ================= Suasana (runtime)', 'function suasanaPengingat(');
  assert.doesNotMatch(rt, /new THREE\.\w*Light\(/, 'jumlah lampu tidak berubah (tanpa kompilasi ulang shader)');
  assert.doesNotMatch(rt, /transparent: true|AdditiveBlending/, 'tanpa bidang transparan / aditif baru');
  /* genangan lampu = sisipan shader yang mati di siang hari + di dalam ruangan (warna akhir sama persis) */
  assert.match(fungsi('suGenangSuntik'), /if \( suGenangWarna\.r > 0\.0 &&/);
  assert.match(fungsi('suasanaPasangLangit'), /if \(luar\) SU_GENANG\.warna\.value\.copy\(SU\.genangWarna\); else SU_GENANG\.warna\.value\.setRGB\(0, 0, 0\);/);
  assert.match(fungsi('suasanaTerapkan'), /SU\.genangWarna\.copy\(SU_WARNA\.genang\)\.multiplyScalar\(genang > 0\.01 \?/);
  assert.match(fungsi('jemuranStatusSekarang'), /jemuranStatus\(jemuranBaca\(\), Date\.now\(\), JEMUR_DUR, jemuranHujan\)/);
  assert.match(fungsi('jemuranAksi'), /jemuranTransisi\(jemuranBaca\(\), aksi, Date\.now\(\), JEMUR_DUR, jemuranHujan\)/);
  /* audio hanya dibuka lewat gerakan pengguna; play/resume tidak pernah dibiarkan menolak tanpa catch */
  assert.match(fungsi('suaraBuka'), /resume\(\); if \(p && p\.catch\) p\.catch/);
});

test('Suasana: genangan lampu = sisipan shader varian malam (siang = program bawaan), langit digambar sesudah benda opak', () => {
  const sisip = fungsi('suGenangSuntik');
  /* siang: GLSL bawaan persis, kunci program = kunci bawaan three.js (program dipakai bersama bahan lain) */
  assert.match(sisip, /if \(!SU_GENANG\.aktif\) return;/);
  assert.match(fungsi('suGenangKunci'), /return SU_GENANG\.aktif \? 'suGenangMalam' : SU_KUNCI_BAWAAN;/);
  assert.match(HTML, /var SU_KUNCI_BAWAAN = THREE\.Material\.prototype\.onBeforeCompile\.toString\(\);/);
  /* varian lawan disiapkan di awal: pergantian senja/subuh tidak mengompilasi shader */
  assert.match(fungsi('suasanaSiapkan'), /setTimeout\(suasanaSiapkanProgram, 3000\)/);
  assert.match(fungsi('suasanaSiapkanProgram'), /suGenangSiapkanLain\(\);/);
  /* chunk yang disisipi ada di Lambert three.js r160 yang di-vendor (kalau three diganti, tes ini mengingatkan) */
  const three = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'three', 'three.module.js'), 'utf8');
  const vs = three.match(/const vertex\$9 = "(#define LAMBERT[^"]*)"/), fs9 = three.match(/const fragment\$9 = "(#define LAMBERT[^"]*)"/);
  assert.ok(vs && fs9, 'shader Lambert ditemukan');
  ['#include <common>', '#include <project_vertex>'].forEach((c) => assert.ok(vs[1].includes(c), c));
  ['#include <common>', '#include <opaque_fragment>', 'outgoingLight', 'diffuseColor'].forEach((c) => assert.ok(fs9[1].includes(c), c));
  ['#include <common>', '#include <project_vertex>', '#include <opaque_fragment>'].forEach((c) => assert.ok(sisip.includes("'" + c + "'"), 'disisipi: ' + c));
  /* langit (kubah, bintang, halo, bulan, pelangi) sesudah benda opak: piksel tertutup gedung tidak diwarnai */
  assert.match(fungsi('suasanaSiapkan'), /SU\.kubah\.renderOrder = 900;/);
  assert.match(fungsi('suasanaTerapkan'), /SU\.kubah\.visible = !\(siang > 0\.999 && k\.jingga < 0\.001 && mendung < 0\.001\);/);
});
