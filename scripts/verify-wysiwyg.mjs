/**
 * Verifikasi manual (sekali jalan) untuk editor WYSIWYG markdown di AI Studio.
 * Alur: register via UI → seed draf markdown via DB → buka draf → cek:
 *   1. Default view = PREVIEW setelah draf dibuka
 *   2. Mode Edit menampilkan editor WYSIWYG (.milkdown) tanpa simbol mentah
 *   3. Toolbar Bold bekerja (muncul <strong>)
 * Membersihkan data uji setelah selesai.
 *
 * Jalankan: node scripts/verify-wysiwyg.mjs
 */
import { chromium } from "@playwright/test";
import { Client } from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const BASE = "http://localhost:3001";
const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const email = `wysiwyg_verify_${stamp}@sekolah.test`;
const password = "PasswordRahasia123!";

const MARKDOWN_DRAFT = [
  "# Sistem Pencernaan Manusia",
  "",
  "## Tujuan Pembelajaran",
  "- Memahami **enzim pencernaan** dan fungsinya",
  "- Menjelaskan perjalanan makanan",
  "",
  "## Alat Pencernaan",
  "",
  "| Organ | Enzim Utama | Hasil Akhir |",
  "| --- | --- | --- |",
  "| Mulut | Amilase | Maltosa |",
  "| Lambung | Pepsin | Peptida |",
  "",
  "Bacaan pengantar tentang *sistem pencernaan*.",
].join("\n");

let db;
let userId, schoolId, teacherProfileId, membershipId, draftId;
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
};

async function main() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(30000);

  // --- 1. Register via UI ---
  await page.goto(`${BASE}/register`);
  await page.locator('input[type="text"]').first().fill("Guru Verifikasi WYSIWYG");
  await page.locator('input[type="email"]').first().fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(password);
  await pw.nth(1).fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/.*onboarding.*/, { timeout: 20000 });
  console.log("Registered:", email);

  // --- 2. Seed DB ---
  db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  const u = await db.query('SELECT id FROM "user" WHERE email = $1', [email]);
  userId = u.rows[0].id;
  schoolId = `sch_${userId}`;
  teacherProfileId = `tp_${userId}`;
  membershipId = `tsm_${userId}`;
  draftId = `draft_${userId}`;

  await db.query(
    `INSERT INTO school (id, name, "normalizedName", "createdAt", "updatedAt")
     VALUES ($1, 'SMA Verifikasi Editor', 'sma verifikasi editor', NOW(), NOW())`,
    [schoolId]
  );
  await db.query(
    `INSERT INTO teacher_profile (id, "userId", "preferredName", "onboardingCompleted", "activeSchoolId")
     VALUES ($1, $2, 'Guru Verifikasi', true, $3)`,
    [teacherProfileId, userId, schoolId]
  );
  await db.query(
    `INSERT INTO teacher_school_membership (id, "teacherProfileId", "schoolId", status, "workspaceRole", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'ACTIVE', 'OWNER', NOW(), NOW())`,
    [membershipId, teacherProfileId, schoolId]
  );
  await db.query(
    `INSERT INTO ai_content_draft (id, "teacherProfileId", "schoolId", "contentType", title, topic, content, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'LESSON_PLAN', 'Modul Verifikasi Editor WYSIWYG', 'Sistem Pencernaan', $4, 'ACTIVE', NOW(), NOW())`,
    [draftId, teacherProfileId, schoolId, MARKDOWN_DRAFT]
  );
  console.log("Seeded draft");

  // --- 3. Buka draf ---
  await page.goto(`${BASE}/ai-studio`, { waitUntil: "domcontentloaded" });
  await page.locator('button:has-text("Draf Tersimpan")').click();
  await page.locator('button:has-text("Buka & Edit")').first().click();
  await page.locator("text=Modul Verifikasi Editor WYSIWYG").first().waitFor();

  // --- Cek 1: editor WYSIWYG langsung tampil (tanpa mode pratinjau) ---
  const editor = page.locator(".milkdown .ProseMirror");
  await editor.waitFor({ state: "visible" });
  check("Editor WYSIWYG langsung tampil saat draf dibuka", true);
  const previewToggleGone = (await page.locator('button:has-text("Pratinjau Teks")').count()) === 0;
  check("Toggle 'Pratinjau Teks' sudah dihapus", previewToggleGone);

  // Tunggu konten termuat
  await page.locator(".milkdown h2", { hasText: "Tujuan Pembelajaran" }).first().waitFor();
  const editorText = await editor.innerText();
  const hasRawMarkers = /\*\*|^#+\s|\|-+\||##/.test(editorText);
  check("Tidak ada simbol markdown mentah (## / ** / |---|)", !hasRawMarkers, hasRawMarkers ? JSON.stringify(editorText.slice(0, 120)) : "");

  // Heading & tabel dirender sebagai elemen
  const h2Count = await editor.locator("h2").count();
  check("Heading ## ter-render jadi elemen <h2>", h2Count >= 2, `h2=${h2Count}`);
  const tableCount = await editor.locator("table").count();
  check("Tabel markdown ter-render jadi <table>", tableCount >= 1, `table=${tableCount}`);
  const liCount = await editor.locator("li").count();
  check("List ter-render jadi <li>", liCount >= 2, `li=${liCount}`);

  // Strong dari draft asli ter-render
  const strongCount = await editor.locator("strong").count();
  check("**teks** ter-render jadi <strong>", strongCount >= 1, `strong=${strongCount}`);

  // --- 5. Toolbar: ketik lalu bold ---
  await editor.locator("p").last().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Kata uji bold.");
  await page.waitForTimeout(300);
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowLeft");
  await page.locator('button[title*="Tebal"]').click();
  await page.waitForTimeout(600);
  const newStrong = await editor.locator("strong", { hasText: "bold" }).count();
  check("Toolbar Tebal menghasilkan <strong>", newStrong >= 1, `strong.uji=${newStrong}`);

  // Placeholder hint toolbar tampil
  const toolbarBtns = await page.locator(".md-wysiwyg-root > div:first-child button").count();
  check("Toolbar format tersedia (7 tombol)", toolbarBtns === 7, `buttons=${toolbarBtns}`);

  await page.screenshot({ path: "docs/reports/problem/wysiwyg-edit-mode-verify.png", fullPage: false });

  // --- Cek round-trip markdown: simpan lalu baca dari DB ---
  await page.locator('button:has-text("Simpan Perubahan"), button:has-text("Simpan Draf")').first().click();
  await page
    .locator("text=Draf AI berhasil disimpan")
    .first()
    .waitFor({ timeout: 20000 });
  const saved = await db.query("SELECT content FROM ai_content_draft WHERE id = $1", [draftId]);
  const savedContent = saved.rows[0]?.content || "";
  console.log("--- SAVED MARKDOWN ---\n" + savedContent + "\n----------------------");
  check(
    "Round-trip markdown: hasil simpan tetap format markdown",
    savedContent.includes("## Tujuan Pembelajaran") && savedContent.includes("**enzim pencernaan**") && /\|\s*Organ\s*\|/.test(savedContent),
    `len=${savedContent.length}`
  );
  check(
    "Round-trip markdown: hasil ketikan + format bold tersimpan",
    savedContent.includes("Kata uji") && savedContent.includes("**bold.**"),
    ""
  );

  // --- 6. Tombol 'Pratinjau Dokumen' tetap tersedia (jalur export) ---
  const previewDocBtn = await page.locator('button:has-text("Pratinjau Dokumen")').count();
  check("Tombol 'Pratinjau Dokumen' tetap tersedia", previewDocBtn >= 1, `buttons=${previewDocBtn}`);

  await browser.close();
}

async function cleanup() {
  if (!db) return;
  try {
    await db.query('DELETE FROM ai_content_draft WHERE id = $1', [draftId]);
    await db.query('DELETE FROM teacher_school_membership WHERE id = $1', [membershipId]);
    await db.query('DELETE FROM teacher_profile WHERE id = $1', [teacherProfileId]);
    await db.query('DELETE FROM school WHERE id = $1', [schoolId]);
    await db.query('DELETE FROM "user" WHERE id = $1', [userId]);
    await db.query('DELETE FROM session WHERE "userId" = $1', [userId]).catch(() => {});
    await db.query('DELETE FROM account WHERE "userId" = $1', [userId]).catch(() => {});
    console.log("Cleanup selesai");
  } catch (e) {
    console.warn("Cleanup partial:", e.message);
  } finally {
    await db.end();
  }
}

main()
  .then(cleanup)
  .catch(async (e) => {
    console.error("ERROR:", e.message);
    await cleanup();
    process.exitCode = 1;
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} check lulus`);
    if (failed.length) {
      console.log("GAGAL:", failed.map((f) => f.name).join("; "));
      process.exitCode = 1;
    }
  });
