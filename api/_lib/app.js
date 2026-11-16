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
const K = require('./kerja');

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
/* Kerja & Belanja: batas per KAMAR (bukan per IP — penghuni di balik CGNAT operator seluler
   berbagi IP) per jam. Pemakaian wajar jauh di bawahnya (3 shift sehari = 9-12 panggilan). */
const BATAS_PENGHUNI = { dompet: 600, kerja: 120, belanja: 60 };
const PESAN_KERJA = {
  belum_daftar: 'Daftar dulu di papan lowongan ya.',
  batas_hari: 'Jatah kerja hari ini sudah habis (' + K.BATAS_KERJA.shiftHari + ' shift). Besok lagi ya!',
  jeda: 'Istirahat dulu sebentar sebelum shift berikutnya.',
  ada_shift: 'Kamu masih punya shift yang berjalan.',
  belum_buka: 'Ronda malam mulai jam 20.00 sampai 04.00 WIB.',
  shift_tidak_ada: 'Shift tidak ditemukan.',
  shift_tidak_aktif: 'Shift ini sudah tidak aktif.',
  terlalu_cepat: 'Shift belum selesai.',
  kedaluwarsa: 'Shift ini sudah kedaluwarsa (lebih dari 20 menit).',
  saldo_kurang: 'Saldo belum cukup — kerja dulu yuk.',
  sudah_punya: 'Barang ini sudah kamu punya.',
  sudah_lunas: 'Uang kos bulan ini sudah lunas. Makasih ya!'
};

const PESAN = {
  belumTerdaftar: 'Nama ini belum terdaftar sebagai penghuni — daftar dulu, atau masuk sebagai tamu.',
  pinSalah: 'PIN salah. Coba lagi ya.',
  pinSamaUsername: 'PIN tidak boleh sama dengan username.',
  namaTamu: 'Nama itu dipakai untuk tamu — pilih nama lain.',
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
/* Perbaikan 11 (M4): pola nama tamu otomatis (Tamu-N) tidak boleh didaftarkan. */
const namaPolaTamu = (nama) => /^tamu-[0-9]+$/.test(I.normalize(nama));
const genderDari = (g) => (g === 'Cowok' || g === 'cowok' ? 'cowok' : 'cewek');

/* Gedung C & D (15 Nov): 40 kamar; kunci KOSANC/KOSAND lewat RPC kosan_register_cd. */
const JUMLAH_KAMAR = 40;
const KUNCI_CD = ['KOSANC', 'KOSAND'];

function buatApp({ db, rahasia, sekarang = () => Date.now(), aman = true }) {
  if (!db) throw new Error('db wajib');
  if (typeof rahasia !== 'string' || rahasia.length < 32) throw new Error('KOSAN_SECRET minimal 32 karakter');

  const kunciBatas = (jenis, ctx) => jenis + ':' + I.kunciBatasIp(rahasia, ctx.ip);
  async function lewatBatas(jenis, ctx) {
    const n = await db.batasTambah(kunciBatas(jenis, ctx), 3600);
    return n > BATAS[jenis];
  }
  /* Perbaikan 11 (P1): yang BERHASIL mengembalikan satu unit jatah IP-nya,
     jadi batas per jaringan (CGNAT) hanya menghitung percobaan gagal /
     ditolak. Nilai BATAS tidak berubah. Best-effort: kalau pengembalian
     gagal (mis. fungsi SQL belum dipasang), login tetap sukses — perilaku
     jatuh ke cara lama (sukses ikut terhitung), tidak pernah lebih buruk. */
  async function kembalikanBatas(jenis, ctx) {
    try { await db.batasKembali(kunciBatas(jenis, ctx), 3600); }
    catch (e) { console.warn('[kosan] batasKembali gagal:', e && e.status, e && e.message); }
  }
  /* Verifikasi PIN lewat RPC lama kosan_login, di belakang gerbang per kamar. */
  async function cekPin(penghuni, pin) {
    if (!(await db.gerbangAmbil('pin:' + penghuni.room, GERBANG))) return 'terkunci';
    let r;
    try {
      r = await db.loginPin(penghuni.name, I.pinHash(pin));
    } catch (e) {
      /* Perbaikan 11 (M1): DB error/timeout bukan percobaan pengguna — kembalikan jatahnya, lalu lempar ulang (503 generik). */
      try { await db.gerbangLepas('pin:' + penghuni.room); } catch (e2) { /* abaikan */ }
      throw e;
    }
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
    /* Perbaikan 11 (P3): di LOGIN tidak ada cek charset — cukup normalize +
       panjang, lalu cocokkan ke daftar penghuni. Charset hanya saat DAFTAR. */
    const namaNorm = typeof username === 'string' ? I.normalize(username) : '';
    if (!namaNorm) return galat(400, 'format', 'Isi username dulu ya.');
    if (!pinSah(pin)) return galat(400, 'format', 'Masukkan PIN 6 digit.');
    if (await lewatBatas('masuk', ctx)) return galat(429, 'terkunci', PESAN.batas);
    const penghuni = namaNorm.length <= 30 ? I.cariPenghuni(await db.occupants(), username) : null;
    if (!penghuni) return galat(401, 'tidak_terdaftar', PESAN.belumTerdaftar);
    /* Catatan: aturan PIN != username TIDAK berlaku di login (penghuni lama
       yang PIN-nya kebetulan sama dengan username tetap bisa masuk). */
    const r = await cekPin(penghuni, pin);
    if (r === 'terkunci') return galat(429, 'terkunci', PESAN.terkunci);
    if (r === 'salah') return galat(401, 'pin_salah', PESAN.pinSalah);
    const gender = genderDari(r.row && r.row.gender);
    const cookie = await bukaSesi(penghuni, gender, ingat === true);
    await catat('masuk', penghuni.room, ctx);
    await kembalikanBatas('masuk', ctx);
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
    if (namaPolaTamu(username)) return galat(400, 'nama_tamu', PESAN.namaTamu);
    if (gender !== 'cewek' && gender !== 'cowok') return galat(400, 'format', 'Pilih gender dulu ya.');
    if (typeof kunci !== 'string' || !kunci.trim() || kunci.length > 20) return galat(400, 'kunci_salah', 'Kode kunci salah, cek lagi kode di caption terbaru @ibu__kos.');
    if (!pinSah(pin)) return galat(400, 'format', 'PIN harus 6 digit angka.');
    const pinHash = I.pinHash(pin);
    if (pinHash === I.pinHash(I.normalize(username))) return galat(400, 'pin_sama_username', PESAN.pinSamaUsername);
    if (await lewatBatas('daftar', ctx)) return galat(429, 'terkunci', PESAN.batas);
    try {
      const kunciUp = kunci.trim().toUpperCase();
      const args = { p_name: username.trim(), p_gender: gender === 'cowok' ? 'Cowok' : 'Cewek',
        p_key: kunciUp, p_pin_hash: pinHash, p_room: I.roomFor(username) };
      /* Gedung C & D: kunci KOSANC/KOSAND -> RPC baru (kamar kosong terendah
         di K21-30 / K31-40; p_room null). Kunci lain tetap ke kosan_register lama. */
      if (KUNCI_CD.indexOf(kunciUp) !== -1) await db.registerCd(Object.assign(args, { p_room: null }));
      else await db.register(args);
    } catch (e) {
      /* pesan RPC (mis. "nama sudah terdaftar", "kunci salah", "Gedung B
         penuh") diteruskan; klien memetakan ke teks yang ramah. */
      if (e && e.status && e.status < 500) return galat(400, 'daftar_ditolak', String(e.message || '').slice(0, 200));
      throw e;
    }
    const penghuni = I.cariPenghuni(await db.occupants(), username);
    if (!penghuni) return galat(503, 'server', 'Server lagi sibuk, coba lagi ya.');
    const cookie = await bukaSesi(penghuni, gender, ingat === true);
    await catat('setup', penghuni.room, ctx); /* 'setup' = daftar baru (lihat runbook; tanpa migrasi CHECK) */
    await kembalikanBatas('daftar', ctx);
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
    if (!Number.isInteger(room) || room < 1 || room > JUMLAH_KAMAR) return galat(400, 'format', 'Kamar tidak valid.'); /* Gedung C & D: 20 -> 40 */
    if (room !== s.sah.penghuni.room) return galat(403, 'bukan_kamarmu', 'Ini bukan kamarmu.');
    if (!pinSah(pin)) return galat(400, 'format', 'Masukkan PIN kamar 6 digit.');
    if (await lewatBatas('kamar', ctx)) return galat(429, 'terkunci', PESAN.batas);
    const r = await cekPin(s.sah.penghuni, pin);
    if (r === 'terkunci') return galat(429, 'terkunci', PESAN.terkunci);
    if (r === 'salah') return galat(401, 'pin_salah', PESAN.pinSalah);
    await kembalikanBatas('kamar', ctx);
    return balas(200, { ok: true });
  }

  /* ================= Kerja & Belanja (Ryan 16 Nov) =================
     Rupiah HANYA untuk penghuni (sesi cookie) dan disimpan di server. Setiap perubahan
     saldo lewat fungsi SQL atomik (supabase/migrations/20261116_kerja_belanja.sql). Upah
     dihitung di sini dari hasil kerja yang dilaporkan klien (dijepit, kerja.js), harga
     dari katalog server: klien tidak pernah mengirim angka uang. Durasi minimum shift,
     jatah 3 shift sehari, jeda 10 menit dan "satu shift aktif" ditegakkan di database. */
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  async function penghuniSesi(ctx, jenis) {
    const s = await sesiDari(ctx);
    if (!s.sah) return { tolak: galat(401, 'perlu_login', 'Masuk sebagai penghuni dulu ya.') };
    const room = s.sah.penghuni.room, nama = s.sah.sesi.nama_norm;
    if ((await db.batasTambah(jenis + ':kamar:' + room, 3600)) > BATAS_PENGHUNI[jenis]) return { tolak: galat(429, 'terkunci', 'Terlalu sering — tunggu sebentar ya.') };
    return { room, nama };
  }
  function galatKerja(e) { /* pesan RAISE dari fungsi SQL ('saldo_kurang', 'jeda:120', ...) -> 409 ramah; galat lain dilempar ulang (503) */
    const m = /^([a-z_]+)(?::(\d{1,6}))?$/.exec(String((e && e.message) || ''));
    if (!e || !e.status || e.status >= 500 || !m || !Object.prototype.hasOwnProperty.call(PESAN_KERJA, m[1])) return null;
    const body = { galat: m[1], pesan: PESAN_KERJA[m[1]] };
    if (m[2]) body.detik = +m[2];
    return balas(409, body);
  }
  function bentukDompet(d) {
    const pek = {};
    Object.keys(K.PEKERJAAN).forEach((id) => { pek[id] = { terdaftar: false, shift: 0, pangkat: 0 }; });
    (Array.isArray(d.pekerjaan) ? d.pekerjaan : []).forEach((p) => {
      const n = Number(p && p.shift_total) || 0;
      if (p && K.pekerjaanDari(p.pekerjaan)) pek[p.pekerjaan] = { terdaftar: true, shift: n, pangkat: K.pangkatDari(n) };
    });
    const nowDb = Date.parse(d.sekarang) || sekarang();
    const terakhir = d.terakhir_selesai ? Date.parse(d.terakhir_selesai) : 0;
    const a = d.shift_aktif && typeof d.shift_aktif.id === 'string' ? d.shift_aktif : null;
    return {
      saldo: Number(d.saldo) || 0,
      pekerjaan: pek,
      hariIni: { shift: Number(d.shift_hari_ini) || 0, maks: K.BATAS_KERJA.shiftHari },
      jedaDetik: terakhir ? Math.max(0, Math.ceil((terakhir + K.BATAS_KERJA.jedaDetik * 1000 - nowDb) / 1000)) : 0,
      shiftAktif: a ? { id: a.id, pekerjaan: a.pekerjaan, detik: Math.max(0, Math.floor((nowDb - Date.parse(a.mulai)) / 1000)) } : null,
      rondaBuka: K.rondaBuka(sekarang()),
      sewa: { bulan: d.sewa_bulan || K.bulanWib(sekarang()), label: K.bulanLabel(d.sewa_bulan || K.bulanWib(sekarang())), lunas: !!d.sewa_lunas, harga: K.SEWA_HARGA },
      barang: (Array.isArray(d.barang) ? d.barang : []).filter((b) => !!K.barangDari(b)),
      riwayat: (Array.isArray(d.riwayat) ? d.riwayat : []).slice(0, 10).map((r) => ({
        jumlah: Number(r.jumlah) || 0, jenis: String(r.jenis || ''), ket: String(r.keterangan || '').slice(0, 80),
        saldo: Number(r.saldo_sesudah) || 0, waktu: r.dibuat || null }))
    };
  }

  /* GET /api/dompet — saldo, status kerja, uang kos bulan ini, barang, 10 mutasi terakhir */
  async function dompet(ctx) {
    const p = await penghuniSesi(ctx, 'dompet'); if (p.tolak) return p.tolak;
    const now = sekarang();
    const d = await db.dompetBaca({ room: p.room, nama: p.nama, tanggal: K.tanggalWib(now), bulan: K.bulanWib(now), maksDetik: K.BATAS_KERJA.maksDetik });
    return balas(200, bentukDompet(d || {}));
  }

  /* POST /api/kerja {aksi: 'daftar'|'mulai'|'selesai'|'batal', pekerjaan?, shift?, hasil?} */
  async function kerja(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { aksi, pekerjaan, shift, hasil } = ctx.body;
    if (['daftar', 'mulai', 'selesai', 'batal'].indexOf(aksi) === -1) return galat(400, 'format', 'Aksi tidak dikenal.');
    if ((aksi === 'daftar' || aksi === 'mulai') && !K.pekerjaanDari(pekerjaan)) return galat(400, 'format', 'Pekerjaan tidak dikenal.');
    if ((aksi === 'selesai' || aksi === 'batal') && !(typeof shift === 'string' && UUID_RE.test(shift))) return galat(400, 'format', 'Shift tidak valid.');
    const p = await penghuniSesi(ctx, 'kerja'); if (p.tolak) return p.tolak;
    const now = sekarang();
    try {
      if (aksi === 'daftar') {
        await db.kerjaDaftar({ room: p.room, nama: p.nama, pekerjaan });
        return balas(200, { ok: true, pekerjaan });
      }
      if (aksi === 'mulai') {
        if (pekerjaan === 'ronda' && !K.rondaBuka(now)) return balas(409, { galat: 'belum_buka', pesan: PESAN_KERJA.belum_buka });
        const r = await db.kerjaMulai({ room: p.room, nama: p.nama, pekerjaan, tanggal: K.tanggalWib(now),
          maksHari: K.BATAS_KERJA.shiftHari, jedaDetik: K.BATAS_KERJA.jedaDetik, maksDetik: K.BATAS_KERJA.maksDetik });
        const job = K.PEKERJAAN[pekerjaan];
        return balas(200, { shift: r.id, pekerjaan, pesanan: job.pesanan, minDetik: job.minDetik });
      }
      if (aksi === 'batal') {
        await db.kerjaBatal({ room: p.room, nama: p.nama, shift });
        return balas(200, { ok: true });
      }
      /* selesai: pekerjaan + jumlah shift sebelum ini (pangkat) dari DB, upah dihitung di sini,
         lalu DB mengunci atomik: status aktif, milik kamar ini, durasi >= minDetik, < 20 menit */
      const s = await db.kerjaShift({ room: p.room, nama: p.nama, shift });
      if (!s) return balas(409, { galat: 'shift_tidak_ada', pesan: PESAN_KERJA.shift_tidak_ada });
      const job = K.pekerjaanDari(s.pekerjaan);
      if (!job) throw new Error('pekerjaan shift tidak dikenal');
      const u = K.upahShift(s.pekerjaan, Number(s.shift_total) || 0, hasil);
      const r = await db.kerjaSelesai({ room: p.room, nama: p.nama, shift, gaji: u.gaji, tip: u.tip, benar: u.benar, salah: u.salah,
        minDetik: job.minDetik, maksDetik: K.BATAS_KERJA.maksDetik, keterangan: 'Gaji ' + job.nama + (u.tip ? ' + tip' : '') });
      const total = Number(r.shift_total) || 0;
      return balas(200, { gaji: u.gaji, tip: u.tip, saldo: Number(r.saldo) || 0, pekerjaan: s.pekerjaan, shift: total,
        pangkat: K.pangkatDari(total), naikPangkat: K.pangkatDari(total) > u.pangkat });
    } catch (e) {
      const g = galatKerja(e); if (g) return g;
      throw e;
    }
  }

  /* POST /api/belanja {aksi: 'beli', barang} | {aksi: 'sewa'} — harga dari katalog server */
  async function belanja(ctx) {
    const tolak = cekPermintaan(ctx); if (tolak) return tolak;
    const { aksi, barang } = ctx.body;
    if (aksi !== 'beli' && aksi !== 'sewa') return galat(400, 'format', 'Aksi tidak dikenal.');
    const item = aksi === 'beli' ? K.barangDari(barang) : null;
    if (aksi === 'beli' && !item) return galat(400, 'format', 'Barang tidak dikenal.');
    const p = await penghuniSesi(ctx, 'belanja'); if (p.tolak) return p.tolak;
    try {
      if (aksi === 'beli') {
        const r = await db.beli({ room: p.room, nama: p.nama, barang, harga: item.harga, unik: item.jenis !== 'kafe', keterangan: 'Beli ' + item.nama });
        return balas(200, { saldo: Number(r.saldo) || 0, barang });
      }
      const bulan = K.bulanWib(sekarang());
      const r = await db.sewaBayar({ room: p.room, nama: p.nama, bulan, jumlah: K.SEWA_HARGA, keterangan: 'Uang kos ' + K.bulanLabel(bulan) });
      return balas(200, { saldo: Number(r.saldo) || 0, bulan, label: K.bulanLabel(bulan) });
    } catch (e) {
      const g = galatKerja(e); if (g) return g;
      throw e;
    }
  }

  return { masuk, setupPin: masuk, daftar, sesi, keluar, kamarMasuk, dompet, kerja, belanja };
}

module.exports = { buatApp, UMUR_INGAT, UMUR_BIASA, BATAS, GERBANG, PESAN, JUMLAH_KAMAR, KUNCI_CD, BATAS_PENGHUNI, PESAN_KERJA };
