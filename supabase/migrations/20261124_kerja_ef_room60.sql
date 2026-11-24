-- 24 Nov 2026: tabel kerja/dompet/belanja masih membatasi kamar 1..40, sehingga
-- penghuni Gedung E/F (kamar 41..60) selalu ditolak (503 "Server lagi sibuk").
-- Samakan dengan kosan_residents/kosan_akun: kamar 1..60.
begin;
alter table kosan_dompet    drop constraint kosan_dompet_room_check,    add constraint kosan_dompet_room_check    check (room >= 1 and room <= 60);
alter table kosan_mutasi    drop constraint kosan_mutasi_room_check,    add constraint kosan_mutasi_room_check    check (room >= 1 and room <= 60);
alter table kosan_pekerjaan drop constraint kosan_pekerjaan_room_check, add constraint kosan_pekerjaan_room_check check (room >= 1 and room <= 60);
alter table kosan_shift     drop constraint kosan_shift_room_check,     add constraint kosan_shift_room_check     check (room >= 1 and room <= 60);
alter table kosan_barang    drop constraint kosan_barang_room_check,    add constraint kosan_barang_room_check    check (room >= 1 and room <= 60);
alter table kosan_sewa      drop constraint kosan_sewa_room_check,      add constraint kosan_sewa_room_check      check (room >= 1 and room <= 60);
commit;
