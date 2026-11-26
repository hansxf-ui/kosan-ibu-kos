-- Arkade Ria (Ryan 26 Nov: "Gas, Arkade dulu") — papan skor mingguan tiga game arkade di interior Kota
-- (capit, balap, dansa) + hadiah boneka pajangan kamar.
-- HANYA MENAMBAH satu tabel + dua fungsi. Tabel lain TIDAK diubah; kosan_barang hanya DITULISI
-- (boneka hadiah) lewat fungsi di bawah.
-- PRASYARAT: migrasi 20261124_kerja_ef_room60.sql sudah jalan (kosan_barang CHECK room 1..60);
--   tanpa itu penghuni Gedung E/F (kamar 41-60) ditolak saat menerima boneka (pelajaran bug E/F 24 Nov).
-- Angka batas di berkas ini: room 1..60 (= JUMLAH_KAMAR di api/_lib/app.js). Kalau kapasitas kos
--   dinaikkan lagi, CHECK kosan_skor.room di bawah WAJIB ikut dinaikkan.
-- Identitas = (room, nama_norm) dari sesi server, sama seperti dompet. Skor sudah dijepit server
-- (api/_lib/arkade.js) sebelum sampai ke sini; fungsi di sini hanya menjaga "skor terbaik per minggu".
-- Tidak ada uang yang berubah. Hanya service_role (server Vercel) yang bisa memanggil / membaca.
-- Idempoten: aman diulang.

begin;

create table if not exists public.kosan_skor (
  room       int  not null check (room between 1 and 60),
  nama_norm  text not null check (length(nama_norm) between 1 and 30),
  game       text not null check (game in ('capit', 'balap', 'dansa')),
  minggu     date not null, -- tanggal Senin (WIB) minggu itu
  skor       int  not null check (skor between 0 and 100000),
  main       int  not null default 1 check (main >= 1),
  diperbarui timestamptz not null default now(), -- kapan skor terbaik dicapai (penentu seri)
  primary key (room, nama_norm, game, minggu)
);
create index if not exists kosan_skor_papan_idx on public.kosan_skor (minggu, game, skor desc, diperbarui);

alter table public.kosan_skor enable row level security; -- tanpa policy: anon/authenticated tidak bisa baca/tulis
revoke all on table public.kosan_skor from public, anon, authenticated;
grant select, insert, update, delete on table public.kosan_skor to service_role;

-- Simpan skor: hanya menggantikan kalau lebih tinggi. p_hadiah (opsional) = kode barang hadiah yang
-- diberikan sekali (kosan_barang; sudah punya = tidak apa-apa).
create or replace function public.kosan_skor_kirim(p_room int, p_nama text, p_game text, p_minggu date, p_skor int, p_hadiah text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lama int;
  v_terbaik int;
  v_hadiah boolean := false;
  v_n int;
begin
  if p_room is null or p_room < 1 or p_room > 60 then raise exception 'kamar tidak valid'; end if;
  if p_nama is null or length(p_nama) < 1 or length(p_nama) > 30 then raise exception 'nama tidak valid'; end if;
  if p_game is null or p_game not in ('capit', 'balap', 'dansa') then raise exception 'game tidak valid'; end if;
  if p_skor is null or p_skor < 0 or p_skor > 100000 then raise exception 'skor tidak valid'; end if;
  if p_hadiah is not null and p_hadiah !~ '^[a-z0-9_]{2,30}$' then raise exception 'hadiah tidak valid'; end if;
  select s.skor into v_lama from public.kosan_skor s
   where s.room = p_room and s.nama_norm = p_nama and s.game = p_game and s.minggu = p_minggu for update;
  insert into public.kosan_skor (room, nama_norm, game, minggu, skor) values (p_room, p_nama, p_game, p_minggu, p_skor)
  on conflict (room, nama_norm, game, minggu) do update
     set main = public.kosan_skor.main + 1,
         diperbarui = case when excluded.skor > public.kosan_skor.skor then now() else public.kosan_skor.diperbarui end,
         skor = greatest(public.kosan_skor.skor, excluded.skor)
  returning skor into v_terbaik;
  if p_hadiah is not null then
    insert into public.kosan_barang (room, nama_norm, barang) values (p_room, p_nama, p_hadiah) on conflict do nothing;
    get diagnostics v_n = row_count;
    v_hadiah := v_n > 0;
  end if;
  return jsonb_build_object('terbaik', v_terbaik, 'rekor', v_lama is null or p_skor > v_lama, 'hadiah_baru', v_hadiah);
end $$;

-- Papan minggu p_minggu: p_batas teratas per game (skor > 0), seri = yang lebih dulu mencapai.
-- Yang keluar hanya nama penghuni (sudah publik di game lewat kosan_occupants) + skor.
create or replace function public.kosan_skor_papan(p_minggu date, p_batas int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('game', x.game, 'nama', x.nama_norm, 'skor', x.skor) order by x.game, x.urut), '[]'::jsonb)
    from (select s.game, s.nama_norm, s.skor,
                 row_number() over (partition by s.game order by s.skor desc, s.diperbarui asc) as urut
            from public.kosan_skor s where s.minggu = p_minggu and s.skor > 0) x
   where x.urut <= least(greatest(coalesce(p_batas, 5), 1), 20);
$$;

revoke all on function public.kosan_skor_kirim(int, text, text, date, int, text) from public, anon, authenticated;
revoke all on function public.kosan_skor_papan(date, int) from public, anon, authenticated;
grant execute on function public.kosan_skor_kirim(int, text, text, date, int, text) to service_role;
grant execute on function public.kosan_skor_papan(date, int) to service_role;

commit;

-- ---------- Cek sesudah migrasi (harus lolos) ----------
--   select has_function_privilege('anon', 'public.kosan_skor_kirim(int,text,text,date,int,text)', 'execute');  -- false
--   select has_function_privilege('anon', 'public.kosan_skor_papan(date,int)', 'execute');                     -- false
--   select has_table_privilege('anon', 'public.kosan_skor', 'select');                                         -- false
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.kosan_skor'::regclass; -- room 1..60
--   select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.kosan_barang'::regclass and contype = 'c'; -- room 1..60
-- Uji di transaksi yang dibatalkan, WAJIB dengan kamar rentang baru (60) — pelajaran bug E/F:
--   begin;
--   select public.kosan_skor_kirim(60, 'uji arkade', 'capit', date '2026-11-23', 120, 'boneka_capit'); -- {"terbaik":120,"rekor":true,"hadiah_baru":true}
--   select public.kosan_skor_kirim(60, 'uji arkade', 'capit', date '2026-11-23', 90, 'boneka_capit');  -- {"terbaik":120,"rekor":false,"hadiah_baru":false}
--   select public.kosan_skor_kirim(1, 'uji arkade a', 'balap', date '2026-11-23', 900, null);
--   select public.kosan_skor_papan(date '2026-11-23', 5);
--   rollback;
