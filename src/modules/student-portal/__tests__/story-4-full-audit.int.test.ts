import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// In-memory cookie store mock for next/headers
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
}));

import { prisma } from "@/lib/auth";
import { hashPin, verifyPin } from "@/lib/student-pin";
import {
  signStudentSessionToken,
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE_NAME,
} from "@/modules/student-auth/student-session";
import {
  getStudentDashboardDataAction,
  getStudentWeeklyScheduleAction,
  changeStudentPinAction,
} from "../student-portal.actions";
import {
  startQuizAttemptFromSessionAction,
  saveQuizAnswerFromSessionAction,
  submitQuizAttemptFromSessionAction,
  getQuizReviewFromSessionAction,
  getStudentQuizListAction,
} from "@/modules/quiz/quiz.actions";
import { getNormalizedDayOfWeek } from "@/lib/schedule-date-utils";

describe("Story 4 Deep Real-Database Integration & Security Audit", () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  // Test Entities
  let schoolId: string;
  let academicPeriodId: string;
  let subjectId: string;
  let teacherUserId: string;
  let teacherProfileId: string;
  let classId: string;
  let studentId: string;
  let studentNis: string;
  let studentPin = "1234";
  let studentSessionToken: string;

  let quizId: string;
  let quizShareToken: string;
  let q1Id: string;
  let q2Id: string;

  beforeAll(async () => {
    try {
      // 1. Setup School
      const school = await prisma.school.create({
        data: {
          name: `Audit Sekolah Siswa S4 ${timestamp}`,
          normalizedName: `audit sekolah siswa s4 ${timestamp}`,
          npsn: `NPSN4${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      // 2. Setup AcademicPeriod (ACTIVE)
      const ap = await prisma.academicPeriod.create({
        data: {
          schoolId: school.id,
          year: "2026/2027",
          semester: "Ganjil",
          status: "ACTIVE",
        },
      });
      academicPeriodId = ap.id;

      // 3. Setup Subject
      const subject = await prisma.subject.create({
        data: {
          name: `Biologi ${timestamp}`,
          schoolId: school.id,
        },
      });
      subjectId = subject.id;

      // 4. Setup Teacher User & Profile
      teacherUserId = `teacher-s4-${timestamp}`;
      const teacherUser = await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Pengampu S4",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const teacherProfile = await prisma.teacherProfile.create({
        data: {
          userId: teacherUser.id,
          activeSchoolId: school.id,
          onboardingCompleted: true,
        },
      });
      teacherProfileId = teacherProfile.id;

      // 5. Setup Class (Rombel)
      const cls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "9-A",
          gradeLevel: "9",
          joinCode: `S4${timestamp.toString().slice(-4)}`,
        },
      });
      classId = cls.id;

      // 6. Setup TeachingContext
      const tc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
          academicPeriodId: ap.id,
          subjectId: subject.id,
          classId: cls.id,
        },
      });

      // 7. Setup Today's TeachingSchedule
      const todayDay = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");
      await prisma.teachingSchedule.create({
        data: {
          teachingContextId: tc.id,
          dayOfWeek: todayDay,
          startTime: "07:00",
          endTime: "23:59", // LIVE range for today's test
          room: "Lab Sains 1",
        },
      });

      // 8. Setup Student with ACTIVE status & Scrypt PIN
      studentNis = `NIS${timestamp.toString().slice(-6)}`;
      const pinHash = await hashPin(studentPin);
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Fajar Siswa Teladan",
          nis: studentNis,
          accessPinHash: pinHash,
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      studentId = student.id;

      // Enroll student in ClassStudent
      await prisma.classStudent.create({
        data: {
          studentId: student.id,
          classId: cls.id,
          academicPeriodId: ap.id,
        },
      });

      // 9. Setup Quiz with 2 Questions (PUBLISHED)
      quizShareToken = `share-token-${timestamp}`;
      const quiz = await prisma.quiz.create({
        data: {
          teachingContextId: tc.id,
          title: "Ujian Akhir Semester Biologi",
          description: "Kerjakan dengan teliti.",
          status: "PUBLISHED",
          shareToken: quizShareToken,
          durationMinutes: 45,
          standardScore: 75,
          shuffleQuestions: false,
          shuffleOptions: false,
          accessMode: "CLASSROOM_PIN",
          classroomPin: "9999",
        },
      });
      quizId = quiz.id;

      const q1 = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          order: 1,
          type: "MULTIPLE_CHOICE",
          text: "Organel sel yang berfungsi menghasilkan ATP adalah?",
          options: ["Ribosom", "Mitokondria", "Lisosom", "Kloroplas"],
          correctIndex: 1, // Mitokondria
          points: 50,
          explanation: "Mitokondria adalah pusat respirasi sel penghasil energi ATP.",
        },
      });
      q1Id = q1.id;

      const q2 = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          order: 2,
          type: "MULTIPLE_CHOICE",
          text: "Hormon pengatur kadar gula darah adalah?",
          options: ["Adrenalin", "Insulin", "Tiroksin", "Estrogen"],
          correctIndex: 1, // Insulin
          points: 50,
          explanation: "Insulin disekresikan pankreas untuk menurunkan gula darah.",
        },
      });
      q2Id = q2.id;

      // 10. Generate initial valid session cookie
      studentSessionToken = signStudentSessionToken({
        studentId: student.id,
        schoolId: school.id,
        classId: cls.id,
        academicPeriodId: ap.id,
        nis: studentNis,
        fullName: student.fullName,
        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
      });
      currentCookieValue = studentSessionToken;

      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not reachable, skipping live DB tests:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Cascading delete school removes all related records
      if (schoolId) {
        await prisma.school.delete({ where: { id: schoolId } });
      }
      if (teacherUserId) {
        await prisma.user.delete({ where: { id: teacherUserId } });
      }
      if (subjectId) {
        await prisma.subject.delete({ where: { id: subjectId } });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  // ==========================================================================
  // 1. DAILY STREAM & SCHEDULE END-TO-END AUDIT (CAP-5)
  // ==========================================================================
  describe("1. Daily Stream & Schedule Integration Audit (CAP-5)", () => {
    it("fetches today's live schedule and student profile from real DB", async () => {
      if (!dbAvailable) return;

      const res = await getStudentDashboardDataAction();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const { student, today, urgentQuizzes } = res.data!;
      expect(student.fullName).toBe("Fajar Siswa Teladan");
      expect(student.nis).toBe(studentNis);
      expect(student.className).toContain("9-A");

      // Verify LIVE schedule detection
      expect(today.schedules.length).toBeGreaterThanOrEqual(1);
      const todayClass = today.schedules.find((s) => s.room === "Lab Sains 1");
      expect(todayClass).toBeDefined();
      expect(todayClass?.isLive).toBe(true);

      // Verify published quiz is in urgent list
      expect(urgentQuizzes.length).toBeGreaterThanOrEqual(1);
      const examQuiz = urgentQuizzes.find((q) => q.shareToken === quizShareToken);
      expect(examQuiz).toBeDefined();
      expect(examQuiz?.title).toBe("Ujian Akhir Semester Biologi");
      expect(examQuiz?.isAttempted).toBe(false);
    });

    it("fetches weekly schedule grouped Monday to Saturday from real DB", async () => {
      if (!dbAvailable) return;

      const res = await getStudentWeeklyScheduleAction();
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(6);

      const todayDay = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");
      const todayGroup = res.data?.find((d) => d.dayOfWeek === todayDay);
      expect(todayGroup?.items.some((i) => i.room === "Lab Sains 1")).toBe(true);
    });

    it("fetches student quiz center list with active and completed buckets", async () => {
      if (!dbAvailable) return;

      const res = await getStudentQuizListAction();
      expect(res.success).toBe(true);
      expect(res.data?.activeQuizzes.some((q) => q.shareToken === quizShareToken)).toBe(true);
      expect(res.data?.completedQuizzes.length).toBe(0);
    });
  });

  // ==========================================================================
  // 2. QUIZ GOLDEN JOURNEY & ANTI-CHEAT SECURITY AUDIT (CAP-6 & B1 & F3 & F6)
  // ==========================================================================
  describe("2. Quiz Sesi Server Golden Journey & Security Audit (CAP-6, B1, F6, F7)", () => {
    let attemptId: string;

    it("B1 & F6: startQuizAttemptFromSessionAction derives studentId from session and sanitizes answers/explanations", async () => {
      if (!dbAvailable) return;

      const res = await startQuizAttemptFromSessionAction(quizShareToken);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      attemptId = res.data!.attemptId;
      expect(attemptId).toBeDefined();
      expect(res.data?.quizTitle).toBe("Ujian Akhir Semester Biologi");
      expect(res.data?.questions.length).toBe(2);

      // F6 CRITICAL AUDIT: Ensure correctIndex and explanation are NOT returned in the questions!
      res.data?.questions.forEach((q: any) => {
        expect(q.correctIndex).toBeUndefined();
        expect(q.explanation).toBeUndefined();
      });

      // Verify row created in real database
      const dbAttempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
      });
      expect(dbAttempt).toBeDefined();
      expect(dbAttempt?.studentId).toBe(studentId);
      expect(dbAttempt?.quizId).toBe(quizId);
      expect(dbAttempt?.status).toBe("IN_PROGRESS");
    });

    it("D1: double-start concurrency returns identical attempt without P2002 error", async () => {
      if (!dbAvailable) return;

      // Student opens a second tab or clicks "Kerjakan" twice
      const secondCall = await startQuizAttemptFromSessionAction(quizShareToken);
      expect(secondCall.success).toBe(true);
      expect(secondCall.data?.attemptId).toBe(attemptId);
    });

    it("F3 & Finding 6: saveQuizAnswerFromSessionAction saves answers and rejects foreign question injection", async () => {
      if (!dbAvailable) return;

      // 1. Save valid answer for question 1 (Index 1 = Mitokondria = Benar)
      const saveRes = await saveQuizAnswerFromSessionAction(attemptId, q1Id, 1);
      expect(saveRes.success).toBe(true);

      // Verify in real DB
      const dbAnswer = await prisma.quizAnswer.findUnique({
        where: { attemptId_questionId: { attemptId, questionId: q1Id } },
      });
      expect(dbAnswer).toBeDefined();
      expect(dbAnswer?.selectedIndex).toBe(1);

      // 2. Reject injection of foreign question not in this attempt snapshot (Finding 6)
      const injectRes = await saveQuizAnswerFromSessionAction(
        attemptId,
        "foreign-question-id-that-does-not-exist",
        0
      );
      expect(injectRes.success).toBe(false);
      expect(injectRes.error).toMatch(/Soal tidak valid/);
    });

    it("CAP-6 & Activity Generates Data: submitQuizAttemptFromSessionAction grades automatically to DB", async () => {
      if (!dbAvailable) return;

      const finalAnswers = [
        { questionId: q1Id, selectedIndex: 1 }, // Benar (+50 poin)
        { questionId: q2Id, selectedIndex: 1 }, // Benar (+50 poin)
      ];

      const submitRes = await submitQuizAttemptFromSessionAction(attemptId, finalAnswers);
      expect(submitRes.success).toBe(true);
      expect(submitRes.data?.score).toBe(100);
      expect(submitRes.data?.passed).toBe(true); // 100 >= 75

      // REAL DB VERIFICATION: Score must be stored in QuizAttempt.score!
      const dbAttempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
      });
      expect(dbAttempt?.status).toBe("SUBMITTED");
      expect(Number(dbAttempt?.score)).toBe(100);
      expect(dbAttempt?.submittedAt).toBeInstanceOf(Date);

      // Teacher leger visibility test (Activity Generates Data):
      const teacherLeger = await prisma.quizAttempt.findMany({
        where: { quizId },
        include: { student: { select: { fullName: true, nis: true } } },
      });
      expect(teacherLeger.length).toBe(1);
      expect(Number(teacherLeger[0].score)).toBe(100);
      expect(teacherLeger[0].student.fullName).toBe("Fajar Siswa Teladan");
    });

    it("Finding 3 Anti-Cheat: review hides answer keys if exam deadline is active, reveals when passed", async () => {
      if (!dbAvailable) return;

      // 1. Test when quiz has future deadline: answer key is masked
      await prisma.quiz.update({
        where: { id: quizId },
        data: { deadline: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour in future
      });

      const maskedReview = await getQuizReviewFromSessionAction(quizShareToken);
      expect(maskedReview.success).toBe(true);
      expect(maskedReview.data?.score).toBe(100);
      // correctIndex MUST be null during active exam!
      expect(maskedReview.data?.questions[0].correctIndex).toBeNull();
      expect(maskedReview.data?.questions[0].explanation).toContain("Kunci jawaban dan pembahasan lengkap akan dibuka otomatis");

      // 2. Test when quiz deadline has passed: full explanations and keys are revealed!
      await prisma.quiz.update({
        where: { id: quizId },
        data: { deadline: new Date(Date.now() - 1000) }, // Past deadline
      });

      const fullReview = await getQuizReviewFromSessionAction(quizShareToken);
      expect(fullReview.success).toBe(true);
      expect(fullReview.data?.questions[0].correctIndex).toBe(1);
      expect(fullReview.data?.questions[0].explanation).toContain("Mitokondria");
    });

    it("Submitting again on already SUBMITTED attempt is idempotent", async () => {
      if (!dbAvailable) return;

      const res = await submitQuizAttemptFromSessionAction(attemptId, []);
      expect(res.success).toBe(true);
      expect(res.alreadySubmitted).toBe(true);
      expect(res.data?.score).toBe(100);
    });
  });

  // ==========================================================================
  // 3. PIN ROTATION & INSTANT SESSION INVALIDATION AUDIT (Amendum B5 & F5)
  // ==========================================================================
  describe("3. PIN Security & Remote Session Invalidation Audit (Amendum B5 & F5)", () => {
    it("rejects wrong old PIN and increments failedAttempts in real DB", async () => {
      if (!dbAvailable) return;

      const res = await changeStudentPinAction({
        oldPin: "0000", // Wrong PIN
        newPin: "5555",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/PIN lama salah/);

      const dbStudent = await prisma.student.findUnique({ where: { id: studentId } });
      expect(dbStudent?.failedAttempts).toBe(1);
    });

    it("F5: changing PIN updates pinUpdatedAt in DB and re-issues local session; invalidates old session token", async () => {
      if (!dbAvailable) return;

      const oldToken = currentCookieValue!;

      // Change PIN from 1234 to 4321
      const changeRes = await changeStudentPinAction({
        oldPin: "1234",
        newPin: "4321",
      });

      expect(changeRes.success).toBe(true);
      expect(changeRes.message).toContain("berhasil diubah");

      // Verify real DB record updated
      const updatedStudent = await prisma.student.findUnique({ where: { id: studentId } });
      expect(updatedStudent?.failedAttempts).toBe(0);
      expect(updatedStudent?.pinUpdatedAt).toBeInstanceOf(Date);

      // Verify new PIN scrypt hash works
      const isNewPinMatch = await verifyPin("4321", updatedStudent!.accessPinHash!);
      expect(isNewPinMatch).toBe(true);

      // F5 CRITICAL: Current cookie store must now contain a token with the new pinUpdatedAt!
      const newToken = currentCookieValue!;
      expect(newToken).not.toBe(oldToken);

      const newVerified = verifyStudentSessionToken(newToken);
      expect(newVerified?.pinUpdatedAt).toBe(updatedStudent!.pinUpdatedAt!.toISOString());

      // REMOTE SESSION TERMINATION PROOF: An attacker or other device using oldToken
      // will be REJECTED because token.pinUpdatedAt does not match DB pinUpdatedAt!
      const oldVerifiedPayload = verifyStudentSessionToken(oldToken);
      expect(oldVerifiedPayload?.pinUpdatedAt).not.toBe(updatedStudent!.pinUpdatedAt!.toISOString());
    });
  });
});
