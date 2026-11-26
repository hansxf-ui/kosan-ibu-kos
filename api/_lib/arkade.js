'use strict';
/* Arkade Ria (Ryan 26 Nov: "Gas, Arkade dulu") — aturan MURNI server untuk tiga game arkade di
   interior Kota: Capit Boneka, Balap Kota, Lantai Dansa. Tanpa jaringan, tanpa DB.
   Klien punya salinan aturan yang sama di blok ARKADE-START index.html; tests/arkade.test.js
   memastikan keduanya sama. Skor dimainkan di klien, jadi server TIDAK percaya angkanya begitu
   saja: tiap skor dijepit ke batas yang mungkin dicapai dalam waktu yang benar-benar berlalu
   sejak tiket main dibuat (tiket = HMAC server), dan durasi minimum ditegakkan.
   Tidak ada uang di sini: hadiah hanya boneka pajangan kamar (sekali, lewat kosan_barang). */

const GAME = {
  capit: { nama: 'Capit Boneka', satuan: 'poin', minDetik: 12, maksDetik: 240 },
  balap: { nama: 'Balap Kota', satuan: 'm', minDetik: 5, maksDetik: 240 },
  dansa: { nama: 'Lantai Dansa', satuan: 'poin', minDetik: 40, maksDetik: 240 }
};
const GAME_ID = Object.keys(GAME);
const punya = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
function gameDari(id) { return punya(GAME, id) ? GAME[id] : null; }

/* ---- Capit: 6 koin, satu boneka paling banyak per koin (ronde 2: 60 dtk; batas skor per koin tidak berubah) ---- */
const CAPIT = { koin: 6, detik: 60, nilaiMaks: 50, bonusPresisi: 10, detikPerKoin: 2.5, hadiahDapat: 3 };
/* ---- Balap: laju naik terus, selesai paling lama 60 detik (ronde 2: 26 m/dtk + 1,1/dtk -> sempurna 60 dtk = 3.540 m) ---- */
const BALAP = { v0: 26, naik: 1.1, detik: 60, nyawa: 3, toleransi: 30 };
function balapLaju(t) { return BALAP.v0 + BALAP.naik * Math.max(0, Math.min(BALAP.detik, t)); } /* m/dtk */
function balapJarakIdeal(t) { const d = Math.max(0, Math.min(BALAP.detik, t)); return BALAP.v0 * d + 0.5 * BALAP.naik * d * d; }
/* ---- Dansa: peta not deterministik di atas lagu 128 BPM, 96 ketuk (45 detik) ---- */
const DANSA = { bpm: 128, ketuk: 96, mulai: 8, akhir: 92, benih: 20261126, jendela: [0.07, 0.13, 0.19], nilai: [100, 60, 30], komboTiap: 10, komboMaks: 10 };
function dansaPeta() {
  /* [{ k: ketuk (boleh .5), j: jalur 0..3 }] — 16 ketuk pertama not seperempat, sesudahnya makin rapat */
  let s = DANSA.benih >>> 0;
  const acak = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const peta = [];
  let lalu = -1;
  for (let k = DANSA.mulai; k < DANSA.akhir; k += 0.5) {
    const bagian = Math.floor((k - DANSA.mulai) / 16); /* 0..5 */
    const utuh = k === Math.floor(k);
    const r = acak(), r2 = acak();
    let ada;
    if (utuh) ada = bagian === 0 ? (k % 2 === 0 || r < 0.35) : r < 0.86;
    else ada = bagian >= 2 && r < (bagian >= 4 ? 0.42 : 0.26);
    if (!ada) continue;
    let j = Math.floor(r2 * 4);
    if (j === lalu) j = (j + 1 + Math.floor(acak() * 3)) % 4;
    peta.push({ k, j }); lalu = j;
  }
  return peta;
}
function dansaPengali(kombo) { return 1 + Math.min(DANSA.komboMaks, Math.floor(Math.max(0, kombo) / DANSA.komboTiap)) * 0.1; }
function dansaNilai(selisihDetik) { /* indeks mutu: 0 sempurna, 1 bagus, 2 lumayan, -1 lewat */
  const a = Math.abs(selisihDetik);
  for (let i = 0; i < DANSA.jendela.length; i++) if (a <= DANSA.jendela[i]) return i;
  return -1;
}
function dansaSkorMaks() {
  let skor = 0, kombo = 0;
  for (let i = 0, n = dansaPeta().length; i < n; i++) { kombo += 1; skor += Math.round(DANSA.nilai[0] * dansaPengali(kombo)); }
  return skor;
}
const DANSA_MAKS = dansaSkorMaks();

/* batas skor yang MUNGKIN dicapai `detik` sesudah tiket dibuat (dijepit di sini, bukan di klien) */
function skorBatas(id, detik) {
  const d = Math.max(0, Number(detik) || 0);
  if (id === 'capit') return Math.min(CAPIT.koin, Math.floor(d / CAPIT.detikPerKoin)) * (CAPIT.nilaiMaks + CAPIT.bonusPresisi);
  if (id === 'balap') return Math.floor(balapJarakIdeal(d)) + BALAP.toleransi;
  if (id === 'dansa') return DANSA_MAKS;
  return 0;
}
function skorJepit(id, skor, detik) {
  if (!gameDari(id) || !Number.isInteger(skor) || skor < 0) return 0;
  return Math.min(skor, skorBatas(id, detik));
}
/* hadiah boneka: minimal 3 boneka terjepit dalam satu kali main (dan skornya memang cukup untuk itu) */
const HADIAH = { barang: 'boneka_capit', nama: 'Boneka beruang Arkade Ria' };
function capitHadiah(skor, dapat) { return Number.isInteger(dapat) && dapat >= CAPIT.hadiahDapat && skor >= CAPIT.hadiahDapat * 20; }

/* minggu papan skor = Senin 00.00 WIB s.d. Minggu 23.59 WIB; kunci = tanggal Senin (YYYY-MM-DD) */
const WIB = 7 * 3600 * 1000;
function mingguWib(ms) {
  const d = new Date(ms + WIB);
  const mundur = (d.getUTCDay() + 6) % 7; /* Senin = 0 */
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mundur)).toISOString().slice(0, 10);
}
function mingguSisaDetik(ms) { /* detik sampai papan direset (Senin 00.00 WIB berikutnya) */
  const awal = Date.parse(mingguWib(ms) + 'T00:00:00Z') - WIB;
  return Math.max(0, Math.ceil((awal + 7 * 86400000 - ms) / 1000));
}

module.exports = { GAME, GAME_ID, CAPIT, BALAP, DANSA, DANSA_MAKS, HADIAH, gameDari, balapLaju, balapJarakIdeal,
  dansaPeta, dansaPengali, dansaNilai, dansaSkorMaks, skorBatas, skorJepit, capitHadiah, mingguWib, mingguSisaDetik };
