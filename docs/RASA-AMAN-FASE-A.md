# RASA-AMAN-FASE-A — runbook deploy login penghuni (PIN) + PIN kamar

Desain: `docs/RASA-AMAN-DESAIN.md` §5, §6, §8, §10. Fase A memindah login
penghuni ke server sendiri (Vercel Functions), menambah "Ingat saya",
dan memeriksa PIN kamar di server tiap kali masuk. Multiplayer tetap v1
(broker publik) sampai Fase B.

> **Perbaikan 9 (keputusan Ryan 14 Nov 14:53 / 14:58 / 15:00): lapisan
> password DICABUT TOTAL — balik ke PIN saja.** Alasan Ryan: setup password
> "terlalu rumit, orang bisa kesel dan pada akhirnya jadi males main".
> Yang dicabut: kolom password, tahap "buat password", endpoint
> `/api/setup/password`, scrypt, tiket setup, cek password bocor (HIBP,
> perbaikan 7) beserta fail-closed-nya (perbaikan 8), tautan "Login pertama
> kali", dan kolom nama tamu. Tanpa kolom password, Chrome tidak punya apa
> pun untuk disimpan/dicek, jadi peringatan "Periksa sandi Anda" tidak
> mungkin muncul. Tidak ada migrasi database.

## Alur sekarang

**Login penghuni (dua langkah)**
1. Layar masuk: username + tombol **Masuk** (+ centang "Ingat saya").
   Klien mencocokkan dengan daftar penghuni publik (`kosan_occupants`).
   Bukan penghuni → "Nama ini belum terdaftar sebagai penghuni — daftar
   dulu, atau masuk sebagai tamu." (keypad tidak muncul).
2. Penghuni → keypad PIN (6 titik, kirim otomatis di digit ke-6) →
   `POST /api/masuk {username, pin, ingat}` → PIN dicek lewat RPC lama
   `kosan_login` (service role) di belakang gerbang percobaan → benar =
   sesi + cookie langsung. Salah = pesan + gerbang menghitung (5 salah
   dalam 15 menit → percobaan berikutnya terkunci ±20 menit, PIN benar
   maupun salah dijawab sama). Aturan "PIN ≠ username" TIDAK berlaku di
   login.
   `/api/setup/pin` tetap ada sebagai alias `/api/masuk` (perilaku sama).

**Daftar (penghuni baru)** — username + gender + kode kunci (KOSAN /
KOSANBARU) → keypad "Buat PIN" → "Ulangi PIN" → `POST /api/daftar`.
PIN tidak boleh sama dengan username (hanya mungkin kalau username angka
semua): dicek di klien sebelum kirim, dan di server
(`pinHash(pin) === pinHash(normalize(username))` → 400
`pin_sama_username`). Server lalu memanggil RPC lama `kosan_register`
dengan service role (definisinya TIDAK diubah) dan langsung membuat sesi.

**Tamu (sekali ketuk)** — "Masuk sebagai tamu" langsung masuk dengan nama
otomatis `Tamu-N`: N terkecil ≥ 1 yang belum dipakai nama penghuni
terdaftar maupun pemain online. Kalau belakangan muncul tamu lain dengan
nama sama (masuk bersamaan), tamu dengan id lebih besar memilih ulang N
terkecil yang bebas. Label tampil `Tamu-N · tamu`. Nama tamu tidak
disimpan di perangkat. Tamu tetap tidak bisa masuk kamar.

**Tetap seperti sebelumnya:** sesi + cookie `__Host-kosan_sesi`
(HttpOnly, 12 jam / "Ingat saya" 30 hari geser), PIN kamar wajib tiap
masuk ruangan (keypad, tidak pernah diingat), gerbang percobaan per kamar,
batas per jaringan (IPv6 per /64), log perangkat/IP (HMAC), ketuk pintu
kamar sendiri → keypad, auto-landscape sinkron di ketukan, region `sin1`.

## Yang berubah

| Bagian | File |
|---|---|
| Endpoint (Vercel Functions, Node, tanpa dependensi) | `api/masuk.js`, `api/setup/pin.js` (alias), `api/daftar.js`, `api/sesi.js`, `api/keluar.js`, `api/kamar/masuk.js`, `api/_lib/*.js` (4 file) |
| Dihapus (perbaikan 9) | `api/setup/password.js`, `tests/fake-hibp.js`, `tests/e2e-fase-a.js`, `tests/e2e-perbaikan2.js` |
| Tabel + fungsi Fase A (tidak menyentuh tabel penghuni) | `supabase/migrations/20261113_rasa_aman_fase_a.sql` (tidak diubah) |
| Klien | `index.html` |
| Tes | `tests/server.test.js`, `tests/klien.test.js`, `tests/fake-db.js`, `tests/lokal.js`, `tests/e2e-pin.js` |

Data penghuni (nama, kamar, gender, PIN, `pin_hash`) tidak diubah oleh
login. Server menulis gender terdaftar ke tabel Fase A `kosan_akun`
(upsert `room, nama_norm, gender`) supaya `/api/sesi` bisa
mengembalikannya. Kolom `password_hash`/`gagal_count`/`kunci_sampai` di
tabel itu, serta fungsi `kosan_akun_setup`/`kosan_akun_gagal`/
`kosan_akun_berhasil` dan gerbang `pw:`, tidak dipakai lagi (dibiarkan
supaya tidak perlu migrasi).

## Urutan deploy

1. **Cek `kosan_login` [CEK].** `select pg_get_function_identity_arguments('public.kosan_login'::regproc);`
   harus `p_name text, p_pin_hash text`, dan barisnya punya kolom `gender`.
   Hitungan gagal `kosan_login` (`kosan_login_attempts`) kumulatif; saat
   gerbang `pin:<kamar>` mulai dari nol karena sepi 15 menit, baris itu ikut
   dihapus (tanpa dobel-hitung).
2. **Migrasi Fase A** sudah dijalankan (perbaikan 9 tidak menambah SQL).
3. **Env var Vercel** (Production + Preview), jangan pernah di repo:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KOSAN_SECRET` (32 byte
   acak). Tanpa salah satunya, endpoint membalas 503 (gagal aman).
4. **Deploy preview.** Daftar file deploy membawa 10 file `api/`: 6
   endpoint (`masuk`, `sesi`, `keluar`, `daftar`, `setup/pin`,
   `kamar/masuk`) + 4 di `api/_lib/`. **`api/setup/password.js` DIHAPUS
   dari daftar deploy.** `tests/`, `supabase/`, `docs/` tidak di-deploy.
5. **Cek preview:**
   - `curl -s -o /dev/null -w '%{http_code}' https://<preview>/api/sesi` → `401`.
   - `curl -s -o /dev/null -w '%{http_code}' -X POST https://<preview>/api/setup/password` → `404` (endpoint sudah tidak ada).
   - `curl -s https://<preview>/ | grep -c 'type="password"'` → `0`.
   - Header `x-vercel-id` memuat `sin1`.
   - Playtest HP: rina → username → Masuk → keypad PIN → masuk; PIN salah
     → error; username bukan penghuni → pesan belum-terdaftar; tamu
     sekali ketuk → "Tamu-1 · tamu"; masuk kamar tetap minta PIN.
6. **Promote ke produksi**, lalu tes live.
7. **Sesudah klien baru live ≥24 jam:** cabut akses langsung browser ke
   RPC lama yang sekarang dilayani server:
   `REVOKE EXECUTE ON FUNCTION public.kosan_login(text, text) FROM anon;`
   dan `REVOKE EXECUTE ON FUNCTION public.kosan_register(...) FROM anon;`
   (sesuaikan signature). Klien baru tidak memanggil keduanya (hanya
   `kosan_occupants`). Sampai `kosan_register` dicabut dari anon, aturan
   "PIN ≠ username" bisa dilewati oleh orang yang memanggil RPC langsung;
   sampai `kosan_login` dicabut, penebak bisa memakai jalur anon untuk
   menambah jatah tebakan. Jangan ditunda lama.

## Operasional

- **Lupa PIN** (sesudah verifikasi lewat DM IG): reset PIN lewat SQL seperti
  runbook lama (`docs/PENGHUNI.md`). Lalu `select kosan_akun_reset(<kamar>);`
  untuk mencabut semua sesi kamar itu + membuka kuncinya.
- **Akun terkunci karena orang iseng (trade-off yang diterima).** Username
  penghuni publik, jadi siapa pun bisa sengaja salah 6x tiap 20 menit dan
  menjaga akun itu terkunci. Penghuni dengan sesi "Ingat saya" tetap bisa
  masuk dunia, tapi tidak bisa masuk kamar selama terkunci. Buka dengan
  `select kosan_akun_buka(<kamar>);` (menghapus gerbang + baris
  `kosan_login_attempts` kamar itu; sesi tidak berubah).
- **Pembersihan data** (retensi 90 hari): `select kosan_bersihkan();`.
- **Kandidat akun ganda** (Fase D): `select room, perangkat, ip_hmac, peristiwa, dibuat from kosan_perangkat_log order by dibuat;`
  Jangan tendang siapa pun berdasarkan ini saja.

## DICABUT (riwayat, jangan dipakai lagi)

- Perbaikan 1–6: login username + **password**, setup password sekali untuk
  penghuni lama (PIN lama → buat password), aturan password (8–128,
  daftar umum), scrypt, kunci password 5x/15 menit.
- Perbaikan 7: tolak password bocor (HIBP k-anonymity, fail-open).
- Perbaikan 8: HIBP fail-closed + gerbang tes `password123` / `P@ssw0rd`.
- Semuanya diganti alur PIN saja di atas (perbaikan 9).

## Rollback

Deploy ulang `index.html` + `api/` versi sebelumnya. Klien lama (sebelum
Fase A) memakai `kosan_login`/`kosan_register` anon langsung, jadi langkah
7 jangan dijalankan sebelum yakin.

## Menjalankan tes

```bash
node --test tests/server.test.js         # tes server, tanpa jaringan
node --test tests/klien.test.js          # tes klien (fungsi murni dari index.html)
PLAYWRIGHT_CORE=... CHROME_PATH=... node tests/e2e-pin.js   # playtest Chromium (server uji lokal + database palsu)
node tests/lokal.js 8790                 # server uji lokal
```
