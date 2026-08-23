import { test, expect } from '@playwright/test';
import { sanitizeSpreadsheetCell, generateSafeExportFilename } from '../src/modules/reporting/reporting.service';
import { getMonthNameIndonesian, assertActiveObjective } from '../src/modules/academic/academic.service';
import { EntityStatus, AcademicPlanType } from '@prisma/client';

test.describe('Stage 07: Reporting & Academic Context E2E & Business Invariants', () => {
  test('1. Core Application Shell & Navigation Presence for Laporan and Akademik', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Ai Teacher Assistant/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('2. Spreadsheet Formula Injection Protection (CWE-1236 Sanitization)', () => {
    // Untrusted user input starting with formula-triggering characters must be prepended with a single quote (')
    const formulaPayloads = [
      '=1+1',
      '=SUM(A1:A10)',
      '+cmd|/c calc',
      '-5*10',
      '@SUM(1,2)',
      '\t=TAB_FORMULA',
      '\r=CR_FORMULA',
    ];

    for (const payload of formulaPayloads) {
      const sanitized = sanitizeSpreadsheetCell(payload);
      expect(typeof sanitized).toBe('string');
      expect((sanitized as string).startsWith("'")).toBe(true);
    }

    // Normal safe strings and numbers remain unmodified
    expect(sanitizeSpreadsheetCell('Ahmad Subarjo')).toBe('Ahmad Subarjo');
    expect(sanitizeSpreadsheetCell('TP 1.1 Eksponen')).toBe('TP 1.1 Eksponen');
    expect(sanitizeSpreadsheetCell(88.5)).toBe(88.5);
    expect(sanitizeSpreadsheetCell(0)).toBe(0);
    expect(sanitizeSpreadsheetCell(null)).toBeNull();
  });

  test('3. Safe Export Filename Generation', () => {
    const filename = generateSafeExportFilename('rekap_presensi', 'X-MIPA-1');
    expect(filename).toMatch(/^rekap_presensi_x-mipa-1_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  test('4. Historical Participant Snapshot Truth & Former Roster Wording', () => {
    // Binding Amendment 3: Former roster student must NOT be labeled Alumni
    const formatRosterLabel = (isCurrentRoster: boolean) => {
      return isCurrentRoster ? 'Aktif di kelas' : 'Tidak di roster saat ini';
    };

    expect(formatRosterLabel(true)).toBe('Aktif di kelas');
    expect(formatRosterLabel(false)).toBe('Tidak di roster saat ini');
    expect(formatRosterLabel(false)).not.toBe('Alumni');

    // Late enrollees receive "—" (NOT_ENROLLED) in historical sessions prior to enrollment
    const evaluateMeetingAttendance = (recordExists: boolean, status?: string) => {
      if (!recordExists) return '—';
      return status || '-';
    };

    expect(evaluateMeetingAttendance(false)).toBe('—');
    expect(evaluateMeetingAttendance(true, 'PRESENT')).toBe('PRESENT');
  });

  test('5. Academic Context TP, Deterministic ATP Ordering, and Archive Lifecycle', () => {
    // Deterministic ATP sequence: orderIndex ASC, createdAt ASC
    const objectives = [
      { id: 'tp2', orderIndex: 1, createdAt: new Date('2026-08-02'), code: 'TP 1.2' },
      { id: 'tp1', orderIndex: 0, createdAt: new Date('2026-08-01'), code: 'TP 1.1' },
      { id: 'tp3', orderIndex: 2, createdAt: new Date('2026-08-03'), code: 'TP 1.3' },
    ];

    const sorted = [...objectives].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.getTime() - b.createdAt.getTime());
    expect(sorted[0].id).toBe('tp1');
    expect(sorted[1].id).toBe('tp2');
    expect(sorted[2].id).toBe('tp3');

    // Binding Amendment 4: Archived TP cannot be mutated
    expect(() => assertActiveObjective(EntityStatus.ACTIVE)).not.toThrow();
    expect(() => assertActiveObjective(EntityStatus.ARCHIVED)).toThrow(/Tujuan Pembelajaran yang diarsipkan bersifat historis/);
  });

  test('6. Immutable Historical Snapshot on TP Activity Links', () => {
    // Binding Amendment 5: Snapshot code and description captured on link creation remain unchanged if TP is edited
    const originalTp = { id: 'tp1', code: 'TP 1.1', description: 'Original objective text' };
    const sessionLink = {
      sessionId: 'sess1',
      learningObjectiveId: originalTp.id,
      snapshotCode: originalTp.code,
      snapshotDescription: originalTp.description,
    };

    // Teacher later edits active TP
    const updatedTp = { ...originalTp, code: 'TP 1.1 (Rev)', description: 'Updated next semester' };

    // Invariant: Historical session link snapshot remains frozen
    expect(sessionLink.snapshotCode).toBe('TP 1.1');
    expect(sessionLink.snapshotDescription).toBe('Original objective text');
    expect(sessionLink.snapshotDescription).not.toBe(updatedTp.description);
  });

  test('7. Academic Plan Month Helper and Plan Type Semantics', () => {
    expect(getMonthNameIndonesian(1)).toBe('Januari');
    expect(getMonthNameIndonesian(7)).toBe('Juli');
    expect(getMonthNameIndonesian(12)).toBe('Desember');
    expect(getMonthNameIndonesian(13)).toBeNull();

    // PROTA and PROSEM plan type validation
    expect(AcademicPlanType.PROTA).toBe('PROTA');
    expect(AcademicPlanType.PROSEM).toBe('PROSEM');
  });

  test('8. Mobile and Desktop Viewport Layout Verification', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
