import { prisma } from "../src/lib/auth";

/**
 * Gate N3: Audit & Backfill Canonical NIS Siswa
 * 
 * Aturan kanonik:
 * 1. Trim spasi depan/belakang
 * 2. Uppercase (huruf besar)
 * 3. String kosong ("" atau spasi saja) dikonversi ke null
 * 4. Pengecekan duplikasi [schoolId, nis] per sekolah
 */
async function auditAndBackfillStudentNis() {
  console.log("=== GATE N3: Audit & Backfill Canonical NIS Siswa ===");

  const BATCH_SIZE = 100;
  let skip = 0;
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalNullified = 0;
  const duplicateAlerts: Array<{ schoolId: string; nis: string; count: number }> = [];

  try {
    const totalStudents = await prisma.student.count();
    console.log(`Ditemukan ${totalStudents} siswa di database.`);

    while (true) {
      const students = await prisma.student.findMany({
        skip,
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        select: { id: true, schoolId: true, fullName: true, nis: true },
      });

      if (students.length === 0) break;

      for (const s of students) {
        totalScanned++;

        if (s.nis === null) {
          continue;
        }

        const trimmed = s.nis.trim();
        const targetNis = trimmed === "" ? null : trimmed.toUpperCase();

        if (s.nis !== targetNis) {
          await prisma.student.update({
            where: { id: s.id },
            data: { nis: targetNis },
          });
          totalUpdated++;
          if (targetNis === null) {
            totalNullified++;
            console.log(`[NULLIFIED] ${s.fullName} (${s.id}) NIS "${s.nis}" -> null`);
          } else {
            console.log(`[CANONICALIZED] ${s.fullName} (${s.id}) NIS "${s.nis}" -> "${targetNis}"`);
          }
        }
      }

      skip += students.length;
    }

    // 2. Audit Duplikasi per Sekolah
    console.log("--- Menjalankan Audit Duplikasi [schoolId, nis] ---");
    const duplicates = await prisma.$queryRaw<Array<{ schoolId: string; nis: string; count: bigint }>>`
      SELECT "schoolId", "nis", COUNT(*) as count
      FROM "student"
      WHERE "nis" IS NOT NULL
      GROUP BY "schoolId", "nis"
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.warn("⚠️  PERINGATAN: Ditemukan duplikasi NIS di sekolah yang sama:");
      for (const d of duplicates) {
        console.warn(`- Sekolah ${d.schoolId} | NIS: ${d.nis} | Jumlah: ${Number(d.count)} baris`);
        duplicateAlerts.push({ schoolId: d.schoolId, nis: d.nis, count: Number(d.count) });
      }
      throw new Error(`Gate N3 Gagal: Terdapat ${duplicates.length} grup duplikasi NIS yang harus diselesaikan manual.`);
    } else {
      console.log("✅ Audit Lolos: 0 duplikasi NIS ditemukan di seluruh sekolah.");
    }

    console.log("=== GATE N3 COMPLETED ===");
    console.log(`Total Siswa Dipindai : ${totalScanned}`);
    console.log(`Total NIS Terupdate  : ${totalUpdated} (Diubah ke null: ${totalNullified})`);
    console.log(`Status Gate N3       : LULUS (Siap untuk autentikasi siswa)`);
  } catch (err: unknown) {
    console.error("❌ Gate N3 Gagal:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

auditAndBackfillStudentNis();
