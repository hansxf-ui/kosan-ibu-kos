-- Kerja & Belanja — kunci per penghuni untuk mulai / selesai / batal shift (audit 16 Nov).
-- Masalah: di READ COMMITTED, cek jatah harian + jeda 10 menit di kosan_kerja_mulai adalah bacaan
-- biasa, sedangkan kosan_kerja_selesai hanya mengunci baris shift-nya. Permintaan "mulai" yang
-- tepat bertumpuk dengan "selesai" bisa membaca shift A masih 'aktif' (belum dihitung), lalu
-- membuat shift B tanpa jeda, bahkan shift ke-4 hari itu.
-- Perbaikan: baris PERTAMA ketiga fungsi = pg_advisory_xact_lock per (kamar, nama). Permintaan
-- kerja milik penghuni yang sama berjalan bergantian; kunci lepas sendiri saat transaksi selesai.
-- Penghuni lain tidak saling menunggu (kunci beda; tabrakan hash hanya membuat antre sebentar).
-- Isi fungsi lain SAMA PERSIS dengan 20261116_kerja_belanja.sql (dicek tests/kerja-server.test.js).
-- HANYA mengganti isi 3 fungsi (nama, argumen, hasil sama; create or replace mempertahankan hak
-- akses, revoke/grant diulang supaya berkas ini lengkap sendiri). Tidak ada tabel / data yang
-- disentuh. Jalankan SESUDAH 20261116_kerja_belanja.sql, sekali di SQL Editor (idempoten).

begin;

create or replace function public.kosan_kerja_mulai(p_room int, p_nama text, p_pekerjaan text, p_tanggal date,
  p_maks_hari int, p_jeda_detik int, p_maks_detik int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_mulai timestamptz; v_akhir timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kosan_kerja:' || p_room::text || ':' || p_nama));
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

create or replace function public.kosan_kerja_selesai(p_room int, p_nama text, p_shift uuid, p_gaji int, p_tip int,
  p_benar int, p_salah int, p_min_detik int, p_maks_detik int, p_keterangan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s record; v_total int; v_saldo bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kosan_kerja:' || p_room::text || ':' || p_nama));
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

create or replace function public.kosan_kerja_batal(p_room int, p_nama text, p_shift uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kosan_kerja:' || p_room::text || ':' || p_nama));
  update public.kosan_shift set status = 'batal', selesai = now()
   where id = p_shift and room = p_room and nama_norm = p_nama and status = 'aktif';
  return found;
end $$;

revoke all on function public.kosan_kerja_mulai(int, text, text, date, int, int, int) from public, anon, authenticated;
revoke all on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) from public, anon, authenticated;
revoke all on function public.kosan_kerja_batal(int, text, uuid) from public, anon, authenticated;
grant execute on function public.kosan_kerja_mulai(int, text, text, date, int, int, int) to service_role;
grant execute on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) to service_role;
grant execute on function public.kosan_kerja_batal(int, text, uuid) to service_role;

commit;

-- ---------- Cek sesudah migrasi ----------
--   select has_function_privilege('anon', 'public.kosan_kerja_mulai(int,text,text,date,int,int,int)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_kerja_mulai(int,text,text,date,int,int,int)', 'execute');  -- true
--   select prosrc like '%pg_advisory_xact_lock%' from pg_proc where proname in ('kosan_kerja_mulai', 'kosan_kerja_selesai', 'kosan_kerja_batal');  -- 3x true
-- Uji kunci dengan DUA tab SQL Editor (kamar uji 40, transaksi dibatalkan):
--   tab 1: begin; select public.kosan_kerja_batal(40, 'uji kerja', gen_random_uuid());   -- kunci dipegang (transaksi belum selesai)
--   tab 2: select public.kosan_kerja_batal(40, 'uji kerja', gen_random_uuid());           -- MENUNGGU sampai tab 1 selesai
--   tab 1: rollback;                                                                      -- tab 2 langsung selesai (false)
