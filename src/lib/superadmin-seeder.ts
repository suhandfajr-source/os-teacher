import type { PrismaClient, Prisma } from "@prisma/client";
import { redactMetadata } from "./audit-metadata";
import type { ParsedAllowlist } from "./superadmin-allowlist";

/**
 * Superadmin seeder core (Story 1c) — testable module; the CLI in
 * `scripts/seed-superadmin.ts` is a thin env/exit-code wrapper.
 *
 * Contract highlights (spec 1c Design Notes, incl. elicitation F3/F4):
 * - ALL validation happens up front; then lookup + UPDATE + AuditLog insert
 *   run inside ONE interactive transaction with an explicit timeout —
 *   plan and apply cannot drift apart (TOCTOU), and a promotion without its
 *   audit entry is impossible.
 * - All-or-nothing: any unknown email (or an unverified one without
 *   --allow-unverified) aborts BEFORE any write; zero rows change.
 * - Idempotent: only actual state changes (USER -> ADMIN) are written and
 *   audited; a no-op re-run writes nothing.
 * - Never demotes: ADMIN users missing from the allowlist are reported as
 *   drift warnings (BH7); demotion stays a deliberate future decision.
 * - Email lookup is case-insensitive on the normalized value (BH8).
 */

const AUDIT_ACTION_PROMOTE = "SUPERADMIN_PROMOTE";
const TRANSACTION_TIMEOUT_MS = 15_000;

export class SeedAbortError extends Error {
    constructor(
        message: string,
        public readonly report: SeederReport
    ) {
        super(message);
        this.name = "SeedAbortError";
    }
}

export class SeedConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SeedConfigError";
    }
}

export interface SeedPlanEntry {
    email: string;
    found: boolean;
    userId?: string;
    name?: string;
    emailVerified?: boolean;
    currentPlatformRole?: string;
    hasTeacherProfile?: boolean;
    createdAt?: Date;
    /** found && currentPlatformRole !== "ADMIN" — would be promoted on apply. */
    willPromote: boolean;
}

export interface DriftEntry {
    userId: string;
    email: string;
    name: string;
    currentPlatformRole: string;
    createdAt: Date;
}

export interface AmbiguousEntry {
    email: string;
    candidates: { userId: string; email: string; name: string }[];
}

export interface SeederReport {
    target: { host: string; database: string };
    dryRun: boolean;
    allowUnverified: boolean;
    plan: SeedPlanEntry[];
    /** ADMIN users whose email is NOT in the allowlist (warning only, BH7). */
    drift: DriftEntry[];
    /** Plan entries that exist but are emailVerified=false (RT1 gate). */
    unverified: SeedPlanEntry[];
    /** Plan entries with no matching User row. */
    unknown: SeedPlanEntry[];
    /** Emails matching >1 case-variant User row — identity ambiguity (RT1). */
    ambiguous: AmbiguousEntry[];
    promoted: number;
    auditEntries: number;
}

interface UserRow {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    platformRole: string;
    createdAt: Date;
}

type Tx = Prisma.TransactionClient;

async function findCandidatesInsensitive(tx: Tx, email: string): Promise<UserRow[]> {
    // mode:"insensitive" over the normalized value (BH8). Postgres unique is
    // case-SENSITIVE, so case-variant twin rows can legally coexist (rows
    // written outside better-auth) — callers must abort as AMBIGUOUS when
    // more than one row matches, never promote an arbitrary twin (RT1).
    // LOWER() raw is the documented fallback if the adapter ever rejects the
    // mode (elicitation F9).
    return tx.user.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        take: 2,
        select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            platformRole: true,
            createdAt: true,
        },
    });
}

export async function runSuperadminSeed(options: {
    prisma: PrismaClient;
    allowlist: ParsedAllowlist;
    target: { host: string; database: string };
    dryRun?: boolean;
    allowUnverified?: boolean;
}): Promise<SeederReport> {
    const { prisma, allowlist, target } = options;
    const dryRun = options.dryRun ?? false;
    const allowUnverified = options.allowUnverified ?? false;

    if (allowlist.invalid.length > 0) {
        throw new SeedConfigError(
            `Allowlist berisi entri tidak valid: ${allowlist.invalid.join(", ")}`
        );
    }
    if (allowlist.emails.length === 0) {
        throw new SeedConfigError(
            "SUPERADMIN_EMAILS kosong/unset — seeder tidak berjalan (fail-fast)."
        );
    }

    return prisma.$transaction(
        async (tx) => {
            const allowlistSet = new Set(allowlist.emails);

            // --- Plan: lookup every allowlist email (same tx as apply — F4).
            const plan: SeedPlanEntry[] = [];
            const ambiguous: AmbiguousEntry[] = [];
            for (const email of allowlist.emails) {
                const candidates = await findCandidatesInsensitive(tx, email);
                if (candidates.length > 1) {
                    ambiguous.push({
                        email,
                        candidates: candidates.map((c) => ({ userId: c.id, email: c.email, name: c.name })),
                    });
                    plan.push({ email, found: false, willPromote: false });
                    continue;
                }
                const user = candidates[0] ?? null;
                const teacherProfile = user
                    ? await tx.teacherProfile.findUnique({ where: { userId: user.id }, select: { userId: true } })
                    : null;
                plan.push({
                    email,
                    found: user !== null,
                    userId: user?.id,
                    name: user?.name,
                    emailVerified: user?.emailVerified,
                    currentPlatformRole: user?.platformRole,
                    hasTeacherProfile: teacherProfile !== null,
                    createdAt: user?.createdAt,
                    willPromote: user !== null && user.platformRole !== "ADMIN",
                });
            }

            // --- Drift: ADMIN users not in the allowlist (report-only — BH7).
            const adminUsers = await tx.user.findMany({
                where: { platformRole: "ADMIN" },
                select: { id: true, email: true, name: true, platformRole: true, createdAt: true },
            });
            const drift: DriftEntry[] = adminUsers
                .filter((u) => !allowlistSet.has(u.email.trim().toLowerCase()))
                .map((u) => ({
                    userId: u.id,
                    email: u.email,
                    name: u.name,
                    currentPlatformRole: u.platformRole,
                    createdAt: u.createdAt,
                }));

            const unknown = plan.filter((p) => !p.found);
            const unverified = plan.filter((p) => p.found && p.emailVerified === false);

            const baseReport: SeederReport = {
                target,
                dryRun,
                allowUnverified,
                plan,
                drift,
                unverified,
                unknown,
                ambiguous,
                promoted: 0,
                auditEntries: 0,
            };

            // --- Gates (before ANY write; zero rows change on abort).
            if (ambiguous.length > 0) {
                throw new SeedAbortError(
                    `Email ambigu (>1 row User varian-case): ${ambiguous
                        .map((a) => `${a.email} [${a.candidates.map((c) => `${c.email}/${c.userId}`).join(" | ")}])`)
                        .join("; ")} — selesaikan duplikat manual sebelum seeding.`,
                    baseReport
                );
            }
            if (unknown.length > 0) {
                throw new SeedAbortError(
                    `Email tidak dikenal (tanpa row User): ${unknown.map((u) => u.email).join(", ")} — all-or-nothing, nol row diubah.`,
                    baseReport
                );
            }
            if (unverified.length > 0 && !allowUnverified) {
                throw new SeedAbortError(
                    `Email belum verified (anti perebutan email, RT1): ${unverified.map((u) => u.email).join(", ")} — jalankan ulang dengan --allow-unverified setelah memeriksa profil di laporan.`,
                    baseReport
                );
            }

            if (dryRun) {
                return baseReport; // no writes inside this tx
            }

            // --- Apply: promote + audit per actual state change.
            // EC-13 (Story 5): superadmin yang SUDAH ADMIN sebelum Story 5 tidak
            // akan pernah willPromote — tanpa backfill ini kolom `role` (kanal
            // plugin admin) mereka tetap "USER" selamanya dan ban/reset password
            // ditolak plugin. Update `role` idempoten untuk SEMUA allowlisted ADMIN.
            let promoted = 0;
            let auditEntries = 0;
            for (const entry of plan) {
                if (entry.userId === undefined) continue;
                const wasAlreadyAdmin = !entry.willPromote;
                await tx.user.update({
                    where: { id: entry.userId },
                    data: { platformRole: "ADMIN", role: "admin" }, // Story 5 F6+G-11: kanal plugin lowercase
                });
                if (wasAlreadyAdmin) continue; // sudah ADMIN — hanya backfill role, bukan promote baru
                promoted += 1;
                await tx.auditLog.create({
                    data: {
                        actorType: "SYSTEM",
                        action: AUDIT_ACTION_PROMOTE,
                        targetType: "USER",
                        targetId: entry.userId,
                        metadata: redactMetadata({
                            email: entry.email,
                            source: "SUPERADMIN_EMAILS",
                            allowUnverified: entry.emailVerified === false ? true : undefined,
                        }) as Prisma.InputJsonValue,
                    },
                });
                auditEntries += 1;
            }

            return { ...baseReport, promoted, auditEntries };
        },
        { timeout: TRANSACTION_TIMEOUT_MS }
    );
}

/** Human-readable report for stdout (the story's core deliverable). */
export function formatSeederReport(report: SeederReport): string {
    const lines: string[] = [];
    lines.push(`DB target : ${report.target.host}/${report.target.database}`);
    lines.push(`Mode      : ${report.dryRun ? "DRY-RUN (nol row diubah)" : "APPLY"}${report.allowUnverified ? " + allow-unverified" : ""}`);
    lines.push("");
    lines.push("Rencana (allowlist):");
    for (const p of report.plan) {
        const flags = [
            p.found ? `role=${p.currentPlatformRole}` : "TIDAK DITEMUKAN",
            p.found ? `verified=${p.emailVerified}` : null,
            p.found && p.hasTeacherProfile ? "TeacherProfile=ada" : null,
            p.willPromote ? "AKAN-DIPROMOSI" : "sudah-ADMIN",
        ].filter(Boolean);
        lines.push(`  - ${p.email}${p.name ? ` (${p.name})` : ""} [${flags.join(", ")}]`);
    }
    if (report.ambiguous.length > 0) {
        lines.push("");
        lines.push("Email AMBIGU — >1 row varian-case (selesaikan manual):");
        for (const a of report.ambiguous) {
            lines.push(`  ? ${a.email} → ${a.candidates.map((c) => `${c.email}/${c.userId}`).join(" | ")}`);
        }
    }
    if (report.drift.length > 0) {
        lines.push("");
        lines.push("PERINGATAN drift — ADMIN di luar allowlist (TIDAK didemosi otomatis, BH7):");
        for (const d of report.drift) {
            lines.push(`  ! ${d.email} (${d.name}, ${d.userId}, sejak ${d.createdAt.toISOString()})`);
        }
    }
    if (report.unverified.length > 0) {
        lines.push("");
        lines.push(
            report.allowUnverified
                ? "PERINGATAN: bypass emailVerified aktif (--allow-unverified) — tercatat di audit metadata."
                : "Email belum verified — profil di atas wajib diperiksa sebelum bypass."
        );
    }
    lines.push("");
    lines.push(`Hasil: promoted=${report.promoted}, auditEntries=${report.auditEntries}`);
    return lines.join("\n");
}

/** Parse a DATABASE_URL into a display-safe target identity (host:port + dbname). */
export function describeDatabaseTarget(databaseUrl: string): { host: string; database: string } {
    try {
        const url = new URL(databaseUrl);
        return { host: url.host, database: url.pathname.replace(/^\//, "") || "(default)" };
    } catch {
        return { host: "(unparseable)", database: "(unparseable)" };
    }
}
