'use strict';
/* Loading screen awal v2 (24 Nov): identitas lama utuh + dunia hidup bertema kos; gerak hanya transform / opacity. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = HTML.indexOf('<div id="loadingOverlay"'), b = HTML.indexOf('<!-- UI refresh — progres loading', a);
const layar = HTML.slice(a, b);
const css = HTML.slice(0, HTML.indexOf('</style>'));

test('loading awal: identitas lama tetap utuh', () => {
  assert.ok(a > 0 && b > a, 'overlay ada');
  for (const k of ['load-awan load-awan-1', 'load-awan load-awan-2', 'load-awan load-awan-3', 'class="load-gedung"', 'kb-jendela', 'load-tanah',
    '<h1>Kosan Ibu Kos</h1>', '<p class="load-tag">Kos virtual yang dibangun bareng penonton</p>', 'id="loadBarIsi"', '<p id="loadTip">Memuat Kosan…</p>',
    '<button id="loadReload" type="button" hidden>Muat ulang</button>']) assert.ok(layar.includes(k), k);
  assert.ok(/#loadingOverlay \{[^}]*z-index: 100[^}]*linear-gradient\(180deg, #7cc7f5 0%, #3b92e3 48%, #1b5fa8 100%\)/.test(css), 'langit + lapisan sama');
});

test('loading awal: dunia hidup bertema kos (bukan kereta Kota)', () => {
  for (const k of ['lk-dunia', 'lk-lapis lk-jauh', 'lk-lapis lk-kos', 'lk-lapis lk-pagar', 'lk-jalan', 'lk-lapis lk-marka', 'lk-lapis lk-semak', 'lk-aktor', 'lk-skuter',
    'lk-roda', 'lk-lewat', 'lk-gerobak', 'lk-kain', 'lk-pohon', 'lk-ayam', 'lk-ekor', 'lk-burung', 'lk-nyala', 'KOSAN IBU KOS', 'JALAN KAMPUNG', 'BAKSO'])
    assert.ok(layar.includes(k), k);
  assert.ok(!layar.includes('km-kereta') && !layar.includes('km-rel'), 'tidak menjiplak adegan kereta');
  assert.ok(!/<img|url\(|https?:\/\//.test(layar), 'tanpa gambar / sumber luar');
  assert.ok(!/<script/.test(layar), 'dunia tidak butuh JS');
});

test('loading awal: gerak hanya transform / opacity, tanpa blur, terkurung di #loadingOverlay', () => {
  const kf = css.match(/@keyframes lk\w+ \{[^@]*?\}\s*\}/g) || [];
  assert.ok(kf.length >= 14, 'keyframes dunia: ' + kf.length);
  for (const k of kf) {
    const isi = k.replace(/@keyframes lk\w+ \{/, '');
    const prop = (isi.match(/[\s{;]([a-z-]+)\s*:/g) || []).map((x) => x.replace(/[\s{;:]/g, ''));
    for (const p of prop) assert.ok(p === 'transform' || p === 'opacity', 'animasi hanya transform / opacity: ' + p + ' @ ' + k.slice(0, 30));
  }
  const aturan = css.split('\n').filter((l) => /\.lk-/.test(l));
  assert.ok(aturan.length > 40);
  for (const l of aturan) { assert.ok(/^\s*#loadingOverlay /.test(l), 'aturan terkurung: ' + l.trim().slice(0, 60)); }
  const blok = css.slice(css.indexOf('/* Loading awal v2'), css.indexOf('/* Ronde 23 — layout landscape pendek'));
  assert.ok(blok.length > 2000 && !/filter\s*:|backdrop-filter|box-shadow: 0 0 /.test(blok), 'tanpa filter / blur di dunia');
  for (const m of blok.match(/animation: (\w+)/g) || []) assert.ok(/animation: lk[A-Z]/.test(m), m);
});

test('loading awal: layar Menuju Kota tidak ikut berubah', () => {
  const x = HTML.indexOf('<div id="kotaMuat"'), y = HTML.indexOf('<!-- Layar masuk (Ronde 10b)', x);
  const km = HTML.slice(x, y);
  assert.ok(km.includes('km-kereta') && km.includes('km-roda') && !km.includes('lk-'), 'adegan kereta utuh, tanpa elemen kos');
  const asli = fs.existsSync(path.join(__dirname, '..', '..', 'alat', 'index.asli.html')) ? fs.readFileSync(path.join(__dirname, '..', '..', 'alat', 'index.asli.html'), 'utf8') : null;
  if (asli) { const p = asli.indexOf('<div id="kotaMuat"'), q = asli.indexOf('<!-- Layar masuk (Ronde 10b)', p); assert.equal(km, asli.slice(p, q), 'markup Menuju Kota identik dengan live'); }
});
