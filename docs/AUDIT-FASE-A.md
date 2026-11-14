# AUDIT-FASE-A — audit penuh rasa aman Fase A (PIN saja)

> Perintah Ryan 14 Nov 16:52: audit penuh, telusuri bug. **Audit saja, tanpa
> perbaikan.** Kode, data, dan produksi tidak diubah. Perbaikan diputuskan
> Ryan sesudah membaca laporan ini.
>
> - Objek: PR #4, branch `feat/rasa-aman-fase-a`, head `c41cdc9`.
> - Metode: membaca kode baris per baris, menjalankan semua suite tes, dan
>   membuat skrip reproduksi kecil di server lokal dengan database palsu
>   (tanpa jaringan, tanpa broker). Tidak ada tes racun broker.
> - Brief `task-f1-sec-rasa-aman-audit-penuh-prompt-kiro.md` tidak ada di
>   workspace, jadi audit ini mengikuti ringkasan di pesan perintah.

## Ringkasan

| Peringkat | Jumlah | Inti |
|---|---|---|
| Kritis (terkonfirmasi) | 0 | — |
| **Belum bisa diverifikasi, potensi Kritis** | 1 | Apakah tabel lama `kosan_residents` (berisi `pin_hash`) bisa dibaca anon. Lihat V1 |
| Penting | 4 | Batas per IP menghitung login yang berhasil (CGNAT), langkah 7 runbook tidak cukup (`FROM anon` saja), nama penghuni lama di luar charset tidak bisa login, repo `main` ≠ produksi |
| Minor | 7 | Jatah gerbang hilang saat DB error, tutup keypad tidak membatalkan permintaan, daftar nama terpakai baru ditolak sesudah PIN 2x, dll. |
| Observasi | 9 | Kode mati, kode kunci di sumber halaman, inkonsistensi kecil |

Sejumlah hal **tidak bisa diaudit dari sandbox**: produksi (HTTP 403 dari
sandbox), database Supabase asli, env var Vercel, dan definisi fungsi lama
yang tidak ada di repo. Untuk masing-masing ada perintah cek di bagian
"Belum bisa diverifikasi".

---

## Hasil tes (dihitung dari file, dijalankan di head `c41cdc9`)

| Suite | Jumlah di file | Hasil |
|---|---|---|
| Unit server `node --test tests/server.test.js` | 38 `test(` | 38/38 lolos |
| Unit klien `node --test tests/klien.test.js` | 20 `test(` | 20/20 lolos |
| Playtest `node tests/e2e-pin.js` (Chromium headless) | 37 `cek(` | 37/37 lolos |

### Tes yang tidak sepenuhnya menguji klaimnya

- **Semua tes server memakai `tests/fake-db.js`**, bukan SQL asli. Gerbang
  `kosan_gerbang_ambil`, kunci `kosan_login`, dan aturan `kosan_register`
  hanya *ditiru*. Contohnya, tiruan `register` hanya mengenal kode
  KOSAN/KOSANBARU dan cara probe kamar sederhana, tanpa aturan Gedung A/B
  maupun flag Gedung B. Kebenaran SQL hanya terbukti lewat uji Postgres 16
  yang pernah dijalankan Vesper.
- **`db.js` hanya diuji dengan fetch tiruan.** Upsert `kosan_akun`
  (`Prefer: resolution=merge-duplicates`) belum pernah dicoba ke PostgREST
  asli di repo ini.
- **Beberapa tes klien hanya cek statis teks/regex, bukan perilaku:**
  - `klien.test.js:45` (handler ketuk pintu memakai `aksiKetukPintu`)
  - `:53` (catatan dihapus)
  - `:59` (tidak ada kolom password)
  - `:95` (penanda tamu, sebagian)
  - `:104` (tombol tamu tidak membaca kolom nama)
  - `:156` (string)
  - `server.test.js` "kode password/scrypt/HIBP sudah tidak ada"

  Untuk klaim "tidak ada sisa kode", cek statis memang cara yang tepat.
  Untuk perilaku, tidak.
- **Bentrok dua tamu `Tamu-N` hanya diuji sebagai fungsi murni**
  (`klien.test.js:82`). Tidak ada tes dua klien sungguhan, karena broker
  diblokir di e2e.
- **e2e `C5`/`C2b` (layar penuh) memakai `navigator.userActivation` di
  Chromium headless**, bukan HP. Kunci orientasi tidak bisa diuji di
  headless.
- **e2e memakai server uji lokal dan `kosan_occupants` tiruan** (sudah
  diketahui). Header CSP diambil dari `vercel.json` asli, jadi `Z1`
  (0 error CSP) memang menguji konfigurasi yang benar.

---

## Belum bisa diverifikasi (akses tidak tersedia dari sandbox)

### V1 — Potensi KRITIS: apakah tabel lama bisa dibaca/ditulis anon

- **Yang dicek:** RLS dan hak akses tabel lama `kosan_residents` dan
  `kosan_login_attempts`. Keduanya tidak ada di repo, dan migrasi Fase A
  tidak menyentuhnya.
- **Kenapa potensi Kritis:**
  - Anon key Supabase memang publik, ada di `index.html:3501`.
  - Kalau `kosan_residents` bisa dibaca anon lewat
    `GET /rest/v1/kosan_residents?select=*`, semua `pin_hash` bocor.
  - Hash-nya FNV-1a dengan salt global tetap, dan ruang PIN cuma 1 juta.
    PIN 20 penghuni bisa dipecahkan offline dalam hitungan jam, dan semua
    gerbang server jadi tidak ada artinya.
  - Kalau `kosan_login_attempts` bisa ditulis anon, siapa pun bisa
    menghapus kunci PIN lama.
- **Cek (SQL Editor, hanya baca):**
  ```sql
  select relname, relrowsecurity from pg_class
   where relname in ('kosan_residents','kosan_login_attempts','kosan_akun','kosan_sesi','kosan_gerbang','kosan_batas','kosan_perangkat_log');
  select tablename, policyname, roles, cmd from pg_policies
   where tablename in ('kosan_residents','kosan_login_attempts');
  select has_table_privilege('anon','public.kosan_residents','select')       as anon_baca_residents,
         has_table_privilege('anon','public.kosan_login_attempts','delete')  as anon_hapus_attempts;
  ```
  Aman = `relrowsecurity = true`, tidak ada policy untuk `anon`, dan kedua
  `has_table_privilege` bernilai `false` atau dihalangi RLS. Cek dari luar
  (hanya baca):
  `curl -s 'https://lpuvkrbdctankydvmzpy.supabase.co/rest/v1/kosan_residents?select=*&limit=1' -H "apikey: <anon>"`
  → harus `[]` atau error izin, **bukan** baris berisi `pin_hash`.

### V2 — Produksi = head branch?

- `curl` ke `https://kosan-ibu-kos.vercel.app/` dan `web_fetch` dari sandbox
  sama-sama ditolak (proxy 403), jadi saya tidak bisa membandingkan.
- Perintah untuk Vesper:
  ```bash
  git show c41cdc9:index.html | sha256sum
  curl -s "https://kosan-ibu-kos.vercel.app/?cb=$(date +%s)" | sha256sum   # harus sama
  for f in api/masuk.js api/_lib/app.js; do echo $f; done   # file api/ tidak bisa diunduh; bandingkan lewat deployment Vercel (Source)
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://kosan-ibu-kos.vercel.app/api/setup/password   # 404
  curl -sI https://kosan-ibu-kos.vercel.app/api/sesi | grep -i -E 'x-vercel-id|strict-transport|content-security'
  ```

### V3 — Integritas data (SQL hanya baca)

```sql
select count(*) from kosan_residents;                                   -- 20
select lower(trim(name)) n, count(*) from kosan_residents group by 1 having count(*) > 1;   -- 0 baris
select room, count(*) from kosan_residents group by 1 having count(*) > 1;                  -- 0 baris
select room, name from kosan_residents
 where lower(trim(regexp_replace(name,'^@+',''))) !~ '^[a-z0-9 _.\-]{1,30}$';               -- lihat P3
select a.room, a.nama_norm, r.name from kosan_akun a left join kosan_residents r on r.room = a.room
 where r.name is null or lower(r.name) <> a.nama_norm;                                      -- 0 baris
select room, count(*) from kosan_sesi where dicabut is null and kedaluwarsa > now() group by 1;
select * from kosan_gerbang where kunci_sampai > now();                                     -- kunci menggantung
select * from kosan_login_attempts where locked_until > now();                              -- sesuaikan nama kolom
select room, name from kosan_residents where name ~* '(test|tes|uji|dummy|^tamu-[0-9]+$)';  -- akun tes / nama mirip tamu
select count(*) from kosan_akun where password_hash is not null;                            -- 0 (sisa password)
```

Duplikat PIN K13 `dilla` + K14 `dil` sudah diketahui dan tidak dilaporkan
di sini.

### V4 — Konfigurasi Vercel

- Env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KOSAN_SECRET` harus
  ada di **Production dan Preview**.
- Cek: `/api/sesi` membalas `401`, bukan `503`.
- Header `x-vercel-id` memuat `sin1`.

---

## Temuan

### P1 — PENTING: batas per IP menghitung login yang BERHASIL; pengguna HP yang berbagi IP (CGNAT) bisa terkunci bersama

- **Lokasi:** `api/_lib/app.js:19` (`BATAS = { masuk: 20, daftar: 20, kamar: 60 }`),
  `:67-70` (`lewatBatas`), dipanggil di `:119` (masuk), `:146` (daftar),
  dan `:197` (kamar). Pemanggilan terjadi sebelum PIN dicek, dan setiap
  permintaan dihitung, termasuk yang berhasil.
- **Ulangi:** skrip reproduksi audit memakai 20 penghuni berbeda, masing-masing
  login dengan PIN **benar** dari satu IP `114.10.20.30`. Permintaan ke-21
  dalam jam yang sama mendapat `429` "Terlalu banyak percobaan — coba lagi
  nanti." (hasil: `200,200,429`).
- **Dampak:**
  - Operator seluler Indonesia banyak memakai CGNAT, sehingga ratusan
    pengguna bisa keluar lewat satu IPv4.
  - Saat ramai (misalnya sesudah video tayang), penghuni yang tidak salah
    apa-apa bisa ditolak masuk selama sisa jam itu. Hal yang sama berlaku
    untuk daftar (20/jam) dan masuk kamar (60/jam, yang juga dipakai
    berulang oleh satu penghuni).
  - Desain §8.2 sendiri sudah menulis bahwa "banyak pengguna HP berbagi
    satu IP".
- **Saran:**
  - Hitung hanya permintaan yang **gagal** (PIN salah atau nama tidak
    terdaftar), atau kembalikan jatahnya saat berhasil.
  - Atau pakai kunci gabungan IP + username dengan batas IP yang jauh lebih
    longgar (mis. 300/jam).
  - Gerbang per kamar (5/15 menit) sudah menjadi pertahanan utama terhadap
    tebak PIN.

### P2 — PENTING: langkah 7 runbook (`REVOKE … FROM anon`) tidak cukup; jalur anon lama tetap terbuka

- **Lokasi:** `docs/RASA-AMAN-FASE-A.md:99-100`.
- **Masalah:**
  - Di Postgres, hak `EXECUTE` fungsi diberikan ke **PUBLIC** secara bawaan,
    dan Supabase juga memberikannya ke `anon` dan `authenticated`.
  - `REVOKE … FROM anon` saja tidak mencabut hak lewat PUBLIC. Akibatnya anon
    **tetap bisa** memanggil `kosan_login` dan `kosan_register`.
  - Migrasi Fase A sendiri sudah benar karena mencabut dari
    `public, anon, authenticated` (lihat migrasi baris 216-226). Hanya
    runbook-nya yang kurang.
- **Ulangi (SQL, sesudah menjalankan langkah 7 versi runbook):**
  `select has_function_privilege('anon','public.kosan_login(text,text)','execute');`
  → kemungkinan masih `true`.
- **Dampak:** selama jalur anon terbuka:
  - aturan PIN ≠ username bisa dilewati dengan memanggil `kosan_register`
    langsung;
  - PIN bisa ditebak langsung lewat `kosan_login` (dibatasi kunci lamanya
    sendiri);
  - kunci lama `kosan_login` menjadi penunjuk PIN lewat `/api/masuk`, karena
    saat terkunci PIN benar dijawab 429 dan PIN salah dijawab 401. Gerbang
    Fase A hanya menutup celah ini selama baris `kosan_login_attempts`
    sempat dihapusnya.
  - Status langkah 7 di produksi tidak diketahui. Klien produksi sudah
    Fase A sejak 14 Nov, jadi langkah ini sudah boleh dijalankan.
- **Saran:**
  ```sql
  revoke execute on function public.kosan_login(text, text) from public, anon, authenticated;
  revoke execute on function public.kosan_register(<signature>) from public, anon, authenticated;
  grant execute on function public.kosan_login(text, text) to service_role;
  grant execute on function public.kosan_register(<signature>) to service_role;
  -- verifikasi: keduanya harus false untuk anon, true untuk service_role
  ```
  `kosan_occupants` tetap boleh anon, karena klien memakainya.

### P3 — PENTING (tergantung data): nama penghuni lama di luar charset tidak bisa login, dengan pesan menyesatkan

- **Lokasi:** `api/_lib/app.js:117`. `/api/masuk` menolak username yang tidak
  lolos `usernameValid` (`a-z0-9 _.-`, maks 30) dengan
  `400 "Isi username dulu ya."`. Klien (`index.html:3917` `entryLogin`)
  hanya mencocokkan ke daftar penghuni, tanpa cek charset, jadi keypad tetap
  muncul.
- **Ulangi:** penghuni yang namanya mengandung karakter di luar charset itu
  (huruf beraksen, emoji, karakter non-Latin) diketik → Masuk → keypad →
  PIN benar → pesan "Isi username dulu ya." di keypad, dan tidak pernah
  bisa masuk. Aturan charset baru ada sejak Ronde 54, sedangkan daftar
  mandiri sudah ada sejak Ronde 51.
- **Dampak:** penghuni sah terkunci permanen tanpa penjelasan. Apakah ada
  nama seperti ini di data perlu dicek dengan query V3 ke-4.
- **Saran:** di login, cukup `normalize` + batas panjang, lalu cocokkan ke
  `kosan_occupants`. Charset hanya ditegakkan saat daftar. Pesan untuk
  format salah: "Nama ini belum terdaftar…".

### P4 — PENTING (proses): repo `main` tertinggal dari produksi; PR #3 desain basi

- **Fakta:**
  - Fase A sudah live (dites di produksi 14 Nov 16:02), tapi PR #4 masih
    `open` dan `main` masih `1876ae3`. Ini pola yang sama dengan sebelum
    13 Nov, saat kode terbaru tidak ada di repo.
  - PR #3 (`docs/RASA-AMAN-DESAIN.md`) masih memuat ±30 sebutan "password"
    (alur §5 lama), padahal password sudah dicabut.
- **Dampak:** sumber kebenaran tidak jelas. Audit berikutnya atau
  rollback bisa memakai versi yang salah.
- **Saran:** sesudah gerbang verifikasi lolos, merge PR #4 dan pastikan
  hash `index.html` produksi = `main` (V2). Perbarui §5 di desain (PR #3)
  ke alur PIN saja, atau tandai §5 lama sebagai DICABUT.

---

### M1 — Minor: DB error/timeout di tengah cek PIN memakan jatah gerbang; 5 gangguan jaringan = kamar terkunci 20 menit

- **Lokasi:** `api/_lib/app.js:72-77`. `gerbangAmbil` dijalankan dulu, lalu
  `loginPin`. Kalau `loginPin` melempar error (timeout 8 detik, Supabase
  sibuk), jatah tidak dikembalikan dan pengguna mendapat 503.
- **Ulangi:** skrip audit: 5 kali `loginPin` melempar timeout, lalu PIN
  benar → `429`, dengan hitungan gerbang 6.
- **Saran:** bungkus `loginPin` dengan `try/catch` dan lepas jatahnya
  (`gerbangLepas`) saat error, lalu lempar ulang.

### M2 — Minor: menutup keypad saat "Memproses…" tidak membatalkan permintaan

- **Lokasi:** `index.html:2666` (`pinTutup`), `:2681` (`pinKirimKamar`),
  `:3931` (`pinKirimMasuk`).
- **Ulangi:** ketik PIN benar, lalu langsung ketuk ✕ sebelum server
  menjawab. Begitu jawaban datang, pemain tetap masuk kamar atau masuk
  dunia walaupun keypad sudah ditutup.
- **Dampak:** membingungkan. Tidak ada celah keamanan, karena PIN-nya memang
  benar.
- **Saran:** simpan token "permintaan aktif" di `pinMode`, lalu abaikan
  jawaban kalau `pinMode` sudah berganti atau null.

### M3 — Minor: daftar nama yang sudah terdaftar baru ditolak SESUDAH mengetik PIN 2x

- **Lokasi:** `index.html:3986` (`entryDaftar`) tidak memeriksa
  `entryIsRegistered(nama)` sebelum membuka keypad.
- **Ulangi:** mode DAFTAR, ketik `rina`, kode `KOSAN`, PIN 2x → baru muncul
  "Username @rina sudah dipakai…".
- **Saran:** cek di klien sebelum membuka keypad. Server tetap menjadi
  penentu akhir.

### M4 — Minor: nama berpola `tamu-N` bisa didaftarkan sebagai penghuni

- **Lokasi:** `api/_lib/app.js` (`daftar`), `index.html:3986`.
- **Ulangi:** daftar dengan username `tamu-3` saat tamu `Tamu-3` sedang
  online.
- **Dampak:**
  - Ada dua "Tamu-3" di dunia, satu penghuni dan satu tamu.
  - Penanda `· tamu` untuk tamu itu hilang, karena label pemain lain diberi
    penanda hanya kalau namanya *bukan* nama penghuni (`index.html` di
    `perbaruiLabelDuplikat`).
  - Tamu baru juga akan melewati nomor itu.
- **Saran:** tolak pola `^tamu-[0-9]+$` saat daftar, di server
  (`/api/daftar`) dan di klien.

### M5 — Minor: login berhasil tapi daftar penghuni gagal dimuat → pesan "tidak bisa terhubung" padahal sesi sudah dibuat

- **Lokasi:** `index.html:3955`.
- **Ulangi:** sesudah PIN benar, `kosan_occupants` gagal (Supabase sibuk).
- **Dampak:** pemain diberi tahu gagal, padahal cookie sudah terpasang.
  Setelah muat ulang langsung muncul "Masuk Kosan". Tidak berbahaya, hanya
  membingungkan.
- **Saran:** pesan "Login berhasil, tapi daftar kamar belum termuat — coba
  ketuk Masuk lagi", atau coba ulang otomatis sekali.

### M6 — Minor: komentar dan teks yang basi

- `index.html:778` dan `:3499` masih menulis bahwa yang dikirim adalah
  "cuma hash" PIN. Sekarang PIN mentah dikirim (via HTTPS) ke server
  sendiri.
- `index.html:3852-3853` masih menulis alur "nama terdaftar → PIN saja →
  kosan_login" dari browser.
- `index.html:727` "keluar dulu untuk ganti": sejak Ronde 55 tidak ada jalan
  keluar ke layar masuk selain muat ulang.
- **Saran:** perbarui komentar dan teks itu. Tidak ada perubahan perilaku.

### M7 — Minor: log peristiwa daftar dicatat sebagai `setup`

- **Lokasi:** `api/_lib/app.js:159`. CHECK di migrasi hanya mengizinkan
  `setup_pin`, `setup`, dan `masuk`.
- **Dampak:** saat menganalisis akun ganda (Fase D), `setup` sekarang berarti
  "daftar baru", bukan "buat password". Data lama yang bertanda `setup`
  (dari masa password) maknanya berbeda.
- **Saran:** catat arti baru ini di runbook. Menambah nilai `daftar` ke
  CHECK butuh migrasi kecil.

---

### Observasi

- **O1. Kode dan berkas mati (aman, tapi menambah kebingungan):**
  - Klien:
    - `pinHash` (`index.html:788`) tidak dipanggil lagi di klien. Fungsi ini
      hanya dipakai tes paritas.
    - `#pinBtn` tersembunyi (cadangan).
  - Server: `inti.samaAman` tidak dipakai.
  - DB:
    - fungsi `kosan_akun_setup`, `kosan_akun_gagal`, `kosan_akun_berhasil`
      (masih di-grant ke `service_role`);
    - kolom `kosan_akun.password_hash`, `gagal_count`, `gagal_sejak`,
      `kunci_sampai`;
    - penghapusan gerbang `pw:` di `kosan_akun_buka` dan `kosan_akun_reset`.
  - Berkas repo yang tidak dirujuk `index.html`: `app.js`, `style.css`,
    `assets/batik-strip.svg`, `assets/hero.jpg`, `assets/ibu-kos.webp`,
    `vendor/confetti.min.js`, `vendor/three/OrbitControls.js`.
    `OrbitControls.js` hanya disebut di komentar (dicabut ronde 7), jadi
    kalau berkas itu ketinggalan di deploy, **tidak ada dampaknya**.
- **O2. Kode kunci daftar ada di sumber halaman.**
  `index.html:4665` `KUNCI_KODE_LIST = ['KOSAN', 'KOSANBARU']`. Siapa pun
  yang membuka sumber halaman tahu kodenya tanpa melihat caption. Ini
  disengaja (mudah dirotasi), tapi artinya kode itu bukan rahasia.
- **O3. Enumerasi nama.** `/api/masuk` membedakan "belum terdaftar" (401
  `tidak_terdaftar`) dan "PIN salah". Ini tidak menambah informasi, karena
  `kosan_occupants` memang publik.
- **O4. Tautan "Masuk sebagai tamu" sekarang tampil juga di mode MASUK.**
  Ronde 53 dulu menyembunyikannya (`entryApplyMode`, `index.html:3615`,
  sejak perbaikan 9). Ini konsisten dengan pesan "atau masuk sebagai
  tamu", tapi perlu dipastikan memang disengaja.
- **O5. Pencatatan perangkat/IP tetap jalan tanpa pemberitahuan di layar.**
  Pemberitahuan dihapus atas permintaan Ryan (14 Nov #3). Desain §8.1
  menyebut perlunya pemberitahuan menurut UU PDP. Ini keputusan pemilik.
- **O6. Label pemain lain tanpa `@`.** Label pemain lain
  (`mpHitungDuplikat`, `index.html:1272`) menampilkan `rina`, sedangkan
  label sendiri `@rina` (`spawnAvatar`, `:3141`). Tampilannya tidak
  konsisten. Ini sudah ada sebelum Fase A.
- **O7. `roomFor` hanya menghasilkan kamar 1–10** (`% 10`) walaupun ada 20
  kamar. Kamar 11–20 hanya terisi lewat probe server. Sudah ada sejak
  dulu, dan tidak berbahaya.
- **O8. Tidak ada header HSTS di `vercel.json`.** Vercel biasanya
  menambahkannya sendiri untuk `*.vercel.app`. Cek header produksi (V2).
- **O9. Rotasi `KOSAN_SECRET`** membuat HMAC IP lama tidak bisa
  dibandingkan lagi dan mereset hitungan batas per IP. Sesi tidak
  terpengaruh, karena tokennya acak. Perlu dicatat kalau suatu saat
  rahasia ini dirotasi.

---

## Sudah diperiksa dan bersih

**Server (`api/`)**
- Hanya 6 endpoint yang hidup: `masuk`, `daftar`, `sesi`, `keluar`,
  `kamar/masuk`, dan alias `setup/pin` → `masuk`. `api/_lib/` bukan
  endpoint. `api/setup/password.js` sudah tidak ada.
- Validasi input:
  - PIN wajib `^\d{6}$` di semua endpoint.
  - Kamar wajib bilangan bulat 1–20.
  - Gender `cewek`/`cowok`.
  - Kode kunci ≤20.
  - Body POST wajib objek JSON. Body >8 KB (jalur stream) ditolak.
- **Normalisasi nama** konsisten antara klien dan server (`normalize`):
  trim, buang `@`, huruf kecil, rapikan spasi. Paritas `pinHash` dan
  `roomFor` klien↔server diuji.
- **PIN ≠ username saat daftar** dicek di klien (`pinSamaUsername`) dan
  server (`pinHash(pin) === pinHash(normalize(username))`, `app.js` di
  `daftar`), dan **tidak** berlaku saat login. Penghuni lama dengan PIN =
  username tetap bisa masuk (diuji).
- **Gerbang PIN per kamar:**
  - 5 percobaan, jendela geser 15 menit, kunci 20 menit.
  - Dicadangkan secara atomik sebelum verifikasi, jadi tebakan paralel
    tidak lolos (diuji 40 paralel). PIN benar mengembalikan jatahnya.
  - Saat terkunci, PIN benar dan salah dijawab identik, dan `kosan_login`
    tidak dipanggil. Satu catatan: hal ini tergantung P2 (jalur anon).
- **CSRF:** cookie `SameSite=Strict`, ditambah wajib `application/json`
  (memaksa preflight) serta pemeriksaan `Sec-Fetch-Site` dan `Origin` =
  `Host`.
- **Sesi:**
  - Cookie `__Host-kosan_sesi` dengan `HttpOnly; SameSite=Strict; Secure;
    Path=/`, tanpa Domain. `Max-Age` hanya untuk "Ingat saya".
  - Token 256-bit acak, dan di DB hanya tersimpan SHA-256-nya.
  - Masa berlaku 12 jam (tanpa ingat) atau 30 hari geser.
  - `keluar` mencabut sesi.
  - Sesi otomatis tidak berlaku kalau kamar berganti penghuni (`sesiDari`
    mencocokkan `nama_norm`). `kosan_akun_reset` mencabut semua sesi kamar.
- **Galat:**
  - Semua error tak terduga → `503` generik. Log hanya berisi
    status/pesan galat, tanpa PIN, token, atau body.
  - Tidak ada `console.log`, `TODO`, atau `debugger` tertinggal di `api/`
    maupun `index.html`.
  - Ada satu `console.warn`/`console.error` dengan pesan generik di
    `jalankan.js`.
- **IP:** diambil dari `X-Forwarded-For` (ditimpa Vercel), disimpan sebagai
  HMAC + HMAC prefiks, bukan IP mentah. Batas IPv6 dihitung per /64, dan
  alamat IPv4-mapped diperlakukan sebagai IPv4.

**SQL (migrasi `supabase/migrations/20261113_rasa_aman_fase_a.sql`)**
- Semua 5 tabel Fase A memakai RLS tanpa policy. Hak `public`, `anon`, dan
  `authenticated` dicabut eksplisit (baris 67-79), sehingga anon tidak bisa
  membaca langsung. `service_role` melewati RLS sesuai rancangan.
- Semua fungsi `SECURITY DEFINER` memakai `set search_path = ''` dengan nama
  ber-skema.
- Hak `EXECUTE` dicabut dari `public`, `anon`, dan `authenticated`.
  `kosan_akun_reset` dan `kosan_akun_buka` juga dicabut dari `service_role`
  (khusus pemilik).
- `kosan_gerbang_ambil` memakai `FOR UPDATE` dan `if not found then return
  false` (aman saat baris terhapus). Saat gerbang mulai dari nol, fungsi ini
  hanya menghapus `kosan_login_attempts` untuk kunci `pin:` (tidak `pw:`).
- Migrasi idempoten, dalam satu transaksi.
- Catatan: `kosan_login`, `kosan_register`, `kosan_occupants`, dan tabel
  lama **tidak ada di repo**, jadi tidak bisa diaudit di sini (lihat V1, V3).

**Klien (`index.html`)**
- Tidak ada `input type="password"` dan tidak ada `autocomplete` password,
  jadi Chrome tidak punya apa pun untuk disimpan.
- Tidak ada kode hidup yang merujuk password, scrypt, HIBP, atau tiket
  setup, baik di `api/`, klien, maupun tes. Yang tersisa hanya komentar
  riwayat dan regex di tes yang menegaskan ketiadaannya.
- Skrip deploy tidak ada di repo.
- **Login dua langkah:**
  - Nama bukan penghuni → pesan belum terdaftar tanpa keypad.
  - Keypad PIN → `/api/masuk`. PIN tidak disimpan di perangkat (e2e `C6`).
- **Daftar:** keypad 2x, PIN = username ditolak sebelum dikirim, lewat
  `/api/daftar`. Klien tidak memanggil `kosan_login` maupun
  `kosan_register` anon (e2e `Z4`).
- **Tamu `Tamu-N`:**
  - Sekali ketuk, tidak membaca kolom nama.
  - Nomor N menghindari nama penghuni dan pemain online.
  - Saat bentrok, yang `playerId`-nya lebih besar mengalah.
  - Nama tamu tidak disimpan di perangkat.
- **PIN kamar tiap kali:** izin sekali pakai 10 detik, dan keypad tidak
  memanggil keyboard HP.
- **Perbaikan 9b/9c/10 bertahan:**
  - Pesan gabungan hanya muncul di mode MASUK, dan pesan penuh polos di mode
    DAFTAR (`klien.test.js:133`, `:139`).
  - Tamu saat penuh bernama "Tamu-1 · tamu" (`:194`, e2e `H1`).
  - Tombol KAMAR KAMU memberi toast (`:224`, e2e `H3`).
- **Pertahanan port `__proto__`** (dibaca, tidak dites):
  - `mpIdSah` (`index.html:1162`, regex + tolak `'prototype'`);
  - `remotePlayers = Object.create(null)` (`:5242`, juga di
    `mpHitungDuplikat` dan `tamuPilihNomor`);
  - token bucket pemain baru (`mpAmbilToken` `:1168`, `mpBolehBuatBaru`
    `:5244`, dipakai `:5400`, `:5417`);
  - `mpProsesPesan` (`:1219`, id topik = id isi pesan).

  Semuanya masih utuh.

**Konfigurasi**
- `vercel.json` berisi `regions: ["sin1"]`. CSP `connect-src` hanya
  mengizinkan `'self'`, dua broker publik (sudah diketahui), dan Supabase.
  Ada juga `frame-ancestors 'none'`, `object-src 'none'`, `nosniff`, dan
  `X-Frame-Options: DENY`.
- Berkas yang dirujuk `index.html` saat runtime:
  - `vendor/three/three.module.js` (importmap)
  - `vendor/html2canvas.min.js`
  - `vendor/mqtt/mqtt.min.js` (dimuat dinamis)
  - `fonts/fonts-local.css` + 8 `woff2`
  - `assets/favicon.png`, `assets/og.jpg`

  Tambah `kosan-3d.html` (redirect), `vercel.json`, dan 10 berkas `api/`.
  Daftar deploy cukup memuat berkas-berkas itu.

## Urutan saran (untuk diputuskan Ryan)

1. **V1** (cek RLS `kosan_residents`) dan **P2** (revoke yang benar):
   keduanya cepat dan berdampak paling besar.
2. **P1** (batas IP hanya untuk yang gagal), sebelum video berikutnya
   tayang.
3. **P3**: jalankan query V3 dulu. Kalau ada nama di luar charset, perbaiki
   login.
4. **P4**: merge PR #4 sesudah V2 cocok.
5. Minor dan Observasi bisa dikerjakan bertahap.

---

## Status perbaikan 11 (perintah Ryan 14 Nov 17:13)

| Temuan | Status | Di mana |
|---|---|---|
| P1 batas IP hitung sukses | Diperbaiki: sukses mengembalikan 1 unit (`batasKembali`, atomik, ≥0); nilai 20/20/60 tetap | `api/_lib/app.js`, `api/_lib/db.js`, `supabase/migrations/20261114_batas_kembali.sql` (perlu dijalankan) |
| P2 revoke | Ditangani terpisah oleh Vesper (cron) — tidak disentuh | — |
| P3 charset di login | Diperbaiki: login hanya normalize + panjang ≤30 → 401 `tidak_terdaftar`; charset hanya saat daftar | `api/_lib/app.js` (`masuk`); klien sudah ditutup oleh cek belum-terdaftar |
| P4 desain basi | §5 desain ditandai DICABUT di branch PR #3; merge PR #4 ditunda sampai promosi | `docs/RASA-AMAN-DESAIN.md` (PR #3) |
| M1 jatah gerbang hilang saat DB error | Diperbaiki (`gerbangLepas` lalu lempar ulang) | `api/_lib/app.js` (`cekPin`) |
| M2 tutup keypad tidak membatalkan | Diperbaiki (jawaban diabaikan bila keypad sudah ditutup/berganti) | `index.html` (`pinTutup`, `pinMasihAktif`, `pinKirim*`, daftar) |
| M3 nama terpakai ditolak telat | Diperbaiki (cek sebelum keypad) | `index.html` (`entryDaftar`) |
| M4 nama `tamu-N` | Diperbaiki (server + klien) | `api/_lib/app.js` (`daftar`), `index.html` |
| M5 pesan sesudah login | Diperbaiki ("Login berhasil, tapi daftar kamar belum termuat…", tombol jadi "Masuk Kosan") | `index.html` |
| M6 komentar basi | Diperbaiki (grep frasa = 0) | `index.html` |
| M7 arti `setup` | Didokumentasikan (tanpa migrasi) | `docs/RASA-AMAN-FASE-A.md` |
| O1 berkas mati | OrbitControls dikeluarkan dari daftar deploy (README); `app.js`/`style.css`/`confetti` TIDAK dihapus karena masih dirujuk dokumen riwayat | `README.md` |
| O4 tautan tamu di mode MASUK | Disengaja (konsisten dengan pesan "atau masuk sebagai tamu"); tidak diubah | — |
| O8 HSTS | Tidak ditambah: Vercel menyetel sendiri di domain bawaan; cara cek di runbook | `docs/RASA-AMAN-FASE-A.md` |
| O9 rotasi secret | Didokumentasikan | `docs/RASA-AMAN-FASE-A.md` |
