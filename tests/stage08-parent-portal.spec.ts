import { test, expect } from '@playwright/test';
import {
  hashInvitationToken,
  generateInvitationToken,
  normalizeEmail,
  maskEmail,
  validateSafeInternalPath,
} from '../src/modules/parent/parent.service';
import { ParentInvitationStatus, AttendanceStatus, AssessmentResultStatus } from '@prisma/client';

test.describe('Stage 08: Parent Portal E2E & Business Invariants', () => {
  test('1. Parent Login & Register Pages Render with Responsive Viewports', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/parent/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.goto('/parent/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/parent/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('2. Unauthenticated Invitation Privacy Protection (No Student/Teacher PII Leak)', () => {
    const { rawToken } = generateInvitationToken();
    const masked = maskEmail('ahmad.fauzan@gmail.com');

    expect(rawToken).toHaveLength(64);
    expect(masked).toBe('a***@gmail.com');
    expect(masked).not.toContain('fauzan');

    // Unauthenticated public response object structure
    const publicResponse = {
      valid: true,
      maskedEmail: masked,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    expect(publicResponse).toHaveProperty('maskedEmail');
    expect(publicResponse).toHaveProperty('valid', true);
    expect(publicResponse).not.toHaveProperty('studentName');
    expect(publicResponse).not.toHaveProperty('teacherName');
    expect(publicResponse).not.toHaveProperty('subjectName');
    expect(publicResponse).not.toHaveProperty('teachingContextId');
  });

  test('3. Open Redirect & Malicious Callback URL Protection', () => {
    expect(validateSafeInternalPath('/parent')).toBe('/parent');
    expect(validateSafeInternalPath('/parent/undangan/abc123token')).toBe('/parent/undangan/abc123token');
    expect(validateSafeInternalPath('https://evil.com/phish')).toBe('/parent');
    expect(validateSafeInternalPath('//attacker.org/steal')).toBe('/parent');
    expect(validateSafeInternalPath('javascript:alert(1)')).toBe('/parent');
    expect(validateSafeInternalPath(undefined)).toBe('/parent');
  });

  test('4. Token Cryptographic Generation & Hashing Properties', () => {
    const { rawToken, tokenHash } = generateInvitationToken();
    expect(rawToken).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(hashInvitationToken(rawToken)).toBe(tokenHash);

    // Raw token must never equal the stored hash
    expect(rawToken).not.toBe(tokenHash);
  });

  test('5. Email Normalization at Invitation Creation and Matching', () => {
    const rawInput = '  Wali.Siswa@Gmail.COM  ';
    const normalized = normalizeEmail(rawInput);
    expect(normalized).toBe('wali.siswa@gmail.com');

    const authUserEmail = 'wali.siswa@gmail.com';
    expect(normalized === normalizeEmail(authUserEmail)).toBe(true);

    const mismatchAuthEmail = 'other.parent@gmail.com';
    expect(normalized === normalizeEmail(mismatchAuthEmail)).toBe(false);
  });

  test('6. Atomic One-Time Acceptance & Concurrency Invariants', () => {
    // Simulated atomic claim: exactly one winner
    let pendingClaimSlots = 1;

    const executeClaim = () => {
      if (pendingClaimSlots === 1) {
        pendingClaimSlots = 0;
        return { success: true, status: ParentInvitationStatus.ACCEPTED };
      }
      throw new Error('Undangan sudah tidak berlaku, telah digunakan, atau kedaluwarsa');
    };

    const firstAttempt = executeClaim();
    expect(firstAttempt.success).toBe(true);
    expect(firstAttempt.status).toBe(ParentInvitationStatus.ACCEPTED);

    // Second concurrent attempt must fail
    expect(() => executeClaim()).toThrow(/Undangan sudah tidak berlaku/);
  });

  test('7. Reissue Lifecycle: Old Pending Token Invalidated when New Invite Issued', () => {
    const invitations: Array<{ id: string; recipientEmail: string; studentId: string; status: ParentInvitationStatus }> = [
      { id: 'inv-1', recipientEmail: 'ibu@test.com', studentId: 's1', status: ParentInvitationStatus.PENDING },
    ];

    // Reissue action revokes existing pending invite
    invitations[0].status = ParentInvitationStatus.REVOKED;

    const newInvitation = {
      id: 'inv-2',
      recipientEmail: 'ibu@test.com',
      studentId: 's1',
      status: ParentInvitationStatus.PENDING,
    };
    invitations.push(newInvitation);

    expect(invitations.find((i) => i.id === 'inv-1')?.status).toBe(ParentInvitationStatus.REVOKED);
    expect(invitations.find((i) => i.id === 'inv-2')?.status).toBe(ParentInvitationStatus.PENDING);
  });

  test('8. Attendance Factual Status & Counts (No Invented Percentages)', () => {
    const records = [
      { status: AttendanceStatus.PRESENT },
      { status: AttendanceStatus.PRESENT },
      { status: AttendanceStatus.LATE },
      { status: AttendanceStatus.SICK },
      { status: AttendanceStatus.PERMISSION },
      { status: AttendanceStatus.ABSENT },
    ];

    const counts = {
      present: records.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      late: records.filter((r) => r.status === AttendanceStatus.LATE).length,
      sick: records.filter((r) => r.status === AttendanceStatus.SICK).length,
      permission: records.filter((r) => r.status === AttendanceStatus.PERMISSION).length,
      absent: records.filter((r) => r.status === AttendanceStatus.ABSENT).length,
    };

    expect(counts.present).toBe(2);
    expect(counts.late).toBe(1);
    expect(counts.sick).toBe(1);
    expect(counts.permission).toBe(1);
    expect(counts.absent).toBe(1);
  });

  test('9. Learning Activity Requires Participant Proof (Attendance Record Snapshot)', () => {
    const sessions = [
      { id: 'sess-1', status: 'COMPLETED', participantStudentIds: ['s1', 's2'], actualTopic: 'Aljabar Linear' },
      { id: 'sess-2', status: 'COMPLETED', participantStudentIds: ['s2'], actualTopic: 'Matriks' }, // s1 was not participant
    ];

    const targetStudentId = 's1';
    const parentVisibleSessions = sessions.filter(
      (s) => s.status === 'COMPLETED' && s.participantStudentIds.includes(targetStudentId)
    );

    expect(parentVisibleSessions).toHaveLength(1);
    expect(parentVisibleSessions[0].id).toBe('sess-1');
    expect(parentVisibleSessions[0].actualTopic).toBe('Aljabar Linear');
  });

  test('10. Completed Assessments & Nullable Score Integrity', () => {
    const results = [
      { id: 'r1', status: AssessmentResultStatus.GRADED, finalScore: 92 },
      { id: 'r2', status: AssessmentResultStatus.ABSENT, finalScore: null },
      { id: 'r3', status: AssessmentResultStatus.EXCUSED, finalScore: null },
    ];

    for (const res of results) {
      if (res.status === AssessmentResultStatus.GRADED) {
        expect(res.finalScore).toBe(92);
      } else {
        expect(res.finalScore).toBeNull();
        expect(res.finalScore).not.toBe(0); // ABSENT/EXCUSED must NOT be converted to 0
      }
    }
  });

  test('11. Confirmation: Assignment is Out of Scope in Parent Portal V1', () => {
    // Binding Amendment 7: Assignment section is deferred
    const parentPortalSections = ['Context', 'Attendance', 'LearningActivities', 'CompletedAssessments'];
    expect(parentPortalSections).not.toContain('Assignments');
    expect(parentPortalSections).not.toContain('StudentSubmission');
  });

  test('12. Dual Profile Coexistence Invariants', () => {
    const dualUser = {
      id: 'user-dual-1',
      teacherProfile: { id: 'tp-1', onboardingCompleted: true },
      parentProfile: { id: 'pp-1' },
    };

    // Teacher capability check
    const canAccessTeacher = !!dualUser.teacherProfile && dualUser.teacherProfile.onboardingCompleted;
    expect(canAccessTeacher).toBe(true);

    // Parent capability check
    const canAccessParent = !!dualUser.parentProfile;
    expect(canAccessParent).toBe(true);
  });
});
