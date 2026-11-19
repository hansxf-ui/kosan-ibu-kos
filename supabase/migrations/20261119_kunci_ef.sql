-- KUNCI E&F (perintah Ryan 19 Nov 21:08: "naik live aja udah, jangan dibuka
-- dulu, kunci semua dulu untuk e&f, jangan sampe bocor, video juga jangan
-- post dulu, tahan dulu aja").
-- Masalah: kunci KOSANE/KOSANF ADA di source klien (KUNCI_KODE_LIST di
-- index.html) — sekali staging naik live, siapa pun bisa baca kuncinya dari
-- view-source. Jadi pendaftaran E/F HARUS dikunci di server, bukan sekadar
-- "kunci belum dipublikasi".
-- Perbaikan: (1) flag `gedung_ef_open` = false di kosan_config;
-- (2) gerbang di AWAL `kosan_register_ef` — baca flag, bukan true = tolak
-- dengan 'gedung belum dibuka' (flag hilang = tertutup).
-- Fungsi disalin UTUH dari migrasi 20261117_gedung_e_f.sql + gerbang saja.
-- Membuka nanti: `update kosan_config set value = true where key = 'gedung_ef_open';`
-- (tanpa deploy) + cabut palang di celah pagar barat + deploy.
-- Jalankan sekali (idempoten: flag pakai ON CONFLICT DO NOTHING, fungsi
-- CREATE OR REPLACE).

begin;

-- ---------- 1. Flag gedung_ef_open = false ----------
insert into kosan_config (key, value) values ('gedung_ef_open', false)
on conflict (key) do nothing;

-- ---------- 2. kosan_register_ef + gerbang ----------
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
  -- KUNCI E&F 19 Nov — gerbang: E&F tertutup sampai Ryan buka (flag hilang = tertutup).
  if not coalesce((select value from kosan_config where key = 'gedung_ef_open'), false) then
    raise exception 'gedung belum dibuka';
  end if;
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

-- Hanya server (service_role). Hak EXECUTE bawaan PUBLIC ikut dicabut.
revoke all on function public.kosan_register_ef(text, text, text, text, smallint) from public, anon, authenticated;
grant execute on function public.kosan_register_ef(text, text, text, text, smallint) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select key, value from kosan_config where key = 'gedung_ef_open';  -- false
--   select has_function_privilege('anon', 'public.kosan_register_ef(text,text,text,text,smallint)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_register_ef(text,text,text,text,smallint)', 'execute');  -- true
-- Uji di transaksi yang dibatalkan (data asli tidak berubah):
--   begin;
--   select public.kosan_register_ef('uji kunci', 'Cewek', 'KOSANE', '0123abcd', null);  -- galat: gedung belum dibuka
--   select count(*) from kosan_residents;  -- tetap 40
--   rollback;
