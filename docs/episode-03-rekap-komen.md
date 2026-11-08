# Ep3 — Rekap Komen Reel Ep2 (DfcKY5qDs6X) — dicek 2026-11-08 09:10–09:12 WITA

Sumber: instagram-cli, akun ibu__kos (17841462581657595), media 18100247507551657.
Post row saat dicek: 17 komen, 99 like, 136 followers.

## Ranking request (komen top-level, by like)

| # | Request | Oleh | Like |
|---|---------|------|------|
| 1 | Mesin cuci + pengering | Mrs. J | 26 |
| 2 | Jemuran diganti / disingkir ke pinggir | a.safiraam | 13 |
| 3 | Kolam renang 10 meter | khalisah | 10 |
| 4 | AC (3 komen: zscaaa4, Aqil x2) | — | 1+2+2 |
| 5 | Kamar mandi shower / dalam (Hevanika, Devi) | — | 2+1 |
| — | Tanaman hias | Dimz | 2 |
| — | Kulkas mini | its.cicik | 0 |
| — | Warung | shfa | 0 |
| — | TV gede | Aulia | 0 (baru) |
| — | Kamar 1 (klaim kamar, bukan request bangun) | simsalabim | 0 (baru) |
| — | iPhone 18 (candaan) | knp dolo | 1 |

## Yang berubah sejak cek 00:27 WITA

- Total komen 15 → 17. Dua komen baru: "Tv gede buu" (Aulia, 0 like) dan "Akuu kamar 1 bu" (simsalabim, 0 like). Keduanya tidak mengubah ranking.
- Like pemuncak naik: mesin cuci 23 → 26; jemuran 12 → 13. Jarak #1 vs #2 melebar: 26 vs 13.

## 3 komen yang tetap tidak ketangkap CLI

- fetch-post-comments mengembalikan 14 komen top-level yang SAMA di sort desc maupun asc; `has_next_page: true` tapi halaman berikut KOSONG (total_count tetap 17). Ini pola yang sama persis dengan Ep1.
- CLI tidak punya flag baca balasan (dicek di `instagram-cli help` — hanya ada `--author-ids`, `--since`, `--until`, `--limit`, `--after`, `--sort-order`). `reply_count` di semua komen = null (tidak terisi).
- Kesimpulan: 3 komen yang hilang hampir pasti BALASAN (reply) ke salah satu komen di atas — persis seperti Ep1, di mana komen pemenang "Wifi kenceng ka" ternyata balasan dan baru ketemu lewat screenshot HP.
- Satu-satunya cara melihat ketiganya: buka reel di HP dan lihat balasan di bawah komen-komennya.

## Implikasi buat pemenang Ep3

- Supaya pemenang berubah, salah satu dari 3 balasan itu harus punya >26 like — sangat tidak mungkin untuk balasan (balasan biasanya jauh lebih sedikit like-nya daripada komen utama), tapi TIDAK bisa dibuktikan dari CLI.
- Rekomendasi: Mesin cuci + pengering (Mrs. J, 26 like) praktis sudah menang; konfirmasi final cukup pemilik lirik balasan di HP — kalau tidak ada balasan di atas 26 like, pemenang sah.
