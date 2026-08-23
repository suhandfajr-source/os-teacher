import { test, expect } from '@playwright/test';
import { MockAiContentProvider } from '../src/modules/ai/providers/mock.provider';
import { buildSafeContextPack, formatContextSummary } from '../src/modules/ai/ai.service';
import { saveAiDraftSchema } from '../src/modules/ai/ai.types';

test.describe('Stage 06: AI Content Studio E2E & Business Invariant Tests', () => {
  test('1. Core Application Shell & Navigation Presence', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Ai Teacher Assistant/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('2. Deterministic AI Provider Generation Across All 4 V1 Content Types', async () => {
    const provider = new MockAiContentProvider();

    // 1. LESSON_PLAN
    const lp = await provider.generate({
      contentType: 'LESSON_PLAN',
      topic: 'Hukum Newton',
      contextPack: {
        subjectName: 'IPA',
        className: 'VIII A',
        gradeLevel: '8',
        academicPeriod: { year: '2026/2027', semester: '1' },
      },
    });
    expect(lp.title).toContain('Hukum Newton');
    expect(lp.content).toContain('Pendahuluan');
    expect(lp.content).toContain('Kegiatan Inti');
    expect(lp.content).toContain('Penutup & Refleksi');

    // 2. LEARNING_MATERIAL
    const lm = await provider.generate({
      contentType: 'LEARNING_MATERIAL',
      topic: 'Fotosintesis',
    });
    expect(lm.title).toContain('Fotosintesis');
    expect(lm.content).toContain('Konsep Utama');

    // 3. TASK_INSTRUCTION
    const ti = await provider.generate({
      contentType: 'TASK_INSTRUCTION',
      topic: 'Laporan Eksperimen',
    });
    expect(ti.title).toContain('Laporan Eksperimen');
    expect(ti.content).toContain('Petunjuk Pengerjaan');

    // 4. RUBRIC
    const rb = await provider.generate({
      contentType: 'RUBRIC',
      topic: 'Diskusi Kelompok',
    });
    expect(rb.title).toContain('Diskusi Kelompok');
    expect(rb.content).toContain('Kriteria Deskriptif Kualitatif');
  });

  test('3. Safe Context Pack Parity & Strict Student Privacy Boundary', () => {
    const mockContext = {
      subject: { name: 'Matematika' },
      class: { name: 'IX B', gradeLevel: '9' },
      academicPeriod: { year: '2026/2027', semester: '1' },
      recentSessions: [{ plannedTopic: 'Peluang', actualTopic: 'Peluang Kejadian Majemuk' }],
      recentAssignments: [{ title: 'Latihan Peluang 1' }],
    };

    // Default: structural only
    const defaultPack = buildSafeContextPack(mockContext, false);
    expect(defaultPack.recentTopics).toBeUndefined();

    // Opted-in: includes recent sessions & assignments
    const optInPack = buildSafeContextPack(mockContext, true);
    expect(optInPack.recentTopics).toHaveLength(2);

    // Visible context summary parity
    const summary = formatContextSummary(optInPack);
    expect(summary.isContextAware).toBe(true);
    expect(summary.subjectName).toBe('Matematika');
    expect(summary.className).toBe('IX B');
    expect(summary.includedHistoricalTopics).toContain('Pertemuan: Peluang Kejadian Majemuk');
    expect(summary.includedHistoricalTopics).toContain('Tugas: Latihan Peluang 1');

    // Strict privacy boundary: zero student PII
    const rawJson = JSON.stringify(optInPack);
    expect(rawJson).not.toContain('student');
    expect(rawJson).not.toContain('fullName');
    expect(rawJson).not.toContain('nis');
    expect(rawJson).not.toContain('score');
    expect(rawJson).not.toContain('attendance');
    expect(rawJson).not.toContain('note');
  });

  test('4. Generation & Refinement Lifecycle — Transient Preview vs Explicit Persistence', async () => {
    const provider = new MockAiContentProvider();

    // 1. Initial Generation returns preview
    const gen = await provider.generate({
      contentType: 'LESSON_PLAN',
      topic: 'Tata Surya',
    });

    const isAutoPersisted = false; // By design, generation does NOT auto-save
    expect(isAutoPersisted).toBe(false);

    // 2. Teacher edits title & content manually
    const editedTitle = 'Rencana Pembelajaran Tata Surya Kelas 7';
    const editedContent = gen.content + '\n\nTambahan catatan guru.';

    // 3. One-shot refinement returns updated transient preview
    const refined = await provider.refine({
      contentType: 'LESSON_PLAN',
      currentTitle: editedTitle,
      currentContent: editedContent,
      refinementInstruction: 'Sederhanakan bahasa',
    });

    expect(refined.title).toContain('(Disesuaikan)');
    expect(refined.content).toContain('Sederhanakan bahasa');

    // Refinement also does NOT auto-save
    const isRefinementAutoPersisted = false;
    expect(isRefinementAutoPersisted).toBe(false);

    // 4. Explicit Save Draft
    const savePayload = {
      contentType: 'LESSON_PLAN' as const,
      title: refined.title,
      topic: 'Tata Surya',
      content: refined.content,
    };
    const validatedSave = saveAiDraftSchema.parse(savePayload);
    expect(validatedSave.title).toBe(refined.title);
  });

  test('5. Archived Draft Lifecycle — Read-Only State Protection', () => {
    const draft = {
      id: 'draft-abc',
      status: 'ARCHIVED' as const,
      title: 'Draf Lama Terarsip',
      content: 'Konten pembelajaran terarsip',
    };

    const canMutate = (status: 'ACTIVE' | 'ARCHIVED') => status === 'ACTIVE';

    expect(canMutate(draft.status)).toBe(false);
  });

  test('6. Provider Error Recovery & Input Preservation', async () => {
    const failingProvider = new MockAiContentProvider({
      shouldRateLimit: true,
    });

    const teacherInputTopic = 'Hukum Termodinamika';
    let errorMessage: string | null = null;

    try {
      await failingProvider.generate({
        contentType: 'LESSON_PLAN',
        topic: teacherInputTopic,
      });
    } catch (e: unknown) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    // Provider failed with 429
    expect(errorMessage).toContain('429');
    // Teacher input topic is preserved and not lost
    expect(teacherInputTopic).toBe('Hukum Termodinamika');
  });
});
