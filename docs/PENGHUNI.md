# PENGHUNI — Runbook Denah Bersama Kosan Ibu Kos

> **Aturan keras (perintah pemilik 7 Nov 19:16): klaim publik dengan nama ngasal
> DILARANG — "rusak nanti jadinya".** Denah bersama HANYA menampilkan nama yang
> ada di objek `RESIDENTS` di `web/app.js`. Tidak ada jalur tulis apa pun dari
> publik ke situs ini (situs 100% statis, tanpa backend/database).

## Cara kerja (2 kebenaran, tidak pernah bertentangan)

| | Denah bersama | Preview pribadi |
|---|---|---|
| **Sumber** | `RESIDENTS` di `web/app.js` (baked-in, ikut deploy) | Hash FNV-1a dari nama, dihitung lokal di HP pengunjung |
| **Siapa yang menulis** | Hanya Vesper, lewat deploy, atas perintah pemilik | Tidak ada yang menulis — murni hitungan lokal |
| **Yang terlihat** | Nama penghuni di tombol kamar + panel detail, buat SEMUA pengunjung | Kartu + highlight kuning, HANYA di HP pengunjung itu |
| **Tulisan di kartu** | `KARTU PENGHUNI RESMI` / stempel `RESMI PENGHUNI` | `KARTU PREVIEW KAMAR` / stempel `PREVIEW` |

## Kapan penghuni ditempatkan

HANYA setelah orangnya tampil di episode (komen/follow) **dan** pemilik
memerintahkan penempatannya (atau Vesper menempatkan sebagai tindak lanjut
episode yang sudah disetujui pemilik — mis. absen penghuni di Episode 3).
**Jangan pernah** menempatkan nama dari form situs, dari deep link `?nama=`,
atau nama ngasal tanpa episode.

## Cara menempatkan penghuni baru

1. **Hitung kamar hash-nya** (nama yang sama = kamar yang sama):
   ```bash
   node -e "const n='Budi Santoso';const s=n.trim().toLowerCase().replace(/\s+/g,' ');let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}console.log('Kamar '+(h%10)+1)"
   ```
2. **Edit `web/app.js`**, objek `RESIDENTS` (baca blok komentar di atasnya):
   ```js
   var RESIDENTS = {
     3: 'Budi Santoso',
   };
   ```
   - Pakai kamar hash kalau masih kosong.
   - Kalau kamar hash sudah ditempati penghuni lain, pakai kamar kosong
     berikutnya (1..10). **Jangan pernah menimpa penghuni lain.**
   - Nama ditulis persis seperti di episode (kapitalisasi asli).
3. **Cek sintaks + logika:**
   ```bash
   cd ~/workspace/kosan-ibu-kos/web && node --check app.js
   cd /tmp/kosan-test && node run2.mjs   # 50 cek (preview, lookup, tabrakan, penuh, XSS)
   ```
   Untuk mengetes dengan penghuni baru, `run2.mjs` memakai injeksi
   `RESIDENTS` dari file produksi — tidak perlu mengubah file produksi
   untuk tes.
4. **Deploy** (daftar berkas eksplisit — file baru WAJIB masuk daftar):
   ```bash
   cd ~/workspace/kosan-ibu-kos/web
   python3 ~/workspace/skills/vercel/bin/vercel_deploy.py deploy . kosan-ibu-kos \
     app.js index.html style.css \
     assets/batik-strip.svg assets/favicon.png assets/hero.jpg assets/ibu-kos.webp assets/og.jpg \
     fonts/Baloo2-600.woff2 fonts/Baloo2-700.woff2 fonts/Baloo2-800.woff2 fonts/Caveat-700.woff2 \
     fonts/Nunito-400.woff2 fonts/Nunito-700.woff2 fonts/Nunito-800.woff2 fonts/Nunito-900.woff2 \
     fonts/fonts-local.css vendor/confetti.min.js vendor/html2canvas.min.js
   ```
5. **Verifikasi live** (jangan klaim selesai sebelum ini lolos):
   ```bash
   CB=$(date +%s)
   for f in app.js style.css index.html; do
     curl -s "https://kosan-ibu-kos.vercel.app/$f?cb=$CB" | md5sum
     md5sum "$f"
   done   # MD5 live HARUS sama dengan lokal
   curl -s "https://kosan-ibu-kos.vercel.app/app.js?cb=$CB" | grep -ci "firebase\|gstatic"  # HARUS 0
   curl -s "https://nobar-7a37d-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/kosan-ibu-kos/members.json"  # HARUS null
   ```
   Lalu buka webnya: denah harus menampilkan nama penghuni baru di kamarnya.

## Cara mencopot penghuni

Hapus barisnya dari `RESIDENTS` → `node --check` → deploy → verifikasi live
(langkah 4–5 di atas). Kamar kembali "Masih kosong".

## Yang TIDAK dilakukan di sini

- **Isi kamar** (fasilitas/perk) tetap diatur aturan format: fasilitas baru
  muncul di web HANYA setelah dibangun di episode. Menempatkan penghuni
  TIDAK menambahkan fasilitas apa pun ke kamarnya.
- **WiFi** tetap TIDAK muncul di web sampai Episode 2 tayang — WiFi tinggal
  di Ruang Tamu, bukan di kamar.
- **Ruang Tamu** bukan kamar: tidak masuk `RESIDENTS`, tidak bisa diklaim,
  tidak bisa jadi kamar siapa pun.

## Sisa lubang: rules RTDB (butuh console pemilik — situs sudah aman tanpanya)

Situs sudah TIDAK LAGI memakai Firebase/RTDB sama sekali (nol referensi di
kode live). Tapi rules RTDB proyek `nobar-7a37d` masih mengizinkan tulis
publik ke `/rooms/$kode/members` — jadi secara teori siapa pun masih bisa
menulis sampah ke path `/rooms/kosan-ibu-kos/members` lewat REST langsung.
**Saat ini tidak berbahaya** (tidak ada yang membaca path itu), tapi
sebaiknya dikunci. Lihat `AUDIT-WEB-2026-11-07.md` bagian "Yang tidak bisa
diperbaiki agent" untuk JSON rules + langkah console yang persis.
