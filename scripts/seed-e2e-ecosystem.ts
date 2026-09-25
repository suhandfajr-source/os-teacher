(process.env as Record<string, string | undefined>).NODE_ENV =
  process.env.NODE_ENV || "development";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { hashPin } from "../src/lib/student-pin";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_STUDENT_PIN = "1234";

const INDONESIAN_NAMES_7A = [
  "Aditya Pratama", "Ahmad Fauzi", "Aisyah Putri", "Anisa Rahma", "Bagas Saputra",
  "Bayu Anggoro", "Citra Dewi", "Dimas Setiawan", "Dina Mariana", "Eko Prasetyo",
  "Fadhil Ramadhan", "Fitri Handayani", "Gilang Ramadhan", "Hana Pertiwi", "Ilham Hidayat",
  "Indah Permatasari", "Kevin Sanjaya", "Lestari Wulandari", "Muhammad Rizky", "Nabila Syahrani"
];

const INDONESIAN_NAMES_7B = [
  "Nurul Izzah", "Panji Gumilang", "Putri Ayu", "Rafi Ahmad", "Rangga Wijaya",
  "Ratu Bilqis", "Reza Rahadian", "Rian Hidayat", "Rina Marlina", "Rizki Maulana",
  "Salma Salsabila", "Sandhika Galih", "Siti Nurhaliza", "Syahrul Gunawan", "Taufik Hidayat",
  "Tiara Andini", "Vina Panduwinata", "Wahyu Hidayat", "Yusuf Mansur", "Zahra Amalia"
];

const INDONESIAN_NAMES_8A = [
  "Andi Wijaya", "Bima Sakti", "Clara Shinta", "Daffa Wardhana", "Eka Novita",
  "Fajar Nugroho", "Gita Gutawa", "Hafiz Al-Asad", "Intan Nuraini", "Joko Anwar",
  "Kartika Putri", "Lukman Hakim", "Maya Septha", "Naufal Samudra", "Olivia Zalianty",
  "Pradipta Arya", "Qori Sandioriva", "Rendi Jhon", "Sherina Munaf", "Tora Sudiro"
];

const INDONESIAN_NAMES_9A = [
  "Abimana Aryasatya", "Bella Saphira", "Chandra Liow", "Dian Sastrowardoyo", "Ernie Judojono",
  "Farhan Akhtar", "Gading Marten", "Helmy Yahya", "Iqbaal Ramadhan", "Joe Taslim",
  "Kunto Aji", "Luna Maya", "Marsha Timothy", "Nicholas Saputra", "Olla Ramlan",
  "Pevita Pearce", "Raditya Dika", "Sule Priatna", "Titi Kamal", "Vino G. Bastian"
];

async function main() {
  console.log("🌱 Memulai seeding ekosistem E2E yang saling terhubung...");

  const pinHash = await hashPin(DEFAULT_STUDENT_PIN);
  const teacherPasswordHash = await hashPassword("Guru1234!");
  const superadminPasswordHash = await hashPassword("Aloemni14");

  // 1. Setup / Update Superadmin suhandfajr5@gmail.com
  console.log("1️⃣ Menyiapkan akun Superadmin (suhandfajr5@gmail.com)...");
  const superadminUser = await prisma.user.upsert({
    where: { email: "suhandfajr5@gmail.com" },
    update: {
      platformRole: "ADMIN",
      role: "admin",
      banned: false,
      registrationOrigin: "PLATFORM_SEED",
    },
    create: {
      id: "superadmin_suhandfajr5",
      name: "Superadmin Platform",
      email: "suhandfajr5@gmail.com",
      emailVerified: true,
      platformRole: "ADMIN",
      role: "admin",
      registrationOrigin: "PLATFORM_SEED",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.account.upsert({
    where: { id: "account_superadmin_suhandfajr5" },
    update: {
      password: superadminPasswordHash,
      userId: superadminUser.id,
      updatedAt: new Date(),
    },
    create: {
      id: "account_superadmin_suhandfajr5",
      accountId: superadminUser.id,
      providerId: "credential",
      userId: superadminUser.id,
      password: superadminPasswordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // 2. Setup Sekolah Utama
  console.log("2️⃣ Menyiapkan Sekolah Utama: SMP Negeri 1 Nusantara...");
  const school = await prisma.school.upsert({
    where: { npsn: "20109988" },
    update: {
      name: "SMP Negeri 1 Nusantara",
      normalizedName: "smpnegeri1nusantara",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      deactivatedAt: null,
    },
    create: {
      id: "school_smpn1_nusantara",
      name: "SMP Negeri 1 Nusantara",
      normalizedName: "smpnegeri1nusantara",
      npsn: "20109988",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
    },
  });

  // 3. Setup Periode Akademik Aktif
  console.log("3️⃣ Menyiapkan Periode Akademik: 2024/2025 Semester 1 (Ganjil)...");
  const academicPeriod = await prisma.academicPeriod.upsert({
    where: {
      schoolId_year_semester: {
        schoolId: school.id,
        year: "2024/2025",
        semester: "1",
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      id: "period_2024_2025_ganjil",
      schoolId: school.id,
      year: "2024/2025",
      semester: "1",
      status: "ACTIVE",
    },
  });

  // 4. Setup Mata Pelajaran
  console.log("4️⃣ Menyiapkan Mata Pelajaran: Matematika, Bahasa Indonesia, IPA...");
  const subjectMatematika = await prisma.subject.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "matematika" } },
    update: { name: "Matematika", shortName: "MTK" },
    create: {
      schoolId: school.id,
      name: "Matematika",
      normalizedName: "matematika",
      shortName: "MTK",
    },
  });

  const subjectBahasa = await prisma.subject.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "bahasaindonesia" } },
    update: { name: "Bahasa Indonesia", shortName: "BINDO" },
    create: {
      schoolId: school.id,
      name: "Bahasa Indonesia",
      normalizedName: "bahasaindonesia",
      shortName: "BINDO",
    },
  });

  const subjectIpa = await prisma.subject.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "ilmupengetahuanalam" } },
    update: { name: "Ilmu Pengetahuan Alam", shortName: "IPA" },
    create: {
      schoolId: school.id,
      name: "Ilmu Pengetahuan Alam",
      normalizedName: "ilmupengetahuanalam",
      shortName: "IPA",
    },
  });

  // 5. Setup 4 Rombongan Belajar (Kelas)
  console.log("5️⃣ Menyiapkan 4 Rombel: 7-A, 7-B, 8-A, 9-A...");
  const class7A = await prisma.class.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "7a" } },
    update: { name: "Kelas 7-A", gradeLevel: "7", joinCode: "KLAS7A", joinCodeLocked: false },
    create: {
      id: "class_7a_nusantara",
      schoolId: school.id,
      name: "Kelas 7-A",
      normalizedName: "7a",
      gradeLevel: "7",
      joinCode: "KLAS7A",
    },
  });

  const class7B = await prisma.class.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "7b" } },
    update: { name: "Kelas 7-B", gradeLevel: "7", joinCode: "KLAS7B", joinCodeLocked: false },
    create: {
      id: "class_7b_nusantara",
      schoolId: school.id,
      name: "Kelas 7-B",
      normalizedName: "7b",
      gradeLevel: "7",
      joinCode: "KLAS7B",
    },
  });

  const class8A = await prisma.class.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "8a" } },
    update: { name: "Kelas 8-A", gradeLevel: "8", joinCode: "KLAS8A", joinCodeLocked: false },
    create: {
      id: "class_8a_nusantara",
      schoolId: school.id,
      name: "Kelas 8-A",
      normalizedName: "8a",
      gradeLevel: "8",
      joinCode: "KLAS8A",
    },
  });

  const class9A = await prisma.class.upsert({
    where: { schoolId_normalizedName: { schoolId: school.id, normalizedName: "9a" } },
    update: { name: "Kelas 9-A", gradeLevel: "9", joinCode: "KLAS9A", joinCodeLocked: false },
    create: {
      id: "class_9a_nusantara",
      schoolId: school.id,
      name: "Kelas 9-A",
      normalizedName: "9a",
      gradeLevel: "9",
      joinCode: "KLAS9A",
    },
  });

  // 6. Setup 3 Akun Guru
  console.log("6️⃣ Menyiapkan 3 Akun Guru: Budi (Matematika), Siti (B. Indo), Hendro (IPA)...");
  
  // Guru 1: Budi Santoso (Mengajar 3 Kelas: 7A, 7B, 8A)
  const teacherUser1 = await prisma.user.upsert({
    where: { email: "budi.matematika@sekolah.id" },
    update: { name: "Budi Santoso, M.Pd", banned: false },
    create: {
      id: "teacher_budi_santoso",
      name: "Budi Santoso, M.Pd",
      email: "budi.matematika@sekolah.id",
      emailVerified: true,
      platformRole: "USER",
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.account.upsert({
    where: { id: "account_teacher_budi_santoso" },
    update: { password: teacherPasswordHash, updatedAt: new Date() },
    create: {
      id: "account_teacher_budi_santoso",
      accountId: teacherUser1.id,
      providerId: "credential",
      userId: teacherUser1.id,
      password: teacherPasswordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const teacherProfile1 = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser1.id },
    update: { activeSchoolId: school.id, onboardingCompleted: true, preferredName: "Pak Budi" },
    create: {
      id: "profile_teacher_budi",
      userId: teacherUser1.id,
      activeSchoolId: school.id,
      onboardingCompleted: true,
      preferredName: "Pak Budi",
    },
  });
  await prisma.teacherSchoolMembership.upsert({
    where: { teacherProfileId_schoolId: { teacherProfileId: teacherProfile1.id, schoolId: school.id } },
    update: { status: "ACTIVE", workspaceRole: "MEMBER" },
    create: {
      teacherProfileId: teacherProfile1.id,
      schoolId: school.id,
      status: "ACTIVE",
      workspaceRole: "MEMBER",
    },
  });

  // Guru 2: Siti Rahmawati (Mengajar 2 Kelas: 7A, 8A)
  const teacherUser2 = await prisma.user.upsert({
    where: { email: "siti.bahasa@sekolah.id" },
    update: { name: "Siti Rahmawati, S.Pd", banned: false },
    create: {
      id: "teacher_siti_rahmawati",
      name: "Siti Rahmawati, S.Pd",
      email: "siti.bahasa@sekolah.id",
      emailVerified: true,
      platformRole: "USER",
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.account.upsert({
    where: { id: "account_teacher_siti_rahmawati" },
    update: { password: teacherPasswordHash, updatedAt: new Date() },
    create: {
      id: "account_teacher_siti_rahmawati",
      accountId: teacherUser2.id,
      providerId: "credential",
      userId: teacherUser2.id,
      password: teacherPasswordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const teacherProfile2 = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser2.id },
    update: { activeSchoolId: school.id, onboardingCompleted: true, preferredName: "Bu Siti" },
    create: {
      id: "profile_teacher_siti",
      userId: teacherUser2.id,
      activeSchoolId: school.id,
      onboardingCompleted: true,
      preferredName: "Bu Siti",
    },
  });
  await prisma.teacherSchoolMembership.upsert({
    where: { teacherProfileId_schoolId: { teacherProfileId: teacherProfile2.id, schoolId: school.id } },
    update: { status: "ACTIVE", workspaceRole: "MEMBER" },
    create: {
      teacherProfileId: teacherProfile2.id,
      schoolId: school.id,
      status: "ACTIVE",
      workspaceRole: "MEMBER",
    },
  });

  // Guru 3: Hendro Wijaya (Mengajar 1 Kelas: 9A)
  const teacherUser3 = await prisma.user.upsert({
    where: { email: "hendro.ipa@sekolah.id" },
    update: { name: "Hendro Wijaya, S.Si", banned: false },
    create: {
      id: "teacher_hendro_wijaya",
      name: "Hendro Wijaya, S.Si",
      email: "hendro.ipa@sekolah.id",
      emailVerified: true,
      platformRole: "USER",
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.account.upsert({
    where: { id: "account_teacher_hendro_wijaya" },
    update: { password: teacherPasswordHash, updatedAt: new Date() },
    create: {
      id: "account_teacher_hendro_wijaya",
      accountId: teacherUser3.id,
      providerId: "credential",
      userId: teacherUser3.id,
      password: teacherPasswordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const teacherProfile3 = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser3.id },
    update: { activeSchoolId: school.id, onboardingCompleted: true, preferredName: "Pak Hendro" },
    create: {
      id: "profile_teacher_hendro",
      userId: teacherUser3.id,
      activeSchoolId: school.id,
      onboardingCompleted: true,
      preferredName: "Pak Hendro",
    },
  });
  await prisma.teacherSchoolMembership.upsert({
    where: { teacherProfileId_schoolId: { teacherProfileId: teacherProfile3.id, schoolId: school.id } },
    update: { status: "ACTIVE", workspaceRole: "MEMBER" },
    create: {
      teacherProfileId: teacherProfile3.id,
      schoolId: school.id,
      status: "ACTIVE",
      workspaceRole: "MEMBER",
    },
  });

  // 7. Setup Teaching Contexts (Hubungan Guru + Mapel + Kelas)
  console.log("7️⃣ Menyiapkan Teaching Contexts (Konteks Mengajar)...");
  
  // Guru 1 (Matematika) -> 7A, 7B, 8A
  const tc1_7A = await prisma.teachingContext.upsert({
    where: { id: "tc_budi_mtk_7a" },
    update: {},
    create: {
      id: "tc_budi_mtk_7a",
      schoolId: school.id,
      teacherProfileId: teacherProfile1.id,
      subjectId: subjectMatematika.id,
      classId: class7A.id,
      academicPeriodId: academicPeriod.id,
    },
  });
  const tc1_7B = await prisma.teachingContext.upsert({
    where: { id: "tc_budi_mtk_7b" },
    update: {},
    create: {
      id: "tc_budi_mtk_7b",
      schoolId: school.id,
      teacherProfileId: teacherProfile1.id,
      subjectId: subjectMatematika.id,
      classId: class7B.id,
      academicPeriodId: academicPeriod.id,
    },
  });
  const tc1_8A = await prisma.teachingContext.upsert({
    where: { id: "tc_budi_mtk_8a" },
    update: {},
    create: {
      id: "tc_budi_mtk_8a",
      schoolId: school.id,
      teacherProfileId: teacherProfile1.id,
      subjectId: subjectMatematika.id,
      classId: class8A.id,
      academicPeriodId: academicPeriod.id,
    },
  });

  // Guru 2 (Bahasa Indonesia) -> 7A, 8A (Siswa sama dengan Guru 1)
  const tc2_7A = await prisma.teachingContext.upsert({
    where: { id: "tc_siti_bindo_7a" },
    update: {},
    create: {
      id: "tc_siti_bindo_7a",
      schoolId: school.id,
      teacherProfileId: teacherProfile2.id,
      subjectId: subjectBahasa.id,
      classId: class7A.id,
      academicPeriodId: academicPeriod.id,
    },
  });
  const tc2_8A = await prisma.teachingContext.upsert({
    where: { id: "tc_siti_bindo_8a" },
    update: {},
    create: {
      id: "tc_siti_bindo_8a",
      schoolId: school.id,
      teacherProfileId: teacherProfile2.id,
      subjectId: subjectBahasa.id,
      classId: class8A.id,
      academicPeriodId: academicPeriod.id,
    },
  });

  // Guru 3 (IPA) -> 9A
  const tc3_9A = await prisma.teachingContext.upsert({
    where: { id: "tc_hendro_ipa_9a" },
    update: {},
    create: {
      id: "tc_hendro_ipa_9a",
      schoolId: school.id,
      teacherProfileId: teacherProfile3.id,
      subjectId: subjectIpa.id,
      classId: class9A.id,
      academicPeriodId: academicPeriod.id,
    },
  });

  // 8. Setup 80 Siswa & Enrollment (20 per kelas)
  console.log("8️⃣ Mendaftarkan 80 Siswa (20 Siswa per Kelas) dengan PIN 1234...");

  async function seedClassRoster(classId: string, names: string[], nisPrefix: string) {
    const studentsCreated = [];
    for (let i = 0; i < names.length; i++) {
      const nis = `${nisPrefix}${String(i + 1).padStart(3, "0")}`;
      const fullName = names[i];

      const student = await prisma.student.upsert({
        where: { schoolId_nis: { schoolId: school.id, nis } },
        update: {
          fullName,
          accountStatus: "ACTIVE",
          accessPinHash: pinHash,
          pinUpdatedAt: new Date(),
        },
        create: {
          schoolId: school.id,
          fullName,
          nis,
          accountStatus: "ACTIVE",
          accessPinHash: pinHash,
          pinUpdatedAt: new Date(),
          approvedById: superadminUser.id,
          approvedAt: new Date(),
        },
      });

      await prisma.classStudent.upsert({
        where: {
          studentId_academicPeriodId: {
            studentId: student.id,
            academicPeriodId: academicPeriod.id,
          },
        },
        update: { classId },
        create: {
          studentId: student.id,
          classId,
          academicPeriodId: academicPeriod.id,
        },
      });

      studentsCreated.push(student);
    }
    return studentsCreated;
  }

  const students7A = await seedClassRoster(class7A.id, INDONESIAN_NAMES_7A, "2407");
  const students7B = await seedClassRoster(class7B.id, INDONESIAN_NAMES_7B, "2408");
  const students8A = await seedClassRoster(class8A.id, INDONESIAN_NAMES_8A, "2308");
  const students9A = await seedClassRoster(class9A.id, INDONESIAN_NAMES_9A, "2209");

  // 9. Setup Sesi Pertemuan, Absensi, Asesmen & Nilai Terhubung
  console.log("9️⃣ Menyiapkan Jurnal Pertemuan, Presensi & Nilai Asesmen...");

  async function seedContextActivity(
    tcId: string,
    topic: string,
    students: typeof students7A
  ) {
    // Sesi 1 (7 hari lalu)
    const date1 = new Date();
    date1.setDate(date1.getDate() - 7);

    const session1 = await prisma.teachingSession.create({
      data: {
        teachingContextId: tcId,
        date: date1,
        plannedTopic: `Pengenalan Konsep: ${topic}`,
        actualTopic: `Pengenalan Konsep: ${topic}`,
        activitySummary: "Guru memaparkan konsep dasar disertai diskusi interaktif siswa.",
        reflection: "Siswa sangat antusias mengikuti materi pengantar.",
        status: "COMPLETED",
      },
    });

    // Presensi Sesi 1
    for (let idx = 0; idx < students.length; idx++) {
      const status = idx === 3 ? "SICK" : idx === 7 ? "PERMISSION" : "PRESENT";
      await prisma.attendanceRecord.create({
        data: {
          teachingSessionId: session1.id,
          studentId: students[idx].id,
          status,
        },
      });
    }

    // Sesi 2 (Hari ini)
    const session2 = await prisma.teachingSession.create({
      data: {
        teachingContextId: tcId,
        date: new Date(),
        plannedTopic: `Pendalaman Materi & Latihan: ${topic}`,
        actualTopic: `Pendalaman Materi & Latihan: ${topic}`,
        activitySummary: "Latihan kelompok dan pemecahan studi kasus.",
        reflection: "Diskusi kelompok berjalan lancar, pemahaman konsep meningkat.",
        status: "COMPLETED",
      },
    });

    // Presensi Sesi 2
    for (let idx = 0; idx < students.length; idx++) {
      await prisma.attendanceRecord.create({
        data: {
          teachingSessionId: session2.id,
          studentId: students[idx].id,
          status: "PRESENT",
        },
      });
    }

    // Assessment Type
    const assessmentType = await prisma.assessmentType.upsert({
      where: {
        teachingContextId_normalizedName: {
          teachingContextId: tcId,
          normalizedName: "tugas_formatif",
        },
      },
      update: {},
      create: {
        teachingContextId: tcId,
        name: "Tugas Formatif",
        normalizedName: "tugas_formatif",
        category: "FORMATIVE",
        isActive: true,
      },
    });

    // Asesmen 1: Formatif
    const assessment1 = await prisma.assessment.create({
      data: {
        teachingContextId: tcId,
        assessmentTypeId: assessmentType.id,
        teachingSessionId: session2.id,
        title: `Tugas Formatif 1: ${topic}`,
        description: `Penilaian pemahaman mandiri untuk materi ${topic}`,
        assessmentDate: new Date(),
        maxScore: 100,
        minimumPassingScore: 75,
        status: "COMPLETED",
      },
    });

    // Nilai Siswa
    for (let idx = 0; idx < students.length; idx++) {
      const score = 75 + ((idx * 7) % 25); // variasi nilai 75 - 99
      await prisma.assessmentResult.create({
        data: {
          assessmentId: assessment1.id,
          studentId: students[idx].id,
          rawScore: score,
          normalizedScore: score,
          finalScore: score,
          status: "GRADED",
        },
      });
    }
  }

  // Isi aktivitas untuk seluruh teaching context
  await seedContextActivity(tc1_7A.id, "Operasi Bilangan Bulat", students7A);
  await seedContextActivity(tc1_7B.id, "Operasi Bilangan Bulat", students7B);
  await seedContextActivity(tc1_8A.id, "Teorema Pythagoras", students8A);

  await seedContextActivity(tc2_7A.id, "Teks Deskripsi & Cerita Fantasi", students7A);
  await seedContextActivity(tc2_8A.id, "Teks Eksplanasi & Berita", students8A);

  await seedContextActivity(tc3_9A.id, "Sistem Reproduksi Manusia & Listrik Dinamis", students9A);

  // 10. Setup Quiz Online untuk Kelas 7A (Matematika)
  console.log("🔟 Menyiapkan Kuis Interaktif Online Matematika di Kelas 7-A...");
  const quiz = await prisma.quiz.create({
    data: {
      teachingContextId: tc1_7A.id,
      title: "Kuis Diagnostik Matematika — Bilangan Bulat & Pecahan",
      status: "PUBLISHED",
      durationMinutes: 45,
      shareToken: `QUIZ-MTK7A-${Date.now().toString().slice(-4)}`,
      questions: {
        create: [
          {
            order: 1,
            type: "MULTIPLE_CHOICE",
            text: "Hasil dari (-15) + (-20) - (-10) adalah...",
            options: ["-25", "-45", "-5", "25"],
            correctIndex: 0,
            points: 50,
            explanation: "(-15) + (-20) = -35; -35 - (-10) = -35 + 10 = -25.",
          },
          {
            order: 2,
            type: "MULTIPLE_CHOICE",
            text: "Berapakah nilai dari 3/4 + 1/2?",
            options: ["5/4", "4/6", "1/2", "3/8"],
            correctIndex: 0,
            points: 50,
            explanation: "3/4 + 2/4 = 5/4.",
          },
        ],
      },
    },
  });

  // Buat akses kuis untuk 5 siswa pertama Kelas 7-A
  for (let i = 0; i < 5; i++) {
    await prisma.quizStudentAccess.create({
      data: {
        quizId: quiz.id,
        studentId: students7A[i].id,
        pin: "7788",
      },
    });
  }

  // 11. Audit Log Catatan Ekosistem
  await prisma.auditLog.create({
    data: {
      actorType: "SUPERADMIN",
      actorId: superadminUser.id,
      action: "E2E_ECOSYSTEM_SEEDED",
      targetType: "SCHOOL",
      targetId: school.id,
      metadata: {
        schoolName: school.name,
        teachersCount: 3,
        classesCount: 4,
        studentsCount: 80,
      },
    },
  });

  console.log("✅ SEEDING EKOSISTEM SELESAI DENGAN SUKSES!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
