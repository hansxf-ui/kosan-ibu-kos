'use strict';
/* Ronde rasa aman, Fase A — logika endpoint (tanpa Vercel, tanpa fetch).
   Semua akses data lewat `db` (lihat db.js untuk Supabase, tests/fake-db.js
   untuk tes). Setiap handler menerima ctx { method, headers, body, ip } dan
   mengembalikan { status, body, cookies? }.
   Aturan: password + PIN + token sesi tidak pernah disimpan mentah, tidak
   pernah dikembalikan, tidak pernah ditulis ke log. */
const I = require('./inti');

const MENIT = 60 * 1000, JAM = 60 * MENIT, HARI = 24 * JAM;
const UMUR_INGAT = 30 * HARI; /* "Ingat saya": 30 hari, diperpanjang saat dipakai */
const UMUR_BIASA = 12 * JAM; /* tanpa "Ingat saya": batas server 12 jam */
const PERPANJANG_TIAP = JAM; /* tulis ulang dipakai/kedaluwarsa maks sekali per jam */
const UMUR_TIKET = 5 * MENIT;
const BATAS = { masuk: 20, setup: 20, kamar: 60 }; /* per HMAC-IP per jam */

function balas(status, body, cookies) { return cookies ? { status, body, cookies } : { status, body }; }
const galat = (status, kode, pesan) => balas(status, { galat: kode, pesan });

/* CSRF: cookie sudah SameSite=Strict; tambahan: POST wajib JSON (memaksa
   preflight lintas origin) dan origin/fetch-site harus sama. */
function cekPermintaan(ctx) {
  const h = ctx.headers || {};
  const ct = String(h['content-type'] || '');
  if (ct.split(';')[0].trim().toLowerCase() !== 'application/json') return galat(415, 'format', 'Format permintaan salah.');
  const site = h['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return galat(403, 'origin', 'Permintaan ditolak.');
  const origin = h.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { return galat(403, 'origin', 'Permintaan ditolak.'); }
    if (!h.host || host !== h.host) return galat(403, 'origin', 'Permintaan ditolak.');
  }
  if (!ctx.body || typeof ctx.body !== 'object' || Array.isArray(ctx.body)) return galat(400, 'format', 'Format permintaan salah.');
  return null;
}

function akunBerlaku(akun, penghuni) {
  return !!(akun && penghuni && akun.password_hash && akun.nama_norm === I.normalize(penghuni.name));
}

function buatApp({ db, rahasia, sekarang = () => Date.now(), aman = true }) {
  if (!db) throw new Error('db wajib');
  if (typeof rahasia !== 'string' || rahasia.length < 32) throw new Error('KOSAN_SECRET minimal 32 karakter');

  async function lewatBatas(jenis, ctx) {
    const ip = I.ipHmac(rahasia, ctx.ip).ip_hmac || 'tanpa-ip';
    const n = await db.batasTambah(jenis + ':' + ip, 3600);
    return n > BATAS[jenis];
  }
  async function catat(peristiwa, room, ctx) {
    const ip = I.ipHmac(rahasia, ctx.ip);
    try {
      await db.logPerangkat({ room, peristiwa, perangkat: I.perangkatSah(ctx.body && ctx.body.perangkat),
        ip_hmac: ip.ip_hmac, ip_prefiks_hmac: ip.ip_prefiks_hmac });
    } catch (e) { /* log gagal tidak boleh menggagalkan login */ }
  }
  async function bukaSesi(penghuni, ingat) {
    const token = I.tokenAcak();
    const now = sekarang();
    await db.sesiBuat({ room: penghuni.room, nama_norm: I.normalize(penghuni.name), token_sha256: I.sha256hex(token),
      ingat: !!ingat, kedaluwarsa: new Date(now + (ingat ? UMUR_INGAT : UMUR_BIASA)).toISOString() });
    return I.cookieSesi(token, { ingat: !!ingat, aman, maxAgeDetik: UMUR_INGAT / 1000 });
  }
  /* Sesi sah = token cocok, belum dicabut/kedaluwarsa, akun masih punya
     password yang dibuat SEBELUM sesi ini, dan kamar masih milik nama yang
     sama. Mengembalikan { sesi, token, penghuni, akun } atau null. */
  async function sesiDari(ctx) {
    const token = I.bacaCookie((ctx.headers || {}).cookie, I.namaCookie(aman));
    if (!token) return { ada: false };
    const s = await db.sesiAmbil(I.sha256hex(token));
    const now = sekarang();
    if (!s || s.dicabut || Date.parse(s.kedaluwarsa) <= now) return { ada: true };
    const akun = await db.akunAmbil(s.room);
    if (!akun || !akun.password_hash || akun.nama_norm !== s.nama_norm) return { ada: true };
    if (akun.password_dibuat && Date.parse(akun.password_dibuat) > Date.parse(s.dibuat)) return { ada: true };
    const penghuni = I.penghuniKamar(await db.occupants(), s.room);
    if (!penghuni || I.normalize(penghuni.name) !== s.nama_norm) return { ada: true };
    return { ada: true, sah: { sesi: s, token, penghuni, akun } };
  }
  const hasilMasuk = (penghuni, akun) => ({ room: penghuni.room, name: penghuni.name, gender: akun.gender });

  /* POST /api/masuk {username, password, ingat, perangkat} */
  async function masuk(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { username, password, ingat } = ctx.body;
    /* password kosong boleh: penghuni lama yang belum punya password cukup
       ketik username lalu diarahkan ke langkah PIN (perlu_setup). */
    if (!I.usernameValid(username) || typeof password !== 'string' || password.length > 128) {
      return galat(400, 'format', 'Isi username dulu ya.');
    }
    if (await lewatBatas('masuk', ctx)) return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi nanti.');
    const penghuni = I.cariPenghuni(await db.occupants(), username);
    if (!penghuni) return galat(401, 'salah', 'Username atau password salah.');
    const akun = await db.akunAmbil(penghuni.room);
    if (!akunBerlaku(akun, penghuni)) return balas(200, { perlu_setup: true });
    if (!password) return galat(400, 'password_kosong', 'Masukkan password-mu.');
    if (akun.kunci_sampai && Date.parse(akun.kunci_sampai) > sekarang()) {
      return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi 15 menit lagi.');
    }
    if (!(await I.cekPassword(password, akun.password_hash))) {
      await db.akunGagal(penghuni.room);
      return galat(401, 'salah', 'Username atau password salah.');
    }
    if (akun.gagal_count > 0) await db.akunBerhasil(penghuni.room);
    const cookie = await bukaSesi(penghuni, ingat === true);
    await catat('masuk', penghuni.room, ctx);
    return balas(200, hasilMasuk(penghuni, akun), [cookie]);
  }

  /* POST /api/setup/pin {username, pin, perangkat} — login pertama penghuni lama */
  async function setupPin(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { username, pin } = ctx.body;
    if (!I.usernameValid(username) || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return galat(400, 'format', 'Masukkan PIN kamar 6 digit.');
    }
    if (await lewatBatas('setup', ctx)) return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi nanti.');
    const penghuni = I.cariPenghuni(await db.occupants(), username);
    if (!penghuni) return galat(401, 'tidak_terdaftar', 'Username belum terdaftar.');
    const akun = await db.akunAmbil(penghuni.room);
    if (akunBerlaku(akun, penghuni)) return galat(409, 'sudah_setup', 'Akun ini sudah punya password. Masuk pakai password ya.');
    const r = await db.loginPin(penghuni.name, I.pinHash(pin));
    if (r.terkunci) return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi 15 menit lagi.');
    if (!r.ok) return galat(401, 'pin_salah', 'PIN salah. Coba lagi ya.');
    const gender = r.row && r.row.gender === 'Cowok' ? 'cowok' : 'cewek';
    const tiket = I.buatTiket(rahasia, { room: penghuni.room, nama_norm: I.normalize(penghuni.name), gender, exp: sekarang() + UMUR_TIKET });
    await catat('setup_pin', penghuni.room, ctx);
    return balas(200, { tiket });
  }

  /* POST /api/setup/password {tiket, password, ingat, perangkat} */
  async function setupPassword(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { tiket, password, ingat } = ctx.body;
    const t = I.bacaTiket(rahasia, tiket, sekarang());
    if (!t) return galat(401, 'tiket_habis', 'Waktunya habis. Masukkan PIN kamarmu lagi ya.');
    const penghuni = I.penghuniKamar(await db.occupants(), t.room);
    if (!penghuni || I.normalize(penghuni.name) !== t.nama_norm) return galat(409, 'kamar_berubah', 'Data kamar berubah. Ulangi dari awal ya.');
    const aturan = I.cekAturanPassword(password, penghuni.name);
    if (aturan) return galat(400, 'password_lemah', aturan);
    const hash = await I.hashPassword(password);
    const ok = await db.akunSetup({ room: t.room, nama_norm: t.nama_norm, gender: t.gender, password_hash: hash });
    if (!ok) return galat(409, 'sudah_setup', 'Akun ini sudah punya password. Masuk pakai password ya.');
    const cookie = await bukaSesi(penghuni, ingat === true);
    await catat('setup', penghuni.room, ctx);
    return balas(200, { room: penghuni.room, name: penghuni.name, gender: t.gender }, [cookie]);
  }

  /* GET /api/sesi — "Ingat saya": cek cookie, perpanjang kalau perlu */
  async function sesi(ctx) {
    const s = await sesiDari(ctx);
    if (!s.sah) return s.ada ? balas(401, { galat: 'perlu_login' }, [I.cookieHapus(aman)]) : galat(401, 'perlu_login', '');
    const { sesi: row, token, penghuni, akun } = s.sah;
    const now = sekarang();
    let cookies;
    if (row.ingat && now - Date.parse(row.dipakai) >= PERPANJANG_TIAP) {
      await db.sesiPerbarui(row.id, { dipakai: new Date(now).toISOString(), kedaluwarsa: new Date(now + UMUR_INGAT).toISOString() });
      cookies = [I.cookieSesi(token, { ingat: true, aman, maxAgeDetik: UMUR_INGAT / 1000 })];
    }
    return balas(200, hasilMasuk(penghuni, akun), cookies);
  }

  /* POST /api/keluar — cabut sesi + hapus cookie (selalu 200) */
  async function keluar(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const token = I.bacaCookie((ctx.headers || {}).cookie, I.namaCookie(aman));
    if (token) {
      const s = await db.sesiAmbil(I.sha256hex(token));
      if (s && !s.dicabut) await db.sesiPerbarui(s.id, { dicabut: new Date(sekarang()).toISOString() });
    }
    return balas(200, { ok: true }, [I.cookieHapus(aman)]);
  }

  /* POST /api/kamar/masuk {room, pin} — PIN dicek di server, tiap kali */
  async function kamarMasuk(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const s = await sesiDari(ctx);
    if (!s.sah) return galat(401, 'perlu_login', 'Masuk sebagai penghuni dulu ya.');
    const { room, pin } = ctx.body;
    if (!Number.isInteger(room) || room < 1 || room > 20) return galat(400, 'format', 'Kamar tidak valid.');
    if (room !== s.sah.penghuni.room) return galat(403, 'bukan_kamarmu', 'Ini bukan kamarmu.');
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return galat(400, 'format', 'Masukkan PIN kamar 6 digit.');
    if (await lewatBatas('kamar', ctx)) return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi nanti.');
    const r = await db.loginPin(s.sah.penghuni.name, I.pinHash(pin));
    if (r.terkunci) return galat(429, 'terkunci', 'Terlalu banyak percobaan — coba lagi 15 menit lagi.');
    if (!r.ok) return galat(401, 'pin_salah', 'PIN salah. Coba lagi ya.');
    return balas(200, { ok: true });
  }

  return { masuk, setupPin, setupPassword, sesi, keluar, kamarMasuk };
}

module.exports = { buatApp, UMUR_INGAT, UMUR_BIASA, UMUR_TIKET, BATAS };
