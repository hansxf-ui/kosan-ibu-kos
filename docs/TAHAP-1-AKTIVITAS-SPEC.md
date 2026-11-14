# Spesifikasi Tahap 1 Aktivitas: Jemuran, Nongkrong di Gazebo, Ngobrol dengan Ibu Kos

Status: **DRAF, menunggu cek Ryan.** Belum ada kode yang dibangun.
Tanggal: 14 November 2026. Basis kode: `main` @ `ac2cfb5`.

## 1. Tujuan dan batasan

Pemain bisa melakukan sesuatu di objek yang sudah ada di kos, bukan hanya jalan-jalan.
Tiga aktivitas di ronde ini sudah disetujui Ryan:

1. **Jemuran**: cucian dari mesin cuci di dapur dijemur di jemuran halaman, ditunggu kering, lalu diangkat.
2. **Nongkrong di gazebo**: duduk di bangku gazebo. Pemain lain melihatnya duduk.
3. **Ngobrol dengan Ibu Kos**: Ibu Kos punya kalimat yang berganti-ganti, bukan satu teks tetap.

Arahan Ryan yang dipakai di spesifikasi ini:

- Aktivitas baru boleh masuk Misi Harian dan memberi Bintang.
- Fasilitas besar (kolam, AC, TV, warung) tetap lewat komentar penonton, satu per episode. Ronde ini tidak menambah fasilitas besar.
- Benda kecil pendukung aktivitas boleh langsung ditambah. Ronde ini hanya menambah **keranjang cucian** dan **3 helai cucian pemain** di jemuran.

Batasan teknis:

- **Semua status aktivitas lokal** (localStorage), seperti Misi dan Lempar Sendal sekarang. Status objek tidak dikirim lewat multiplayer. Broker MQTT publik bisa dipalsukan siapa saja, jadi status bersama menunggu relay Fase B (`docs/RASA-AMAN-DESAIN.md`).
- Satu-satunya yang terlihat oleh pemain lain adalah **pose duduk di gazebo**. Pose duduk sudah ada di protokol (`pose: 'sit'`), jadi tidak ada jenis pesan baru.
- Server, API, database, dan data penghuni tidak disentuh.
- Semua geometri tetap prosedural (`box`/`cyl`/`ball`), tanpa model GLB, tanpa `backdrop-filter`.
- Tambahan mesh maksimal **+12** di halaman. Perkiraan: keranjang 3, cucian 3.
- Ronde ini tidak mengubah posisi objek yang sudah diputuskan Ryan (gazebo, jemuran, Ibu Kos, kamera).

## 2. Tugas 0: perbaiki realm dapur di multiplayer

Bug yang sudah dikonfirmasi Vesper: `mpRealmDikenal` (`index.html` ±1452) hanya mengenal `yard`, `living`, dan `room-1..20`. `enterDapur` mengisi `myRealm = 'dapur'`, tapi penerima mengubahnya jadi `yard`. Akibatnya pemain yang sedang di dapur tampak berdiri di halaman oleh pemain lain.

Perubahan:

- `mpRealmDikenal`: terima `'dapur'`.
- Tes klien baru: `mpRealmDikenal('dapur') === 'dapur'`. Nilai tak dikenal tetap jadi `'yard'`.
- `docs/MULTIPLAYER-SPEC.md`: tambahkan `dapur` ke daftar realm di tabel field `realm` (§2.2) dan di aturan validasi (§2.7). Kedua tempat itu juga masih menulis `room-1`…`room-10`, jadi sekalian diperbarui ke `room-20`, sesuai kode sejak Gedung B.

Catatan saat deploy: selama ada pemain yang masih memakai versi lama (tab belum dimuat ulang), versi lama tetap menganggap dapur sebagai halaman. Ini hilang setelah mereka memuat ulang. Tidak ada efek ke keamanan.

Tugas ini dikerjakan pertama karena gazebo (bagian 4) adalah aktivitas pertama yang dilihat bersama.

## 3. Jemuran

### 3.1 Alur pemain

1. Penghuni menyalakan **mesin cuci** di dapur seperti sekarang (`startWash('wm')`, 30 detik).
2. Saat selesai (`finishWash('wm')`), toast berubah jadi: "Cucian selesai! Bawa ke jemuran di halaman barat 🧺". Status cucian jadi **basah**, dan **keranjang cucian** muncul di tangan avatar.
3. Pemain keluar ke halaman dan berjalan ke jemuran (x -18..-13, z 0..8).
4. Ketuk jemuran: kartu "Jemuran" muncul dengan tombol **Jemur cucian**. Ketuk tombol: 3 helai cucian muncul di tali, keranjang hilang dari tangan, status jadi **dijemur**.
5. Cucian kering setelah **`JEMUR_DUR`** (usul 3 menit waktu nyata). Pemain boleh pergi, masuk kamar, atau memuat ulang halaman, karena waktunya dihitung dari jam, bukan dari frame.
6. Ketuk jemuran lagi:
   - Kalau belum kering, kartu menampilkan sisa waktu, misalnya "Kering kira-kira 1 menit lagi".
   - Kalau sudah kering, tombol **Angkat cucian** muncul. Ketuk tombol: cucian hilang dari tali, toast "Cucian kering diangkat 👕", misi `jemur` tercentang (+1 Bintang, sekali sehari), dan status kembali **kosong**.

### 3.2 Aturan

- **Tamu** tidak bisa masuk dapur, jadi tidak pernah punya cucian. Kalau tamu mengetuk jemuran, kartunya menjelaskan: "Jemuran kos. Cuci dulu di dapur, khusus penghuni."
- Kalau statusnya masih basah atau dijemur, mesin cuci tidak bisa dipakai lagi. Toast: "Cucianmu masih di keranjang / di jemuran 🧺". Satu cucian per pemain.
- **Jarak**: tombol Jemur dan Angkat hanya muncul kalau avatar berada ≤ **3 m** dari kotak jemuran. Kalau lebih jauh, kartu tetap terbuka dengan pesan "Jalan ke jemuran dulu ya". Ketukan sekarang bisa dari jarak berapa pun, dan pembatasan jarak ini membuat pemain benar-benar berjalan ke sana.
- **Pengering** di dapur tidak diubah di ronde ini. Pengering tetap mesin terpisah dan tidak memengaruhi status cucian.
- 4 pakaian dekorasi yang sudah ada di jemuran tetap ada.
- Cucian pemain hanya terlihat oleh dirinya sendiri, karena statusnya lokal. Ini ditulis jujur di kartu: "Cucian ini cuma kelihatan di HP-mu."

### 3.3 Objek

- **Cucian pemain**: 3 `box` tipis (0,06 × 0,6 × 0,45) di slot tali yang masih kosong: (-16,5; 1,4; 4,0), (-14,5; 1,4; 2,0), (-14,5; 1,4; 5,0). Warnanya memakai material yang sudah ada di `M` (misalnya `M.white` dan `M.bedCream`) supaya tidak menambah material. Mesh ini disembunyikan (`visible = false`) kecuali status dijemur atau kering. Cucian baru tidak mendapat AABB di `PLAZA_SOLIDS`, karena hanya muncul sementara dan hanya di layar pemain itu. Pakaian dekorasi lama tetap punya AABB-nya. Saat dijemur, cucian sedikit bergoyang (rotasi z ±0,05 rad), di animasi yang sama dengan lampu atau uap dapur.
- **Keranjang cucian**: 3 mesh (badan, isi, pegangan), menempel ke grup avatar di sisi tangan kanan. Hanya terlihat saat status basah. Saat avatar dibangun ulang (`buildVisitorAvatar`, ganti gender), keranjang dipasang lagi. Keranjang **tidak** terlihat oleh pemain lain.
- **Target ketuk**: 4 tiang, 2 tali, 4 pakaian lama, dan 3 cucian baru mendapat `userData.interact = 'jemuran'` dan dimasukkan ke `clickables`. `canvasTap` mendapat cabang `ud.interact === 'jemuran'`, sebelum cabang `card`.

### 3.4 Status dan penyimpanan

Kunci localStorage: `kosan3d-jemuran` → `{ "status": "kosong"|"basah"|"dijemur", "sejak": <ms> }`.

Status **kering** tidak disimpan. Status itu dihitung: `dijemur` dan `sekarang - sejak ≥ JEMUR_DUR`.

Fungsi murni baru di blok `JEMURAN-START/END` (dites node, pola `MISI`):

- `jemuranMuat(raw)`: parsing aman. Kalau JSON rusak, statusnya tak dikenal, atau `sejak` bukan angka, hasilnya `kosong`. `sejak` di masa depan (jam HP dimundurkan) dipotong ke sekarang.
- `jemuranStatus(st, sekarang, dur)` → `'kosong'|'basah'|'dijemur'|'kering'`.
- `jemuranSisaDetik(st, sekarang, dur)` → angka ≥ 0.
- `jemuranTransisi(st, aksi, sekarang)` untuk aksi `'cuci_selesai'|'jemur'|'angkat'` → state baru, atau `null` kalau aksinya tidak sah dari status itu (misalnya `angkat` saat belum kering).
- `jarakKeKotak(x, z, kotak)`: jarak dari titik ke AABB (0 kalau di dalam). Dipakai jemuran dan gazebo.

## 4. Nongkrong di gazebo

### 4.1 Alur pemain

1. Pemain berjalan ke gazebo (pusat 12,0; 6,5).
2. Ketuk salah satu dari 4 bangku: kartu "Gazebo" muncul dengan tombol **Duduk di sini**.
3. Ketuk tombol: avatar pindah ke kursi terdekat di bangku itu, pose duduk menghadap meja. Tombol **Bangun** di topbar (`#wakeBtn`) muncul, sama seperti duduk di kasur. Joystick tidak menggerakkan avatar selama duduk, juga sama seperti di kamar.
4. Pose `sit` dipublikasikan segera (`mpKirimPos`). Pemain lain melihat avatarnya duduk di bangku, karena `mpTerapkanPoseRemote` memakai x/z dari pesan dan tinggi duduk yang sama dengan kasur.
5. Duduk pertama hari itu mencentang misi `gazebo` (+1 Bintang).
6. Bangun lewat tombol Bangun, atau otomatis saat pindah realm (masuk kamar, ruang tamu, dapur). Avatar berdiri di titik bangun di depan bangku itu.

### 4.2 Kursi

8 kursi, 2 per bangku. Tinggi jok bangku 0,49 m dan tinggi kasur 0,48 m, jadi `y = -0,31` dan kaki `-0,92` dari `POSE_SIT` bisa dipakai apa adanya. Ini juga berarti tampilan pemain lain tidak perlu diubah.

| Bangku | Kursi (x, z) | Menghadap (rotY) | Titik bangun (x, z) |
|---|---|---|---|
| Utara (z 5,3) | (11,6; 5,3), (12,4; 5,3) | 0 (ke +z, ke meja) | (x kursi; 4,6) |
| Selatan (z 7,7) | (11,6; 7,7), (12,4; 7,7) | π | (x kursi; 8,4) |
| Timur (x 13,3) | (13,3; 6,2), (13,3; 6,8) | -π/2 | (14,1; z kursi) |
| Barat (x 10,7) | (10,7; 6,2), (10,7; 6,8) | π/2 | (9,9; z kursi) |

Angka akhir (geser badan sedikit ke belakang supaya kaki tidak menembus meja) disetel saat membangun, dengan screenshot sebelum dan sesudah. Semua titik bangun ada di atas dek dan di luar AABB kolom, bangku, dan railing di `PLAZA_SOLIDS`.

### 4.3 Aturan

- **Jarak**: Duduk hanya bisa kalau avatar ≤ **3 m** dari bangku. Kalau lebih jauh: "Jalan ke gazebo dulu ya".
- **Kursi terisi**: kalau ada pemain lain (`remotePlayers`, realm `yard`, pose `sit`) dalam 0,35 m dari kursi itu, pilih kursi lain di bangku yang sama. Kalau dua-duanya terisi: "Bangkunya penuh, coba bangku lain". Data ini berasal dari pesan publik yang bisa dipalsukan. Akibat terburuknya pemain tidak bisa duduk di satu bangku, jadi tidak ada risiko keamanan.
- **Tamu boleh duduk di gazebo.** Gazebo ada di halaman, bukan ruangan, jadi larangan masuk ruangan untuk tamu tidak berlaku.
- **Label nama saat duduk** (perlu keputusan Ryan, lihat bagian 8): usulnya label nama **tetap tampil** saat duduk, baik avatar sendiri maupun pemain lain, supaya terlihat siapa yang sedang nongkrong. Label tetap disembunyikan saat tidur. Sekarang label disembunyikan untuk duduk maupun tidur (`terapkanPoseKamar`, `mpTerapkanPoseRemote`).

### 4.4 Perubahan kode

- `roomPose` tetap jadi status pose (`null|'sit'|'sleep'`) dan tetap yang dipublikasikan. Yang ditambah adalah variabel **`poseJangkar`** `{x, z, y, rotX, rotY, leg, bangun:{x,z,rotY}}`. Untuk kasur nilainya `POSE_SIT`/`POSE_SLEEP` + `WAKE_SPOT`. Untuk gazebo nilainya kursi yang dipilih.
- `terapkanPoseKamar` dan `bangunDariKasur` membaca `poseJangkar`, bukan konstanta kasur. Perilaku kasur tidak berubah. Ini dijaga dengan tes, lihat bagian 7.
- Masuk kamar, ruang tamu, atau dapur dari halaman memanggil `bangunDariKasur(true)` kalau sedang duduk, seperti `enterRoom` sekarang.
- Mesh jok dan panel 4 bangku mendapat `userData.interact = 'bangku'`, `bangku: 'utara'|'selatan'|'timur'|'barat'`, dan masuk `clickables`.
- Fungsi murni baru (blok `GAZEBO-START/END`):
  - `GAZEBO_KURSI`: tabel di 4.2.
  - `gazeboPilihKursi(bangku, ax, az, terisi)`: kursi terdekat yang kosong di bangku itu, atau `null`.
  - `gazeboKursiTerisi(kursi, pemain)`: cek pemain lain dalam 0,35 m.

## 5. Ngobrol dengan Ibu Kos

### 5.1 Alur pemain

1. Ketuk Ibu Kos (posisi tetap di 10,5; -2,5). Kartu Ibu Kos terbuka seperti sekarang: teks perkenalan lama tetap ada.
2. Di bawahnya muncul **satu kalimat Ibu Kos** dalam gelembung chat, dan tombol **Ngobrol lagi**.
3. Ketuk **Ngobrol lagi**: kalimat berikutnya.
4. Ngobrol pertama hari itu mencentang misi `ibu` (+1 Bintang).
5. Selama kartu terbuka dan pemain ≤ 6 m, Ibu Kos memutar badan menghadap pemain. Saat kartu ditutup, Ibu Kos kembali ke `rotation.y = 0`. Ini hanya di layar pemain sendiri.

### 5.2 Urutan kalimat

`ibuPilihKalimat(ctx)` adalah fungsi murni. Kalimat pertama tiap kali kartu dibuka mengikuti prioritas ini:

1. Cucian pemain sudah **kering** di jemuran → "Cucianmu udah kering tuh di jemuran, angkat gih sebelum diambil angin 😄"
2. Pemain **tamu** → "Mau jadi penghuni? Kode kuncinya ada di caption video terbaru Ibu ya."
3. Ada **misi** yang belum selesai hari ini → "Misi hari ini masih ada N lagi, semangat!"
4. Kalau tidak ada yang cocok: **sapaan sesuai jam WIB** (pagi 04–10, siang 10–15, sore 15–18, malam 18–04).

**Ngobrol lagi** mengambil kalimat dari daftar `IBU_OBROLAN` secara bergilir. Urutannya diacak sekali per hari dengan seed tanggal WIB, jadi tiap hari terasa beda tapi tidak berulang dalam satu sesi. Indeks terakhir disimpan di `kosan3d-ibu-obrolan` `{tanggal, i}`.

### 5.3 Isi kalimat (DRAF, Ryan/Vesper silakan ganti)

Aturan isi: Ibu Kos tidak menjanjikan fasilitas yang belum dibangun, tidak menyebut nama penghuni lain, dan tidak menyebut tanggal episode.

Sapaan:
- Pagi: "Pagi! Udah sarapan belum? Mumpung cerah, enak buat jemur cucian."
- Siang: "Siang-siang gini enaknya ngadem di gazebo."
- Sore: "Sore, Nak. Cucian di jemuran jangan lupa diangkat ya."
- Malam: "Udah malam, jangan begadang. Lampu kamar dimatiin kalau tidur."

`IBU_OBROLAN`:
1. "Gazebo itu dibangun karena kalian yang minta. Dipakai ya, jangan cuma difoto."
2. "Mesin cuci di dapur gratis buat penghuni. Habis nyuci, jemur di halaman barat."
3. "Kalau ketemu tetangga, sapa dong. Kos ini rame karena kalian."
4. "Mau fasilitas baru? Komen di video Ibu. Like terbanyak, Ibu bangun."
5. "Tangga ke balkon lantai dua itu enak buat lihat pemandangan sore."
6. "Ibu nggak galak kok. Asal kamar rapi dan saling jaga, Ibu senang."
7. "WiFi ruang tamu itu dulu request pertama kalian. Kenceng kan?"
8. "Parkiran di selatan itu buat motor, bukan buat jemur sendal ya."
9. "Kalau capek, rebahan dulu di kasur. Kamar itu rumahmu."
10. "Kode kunci kamar selalu Ibu taruh di caption video terbaru."
11. "Lempar sendal boleh, asal jangan ke jendela tetangga."
12. "Nanti kalau kos makin rame, Ibu bikin acara kumpul-kumpul."

Catatan untuk nomor 12: kalimat ini bisa dibaca sebagai janji. Coret kalau Ryan tidak mau.

## 6. Misi Harian

`MISI_LIST` bertambah dari 7 jadi **10** (maksimal 10 Bintang per hari). State lama kompatibel, karena `done` hanya objek kunci-boolean.

| id | nama | keterangan | ikon (baru di `UICONS`) |
|---|---|---|---|
| `gazebo` | Nongkrong di Gazebo | Duduk di bangku gazebo | `chair` (sudah ada) |
| `jemur` | Jemur Cucian | Angkat cucian kering dari jemuran | `baju` (baru) |
| `ibu` | Ngobrol sama Ibu Kos | Ketuk Ibu Kos lalu ngobrol | `obrol` (baru) |

Catatan: misi `jemur` hanya bisa diselesaikan penghuni, karena tamu tidak bisa memakai dapur. Untuk tamu, keterangan misinya: "Khusus penghuni". Panel misi (`#misiCard`) sudah punya `max-height`. Setelah jadi 10 baris, panel dicek di 390×844 dan 740×360 dan harus bisa digulir dengan rapi.

## 7. Pengujian

Tes otomatis (dihitung dari file, dilaporkan apa adanya):

- `tests/klien.test.js` (sekarang 27). Tes yang ditambah:
  - `mpRealmDikenal('dapur')`
  - `jemuranMuat` (JSON rusak, status asing, `sejak` di masa depan)
  - `jemuranStatus` / `jemuranSisaDetik` (batas tepat `JEMUR_DUR`)
  - `jemuranTransisi` (semua transisi sah dan tidak sah)
  - `jarakKeKotak`
  - `gazeboPilihKursi` (kursi terdekat, satu terisi, dua terisi)
  - `ibuPilihKalimat` (urutan prioritas, sapaan per jam WIB, urutan acak per hari yang deterministik)
  - `misiSelesaiDiState` dengan 3 id baru
- `tests/server.test.js` (49) dan `tests/e2e-pin.js` (46) harus tetap lulus tanpa diubah.

Cek manual dan screenshot (Playwright lokal, 390×844, 844×390, 740×360):

- Jemuran: kosong → basah (keranjang di tangan) → dijemur → kering → angkat. Muat ulang halaman di tengah status dijemur, lalu cek statusnya tetap benar.
- Gazebo: duduk di keempat bangku, lalu cek kaki tidak menembus meja dan titik bangun tidak di dalam benda padat.
- Gazebo dengan 2 browser terhubung ke broker yang sama: pemain B melihat A duduk di kursi yang benar, dan label nama mengikuti keputusan Ryan.
- Kasur di kamar: tidur, duduk, dan bangun tetap sama seperti sebelumnya (regresi `poseJangkar`).
- Ibu Kos: urutan prioritas kalimat, dan badan Ibu menghadap pemain lalu kembali.
- Performa: hitung jumlah mesh halaman sebelum dan sesudah (target +12 atau kurang), dan cek fps dengan `?bot=20` dibanding `main`.
- Yang tidak bisa saya cek: rasa di HP Ryan. Itu tetap dicoba di preview yang di-deploy Vesper.

## 8. Yang perlu diputuskan Ryan

1. **Lama jemur `JEMUR_DUR`**: usul 3 menit. Lebih lama terasa nyata, lebih pendek lebih cepat dapat Bintang.
2. **Label nama saat duduk**: usul tetap tampil (lihat 4.3).
3. **Kalimat Ibu Kos** di 5.3: disetujui, diedit, atau ditulis ulang oleh Ryan.
4. **Jarak maksimal** 3 m untuk jemuran dan gazebo: usul 3 m.

## 9. Bukan bagian ronde ini

- Masak di dapur, siram tanaman, kucing kos (bisa jadi Tahap 1b).
- Emote, chat, dan status objek bersama (Tahap 2; status bersama menunggu relay Fase B).
- Pengering yang terhubung ke status cucian.
- Hujan / cuaca.
- Menyimpan Bintang dan progres di server (Tahap 4).
- Fasilitas besar dari komentar (kolam, AC, TV, warung): tetap satu per episode.

## 10. Urutan kerja yang diusulkan

Satu PR, beberapa commit, supaya bisa ditinjau per bagian:

1. Tugas 0: `mpRealmDikenal` + tes + `MULTIPLAYER-SPEC.md`.
2. `poseJangkar` (refaktor kasur tanpa perubahan perilaku) + tes regresi.
3. Gazebo.
4. Jemuran + keranjang.
5. Ibu Kos.
6. Misi baru + ikon + cek panel misi.
7. Screenshot sebelum/sesudah, hitung mesh, dan cek fps.
