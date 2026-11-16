-- Kerja & Belanja (perintah Ryan 16 Nov: "sistem pekerjaan ... mendapatkan uang IDR, untuk
-- mendapatkan uangnya jangan terlalu mudah ... uangnya bisa dipake untuk berbelanja"; rencana
-- "ikut saranmu" = uang disimpan di server, hanya penghuni).
-- HANYA MENAMBAH tabel + fungsi baru. Tabel penghuni (kosan_residents), kosan_login,
-- kosan_register, kosan_register_cd, kosan_occupants, kosan_akun, kosan_sesi TIDAK disentuh.
-- Identitas = (room, nama_norm) dari sesi server (/api/*), sama seperti kosan_sesi: kalau kamar
-- berganti penghuni, penghuni baru mulai dari dompet kosong.
-- Semua angka uang ditentukan server (api/_lib/kerja.js); fungsi di sini menegakkan aturan yang
-- harus atomik: saldo tidak pernah negatif, satu shift aktif per penghuni, durasi minimum shift,
-- jatah shift per hari, jeda antar shift, barang sekali beli, uang kos sekali per bulan.
-- Hanya service_role (server Vercel) yang bisa memanggil / membaca. Jalankan sekali di SQL Editor
-- Supabase (idempoten: aman diulang).

begin;

-- ---------- tabel ----------
create table if not exists public.kosan_dompet (
  room       int  not null check (room between 1 and 40),
  nama_norm  text not null check (length(nama_norm) between 1 and 30),
  saldo      bigint not null default 0 check (saldo >= 0 and saldo <= 100000000),
  diperbarui timestamptz not null default now(),
  primary key (room, nama_norm)
);

create table if not exists public.kosan_mutasi (
  id            bigserial primary key,
  room          int  not null check (room between 1 and 40),
  nama_norm     text not null,
  jumlah        int  not null check (jumlah <> 0 and jumlah between -1000000 and 1000000),
  jenis         text not null check (jenis in ('gaji', 'beli', 'sewa')),
  keterangan    text not null check (length(keterangan) <= 80),
  saldo_sesudah bigint not null check (saldo_sesudah >= 0),
  dibuat        timestamptz not null default now()
);
create index if not exists kosan_mutasi_penghuni_idx on public.kosan_mutasi (room, nama_norm, id desc);

create table if not exists public.kosan_pekerjaan (
  room        int  not null check (room between 1 and 40),
  nama_norm   text not null,
  pekerjaan   text not null check (pekerjaan in ('kafe', 'warung', 'ronda', 'laundry')),
  shift_total int  not null default 0 check (shift_total >= 0),
  terdaftar   timestamptz not null default now(),
  primary key (room, nama_norm, pekerjaan)
);

create table if not exists public.kosan_shift (
  id        uuid primary key default gen_random_uuid(),
  room      int  not null check (room between 1 and 40),
  nama_norm text not null,
  pekerjaan text not null check (pekerjaan in ('kafe', 'warung', 'ronda', 'laundry')),
  tanggal   date not null, -- tanggal WIB saat mulai (jatah per hari)
  mulai     timestamptz not null default now(),
  selesai   timestamptz,
  status    text not null default 'aktif' check (status in ('aktif', 'selesai', 'batal', 'kedaluwarsa')),
  gaji      int check (gaji is null or gaji between 0 and 20000),
  tip       int check (tip is null or tip between 0 and 20000),
  benar     int check (benar is null or benar between 0 and 1000),
  salah     int check (salah is null or salah between 0 and 1000)
);
create index if not exists kosan_shift_penghuni_idx on public.kosan_shift (room, nama_norm, tanggal);
-- paling banyak SATU shift aktif per penghuni (dua "mulai" paralel: yang kedua unique_violation)
create unique index if not exists kosan_shift_satu_aktif on public.kosan_shift (room, nama_norm) where status = 'aktif';

create table if not exists public.kosan_barang (
  room      int  not null check (room between 1 and 40),
  nama_norm text not null,
  barang    text not null check (barang ~ '^[a-z0-9_]{2,30}$'),
  dibeli    timestamptz not null default now(),
  primary key (room, nama_norm, barang)
);

create table if not exists public.kosan_sewa (
  room      int  not null check (room between 1 and 40),
  nama_norm text not null,
  bulan     text not null check (bulan ~ '^[0-9]{4}-[0-9]{2}$'), -- bulan WIB
  jumlah    int  not null check (jumlah between 1 and 1000000),
  dibayar   timestamptz not null default now(),
  primary key (room, nama_norm, bulan)
);

-- ---------- akses: hanya service_role ----------
alter table public.kosan_dompet    enable row level security;
alter table public.kosan_mutasi    enable row level security;
alter table public.kosan_pekerjaan enable row level security;
alter table public.kosan_shift     enable row level security;
alter table public.kosan_barang    enable row level security;
alter table public.kosan_sewa      enable row level security;
-- Tanpa policy = anon/authenticated tidak bisa baca/tulis walau punya grant; grant bawaan dicabut juga.
revoke all on table public.kosan_dompet, public.kosan_mutasi, public.kosan_pekerjaan, public.kosan_shift, public.kosan_barang, public.kosan_sewa
  from public, anon, authenticated;
revoke all on sequence public.kosan_mutasi_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.kosan_dompet, public.kosan_mutasi, public.kosan_pekerjaan, public.kosan_shift, public.kosan_barang, public.kosan_sewa
  to service_role;
grant usage, select on sequence public.kosan_mutasi_id_seq to service_role;

-- ---------- fungsi ----------
-- Pesan RAISE yang dikenal server (api/_lib/app.js PESAN_KERJA): belum_daftar, batas_hari,
-- jeda:<detik>, ada_shift, shift_tidak_ada, shift_tidak_aktif, terlalu_cepat, kedaluwarsa,
-- saldo_kurang, sudah_punya, sudah_lunas. Pesan lain = galat server (503).

-- Baca dompet + status kerja. Shift aktif yang lebih tua dari p_maks_detik ditandai kedaluwarsa.
create or replace function public.kosan_dompet_baca(p_room int, p_nama text, p_tanggal date, p_bulan text, p_maks_detik int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.kosan_shift set status = 'kedaluwarsa', selesai = now()
   where room = p_room and nama_norm = p_nama and status = 'aktif' and mulai < now() - make_interval(secs => p_maks_detik);
  return jsonb_build_object(
    'saldo', coalesce((select d.saldo from public.kosan_dompet d where d.room = p_room and d.nama_norm = p_nama), 0),
    'pekerjaan', coalesce((select jsonb_agg(jsonb_build_object('pekerjaan', k.pekerjaan, 'shift_total', k.shift_total) order by k.pekerjaan)
                             from public.kosan_pekerjaan k where k.room = p_room and k.nama_norm = p_nama), '[]'::jsonb),
    'shift_hari_ini', (select count(*) from public.kosan_shift s
                        where s.room = p_room and s.nama_norm = p_nama and s.tanggal = p_tanggal and s.status = 'selesai'),
    'shift_aktif', (select jsonb_build_object('id', s.id, 'pekerjaan', s.pekerjaan, 'mulai', s.mulai) from public.kosan_shift s
                     where s.room = p_room and s.nama_norm = p_nama and s.status = 'aktif' order by s.mulai desc limit 1),
    'terakhir_selesai', (select max(s.selesai) from public.kosan_shift s
                          where s.room = p_room and s.nama_norm = p_nama and s.status = 'selesai'),
    'sewa_bulan', p_bulan,
    'sewa_lunas', exists (select 1 from public.kosan_sewa w where w.room = p_room and w.nama_norm = p_nama and w.bulan = p_bulan),
    'barang', coalesce((select jsonb_agg(b.barang order by b.dibeli) from public.kosan_barang b
                         where b.room = p_room and b.nama_norm = p_nama), '[]'::jsonb),
    'riwayat', coalesce((select jsonb_agg(jsonb_build_object('jumlah', m.jumlah, 'jenis', m.jenis, 'keterangan', m.keterangan,
                                                             'saldo_sesudah', m.saldo_sesudah, 'dibuat', m.dibuat) order by m.id desc)
                          from (select * from public.kosan_mutasi m2 where m2.room = p_room and m2.nama_norm = p_nama
                                 order by m2.id desc limit 10) m), '[]'::jsonb),
    'sekarang', now());
end $$;

-- Daftar pekerjaan (idempoten).
create or replace function public.kosan_kerja_daftar(p_room int, p_nama text, p_pekerjaan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_total int;
begin
  if p_pekerjaan is null or p_pekerjaan not in ('kafe', 'warung', 'ronda', 'laundry') then raise exception 'pekerjaan tidak valid'; end if;
  insert into public.kosan_pekerjaan (room, nama_norm, pekerjaan) values (p_room, p_nama, p_pekerjaan)
  on conflict (room, nama_norm, pekerjaan) do nothing;
  select k.shift_total into v_total from public.kosan_pekerjaan k
   where k.room = p_room and k.nama_norm = p_nama and k.pekerjaan = p_pekerjaan;
  return jsonb_build_object('pekerjaan', p_pekerjaan, 'shift_total', v_total);
end $$;

-- Mulai shift: wajib terdaftar, jatah p_maks_hari shift SELESAI per tanggal WIB, jeda p_jeda_detik
-- sesudah shift selesai terakhir. Shift aktif lain milik penghuni ini dibatalkan (muat ulang HP).
create or replace function public.kosan_kerja_mulai(p_room int, p_nama text, p_pekerjaan text, p_tanggal date,
  p_maks_hari int, p_jeda_detik int, p_maks_detik int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_mulai timestamptz; v_akhir timestamptz;
begin
  if not exists (select 1 from public.kosan_pekerjaan k where k.room = p_room and k.nama_norm = p_nama and k.pekerjaan = p_pekerjaan) then
    raise exception 'belum_daftar';
  end if;
  update public.kosan_shift set status = 'kedaluwarsa', selesai = now()
   where room = p_room and nama_norm = p_nama and status = 'aktif' and mulai < now() - make_interval(secs => p_maks_detik);
  if (select count(*) from public.kosan_shift s
       where s.room = p_room and s.nama_norm = p_nama and s.tanggal = p_tanggal and s.status = 'selesai') >= p_maks_hari then
    raise exception 'batas_hari';
  end if;
  select max(s.selesai) into v_akhir from public.kosan_shift s where s.room = p_room and s.nama_norm = p_nama and s.status = 'selesai';
  if v_akhir is not null and v_akhir > now() - make_interval(secs => p_jeda_detik) then
    raise exception 'jeda:%', ceil(extract(epoch from (v_akhir + make_interval(secs => p_jeda_detik) - now())))::int;
  end if;
  update public.kosan_shift set status = 'batal', selesai = now() where room = p_room and nama_norm = p_nama and status = 'aktif';
  begin
    insert into public.kosan_shift (room, nama_norm, pekerjaan, tanggal) values (p_room, p_nama, p_pekerjaan, p_tanggal)
    returning id, mulai into v_id, v_mulai;
  exception when unique_violation then
    raise exception 'ada_shift';
  end;
  return jsonb_build_object('id', v_id, 'mulai', v_mulai);
end $$;

-- Baca satu shift (untuk hitung upah di server): pekerjaan, status, lama (detik), shift_total pekerjaannya.
create or replace function public.kosan_kerja_shift(p_room int, p_nama text, p_shift uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('pekerjaan', s.pekerjaan, 'status', s.status,
           'detik', floor(extract(epoch from (now() - s.mulai)))::int,
           'shift_total', coalesce((select k.shift_total from public.kosan_pekerjaan k
                                     where k.room = s.room and k.nama_norm = s.nama_norm and k.pekerjaan = s.pekerjaan), 0))
    from public.kosan_shift s where s.id = p_shift and s.room = p_room and s.nama_norm = p_nama;
$$;

-- Selesaikan shift + bayar (ATOMIK, baris shift dikunci): status aktif, milik penghuni ini, durasi
-- di antara p_min_detik dan p_maks_detik. Upah (p_gaji + p_tip) dihitung server, dijepit di sini.
create or replace function public.kosan_kerja_selesai(p_room int, p_nama text, p_shift uuid, p_gaji int, p_tip int,
  p_benar int, p_salah int, p_min_detik int, p_maks_detik int, p_keterangan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s record; v_total int; v_saldo bigint;
begin
  if p_gaji is null or p_tip is null or p_gaji < 0 or p_tip < 0 or p_gaji + p_tip > 20000 then raise exception 'upah tidak valid'; end if;
  select * into s from public.kosan_shift where id = p_shift and room = p_room and nama_norm = p_nama for update;
  if not found then raise exception 'shift_tidak_ada'; end if;
  if s.status <> 'aktif' then raise exception 'shift_tidak_aktif'; end if;
  if s.mulai > now() - make_interval(secs => p_min_detik) then raise exception 'terlalu_cepat'; end if;
  if s.mulai < now() - make_interval(secs => p_maks_detik) then raise exception 'kedaluwarsa'; end if;
  update public.kosan_shift set status = 'selesai', selesai = now(), gaji = p_gaji, tip = p_tip,
         benar = least(greatest(coalesce(p_benar, 0), 0), 1000), salah = least(greatest(coalesce(p_salah, 0), 0), 1000)
   where id = p_shift;
  insert into public.kosan_pekerjaan as k (room, nama_norm, pekerjaan, shift_total) values (p_room, p_nama, s.pekerjaan, 1)
  on conflict (room, nama_norm, pekerjaan) do update set shift_total = k.shift_total + 1
  returning k.shift_total into v_total;
  insert into public.kosan_dompet as d (room, nama_norm, saldo) values (p_room, p_nama, p_gaji + p_tip)
  on conflict (room, nama_norm) do update set saldo = d.saldo + excluded.saldo, diperbarui = now()
  returning d.saldo into v_saldo;
  if p_gaji + p_tip > 0 then
    insert into public.kosan_mutasi (room, nama_norm, jumlah, jenis, keterangan, saldo_sesudah)
    values (p_room, p_nama, p_gaji + p_tip, 'gaji', left(coalesce(p_keterangan, 'Gaji'), 80), v_saldo);
  end if;
  return jsonb_build_object('saldo', v_saldo, 'shift_total', v_total, 'pekerjaan', s.pekerjaan);
end $$;

-- Batalkan shift aktif (tanpa upah, tidak dihitung jatah).
create or replace function public.kosan_kerja_batal(p_room int, p_nama text, p_shift uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.kosan_shift set status = 'batal', selesai = now()
   where id = p_shift and room = p_room and nama_norm = p_nama and status = 'aktif';
  return found;
end $$;

-- Beli (harga dari katalog server). p_unik = aksesori / dekor: sekali beli. Saldo tidak cukup =
-- seluruh transaksi batal (termasuk catatan barang).
create or replace function public.kosan_beli(p_room int, p_nama text, p_barang text, p_harga int, p_unik boolean, p_keterangan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_saldo bigint;
begin
  if p_harga is null or p_harga < 1 or p_harga > 1000000 then raise exception 'harga tidak valid'; end if;
  if p_barang is null or p_barang !~ '^[a-z0-9_]{2,30}$' then raise exception 'barang tidak valid'; end if;
  if p_unik then
    insert into public.kosan_barang (room, nama_norm, barang) values (p_room, p_nama, p_barang)
    on conflict (room, nama_norm, barang) do nothing;
    if not found then raise exception 'sudah_punya'; end if;
  end if;
  update public.kosan_dompet set saldo = saldo - p_harga, diperbarui = now()
   where room = p_room and nama_norm = p_nama and saldo >= p_harga
  returning saldo into v_saldo;
  if not found then raise exception 'saldo_kurang'; end if;
  insert into public.kosan_mutasi (room, nama_norm, jumlah, jenis, keterangan, saldo_sesudah)
  values (p_room, p_nama, -p_harga, 'beli', left(coalesce(p_keterangan, 'Belanja'), 80), v_saldo);
  return jsonb_build_object('saldo', v_saldo);
end $$;

-- Bayar uang kos bulan p_bulan (WIB) sekali.
create or replace function public.kosan_sewa_bayar(p_room int, p_nama text, p_bulan text, p_jumlah int, p_keterangan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_saldo bigint;
begin
  if p_jumlah is null or p_jumlah < 1 or p_jumlah > 1000000 then raise exception 'jumlah tidak valid'; end if;
  if p_bulan is null or p_bulan !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'bulan tidak valid'; end if;
  insert into public.kosan_sewa (room, nama_norm, bulan, jumlah) values (p_room, p_nama, p_bulan, p_jumlah)
  on conflict (room, nama_norm, bulan) do nothing;
  if not found then raise exception 'sudah_lunas'; end if;
  update public.kosan_dompet set saldo = saldo - p_jumlah, diperbarui = now()
   where room = p_room and nama_norm = p_nama and saldo >= p_jumlah
  returning saldo into v_saldo;
  if not found then raise exception 'saldo_kurang'; end if;
  insert into public.kosan_mutasi (room, nama_norm, jumlah, jenis, keterangan, saldo_sesudah)
  values (p_room, p_nama, -p_jumlah, 'sewa', left(coalesce(p_keterangan, 'Uang kos'), 80), v_saldo);
  return jsonb_build_object('saldo', v_saldo, 'bulan', p_bulan);
end $$;

-- Hanya server (service_role). Hak EXECUTE bawaan PUBLIC ikut dicabut.
revoke all on function public.kosan_dompet_baca(int, text, date, text, int) from public, anon, authenticated;
revoke all on function public.kosan_kerja_daftar(int, text, text) from public, anon, authenticated;
revoke all on function public.kosan_kerja_mulai(int, text, text, date, int, int, int) from public, anon, authenticated;
revoke all on function public.kosan_kerja_shift(int, text, uuid) from public, anon, authenticated;
revoke all on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) from public, anon, authenticated;
revoke all on function public.kosan_kerja_batal(int, text, uuid) from public, anon, authenticated;
revoke all on function public.kosan_beli(int, text, text, int, boolean, text) from public, anon, authenticated;
revoke all on function public.kosan_sewa_bayar(int, text, text, int, text) from public, anon, authenticated;
grant execute on function public.kosan_dompet_baca(int, text, date, text, int) to service_role;
grant execute on function public.kosan_kerja_daftar(int, text, text) to service_role;
grant execute on function public.kosan_kerja_mulai(int, text, text, date, int, int, int) to service_role;
grant execute on function public.kosan_kerja_shift(int, text, uuid) to service_role;
grant execute on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) to service_role;
grant execute on function public.kosan_kerja_batal(int, text, uuid) to service_role;
grant execute on function public.kosan_beli(int, text, text, int, boolean, text) to service_role;
grant execute on function public.kosan_sewa_bayar(int, text, text, int, text) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_beli(int,text,text,int,boolean,text)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_beli(int,text,text,int,boolean,text)', 'execute');  -- true
--   select has_table_privilege('anon', 'public.kosan_dompet', 'select');                                            -- false
--   select count(*) from kosan_residents;                                                                           -- tidak berubah
-- Uji di transaksi yang dibatalkan (kamar 99 tidak ada: CHECK room 1..40 -> pakai kamar uji 40 + nama uji):
--   begin;
--   select public.kosan_kerja_daftar(40, 'uji kerja', 'kafe');
--   select public.kosan_kerja_mulai(40, 'uji kerja', 'kafe', current_date, 3, 600, 1200);         -- {"id": ..., "mulai": ...}
--   select public.kosan_kerja_selesai(40, 'uji kerja', (select id from kosan_shift where nama_norm = 'uji kerja' and status = 'aktif'),
--                                     7000, 2000, 6, 0, 100, 1200, 'Gaji uji');                     -- galat: terlalu_cepat (belum 100 dtk)
--   update kosan_shift set mulai = now() - interval '3 minutes' where nama_norm = 'uji kerja' and status = 'aktif';
--   select public.kosan_kerja_selesai(40, 'uji kerja', (select id from kosan_shift where nama_norm = 'uji kerja' and status = 'aktif'),
--                                     7000, 2000, 6, 0, 100, 1200, 'Gaji uji');                     -- {"saldo": 9000, "shift_total": 1, ...}
--   select public.kosan_kerja_mulai(40, 'uji kerja', 'kafe', current_date, 3, 600, 1200);         -- galat: jeda:600 (kira-kira)
--   select public.kosan_beli(40, 'uji kerja', 'poster', 12000, true, 'Beli uji');                 -- galat: saldo_kurang
--   select public.kosan_beli(40, 'uji kerja', 'kopisusu', 4000, false, 'Beli uji');               -- {"saldo": 5000}
--   select public.kosan_sewa_bayar(40, 'uji kerja', to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM'), 100000, 'Uang kos uji');  -- galat: saldo_kurang
--   select public.kosan_dompet_baca(40, 'uji kerja', current_date, '2026-11', 1200);
--   rollback;
