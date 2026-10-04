import { z } from "zod";

/**
 * Tipe Aksi Mutasi yang didukung oleh Human-in-the-Loop Action Engine
 */
export const AgentActionTypeEnum = z.enum([
  "RECORD_ATTENDANCE",
  "CREATE_ANNOUNCEMENT",
  "CREATE_ASSIGNMENT",
]);
export type AgentActionType = z.infer<typeof AgentActionTypeEnum>;

/**
 * 1. Payload Snapshot: Pencatatan Presensi Kelas
 */
export const AttendanceItemSchema = z.object({
  studentId: z.string().min(1, "Student ID wajib diisi"),
  studentName: z.string().optional(),
  status: z.enum(["PRESENT", "SICK", "PERMISSION", "ABSENT"]),
  notes: z.string().optional(),
});

export const RecordAttendancePayloadSchema = z.object({
  classId: z.string().min(1, "Class ID wajib diisi"),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  topic: z.string().optional().default("Sesi Pembelajaran"),
  records: z.array(AttendanceItemSchema).min(1, "Minimal harus ada 1 catatan presensi"),
});
export type RecordAttendancePayload = z.infer<typeof RecordAttendancePayloadSchema>;

/**
 * 2. Payload Snapshot: Pembuatan Pengumuman Kelas
 */
export const CreateAnnouncementPayloadSchema = z.object({
  classId: z.string().min(1, "Class ID wajib diisi"),
  title: z.string().min(3, "Judul pengumuman minimal 3 karakter"),
  content: z.string().min(5, "Konten pengumuman minimal 5 karakter"),
  isPinned: z.boolean().optional().default(false),
});
export type CreateAnnouncementPayload = z.infer<typeof CreateAnnouncementPayloadSchema>;

/**
 * 3. Payload Snapshot: Pembuatan Draft Penugasan Baru
 */
export const CreateAssignmentPayloadSchema = z.object({
  classId: z.string().min(1, "Class ID wajib diisi"),
  subjectId: z.string().min(1, "Subject ID wajib diisi"),
  title: z.string().min(3, "Judul tugas minimal 3 karakter"),
  description: z.string().min(5, "Deskripsi tugas minimal 5 karakter"),
  dueDate: z.string().datetime({ message: "Format batas waktu harus ISO DateTime" }),
});
export type CreateAssignmentPayload = z.infer<typeof CreateAssignmentPayloadSchema>;

/**
 * Input Schema untuk Tool AI SDK pembuat draft proposal
 */
export const ProposeAttendanceLogSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID wajib diisi"),
  classId: z.string().min(1, "Class ID rombel wajib diisi"),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  topic: z.string().optional().default("Sesi Pembelajaran"),
  records: z.array(AttendanceItemSchema).min(1, "Minimal harus ada 1 catatan presensi"),
});
export type ProposeAttendanceLogInput = z.infer<typeof ProposeAttendanceLogSchema>;

export const ProposeClassAnnouncementSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID wajib diisi"),
  classId: z.string().min(1, "Class ID rombel wajib diisi"),
  title: z.string().min(3, "Judul pengumuman minimal 3 karakter"),
  content: z.string().min(5, "Konten pengumuman minimal 5 karakter"),
});
export type ProposeClassAnnouncementInput = z.infer<typeof ProposeClassAnnouncementSchema>;

export const ProposeAssignmentDraftSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID wajib diisi"),
  classId: z.string().min(1, "Class ID rombel wajib diisi"),
  subjectId: z.string().min(1, "Subject ID mata pelajaran wajib diisi"),
  title: z.string().min(3, "Judul tugas minimal 3 karakter"),
  description: z.string().min(5, "Deskripsi tugas minimal 5 karakter"),
  dueDate: z.string().datetime({ message: "Format batas waktu harus ISO DateTime" }),
});
export type ProposeAssignmentDraftInput = z.infer<typeof ProposeAssignmentDraftSchema>;
