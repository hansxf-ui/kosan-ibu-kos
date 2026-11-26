'use strict';
/* Adapter Supabase (PostgREST) untuk Fase A. Memakai SERVICE ROLE dari env
   Vercel — kunci ini TIDAK PERNAH ada di repo atau di browser. Tanpa SDK,
   hanya fetch bawaan Node. */

function buatDb({ url, kunci, fetchFn = globalThis.fetch }) {
  if (!url || !kunci) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi');
  const dasar = url.replace(/\/+$/, '') + '/rest/v1/';
  /* Kunci baru (sb_secret_...) bukan JWT: cukup header apikey. Kunci lama
     (JWT service_role) dikirim juga sebagai Bearer. */
  const auth = kunci.startsWith('sb_') ? { apikey: kunci } : { apikey: kunci, Authorization: 'Bearer ' + kunci };

  async function panggil(path, { method = 'GET', body, prefer } = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, auth);
    if (prefer) headers.Prefer = prefer;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    let r;
    try {
      r = await fetchFn(dasar + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    } finally { clearTimeout(t); }
    const teks = await r.text();
    let j = null;
    try { j = teks ? JSON.parse(teks) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const e = new Error((j && j.message) || ('supabase ' + r.status));
      e.status = r.status;
      throw e;
    }
    return j;
  }
  const rpc = (fn, args) => panggil('rpc/' + fn, { method: 'POST', body: args || {} });
  /* ---- Foto profil (18 Nov): Supabase Storage, bucket `foto-profil` (public,
     dibuat via SQL — migrasi 20261118_foto_profil.sql). Server memakai
     SERVICE ROLE dari env — kunci ini TIDAK PERNAH ada di repo atau browser.
     File TIDAK lewat Vercel: klien PUT langsung ke signed upload URL. ---- */
  const dasarStorage = url.replace(/\/+$/, '') + '/storage/v1/';
  const FOTO_BUCKET = 'foto-profil';
  const FOTO_MAKS_BYTE = 500 * 1024;
  async function storagePanggil(path, { method = 'GET', body, headers } = {}) {
    const h = Object.assign({}, auth, headers || {});
    if (body !== undefined && !h['Content-Type']) h['Content-Type'] = 'application/json';
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    let r;
    try { r = await fetchFn(dasarStorage + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), signal: ctl.signal }); }
    finally { clearTimeout(t); }
    return r;
  }
  async function storageJson(path, opt) {
    const r = await storagePanggil(path, opt);
    const teks = await r.text();
    let j = null; try { j = teks ? JSON.parse(teks) : null; } catch (e) { j = null; }
    if (!r.ok) { const e = new Error((j && (j.message || j.error)) || ('storage ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const angka = (n) => { if (!Number.isInteger(n)) throw new Error('room bukan bilangan bulat'); return n; };
  const hex = (s) => { if (!/^[0-9a-f]{64}$/.test(s)) throw new Error('hash tidak valid'); return s; };
  const uuid = (s) => { if (!/^[0-9a-f-]{36}$/.test(String(s))) throw new Error('id tidak valid'); return s; };
  /* Kerja & Belanja: argumen dicek bentuknya sebelum dikirim (nilai = dari server, bukan klien) */
  const nama = (s) => { if (typeof s !== 'string' || !s || s.length > 30 || /[\u0000-\u001f]/.test(s)) throw new Error('nama tidak valid'); return s; };
  const kode = (s) => { if (!/^[a-z0-9_]{2,30}$/.test(String(s))) throw new Error('kode tidak valid'); return s; };
  const tanggal = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) throw new Error('tanggal tidak valid'); return s; };
  const bulan = (s) => { if (!/^\d{4}-\d{2}$/.test(String(s))) throw new Error('bulan tidak valid'); return s; };
  const uang = (n) => { if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new Error('jumlah tidak valid'); return n; };
  const ket = (s) => String(s || '').slice(0, 80);

  return {
    occupants: async () => (await rpc('kosan_occupants', {})) || [],
    /* RPC lama kosan_login (dipanggil dengan service role): verifikasi PIN +
       kunci 5x/15 menit yang sudah ada. Data penghuni tidak diubah. */
    async loginPin(name, pinHash) {
      try {
        const rows = await rpc('kosan_login', { p_name: name, p_pin_hash: pinHash });
        return Array.isArray(rows) && rows.length ? { ok: true, row: rows[0] } : { ok: false };
      } catch (e) {
        if (/Terlalu banyak percobaan/.test(String(e.message))) return { ok: false, terkunci: true };
        throw e;
      }
    },
    akunAmbil: async (room) => {
      const r = await panggil('kosan_akun?room=eq.' + angka(room) + '&select=*');
      return (Array.isArray(r) && r[0]) || null;
    },
    /* Simpan gender terdaftar per kamar (upsert ke tabel Fase A kosan_akun;
       kolom password di sana tidak dipakai lagi sejak perbaikan 9). */
    akunSimpan: (a) => panggil('kosan_akun', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { room: angka(a.room), nama_norm: a.nama_norm, gender: a.gender === 'cowok' ? 'cowok' : 'cewek' } }),
    /* RPC lama kosan_register (definisi tidak diubah), dipanggil server
       sesudah cek PIN != username. Galat RPC dilempar dengan .status. */
    register: (args) => rpc('kosan_register', args),
    /* Gedung C & D (15 Nov): RPC BARU kosan_register_cd untuk kunci KOSANC
       (K21-30) / KOSAND (K31-40) — supabase/migrations/20261115_gedung_c_d.sql.
       kosan_register lama tidak disentuh. */
    registerCd: (args) => rpc('kosan_register_cd', args),
    /* Gedung E & F (Opsi D, 17 Nov): RPC BARU kosan_register_ef untuk kunci
       KOSANE (K41-50) / KOSANF (K51-60) — supabase/migrations/20261117_gedung_e_f.sql. */
    registerEf: (args) => rpc('kosan_register_ef', args),
    sesiBuat: async (row) => {
      const r = await panggil('kosan_sesi', { method: 'POST', body: row, prefer: 'return=representation' });
      return r && r[0];
    },
    sesiAmbil: async (sha) => {
      const r = await panggil('kosan_sesi?token_sha256=eq.' + hex(sha) + '&select=*');
      return (Array.isArray(r) && r[0]) || null;
    },
    sesiPerbarui: (id, patch) => panggil('kosan_sesi?id=eq.' + uuid(id), { method: 'PATCH', body: patch, prefer: 'return=minimal' }),
    logPerangkat: (row) => panggil('kosan_perangkat_log', { method: 'POST', body: row, prefer: 'return=minimal' }),
    batasTambah: async (kunci, detik) => Number(await rpc('kosan_batas_tambah', { p_kunci: kunci, p_detik: detik })),
    /* Perbaikan 11 (P1): kembalikan satu unit jatah (atomik, tidak di bawah 0)
       — fungsi SQL supabase/migrations/20261114_batas_kembali.sql. */
    batasKembali: (kunci, detik) => rpc('kosan_batas_kembali', { p_kunci: kunci, p_detik: detik }),
    gerbangAmbil: async (kunci, g) => (await rpc('kosan_gerbang_ambil', { p_kunci: kunci, p_maks: g.maks, p_jendela: g.jendelaDetik, p_kunci_detik: g.kunciDetik })) === true,
    gerbangLepas: (kunci) => rpc('kosan_gerbang_lepas', { p_kunci: kunci }),
    /* ---- Kerja & Belanja (16 Nov): fungsi SQL atomik supabase/migrations/20261116_kerja_belanja.sql.
       Galat RAISE (mis. 'saldo_kurang', 'jeda:120') dilempar dengan .status 400 seperti PostgREST. ---- */
    dompetBaca: async (a) => rpc('kosan_dompet_baca', { p_room: angka(a.room), p_nama: nama(a.nama), p_tanggal: tanggal(a.tanggal), p_bulan: bulan(a.bulan), p_maks_detik: uang(a.maksDetik) }),
    kerjaDaftar: async (a) => rpc('kosan_kerja_daftar', { p_room: angka(a.room), p_nama: nama(a.nama), p_pekerjaan: kode(a.pekerjaan) }),
    kerjaMulai: async (a) => rpc('kosan_kerja_mulai', { p_room: angka(a.room), p_nama: nama(a.nama), p_pekerjaan: kode(a.pekerjaan), p_tanggal: tanggal(a.tanggal),
      p_maks_hari: uang(a.maksHari), p_jeda_detik: uang(a.jedaDetik), p_maks_detik: uang(a.maksDetik) }),
    kerjaShift: async (a) => rpc('kosan_kerja_shift', { p_room: angka(a.room), p_nama: nama(a.nama), p_shift: uuid(a.shift) }),
    kerjaSelesai: async (a) => rpc('kosan_kerja_selesai', { p_room: angka(a.room), p_nama: nama(a.nama), p_shift: uuid(a.shift), p_gaji: uang(a.gaji), p_tip: uang(a.tip),
      p_benar: uang(a.benar), p_salah: uang(a.salah), p_min_detik: uang(a.minDetik), p_maks_detik: uang(a.maksDetik), p_keterangan: ket(a.keterangan) }),
    kerjaBatal: async (a) => rpc('kosan_kerja_batal', { p_room: angka(a.room), p_nama: nama(a.nama), p_shift: uuid(a.shift) }),
    beli: async (a) => rpc('kosan_beli', { p_room: angka(a.room), p_nama: nama(a.nama), p_barang: kode(a.barang), p_harga: uang(a.harga), p_unik: a.unik === true, p_keterangan: ket(a.keterangan) }),
    sewaBayar: async (a) => rpc('kosan_sewa_bayar', { p_room: angka(a.room), p_nama: nama(a.nama), p_bulan: bulan(a.bulan), p_jumlah: uang(a.jumlah), p_keterangan: ket(a.keterangan) }),
    /* ---- Arkade Ria (26 Nov): fungsi SQL supabase/migrations/20261126_arkade_skor.sql ---- */
    skorKirim: async (a) => rpc('kosan_skor_kirim', { p_room: angka(a.room), p_nama: nama(a.nama), p_game: kode(a.game), p_minggu: tanggal(a.minggu),
      p_skor: uang(a.skor), p_hadiah: a.hadiah ? kode(a.hadiah) : null }),
    skorPapan: async (a) => (await rpc('kosan_skor_papan', { p_minggu: tanggal(a.minggu), p_batas: uang(a.batas) })) || [],
    /* ---- Warna Kamar (26 Nov): fungsi SQL supabase/migrations/20261127_warna_kamar.sql ---- */
    gayaBaca: async (a) => (await rpc('kosan_gaya_baca', { p_room: angka(a.room), p_nama: nama(a.nama) })) || null,
    gayaSimpan: async (a) => rpc('kosan_gaya_simpan', { p_room: angka(a.room), p_nama: nama(a.nama), p_dinding: kode(a.dinding), p_lantai: kode(a.lantai), p_selimut: kode(a.selimut) }),
    /* ---- Foto profil (18 Nov) — Storage `foto-profil`, kunci objek = nomor kamar ---- */
    fotoUrlPublik: (room) => url.replace(/\/+$/, '') + '/storage/v1/object/public/' + FOTO_BUCKET + '/' + angka(room),
    fotoAmbil: async (room) => {
      const r = await panggil('kosan_foto_profil?room=eq.' + angka(room) + '&select=url,diperbarui');
      return (Array.isArray(r) && r[0]) || null;
    },
    fotoSimpan: (room, urlFoto) => panggil('kosan_foto_profil', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { room: angka(room), url: urlFoto, diperbarui: new Date().toISOString() } }),
    fotoMintaUrl: async (room) => {
      /* Bucket dibuat sekali via SQL (migrasi 20261118); kalau belum ada,
         buat di sini — best-effort, abaikan "sudah ada" (signed URL akan
         gagal jelas kalau bucket benar-benar tidak ada). */
      try {
        const cek = await storagePanggil('bucket/' + FOTO_BUCKET);
        if (cek.status === 404) {
          await storageJson('bucket', { method: 'POST', body: { id: FOTO_BUCKET, name: FOTO_BUCKET, public: true,
            file_size_limit: FOTO_MAKS_BYTE, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] } });
        }
      } catch (e) { /* lanjut */ }
      /* Objek lama WAJIB dihapus dulu: createSignedUploadUrl gagal
         "The resource already exists" (400) kalau objek sudah ada di path
         itu — terbukti live 18 Nov (minta 503 5/5 selagi objek yatim
         foto-profil/41 masih ada; minta lolos saat objek belum ada).
         Foto lama memang sedang diganti, jadi hapus di sini sudah benar;
         kalau pengguna batal, kartu kembali ke inisial. */
      try { await storagePanggil('object/' + FOTO_BUCKET + '/' + angka(room), { method: 'DELETE' }); } catch (e) { /* belum ada = lanjut */ }
      const j = await storageJson('object/upload/sign/' + FOTO_BUCKET + '/' + angka(room), { method: 'POST', body: { expiresIn: 300 } });
      let penuh = null;
      if (j && typeof j.url === 'string' && j.url) penuh = j.url.indexOf('http') === 0 ? j.url : (url.replace(/\/+$/, '') + '/storage/v1/' + j.url.replace(/^\/+/, ''));
      else if (j && typeof j.token === 'string' && j.token) penuh = url.replace(/\/+$/, '') + '/storage/v1/object/upload/sign/' + FOTO_BUCKET + '/' + angka(room) + '?token=' + j.token;
      if (!penuh) throw new Error('signed upload URL tidak didapat');
      return { unggah: penuh };
    },
    fotoUnduh: async (room) => {
      const r = await storagePanggil('object/' + FOTO_BUCKET + '/' + angka(room));
      if (!r.ok) { const e = new Error('foto tidak ditemukan'); e.status = r.status; throw e; }
      return Buffer.from(await r.arrayBuffer());
    },
    fotoHapus: async (room) => {
      try { await storagePanggil('object/' + FOTO_BUCKET + '/' + angka(room), { method: 'DELETE' }); } catch (e) { /* 404 = sudah tidak ada */ }
    }
  };
}

module.exports = { buatDb };
