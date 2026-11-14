# Kosan Ibu Kos

Kos virtual yang dibangun bareng penonton Instagram [@ibu__kos](https://www.instagram.com/ibu__kos/).
Di tiap episode video, penonton mengusulkan fasilitas lewat komentar; usulan dengan
like terbanyak benar-benar dibangun di game, lalu hasilnya ditayangkan di episode
berikutnya. Tidak ada misi dan tidak ada musuh — intinya: punya kamar, punya
tetangga, dan melihat kosnya makin lama makin jadi.

**Live:** https://kosan-ibu-kos.vercel.app/

## Keadaan sekarang

- 20 kamar, **sudah penuh** — penghuninya orang beneran, nama mereka nama
  Instagram. Jangan pernah mengubah, memindahkan, atau menghapus penghuni
  terdaftar sebagai efek samping perubahan lain.
- Gedung A + B (modern, 26×10 m), halaman, gazebo, parkiran, jemuran, ruang
  tamu, dapur, balkon lantai dua dengan tangga beton terbuka.
- Multiplayer lewat MQTT (broker publik EMQX/HiveMQ). Tamu boleh masuk dan
  jalan-jalan; hanya penghuni (pakai kode kunci + PIN) yang boleh masuk ruangan.
- Keamanan multiplayer (13 Nov 2026): celah id `__proto__` ditutup, token bucket
  anti-banjir, dispose geometri avatar, mqtt.js di-vendor, header CSP.
  Bukti: unit 38/38, regresi 66/66, review ✅ Approved, playtest dua tab 12/12.

## Struktur

| File / direktori | Isi |
| --- | --- |
| `index.html` | Game-nya (modul inline ~248 KB) |
| `kosan-3d.html` | Redirect ke `/` |
| `vendor/mqtt/` | mqtt.js 5.10.1 lokal (di-vendor, tanpa CDN unpkg) |
| `vercel.json` | Header keamanan (CSP, nosniff, anti-iframe). Kalau menambah sumber eksternal baru (script/broker), daftarkan di CSP di sini |
| `docs/MULTIPLAYER-SPEC.md` | Spek multiplayer |
| `api/` | Vercel Functions login penghuni + PIN kamar (rasa aman Fase A). `api/_lib/` bukan endpoint |
| `supabase/migrations/` | SQL tabel + fungsi baru (dijalankan manual di SQL Editor) |
| `tests/` | Tes server (`node --test tests/server.test.js`) + playtest browser; tidak di-deploy |
| `docs/RASA-AMAN-DESAIN.md`, `docs/RASA-AMAN-FASE-A.md` | Desain ronde rasa aman + runbook deploy Fase A |
| `.kiro/steering/konteks-game.md` | Konteks game (dimuat di setiap sesi Kiro) |

## Deploy

Proyek Vercel ini **tidak punya integrasi Git** — merge ke `main` TIDAK
auto-deploy. Deploy dilakukan manual lewat API Vercel (`vercel_deploy.py`),
dengan daftar file eksplisit (20 file, termasuk `vendor/mqtt/mqtt.min.js` dan
`vercel.json`). Sesudah deploy, verifikasi sha live = sha lokal.
Sejak rasa aman Fase A, daftar itu wajib ditambah 10 file `api/` (termasuk `api/_lib/`) + env var
Vercel (lihat `docs/RASA-AMAN-FASE-A.md`).

Berkas yang benar-benar dipakai game saat runtime (audit Fase A, O1):
`index.html`, `kosan-3d.html` (redirect), `vercel.json`,
`vendor/three/three.module.js`, `vendor/html2canvas.min.js`,
`vendor/mqtt/mqtt.min.js`, `fonts/fonts-local.css` + 8 `fonts/*.woff2`,
`assets/favicon.png`, `assets/og.jpg`, dan 10 berkas `api/`.
**`vendor/three/OrbitControls.js` TIDAK perlu di-deploy** (tidak dipakai
sejak ronde 7, hanya disebut di komentar). `app.js`, `style.css`,
`vendor/confetti.min.js`, `assets/batik-strip.svg`, `assets/hero.jpg`,
`assets/ibu-kos.webp` juga tidak dirujuk game (sisa web lama); berkasnya
dibiarkan di repo karena masih dirujuk dokumen riwayat.

## Aturan kerja

- Gedung baru (C/D/E) hanya dibuka atas perintah pemilik.
- Video episode tidak diposting sebelum pemilik menonton dan menyetujui videonya.
- Peringatan nama soal visibilitas, bukan menyuruh ganti nama: nama yang diketik
  muncul di atas kepala pemain, di depan semua pemain online.
