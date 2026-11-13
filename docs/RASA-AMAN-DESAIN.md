# RASA-AMAN-DESAIN — login penghuni, broker ber-login, PIN kamar

> **Status:** DESAIN, diajukan untuk disetujui. Belum ada kode yang diubah.
> Ditulis 13 Nov 2026 dari brief ronde "rasa aman" (berbasis `main` 1876ae3).
> Tujuan ronde: tutup tiga celah yang merusak rasa aman penghuni, yaitu
> menyamar jadi tetangga, menghilangkan avatar orang, dan nama kasar.
>
> Tanda **[CEK]** = fakta yang belum bisa saya verifikasi dari sandbox dan
> wajib dicek di console sebelum implementasi. Kalau hasil cek berbeda,
> bagian yang ditandai punya rencana cadangan.

---

## 0. Ringkasan keputusan yang diminta

| # | Usulan | Alternatif |
|---|---|---|
| 1 | **Broker: EMQX Cloud Serverless.** HiveMQ Cloud Serverless sudah tidak bisa dibuat baru dan mati 31 Des 2026 (§2). | HiveMQ Starter/Launch berbayar (mulai $299/bln) |
| 2 | **Jalur server: Vercel Functions di domain yang sama** (`/api/*`). IP klien dari Vercel tidak bisa dipalsukan, dan sesi bisa disimpan di cookie HttpOnly (§3). | Supabase Edge Functions (IP dari `x-forwarded-for` dilaporkan bisa dipalsukan) |
| 3 | **Kredensial MQTT: JWT berumur 1 jam** kalau JWT tersedia di Serverless **[CEK]**. Cadangan: user bawaan EMQX yang dibuat/dihapus lewat API. | — |
| 4 | **Protokol multiplayer v2:** id pemain pindah ke TOPIK (`.../pos/<id>`), broker hanya mengizinkan publish ke topik id sendiri, dan nama penghuni diambil dari daftar penghuni, bukan dari isi pesan (§7). | — |
| 5 | **PIN TIDAK diwajibkan unik.** Memaksa unik justru membocorkan PIN orang lain (§6.3). Ini menyimpang dari brief, jadi perlu persetujuan. | Ikuti brief (ganti PIN 2 penghuni) |
| 6 | **Batas belanja EMQX ±$5/bln**, bukan $0. Dengan $0, multiplayer mati begitu kuota gratis 1 GB habis (§2.3). | $0 (multiplayer bisa mati di tengah bulan) |
| 7 | **Sembunyikan pemain:** penghuni = permanen, tamu = per sesi (§9.2). | Semua per sesi |
| 8 | **Retensi log IP + perangkat 90 hari**, IP disimpan sebagai HMAC (bukan IP mentah) (§8). | Simpan IP mentah |

---

## 1. Temuan di kode sekarang yang membentuk desain

Ini hasil membaca `index.html` di `main` 1876ae3, bukan dugaan:

1. **PIN dikirim sebagai hash yang dihitung di browser** (`pinHash`, FNV-1a
   10.000x, salt tetap `kosan-ibu-kos-pin-v1`). Server membandingkan hash itu
   dengan `pin_hash`. Akibatnya:
   - `pin_hash` yang tersimpan = setara password. Siapa pun yang tahu
     hash-nya bisa login lewat `kosan_login` tanpa tahu PIN.
   - Salt sama untuk semua orang, jadi PIN sama = hash sama. Itu sebabnya
     terlihat 2 penghuni berbagi PIN.
   - Ruang PIN cuma 1 juta. Kalau isi tabel bocor, PIN bisa ditebak offline.
2. **Status penghuni cuma boolean di browser** (`isResidentSession`). Server
   tidak menerbitkan token apa pun sesudah login. Multiplayer sama sekali
   tidak tahu siapa yang login.
3. **Multiplayer masih di broker publik, satu topik `pos` bersama**, dengan
   `id` dan `nama` di dalam isi pesan. Broker ber-login pun tidak bisa
   memeriksa isi pesan. Jadi, kalau topiknya tidak diubah, login di broker
   tidak menghentikan penyamaran (§7).
4. **Gerbang tamu dan kamar ada di browser** (`masukTamu`, `enterRoom` →
   `ktaIsResident`). Gerbang ini mencegah salah pencet, tapi bisa dilewati
   lewat devtools.
5. **`kosan_login` bisa dipanggil siapa saja dengan anon key.** Kalau
   password ditambah tapi jalur ini tetap terbuka, password tidak ada
   gunanya karena orang tetap bisa login pakai PIN saja.
6. Pertahanan ronde port (`mpIdSah`, token bucket, `Object.create(null)`,
   `mpProsesPesan`) **tetap dipakai**. Desain v2 hanya menambah cek.
7. Temuan sampingan, bukan keamanan: `mpRealmDikenal` (baris ±1069) hanya
   mengenal `yard`, `living`, `room-1..20`. Alam `dapur` dianggap `yard`,
   jadi pemain yang sedang di dapur kemungkinan tampil di halaman pada
   layar orang lain. v2 harus memasukkan `dapur` ke daftar alam (§7.1).

---

## 2. Pilihan broker

### 2.1 Perbandingan

| | HiveMQ Cloud Serverless | EMQX Cloud Serverless |
|---|---|---|
| Status | **Dipensiunkan 31 Des 2026. Cluster Serverless baru sudah tidak bisa dibuat** ([HiveMQ docs](https://docs.hivemq.com/hivemq-cloud), [halaman EOL](https://docs.hivemq.com/hivemq-cloud/serverless-end-of-life.html)) | Aktif |
| Koneksi bersamaan gratis | 100 ([HiveMQ](https://hivemq.atlassian.net/wiki/spaces/HCSP/pages/2539683951/How+can+I+calculate+my+estimated+costs)) | Maks 1.000 ([batas EMQX](https://docs.emqx.com/en/cloud/latest/create/restriction.html)), ditagih per menit sesi |
| Kuota gratis/bulan | 10 GB trafik | **1 GB trafik** ([EMQX](https://docs.emqx.com/en/cloud/latest/deployments/alerts_guide/free_traffic_limit_reached.html)) + 1 juta menit sesi ([EMQX](https://docs.emqx.com/en/cloud/latest/deployments/alerts_guide/free_minutes_limit_reached.html)) |
| Lewat kuota | Tidak relevan (pensiun) | $0,15/GB. Kalau batas belanja $0, deployment **berhenti** sampai bulan berikut ([EMQX](https://docs.emqx.com/en/cloud/latest/deployments/spend_limit.html)) |
| ACL per pengguna | Serverless cuma punya aturan otorisasi dasar. Manajemen akses lanjutan + REST API ada di Starter ([HiveMQ](https://www.hivemq.com/blog/hivemq-cloud-serverless-vs-starter-mqtt-iot-or-iiot/)) | Otorisasi bawaan dengan placeholder `${username}` di topik ([EMQX](https://docs.emqx.com/en/cloud/latest/best_practices/acl_v5.html), [default authz](https://docs.emqx.com/en/cloud/latest/deployments/default_authz.html)) **[CEK: tersedia di Serverless]** |
| Provisioning kredensial | Console. API hanya di paket berbayar | API deployment (AppID/Secret) + impor massal ([EMQX](https://emqx.com/en/blog/mastering-iot-solution-with-emqx-cloud-serverless-addition)). JWT ([EMQX](https://docs.emqx.com/en/cloud/latest/deployments/jwt_auth.html)) **[CEK: tersedia di Serverless]** |
| Paket berikutnya | Mulai $299/bln ([HiveMQ pricing](https://www.hivemq.com/pricing/)) | Bayar sesuai pakai, di paket yang sama |

**Rekomendasi: EMQX Cloud Serverless.** HiveMQ gugur karena paketnya tidak
bisa dibuat lagi dan mati 7 minggu dari sekarang.

### 2.2 [CEK] yang harus dipastikan di console EMQX sebelum mulai

1. Apakah autentikasi JWT tersedia di Serverless? Kalau tidak → pakai user
   bawaan via API (§7.2 opsi B).
2. Apakah placeholder `${username}` di ACL bawaan berlaku di Serverless?
   Kalau tidak → aturan ACL per user dibuat lewat API (2 aturan per user).
3. Bisakah aturan "tidak ada yang cocok = tolak" diatur?
4. Batas jumlah user bawaan, batas ukuran pesan, dan batas laju pesan per
   klien.
5. Apakah ACL juga diperiksa untuk pesan last-will?

### 2.3 Perkiraan trafik (angka kasar, wajib diukur di minggu pertama)

Asumsi:
- Satu pesan `pos` v2 ≈ 120 byte di jaringan (isi pesan diringkas, sudah
  termasuk overhead MQTT/WebSocket/TLS).
- Tiap pemain bergerak 30% waktu di 10 Hz, sisanya heartbeat tiap 3 detik.
  Rata-rata ≈ 3,2 pesan/detik per pemain.
- Langganan per alam (§7.3), dan MQTT 5 `noLocal` aktif (pesan sendiri tidak
  dikirim balik).

| Pemain online bersamaan | Trafik/jam | Kuota 1 GB habis dalam | Biaya kalau 2 jam/hari selama sebulan |
|---|---|---|---|
| 5 | ~35 MB | ~29 jam main | ~$0,2 |
| 10 | ~140 MB | ~7 jam main | ~$1,1 |
| 20 | ~550 MB | ~2 jam main | ~$4,8 |

Kesimpulan:
- Kuota gratis 1 GB bisa habis dalam beberapa hari kalau satu video ramai.
  Karena itu saya usul batas belanja ±$5/bln, bukan $0.
- Kalau mau lebih hemat: turunkan laju gerak 10 Hz → 5 Hz. Trafik turun
  ±45%, dan gerakan tetap mulus karena ada lerp.
- **Pertanyaan:** berapa pemain online bersamaan di jam ramai sekarang?

---

## 3. Arsitektur

```
Browser (index.html)
  │  HTTPS, domain sama: /api/*  (cookie sesi HttpOnly)
  ▼
Vercel Functions (Node) ── service role ──► Supabase Postgres
  │  - login / setup password / logout     (tabel + RPC, RLS tertutup)
  │  - kredensial MQTT (penghuni + tamu)
  │  - masuk kamar (cek PIN)
  │  - lapor
  │  - catat IP (dari header Vercel) + id perangkat
  │
  └─ menerbitkan JWT / user MQTT ──► EMQX Cloud Serverless (wss, ber-login, ACL)
                                         ▲
Browser ── wss (kredensial dari /api) ───┘
```

Kenapa Vercel Functions, bukan Supabase Edge Functions:

- **IP klien.** Vercel menimpa `X-Forwarded-For` supaya IP tidak bisa
  dipalsukan ([Vercel docs](https://vercel.com/docs/headers/request-headers)).
  Di Supabase, ada laporan bahwa header ini bisa dipalsukan pengirim
  ([diskusi Supabase](https://github.com/orgs/supabase/discussions/34647)).
- **"Ingat saya" tanpa token yang bisa dibaca JavaScript.** Karena domainnya
  sama, token sesi bisa disimpan di cookie `HttpOnly; Secure;
  SameSite=Strict`. Script di halaman (termasuk script jahat kalau ada XSS)
  tidak bisa membacanya. Edge Function ada di domain lain (`supabase.co`),
  jadi cookie-nya dianggap pihak ketiga dan diblokir Safari/in-app browser
  IG.
- **CSP lebih sempit.** `connect-src` cukup `'self'` + broker EMQX.

**[CEK]** Pipeline deploy Vesper (`vercel_deploy.py`, daftar file eksplisit)
harus bisa ikut men-deploy `api/*.js` dan env var. Kalau tidak bisa, cadangan
= Supabase Edge Functions. Akibatnya: sidik IP jadi sinyal lemah (bisa
dipalsukan), dan token sesi disimpan di `localStorage`.

Rahasia hanya ada di env var Vercel: `SUPABASE_SERVICE_ROLE_KEY`,
`EMQX_JWT_SECRET` (atau `EMQX_APP_ID`/`EMQX_APP_SECRET`), `IP_HMAC_SECRET`.
**Tidak ada kredensial di repo atau di kode browser.**

---

## 4. Identitas pemain v2

| Jenis | `playerId` | Asal | Contoh |
|---|---|---|---|
| Penghuni | `pk` + nomor kamar | Diterbitkan server dari akun yang login | `pk13` |
| Tamu | `pt` + 8 karakter acak | Diterbitkan server saat minta kredensial tamu | `pt8f2kq0zx` |

- Keduanya tetap lolos `mpIdSah` (`^p[a-z0-9]{1,16}$`), jadi validasi lama
  tidak perlu dilonggarkan.
- Browser tidak lagi membuat `playerId` sendiri untuk multiplayer.
  `kosan3d-id` lama dibiarkan dan tidak dipakai.
- **Satu penghuni, satu avatar.** `clientId` MQTT = `playerId` persis.
  Kalau penghuni masuk dari perangkat kedua, koneksi lama ditendang broker.
  Klien yang ditendang (reason code MQTT 5 `0x8E`) TIDAK menyambung ulang
  otomatis, dan menampilkan "Kamu masuk dari tab/perangkat lain". Tanpa
  aturan ini, dua tab akan saling tendang tiap 2 detik.

---

## 5. Alur masuk

### 5.1 Penghuni (sudah punya password)

1. Layar masuk: **username + password** + centang **"Ingat saya"**.
2. `POST /api/masuk {username, password, perangkat}` →
   - server: cek batas percobaan → scrypt verify → buat sesi.
   - set cookie `kosan_sesi`:
     - "Ingat saya" dicentang: `Max-Age` 30 hari, diperpanjang tiap
       dipakai.
     - Tidak dicentang: cookie sesi biasa, hilang saat browser ditutup.
   - balas `{room, name, gender, playerId}`.
3. Kunjungan berikut: `GET /api/sesi`. Kalau cookie masih berlaku, pemain
   langsung masuk tanpa mengetik apa pun.
4. Yang tersimpan di perangkat **hanya token sesi acak 256-bit** (di cookie
   HttpOnly). Di database yang disimpan hanya SHA-256 dari token itu.
   Password tidak pernah disimpan di perangkat, baik di `localStorage`,
   `sessionStorage`, maupun cookie yang bisa dibaca JS.
5. **Keluar:** `POST /api/keluar` mencabut sesi, cookie dihapus, dan
   kredensial MQTT ikut dicabut (§7.2).

Aturan password:
- minimal 8 karakter, ditolak kalau ada di daftar ±1.000 password umum,
  tanpa aturan "wajib simbol";
- di-hash di server dengan `crypto.scrypt` bawaan Node (N=2^15, r=8, p=1,
  salt acak 16 byte per akun), tanpa dependensi tambahan.

Batas percobaan:
- 5 salah per akun dalam 15 menit → akun dikunci 15 menit (pola sama dengan
  kunci PIN Ronde 61);
- 20 percobaan per IP per jam.

### 5.2 Penghuni lama: setup password sekali

Untuk 20 penghuni yang `password_hash`-nya masih kosong:

1. Pemain mengetik username + password apa saja → server membalas
   `perlu_setup` (tanpa memeriksa password).
2. UI: "Login pertama sejak pembaruan. Masukkan **PIN kamarmu** dulu ya."
3. `POST /api/setup/pin {username, pin}` → server menghitung hash lama
   (`pinHash` FNV, port 1:1 dari klien) dari PIN mentah dan membandingkan
   dengan `pin_hash`. **PIN dan `pin_hash` tidak diubah.** Lalu server
   menerbitkan tiket setup sekali pakai (5 menit).
4. UI: "Buat password" (2x) → `POST /api/setup/password {tiket, password}` →
   simpan hash scrypt, buat sesi, catat perangkat + IP (event `setup`).
5. **Sejak itu login hanya lewat username + password.** Jalur PIN-saja
   ditutup untuk akun itu. PIN tetap jadi PIN kamar.

Tidak ada yang daftar ulang dan tidak ada yang kehilangan kamar. Data nama,
kamar, gender, dan PIN tidak disentuh.

Lupa password (tanpa email): pemilik memverifikasi lewat DM IG, lalu
mengosongkan `password_hash` (runbook). Penghuni mengulang alur setup di
atas dengan PIN-nya.

### 5.3 Tamu

1. Tamu mengetik nama, lalu "Masuk sebagai tamu" (tanpa password).
2. `POST /api/tamu {nama, perangkat}` → server:
   - tolak nama yang sama dengan nama penghuni (pakai `normalize`, dan
     charset `usernameValid` mencegah homoglyph);
   - tolak nama yang kena filter kata (§9.1);
   - batas: 10 tamu per IP per jam, maks 200 tamu aktif;
   - terbitkan `pt...` + kredensial MQTT tamu (12 jam).
3. Tamu tidak punya sesi, jadi `/api/kamar/masuk` selalu menolak (§6).
4. Kalau `/api/tamu` gagal (server down), tamu tetap masuk dalam **mode
   sendiri**. Game tidak boleh mati.

---

## 6. PIN kamar

### 6.1 Alur

1. Ketuk pintu kamar sendiri / tombol KAMAR KAMU → modal PIN (kolom kosong,
   `autocomplete="off"`).
2. `POST /api/kamar/masuk {room, pin}` + cookie sesi → server cek:
   - sesi sah dan tidak dicabut;
   - akun sesi = pemilik `room`;
   - PIN cocok dengan `pin_hash` (hash dihitung di server dari PIN mentah);
   - batas: 5 salah per akun per 15 menit.
3. Cocok → 200 → `enterRoom(n)`. **PIN tidak pernah disimpan**, dan setiap
   kali masuk kamar wajib ketik lagi.

### 6.2 Yang dilindungi dan yang tidak (jujur)

- **Dilindungi:** orang yang memegang HP penghuni dengan sesi "Ingat saya"
  (teman, adik) bisa jalan-jalan sebagai penghuni itu, tapi tidak bisa masuk
  kamarnya lewat game.
- **Dilindungi:** penerima pesan multiplayer membuang pemain di alam
  `room-N` kalau pengirimnya bukan `pk<N>` (§7.4). Jadi tidak ada yang bisa
  "nongol" di kamar orang.
- **Tidak dilindungi:** isi kamar itu kode statis yang sama untuk semua
  orang. Klien yang dimodifikasi tetap bisa *menggambar* interior kamar di
  layarnya sendiri. Ini hanya terlihat oleh dirinya, tidak oleh penghuni
  lain. Kalau nanti kamar punya data pribadi (catatan, dekorasi), data itu
  harus diambil lewat server dengan tiket dari `/api/kamar/masuk`.

### 6.3 Dua penghuni berbagi PIN: usul menyimpang dari brief

Brief meminta keduanya ganti PIN supaya unik. Saya usul **tidak**, karena:

- **Memaksa PIN unik membocorkan PIN orang lain.** Pesan seperti "PIN ini
  sudah dipakai" memberi tahu bahwa ada akun lain dengan PIN itu, dan PIN
  itu bisa dicoba ke 19 akun lain.
- **PIN sama bukan celah sesudah ronde ini.** PIN baru bisa dipakai kalau
  sudah login dengan password akun pemilik kamar.
- **Menyuruh ganti PIN bertentangan dengan batasan "jangan ubah PIN".**
- Kemiripan PIN hanya terlihat karena salt-nya global (§1.1). Kemungkinan
  besar kedua akun itu Kamar 13 + 14 (dilla/dil, §8.3). Kalau terbukti orang
  yang sama, masalahnya selesai bersama penyelesaian duplikat.

Kalau tetap ingin dua PIN itu berbeda: sediakan fitur "Ganti PIN" untuk
semua penghuni (opsional, tanpa menyebut alasannya), bukan pesan ke dua
orang tertentu.

---

## 7. Kredensial MQTT, ACL, protokol v2

### 7.1 Topik v2 (realm ada di topik)

| Topik | Siapa boleh publish | Retained |
|---|---|---|
| `kosan-ibu-kos/v2/<alam>/pos/<id>` | hanya `<id>` itu | tidak |
| `kosan-ibu-kos/v2/presence/<id>` | hanya `<id>` itu | ya |

- `<alam>` = `yard`, `living`, `dapur`, `room-1`…`room-20`.
- ACL (satu set aturan untuk semua, pakai placeholder **[CEK]**):
  - izinkan publish `kosan-ibu-kos/v2/+/pos/${username}`
  - izinkan publish `kosan-ibu-kos/v2/presence/${username}`
  - izinkan subscribe `kosan-ibu-kos/v2/+/pos/+` dan
    `kosan-ibu-kos/v2/presence/+`
  - selain itu: tolak
- Efek ACL:
  - tidak ada yang bisa publish atas nama id lain;
  - tidak ada yang bisa mengosongkan presence orang lain (celah "ngilangin
    avatar orang");
  - tidak ada yang bisa menanam pesan retained di topik id lain.

### 7.2 Penerbitan kredensial

**Opsi A (diusulkan, kalau JWT tersedia di Serverless):**
- `GET /api/mqtt` (sesi penghuni / token tamu) → JWT HS256
  `{username: playerId, exp: 1 jam}`, plus klaim ACL kalau didukung.
- Klien menyambung dengan `username = playerId`, `password = JWT`.
- Klien meminta JWT baru ±5 menit sebelum kedaluwarsa, lalu menyambung
  ulang.
- **Pencabutan:** server berhenti menerbitkan JWT untuk sesi yang dicabut.
  Jendela paling lama 1 jam.

**Opsi B (cadangan): user bawaan EMQX lewat API.**
- `/api/mqtt` membuat user `playerId` + password acak 32 byte (rotasi tiap
  24 jam) dan membalasnya ke klien.
- **Pencabutan:** hapus user lewat API, langsung berlaku.
- Butuh pembersihan: cron (Vercel Cron atau `pg_cron`) menghapus kredensial
  tamu yang lebih dari 12 jam.

Di kedua opsi, kredensial MQTT memang harus bisa dibaca JS (mqtt.js butuh).
Itu sebabnya umurnya pendek. Sesi panjang tetap di cookie HttpOnly.

### 7.3 Isi pesan + langganan per alam

- `pos` v2 diringkas: `{"x":2.53,"z":8.1,"r":3.14,"g":0.8,"p":"duduk"}`.
  Tanpa `id`/`nama`/`gender`/`realm`, karena semuanya sudah ada di topik
  atau presence.
- Klien hanya subscribe `v2/<alamku>/pos/+` dan presence. Pindah alam =
  unsubscribe lalu subscribe baru. Pemain di kamar hampir tidak menerima
  trafik.
- MQTT 5 + `noLocal`. mqtt.js 5.10.1 di `vendor/mqtt/` mendukungnya.

### 7.4 Aturan penerima (lapisan kedua, di atas ACL)

`mpProsesPesan` diperluas. Cek lama tetap ada, ditambah:

1. `id` diambil dari **topik**. Isi pesan tidak boleh membawa id lain.
2. **Nama penghuni dari `OCCUPANTS`, bukan dari pesan.** `pk13` selalu
   bernama penghuni Kamar 13, apa pun isi pesannya.
3. **Nama tamu:**
   - tampil dengan penanda (mis. `Budi · tamu`);
   - kalau nama tamu sama dengan nama penghuni (`normalize`) atau kena
     filter → tampil `Tamu #8f2k`.
4. Pesan di alam `room-N` dari id selain `pk<N>` → dibuang.
5. Id di daftar sembunyi (§9.2) → tidak dirender.

Penegakan di sisi penerima sudah cukup untuk tampilan. Pengirim nakal bisa
mengubah layarnya sendiri, tapi tidak bisa mengubah apa yang dilihat orang
lain.

### 7.5 Cut-over dari broker publik

- Versi baru **berhenti total** memakai `broker.emqx.io` / `broker.hivemq.com`.
  Keduanya dihapus dari `BROKERS` dan dari CSP `connect-src`.
- Klien lama yang masih ter-cache tetap di dunia lama (broker publik) dan
  tidak terlihat di dunia baru. Tidak ada yang rusak. Mereka pindah sendiri
  setelah reload.
- `kosan_login` (login PIN-saja) dicabut aksesnya dari `anon` saat cut-over
  (`REVOKE EXECUTE ... FROM anon`). Sesudah itu, PIN hanya diperiksa lewat
  server dengan service role.

---

## 8. Sidik perangkat + duplikat

### 8.1 Data yang dikumpulkan

| Sinyal | Asal | Bobot |
|---|---|---|
| `perangkat` | UUID acak di `localStorage` `kosan3d-perangkat`, dibuat sekali | Utama |
| IP | Header Vercel di server. **IP dari klien tidak pernah dipercaya** | Pendukung |

- IP disimpan sebagai `HMAC-SHA256(IP_HMAC_SECRET, ip)` plus HMAC prefiks
  (/24 untuk IPv4, /48 untuk IPv6), bukan IP mentah. Pemilik tetap bisa
  melihat "dua akun dari IP yang sama", tapi daftar IP penghuni tidak
  tersimpan. **Pertanyaan:** perlu IP mentah untuk keperluan lain?
- Dicatat saat: `setup`, `masuk`, `tamu`.
- **Retensi 90 hari**, dihapus otomatis oleh cron.
- Hanya pemilik yang bisa baca: RLS aktif tanpa policy `anon`, dibaca lewat
  dashboard Supabase.
- Perlu satu kalimat pemberitahuan di layar masuk, misalnya: "Untuk mencegah
  akun ganda, kami mencatat perangkat dan alamat jaringanmu saat masuk."
  (UU PDP mengatur data seperti ini.)

### 8.2 Keterbatasan

- `perangkat` hilang kalau storage dihapus atau pemain memakai mode
  penyamaran.
- Banyak pengguna HP berbagi satu IP lewat operator, dan IP berubah-ubah.
- Jadi sinyal ini hanya **kandidat untuk ditinjau pemilik**, bukan bukti dan
  bukan dasar tendang otomatis.

### 8.3 Kamar 13 "dilla" + Kamar 14 "dil"

- View `kosan_duplikat_kandidat` menandai pasangan akun yang setup/masuk dari
  `perangkat` sama (kuat) atau HMAC IP sama dalam 24 jam (lemah).
- Pemilik yang memutuskan mana yang ditendang. **Tidak ada tendangan sebelum
  ronde ini jalan.** Tidak ada yang otomatis.
- Kalau hanya salah satu yang pernah setup, view tidak bisa menyimpulkan
  apa-apa. Pemilik bisa menunggu, atau bertanya lewat DM.

---

## 9. Pendamping

### 9.1 Filter kata kasar

- **Disimpan di** tabel Supabase `kosan_kata_terlarang (kata, tingkat)`.
  Pemilik bisa menambah kata tanpa deploy. Klien membacanya lewat RPC publik
  `kosan_kata_list()` (daftar ini memang tidak rahasia) dan menyimpannya di
  cache per sesi.
- **Dicek di:** `/api/tamu` (server, wajib) dan di penerima (§7.4).
- **Normalisasi sebelum cocok:**
  - huruf kecil;
  - buang spasi/titik/strip/underscore;
  - leet `4→a 1→i 3→e 0→o 5→s 7→t`;
  - huruf berulang dipadatkan.
- **Dua tingkat:**
  - `keras` = cocok di dalam kata;
  - `lunak` = harus kata utuh (mengurangi salah tangkap pada nama yang
    kebetulan mengandung potongan kata).
- **Nama penghuni yang sudah terdaftar selalu lolos** (masuk whitelist).
  Data penghuni tidak diubah.
- **Kalau nama ditolak:** "Nama ini nggak bisa dipakai di kos. Coba nama lain
  ya." Kata yang kena tidak disebut.

### 9.2 Sembunyikan pemain

- Ketuk avatar pemain lain → kartu kecil: **Sembunyikan · Laporkan**. Ini
  perubahan dari spek v1: avatar remote jadi bisa diketuk. Ketukan pintu
  tetap menang kalau pintu lebih dekat.
- Hanya di layar sendiri. Pemain yang disembunyikan tidak diberi tahu.
- Penghuni (`pk..`) = **permanen** di `localStorage` `kosan3d-sembunyi`,
  karena id penghuni stabil.
- Tamu (`pt..`) = **per sesi**, karena id tamu acak per kunjungan.
- Daftar yang disembunyikan bisa dibuka lagi dari menu.

### 9.3 Lapor

Tabel `kosan_laporan`:

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | bigserial | |
| `dibuat` | timestamptz | default `now()` |
| `pelapor_id` | text | `pk..` / `pt..` |
| `pelapor_sesi` | uuid null | sesi penghuni |
| `dilaporkan_id` | text | |
| `dilaporkan_nama` | text | snapshot label saat dilapor |
| `alasan` | text | `nama_kasar` / `pelecehan` / `menyamar` / `spam` / `lainnya` |
| `catatan` | text | maks 280 |
| `alam` | text | |
| `perangkat`, `ip_hmac` | text | |
| `status` | text | `baru` / `ditinjau` / `ditindak` / `ditolak` |

- RPC `kosan_lapor(...)`: `SECURITY DEFINER`, `EXECUTE` hanya untuk
  `service_role`. Dipanggil dari `/api/lapor`, karena IP harus dicatat dari
  server.
- **Batas:** 5 laporan per pelapor per jam. Laporan sama (pelapor +
  dilaporkan) dalam 10 menit digabung.
- RLS aktif tanpa policy publik. Hanya pemilik yang membaca.
- **Pertanyaan:** perlu notifikasi ke pemilik kalau ada laporan baru (mis.
  email harian)? Di desain ini belum ada.

---

## 10. Skema data (tambahan saja, tabel lama tidak diubah)

**[CEK]** Saya belum melihat skema Supabase asli (SQL tidak ada di repo).
Mohon kirim definisi tabel penghuni + fungsi `kosan_*`, tanpa data.

| Tabel baru | Isi |
|---|---|
| `kosan_akun` | FK ke baris penghuni, `password_hash`, `password_dibuat`, `gagal_count`, `kunci_sampai` |
| `kosan_sesi` | `id`, FK akun, `token_sha256`, `ingat`, `dibuat`, `dipakai`, `kedaluwarsa`, `dicabut` |
| `kosan_perangkat_log` | FK akun null, `peristiwa`, `perangkat`, `ip_hmac`, `ip_prefiks_hmac`, `dibuat` |
| `kosan_kata_terlarang` | `kata`, `tingkat` |
| `kosan_laporan` | §9.3 |
| `kosan_batas` | penghitung batas percobaan: `kunci`, `jendela`, `jumlah` (RPC increment atomik) |

Semua RLS aktif. Semua RPC tulis hanya untuk `service_role`. Yang tetap
publik: `kosan_occupants` (nama + kamar memang publik) dan
`kosan_kata_list`.

---

## 11. Urutan rilis

1. **Fase A, server + login:** tabel, Vercel Functions, layar login +
   setup password, PIN kamar via server. Multiplayer tetap v1 sementara.
2. **Fase B, broker v2:** EMQX, protokol v2, cut-over (§7.5), cabut `anon`
   dari `kosan_login`.
3. **Fase C, pendamping:** filter, sembunyikan, lapor.
4. **Fase D, duplikat:** view kandidat. Pemilik meninjau, lalu memutuskan.

Fase A bisa dirilis sendiri. Fase B baru menutup penyamaran dan penghilangan
avatar.

---

## 12. Verifikasi

### 12.1 Unit test (RED di kode sekarang → GREEN sesudah fix)

Fungsi murni diekstrak verbatim seperti harness ronde port:

1. Pesan `pos` di topik `pk13` yang mengaku nama lain → label tetap nama
   penghuni Kamar 13.
2. Tamu `pt..` dengan nama penghuni / nama kena filter → label
   `Tamu #xxxx`.
3. Pesan alam `room-13` dari `pk14` / `pt..` → dibuang.
4. Id di daftar sembunyi → tidak dirender. Penghuni tersimpan permanen,
   tamu tidak.
5. Filter: normalisasi leet / spasi / pengulangan. Tingkat keras vs lunak.
   Whitelist nama penghuni.
6. Server: `/api/tamu` menolak nama penghuni. `/api/kamar/masuk` menolak
   tamu, menolak penghuni lain, dan menolak PIN salah. Kunci aktif sesudah
   5 salah.
7. Port `pinHash` server = klien untuk vektor uji (tanpa PIN asli).
8. Akun dengan password: jalur PIN-saja ditolak.
9. Regresi: semua tes ronde port tetap lolos.

### 12.2 Review independen

Baca kode + ulang angka tes → status Approved sebelum deploy.

### 12.3 Preview + playtest dua tab (benign, tanpa pesan racun)

- Penghuni + tamu saling melihat. Label tamu bertanda.
- Tamu yang mencoba masuk pakai nama penghuni → ditolak `/api/tamu`.
- 0 error CSP, 0 request ke unpkg, 0 request ke broker publik.

### 12.4 Tes live di produksi (6 PASS)

1. Login penghuni + "Ingat saya" → reload → tetap masuk. Tidak ada password
   di `localStorage`/`sessionStorage`/`document.cookie`.
2. Masuk kamar minta PIN. Keluar lalu masuk lagi → minta PIN lagi.
3. Tamu masuk bebas. Tamu tidak bisa masuk kamar (server 403).
4. Tamu dengan nama penghuni ditolak.
5. Penghuni + tamu saling melihat di dua perangkat.
6. 0 error CSP, 0 request unpkg, 0 request broker publik, mqtt tersambung ke
   EMQX.

---

## 13. Estimasi

| Bagian | Perkiraan |
|---|---|
| Setup EMQX + [CEK] §2.2 (butuh akun + kartu pemilik) | 0,5 hari |
| Skema Supabase + RPC + RLS | 1 hari |
| Vercel Functions (masuk, setup, sesi, keluar, mqtt, tamu, kamar, lapor, batas) | 2–3 hari |
| Klien: layar login/setup, modal PIN, protokol v2, sembunyikan/lapor, filter | 3–4 hari |
| Tes, review, preview, live | 1,5–2 hari |
| **Total** | **±8–11 hari kerja** |

Risiko estimasi: hasil [CEK] EMQX (opsi B menambah ±1 hari), dan apakah
pipeline deploy bisa men-deploy Functions.

---

## 14. Sisa risiko + yang TIDAK ditutup ronde ini

- **Password dibagikan / HP dipinjam dengan "Ingat saya":** orang itu bisa
  jalan sebagai penghuni. PIN hanya melindungi kamar.
- **Nama tamu yang lolos filter tapi tetap menyakitkan:** ditangani lewat
  sembunyikan + lapor. Belum ada moderasi real-time.
- **Laporan dibaca manual** oleh pemilik. Belum ada notifikasi.
- **Tamu iseng yang jalan-jalan mengganggu:** dibatasi per IP, tapi tidak
  dicegah.
- **Sidik perangkat mudah di-reset.** Duplikat cuma kandidat.
- **XSS:** CSP masih `'unsafe-inline'` (script modul inline). Kalau ada XSS,
  kredensial MQTT berumur pendek bisa dicuri, tapi cookie sesi tidak.
  Memindah script ke file terpisah supaya CSP bisa ketat = ronde
  tersendiri.
- **Kuota EMQX habis + batas belanja tercapai → multiplayer mati sampai
  bulan berikut.** Game jatuh ke mode sendiri.
- **PIN 6 digit + hash FNV lemah kalau isi database bocor.** Membungkus ulang
  `pin_hash` dengan scrypt di server bisa dilakukan tanpa mengubah PIN, tapi
  itu mengubah data tersimpan, jadi perlu izin terpisah.
- **Balapan setup pertama:** orang yang tahu PIN penghuni bisa membuat
  password lebih dulu. Mitigasi: batas percobaan, log perangkat, pemulihan
  lewat pemilik.
- **Reset password lewat DM IG** rawan rekayasa sosial. Pemilik harus
  memverifikasi.
- **Broker publik v1 tetap terbuka** untuk siapa pun. Tidak berbahaya karena
  sesudah cut-over tidak ada klien baru yang mendengarkan.

---

## 15. Pertanyaan terbuka

1. Setuju EMQX + batas belanja ±$5/bln? Akun EMQX + kartu atas nama pemilik.
2. Setuju Vercel Functions? Bisakah pipeline deploy Vesper membawa `api/` +
   env var?
3. Setuju PIN tidak dipaksa unik (§6.3)?
4. Berapa pemain online bersamaan di jam ramai?
5. IP cukup disimpan sebagai HMAC? Retensi 90 hari?
6. Sembunyikan: penghuni permanen, tamu per sesi, setuju?
7. Penanda tamu di label: `· tamu`, ikon, atau warna?
8. Perlu notifikasi laporan ke pemilik?
9. Kirim skema SQL tabel penghuni + fungsi `kosan_*` (tanpa data).
