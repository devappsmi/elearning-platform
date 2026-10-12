-- Hasil tes penempatan (PRD AUTH-05, docs/PLAN.md bagian 7q). Kolom placement_start_unit_id sudah ada sejak init;
-- ini menambah kapan tes diambil dan skornya. Semua kolom boleh NULL: murid lama = belum pernah ikut tes.
ALTER TABLE "users" ADD COLUMN     "placement_correct" INTEGER,
ADD COLUMN     "placement_taken_at" TIMESTAMP(3),
ADD COLUMN     "placement_total" INTEGER;
