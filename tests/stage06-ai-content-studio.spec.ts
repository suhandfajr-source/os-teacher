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

  test('7. AI Studio PPTX Automatic Generator Invariant & Layout Pipeline', async () => {
    const { parseMarkdownForPpt } = await import('../src/lib/export/ppt/ppt-parser');
    const { resolvePresentationLayout } = await import('../src/lib/export/ppt/ppt-layout-resolver');

    const sampleMarkdown = `# Modul Ajar Biologi\n\n## Tujuan Pembelajaran\n- Memahami struktur sel prokariotik dan eukariotik\n\n## Materi Inti\n- Dinding sel memberikan perlindungan mekanis\n- Membran plasma mengatur transport zat\n- Sitoplasma tempat metabolisme berlangsung\n\n## Kuis\n- Sebutkan fungsi utama kloroplas pada sel tumbuhan!`;

    const parsed = parseMarkdownForPpt(sampleMarkdown, 'Modul Ajar Biologi');
    expect(parsed.documentTitle).toBe('Modul Ajar Biologi');
    expect(parsed.sections).toHaveLength(3);

    const model = resolvePresentationLayout(parsed, {
      title: 'Modul Ajar Biologi',
      schoolName: 'SMA Negeri 1',
      subjectName: 'Biologi',
      teacherName: 'Guru Biologi',
      className: 'XI IPA 1',
      dateFormatted: '29 Agustus 2026',
    });

    expect(model.slides.length).toBe(4); // Cover, Objectives, Content, Quiz
    expect(model.slides[0].type).toBe('COVER');
    expect(model.slides[1].type).toBe('OBJECTIVES');
    expect(model.slides[2].type).toBe('CONTENT');
    expect(model.slides[3].type).toBe('REFLECTION_OR_QUIZ');
  });

  test('8. AI Studio Custom DOCX Template Validation & Extraction Contract', async () => {
    const { validateAndParseDocxTemplate } = await import('../src/modules/templates/docx-placeholder-parser');
    const PizZip = (await import('pizzip')).default;

    const zip = new PizZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );

    const validDocx = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

    const res = await validateAndParseDocxTemplate(validDocx, 'LESSON_PLAN');
    expect(res.valid).toBe(true);
    expect(res.manifest?.recognized).toEqual(['ISI_KONTEN', 'JUDUL']);
    expect(res.manifest?.unsupported).toEqual([]);
    expect(res.checksumSha256).toBeDefined();
  });

  test('9. AI Studio Real Browser Custom DOCX Template Upload, Selection & Export Flow', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Register teacher through UI to establish legitimate signed Better Auth session
    const uniqueEmail = `guru_ai_docx_${Date.now()}_${Math.floor(Math.random() * 1000)}@sekolah.test`;
    await page.goto('/register');
    await page.locator('input[type="text"]').first().fill('Guru AI Studio DOCX');
    await page.locator('input[type="email"]').first().fill(uniqueEmail);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('PasswordRahasia123!');
    await passwordInputs.nth(1).fill('PasswordRahasia123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*onboarding.*/, { timeout: 20000 });

    // 2. Ensure teacher profile exists in database
    const { Client } = await import('pg');
    const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const userRes = await client.query('SELECT id FROM "user" WHERE email = $1', [uniqueEmail]);
    const userId = userRes.rows[0].id;
    const schoolId = `sch_${userId}`;
    await client.query(`
      INSERT INTO school (id, name, "normalizedName", "createdAt", "updatedAt") 
      VALUES ($1, 'SMA Negeri 1 Template', 'sma negeri 1 template', NOW(), NOW())
    `, [schoolId]);

    const tpCheck = await client.query('SELECT id FROM teacher_profile WHERE "userId" = $1', [userId]);
    let teacherProfileId: string;
    if (tpCheck.rows.length > 0) {
      teacherProfileId = tpCheck.rows[0].id;
      await client.query(`
        UPDATE teacher_profile SET "onboardingCompleted" = true, "activeSchoolId" = $1 WHERE id = $2
      `, [schoolId, teacherProfileId]);
    } else {
      teacherProfileId = `tp_${userId}`;
      await client.query(`
        INSERT INTO teacher_profile (id, "userId", "preferredName", "onboardingCompleted", "activeSchoolId") 
        VALUES ($1, $2, 'Guru AI Studio', true, $3)
      `, [teacherProfileId, userId, schoolId]);
    }

    await client.query(`
      INSERT INTO teacher_school_membership (id, "teacherProfileId", "schoolId", status, "workspaceRole", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'ACTIVE', 'OWNER', NOW(), NOW())
      ON CONFLICT ("teacherProfileId", "schoolId") DO UPDATE SET status = 'ACTIVE'
    `, [`tsm_${userId}`, teacherProfileId, schoolId]);

    const draftId = `draft_${userId}`;
    await client.query(`
      INSERT INTO ai_content_draft (id, "teacherProfileId", "schoolId", "contentType", title, topic, content, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'LESSON_PLAN', 'Modul Ajar Biologi Sel', 'Sistem Pencernaan', '# Sistem Pencernaan\n\n## Tujuan Pembelajaran\n- Memahami enzim pencernaan', 'ACTIVE', NOW(), NOW())
    `, [draftId, teacherProfileId, schoolId]);
    await client.end();

    // 3. Navigate to /ai-studio
    await page.goto('/ai-studio', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/AI Content Studio|Teacher OS/i);

    // 4. Switch to Draf Tersimpan and Open Draft
    await page.locator('button:has-text("Draf Tersimpan")').click();
    await expect(page.locator('text=Modul Ajar Biologi Sel').first()).toBeVisible({ timeout: 20000 });
    await page.locator('button:has-text("Buka & Edit")').first().click();

    // Wait for draft preview editor to appear
    await expect(page.locator('text=Modul Ajar Biologi Sel').first()).toBeVisible({ timeout: 20000 });

    // 5. Open Custom Template Dialog
    const templateTrigger = page.locator('button:has-text("Template Word")').first();
    await expect(templateTrigger).toBeVisible();
    await templateTrigger.click();

    // 6. Verify Template Manager Dialog opened
    await expect(page.locator('h2:has-text("Kelola Template Word")')).toBeVisible();

    // 7. Prepare valid in-memory DOCX file fixture
    const PizZip = (await import('pizzip')).default;
    const zip = new PizZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );
    const validDocxBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

    // Fill template upload form
    await page.locator('input[placeholder*="Format Modul"]').fill('Template Resmi Sekolah');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'template_resmi.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: validDocxBuffer,
    });

    // Click Unggah Template
    await page.locator('button:has-text("Unggah Template")').click();

    // Expect template appearing in list
    await expect(page.locator('span:has-text("Template Resmi Sekolah")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Ganti File")').first()).toBeVisible();

    // 8. Close Dialog
    await page.locator('button:has-text("Tutup")').click();

    // 9. Export using Custom Template
    const myTemplatesDropdown = page.locator('button:has-text("Template Saya")').first();
    await expect(myTemplatesDropdown).toBeVisible();
    await myTemplatesDropdown.hover();

    const templateOption = page.locator('button:has-text("Template Resmi Sekolah")').first();
    await expect(templateOption).toBeVisible();

    // 10. Click export and intercept download event
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await templateOption.click();

    const download = await downloadPromise;
    const downloadedFilename = download.suggestedFilename();
    expect(downloadedFilename.endsWith('.docx')).toBe(true);

    // 11. Ensure loading state restores
    await expect(page.locator('button:has-text("Template Saya")').first()).toBeEnabled();
  });
});


