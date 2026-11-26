-- Warna Kamar (Ryan 26 Nov: "pilih warna kamar sendiri" -> "Warna kamar dulu aja") — pilihan warna
-- dinding + jenis lantai + warna selimut per penghuni, supaya tetap sama walau ganti HP.
-- HANYA MENAMBAH satu tabel + dua fungsi. Tabel/fungsi lain TIDAK diubah. Tidak ada uang yang berubah.
-- Angka batas di berkas ini: room 1..60 (= JUMLAH_KAMAR di api/_lib/app.js; pelajaran bug E/F 24 Nov).
--   Kalau kapasitas kos dinaikkan lagi, CHECK kosan_kamar_gaya.room + cek p_room di dua fungsi WAJIB ikut naik.
-- Identitas = (room, nama_norm) dari sesi server, sama seperti dompet. Daftar putih pilihan yang
-- sebenarnya ada di server (api/_lib/gaya.js); di sini hanya bentuk kode (d0..d99, l0..l99, s0..s99),
-- jadi menambah pilihan baru kelak tidak butuh migrasi.
-- Hanya service_role (server Vercel) yang bisa memanggil / membaca. Idempoten: aman diulang.

begin;

create table if not exists public.kosan_kamar_gaya (
  room       int  not null check (room between 1 and 60),
  nama_norm  text not null check (length(nama_norm) between 1 and 30),
  dinding    text not null default 'd0' check (dinding ~ '^d[0-9]{1,2}$'),
  lantai     text not null default 'l0' check (lantai ~ '^l[0-9]{1,2}$'),
  selimut    text not null default 's0' check (selimut ~ '^s[0-9]{1,2}$'),
  diperbarui timestamptz not null default now(),
  primary key (room, nama_norm)
);

alter table public.kosan_kamar_gaya enable row level security; -- tanpa policy: anon/authenticated tidak bisa baca/tulis
revoke all on table public.kosan_kamar_gaya from public, anon, authenticated;
grant select, insert, update, delete on table public.kosan_kamar_gaya to service_role;

-- Baca pilihan satu penghuni; belum pernah memilih -> null.
create or replace function public.kosan_gaya_baca(p_room int, p_nama text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dinding', g.dinding, 'lantai', g.lantai, 'selimut', g.selimut)
    from public.kosan_kamar_gaya g where g.room = p_room and g.nama_norm = p_nama;
$$;

-- Simpan (timpa) pilihan satu penghuni.
create or replace function public.kosan_gaya_simpan(p_room int, p_nama text, p_dinding text, p_lantai text, p_selimut text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_room is null or p_room < 1 or p_room > 60 then raise exception 'kamar tidak valid'; end if;
  if p_nama is null or length(p_nama) < 1 or length(p_nama) > 30 then raise exception 'nama tidak valid'; end if;
  if p_dinding is null or p_dinding !~ '^d[0-9]{1,2}$' or p_lantai is null or p_lantai !~ '^l[0-9]{1,2}$'
     or p_selimut is null or p_selimut !~ '^s[0-9]{1,2}$' then raise exception 'pilihan tidak valid'; end if;
  insert into public.kosan_kamar_gaya (room, nama_norm, dinding, lantai, selimut)
  values (p_room, p_nama, p_dinding, p_lantai, p_selimut)
  on conflict (room, nama_norm) do update
     set dinding = excluded.dinding, lantai = excluded.lantai, selimut = excluded.selimut, diperbarui = now();
  return jsonb_build_object('dinding', p_dinding, 'lantai', p_lantai, 'selimut', p_selimut);
end $$;

revoke all on function public.kosan_gaya_baca(int, text) from public, anon, authenticated;
revoke all on function public.kosan_gaya_simpan(int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.kosan_gaya_baca(int, text) to service_role;
grant execute on function public.kosan_gaya_simpan(int, text, text, text, text) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_gaya_baca(int,text)', 'execute');                    -- false
--   select has_function_privilege('anon', 'public.kosan_gaya_simpan(int,text,text,text,text)', 'execute');   -- false
--   select has_table_privilege('anon', 'public.kosan_kamar_gaya', 'select');                                 -- false
--   select relrowsecurity from pg_class where oid = 'public.kosan_kamar_gaya'::regclass;                     -- true
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.kosan_kamar_gaya'::regclass; -- room 1..60
-- Uji di transaksi yang dibatalkan, WAJIB dengan kamar rentang baru (41 dan 60) — pelajaran bug E/F:
--   begin;
--   select public.kosan_gaya_baca(60, 'uji warna');                          -- null
--   select public.kosan_gaya_simpan(60, 'uji warna', 'd27', 'l8', 's17');    -- {"dinding":"d27","lantai":"l8","selimut":"s17"} (kode dua digit)
--   select public.kosan_gaya_simpan(41, 'uji warna b', 'd1', 'l1', 's1');
--   select public.kosan_gaya_simpan(60, 'uji warna', 'd2', 'l0', 's0');      -- menimpa
--   select public.kosan_gaya_baca(60, 'uji warna');                          -- {"dinding":"d2","lantai":"l0","selimut":"s0"}
--   select public.kosan_gaya_simpan(60, 'uji warna', 'd100', 'l0', 's0');    -- GALAT: pilihan tidak valid -> transaksi batal; ulangi blok tanpa baris ini untuk uji berikut
--   select public.kosan_gaya_simpan(61, 'uji warna', 'd1', 'l1', 's1');      -- GALAT: kamar tidak valid (transaksi batal di sini — jalankan terakhir)
--   rollback;
