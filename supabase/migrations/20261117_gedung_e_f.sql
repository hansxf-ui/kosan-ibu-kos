-- Gedung E & F (Opsi D — Komplek Sebelah, perintah Ryan 17 Nov 20:12, bangun
-- langsung di preview): 20 kamar baru K41-K60 di komplek tetangga barat.
-- HANYA MENAMBAH fungsi baru kosan_register_ef + melebarkan CHECK kamar
-- (kosan_residents, kosan_akun, kosan_sesi) dari 1..40 ke 1..60.
-- TIDAK disentuh: kosan_register (kunci KOSAN / KOSANBARU), kosan_register_cd
-- (kunci KOSANC / KOSAND), kosan_login, kosan_occupants, data penghuni K1-K40.
-- Kunci = gerbang bersama (pola KOSANC/KOSAND, tanpa flag gedung): KOSANE -> K41-50
-- (Gedung E), KOSANF -> K51-60 (Gedung F). Server (/api/daftar) memanggil
-- fungsi ini HANYA untuk kunci KOSANE/KOSANF (api/_lib/app.js).
-- Jalankan sekali di SQL Editor Supabase (idempoten: aman diulang).

begin;

-- ---------- 1. CHECK kamar: 1..40 -> 1..60 ----------
-- Nama constraint bawaan Postgres untuk CHECK kolom inline = <tabel>_room_check,
-- tapi dicari lewat definisinya supaya tetap benar kalau namanya lain.
-- Mencakup kosan_residents (tabel penghuni utama) + tabel Fase A (kosan_akun, kosan_sesi).
do $$
declare c record;
begin
  for c in
    select t.relname as tabel, k.conname as nama
      from pg_constraint k join pg_class t on t.oid = k.conrelid join pg_namespace s on s.oid = t.relnamespace
     where s.nspname = 'public' and t.relname in ('kosan_residents', 'kosan_akun', 'kosan_sesi') and k.contype = 'c'
       and pg_get_constraintdef(k.oid) ~ 'room' and pg_get_constraintdef(k.oid) ~ '40'
  loop
    execute format('alter table public.%I drop constraint %I', c.tabel, c.nama);
  end loop;
end $$;
alter table public.kosan_residents drop constraint if exists kosan_residents_room_check;
alter table public.kosan_residents add constraint kosan_residents_room_check check (room between 1 and 60);
alter table public.kosan_akun drop constraint if exists kosan_akun_room_check;
alter table public.kosan_akun add constraint kosan_akun_room_check check (room between 1 and 60);
alter table public.kosan_sesi drop constraint if exists kosan_sesi_room_check;
alter table public.kosan_sesi add constraint kosan_sesi_room_check check (room between 1 and 60);

-- ---------- 2. kosan_register_ef ----------
-- Cerminan aturan kosan_register_cd (15 Nov): nama dinormalisasi (trim, buang
-- @ depan, huruf kecil, spasi tunggal), charset a-z 0-9 spasi _ . - (maks 30,
-- minimal 1 huruf/angka), gender Cewek/Cowok, pin_hash 8 hex, nama unik di
-- SEMUA kamar (1-60, dibanding setelah normalisasi), kamar kosong terendah di
-- rentang gedung (p_room dipakai kalau ada di rentang + kosong). Balapan dua
-- pendaftar ke kamar yang sama -> unique_violation (PK room) -> probe ulang (maks 3x).
create or replace function public.kosan_register_ef(p_name text, p_gender text, p_key text, p_pin_hash text, p_room smallint)
returns smallint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  v_key text := upper(trim(coalesce(p_key, '')));
  v_room smallint;
  v_lo smallint;
  v_hi smallint;
  v_attempt int;
begin
  v_name := trim(ltrim(v_name, '@'));
  if v_key is distinct from 'KOSANE' and v_key is distinct from 'KOSANF' then
    raise exception 'kunci salah';
  end if;
  if v_name = '' or length(v_name) > 30 then
    raise exception 'nama tidak valid';
  end if;
  if v_name !~ '^[a-z0-9 _.-]+$' or v_name !~ '[a-z0-9]' then
    raise exception 'username tidak valid';
  end if;
  if p_gender is null or p_gender not in ('Cewek', 'Cowok') then
    raise exception 'gender tidak valid';
  end if;
  if p_pin_hash is null or p_pin_hash !~ '^[0-9a-f]{8}$' then
    raise exception 'pin tidak valid';
  end if;
  if exists (select 1 from kosan_residents r
              where lower(trim(regexp_replace(ltrim(trim(r.name), '@'), '\s+', ' ', 'g'))) = v_name) then
    raise exception 'nama sudah terdaftar';
  end if;
  if v_key = 'KOSANE' then v_lo := 41; v_hi := 50; else v_lo := 51; v_hi := 60; end if;
  if p_room between v_lo and v_hi and not exists (select 1 from kosan_residents where room = p_room) then
    v_room := p_room;
  else
    select r into v_room from generate_series(v_lo::int, v_hi::int) as r
     where not exists (select 1 from kosan_residents where room = r)
     order by r limit 1;
  end if;
  if v_room is null then
    if v_key = 'KOSANE' then
      if (select count(*) from kosan_residents where room between 51 and 60) < 10 then
        raise exception 'Gedung E penuh — kode Gedung F ada di caption video terbaru';
      end if;
    else
      if (select count(*) from kosan_residents where room between 41 and 50) < 10 then
        raise exception 'Gedung F penuh — kode Gedung E ada di caption video terbaru';
      end if;
    end if;
    raise exception 'kosan penuh';
  end if;
  for v_attempt in 1..3 loop
    begin
      insert into kosan_residents (room, name, gender, pin_hash)
      values (v_room, v_name, p_gender, p_pin_hash);
      return v_room;
    exception when unique_violation then
      if exists (select 1 from kosan_residents r
                  where lower(trim(regexp_replace(ltrim(trim(r.name), '@'), '\s+', ' ', 'g'))) = v_name) then
        raise exception 'nama sudah terdaftar';
      end if;
      select r into v_room from generate_series(v_lo::int, v_hi::int) as r
       where not exists (select 1 from kosan_residents where room = r)
       order by r limit 1;
      if v_room is null then
        raise exception 'kamar sudah terisi';
      end if;
    end;
  end loop;
  raise exception 'kamar sudah terisi';
end;
$function$;

-- Hanya server (service_role). Hak EXECUTE bawaan PUBLIC ikut dicabut (audit P2).
revoke all on function public.kosan_register_ef(text, text, text, text, smallint) from public, anon, authenticated;
grant execute on function public.kosan_register_ef(text, text, text, text, smallint) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_register_ef(text,text,text,text,smallint)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_register_ef(text,text,text,text,smallint)', 'execute');  -- true
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid in ('public.kosan_akun'::regclass, 'public.kosan_sesi'::regclass) and contype = 'c';  -- room between 1 and 60
--   select count(*) from kosan_residents where room between 1 and 40;   -- tidak berubah (33)
--   kosan_occupants() harus ikut mengembalikan kamar 41-60 sesudah ada pendaftar
--   (fungsi lama, tidak diubah — cek dengan satu pendaftaran uji lalu hapus barisnya).
-- Uji di transaksi yang dibatalkan (data asli tidak berubah):
--   begin;
--   select public.kosan_register_ef('uji e', 'Cewek', 'KOSANE', '0123abcd', null);   -- 41 (kamar E kosong terendah)
--   select public.kosan_register_ef('uji f', 'Cowok', 'KOSANF', '0123abcd', null);   -- 51
--   select public.kosan_register_ef('Uji E', 'Cewek', 'KOSANE', '0123abcd', null);   -- galat: nama sudah terdaftar
--   select public.kosan_register_ef('uji x', 'Cewek', 'KOSAN', '0123abcd', null);    -- galat: kunci salah
--   rollback;
