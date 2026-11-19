-- Foto profil (18 Nov — perintah Ryan 19:31 "di kartu profil cocoknya bisa
-- pasang foto tuh"): 1 foto per penghuni, URL publik Supabase Storage.
-- Tabel ini HANYA menyimpan URL (bukan bytes): file-nya di bucket Storage
-- `foto-profil` (public, dibuat 18 Nov via SQL: file_size_limit 512 KB,
-- allowed_mime_types JPEG/PNG/WebP; kunci objek = nomor kamar, menimpa).
-- Server (/api/foto-profil) yang menulis tabel ini (service_role); klien
-- TIDAK PERNAH menulis langsung. RLS aktif, tanpa policy (ikuti pola
-- tabel kosan_* lain: 0 policy, service_role saja).
-- Alur: POST /api/foto-profil {aksi:'minta'} -> signed upload URL (server,
-- service_role) -> klien PUT file langsung ke Storage -> POST {aksi:'selesai'}
-- -> server validasi magic bytes + ukuran, lalu upsert baris ini.
-- URL foto disebarkan ke pemain lain lewat pesan presence MQTT (field `foto`,
-- opsional; klien lama mengabaikannya) — bukan lewat tabel ini.
-- HANYA MENAMBAH tabel baru. TIDAK disentuh: kosan_residents, kosan_akun,
-- kosan_sesi, RPC register/login, data penghuni K1-K40.
-- Jalankan sekali di SQL Editor Supabase / supabase-mgmt run-sql (idempoten).

begin;

create table if not exists public.kosan_foto_profil (
  room smallint primary key check (room between 1 and 60),
  -- PERBAIKAN 18 Nov (Vesper): regex `~ '^https://[^ ]{1,300}$'` ternyata
  -- TIDAK VALID di Postgres ini (2201B "invalid repetition count(s)") —
  -- upsert pertama dari /api/foto-profil selalu 503. Diganti LIKE + length.
  url text not null check (url like 'https://%' and length(url) <= 300 and url not like '% %'),
  diperbarui timestamptz not null default now()
);

alter table public.kosan_foto_profil enable row level security;

commit;

-- Cek sesudah migrasi (harus lolos):
--   select * from public.kosan_foto_profil;  -- kosong (belum ada yang pasang foto)
--   select id, public, file_size_limit from storage.buckets where id = 'foto-profil';
--     -- foto-profil | true | 524288
