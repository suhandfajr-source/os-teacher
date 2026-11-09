import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

import { nanoid } from "nanoid";

async function main() {
  const email = "guru.demo@klassa.id";
  const password = "Password123!";
  const name = "Bapak Guru Demo, S.Pd.";

  console.log(`Setting up demo account: ${email}...`);

  const hashedPassword = await hashPassword(password);

  let school = await prisma.school.findFirst({
    where: { npsn: "20108899" },
  });

  if (!school) {
    school = await prisma.school.create({
      data: {
        id: "school_" + nanoid(16),
        name: "SMA Negeri 1 Nusantara",
        normalizedName: "sma negeri 1 nusantara",
        npsn: "20108899",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
      },
    });
    console.log("School created:", school.name);
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "user_" + nanoid(16),
        name,
        email,
        emailVerified: true,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("User created:", user.name);
  }

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: "acc_" + nanoid(16),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    });
  }

  let teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
  });

  if (!teacherProfile) {
    teacherProfile = await prisma.teacherProfile.create({
      data: {
        id: "tp_" + nanoid(16),
        userId: user.id,
        preferredName: "Pak Guru Demo",
        activeSchoolId: school.id,
        onboardingCompleted: true,
      },
    });
  } else {
    await prisma.teacherProfile.update({
      where: { id: teacherProfile.id },
      data: { onboardingCompleted: true, activeSchoolId: school.id },
    });
  }

  const existingMembership = await prisma.teacherSchoolMembership.findFirst({
    where: { teacherProfileId: teacherProfile.id, schoolId: school.id },
  });

  if (!existingMembership) {
    await prisma.teacherSchoolMembership.create({
      data: {
        id: "tsm_" + nanoid(16),
        teacherProfileId: teacherProfile.id,
        schoolId: school.id,
        status: "ACTIVE",
      },
    });
  }

  console.log("SUCCESS! Account ready.");
  console.log("Email   :", email);
  console.log("Password:", password);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
