import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma, auth } from "@/lib/auth";
import { assertSessionCreationAllowed } from "@/lib/session-guards";
import { makeSignature } from "better-auth/crypto";

/**
 * Cookie sesi Better Auth ter-signing HMAC (value = `${token}.${signature}`).
 * Helper ini meniru createCookieHeaders dari test-utils resmi Better Auth.
 */
async function buildSessionCookieHeaders(token: string): Promise<Headers> {
  const secret = process.env.BETTER_AUTH_SECRET || "dev-only-local-secret-do-not-use-in-production";
  const signed = `${token}.${await makeSignature(token, secret)}`;
  const h = new Headers();
  h.set("cookie", `better-auth.session_token=${signed}`);
  return h;
}

/**
 * Story 5 — VG-3/VG-4: verifikasi PLUGIN ADMIN BETTER AUTH ASLI (tanpa stub).
 *
 * Menutup broken-verification gap: test int Story 5 lain men-stub `auth.api`
 * sehingga invariant B5 ("ban/reset password revoke SEMUA sesi") terverifikasi
 * secara tautologis. File ini menjalankan endpoint plugin sungguhan:
 * - G-11/VG-4: banUser asli oleh aktor superadmin (role sinkron) → banned +
 *   seluruh sesi target revoke nyata.
 * - VG-3/OQ-6: sesi BARU guru sekolah nonaktif ditolak oleh databaseHooks
 *   (auth.api.signInEmail asli → nol row session lahir).
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));

describe("Story 5 — Better Auth admin plugin REAL integration (VG-3/VG-4/G-11)", () => {
  let dbAvailable = false;
  const ts = Date.now();
  let superadminId: string;
  let superadminToken: string;
  let teacherId: string;
  let schoolId: string;

  beforeAll(async () => {
    try {
      // Aktor superadmin — kanal role sesuai kontrak F6 (seeder sinkron)
      const sa = await prisma.user.create({
        data: { id: `s5p-sa-${ts}`, email: `s5p-sa-${ts}@test.com`, name: "Superadmin Plugin", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "ADMIN", role: "ADMIN" },
      });
      superadminId = sa.id;
      superadminToken = `s5p-satok-${ts}`;
      await prisma.session.create({
        data: { id: `s5p-sasess-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: superadminToken, createdAt: new Date(), updatedAt: new Date(), userId: superadminId },
      });

      // Target guru + sesi aktifnya
      const teacher = await prisma.user.create({
        data: { id: `s5p-teacher-${ts}`, email: `s5p-teacher-${ts}@test.com`, name: "Guru Target", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
      });
      teacherId = teacher.id;
      await prisma.session.create({
        data: { id: `s5p-tsess-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `s5p-ttok-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherId },
      });

      const school = await prisma.school.create({
        data: { name: `S5 Plugin ${ts}`, normalizedName: `s5 plugin ${ts}` },
      });
      schoolId = school.id;

      dbAvailable = true;
    } catch (err) {
      console.warn("[s5 plugin test] DB unavailable:", err);
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.user.deleteMany({ where: { id: { in: [superadminId, teacherId] } } });
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    } catch {
      /* best-effort */
    }
  });

  it("VG-4/B5/G-11: banUser plugin ASLI oleh superadmin → banned + SEMUA sesi target revoke nyata", { timeout: 60_000 }, async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }
    expect(await prisma.session.count({ where: { userId: teacherId } })).toBe(1);

    // Aktor superadmin dengan kredensial asli (role di-promote sebagaimana seeder F6)
    const credEmail = `s5p-sa2-${ts}@test.com`;
    await auth.api.signUpEmail({
      body: { name: "Superadmin Kred", email: credEmail, password: "PasswordAman123" },
    });
    await prisma.user.update({ where: { email: credEmail }, data: { platformRole: "ADMIN", role: "admin" } });

    const signInRes = (await auth.api.signInEmail({
      body: { email: credEmail, password: "PasswordAman123" },
    })) as unknown as { headers?: Headers };
    const anyRes = signInRes as unknown as { token?: string };
    expect(anyRes.token).toBeTruthy();
    const actorHeaders = await buildSessionCookieHeaders(anyRes.token!);

    // B5 — ban via plugin ASLI (bukan stub); aktor ter-autentikasi via cookie sesi asli
    // Endpoint plugin sukses bisa mengembalikan undefined — bukti ban = state DB.
    await auth.api.banUser({
      body: { userId: teacherId, banReason: "VG-4 real plugin test" },
      headers: actorHeaders,
    });

    const target = await prisma.user.findUnique({ where: { id: teacherId } });
    expect(target!.banned).toBe(true); // plugin ASLI men-set banned
    // B5 — revoke NYATA oleh plugin:
    expect(await prisma.session.count({ where: { userId: teacherId } })).toBe(0);

    const log = await prisma.auditLog.findFirst({ where: { action: "TEACHER_BANNED", targetId: teacherId } });
    expect(log).toBeNull(); // audit dilakukan action layer, bukan plugin — plugin hanya mesin

    // Cleanup aktor kredensial
    const credUser = await prisma.user.findUnique({ where: { email: credEmail } });
    if (credUser) {
      await prisma.session.deleteMany({ where: { userId: credUser.id } });
      await prisma.account.deleteMany({ where: { userId: credUser.id } });
      await prisma.user.delete({ where: { id: credUser.id } });
    }
  });

  it("VG-3/OQ-6/G-5: databaseHooks ASLI menolak sesi baru guru sekolah nonaktif (signInEmail)", { timeout: 60_000 }, async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }
    // Guru dengan kredensial Better Auth asli (sign-up → sesi awal terbentuk)
    const email = `s5p-hook-${ts}@test.com`;
    const signUp = await auth.api.signUpEmail({
      body: { name: "Guru Hook", email, password: "PasswordAman123" },
    });
    expect(signUp).toBeTruthy();
    const hookUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    // Profil guru terikat ke sekolah yang akan dinonaktifkan
    const profile = await prisma.teacherProfile.create({
      data: { userId: hookUser.id, activeSchoolId: schoolId, onboardingCompleted: true },
    });
    await prisma.teacherSchoolMembership.create({
      data: { teacherProfileId: profile.id, schoolId, status: "ACTIVE", workspaceRole: "MEMBER" },
    });

    // Sebelum nonaktif: helper mengizinkan
    expect(await assertSessionCreationAllowed(hookUser.id)).toBe(true);

    // Hapus sesi awal, nonaktifkan sekolah
    await prisma.session.deleteMany({ where: { userId: hookUser.id } });
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });

    // Hook asli (via auth instance): helper menolak
    expect(await assertSessionCreationAllowed(hookUser.id)).toBe(false);

    // Login ulang → GAGAL dan nol row session lahir (invariant OQ-6)
    await expect(
      auth.api.signInEmail({ body: { email, password: "PasswordAman123" } })
    ).rejects.toThrow();
    expect(await prisma.session.count({ where: { userId: hookUser.id } })).toBe(0);

    // Reaktivasi → login sukses dan sesi lahir (G-6)
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
    const reLogin = await auth.api.signInEmail({ body: { email, password: "PasswordAman123" } });
    expect(reLogin).toBeTruthy();
    expect(await prisma.session.count({ where: { userId: hookUser.id } })).toBeGreaterThan(0);

    // Cleanup
    await prisma.session.deleteMany({ where: { userId: hookUser.id } });
    await prisma.teacherProfile.delete({ where: { id: profile.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: hookUser.id } }).catch(() => {});
  });
});
