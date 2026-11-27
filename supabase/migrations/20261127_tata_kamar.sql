-- Tata Kamar (pemilik 26 Nov: "atur tata letak sendiri ... mindah mindahin sendiri" -> 27 Nov "Gas, tata letak perabot")
-- — posisi + arah perabot kamar per penghuni, supaya tetap sama walau ganti HP.
-- HANYA MENAMBAH satu tabel + dua fungsi. Tabel/fungsi lain TIDAK diubah. Tidak ada uang yang berubah.
-- Angka batas di berkas ini: room 1..60 (= JUMLAH_KAMAR di api/_lib/app.js; pelajaran bug E/F 24 Nov).
--   Kalau kapasitas kos dinaikkan lagi, CHECK kosan_kamar_tata.room + cek p_room di fungsi simpan WAJIB ikut naik.
-- Identitas = (room, nama_norm) dari sesi server, sama seperti dompet / warna kamar.
-- Bentuk data: objek jsonb { "<id barang>": [x_mm, z_mm, putaran] } — x -4000..4000, z -3500..3500 (kamar 8 x 7 m, milimeter),
--   putaran 0..3 (kelipatan 90 derajat), paling banyak 16 barang. Daftar putih id + aturan tabrakan yang
--   sebenarnya ada di server (api/_lib/tata.js); di sini bentuk + batas angka dijaga lagi (lapis kedua),
--   jadi menambah barang baru kelak tidak butuh migrasi.
-- Hanya service_role (server Vercel) yang bisa memanggil / membaca. Idempoten: aman diulang.

begin;

create or replace function public.kosan_tata_sah(p_tata jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; n int := 0;
begin
  if p_tata is null or jsonb_typeof(p_tata) <> 'object' then return false; end if;
  if length(p_tata::text) > 700 then return false; end if;
  for k, v in select * from jsonb_each(p_tata) loop
    n := n + 1;
    if n > 16 then return false; end if;
    if k !~ '^[a-z][a-z_]{1,19}$' then return false; end if;
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 3 then return false; end if;
    if jsonb_typeof(v->0) <> 'number' or jsonb_typeof(v->1) <> 'number' or jsonb_typeof(v->2) <> 'number' then return false; end if;
    if (v->>0) !~ '^-?[0-9]{1,4}$' or (v->>1) !~ '^-?[0-9]{1,4}$' or (v->>2) !~ '^[0-3]$' then return false; end if;
    if (v->>0)::int < -4000 or (v->>0)::int > 4000 or (v->>1)::int < -3500 or (v->>1)::int > 3500 then return false; end if;
  end loop;
  return n >= 1;
end $$;

create table if not exists public.kosan_kamar_tata (
  room       int   not null check (room between 1 and 60),
  nama_norm  text  not null check (length(nama_norm) between 1 and 30),
  tata       jsonb not null check (public.kosan_tata_sah(tata)),
  diperbarui timestamptz not null default now(),
  primary key (room, nama_norm)
);

alter table public.kosan_kamar_tata enable row level security; -- tanpa policy: anon/authenticated tidak bisa baca/tulis
revoke all on table public.kosan_kamar_tata from public, anon, authenticated;
grant select, insert, update, delete on table public.kosan_kamar_tata to service_role;

-- Baca tata letak satu penghuni; belum pernah menata -> null.
create or replace function public.kosan_tata_baca(p_room int, p_nama text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select t.tata from public.kosan_kamar_tata t where t.room = p_room and t.nama_norm = p_nama;
$$;

-- Simpan (timpa) tata letak satu penghuni. p_tata null = "Balikin ke awal" (baris dihapus -> kamar bawaan).
create or replace function public.kosan_tata_simpan(p_room int, p_nama text, p_tata jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_room is null or p_room < 1 or p_room > 60 then raise exception 'kamar tidak valid'; end if;
  if p_nama is null or length(p_nama) < 1 or length(p_nama) > 30 then raise exception 'nama tidak valid'; end if;
  if p_tata is null or jsonb_typeof(p_tata) = 'null' then
    delete from public.kosan_kamar_tata where room = p_room and nama_norm = p_nama;
    return null;
  end if;
  if not public.kosan_tata_sah(p_tata) then raise exception 'tata tidak valid'; end if;
  insert into public.kosan_kamar_tata (room, nama_norm, tata)
  values (p_room, p_nama, p_tata)
  on conflict (room, nama_norm) do update set tata = excluded.tata, diperbarui = now();
  return p_tata;
end $$;

revoke all on function public.kosan_tata_sah(jsonb) from public, anon, authenticated;
revoke all on function public.kosan_tata_baca(int, text) from public, anon, authenticated;
revoke all on function public.kosan_tata_simpan(int, text, jsonb) from public, anon, authenticated;
grant execute on function public.kosan_tata_sah(jsonb) to service_role;
grant execute on function public.kosan_tata_baca(int, text) to service_role;
grant execute on function public.kosan_tata_simpan(int, text, jsonb) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_tata_baca(int,text)', 'execute');            -- false
--   select has_function_privilege('anon', 'public.kosan_tata_simpan(int,text,jsonb)', 'execute');    -- false
--   select has_function_privilege('authenticated', 'public.kosan_tata_simpan(int,text,jsonb)', 'execute'); -- false
--   select has_function_privilege('service_role', 'public.kosan_tata_simpan(int,text,jsonb)', 'execute');  -- true
--   select has_table_privilege('anon', 'public.kosan_kamar_tata', 'select');                         -- false
--   select relrowsecurity from pg_class where oid = 'public.kosan_kamar_tata'::regclass;             -- true
--   select count(*) from pg_policies where tablename = 'kosan_kamar_tata';                           -- 0
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.kosan_kamar_tata'::regclass; -- room 1..60
-- Uji di transaksi yang dibatalkan, WAJIB dengan kamar rentang baru (41 dan 60) — pelajaran bug E/F:
--   begin;
--   do $uji$
--   declare r jsonb; gagal int := 0;
--   begin
--     if public.kosan_tata_baca(60, 'zz_uji_tata') is not null then raise exception 'uji: kamar 60 seharusnya kosong'; end if;
--     r := public.kosan_tata_simpan(60, 'zz_uji_tata', '{"kasur":[3250,-3500,2],"nakas":[-1800,-3130,1]}'::jsonb);
--     if r->'kasur'->>2 <> '2' then raise exception 'uji: simpan kamar 60 salah %', r; end if;
--     r := public.kosan_tata_simpan(41, 'zz_uji_tata_b', '{"bean_bag":[1000,1200,3]}'::jsonb);
--     if public.kosan_tata_baca(41, 'zz_uji_tata_b')->'bean_bag'->>0 <> '1000' then raise exception 'uji: baca kamar 41 salah'; end if;
--     r := public.kosan_tata_simpan(60, 'zz_uji_tata', '{"kasur":[-3250,-3500,0]}'::jsonb); -- menimpa
--     if public.kosan_tata_baca(60, 'zz_uji_tata') <> '{"kasur":[-3250,-3500,0]}'::jsonb then raise exception 'uji: timpa salah'; end if;
--     perform public.kosan_tata_simpan(60, 'zz_uji_tata', null);                          -- balikin ke awal
--     if public.kosan_tata_baca(60, 'zz_uji_tata') is not null then raise exception 'uji: hapus salah'; end if;
--     begin perform public.kosan_tata_simpan(61, 'zz_uji_tata', '{"kasur":[0,0,0]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(0, 'zz_uji_tata', '{"kasur":[0,0,0]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '{"kasur":[4001,0,0]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '{"kasur":[0,0,4]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '{"kasur":[0.5,0,0]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '{"Kasur; drop":[0,0,0]}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '[1,2,3]'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     begin perform public.kosan_tata_simpan(41, 'zz_uji_tata', '{}'::jsonb); gagal := gagal + 1; exception when others then null; end;
--     if gagal <> 0 then raise exception 'uji: % masukan jahat diterima', gagal; end if;
--     raise notice 'uji tata kamar 41/60: LOLOS';
--   end $uji$;
--   rollback;
