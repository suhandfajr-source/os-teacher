import { describe, it, expect } from "vitest";
import { formatSeederReport, describeDatabaseTarget } from "../superadmin-seeder";

/**
 * Unit tests for the seeder's pure formatter/output layer (review 1c — the
 * report is the story's core operator deliverable and the blast-radius signal).
 */

describe("describeDatabaseTarget", () => {
    it("extracts host, PORT and dbname from a standard postgres URL", () => {
        expect(describeDatabaseTarget("postgresql://u:p@localhost:5432/klassa_dev")).toEqual({
            host: "localhost:5432",
            database: "klassa_dev",
        });
    });

    it("distinguishes ports — wrong-DB signal survives multi-instance local Postgres", () => {
        expect(describeDatabaseTarget("postgresql://u:p@localhost:5432/a").host).toBe("localhost:5432");
        expect(describeDatabaseTarget("postgresql://u:p@localhost:5433/a").host).toBe("localhost:5433");
    });

    it("reports (default) when the URL has no path", () => {
        expect(describeDatabaseTarget("postgresql://u:p@localhost:5432").database).toBe("(default)");
    });

    it("degrades safely on an unparseable URL", () => {
        expect(describeDatabaseTarget("not a url")).toEqual({ host: "(unparseable)", database: "(unparseable)" });
    });
});

describe("formatSeederReport", () => {
    const base = {
        target: { host: "localhost:5432", database: "klassa_dev" },
        dryRun: false,
        allowUnverified: false,
        plan: [],
        drift: [],
        unverified: [],
        unknown: [],
        ineligible: [],
        ambiguous: [],
        promoted: 0,
        auditEntries: 0,
        created: 0,
        adopted: 0,
    };

    it("always leads with the DB target identity (blast-radius)", () => {
        const out = formatSeederReport({ ...base });
        expect(out.split("\n")[0]).toContain("localhost:5432/klassa_dev");
    });

    it("marks dry-run mode explicitly", () => {
        const out = formatSeederReport({ ...base, dryRun: true });
        expect(out).toContain("DRY-RUN");
    });

    it("renders plan entries with account signals incl. TeacherProfile=ada (RT1/F3)", () => {
        const out = formatSeederReport({
            ...base,
            plan: [
                {
                    email: "a@b.c",
                    found: true,
                    name: "Guru A",
                    emailVerified: false,
                    currentPlatformRole: "USER",
                    hasTeacherProfile: true,
                    willPromote: true,
                    willCreate: false,
                },
                { email: "x@y.z", found: false, willPromote: false, willCreate: false },
            ],
        });
        expect(out).toContain("a@b.c (Guru A)");
        expect(out).toContain("TeacherProfile=ada");
        expect(out).toContain("AKAN-DIPROMOSI");
        expect(out).toContain("x@y.z");
        expect(out).toContain("TIDAK DITEMUKAN");
    });

    it("renders drift warnings (BH7) and ambiguity candidates (RT1)", () => {
        const out = formatSeederReport({
            ...base,
            drift: [
                {
                    userId: "u1",
                    email: "old@b.c",
                    name: "Lama",
                    currentPlatformRole: "ADMIN",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                },
            ],
            ambiguous: [{ email: "twin@b.c", candidates: [{ userId: "u2", email: "Twin@b.c", name: "T1" }, { userId: "u3", email: "twin@b.c", name: "T2" }] }],
        });
        expect(out).toContain("drift");
        expect(out).toContain("old@b.c");
        expect(out).toContain("AMBIGU");
        expect(out).toContain("Twin@b.c/u2");
    });

    it("renders unverified warning and bypass marker", () => {
        const entry = { email: "u@b.c", found: true, emailVerified: false, willPromote: true };
        const warn = formatSeederReport({ ...base, unverified: [entry as never] });
        expect(warn).toContain("belum verified");
        const bypass = formatSeederReport({ ...base, unverified: [entry as never], allowUnverified: true });
        expect(bypass).toContain("bypass emailVerified aktif");
    });
});
