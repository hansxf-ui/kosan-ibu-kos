'use strict';
/* Database palsu di memori untuk tes. Meniru perilaku RPC + tabel di
   supabase/migrations/20261113_rasa_aman_fase_a.sql dan RPC lama
   kosan_login / kosan_occupants (yang tidak ada di repo). PIN di sini
   PIN UJI, bukan PIN penghuni asli. */
const crypto = require('node:crypto');
const { pinHash, normalize } = require('../api/_lib/inti');

function buatFakeDb({ penghuni, sekarang = () => Date.now() }) {
  /* penghuni: [{ room, name, gender: 'Cewek'|'Cowok', pin }] */
  const lama = penghuni.map((p) => ({ room: p.room, name: p.name, gender: p.gender, pin_hash: pinHash(p.pin), gagal: 0, kunci: 0 }));
  const t = { akun: new Map(), sesi: [], log: [], batas: new Map(), gerbang: new Map(),
    /* Kerja & Belanja — meniru tabel supabase/migrations/20261116_kerja_belanja.sql */
    dompet: new Map(), mutasi: [], pekerjaan: new Map(), shift: [], barang: new Map(), sewa: new Map(),
    /* Arkade Ria — meniru tabel kosan_skor (supabase/migrations/20261126_arkade_skor.sql) */
    skor: new Map(),
    /* Foto profil — meniru tabel kosan_foto_profil + objek Storage `foto-profil` (18 Nov) */
    foto: new Map(), fotoObjek: new Map() };
  const raise = (m) => { const e = new Error(m); e.status = 400; throw e; }; /* RAISE EXCEPTION -> PostgREST 400 */
  const kunciP = (room, nama) => room + '|' + nama;
  let mutasiId = 0;
  const PEKERJAAN_SQL = ['kafe', 'warung', 'ronda', 'laundry'];
  function kedaluwarsakan(room, nama, maksDetik) {
    const now = sekarang();
    for (const s of t.shift) if (s.room === room && s.nama_norm === nama && s.status === 'aktif' && s.mulai < now - maksDetik * 1000) { s.status = 'kedaluwarsa'; s.selesai = now; }
  }
  function catatMutasi(room, nama, jumlah, jenis, keterangan, saldo) {
    t.mutasi.push({ id: ++mutasiId, room, nama_norm: nama, jumlah, jenis, keterangan: String(keterangan || '').slice(0, 80), saldo_sesudah: saldo, dibuat: iso(sekarang()) });
  }
  const iso = (ms) => new Date(ms).toISOString();
  const panggilan = [];
  /* tiru DELETE FROM kosan_login_attempts WHERE name IN (penghuni kamar) */
  const hapusAttempts = (room) => { for (const p of lama) if (p.room === room) { p.gagal = 0; p.kunci = 0; } };

  return {
    _t: t, _lama: lama, _panggilan: panggilan,
    async occupants() { panggilan.push('occupants'); return lama.map((p) => ({ room: p.room, name: p.name })); },
    async loginPin(name, h) {
      panggilan.push('loginPin');
      const p = lama.find((x) => x.name.toLowerCase() === String(name).trim().toLowerCase());
      if (!p) return { ok: false };
      /* Tiru kosan_login asli (terverifikasi Postgres): hitungan gagal
         kumulatif tanpa peluruhan, kunci 15 menit di kegagalan ke-5, dan
         saat terkunci "Terlalu banyak percobaan" HANYA untuk PIN benar. */
      if (p.kunci > sekarang()) return p.pin_hash === h ? { ok: false, terkunci: true } : { ok: false };
      if (p.pin_hash !== h) { if (++p.gagal >= 5) { p.kunci = sekarang() + 15 * 60000; p.gagal = 0; } return { ok: false }; }
      p.gagal = 0;
      return { ok: true, row: { gender: p.gender } };
    },
    async akunAmbil(room) { const a = t.akun.get(room); return a ? Object.assign({}, a) : null; },
    async akunSimpan(a) {
      if (!['cewek', 'cowok'].includes(a.gender)) throw new Error('gender tidak valid');
      const ada = t.akun.get(a.room) || {};
      t.akun.set(a.room, Object.assign({}, ada, { room: a.room, nama_norm: a.nama_norm, gender: a.gender }));
    },
    /* tiru kosan_register lama: nama unik (normalisasi), kunci KOSAN /
       KOSANBARU, kamar diminta atau kamar kosong pertama, maks 20. Galat
       dilempar dengan .status 400 seperti PostgREST (raise exception). */
    async register(a) {
      panggilan.push('register');
      const tolak = (m) => { const e = new Error(m); e.status = 400; throw e; };
      const n = normalize(a.p_name);
      if (!n || n.length > 30) tolak('nama tidak valid');
      if (lama.some((x) => normalize(x.name) === n)) tolak('nama sudah terdaftar');
      if (!['KOSAN', 'KOSANBARU'].includes(a.p_key)) tolak('kunci salah');
      if (!/^[0-9a-f]{8}$/.test(a.p_pin_hash)) tolak('pin tidak valid');
      const terisi = new Set(lama.map((x) => x.room));
      let room = terisi.has(a.p_room) ? 0 : a.p_room;
      for (let r = 1; !room && r <= 20; r++) if (!terisi.has(r)) room = r;
      if (!room) tolak('kosan penuh');
      lama.push({ room, name: n, gender: a.p_gender, pin_hash: a.p_pin_hash, gagal: 0, kunci: 0 });
      return room;
    },
    /* tiru kosan_register_cd (supabase/migrations/20261115_gedung_c_d.sql):
       KOSANC -> kamar kosong terendah 21-30, KOSAND -> 31-40; nama unik di
       semua kamar; pesan penuh menunjuk gedung lain kalau masih ada kamar. */
    async registerCd(a) {
      panggilan.push('registerCd');
      const tolak = (m) => { const e = new Error(m); e.status = 400; throw e; };
      const key = String(a.p_key || '').trim().toUpperCase();
      if (key !== 'KOSANC' && key !== 'KOSAND') tolak('kunci salah');
      const n = normalize(a.p_name);
      if (!n || n.length > 30) tolak('nama tidak valid');
      if (!/^[a-z0-9 _.\-]+$/.test(n) || !/[a-z0-9]/.test(n)) tolak('username tidak valid');
      if (!['Cewek', 'Cowok'].includes(a.p_gender)) tolak('gender tidak valid');
      if (!/^[0-9a-f]{8}$/.test(a.p_pin_hash)) tolak('pin tidak valid');
      if (lama.some((x) => normalize(x.name) === n)) tolak('nama sudah terdaftar');
      const [lo, hi] = key === 'KOSANC' ? [21, 30] : [31, 40];
      const terisi = new Set(lama.map((x) => x.room));
      let room = (a.p_room >= lo && a.p_room <= hi && !terisi.has(a.p_room)) ? a.p_room : 0;
      for (let r = lo; !room && r <= hi; r++) if (!terisi.has(r)) room = r;
      if (!room) {
        const lain = key === 'KOSANC' ? [31, 40] : [21, 30];
        const isiLain = lama.filter((x) => x.room >= lain[0] && x.room <= lain[1]).length;
        if (isiLain < 10) tolak(key === 'KOSANC' ? 'Gedung C penuh — kode Gedung D ada di caption video terbaru' : 'Gedung D penuh — kode Gedung C ada di caption video terbaru');
        tolak('kosan penuh');
      }
      lama.push({ room, name: n, gender: a.p_gender, pin_hash: a.p_pin_hash, gagal: 0, kunci: 0 });
      return room;
    },
    /* tiru kosan_register_ef (supabase/migrations/20261117_gedung_e_f.sql):
       KOSANE -> kamar kosong terendah 41-50, KOSANF -> 51-60; nama unik di
       semua kamar; pesan penuh menunjuk gedung lain kalau masih ada kamar. */
    async registerEf(a) {
      panggilan.push('registerEf');
      const tolak = (m) => { const e = new Error(m); e.status = 400; throw e; };
      const key = String(a.p_key || '').trim().toUpperCase();
      if (key !== 'KOSANE' && key !== 'KOSANF') tolak('kunci salah');
      const n = normalize(a.p_name);
      if (!n || n.length > 30) tolak('nama tidak valid');
      if (!/^[a-z0-9 _.\-]+$/.test(n) || !/[a-z0-9]/.test(n)) tolak('username tidak valid');
      if (!['Cewek', 'Cowok'].includes(a.p_gender)) tolak('gender tidak valid');
      if (!/^[0-9a-f]{8}$/.test(a.p_pin_hash)) tolak('pin tidak valid');
      if (lama.some((x) => normalize(x.name) === n)) tolak('nama sudah terdaftar');
      const [lo, hi] = key === 'KOSANE' ? [41, 50] : [51, 60];
      const terisi = new Set(lama.map((x) => x.room));
      let room = (a.p_room >= lo && a.p_room <= hi && !terisi.has(a.p_room)) ? a.p_room : 0;
      for (let r = lo; !room && r <= hi; r++) if (!terisi.has(r)) room = r;
      if (!room) {
        const lain = key === 'KOSANE' ? [51, 60] : [41, 50];
        const isiLain = lama.filter((x) => x.room >= lain[0] && x.room <= lain[1]).length;
        if (isiLain < 10) tolak(key === 'KOSANE' ? 'Gedung E penuh — kode Gedung F ada di caption video terbaru' : 'Gedung F penuh — kode Gedung E ada di caption video terbaru');
        tolak('kosan penuh');
      }
      lama.push({ room, name: n, gender: a.p_gender, pin_hash: a.p_pin_hash, gagal: 0, kunci: 0 });
      return room;
    },
    async akunBuka(room) {
      t.gerbang.delete('pin:' + room); t.gerbang.delete('pw:' + room); hapusAttempts(room);
    },
    async akunReset(room) {
      t.gerbang.delete('pin:' + room); t.gerbang.delete('pw:' + room); hapusAttempts(room);
      for (const s of t.sesi) if (s.room === room && !s.dicabut) s.dicabut = iso(sekarang());
    },
    async sesiBuat(row) {
      if (!/^[0-9a-f]{64}$/.test(row.token_sha256)) throw new Error('token_sha256 tidak valid');
      const s = Object.assign({ id: crypto.randomUUID(), dibuat: iso(sekarang()), dipakai: iso(sekarang()), dicabut: null }, row);
      t.sesi.push(s); return Object.assign({}, s);
    },
    async sesiAmbil(sha) { const s = t.sesi.find((x) => x.token_sha256 === sha); return s ? Object.assign({}, s) : null; },
    async sesiPerbarui(id, patch) { const s = t.sesi.find((x) => x.id === id); if (s) Object.assign(s, patch); },
    async logPerangkat(row) { t.log.push(Object.assign({ dibuat: iso(sekarang()) }, row)); },
    async batasTambah(kunci, detik) {
      const j = Math.floor(sekarang() / 1000 / detik) * detik;
      const k = kunci + '@' + j;
      const n = (t.batas.get(k) || 0) + 1; t.batas.set(k, n); return n;
    },
    /* meniru kosan_batas_kembali: jendela sama dengan batasTambah, tidak di bawah 0 */
    async batasKembali(kunci, detik) {
      const j = Math.floor(sekarang() / 1000 / detik) * detik;
      const k = kunci + '@' + j;
      if (t.batas.get(k) > 0) t.batas.set(k, t.batas.get(k) - 1);
    },
    /* meniru kosan_gerbang_ambil/lepas: atomik karena JS satu thread dan
       tidak ada await di dalamnya */
    async gerbangAmbil(kunci, g) {
      const now = sekarang();
      const baru = !t.gerbang.has(kunci);
      const x = t.gerbang.get(kunci) || { n: 0, terakhir: now, kunci: 0 };
      if (x.kunci > now) { t.gerbang.set(kunci, x); return false; }
      if (baru || x.terakhir < now - g.jendelaDetik * 1000) {
        const m = /^pin:(\d{1,2})$/.exec(kunci);
        if (m) hapusAttempts(+m[1]);
        x.n = 0; x.kunci = 0;
      } else if (x.kunci) { x.n = 0; x.kunci = 0; }
      x.n += 1; x.terakhir = now;
      if (x.n > g.maks) { x.kunci = now + g.kunciDetik * 1000; t.gerbang.set(kunci, x); return false; }
      t.gerbang.set(kunci, x); return true;
    },
    async gerbangLepas(kunci) { const x = t.gerbang.get(kunci); if (x && x.n > 0) x.n -= 1; },

    /* ---- Kerja & Belanja: tiruan fungsi SQL (atomik: tanpa await di dalam) ---- */
    async dompetBaca({ room, nama, tanggal, bulan, maksDetik }) {
      panggilan.push('dompetBaca');
      kedaluwarsakan(room, nama, maksDetik);
      const k = kunciP(room, nama), milik = (s) => s.room === room && s.nama_norm === nama;
      const aktif = t.shift.filter((s) => milik(s) && s.status === 'aktif').sort((a, b) => b.mulai - a.mulai)[0];
      const selesai = t.shift.filter((s) => milik(s) && s.status === 'selesai');
      return {
        saldo: t.dompet.has(k) ? t.dompet.get(k) : 0,
        pekerjaan: [...t.pekerjaan.values()].filter(milik).sort((a, b) => (a.pekerjaan < b.pekerjaan ? -1 : 1)).map((p) => ({ pekerjaan: p.pekerjaan, shift_total: p.shift_total })),
        shift_hari_ini: selesai.filter((s) => s.tanggal === tanggal).length,
        shift_aktif: aktif ? { id: aktif.id, pekerjaan: aktif.pekerjaan, mulai: iso(aktif.mulai) } : null,
        terakhir_selesai: selesai.length ? iso(Math.max(...selesai.map((s) => s.selesai))) : null,
        sewa_bulan: bulan, sewa_lunas: t.sewa.has(k + '|' + bulan),
        barang: [...(t.barang.get(k) || [])],
        riwayat: t.mutasi.filter(milik).sort((a, b) => b.id - a.id).slice(0, 10)
          .map((m) => ({ jumlah: m.jumlah, jenis: m.jenis, keterangan: m.keterangan, saldo_sesudah: m.saldo_sesudah, dibuat: m.dibuat })),
        sekarang: iso(sekarang())
      };
    },
    async kerjaDaftar({ room, nama, pekerjaan }) {
      if (PEKERJAAN_SQL.indexOf(pekerjaan) === -1) raise('pekerjaan tidak valid');
      const k = kunciP(room, nama) + '|' + pekerjaan;
      if (!t.pekerjaan.has(k)) t.pekerjaan.set(k, { room, nama_norm: nama, pekerjaan, shift_total: 0, terdaftar: iso(sekarang()) });
      return { pekerjaan, shift_total: t.pekerjaan.get(k).shift_total };
    },
    async kerjaMulai({ room, nama, pekerjaan, tanggal, maksHari, jedaDetik, maksDetik }) {
      panggilan.push('kerjaMulai');
      if (!t.pekerjaan.has(kunciP(room, nama) + '|' + pekerjaan)) raise('belum_daftar');
      kedaluwarsakan(room, nama, maksDetik);
      const now = sekarang(), milik = (s) => s.room === room && s.nama_norm === nama;
      const selesai = t.shift.filter((s) => milik(s) && s.status === 'selesai');
      if (selesai.filter((s) => s.tanggal === tanggal).length >= maksHari) raise('batas_hari');
      const terakhir = selesai.length ? Math.max(...selesai.map((s) => s.selesai)) : 0;
      if (terakhir && terakhir > now - jedaDetik * 1000) raise('jeda:' + Math.ceil((terakhir + jedaDetik * 1000 - now) / 1000));
      for (const s of t.shift) if (milik(s) && s.status === 'aktif') { s.status = 'batal'; s.selesai = now; } /* satu shift aktif per penghuni */
      const s = { id: crypto.randomUUID(), room, nama_norm: nama, pekerjaan, tanggal, mulai: now, selesai: null, status: 'aktif', gaji: null, tip: null, benar: null, salah: null };
      t.shift.push(s);
      return { id: s.id, mulai: iso(now) };
    },
    async kerjaShift({ room, nama, shift }) {
      const s = t.shift.find((x) => x.id === shift && x.room === room && x.nama_norm === nama);
      if (!s) return null;
      const p = t.pekerjaan.get(kunciP(room, nama) + '|' + s.pekerjaan);
      return { pekerjaan: s.pekerjaan, status: s.status, detik: Math.floor((sekarang() - s.mulai) / 1000), shift_total: p ? p.shift_total : 0 };
    },
    async kerjaSelesai({ room, nama, shift, gaji, tip, benar, salah, minDetik, maksDetik, keterangan }) {
      panggilan.push('kerjaSelesai');
      if (!(gaji >= 0 && tip >= 0 && gaji + tip <= 20000)) raise('upah tidak valid');
      const s = t.shift.find((x) => x.id === shift && x.room === room && x.nama_norm === nama);
      if (!s) raise('shift_tidak_ada');
      if (s.status !== 'aktif') raise('shift_tidak_aktif');
      const now = sekarang();
      if (now - s.mulai < minDetik * 1000) raise('terlalu_cepat');
      if (now - s.mulai > maksDetik * 1000) raise('kedaluwarsa');
      Object.assign(s, { status: 'selesai', selesai: now, gaji, tip, benar, salah });
      const kp = kunciP(room, nama) + '|' + s.pekerjaan;
      if (!t.pekerjaan.has(kp)) t.pekerjaan.set(kp, { room, nama_norm: nama, pekerjaan: s.pekerjaan, shift_total: 0, terdaftar: iso(now) });
      const p = t.pekerjaan.get(kp); p.shift_total += 1;
      const k = kunciP(room, nama), saldo = (t.dompet.get(k) || 0) + gaji + tip;
      t.dompet.set(k, saldo);
      if (gaji + tip > 0) catatMutasi(room, nama, gaji + tip, 'gaji', keterangan, saldo);
      return { saldo, shift_total: p.shift_total, pekerjaan: s.pekerjaan };
    },
    async kerjaBatal({ room, nama, shift }) {
      const s = t.shift.find((x) => x.id === shift && x.room === room && x.nama_norm === nama && x.status === 'aktif');
      if (!s) return false;
      s.status = 'batal'; s.selesai = sekarang();
      return true;
    },
    async beli({ room, nama, barang, harga, unik, keterangan }) {
      panggilan.push('beli');
      if (!(Number.isInteger(harga) && harga > 0 && harga <= 1000000)) raise('harga tidak valid');
      const k = kunciP(room, nama);
      const milik = t.barang.get(k) || new Set();
      if (unik && milik.has(barang)) raise('sudah_punya');
      const saldo = t.dompet.get(k) || 0;
      if (saldo < harga) raise('saldo_kurang');
      if (unik) { milik.add(barang); t.barang.set(k, milik); }
      t.dompet.set(k, saldo - harga);
      catatMutasi(room, nama, -harga, 'beli', keterangan, saldo - harga);
      return { saldo: saldo - harga };
    },
    async sewaBayar({ room, nama, bulan, jumlah, keterangan }) {
      panggilan.push('sewaBayar');
      if (!(Number.isInteger(jumlah) && jumlah > 0 && jumlah <= 1000000)) raise('jumlah tidak valid');
      const k = kunciP(room, nama);
      if (t.sewa.has(k + '|' + bulan)) raise('sudah_lunas');
      const saldo = t.dompet.get(k) || 0;
      if (saldo < jumlah) raise('saldo_kurang');
      t.sewa.set(k + '|' + bulan, { jumlah, dibayar: iso(sekarang()) });
      t.dompet.set(k, saldo - jumlah);
      catatMutasi(room, nama, -jumlah, 'sewa', keterangan, saldo - jumlah);
      return { saldo: saldo - jumlah, bulan };
    },
    /* ---- Arkade Ria: tiruan kosan_skor_kirim / kosan_skor_papan (atomik: tanpa await di dalam) ---- */
    async skorKirim({ room, nama, game, minggu, skor, hadiah }) {
      panggilan.push('skorKirim');
      if (!(Number.isInteger(room) && room >= 1 && room <= 60)) raise('kamar tidak valid');
      if (['capit', 'balap', 'dansa'].indexOf(game) === -1) raise('game tidak valid');
      if (!(Number.isInteger(skor) && skor >= 0 && skor <= 100000)) raise('skor tidak valid');
      const k = kunciP(room, nama) + '|' + game + '|' + minggu;
      const lama = t.skor.get(k);
      const rekor = !lama || skor > lama.skor;
      if (!lama) t.skor.set(k, { room, nama_norm: nama, game, minggu, skor, main: 1, diperbarui: sekarang() });
      else { lama.main += 1; if (rekor) { lama.skor = skor; lama.diperbarui = sekarang(); } }
      let hadiahBaru = false;
      if (hadiah) {
        const kp = kunciP(room, nama), milik = t.barang.get(kp) || new Set();
        if (!milik.has(hadiah)) { milik.add(hadiah); t.barang.set(kp, milik); hadiahBaru = true; }
      }
      return { terbaik: t.skor.get(k).skor, rekor, hadiah_baru: hadiahBaru };
    },
    async skorPapan({ minggu, batas }) {
      panggilan.push('skorPapan');
      const out = [];
      for (const g of ['capit', 'balap', 'dansa']) {
        [...t.skor.values()].filter((r) => r.game === g && r.minggu === minggu && r.skor > 0)
          .sort((a, b) => b.skor - a.skor || a.diperbarui - b.diperbarui).slice(0, batas)
          .forEach((r) => out.push({ game: g, nama: r.nama_norm, skor: r.skor }));
      }
      return out;
    },
    /* Foto profil (18 Nov) — kunci objek = nomor kamar; _fotoUnggah menaruh
       objek seolah sudah di-PUT ke Storage lewat signed URL. */
    fotoUrlPublik(room) { return 'https://foto.test/foto-profil/' + room; },
    async fotoAmbil(room) { return t.foto.get(room) || null; },
    async fotoSimpan(room, url) { t.foto.set(room, { url, diperbarui: iso(sekarang()) }); },
    async fotoMintaUrl(room) { return { unggah: 'https://foto.test/unggah/' + room + '?token=uji' }; },
    async fotoUnduh(room) {
      if (!t.fotoObjek.has(room)) { const e = new Error('foto tidak ditemukan'); e.status = 404; throw e; }
      return Buffer.from(t.fotoObjek.get(room));
    },
    async fotoHapus(room) { t.fotoObjek.delete(room); },
    _fotoUnggah(room, buf) { t.fotoObjek.set(room, Buffer.from(buf)); }
  };
}

module.exports = { buatFakeDb };
