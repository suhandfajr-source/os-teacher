import { prisma } from "@/lib/auth";
import crypto from "crypto";
import {
  CreateParentInvitationInput,
  PublicInvitationInfo,
  AuthenticatedInvitationDetail,
  ParentContextListItem,
  ParentContextDetail,
  TeacherParentAccessItem,
  TeacherParentInvitationItem
} from "./parent.types";
import {
  verifyTeachingContextAccess,
  verifyCurrentStudentInTeachingContext,
  verifyParentTeachingAccess
} from "@/lib/authorization";
import { AttendanceStatus, AssessmentResultStatus, ParentInvitationStatus } from "@prisma/client";

// -------------------------------------------------
// TOKEN UTILITIES
// -------------------------------------------------

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

import { normalizeEmail, maskEmail, validateSafeInternalPath } from "./parent.utils";
export { normalizeEmail, maskEmail, validateSafeInternalPath };

// -------------------------------------------------
// TEACHER INVITATION & ACCESS MANAGEMENT
// -------------------------------------------------

export async function createParentInvitation(
  teacherProfileId: string,
  input: CreateParentInvitationInput
): Promise<{
  invitation: {
    id: string;
    tokenHash: string;
    recipientEmail: string;
    relationshipLabel: string | null;
    studentId: string;
    teachingContextId: string;
    teacherProfileId: string;
    status: ParentInvitationStatus;
    expiresAt: Date;
    createdAt: Date;
    student: {
      id: string;
      fullName: string;
    };
  };
  rawToken: string;
}> {
  // 1. Verify teacher ownership and school membership
  const { profile } = await verifyTeachingContextAccess(input.teachingContextId);
  if (profile.id !== teacherProfileId) {
    throw new Error("Forbidden: You do not own this teaching context");
  }

  // 2. Verify student is in the current active roster
  await verifyCurrentStudentInTeachingContext(input.teachingContextId, input.studentId);

  const recipientEmail = normalizeEmail(input.recipientEmail);
  if (!recipientEmail || !recipientEmail.includes("@")) {
    throw new Error("Email orang tua tidak valid");
  }

  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return await prisma.$transaction(async (tx) => {
    // Reissue lifecycle (Binding Amendment 5):
    // Revoke any previous PENDING invitations for this (email, student, context) tuple
    await tx.parentInvitation.updateMany({
      where: {
        recipientEmail: recipientEmail,
        studentId: input.studentId,
        teachingContextId: input.teachingContextId,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    const invitation = await tx.parentInvitation.create({
      data: {
        tokenHash,
        recipientEmail,
        relationshipLabel: input.relationshipLabel?.trim() || null,
        studentId: input.studentId,
        teachingContextId: input.teachingContextId,
        teacherProfileId: profile.id,
        status: "PENDING",
        expiresAt,
      },
      include: {
        student: true,
        teachingContext: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });

    return { invitation, rawToken };
  });
}

export async function getTeacherParentAccessList(teachingContextId: string): Promise<TeacherParentAccessItem[]> {
  await verifyTeachingContextAccess(teachingContextId);

  const accesses = await prisma.parentTeachingAccess.findMany({
    where: {
      teachingContextId,
    },
    include: {
      parentStudentRelation: {
        include: {
          student: true,
          parentProfile: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return accesses.map((a) => ({
    id: a.id,
    parentStudentRelationId: a.parentStudentRelationId,
    studentId: a.parentStudentRelation.studentId,
    studentName: a.parentStudentRelation.student.fullName,
    parentEmail: a.parentStudentRelation.parentProfile.user.email,
    parentName: a.parentStudentRelation.parentProfile.user.name,
    relationshipLabel: a.parentStudentRelation.relationshipLabel,
    status: a.status,
    grantedAt: a.createdAt,
    revokedAt: a.revokedAt,
  }));
}

export async function getTeacherParentInvitationList(teachingContextId: string): Promise<TeacherParentInvitationItem[]> {
  await verifyTeachingContextAccess(teachingContextId);

  const invites = await prisma.parentInvitation.findMany({
    where: {
      teachingContextId,
    },
    include: {
      student: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return invites.map((inv) => ({
    id: inv.id,
    studentId: inv.studentId,
    studentName: inv.student.fullName,
    recipientEmail: inv.recipientEmail,
    relationshipLabel: inv.relationshipLabel,
    status: inv.status,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    createdAt: inv.createdAt,
  }));
}

export async function revokeParentTeachingAccess(
  teachingContextId: string,
  accessId: string
): Promise<{ success: boolean }> {
  await verifyTeachingContextAccess(teachingContextId);

  const access = await prisma.parentTeachingAccess.findUnique({
    where: { id: accessId },
  });

  if (!access || access.teachingContextId !== teachingContextId) {
    throw new Error("Akses orang tua tidak ditemukan pada kelas ini");
  }

  await prisma.parentTeachingAccess.update({
    where: { id: accessId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  return { success: true };
}

export async function cancelParentInvitation(
  teachingContextId: string,
  invitationId: string
): Promise<{ success: boolean }> {
  await verifyTeachingContextAccess(teachingContextId);

  const invitation = await prisma.parentInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation || invitation.teachingContextId !== teachingContextId) {
    throw new Error("Undangan tidak ditemukan pada kelas ini");
  }

  await prisma.parentInvitation.update({
    where: { id: invitationId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  return { success: true };
}

// -------------------------------------------------
// PUBLIC & PARENT INVITATION ACCEPTANCE
// -------------------------------------------------

export async function getPublicInvitationInfo(rawToken: string): Promise<PublicInvitationInfo> {
  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await prisma.parentInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return { valid: false, message: "Tautan undangan tidak valid" };
  }

  if (invitation.status !== "PENDING" || invitation.revokedAt !== null) {
    return { valid: false, message: "Undangan sudah tidak berlaku atau telah digunakan" };
  }

  if (invitation.expiresAt < new Date()) {
    return { valid: false, message: "Undangan telah kedaluwarsa" };
  }

  return {
    valid: true,
    maskedEmail: maskEmail(invitation.recipientEmail),
    expiresAt: invitation.expiresAt,
    status: invitation.status,
  };
}

export async function getAuthenticatedInvitationDetail(
  rawToken: string,
  userEmail: string
): Promise<AuthenticatedInvitationDetail> {
  const tokenHash = hashInvitationToken(rawToken);
  const normalizedUserEmail = normalizeEmail(userEmail);

  const invitation = await prisma.parentInvitation.findUnique({
    where: { tokenHash },
    include: {
      student: true,
      teachingContext: {
        include: {
          subject: true,
          class: true,
          academicPeriod: true,
          teacherProfile: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error("Tautan undangan tidak valid");
  }

  if (invitation.status !== "PENDING" || invitation.revokedAt !== null) {
    throw new Error("Undangan sudah tidak berlaku atau telah digunakan");
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("Undangan telah kedaluwarsa");
  }

  if (normalizeEmail(invitation.recipientEmail) !== normalizedUserEmail) {
    throw new Error("Email akun yang masuk tidak sesuai dengan email penerima undangan");
  }

  return {
    id: invitation.id,
    recipientEmail: invitation.recipientEmail,
    relationshipLabel: invitation.relationshipLabel,
    studentId: invitation.studentId,
    studentName: invitation.student.fullName,
    teachingContextId: invitation.teachingContextId,
    className: invitation.teachingContext.class.name,
    subjectName: invitation.teachingContext.subject.name,
    academicYear: invitation.teachingContext.academicPeriod.year,
    academicSemester: invitation.teachingContext.academicPeriod.semester,
    teacherName:
      invitation.teachingContext.teacherProfile.preferredName ||
      invitation.teachingContext.teacherProfile.user.name,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
  };
}

export async function acceptParentInvitationAtomic(
  rawToken: string,
  userId: string,
  userEmail: string
): Promise<{ success: boolean; studentId: string; teachingContextId: string }> {
  const tokenHash = hashInvitationToken(rawToken);
  const normalizedUserEmail = normalizeEmail(userEmail);

  return await prisma.$transaction(async (tx) => {
    // 1. Find invitation candidate
    const invitation = await tx.parentInvitation.findUnique({
      where: { tokenHash },
      include: {
        teachingContext: {
          include: {
            teacherProfile: {
              include: {
                memberships: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new Error("Undangan tidak valid");
    }

    if (invitation.status !== "PENDING" || invitation.revokedAt !== null || invitation.acceptedAt !== null) {
      throw new Error("Undangan sudah tidak berlaku atau telah digunakan");
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error("Undangan telah kedaluwarsa");
    }

    if (normalizeEmail(invitation.recipientEmail) !== normalizedUserEmail) {
      throw new Error("Email akun yang masuk tidak cocok dengan penerima undangan");
    }

    // 2. Revalidate teacher ownership and active school membership
    const context = invitation.teachingContext;
    const teacherProfile = context.teacherProfile;
    const activeMembership = teacherProfile.memberships.find(
      (m) => m.schoolId === context.schoolId && m.status === "ACTIVE"
    );
    if (!activeMembership || context.teacherProfileId !== teacherProfile.id) {
      throw new Error("Guru pembuat undangan sudah tidak memiliki hak akses aktif pada kelas ini");
    }

    // 3. Revalidate student is STILL in current ClassStudent roster
    const currentRosterEntry = await tx.classStudent.findFirst({
      where: {
        studentId: invitation.studentId,
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
      },
    });

    if (!currentRosterEntry) {
      throw new Error("Siswa tidak lagi terdaftar dalam anggota kelas aktif saat ini");
    }

    // 4. Atomic One-Time Claim (Binding Amendment 4)
    // Conditional update ensures only one concurrent winner
    const claimResult = await tx.parentInvitation.updateMany({
      where: {
        id: invitation.id,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    if (claimResult.count === 0) {
      throw new Error("Undangan sudah tidak berlaku, telah digunakan, atau kedaluwarsa");
    }

    // 5. Find or create ParentProfile for user
    let parentProfile = await tx.parentProfile.findUnique({
      where: { userId },
    });

    if (!parentProfile) {
      parentProfile = await tx.parentProfile.create({
        data: {
          userId,
        },
      });
    }

    // Update invitation with acceptedByParentProfileId
    await tx.parentInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedByParentProfileId: parentProfile.id,
      },
    });

    // 6. Find or create ParentStudentRelation
    let relation = await tx.parentStudentRelation.findUnique({
      where: {
        parentProfileId_studentId: {
          parentProfileId: parentProfile.id,
          studentId: invitation.studentId,
        },
      },
    });

    if (!relation) {
      relation = await tx.parentStudentRelation.create({
        data: {
          parentProfileId: parentProfile.id,
          studentId: invitation.studentId,
          relationshipLabel: invitation.relationshipLabel || null,
        },
      });
    } else if (invitation.relationshipLabel && !relation.relationshipLabel) {
      relation = await tx.parentStudentRelation.update({
        where: { id: relation.id },
        data: {
          relationshipLabel: invitation.relationshipLabel,
        },
      });
    }

    // 7. Upsert ParentTeachingAccess
    await tx.parentTeachingAccess.upsert({
      where: {
        parentStudentRelationId_teachingContextId: {
          parentStudentRelationId: relation.id,
          teachingContextId: invitation.teachingContextId,
        },
      },
      update: {
        status: "ACTIVE",
        grantedByTeacherProfileId: invitation.teacherProfileId,
        revokedAt: null,
      },
      create: {
        parentStudentRelationId: relation.id,
        teachingContextId: invitation.teachingContextId,
        grantedByTeacherProfileId: invitation.teacherProfileId,
        status: "ACTIVE",
      },
    });

    return {
      success: true,
      studentId: invitation.studentId,
      teachingContextId: invitation.teachingContextId,
    };
  });
}

// -------------------------------------------------
// PARENT PORTAL READ-ONLY QUERIES
// -------------------------------------------------

export async function getParentAuthorizedContexts(parentProfileId: string): Promise<ParentContextListItem[]> {
  const accesses = await prisma.parentTeachingAccess.findMany({
    where: {
      parentStudentRelation: {
        parentProfileId: parentProfileId,
      },
      status: "ACTIVE",
    },
    include: {
      parentStudentRelation: {
        include: {
          student: true,
        },
      },
      teachingContext: {
        include: {
          subject: true,
          class: true,
          academicPeriod: true,
          teacherProfile: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return accesses.map((a) => {
    const student = a.parentStudentRelation.student;
    const context = a.teachingContext;
    const teacher = context.teacherProfile;
    return {
      studentId: student.id,
      studentName: student.fullName,
      relationshipLabel: a.parentStudentRelation.relationshipLabel,
      teachingContextId: context.id,
      subjectName: context.subject.name,
      className: context.class.name,
      academicYear: context.academicPeriod.year,
      academicSemester: context.academicPeriod.semester,
      teacherName: teacher.preferredName || teacher.user.name,
      accessStatus: a.status,
    };
  });
}

export async function getParentContextDetail(
  studentId: string,
  teachingContextId: string
): Promise<ParentContextDetail> {
  // 1. Validate authorization
  const { student, relation, teachingContext } = await verifyParentTeachingAccess(studentId, teachingContextId);

  // 2. Query attendance records for this student in this context
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      teachingSession: {
        teachingContextId,
      },
    },
    include: {
      teachingSession: true,
    },
    orderBy: {
      teachingSession: {
        date: "desc",
      },
    },
  });

  let presentCount = 0;
  let lateCount = 0;
  let sickCount = 0;
  let permissionCount = 0;
  let absentCount = 0;

  const records = attendanceRecords.map((r) => {
    if (r.status === AttendanceStatus.PRESENT) presentCount++;
    else if (r.status === AttendanceStatus.LATE) lateCount++;
    else if (r.status === AttendanceStatus.SICK) sickCount++;
    else if (r.status === AttendanceStatus.PERMISSION) permissionCount++;
    else if (r.status === AttendanceStatus.ABSENT) absentCount++;

    return {
      sessionId: r.teachingSessionId,
      date: r.teachingSession.date.toISOString().split("T")[0],
      status: r.status,
    };
  });

  // 3. Query completed learning activities with participant proof (Binding Amendment 6)
  const completedSessions = await prisma.teachingSession.findMany({
    where: {
      teachingContextId,
      status: "COMPLETED",
      attendanceRecords: {
        some: {
          studentId,
        },
      },
    },
    include: {
      attendanceRecords: {
        where: { studentId },
      },
    },
    orderBy: { date: "desc" },
  });

  const activities = completedSessions.map((s) => ({
    sessionId: s.id,
    date: s.date.toISOString().split("T")[0],
    actualTopic: s.actualTopic,
    attendanceStatus: s.attendanceRecords[0]?.status || AttendanceStatus.PRESENT,
  }));

  // 4. Query completed assessments with exact student results
  const completedAssessments = await prisma.assessment.findMany({
    where: {
      teachingContextId,
      status: "COMPLETED",
      results: {
        some: {
          studentId,
        },
      },
    },
    include: {
      assessmentType: true,
      results: {
        where: { studentId },
      },
    },
    orderBy: { assessmentDate: "desc" },
  });

  const assessments = completedAssessments.map((ass) => {
    const res = ass.results[0];
    const resultStatus = res?.status || AssessmentResultStatus.PENDING;
    const finalScore = resultStatus === AssessmentResultStatus.GRADED && res?.finalScore ? Number(res.finalScore) : null;
    const minimumPassingScore = ass.minimumPassingScore ? Number(ass.minimumPassingScore) : null;

    return {
      assessmentId: ass.id,
      title: ass.title,
      category: ass.assessmentType.category,
      date: ass.assessmentDate.toISOString().split("T")[0],
      minimumPassingScore,
      resultStatus,
      finalScore,
    };
  });

  const teacher = teachingContext.teacherProfile;

  return {
    studentId: student.id,
    studentName: student.fullName,
    relationshipLabel: relation.relationshipLabel,
    teachingContextId: teachingContext.id,
    subjectName: teachingContext.subject.name,
    className: teachingContext.class.name,
    academicYear: teachingContext.academicPeriod.year,
    academicSemester: teachingContext.academicPeriod.semester,
    teacherName: teacher.preferredName || teacher.user.name,
    attendance: {
      presentCount,
      lateCount,
      sickCount,
      permissionCount,
      absentCount,
      records,
    },
    activities,
    assessments,
  };
}
