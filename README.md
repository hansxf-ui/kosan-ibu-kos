# Kosan Ibu Kos 🏠

**Situs web 3D interaktif: kosan yang dibangun lewat komentar penonton.**

🌐 **Live:** https://kosan-ibu-kos.vercel.app/
📸 **Instagram:** [@ibu__kos](https://www.instagram.com/ibu__kos/)

## Konsep

Kosan Ibu Kos adalah kosan fiktif yang fasilitasnya tumbuh dari komentar penonton di Instagram. Setiap episode, penonton mengusulkan fasilitas lewat komen — yang paling banyak di-like, dibangun di episode berikutnya dan muncul di situs ini.

Aturan mainnya:

- Kosan **harus beneran kosong dulu** — fasilitas baru muncul di web/3D hanya setelah dibangun di episode.
- 10 kamar, 1 Ibu Kos, 0 ampun buat yang telat bayar.
- Ketik namamu di situs → dapat preview nomor kamarmu → simpan kartunya, pamerin di komen episode terbaru.

## Yang ada di situs

| File | Isi |
| --- | --- |
| `index.html` + `app.js` + `style.css` | Halaman utama: ketik nama → kartu penghuni + nomor kamar (10 kamar, kosong semua sampai ada yang tampil di episode) |
| `kosan-3d.html` | Tur 3D kosan (Three.js, self-hosted di `vendor/three/`): halaman kosan, teras, dan ruang dalam — kontrol jalan + kamera ala game, joystick di HP. Termasuk multiplayer v1 (MQTT publik, lihat `docs/MULTIPLAYER-SPEC.md`) — sudah ada di kode, belum di-deploy ke live |
| `assets/` | Gambar: hero, foto Ibu Kos, favicon, OG image |
| `fonts/` | Font lokal (Baloo 2, Caveat, Nunito) — tanpa CDN |
| `vendor/` | Pustaka lokal: Three.js, confetti, html2canvas |
| `docs/` | Spek & catatan produksi (lihat bawah) |

Situs 100% statis — tanpa backend, tanpa Firebase, tanpa akun. Klaim kamar dihitung lokal di browser; hanya pemilik yang bisa menulis nama penghuni lewat deploy.

## Cara jalanin

Tidak butuh build step. Cukup serve folder ini sebagai situs statis:

```bash
# Python
python3 -m http.server 8000
# lalu buka http://localhost:8000

# atau Node
npx serve .
```

Deploy ke Vercel/Netlify/GitHub Pages: root directory = repo ini, tanpa build command.

## Dokumen

- `docs/KOSAN-3D-SPEC.md` — spek situs 3D (3 fase: halaman → teras → ruang dalam)
- `docs/KOSAN-3D-PLAN.md` — rencana build 3D
- `docs/KOSAN-3D-BUILD-NOTES.md` — catatan build per ronde
- `docs/MULTIPLAYER-SPEC.md` — spek + implementasi multiplayer v1 (MQTT publik EMQX/HiveMQ, failover 10 dtk/broker, realm per alam); kode sudah ada di `kosan-3d.html`, belum di-deploy ke live
- `docs/PENGHUNI.md` — aturan siapa boleh jadi penghuni
- `docs/AUDIT-WEB-2026-11-07.md` — audit web
- `docs/episode-01-naskah.md`, `docs/episode-02-naskah.md` — naskah episode 1–2
- `docs/episode-03-rekap-komen.md` — rekap komentar episode 3

## Episode

- **Episode 1** — tayang 6 Nov 2026 ([tonton di Instagram](https://www.instagram.com/reel/DfZnSOUjmO7/))
- **Episode 2** — tayang 7 Nov 2026, pemenang: WiFi kenceng (15 like) — router sudah ada di ruang tamu 3D
- **Episode 3** — pemenang menunggu rekap komentar (teratas: mesin cuci + pengering)

## Lisensi

MIT — lihat [LICENSE](LICENSE).
