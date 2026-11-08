# Kosan 3D Fase 1 — Build Notes

> Dibangun 7 Nov 2026 (sore) dari `KOSAN-3D-SPEC.md` + `KOSAN-3D-PLAN.md`
> (Task 1–6 selesai). BELUM di-deploy, BELUM ditautkan dari `index.html`.
> Parent yang deploy preview + playtest di browser sungguhan.

## File yang dibuat (baru semua — `index.html` / `app.js` TIDAK disentuh)

| File | Isi / ukuran |
|---|---|
| `web/vendor/three/three.module.js` | Three.js 0.160.0 dari `unpkg.com/three@0.160.0/build/three.module.js` — 1.272.972 byte, `WebGLRenderer` muncul 45x |
| `web/vendor/three/OrbitControls.js` | OrbitControls 0.160.0 dari `unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js` — 29.868 byte, `class OrbitControls` 1x, `from 'three'` 1x (diselesaikan importmap) |
| `web/kosan-3d.html` | Satu file HTML (34.694 byte): vanilla JS + Three.js, importmap persis seperti spek, HUD + dunia + avatar + kartu |
| `KOSAN-3D-BUILD-NOTES.md` | File ini |

## Yang ada di halaman

- **Dunia siang:** langit biru + kabut jauh, matahari DirectionalLight
  (bayangan lembut, shadow map 1024) + HemisphereLight. Tanah hijau 140×140,
  jalan setapak batu dari gerbang ke gedung, pagar putih keliling (celah
  gerbang di selatan), 3 pohon, 1 bangku, 3 awan.
- **Gedung biru terang 2 lantai** (24×7×8 m): lis putih antar lantai, atap
  datar + parapet, papan "KOSAN DIBUKA" (CanvasTexture, teks putih di biru
  gelap, pakai 2 tiang), jendela kaca hangat di antara pintu.
- **10 pintu kamar bernomor** (CanvasTexture angka 1–10): lantai 1 kamar 1–5
  di fasad depan, lantai 2 kamar 6–10 di atas balkon (slab + pagar + 2 kolom).
  Tiap pintu tercatat di `ROOM_DOORS[n]` (mesh + posisi).
- **Ruang tamu:** teras di sisi kanan depan gedung (x 13–19, z −5–1) — karpet
  merah, meja kayu rendah, **router putih 2 antena + LED hijau**, 2 bantal
  duduk, papan kecil "RUANG TAMU". (Interpretasi: "di sisi pintu depan"
  dari spec = teras di samping fasad depan; tidak ada pintu utama terpisah
  di fasad karena 5 pintu kamar sudah memenuhi lebar fasad.)
- **Avatar chibi bulat** (kepala besar bulat, badan pendek gemuk — BUKAN
  kotak): pengunjung = topi biru + baju merah + celana abu-abu (sesuai
  avatar tes referensi), label nama sprite di atas kepala (default "kamu").
  **Ibu Kos** statis di dekat teras: konde + uban, daster biru, celemek
  oranye, menghadap halaman.
- **Kontrol:** D-pad layar (tahan ▲ maju, ◀/▶ belok, ▼ mundur; ~3 m/dtk),
  drag = orbit kamera (OrbitControls, target mengikuti avatar tiap frame),
  tombol zoom +/− (jarak 6–20 m), WASD/panah + wheel di desktop.
  Avatar tidak bisa menembus dinding gedung (AABB push-out, radius 0,4 m),
  meja ruang tamu, atau pagar (kotak halaman x ±19, z −17..17).
- **Nama → kamar:** kolom "Ketik namamu" + tombol. Fungsi
  `normalize`/`roomFor`/`makeId`/`previewFor` disalin **persis** dari
  `web/app.js` (dicek: identik setelah dedent — app.js membungkusnya dalam
  IIFE sehingga indentasi beda 2 spasi, isi/konstanta/urutan sama).
  `RESIDENTS = {}` (kosong) → semua kamar "Masih kosong". Kartu preview:
  nomor kamar + ID + stempel "PREVIEW" + "belum tercatat"; tombol
  "Lihat kamarku" menerbangkan kamera ke pintu kamar itu. Nama disimpan
  HANYA di `localStorage` browser sendiri (`kosan3d-nama`) dan dipulihkan
  saat muat ulang.
- **Klik (raycast, ketuk <10px & <1000ms — dilonggarkan 7 Nov, lihat
  "Perbaikan playtest"):** pintu → kartu kamar itu (nomor +
  status; kalau itu kamar preview-mu, ditandai); karpet/meja/router/bantal
  ruang tamu → kartu WiFi dengan teks perk persis dari spec/app.js; Ibu Kos
  → kartu profil singkat. Pintu yang diklik berdenyut kuning 700 ms.
- **HUD:** judul + penghitung "10 kamar · 10 kosong", tombol "← Web Utama"
  (link ke `index.html`), tombol **Misi** dan **KTA** nonaktif (`disabled`)
  berlabel "segera hadir" (Fase 2 — TIDAK dibangun). Font lokal dipakai
  ulang (`fonts/fonts-local.css`: Baloo 2 / Nunito).
- **Bukan Fase 1 (sengaja tidak ada):** misi, mini game, hook kosmetik, KTA
  interaktif, counter live, chat, multiplayer, suara. Tidak ada Firebase,
  tidak ada analytics, tidak ada `fetch`/XHR, tidak ada login.

## Cara deploy-preview (untuk parent)

Halaman ini file statis biasa — ikut ter-deploy kalau folder `web/` di-deploy
utuh. Perintah yang sama seperti deploy web biasa, tambah 3 file baru:

```bash
python3 ~/workspace/skills/vercel/bin/vercel_deploy.py deploy . kosan-ibu-kos \
  app.js index.html kosan-3d.html style.css \
  assets/batik-strip.svg assets/favicon.png assets/hero.jpg assets/ibu-kos.webp assets/og.jpg \
  fonts/Baloo2-600.woff2 fonts/Baloo2-700.woff2 fonts/Baloo2-800.woff2 fonts/Caveat-700.woff2 \
  fonts/Nunito-400.woff2 fonts/Nunito-700.woff2 fonts/Nunito-800.woff2 fonts/Nunito-900.woff2 \
  fonts/fonts-local.css vendor/confetti.min.js vendor/html2canvas.min.js \
  vendor/three/three.module.js vendor/three/OrbitControls.js
```

Lalu buka `https://kosan-ibu-kos.vercel.app/kosan-3d.html`.
JANGAN tautkan dari `index.html` sebelum vonis pemilik (tugas terpisah).

Preview lokal tanpa deploy juga bisa (butuh server HTTP statis karena ES
module + importmap tidak jalan dari `file://`):

```bash
cd ~/workspace/kosan-ibu-kos/web && python3 -m http.server 8130
# buka http://localhost:8130/kosan-3d.html
```

## Verifikasi yang sudah dilakukan (node, tanpa browser)

- `node --check` pada modul JS yang diekstrak dari `kosan-3d.html` → **lolos**.
- Importmap JSON valid; kedua target vendor ada dan ukurannya benar.
- Semua 15 id HUD ada (`hud-title`, `nameInput`, `nameBtn`, `roomCard`,
  `dpad`/`dUp`/`dDown`/`dLeft`/`dRight`, `zoomIn`/`zoomOut`, `backLink`,
  `misiBtn`, `ktaBtn`).
- Fungsi kamar (blok murni diekstrak dari HTML, dijalankan di node):
  `roomFor("Budi Santoso") = 3` ✓, `makeId("Budi Santoso", 3) =
  "KOSAN-03-BUDI"` ✓, `previewFor("Budi Santoso").room = 3` ✓,
  normalisasi spasi/kapital ✓, `makeId("A",1) = "KOSAN-01-AXXX"` ✓,
  aturan (c) fall-through: kamar hash 3 dihuni → preview pindah ke kamar 1
  dengan `moved=true` ✓.
- Logika gerak (fungsi murni `moveStep`, simulasi per-frame dt=0,05 seperti
  di `animate`): maju 1 dtk dari gerbang → z 12→9, x tetap 0 ✓; belok kiri
  lalu maju → x negatif, z positif ✓; jalan ke gedung 10 dtk → berhenti di
  z=−5,0 (muka dinding −5,4 + radius 0,4), tidak tembus ✓; jalan ke
  pagar selatan/timur → berhenti di z=17 / x=19 ✓; menabrak sisi gedung →
  berhenti x=12,8 ✓; meja ruang tamu → berhenti z=−0,8 (dari selatan) /
  z=−3,2 (dari utara) ✓.
- Parser HTML: tidak ada tag tak tertutup / error.
- `index.html` (mtime 7 Nov 11:23) dan `app.js` (mtime 7 Nov 12:18) tidak
  berubah.

## Batasan / hal yang masih perlu diverifikasi di browser sungguhan

1. **Render 3D + error console** — belum dibuka di browser sama sekali.
   Cek: dunia tampil, tidak ada error console, importmap + vendor termuat.
2. **Gerak nyata** — D-pad benar-benar menggerakkan avatar (bukan cuma
   kamera), kamera mengikuti, drag memutar kamera, zoom +/− bekerja.
   (Logika geraknya sudah lolos uji node di atas; yang belum dibuktikan
   adalah wiring DOM → Three.js di browser.)
3. **Klik kartu** — ketuk pintu kamar 3 membuka kartu Kamar 3 (bukan
   tetangga), ketuk router/meja membuka kartu WiFi, ketuk Ibu Kos membuka
   kartu profil. Raycast di HP (touch) belum dites.
4. **Nama → kamar end-to-end** — ketik "Budi Santoso" → kartu Kamar 3 +
   ID KOSAN-03-BUDI, label avatar berubah, "Lihat kamarku" menerbangkan
   kamera ke pintu 3. (Fungsi di baliknya sudah lolos uji node.)
5. **Layout HP 390px** — D-pad + HUD + kartu tidak menutupi tengah layar;
   kartu bottom sheet menggeser D-pad/zoom ke atas (class `card-open`).
   Belum dicek visual.
6. **Performa HP** — pixel ratio dibatasi 2, material/geometri dipakai ulang,
   shadow map 1024, satu DirectionalLight berbayang. Tetap perlu cek FPS
   nyata di HP pemilik (target mulus, bukan angka pasti).
7. **Font CanvasTexture** — teks papan/label digambar dengan "Baloo 2";
   kalau font lokal belum termuat saat canvas digambar, fallback ke
   sans-serif (masih terbaca, tapi kurang khas). Kalau terlihat jelek,
   gambar ulang tekstur setelah `document.fonts.ready`.
8. **Arah hadap avatar** — model menghadap +z lokal; rotasi dihitung
   `yaw + π` agar muka mengikuti arah jalan. Cek visual: saat maju ke
   gedung, muka avatar harus menghadap gedung (bukan punggung).
9. **Tombol Misi/KTA** — tampil nonaktif "segera hadir"; pastikan tidak
   bisa diklik (atribut `disabled` sudah dipasang).
10. **Satu cacat kecil yang diketahui (bukan bug):** jendela kaca hanya 0,01 m
    di depan bingkai putih — di sudut pandang miring ekstrem bisa berkedip
    (z-fighting ringan). Kalau terlihat di playtest, geser kaca ke −5,90.

---

## Perbaikan playtest 7 Nov 22:01–23:37 (4 bug dari browser sungguhan)

Diperbaiki di `web/kosan-3d.html` saja. `index.html` / `app.js` TIDAK
disentuh, tidak di-deploy. Verifikasi: `node --check` modul yang diekstrak
→ lolos; skrip `/tmp/kosan3d-fix-verify.js` (mengextrak handler + fungsi
ASLI dari file, lalu mensimulasikan) → **19/19 lolos**; fungsi kamar
diuji ulang: `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`,
`previewFor.room = 3` ✓.

### Bug 1 — FIXED: huruf WASD hilang saat mengetik nama
- **Akar:** handler global `window keydown/keyup` untuk KEYMAP memanggil
  `e.preventDefault()` tanpa memeriksa fokus — huruf w/a/s/d tidak masuk
  ke kolom ("Budi Santoso" → "Bui ntoo" → Kamar 8 yang salah).
- **Perbaikan** (`kosan-3d.html`, kedua handler `window keydown`/`keyup`):
  return langsung kalau `e.target` adalah INPUT atau TEXTAREA
  (`e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')`).
  Logika keys di luar input tidak berubah.
- **Verifikasi (node, handler asli diekstrak dari file):** simulasi ketik
  "Budi Santoso" di input → utuh, tidak ada huruf hilang; KeyW/KeyA di
  luar input tetap set `keys.up`/`keys.left` + preventDefault; keyup KeyW
  di input tidak menyentuh state keys.

### Bug 2 — FIXED (defensif): papan "KOSAN DIBUKA" polos tanpa teks
- **Gejala:** di semua screenshot playtest, papan di atap tampak biru tua
  polos (bg #1b4f8a ter-render, teks putih tidak ada), padahal nomor pintu
  (fungsi `textTexture` yang sama) terlihat.
- **Perbaikan** (`kosan-3d.html`):
  (a) `textTexture` di-refactor: isi gambar dibungkus `draw()` +
  `tex.userData.redraw` (gambar ulang di canvas yang sama +
  `needsUpdate = true`); setelah `document.fonts.ready`, tekstur papan
  digambar ulang — kalau penyebabnya font web belum siap saat canvas
  pertama digambar, ini memperbaikinya.
  (b) Material papan jadi `side: THREE.DoubleSide` (antisipasi orientasi).
  (c) Mode debug: URL `?debug=sign` menampilkan canvas tekstur papan
  sebagai `<img>` berbingkai merah di atas halaman (isi canvas langsung
  terlihat — membedakan masalah canvas/font vs masalah 3D/material).
  Ukuran/posisi/warna papan TIDAK diubah (PlaneGeometry 13×2,03 di
  (0, 8,6, −5,7), bg #1b4f8a).
- **Verifikasi:** node --check lolos; grep memastikan redraw + DoubleSide +
  fonts.ready + debug=sign ada; papan tidak berubah ukuran/posisi/warna.
  **Parent masih perlu cek visual di browser:** buka
  `kosan-3d.html?debug=sign` — kalau `<img>` merah menampilkan teks
  "KOSAN DIBUKA" tapi papan 3D tetap polos, penyebabnya di sisi 3D
  (bukan canvas); kalau `<img>`-nya juga polos, penyebabnya di canvas/font.

### Bug 3 — BELUM KETEMU (dari kode): kotak biru muda polos menutupi fasad lantai atas saat kartu terbuka
- **Gejala:** kotak biru muda polos besar menutupi sebagian fasad lantai
  atas (area kamar 7–9) SAAT kartu kamar terbuka; hilang saat kartu ditutup.
- **Audit kode (semua yang berubah saat `openCard()` / `submitName()`):**
  - `openCard()` hanya: `cardEl.classList.add('open')` +
    `document.body.classList.add('card-open')`. Efek CSS-nya hanya tiga:
    `#dpad` naik ke `bottom: 226px`, `#zoombox` naik ke `bottom: 226px`,
    `#hint` jadi `display: none`. Tidak ada elemen lain yang berubah.
  - `submitName()` selain itu hanya: `previewFor` (fungsi murni, tidak
    menyentuh DOM/3D), `spawnAvatar` → `setLabel` (gambar ulang canvas
    label — lihat di bawah), `localStorage.setItem`, `showRoomCard`
    (isi `innerHTML` kartu + `openCard()`). `flyToDoor` hanya jalan kalau
    tombol "Lihat kamarku" diklik — `submitName` selalu dipanggil dengan
    `fly=false`.
  - Satu-satunya penugasan `.style.` di seluruh file adalah `<img>` debug
    Bug 2 (hanya aktif dengan `?debug=sign`).
- **Kandidat yang sudah diperiksa + dicoret:**
  1. `#roomCard` — DICORET. Putih (`background: #fff`), bottom sheet
     (`bottom: 12px`, `max-height: 210px`, `max-width: 480px`, terpusat).
     Secara posisi tidak bisa menutupi fasad lantai atas (tengah-atas
     layar); secara warna bukan biru muda.
  2. `#dpad` / `#zoombox` yang naik saat kartu terbuka — DICORET.
     Sekumpulan tombol putih kecil (~184×120 px) di kiri/kanan bawah,
     bukan kotak biru muda besar.
  3. `#hint` — DICORET. Malah HILANG saat kartu terbuka
     (`body.card-open #hint { display: none; }`).
  4. Sprite label nama (2,4×0,6 m, transparan) — DICORET. `setLabel`
     hanya `clearRect` + `strokeText`/`fillText` di atas canvas transparan;
     tidak ada `fillRect` warna; sprite kecil, tidak bisa jadi kotak besar
     buram.
  5. `pulseDoor` (denyut kuning pintu yang diklik) — DICORET. Hanya
     mengubah `emissive` material pintu yang diklik itu sendiri (tiap
     pintu punya instance material sendiri, tidak ada cross-talk), warna
     kuning, ukuran pintu 1,3×2,4 m.
  6. Mesh 3D lain — DICORET. Tidak ada mesh yang muncul/bergerak/berubah
     saat kartu dibuka; semua mesh dunia statis sejak `buildWorld()`.
  7. Tombol "Lihat kamarku" (`#goRoomBtn`, biru #2E7FD6) — DICORET.
     Tombol kecil DI DALAM kartu putih, bukan menutupi fasad.
- **Sisa hipotesis (tidak bisa dibuktikan dari kode):**
  (a) Artefak compositing browser otomasi: region kanvas WebGL tidak
  ter-repaint saat DOM berubah (kartu dibuka → composite ulang), sehingga
  background body `#8ec9ee` (biru muda) terlihat menembus — bentuknya
  kotak polos, korelasinya persis dengan buka/tutup kartu. Ini satu-satunya
  permukaan biru muda polos sebesar itu selain langit 3D.
  (b) Langit 3D (`scene.background` #8ec9ee) yang terlihat karena kamera
  sempat melihat ke area kosong — tapi ini tidak menjelaskan korelasi
  dengan kartu, kecuali kalau kemunculannya bersamaan dengan fly-to.
  (c) Back-face papan (FrontSide, dari belakang tak terlihat) sehingga
  langit tembus — tapi papan ada di atas (y 7,6–9,6), bukan area kamar 7–9,
  dan tidak berubah saat kartu dibuka.
- **Diagnostik yang parent perlu jalankan (browser task terarah):**
  1. Reproduksi: buka kartu kamar, screenshot.
  2. **Bedakan DOM vs 3D:** dengan kartu tetap terbuka, seret kamera ~90°.
     Kotak diam di layar → DOM; kotak ikut bergerak dengan dunia → objek
     3D/langit.
  3. Dengan kartu terbuka, jalankan di halaman:
     `document.elementFromPoint(x, y)` di tengah kotak → nama elemen yang
     menutupinya (kalau hasilnya `<canvas>` → 3D/compositing; kalau `<div>`
     → DOM, ketahuan elemennya).
  4. Sembunyikan kartu via devtools (`#roomCard` → `display:none`) saat
     kartu terbuka: kotak hilang → dari subtree kartu; kotak tetap →
     bukan kartu.
  5. Sembunyikan sprite label (`avatarLabel.sprite.visible = false`),
     buka kartu lagi: kotak hilang → label; tetap → bukan label.
  6. Catat: kotak muncul langsung saat kartu terbuka, atau HANYA setelah
     klik "Lihat kamarku" (fly-to)? Ini memisahkan pemicu DOM vs gerakan
     kamera.

### Bug 4 — FIXED: ketuk objek 3D tidak membuka kartu di otomasi
- **Akar:** ambang ketuk `moved > 8 || dt > 500 → return`; tekanan pointer
  otomasi berlangsung ~0,8 dtk (800 ms) sehingga selalu diklasifikasikan
  sebagai seret kamera.
- **Perbaikan** (`kosan-3d.html`, handler `pointerup`):
  ambang dilonggarkan menjadi `moved > 10 || dt > 1000 → return`.
  Gerakan tetap menjadi pembeda utama (seret terfilter oleh `moved`);
  ketuk cepat HP (~100–200 ms) tetap lolos. Logika raycast/kartu tidak
  diubah.
- **Verifikasi:** node --check lolos; grep memastikan ambang baru ada dan
  ambang lama sudah tidak ada. Perlu cek ulang di browser: ketuk pintu
  membuka kartu + seret kamera tetap memutar (tidak ikut membuka kartu).

---

## Ronde perbaikan 2 (8 Nov 2026 ~00:00 WITA) — sesudah re-test 23:44–23:53

Hasil re-test yang diperbaiki: ketik cepat LULUS, ketuk pintu 3 LULUS, seret kamera LULUS. Gagal: (A) papan 3D tetap polos (canvas TERBUKTI benar via ?debug=sign), (B) kotak biru muda ~500×210 px muncul pas kartu dibuka lewat "Cari kamarku" (bukan lewat ketukan pintu), (C) ketuk router 3× tidak buka kartu WiFi, (D) kartu ketukan pintu tanpa stempel/tombol. Semua perbaikan di `web/kosan-3d.html` saja; `index.html` (mtime 7 Nov 11:23) dan `app.js` (12:18) TIDAK disentuh; TIDAK ada deploy.

### (1) Papan — DIBANGUN ULANG setelah fonts.ready
- **Perubahan** (baris ~408–444): tekstur + mesh papan sekarang dibuat DI DALAM callback `document.fonts.ready` (`buildSign()`), BUKAN saat modul dimuat. Sebelum callback, papan belum ada di scene. Di dalam callback: `signTex` = CanvasTexture FRESH dari `textTexture(...)` yang sama (13×2,03 m, posisi (0, 8.6, -5.7), bg #1b4f8a, teks putih 104px — tidak berubah), lalu `sign.material.map = signTex; sign.material.needsUpdate = true;`, lalu `scene.add(sign)`. Fallback: `setTimeout(buildSign, 3000)` kalau `fonts.ready` tidak kunjung resolve; guard `signBuilt` supaya build tepat sekali. `?debug=sign` dipertahankan — `<img>` menampilkan canvas yang SAMA dengan tekstur baru (src di-set di dalam `buildSign`). Tambahan: `window.__kosanSign` (null sebelum build, mesh sesudahnya) untuk diagnostik browser.
- **Verifikasi:** `node --check` lolos (modul 30.871 byte); grep memastikan `buildSign` + `fonts.ready` + fallback ada.
- **CATATAN PENTING buat re-test — papan nyaris di luar frame default!** Hitungan geometri kamera default (posisi (0,4.5,21), target (0,1.2,12), FOV 55°): puncak frame ≈ +7,4° di atas horizon; papan membentang +6,6° s.d. +10,9° — jadi hanya ~15% bawah papan yang masuk frame di tampilan awal. Untuk memverifikasi teks papan, re-test WAJIB MENDONGAK (seret layar ke bawah supaya kamera melihat ke atas), BUKAN zoom masuk (zoom malah mempersempit frame). Posisi/ukuran papan TIDAK diubah sesuai brief — kalau pemilik nanti mau papan lebih kelihatan, itu keputusan terpisah (turunkan papan / naikkan sudut kamera default).

### (2) Diagnostik kotak biru — toggle URL baru
- **Perubahan:** `?debug=nosign` (baris 435): mesh papan tidak ditambahkan ke scene. `?debug=nolabel` (baris ~681–684): sprite label avatar tidak ditambahkan ke avatar (`makeLabel` tetap jalan supaya `spawnAvatar`/`setLabel` tidak error).
- **Cara pakai (untuk parent, di browser):** buka `kosan-3d.html?debug=nosign` → ketik nama → "Cari kamarku" → kalau kotak biru HILANG, kotak = papan. Kalau masih ada, buka `kosan-3d.html?debug=nolabel` → ulangi → kalau kotak HILANG, kotak = label. Kalau kotak tetap ada di kedua mode, kotak bukan papan dan bukan label — lanjut audit mesh lain (kandidat berikutnya: jendela kaca / trim / atap). Toggle ini HANYA diagnostik, bukan perbaikan; jangan di-link ke publik.
- **Verifikasi:** grep memastikan kedua toggle ada; `node --check` lolos.

### (3) Ketuk router — hit-proxy teras
- **Perubahan** (baris ~527–535): kotak tak kasat mata `BoxGeometry(7, 1.6, 5.4)` di (16, 0.8, -2) menutupi SELURUH teras (karpet + meja + router + bantal), `userData = { card: 'living' }`, material `transparent: true, opacity: 0, depthWrite: false`, `visible` tetap `true` (raycast melewatkan `visible:false`), tidak menulis bayangan. Dimasukkan ke `clickables`. Rug/meja/router/LED/bantal tetap di `clickables` seperti sebelumnya.
- **Verifikasi:** grep memastikan `livingHit` + `userData { card: 'living' }` + `clickables.push(livingHit)` ada. Perlu cek ulang di browser: ketuk di mana saja di area teras (karpet/meja/router) membuka kartu Ruang Tamu.

### (4) Konsistensi kartu ketukan — stempel + tombol
- **Perubahan** (`showRoomCard`, baris ~712–748): variabel `ownRoom = !resident && n === visitorRoom && visitorId`. Kalau kartu dibuka lewat ketukan pintu di kamar preview sendiri, kartu sekarang menampilkan stempel "KARTU PREVIEW KAMAR" + "belum tercatat." + tombol "Lihat kamarku" (terbang ke pintu kamar itu), sama seperti kartu dari "Cari kamarku". Kartu lain tidak berubah.
- **Verifikasi:** baca ulang blok `showRoomCard` — cabang `ownRoom` berisi stempel + tombol `flyToDoor(n)`; `node --check` lolos.

### Verifikasi akhir ronde 2
- `node --check` pada modul yang diekstrak dari file → **lolos** (30.871 byte).
- Fungsi kamar (diekstrak ASLI dari file): `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`, `previewFor.room = 3` — tidak berubah.
- Ambang ketuk tetap `moved > 10 || dt > 1000` (baris 856); ambang lama `moved > 8 || dt > 500` = 0 kemunculan.
- 0 kemunculan `firebase`/`analytics`/`fetch(` di file.
- Logika belok/D-pad, `RESIDENTS`, fungsi kamar, Misi/KTA ("segera hadir") TIDAK diubah.
- **Yang masih perlu dicek parent di browser (belum bisa diverifikasi dari kode):** (a) teks papan terbaca SETELAH mendongak; (b) identitas kotak biru via toggle `?debug=nosign` / `?debug=nolabel`; (c) ketuk teras membuka kartu WiFi; (d) kartu ketukan pintu kamar sendiri ada stempel + tombol; (e) belok lalu maju mengubah arah jalan avatar (re-test sebelumnya: belok di tempat tidak kelihatan karena avatar nyaris simetris dari belakang — verifikasi lewat arah jalan, bukan lewat putaran di tempat).

---

## Ronde perbaikan 3 (8 Nov 2026 ~00:17 WITA) — kotak biru: kartu kamar scrollable

### Diagnostik yang menentukan (re-test 8 Nov 00:12–00:16, viewport 1919×998)
- Kotak biru muncul saat kartu KAMAR dibuka lewat "Cari kamarku" (A) DAN lewat ketukan pintu (B) — tapi TIDAK muncul saat kartu Ruang Tamu dibuka (C). Tutup kartu → kotak langsung hilang.
- Ukuran kotak terukur presisi: x 726–1199 (lebar ~474 px), y 13–216 (tinggi ~203 px), tengah ~(963,115). Warna: gradien biru, bagian bawah PERSIS warna langit `#8ec9ee` = RGB(142,201,238). Tidak ada elemen HTML di tengah kotak (area itu di dalam tampilan 3D).
- Sudah dicoret: papan (`?debug=nosign` tidak menghilangkan), label avatar (`?debug=nolabel` tidak menghilangkan), hit-proxy teras (opacity 0, posisi salah).
- **Analisis (parent): ukuran kotak ≈ ukuran kartu `#roomCard` (max-width 480 px, max-height 210 px).** Kartu kamar isinya panjang (judul + "Masih kosong." + ID + stempel + "belum tercatat." + "Ini kamarmu (preview) — ID ..." + tombol "Lihat kamarku") → total ~205–251 px > max-height 210 px → kartu kamar MENGALIR (`overflow-y: auto`, bisa di-scroll). Kartu Ruang Tamu isinya pendek (~112 px) → TIDAK scroll. Satu-satunya perbedaan struktural yang cocok: kartu kamar = kartu scrollable, kartu Ruang Tamu = tidak. Dugaan kuat: kartu scrollable itu mengacaukan compositing kanvas WebGL di browser otomasi (kotak = daerah kanvas yang gagal digambar, menampilkan langit). BUKAN objek 3D — tidak ada mesh yang bisa menghasilkan kotak itu.
- Hitungan tinggi kartu (asumsi: h2 ~22px + margin 4; p 14px lh 1.45 = 20,3; cardid 15px = 21,75; stempel ~23px; tombol ~35px):
  - SEBELUM (padding 14+16=30, max-height 210): isPreview ~206 px (pas-pasan di desktop, metrik font nyata bisa melampaui 210); ownRoom (ketuk) ~205 px; ownRoom + baris "Ini kamarmu" wrap 2 baris (HP 390px) ~225 px → SCROLL; isPreview + kasus `moved` (paragraf pindah 2 baris) ~251 px → SCROLL.
  - SESUDAH (lihat di bawah): isPreview ~170 px; ownRoom ~169 px; ownRoom + wrap ~189 px; isPreview + moved ~215 px — SEMUA di bawah max-height baru 240 px, tidak pernah scroll.

### Perbaikan — kartu kamar dipadatkan supaya tidak pernah scroll
Semua di `web/kosan-3d.html` saja; `index.html` (mtime 7 Nov 11:23) dan `app.js` (12:18) TIDAK disentuh; TIDAK ada deploy.
- **CSS `#roomCard`** (baris 61–64): padding `14px 16px 16px` → `12px 14px 14px`; `max-height: 210px` → `240px`; `overflow-y: auto` DIPERTAHANKAN sebagai pengaman (kalau konten tetap kepanjangan di layar kecil, scroll tetap tersedia); tambah `transform: translateZ(0);` (memaksa kartu ke compositing layer sendiri yang benar — perbaikan standar untuk glitch layer).
- **`body.card-open #dpad` / `#zoombox`** (baris 81–82): `bottom: 226px` → `256px`. Konsekuensi langsung dari max-height baru: kartu setinggi 240 + bottom 12 = 252 px dari bawah; offset lama 226 akan membuat D-pad/zoom menabrak kartu yang tinggi. Aturan yang sama seperti sebelumnya (210+12=222 → 226, selisih 4 px): 240+12=252 → 256.
- **Isi kartu kamar di `showRoomCard`** (baris 710–748): stempel + "belum tercatat." digabung jadi SATU baris (`<p style="margin-top:4px"><span class="stamp" style="margin-top:0">KARTU PREVIEW KAMAR</span> belum tercatat.</p>`) di kedua jalur (isPreview baris 720, ownRoom baris 731) — menghemat ~26 px per kartu. Margin antar-baris `margin-top:6px` → `4px` (cardid, baris "Ini kamarmu", baris stempel). Tidak ada lagi `margin-top:6px` di file (grep = 0).
- **Penyimpangan dari brief (disengaja, dicatat):** brief menyarankan mempersingkat baris "Ini kamarmu (preview) — ID ..." jadi "Ini kamarmu (preview)." dengan alasan ID sudah ada di baris ID di atas. Alasan itu hanya benar di jalur "Cari kamarku" (ada baris `cardid`); di jalur ketukan pintu (ownRoom) TIDAK ADA baris ID terpisah — menghapus ID dari baris itu akan menghilangkan info ID dari kartu ketukan. Jadi baris itu dipertahankan utuh (dengan ID). Penghematan dari penggabungan stempel + margin + padding + max-height sudah cukup (kartu tertinggi ~215 px < 240 px), jadi pemotongan teks tidak diperlukan.

### Verifikasi akhir ronde 3
- `node --check` pada modul yang diekstrak dari file → **lolos** (31.061 byte).
- Fungsi kamar (diekstrak ASLI dari file): `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`, `previewFor.room = 3` — tidak berubah.
- Toggle debug `?debug=sign` / `?debug=nosign` / `?debug=nolabel` masih ada (grep = 6 kemunculan); ambang ketuk tetap `moved > 10 || dt > 1000` (baris 858); 0 kemunculan `firebase`/`analytics`/`fetch(`.
- Fungsi kamar, papan, label, hit-proxy, ambang ketuk, Misi/KTA ("segera hadir") TIDAK diubah.
- **Yang masih perlu dicek parent di browser (belum bisa diverifikasi dari kode):** buka kartu kamar lewat "Cari kamarku" DAN lewat ketukan pintu → kotak biru HARUS hilang di kedua jalur; kartu Ruang Tamu tetap normal; D-pad/zoombox tidak tertutup kartu saat kartu terbuka (offset baru 256 px).

---

## Ronde perbaikan 4 (8 Nov 2026 ~03:52 WITA) — vonis pemilik dari HP: moonwalk, hapus tombol panah + zoom, joystick analog, pinch zoom, HUD mobile berantakan

Semua di `web/kosan-3d.html` saja (42.664 byte); `index.html` dan `app.js` TIDAK disentuh; TIDAK ada deploy.

### (1) Moonwalk — avatar mundur tapi badan tetap menghadap depan
- **Perubahan (PURE + `animate()`):** fungsi murni baru `facingYaw(yaw, fwd, turn, cur)` — maju (`fwd>0`) → `yaw + PI`; mundur saja (`fwd<0`) → `yaw` (berbalik 180°, menghadap arah mundur); belok di tempat (`fwd=0, turn≠0`) → `yaw + PI` (ikut yaw seperti semula); diam total → `cur` (tidak berubah). `lerpAngle(a, b, t)` baru — lerp sudut lewat jalur terpendek (tidak muter 360° saat lewat ±PI). Di `animate()`: `avatar.rotation.y = lerpAngle(rotasi saat ini, facingYaw(...), 1 - exp(-10*dt))` — putaran halus, tidak snap. `avatar.rotation.y = Math.PI` saat spawn (mempertahankan tampang awal: membelakangi kamera, menghadap gedung).
- **Keputusan desain (dicatat):** saat diam total rotasi MEMBEKU — jadi setelah belok di tempat, badan tertinggal dari heading sebesar lag lerp (maks ~0,24 rad ≈ 14°, di simulasi 1 detik belok penuh lag 0,14 rad ≈ 8°). Tidak kelihatan di chibi yang nyaris simetris, dan terkoreksi begitu jalan maju/mundur ditekan. Alternatif (diam ikut merapat ke heading) ditolak karena akan membuat avatar berputar 180° sendiri setelah berhenti mundur.
- **Verifikasi:** simulasi node 40/40 lolos (lihat `/tmp/kosan3d-r4-verify.js`): maju → `yaw+PI`; mundur 1 dtk (10 frame) → z 12→15 DAN rotasi → 0; maju lagi → z kembali 12 DAN rotasi → PI; belok di tempat → yaw +2,4, rotasi ikut dengan lag < 0,3 rad, membeku saat diam, merapat saat maju ditekan.

### (2) D-pad DIHAPUS TOTAL
- **Perubahan:** HTML `#dpad` + 4 tombol (`dUp/dDown/dLeft/dRight`) dihapus; seluruh CSS `#dpad`/`#dUp`/`#dLeft`/`#dDown`/`#dRight`/`button.held` dihapus; fungsi `bindHold` + 4 pemanggilannya dihapus; CSS `body.card-open #dpad` dihapus. Keyboard WASD/panah TETAP jalan (KEYMAP + guard INPUT tidak berubah).
- **Verifikasi:** grep case-insensitive `dpad` = 0, `bindHold` = 0, `dUp/dDown/dLeft/dRight` = 0, `held` = 0.

### (3) Joystick virtual analog (pengganti tombol arah)
- **Perubahan (HTML + CSS + JS):** div `#joy` (alas lingkaran 120px, kiri bawah) + `#joyKnob` (52px). Pointer events (touch + mouse): tekan di alas → knob mengikuti jari dalam radius 34 px (`JOY_R = (120-52)/2`), lepas → knob kembali ke tengah. Sumbu vertikal = maju/mundur (dorong atas = maju), sumbu horizontal = belok (dorong kanan = belok kanan). Dead zone 0,12 (defleksi < ~4 px diabaikan). Kecepatan + laju belok PROPORSIONAL dengan defleksi (kecepatan penuh = 3 m/dtk dan belok penuh = 2,4 rad/dtk, sama seperti sebelumnya). Integrasi: `mergeInput(kFwd, kTurn, joy.fwd, joy.turn)` (fungsi murni, di PURE) menggabung keyboard (±1) + joystick (-1..1) dan menjepit hasil ke [-1, 1]; `moveStep(x, z, yaw, input, dt)` tanda barunya menerima `{fwd, turn}` analog (BUKAN lagi `keys` boolean) — kecepatan = `SPEED * |fwd|`, laju belok = `TURN * turn`. `#joy` `touch-action: none` + elemen DOM terpisah di atas kanvas (z-index 10) → sentuhan joystick tidak pernah sampai ke OrbitControls (kamera tidak ikut berputar); knob `pointer-events: none`; `setPointerCapture` supaya seret tetap terlacak walau jari keluar alas.
- **Verifikasi:** simulasi node: `mergeInput(1,0,-0.5,0.3)` = `{fwd:0.5, turn:0.3}`; clamp di ±1; `moveStep` analog setengah (`fwd:0.5`, 1 dtk) → z berkurang 1,5 (proporsional); belok setengah (`turn:-0.5`) → yaw -1,2. Grep: `joy` = 41 kemunculan.

### (4) Tombol zoom DIHAPUS, diganti pinch zoom (cubit)
- **Perubahan:** HTML `#zoombox` + tombol `zoomIn/zoomOut` dihapus; seluruh CSS `#zoombox` dihapus; fungsi `zoomBy` + 2 listener dihapus; CSS `body.card-open #zoombox` dihapus. **Pinch:** `pointers` Map melacak pointer aktif di kanvas; saat tepat 2 pointer → `pinchBegin()`: `controls.enabled = false` (tidak ada rotate) + jarak awal dicatat; `pointermove` mengatur jarak kamera dari rasio `pinchLen * pinchDist / d` (clamp `minDistance` 6 – `maxDistance` 20, sama seperti zoom lama); saat kembali ke <2 pointer → `pinchEnd()`: `controls.enabled = true`. **Ketukan dari gestur 2 jari diabaikan** (`wasPinch` → return sebelum raycast; `downPos` di-null-kan saat pinch mulai). **Detail penting (dicek ke `vendor/three/OrbitControls.js`):** handler OrbitControls mengembalikan dini kalau `enabled === false` — jadi kalau jari ke-2 sempat tercatat di peta pointer internalnya, state-nya nyangkut di mode pinch dan kamera melonjak saat satu jari diangkat. Karena itu jari ke-2 DISEMBUNYIKAN dari OrbitControls: listener `window pointerdown` fase capture — kalau targetnya kanvas dan sudah ada 1 pointer aktif, jari ke-2 dicatat di `pointers`, `pinchBegin()` dipanggil, lalu `stopPropagation()` + `preventDefault()` sebelum event sampai ke kanvas. OrbitControls tidak pernah melihat jari ke-2, state-nya tetap ROTATE dengan 1 pointer.
- **Verifikasi:** grep case-insensitive `zoombox` = 0, `zoomBy` = 0, `zoomIn/zoomOut` = 0; `pinch` = 16 kemunculan; `controls.enabled = false` ada 1 (di `pinchBegin`).

### (5) HUD dirapikan untuk HP 390px
- **Perubahan (CSS + HTML):**
  - `#topbtns` dari kolom → **satu baris** (row + wrap, rata kanan di desktop). Di `≤420px`, `#topbar` jadi 2 baris (judul di atas, 3 pil sebaris di bawah), padding 8px 12px, judul 16px, subjudul 11px, pil 12px.
  - **Label pil dipersingkat (disengaja, dicatat):** `🎯 Misi — segera hadir` → `🎯 Misi`, `🪪 KTA — segera hadir` → `🪪 KTA` (tambah `title="Segera hadir"`; status tetap disabled). Alasan: label lengkap butuh ~420 px dalam satu baris, sedangkan lebar tersedia di 390px hanya ~366 px (390 − padding 24) — mustahil muat tanpa mengecilkan font sampai tidak terbaca. Label singkat butuh ~227 px, muat longgar. Nama di brief ("Web Utama, Misi, KTA") memang sudah bentuk singkat ini.
  - `#namebar` tetap di bawah topbar (desktop `top: 74px`; mobile `top: 88px` — topbar mobile ~81px), lebar penuh margin 12px, tombol `Cari kamarku` 14px di mobile.
  - `#hint` teks baru: `Joystick buat jalan · seret layar putar kamera · cubit buat zoom · ketuk pintu kamar` (tetap hilang saat kartu terbuka). Di mobile: naik ke `bottom: 148px` (di atas joystick), boleh 2 baris (`white-space: normal`, `max-width: calc(100vw - 24px)`, 11px) — kalau tetap di bawah, teksnya menabrak joystick.
  - `#roomCard` tetap bottom sheet; saat terbuka joystick geser ke `body.card-open #joy { bottom: 256px; }` (sama seperti offset tombol arah dulu: kartu 240 + bottom 12 = 252, +4 px).
  - **Cek tumpang tindih di 390×844 (nalar):** topbar 0–~81px; namebar 88–~136px; hint ~148–180px dari bawah (2 baris, 11px); joystick 16–136px dari bawah (120px); kartu terbuka 12–252px dari bawah, joystick naik ke 256–376px dari bawah (celah 4 px di atas kartu). Tidak ada yang saling menutupi. Di viewport pendek (mis. 700px) jarak yang sama tetap berlaku karena semua posisi dihitung dari tepi.
- **Verifikasi:** baca ulang CSS + hitungan di atas; perlu cek visual di browser (layar 390px sungguhan) oleh parent — tidak bisa diverifikasi dari kode.

### Verifikasi akhir ronde 4
- `node --check` pada modul yang diekstrak dari file → **lolos** (35.347 byte).
- Simulasi node `/tmp/kosan3d-r4-verify.js` (PURE diekstrak ASLI dari file) → **40/40 lolos**, termasuk: `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`, `previewFor.room = 3` (tidak berubah); facingYaw maju/mundur/diam/belok; lerpAngle jalur terpendek; mergeInput + clamp; moveStep analog + simulasi frame mundur/maju/belok.
- 0 kemunculan `firebase`/`analytics`/`fetch(` di file; toggle debug `?debug=sign`/`?debug=nosign`/`?debug=nolabel` masih ada (6 kemunculan); ambang ketuk tetap `moved > 10 || dt > 1000` (1 kemunculan); `KEYMAP`, `localStorage`, `buildSign`, `livingHit` masih ada.
- Fungsi kamar, `RESIDENTS`, papan KOSAN DIBUKA (`buildSign` setelah `fonts.ready`), hit-proxy teras, isi kartu, Misi/KTA (tetap nonaktif "segera hadir"), drag putar kamera TIDAK diubah.
- **Yang masih perlu dicek parent di browser (tidak bisa diverifikasi dari kode):** (a) di HP 390px: joystick terasa enak (maju/mundur/belok proporsional), cubit zoom in/out jalan + tidak membuka kartu, kamera tidak melonjak setelah cubit; (b) avatar tidak moonwalk lagi saat mundur (badan berbalik menghadap arah mundur); (c) HUD 390px rapi: topbar 2 baris, 3 pil sebaris, namebar tidak menabrak topbar, hint tidak menabrak joystick, kartu terbuka tidak menutupi joystick; (d) keyboard WASD/panah di desktop masih jalan.

## Ronde 5 — Audit + perbaikan joystick (playtest 04:00–04:08: moonwalk + sumbu X mati)

### Temuan audit (baca statis + simulasi DOM path dengan kode ASLI file)
- **File live = file lokal (MD5 identik `8b207b0d…`), dan live MENGANDUNG `facingYaw`/`lerpAngle`/joystick, 0 sisa D-pad.** Hipotesis "deploy basi / kode lama" GUGUR — browser menjalankan kode yang sama persis dengan yang dibaca.
- **Simulasi DOM path (`/tmp/joy-dom-sim.js`, PURE + handler joy + `animate()` diekstrak verbatim, fake DOM 1919×998):** UP → maju + rotasi → π ✓; DOWN 3 dtk → z 5,7→15,0 DAN rotasi → 0,00 ✓ (moonwalk TIDAK ter-reproduksi); RIGHT 3 dtk → yaw −7,40, rotasi ikut ✓; LEFT → yaw kembali ~0 ✓. **Jalur murni + DOM simetris X/Y — tidak ada asimetri sumbu di kode.** Jadi (a) moonwalk TIDAK BISA dihasilkan kode ini dalam steady state (dibuktikan matematis: semua kombinasi (yaw,fwd) yang bergerak ke selatan pasti berujung hadap selatan); kemungkinan tersisa: observasi saat transisi / artefak browser otomasi — overlay `?debug=joy` di bawah ini alat untuk membuktikannya dari screenshot.
- **Simulasi capture-gagal (S4/S5):** kalau gerakan pertama melompat ke luar `#joy` tanpa capture, `joyEl` tidak pernah menerima move → `joy.turn` tetap 0 (sumbu X mati persis seperti laporan); kalau gerakan berhenti sampai ke `joyEl` di tengah jalan, nilai terakhir MEMBEKU (avatar terus belok). Dan kalau `pointerup` juga luput dari `#joy`, `joyId` nyangkut → semua `pointerdown` joystick berikutnya diabaikan (`if (joyId !== null) return;`) → joystick mati total. **Ini bug konkret di kode (b):** state machine joystick sepenuhnya bergantung pada `setPointerCapture` yang TERBUKTI bocor di playtest (dorongan keluar lingkaran sempat menyeret kanvas + memutar kamera).
- **Roda gulir tidak zoom:** `OrbitControls` r160 `enableZoom = true` default (baris 76 vendor) dan kode tidak pernah mematikannya — jadi bukan setting. Satu-satunya jalan `controls.enabled` jadi false adalah `pinchBegin()`; `pinchActive`/`pointers` hanya dibersihkan oleh `pointerup`/`pointercancel` DI KANVAS. Kalau pointerup luput dari kanvas, `controls.enabled` nyangkut false → drag + roda gulir mati. **Bug konkret kedua, pola yang sama (cleanup hanya di satu elemen).**

### Perbaikan (minimal, hanya jalur yang rusak)
1. **Fallback joystick di window (baris ~874–893):** `window pointermove/up/cancel` keyed by `joyId` (dilewati kalau `e.target === joyEl` supaya tidak dobel saat capture jalan) + `window blur → joyReset()`. Tidak mengubah perilaku saat capture jalan; saat capture bocor, gerakan/lepas tetap diproses dan `joyId` tidak bisa nyangkut.
2. **Bookkeeping pinch di window (baris ~977–985):** `canvasPointerBookkeeping(e)` diekstrak (hapus dari `pointers` + `pinchEnd` bila <2) dan dipanggil juga dari `window pointerup/cancel`. Tap TETAP kanvas saja (tidak dobel). `controls.enabled` tidak bisa lagi nyangkut false karena pointerup luput.
3. **Overlay debug `?debug=joy` (baris ~895–903 + update di `animate()`):** div fixed di bawah namebar (top 132px desktop / 140px mobile, `pointer-events:none`, tidak menutupi joystick/kartu), tampil hanya bila URL mengandung `?debug=joy`, teks live tiap frame: `joy fwd/turn | in fwd/turn | yaw | rot | id | pinch | ctl`. Cara pakai: buka `kosan-3d.html?debug=joy`, dorong joystick, baca dari screenshot — kalau `joy.turn` tetap 0.00 saat didorong kanan → event tidak sampai; kalau `in fwd` −1.00 tapi `rot` tetap ~3.14 → lerp tidak jalan di browser itu; kalau `id` tetap angka setelah lepas → joyId nyangkut; kalau `ctl` 0 → controls mati (pinch nyangkut).

### Yang diaudit + dicoret (dan kenapa)
- `joyUpdate` (dx/dy, clamp, dead zone 0,12, `joy.fwd=-dy/R`, `joy.turn=-dx/R`): simetris X/Y, tidak ada yang membedakan sumbu. Coret.
- `mergeInput`/`moveStep`/`facingYaw`/`lerpAngle` + wiring `animate()`: simulasi frame 40/40 ronde 4 + simulasi DOM path ronde 5 — semua benar. Coret.
- `setPointerCapture` di `joyEl`: ada, tapi playtest membuktikan bocor di browser otomasi → BUKAN diandalkan lagi (difallback window). Bukan dihapus (tetap jalur utama saat jalan).
- Handler lain yang menyentuh `joy`/`keys`: tidak ada (grep: hanya `joyUpdate`/`joyReset` menulis `joy.*`; hanya KEYMAP menulis `keys.*`). Pinch handler hanya aktif bila target kanvas. Coret.
- Duplikat `#joy` / tulisan `rotation.y` lain: 1 elemen `#joy`, satu-satunya penulis `avatar.rotation.y` adalah setup spawn (π) + lerp di `animate()`. Coret.
- `avatar.rotation.y = Math.PI` saat spawn: nilai awal saja, lerp memindahkannya (terbukti simulasi). Bukan bug.

### Verifikasi
- `node --check` modul diekstrak → **lolos**.
- Simulasi DOM path v2 (`/tmp/joy-dom-sim2.js`, kode BARU): capture jalan → RIGHT turn −1,00 yaw −5,00 ✓; capture RUSAK (move via window) → turn −1,00 yaw −10,00 ✓; DOWN via window → fwd −1,00, rot menuju −10 ≡ −3,72 (jalur terpendek lerpAngle) ✓; pointerup via window → `id=null` ✓; drag berikutnya tetap jalan (tidak nyangkut) ✓; overlay `joyDbg` TERBUAT + teks live ✓.
- Fungsi kamar diekstrak ASLI: `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`, `previewFor.room = 3` — tidak berubah.
- `?debug=joy` = 3 kemunculan; `?debug=sign`/`nosign`/`nolabel` masih ada; ambang ketuk tetap `moved > 10 || dt > 1000`; 0 `firebase`/`analytics`/`fetch(`; 0 `dpad`/`zoombox`.
- Fungsi kamar, papan, kartu, hit-proxy, toggle debug lama, Misi/KTA, hint TIDAK diubah.
- **Yang parent masih perlu cek di browser:** (a) `?debug=joy` + dorong BAWAH: `joy fwd` −1,00 dan `rot` → 0,00 (kalau rot tetap ~3,14, moonwalk nyata di browser itu dan butuh data overlay); (b) dorong KANAN/KIRI: `joy turn` ±1,00 dan `yaw` berubah; (c) roda gulir zoom + `ctl` tetap 1; (d) HUD 390px + pinch zoom tetap hanya bisa di HP asli pemilik.

## Ronde 6 — Rebuild karakter ala sekolahbebaz + kontrol camera-relative instan + hapus bobbing (vonis pemilik 8 Nov 16:27 + koreksi 16:30)

### Vonis pemilik (HP, ground truth)
"kontrolnya berat banget analognya, gak nyaman, karakter jelek pula modelnya, lompat lompat pula jalannya, buat kayak si sekolahbebaz model karakternya" + koreksi 16:30: "analognya kontrolnya gak nyaman cok, lama banget karakternya belok atau apa gitu, kayak dekay" = belok LAMA / rasa delay-decay, BUKAN terlalu sensitif. DUA arahan brief awal BATAL: (1) turunkan TURN 2.4→1.6; (2) ramp/akselerasi bertahap. Keduanya bikin makin ngaret — kebalikan dari yang diminta.

### Tugas 1 — Spek sekolahbebaz (diekstrak dari HTML ASLI https://sekolahbebaz.pages.dev/, 279.127 byte, curl 8 Nov 16:28)
- `buatAvatar(olimpiade, skin, seragam, polos)` — Three.js r160, `mat()` = MeshStandardMaterial cache (roughness 0,7). Group scale 1,1; tinggi total ~1,82 (x1,1 ≈ 2,0 m).
- Kaki: sepatu box putih #F7F9FC (0,17, 0,1, 0,3) di (±0,12, 0,05, 0,04); betis silinder #1E1E24 (r 0,09–0,1, h 0,62) di (±0,12, 0,41, 0).
- Tangan: kapsul jaket (r 0,08, len 0,36) di (±0,34, 0,98, 0), rot.z ±0,2; manset putih box (0,17, 0,05, 0,17) di (±0,38, 0,76, 0); telapak bola kulit r 0,07 di (±0,39, 0,7, 0).
- Badan: kapsul jaket (r 0,27, len 0,36, roughness 0,5) di (0, 1,0, 0); panel kemeja box (0,16, 0,36, 0,05) di (0, 1,02, 0,25).
- Kepala: bola kulit r 0,27 di (0, 1,55, 0). Wajah (semua +z): mata bola r 0,042 #141414 roughness 0,1 di (±0,095, 1,585, 0,235), scale.y 1,35; highlight putih r 0,013 di (±0,083, 1,605, 0,272); pipi CircleGeometry r 0,04 #F28B82 opacity 0,55 di (±0,16, 1,51, 0,222), rot.y ±0,6; senyum Torus (0,05, 0,012, arc π) #5A2E22 di (0, 1,5, 0,255), rot.z π.
- Seragam bawaan (tanpa KTA) = SERAGAM_BAWAAN[0] 'Varsity Merah': jaket #E5484D, dalam #FFD447, kepala 'topiBalik', aksen #2F8FEA. TopiBalik: kubah setengah bola r 0,29 (thetaLength 0,45π) di (0, 1,58, 0) + brim box (0,26, 0,03, 0,22) di (0, 1,63, **-0,3**) — brim ke BELAKANG.
- Kulit bawaan SKINS[1] = #E0A97E (SKINS = ['#C98E64', '#E0A97E', '#B07A52', '#D9A277', '#A9714B']).
- Animasi `update(t, gerak)`: tubuh.position.y = |sin(t*(3+8*gerak))| * (0,05+0,03*gerak) [BOBBING — sengaja TIDAK ditiru, aturan pemilik]; tubuh.rotation.y = sin(t*1,3)*0,25*(1-gerak) [goyang idle]; kaki rot.x = sin(t*11+k*π)*0,55*gerak; tangan rot.x = -sin(t*11+k*π)*0,6*gerak, rot.z tetap ±0,2.
- Gerak `langkah(dt)` (mode jalan, orang ketiga): jalan 4 m/dtk, lari 9 (Shift); tombol D-pad putar yaw 1,9 rad/dtk; joystick: `maju -= stik.dy; samping += stik.dx; if (!lihatSentuh) pemain.yaw -= stik.dx * 1.6 * dt` (sumbu X = strafe + putar heading 1,6 rad/dtk); gerak relatif kamera (fx=-sin yaw, fz=-cos yaw); avatar menghadap vektor gerak `atan2(...)` + lerp `min(1, dt*12)`; kamera di belakang heading (jarak luar hp 7 / desktop 5,6, tinggi 2,0 + pitch, lookAt 1,2 m di depan). TIDAK ADA ramp/smoothing input di kode mereka — rasa "ringan" datang dari skema ini + hadap cepat.
- Label nama: elemen DOM `sorot.el` ('⭐ @nama' / '🚶 kamu') yang diproyeksikan — BUKAN sprite 3D. Kosan tetap pakai sprite canvas (sudah jalan).
- Joystick mereka: lingkaran tetap 120px, knob translate dx*35px, normalisasi /50, clamp ±1, handler touch + pointer + capture.

### Tugas 2 — Rebuild karakter (makeBebazAvatar, ganti TOTAL chibi lama buat pengunjung)
- Proporsi, bentuk, warna, wajah, topiBalik = spek di atas (jaket #E5484D, kemeja #FFD447, kulit #E0A97E, topi aksen #2F8FEA brim belakang). Kepala r 0,27 dari tinggi ~1,82 — BUKAN chibi kepala besar (dulu kepala Ø 0,84 dari tinggi 1,7 m). Tinggi total x1,1 ≈ 2,06 m (pintu kosan 2,4 m — proporsional).
- Perbedaan yang disengaja (dicatat, bukan lupa): material Lambert (selaras cahaya scene Kosan) bukan Standard — hex SAMA; TANPA cincin emas / pilar cahaya / kilau orbit (efek panggung murid duduk, bukan bagian karakter); kaki+tangan digantung di pivot grup pinggul (±0,12, 0,72, 0) / bahu (±0,34, 1,16, 0) supaya ayunan berputar dari sendi (aslinya mesh diputar dari tengah anggota); panel kemeja digeser ke z 0,26 (bukan 0,25) supaya tidak z-fighting dengan kapsul badan; mata pakai Basic #141414 (selalu gelap terbaca) bukan Standard.
- Depan vs belakang JELAS (pelajaran ronde 5): wajah (mata+highlight+pipi+senyum) + panel kuning di depan; brim topi + punggung jaket polos di belakang.
- Label nama tetap sprite canvas, posisi y 2,0 (ruang grup, ≈2,2 dunia, di atas topi ~2,06). `spawnAvatar` / setLabel tidak berubah.
- Ibu Kos TIDAK diubah — tetap `makeChibi({ bun: true, dress: true })`.

### Tugas 3 — Kontrol camera-relative INSTAN (menggantikan skema tank ronde 4-5)
- Akar rasa "dekay" di skema lama: joystick X cuma memutar avatar di tempat (kamera diam — dunia tidak ikut berputar, jadi belok terasa lambat) + facing lerp mengejar target yang ikut bergerak (lag 0,24 rad pada rate 10/dtk).
- Skema baru (bebaz): heading = azimuth kamera (`avatarYaw = atan2(camX-targetX, camZ-targetZ)` tiap frame — drag kamera ikut memutar heading). `moveStep`: maju = searah kamera; sumbu X = strafe + putar heading/kamera (`yaw += turn * YAW_RATE * dt`, YAW_RATE tetap **2,4** — bukan 1,6 bebaz; pemilik minta belok cepat, jadi angka lama dipertahankan dengan arti baru). Kamera diputar mengikuti heading baru via `rotateCamera(dYaw)` (putar offset kamera mengelilingi target, jarak + tinggi dipertahankan; dilewati saat flyTarget aktif). Drag / pinch / roda gulir OrbitControls tetap jalan; ketuk pintu/teras tetap jalan.
- Hadap = arah VEKTOR GERAK (`faceMove(mx, mz, cur)` = atan2 bila bergerak, diam = tetap) menggantikan `facingYaw` (berbasis yaw saja, tidak bisa menyatakan strafe). Lerp hadap CEPAT 12/dtk (bebaz: `dt*12`; dulu 10/dtk). Moonwalk mustahil secara konstruksi: mundur → vektor gerak berlawanan → hadap berbalik 180°.
- TANPA ramp/smoothing apa pun: dorong → langsung gerak; lepas → langsung berhenti (simulasi membuktikan pos tidak berubah setelah lepas).
- Keyboard: panah/WASD sama seperti joystick (atas/bawah = maju/mundur, kiri/kanan = strafe + putar). Dead zone tetap 0,12.

### Tugas 4 — Hapus TOTAL bobbing
- `bobT` DIHAPUS (grep 0). `avatar.position.y = 0` selalu, kaki menapak.
- Animasi jalan ala bebaz: `walkT` jam absolut; kaki rot.x = sin(walkT*11)*0,55*gerak (kiri/kanan berlawanan fase); tangan rot.x = -sin(...)*0,6*gerak; goyang idle tubuh rot.y = sin(walkT*1,3)*0,25*(1-gerak). `gerak = min(1, hypot(fwd, turn))`. Badan TIDAK PERNAH naik-turun.

### Verifikasi
- `node --check` modul diekstrak → **lolos**.
- Simulasi node (`/tmp/sim-r6.js`, PURE verbatim + harness loop animate): UP 1 dtk → z 12→9, rot tetap 3,14 ✓; DOWN 1 dtk → z 12→15, rot → 0,00 (tanpa moonwalk) ✓; KANAN 1 dtk → yaw 0→-2,40, x 0→0,80 (strafe kanan + melengkung) ✓; KANAN 3 dtk → yaw -7,20 ternormalisasi -0,92 ✓; LEPAS 0,5 dtk → moving=false, pos TIDAK berubah (berhenti instan, tanpa decay) ✓; lerp hadap 0,25 dtk → rot 0,156 (< 0,20, rate 12/dtk) ✓; diagonal up-right 1 dtk → (2,63, 12,18), rot 0,80 mengikuti vektor gerak ✓.
- Fungsi kamar utuh: `roomFor("Budi Santoso") = 3`, `makeId = "KOSAN-03-BUDI"`, `previewFor.room = 3`.
- Grep: `bobT` 0; `facingYaw` 0 (tinggal 1 komentar penjelas penggantian); `dpad` 0; `zoombox` 0; `firebase` 0; `position.y =` hanya nilai konstruksi + `avatar.position.y = 0`; semua 37 material yang dipakai terdefinisi; `makeBebazAvatar` terdefinisi + 1 pemanggilan (pengunjung); `makeChibi` tinggal dipakai Ibu Kos.
- TIDAK diubah: fungsi kamar, kartu kamar, papan, ketuk pintu/teras, hit-proxy, ambang ketuk, joystick UI, pinch, HUD, tombol Misi/KTA, toggle debug lama, overlay ?debug=joy.
- **Yang parent masih perlu cek (tidak bisa dari kode):** playtest di browser + vonis HP pemilik: (a) dorong atas = jalan menjauhi kamera, dorong kanan = strafe kanan + kamera ikut berbelok (sinkron, tanpa rasa dekay); (b) lepas joystick = berhenti langsung, tanpa ngaret; (c) karakter baru kelihatan kayak bebaz (proporsi, wajah, topi dibalik) + depan/belakang jelas beda; (d) jalan tidak lompat-lompat, kaki menapak; (e) pinch + HUD 390px tetap hanya bisa di HP asli pemilik. Kalau belok masih terasa lama, satu-satunya kenop adalah YAW_RATE (2,4) di moveStep — naikkan ke 2,8–3,0, jangan tambah ramp.

## Referensi visual sekolahbebaz (screenshot langsung, 8 Nov 16:28–16:55 WITA)

Browser task mengamati https://sekolahbebaz.pages.dev/ (mode "Jalan-jalan", tanpa login — tidak ada layar username wajib; formulir "Bikin KTA" opsional, nama "Budi Santoso" TIDAK dimasukkan karena situs melarang nama lengkap publik). Avatar default berlabel "🚶 kamu".

### Karakter pemain — yang terlihat di layar
- Gaya: chibi low-poly, semua bentuk membulat/kapsul, tanpa leher/telinga/hidung/alis.
- Proporsi: kepala SANGAT besar — diameter ≈ lebar badan, tinggi kepala ±28–30% dari tinggi total; torso kapsul ±35–40%; kaki ±20–22%; sepatu ±8–10%. Kepala besar, badan pendek-gemuk, kaki pendek.
- Kepala: bola sempurna, kulit cokelat muda/krem.
- Tutup kepala: SELURUH atas kepala ditutup topi/peci setengah bola (dome) BIRU LANGIT cerah, tepi bawah lurus horizontal tepat di atas mata, TANPA pinggiran/brim (dari depan), tanpa poni, tanpa rambut terlihat.
- Wajah (depan saja): dua mata hitam besar oval vertikal + titik kilau putih kecil, dua bulatan pipi/blush merah muda, satu senyum kecil melengkung cokelat gelap.
- Badan: kapsul vertikal MERAH KORAL/salmon, bahu membulat, lebar ≈ kepala. Di tengah dada depan: satu persegi panjang vertikal KUNING KEEMASAN (seperti saku).
- Tangan: dua kapsul tipis merah koral, menggantung lurus ke bawah sampai pertengahan paha; ujung pergelangan manset putih balok persegi kecil; telapak bola kecil warna kulit.
- Kaki: dua kaki terpisah, lurus sejajar, silinder/balok tipis HITAM pekat/abu sangat gelap, celah kecil di antaranya.
- Sepatu: dua balok putih chunky/kotak, datar, sedikit lebih lebar dari kaki, tanpa tali.
- Label nama: pil kuning di atas kepala, teks biru gelap "🚶 kamu". NPC berlabel pil putih berisi @username.
- Penanda pemain (bukan badan): silinder transparan kemerahan membungkus karakter + cakram lingkaran merah di tanah + kilau putih belah ketupat melayang.

### Cara berjalan (tahan tombol "Maju" ▲ ±25 dtk dan ±55 dtk)
- **GLIDE/SLIDE murni — pose TETAP PERSIS sama seperti saat diam**: kaki tetap lurus, rapat, menapak rata tanpa terangkat; tangan tetap menggantung lurus TANPA berayun; badan tetap tegak vertikal tanpa membungkuk, TANPA naik-turun/lompat (0 bobbing); kepala tidak menunduk/miring. Kecepatan lambat dan konstan.
- Kamera orang-ketiga SELALU menampilkan wajah dari depan: tombol "Putar kiri/kanan" + seretan memutar sudut pandang, tapi karakter tetap menghadap kamera — sisi belakang murni karakter pemain TIDAK berhasil diperoleh (tampak belakang hanya bisa diperkirakan dari NPC: punggung kepala polos kulit, topi setengah bola, torso polos tanpa patch kuning).
- NPC: template lebih sederhana — kepala bola + torso kapsul warna baju bervariasi, TANPA tangan, bawahnya satu kerucut terpotong abu-abu, tanpa sepatu.

### DISKREPANSI vs ekstraksi kode (Ronde 6, Tugas 1) — CATAT, jangan diabaikan
- Ekstraksi kode mengklaim animasi jalan: kaki rot.x = sin(t·11)·0,55·gerak, tangan berlawanan fase ·0,6. **Visual menunjukkan TIDAK ADA ayunan sama sekali** (glide, pose tetap). Kemungkinan: kode ayunan itu bukan jalur jalan D-pad (mungkin lari/emote/NPC/jalur lain), atau `gerak` tidak ter-set saat jalan via D-pad. **Rebuild Ronde 6 menambahkan ayunan kaki/tangan berdasarkan ekstraksi kode — kalau pemilik/vonis berikutnya bilang jalan Kosan harus ngesot kayak bebaz (tanpa ayunan), cabut ayunannya, sisakan glide.**
- Ekstraksi kode mengklaim topiBalik (brim topi di BELAKANG -z). Visual tidak bisa mengonfirmasi (tidak ada tampak belakang pemain; NPC belakang: topi setengah bola polos, brim tidak terlihat). Brim-belakang di rebuild Ronde 6 = dari kode, belum terverifikasi visual.
- Yang COCOK antara kode dan visual: kepala r 0,27 (±28–30% tinggi), jaket varsity merah #E5484D + panel kuning #FFD447, kulit #E0A97E, topi dome biru, sepatu putih, kaki gelap, manset putih, 0 bobbing di jalan.

## Ronde 7 — Port kontrol + kamera open-world-fantasy (8 Nov 18:22–19:xx WITA)

### Pemicu
Vonis pemilik 8 Nov 18:21 (dari HP, ground truth, frustrasi): "aneh banget cok kontrolnya, buat kayak game open-world-fantasy aja, lu buat kontrol analog dan kamera aja ga beres". Tiga skema sudah dicoba dan SEMUA ditolak: D-pad avatar-relative (ronde 1-3) → joystick avatar-relative (ronde 4-5) → joystick camera-relative + rotateCamera (ronde 6, playtest browser 7/7 tapi tetap ditolak pemilik di HP). Perintah: PORT skema kontrol + kamera dari game open-world-fantasy pemilik (sudah dia suka, terbukti nyaman) — JANGAN rancang skema keempat dari nol.

### Sumber (dibaca langsung, bukan dari ingatan)
- `~/workspace/open-world-fantasy/js/controls.js` (130 baris, fungsi murni)
- `~/workspace/open-world-fantasy/js/main.js` (joystick ~276-330, kamera orbit + pinch ~334-430, gerak per-frame ~480-560)
- `~/workspace/open-world-fantasy/js/config.js` (SPEED + CAMERA)
- `~/workspace/open-world-fantasy/css/style.css` (joystick 120px/50px) + `index.html` (markup `#joystick > #stick`)

### Yang di-port (file/baris)
- PURE (blok baru di kosan-3d.html, menggantikan `mergeInput`/`faceMove`/`lerpAngle`/`moveStep`/`clamp1`):
  - `clampJoystick` (controls.js) — normalisasi defleksi ke lingkaran satuan.
  - `deadzoneLatch` (controls.js) — histeresis: mulai >0,15, berhenti <0,08 (penangkal "kejang": getar jempol tidak membuat karakter nyala-mati).
  - `turnToward` (controls.js) — belok jalur terpendek, alpha 0..1.
  - `moveVector` (controls.js) — camera-relative, joystick atas (y=-1) = maju; vektor satuan.
  - `clampCamera` (controls.js) — pitch [-0,15, 1,1].
  - `cameraPos` (controls.js) — orbit: `hDist = dist*cos(pitch)`, `y = max(target.y + sin(pitch)*dist + 1,2, 0,5)` (tanah Kosan datar → lantai 0,5 m).
  - `zoomByPinch` / `zoomByWheel` (controls.js) — clamp `[KOSAN_CAM.min, KOSAN_CAM.max]`.
  - `SPEED = { walk: 4, run: 7 }` (config.js) + `KOSAN_CAM = { dist: 9,5, min: 3, max: 12 }` (dist awal 9,5; min/max fantasy).
- Joystick (main.js ~276-330, verbatim): `joy = {x, y, active, id}`, `joyCenter()` (rad = width/2 = 60), pointerdown (abaikan jari ke-2, setPointerCapture), pointermove (clampJoystick + stick visual `translate(j.x*32, j.y*32)`), `endJoy` di pointerup/cancel. Nilai joy MENTAH — deadzone diterapkan per-frame di animate, bukan di handler.
- Kamera orbit + pinch (main.js ~334-430, verbatim): `canvasPointers` Map, `camDrag`, `pinch = {d0, dist0}`, drag 1 jari = orbit (0,005 rad/px, `camYaw -= dx*0,005`, pitch clamp), pinch = zoomByPinch, wheel = zoomByWheel (passive:false), `endCam` dengan re-baseline pinch (jari ke-3 lepas) + jari sisa jadi drag orbit baru.
- Gerak per-frame (main.js ~480-560, verbatim): `deadzoneLatch(rawMag, wasMoving)` → `moveVector(joy, camYaw)` → run latch (`wasRunning ? mag>=0,75 : mag>=0,9` → SPEED.run/walk) → `move = speed*mag` → posisi axis-separated (x lalu z — Kosan: clamp YARD + `collideBuilding` + dorong meja, dipertahankan) → hadap `turnToward(rot, atan2(dir.x, dir.z), min(1, dt*12))`. TANPA ramp, TANPA turn rate terpisah. Moonwalk mustahil secara konstruksi.
- Kamera follow (main.js): `camTarget.lerp(avatar.position, 0,15)` → `cameraPos(camTarget, camYaw, camPitch, camDist)` → `lookAt(camTarget.x, camTarget.y+1,5, camTarget.z)`.
- Nilai awal kamera — dicek hitungannya, bukan asal: camTarget (0,0,12) [posisi avatar, y=0], camYaw 0, camPitch 0,35, camDist 9,5 → kamera (0, 4,46, 20,92), lookAt (0, 1,5, 12) ≈ framing spawn lama (0, 4,5, 21) / target (0, 1,2, 12).
- Fly "Lihat kamarku" diimplementasikan ulang di atas kamera baru: `flyToDoor(n)` menghitung state orbit yang framing akhirnya SAMA PERSIS dengan fly lama (kamera (p.x, p.y+1,6, p.z+6) menatap (p.x, p.y, p.z)): camTarget (p.x, p.y-1,5, p.z) [supaya lookAt +1,5 mendarat di pintu], camYaw 0, camDist = hypot(6, 1,9) = 6,29, camPitch = asin(1,9/6,29) = 0,307 [supaya y kamera = (p.y-1,5)+1,9+1,2 = p.y+1,6]. Selama fly, camTarget/camYaw/camPitch/camDist di-lerp (k = 1-exp(-2,5*dt), camYaw via turnToward); selesai saat kamera < 0,2 m dari posisi fly akhir. Sentuhan kanvas membatalkan fly (dulu: event 'start' OrbitControls).

### Yang DICABUT (total, bukan ditumpuk)
- OrbitControls: import + entri importmap + `new OrbitControls` + semua `controls.*` (target, update, enabled, min/maxDistance, maxPolarAngle, listener 'start'). **vendor/three/OrbitControls.js TIDAK TERPAKAI lagi — parent: buang dari daftar deploy (22 file -> 21 file).**
- `rotateCamera` (ronde 6) — heading/kamera sekarang murni state camYaw.
- `mergeInput` / `faceMove` / `lerpAngle` / `moveStep` / `clamp1` (ronde 4-6).
- Handler joystick ronde 4-6 (`joyUpdate`, `joyReset`, `JOY_R`, `joyId`) + **fallback window ronde 5 DICABUT** (skema fantasy mengandalkan setPointerCapture saja — terbukti di HP pemilik; kalau playtest otomasi menunjukkan capture bocor lagi, itu artefak browser otomasi, fallback bisa dipasang lagi tanpa mengubah rasa di HP) + reset saat window blur.
- Bookkeeping window ronde 5 untuk pinch + listener window capture-phase yang menyembunyikan jari ke-2 dari OrbitControls (digantikan capture + re-baseline fantasy).

### Yang sengaja TIDAK di-port (dan kenapa)
- `isTap` (controls.js): hanya untuk tombol yang berbagi layar dengan drag (tombol lompat fantasy). Ketuk pintu/teras/Ibu Kosan pakai handler sendiri (gerak<=10px + durasi<=1000ms, sudah lolos 7/7) — logikanya TIDAK DIUBAH, hanya wiring-nya disesuaikan (tes ketuk kini `canvasTap(e, wasPinch)` dipanggil dari pointerup/cancel kanvas, lalu `endCam`).
- `stepVertical` / `resolveVertical` / `easeToward` / `collidesAt`: gravitasi, lompat, air, tabrakan medan fantasy. Kosan: tanah datar y=0, tanpa lompat/air; tabrakan tetap `collideBuilding` + TABLE_BOX Kosan.
- CSS joystick fantasy: alas 120px + knob 50px ≈ Kosan 120px/52px — CSS Kosan DIPERTAHANKAN (posisi left 16px/bottom 16px sama).
- Keyboard (WASD/panah): fantasy TIDAK punya input keyboard gerak (hanya chat) — keyboard Kosan dipertahankan sebagai tambahan, digabung ke vektor joy via `clampJoystick` (perlu buat playtest desktop; tidak mengubah rasa sentuh).

### Yang TIDAK diubah
- Karakter bebaz (`makeBebazAvatar` + ayunan kaki/tangan + idle sway — tetap; `gerak` kini = mag ter-latch, bukan hypot(fwd, turn)).
- Ibu Kos (`makeChibi({bun, dress})`), fungsi kamar (Budi Santoso = Kamar 3 + KOSAN-03-BUDI), kartu kamar, papan, hit-proxy, ambang ketuk, posisi/ukuran joystick di layar, HUD, tombol Misi/KTA, toggle debug lama, overlay `?debug=joy` (isi disesuaikan variabel baru: `joy x/y | mag | camYaw rot | id | dist`).

### Insiden saat pengerjaan (dicatat supaya tidak terulang)
- Splice animate pertama MERUSAK file: `h.index('</script>')` menemukan penutup **importmap** (awal file), bukan penutup modul — karena `e < s`, splice MENGGANDAKAN isi file (53 KB -> 103 KB, dua salinan modul). Terdeteksi dari grep (dua `var clock`, dua `animate();`, 103.383 byte) dan DIPERBAIKI dengan memotong pada marker unik ujung animate baru (`animate();\n\n</script>`, 1 kemunculan) + menutup `</script></body></html>`. File akhir 55.024 byte, 1 DOCTYPE / 1 importmap / 1 modul. **Aturan: splice Python WAJIB memastikan start < end dan memverifikasi jumlah kemunculan marker SEBELUM menulis; untuk penutup modul pakai `<script type="module">` + pencarian dari akhir, jangan `index('</script>')` mentah.**

### Verifikasi
- `node --check` modul diekstrak (47.746 byte) → **lolos**.
- Simulasi node `/tmp/sim-r7.js` (PURE verbatim + harness replika matematika animate) → **35/35 LULUS**: kamar utuh (Budi=3, KOSAN-03-BUDI); clampJoystick; deadzoneLatch histeresis (0,10 diam=berhenti, 0,16 diam=jalan, 0,10 jalan=TETAP jalan, 0,07 jalan=berhenti); moveVector 4 arah + camYaw 90°; turnToward lewat ±PI (3,0->-3,0 = 3,1416); clampCamera; cameraPos spawn (0, 4,46, 20,92) ≈ lama (0, 4,5, 21); zoom pinch/wheel + clamp; gerak 1 dtk — ATAS penuh z 12->5 (RUN 7, mag 1,0>=0,9), BAWAH z 12->17 (RUN + mentok pagar), KANAN x 0->7, DIAGONAL (4,95, 7,05) rot 2,36, ATAS setengah z 12->10 (walk 4 × 0,5, proporsional), LEPAS 0,5 dtk posisi tetap (berhenti instan), LARI 0,95 z 12->5,35, histeresis lari (0,8 sesudah lari tetap RUN z 8,68->3,08; 0,8 dari diam = WALK z 8,8), TABRAKAN gedung mentok z=-5,0, DEADZONE 0,10 tidak bergerak; FLY pintu 3: kamera akhir (0, 2,80, 1,90) = fly lama, lookAt y+1,5 = 1,2 = pusat pintu.
  - Catatan: 4 ekspektasi awal simulasi SALAH (mengira defleksi penuh = walk 4; nyatanya fantasy: defleksi penuh mag>=0,9 = RUN 7 — port verbatim, bukan bug). Ekspektasi diperbaiki, 35/35 lulus.
- Grep: `OrbitControls` 0 (kode; tinggal 1 baris komentar penjelas pencabutan), `bobT`/`dpad`/`firebase`/`fetch(` 0, `controls.` 0, `avatarYaw`/`joy.fwd`/`joy.turn`/`joyId`/`JOY_R`/`joyUpdate`/`moveStep`/`faceMove`/`lerpAngle`/`mergeInput`/`rotateCamera`/`pinchActive` 0. Import tersisa satu: `import * as THREE from 'three';` (tidak ada import tak terpakai).
- **Yang parent masih perlu cek (tidak bisa dari kode):** deploy (21 file, TANPA OrbitControls.js) + playtest browser + vonis HP pemilik: (a) dorong atas = jalan menjauhi kamera, kanan = strafe kanan + kamera ikut (tanpa rasa dekay); (b) lepas joystick = berhenti langsung; (c) drag kanvas = orbit 0,005 rad/px, pitch clamp; (d) pinch + wheel = zoom 3-12; (e) "Lihat kamarku" = kamera terbang ke pintu lalu follow normal; (f) ketuk pintu 3 = kartu terbuka (regresi); (g) karakter + jalan tetap seperti ronde 6. Kalau masih terasa aneh, kenop yang boleh diubah: ambang run 0,9/0,75 atau SPEED walk/run — JANGAN tambah ramp atau turn rate terpisah (itu skema lama yang ditolak).

## Ronde 8 — Picker gender + outfit original "anak kos" (perintah pemilik 8 Nov 18:38)

Perintah pemilik: "karakternya di buat cowok cewek gak sih, karena yang main bukan cuma cowok, apalagi yang kebanyakan komen itu cewek, dan karakternya outfitnya jangan ngikutin si sekolahbebaz itu, kita desain sendiri". Info tambahan pemilik (screenshot Insights IG @ibu__kos, 8 Nov 18:40 — ground truth): audiens = **Wanita 77,4% / Laki-laki 22,6%**; usia terbesar 18–24 (45,2%), lalu 25–34 (22,6%), 13–17 (16,1%), 35–44 (12,9%), 45–54 (3,2%), 55+ 0%. Ini MEMVALIDASI default Cewek — jangan ubah default.

### Yang dikerjakan
- **Picker gender**: dua tombol `👧 Cewek` / `👦 Cowok` (`#genderRow`, di bawah namebar; desktop top 128px, mobile 142px; tombol aktif = biru Kosan #2E7FD6). Pilihan disimpan di localStorage `kosanGender`, dibaca saat load, **default Cewek**. Ganti pilihan → avatar langsung rebuild di tempat (posisi + hadap + nama + kamar TIDAK berubah, kartu tidak disentuh).
- **`makeBebazAvatar()` DIGANTI TOTAL jadi `makeKosanAvatar(gender)`** (return shape SAMA: `{g, tubuh, legL, legR, armL, armR}` — kode animate/kontrol tidak disentuh). Proporsi dipertahankan dari ronde 6 (kepala r 0,27 dari tinggi ~1,82, grup x1,1 = ~2,06 m); yang berubah hanya OUTFIT + RAMBUT. Wajah sama untuk kedua gender (mata hitam + kilau putih + pipi + senyum, di +z).
- **CEWEK (pilihan utama)**: rambut sebahu gelap (kubah atas garis rambut di atas mata + panel belakang kapsul sampai bahu + 2 jambul samping pembingkai wajah), kaus krem-kuning hangat polos `0xF6CE7D` (tanpa panel/saku), rok biru mengembang `0x2E7FD6` (nyambung gedung kosan; kerucut 0,30→0,44, y 0,35–0,85), kaki polos (kulit) + sepatu putih. Siluet: rok + rambut panjang = jelas beda dari cowok. 24 mesh.
- **COWOK**: rambut pendek gelap (kubah atas + rambut belakang bawah, tanpa topi), kaus teal polos `0x2A9D8F`, celana pendek khaki `0xD9C08A` (box 0,42×0,24×0,28 di pinggul), kaki polos + sepatu putih. 22 mesh.
- **Lengan pendek** (keduanya): lengan atas kaus (kapsul r 0,085, len 0,16) + lengan bawah kulit (kapsul r 0,06, len 0,2) + telapak kulit — beda dari lengan panjang jaket bebaz.
- **`buildVisitorAvatar()`**: bangun (ulang) avatar sesuai gender; dipanggil saat load + saat picker ditekan. Hadap (`rotation.y`) dipertahankan saat ganti gender; label nama (`avatarLabel.sprite`) dipindah ke grup baru; `?debug=nolabel` tetap dihormati. Grup lama di-`scene.remove` (geometri tidak di-dispose — toggle jarang, leak negligible).
- **Overlay `?debug=joy`**: posisi top digeser ke bawah baris gender (desktop 172px, mobile 186px) supaya tidak menutupi tombol picker saat debug aktif.

### Yang DICABUT (total)
- Outfit varsity bebaz: jaket merah `0xE5484D` (`jacketRed`), panel kuning dada `0xFFD447` (`shirtYellow`), topi aksen biru `0x2F8FEA` (`capAccent`), celana gelap `0x1E1E24` (`pantsDark`) — definisi material + semua pemakaian. Grep: `E5484D`/`FFD447`/`2F8FEA`/`jacketRed`/`shirtYellow`/`capAccent`/`pantsDark`/`topi dibalik`/`makeBebazAvatar` = **0**.
- Material yang DIPERTAHANKAN (bukan outfit): `skinBebaz` (kulit), `eyeDark`/`cheekPink`/`smileBrown` (wajah), `shoeWhite` (sepatu), `hairDark` (rambut), `dressBlue` (dipakai ulang untuk rok — biru gedung Kosan).

### Yang TIDAK diubah
- Kode kontrol/kamera ronde 7 (moveVector, turnToward, deadzoneLatch, cameraPos, joystick, orbit, pinch, fly "Lihat kamarku") — TIDAK DISENTUH SAMA SEKALI (playtest ronde 7 sedang jalan).
- Fungsi kamar (Budi Santoso = Kamar 3 + KOSAN-03-BUDI — gender TIDAK memengaruhi kamar), kartu kamar, papan, ketuk pintu/teras, hit-proxy, ambang ketuk, HUD, Misi/KTA, toggle debug lama, Ibu Kos (`makeChibi({bun, dress})`), animasi jalan (ayunan kaki/tangan dari pivot, y SELALU 0, 0 bobbing).

### Verifikasi
- `node --check` modul diekstrak (58.083 byte) → **lolos**. Struktur file: 1 DOCTYPE / 1 importmap / 1 modul.
- Harness node `/tmp/harness-r8.js` (stub THREE minimal, ekstrak `M` + `makeKosanAvatar` + PURE verbatim dari file) → **SEMUA LOLOS**: kedua gender parts lengkap + pivot kiri/kanan berbeda objek; TIDAK ada warna varsity di varian mana pun; cewek: kaus krem + rok biru (cylinder 0x2e7fd6, 1x) + rambut 4 mesh + mata/pipi lengkap; cowok: kaus teal + shorts khaki (box 0xd9c08a, 1x) + rambut 2 mesh + mata/pipi lengkap; cewek TIDAK mengandung warna cowok dan sebaliknya; `roomFor('Budi Santoso') = 3`, `makeId = 'KOSAN-03-BUDI'`, roomFor stabil (case-insensitive).
- **Yang parent masih perlu cek (tidak bisa dari kode):** deploy + playtest browser + vonis HP pemilik: (a) tombol 👧/👦 terlihat jelas di HP + ganti gender langsung rebuild tanpa reset nama/kamar; (b) varian Cewek kelihatan paling cakep (ini pilihan utama — mayoritas pemain cewek 18–24); (c) siluet cewek vs cowok jelas beda (rok + rambut panjang vs shorts + rambut pendek); (d) depan vs belakang tetap jelas beda di kedua gender; (e) jalan tetap menapak tanpa lompat di kedua gender. Catatan: ronde 7 (kontrol fantasy) dan ronde 8 (gender/outfit) adalah dua perubahan yang belum digabung dalam SATU playtest — playtest berikutnya harus mencakup keduanya sekaligus.

## Ronde 9 — Joystick mengambang ala Mobile Legends (perintah pemilik 8 Nov 19:03)

Perintah pemilik: "analognya jangan di kunci di satu tempat, contohnya bagusnya kayak analog game-game lain kayak mobile legends gak ngunci di satu titik, jadi enak". Artinya: joystick HARUS MENGAMBANG (floating/dynamic) — muncul di mana jempol nempel, bukan terkunci di satu titik kiri bawah.

### Yang dikerjakan
- **Joystick tetap DICABUT, diganti joystick mengambang**: `#joy` tidak lagi punya posisi tetap (`left:16px; bottom:16px` + aturan `body.card-open #joy { bottom:256px }` DICABUT). `#joy` sekarang `display:none` + `pointer-events:none` — MURNI VISUAL; semua sentuhan masuk ke kanvas. Sentuh di KIRI layar → `joyShow()` memunculkan alas 120px di titik sentuh (dijepit ke dalam layar: `cx = clamp(x, 60, W-60)`, `cy = clamp(y, 60, H-60)`); knob mengikuti jari (`translate(j.x*32, j.y*32)`); lepas → `joyHide()` (display none + input reset 0). Elemen `#joy`/`#joyKnob` yang sama dipakai lagi — tidak ada elemen baru.
- **Asal joystick = titik sentuh (`joy.ox/oy`)**: input = `clampJoystick((jari − asal)/60)` — dari titik asal MANA PUN arahnya benar (atas = maju, kanan = kanan, bawah = mundur). Jepitan visual di tepi layar TIDAK mengubah input (input dihitung dari titik sentuh asli; hanya alasnya yang bergeser supaya tidak terpotong — knob bisa berjarak ≤60px dari jari persis di tepi layar, kasus tepi saja).
- **SATU handler kanvas, bercabang wilayah + pointerId** (pengganti handler `joyEl` terpisah + handler kanvas lama):
  - `pointerdown` kiri (`x < 45% lebar`, konstanta `JOY_ZONE_W = 0.45`) → joystick (`joyStart`), pointer TIDAK masuk `canvasPointers` (tidak pernah jadi pinch/orbit). Jari ke-2 di kiri → diabaikan total (bukan joystick, bukan ketuk).
  - `pointerdown` kanan → orbit kamera (`camDrag`) / pinch (2 jari kanvas → `pinch`, logika fantasy tetap). Jari ke-2 di kanan saat joystick aktif → orbit (dua jempol independen: jalan + putar barengan).
  - `pointermove`: pointer joystick → `joyMove`; pointer kanvas → pinch zoom / orbit (fantasy, tidak diubah).
  - `pointerup`/`pointercancel` → `canvasPointerEnd`: tes ketuk dulu, lalu `endJoy` ATAU `endCam` sesuai pointerId.
- **KETUK tetap jalan di mana saja**: `downPos`/`downTime` global DIGANTI `tapInfo` Map per-pointer (`{x, y, t}` dicatat tiap pointerdown yang di-routing). Saat lepas: gerak ≤10px + durasi ≤1000ms (ambang lama yang sudah lolos, TIDAK diubah) → raycast pintu/teras/Ibu — walau joystick sempat muncul saat sentuh kiri. Gestur 2 jari bukan ketukan (tapInfo kedua jari pinch dihapus saat pinch mulai + flag `wasPinch`).
- **Jaring pengaman lepas joystick**: listener `window pointerup`/`pointercancel` — kalau pointer capture kanvas bocor dan pointerup luput dari kanvas (pernah kejadian di browser otomasi, ronde 5), window ikut mematikan joystick supaya tidak nyangkut jalan terus. Tidak mengubah rasa di HP (di sana kanvas selalu dapat pointerup-nya; pemanggilan kedua no-op karena `endJoy` memeriksa `joy.active` + id). Kamera tidak butuh jaring ini (camDrag nyangkut = tidak berbahaya: tidak ada move yang masuk tanpa capture).
- **Hint diperbarui**: "Sentuh kiri layar buat jalan · seret kanan putar kamera · cubit buat zoom · ketuk pintu kamar" (hint lama yang bilang joystick ada di kiri bawah diganti).
- **Overlay `?debug=joy`**: ditambah asal joystick — format baru `joy x/y | mag | ox/oy | camYaw rot | id | dist` (ox/oy = titik sentuh joystick, px).

### Yang TIDAK diubah
- Matematika gerak fantasy (moveVector, SPEED walk 4/run 7 + latch 0,9/0,75, turnToward dt*12, deadzoneLatch histeresis 0,15/0,08, clampJoystick) — TIDAK DISENTUH; blok PURE (baris 158–307) tidak berubah.
- Kamera (camYaw/camPitch/camDist, orbit 0,005 rad/px, pitch clamp, pinch/wheel zoom 3–12, fly "Lihat kamarku") — TIDAK DISENTUH.
- Fungsi kamar (Budi Santoso = Kamar 3 + KOSAN-03-BUDI), kartu kamar, papan, picker gender + kedua outfit (ronde 8), HUD, Misi/KTA, toggle debug lama, Ibu Kos, animasi jalan (0 bobbing).
- `joyCenter()` DICABUT (asal bukan lagi tengah elemen — asal = titik sentuh). Listener `joyEl` (pointerdown/move/up/cancel/contextmenu) DICABUT SEMUA — `#joy` tidak lagi menerima event.

### Verifikasi
- `node --check` modul diekstrak (52.294 byte) → **lolos**. Struktur file: 1 DOCTYPE / 1 importmap / 1 modul.
- Harness node `/tmp/harness-r9.js` (ekstrak PURE + wiring slice `JOY_R .. pulseDoor` VERBATIM dari file, DOM palsu layar HP 390×844) → **33/33 LOLOS**: kamar utuh; joystick mengambang dari 3 titik asal (atas/kanan/bawah → arah benar + moveVector benar); ambang deadzone latch (5px belum jalan, 10px jalan); ketuk kanan → raycast + kartu kamar 3; ketuk kiri → joystick sempat muncul TAPI kartu tetap terbuka + joystick hilang; ambang ketuk (gerak 60px / durasi 1500ms → BUKAN ketuk); dua jempol bersamaan (joystick + orbit independen, lepas joystick tidak membunuh orbit); pinch dua jari kanan → zoom in; jari ke-2 kiri diabaikan (joy.id tidak berubah, geraknya tidak mengubah joy); jepit alas di pojok layar (left 0px, top 724px) + input dari titik sentuh asli tetap benar; jaring pengaman window mematikan joystick saat kanvas luput pointerup; sentuh kanvas membatalkan fly; pointer joystick tidak masuk canvasPointers.
- Grep: `bobT`/`dpad`/`firebase`/`fetch(` = **0**; `downPos`/`downTime`/`joyCenter` = 0 di kode (tinggal 1 baris komentar penjelas); `#joy` tidak lagi punya `left/bottom` tetap; `joyEl` hanya dipakai untuk `style` (visual).
- **Yang parent masih perlu cek (tidak bisa dari kode):** deploy + playtest browser + vonis HP pemilik: (a) sentuh kiri layar di titik mana pun → alas muncul di situ + karakter jalan ke arah yang benar; (b) sentuh kanan → kamera mengorbit (bukan joystick); (c) dua jempol: jalan + putar kamera barengan; (d) ketuk pintu (kiri maupun kanan) tetap membuka kartu; (e) pinch zoom tetap jalan; (f) lepas joystick → alas hilang + karakter berhenti langsung. Catatan: playtest gabungan ronde 7+8 sedang jalan di browser saat ronde 9 dibangun — playtest berikutnya harus mencakup ronde 7 + 8 + 9 sekaligus (kontrol fantasy + gender + joystick mengambang).

## Ronde 10a — Rambut belakang + UI rapih (batch A; perintah pemilik 8 Nov 20:55)

Perintah pemilik: rambut belakang cewek + cowok aneh, router di luar (itu batch B), UI tidak rapih/tidak logis, gender jangan di dalam game (batch B), game harus multiplayer beneran (spek terpisah). Batch A ini hanya rambut + UI. JANGAN sentuh router/teras, gender/entry, kontrol, kamera, fungsi kamar.

### Diagnosis (screenshot langsung, jadi acuan perbaikan)
- **Cewek:** panel belakang lebar cuma ±55% kepala, datar kayak papan (tepi lurus, bawah bergerigi), kulit tan keliatan jelas di kiri-kanan panel → belakang kepala tampak botak di samping panel.
- **Cowok:** kubah cuma nutup ±40% atas kepala, pita lebar kulit telanjang di belakang kepala, PLUS bercak gelap di tengkuk (tester bilang itu jenggot depan yang "bocor" — dicek di kode: TIDAK ADA mesh jenggot/dagu sama sekali; bercak itu bola rambut belakang lama yang sempit, r 0,22, lebar 0,40 vs kepala 0,54).

### Yang dikerjakan — RAMBUT
- **Pola baru: cangkang (shell) + kubah + panel/jambul.** Cangkang = `SphereGeometry` sebagian (phiStart `PI/2 + 0,9`, phiLength `2PI − 1,8` → celah depan 1,8 rad menghadap +z = wajah; phi +z = PI/2 di Three.js), membalut belakang + samping kepala. Kubah atas ditenggelamkan ke dalam cangkang supaya tepinya yang lurus tidak keliatan dari belakang.
- **Cewek:** cangkang r 0,30 skala (1,03, 1,06, 0,98) → lebar 0,618 (> kepala 0,54), theta 0,62π (rim y ≈ 1,43); panel belakang kapsul r 0,19 len 0,22 skala (1,55, 1, 0,62) → lebar 0,589, di (0, 1,38, −0,21), bawah y ≈ 1,08 (sampai bahu, ujung membulat); 2 jambul samping kapsul r 0,065 len 0,28 di (±0,26, 1,28, 0,02), miring keluar 0,08 rad — menyatu dengan cangkang + panel jadi rambut panjang yang mengalir.
- **Cowok:** cangkang r 0,30 skala (1,0, 1,0, 0,97) → lebar 0,60 (> kepala 0,54), theta 0,66π (rim y ≈ 1,41 = tengkuk); bola belakang lama (r 0,22, lebar 0,40) DICABUT. Sisa kulit 1,28–1,41 di belakang = leher, wajar untuk potongan pendek.
- **Tidak ada mesh gelap depan yang nongol dari belakang:** mata/pipi/senyum semua di z > 0,2 dan |x| < 0,2 (di dalam celah wajah); cangkang + panel menutupi seluruh belakang kepala.

### Yang dikerjakan — UI
- **Hint:** boleh membungkus (`white-space: normal`, `max-width: calc(100vw − 24px)`, `text-align: center`) + jarak aman tepi bawah `calc(18px + env(safe-area-inset-bottom))`; mobile tetap `bottom: calc(148px + safe-area)`.
- **Label nama 3D:** diskalakan berdasar jarak kamera di animate (`ls = clamp(camDist/9,5, 0,35, 1,3)`; `sprite.scale.set(2,4*ls, 0,6*ls, 1)`) — zoom dekat (dist 3) label mengecil 0,35× jadi tidak menutupi gedung/langit; zoom jauh tetap terbaca (maks 1,3×).
- **Kartu kamar:** di desktop (min-width 421px) berlabuh kanan bawah (`width: 340px`, `right: 12px`) — avatar di tengah layar tidak tertutup; di HP tetap lembar bawah tapi max-height 200px + tombol ciutkan `▾`/`▴` (`#cardToggle`, di samping ✕) yang melipat kartu jadi judul saja (`#roomCard.min` menyembunyikan `#cardBody` + `#cardActions`); kartu baru yang dibuka selalu tampil penuh (openCard reset `min`).
- **Media query 390px diperiksa:** topbar 2 baris, namebar, genderRow, hint, kartu — semua muat rapi (tidak ada yang diubah selain hint + kartu di atas).

### Yang TIDAK diubah
- Router/teras, gender/entry (`#genderRow` apa adanya — batch B), kontrol fantasy + joystick mengambang (`JOY_ZONE_W 0,45`, `tapInfo`, ambang ketuk 10px/1000ms), kamera + fly, fungsi kamar, animasi jalan (0 bobbing), Misi/KTA, Ibu Kos, papan KOSAN DIBUKA.

### Verifikasi
- `node --check` modul diekstrak → **lolos**. Struktur: 1 DOCTYPE / 1 importmap / 1 modul. File 64.065 byte.
- Harness node → **22/23 lolos + 1 gagal palsu** (tes "tanpa kata jenggot/dagu" kena komentar penjelas saya sendiri yang menulis kata itu — komentar ditulis ulang tanpa kata tersebut, cek ulang **6/6 lolos**): kamar utuh (Budi Santoso = Kamar 3, KOSAN-03-BUDI); lebar rambut vs kepala — cewek cangkang 0,618 + panel 0,589, cowok cangkang 0,60 (semua > 0,54); panel sampai bahu; cangkang cowok turun ke tengkuk; jambul menyatu; skala label 0,35 @ dist 3 / 1,0 @ 9,5 / 1,26 @ 12; joystick + tap utuh; hint bungkus + safe-area; kartu dock kanan + ciutkan.
- Grep: `bobT`/`dpad`/`firebase`/`fetch(` = **0**; geometri rambut lama (backGeo 0,16 / bola 0,22) = 0.
- **Yang parent masih perlu cek (tidak bisa dari kode):** TIDAK ADA DEPLOY (tugas batch A lokal saja). Setelah batch B selesai + deploy: playtest browser — (a) rambut belakang cewek nutupin kepala penuh sampai bahu + tidak ada kulit di kiri-kanan panel; (b) rambut belakang cowok membalut sampai tengkuk + tidak ada bercak gelap; (c) zoom dekat: label nama mengecil, tidak menutupi gedung; (d) kartu di desktop di kanan bawah (avatar keliatan) + tombol ciutkan jalan di HP; (e) hint tidak terpotong di tepi bawah 390px. Vonis visual akhir tetap HP pemilik.

## Ronde 10b — Router ke ruang tamu dalam ("beda alam") + gender ke layar masuk (batch B; perintah pemilik 8 Nov 20:55 + 21:01)

Perintah pemilik: router jangan di luar (tidak ada orang naruh WiFi di atas meja di halaman depan); gender jangan dipilih di dalam game (orang bisa gonta-ganti); masuk kosan nanti "beda alam" kayak Museum 3D H2H. Batch B ini hanya router + layar masuk. Rambut + hint + label + kartu = batch A, TIDAK disentuh.

### Keputusan implementasi — ruang tamu: SCENE TERPISAH (bukan geometri di teras)

Dipilih scene THREE kedua (`livingScene`), bukan ruangan geometri di lokasi teras. Alasan:
- Sesuai perintah eksplisit pemilik ("beda alam", scene/ruang terpisah kayak Museum 3D) + MULTIPLAYER-SPEC §8 (realm = field di pesan; `'living'` sudah disiapkan sejak v1).
- Halaman tidak dirombak: `buildWorld()` TIDAK disentuh sama sekali; kamera/joystick/animate yang sama dipakai ulang dengan `myRealm` sebagai saklar (render + tabrakan + ketuk).
- Dinding satu-sisi menghadap ke dalam (plane FrontSide): kamera orbit tidak pernah terhalang dinding saat zoom-out — avatar selalu kelihatan dari sudut mana pun. Dari luar ruangan dinding tidak kelihatan, tapi halaman tidak pernah melihat interior (scene terpisah), jadi tidak ada yang aneh.
- Alternatif yang ditolak: ruangan geometri di teras — kamera orbit (dist 9,5) akan keluar ruangan dan dinding buram akan menutupi avatar di dalam; plus butuh melubangi tabrakan gedung. Scene terpisah menghindari keduanya.

### Yang dikerjakan — ROUTER → RUANG TAMU DALAM
- Router + 2 antena + LED hijau DICABUT dari meja teras terbuka (x=16, z=-2). Teras luar tetap ada (karpet, meja, kaki meja, bantal duduk, papan "RUANG TAMU", hit-proxy) sebagai tempat duduk — tanpa router.
- `buildLivingRoom()` (scene baru `livingScene`, dipanggil sekali saat load): ruangan 9×7 m, tinggi 3,2 m — lantai kayu, 4 dinding krem menghadap ke dalam + langit-langit menghadap bawah, lampu hemisphere hangat + point light di atas meja. Isi: karpet, meja kayu + 4 kaki, **router putih 2 antena + LED hijau di atas meja (sisi utara)**, 2 bantal duduk, papan "RUANG TAMU" di dinding utara, pintu KELUAR kayu di dinding selatan (bukaan 1,4 m + ambang atas + papan "KELUAR" + gagang kuning).
- Pindah alam: `enterLiving()` / `exitLiving()` (kontrak MULTIPLAYER-SPEC §8.3) — ganti scene, set `myRealm` (`'yard'`/`'living'`), avatar di-reparent antar scene (label nama ikut karena anak avatar), posisi halaman disimpan + dipulihkan, kamera di-snap ke avatar (camDist 5 di ruangan, pulih saat keluar), `flyTarget = null`. Jalan masuk: kartu Ruang Tamu (ketuk teras) → tombol "🚪 Masuk Ruang Tamu". Jalan keluar: ketuk pintu KELUAR di dalam, ATAU tombol kartu "Keluar ke Halaman", ATAU pil HUD "🚪 Keluar" (hanya tampil di alam living). `flyToDoor("Lihat kamarku")` dari dalam ruangan keluar dulu ke halaman baru terbang.
- Tabrakan per alam di `animate()`: `LIVING` {±4,0, ±3,0} + `LIVING_TABLE` {±1,1, −2,9…−1,3} (dinding + meja dalam); yard tetap `YARD` + `collideBuilding` + `TABLE_BOX` (tidak berubah perilakunya). Ketuk per alam: `livingClickables` vs `clickables`. Render: `renderer.render(myRealm === 'living' ? livingScene : scene, camera)`. Overlay `?debug=joy` ditambah `| realm yard/living`.
- `buildVisitorAvatar()` sadar alam: avatar ditambahkan ke scene alam aktif (jadi ganti gender dari overlay saat sedang di dalam ruangan tidak melempar avatar ke halaman).

### Yang dikerjakan — GENDER → LAYAR MASUK (MULTIPLAYER-SPEC §4)
- Overlay `#entryOverlay` (di atas dunia, dunia tetap kelihatan di belakang): judul, `#entryName`, `#genderRow` (PINDAH ke sini dari HUD — elemen yang sama, bukan duplikasi), tombol "Masuk Kosan", catatan "Nama & gender dikunci selama di dalam — keluar dulu untuk ganti."
- Auto-submit saat load DICABUT: nama tersimpan hanya mengisi awal field (di `showEntry()`); masuk harus ketukan eksplisit. Nama kosong → fokus kembali ke input, tidak masuk.
- `masukKosan()`: validasi → `ensurePlayerId()` (kunci permanen `kosan3d-id`, `'p'` + 8 char acak, dibuat sekali) → sinkron `nameInput` → `submitName(false)` (kamar + ID + label + kartu preview, perilaku lama) → `entered = true`, overlay tertutup, label identitas read-only `#whoami` di topbar ("👤 Budi Santoso · Cewek"), tombol "👤 Ganti karakter" muncul. Masuk ulang tanpa perubahan nama = sekadar tutup overlay (tidak submit ulang, tidak ada kartu pop-up lagi).
- `#genderRow` DICABUT TOTAL dari HUD (aturan CSS lamanya yang menaruhnya di bawah namebar ikut dicabut; `#namebar` tetap di HUD untuk preview kamar — ketik nama → kartu — tapi gender TIDAK berubah dari HUD). Ganti karakter hanya lewat overlay (tombol "Ganti karakter" di topbar, tampil sesudah masuk). `setGender()` tetap dipakai overlay (pilih SEBELUM masuk); listener-nya tidak berubah.
- `kosan3d-id` tersimpan di localStorage, tidak pernah dibuat ulang kalau sudah ada; tidak pernah ditampilkan di layar.

### Yang TIDAK diubah
- Rambut (batch A), hint, label nama 3D, kartu (batch A), kontrol fantasy + joystick mengambang (JOY_ZONE_W 0,45, tapInfo, ambang ketuk 10px/1000ms), kamera + fly (selain guard keluar-living), fungsi kamar, animasi jalan (0 bobbing), Misi/KTA, Ibu Kos (tetap di halaman), papan KOSAN DIBUKA, blok PURE. `LIVING_POS` lama (tidak terpakai) dibiarkan.

### Verifikasi
- `node --check` modul diekstrak → **lolos**. Struktur: 1 DOCTYPE / 1 importmap / 1 modul. File 78.277 byte.
- Harness node `/tmp/harness-r10b.js` (jalankan SELURUH modul verbatim di VM dengan stub THREE + DOM, layar 390×844, `?debug=joy`) → **60/60 LOLOS**: kamar utuh (Budi Santoso = Kamar 3, KOSAN-03-BUDI); overlay tampil saat load + belum entered + visitorRoom 0 + kartu tidak auto-buka + playerId belum dibuat; masuk (entered, room 3, ID, playerId pola `p`+8, localStorage 3 kunci, whoami, tombol Ganti karakter, kartu preview); ganti karakter via overlay (cowok → whoami Cowok → kembali cewek; masuk ulang nama sama tidak submit ulang); nama kosong ditolak; router halaman 0 / ruang tamu 3 (box + 2 antena) + LED 1/0 + pintu keluar di livingClickables + 6 plane dinding/langit-langit; pindah alam (realm, avatar re-parent, spawn (0, 2.5), camDist 5, tombol Keluar, posisi halaman dipulihkan (2, 8)); gerak + tabrakan di dalam ruangan lewat `animate()` ASLI (meja menahan z ≥ −0,9; dinding timur x = 4,0; dinding utara z = −3,0; debug realm living/yard); ketuk pintu 3 → kartu, teras → kartu + tombol Masuk → realm living, pintu keluar → yard; flyToDoor dari living keluar dulu; joystick mengambang utuh (asal, arah, lepas); kartu living di dalam = tombol Keluar ke Halaman.
- Grep: `bobT`/`dpad`/`firebase`/`fetch(` = **0**; router di koordinat teras lama (16, 0.58, −2) = **0**; `genderRow` di dalam `#entryOverlay` (cek Python) + 0 di area HUD.
- **Yang parent masih perlu cek (tidak bisa dari kode):** TIDAK ADA DEPLOY (tugas lokal saja). Setelah deploy: playtest browser — (a) overlay masuk tampil saat load (nama + gender terisi dari simpanan) + Masuk jalan; (b) di dalam game tidak ada lagi tombol gender di HUD; (c) ketuk teras → kartu → Masuk Ruang Tamu → interior tampil (router di atas meja dalam, hangat, dinding + langit-langit kelihatan) + avatar bisa jalan di dalam tanpa tembus dinding/meja; (d) keluar lewat pintu / tombol kartu / pil Keluar → kembali ke halaman di posisi semula; (e) "Lihat kamarku" dari dalam ruangan keluar dulu baru terbang. Vonis visual akhir tetap HP pemilik.

### Ronde 10c — Perbaikan ruang tamu (3 temuan playtest ronde 10)

Playtest ronde 10 lolos hampir semua, tapi menangkap 3 hal aneh di ruang tamu — diperbaiki di ronde ini SEBELUM link diserahkan ke pemilik. Tidak disentuh: rambut, overlay masuk, gender, kontrol, fungsi kamar, animasi.

### Yang dikerjakan — 1. PINTU KELUAR MENUTUPI AVATAR SAAT MASUK (bug)
- Biang: pintu KELUAR kayu menutup lubang pintu (0, 1.2, 3.45) tepat di antara kamera awal (selatan, z ≈ 7,2) dan avatar spawn (0, 2.5) — di layar awal cuma keliatan blok cokelat besar + label nama mengintip; baru setelah kamera diputar ketahuan itu pintu.
- Perbaiki (pilih yang paling bersih — tanpa engsel/animasi, tanpa pindah spawn): pintu SELALU terbuka, menempel rata di segmen dinding kiri (tengah −1,35, z 3,44 — 0,01 di depan dinding, tanpa z-fight; ujung kanan −0,7 tepat di tepi lubang). Lubang pintu x −0,7…0,7 bersih total; garis pandang kamera→avatar (x=0) tidak menyentuh pintu. Gagang kuning ikut pindah ke tepi bebas pintu (−1,85). Pintu tetap bisa diketuk untuk keluar (`userData card 'exit-living'`, tetap di `livingClickables`).

### Yang dikerjakan — 2. FRAMING KAMERA TIDAK KEMBALI SETELAH KELUAR (bug)
- Biang: `exitLiving()` men-snap `camYaw = 0` + cuma memulihkan `camDist`; `camPitch` tidak dipulihkan sama sekali — kamera ikut sudut dari dalam ruangan (lebih dekat/sudut lebih tinggi, gedung terpotong di tepi atas).
- Perbaiki: `savedYard` sekarang menyimpan `camYaw` + `camPitch` juga (saat masuk); saat keluar, ketiganya dipulihkan lewat `flyTarget` (mekanisme lerp yang sudah ada di `animate()`) — kembali HALUS, bukan snap. `flyToDoor("Lihat kamarku")` menimpa `flyTarget` ini belakangan kalau dipencet dari dalam ruangan — tidak bentrok. Sisa-sisa `flyTarget = null` + baris no-op di `exitLiving()` dibersihkan.

### Yang dikerjakan — 3. ISI RUANG TAMU (kosong banget)
- Interior tadinya cuma meja+router, alas merah, 2 bantal. Ditambah (palet yang sama: dinding krem, lantai cokelat, alas merah): sofa terakota di dinding barat menghadap TV (alas + sandaran + 2 sandaran tangan + 2 bantal duduk krem + 2 bantal lempar kuning/hijau), 2 kursi teal di dinding timur menghadap barat, meja kopi kayu di tengah karpet (+ 1 buku teal di atasnya), TV kecil di dinding timur menghadap sofa (bingkai kayu + layar gelap) + konsol kayu di bawahnya, 2 tanaman sudut (barat daya + timur daya, mengapit pintu masuk — pot + batang + 3 bola daun), hiasan dinding (2 bingkai di dinding utara mengapit papan RUANG TAMU + poster "SANTAI DULU" di dinding barat di atas sofa). Material baru: `sofaRust` (0xc96f4a), `tvScreen` (0x1a2028).
- Jalur jalan tengah (x −1…1, dari pintu ke meja router) tetap lega; perabot menempel dinding kecuali meja kopi (ruang lewat di kiri-kanannya). Tabrakan baru `LIVING_OBSTACLES` (7 kotak: sofa, 2 kursi, meja kopi, konsol TV, 2 tanaman) — avatar didorong keluar lewat sisi penetrasi terkecil (loop di `animate()`, setelah dorongan meja router yang tidak diubah). Spawn (0, 2.5) + jalur pintu→tengah bebas dari tabrakan.

### Yang TIDAK diubah
- Rambut, overlay masuk, gender, kontrol fantasy + joystick mengambang, fungsi kamar, animasi jalan (0 bobbing), Misi/KTA, Ibu Kos, papan KOSAN DIBUKA, blok PURE, `LIVING_POS` lama.

### Verifikasi
- `node --check` modul diekstrak (ulang dari file terbaru) → **lolos**. Struktur: 1 DOCTYPE / 1 importmap / 1 modul. File 84.091 byte, MD5 f88690bac844aea99a004381125337bd.
- Harness node `/tmp/harness-r10c.js` (PURE + `enterLiving`/`exitLiving` + blok tabrakan living diekstrak VERBATIM, stub THREE + DOM) → **36/36 LOLOS**: kamar utuh (Budi Santoso = Kamar 3, KOSAN-03-BUDI); masuk (realm living, savedYard simpan pos+rot+camDist/camYaw/camPitch, spawn (0,2.5) hadap PI, kamera dalam yaw 0/pitch 0,35/dist 5, masuk 2x no-op); keluar (realm yard, posisi avatar dipulihkan, flyTarget = framing halaman tersimpan, lerp halus konvergen < 300 frame, kamera akhir = framing halaman ±0,05, keluar 2x no-op); tabrakan (sofa dorong −3,1; meja kopi −0,2; konsol TV 3,5; tanaman dorong keluar; titik bebas + spawn + jalur pintu→tengah tidak berubah; meja router tetap dorong −0,9; 7 obstacle); pintu (posisi baru −1,35/3,44, posisi lama hilang, garis pandang kamera→avatar bersih, lubang pintu bersih, tetap bisa diketuk); router di DALAM (meja 0,−2,1 + antena + LED), 0 router di halaman; perabot baru ada di kode.
- Grep: `bobT`/`dpad`/`firebase`/`fetch(` = **0**.
- **Yang parent masih perlu lakukan:** TIDAK ADA DEPLOY (tugas lokal saja). Setelah deploy: playtest browser — (a) masuk ruang tamu → avatar TERLIHAT PENUH (pintu terbuka rata di dinding kiri, tidak menutupi); (b) putar/zoom kamera di dalam, lalu keluar → framing kembali halus ke sudut halaman sebelum masuk (gedung tidak terpotong); (c) interior terasa berisi (sofa, kursi, meja kopi, TV, tanaman, hiasan) + avatar tidak tembus perabot; (d) router tetap di dalam, teras tetap tanpa router. Vonis visual akhir tetap HP pemilik.

### Ronde 10d — Perbaikan pintu keluar + kamera kembali + papan terpotong + ruangan disederhanakan

Playtest fokus 10c (37 mnt, screenshot langsung) menemukan 2 perbaikan 10c yang BELUM lolos di live, walau harness 10c (36/36) bilang lolos — harness 10c hanya menguji matematika lerp + posisi, BUKAN loop animate asli dan BUKAN posisi kamera terhadap dinding. Ditambah perintah pemilik 22:33: ruangan disederhanakan (perabot 10c dicabut). Tidak disentuh: rambut, overlay masuk, gender, kontrol, fungsi kamar, animasi.

### Diagnosis — 1. PINTU KELUAR (klaim 10c "rata di dinding" TIDAK terbukti di live)
- Geometri pintu SUDAH rata: `exitDoor` pos (−1,35, 1,2, 3,44), skala (1,3, 2,4, 0,1), `rotY = 0` — menempel segmen dinding kiri, tidak miring. Klaim "mengayun ~90°" playtest adalah salah baca perspektif.
- Biang SEBENARNYA: kamera entry ruang tamu ada DI LUAR ruangan — `enterLiving` set `camDist = 5` dari spawn (0, 2,5) → kamera di (0, 2,91, 7,20), 3,7 m di selatan dinding (z 3,5), menatap lewat dinding satu-sisi yang tak kasat mata dari luar. Panel pintu 1,3×2,4 m dari jarak 3,99 m memenuhi kiri-tengah layar (lebar sudut ±18,5° vs setengah-FOV horizontal HP ±13,5°).
- Perbaiki: spawn digeser ke tengah ruangan `LIVING_SPAWN = { x: 0, z: -0,5, rot: Math.PI }` (menghadap meja router) + `camDist` entry 5 → 4 → kamera entry di (0, 2,57, 3,26) DI DALAM ruangan (0,24 m dari dinding selatan). Pintu KELUAR kini 84° dari sumbu pandang (di luar frame saat masuk); avatar penuh dalam frame (kepala 8,2°, kaki 18,5° < 27,5°); router (4,5°) + papan RUANG TAMU (12,7°) terlihat di frame masuk. Pintu tetap rata di dinding + tetap bisa diketuk.

### Diagnosis — 2. KAMERA KEMBALI GAGAL (kenapa pemulihan 10c gagal di live)
- (a) `camDist` SUDAH disimpan/dipulihkan (baris 889/918) — bukan biang. (b) Ketiga jalur keluar (pil "Keluar", tombol kartu, ketuk pintu) SEMUA memanggil `exitLiving()` yang sama — bukan biang. (c) Lerp `flyTarget` di loop animate ASLI: diuji dengan harness modul-utuh (`/tmp/harness-10d.js`, modul verbatim + stub THREE/DOM, `animate()` dipanggil frame demi frame) — fly BEKERJA SENDIRI: ketiga jalur selesai ~frame 106 dan kembali ke framing sebelum masuk (selisih ≤ 0,069, mayoritas ≤ 0,05).
- Biang SEBENARNYA: SATU sentuhan kanvas di tengah fly (~1,8 dtk) membatalkan pemulihan — handler `pointerdown` kanvas (baris 1525) selalu `flyTarget = null`. Playtest: tester keluar via pil lalu menyentuh/menyeret kanvas untuk memeriksa → fly mati di tengah jalan → kamera membeku di framing dalam (harness 5d: selisih yaw 0,219 / dist 0,336; dua screenshot identik = kamera statis, bukan animasi berjalan). Persis gambaran playtest: kamera dekat + miring dari kiri, avatar besar menghadap kamera, gedung miring, bangku besar, Ibu Kos terpotong.
- Perbaiki: bendera `flyKeep` — `exitLiving()` set `flyKeep = true` (fly pemulihan DILINDUNGI, pointerdown kanvas tidak membatalkannya); `flyToDoor` ("Lihat kamarku") set `flyKeep = false` (tetap bisa dibatalkan, perilaku lama); `enterLiving` membersihkan keduanya. Bonus: saat fly selesai, nilai kamera DIJEPRET TEPAT ke target (sisa lerp eksponensial dulu menyisakan selisih camDist sampai 0,07 > toleransi 0,05).

### Yang dikerjakan — 3. PAPAN "KOSAN DIBUKA" TERPOTONG (minor)
- Terkonfirmasi lewat sudut: dari kamera spawn, sudut atas papan 29,30° > setengah-FOV vertikal 27,50° (tengah papan 27,18°, nyaris pas) — ~40% atas papan terpotong.
- Perbaiki (satu baris + konsistensi): `camPitch` spawn 0,35 → 0,25 (baris 427 + nilai awal `savedYard` 751) → sudut atas papan 25,26°, muat dengan margin 2,2°. Papan tidak disentuh.

### Yang dikerjakan — 4. RUANGAN DISEDERHANAKAN (perintah pemilik 22:33)
- DICABUT dari `livingScene`: sofa terakota, 2 kursi teal, meja kopi (+buku), TV kecil + konsol, 2 tanaman sudut, 2 bingkai + poster "SANTAI DULU" — beserta `LIVING_OBSTACLES` (7 kotak) + loop tabrakannya di `animate()` + material tak terpakai `sofaRust`/`tvScreen`. Alasan: isi kosan dibangun lewat komen + like terbanyak; fasilitas muncul di 3D HANYA setelah dibangun di episode.
- PERTAHANKAN: meja kayu rendah + router di atasnya (pemenang Ep2, sudah dibangun — router tetap di meja kayunya sendiri seperti ronde 10b, BUKAN di meja kopi), alas merah + 2 bantal, papan "RUANG TAMU", dinding/langit-langit/lantai/lampu. Tabrakan meja router (`LIVING_TABLE`) tetap jalan. Ruangan kini: router + alas saja.

### Yang TIDAK diubah
- Rambut, overlay masuk, gender, kontrol fantasy + joystick mengambang, fungsi kamar, animasi jalan (0 bobbing), Misi/KTA, Ibu Kos, papan KOSAN DIBUKA, blok PURE, pintu KELUAR (posisi/rotasi sama, hanya kamera+spawn yang pindah).

### Verifikasi
- `node --check` modul diekstrak → **lolos**. Struktur: 1 DOCTYPE / 1 importmap / 1 modul. File 81.382 byte (dari 84.319).
- Harness node `/tmp/harness-10d.js` (MODUL UTUH verbatim + stub THREE/DOM, `animate()` asli dipanggil per frame, 390×844) → **SEMUA LOLOS**: kamar utuh (Budi Santoso = Kamar 3, KOSAN-03-BUDI); papan muat (25,26° < 27,5°); entry living kamera DI DALAM (0, 2,57, 3,26), pintu 84° dari sumbu pandang (di luar frame), avatar penuh (8,2°/18,5°), router + papan RUANG TAMU terlihat; keluar via PIL / TOMBOL KARTU / KETUK PINTU — selisih kamera vs sebelum masuk **0,000** (yaw/pitch/dist, selesai frame 106); sentuhan kanvas di tengah fly (frame 30) TIDAK membatalkan (fly bertahan, selesai Δ 0,000); router tetap di dalam ruangan.
- Grep: `LIVING_OBSTACLES`/`sofaRust`/`tvScreen`/`SANTAI` = **0**; `bobT`/`dpad`/`firebase`/`fetch(` = **0**.
- **Yang parent masih perlu lakukan:** TIDAK ADA DEPLOY (tugas lokal saja). Setelah deploy: playtest browser — (a) masuk ruang tamu → ruangan + avatar penuh, TANPA panel pintu besar di kiri-tengah; router + papan RUANG TAMU kelihatan; (b) putar/zoom kamera di dalam, lalu keluar via pil / tombol kartu / ketuk pintu (coba sentuh kanvas juga saat baru keluar) → framing kembali SAMA dengan sebelum masuk; (c) papan KOSAN DIBUKA utuh di layar spawn; (d) ruangan sederhana (router + alas + bantal saja, tanpa sofa/TV/tanaman/poster). Vonis visual akhir tetap HP pemilik.

### Ronde 10e — Perbaikan 3 temuan playtest 10d + router tertutup (SEBELUM link ke pemilik)
Playtest 10d (42 mnt): pintu saat masuk LOLOS, ruangan sederhana LOLOS, papan atap LOLOS, regresi LOLOS. Yang diperbaiki di sini: (1) ketuk pintu KELUAR mati, (2) kamera kembali ~10% lebih dekat, (3) seret di tengah fly pemulihan, (4) router tidak terlihat saat masuk (tertutup avatar).

#### Diagnosis (harness, bukan teori)
1. **Ketuk pintu mati — BUKAN raycast rusak, tapi affordance salah.** Uji raycast dengan Three.js ASLI (`/tmp/harness-r10e-ray.mjs`, geometri + kamera direplika persis): ketuk TENGAH panel pintu dari kamera orbit → `exit-living` (kena). Yang mati: papan "KELUAR" (x 0, di atas LUBANG) dan lubang pintu (x 0, kosong) → 0 hit, karena keduanya TIDAK ada di `livingClickables`. Panel yang bisa diklik malah di x −1,35 (menempel dinding kiri) dan terbaca sebagai dinding. Jadi 4+ ketukan tester (tengah pintu / papan / tepi / samping pintu) semuanya mendarat di lubang + papan yang memang mati. Handler ketuk sendiri benar (`targets = living ? livingClickables : clickables`, `card 'exit-living' → exitLiving()`).
2. **Kamera ~10% lebih dekat — fly + snap 10d TERBUKTI tepat; biangnya `camTarget` tidak disimpan.** Harness fly (`/tmp/harness-r10e-fly.mjs`, kode PURE asli + replika verbatim blok fly/follow animate): fly bersih pil → selisih vs baseline SEBENARNYA 0,000 (92 frame). Satu-satunya selisih kode-vs-baseline: `savedYard` hanya menyimpan posisi avatar sebagai target bidik, padahal `camTarget` tertinggal di belakang avatar saat jalan (follow lerp 0,15/frame): masuk tepat saat avatar berhenti → lag 0,378 m → framing pulih bergeser 0,378 m (≈65 px tepi + tampak lebih dekat). Setelah diam 0,5 dtk lag tinggal 0,003 m. Inilah kenapa harness 10d "lolos palsu": ia membandingkan hasil akhir DENGAN nilai simpanan yang sudah salah, bukan dengan baseline sebenarnya. Jalur pil / tombol kartu / ketuk pintu semuanya memanggil `exitLiving()` yang sama (tidak ada pemulihan berbeda) — beda "lebih dekat lagi" di jalur kartu konsisten dengan lag yang lebih besar pada run itu.
3. **Seret tengah fly:** fly pulih sendiri kalau input berhenti (drag −500px / pinch ke dist 3 di tengah fly → akhir tetap 0,000 setelah input lepas). Rusaknya kalau input BERLANJUT melewati snap (atau masih aktif saat screenshot) — framing akhir jadi framing seretan, bukan baseline.
4. **Router tertutup:** proyeksi dari kamera masuk menunjukkan router di px (960,574) — tepat di tengah layar, di dalam rentang badan avatar (x 883–1036). Avatar di x 0 tepat menutupi router dari kamera selatan.

#### Perbaikan (hanya `kosan-3d.html`, surgical)
1. **Pintu KELUAR jadi pintu beneran:** panel pindah ke DALAM lubang (x 0, lebar 1,42 menutup lubang 1,4, z 3,44) + gagang kuning pindah ke panel (x 0,45) + papan "KELUAR" ikut BISA DIKETUK (`userData {card:'exit-living'}`, masuk `livingClickables`). Aman buat layar masuk: kamera masuk di z 3,26 DI DALAM ruangan, panel di z 3,44 ada DI BELAKANG kamera — tidak menutupi avatar (masalah 10c dulu karena kamera masih di luar, z 7,2). Kini ketuk di mana saja pada rakitan pintu (panel / papan / lubang) → `exitLiving()`, jalur yang sama seperti pil.
2. **Kamera kembali:** `savedYard` kini menyimpan `camTarget` ASLI (`{x,y,z}` saat masuk), dan `exitLiving()` memakai itu sebagai target bidik fly (bukan posisi avatar). Ketiga jalur keluar (pil / tombol kartu / ketuk pintu) tetap satu `exitLiving()` yang sama.
3. **Input selama fly pemulihan diabaikan:** handler `pointermove` (orbit/pinch) dan `wheel` (zoom) mengabaikan input selama `flyKeep` true — baseline drag/pinch tetap di-update supaya tidak ada lompatan saat fly selesai. Joystick tetap jalan (hanya orbit/zoom yang diabaikan). "Lihat kamarku" tetap bisa dibatalkan seperti biasa (`flyKeep=false` di jalurnya, guard tidak aktif).
4. **Router terlihat:** `LIVING_SPAWN.x` 0 → 1,2 — avatar geser ke samping, router terlihat di kiri avatar saat masuk. Kamera tetap di dalam ruangan (1,2, 2,57, 3,26), pintu tetap di luar frame.

#### Verifikasi
- `node --check` modul diekstrak → **lolos**. Struktur: 1 DOCTYPE / 1 modul. File 83.208 byte (dari 81.382), MD5 cc538750… (lokal, BELUM deploy).
- Harness fly 10e (kode PURE asli + replika fly/follow): fly bersih 0,000; lag camTarget + fix → 0,378 m jadi **0,0002 m**; drag −500px tengah fly + guard → **0,0000**; pointerdown tengah fly → fly TIDAK batal (`flyKeep` true).
- Harness raycast 10e (Three.js asli): ketuk panel tengah / papan KELUAR / area lubang / kedua tepi panel → semua **`exit-living`**; ketuk meja (kontrol) → `living` (tidak rusak). Router dari spawn baru: px x 758, di luar badan avatar (883–1036) → **TERLIHAT**; kontrol spawn lama x 0: router px 960 di dalam badan avatar → tertutup (sesuai laporan playtest).
- Kamar utuh (Budi Santoso = Kamar 3, KOSAN-03-BUDI); `clampJoystick`/`moveVector`/`cameraPos` utuh.
- Grep: `bobT`/`dpad`/`firebase`/`fetch(` = **0**; `LIVING_OBSTACLES`/`SANTAI` = **0** (ruangan tetap sederhana); `livingScene` 26, `myRealm` 13, `kosan3d-id` 3.
- **Yang parent masih perlu lakukan:** TIDAK ADA DEPLOY (tugas lokal saja). Setelah deploy: playtest browser — (a) di dalam ruang tamu, ketuk TENGAH pintu / papan "KELUAR" / tepi pintu → harus keluar ke halaman; ketuk meja → kartu tetap terbuka (bukan keluar); (b) keluar via pil / tombol kartu / ketuk pintu → framing kembali SAMA dengan baseline sebelum masuk (bandingkan screenshot sebelum vs sesudah, bukan vs nilai simpanan); (c) pil "Keluar" lalu langsung seret kanvas −500px → framing akhir tetap sama dengan baseline; (d) saat pertama masuk, router terlihat di samping kiri avatar (tidak tertutup badan); (e) "Lihat kamarku" tetap bisa dibatalkan sentuhan. Vonis visual akhir tetap HP pemilik.
