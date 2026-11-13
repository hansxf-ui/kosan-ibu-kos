# RASA-AMAN-DESAIN — login penghuni, relay ber-token, PIN kamar

> **Status:** DESAIN v2, disetujui 13 Nov 2026. Broker diganti Cloudflare
> Durable Objects (keputusan pemilik sesudah perbandingan broker). Fase A
> (server + login + PIN kamar) sedang diimplementasi.
> Berbasis `main` 1876ae3. Tujuan ronde: tutup tiga celah yang merusak rasa
> aman penghuni, yaitu menyamar jadi tetangga, menghilangkan avatar orang,
> dan nama kasar.
>
> Tanda **[CEK]** = fakta yang belum terverifikasi dan wajib dicek sebelum
> fase yang memakainya. Bagian yang ditandai punya rencana cadangan.

---

## 0. Ringkasan keputusan

| # | Keputusan | Status |
|---|---|---|
| 1 | **Relay multiplayer: Cloudflare Durable Objects**, SATU DO global, Hibernation API (§2, §7). Pengganti broker MQTT. | Disetujui |
| 2 | **Jalur server: Vercel Functions di domain yang sama** (`/api/*`). IP klien dari Vercel tidak bisa dipalsukan, dan sesi disimpan di cookie HttpOnly (§3). | Disetujui |
| 3 | **Kredensial relay: token bertanda tangan HMAC berumur 1 jam**, diterbitkan Vercel untuk penghuni (dari sesi) dan tamu (§7.2). Tidak ada provisioning user, tidak ada cron. | Disetujui |
| 4 | **Protokol v2: id ditempel oleh relay**, bukan oleh pengirim. Nama penghuni diambil dari daftar penghuni (§7). | Disetujui |
| 5 | **PIN TIDAK diwajibkan unik** (§6.3). | Disetujui |
| 6 | **Biaya target $0 (Workers Free).** Kalau batas keras 100 ribu/hari ternyata dihitung per pesan mentah (bukan 20:1), naik ke Workers Paid ±$9/bln (§2.3). **[CEK]** lewat deploy percobaan. | Menunggu cek Vesper |
| 7 | **Sembunyikan pemain:** penghuni = permanen, tamu = per sesi (§9.2). | Disetujui |
| 8 | **Retensi log IP + perangkat 90 hari**, IP disimpan sebagai HMAC (§8). | Disetujui |

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

## 2. Pilihan relay

### 2.1 Perbandingan (versi akhir, dengan koreksi Vesper)

| Pilihan | Biaya | Kenapa dipilih / gugur |
|---|---|---|
| **Cloudflare Durable Objects** | $0 (Workers Free) atau ±$9/bln (Paid, kalau [CEK] §2.3 gagal) | **Dipilih.** Tanpa server yang dijaga pemilik. Relay sendiri yang menempelkan id, jadi lebih kuat dari ACL topik |
| EMQX Cloud Serverless | $0–5 | Kuota 1 GB/bln. Tanpa JWT di Serverless, jadi setiap tamu harus dibuatkan user lewat API + cron pembersih |
| Self-host EMQX di VPS pemilik | $0 | Cadangan kalau Cloudflare tidak bisa dipakai. Pemilik mengurus uptime + TLS; VPS mati = Wabot + bot Discord ikut kena |
| Self-host Mosquitto | $0 | Tanpa JWT bawaan. (Koreksi: alasan "`%u`/`%c` tidak jalan di dynamic-security" sudah kedaluwarsa, diperbaiki di Mosquitto 2.1.0, Jan 2026.) |
| HiveMQ Cloud Serverless | — | Dipensiunkan 31 Des 2026, cluster baru tidak bisa dibuat. Starter ±$243–253/bln |
| Supabase Realtime | >$150/bln di 10 Hz | Kuota gratis 2 juta pesan/bln, setiap penerima dihitung. Habis ±2 jam main/bln |
| Ably | Habis ±5 jam main/bln | 6 juta pesan/bln, setiap penerima dihitung |
| flespi | €130/bln (Start) | Koreksi: batas Free terpublikasi dan tidak cukup (10 device, 500 pesan/menit/channel, 20.000 pesan MQTT/menit) |

### 2.2 Aturan wajib relay (dari verifikasi Vesper)

1. **Hibernation API wajib:** `this.ctx.acceptWebSocket(ws, tags)`, BUKAN
   `ws.accept()`. Tanpa hibernasi, DO ditagih durasi selama ada socket
   terbuka. Contoh resmi tanpa hibernasi: $142,95/bln.
2. **Satu DO global** (`idFromName('kosan-dunia')`), bukan satu DO per alam.
   Tiap DO aktif ditagih durasi sendiri: 10 DO aktif × 4 jam/hari =
   18.000 GB-s/hari, di atas batas Free 13.000.
3. **Jangan tulis SQLite per pesan posisi.** Meter tulis Free 100 ribu/hari
   habis dalam <1 jam di 10 Hz. Relay v2 tidak menulis storage sama sekali.
   Daftar pemain untuk snapshot saat join diambil dari memori.
4. **State di memori hilang saat hibernasi.** Daftar pemain dibangun ulang di
   constructor dari attachment tiap socket (`deserializeAttachment`, maks
   2.048 byte per socket). Selama main di 10 Hz DO tidak pernah hibernasi
   (hibernasi hanya kalau tidak ada event), jadi ini soal antar-sesi.
5. **Klien wajib bisa reconnect.** Saat runtime Cloudflare diperbarui,
   koneksi yang ada diberi waktu maks 20 menit lalu diputus (§7.6).
6. **Filter per alam:** tag WebSocket dipasang saat `acceptWebSocket`
   (maks 10 tag). **[CEK]** Menurut saya tag tidak bisa diubah sesudah
   accept. Kalau benar, tag hanya dipakai untuk `id:<id>` (cari socket
   lama untuk ditendang), sedangkan alam disimpan di attachment + peta di
   memori, dan siaran per alam menyaring dari peta itu. Dengan ≤220 socket,
   menyaring di memori murah.

### 2.3 Biaya dan kuota

Model trafik sama dengan desain v1: 10 Hz saat bergerak (30% waktu),
heartbeat 3 detik saat diam, rata-rata ±3,2 pesan masuk/detik per pemain.
Hanya pesan MASUK ke DO yang dihitung request. Pesan keluar tidak.

| Skenario | Pesan masuk/hari | Request/hari kalau 20:1 | Kalau 1:1 |
|---|---|---|---|
| 10 pemain × 2 jam | ±232.600 | ±11.600 | ±232.600 |
| 20 pemain × 4 jam | ±930.000 | ±46.500 | ±930.000 |

- **Durasi:** 1 DO aktif selama ada yang main. 4 jam/hari × 0,128 GB =
  ±1.840 GB-s/hari, di bawah batas Free 13.000.
- **[CEK] 20:1 belum terjawab.** Dokumentasi menyebut rasio 20:1 untuk
  penagihan request komputasi, dan "tidak memengaruhi metrik". Tidak ada
  kalimat eksplisit bahwa batas keras Free 100.000/hari memakai hitungan
  20:1. Kalau ternyata 1:1, kuota habis dalam ±52 menit main agregat/hari
  (10 pemain), dan biaya jadi ±$9/bln di Workers Paid ($5 dasar + ±$4
  overage, hitungan Vesper). Vesper menjawabnya lewat deploy percobaan kecil
  + meter dashboard begitu akun Cloudflare pemilik jadi. **Arsitektur tidak
  berubah apa pun jawabannya.**
- **Kalau kuota habis:** bukan hanya koneksi baru yang ditolak. Pesan masuk
  dari pemain yang sudah tersambung juga berhenti diproses. Game jatuh ke
  mode sendiri sampai kuota pulih (00:00 UTC = 07.00 WIB), atau sampai naik
  ke Paid.
- Penghematan yang tersedia: laju gerak 10 → 5 Hz menurunkan pesan ±45%.

---

## 3. Arsitektur

```
Browser (index.html)
  │  HTTPS, domain sama: /api/*  (cookie sesi HttpOnly)
  ▼
Vercel Functions (Node) ── service role ──► Supabase Postgres
  │  - masuk / setup password / sesi / keluar     (tabel baru, RLS tertutup)
  │  - masuk kamar (cek PIN)
  │  - token relay (penghuni) + tamu              [Fase B]
  │  - lapor                                      [Fase C]
  │  - catat IP (dari header Vercel) + id perangkat
  │
  └─ token HMAC 1 jam (RELAY_SECRET) ─┐
                                      ▼
Browser ── wss + token ──► Cloudflare Worker ──► 1 Durable Object "kosan-dunia"
                           (cek token saat upgrade)   (Hibernation API, siaran per alam)
```

Kenapa Vercel Functions (tidak berubah dari v1):

- **IP klien.** Vercel menimpa `X-Forwarded-For` supaya IP tidak bisa
  dipalsukan ([Vercel docs](https://vercel.com/docs/headers/request-headers)).
- **"Ingat saya" tanpa token yang bisa dibaca JavaScript.** Domain sama, jadi
  token sesi disimpan di cookie `HttpOnly; Secure; SameSite=Strict`.
- **CSP sempit.** `connect-src` = `'self'` + host Worker relay. Sesudah
  cut-over, broker publik dan `vendor/mqtt` tidak dipakai lagi.

Rahasia (env var, tidak pernah di repo/kode browser):

| Nama | Di mana | Fase |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | A |
| `KOSAN_SECRET` (≥32 byte acak; sub-kunci untuk HMAC IP + tiket setup diturunkan darinya) | Vercel | A |
| `RELAY_SECRET` (≥32 byte acak, SAMA di dua tempat) | Vercel + secret Worker | B |

**[CEK]** Pipeline deploy Vesper harus bisa membawa `api/` + env var ke
Vercel. Deploy Worker lewat `wrangler` dengan API token template "Edit
Cloudflare Workers" (izin minimum Account → Workers Scripts: Edit). Vesper
yang deploy begitu pemilik memberi token. Pemilik membuat akun Cloudflare
pakai email.

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
- **Satu penghuni, satu avatar.** Kalau penghuni masuk dari perangkat
  kedua, relay menutup socket lama dengan kode `4001` (§7.3). Klien yang
  ditendang TIDAK menyambung ulang otomatis, dan menampilkan "Kamu masuk dari
  tab/perangkat lain". Tanpa aturan ini, dua tab akan saling tendang terus.

---

## 5. Alur masuk

### 5.1 Penghuni (sudah punya password)

1. Layar masuk: **username + password** + centang **"Ingat saya"**.
2. `POST /api/masuk {username, password, perangkat}` →
   - server: cek batas percobaan → scrypt verify → buat sesi.
   - set cookie `__Host-kosan_sesi` (`HttpOnly; Secure; SameSite=Strict;
     Path=/`):
     - "Ingat saya" dicentang: `Max-Age` 30 hari, diperpanjang saat dipakai.
     - Tidak dicentang: cookie sesi biasa (hilang saat browser ditutup), dan
       server tetap membatasi umurnya 12 jam.
   - balas `{room, name, gender}`.
3. Kunjungan berikut: `GET /api/sesi`. Kalau cookie masih berlaku, layar
   masuk menampilkan "Masuk sebagai @nama" dengan satu tombol, tanpa
   mengetik apa pun. Satu ketukan tetap perlu karena layar penuh + kunci
   landscape hanya boleh dari gestur pengguna. Ada tautan "Bukan kamu?
   Keluar akun".
4. Yang tersimpan di perangkat **hanya token sesi acak 256-bit** (di cookie
   HttpOnly). Di database yang disimpan hanya SHA-256 dari token itu.
   Password tidak pernah disimpan di perangkat, baik di `localStorage`,
   `sessionStorage`, maupun cookie yang bisa dibaca JS.
5. **Keluar:** `POST /api/keluar` mencabut sesi dan menghapus cookie. Token
   relay tidak diperpanjang lagi (§7.2).

Aturan password:
- 8–128 karakter, ditolak kalau ada di daftar password umum (±150 entri,
  termasuk pola lokal seperti `bismillah`, `sayang`, `kosanibukos`), sama
  dengan username, atau satu karakter diulang. Tanpa aturan "wajib simbol";
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
   (`pinHash` FNV, port 1:1 dari klien) dari PIN mentah, lalu memanggil RPC
   lama `kosan_login` dengan service role (§10), sehingga kunci PIN 5x/15
   menit yang sudah ada ikut berlaku. **PIN dan `pin_hash` tidak diubah.**
   Lalu server menerbitkan tiket setup bertanda tangan (5 menit). Tiket itu
   sekali pakai karena penyimpanan password bersyarat `password_hash IS
   NULL` dan atomik.
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
   - terbitkan `pt...` + token relay tamu (1 jam, diperpanjang selama
     bermain) [Fase B].
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

## 7. Relay v2 (Fase B)

### 7.1 Pesan (JSON di atas WebSocket)

Klien → relay:

| Pesan | Isi | Aturan relay |
|---|---|---|
| `pos` | `{"t":"pos","x":2.53,"z":8.1,"r":3.14,"g":0.8,"p":"duduk"}` | Angka finite, dalam batas alam + 1 m, `g` 0..1, `p` dari daftar pose |
| `alam` | `{"t":"alam","a":"dapur"}` | `a` ∈ `yard`, `living`, `dapur`, `room-1..20`. `room-N` hanya untuk penghuni Kamar N |
| `perpanjang` | `{"t":"perpanjang","token":"..."}` | Token baru harus sah dan id-nya sama |

Relay → klien:

| Pesan | Isi |
|---|---|
| `snap` | Saat bergabung: daftar pemain di alam yang sama `[{id,jenis,nama,x,z,r,g,p}]` dari memori |
| `pos` | `{"t":"pos","id":"pk13",...}`. **`id` ditempel relay dari token**, bukan dari pengirim |
| `masuk` / `pergi` | Pemain bergabung ke / keluar dari alam (termasuk socket tertutup) |

- Pemain hanya menerima pesan dari alam yang sama. Pindah alam = relay
  mengirim `pergi` ke alam lama dan `masuk` + `snap` ke alam baru.
- Relay **tidak pernah menulis storage**. Presence retained (v1) diganti
  `snap`, last-will (v1) diganti `webSocketClose`/`webSocketError`.

### 7.2 Token relay

- Format: `base64url(json).base64url(HMAC-SHA256(RELAY_SECRET, json))`,
  isi `{id, jenis:"penghuni"|"tamu", room?, nama, exp}`, umur 1 jam.
- Penghuni: `GET /api/relay/token` dengan cookie sesi → `id = pk<room>`,
  `nama` = nama terdaftar.
- Tamu: `POST /api/tamu` (§5.3) → `id = pt<8 acak>`, `nama` sudah lolos
  filter + bukan nama penghuni.
- Dikirim lewat subprotocol WebSocket (`new WebSocket(url, ['kosan.v2',
  token])`), bukan query string, supaya tidak tercatat di log URL.
- Klien mengirim `perpanjang` ±5 menit sebelum `exp`. Relay mengecek `exp`
  di setiap pesan. Lewat `exp` + 60 detik → tutup dengan kode `4003`.
- **Pencabutan:** sesi dicabut → Vercel berhenti menerbitkan token (jendela
  maks 1 jam), dan bisa menendang langsung lewat `POST /admin/tendang
  {id}` ke Worker (ditandatangani `RELAY_SECRET`).

### 7.3 Aturan relay (di atas §2.2)

- **Satu id, satu socket.** Socket baru dengan id yang sama menutup socket
  lama dengan kode `4001` ("masuk dari tempat lain"). Klien yang menerima
  `4001` TIDAK menyambung ulang otomatis.
- **Batas laju per socket:** token bucket 15 pesan/detik. Kelebihan dibuang.
  Lebih dari 3× batas selama 5 detik → tutup `4008`.
- **Batas ukuran pesan:** 512 byte. Lebih → buang.
- **Batas jumlah:** maks 200 tamu tersambung. Lebih → tolak upgrade `503`.
- Attachment per socket (≤2.048 byte): `{id, jenis, room, nama, alam, exp}`.
  Posisi terakhir hanya di memori (hilang saat hibernasi, terisi lagi dari
  heartbeat 3 detik).

### 7.4 Aturan penerima (lapisan kedua, tetap ada)

Pertahanan ronde port tetap (`mpIdSah`, token bucket, `Object.create(null)`,
validasi pesan). Ditambah:

1. Nama penghuni `pk<N>` selalu dari `OCCUPANTS` kamar N.
2. Tamu tampil dengan penanda (mis. `Budi · tamu`). Nama tamu yang sama
   dengan nama penghuni atau kena filter → `Tamu #8f2k`.
3. Pesan alam `room-N` dari id selain `pk<N>` → dibuang.
4. Id di daftar sembunyi (§9.2) → tidak dirender.
5. `dapur` masuk daftar alam yang dikenal (temuan §1.7).

### 7.5 Cut-over dari broker publik

- Versi baru berhenti total memakai `broker.emqx.io`/`broker.hivemq.com` dan
  `vendor/mqtt`. Keduanya dihapus dari kode dan CSP `connect-src`.
- Klien lama ter-cache tetap di dunia lama dan tidak terlihat di dunia baru.
  Tidak ada yang rusak; mereka pindah sendiri sesudah reload.
- `REVOKE EXECUTE ON FUNCTION kosan_login(...) FROM anon` saat cut-over.
  Klien Fase A sudah tidak memanggil `kosan_login` lagi, jadi pencabutan ini
  bisa dimajukan begitu klien Fase A live ≥24 jam.

### 7.6 Reconnect klien

| Kejadian | Perilaku klien |
|---|---|
| Kode `1001`/`1006`/`1012` (runtime update, jaringan putus) | Sambung ulang dengan jeda 1, 2, 5, 10, 30 detik (+ acak ±20%) |
| `4003` (token habis) | Ambil token baru, lalu sambung ulang |
| `4001` (masuk dari tempat lain) | Berhenti. Tampilkan "Kamu masuk dari tab/perangkat lain" |
| Upgrade ditolak / kuota habis | Mode sendiri. Coba lagi tiap 60 detik + tombol coba lagi di pil status |

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

**Fase A tidak butuh skema tabel penghuni.** Server memverifikasi PIN dengan
memanggil RPC lama `kosan_login(p_name, p_pin_hash)` memakai service role, dan
membaca nama + kamar dari `kosan_occupants()`. Tabel baru dikunci pada
`room` + `nama_norm` (bukan FK), jadi kalau kamar berganti penghuni, akun
lama otomatis tidak berlaku. **[CEK]** `kosan_login` bisa dieksekusi
`service_role`, mengembalikan baris berisi `gender`, dan hanya menulis
penghitung kunci PIN-nya sendiri.

| Tabel baru | Isi | Fase |
|---|---|---|
| `kosan_akun` | `room` (PK), `nama_norm`, `gender`, `password_hash`, `password_dibuat`, `gagal_count`, `kunci_sampai` | A |
| `kosan_sesi` | `id`, `room`, `nama_norm`, `token_sha256`, `ingat`, `dibuat`, `dipakai`, `kedaluwarsa`, `dicabut` | A |
| `kosan_perangkat_log` | `room` null, `peristiwa`, `perangkat`, `ip_hmac`, `ip_prefiks_hmac`, `dibuat` | A |
| `kosan_batas` | penghitung batas percobaan per jendela waktu | A |
| `kosan_kata_terlarang` | `kata`, `tingkat` | C |
| `kosan_laporan` | §9.3 | C |

Semua RLS aktif tanpa policy. Hak `anon`/`authenticated` dicabut eksplisit.
Semua RPC baru hanya untuk `service_role`. Yang tetap publik:
`kosan_occupants` dan (Fase C) `kosan_kata_list`.

---

## 11. Urutan rilis

1. **Fase A, server + login:** tabel, Vercel Functions, layar login + setup
   password, PIN kamar via server. Multiplayer tetap v1 sementara.
2. **Fase B, relay v2:** Worker + DO, protokol v2, token relay + tamu,
   reconnect, cut-over (§7.5).
3. **Fase C, pendamping:** filter, sembunyikan, lapor.
4. **Fase D, duplikat:** view kandidat. Pemilik meninjau, lalu memutuskan.

Fase A bisa dirilis sendiri. Fase B baru menutup penyamaran dan penghilangan
avatar.

---

## 12. Verifikasi

### 12.1 Unit test (RED di kode sekarang → GREEN sesudah fix)

Server (Fase A):

1. Login hanya lewat username + password. Akun yang sudah punya password
   tidak bisa dibuka lagi lewat jalur setup PIN.
2. Setup sekali pakai: tiket kedua ditolak.
3. Password tersimpan sebagai scrypt. Token sesi tersimpan sebagai SHA-256.
   Tidak ada password mentah di database palsu, di respons, atau di cookie.
4. Kunci akun sesudah 5 password salah.
5. `/api/kamar/masuk` menolak tamu (tanpa sesi), menolak penghuni kamar lain,
   menolak PIN salah.
6. Port `pinHash` server = klien untuk vektor uji (tanpa PIN asli).
7. POST dari origin lain ditolak.

Klien (Fase A): masuk kamar meminta PIN setiap kali, dan login penghuni tidak
lagi memakai PIN saja.

Relay (Fase B), fungsi murni diekstrak dari Worker:

8. Token: tanda tangan salah / kedaluwarsa / id beda saat `perpanjang` →
   ditolak.
9. `id` di pesan keluar selalu dari token, walau pengirim menyisipkan `id`.
10. Batas laju 15/detik, ukuran 512 byte, tutup `4008` saat banjir.
11. `alam` `room-13` dari `pk14`/`pt..` → ditolak. `dapur` diterima.
12. Socket kedua dengan id sama → socket pertama ditutup `4001`.
13. Rebuild peta pemain dari attachment (simulasi hibernasi).
14. Penerima (§7.4): label penghuni dari `OCCUPANTS`, tamu dengan nama
    penghuni → `Tamu #xxxx`, sembunyi.
15. Regresi: semua tes ronde port tetap lolos.

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
3. Tamu masuk bebas. Tamu tidak bisa masuk kamar (server 401).
4. Tamu dengan nama penghuni ditolak.
5. Penghuni + tamu saling melihat di dua perangkat.
6. 0 error CSP, 0 request unpkg, 0 request broker publik, relay tersambung.

---

## 13. Estimasi

| Bagian | Perkiraan |
|---|---|
| Fase A: skema + RPC + RLS | 1 hari |
| Fase A: Vercel Functions (masuk, setup, sesi, keluar, kamar) | 1,5–2 hari |
| Fase A: klien (login/setup, Ingat saya, modal PIN) | 1,5 hari |
| Fase B: Worker + DO relay + token + tamu | 2–2,5 hari |
| Fase B: klien protokol v2 + reconnect + cut-over | 1,5 hari |
| Fase C: filter, sembunyikan, lapor | 1,5 hari |
| Tes, review, preview, live | 1,5–2 hari |
| **Total** | **±10–11,5 hari kerja** |

Dibanding desain v1: relay menambah ±1–1,5 hari, provisioning + cron EMQX
hilang (±1 hari). Selisih maks +0,5 hari. Risiko estimasi: deploy Worker
bergantung akun + token Cloudflare pemilik.

---

## 14. Sisa risiko + yang TIDAK ditutup ronde ini

- **Password dibagikan / HP dipinjam dengan "Ingat saya":** orang itu bisa
  jalan sebagai penghuni. PIN hanya melindungi kamar.
- **Nama tamu yang lolos filter tapi tetap menyakitkan:** ditangani lewat
  sembunyikan + lapor. Belum ada moderasi real-time.
- **Laporan dibaca manual** oleh pemilik. Belum ada notifikasi.
- **Tamu iseng yang mengganggu:** dibatasi per IP + 200 tamu, tidak dicegah.
- **Sidik perangkat mudah di-reset.** Duplikat cuma kandidat.
- **XSS:** CSP masih `'unsafe-inline'`. Kalau ada XSS, token relay berumur
  pendek bisa dicuri, tapi cookie sesi tidak.
- **Kuota Cloudflare harian habis → multiplayer berhenti total sampai 07.00
  WIB**, termasuk pemain yang sudah tersambung. Game jatuh ke mode sendiri.
- **Kode relay jadi tanggungan kita** (±250 baris), dengan unit test §12.1.
- **PIN 6 digit + hash FNV lemah kalau isi database bocor.** Membungkus ulang
  `pin_hash` dengan scrypt perlu izin terpisah (mengubah data tersimpan).
- **Balapan setup pertama:** orang yang tahu PIN penghuni bisa membuat
  password lebih dulu. Mitigasi: batas percobaan, log perangkat, pemulihan
  lewat pemilik.
- **Reset password lewat DM IG** rawan rekayasa sosial.
- **Broker publik v1 tetap terbuka** untuk siapa pun, tapi sesudah cut-over
  tidak ada klien baru yang mendengarkan.

---

## 15. Pertanyaan terbuka

1. **[CEK Vesper]** 20:1 berlaku untuk batas keras Free atau tidak (§2.3).
2. **[CEK]** Tag WebSocket bisa diubah sesudah `acceptWebSocket`? (§2.2.6)
3. **[CEK]** `kosan_login` bisa dipanggil `service_role` dan mengembalikan
   `gender` (§10).
4. Pemilik membuat akun Cloudflare (email) + API token deploy untuk Vesper.
5. Pipeline deploy membawa `api/` + env var ke Vercel?
6. Berapa pemain online bersamaan di jam ramai?
7. Penanda tamu di label: `· tamu`, ikon, atau warna?
8. Perlu notifikasi laporan ke pemilik?
