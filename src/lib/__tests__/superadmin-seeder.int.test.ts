import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/auth";
import { runSuperadminSeed, SeedConfigError, SeedAbortError } from "../superadmin-seeder";
import { parseSuperadminEmails } from "../superadmin-allowlist";
import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * Integration tests against the real DATABASE_URL (Story 1c, BH12).
 * Pattern: dbAvailable flag from a try/catch beforeAll — mirrors
 * src/modules/imports/__tests__/import.db-concurrency.test.ts (NOT skipIf).
 * Env is inherited via vitest.config.ts (phantom dotenv loads .env) — no
 * extra plumbing here (elicitation F1).
 */

let dbAvailable = false;
const createdUserIds: string[] = [];
let seq = 0;

const TARGET = { host: "(test)", database: "(test)" };

interface TestUser {
    id: string;
    email: string;
    name: string;
}

async function createTestUser(prefix: string, extra?: { platformRole?: string; emailVerified?: boolean; emailOverride?: string; registrationOrigin?: string }): Promise<TestUser> {
    seq += 1;
    const email = extra?.emailOverride ?? `${prefix}-${Date.now()}-${seq}@test.local`;
    const user = await prisma.user.create({
        data: {
            id: `1c-test-${Math.random().toString(36).slice(2, 12)}`,
            name: `1c Test ${prefix}`,
            email,
            emailVerified: extra?.emailVerified ?? false,
            platformRole: extra?.platformRole ?? "USER",
            // Single-Admin Lane: default fixture = akun lahir-seeder; tes gate
            // I2 eksplisit membuat PUBLIC_REGISTER.
            registrationOrigin: extra?.registrationOrigin ?? "PLATFORM_SEED",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email: user.email, name: user.name };
}

async function auditCountFor(userId: string, action = "SUPERADMIN_PROMOTE"): Promise<number> {
    return prisma.auditLog.count({ where: { targetId: userId, action, actorType: "SYSTEM" } });
}

/** Fault-injection client (F4 atomicity test): passes $transaction callbacks a
 * wrapped tx whose auditLog.create throws for a specific targetId — updates
 * and audit inserts must then roll back together. Typed loosely on purpose
 * (structural proxy over Prisma internals is test-only machinery). */
/* eslint-disable @typescript-eslint/no-explicit-any */
function makeAuditFaultClient(client: PrismaClient, failTargetId: string): PrismaClient {
    const wrapTx = (tx: any): any =>
        new Proxy(tx, {
            get(target: any, prop: string | symbol): any {
                const value = target[prop];
                if (prop === "auditLog") {
                    return new Proxy(value, {
                        get(t2: any, p2: string | symbol): any {
                            const fn = t2[p2];
                            if (p2 === "create" && typeof fn === "function") {
                                return async (args: { data: { targetId?: string } }) => {
                                    if (args.data.targetId === failTargetId) {
                                        throw new Error("injected audit failure");
                                    }
                                    return fn.call(t2, args);
                                };
                            }
                            return typeof fn === "function" ? fn.bind(t2) : fn;
                        },
                    });
                }
                return typeof value === "function" ? value.bind(target) : value;
            },
        });
    return new Proxy(client, {
        get(target: any, prop: string | symbol): any {
            if (prop === "$transaction") {
                const orig = target.$transaction;
                return (fn: (tx: any) => Promise<unknown>, opts?: unknown) =>
                    orig.call(target, (tx: any) => fn(wrapTx(tx)), opts);
            }
            const value = target[prop];
            return typeof value === "function" ? value.bind(target) : value;
        },
    }) as PrismaClient;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbAvailable = true;
    } catch {
        dbAvailable = false;
    }
});

afterAll(async () => {
    if (!dbAvailable) return;
    try {
        if (createdUserIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { targetId: { in: createdUserIds } } });
            await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
        }
    } catch {
        // Ignore cleanup error (reference pattern: import.db-concurrency.test.ts)
    }
    // NOTE: no $disconnect() — the shared singleton must survive for any test
    // file that runs after this one in the same worker (reference pattern).
});

describe("Story 1c — superadmin seeder core (real DB)", () => {
    it("fail-fasts on an empty allowlist without touching the DB", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        for (const env of ["", "   ", undefined, ",,,"]) {
            const parsed = parseSuperadminEmails(env as string | undefined);
            await expect(
                runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET })
            ).rejects.toBeInstanceOf(SeedConfigError);
        }
    });

    it("aborts all-or-nothing on unknown email: zero rows change, report carries the plan", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const known = await createTestUser("1c-known");
        const unknownEmail = `1c-unknown-${Date.now()}-${seq}@test.local`;
        const parsed = parseSuperadminEmails(`${known.email},${unknownEmail}`);
        const attempt = runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
        await expect(attempt).rejects.toMatchObject({
            name: "SeedAbortError",
            report: { unknown: [{ email: unknownEmail }] },
        });
        const after = await prisma.user.findUnique({ where: { id: known.id } });
        expect(after?.platformRole).toBe("USER"); // not promoted — all-or-nothing held
        expect(await auditCountFor(known.id)).toBe(0);
    });

    it("blocks unverified email by default; --allow-unverified proceeds and marks the audit", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const user = await createTestUser("1c-unverified"); // emailVerified=false
        const parsed = parseSuperadminEmails(user.email);
        const base = { prisma, allowlist: parsed, target: TARGET } as const;

        const blocked = runSuperadminSeed(base);
        await expect(blocked).rejects.toMatchObject({
            name: "SeedAbortError",
            report: { unverified: [{ email: user.email, emailVerified: false }] },
        });
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");

        const report = await runSuperadminSeed({ ...base, allowUnverified: true });
        expect(report.promoted).toBe(1);
        expect(report.auditEntries).toBe(1);

        const audit = await prisma.auditLog.findFirst({
            where: { targetId: user.id, actorType: "SYSTEM" },
        });
        expect(audit).not.toBeNull();
        expect(audit?.metadata).toMatchObject({ email: user.email, allowUnverified: true });
        expect(JSON.stringify(audit?.metadata)).not.toMatch(/pin|password|secret|token|hash|pepper/i);
    });

    it("finds a mixed-case stored row via insensitive lookup (BH8)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        // Stored verbatim in mixed case (row written outside better-auth).
        const stored = `1C-Mixed-${Date.now()}-${seq}@Test.LOCAL`;
        const user = await createTestUser("1c-mixed", { emailOverride: stored });
        const parsed = parseSuperadminEmails(stored.toLowerCase());
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
        expect(report.plan[0].found).toBe(true);
        expect(report.plan[0].userId).toBe(user.id);
        expect(report.promoted).toBe(1);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("ADMIN");
        // Story 5 VG-2/F6: kanal plugin admin (user.role) harus sinkron
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.role).toBe("admin");
    });

    it("Story 5 EC-13: backfill role='ADMIN' untuk superadmin yang SUDAH ADMIN sebelum Story 5", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        // Superadmin lama (pra-Story 5): platformRole ADMIN, role masih default USER
        const legacy = await createTestUser("1c-legacy-sa", { platformRole: "ADMIN" });
        expect((await prisma.user.findUnique({ where: { id: legacy.id } }))?.role).toBe("USER");

        const parsed = parseSuperadminEmails(legacy.email);
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });

        // Tidak dihitung promote baru (sudah ADMIN) — tapi role di-backfill
        expect(report.promoted).toBe(0);
        const after = await prisma.user.findUnique({ where: { id: legacy.id } });
        expect(after?.platformRole).toBe("ADMIN");
        expect(after?.role).toBe("admin"); // EC-13 — kanal plugin admin tersinkron
    });

    it("is idempotent: second run promotes nothing and writes zero new audit entries (BH12)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const user = await createTestUser("1c-idem");
        const parsed = parseSuperadminEmails(user.email);
        const base = { prisma, allowlist: parsed, target: TARGET, allowUnverified: true } as const;

        const first = await runSuperadminSeed(base);
        expect(first.promoted).toBe(1);
        const auditAfterFirst = await auditCountFor(user.id);
        expect(auditAfterFirst).toBe(1);

        const second = await runSuperadminSeed(base);
        expect(second.promoted).toBe(0);
        expect(second.auditEntries).toBe(0);
        expect(await auditCountFor(user.id)).toBe(auditAfterFirst); // no new entries
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("ADMIN");
        // Story 5 VG-2/F6: kanal plugin admin (user.role) harus sinkron
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.role).toBe("admin");
    });

    it("reports ADMIN-not-in-allowlist as drift without demoting (BH7)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const admin = await createTestUser("1c-drift-admin", { platformRole: "ADMIN" });
        const other = await createTestUser("1c-drift-other"); // in allowlist, stays USER
        const parsed = parseSuperadminEmails(other.email);
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });

        expect(report.drift.find((d) => d.userId === admin.id)).toMatchObject({
            email: admin.email,
            name: admin.name,
        });
        // NOT demoted:
        expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.platformRole).toBe("ADMIN");
    });

    it("dry-run produces the plan without changing any row", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const user = await createTestUser("1c-dryrun");
        const parsed = parseSuperadminEmails(user.email);
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, dryRun: true, allowUnverified: true });
        expect(report.plan[0].willPromote).toBe(true);
        expect(report.promoted).toBe(0);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
        expect(await auditCountFor(user.id)).toBe(0);
    });
    it("surfaces hasTeacherProfile=true when the user has a TeacherProfile (F3 account signal)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const user = await createTestUser("1c-teacher");
        await prisma.teacherProfile.create({ data: { userId: user.id } });
        try {
            const parsed = parseSuperadminEmails(user.email);
            // Single-Admin Lane I2: jalur guru kini abort — sinyal akun tetap
            // terbit di laporan abort (dry-run, nol row berubah).
            let caught: unknown;
            try {
                await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, dryRun: true, allowUnverified: true });
            } catch (e) {
                caught = e;
            }
            expect(caught).toBeInstanceOf(SeedAbortError);
            expect((caught as Error).message).toMatch(/TeacherProfile/);
            expect((caught as SeedAbortError).report.plan[0].hasTeacherProfile).toBe(true);
        } finally {
            await prisma.teacherProfile.deleteMany({ where: { userId: user.id } });
        }
    });

    it("aborts as AMBIGUOUS on case-variant twin rows — never promotes an arbitrary twin (RT1)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const base = `1c-twin-${Date.now()}-${seq}`;
        const twinA = await createTestUser("1c-twin", { emailOverride: `${base}@test.local` });
        const twinB = await createTestUser("1c-twin", { emailOverride: `${base.toUpperCase()}@TEST.local` });
        try {
            const parsed = parseSuperadminEmails(`${base}@test.local`);
            const attempt = runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
            await expect(attempt).rejects.toMatchObject({
                name: "SeedAbortError",
                report: { ambiguous: [{ email: `${base}@test.local` }] },
            });
            // Neither twin was touched:
            expect((await prisma.user.findUnique({ where: { id: twinA.id } }))?.platformRole).toBe("USER");
            expect((await prisma.user.findUnique({ where: { id: twinB.id } }))?.platformRole).toBe("USER");
        } finally {
            // cleaned via createdUserIds in afterAll
        }
    });

    it("atomicity: audit failure mid-apply rolls back the earlier promotion (F4)", async () => {
        if (!dbAvailable) {
            expect(true).toBe(true);
            return;
        }
        const userA = await createTestUser("1c-atomic-a");
        const userB = await createTestUser("1c-atomic-b");
        const parsed = parseSuperadminEmails(`${userA.email},${userB.email}`);

        // Fault injection: wrap the client so tx.auditLog.create throws for B —
        // proving UPDATE(A) + audit(B) share ONE transaction.
        const faulty = makeAuditFaultClient(prisma, userB.id);
        await expect(
            runSuperadminSeed({ prisma: faulty, allowlist: parsed, target: TARGET, allowUnverified: true })
        ).rejects.toThrow(/injected audit failure/);

        expect((await prisma.user.findUnique({ where: { id: userA.id } }))?.platformRole).toBe("USER");
        expect((await prisma.user.findUnique({ where: { id: userB.id } }))?.platformRole).toBe("USER");
        expect(await auditCountFor(userA.id)).toBe(0);
        expect(await auditCountFor(userB.id)).toBe(0);
    });
});

describe("Story 1c — seeder core guards (no DB needed)", () => {
    it("rejects an allowlist containing invalid entries before any DB work", async () => {
        const parsed = parseSuperadminEmails("a@b.c,not-an-email");
        await expect(
            runSuperadminSeed({ prisma: {} as never, allowlist: parsed, target: TARGET })
        ).rejects.toBeInstanceOf(SeedConfigError);
    });
});

describe("Single-Admin Lane — I1/I2 (registrationOrigin)", () => {
    it("I2: akun PUBLIC_REGISTER di allowlist → abort sebelum tulis, nol row berubah", async () => {
        if (!dbAvailable) { expect(true).toBe(true); return; }
        const user = await createTestUser("lane-pub", { emailVerified: true, registrationOrigin: "PUBLIC_REGISTER" });
        const parsed = parseSuperadminEmails(user.email);
        await expect(
            runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true })
        ).rejects.toThrow(/PUBLIC_REGISTER/);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
        expect(await auditCountFor(user.id)).toBe(0);
    });

    it("I2 keras: akun ber-TeacherProfile ditolak bahkan dengan --adopt", async () => {
        if (!dbAvailable) { expect(true).toBe(true); return; }
        const user = await createTestUser("lane-guru", { emailVerified: true, registrationOrigin: "PLATFORM_SEED" });
        await prisma.teacherProfile.create({ data: { userId: user.id, onboardingCompleted: false } });
        const parsed = parseSuperadminEmails(user.email);
        await expect(
            runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true, adopt: true })
        ).rejects.toThrow(/TeacherProfile/);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
    });

    it("--adopt: akun publik bersih → origin pindah ke PLATFORM_SEED + audit; idempoten", async () => {
        if (!dbAvailable) { expect(true).toBe(true); return; }
        const user = await createTestUser("lane-adopt", { emailVerified: true, registrationOrigin: "PUBLIC_REGISTER" });
        const parsed = parseSuperadminEmails(user.email);
        const r1 = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true, adopt: true });
        expect(r1.adopted).toBe(1);
        expect(r1.promoted).toBe(1);
        const db1 = await prisma.user.findUnique({ where: { id: user.id }, select: { registrationOrigin: true, platformRole: true } });
        expect(db1).toMatchObject({ registrationOrigin: "PLATFORM_SEED", platformRole: "ADMIN" });
        expect(await auditCountFor(user.id, "SUPERADMIN_ADOPT_ORIGIN")).toBe(1);
        const r2 = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true, adopt: true });
        expect(r2.adopted).toBe(0);
        expect(r2.promoted).toBe(0);
    });

    it("I1 create-when-missing: seeder menciptakan akun + account credential (login-ready)", async () => {
        if (!dbAvailable) { expect(true).toBe(true); return; }
        const email = `lane-create-${Date.now()}-${++seq}@test.local`;
        const passwordHash = await hashPassword("BootstrapPass123!");
        const parsed = parseSuperadminEmails(email);
        const report = await runSuperadminSeed({
            prisma, allowlist: parsed, target: TARGET, allowUnverified: true,
            bootstrap: { [email]: { name: "Lane Seed", passwordHash } },
        });
        expect(report.created).toBe(1);
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, platformRole: true, role: true, registrationOrigin: true, emailVerified: true } });
        expect(user).toMatchObject({ platformRole: "ADMIN", role: "admin", registrationOrigin: "PLATFORM_SEED", emailVerified: true });
        const account = await prisma.account.findFirst({ where: { userId: user!.id, providerId: "credential" } });
        expect(account?.password).toBeTruthy();
        expect(await verifyPassword({ password: "BootstrapPass123!", hash: account!.password! })).toBe(true);
        expect(await verifyPassword({ password: "WrongPass456!", hash: account!.password! })).toBe(false);
        createdUserIds.push(user!.id);
    });

    it("I1 tanpa bootstrap: unknown email tetap abort (bukan create diam-diam)", async () => {
        if (!dbAvailable) { expect(true).toBe(true); return; }
        const parsed = parseSuperadminEmails(`nobody-lane-${Date.now()}@test.local`);
        await expect(
            runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true })
        ).rejects.toBeInstanceOf(SeedAbortError);
    });
});
