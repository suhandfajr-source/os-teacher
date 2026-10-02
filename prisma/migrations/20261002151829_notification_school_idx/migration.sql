-- BH-16 (defer Story 5): index FK notification.schoolId untuk query notifikasi per-sekolah.
CREATE INDEX "notification_schoolId_idx" ON "notification"("schoolId");
