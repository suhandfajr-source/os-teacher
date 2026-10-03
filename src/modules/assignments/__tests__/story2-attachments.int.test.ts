import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Story 2 (lampiran guru) — int test real-DB: createAssignment dgn file,
 * setAssignmentAttachmentsAction replace/remove + hapus objek, akses route
 * (siswa rombel benar 302 / rombel lain 404 / guru asing 404), presign
 * kind=attachment (guru vs sesi siswa 403), guard >5 gabungan, duplikat key,
 * mati anggun tanpa S3. Storage S3 & otorisasi di-mock — DB nyata (pola story-1).
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

// verifyTeachingContextAccess default: pemilik sah (guru fixture) — test asing men-override
vi.mock("@/lib/authorization", () => ({
  verifyTeachingContextAccess: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { hashPin } from "@/lib/student-pin";
import { signStudentSessionToken } from "@/modules/student-auth/student-session";
import {
  createAssignment,
  setAssignmentAttachmentsAction,
  getAssignmentAttachmentsAction,
} from "../../assignments/assignment.actions";
import { headObjectSize, deleteObjects, isStorageConfigured, presignDownload } from "@/modules/storage/storage.service";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { GET as attachmentGET } from "@/app/api/assignments/attachments/[fileId]/route";
import { POST as uploadUrlPOST } from "@/app/api/assignments/files/upload-url/route";
import { NextRequest } from "next/server";

const mockedHead = vi.mocked(headObjectSize);
const mockedDelete = vi.mocked(deleteObjects);
const mockedIsStorageConfigured = vi.mocked(isStorageConfigured);
const mockedVerifyContext = vi.mocked(verifyTeachingContextAccess);
const mockedPresignDownload = vi.mocked(presignDownload);

const KEY_A = "attachments/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.pdf";
const KEY_B = "attachments/tmp/1f5e1e96-9bd6-4a8e-a108-4b0e7dd42222.jpg";
const KEY_C = "attachments/tmp/2f5e1e96-9bd6-4a8e-a108-4b0e7dd43333.docx";
const FILE_A = { storageKey: KEY_A, name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 2048 };
const FILE_B = { storageKey: KEY_B, name: "lkpd.jpg", mimeType: "image/jpeg", sizeBytes: 1024 };
const FILE_C = { storageKey: KEY_C, name: "bacaan.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 8192 };

function attachmentRequest(fileId: string, disposition?: string) {
  const url = new URL(`http://localhost:3000/api/assignments/attachments/${fileId}`);
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

describe("Story 2 Lampiran Guru — Real-DB Integration", { timeout: 60_000 }, () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  let schoolId: string;
  let teachingContextId: string;
  let otherContextId: string;
  let studentId: string;
  let rombelStudentToken: string;
  let otherRombelStudentToken: string;
  let assignmentId: string;
  let attachmentIdA: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: {
          name: `Sekolah AttStory2 ${timestamp}`,
          normalizedName: `sekolah attstory2 ${timestamp}`,
          npsn: `NPAT${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      const ap = await prisma.academicPeriod.create({
        data: { schoolId, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
      });
      const subject = await prisma.subject.create({ data: { name: `Matematika ${timestamp}`, schoolId } });

      const tu = `teacher-att2-${timestamp}`;
      await prisma.user.create({
        data: { id: tu, email: `${tu}@test.com`, name: "Guru Att2", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      });
      const tp = await prisma.teacherProfile.create({
        data: { userId: tu, activeSchoolId: schoolId, onboardingCompleted: true },
      });

      const mkClass = async (name: string, joinCode: string) =>
        prisma.class.create({ data: { schoolId, name, gradeLevel: "8", joinCode } });

      const cls = await mkClass("8-ATT", `AT2${timestamp.toString().slice(-4)}`);
      const otherCls = await mkClass("8-ATX", `ATX${timestamp.toString().slice(-4)}`);

      const tc = await prisma.teachingContext.create({
        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: cls.id },
      });
      teachingContextId = tc.id;

      // Default: verifyTeachingContextAccess sukses (guru pemilik fixture) —
      // actions memakai auth.context.id untuk revalidatePath
      mockedVerifyContext.mockReset().mockImplementation(async () => ({
        context: { id: tc.id },
      } as never));
      const otherTc = await prisma.teachingContext.create({
        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: otherCls.id },
      });
      otherContextId = otherTc.id;

      const mkStudent = async (fullName: string, nis: string, classId: string) => {
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
        await prisma.classStudent.create({ data: { studentId: s.id, classId, academicPeriodId: ap.id } });
        return s;
      };

      const s1 = await mkStudent("Siswa Rombel Benar", `NISAT1${timestamp.toString().slice(-5)}`, cls.id);
      studentId = s1.id;
      const s2 = await mkStudent("Siswa Rombel Lain", `NISAT2${timestamp.toString().slice(-5)}`, otherCls.id);

      const signToken = (s: typeof s1, classId: string) =>
        signStudentSessionToken({
          studentId: s.id,
          schoolId,
          classId,
          academicPeriodId: ap.id,
          nis: s.nis!,
          fullName: s.fullName,
          pinUpdatedAt: s.pinUpdatedAt!.toISOString(),
        });
      // token untuk siswa rombel LAIN (untuk uji 404) — disimpan sbg currentCookie saat tes
      otherRombelStudentToken = signToken(s2, otherCls.id);
      rombelStudentToken = signToken(s1, cls.id);

      // Default verifyTeachingContextAccess di-set setelah fixture (lihat atas)
      mockedHead.mockReset().mockImplementation(async (key: string) =>
        key === KEY_A ? FILE_A.sizeBytes : key === KEY_B ? FILE_B.sizeBytes : key === KEY_C ? FILE_C.sizeBytes : key?.startsWith("attachments/tmp/") ? 1024 : null
      );

      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not reachable, skipping live DB tests:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    }
  });

  it("HAPPY: createAssignment dengan 2 lampiran → row + view isPreviewable", async () => {
    if (!dbAvailable) return;
    const assignment = await createAssignment({
      teachingContextId,
      title: "Tugas Berlampiran",
      description: "Kerjakan LKPD terlampir",
      files: [FILE_A, FILE_B],
    });
    assignmentId = assignment.id;
    expect(assignment.attachments).toHaveLength(2);
    expect(assignment.attachments[0]).toMatchObject({
      originalName: "soal.pdf",
      isPreviewable: true,
    });

    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    expect(rows.map((r) => r.storageKey).sort()).toEqual([KEY_A, KEY_B].sort());
    attachmentIdA = rows.find((r) => r.storageKey === KEY_A)!.id;
  });

  it("K8: setelah ada submission, guru masih bisa mengubah lampiran", async () => {
    if (!dbAvailable) return;
    // Simulasikan siswa sudah mengumpulkan
    await prisma.assignmentSubmission.create({
      data: { assignmentId, studentId, status: "SUBMITTED", textContent: "sudah dikerjakan" },
    });

    const res = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [attachmentIdA],
      newFiles: [FILE_C],
    });
    expect(res.success).toBe(true);
    expect(res.attachments).toHaveLength(2);

    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    expect(rows).toHaveLength(2);
    // KEY_B (lkpd.jpg) dihapus dari storage
    expect(mockedDelete).toHaveBeenCalled();
    const deleted = mockedDelete.mock.calls.flat(2);
    expect(deleted).toContain(KEY_B);
    expect(deleted).not.toContain(KEY_A);
  });

  it("GUARD: kept + baru > 5 → ditolak server", async () => {
    if (!dbAvailable) return;
    const res = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [attachmentIdA],
      newFiles: [FILE_B, FILE_C, { ...FILE_B, storageKey: "attachments/tmp/3f5e1e96-9bd6-4a8e-a108-4b0e7dd44444.jpg", sizeBytes: 1024 }, { ...FILE_C, storageKey: "attachments/tmp/4f5e1e96-9bd6-4a8e-a108-4b0e7dd45555.docx", sizeBytes: 1024, name: "bacaan2.docx" }, { ...FILE_A, storageKey: "attachments/tmp/5f5e1e96-9bd6-4a8e-a108-4b0e7dd46666.pdf", sizeBytes: 1024, name: "tambahan.pdf" }],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Maksimal 5");
  });

  it("GUARD: duplikat storageKey & key liar → ditolak", async () => {
    if (!dbAvailable) return;
    const dup = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [FILE_A, { ...FILE_A, name: "duplikat.pdf" }],
    });
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.error).toContain("duplikasi");

    const liar = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [{ ...FILE_A, storageKey: "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.pdf" }],
    });
    expect(liar.success).toBe(false);
    if (!liar.success) expect(liar.error).toContain("belum terunggah");
  });

  it("getAssignmentAttachmentsAction: daftar utk guru", async () => {
    if (!dbAvailable) return;
    const list = await getAssignmentAttachmentsAction(teachingContextId, assignmentId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].originalName).toBeTruthy();
  });

  it("ROUTE: siswa rombel tugas → 302; siswa rombel lain → 404", async () => {
    if (!dbAvailable) return;
    // Ambil id lampiran terkini
    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    const target = rows[0];

    // Rombel benar: token siswa s1 (member 8-ATT) → 302
    currentCookieValue = rombelStudentToken;
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Forbidden: You do not own this teaching context");
    });
    mockedHead.mockReset().mockResolvedValue(2048);
    mockedPresignDownload.mockClear();
    const res302siswa = await attachmentGET(attachmentRequest(target.id), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(res302siswa.status).toBe(302);
    expect(res302siswa.headers.get("cache-control")).toContain("no-store");
    // VG1: pastikan disposition default adalah "attachment"
    expect(mockedPresignDownload).toHaveBeenCalledWith(target.storageKey, expect.objectContaining({
      disposition: "attachment",
    }));

    // VG1: pastikan query ?disposition=inline menghasilkan inline untuk previewable
    mockedPresignDownload.mockClear();
    const res302inline = await attachmentGET(attachmentRequest(target.id, "inline"), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(res302inline.status).toBe(302);
    expect(mockedPresignDownload).toHaveBeenCalledWith(target.storageKey, expect.objectContaining({
      disposition: "inline",
    }));

    // Rombel lain → 404
    currentCookieValue = otherRombelStudentToken;
    const res404 = await attachmentGET(attachmentRequest(target.id), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(res404.status).toBe(404);

    // Guru pemilik → 302
    currentCookieValue = null;
    mockedVerifyContext.mockReset().mockResolvedValue({ context: { id: teachingContextId } } as never);
    const res302 = await attachmentGET(attachmentRequest(target.id, "inline"), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(res302.status).toBe(302);
  });

  it("ROUTE: objek hilang → 404 ramah", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
    mockedHead.mockReset().mockResolvedValue(null);
    const res = await attachmentGET(attachmentRequest(attachmentIdA), {
      params: Promise.resolve({ fileId: attachmentIdA }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("tidak lagi tersedia");
  });

  it("PRESIGN: sesi siswa minta kind=attachment → 403", async () => {
    if (!dbAvailable) return;
    currentCookieValue = otherRombelStudentToken; // sesi siswa apa pun ditolak
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Unauthorized");
    });
    const res = await uploadUrlPOST(
      uploadUrlRequest({
        kind: "attachment",
        teachingContextId,
        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
      })
    );
    expect(res.status).toBe(403);
    currentCookieValue = null;
  });

  it("PRESIGN: guru pemilik kind=attachment → 200 prefix attachments/tmp", async () => {
    if (!dbAvailable) return;
    currentCookieValue = null; // tanpa sesi siswa → jatuh ke jalur guru (mock sukses)
    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
    const res = await uploadUrlPOST(
      uploadUrlRequest({
        kind: "attachment",
        teachingContextId,
        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploads[0].storageKey).toMatch(/^attachments\/tmp\//);
  });

  it("PRESIGN: guru asing (verify throw) → 404; context kosong → 400", async () => {
    if (!dbAvailable) return;
    currentCookieValue = null;
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res404 = await uploadUrlPOST(
      uploadUrlRequest({
        kind: "attachment",
        teachingContextId,
        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
      })
    );
    expect(res404.status).toBe(404);

    const res400 = await uploadUrlPOST(
      uploadUrlRequest({
        kind: "attachment",
        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
      })
    );
    expect(res400.status).toBe(400);
  });

  it("MATI ANGGERUN: S3 tak dikonfigurasi → claim tolak; create tanpa file tetap jalan", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockImplementation(async () => ({
      context: { id: teachingContextId },
    } as never));
    mockedIsStorageConfigured.mockReturnValue(false);
    const withFiles = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [FILE_A],
    });
    expect(withFiles.success).toBe(false);
    if (!withFiles.success) expect(withFiles.error).toContain("belum dikonfigurasi");

    const plain = await createAssignment({ teachingContextId, title: "Tugas Tanpa Lampiran" });
    expect(plain.id).toBeTruthy();
    mockedIsStorageConfigured.mockReturnValue(true);
  });

  it("VG1: file non-previewable (docx) dipaksa disposition=attachment meskipun minta inline", async () => {
    if (!dbAvailable) return;
    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    const docxFile = rows.find((r) => r.mimeType.includes("wordprocessingml"));
    if (!docxFile) return;

    currentCookieValue = rombelStudentToken;
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Forbidden");
    });
    mockedHead.mockReset().mockResolvedValue(docxFile.sizeBytes);
    mockedPresignDownload.mockClear();

    const res = await attachmentGET(attachmentRequest(docxFile.id, "inline"), {
      params: Promise.resolve({ fileId: docxFile.id }),
    });
    expect(res.status).toBe(302);
    expect(mockedPresignDownload).toHaveBeenCalledWith(
      docxFile.storageKey,
      expect.objectContaining({ disposition: "attachment" })
    );
  });

  it("VG2: klaim lampiran gagal jika ukuran mismatch atau upload belum selesai (HEAD null)", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockImplementation(async () => ({
      context: { id: teachingContextId },
    } as never));

    // Case 1: size mismatch
    mockedHead.mockReset().mockResolvedValueOnce(999999);
    const mismatchRes = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [FILE_A],
    });
    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.error).toContain("tidak sesuai");

    // Case 2: upload belum selesai (HEAD null)
    mockedHead.mockReset().mockResolvedValueOnce(null);
    const nullRes = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [FILE_A],
    });
    expect(nullRes.success).toBe(false);
    expect(nullRes.error).toContain("belum selesai");
  });

  it("VG3: ROUTE attachment menolak akses tanpa sesi dan guru yang dibanned", async () => {
    if (!dbAvailable) return;
    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    const target = rows[0];

    // Case 1: Tanpa sesi sama sekali (anonim)
    currentCookieValue = null;
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Unauthorized");
    });
    const anonRes = await attachmentGET(attachmentRequest(target.id), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(anonRes.status).toBe(404);

    // Case 2: Guru dibanned (isBanned: true)
    mockedVerifyContext.mockReset().mockResolvedValue({
      isBanned: true,
      context: { id: teachingContextId },
    } as never);
    const bannedRes = await attachmentGET(attachmentRequest(target.id), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(bannedRes.status).toBe(404);
  });

  it("VG4: createAssignment gagal klaim file (duplikat key) melempar error dan tidak membuat assignment", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockImplementation(async () => ({
      context: { id: teachingContextId },
    } as never));
    mockedHead.mockReset().mockResolvedValue(FILE_A.sizeBytes);

    const countBefore = await prisma.assignment.count({ where: { teachingContextId } });
    await expect(
      createAssignment({
        teachingContextId,
        title: "Tugas Cacat",
        files: [FILE_A, { ...FILE_A, name: "duplikat.pdf" }],
      })
    ).rejects.toThrow("duplikasi");

    const countAfter = await prisma.assignment.count({ where: { teachingContextId } });
    expect(countAfter).toBe(countBefore);
  });

  it("BH1: setAssignmentAttachmentsAction & upload-url menolak guru yang dibanned", async () => {
    if (!dbAvailable) return;
    mockedVerifyContext.mockReset().mockResolvedValue({
      isBanned: true,
      context: { id: teachingContextId },
    } as never);

    // setAssignmentAttachmentsAction
    const setRes = await setAssignmentAttachmentsAction({
      teachingContextId,
      assignmentId,
      keepFileIds: [],
      newFiles: [FILE_A],
    });
    expect(setRes.success).toBe(false);
    expect(setRes.error).toContain("dinonaktifkan");

    // upload-url
    currentCookieValue = null;
    const urlRes = await uploadUrlPOST(
      uploadUrlRequest({
        kind: "attachment",
        teachingContextId,
        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
      })
    );
    expect(urlRes.status).toBe(403);
  });

  it("BH3: siswa berstatus tidak aktif ditolak saat mengakses attachment", async () => {
    if (!dbAvailable) return;
    // Ubah sementara status siswa s1 menjadi ARCHIVED
    await prisma.student.update({
      where: { id: studentId },
      data: { status: "ARCHIVED" },
    });

    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
    const target = rows[0];

    currentCookieValue = rombelStudentToken;
    mockedVerifyContext.mockReset().mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await attachmentGET(attachmentRequest(target.id), {
      params: Promise.resolve({ fileId: target.id }),
    });
    expect(res.status).toBe(404);

    // Kembalikan ke ACTIVE
    await prisma.student.update({
      where: { id: studentId },
      data: { status: "ACTIVE" },
    });
  });
});
