'use strict';
/* Ronde rasa aman, Fase A — logika endpoint (tanpa Vercel, tanpa fetch).
   Semua akses data lewat `db` (lihat db.js untuk Supabase, tests/fake-db.js
   untuk tes). Setiap handler menerima ctx { method, headers, body, ip } dan
   mengembalikan { status, body, cookies? }.

   Perbaikan 9 (keputusan Ryan 14 Nov 14:53/14:58/15:00): lapisan password
   DICABUT TOTAL — login penghuni = username + PIN (keypad), PIN benar
   langsung membuat sesi. Tidak ada password, scrypt, tiket setup, maupun
   cek HIBP di alur mana pun.
   Aturan: PIN + token sesi tidak pernah disimpan mentah, tidak pernah
   dikembalikan, tidak pernah ditulis ke log. */
const I = require('./inti');

const MENIT = 60 * 1000, JAM = 60 * MENIT, HARI = 24 * JAM;
const UMUR_INGAT = 30 * HARI; /* "Ingat saya": 30 hari, diperpanjang saat dipakai */
const UMUR_BIASA = 12 * JAM; /* tanpa "Ingat saya": batas server 12 jam */
const PERPANJANG_TIAP = JAM; /* tulis ulang dipakai/kedaluwarsa maks sekali per jam */
const BATAS = { masuk: 20, daftar: 20, kamar: 60 }; /* per jaringan (HMAC IP, IPv6 per /64) per jam */
/* Gerbang percobaan PIN per kamar, DICADANGKAN sebelum verifikasi (atomik
   di DB), jadi permintaan paralel tidak bisa melewatinya. Percobaan yang
   berhasil dikembalikan. Selama terkunci, PIN benar maupun salah dijawab
   SAMA dan kosan_login tidak dipanggil (kunci lama kosan_login bisa jadi
   penunjuk PIN). Jendela geser dari percobaan TERAKHIR; saat gerbang mulai
   dari nol karena sepi, kosan_gerbang_ambil ikut menghapus
   kosan_login_attempts kamar itu (tanpa dobel-hitung).
   Trade-off yang DITERIMA: orang yang tahu username bisa terus mengunci
   akun (6 tebakan tiap 20 menit). Pemilik membuka dengan
   kosan_akun_buka(N) — lihat docs/RASA-AMAN-FASE-A.md. */
const GERBANG = { maks: 5, jendelaDetik: 15 * 60, kunciDetik: 20 * 60 };

const PESAN = {
  belumTerdaftar: 'Nama ini belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu.',
  pinSalah: 'PIN salah. Coba lagi ya.',
  pinSamaUsername: 'PIN tidak boleh sama dengan username.',
  terkunci: 'Terlalu banyak percobaan — coba lagi sekitar 20 menit lagi.',
  batas: 'Terlalu banyak percobaan — coba lagi nanti.'
};

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
const pinSah = (pin) => typeof pin === 'string' && /^\d{6}$/.test(pin);
const genderDari = (g) => (g === 'Cowok' || g === 'cowok' ? 'cowok' : 'cewek');

function buatApp({ db, rahasia, sekarang = () => Date.now(), aman = true }) {
  if (!db) throw new Error('db wajib');
  if (typeof rahasia !== 'string' || rahasia.length < 32) throw new Error('KOSAN_SECRET minimal 32 karakter');

  async function lewatBatas(jenis, ctx) {
    const n = await db.batasTambah(jenis + ':' + I.kunciBatasIp(rahasia, ctx.ip), 3600);
    return n > BATAS[jenis];
  }
  /* Verifikasi PIN lewat RPC lama kosan_login, di belakang gerbang per kamar. */
  async function cekPin(penghuni, pin) {
    if (!(await db.gerbangAmbil('pin:' + penghuni.room, GERBANG))) return 'terkunci';
    const r = await db.loginPin(penghuni.name, I.pinHash(pin));
    if (r.ok) { await db.gerbangLepas('pin:' + penghuni.room); return { row: r.row }; }
    return r.terkunci ? 'terkunci' : 'salah';
  }
  async function catat(peristiwa, room, ctx) {
    const ip = I.ipHmac(rahasia, ctx.ip);
    try {
      await db.logPerangkat({ room, peristiwa, perangkat: I.perangkatSah(ctx.body && ctx.body.perangkat),
        ip_hmac: ip.ip_hmac, ip_prefiks_hmac: ip.ip_prefiks_hmac });
    } catch (e) { /* log gagal tidak boleh menggagalkan login */ }
  }
  /* Buka sesi + simpan gender terdaftar di kosan_akun (tabel Fase A; kolom
     password di sana tidak dipakai lagi) supaya /api/sesi bisa
     mengembalikannya. Data penghuni lama tidak disentuh. */
  async function bukaSesi(penghuni, gender, ingat) {
    const nama_norm = I.normalize(penghuni.name);
    await db.akunSimpan({ room: penghuni.room, nama_norm, gender });
    const token = I.tokenAcak();
    const now = sekarang();
    await db.sesiBuat({ room: penghuni.room, nama_norm, token_sha256: I.sha256hex(token),
      ingat: !!ingat, kedaluwarsa: new Date(now + (ingat ? UMUR_INGAT : UMUR_BIASA)).toISOString() });
    return I.cookieSesi(token, { ingat: !!ingat, aman, maxAgeDetik: UMUR_INGAT / 1000 });
  }
  /* Sesi sah = token cocok, belum dicabut/kedaluwarsa, dan kamar masih
     milik nama yang sama. (Reset/pencabutan oleh pemilik = dicabut.) */
  async function sesiDari(ctx) {
    const token = I.bacaCookie((ctx.headers || {}).cookie, I.namaCookie(aman));
    if (!token) return { ada: false };
    const s = await db.sesiAmbil(I.sha256hex(token));
    if (!s || s.dicabut || Date.parse(s.kedaluwarsa) <= sekarang()) return { ada: true };
    const penghuni = I.penghuniKamar(await db.occupants(), s.room);
    if (!penghuni || I.normalize(penghuni.name) !== s.nama_norm) return { ada: true };
    const akun = await db.akunAmbil(s.room);
    const gender = akun && akun.nama_norm === s.nama_norm ? akun.gender : 'cewek';
    return { ada: true, sah: { sesi: s, token, penghuni, gender } };
  }
  const hasilMasuk = (penghuni, gender) => ({ room: penghuni.room, name: penghuni.name, gender });

  /* POST /api/masuk {username, pin, ingat, perangkat} — login penghuni:
     PIN benar -> sesi langsung dibuat. (/api/setup/pin = alias yang sama.) */
  async function masuk(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { username, pin, ingat } = ctx.body;
    if (!I.usernameValid(username)) return galat(400, 'format', 'Isi username dulu ya.');
    if (!pinSah(pin)) return galat(400, 'format', 'Masukkan PIN 6 digit.');
    if (await lewatBatas('masuk', ctx)) return galat(429, 'terkunci', PESAN.batas);
    const penghuni = I.cariPenghuni(await db.occupants(), username);
    if (!penghuni) return galat(401, 'tidak_terdaftar', PESAN.belumTerdaftar);
    /* Catatan: aturan PIN != username TIDAK berlaku di login (penghuni lama
       yang PIN-nya kebetulan sama dengan username tetap bisa masuk). */
    const r = await cekPin(penghuni, pin);
    if (r === 'terkunci') return galat(429, 'terkunci', PESAN.terkunci);
    if (r === 'salah') return galat(401, 'pin_salah', PESAN.pinSalah);
    const gender = genderDari(r.row && r.row.gender);
    const cookie = await bukaSesi(penghuni, gender, ingat === true);
    await catat('masuk', penghuni.room, ctx);
    return balas(200, hasilMasuk(penghuni, gender), [cookie]);
  }

  /* POST /api/daftar {username, gender, kunci, pin, ingat, perangkat} —
     daftar penghuni baru lewat server (aturan PIN != username ditegakkan di
     sini), lalu memanggil RPC lama kosan_register dengan service role
     (definisinya tidak diubah) dan langsung membuat sesi. */
  async function daftar(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { username, gender, kunci, pin, ingat } = ctx.body;
    if (!I.usernameValid(username)) return galat(400, 'username_tidak_valid', 'Username hanya boleh huruf, angka, spasi, _ . - (maks 30 karakter).');
    if (gender !== 'cewek' && gender !== 'cowok') return galat(400, 'format', 'Pilih gender dulu ya.');
    if (typeof kunci !== 'string' || !kunci.trim() || kunci.length > 20) return galat(400, 'kunci_salah', 'Kode kunci salah, cek lagi kode di caption terbaru @ibu__kos.');
    if (!pinSah(pin)) return galat(400, 'format', 'PIN harus 6 digit angka.');
    const pinHash = I.pinHash(pin);
    if (pinHash === I.pinHash(I.normalize(username))) return galat(400, 'pin_sama_username', PESAN.pinSamaUsername);
    if (await lewatBatas('daftar', ctx)) return galat(429, 'terkunci', PESAN.batas);
    try {
      await db.register({ p_name: username.trim(), p_gender: gender === 'cowok' ? 'Cowok' : 'Cewek',
        p_key: kunci.trim().toUpperCase(), p_pin_hash: pinHash, p_room: I.roomFor(username) });
    } catch (e) {
      /* pesan RPC (mis. "nama sudah terdaftar", "kunci salah", "Gedung B
         penuh") diteruskan; klien memetakan ke teks yang ramah. */
      if (e && e.status && e.status < 500) return galat(400, 'daftar_ditolak', String(e.message || '').slice(0, 200));
      throw e;
    }
    const penghuni = I.cariPenghuni(await db.occupants(), username);
    if (!penghuni) return galat(503, 'server', 'Server lagi sibuk, coba lagi ya.');
    const cookie = await bukaSesi(penghuni, gender, ingat === true);
    await catat('setup', penghuni.room, ctx);
    return balas(200, hasilMasuk(penghuni, gender), [cookie]);
  }

  /* GET /api/sesi — "Ingat saya": cek cookie, perpanjang kalau perlu */
  async function sesi(ctx) {
    const s = await sesiDari(ctx);
    if (!s.sah) return s.ada ? balas(401, { galat: 'perlu_login' }, [I.cookieHapus(aman)]) : galat(401, 'perlu_login', '');
    const { sesi: row, token, penghuni, gender } = s.sah;
    const now = sekarang();
    let cookies;
    if (row.ingat && now - Date.parse(row.dipakai) >= PERPANJANG_TIAP) {
      await db.sesiPerbarui(row.id, { dipakai: new Date(now).toISOString(), kedaluwarsa: new Date(now + UMUR_INGAT).toISOString() });
      cookies = [I.cookieSesi(token, { ingat: true, aman, maxAgeDetik: UMUR_INGAT / 1000 })];
    }
    return balas(200, hasilMasuk(penghuni, gender), cookies);
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
    if (!pinSah(pin)) return galat(400, 'format', 'Masukkan PIN kamar 6 digit.');
    if (await lewatBatas('kamar', ctx)) return galat(429, 'terkunci', PESAN.batas);
    const r = await cekPin(s.sah.penghuni, pin);
    if (r === 'terkunci') return galat(429, 'terkunci', PESAN.terkunci);
    if (r === 'salah') return galat(401, 'pin_salah', PESAN.pinSalah);
    return balas(200, { ok: true });
  }

  return { masuk, setupPin: masuk, daftar, sesi, keluar, kamarMasuk };
}

module.exports = { buatApp, UMUR_INGAT, UMUR_BIASA, BATAS, GERBANG, PESAN };
