-- Email selalu disimpan HURUF KECIL (docs/PLAN.md bagian 6f).
--
-- Sebelumnya "Budi@X.com" dan "budi@x.com" dianggap dua alamat berbeda: murid yang mengetik huruf
-- besar gagal masuk, tautan reset tidak pernah terkirim, undangan/akun ganda lolos, dan lockout
-- login bisa dilewati dengan mengganti kapitalisasi. Aplikasi kini menormalkan di DTO dan service;
-- migrasi ini (1) membereskan data yang sudah ada dan (2) memasang CHECK sebagai lapisan TERAKHIR,
-- supaya jalur kode/skrip mana pun yang lupa menormalkan GAGAL KERAS alih-alih diam-diam membuat
-- alamat kembar.
--
-- CHECK-nya sengaja hanya melarang huruf ASCII besar, bukan `email = lower(email)`: `lower()` di
-- Postgres bergantung pada locale/libc untuk karakter non-ASCII dan bisa berbeda dari
-- `String.prototype.toLowerCase()` di aplikasi -- akan menolak nilai sah yang sudah dinormalkan.

-- Alamat kembar yang HANYA beda huruf besar/kecil tidak bisa diselesaikan otomatis (mana yang
-- benar?). Hentikan dengan pesan yang jelas, bukan dengan galat unique constraint yang membingungkan.
-- (`invitations.email` tidak unik, jadi tidak perlu dicek.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'users.email punya alamat kembar yang hanya beda huruf besar/kecil -- selesaikan manual sebelum migrasi ini';
  END IF;
  IF EXISTS (SELECT 1 FROM "admin_users" GROUP BY lower("email") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'admin_users.email punya alamat kembar yang hanya beda huruf besar/kecil -- selesaikan manual sebelum migrasi ini';
  END IF;
END $$;

UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "admin_users" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "invitations" SET "email" = lower("email") WHERE "email" <> lower("email");

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" !~ '[A-Z]');
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_lowercase" CHECK ("email" !~ '[A-Z]');
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_lowercase" CHECK ("email" !~ '[A-Z]');
