import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// In-memory cookie store mock for next/headers (pola story-4/story-7)
let currentCookieValue: string | null = null;
const mockCookieStore = {
  get: vi.fn((name: string) => {
    if (name === "klassa_student_session" && currentCookieValue) {
      return { name, value: currentCookieValue };
    }
    return undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    if (name === "klassa_student_session") {
      currentCookieValue = value;
    }
  }),
  delete: vi.fn((name: string) => {
    if (name === "klassa_student_session") {
      currentCookieValue = null;
    }
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => new Headers()),
}));

// revalidatePath di luar konteks Next runtime melempar invariant — stub no-op (pola action test)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Injeksi TOCTOU: delegate model Prisma dibuat segar per akses properti, sehingga
// vi.spyOn tidak menjangkau pemanggil internal. Proxy level modul meng-intercept
// assignmentSubmission.findUnique secara deterministik saat impl di-set.
const { submissionFindUnique } = vi.hoisted(() => ({
  submissionFindUnique: {
    impl: null as null | ((args: unknown) => Promise<unknown>),
    used: false,
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    prisma: new Proxy(actual.prisma, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop === "assignmentSubmission" && value && typeof value === "object") {
          return new Proxy(value, {
            get(delegate, method, recv) {
              if (method === "findUnique" && submissionFindUnique.impl) {
                return (args: unknown) => {
                  submissionFindUnique.used = true;
                  return submissionFindUnique.impl!(args);
                };
              }
              return Reflect.get(delegate, method, recv);
            },
          });
        }
        return value;
      },
    }),
  };
});

// Mock otorisasi guru — logika bisnis & DB nyata, auth gate di-stub (pola story-5)
vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyTeachingContextAccess: vi.fn(),
  verifyAiDraftAccess: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { hashPin } from "@/lib/student-pin";
import { signStudentSessionToken } from "@/modules/student-auth/student-session";
import { verifyTeachingContextAccess, verifyAiDraftAccess } from "@/lib/authorization";
import { submitAssignmentAction, getStudentSubmissionStatusAction } from "../student-submission.actions";
import { getPublishedMaterialsAction } from "../student-materi.actions";
import {
  getSubmissionQueueAction,
  reviewSubmissionAction,
} from "../../assignments/assignment.actions";
import { publishAiDraftAction, unpublishAiDraftAction } from "../../ai/ai.actions";

const mockedVerifyContext = vi.mocked(verifyTeachingContextAccess);
const mockedVerifyDraft = vi.mocked(verifyAiDraftAccess);

/**
 * Story 8 — rantai DoD real-db: guru buat tugas → siswa submit → guru review
 * → siswa lihat feedback; materi published terlihat & non-publish/non-LEARNING_MATERIAL
 * tak bocor; resubmit terkunci; submit tugas rombel lain ditolak.
 */
describe("Story 8 Submission, Materi & Mode Keluarga — Real-DB Integration", { timeout: 60_000 }, () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  let schoolId: string;
  let subjectId: string;
  let teacherUserId: string;
  let teacherProfileId: string;
  let studentId: string;
  let studentNis: string;
  let teachingContextId: string;
  let assignmentId: string;
  let assignmentLateId: string;

  // Konteks rombel lain (kelas beda, guru sama) — untuk uji isolasi
  let otherContextId: string;
  let otherAssignmentId: string;

  let studentToken: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: {
          name: `Audit Sekolah S8 ${timestamp}`,
          normalizedName: `audit sekolah s8 ${timestamp}`,
          npsn: `NPSN8${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      const ap = await prisma.academicPeriod.create({
        data: { schoolId: school.id, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
      });
      const subject = await prisma.subject.create({
        data: { name: `Biologi ${timestamp}`, schoolId: school.id },
      });
      subjectId = subject.id;

      teacherUserId = `teacher-s8-${timestamp}`;
      await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Pengampu S8",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const tp = await prisma.teacherProfile.create({
        data: { userId: teacherUserId, activeSchoolId: school.id, onboardingCompleted: true },
      });
      teacherProfileId = tp.id;

      const cls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "8-A",
          gradeLevel: "8",
          joinCode: `S8${timestamp.toString().slice(-4)}`,
        },
      });
      const tc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: tp.id,
          schoolId: school.id,
          academicPeriodId: ap.id,
          subjectId: subject.id,
          classId: cls.id,
        },
      });
      teachingContextId = tc.id;

      // Rombel lain (kelas beda) — assignment di sana tak boleh bisa disubmit siswa
      const otherCls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "8-B",
          gradeLevel: "8",
          joinCode: `S8X${timestamp.toString().slice(-4)}`,
        },
      });
      const otherTc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: tp.id,
          schoolId: school.id,
          academicPeriodId: ap.id,
          subjectId: subject.id,
          classId: otherCls.id,
        },
      });
      otherContextId = otherTc.id;

      // Siswa + enrollment periode aktif
      studentNis = `NIS8${timestamp.toString().slice(-5)}`;
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Dodo Siswa Disiplin",
          nis: studentNis,
          accessPinHash: await hashPin("1234"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      studentId = student.id;
      await prisma.classStudent.create({
        data: { studentId, classId: cls.id, academicPeriodId: ap.id },
      });

      studentToken = signStudentSessionToken({
        studentId,
        schoolId: school.id,
        classId: cls.id,
        academicPeriodId: ap.id,
        nis: studentNis,
        fullName: student.fullName,
        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
      });

      // Tugas utama (tenggat masa depan — submit tepat waktu)
      const a1 = await prisma.assignment.create({
        data: {
          teachingContextId: tc.id,
          title: "Laporan Praktikum Fotosintesis",
          description: "Kumpulkan laporan praktikum daun",
          dueDate: new Date(Date.now() + 86_400_000),
          status: "ACTIVE",
        },
      });
      assignmentId = a1.id;

      // Tugas dengan tenggat lampau — submit terlambat
      const a2 = await prisma.assignment.create({
        data: {
          teachingContextId: tc.id,
          title: "Refleksi Ekosistem",
          description: "Tuliskan refleksi",
          dueDate: new Date(Date.now() - 86_400_000),
          status: "ACTIVE",
        },
      });
      assignmentLateId = a2.id;

      // Tugas di rombel lain
      const a3 = await prisma.assignment.create({
        data: {
          teachingContextId: otherTc.id,
          title: "Tugas Kelas Lain",
          description: "Jangan bisa diakses siswa 8-A",
          status: "ACTIVE",
        },
      });
      otherAssignmentId = a3.id;

      currentCookieValue = studentToken;
      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not reachable, skipping live DB tests:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // ai_content_draft punya FK RESTRICT ke school — hapus draf dulu (pola story-5)
      await prisma.aiContentDraft.deleteMany({ where: { schoolId } });
      if (schoolId) await prisma.school.delete({ where: { id: schoolId } });
      if (teacherUserId) await prisma.user.delete({ where: { id: teacherUserId } });
      if (subjectId) await prisma.subject.delete({ where: { id: subjectId } });
    } catch {
      // Ignore cleanup error
    }
  });

  function setTeacherActor() {
    mockedVerifyContext.mockImplementation(async (ctxId: string) => {
      const context = await prisma.teachingContext.findUnique({ where: { id: ctxId } });
      if (!context) throw new Error("Teaching context not found");
      return {
        profile: { id: teacherProfileId, userId: teacherUserId },
        activeSchoolId: schoolId,
        activeSchool: { id: schoolId, name: "S8" },
        session: { user: { id: teacherUserId } },
        context: context as never,
      } as never;
    });
  }

  it("rantai DoD: siswa submit → guru review → siswa lihat feedback & resubmit terkunci", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    // 1. Siswa submit teks+tautan
    const submit = await submitAssignmentAction(assignmentId, {
      textContent: "Laporan lengkap di lampiran tautan.",
      linkUrl: "https://contoh.id/laporan-dodo",
    });
    expect(submit.success).toBe(true);
    expect(submit.submission!.status).toBe("SUBMITTED");
    expect(submit.submission!.isLate).toBe(false);

    // 2. Muncul di antrean guru
    setTeacherActor();
    const queue = await getSubmissionQueueAction(teachingContextId, assignmentId);
    const item = queue.find((q) => q.studentId === studentId);
    expect(item).toBeDefined();
    expect(item!.status).toBe("SUBMITTED");
    expect(item!.textContent).toBe("Laporan lengkap di lampiran tautan.");

    // 3. Guru review — feedback wajib, skor opsional
    const review = await reviewSubmissionAction({
      teachingContextId,
      submissionId: item!.id,
      feedback: "Laporan rapi, analisis bagus.",
      score: 92,
    });
    expect(review.success).toBe(true);

    // 4. Siswa lihat feedback & skor
    currentCookieValue = studentToken;
    const status = await getStudentSubmissionStatusAction(assignmentId);
    expect(status.success).toBe(true);
    expect(status.submission!.status).toBe("REVIEWED");
    expect(status.submission!.feedback).toBe("Laporan rapi, analisis bagus.");
    expect(status.submission!.score).toBe(92);
    expect(status.submission!.reviewedAt).not.toBeNull();

    // 5. Resubmit setelah REVIEWED ditolak
    const resubmit = await submitAssignmentAction(assignmentId, {
      textContent: "coba kirim ulang",
    });
    expect(resubmit.success).toBe(false);
    expect(resubmit.error).toContain("terkunci");

    // 6. Antrean guru menandai REVIEWED
    setTeacherActor();
    const queue2 = await getSubmissionQueueAction(teachingContextId, assignmentId);
    expect(queue2.find((q) => q.studentId === studentId)!.status).toBe("REVIEWED");
  });

  it("submit terlambat: tersimpan + badge terlambat", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const res = await submitAssignmentAction(assignmentLateId, {
      textContent: "Terlambat sedikit, maaf bu.",
    });
    expect(res.success).toBe(true);
    expect(res.submission!.isLate).toBe(true);
    expect(res.submission!.status).toBe("SUBMITTED");
  });

  it("validasi: submit kosong & link invalid ditolak; teks saja valid", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const empty = await submitAssignmentAction(assignmentLateId, { textContent: "  " });
    expect(empty.success).toBe(false);

    const badLink = await submitAssignmentAction(assignmentLateId, { linkUrl: "javascript:x" });
    expect(badLink.success).toBe(false);

    // teks saja valid (resubmit SUBMITTED diizinkan — update konten)
    const textOnly = await submitAssignmentAction(assignmentLateId, {
      textContent: "Revisi jawaban teks saja",
    });
    expect(textOnly.success).toBe(true);
    expect(textOnly.submission!.textContent).toBe("Revisi jawaban teks saja");
    expect(textOnly.submission!.linkUrl).toBeNull();
  });

  it("re-review: guru memperbarui feedback & skor submission REVIEWED", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const before = await getStudentSubmissionStatusAction(assignmentId);
    expect(before.submission!.status).toBe("REVIEWED");

    setTeacherActor();
    const again = await reviewSubmissionAction({
      teachingContextId,
      submissionId: before.submission!.id,
      feedback: "Revisi umpan balik: analisis sangat baik.",
      score: 88,
    });
    expect(again.success).toBe(true);

    currentCookieValue = studentToken;
    const after = await getStudentSubmissionStatusAction(assignmentId);
    expect(after.submission!.status).toBe("REVIEWED");
    expect(after.submission!.feedback).toBe("Revisi umpan balik: analisis sangat baik.");
    expect(after.submission!.score).toBe(88);

    // Skor opsional bisa dikosongkan saat re-review
    setTeacherActor();
    const clear = await reviewSubmissionAction({
      teachingContextId,
      submissionId: before.submission!.id,
      feedback: "Final tanpa skor.",
    });
    expect(clear.success).toBe(true);

    currentCookieValue = studentToken;
    const final = await getStudentSubmissionStatusAction(assignmentId);
    expect(final.submission!.feedback).toBe("Final tanpa skor.");
    expect(final.submission!.score).toBeNull();
  });

  it("TOCTOU: review mendarat setelah cek siswa — guard updateMany menolak resubmit", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const before = await getStudentSubmissionStatusAction(assignmentId);
    expect(before.submission!.status).toBe("REVIEWED");

    // Simulasi race: findUnique internal mengembalikan snapshot basi (SUBMITTED)
    // padahal DB sudah REVIEWED — review guru mendarat di antara cek & tulis.
    const staleRow = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    submissionFindUnique.used = false;
    submissionFindUnique.impl = async () => ({ ...staleRow!, status: "SUBMITTED" });

    const res = await submitAssignmentAction(assignmentId, { textContent: "narasi race" });
    submissionFindUnique.impl = null;

    // Snapshot basi benar dipakai action (bukan vacuous pass via early-return)
    expect(submissionFindUnique.used).toBe(true);
    expect(res.success).toBe(false);
    expect(res.error).toContain("terkunci");

    // Review guru tak tertimpa jadi SUBMITTED — konten & status utuh
    const after = await getStudentSubmissionStatusAction(assignmentId);
    expect(after.submission!.status).toBe("REVIEWED");
    expect(after.submission!.textContent).toBe(before.submission!.textContent);
  });

  it("badge antrean guru: _count hanya menghitung submission SUBMITTED", async () => {
    if (!dbAvailable) return;
    // Query yang sama dengan halaman /kelas/[teachingContextId]/tugas
    const rows = await prisma.assignment.findMany({
      where: { teachingContextId },
      include: { _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } },
    });
    const pendingById = new Map(rows.map((r) => [r.id, r._count.submissions]));
    expect(pendingById.get(assignmentId)).toBe(0); // REVIEWED setelah rantai + re-review
    expect(pendingById.get(assignmentLateId)).toBe(1); // SUBMITTED (terlambat)
  });

  it("isolasi rombel: submit tugas kelas lain ditolak tanpa bocor keberadaannya", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const res = await submitAssignmentAction(otherAssignmentId, {
      textContent: "nyoba-submit lintas kelas",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Tugas tidak tersedia.");
  });

  it("tanpa sesi: submit ditolak, tak ada identitas lain", async () => {
    if (!dbAvailable) return;
    const saved = currentCookieValue;
    currentCookieValue = null;
    const res = await submitAssignmentAction(assignmentId, { textContent: "sesi hilang" });
    currentCookieValue = saved;
    expect(res.success).toBe(false);
    expect(res.error).toContain("Sesi");
  });

  it("review lintas konteks: submission rombel lain ditolak tanpa bocor", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    // siswa kelas A submit tugasnya sendiri dulu (tugas refleksi masih SUBMITTED setelah revisi)
    const sub = await getStudentSubmissionStatusAction(assignmentLateId);
    expect(sub.success).toBe(true);

    // Guru konteks kelas B mencoba review submission kelas A → "tidak ditemukan"
    setTeacherActor();
    const res = await reviewSubmissionAction({
      teachingContextId: otherContextId,
      submissionId: sub.submission!.id,
      feedback: "review ilegal",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Submission tidak ditemukan.");
  });

  it("materi: hanya LEARNING_MATERIAL published konteks rombel yang terlihat; lainnya tak bocor", async () => {
    if (!dbAvailable) return;

    // Sediakan 4 draf: published-LEARNING_MATERIAL (target), unpublished, LESSON_PLAN published-simulator, ARCHIVED published
    const makeDraft = (data: Partial<{
      contentType: string;
      status: string;
      publishedAt: Date | null;
      title: string;
    }>) =>
      prisma.aiContentDraft.create({
        data: {
          teacherProfileId,
          schoolId,
          teachingContextId,
          contentType: (data.contentType ?? "LEARNING_MATERIAL") as never,
          status: (data.status ?? "ACTIVE") as never,
          publishedAt: data.publishedAt ?? null,
          title: data.title ?? "Draf",
          topic: "Fotosintesis",
          content: "Isi materi tentang fotosintesis.",
          modelUsed: "gemini",
        },
      });

    const target = await makeDraft({ title: "Materi Terpublish", publishedAt: null });
    await makeDraft({ title: "Draf Belum Publish", publishedAt: null });
    await makeDraft({ contentType: "LESSON_PLAN", title: "RPP", publishedAt: new Date() });
    await makeDraft({ status: "ARCHIVED", title: "Materi Diarsip", publishedAt: new Date() });

    // Materi published milik konteks kelas LAIN — boundary "konteks lain tak bocor"
    await prisma.aiContentDraft.create({
      data: {
        teacherProfileId,
        schoolId,
        teachingContextId: otherContextId,
        contentType: "LEARNING_MATERIAL",
        status: "ACTIVE",
        publishedAt: new Date(),
        title: "Materi Kelas B (tidak boleh terlihat)",
        topic: "Ekosistem",
        content: "Materi kelas lain.",
        modelUsed: "gemini",
      },
    });

    mockedVerifyDraft.mockImplementation(async (draftId: string) => {
      const draft = await prisma.aiContentDraft.findUnique({ where: { id: draftId } });
      if (!draft) throw new Error("Draft AI tidak ditemukan");
      return {
        profile: { id: teacherProfileId },
        activeSchoolId: schoolId,
        draft: draft as never,
      } as never;
    });

    // Publish target → success; publish LESSON_PLAN → gagal (boundary)
    const pub = await publishAiDraftAction(target.id);
    expect(pub.success).toBe(true);

    const lessonPlan = await prisma.aiContentDraft.findFirst({
      where: { title: "RPP", schoolId },
    });
    const pubLp = await publishAiDraftAction(lessonPlan!.id);
    expect(pubLp.success).toBe(false);
    expect(pubLp.error).toContain("LEARNING_MATERIAL");

    // Cabang tolak publish lainnya: ARCHIVED & tanpa teachingContextId
    const archived = await prisma.aiContentDraft.findFirst({
      where: { title: "Materi Diarsip", schoolId },
    });
    const pubArchived = await publishAiDraftAction(archived!.id);
    expect(pubArchived.success).toBe(false);
    expect(pubArchived.error).toContain("terarsip");

    const noCtx = await prisma.aiContentDraft.create({
      data: {
        teacherProfileId,
        schoolId,
        teachingContextId: null,
        contentType: "LEARNING_MATERIAL",
        status: "ACTIVE",
        title: "Materi Tanpa Konteks",
        topic: "Fotosintesis",
        content: "Tanpa rombel.",
        modelUsed: "gemini",
      },
    });
    const pubNoCtx = await publishAiDraftAction(noCtx.id);
    expect(pubNoCtx.success).toBe(false);
    expect(pubNoCtx.error).toContain("rombel");

    // Query portal siswa via action yang dipakai halaman Materi (satu sumber kebenaran)
    currentCookieValue = studentToken;
    const visible = await getPublishedMaterialsAction();
    expect(visible.success).toBe(true);
    expect(visible.materials!.map((v) => v.title)).toEqual(["Materi Terpublish"]);

    // Boundary lintas-rombel: materi published kelas B tak terlihat dari kelas A
    expect(visible.materials!.map((v) => v.title)).not.toContain(
      "Materi Kelas B (tidak boleh terlihat)"
    );

    // Unpublish → hilang dari portal
    const unpub = await unpublishAiDraftAction(target.id);
    expect(unpub.success).toBe(true);
    currentCookieValue = studentToken;
    const visibleAfter = await getPublishedMaterialsAction();
    expect(visibleAfter.success).toBe(true);
    expect(visibleAfter.materials).toHaveLength(0);

    // Tanpa sesi: action menolak tanpa membocorkan identitas lain
    const savedCookie = currentCookieValue;
    currentCookieValue = null;
    const noSession = await getPublishedMaterialsAction();
    currentCookieValue = savedCookie;
    expect(noSession.success).toBe(false);
  });
});