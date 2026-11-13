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
   Catatan: komentar Ronde 61 di klien lama menyebut pesan "Terlalu banyak
   percobaan" hanya muncul untuk PIN yang **benar**. Kalau itu benar,
   kunci `kosan_login` bisa jadi penunjuk PIN. Server Fase A tidak
   bergantung padanya: semua cek PIN (setup + kamar) lewat gerbang
   `kosan_gerbang` per kamar (5 percobaan/15 menit, kunci 20 menit),
   sehingga selama terkunci PIN benar dan salah dijawab sama, dan
   `kosan_login` tidak dipanggil. Hitungan gagal `kosan_login`
   (`kosan_login_attempts`) terverifikasi kumulatif, tidak meluruh. Supaya
   tidak dobel-hitung, setiap kali gerbang `pin:<kamar>` mulai dari nol
   karena sepi 15 menit, baris `kosan_login_attempts` penghuni kamar itu
   ikut dihapus (definisi `kosan_login` tidak diubah).
2. **Migrasi.** Jalankan `supabase/migrations/20261113_rasa_aman_fase_a.sql`
   di SQL Editor. File ini idempoten. Lalu jalankan dua cek di bagian bawah
   file (anon ditolak, service_role boleh `kosan_login`).
   Sebelum produksi, jalankan dulu di proyek Supabase uji, lalu uji
   balapan `kosan_gerbang_ambil` dari dua sesi SQL sekaligus (harus total
   tepat 5 `true`, sisanya `false`). Migrasi versi sebelumnya sudah lolos
   uji Postgres 16 + race test. Versi ini menambah DELETE ke
   `kosan_login_attempts` (lewat `kosan_residents`) di `kosan_gerbang_ambil`,
   `kosan_akun_buka`, `kosan_akun_reset`, dan belum diuji ulang di Postgres:
   ulangi skenario dobel-hitung (3 salah, sepi 20 menit, 2 salah → PIN
   benar harus berhasil) dan skenario buka-kunci lama.
3. **Env var Vercel** (Production + Preview), jangan pernah di repo:
   - `SUPABASE_URL` = `https://lpuvkrbdctankydvmzpy.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = service role / secret key proyek
   - `KOSAN_SECRET` = 32 byte acak, mis. `openssl rand -base64 32`
   Tanpa salah satunya, endpoint membalas 503 (gagal aman).
4. **Deploy preview.** Daftar file deploy wajib ikut membawa folder `api/`
   (10 file `.js` di atas: 6 endpoint + 4 di `api/_lib/`). `tests/`, `supabase/`, `docs/` tidak perlu
   di-deploy. Vercel tidak menjadikan `api/_lib/` sebagai endpoint.
5. **Cek preview:**
   - `curl -s -o /dev/null -w '%{http_code}' https://<preview>/api/sesi` → `401`
     (bukan 404/503).
   - Playtest dua tab sesuai `docs/RASA-AMAN-DESAIN.md` §12.3.
6. **Promote ke produksi**, lalu tes live §12.4 nomor 1–3.
7. **Sesudah klien baru live ≥24 jam:** cabut login PIN-saja dari browser,
   `REVOKE EXECUTE ON FUNCTION public.kosan_login(text, text) FROM anon;`
   (§7.5). Klien Fase A sudah tidak memanggilnya. Jangan ditunda lama:
   selama anon masih bisa memanggil `kosan_login` langsung, penebak bisa
   menyelipkan satu percobaan lewat server sesudah 15 menit sepi (yang
   menghapus hitungan lama) di antara tebakan lewat jalur anon, sehingga
   jatahnya kira-kira dua kali lipat per 15 menit.

## Operasional

- **Lupa password** (sesudah verifikasi lewat DM IG):
  `select kosan_akun_reset(<kamar>);` Semua sesi kamar itu dicabut dan
  semua kuncinya dibuka (gerbang Fase A + kunci PIN lama
  `kosan_login_attempts`). Penghuni login pertama lagi pakai PIN kamarnya.
- **Akun terkunci karena orang iseng (trade-off yang diterima).** Username
  penghuni publik, jadi siapa pun bisa sengaja salah 6x tiap 20 menit
  (password atau PIN) dan menjaga akun itu terkunci terus. Penghuni yang
  sudah punya sesi "Ingat saya" tetap bisa masuk dunia, tapi tidak bisa
  masuk kamar selama gerbang PIN terkunci. Kalau ada penghuni lapor
  "terkunci terus": `select kosan_akun_buka(<kamar>);` (membuka kunci saja,
  password dan sesi tidak berubah). Password dan PIN langsung terbuka:
  fungsi ini menghapus gerbang Fase A sekaligus baris `kosan_login_attempts`
  kamar itu (kunci 5x PIN salah dari sistem lama). Lihat pola serangan di
  `select * from kosan_gerbang where kunci like '%:<kamar>';` dan, kalau
  berulang, kabari untuk ronde berikutnya (mis. kunci per IP + kamar).
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
