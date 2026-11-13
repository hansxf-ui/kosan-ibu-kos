'use strict';
/* Database palsu di memori untuk tes. Meniru perilaku RPC + tabel di
   supabase/migrations/20261113_rasa_aman_fase_a.sql dan RPC lama
   kosan_login / kosan_occupants (yang tidak ada di repo). PIN di sini
   PIN UJI, bukan PIN penghuni asli. */
const crypto = require('node:crypto');
const { pinHash } = require('../api/_lib/inti');

function buatFakeDb({ penghuni, sekarang = () => Date.now() }) {
  /* penghuni: [{ room, name, gender: 'Cewek'|'Cowok', pin }] */
  const lama = penghuni.map((p) => ({ room: p.room, name: p.name, gender: p.gender, pin_hash: pinHash(p.pin), gagal: 0, kunci: 0 }));
  const t = { akun: new Map(), sesi: [], log: [], batas: new Map(), gerbang: new Map() };
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
    async akunSetup(a) {
      if (!/^scrypt\$/.test(a.password_hash)) throw new Error('hash tidak valid');
      const ada = t.akun.get(a.room);
      if (ada && ada.password_hash && ada.nama_norm === a.nama_norm) return false;
      t.akun.set(a.room, { room: a.room, nama_norm: a.nama_norm, gender: a.gender, password_hash: a.password_hash,
        password_dibuat: iso(sekarang()), gagal_count: 0, gagal_sejak: null, kunci_sampai: null });
      for (const s of t.sesi) if (s.room === a.room && s.nama_norm !== a.nama_norm && !s.dicabut) s.dicabut = iso(sekarang());
      return true;
    },
    async akunGagal(room) {
      const a = t.akun.get(room); if (!a) return;
      const basi = !a.gagal_sejak || Date.parse(a.gagal_sejak) < sekarang() - 15 * 60000;
      a.gagal_count = basi ? 1 : a.gagal_count + 1;
      if (basi) a.gagal_sejak = iso(sekarang());
      if (a.gagal_count >= 5) { a.kunci_sampai = iso(sekarang() + 15 * 60000); a.gagal_count = 0; a.gagal_sejak = null; }
    },
    async akunBerhasil(room) { const a = t.akun.get(room); if (a) { a.gagal_count = 0; a.gagal_sejak = null; } },
    async akunBuka(room) {
      t.gerbang.delete('pin:' + room); t.gerbang.delete('pw:' + room); hapusAttempts(room);
      const a = t.akun.get(room); if (a) Object.assign(a, { kunci_sampai: null, gagal_count: 0, gagal_sejak: null });
    },
    async akunReset(room) {
      t.gerbang.delete('pin:' + room); t.gerbang.delete('pw:' + room); hapusAttempts(room);
      const a = t.akun.get(room);
      if (a) Object.assign(a, { password_hash: null, password_dibuat: null, gagal_count: 0, gagal_sejak: null, kunci_sampai: null });
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
    async gerbangLepas(kunci) { const x = t.gerbang.get(kunci); if (x && x.n > 0) x.n -= 1; }
  };
}

module.exports = { buatFakeDb };
