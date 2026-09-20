import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/auth";
import { runSuperadminSeed, SeedAbortError, SeedConfigError } from "../superadmin-seeder";
import { parseSuperadminEmails } from "../superadmin-allowlist";

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

async function createTestUser(prefix: string, extra?: { platformRole?: string; emailVerified?: boolean; emailOverride?: string }): Promise<TestUser> {
    seq += 1;
    const email = extra?.emailOverride ?? `${prefix}-${Date.now()}-${seq}@test.local`;
    const user = await prisma.user.create({
        data: {
            id: `1c-test-${Math.random().toString(36).slice(2, 12)}`,
            name: `1c Test ${prefix}`,
            email,
            emailVerified: extra?.emailVerified ?? false,
            platformRole: extra?.platformRole ?? "USER",
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
    } finally {
        await prisma.$disconnect();
    }
});

describe("Story 1c — superadmin seeder core (real DB)", () => {
    it("fail-fasts on an empty allowlist without touching the DB", async () => {
        for (const env of ["", "   ", undefined, ",,,"]) {
            const parsed = parseSuperadminEmails(env as string | undefined);
            await expect(
                runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET })
            ).rejects.toBeInstanceOf(SeedConfigError);
        }
    });

    it("aborts all-or-nothing on unknown email: zero rows change, report carries the plan", async () => {
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
        // Stored verbatim in mixed case (row written outside better-auth).
        const stored = `1C-Mixed-${Date.now()}-${seq}@Test.LOCAL`;
        const user = await createTestUser("1c-mixed", { emailOverride: stored });
        const parsed = parseSuperadminEmails(stored.toLowerCase());
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
        expect(report.plan[0].found).toBe(true);
        expect(report.plan[0].userId).toBe(user.id);
        expect(report.promoted).toBe(1);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("ADMIN");
    });

    it("is idempotent: second run promotes nothing and writes zero new audit entries (BH12)", async () => {
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
    });

    it("reports ADMIN-not-in-allowlist as drift without demoting (BH7)", async () => {
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
        const user = await createTestUser("1c-dryrun");
        const parsed = parseSuperadminEmails(user.email);
        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, dryRun: true, allowUnverified: true });
        expect(report.plan[0].willPromote).toBe(true);
        expect(report.promoted).toBe(0);
        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
        expect(await auditCountFor(user.id)).toBe(0);
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
