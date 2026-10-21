import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/lib/student-pin";
import crypto from "node:crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("🚀 Memulai proses seeding data Portal Siswa...");

  // 1. SEKOLAH
  const school = await prisma.school.upsert({
    where: { npsn: "20108899" },
    update: {
      name: "SMA Negeri 1 Nusantara",
      normalizedName: "sma negeri 1 nusantara",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      deactivatedAt: null,
    },
    create: {
      npsn: "20108899",
      name: "SMA Negeri 1 Nusantara",
      normalizedName: "sma negeri 1 nusantara",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
    },
  });
  console.log("✓ Sekolah:", school.name);

  // 2. PERIODE AKADEMIK (Semester Ganjil 2026/2027)
  const academicPeriod = await prisma.academicPeriod.upsert({
    where: {
      schoolId_year_semester: {
        schoolId: school.id,
        year: "2026/2027",
        semester: "GANJIL",
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      schoolId: school.id,
      year: "2026/2027",
      semester: "GANJIL",
      status: "ACTIVE",
    },
  });
  console.log("✓ Periode Akademik:", academicPeriod.year, academicPeriod.semester, `(${academicPeriod.status})`);

  // 3. KELAS / ROMBEL
  const class10A = await prisma.class.upsert({
    where: {
      schoolId_normalizedName: {
        schoolId: school.id,
        normalizedName: "10-mipa-1",
      },
    },
    update: {
      name: "10-MIPA-1",
      gradeLevel: "10",
      status: "ACTIVE",
    },
    create: {
      schoolId: school.id,
      name: "10-MIPA-1",
      normalizedName: "10-mipa-1",
      gradeLevel: "10",
      status: "ACTIVE",
    },
  });
  console.log("✓ Kelas:", class10A.name);

  // 4. SISWA UTAMA (Fajar Pratama Nugraha - NIS: 20261001, PIN: 1234)
  const pinHash = await hashPin("1234");
  const student = await prisma.student.upsert({
    where: {
      schoolId_nis: {
        schoolId: school.id,
        nis: "20261001",
      },
    },
    update: {
      fullName: "Fajar Pratama Nugraha",
      accountStatus: "ACTIVE",
      status: "ACTIVE",
      accessPinHash: pinHash,
      pinUpdatedAt: new Date("2026-07-15T08:00:00Z"),
      birthDate: "2009-08-17",
    },
    create: {
      schoolId: school.id,
      fullName: "Fajar Pratama Nugraha",
      nis: "20261001",
      accountStatus: "ACTIVE",
      status: "ACTIVE",
      accessPinHash: pinHash,
      pinUpdatedAt: new Date("2026-07-15T08:00:00Z"),
      birthDate: "2009-08-17",
    },
  });
  console.log("✓ Siswa:", student.fullName, "- NIS:", student.nis, "- PIN: 1234");

  // Hubungkan Siswa ke Rombel untuk Periode Aktif
  await prisma.classStudent.upsert({
    where: {
      studentId_academicPeriodId: {
        studentId: student.id,
        academicPeriodId: academicPeriod.id,
      },
    },
    update: {
      classId: class10A.id,
    },
    create: {
      studentId: student.id,
      classId: class10A.id,
      academicPeriodId: academicPeriod.id,
    },
  });

  // 5. DATA GURU & MATA PELAJARAN (5 Rombel Mata Pelajaran)
  const subjectsData = [
    {
      code: "mat-10",
      name: "Matematika (Wajib)",
      shortName: "MAT-10",
      teacherName: "Drs. Hendra Wijaya, M.Pd.",
      teacherEmail: "hendra.wijaya@sman1nusantara.sch.id",
      schedules: [
        { dayOfWeek: 1, startTime: "07:30", endTime: "09:00", room: "Ruang 10-MIPA-1" },
        { dayOfWeek: 3, startTime: "07:30", endTime: "09:00", room: "Ruang 10-MIPA-1" },
      ],
      tps: [
        { code: "TP-1.1", desc: "Memahami konsep eksponen dan sifat-sifat bilangan berpangkat", score: 88 },
        { code: "TP-1.2", desc: "Menyelesaikan masalah kontekstual persamaan eksponensial dan logaritma", score: 92 },
        { code: "TP-1.3", desc: "Menganalisis barisan dan deret aritmatika serta aplikasinya", score: 86 },
      ],
      materials: [
        {
          title: "Modul 1: Eksponen, Bentuk Akar, dan Sifat Aljabar",
          content: `# Modul Eksponen & Sifat-sifat Pangkat\n\nEksponen adalah perkalian berulang dari suatu bilangan yang sama.\n\n### Sifat-sifat Pokok:\n1. $a^m \\times a^n = a^{m+n}$\n2. $\\frac{a^m}{a^n} = a^{m-n}$\n3. $(a^m)^n = a^{m \\times n}$\n\n*Pelajari kembali latihan soal halaman 12 buku paket sebelum kuis CBT!*`,
          date: new Date("2026-07-22T09:00:00Z"),
        },
        {
          title: "Panduan Belajar: Konsep Logaritma dan Contoh Aplikasi Kehidupan",
          content: `# Pengantar Logaritma\n\nLogaritma merupakan kebalikan (*invers*) dari operasi perpangkatan (eksponen).\n\nJika $a^c = b$, maka $^a\\log b = c$ dengan syarat $a > 0, a \\neq 1, b > 0$.\n\nContoh aplikasi:\n- Pengukuran skala Richter pada gempa bumi\n- Tingkat keasaman cairan (pH)`,
          date: new Date("2026-08-18T10:00:00Z"),
        },
      ],
    },
    {
      code: "ind-10",
      name: "Bahasa Indonesia",
      shortName: "IND-10",
      teacherName: "Siti Rahmawati, S.Pd.",
      teacherEmail: "siti.rahmawati@sman1nusantara.sch.id",
      schedules: [
        { dayOfWeek: 1, startTime: "09:15", endTime: "10:45", room: "Ruang 10-MIPA-1" },
        { dayOfWeek: 4, startTime: "07:30", endTime: "09:00", room: "Ruang 10-MIPA-1" },
      ],
      tps: [
        { code: "TP-1.1", desc: "Mengidentifikasi laporan hasil observasi (LHO) objektif", score: 90 },
        { code: "TP-1.2", desc: "Menulis teks eksposisi dengan kaidah kebahasaan baku PUEBI", score: 94 },
      ],
      materials: [
        {
          title: "Sistematika Teks Laporan Hasil Observasi (LHO)",
          content: `# Teks Laporan Hasil Observasi\n\nTeks LHO memaparkan fakta berdasarkan hasil pengamatan langsung di lapangan.\n\n### Struktur Utama:\n1. **Pernyataan Umum (Klasifikasi):** Menjelaskan objek secara umum.\n2. **Deskripsi Bagian:** Merinci bagian-bagian atau aspek tertentu.\n3. **Deskripsi Manfaat/Simpulan:** Nilai guna objek yang diamati.`,
          date: new Date("2026-08-01T08:00:00Z"),
        },
      ],
    },
    {
      code: "fis-10",
      name: "Fisika",
      shortName: "FIS-10",
      teacherName: "Bambang Sutrisno, M.Si.",
      teacherEmail: "bambang.sutrisno@sman1nusantara.sch.id",
      schedules: [
        { dayOfWeek: 2, startTime: "07:30", endTime: "09:45", room: "Laboratorium Fisika" },
        { dayOfWeek: 5, startTime: "07:30", endTime: "09:30", room: "Ruang 10-MIPA-1" },
      ],
      tps: [
        { code: "TP-1.1", desc: "Menerapkan besaran, satuan, dan pengukuran angka penting ilmiah", score: 82 },
        { code: "TP-1.2", desc: "Menganalisis kinematika gerak lurus (GLB dan GLBB)", score: 88 },
        { code: "TP-1.3", desc: "Menerapkan hukum-hukum gerak Newton pada benda bidang miring", score: 84 },
      ],
      materials: [
        {
          title: "Petunjuk Praktikum: Pengukuran Jangka Sorong & Mikrometer Sekrup",
          content: `# Praktikum Pengukuran Presisi Fisika\n\nKetelitian alat ukur:\n- Mistar: $0.1\\text{ cm} = 1\\text{ mm}$\n- Jangka Sorong: $0.01\\text{ cm} = 0.1\\text{ mm}$\n- Mikrometer Sekrup: $0.01\\text{ mm}$\n\nPastikan mencatat nilai skala utama dan skala nonius secara teliti!`,
          date: new Date("2026-08-10T07:30:00Z"),
        },
      ],
    },
    {
      code: "eng-10",
      name: "Bahasa Inggris",
      shortName: "ENG-10",
      teacherName: "Sarah Jenkins, B.Ed.",
      teacherEmail: "sarah.jenkins@sman1nusantara.sch.id",
      schedules: [
        { dayOfWeek: 2, startTime: "10:00", endTime: "11:30", room: "Ruang Multimedia" },
        { dayOfWeek: 3, startTime: "09:15", endTime: "11:00", room: "Ruang 10-MIPA-1" },
      ],
      tps: [
        { code: "TP-1.1", desc: "Identifying main ideas and details in descriptive texts of historical places", score: 92 },
        { code: "TP-1.2", desc: "Composing short descriptive essays using adjectives and sensory details", score: 90 },
      ],
      materials: [
        {
          title: "Mastering Descriptive Text: Adjectives & Sensory Words",
          content: `# Descriptive Text Essentials\n\nA descriptive text focuses on describing a particular person, place, or thing.\n\n### Generic Structure:\n- **Identification:** Introduces the subject.\n- **Description:** Describes features, qualities, or characteristics.\n\n*Remember to use vivid adjectives (e.g., breathtaking, ancient, serene)!*`,
          date: new Date("2026-08-25T11:00:00Z"),
        },
      ],
    },
    {
      code: "inf-10",
      name: "Informatika",
      shortName: "INF-10",
      teacherName: "Wahid Kurniawan, S.Kom.",
      teacherEmail: "wahid.kurniawan@sman1nusantara.sch.id",
      schedules: [
        { dayOfWeek: 4, startTime: "09:15", endTime: "11:30", room: "Laboratorium Komputer 1" },
        { dayOfWeek: 5, startTime: "09:45", endTime: "11:15", room: "Laboratorium Komputer 1" },
      ],
      tps: [
        { code: "TP-1.1", desc: "Menerapkan prinsip berpikir komputasional dalam dekomposisi masalah", score: 96 },
        { code: "TP-1.2", desc: "Merancang algoritma pemrograman dasar (kondisi, loop, fungsi)", score: 94 },
      ],
      materials: [
        {
          title: "Dasar Berpikir Komputasional & Flowchart Logika Pemrograman",
          content: `# 4 Pilar Berpikir Komputasional\n\n1. **Dekomposisi:** Memecah masalah besar menjadi bagian-bagian kecil.\n2. **Pengenalan Pola:** Mencari kesamaan di antara permasalahan.\n3. **Abstraksi:** Fokus pada hal penting dan mengabaikan detail yang tidak relevan.\n4. **Algoritma:** Menyusun langkah-langkah terstruktur untuk menyelesaikan masalah.`,
          date: new Date("2026-07-28T13:00:00Z"),
        },
      ],
    },
  ];

  for (const sData of subjectsData) {
    // A. Akun User & Profil Guru
    const user = await prisma.user.upsert({
      where: { email: sData.teacherEmail },
      update: { name: sData.teacherName, emailVerified: true },
      create: {
        id: crypto.randomUUID(),
        name: sData.teacherName,
        email: sData.teacherEmail,
        emailVerified: true,
        registrationOrigin: "PLATFORM_SEED",
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const teacherProfile = await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: { activeSchoolId: school.id, onboardingCompleted: true },
      create: {
        userId: user.id,
        activeSchoolId: school.id,
        preferredName: sData.teacherName,
        onboardingCompleted: true,
      },
    });

    await prisma.teacherSchoolMembership.upsert({
      where: {
        teacherProfileId_schoolId: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        teacherProfileId: teacherProfile.id,
        schoolId: school.id,
        status: "ACTIVE",
      },
    });

    // B. Mata Pelajaran (Subject)
    const subject = await prisma.subject.upsert({
      where: {
        schoolId_normalizedName: {
          schoolId: school.id,
          normalizedName: sData.code,
        },
      },
      update: { name: sData.name, shortName: sData.shortName },
      create: {
        schoolId: school.id,
        name: sData.name,
        normalizedName: sData.code,
        shortName: sData.shortName,
      },
    });

    // C. Teaching Context (Rombel Belajar Guru untuk Kelas 10-MIPA-1)
    const teachingContext = await prisma.teachingContext.upsert({
      where: {
        teacherProfileId_schoolId_academicPeriodId_subjectId_classId: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
          academicPeriodId: academicPeriod.id,
          subjectId: subject.id,
          classId: class10A.id,
        },
      },
      update: {},
      create: {
        teacherProfileId: teacherProfile.id,
        schoolId: school.id,
        academicPeriodId: academicPeriod.id,
        subjectId: subject.id,
        classId: class10A.id,
      },
    });
    console.log(`  → Rombel Mapel: ${sData.name} (${sData.teacherName})`);

    // D. Jadwal Pelajaran Mingguan
    await prisma.teachingSchedule.deleteMany({
      where: { teachingContextId: teachingContext.id },
    });
    for (const sch of sData.schedules) {
      await prisma.teachingSchedule.create({
        data: {
          teachingContextId: teachingContext.id,
          dayOfWeek: sch.dayOfWeek,
          startTime: sch.startTime,
          endTime: sch.endTime,
          room: sch.room,
        },
      });
    }

    // E. Tujuan Pembelajaran (TP)
    const createdTps: any[] = [];
    for (let i = 0; i < sData.tps.length; i++) {
      const tpItem = sData.tps[i];
      let tp = await prisma.learningObjective.findFirst({
        where: {
          teachingContextId: teachingContext.id,
          code: tpItem.code,
        },
      });
      if (!tp) {
        tp = await prisma.learningObjective.create({
          data: {
            teachingContextId: teachingContext.id,
            code: tpItem.code,
            description: tpItem.desc,
            orderIndex: i + 1,
            status: "ACTIVE",
          },
        });
      }
      createdTps.push({ ...tp, targetScore: tpItem.score });
    }

    // F. Assessment Types & Grade Policy
    const typeUH = await prisma.assessmentType.upsert({
      where: {
        teachingContextId_normalizedName: {
          teachingContextId: teachingContext.id,
          normalizedName: "ulangan-harian",
        },
      },
      update: {},
      create: {
        teachingContextId: teachingContext.id,
        name: "Ulangan Harian / Formatif",
        normalizedName: "ulangan-harian",
        category: "FORMATIVE",
      },
    });

    const typeSTS = await prisma.assessmentType.upsert({
      where: {
        teachingContextId_normalizedName: {
          teachingContextId: teachingContext.id,
          normalizedName: "sumatif-tengah-semester",
        },
      },
      update: {},
      create: {
        teachingContextId: teachingContext.id,
        name: "Sumatif Tengah Semester (STS)",
        normalizedName: "sumatif-tengah-semester",
        category: "MIDTERM",
      },
    });

    const typeTugas = await prisma.assessmentType.upsert({
      where: {
        teachingContextId_normalizedName: {
          teachingContextId: teachingContext.id,
          normalizedName: "tugas-mandiri",
        },
      },
      update: {},
      create: {
        teachingContextId: teachingContext.id,
        name: "Tugas Mandiri",
        normalizedName: "tugas-mandiri",
        category: "ASSIGNMENT",
      },
    });

    const gradePolicy = await prisma.gradePolicy.upsert({
      where: { teachingContextId: teachingContext.id },
      update: { status: "ACTIVE" },
      create: {
        teachingContextId: teachingContext.id,
        status: "ACTIVE",
      },
    });

    await prisma.gradePolicyItem.deleteMany({
      where: { gradePolicyId: gradePolicy.id },
    });

    await prisma.gradePolicyItem.createMany({
      data: [
        { gradePolicyId: gradePolicy.id, assessmentTypeId: typeTugas.id, weight: 30, sortOrder: 1 },
        { gradePolicyId: gradePolicy.id, assessmentTypeId: typeUH.id, weight: 35, sortOrder: 2 },
        { gradePolicyId: gradePolicy.id, assessmentTypeId: typeSTS.id, weight: 35, sortOrder: 3 },
      ],
    });

    // G. Sesi Pembelajaran & Presensi Siswa (Dari Juli s.d. Oktober 2026)
    const sessionDates = [
      "2026-07-20", "2026-07-27",
      "2026-08-03", "2026-08-10", "2026-08-24", "2026-08-31",
      "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
      "2026-10-02"
    ];

    for (let sIdx = 0; sIdx < sessionDates.length; sIdx++) {
      const dtStr = sessionDates[sIdx];
      const sessionDate = new Date(`${dtStr}T08:00:00Z`);

      let session = await prisma.teachingSession.findFirst({
        where: {
          teachingContextId: teachingContext.id,
          date: sessionDate,
        },
      });
      if (!session) {
        session = await prisma.teachingSession.create({
          data: {
            teachingContextId: teachingContext.id,
            date: sessionDate,
            status: "COMPLETED",
            plannedTopic: `Pertemuan ${sIdx + 1}: ${sData.name}`,
            actualTopic: `Membahas ${sData.tps[sIdx % sData.tps.length].desc}`,
            activitySummary: "Diskusi aktif, latihan terbimbing, dan tanya jawab materi.",
          },
        });
      }

      // Status Presensi: 1x izin di Agustus, 1x sakit di September, 1x telat di Oktober, sisanya Hadir
      let attStatus: "PRESENT" | "SICK" | "PERMISSION" | "LATE" = "PRESENT";
      if (sIdx === 4 && sData.code === "eng-10") attStatus = "PERMISSION";
      if (sIdx === 7 && sData.code === "fis-10") attStatus = "SICK";
      if (sIdx === 10 && sData.code === "mat-10") attStatus = "LATE";

      await prisma.attendanceRecord.upsert({
        where: {
          teachingSessionId_studentId: {
            teachingSessionId: session.id,
            studentId: student.id,
          },
        },
        update: { status: attStatus },
        create: {
          teachingSessionId: session.id,
          studentId: student.id,
          status: attStatus,
        },
      });
    }

    // H. Penilaian Resmi (Assessments) & Hasil (AssessmentResult)
    // Hapus assessment lama jika ada agar bersih dan tidak duplikat
    const oldAssessments = await prisma.assessment.findMany({
      where: { teachingContextId: teachingContext.id },
      select: { id: true },
    });
    for (const oa of oldAssessments) {
      await prisma.assessmentLearningObjective.deleteMany({ where: { assessmentId: oa.id } });
      await prisma.assessmentResult.deleteMany({ where: { assessmentId: oa.id } });
      await prisma.assessment.delete({ where: { id: oa.id } });
    }

    // 1. Formatif 1
    const assessUH1 = await prisma.assessment.create({
      data: {
        teachingContextId: teachingContext.id,
        assessmentTypeId: typeUH.id,
        title: `Asesmen Formatif 1: ${createdTps[0]?.code ?? "TP-1"}`,
        assessmentDate: new Date("2026-08-15T00:00:00Z"),
        maxScore: 100,
        minimumPassingScore: 75,
        status: "COMPLETED",
        results: {
          create: {
            studentId: student.id,
            status: "GRADED",
            rawScore: createdTps[0]?.targetScore ?? 88,
            finalScore: createdTps[0]?.targetScore ?? 88,
            note: "Memahami konsep dengan sangat baik.",
          },
        },
      },
    });
    if (createdTps[0]) {
      await prisma.assessmentLearningObjective.create({
        data: {
          assessmentId: assessUH1.id,
          learningObjectiveId: createdTps[0].id,
          snapshotCode: createdTps[0].code,
          snapshotDescription: createdTps[0].description,
        },
      });
    }

    // 2. Sumatif Tengah Semester (STS)
    const assessSTS = await prisma.assessment.create({
      data: {
        teachingContextId: teachingContext.id,
        assessmentTypeId: typeSTS.id,
        title: `Sumatif Tengah Semester (STS) - ${sData.name}`,
        assessmentDate: new Date("2026-09-25T00:00:00Z"),
        maxScore: 100,
        minimumPassingScore: 75,
        status: "COMPLETED",
        results: {
          create: {
            studentId: student.id,
            status: "GRADED",
            rawScore: (createdTps[0]?.targetScore ?? 85) - 2,
            finalScore: (createdTps[0]?.targetScore ?? 85) - 2,
            note: "Hasil ujian tengah semester memuaskan.",
          },
        },
      },
    });
    if (createdTps[1]) {
      await prisma.assessmentLearningObjective.create({
        data: {
          assessmentId: assessSTS.id,
          learningObjectiveId: createdTps[1].id,
          snapshotCode: createdTps[1].code,
          snapshotDescription: createdTps[1].description,
        },
      });
    }

    // I. Pustaka Materi
    await prisma.aiContentDraft.deleteMany({
      where: { teachingContextId: teachingContext.id, contentType: "LEARNING_MATERIAL" },
    });
    for (const mat of sData.materials) {
      await prisma.aiContentDraft.create({
        data: {
          schoolId: school.id,
          teacherProfileId: teacherProfile.id,
          teachingContextId: teachingContext.id,
          contentType: "LEARNING_MATERIAL",
          topic: mat.title,
          title: mat.title,
          content: mat.content,
          status: "ACTIVE",
          publishedAt: mat.date,
        },
      });
    }

    // J. Tugas Mandiri (1 Selesai Dinilai + 1 Aktif untuk Dikerjakan)
    const oldAssignments = await prisma.assignment.findMany({
      where: { teachingContextId: teachingContext.id },
      select: { id: true },
    });
    for (const oas of oldAssignments) {
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: oas.id } });
      await prisma.assignment.delete({ where: { id: oas.id } });
    }

    // 1. Tugas Selesai
    const taskDone = await prisma.assignment.create({
      data: {
        teachingContextId: teachingContext.id,
        title: `Tugas Analisis 1: ${sData.name}`,
        description: `Kerjakan ringkasan materi dan selesaikan studi kasus sesuai instruksi pada modul pertemuan awal.`,
        dueDate: new Date("2026-08-30T23:59:00Z"),
        status: "ACTIVE",
      },
    });

    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: taskDone.id,
        studentId: student.id,
        textContent: "Berikut saya lampirkan laporan ringkasan studi kasus yang telah saya selesaikan secara terperinci.",
        status: "REVIEWED",
        score: 92,
        feedback: "Analisis sistematis, data pendukung akurat. Kerja bagus!",
        submittedAt: new Date("2026-08-29T14:30:00Z"),
        reviewedAt: new Date("2026-08-31T09:00:00Z"),
      },
    });

    // 2. Tugas Aktif (Deadline Oktober 2026)
    await prisma.assignment.create({
      data: {
        teachingContextId: teachingContext.id,
        title: `Tugas Proyek Mandiri: Penerapan Konsep ${sData.name}`,
        description: `Susunlah laporan eksplorasi implementasi konsep pembelajaran dalam kehidupan nyata atau teknologi modern. Kumpulkan sebelum batas waktu.`,
        dueDate: new Date("2026-10-15T23:59:00Z"),
        status: "ACTIVE",
      },
    });

    // K. Kuis CBT (1 Selesai + 1 Tersedia / Aktif)
    const oldQuizzes = await prisma.quiz.findMany({
      where: { teachingContextId: teachingContext.id },
      select: { id: true },
    });
    for (const oq of oldQuizzes) {
      await prisma.quizAttempt.deleteMany({ where: { quizId: oq.id } });
      await prisma.quizQuestion.deleteMany({ where: { quizId: oq.id } });
      await prisma.quiz.delete({ where: { id: oq.id } });
    }

    // 1. Kuis Selesai
    const quizDone = await prisma.quiz.create({
      data: {
        teachingContextId: teachingContext.id,
        title: `Kuis Evaluasi 1 - ${sData.name}`,
        description: "Evaluasi pemahaman konsep dasar pertemuan 1-4.",
        status: "PUBLISHED",
        durationMinutes: 20,
        standardScore: 75,
        deadline: new Date("2026-08-20T23:59:00Z"),
        questions: {
          create: [
            {
              order: 1,
              type: "MULTIPLE_CHOICE",
              text: `Manakah pernyataan yang paling tepat mengenai konsep dasar dalam materi ${sData.name}?`,
              options: ["Pernyataan A (Tepat)", "Pernyataan B (Kurang tepat)", "Pernyataan C", "Pernyataan D"],
              correctIndex: 0,
              points: 50,
            },
            {
              order: 2,
              type: "MULTIPLE_CHOICE",
              text: "Bagaimana korelasi antara parameter utama terhadap hasil akhir pengukuran?",
              options: ["Berbanding lurus", "Berbanding terbalik", "Tidak berpengaruh", "Konstan"],
              correctIndex: 0,
              points: 50,
            },
          ],
        },
      },
    });

    // Catat attempt selesai untuk kuis pertama
    await prisma.quizAttempt.create({
      data: {
        quizId: quizDone.id,
        studentId: student.id,
        status: "SUBMITTED",
        score: 90,
        questionOrder: [1, 2],
        startedAt: new Date("2026-08-18T10:00:00Z"),
        submittedAt: new Date("2026-08-18T10:18:00Z"),
      },
    });

    // 2. Kuis Aktif (Bisa dicoba di CBT Siswa)
    await prisma.quiz.create({
      data: {
        teachingContextId: teachingContext.id,
        title: `Simulasi CBT: Ujian Pemahaman ${sData.name}`,
        description: "Latihan soal terstruktur untuk menguji pemahaman konsep sebelum asesmen sumatif akhir.",
        status: "PUBLISHED",
        durationMinutes: 30,
        standardScore: 75,
        deadline: new Date("2026-10-25T23:59:00Z"),
        questions: {
          create: [
            {
              order: 1,
              type: "MULTIPLE_CHOICE",
              text: `Berdasarkan pembelajaran ${sData.name}, langkah awal yang paling krusial sebelum memulai analisis data adalah...`,
              options: [
                "Melakukan verifikasi dan validasi data awal",
                "Langsung membuat kesimpulan akhir",
                "Mengabaikan data pencilan",
                "Menyalin hasil pengujian kelompok lain"
              ],
              correctIndex: 0,
              points: 25,
            },
            {
              order: 2,
              type: "MULTIPLE_CHOICE",
              text: "Manakah faktor penentu yang paling memengaruhi stabilitas sistem pada kondisi dinamis?",
              options: [
                "Keseimbangan antara gaya aksi dan reaksi",
                "Warna komponen fisik",
                "Jumlah observasi tanpa perhitungan",
                "Waktu pelaksanaan eksperimen"
              ],
              correctIndex: 0,
              points: 25,
            },
            {
              order: 3,
              type: "MULTIPLE_CHOICE",
              text: "Ketika terjadi anomali pada hasil kalkulasi, tindakan yang paling tepat sesuai metode ilmiah adalah...",
              options: [
                "Menelusuri kembali setiap tahapan perhitungan dan kalibrasi instrumen",
                "Menghapus nilai anomali tanpa verifikasi",
                "Mengubah hipotesis secara sepihak",
                "Mengulang seluruh proses tanpa evaluasi"
              ],
              correctIndex: 0,
              points: 25,
            },
            {
              order: 4,
              type: "ESSAY",
              text: `Jelaskan secara ringkas bagaimana konsep utama dalam ${sData.name} dapat diintegrasikan untuk memecahkan permasalahan nyata di masyarakat!`,
              options: [],
              correctIndex: null,
              points: 25,
            },
          ],
        },
      },
    });
  }

  console.log("\n========================================================");
  console.log("🎉 SEEDING DATA SISWA LENGKAP SELESAI DENGAN SUKSES!");
  console.log("========================================================");
  console.log("Informasi Login Siswa:");
  console.log("  • Nama Siswa    : Fajar Pratama Nugraha");
  console.log("  • Sekolah       : SMA Negeri 1 Nusantara");
  console.log("  • Rombel / Kelas: 10-MIPA-1 (Tingkat 10)");
  console.log("  • Periode       : 2026/2027 Ganjil (Aktif)");
  console.log("  • NIS           : 20261001");
  console.log("  • PIN           : 1234");
  console.log("  • Total Mapel   : 5 Rombel Mata Pelajaran Terhubung:");
  console.log("      1. Matematika (Wajib) - Drs. Hendra Wijaya, M.Pd.");
  console.log("      2. Bahasa Indonesia   - Siti Rahmawati, S.Pd.");
  console.log("      3. Fisika             - Bambang Sutrisno, M.Si.");
  console.log("      4. Bahasa Inggris     - Sarah Jenkins, B.Ed.");
  console.log("      5. Informatika        - Wahid Kurniawan, S.Kom.");
  console.log("  • Data Lengkap  : Presensi Juli-Okt, Tugas, Nilai, Kuis, Materi, & Jadwal.");
  console.log("========================================================\n");
}

seed()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
