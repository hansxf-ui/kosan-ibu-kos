-- Perbaikan 11 (P1, audit Fase A cb21617): batas per jaringan hanya boleh
-- menghitung percobaan yang GAGAL/ditolak. Server memanggil fungsi ini
-- sesudah login / daftar / masuk kamar BERHASIL untuk mengembalikan satu
-- unit jatah yang tadi diambil kosan_batas_tambah. Jendela dihitung persis
-- sama dengan kosan_batas_tambah. Atomik (satu UPDATE), tidak pernah di bawah
-- 0; baris yang tidak ada = tidak berubah. HANYA menambah fungsi baru —
-- tabel, data penghuni, dan fungsi lama tidak disentuh. Idempoten.
-- Kalau belum dijalankan, server tetap jalan (pengembalian dilewati, login
-- tetap sukses, perilaku = sebelum perbaikan 11).

begin;

create or replace function public.kosan_batas_kembali(p_kunci text, p_detik int)
returns void language plpgsql security definer set search_path = '' as $$
declare j timestamptz;
begin
  if p_detik < 1 or length(p_kunci) > 200 then raise exception 'batas tidak valid'; end if;
  j := to_timestamp(floor(extract(epoch from now()) / p_detik) * p_detik);
  update public.kosan_batas set jumlah = greatest(jumlah - 1, 0)
   where kunci = p_kunci and jendela = j;
end $$;

revoke all on function public.kosan_batas_kembali(text, int) from public, anon, authenticated;
grant execute on function public.kosan_batas_kembali(text, int) to service_role;

commit;

-- Cek sesudah migrasi (harus lolos):
--   select has_function_privilege('anon', 'public.kosan_batas_kembali(text, int)', 'execute');          -- false
--   select has_function_privilege('service_role', 'public.kosan_batas_kembali(text, int)', 'execute');  -- true
-- Uji cepat (kunci uji, bukan IP asli):
--   select public.kosan_batas_tambah('uji:x', 3600);   -- 1
--   select public.kosan_batas_tambah('uji:x', 3600);   -- 2
--   select public.kosan_batas_kembali('uji:x', 3600);
--   select jumlah from public.kosan_batas where kunci = 'uji:x';  -- 1
--   select public.kosan_batas_kembali('uji:x', 3600); select public.kosan_batas_kembali('uji:x', 3600);
--   select jumlah from public.kosan_batas where kunci = 'uji:x';  -- 0 (tidak negatif)
--   delete from public.kosan_batas where kunci = 'uji:x';
