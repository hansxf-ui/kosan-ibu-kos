-- Kerja di Kota (pemilik 27 Nov: "Gas, kerja di Kota dulu" + "logika kerjanya buat yang bener, jangan terlalu mudah juga
-- untuk dapetin duitnya") — tiga pekerjaan baru di interior Kota: barista (Kafe Bulan), resepsionis (Hotel Kencana),
-- pramuniaga (Maison Luna). Memakai tabel + fungsi kerja yang SUDAH ADA; berkas ini hanya MELEBARKAN tiga hal:
--   1. CHECK kosan_pekerjaan.pekerjaan  : + 'barista', 'resepsionis', 'pramuniaga'
--   2. CHECK kosan_shift.pekerjaan      : + tiga yang sama
--   3. fungsi kosan_kerja_daftar        : daftar pekerjaan sah + tiga yang sama
--   4. fungsi kosan_kerja_selesai       : batas gaji + tip per shift 20.000 -> 25.000 (upah Kota paling tinggi
--      16.500 + 6.000 = 22.500 di pangkat tertinggi; kampung paling tinggi 15.000). CHECK kolom kosan_shift.gaji
--      dan .tip (masing-masing <= 20.000) TIDAK diubah: gaji maks 16.500 dan tip maks 6.000 masih di bawahnya.
-- Tidak ada tabel baru, tidak ada data yang diubah, tidak ada uang yang berubah. room tetap 1..60 (CHECK lama).
-- RLS + hak akses tabel tidak disentuh; dua fungsi yang diganti diberi hak yang sama seperti sebelumnya
-- (hanya service_role). Isi dua fungsi = isi produksi 27 Nov (pg_get_functiondef), beda HANYA di dua angka/daftar di atas.
-- Angka batas di berkas ini (pelajaran bug E/F 24 Nov): daftar pekerjaan muncul di 3 tempat (dua CHECK + kosan_kerja_daftar)
--   dan di api/_lib/kerja.js + api/_lib/kerjakota.js + tests/fake-db.js; batas upah muncul di kosan_kerja_selesai + tests/fake-db.js.
-- Idempoten: aman diulang. URUTAN DEPLOY: jalankan berkas ini DULU, baru kode (kode lama tetap jalan sesudah migrasi).

begin;

alter table public.kosan_pekerjaan drop constraint if exists kosan_pekerjaan_pekerjaan_check;
alter table public.kosan_pekerjaan add constraint kosan_pekerjaan_pekerjaan_check
  check (pekerjaan in ('kafe', 'warung', 'ronda', 'laundry', 'barista', 'resepsionis', 'pramuniaga'));

alter table public.kosan_shift drop constraint if exists kosan_shift_pekerjaan_check;
alter table public.kosan_shift add constraint kosan_shift_pekerjaan_check
  check (pekerjaan in ('kafe', 'warung', 'ronda', 'laundry', 'barista', 'resepsionis', 'pramuniaga'));

create or replace function public.kosan_kerja_daftar(p_room int, p_nama text, p_pekerjaan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_total int;
begin
  if p_pekerjaan is null or p_pekerjaan not in ('kafe', 'warung', 'ronda', 'laundry', 'barista', 'resepsionis', 'pramuniaga') then raise exception 'pekerjaan tidak valid'; end if;
  insert into public.kosan_pekerjaan (room, nama_norm, pekerjaan) values (p_room, p_nama, p_pekerjaan)
  on conflict (room, nama_norm, pekerjaan) do nothing;
  select k.shift_total into v_total from public.kosan_pekerjaan k
   where k.room = p_room and k.nama_norm = p_nama and k.pekerjaan = p_pekerjaan;
  return jsonb_build_object('pekerjaan', p_pekerjaan, 'shift_total', v_total);
end $$;

create or replace function public.kosan_kerja_selesai(p_room int, p_nama text, p_shift uuid, p_gaji int, p_tip int,
  p_benar int, p_salah int, p_min_detik int, p_maks_detik int, p_keterangan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s record; v_total int; v_saldo bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kosan_kerja:' || p_room::text || ':' || p_nama));
  if p_gaji is null or p_tip is null or p_gaji < 0 or p_tip < 0 or p_gaji + p_tip > 25000 then raise exception 'upah tidak valid'; end if;
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

revoke all on function public.kosan_kerja_daftar(int, text, text) from public, anon, authenticated;
revoke all on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) from public, anon, authenticated;
grant execute on function public.kosan_kerja_daftar(int, text, text) to service_role;
grant execute on function public.kosan_kerja_selesai(int, text, uuid, int, int, int, int, int, int, text) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select pg_get_constraintdef(oid) from pg_constraint where conname in ('kosan_pekerjaan_pekerjaan_check', 'kosan_shift_pekerjaan_check');
--     -- dua baris, masing-masing memuat 7 pekerjaan (4 kampung + barista, resepsionis, pramuniaga)
--   select has_function_privilege('anon', 'public.kosan_kerja_daftar(int,text,text)', 'execute');                                    -- false
--   select has_function_privilege('anon', 'public.kosan_kerja_selesai(int,text,uuid,int,int,int,int,int,int,text)', 'execute');      -- false
--   select has_function_privilege('authenticated', 'public.kosan_kerja_selesai(int,text,uuid,int,int,int,int,int,int,text)', 'execute'); -- false
--   select has_function_privilege('service_role', 'public.kosan_kerja_selesai(int,text,uuid,int,int,int,int,int,int,text)', 'execute'); -- true
--   select prosecdef, proconfig from pg_proc where proname in ('kosan_kerja_daftar', 'kosan_kerja_selesai');  -- true, {search_path=""}
--   select relrowsecurity from pg_class where oid in ('public.kosan_pekerjaan'::regclass, 'public.kosan_shift'::regclass);           -- true, true
--
-- ---------- Uji ujung rentang kamar 41 + 60 (SELALU di-rollback: tidak meninggalkan data) ----------
-- Satu shift penuh tiap pekerjaan Kota untuk kamar 41 dan kamar 60 dengan nama uji yang mustahil dipakai penghuni
-- (diawali "zz_uji_"), upah tertinggi 16.500 + 6.000, lalu upah 25.500 yang WAJIB ditolak. Shift dimundurkan 80 detik
-- supaya lolos batas minimal 70 detik. Kalau salah satu baris gagal, seluruh blok berhenti dan tidak ada yang tersimpan.
--   begin;
--   do $uji$
--   declare k int; p text; v_shift uuid; r jsonb; n int := 0;
--   begin
--     foreach k in array array[41, 60] loop
--       foreach p in array array['barista', 'resepsionis', 'pramuniaga'] loop
--         perform public.kosan_kerja_daftar(k, 'zz_uji_kota', p);
--         r := public.kosan_kerja_mulai(k, 'zz_uji_kota', p, current_date, 99, 0, 1200);
--         v_shift := (r->>'id')::uuid;
--         update public.kosan_shift set mulai = now() - interval '80 seconds' where id = v_shift;
--         begin
--           perform public.kosan_kerja_selesai(k, 'zz_uji_kota', v_shift, 20000, 5500, 10, 0, 70, 1200, 'uji batas');
--           raise exception 'GAGAL: upah 25.500 seharusnya ditolak';
--         exception when others then
--           if sqlerrm <> 'upah tidak valid' then raise; end if;
--         end;
--         r := public.kosan_kerja_selesai(k, 'zz_uji_kota', v_shift, 16500, 6000, 10, 0, 70, 1200, 'Gaji uji Kota + tip');
--         n := n + 1;
--         if (r->>'pekerjaan') <> p or (r->>'saldo')::bigint <> 22500 * (case when k = 41 then n else n - 3 end) then
--           raise exception 'GAGAL: kamar % pekerjaan % -> %', k, p, r;
--         end if;
--       end loop;
--     end loop;
--     if (select count(*) from public.kosan_shift where nama_norm = 'zz_uji_kota' and status = 'selesai' and room in (41, 60)) <> 6 then
--       raise exception 'GAGAL: jumlah shift uji bukan 6';
--     end if;
--     raise notice 'LOLOS: 6 shift Kota (kamar 41 + 60) tercatat, upah 25.500 ditolak';
--   end $uji$;
--   rollback;
--   select count(*) from public.kosan_shift where nama_norm = 'zz_uji_kota';   -- 0 (rollback berhasil)
--   select count(*) from public.kosan_dompet where nama_norm = 'zz_uji_kota';  -- 0
--
-- ---------- Membatalkan migrasi (hanya kalau BELUM ada shift Kota tercatat) ----------
--   Jalankan lagi dua ALTER di atas dengan daftar lama ('kafe', 'warung', 'ronda', 'laundry') dan pasang kembali
--   dua fungsi dari supabase/migrations/20261116_kerja_belanja.sql. Kalau sudah ada baris pekerjaan Kota, CHECK lama
--   akan menolak — biarkan migrasi ini terpasang (kode lama tetap jalan dengannya).
