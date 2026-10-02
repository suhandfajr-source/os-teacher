-- Drop fitur deteksi konflik tanggal lahir (dead code): cabang penulisnya tak pernah
-- terjangkau (code review 2026-09-27); keputusan user opsi A 2026-10-02.
ALTER TABLE "student" DROP COLUMN "birthDateConflict";
ALTER TABLE "student" DROP COLUMN "conflictBirthDates";
