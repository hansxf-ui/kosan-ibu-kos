# KERJA-BELANJA — kerja, Rupiah, toko, uang kos (16 Nov 2026)

Permintaan Ryan: "orang-orang bisa bekerja, seperti di cafe dan lain-lain dan mendapatkan
uang IDR, untuk mendapatkan uangnya jangan terlalu mudah agar tidak membosankan ... uangnya
bisa dipake untuk berbelanja membeli sesuatu, mendaftar kerja > mulai bekerja > animasi
bekerja > selesai bekerja > mendapatkan uang". Rencana disetujui ("ikut saranmu"), lalu
tambahan disetujui: jaga warung, ronda malam, laundry kiloan, uang kos bulanan, misi baru.

## Ringkas

- **4 pekerjaan**: Barista Kafe (Kedai Kopi baru di Jalan Kampung), Penjaga Warung, Ronda
  Malam (20.00–04.00 WIB), Laundry Kiloan (dapur kos, penghuni saja).
- **Alur**: daftar (papan lowongan / menu ☰ Kerja / kartu tempat kerja) → mulai shift →
  mini game + animasi tangan → selesai → gaji + tip masuk dompet.
- **Rupiah disimpan di server** (Supabase), hanya untuk penghuni. Server yang menghitung
  gaji dan harga; klien hanya melapor hasil kerja `{benar, salah, cepat}`.
- **Tidak terlalu mudah**: maks 3 shift sehari (semua pekerjaan), istirahat 10 menit antar
  shift, satu shift minimal ~100 detik, maks 20 menit. Salah tekan mengurangi tip.
- **Naik pangkat** sesudah 5 dan 15 shift per pekerjaan: gaji pokok naik, petunjuk berkurang,
  pembeli lebih cepat tidak sabar.
- **Belanja**: kopi di Kedai Kopi (dipegang 90 detik), aksesori (topi, kacamata, tas —
  terlihat pemain lain) dan dekorasi kamar (poster, tanaman, karpet, lampu tumblr) di Toko
  Online, uang kos Rp100.000 per bulan WIB lewat kartu Ibu Kos (sukarela, hanya cap LUNAS
  di KTA; tidak pernah memengaruhi kepemilikan kamar).
- **Tamu**: kafe, warung, ronda bisa dicoba sebagai **latihan** (tanpa server, tanpa gaji,
  layar hasil menampilkan perkiraan gaji). Laundry tidak (tamu tidak bisa masuk dapur).
- **Bintang Kosan tetap lokal** di HP (misi + jajan warung). Rupiah terpisah.
- Misi Harian baru: **Kerja 1 shift** (latihan ikut dihitung) dan **Jajan di kafe**
  (penghuni).

## Pekerjaan

| Pekerjaan | Tempat | Tugas per shift | Gaji pokok (Magang / Tengah / Senior) | Tip maks |
| --- | --- | --- | --- | --- |
| Barista Kafe | Kedai Kopi, Jalan Kampung | 6 pesanan: ketuk bahan sesuai resep | Rp7.000 / 9.000 / 11.000 | Rp4.000 |
| Penjaga Warung | Warung, Jalan Kampung | 6 pembeli: ambil barang + kembalian pas | Rp6.000 / 8.000 / 10.000 | Rp3.000 |
| Ronda Malam | Pos Ronda (20.00–04.00 WIB) | 4 titik patroli × 3 ketukan kentongan tepat irama, jaga pos, lapor | Rp8.000 / 10.000 / 12.000 | Rp3.000 |
| Laundry Kiloan | Dapur kos | 3 kantong: timbang (pilih ongkos), cuci, keringkan, lipat 3 baju | Rp7.000 / 9.000 / 11.000 | Rp3.000 |

Kesulitan per pangkat:

- **Barista**: Magang melihat langkah berikutnya disorot; Barista melihat resep; Barista
  Senior hanya nama minuman ("Intip resep" = 1 salah).
- **Warung**: Magang diberi tahu kembaliannya; Penjaga melihat total + uang dibayar; Kepala
  hanya harga satuan + uang dibayar.
- **Kafe + warung**: kesabaran pembeli 32 / 27 / 23 detik (warung +6 detik untuk menghitung).
- **Laundry**: Magang diberi rumus `kg × Rp2.000/kg`; urutan lipat disorot untuk Magang.

Rumus (api/_lib/kerja.js `upahShift`, dibulatkan ke bawah kelipatan Rp500):

```
gaji = gaji_pokok[pangkat] × (0,3 + 0,7 × benar/pesanan)
tip  = tip_maks × benar/pesanan × max(0, 1 − 0,1 × salah) × (0,4 + 0,6 × cepat)
```

Contoh: Magang Barista, 6/6 benar, 1 salah, kecepatan 0,5 → gaji Rp7.000 + tip Rp2.500.
Paling banyak Rp15.000 per shift (Barista Senior / Komandan Ronda, sempurna), jadi paling
banyak Rp45.000 per hari per penghuni. Magang yang rajin dapat sekitar Rp25.000–30.000
sehari: uang kos ±4 hari kerja penuh, satu aksesori 1–2 hari.

## Harga

| Barang | Harga | Jenis |
| --- | --- | --- |
| Es kopi susu gula aren / Americano panas / Teh tarik / Es cokelat | Rp4.000 / 3.000 / 3.500 / 4.000 | Kopi (boleh beli berulang) |
| Topi baseball / Topi bucket | Rp15.000 / 18.000 | Aksesori (sekali beli) |
| Kacamata hitam / Kacamata bulat | Rp20.000 / 20.000 | Aksesori |
| Tas ransel / Tas selempang | Rp30.000 / 25.000 | Aksesori |
| Poster / Tanaman hias / Karpet bulu / Lampu tumblr | Rp12.000 / 20.000 / 35.000 / 25.000 | Dekor kamar (sekali beli) |
| Uang kos | Rp100.000 per bulan WIB | Sukarela, cap LUNAS di KTA |

Sumber kebenaran: `api/_lib/kerja.js` (`KATALOG`, `PEKERJAAN`). Salinan tampilan di blok
`KERJA-START` index.html dites sama (`tests/kerja-klien.test.js`).

## Server

Endpoint baru (total 9 endpoint, di bawah batas 12 Vercel Hobby):

- `GET /api/dompet` — saldo, status kerja per pekerjaan, jatah hari ini, sisa istirahat,
  shift aktif, uang kos bulan ini, barang milik, 10 mutasi terakhir.
- `POST /api/kerja` `{aksi: 'daftar'|'mulai'|'selesai'|'batal', pekerjaan?, shift?, hasil?}`
- `POST /api/belanja` `{aksi: 'beli', barang}` atau `{aksi: 'sewa'}`

Semuanya butuh sesi penghuni (cookie), cek CSRF yang sama dengan endpoint lain, dan batas
per **kamar** per jam (dompet 600, kerja 120, belanja 60; bukan per IP karena CGNAT).

Database (`supabase/migrations/20261116_kerja_belanja.sql`, hanya MENAMBAH): tabel
`kosan_dompet`, `kosan_mutasi`, `kosan_pekerjaan`, `kosan_shift`, `kosan_barang`,
`kosan_sewa` + 8 fungsi `kosan_*` (security definer, `search_path = ''`, hanya
`service_role`). Fungsi menegakkan yang harus atomik: saldo tidak pernah negatif, satu shift
aktif per penghuni (unique partial index), durasi minimum + maksimum shift, jatah per hari
WIB, jeda 10 menit, barang sekali beli, uang kos sekali per bulan. Tabel penghuni, sesi, dan
fungsi login tidak disentuh. Identitas dompet = `(room, nama_norm)` dari sesi server: kalau
kamar berganti penghuni, penghuni baru mulai dari dompet kosong.

Batas curang yang diterima: klien yang diutak-atik bisa melapor hasil sempurna, tapi tetap
dibatasi durasi minimum, 3 shift sehari, dan Rp15.000 per shift (CHECK SQL: maks Rp20.000).

## Klien (index.html)

- **Kedai Kopi** menggantikan rumah krem (x -1..7) di Jalan Kampung, atas perintah langsung
  Ryan (bukan area palang "SEGERA DIBUKA" yang dicadangkan untuk voting). Teras terbuka,
  kanopi kanvas bergaris (opak), meja bar menghadap jalan, papan menu, papan lowongan.
  Malam: lampu untai + lampu gantung (MeshBasicMaterial) dan genangan cahaya di trotoar.
- **Pembeli** = avatar NPC lokal (hanya di HP pemain itu, tidak lewat jaringan).
- **Barista + penjaga warung** ditambat di balik meja (posisi tetap, pose `stand`); pemain
  lain melihat celemek + gerak tangan lewat field opsional `kerja`.
- **Aksesori** lewat field opsional MQTT `topi`, `kacamata`, `tas` (indeks), `kerja`
  (kafe/warung/ronda/laundry). Kosmetik saja, klien lama mengabaikannya, tidak membuktikan
  kepemilikan dan tidak pernah memicu gaji.
- **Panel kerja**: kafe, warung, laundry di panel bawah (portrait) / kanan (landscape); ronda
  memakai pita kecil di atas supaya layar lapang untuk berjalan. Selama panel terbuka,
  bidang proyeksi kamera digeser (`setViewOffset`) supaya avatar tampil di area yang tidak
  tertutup panel. Posisi + aturan kamera tidak berubah.
- Tidak ada lampu baru, bidang transparan, atau emissive; tidak ada naik-turun badan.
- Meninggalkan tempat kerja (keluar alam), lewat 20 menit, atau tombol Berhenti =
  shift dibatalkan tanpa gaji (jatah hari ini tidak berkurang). **Kecuali** saat "Mencatat
  gaji…": Berhenti mati dan keluar alam tidak membatalkan; gaji yang dijawab server tetap
  dicatat (toast gaji kalau sudah pindah tempat).
- **Gaji belum tercatat** (sinyal putus, timeout 10 dtk, 429, 5xx): layar hasil menampilkan
  **Coba lagi** (laporan + id shift sama; server membayar shift aktif sampai 20 menit sejak
  mulai) dan dompet dimuat ulang. Coba lagi dijawab `shift_tidak_aktif` = percobaan pertama
  mungkin sudah tercatat: pemain diarahkan ke saldo + riwayat. `terlalu_cepat` = satu kiriman
  ulang sesudah 2,5 dtk.
- Potret dompet (jeda, jatah, uang kos) dibandingkan dengan jam sekarang: jeda jadi waktu
  mutlak, jatah dari tanggal WIB lain tidak menolak, lunas bulan lalu = belum lunas. GET
  dompet yang mulai sebelum beli / bayar / daftar / gaji dibuang lalu dimuat ulang. Beli dan
  bayar uang kos tidak bisa diketuk dua kali.

## Urutan deploy

1. **SQL dulu.** Jalankan `supabase/migrations/20261116_kerja_belanja.sql` sekali di SQL
   Editor Supabase (satu transaksi, idempoten). Lalu jalankan cek di akhir file:
   `has_function_privilege('anon', ...)` → `false`, `service_role` → `true`,
   `select count(*) from kosan_residents;` tidak berubah. Uji di transaksi yang dibatalkan
   (blok `begin; ... rollback;` di akhir file). **Belum pernah dijalankan di Postgres asli
   dari sandbox** — tes server memakai database palsu (`tests/fake-db.js`).
   Sesudahnya jalankan `supabase/migrations/20261117_kerja_kunci.sql` (audit 16 Nov): isi
   `kosan_kerja_mulai` / `_selesai` / `_batal` sama persis, ditambah
   `pg_advisory_xact_lock` per penghuni di baris pertama, supaya "mulai" yang bertumpuk
   dengan "selesai" tidak bisa melewati jeda 10 menit atau jatah 3 shift. Tidak menyentuh
   tabel. Cek di akhir file (uji dua tab SQL Editor: tab kedua harus menunggu). Klien +
   server tetap jalan kalau migrasi ini belum dijalankan (hanya celah balapan itu yang
   tersisa).
2. **Daftar file deploy** bertambah 4 berkas baru: `api/dompet.js`, `api/kerja.js`,
   `api/belanja.js`, `api/_lib/kerja.js` (plus `api/_lib/app.js` + `api/_lib/db.js` yang
   berubah, dan `index.html`). Berkas `api/` jadi 14 (9 endpoint + 5 di `api/_lib/`).
   Tidak ada env var baru.
3. **Cek preview:**
   - `curl -s -o /dev/null -w '%{http_code}' https://<preview>/api/dompet` → `401`.
   - `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"aksi":"daftar","pekerjaan":"kafe"}' https://<preview>/api/kerja` → `401`.
   - `curl -s -o /dev/null -w '%{http_code}' -X POST https://<preview>/api/belanja` → `415`.
   - `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://contoh.invalid' -H 'Content-Type: application/json' -d '{}' https://<preview>/api/belanja` → `403`.
   - Playtest HP (penghuni): pil saldo muncul `Rp0` → ☰ Kerja → Daftar Barista → Jalan
     Kampung → ketuk Kedai Kopi → Mulai shift → layani 6 pembeli → gaji masuk, riwayat
     tercatat → shift berikutnya ditolak "istirahat 10 menit". Tamu: Coba kerja (latihan).
4. **Promote**, lalu tes live dengan satu akun penghuni.

Kalau urutannya terbalik (klien live sebelum SQL): `/api/dompet` menjawab 503, pil saldo
menampilkan `Rp —`, kartu tempat kerja menampilkan "Dompet belum termuat · coba lagi", dan
mulai shift penghuni ditolak dengan pesan server; tamu tetap bisa latihan. Gagal aman, tidak
ada Rupiah yang tercatat setengah.

## Operasional

- Saldo terbanyak: `select room, nama_norm, saldo from kosan_dompet order by saldo desc limit 20;`
- Mutasi satu kamar: `select * from kosan_mutasi where room = 3 order by id desc limit 20;`
- Shift hari ini: `select room, nama_norm, pekerjaan, status, gaji, tip, benar, salah from kosan_shift where tanggal = (now() at time zone 'Asia/Jakarta')::date order by mulai;`
- **Koreksi saldo** (mis. kompensasi galat server; selalu dengan catatan mutasi):

  ```sql
  begin;
  insert into kosan_dompet as d (room, nama_norm, saldo) values (3, 'rina', 5000)
  on conflict (room, nama_norm) do update set saldo = d.saldo + excluded.saldo, diperbarui = now();
  insert into kosan_mutasi (room, nama_norm, jumlah, jenis, keterangan, saldo_sesudah)
  select 3, 'rina', 5000, 'gaji', 'Koreksi Ibu Kos', saldo from kosan_dompet where room = 3 and nama_norm = 'rina';
  commit;
  ```

- Kamar berganti penghuni: dompet lama tetap di tabel (kunci `room` + `nama_norm` lama),
  tidak terbaca penghuni baru. Hapus manual kalau perlu.

## Rollback

Deploy ulang `index.html` + `api/` versi sebelumnya. Tabel + fungsi baru boleh dibiarkan
(tidak dipakai klien lama, hanya `service_role` yang bisa membacanya).

## Menjalankan tes

```bash
node --test tests/kerja-server.test.js   # server: upah, jatah, jeda, ronda, belanja, uang kos, CSRF, migrasi
node --test tests/kerja-klien.test.js    # klien: salinan aturan = server, mini game, tempat, kabel, aturan tetap
node --test tests/kerja-alur.test.js     # alur klien dengan server palsu: jeda/jatah basi, batal saat mencatat gaji, Coba lagi, GET basi, ketuk dua kali
node --test tests/*.test.js              # semua
```

## Menunggu keputusan Ryan

- **Kalimat Ibu Kos baru** (malam, hujan, uang kos) masih DRAF di blok `IBU-START`
  (`IBU_OBROLAN_MALAM`, `IBU_OBROLAN_HUJAN`, `IBU_SEWA`). Disetujui satu per satu; jangan
  di-merge sebelum disetujui.
- **Dekorasi kamar** bertentangan dengan vonis lama "isi kamar SEDERHANA: kasur + meja kecil
  saja — isi kamar tumbuh lewat komen episode". Hanya muncul di kamar pemilik yang membeli.
  Kalau tidak disetujui, kategori dekor dicabut dari katalog (server + klien).
- **Tanaman hias** pernah diusulkan penonton (Dimz, 2 like) dan kalah voting.
