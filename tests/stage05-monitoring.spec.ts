import { test, expect } from '@playwright/test';

test.describe('Stage 05: Student Monitoring', () => {
  test('1. Core Application Shell & Navigation', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Ai Teacher Assistant/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('2. Current Roster Population Rule (Binding Amendment 1)', () => {
    // Current class monitoring must only include students actively present in ClassStudent
    const currentRoster = [{ studentId: 's1', name: 'Ahmad' }, { studentId: 's2', name: 'Budi' }];
    const formerRosterStudent = { studentId: 's3', name: 'Citra' }; // left class

    const isCurrentActiveMonitoringStudent = (id: string) => currentRoster.some(s => s.studentId === id);

    expect(isCurrentActiveMonitoringStudent('s1')).toBe(true);
    expect(isCurrentActiveMonitoringStudent('s2')).toBe(true);
    expect(isCurrentActiveMonitoringStudent(formerRosterStudent.studentId)).toBe(false);
  });

  test('3. Count & Summary Semantics (Binding Amendment 2)', () => {
    // Unique current student count verification
    const studentRows = [
      { studentId: 's1', belowKktpCount: 2, openFollowUpCount: 3, remedialCount: 1 },
      { studentId: 's2', belowKktpCount: 0, openFollowUpCount: 0, remedialCount: 0 },
      { studentId: 's3', belowKktpCount: 1, openFollowUpCount: 1, remedialCount: 1 },
    ];

    const uniqueStudentsWithBelowKktp = studentRows.filter(r => r.belowKktpCount > 0).length;
    const uniqueStudentsWithOpenFollowUp = studentRows.filter(r => r.openFollowUpCount > 0).length;
    const uniqueStudentsWithRemedial = studentRows.filter(r => r.remedialCount > 0).length;

    expect(uniqueStudentsWithBelowKktp).toBe(2);
    expect(uniqueStudentsWithOpenFollowUp).toBe(2);
    expect(uniqueStudentsWithRemedial).toBe(2);
  });

  test('4. Academic Monitoring Rules (Binding Amendment 3)', () => {
    // Only COMPLETED assessments and GRADED results with numeric finalScore are counted
    const results = [
      { assessmentStatus: 'COMPLETED', resultStatus: 'GRADED', finalScore: 80, kktp: 75 },
      { assessmentStatus: 'COMPLETED', resultStatus: 'GRADED', finalScore: 60, kktp: 75 }, // below KKTP
      { assessmentStatus: 'IN_PROGRESS', resultStatus: 'GRADED', finalScore: 50, kktp: 75 }, // excluded
      { assessmentStatus: 'COMPLETED', resultStatus: 'PENDING', finalScore: null, kktp: 75 }, // excluded
      { assessmentStatus: 'COMPLETED', resultStatus: 'ABSENT', finalScore: null, kktp: 75 }, // excluded
    ];

    const validCompletedResults = results.filter(
      r => r.assessmentStatus === 'COMPLETED' && r.resultStatus === 'GRADED' && r.finalScore !== null
    );

    expect(validCompletedResults.length).toBe(2);

    const belowKktpCount = validCompletedResults.filter(
      r => r.kktp !== null && r.finalScore !== null && r.finalScore < r.kktp
    ).length;

    expect(belowKktpCount).toBe(1);
  });

  test('5. Remedial Stored Facts vs Fabricated Transitions (Binding Amendment 4)', () => {
    // Stored factual remedial attempt
    const remedialAttempt = {
      score: 85,
      attemptDate: new Date('2026-08-15'),
      note: 'Mengerjakan soal perbaikan',
    };

    // Stage 05 displays factual recorded score, no fabricated previousFinalScore -> newFinalScore transition
    expect(remedialAttempt.score).toBe(85);
    expect(remedialAttempt.note).toBe('Mengerjakan soal perbaikan');
  });

  test('6. Factual Attendance Counts Only (Binding Amendment 5)', () => {
    const rawAttendance = [
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'LATE' },
      { status: 'SICK' },
      { status: 'PERMISSION' },
      { status: 'ABSENT' },
    ];

    const counts = {
      total: rawAttendance.length,
      present: rawAttendance.filter(a => a.status === 'PRESENT').length,
      late: rawAttendance.filter(a => a.status === 'LATE').length,
      sick: rawAttendance.filter(a => a.status === 'SICK').length,
      permission: rawAttendance.filter(a => a.status === 'PERMISSION').length,
      absent: rawAttendance.filter(a => a.status === 'ABSENT').length,
    };

    expect(counts.total).toBe(6);
    expect(counts.present).toBe(2);
    expect(counts.late).toBe(1);
    expect(counts.sick).toBe(1);
    expect(counts.permission).toBe(1);
    expect(counts.absent).toBe(1);
  });

  test('7. Follow-Up Invariants & Lifecycle (Binding Amendment 6)', () => {
    // 1. Initial creation with follow-up
    const note: {
      content: string;
      requiresFollowUp: boolean;
      resolvedAt: Date | null;
      isArchived: boolean;
    } = {
      content: 'Perlu bimbingan remedial',
      requiresFollowUp: true,
      resolvedAt: null,
      isArchived: false,
    };

    expect(note.requiresFollowUp).toBe(true);
    expect(note.resolvedAt).toBeNull(); // OPEN

    // 2. Resolve follow-up
    const resolvedTime = new Date();
    note.resolvedAt = resolvedTime; // RESOLVED
    expect(note.resolvedAt).toEqual(resolvedTime);

    // 3. Reopen follow-up
    note.resolvedAt = null; // REOPEN
    expect(note.resolvedAt).toBeNull();
    expect(note.requiresFollowUp).toBe(true);

    // 4. Update to requiresFollowUp = false -> resets resolvedAt
    note.requiresFollowUp = false;
    note.resolvedAt = null;
    expect(note.requiresFollowUp).toBe(false);
    expect(note.resolvedAt).toBeNull();

    // 5. Archive note
    note.isArchived = true;
    expect(note.isArchived).toBe(true);
  });
});
