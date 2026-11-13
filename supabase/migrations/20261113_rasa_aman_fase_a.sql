-- Ronde rasa aman, Fase A (docs/RASA-AMAN-DESAIN.md §5, §6, §8, §10).
-- HANYA MENAMBAH tabel + fungsi baru. Tabel penghuni, kosan_login,
-- kosan_register, kosan_occupants TIDAK disentuh. Nama, kamar, gender,
-- PIN, pin_hash penghuni TIDAK diubah.
-- Jalankan sekali di SQL Editor Supabase (idempoten: aman diulang).

begin;

-- ---------- tabel ----------
create table if not exists public.kosan_akun (
  room            int primary key check (room between 1 and 20),
  nama_norm       text not null,
  gender          text not null check (gender in ('cewek', 'cowok')),
  password_hash   text check (password_hash is null or password_hash like 'scrypt$%'),
  password_dibuat timestamptz,
  gagal_count     int not null default 0,
  gagal_sejak     timestamptz,
  kunci_sampai    timestamptz,
  dibuat          timestamptz not null default now()
);

create table if not exists public.kosan_sesi (
  id           uuid primary key default gen_random_uuid(),
  room         int not null check (room between 1 and 20),
  nama_norm    text not null,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  ingat        boolean not null default false,
  dibuat       timestamptz not null default now(),
  dipakai      timestamptz not null default now(),
  kedaluwarsa  timestamptz not null,
  dicabut      timestamptz
);
create index if not exists kosan_sesi_room_idx on public.kosan_sesi (room);

create table if not exists public.kosan_perangkat_log (
  id              bigserial primary key,
  room            int,
  peristiwa       text not null check (peristiwa in ('setup_pin', 'setup', 'masuk')),
  perangkat       text check (perangkat is null or perangkat ~ '^[A-Za-z0-9-]{8,64}$'),
  ip_hmac         text,
  ip_prefiks_hmac text,
  dibuat          timestamptz not null default now()
);
create index if not exists kosan_perangkat_log_dibuat_idx on public.kosan_perangkat_log (dibuat);
create index if not exists kosan_perangkat_log_perangkat_idx on public.kosan_perangkat_log (perangkat);
create index if not exists kosan_perangkat_log_ip_idx on public.kosan_perangkat_log (ip_hmac);

create table if not exists public.kosan_batas (
  kunci   text not null,
  jendela timestamptz not null,
  jumlah  int not null default 0,
  primary key (kunci, jendela)
);

-- ---------- akses: hanya service_role (server Vercel) ----------
alter table public.kosan_akun          enable row level security;
alter table public.kosan_sesi          enable row level security;
alter table public.kosan_perangkat_log enable row level security;
alter table public.kosan_batas         enable row level security;
-- Tanpa policy = anon/authenticated tidak bisa baca/tulis walau punya grant.
-- Grant bawaan Supabase dicabut juga (pertahanan berlapis).
revoke all on table public.kosan_akun, public.kosan_sesi, public.kosan_perangkat_log, public.kosan_batas
  from public, anon, authenticated;
revoke all on sequence public.kosan_perangkat_log_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.kosan_akun, public.kosan_sesi, public.kosan_perangkat_log, public.kosan_batas
  to service_role;
grant usage, select on sequence public.kosan_perangkat_log_id_seq to service_role;

-- ---------- fungsi ----------
-- Simpan password pertama kali. Atomik + sekali pakai: hanya menulis kalau
-- kamar belum punya password, ATAU baris lama milik nama lain (kamar sudah
-- berganti penghuni). Mengembalikan true kalau tersimpan.
create or replace function public.kosan_akun_setup(p_room int, p_nama_norm text, p_gender text, p_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_hash is null or p_hash not like 'scrypt$%' then raise exception 'hash tidak valid'; end if;
  insert into kosan_akun as a (room, nama_norm, gender, password_hash, password_dibuat)
  values (p_room, p_nama_norm, p_gender, p_hash, now())
  on conflict (room) do update
    set nama_norm = excluded.nama_norm, gender = excluded.gender,
        password_hash = excluded.password_hash, password_dibuat = excluded.password_dibuat,
        gagal_count = 0, gagal_sejak = null, kunci_sampai = null
    where a.password_hash is null or a.nama_norm <> excluded.nama_norm;
  get diagnostics n = row_count;
  if n = 1 then
    -- sesi milik nama lain di kamar ini (penghuni lama) dicabut
    update kosan_sesi set dicabut = now()
      where room = p_room and nama_norm <> p_nama_norm and dicabut is null;
  end if;
  return n = 1;
end $$;

-- Password salah: 5x dalam 15 menit -> akun dikunci 15 menit.
create or replace function public.kosan_akun_gagal(p_room int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update kosan_akun set
    gagal_count = case when gagal_sejak is null or gagal_sejak < now() - interval '15 minutes' then 1 else gagal_count + 1 end,
    gagal_sejak = case when gagal_sejak is null or gagal_sejak < now() - interval '15 minutes' then now() else gagal_sejak end
  where room = p_room;
  update kosan_akun set kunci_sampai = now() + interval '15 minutes', gagal_count = 0, gagal_sejak = null
  where room = p_room and gagal_count >= 5;
end $$;

create or replace function public.kosan_akun_berhasil(p_room int)
returns void language sql security definer set search_path = public as $$
  update kosan_akun set gagal_count = 0, gagal_sejak = null where room = p_room and gagal_count > 0;
$$;

-- Penghitung batas percobaan per jendela waktu tetap (mis. per jam).
create or replace function public.kosan_batas_tambah(p_kunci text, p_detik int)
returns int language plpgsql security definer set search_path = public as $$
declare j timestamptz; n int;
begin
  if p_detik < 1 or length(p_kunci) > 200 then raise exception 'batas tidak valid'; end if;
  j := to_timestamp(floor(extract(epoch from now()) / p_detik) * p_detik);
  insert into kosan_batas (kunci, jendela, jumlah) values (p_kunci, j, 1)
  on conflict (kunci, jendela) do update set jumlah = kosan_batas.jumlah + 1
  returning jumlah into n;
  return n;
end $$;

-- RUNBOOK lupa password (pemilik, sesudah verifikasi lewat DM IG):
--   select kosan_akun_reset(13);
-- Penghuni lalu login pertama lagi pakai PIN kamarnya + buat password baru.
-- PIN tidak berubah. Semua sesi kamar itu dicabut.
create or replace function public.kosan_akun_reset(p_room int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update kosan_akun set password_hash = null, password_dibuat = null,
    gagal_count = 0, gagal_sejak = null, kunci_sampai = null
  where room = p_room;
  update kosan_sesi set dicabut = now() where room = p_room and dicabut is null;
end $$;

-- Retensi (§8.1): log perangkat 90 hari, sesi mati 7 hari, penghitung 2 hari.
create or replace function public.kosan_bersihkan()
returns void language sql security definer set search_path = public as $$
  delete from kosan_perangkat_log where dibuat < now() - interval '90 days';
  delete from kosan_sesi where kedaluwarsa < now() - interval '7 days' or dicabut < now() - interval '7 days';
  delete from kosan_batas where jendela < now() - interval '2 days';
$$;

revoke all on function public.kosan_akun_setup(int, text, text, text) from public, anon, authenticated;
revoke all on function public.kosan_akun_gagal(int)                    from public, anon, authenticated;
revoke all on function public.kosan_akun_berhasil(int)                 from public, anon, authenticated;
revoke all on function public.kosan_batas_tambah(text, int)            from public, anon, authenticated;
revoke all on function public.kosan_akun_reset(int)                    from public, anon, authenticated;
revoke all on function public.kosan_bersihkan()                        from public, anon, authenticated;
grant execute on function public.kosan_akun_setup(int, text, text, text) to service_role;
grant execute on function public.kosan_akun_gagal(int)                    to service_role;
grant execute on function public.kosan_akun_berhasil(int)                 to service_role;
grant execute on function public.kosan_batas_tambah(text, int)            to service_role;

commit;

-- ---------- jadwal pembersihan (opsional, butuh ekstensi pg_cron) ----------
-- [CEK] aktifkan pg_cron di Database -> Extensions, lalu jalankan:
--   select cron.schedule('kosan-bersihkan', '17 20 * * *', 'select public.kosan_bersihkan()');
--   (20:17 UTC = 03:17 WIB)

-- ---------- cek sesudah migrasi (harus lolos) ----------
-- 1) anon tidak bisa baca tabel baru:
--    set role anon; select count(*) from kosan_akun;   -- ERROR permission denied
--    reset role;
-- 2) service_role bisa memanggil RPC lama yang dipakai server:
--    select has_function_privilege('service_role', 'public.kosan_login(text, text)', 'execute');
--    [CEK] sesuaikan tipe argumen kalau kosan_login punya signature lain.
