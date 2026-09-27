-- Tanggal lahir & deteksi anomali pendaftaran (review 36c5321)
ALTER TABLE "student" ADD COLUMN "birthDate" TEXT;
ALTER TABLE "student" ADD COLUMN "birthDateConflict" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "student" ADD COLUMN "conflictBirthDates" TEXT;
