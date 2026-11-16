---
inclusion: always
---

# Konteks game: Kosan Ibu Kos

## Ini game apa

Kosan Ibu Kos bukan game menang-kalah dan bukan game kejar skor. Ini kos
virtual yang dibangun bareng penonton Instagram.

- Akun Instagram [@ibu__kos](https://www.instagram.com/ibu__kos/) bicara
  sebagai "Ibu Kos".
- Di tiap episode video, penonton mengusulkan fasilitas lewat komentar
  ("Bu, bangunin mesin cuci dong", "Bu, bikinin gazebo"). Usulan dengan like
  terbanyak benar-benar dibangun di game, lalu hasilnya ditayangkan di
  episode berikutnya. Dunianya tumbuh dari komentar orang.
- Pemainnya adalah penghuni kos. Mereka daftar pakai nama, dapat kamar
  (sekarang 20 kamar, sudah penuh), lalu bisa jalan-jalan di halaman, duduk
  di gazebo, masuk ruang tamu, masak di dapur, ketemu penghuni lain yang
  sedang online, dan naik tangga ke balkon lantai dua.
- Ada **Misi Harian** ringan dan **Bintang Kosan**: aktivitas sehari-hari
  (masuk kamar, tidur, jalan-jalan, main Lempar Sendal, dan sejenisnya)
  memberi +1 Bintang, sekali per misi per hari. Semuanya lokal di HP pemain
  dan reset tiap hari (WIB). Ryan menyetujui (14 Nov) aktivitas baru boleh
  masuk Misi Harian dan memberi Bintang.
- Misi dan Bintang adalah ajakan untuk mencoba isi kos, bukan kompetisi:
  tidak ada papan peringkat, tidak ada hadiah server, dan tidak ada musuh.
  Intinya tetap: punya kamar, punya tetangga, dan melihat kosnya makin lama
  makin jadi.
- **Rupiah (Kerja & Belanja, disetujui Ryan 16 Nov):** penghuni bisa kerja
  (barista di Kedai Kopi, jaga warung, ronda malam, laundry kiloan) dan
  dapat Rupiah virtual untuk jajan kopi, aksesori, dekor kamar, dan uang kos
  sukarela (cap LUNAS di KTA). Rupiah disimpan dan dihitung di **server**
  (Supabase, hanya penghuni; tamu cuma latihan tanpa gaji); sengaja tidak
  terlalu mudah (3 shift sehari, jeda 10 menit). **Bintang Kosan tetap
  lokal** di HP. Rupiah tidak pernah memengaruhi kepemilikan kamar dan tetap
  tanpa papan peringkat. Aturan + runbook: `docs/KERJA-BELANJA.md`.

## Aturan menambah isi dunia

- **Fasilitas besar** (misalnya kolam, AC, TV, warung) hanya muncul setelah
  menang di komentar penonton dan dibangun di episode, satu per episode.
  Pengecualian hanya perintah langsung Ryan (contoh: warung Jalan Kampung,
  Kedai Kopi untuk kerja 16 Nov). Area palang "SEGERA DIBUKA" tetap
  dicadangkan untuk voting penonton.
- **Benda kecil pendukung aktivitas** yang sudah disetujui (misalnya
  keranjang cucian, menu masak, kucing kos) boleh ditambah langsung.

## Yang dijaga saat mengetes atau mengubah game

Jaga perasaan "kos yang hidup dan aman". Game ini harus terasa seperti rumah
kedua, bukan arena.

- Penghuninya orang beneran. Nama mereka nama Instagram, dan kamar mereka
  sudah ditempati. Kalau ada yang rusak, yang rusak itu rumah orang.
- Nama Instagram adalah identitas penghuni di kos ini. Jangan menyuruh
  penghuni menyembunyikan atau mengganti nama. Peringatan yang benar soal
  visibilitas: nama yang diketik akan muncul di atas kepala pemain, di depan
  semua pemain online.
- Jangan pernah mengubah data penghuni atau kamar yang sudah ditempati
  sebagai efek samping perubahan lain.

## Prioritas keamanan

Celah yang merusak rasa aman penghuni sama pentingnya dengan celah yang
merusak game:

- menyamar jadi tetangga (memakai identitas pemain lain),
- menghilangkan avatar orang lain,
- nama kasar atau pelecehan yang tampil ke penghuni.

Menutup celah ini butuh keputusan arsitektur (broker ber-login, server
perantara, atau filter + tombol lapor). Bahas sebagai ronde tersendiri,
jangan dicampur ke perbaikan lain.
