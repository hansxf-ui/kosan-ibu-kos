# RASA-AMAN-FASE-A — runbook deploy login penghuni + PIN kamar

Desain: `docs/RASA-AMAN-DESAIN.md` §5, §6, §8, §10. Fase A menambah login
username + password, setup password sekali untuk penghuni lama, "Ingat
saya", dan PIN kamar yang dicek di server. Multiplayer tetap v1 (broker
publik) sampai Fase B.

## Yang berubah

| Bagian | File |
|---|---|
| Endpoint server (Vercel Functions, Node, tanpa dependensi) | `api/masuk.js`, `api/sesi.js`, `api/keluar.js`, `api/setup/pin.js`, `api/setup/password.js`, `api/kamar/masuk.js`, `api/_lib/*.js` |
| Tabel + fungsi baru (tidak menyentuh tabel penghuni) | `supabase/migrations/20261113_rasa_aman_fase_a.sql` |
| Klien | `index.html`: layar masuk (password, setup, Ingat saya, Keluar akun), modal PIN kamar, gerbang `enterRoom` |
| Tes | `tests/server.test.js`, `tests/fake-db.js`, `tests/lokal.js`, `tests/e2e-fase-a.js` |

Data penghuni (nama, kamar, gender, PIN, `pin_hash`) tidak diubah. Server
memverifikasi PIN lewat RPC lama `kosan_login` dengan service role.

## Urutan deploy

1. **Cek `kosan_login` [CEK].** Di SQL Editor:
   `select pg_get_function_identity_arguments('public.kosan_login'::regproc);`
   Harus `p_name text, p_pin_hash text`, dan baris hasilnya punya kolom
   `gender`. Kalau beda, kabari dulu sebelum lanjut.
2. **Migrasi.** Jalankan `supabase/migrations/20261113_rasa_aman_fase_a.sql`
   di SQL Editor. File ini idempoten. Lalu jalankan dua cek di bagian bawah
   file (anon ditolak, service_role boleh `kosan_login`).
   **SQL ini belum pernah dijalankan di Postgres asli** (sandbox tidak punya
   Postgres). Tes server memakai database palsu yang meniru perilakunya.
3. **Env var Vercel** (Production + Preview), jangan pernah di repo:
   - `SUPABASE_URL` = `https://lpuvkrbdctankydvmzpy.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = service role / secret key proyek
   - `KOSAN_SECRET` = 32 byte acak, mis. `openssl rand -base64 32`
   Tanpa salah satunya, endpoint membalas 503 (gagal aman).
4. **Deploy preview.** Daftar file deploy wajib ikut membawa folder `api/`
   (8 file `.js` di atas). `tests/`, `supabase/`, `docs/` tidak perlu
   di-deploy. Vercel tidak menjadikan `api/_lib/` sebagai endpoint.
5. **Cek preview:**
   - `curl -s -o /dev/null -w '%{http_code}' https://<preview>/api/sesi` → `401`
     (bukan 404/503).
   - Playtest dua tab sesuai `docs/RASA-AMAN-DESAIN.md` §12.3.
6. **Promote ke produksi**, lalu tes live §12.4 nomor 1–3.
7. **Sesudah klien baru live ≥24 jam:** cabut login PIN-saja dari browser,
   `REVOKE EXECUTE ON FUNCTION public.kosan_login(text, text) FROM anon;`
   (§7.5). Klien Fase A sudah tidak memanggilnya.

## Operasional

- **Lupa password** (sesudah verifikasi lewat DM IG):
  `select kosan_akun_reset(<kamar>);` Semua sesi kamar itu dicabut.
  Penghuni login pertama lagi pakai PIN kamarnya.
- **Pembersihan data** (retensi 90 hari): `select kosan_bersihkan();`
  manual, atau jadwalkan dengan pg_cron (lihat akhir file migrasi).
- **Kandidat akun ganda** (Fase D): sementara bisa dilihat manual,
  `select room, perangkat, ip_hmac, peristiwa, dibuat from kosan_perangkat_log order by dibuat;`
  Jangan tendang siapa pun berdasarkan ini saja.

## Rollback

Deploy ulang `index.html` versi sebelumnya. Klien lama memakai
`kosan_login` lagi, jadi langkah 7 jangan dijalankan sebelum yakin. Tabel
baru boleh dibiarkan: tidak ada yang membacanya selain `/api/*`.

## Menjalankan tes

```bash
node --test tests/server.test.js         # 29 tes server, tanpa jaringan
PLAYWRIGHT_CORE=... CHROME_PATH=... node tests/e2e-fase-a.js          # playtest klien baru
PLAYWRIGHT_CORE=... CHROME_PATH=... node tests/e2e-fase-a.js --lama   # klien dari main (RED)
node tests/lokal.js 8790                 # server uji lokal (database palsu)
```
