# Kosan 3D — Fase 1 (Jalan-jalan) — Spec

> Disetujui pemilik 7 Nov 2026 21:49 ("gas kalo gitu") atas rencana 3 fase di chat.
> Model: kampus 3D @sekolahbebaz (sekolahbebaz.pages.dev) — vanilla JS + Three.js
> self-hosted, satu file HTML. Diverifikasi langsung oleh pemilik: bisa dimainin semua.

## Tujuan

Satu halaman baru, `web/kosan-3d.html`, berisi dunia 3D Kosan yang bisa
dijelajahi pakai karakter — meniru pola sekolahbebaz, tapi dengan gaya dan
aturan Kosan. BUKAN pengganti web yang ada; halaman tambahan yang nantinya
ditautkan dari `index.html` HANYA setelah vonis pemilik atas preview.

## Aturan tetap (tidak boleh dilanggar)

1. **Situs 100% statis, tanpa Firebase, tanpa klaim tulis publik** (veto pemilik
   7 Nov 19:16 + audit 19:28). Tidak ada penulisan data bersama dari halaman ini.
2. **Nama → kamar HARUS sama persis dengan web yang ada.** Port fungsi dari
   `web/app.js` apa adanya (lihat "Kebenaran kamar" di bawah). Nama sama =
   kamar sama. Kartu tetap jujur: "KARTU PREVIEW KAMAR" + "belum tercatat"
   kalau bukan penghuni beneran.
3. **Penghuni di dunia 3D HANYA yang ada di `RESIDENTS` baked-in** (saat ini
   KOSONG — jadi semua kamar tampil "Masih kosong"). Pengunjung yang
   jalan-jalan adalah avatar TAMU, bukan penghuni; tidak ada yang bisa
   mengklaim kamar lewat halaman ini.
4. **Fasilitas baru muncul HANYA setelah dibangun di episode.** Saat ini yang
   boleh tampil: gedung kosan, 10 kamar, halaman, ruang tamu + WiFi (router,
   sinyal penuh — dibangun di Ep2 v6, tayang 7 Nov 20:17). TIDAK ada fasilitas
   lain (tidak ada kolam, warung, dsb.).
5. **Gaya visual = video Kosan:** siang terang, gedung BIRU TERANG 2 lantai,
   papan "KOSAN DIBUKA", karakter CHIBI BULAT (kepala besar bulat, badan
   pendek gemuk — BUKAN kotak), shading + bayangan lembut. Jangan redesain
   wajah/badan karakter. Standar hero pemilik: jangan kirim versi kotak polos
   vertex-color dulu — langsung kualitas final.
6. **Mobile-first (HP pemilik).** D-pad layar, drag putar kamera, zoom. Harus
   jalan mulus di HP; batasi pixel ratio, geometri sederhana, material
   dipakai ulang.
7. **File BARU, jangan timpa yang ada.** `kosan-3d.html` baru; `index.html`
   dan `app.js` TIDAK diubah di Fase 1 (tautan dari index ditambahkan
   SETELAH vonis pemilik, di tugas terpisah).

## Kebenaran kamar (port persis dari web/app.js)

```js
function normalize(nama) {
  return nama.trim().toLowerCase().replace(/\s+/g, ' ');
}
function roomFor(nama) {
  var s = normalize(nama), h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 10) + 1;
}
function makeId(nama, room) {
  var clean = normalize(nama).replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase();
  while (clean.length < 4) clean += 'X';
  return 'KOSAN-' + String(room).padStart(2, '0') + '-' + clean;
}
```

`previewFor(nama)`: (a) nama ada di RESIDENTS → kamar tercatatnya;
(b) kamar hash kosong → kamar itu; (c) kamar hash dihuni → kamar kosong
berikutnya (1..10); (d) penuh → null. RESIDENTS saat ini `{}` (kosong).
Nama pengunjung disimpan HANYA di localStorage browser sendiri.

## Fitur Fase 1 (v1 — hanya ini, tidak lebih)

1. **Dunia 3D siang:** gedung kosan biru 2 lantai + papan "KOSAN DIBUKA",
   halaman + jalan setapak + pagar, ruang tamu (area bersama, meja + router
   putih 2 antena + LED hijau), 10 pintu kamar bernomor 1–10 (5 lantai 1,
   5 lantai 2 — sesuai denah web: lantai 1 = kamar 1–5, lantai 2 = 6–10).
   Langit biru cerah, matahari + bayangan lembut.
2. **Mode jalan-jalan:** kamera orang-ketiga di belakang avatar chibi.
   D-pad layar (▲◀▶▼) menggerakkan karakter (maju/mundur/belok, kamera
   mengikuti); drag di layar memutar kamera; tombol zoom +/−; keyboard
   WASD/panah di desktop. Avatar berlabel nama yang diketik (default "kamu").
3. **Nama → kamar:** kolom "Ketik namamu" (sama seperti web). Setelah isi,
   avatar berlabel nama itu + kartu preview muncul: nomor kamar + ID
   (format KOSAN-XX-XXXX) + stempel PREVIEW + "belum tercatat" (kecuali
   penghuni beneran). Tombol "Lihat kamarku" menggerakkan kamera ke pintu
   kamar itu.
4. **Klik gedung/kamar:** klik pintu kamar → kartu kamar (nomor, status
   "Masih kosong" / nama penghuni beneran kalau ada di RESIDENTS). Klik
   ruang tamu → kartu: "Tempat kumpul semua penghuni — nonton bareng,
   ngobrol, numpang WiFi. 📶 Router baru terpasang di sini, sinyal penuh,
   internetnya ngebut! WiFi kenceng — request terbanyak di Episode 2, Ibu
   bangun buat semua penghuni." Klik Ibu Kos (avatar di halaman) → kartu
   profil singkat Ibu Kos.
5. **HUD:** judul "Kosan Ibu Kos — Jalan-jalan", penghitung kecil (10 kamar,
   "X kosong"), tombol kembali ke web utama (link ke index.html),
   tombol "Misi" dan "KTA" tampil tapi NONAKTIF dengan label "segera hadir"
   (Fase 2 — jangan dibangun sekarang).
6. **Tanpa login, tanpa analytics, tanpa pengiriman data.** Semua lokal.

## Teknologi

- Vanilla JS + Three.js 0.160.0 self-hosted (ikuti pola referensi):
  importmap `"three" → ./vendor/three/three.module.js`,
  `"three/addons/controls/OrbitControls.js" → ./vendor/three/OrbitControls.js`.
- Satu file HTML (`kosan-3d.html`) + 2 file vendor. Tanpa framework, tanpa
  build step. Font yang sama dengan web (Baloo 2 / Nunito lokal kalau bisa
  dipakai ulang dari fonts/; kalau ribet, font sistem dulu — jangan unduh
  font baru dari internet saat runtime).
- Geometri prosedural Three.js (Box/Capsule/Cylinder/Sphere + CanvasTexture
  untuk papan nama/teks). TIDAK ada model GLB di Fase 1.

## Bukan bagian Fase 1 (jangan dibangun)

Misi harian, mini game, hook kosmetik (Kunci Kamar, hoodie, dsb.), KTA
interaktif, counter live server, chat, multiplayer, suara/musik. Itu Fase 2.

## Gerbang mutu (sebelum diserahkan ke pemilik)

1. `node --check` pada modul JS yang diekstrak (atau pemeriksaan sintaks
   setara) lolos.
2. Halaman dimuat tanpa error console di browser sungguhan; dunia 3D tampil.
3. Playtest: avatar BENERAN bergerak (D-pad + drag + zoom), klik kamar
   membuka kartu yang benar, ketik nama "Budi Santoso" → Kamar 3 +
   ID KOSAN-03-BUDI (cocok dengan web yang ada).
4. Cek HP 390px (layout D-pad + HUD tidak menutupi layar).
5. Deploy preview TANPA tautan dari index.html; produksi tidak berubah
   untuk pengunjung.
