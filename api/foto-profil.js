/* POST /api/foto-profil {aksi} — foto profil penghuni (18 Nov, Ryan 19:31).
   Route ke-10 (file ke-39 saat deploy): file TIDAK lewat Vercel — klien
   PUT langsung ke signed upload URL Supabase Storage (bacaBody membatasi
   body stream 8 KB, foto ~500 KB tidak muat lewat JSON). */
module.exports = require('./_lib/jalankan').jalankan('fotoProfil', 'POST');
