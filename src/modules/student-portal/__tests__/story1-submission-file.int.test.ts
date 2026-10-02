import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Story 1 (file) — int test real-DB: klaim file presign → row submission_file,
 * resubmit replace + hapus objek lama (K7), keepFileIds, guard REVIEWED,
 * key tak-klaimable, objek hilang/ukuran bohong, mati-anggun tanpa S3,
 * dan pintu akses file route (siswa pemilik vs siswa lain vs guru asing).
 * Storage S3 di-mock — DB & logika bisnis nyata (pola story-8).
 */

let currentCookieValue: string | null = null;
const mockCookieStore = {
  get: vi.fn((name: string) =>
    name === "klassa_student_session" && currentCookieValue
      ? { name, value: currentCookieValue }
      : undefined
  ),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock hanya fungsi yang menyentuh S3 — validasi key murni tetap asli
vi.mock("@/modules/storage/storage.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/storage/storage.service")>();
  return {
    ...actual,
    isStorageConfigured: vi.fn(() => true),
    headObjectSize: vi.fn(),
    deleteObjects: vi.fn(async (_keys: string[]) => {}),
    presignDownload: vi.fn(async () => ({ url: "https://storage.example/signed" })),
    presignSubmissionUpload: vi.fn(async (storageKey: string, mimeType: string) => ({
      storageKey,
      uploadUrl: "https://storage.example/upload",
      fields: { "Content-Type": mimeType },
    })),
  };
});

// Mock otorisasi guru — default tolak (throw); test tertentu meng-allow
vi.mock("@/lib/authorization", () => ({
  verifyTeachingContextAccess: vi.fn(() => {
    throw new Error("Forbidden: You do not own this teaching context");
  }),
}));

import { prisma, auth } from "@/lib/auth";
import { hashPin } from "@/lib/student-pin";
import { signStudentSessionToken } from "@/modules/student-auth/student-session";
import { submitAssignmentAction, getStudentSubmissionStatusAction } from "../student-submission.actions";
import { getSubmissionQueueAction } from "../../assignments/assignment.actions";
import { headObjectSize, deleteObjects, isStorageConfigured, presignDownload } from "@/modules/storage/storage.service";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { GET as submissionFileGET } from "@/app/api/assignments/files/[fileId]/route";
import { POST as uploadUrlPOST } from "@/app/api/assignments/files/upload-url/route";
import { NextRequest } from "next/server";

const mockedHead = vi.mocked(headObjectSize);
const mockedDelete = vi.mocked(deleteObjects);
const mockedIsStorageConfigured = vi.mocked(isStorageConfigured);
const mockedPresignDownload = vi.mocked(presignDownload);
const mockedVerifyContext = vi.mocked(verifyTeachingContextAccess);

const KEY_A = "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.jpg";
const KEY_B = "submissions/tmp/1f5e1e96-9bd6-4a8e-a108-4b0e7dd42222.pdf";
const KEY_C = "submissions/tmp/2f5e1e96-9bd6-4a8e-a108-4b0e7dd43333.docx";

const FILE_A = { storageKey: KEY_A, name: "jawaban.jpg", mimeType: "image/jpeg", sizeBytes: 2048 };
const FILE_B = { storageKey: KEY_B, name: "laporan.pdf", mimeType: "application/pdf", sizeBytes: 4096 };
const FILE_C = { storageKey: KEY_C, name: "esai.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 8192 };

function fileRequest(fileId: string, disposition?: string) {
  const url = new URL(`http://localhost:3000/api/assignments/files/${fileId}`);
  if (disposition) url.searchParams.set("disposition", disposition);
  return new NextRequest(url);
}

function uploadUrlRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/assignments/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Story 1 Submission File — Real-DB Integration", { timeout: 60_000 }, () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  let schoolId: string;
  let teachingContextId: string;
  let otherAssignmentId: string;
  let studentId: string;
  let otherStudentId: string;
  let assignmentId: string;
  let studentToken: string;
  let otherStudentToken: string;
  let savedFileId: string;
  let foreignTeacherProfileId: string;
  let foreignTeacherUserId: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: {
          name: `Sekolah FileStory1 ${timestamp}`,
          normalizedName: `sekolah filestory1 ${timestamp}`,
          npsn: `NPFS${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      const ap = await prisma.academicPeriod.create({
        data: { schoolId, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
      });
      const subject = await prisma.subject.create({ data: { name: `Fisika ${timestamp}`, schoolId } });

      const tu = `teacher-fs1-${timestamp}`;
      await prisma.user.create({
        data: { id: tu, email: `${tu}@test.com`, name: "Guru FS1", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      });
      const tp = await prisma.teacherProfile.create({
        data: { userId: tu, activeSchoolId: schoolId, onboardingCompleted: true },
      });

      // Guru asing (bukan pemilik konteks) — untuk uji route 404
      const tu2 = `teacher-fs1x-${timestamp}`;
      await prisma.user.create({
        data: { id: tu2, email: `${tu2}@test.com`, name: "Guru Asing", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      });
      const tp2 = await prisma.teacherProfile.create({
        data: { userId: tu2, activeSchoolId: schoolId, onboardingCompleted: true },
      });
      foreignTeacherProfileId = tp2.id;
      foreignTeacherUserId = tu2;

      const cls = await prisma.class.create({
        data: { schoolId, name: "7-F", gradeLevel: "7", joinCode: `FS1${timestamp.toString().slice(-4)}` },
      });
      const tc = await prisma.teachingContext.create({
        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: cls.id },
      });
      teachingContextId = tc.id;

      const mkStudent = async (fullName: string, nis: string) => {
        const s = await prisma.student.create({
          data: {
            schoolId,
            fullName,
            nis,
            accessPinHash: await hashPin("1234"),
            accountStatus: "ACTIVE",
            status: "ACTIVE",
            pinUpdatedAt: new Date(),
          },
        });
        await prisma.classStudent.create({ data: { studentId: s.id, classId: cls.id, academicPeriodId: ap.id } });
        return s;
      };

      const s1 = await mkStudent("Budi File Sender", `NISFS1${timestamp.toString().slice(-5)}`);
      const s2 = await mkStudent("Ani Bukan Pemilik", `NISFS2${timestamp.toString().slice(-5)}`);
      studentId = s1.id;
      otherStudentId = s2.id;

      const signToken = (s: typeof s1) =>
        signStudentSessionToken({
          studentId: s.id,
          schoolId,
          classId: cls.id,
          academicPeriodId: ap.id,
          nis: s.nis!,
          fullName: s.fullName,
          pinUpdatedAt: s.pinUpdatedAt!.toISOString(),
        });
      studentToken = signToken(s1);
      otherStudentToken = signToken(s2);

      const a = await prisma.assignment.create({
        data: { teachingContextId: tc.id, title: "Tugas Foto Rangkaian", status: "ACTIVE", dueDate: new Date(Date.now() + 86_400_000) },
      });
      assignmentId = a.id;

      // Rombel lain (kelas beda, guru sama) — tugasnya tak boleh bisa diakses siswa 7-F
      const cls2 = await prisma.class.create({
        data: { schoolId, name: "7-G", gradeLevel: "7", joinCode: `FS1X${timestamp.toString().slice(-4)}` },
      });
      const tc2 = await prisma.teachingContext.create({
        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: cls2.id },
      });
      const a2 = await prisma.assignment.create({
        data: { teachingContextId: tc2.id, title: "Tugas Rombel Lain", status: "ACTIVE" },
      });
      otherAssignmentId = a2.id;

      currentCookieValue = studentToken;
      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not reachable, skipping live DB tests:", err);
      if (process.env.DATABASE_URL) throw err; // VG-Other (fail-loud): DB dikonfigurasi tapi tak terjangkau — vakum-pass dilarang
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    }
  });

  it("HAPPY: submit dengan file → row submission_file + view berisi file", async () => {
    if (!dbAvailable) return;
    mockedHead.mockResolvedValue(FILE_A.sizeBytes);

    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
    expect(res.success).toBe(true);
    expect(res.submission?.files).toHaveLength(1);
    expect(res.submission?.files[0]).toMatchObject({
      originalName: "jawaban.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      isPreviewable: true,
    });

    const rows = await prisma.submissionFile.findMany({ where: { submission: { assignmentId, studentId } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].storageKey).toBe(KEY_A);
    savedFileId = rows[0].id;
  });

  it("RESUBMIT replace: 2 file lama diganti total → objek lama dihapus (K7)", async () => {
    if (!dbAvailable) return;
    mockedHead.mockReset().mockResolvedValue(FILE_B.sizeBytes);

    // Set sekarang: tambah B (jadi A+B via keepFileIds)
    const res1 = await submitAssignmentAction(assignmentId, {
      files: [FILE_B],
      keepFileIds: [savedFileId], // pertahankan A
    });
    expect(res1.success).toBe(true);
    expect(res1.submission?.files).toHaveLength(2);

    // Replace total: hanya C, tanpa keep
    mockedHead.mockResolvedValue(FILE_C.sizeBytes);
    const res2 = await submitAssignmentAction(assignmentId, { files: [FILE_C] });
    expect(res2.success).toBe(true);
    expect(res2.submission?.files).toHaveLength(1);
    expect(res2.submission?.files[0].originalName).toBe("esai.docx");

    const rows = await prisma.submissionFile.findMany({ where: { submission: { assignmentId, studentId } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].storageKey).toBe(KEY_C);

    // Objek A & B harus dihapus dari storage
    expect(mockedDelete).toHaveBeenCalled();
    const deletedKeys = mockedDelete.mock.calls.flat(2);
    expect(deletedKeys).toContain(KEY_A);
    expect(deletedKeys).toContain(KEY_B);
  });

  it("GUARD: REVIEWED → resubmit ditolak", async () => {
    if (!dbAvailable) return;
    await prisma.assignmentSubmission.updateMany({
      where: { assignmentId, studentId },
      data: { status: "REVIEWED", feedback: "Bagus", score: 90, reviewedAt: new Date() },
    });
    mockedHead.mockResolvedValue(FILE_A.sizeBytes);
    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("terkunci");
  });

  it("GUARD: storageKey liar (bukan keluaran presign) → ditolak", async () => {
    if (!dbAvailable) return;
    await prisma.assignmentSubmission.updateMany({
      where: { assignmentId, studentId },
      data: { status: "SUBMITTED" },
    });
    const res = await submitAssignmentAction(assignmentId, {
      files: [{ ...FILE_A, storageKey: "assignments/tmp/curi-key.jpg" }],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("belum terunggah");
  });

  it("GUARD: objek hilang di storage (head null) → ditolak", async () => {
    if (!dbAvailable) return;
    mockedHead.mockResolvedValue(null);
    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("belum selesai terunggah");
  });

  it("GUARD: ukuran objek bohong (≠ metadata) → ditolak", async () => {
    if (!dbAvailable) return;
    mockedHead.mockResolvedValue(999_999);
    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("tidak sesuai");
  });

  it("GUARD: files [] tanpa teks/link → error minimal satu kanal", async () => {
    if (!dbAvailable) return;
    const res = await submitAssignmentAction(assignmentId, { files: [] });
    expect(res.success).toBe(false);
  });

  it("ROUTE: siswa pemilik → 302 ke presigned URL", async () => {
    if (!dbAvailable) return;
    // Ambil id file TERKINI (row berganti id setiap replace)
    const currentRow = await prisma.submissionFile.findFirst({
      where: { submission: { assignmentId, studentId } },
      orderBy: { createdAt: "desc" },
    });
    expect(currentRow).toBeTruthy();
    currentCookieValue = studentToken;
    mockedHead.mockReset().mockResolvedValue(currentRow!.sizeBytes); // objek ada
    mockedPresignDownload.mockClear();
    const req = fileRequest(currentRow!.id, "inline");
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: currentRow!.id }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("storage.example");
    savedFileId = currentRow!.id;
  });

  it("ROUTE: objek hilang di storage → 404 ramah (C2, bukan XML mentah)", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;
    mockedHead.mockReset().mockResolvedValue(null);
    const req = fileRequest(savedFileId);
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("tidak lagi tersedia");
  });

  it("ROUTE: inline untuk non-previewable dipaksa jadi attachment (E3)", async () => {
    if (!dbAvailable) return;
    // File tersimpan terakhir adalah esai.docx (application/vnd...wordprocessingml)
    currentCookieValue = studentToken;
    mockedHead.mockReset().mockResolvedValue(8192);
    mockedPresignDownload.mockClear();
    const req = fileRequest(savedFileId, "inline");
    await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    const arg = mockedPresignDownload.mock.calls[0]?.[1];
    expect(arg?.disposition).toBe("attachment");
  });

  it("ROUTE: guru pemilik konteks (helper resolve) → 302", async () => {
    if (!dbAvailable) return;
    currentCookieValue = null; // bukan jalur siswa
    mockedVerifyContext.mockReset().mockResolvedValueOnce({} as never);
    mockedHead.mockReset().mockResolvedValue(8192);
    const req = fileRequest(savedFileId);
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    expect(res.status).toBe(302);
    expect(mockedVerifyContext).toHaveBeenCalled();
  });

  it("ROUTE: siswa lain (bukan pemilik) → 404 generik", async () => {
    if (!dbAvailable) return;
    currentCookieValue = otherStudentToken;
    const req = fileRequest(savedFileId);
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    expect(res.status).toBe(404);
  });

  it("ROUTE: tanpa sesi apa pun → 404 generik", async () => {
    if (!dbAvailable) return;
    currentCookieValue = null;
    vi.spyOn(auth.api, "getSession").mockResolvedValue(null as never);
    const req = fileRequest(savedFileId);
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    expect(res.status).toBe(404);
    vi.mocked(auth.api.getSession).mockRestore();
  });

  it("ROUTE: guru asing (bukan pemilik konteks) → 404 generik", async () => {
    if (!dbAvailable) return;
    currentCookieValue = null; // bukan jalur siswa
    expect(foreignTeacherProfileId).toBeTruthy();
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: foreignTeacherUserId },
    } as never);
    const req = fileRequest(savedFileId);
    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
    expect(res.status).toBe(404);
    vi.mocked(auth.api.getSession).mockRestore();
  });

  it("MATI ANGGERUN: S3 tak dikonfigurasi → submit file ditolak, teks tetap jalan", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken; // kembali ke sesi siswa setelah test route
    mockedIsStorageConfigured.mockReturnValue(false);
    const withFiles = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
    expect(withFiles.success).toBe(false);
    if (!withFiles.success) expect(withFiles.error).toContain("belum dikonfigurasi");

    const textOnly = await submitAssignmentAction(assignmentId, {
      textContent: "jawaban teks cadangan",
    });
    expect(textOnly.success).toBe(true);
    mockedIsStorageConfigured.mockReturnValue(true);
  });

  it("E2 FIX: resubmit keep-only (files:[] + keepFileIds) tanpa teks → sukses & id stabil", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;
    const before = await prisma.submissionFile.findMany({
      where: { submission: { assignmentId, studentId } },
    });
    expect(before.length).toBeGreaterThanOrEqual(1);

    const res = await submitAssignmentAction(assignmentId, {
      files: [],
      keepFileIds: before.map((f) => f.id),
    });
    expect(res.success).toBe(true);
    expect(res.submission?.files).toHaveLength(before.length);
    // Id file yang dipertahankan TIDAK berubah (E13)
    const after = await prisma.submissionFile.findMany({
      where: { submission: { assignmentId, studentId } },
    });
    expect(after.map((f) => f.id).sort()).toEqual(before.map((f) => f.id).sort());
  });

  it("BH1 FIX: kept + baru > 5 → ditolak server", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;
    // Set 3 file dulu (A + B replace total)
    mockedHead.mockReset().mockImplementation(async (key: string) =>
      key === KEY_A ? FILE_A.sizeBytes : key === KEY_B ? FILE_B.sizeBytes : key === KEY_C ? FILE_C.sizeBytes : 1024
    );
    const prep = await submitAssignmentAction(assignmentId, {
      files: [FILE_A, FILE_B],
      keepFileIds: [],
    });
    expect(prep.success).toBe(true);
    expect(prep.submission?.files).toHaveLength(2);
    const current = await prisma.submissionFile.findMany({
      where: { submission: { assignmentId, studentId } },
    });
    // current seharusnya 2 (replace) — tambah keep fiktif tak masalah: 2 kept + 4 baru = 6
    const KEY_D = "submissions/tmp/3f5e1e96-9bd6-4a8e-a108-4b0e7dd44444.jpg";
    const KEY_E = "submissions/tmp/4f5e1e96-9bd6-4a8e-a108-4b0e7dd45555.jpg";
    const KEY_F = "submissions/tmp/5f5e1e96-9bd6-4a8e-a108-4b0e7dd46666.jpg";
    const KEY_G = "submissions/tmp/6f5e1e96-9bd6-4a8e-a108-4b0e7dd47777.jpg";
    const res = await submitAssignmentAction(assignmentId, {
      files: [
        { ...FILE_C, storageKey: KEY_D, sizeBytes: 1024 },
        { ...FILE_A, storageKey: KEY_E, sizeBytes: 1024 },
        { ...FILE_B, storageKey: KEY_F, sizeBytes: 1024 },
        { ...FILE_C, storageKey: KEY_G, name: "tambahan.docx", sizeBytes: 1024 },
      ],
      keepFileIds: current.map((f) => f.id),
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Maksimal 5 file");
    void current;
  });

  it("E5 FIX: storageKey duplikat dalam satu batch → ditolak jelas", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;
    mockedHead.mockReset().mockResolvedValue(FILE_A.sizeBytes);
    const res = await submitAssignmentAction(assignmentId, {
      files: [FILE_A, { ...FILE_A, name: "duplikat.jpg" }],
      keepFileIds: [],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("duplikasi");
  });

  it("VG2: getSubmissionQueueAction membawa metadata files untuk guru", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
    const queue = await getSubmissionQueueAction(teachingContextId, assignmentId);
    const mine = queue.find((q) => q.studentId === studentId);
    expect(mine).toBeTruthy();
    expect((mine?.files?.length ?? 0)).toBeGreaterThanOrEqual(1);
    expect(mine?.files[0]).toMatchObject({
      originalName: expect.any(String),
      mimeType: expect.any(String),
      sizeBytes: expect.any(Number),
      isPreviewable: expect.any(Boolean),
    });
  });

  it("VG3: getStudentSubmissionStatusAction mengembalikan files", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;
    const res = await getStudentSubmissionStatusAction(assignmentId);
    expect(res.success).toBe(true);
    expect((res.submission?.files?.length ?? 0)).toBeGreaterThanOrEqual(1);
    expect(res.submission?.files[0].originalName).toBeTruthy();
  });

  describe("VG1: POST /api/assignments/files/upload-url", () => {
    it("HAPPY: siswa aktif → daftar presign", async () => {
      if (!dbAvailable) return;
      currentCookieValue = studentToken;
      const res = await uploadUrlPOST(
        uploadUrlRequest({
          assignmentId,
          files: [{ name: "foto.jpg", mimeType: "image/jpeg", sizeBytes: 1024 }],
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.uploads).toHaveLength(1);
      expect(data.uploads[0].storageKey).toMatch(/^submissions\/tmp\//);
      expect(data.uploads[0].uploadUrl).toContain("storage.example");
    });

    it("401 tanpa sesi siswa", async () => {
      if (!dbAvailable) return;
      currentCookieValue = null;
      const res = await uploadUrlPOST(
        uploadUrlRequest({ assignmentId, files: [{ name: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10 }] })
      );
      expect(res.status).toBe(401);
    });

    it("404 tugas rombel lain (tanpa bocor)", async () => {
      if (!dbAvailable) return;
      currentCookieValue = studentToken;
      const res = await uploadUrlPOST(
        uploadUrlRequest({
          assignmentId: otherAssignmentId,
          files: [{ name: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10 }],
        })
      );
      expect(res.status).toBe(404);
    });

    it("400 file terblokir / lebih dari 5", async () => {
      if (!dbAvailable) return;
      currentCookieValue = studentToken;
      const blocked = await uploadUrlPOST(
        uploadUrlRequest({ assignmentId, files: [{ name: "makro.docm", mimeType: "application/msword", sizeBytes: 10 }] })
      );
      expect(blocked.status).toBe(400);

      const tooMany = await uploadUrlPOST(
        uploadUrlRequest({
          assignmentId,
          files: Array.from({ length: 6 }, (_, i) => ({
            name: `f${i}.jpg`,
            mimeType: "image/jpeg",
            sizeBytes: 10,
          })),
        })
      );
      expect(tooMany.status).toBe(400);
    });

    it("503 saat storage belum dikonfigurasi", async () => {
      if (!dbAvailable) return;
      currentCookieValue = studentToken;
      mockedIsStorageConfigured.mockReturnValue(false);
      const res = await uploadUrlPOST(
        uploadUrlRequest({ assignmentId, files: [{ name: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10 }] })
      );
      expect(res.status).toBe(503);
      mockedIsStorageConfigured.mockReturnValue(true);
    });
  });
});
