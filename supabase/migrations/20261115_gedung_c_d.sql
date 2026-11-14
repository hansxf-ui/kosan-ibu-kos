-- Gedung C & D (perintah Ryan 15 Nov 00:41): 20 kamar baru K21-K40.
-- HANYA MENAMBAH fungsi baru kosan_register_cd + melebarkan CHECK kamar
-- tabel Fase A (kosan_akun, kosan_sesi) dari 1..20 ke 1..40.
-- TIDAK disentuh: kosan_register (kunci KOSAN / KOSANBARU), kosan_login,
-- kosan_occupants, tabel kosan_residents, data penghuni K1-K20.
-- Kunci = gerbang bersama (pola KOSAN, tanpa flag gedung): KOSANC -> K21-30
-- (Gedung C), KOSAND -> K31-40 (Gedung D). Server (/api/daftar) memanggil
-- fungsi ini HANYA untuk kunci KOSANC/KOSAND (api/_lib/app.js).
-- Jalankan sekali di SQL Editor Supabase (idempoten: aman diulang).

begin;

-- ---------- 1. CHECK kamar tabel Fase A: 1..20 -> 1..40 ----------
-- Nama constraint bawaan Postgres untuk CHECK kolom inline = <tabel>_room_check,
-- tapi dicari lewat definisinya supaya tetap benar kalau namanya lain.
do $$
declare c record;
begin
  for c in
    select t.relname as tabel, k.conname as nama
      from pg_constraint k join pg_class t on t.oid = k.conrelid join pg_namespace s on s.oid = t.relnamespace
     where s.nspname = 'public' and t.relname in ('kosan_akun', 'kosan_sesi') and k.contype = 'c'
       and pg_get_constraintdef(k.oid) ~ 'room' and pg_get_constraintdef(k.oid) ~ '20'
  loop
    execute format('alter table public.%I drop constraint %I', c.tabel, c.nama);
  end loop;
end $$;
alter table public.kosan_akun drop constraint if exists kosan_akun_room_check;
alter table public.kosan_akun add constraint kosan_akun_room_check check (room between 1 and 40);
alter table public.kosan_sesi drop constraint if exists kosan_sesi_room_check;
alter table public.kosan_sesi add constraint kosan_sesi_room_check check (room between 1 and 40);

-- ---------- 2. kosan_register_cd ----------
-- Cerminan aturan kosan_register (draf Vesper 15 Nov, dicek ulang):
-- nama dinormalisasi (trim, buang @ depan, huruf kecil, spasi tunggal),
-- charset a-z 0-9 spasi _ . - (maks 30, minimal 1 huruf/angka), gender
-- Cewek/Cowok, pin_hash 8 hex, nama unik di SEMUA kamar (1-40, dibanding
-- setelah normalisasi), kamar kosong terendah di rentang gedung (p_room
-- dipakai kalau ada di rentang + kosong). Balapan dua pendaftar ke kamar
-- yang sama -> unique_violation (PK room) -> probe ulang (maks 3x).
create or replace function public.kosan_register_cd(p_name text, p_gender text, p_key text, p_pin_hash text, p_room smallint)
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
  if v_key is distinct from 'KOSANC' and v_key is distinct from 'KOSAND' then
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
  if v_key = 'KOSANC' then v_lo := 21; v_hi := 30; else v_lo := 31; v_hi := 40; end if;
  if p_room between v_lo and v_hi and not exists (select 1 from kosan_residents where room = p_room) then
    v_room := p_room;
  else
    select r into v_room from generate_series(v_lo::int, v_hi::int) as r
     where not exists (select 1 from kosan_residents where room = r)
     order by r limit 1;
  end if;
  if v_room is null then
    if v_key = 'KOSANC' then
      if (select count(*) from kosan_residents where room between 31 and 40) < 10 then
        raise exception 'Gedung C penuh — kode Gedung D ada di caption video terbaru';
      end if;
    else
      if (select count(*) from kosan_residents where room between 21 and 30) < 10 then
        raise exception 'Gedung D penuh — kode Gedung C ada di caption video terbaru';
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
revoke all on function public.kosan_register_cd(text, text, text, text, smallint) from public, anon, authenticated;
grant execute on function public.kosan_register_cd(text, text, text, text, smallint) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_register_cd(text,text,text,text,smallint)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_register_cd(text,text,text,text,smallint)', 'execute');  -- true
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid in ('public.kosan_akun'::regclass, 'public.kosan_sesi'::regclass) and contype = 'c';  -- room between 1 and 40
--   select count(*) from kosan_residents where room between 1 and 20;   -- tidak berubah (20)
--   kosan_occupants() harus ikut mengembalikan kamar 21-40 sesudah ada pendaftar
--   (fungsi lama, tidak diubah — cek dengan satu pendaftaran uji lalu hapus barisnya).
-- Uji di transaksi yang dibatalkan (data asli tidak berubah):
--   begin;
--   select public.kosan_register_cd('uji c', 'Cewek', 'KOSANC', '0123abcd', null);   -- 21 (kamar C kosong terendah)
--   select public.kosan_register_cd('uji d', 'Cowok', 'KOSAND', '0123abcd', null);   -- 31
--   select public.kosan_register_cd('Uji C', 'Cewek', 'KOSANC', '0123abcd', null);   -- galat: nama sudah terdaftar
--   select public.kosan_register_cd('uji x', 'Cewek', 'KOSAN', '0123abcd', null);    -- galat: kunci salah
--   rollback;
