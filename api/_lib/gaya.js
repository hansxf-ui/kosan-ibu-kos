'use strict';
/* Warna Kamar (Ryan 26 Nov: "pilih warna kamar sendiri") — daftar putih pilihan warna kamar.
   SATU sumber di server; klien (index.html, blok WARNA-KAMAR) memuat daftar id yang sama —
   dijaga tests/warna-kamar.test.js. Indeks 0 = bawaan (tampilan kamar sebelum fitur ini).
   Bukan fungsi Vercel (folder _lib): tidak menambah hitungan fungsi. */
const deret = (h, n) => Array.from({ length: n }, (_, i) => h + i);
const DINDING = deret('d', 28); /* d0..d27 */
const LANTAI = deret('l', 9);   /* l0..l8 */
const SELIMUT = deret('s', 19); /* s0..s18 */
const BAWAAN = Object.freeze({ dinding: 'd0', lantai: 'l0', selimut: 's0' });

/* badan permintaan -> { dinding, lantai, selimut } atau null (ada yang di luar daftar / bukan string) */
function sahkan(b) {
  if (!b || typeof b !== 'object') return null;
  const { dinding, lantai, selimut } = b;
  if (typeof dinding !== 'string' || typeof lantai !== 'string' || typeof selimut !== 'string') return null;
  if (!DINDING.includes(dinding) || !LANTAI.includes(lantai) || !SELIMUT.includes(selimut)) return null;
  return { dinding, lantai, selimut };
}
/* baris database -> pilihan yang pasti sah (kode tak dikenal, mis. pilihan yang kelak dicabut -> bawaan); tanpa baris -> null */
function rapikan(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    dinding: DINDING.includes(r.dinding) ? r.dinding : BAWAAN.dinding,
    lantai: LANTAI.includes(r.lantai) ? r.lantai : BAWAAN.lantai,
    selimut: SELIMUT.includes(r.selimut) ? r.selimut : BAWAAN.selimut
  };
}
module.exports = { DINDING, LANTAI, SELIMUT, BAWAAN, sahkan, rapikan };
