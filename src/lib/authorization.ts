import { prisma, auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function requireAuthSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function verifyActiveSchoolMembership() {
  const session = await requireAuthSession();

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!profile || !profile.activeSchoolId) {
    throw new Error("Teacher profile or active school not found");
  }

  const activeSchool = await prisma.school.findUnique({
    where: { id: profile.activeSchoolId }
  });
  
  if (!activeSchool) throw new Error("Active school not found");

  const membership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId: profile.activeSchoolId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Not an active member of the school workspace");
  }

  return { session, profile, activeSchoolId: profile.activeSchoolId, activeSchool };
}

export async function verifyTeachingContextAccess(teachingContextId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId }
  });

  if (!context) {
    throw new Error("Teaching context not found");
  }

  if (context.teacherProfileId !== profile.id) {
    throw new Error("Forbidden: You do not own this teaching context");
  }

  if (context.schoolId !== activeSchoolId) {
    throw new Error("Forbidden: This context belongs to a different school workspace");
  }

  return { profile, activeSchoolId, context };
}

export async function verifyClassRosterAccess(classId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  // Determine if the teacher has any TeachingContext for this class in this school
  const context = await prisma.teachingContext.findFirst({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
      classId: classId
    }
  });

  if (!context) {
    throw new Error("Forbidden: You do not teach this class");
  }

  return { profile, activeSchoolId, context };
}

export async function verifyTeachingSessionAccess(sessionId: string) {
  const session = await prisma.teachingSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error("Teaching session not found");
  }

  const contextAuth = await verifyTeachingContextAccess(session.teachingContextId);

  return { ...contextAuth, session };
}

export async function verifyAssessmentAccess(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      assessmentType: true,
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true
        }
      }
    }
  });

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const contextAuth = await verifyTeachingContextAccess(assessment.teachingContextId);

  return { ...contextAuth, assessment };
}

export async function verifyAssessmentTypeAccess(assessmentTypeId: string) {
  const assessmentType = await prisma.assessmentType.findUnique({
    where: { id: assessmentTypeId }
  });

  if (!assessmentType) {
    throw new Error("Assessment type not found");
  }

  const contextAuth = await verifyTeachingContextAccess(assessmentType.teachingContextId);

  return { ...contextAuth, assessmentType };
}

export async function verifyGradePolicyAccess(gradePolicyId: string) {
  const gradePolicy = await prisma.gradePolicy.findUnique({
    where: { id: gradePolicyId },
    include: {
      items: {
        include: {
          assessmentType: true
        },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!gradePolicy) {
    throw new Error("Grade policy not found");
  }

  const contextAuth = await verifyTeachingContextAccess(gradePolicy.teachingContextId);

  return { ...contextAuth, gradePolicy };
}

export async function verifyAssessmentResultAccess(resultId: string) {
  const result = await prisma.assessmentResult.findUnique({
    where: { id: resultId },
    include: {
      assessment: true,
      student: true
    }
  });

  if (!result) {
    throw new Error("Assessment result not found");
  }

  const assessmentAuth = await verifyAssessmentAccess(result.assessmentId);

  return { ...assessmentAuth, result };
}

export async function verifyStudentScoreHistoryAccess(studentId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  // Validate student belongs to this active school and is enrolled in at least one class taught by current teacher
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: activeSchoolId,
      classMemberships: {
        some: {
          class: {
            teachingContexts: {
              some: {
                teacherProfileId: profile.id,
                schoolId: activeSchoolId
              }
            }
          }
        }
      }
    }
  });

  if (!student) {
    throw new Error("Forbidden: You do not teach this student or student not found");
  }

  return { profile, activeSchoolId, student };
}

// -------------------------------------------------
// STAGE 05 MONITORING AUTHORIZATION HELPERS
// -------------------------------------------------

/**
 * Validates that the student is CURRENTLY enrolled in the roster of the given TeachingContext.
 * Required for creating new StudentMonitoringNotes.
 */
export async function verifyCurrentStudentInTeachingContext(teachingContextId: string, studentId: string) {
  const { profile, activeSchoolId, context } = await verifyTeachingContextAccess(teachingContextId);

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: activeSchoolId,
    },
  });

  if (!student) {
    throw new Error("Forbidden: Student not found in active school");
  }

  const currentMembership = await prisma.classStudent.findFirst({
    where: {
      studentId: studentId,
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
    },
  });

  if (!currentMembership) {
    throw new Error("Forbidden: Siswa tidak terdaftar dalam anggota kelas aktif saat ini");
  }

  return { profile, activeSchoolId, context, student, currentMembership };
}

/**
 * Validates that the teacher owns the TeachingContext and the student either is currently enrolled
 * OR has historical activity / notes in this exact TeachingContext.
 */
export async function verifyStudentHistoricalAccessInContext(teachingContextId: string, studentId: string) {
  const { profile, activeSchoolId, context } = await verifyTeachingContextAccess(teachingContextId);

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: activeSchoolId,
    },
  });

  if (!student) {
    throw new Error("Forbidden: Student not found in active school");
  }

  // Check current roster presence
  const currentMembership = await prisma.classStudent.findFirst({
    where: {
      studentId: studentId,
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
    },
  });

  const isCurrentRosterStudent = !!currentMembership;

  if (!isCurrentRosterStudent) {
    // Check if there is any historical activity or note in this exact context
    const hasAttendance = await prisma.attendanceRecord.findFirst({
      where: {
        studentId: studentId,
        teachingSession: {
          teachingContextId: context.id,
        },
      },
    });

    const hasAssessment = await prisma.assessmentResult.findFirst({
      where: {
        studentId: studentId,
        assessment: {
          teachingContextId: context.id,
        },
      },
    });

    const hasNote = await prisma.studentMonitoringNote.findFirst({
      where: {
        studentId: studentId,
        teachingContextId: context.id,
      },
    });

    if (!hasAttendance && !hasAssessment && !hasNote) {
      throw new Error("Forbidden: Siswa tidak memiliki hubungan atau riwayat pembelajaran pada kelas ini");
    }
  }

  return { profile, activeSchoolId, context, student, isCurrentRosterStudent };
}

/**
 * Validates that the note exists and belongs to a TeachingContext owned by the active teacher.
 */
export async function verifyMonitoringNoteAccess(noteId: string) {
  const note = await prisma.studentMonitoringNote.findUnique({
    where: { id: noteId },
    include: {
      teachingContext: true,
      student: true,
    },
  });

  if (!note) {
    throw new Error("Catatan monitoring tidak ditemukan");
  }

  const contextAuth = await verifyTeachingContextAccess(note.teachingContextId);

  return { ...contextAuth, note };
}

// -------------------------------------------------
// STAGE 06 AI CONTENT STUDIO AUTHORIZATION HELPERS
// -------------------------------------------------

/**
 * Validates that the AI content draft exists, belongs to the active school,
 * and is owned by the current authenticated teacher profile.
 */
export async function verifyAiDraftAccess(draftId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const draft = await prisma.aiContentDraft.findUnique({
    where: { id: draftId },
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
    },
  });

  if (!draft) {
    throw new Error("Draft AI tidak ditemukan");
  }

  if (draft.teacherProfileId !== profile.id) {
    throw new Error("Forbidden: You do not own this AI draft");
  }

  if (draft.schoolId !== activeSchoolId) {
    throw new Error("Forbidden: This draft belongs to a different school workspace");
  }

  return { profile, activeSchoolId, draft };
}

// -------------------------------------------------
// STAGE 07 ACADEMIC CONTEXT AUTHORIZATION HELPERS
// -------------------------------------------------

/**
 * Validates that the LearningObjective exists and belongs to a TeachingContext
 * owned by the active teacher in the active school workspace.
 */
export async function verifyLearningObjectiveAccess(objectiveId: string) {
  const objective = await prisma.learningObjective.findUnique({
    where: { id: objectiveId },
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
    },
  });

  if (!objective) {
    throw new Error("Tujuan Pembelajaran tidak ditemukan");
  }

  const contextAuth = await verifyTeachingContextAccess(objective.teachingContextId);

  return { ...contextAuth, objective };
}

/**
 * Validates that the AcademicPlanItem exists and belongs to a TeachingContext
 * owned by the active teacher in the active school workspace.
 */
export async function verifyAcademicPlanItemAccess(planItemId: string) {
  const planItem = await prisma.academicPlanItem.findUnique({
    where: { id: planItemId },
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
    },
  });

  if (!planItem) {
    throw new Error("Program Akademik (Prota/Prosem) tidak ditemukan");
  }

  const contextAuth = await verifyTeachingContextAccess(planItem.teachingContextId);

  return { ...contextAuth, planItem };
}

// -------------------------------------------------
// STAGE 08 PARENT PORTAL AUTHORIZATION HELPERS
// -------------------------------------------------

/**
 * Validates that the user has an active authenticated session and returns ParentProfile if exists.
 */
export async function verifyParentSession() {
  const session = await requireAuthSession();

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id }
  });

  return { session, parentProfile };
}

/**
 * Validates that the authenticated parent has an active relation with the given student.
 */
export async function verifyParentStudentRelation(studentId: string) {
  const { session, parentProfile } = await verifyParentSession();

  if (!parentProfile) {
    throw new Error("Forbidden: Profil orang tua tidak ditemukan");
  }

  const relation = await prisma.parentStudentRelation.findUnique({
    where: {
      parentProfileId_studentId: {
        parentProfileId: parentProfile.id,
        studentId: studentId
      }
    },
    include: {
      student: true
    }
  });

  if (!relation) {
    throw new Error("Forbidden: Anda tidak memiliki akses terhadap data siswa ini");
  }

  return { session, parentProfile, relation, student: relation.student };
}

/**
 * Validates that the authenticated parent has ACTIVE ParentTeachingAccess
 * for the exact Student and exact TeachingContext.
 */
export async function verifyParentTeachingAccess(studentId: string, teachingContextId: string) {
  const { session, parentProfile, relation, student } = await verifyParentStudentRelation(studentId);

  const access = await prisma.parentTeachingAccess.findUnique({
    where: {
      parentStudentRelationId_teachingContextId: {
        parentStudentRelationId: relation.id,
        teachingContextId: teachingContextId
      }
    },
    include: {
      teachingContext: {
        include: {
          subject: true,
          class: true,
          academicPeriod: true,
          teacherProfile: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!access || access.status !== "ACTIVE") {
    throw new Error("Forbidden: Akses pembelajaran kelas ini tidak aktif atau telah dicabut");
  }

  return {
    session,
    parentProfile,
    relation,
    student,
    access,
    teachingContext: access.teachingContext
  };
}

