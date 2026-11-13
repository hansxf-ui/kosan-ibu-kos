# MULTIPLAYER-SPEC — Kosan 3D: pemain bisa ketemu pemain lain

> **Status:** spek v1 (belum diimplementasi). Ditulis 8 Nov 2026 dari perintah pemilik:
> "ini gamenya harus beneran multiplayer kayak si sekolahbebaz, bisa ketemu pemain lain".
> **Tambahan pemilik 8 Nov 21:01:** masuk kosan nanti "beda alam" kayak Museum 3D
> Hearts2Hearts — interior (ruang tamu + kamar) adalah scene/ruang TERPISAH dari
> halaman luar, dimasuki lewat pintu. Spek ini sudah menyiapkan itu dari awal
> (lihat §8) supaya protokol tidak perlu dirombak saat interior dibangun.
>
> **Yang TIDAK berubah:** gerak lokal (fantasy), fungsi kamar, kartu kamar,
> papan, fly "Lihat kamarku", joystick mengambang, kamera orbit, HUD.
> Multiplayer HANYA menambah: identitas di layar masuk + avatar pemain lain
> di dunia yang sama.
>
> **Sumber pola yang dipakai (sudah terbukti di workspace ini):**
> - `~/workspace/game-kantor/game.js` — MQTT publik Kantor Misi (EMQX + HiveMQ,
>   mqtt.js 5.10.1, `sambung()` + failover, presence/timeout, last-will implisit
>   lewat retained `''`). Semua nomor/aturan di bawah yang ditandai "(Kantor)"
>   disalin dari file itu.
> - `~/workspace/kosan-ibu-kos/web/kosan-3d.html` — `makeKosanAvatar(gender)`,
>   `makeLabel(text)`/`setLabel`, `buildVisitorAvatar()`, loop `animate()`
>   (`avatarPos`, `avatar.rotation.y`, `SPEED`, `YARD`), entry
>   (`localStorage 'kosan3d-nama'` + `'kosanGender'`).

---

## 0. Ringkasan keputusan (baca ini dulu sebelum coding)

| Keputusan | Isi | Alasan |
|---|---|---|
| Transport | MQTT publik, **tanpa Firebase, tanpa akun baru, tanpa server sendiri** | Pola Kantor Misi sudah terbukti jalan di HP pemilik |
| Broker | Utama `wss://broker.emqx.io:8084/mqtt`, cadangan `wss://broker.hivemq.com:8884/mqtt` | Sama persis dengan Kantor Misi |
| Pustaka | `mqtt.js 5.10.1` dari `https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js`, dimuat dinamis | Sama dengan Kantor Misi (`pustakaJaringan()`) |
| Namespace topik | `kosan-ibu-kos/v1/` | Tidak tabrakan dengan `kantor/v1/...` |
| Topik | `kosan-ibu-kos/v1/pos` (gerak, tidak retained) + `kosan-ibu-kos/v1/presence/<id>` (identitas, retained per pemain) | Presence retained = pemain baru langsung lihat siapa yang online |
| Dunia | SATU dunia bersama, tanpa kode ruang | Kosan itu satu tempat; beda dengan Kantor Misi yang per-ruang (`kantor/v1/${kode}/`) |
| Identitas | Nama + gender dipilih di **layar masuk** dan **TERKUNCI** selama di dalam game | Syarat multiplayer: identitas pemain lain harus stabil |
| Rate publish | ~10 Hz saat bergerak, heartbeat 3 dtk saat diam | Sama dengan detak jantung 3 dtk Kantor Misi |
| Timeout pemain | Tidak ada kabar ~5 dtk → avatar dihapus | Sama dengan ambang basi 5 dtk Kantor Misi |
| Render pemain lain | `makeKosanAvatar(gender)` + `makeLabel(nama)` yang sudah ada; lerp eksponensial; maks 20 terdekat | Pakai ulang, bukan bangun baru |
| Realm (masa depan) | Pesan presence/pos membawa field `realm` sejak v1 (`'yard'` sekarang) | §8 — interior "beda alam" tidak merombak protokol |
| Gagal total | Mode sendiri (single-player) tetap jalan, ada status + tombol coba lagi | Game tidak boleh mati gara-gara jaringan |

---

## 1. Arsitektur

### 1.1 Gambaran

```
┌──────────────┐   publish pos 10 Hz / heartbeat 3 dtk   ┌─────────────────────┐
│  Pemain A    │ ───────────────────────────────────────▶│                     │
│  (browser HP)│   subscribe pos + presence/#            │  Broker MQTT publik │
│              │ ◀───────────────────────────────────────│  EMQX (utama)       │
└──────────────┘                                         │  HiveMQ (cadangan)  │
┌──────────────┐   publish pos 10 Hz / heartbeat 3 dtk   │  tanpa akun, tanpa  │
│  Pemain B    │ ───────────────────────────────────────▶│  server sendiri     │
│  (browser HP)│   subscribe pos + presence/#            └─────────────────────┘
└──────────────┘
```

- **Tidak ada server aplikasi.** Broker publik hanya meneruskan pesan; semua
  logika (siapa yang tampil, posisi, timeout) ada di masing-masing browser.
- **Tidak ada login/akun.** Identitas = nama ketikan + `clientId` acak yang
  disimpan di `localStorage` (lihat §4).
- **Satu dunia bersama.** Semua pemain yang membuka `kosan-3d.html` dan masuk
  akan saling melihat — tidak ada kode ruang, tidak ada host/tamu. (Kantor Misi
  punya host/tamu karena itu game ronde; Kosan tidak butuh wasit.)

### 1.2 Pemuatan pustaka (salin pola Kantor Misi)

Di `game.js` Kantor Misi (baris ~27–38):

```js
let mqttJanji = null;
function pustakaJaringan() {
  if (typeof mqtt !== 'undefined') return Promise.resolve();
  if (!mqttJanji) {
    mqttJanji = muatSkrip('https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js')
      .catch((e) => { mqttJanji = null; throw e; }); // janji GAGAL tidak disimpan
  }
  return mqttJanji;
}
```

Untuk Kosan, terapkan pola yang sama di `kosan-3d.html`:

- Fungsi `muatSkrip(src)` (buat elemen `<script>`, `onload`/`onerror`) — belum
  ada di `kosan-3d.html`, tambahkan.
- `pustakaJaringan()` seperti di atas, dengan URL dan versi yang sama persis
  (`mqtt@5.10.1`).
- **Kapan dimuat:** HANYA setelah pemain menekan "Masuk Kosan" di layar masuk
  (§4) — bukan saat halaman dibuka. Alasan: dunia 3D harus tetap ringan dan
  langsung tampil walau jaringan lemot; pemain yang belum masuk tidak butuh
  MQTT. Kalau `muatSkrip` gagal (unpkg tidak terjangkau): masuk mode sendiri
  (§1.5), jangan blokir pemain.

### 1.3 Sambung + failover (salin pola Kantor Misi `sambung()`)

Di `game.js` Kantor Misi (baris ~5, ~621–650):

```js
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
mqtt.connect(BROKERS[idx], {
  clientId: 'kantor-' + ID + '-' + Math.random().toString(36).slice(2, 6),
  reconnectPeriod: 2000, connectTimeout: 8000
});
// Batas keras 10 dtk per broker → failover ke broker berikut →
// kalau semua gagal, tampilkan pesan "periksa koneksi lalu coba lagi".
```

Untuk Kosan, salin bulat-bulat dengan penyesuaian nama:

- `BROKERS` sama persis (dua URL di atas, urutan sama).
- `clientId: 'kosan-' + playerId + '-' + Math.random().toString(36).slice(2, 6)`
  (`playerId` = id permanen dari §4; suffix acak 4 karakter supaya dua tab
  dengan `playerId` sama — mis. tab ganda di perangkat yang sama — tidak
  saling menendang dari broker).
- Opsi koneksi sama: `reconnectPeriod: 2000, connectTimeout: 8000`.
- **Failover:** batas keras 10 dtk per broker (`setTimeout`), kalau belum
  `connect` → `c.end(true)` lalu coba broker berikut. Kalau semua broker gagal
  → mode sendiri (§1.5).
- **Last-will (wajib diisi saat connect):**
  ```js
  will: {
    topic: 'kosan-ibu-kos/v1/presence/' + playerId,
    payload: '',          // payload kosong + retain = hapus presence saya
    retain: true
  }
  ```
  Kalau tab mati mendadak (crash, sinyal hilang), broker mengirim will ini
  sehingga pemain lain langsung tahu saya pergi — tanpa menunggu timeout 5 dtk.
- **Reconnect otomatis:** `mqtt.js` dengan `reconnectPeriod: 2000` menyambung
  ulang sendiri saat koneksi putus di tengah jalan. Saat `connect` ulang
  berhasil: subscribe lagi + publish ulang presence + pos saat itu juga
  (jangan andalkan retained presence lama — tulis ulang supaya `ts` segar).
- **Status ke pemain:** satu pil kecil di `#topbar` (di samping `#roomCount`,
  jangan ubah layout):
  - `🟢 N pemain di sini` — tersambung (N = jumlah pemain lain di realm yang
    sama, lihat §3.5).
  - `🟡 Menghubungkan…` — sedang coba broker.
  - `⚪ Sendiri — ketuk untuk coba lagi` — semua broker gagal / pustaka gagal
    dimuat; ketuk pil = jalankan `sambung(0)` lagi.
  - Saat reconnect di tengah jalan, pil kembali ke `🟡` sebentar lalu `🟢`.

### 1.4 Alur masuk (urutan pasti)

1. Halaman dibuka → dunia 3D dimuat seperti sekarang (single-player).
2. Layar masuk tampil (§4). Pemain isi nama + pilih gender + tekan
   **"Masuk Kosan"**.
3. Validasi nama (tidak kosong setelah `normalize()`). Simpan
   `localStorage 'kosan3d-nama'`, `'kosanGender'`, `'kosan3d-id'` (buat kalau
   belum ada).
4. `spawnAvatar(nama)` + `buildVisitorAvatar()` seperti sekarang (posisi spawn
   `(0, 12)`, hadap `Math.PI`).
5. `await pustakaJaringan()` → `sambung(0, onOpen)`.
6. Saat `connect`: `klien.subscribe(['kosan-ibu-kos/v1/pos',
   'kosan-ibu-kos/v1/presence/#'])`, lalu publish presence (retained) +
   pos pertama.
7. Pemain lain yang sudah online menerima presence saya → avatar saya muncul
   di layar mereka. Saya menerima retained presence mereka → avatar mereka
   muncul di layar saya. Dunia bersama terbentuk.

### 1.5 Mode sendiri (fallback — game tidak boleh mati)

- Kalau pustaka gagal dimuat ATAU semua broker gagal: pemain tetap masuk
  dunia dan bisa jalan-jalan sendiri persis seperti sekarang. Pil status
  menunjukkan `⚪ Sendiri` dan bisa diketuk untuk mencoba lagi.
- Mode sendiri BUKAN error screen. Tidak ada popup yang memblokir, tidak ada
  tombol yang hilang.
- Kalau koneksi putus di tengah jalan lalu pulih: pemain kembali terlihat
  pemain lain otomatis (presence + pos ditulis ulang saat reconnect).

---

## 2. Skema topik + format pesan

### 2.1 Topik

| Topik | Retained | QoS | Isi |
|---|---|---|---|
| `kosan-ibu-kos/v1/pos` | tidak | 0 | Posisi + gerak semua pemain (satu topik bersama) |
| `kosan-ibu-kos/v1/presence/<id>` | **ya** | 0 | Identitas satu pemain (`<id>` = `playerId` pengirim) |

- Namespace `kosan-ibu-kos/v1/` — sengaja beda dari `kantor/v1/` supaya tidak
  ada pesan Kantor Misi yang nyasar ke Kosan (dan sebaliknya).
- **Satu topik `pos` untuk semua pemain** (bukan per pemain): jumlah
  subscription tetap 2 berapa pun pemainnya; penerima menyaring lewat field
  `id` di dalam pesan.
- **Presence per pemain** (satu topik retained per `id`): pemain baru yang
  subscribe `presence/#` langsung menerima daftar pemain online dari pesan
  retained — tanpa menunggu siapa pun bergerak. Saat pemain keluar bersih,
  ia publish payload kosong (`''`, retained) ke topik presence-nya sendiri
  sehingga broker menghapusnya; pemain lain menerima pesan kosong itu dan
  menghapus avatarnya (pola yang sama dipakai Kantor Misi untuk menutup ruang:
  `publish(topik('state'), '', { retain: true })` + jeda flush 150 ms, lihat
  `game.js` baris ~1410–1413).

### 2.2 Pesan `pos` (gerak)

```json
{
  "id": "p3f9kx2q",
  "nama": "Budi Santoso",
  "gender": "cewek",
  "realm": "yard",
  "x": 2.5,
  "z": 8.1,
  "rot": 3.14,
  "gerak": 0.8,
  "ts": 1794384000000
}
```

| Field | Tipe | Aturan |
|---|---|---|
| `id` | string | `playerId` permanen pengirim (§4). **Kunci identitas — bukan nama.** |
| `nama` | string | Nama tampilan, sudah `trim()`, maks 40 karakter (sama dengan `maxlength="40"` di `#nameInput`). Kosong → `"Pemain"`. |
| `gender` | string | `"cewek"` atau `"cowok"` saja. |
| `realm` | string | Alam/lokasi pemain: `"yard"` di v1; `"living"`, `"room-1"`…`"room-10"` di masa depan (§8). |
| `x`, `z` | number | Posisi meter, dalam batas `YARD` (`x` −19…19, `z` −17…17) + toleransi 1 m. |
| `rot` | number | Arah hadap radian, ternormalisasi ke [−π, π] (sama seperti `avatar.rotation.y` di `animate()`). |
| `gerak` | number | 0…1 — besar defleksi ter-latch (`mag` dari `deadzoneLatch`); 0 = diam, 1 = lari penuh. Dipakai untuk ayunan kaki pemain lain (§3.4). |
| `ts` | number | `Date.now()` saat kirim (ms). Dipakai untuk urutan perubahan realm (§8.3). |

- Ukuran pesan ≈ 120–150 byte — ringan; 10 Hz × 20 pemain ≈ 200 pesan/detik
  masuk, masih jauh di bawah kemampuan broker publik dan browser.
- **Nama + gender ikut di setiap pesan `pos`** (bukan cuma di presence):
  supaya pemain yang kelewat pesan presence (mis. baru subscribe tepat saat
  presence dikirim ulang) tetap bisa menampilkan nama/gender dari `pos`
  pertama yang ia terima.

### 2.3 Pesan `presence` (identitas, retained)

```json
{ "id": "p3f9kx2q", "nama": "Budi Santoso", "gender": "cewek", "realm": "yard", "ts": 1794384000000 }
```

- Field sama dengan `pos` minus `x`/`z`/`rot`/`gerak`.
- Dipublish: (a) saat masuk (habis `connect`), (b) saat `realm` berubah
  (bersamaan dengan `pos` pertama di realm baru — lihat §8.3), (c) heartbeat
  ulang tiap 30 dtk (murah, menjaga retained tetap segar), (d) saat reconnect
  berhasil.
- Payload kosong (`''`, retained) = "pemain ini pergi". Diterima → hapus
  avatar + entrinya (lihat §2.5).

### 2.4 Kapan publish (rate)

| Kondisi | Aksi |
|---|---|
| Bergerak (`mag > 0.01` — kondisi yang sama dengan blok gerak di `animate()`) | Publish `pos` **maks tiap 100 ms** (~10 Hz). Jangan publish tiap frame. |
| Diam | Publish `pos` (heartbeat) **tiap 3 dtk** — angka yang sama dengan detak jantung 3 dtk Kantor Misi. |
| Baru masuk / reconnect / ganti realm | Publish presence + `pos` **segera** (jangan tunggu interval berikut — pola `kirimPosSekarang()` Kantor Misi: perubahan keadaan tidak boleh menunggu deteksi perubahan). |
| Keluar bersih (`beforeunload`/`pagehide`, lihat §4.4) | Publish presence `''` (retained), jeda flush 150 ms, lalu `klien.end(true)` (pola Kantor Misi). |

Implementasi rate: satu `setInterval` 100 ms yang memeriksa
`now - lastPosSent >= 100 && (bergerak || now - lastPosSent >= 3000)`.
Jangan pasang dua timer yang saling tumpuk.

### 2.5 Kapan menghapus pemain (timeout + pesan pergi)

- Setiap entri pemain lain menyimpan `lastSeen` = `Date.now()` **lokal saat
  pesan diterima** (jangan pakai `ts` pengirim — jam tiap HP bisa miring;
  `ts` hanya untuk urutan realm, §8.3). `lastSeen` diperbarui oleh pesan `pos`
  MAUPUN `presence` dari pemain itu.
- Sweeper `setInterval` tiap 500 ms: entri dengan
  `Date.now() - lastSeen > 5000` → hapus avatar dari scene + dispose tekstur
  label + hapus entri + perbarui pil status + label duplikat (§2.6).
  Ambang 5 dtk = ambang basi 5 dtk Kantor Misi (`basiMs > 5000`).
- Pesan presence kosong (`''`) dari pemain itu → hapus **segera** (tanpa
  tunggu 5 dtk).
- **Tab di latar:** browser menidurkan timer tab yang tidak aktif, jadi pemain
  yang pindah tab/aplikasi akan berhenti publish dan hilang dari layar pemain
  lain setelah ~5 dtk. Itu perilaku yang diharapkan (bukan bug): saat ia
  kembali, tabnya publish ulang dan avatarnya muncul lagi. Jangan coba
  mengakali dengan `setInterval` yang lebih agresif — tidak akan jalan di
  latar dan hanya menguras baterai.

### 2.6 Nama duplikat

- Nama boleh sama — yang unik adalah `id`. **Jangan tolak nama yang sudah
  dipakai orang lain.**
- Label nama di atas avatar: tampilkan `nama` apa adanya. Kalau ada DUA pemain
  online dengan nama sama (perbandingan sesudah `trim().toLowerCase()`),
  kedua label diberi akhiran ` · #XXXX` (4 karakter pertama `id`, mis.
  `Budi Santoso · #3f9k`). Akhiran dihitung ulang tiap roster berubah
  (masuk/keluar/timeout) lewat satu fungsi `perbaruiLabelDuplikat()`.
- Label pemain lokal (avatar sendiri) tidak pernah diberi akhiran.

### 2.7 Validasi pesan masuk (wajib — broker publik bisa diisi siapa saja)

Setiap pesan yang diterima HARUS lolos semua cek ini, kalau tidak dibuang
diam-diam (tanpa pesan error, tanpa crash):

1. `JSON.parse` dalam `try/catch` (pola Kantor Misi) — gagal parse → buang.
2. `m.id` ada dan string; `m.id === playerId` sendiri → buang (jangan render
   diri sendiri — pola Kantor Misi `if (m.id === ID) return`).
3. `pos`: `x`/`z` number dan finite, dalam `YARD` + toleransi 1 m;
   `rot` number finite; `gerak` number 0…1; `gender` salah satu dari
   `cewek`/`cowok`; `realm` string dalam daftar yang dikenal
   (`yard`, `living`, `room-1`…`room-10` — realm tak dikenal → perlakukan
   sebagai `yard` JANGAN buang pesan, supaya pemain dari versi baru tetap
   terlihat); `nama` string, potong ke 40 karakter.
4. `presence`: `id`/`nama`/`gender`/`realm` valid seperti di atas.
5. Batas roster: simpan maks **50 entri** pemain lain; kalau lebih, buang
   entri dengan `lastSeen` paling lama (bukan yang baru). Render tetap
   dibatasi 20 terdekat (§3.5).
6. Data remote TIDAK PERNAH mengubah state lokal: posisi remote tidak
   memindahkan pemain lokal, tidak membuka kartu kamar, tidak mengubah
   `visitorRoom`/`visitorId`.
7. **(Audit keamanan 13 Nov 2026)** `id` wajib cocok `^p[a-z0-9]{1,16}$`
   (`MP_ID_RE`), baik di isi pesan maupun di topik `presence/<id>`, dan
   keduanya harus sama. Alasan: id `__proto__` dulu lolos, mencemari
   `Object.prototype`, dan membekukan render semua pemain lewat satu pesan
   retained. `remotePlayers` dibuat dengan `Object.create(null)`.
8. **(Audit 13 Nov)** Pembuatan pemain BARU dibatasi token bucket
   (`MP_BARU_KAPASITAS` 20, `MP_BARU_PER_DTK` 5). Banjir id palsu tidak bisa
   membangun ratusan avatar. Pemain asli yang tertolak muncul lewat `pos`
   berikutnya (heartbeat 3 dtk).
9. **(Audit 13 Nov)** Avatar remote yang dihapus/dibangun ulang wajib
   membuang geometry-nya (`mpBuangGeometri`) + `SpriteMaterial` label.
   Material `M.*` dipakai bersama, JANGAN di-dispose.

---

## 3. Render pemain lain

### 3.1 Pakai ulang fungsi yang sudah ada

- Avatar: `makeKosanAvatar(gender)` — mengembalikan
  `{ g, tubuh, legL, legR, armL, armR }` (grup + pivot pinggul/bahu).
  Panggil sekali per pemain lain saat pertama terlihat; JANGAN panggil ulang
  tiap pesan.
- Label: `makeLabel(nama)` — mengembalikan `{ sprite, canvas, ctx, texture }`;
  pasang `sprite` ke grup avatar seperti `buildVisitorAvatar()` memasang
  `avatarLabel.sprite` (posisi `y = 2.05`). Ganti teks lewat
  `setLabel(label, teks)` (untuk akhiran duplikat §2.6).
- **Jangan** membuat pembangun avatar kedua / material kedua untuk pemain
  lain. Satu-satunya pembeda visual antar pemain adalah gender (outfit) dan
  label nama — sama seperti `@sekolahbebaz` (semua pemain pakai avatar chibi
  yang sama, beda label).

### 3.2 Struktur data per pemain lain

```js
var remotePlayers = {}; // id -> entri
// entri: {
//   id, nama, gender, realm,
//   group, parts,          // dari makeKosanAvatar(gender)
//   label,                 // dari makeLabel(nama)
//   tx, tz, trot,          // target dari pesan terakhir
//   gerak,                 // 0..1, dari pesan terakhir
//   walkPhase,             // offset fase ayunan (turunan dari id, §3.4)
//   lastSeen,              // Date.now() lokal saat pesan terakhir
//   snapped                // true = sudah ditempatkan (bukan lerp dari 0,0)
// }
```

### 3.3 Lerp posisi + hadap (salin pola Kantor Misi)

Di `game.js` Kantor Misi (baris ~891–899), avatar lawan diinterpolasi dengan
faktor eksponensial yang sadar-dt (mulus di refresh rate berapa pun):

```js
const k = 1 - Math.exp(-12 * dt);
dp.x += (posDia.x - dp.x) * k;
dp.z += (posDia.z - dp.z) * k;
let bedaRy = posDia.ry - avatarDia.group.rotation.y;
// bungkus beda ke [-PI, PI] (while beda > PI …; while beda < -PI …)
avatarDia.group.rotation.y += bedaRy * (1 - Math.exp(-12 * dt));
```

Untuk Kosan, terapkan pola yang sama di dalam `animate()`, sesudah blok
gerak lokal:

- Faktor `k = 1 - Math.exp(-12 * dt)` untuk x/z; faktor yang sama untuk rotasi
  dengan pembungkusan beda ke [−π, π] (salin loop `while` Kantor Misi).
- **Snap saat pertama terlihat / saat ganti realm:** tempatkan grup LANGSUNG
  di `(tx, tz, trot)` tanpa lerp — kalau tidak, avatar baru akan meluncur
  dari titik spawn `(0, 12)` menyeberangi peta. Atur `snapped = true` sesudah
  penempatan pertama; pesan berikutnya baru di-lerp.
- Posisi remote TIDAK melewati `collideBuilding`/`TABLE_BOX` — posisi yang
  diterima sudah hasil tabrakan di sisi pengirim; memvalidasi ulang di sini
  hanya menambah risiko avatar remote tersangkut. (Pengecualian: validasi
  batas `YARD` di §2.7 sudah cukup.)
- Remote tidak pernah memutar kamera lokal dan tidak memengaruhi `camTarget`.

### 3.4 Animasi jalan pemain lain (pakai rumus yang sama dengan lokal)

Di `animate()` lokal (baris ~1325–1332):

```js
walkT += dt;
var gerak = mag;
var sw = Math.sin(walkT * 11);
avLegL.rotation.x = sw * 0.55 * gerak;
avLegR.rotation.x = -sw * 0.55 * gerak;
avArmL.rotation.x = -sw * 0.6 * gerak;
avArmR.rotation.x = sw * 0.6 * gerak;
avTubuh.rotation.y = Math.sin(walkT * 1.3) * 0.25 * (1 - gerak);
```

Untuk pemain lain, pakai rumus yang persis sama dengan dua penyesuaian:

- `gerak` diambil dari pesan `pos` terakhir pemain itu (bukan `mag` lokal).
- Fase ayunan diberi offset per pemain supaya langkah mereka tidak sinkron
  semua: `sw = Math.sin(walkT * 11 + entri.walkPhase)`, dengan
  `walkPhase = (hash(id) % 628) / 100` (0…2π, hash sederhana dari string id).
  `walkT` tetap global — tidak perlu jam per pemain.
- Saat `gerak = 0`: kaki kembali 0 dan `tubuh` bergoyang idle seperti lokal
  (`Math.sin(walkT * 1.3) * 0.25`).
- `avatar.position.y` remote SELALU 0 (aturan tetap: tanpa bobbing).

### 3.5 Batas render + penghitung pemain

- **Maks 20 avatar remote dirender** (grup `visible = true`). Urutan: jarak
  dari `avatarPos` pemain lokal, terdekat dulu. Entri di luar 20 tetap
  disimpan di `remotePlayers` (supaya `lastSeen`/timeout tetap jalan) tapi
  grupnya `visible = false`.
- Hitung ulang siapa yang masuk 20 besar tiap 1 dtk (bukan tiap frame).
- Pil status (§1.3) menampilkan jumlah pemain lain **di realm yang sama**
  saja — pemain di realm lain tidak dihitung (lihat §8.2).
- **Mitigasi performa berlapis** (terapkan berurutan kalau frame drop di HP):
  1. Turunkan batas render 20 → 10.
  2. Matikan `castShadow` pada mesh avatar remote (bayangan lokal tetap).
  3. Turunkan `renderer.setPixelRatio` dari `min(dpr, 2)` (baris 346 saat ini)
     ke `min(dpr, 1.25)` — angka yang dipakai Kantor Misi.
  4. Turunkan rate publish bergerak 10 Hz → 5 Hz (interval 200 ms).
  Jangan lakukan semuanya sekaligus — ukur dulu, satu lapis sekali.

### 3.6 Yang TIDAK berubah pada pemain lokal

- Blok gerak lokal di `animate()` (joystick + keyboard → `deadzoneLatch` →
  `moveVector` → `SPEED` → `collideBuilding` → `turnToward`) **tidak
  disentuh** kecuali menambah SATU hook publish sesudah `avatarPos` berubah
  (lihat Lampiran A).
- Kamera, fly `flyToDoor`, kartu kamar, papan, `roomCount`, tombol
  Misi/KTA — tidak berubah.
- Pemain lain tidak bisa didorong, tidak menghalangi jalan, dan tidak bisa
  diklik/diketuk untuk membuka kartu (ketuk tetap hanya untuk pintu/teras/Ibu
  Kos seperti sekarang). Tabrakan antar pemain = jalan tembus di v1 (lihat
  §5).

---

## 4. Identitas: layar masuk + kunci selama di dalam game

### 4.1 Masalah dengan keadaan sekarang

Saat ini `#namebar` dan `#genderRow` hidup di HUD selama game berjalan:
nama bisa diketik ulang kapan saja (`submitName`), gender bisa diganti
tengah jalan (`setGender` → `buildVisitorAvatar()` rebuild di tempat).
Untuk single-player itu enak. Untuk multiplayer itu merusak: nama/gender
pemain lain harus stabil — kalau seseorang ganti nama tiap 5 detik, label di
layar orang lain berkedip dan `presence` jadi tidak bisa dipercaya.

### 4.2 Layar masuk (entry gate)

- Saat halaman dibuka, tampilkan **layar masuk di atas dunia 3D** (overlay
  gelap transparan, dunia tetap terlihat di belakang — jangan buat halaman
  terpisah). Isinya: judul "🏠 Kosan Ibu Kos", input nama (pakai `#nameInput`
  yang sudah ada, dipindah ke dalam overlay), picker gender (pakai
  `#genderF`/`#genderM` yang sudah ada, dipindah ke dalam overlay), dan
  tombol **"Masuk Kosan"**.
- Secara teknis: pindahkan `#namebar` + `#genderRow` ke dalam overlay masuk
  (bukan duplikasi elemen — elemen yang sama, wadah yang beda). Tombol
  `#nameBtn` diubah labelnya dari `"Cari kamarku"` menjadi `"Masuk Kosan"`.
- **Tidak ada auto-submit.** Perilaku lama (baris ~1013: nama tersimpan
  langsung `submitName(false)` saat load) DICABUT untuk multiplayer:
  masuk harus ketukan eksplisit. Nama + gender tersimpan hanya dipakai untuk
  **mengisi awal** field (returning player tinggal tekan "Masuk Kosan").
- Validasi saat tekan "Masuk Kosan": nama kosong sesudah `normalize()` →
  fokus ke input, jangan masuk (perilaku lama dipertahankan). Gender selalu
  ada (default `'cewek'` — sama seperti sekarang).
- Saat masuk: `submitName(false)` tetap dipanggil (supaya `visitorRoom` /
  `visitorId` / kartu preview tetap terbentuk seperti sekarang), lalu
  overlay masuk disembunyikan dan `#namebar`/`#genderRow` ikut hilang dari
  HUD. Kartu kamar tetap bisa dibuka sesudah masuk lewat ketuk pintu/teras
  (tidak berubah).

### 4.3 Terkunci selama di dalam game

- Selama di dalam dunia: nama + gender **tidak bisa diubah**. Tidak ada
  input nama dan tidak ada tombol gender di HUD.
- Identitas yang sedang dipakai ditampilkan read-only di `#topbar` (mis.
  di bawah `#roomCount`, teks kecil: `👤 Budi Santoso · Cewek`). Bukan
  tombol — hanya label.
- Ganti nama/gender = keluar dari dunia lalu masuk lagi: tekan
  `← Web Utama` (`#backLink`, sudah ada) atau muat ulang halaman → kembali
  ke layar masuk dengan field terisi pilihan terakhir. Ini perilaku yang
  disengaja, bukan bug — tulis di layar masuk dengan satu baris kecil:
  "Nama & gender dikunci selama di dalam — keluar dulu untuk ganti."
- `setGender()` yang sekarang (rebuild avatar tengah jalan) **tidak lagi
  dipanggil dari HUD** — fungsi boleh tetap ada untuk dipakai layar masuk
  (ganti pilihan SEBELUM masuk), tapi listener tombol gender hanya aktif
  selama overlay masuk tampil.

### 4.4 Identitas teknis

| Kunci `localStorage` | Isi | Keterangan |
|---|---|---|
| `kosan3d-nama` | nama (trim, maks 40) | Sudah ada — dipakai lagi |
| `kosanGender` | `'cewek'` / `'cowok'` | Sudah ada — dipakai lagi |
| `kosan3d-id` | `'p'` + 8 karakter acak `[a-z0-9]` | **BARU** — `playerId` permanen. Dibuat sekali saat pertama masuk (`'p' + Math.random().toString(36).slice(2, 10)` — pola `kantormisi-id` Kantor Misi). Jangan pernah dibuat ulang kalau sudah ada. Dipakai sebagai `id` pesan + suffix `clientId` + suffix topik presence. |

- `playerId` TIDAK PERNAH ditampilkan di layar (bukan nama). Yang tampil
  hanya `nama`.
- **Keluar bersih:** pasang handler `beforeunload` DAN `pagehide` (Safari HP
  lebih bisa diandalkan dengan `pagehide`) dengan penjaga "sekali saja":
  publish presence `''` (retained), jeda flush 150 ms (pola Kantor Misi),
  lalu `klien.end(true)`. `pagehide` tidak menjamin jeda 150 ms sempat jalan
  — itu sebabnya last-will (§1.3) ada sebagai jaring pengaman.

---

## 5. Di luar v1 — yang TIDAK masuk v1 (ditulis eksplisit, jangan dibangun)

- **Chat teks / suara.** Tidak ada kotak chat, tidak ada bubble, tidak ada
  topik chat. (Kalau nanti ada: topik terpisah + moderasi — di luar spek ini.)
- **Interaksi antar pemain.** Tidak ada dorong, sapa, emote ke pemain lain,
  atau aksi apa pun yang mengubah state pemain lain.
- **Masuk kamar pemain lain.** Pintu yang diketuk tetap membuka kartu kamar
  **sendiri** (preview) seperti sekarang. Interior kamar orang lain tidak
  ada di v1 (lihat §8 untuk rencana realm).
- **Kepemilikan kamar / RESIDENTS berubah.** `RESIDENTS` tetap kosong dan
  lokal; multiplayer tidak membuat kamar jadi "terisi" dan tidak mengubah
  `roomCount` ("10 kamar · 10 kosong").
- **Daftar teman, blokir/lapor, admin/mod, ruangan privat/instans.**
- **State dunia persisten** (perabot yang dipindah, dsb.) — dunia v1
  statis; yang bergerak hanya avatar pemain.

---

## 6. Risiko + mitigasi

| Risiko | Dampak | Mitigasi (v1) |
|---|---|---|
| Broker EMQX down / lambat | Pemain tidak saling melihat | Failover ke HiveMQ (batas 10 dtk/broker, §1.3); kalau dua-duanya gagal → mode sendiri + tombol coba lagi |
| Broker publik diisi spam / pesan jahat | Avatar nyasar, crash | Validasi ketat §2.7 (buang diam-diam); batas roster 50; data remote tidak pernah mengubah state lokal |
| Nama duplikat | Bingung siapa siapa | Nama boleh sama; label dibedakan ` · #XXXX` kalau duplikat (§2.6) |
| Pemain AFK menumpuk | Layar penuh avatar diam | Timeout 5 dtk menghapus yang tidak ada kabar (§2.5); heartbeat 3 dtk menjaga yang diam tapi hidup tetap tampil |
| Tab di latar berhenti publish | Pemain hilang lalu muncul lagi | Diterima sebagai perilaku yang diharapkan (§2.5); avatar muncul lagi saat tab kembali |
| HP kentang: 20 avatar + bayangan | Frame drop | Mitigasi berlapis §3.5 (batas render → bayangan remote → pixel ratio → rate publish) |
| `unpkg` tidak terjangkau | mqtt.js gagal dimuat | Mode sendiri tetap jalan (§1.5); coba lagi lewat pil status |
| Dua tab di perangkat yang sama | `clientId` bentrok, saling tendang | Suffix acak 4 karakter di `clientId` (§1.3); `playerId` boleh sama, koneksi tidak boleh sama |
| Jam HP miring | Timeout salah hitung | `lastSeen` pakai jam lokal penerima, bukan `ts` pengirim (§2.5) |
| Pesan hilang (QoS 0) | Posisi lompat sesaat | State dikirim ulang 10×/dtk — paket hilang terkoreksi 100 ms kemudian; presence retained tidak hilang |
| Pemain iseng kirim posisi di luar peta | Avatar di luar gedung / di langit | Validasi batas `YARD` + toleransi di §2.7; `y` tidak pernah dikirim (selalu 0) |
| Versi lama vs baru (realm tak dikenal) | Pemain baru tidak terlihat pemain lama | Realm tak dikenal → perlakukan sebagai `yard` (§2.7) — jangan buang pesannya |

**Sisa risiko yang diketahui (audit 13 Nov 2026):** karena `playerId` ikut di
setiap pesan, siapa pun yang subscribe bisa menyamar sebagai pemain lain
atau menghapus presence-nya. Nama juga tanpa filter, dan nama dikirim ke
broker publik (layar masuk sekarang memberi peringatan). `mqtt.js` masih
dimuat dari unpkg tanpa SRI; sebaiknya simpan di `vendor/`.

**Yang sengaja TIDAK dimitigasi di v1:** autentikasi (siapa pun bisa publish
ke topik publik — sama seperti Kantor Misi). Kalau ada abuse nyata, v2 bisa
menambah kode ruang bersama di topik (mis. `kosan-ibu-kos/v1/<kode>/pos`)
atau token — tapi jangan dibangun sekarang.

---

## 7. Rencana verifikasi

### 7.1 Simulasi node (tanpa browser — logika murni)

Ekstrak fungsi murni (bangun pesan `pos`/`presence`, validasi pesan masuk,
sweeper timeout, label duplikat, filter realm) ke harness node seperti
harness ronde-ronde sebelumnya (`/tmp/harness-*.js` — ekstrak verbatim dari
file, jangan tulis ulang logikanya di harness). Kasus yang harus lolos:

1. Pesan `pos` valid → diterima, entri dibuat, target posisi benar.
2. JSON rusak / field hilang / `x` di luar `YARD` / `gerak` 1,5 / `gender`
   aneh → dibuang, entri tidak dibuat.
3. Pesan dengan `id` sendiri → dibuang.
4. Tidak ada kabar 5 dtk → sweeper menghapus entri.
5. Presence `''` → entri langsung terhapus.
6. Dua pemain nama sama → kedua label dapat akhiran ` · #XXXX`; satu
   pergi → akhiran hilang dari yang tinggal.
7. `realm` beda → `visible = false`, tidak dihitung di pil status; kembali
   ke realm sama → tampil lagi tanpa buat ulang grup.
8. `realm` tak dikenal → diperlakukan sebagai `yard`.
9. Lerp: posisi remote bergerak mendekati target (faktor `1-exp(-12·dt)`),
   tidak teleport tiap pesan; snap hanya di penempatan pertama.
10. `node --check` modul yang diekstrak lolos; struktur file tetap
    1 DOCTYPE / 1 importmap / 1 modul.

### 7.2 Playtest browser 2 jendela (wajib sebelum serah ke pemilik)

Dua jendela/tab browser (atau satu desktop + satu HP), masing-masing masuk
dengan nama + gender berbeda:

| # | Uji | Lolos bila |
|---|---|---|
| 1 | A masuk, lalu B masuk | A melihat avatar + label B muncul; B melihat A (cek dari retained presence — tidak perlu tunggu B bergerak) |
| 2 | A jalan (joystick) | Di layar B, avatar A bergerak mulus + kaki mengayun; hadap A mengikuti arah geraknya |
| 3 | A diam 10 dtk | Avatar A tetap tampil di layar B (heartbeat jalan), kaki diam |
| 4 | B tutup tab | Avatar B hilang dari layar A dalam ~5 dtk |
| 5 | A + B nama sama | Kedua label menampilkan akhiran ` · #XXXX` yang berbeda |
| 6 | A ketuk pintu 3 | Kartu Kamar 3 terbuka di layar A saja; layar B tidak berubah |
| 7 | Matikan jaringan / blokir broker | Pil status berubah ke `⚪ Sendiri`, game tetap bisa dimainkan; sambungkan lagi → pemain lain muncul kembali |
| 8 | Masuk tanpa nama | Tidak bisa masuk (fokus kembali ke input) |
| 9 | Masuk, lalu muat ulang halaman | Kembali ke layar masuk dengan nama + gender terisi; masuk lagi dengan ketukan |
| 10 | 20 pemain (opsional — pakai `?bot=N` bila disediakan, lihat §7.3) | Frame tetap playable, pil status menunjukkan jumlah yang benar |

**Yang HANYA bisa dites di HP asli** (browser tes tidak bisa): dua jempol
bersamaan antar pemain tidak relevan di sini — tapi pinch/zoom + layout
390px layar masuk tetap harus dicek di HP sebelum vonis pemilik.

### 7.3 Alat bantu tes (disarankan, bukan wajib)

- Param debug `?bot=N` (hanya untuk pengujian, jangan dipromosikan ke
  pemain): membuat N avatar remote palsu yang berjalan acak di halaman
  (tanpa MQTT) untuk menguji batas render 20 + performa HP. Hapus atau
  biarkan — keputusan implementer; kalau dibiarkan, harus tidak aktif
  tanpa param.
- Overlay `?debug=joy` yang sudah ada: tambahkan baris status multiplayer
  (`mp: 🟢/🟡/⚪ · remote N · lastSeen tertua X ms`) supaya playtest bisa
  membaca keadaan tanpa menebak.

---

## 8. Forward-compatibility: realm / "beda alam" (arahan pemilik 8 Nov 21:01)

> **Bukan bagian v1 yang dibangun sekarang — tapi v1 HARUS sudah
> menyiapkannya.** Bagian ini mengunci keputusan supaya interior tidak
> merombak protokol.

### 8.1 Arah yang diminta pemilik

Masuk kosan nanti dibuat **"beda alam"** seperti Museum 3D Hearts2Hearts
dulu: interior (ruang tamu + kamar) adalah **scene/ruang yang TERPISAH**
dari halaman luar, dimasuki lewat pintu — lobi + ruangan-ruangan di dalam.
Halaman luar dan interior bukan satu dunia kontinu; pemain "pindah alam"
saat masuk pintu.

### 8.2 Keputusan yang dikunci sekarang (v1)

1. **Realm adalah FIELD di pesan, bukan topik.** `pos` dan `presence`
   membawa `realm` sejak v1 (§2.2–2.3). Topik tetap dua saja
   (`kosan-ibu-kos/v1/pos`, `kosan-ibu-kos/v1/presence/#`) untuk semua
   alam. Alasan: alam baru (kamar baru, ruang baru) cukup bernilai string
   baru — tidak perlu subscription baru, tidak perlu ganti topik, tidak
   perlu naik versi protokol.
2. **Nilai realm v1:** `"yard"` (halaman luar — satu-satunya alam di v1).
   Nilai masa depan: `"living"` (ruang tamu), `"room-1"` … `"room-10"`
   (kamar). Daftar ini terbuka — implementer interior boleh menambah nilai
   tanpa mengubah §2.
3. **Aturan tampil:** klien hanya me-render pemain lain yang
   `realm`-nya sama dengan realm sendiri. Entri pemain di realm lain
   **tetap disimpan** (grup `visible = false`, tidak masuk hitungan pil
   status, tidak masuk 20 terdekat) supaya kembali ke alam itu tampil
   instan tanpa menunggu presence baru.
4. **Koordinat hanya bermakna di dalam realm yang sama.** `x`/`z` pemain
   di `"room-3"` dan pemain di `"yard"` boleh angkanya sama — mereka tetap
   di ruang berbeda. Jangan pernah menginterpolasi posisi antar realm.

### 8.3 Pindah alam (kontrak untuk implementer interior nanti)

- **Pemicu:** pemain mengetuk pintu / tombol "Masuk" (interior). Saat
  interior dibangun, kartu kamar ("Kamar 3") menjadi pintu masuk ke realm
  `"room-3"`; pintu ruang tamu menjadi pintu masuk ke `"living"`.
- **Urutan saat pindah alam (wajib):**
  1. Ganti scene/ruang lokal (tampilkan interior, sembunyikan halaman —
     atau sebaliknya).
  2. Set `myRealm` baru.
  3. **Segera** publish `presence` + `pos` dengan `realm` baru (aturan
     "publish segera saat keadaan berubah", §2.4).
  4. Pemain lain yang satu alam dengan alam baru saya langsung melihat
     saya muncul; pemain di alam lama saya langsung tidak melihat saya.
- **Posisi saat pindah:** posisi spawn di alam baru ditentukan scene
  interior (mis. di depan pintu masuk alam itu). Koordinat `x`/`z` di
  pesan pertama sesudah pindah adalah koordinat di alam baru.
- **Urutan pesan:** kalau `presence` dan `pos` membawa `realm` yang
  berbeda (balapan jaringan), yang dipakai adalah yang `ts`-nya lebih
  baru. Ini satu-satunya kegunaan `ts` pengirim.
- **Snap, bukan lerp, saat realm berubah:** begitu entri remote ganti
  `realm` menjadi sama dengan realm saya (atau saya ganti realm menjadi
  sama dengannya), tempatkan grup remote LANGSUNG di target barunya
  (`snapped = false` → snap ulang). Jangan biarkan avatar meluncur dari
  posisi halaman ke posisi kamar.
- **Keluar alam = kebalikan:** pindah kembali ke `"yard"` mengikuti
  urutan yang sama.

### 8.4 Yang TIDAK berubah saat interior dibangun

- Topik, format pesan, rate publish, timeout 5 dtk, last-will, failover
  broker — semuanya tetap.
- Identitas tetap dikunci di layar masuk (§4); pindah alam tidak meminta
  nama/gender lagi.
- Fungsi kamar (`roomFor`, `makeId`, kartu preview) tetap lokal; interior
  kamar adalah presentasi dari kamar yang sama, bukan sistem baru.

---

## Lampiran A. Checklist implementasi (file: `web/kosan-3d.html` saja)

Tidak ada file baru yang wajib (kecuali spek ini). Semua perubahan di dalam
satu file `kosan-3d.html` — pola yang sama dengan ronde-ronde sebelumnya.

| # | Pekerjaan | Lokasi di file saat ini |
|---|---|---|
| 1 | Tambah `muatSkrip()` + `pustakaJaringan()` (mqtt.js 5.10.1 unpkg) | Dekat `import * as THREE` / blok PURE (jangan di dalam blok PURE) |
| 2 | Tambah konstanta `BROKERS`, `MP_TOPICS`, `MP_RATE_MS = 100`, `MP_HEARTBEAT_MS = 3000`, `MP_TIMEOUT_MS = 5000`, `MP_MAX_RENDER = 20` | Dekat `SPEED` / `YARD` (baris ~201–234) |
| 3 | Tambah `playerId` (`localStorage 'kosan3d-id'`, buat sekali) + `klien`, `remotePlayers = {}`, `myRealm = 'yard'`, `lastPosSent` | Dekat `visitorGender` / `avatarPos` (baris ~856–872) |
| 4 | Tambah `sambung(idxBroker, onOpen)` (failover 10 dtk, last-will, reconnect) + `pasangPenangan(c)` (`on('message')` + validasi §2.7) + `kirimPos()` + `kirimPresence()` + `sweeper` 500 ms | Blok baru sesudah fungsi kamera / sebelum `animate()` |
| 5 | Layar masuk: pindahkan `#namebar` + `#genderRow` ke overlay; `#nameBtn` → "Masuk Kosan"; cabut auto-submit saat load (baris ~1013); tambah label read-only identitas di `#topbar`; tambah pil status `🟢/🟡/⚪` di `#topbar` | HTML baris ~117–145 + `submitName` baris ~990–1015 |
| 6 | `setGender()` hanya aktif sebelum masuk (listener tetap, tapi tombol disembunyikan sesudah masuk bersama overlay) | Baris ~894–909 |
| 7 | Hook publish di `animate()`: sesudah `avatarPos` berubah + timer 100 ms / 3 dtk (§2.4) | `animate()` baris ~1274–1332 |
| 8 | Render remote di `animate()`: lerp + ayunan + idle (§3.3–3.4) + hitung ulang 20 terdekat tiap 1 dtk | `animate()`, sesudah blok kamera |
| 9 | `beforeunload` + `pagehide`: presence `''` + flush 150 ms + `klien.end(true)` (penjaga sekali saja) | Akhir modul, sebelum `animate()` dipanggil |
| 10 | Hapus avatar remote saat entri dihapus (scene.remove + dispose tekstur label) — jangan biarkan grup yatim di scene | Fungsi `hapusRemote(id)` baru |
| 11 | `?debug=joy`: tambah baris status multiplayer (§7.3) | Blok overlay debug di `animate()` |

**Yang TIDAK BOLEH disentuh:** blok PURE (fungsi kamar — `normalize`,
`roomFor`, `makeId`, `previewFor`), `makeKosanAvatar`, `makeLabel`/`setLabel`
(selain dipakai), `collideBuilding`, `TABLE_BOX`, `YARD`, `SPEED`, kamera
fantasy, fly `flyToDoor`, joystick mengambang, kartu kamar, papan.

## Lampiran B. Kerangka kode (pseudo-code — adaptasi Kantor Misi, bukan salin mentah)

```js
// -- sambung (adaptasi game.js sambung()) --
function mpSambung(idxBroker, onOpen) {
  if (typeof mqtt === 'undefined') return null; // pustaka gagal -> mode sendiri
  var c = mqtt.connect(BROKERS[idxBroker], {
    clientId: 'kosan-' + playerId + '-' + Math.random().toString(36).slice(2, 6),
    reconnectPeriod: 2000, connectTimeout: 8000,
    will: { topic: 'kosan-ibu-kos/v1/presence/' + playerId, payload: '', retain: true }
  });
  var dibuka = false, selesai = false;
  var batas = setTimeout(function () {
    if (dibuka || selesai) return;
    selesai = true; try { c.end(true); } catch (e) {}
    if (idxBroker + 1 < BROKERS.length) mpSambung(idxBroker + 1, onOpen);
    else mpModeSendiri(); // semua broker gagal
  }, 10000);
  c.on('connect', function () {
    if (!dibuka) { dibuka = true; clearTimeout(batas); klien = c; onOpen(c); }
    c.subscribe(['kosan-ibu-kos/v1/pos', 'kosan-ibu-kos/v1/presence/#'], function () {});
    mpKirimPresence(); mpKirimPos(true); // tulis ulang saat (re)connect
  });
  c.on('close', function () { if (dibuka) mpSetStatus('reconnect'); });
  c.on('error', function () { /* gagal() ala Kantor: failover hanya bila belum dibuka */ });
  return c;
}

// -- pesan masuk (adaptasi game.js pasangPenangan()) --
function mpPasangPenangan(c) {
  c.on('message', function (t, payload) {
    var nama = t.split('/').pop();
    var teks = payload.toString();
    if (nama === 'presence' && teks === '') {
      // presence kosong = pemain pergi (topik .../presence/<id>)
      mpHapusRemote(t.split('/').pop());
      return;
    }
    var m; try { m = JSON.parse(teks); } catch (e) { return; }
    if (!m || typeof m.id !== 'string' || m.id === playerId) return;
    if (nama === 'pos') mpTerimaPos(m);
    else if (nama === 'presence') mpTerimaPresence(m);
  });
}
// mpTerimaPos / mpTerimaPresence: validasi §2.7 -> buat/update entri ->
//   lastSeen = Date.now() -> snap bila baru / ganti realm -> perbaruiLabelDuplikat()
```

## Lampiran C. Istilah

- **Realm/alam:** satu ruang/scene terpisah (halaman, ruang tamu, kamar).
  Pemain hanya melihat pemain lain di alam yang sama (§8).
- **Presence:** pesan identitas retained per pemain — "siapa yang online".
- **Pos:** pesan gerak tidak retained — "di mana + sedang apa".
- **Last-will:** pesan yang broker kirimkan otomatis atas nama klien yang
  mati mendadak (diisi saat `connect`).
- **Mode sendiri:** fallback saat MQTT tidak tersedia — game tetap jalan
  tanpa pemain lain.
