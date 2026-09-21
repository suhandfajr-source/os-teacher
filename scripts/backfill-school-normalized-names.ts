import { prisma } from "../src/lib/auth";
import { normalizeSchoolName } from "../src/lib/school-dedup";

async function backfillSchoolNormalizedNames() {
  console.log("=== BACKFILL: Recompute School.normalizedName (v2) ===");

  const BATCH_SIZE = 100;
  let skip = 0;
  let totalScanned = 0;
  let totalUpdated = 0;

  try {
    const totalSchools = await prisma.school.count();
    console.log(`Found ${totalSchools} schools in database.`);

    while (true) {
      const schools = await prisma.school.findMany({
        skip,
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        select: { id: true, name: true, normalizedName: true },
      });

      if (schools.length === 0) {
        break;
      }

      for (const school of schools) {
        totalScanned++;
        const targetNormalized = normalizeSchoolName(school.name);

        if (school.normalizedName !== targetNormalized) {
          await prisma.school.update({
            where: { id: school.id },
            data: { normalizedName: targetNormalized },
          });
          totalUpdated++;
          console.log(
            `[UPDATE] ${school.name} -> "${school.normalizedName}" => "${targetNormalized}"`
          );
        }
      }

      skip += schools.length;
    }

    console.log("=== BACKFILL COMPLETED ===");
    console.log(`Total Scanned: ${totalScanned}`);
    console.log(`Total Updated: ${totalUpdated}`);
    console.log(`Already v2 compliant: ${totalScanned - totalUpdated}`);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillSchoolNormalizedNames();
