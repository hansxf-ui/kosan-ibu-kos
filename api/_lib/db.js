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
  const angka = (n) => { if (!Number.isInteger(n)) throw new Error('room bukan bilangan bulat'); return n; };
  const hex = (s) => { if (!/^[0-9a-f]{64}$/.test(s)) throw new Error('hash tidak valid'); return s; };
  const uuid = (s) => { if (!/^[0-9a-f-]{36}$/.test(String(s))) throw new Error('id tidak valid'); return s; };

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
    akunSetup: async (a) => (await rpc('kosan_akun_setup', { p_room: angka(a.room), p_nama_norm: a.nama_norm, p_gender: a.gender, p_hash: a.password_hash })) === true,
    akunGagal: (room) => rpc('kosan_akun_gagal', { p_room: angka(room) }),
    akunBerhasil: (room) => rpc('kosan_akun_berhasil', { p_room: angka(room) }),
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
    gerbangAmbil: async (kunci, g) => (await rpc('kosan_gerbang_ambil', { p_kunci: kunci, p_maks: g.maks, p_jendela: g.jendelaDetik, p_kunci_detik: g.kunciDetik })) === true,
    gerbangLepas: (kunci) => rpc('kosan_gerbang_lepas', { p_kunci: kunci })
  };
}

module.exports = { buatDb };
