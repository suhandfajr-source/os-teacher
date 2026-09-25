import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { parseArgs } from "node:util";
import { parseSuperadminEmails } from "../src/lib/superadmin-allowlist";
import {
    runSuperadminSeed,
    formatSeederReport,
    describeDatabaseTarget,
    SeedAbortError,
    SeedConfigError,
} from "../src/lib/superadmin-seeder";

/**
 * Superadmin seeder CLI (Story 1c) — thin wrapper: env + args + client init
 * + exit codes. All logic (including allowlist fail-fast) lives in the tested
 * `src/lib/superadmin-seeder.ts`.
 *
 * Run: npm run seed:superadmin [-- --dry-run] [-- --allow-unverified]
 *      [-- --adopt] [-- --create-name "Nama Lengkap"]
 * LOCAL DB ONLY — production schema moves via `prisma migrate deploy` (Never list).
 * Requires Node >= 20.12 (--env-file-if-exists).
 * Single-Admin Lane: create-when-missing butuh SUPERADMIN_INITIAL_PASSWORD (env;
 * hanya dipakai saat email allowlist belum punya row User).
 */

/** Hard-exit fallback must exceed the core's TRANSACTION_TIMEOUT_MS (15s) so a
 * legitimately slow apply (e.g. cold-start DB) is never killed mid-flight. */
const HARD_EXIT_FALLBACK_MS = 30_000;

/** I1 create-when-missing — bangun peta bootstrap; undefined bila env password
 * bootstrap tidak diset (seeder akan abort dgn pesan bila ada email unknown). */
async function buildBootstrap(
    emails: string[],
    name: string,
    initialPassword: string | undefined
): Promise<Record<string, { name: string; passwordHash: string }> | undefined> {
    if (!initialPassword) return undefined;
    const passwordHash = await hashPassword(initialPassword);
    return Object.fromEntries(emails.map((email) => [email, { name, passwordHash }]));
}

async function main(): Promise<number> {
    let flags: { "dry-run": boolean; "allow-unverified": boolean; adopt: boolean; "create-name": string };
    try {
        const { values } = parseArgs({
            options: {
                "dry-run": { type: "boolean", default: false },
                "allow-unverified": { type: "boolean", default: false },
                adopt: { type: "boolean", default: false },
                "create-name": { type: "string", default: "Super Admin" },
            },
        });
        flags = {
            "dry-run": values["dry-run"] === true,
            "allow-unverified": values["allow-unverified"] === true,
            adopt: values.adopt === true,
            "create-name": String(values["create-name"] ?? "Super Admin"),
        };
    } catch (error) {
        console.error("Argumen CLI tidak dikenal:", error instanceof Error ? error.message : error);
        console.error("Gunakan: npm run seed:superadmin [-- --dry-run] [-- --allow-unverified] [-- --adopt] [-- --create-name Nama]");
        return 1;
    }

    const allowlist = parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error(
            "DATABASE_URL tidak ter-set. Pastikan .env berisi DATABASE_URL — " +
                "npm script memuatnya via --env-file-if-exists=.env (tsx tidak memuat .env sendiri)."
        );
        return 1;
    }

    // --- DB target identity FIRST (blast-radius wrong-DB): printed before any
    // client exists and long before any write (Design Notes contract).
    const target = describeDatabaseTarget(databaseUrl);
    console.log(`DB target : ${target.host}/${target.database}`);
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(target.host)) {
        console.warn(
            `PERINGATAN: host bukan localhost (${target.host}) — kontrak story: jalur seeder hanya untuk DB lokal. Pastikan ini memang tujuan Anda.`
        );
    }

    // --- Client init mirrors src/lib/auth.ts (Pool + PrismaPg + PrismaClient).
    // Pool/PrismaClient connect lazily, so an allowlist config error below
    // still means zero DB connections ("sebelum DB disentuh").
    const pool = new Pool({ connectionString: databaseUrl, max: 5 });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter, log: ["error"] });

    try {
        const report = await runSuperadminSeed({
            prisma,
            allowlist,
            target,
            dryRun: flags["dry-run"],
            allowUnverified: flags["allow-unverified"],
            adopt: flags.adopt,
            // I1 create-when-missing: hash sekali di sini — plaintext password
            // tidak pernah meninggalkan proses CLI ini.
            bootstrap: await buildBootstrap(allowlist.emails, flags["create-name"], process.env.SUPERADMIN_INITIAL_PASSWORD),
        });
        console.log(formatSeederReport(report));
        if (flags["allow-unverified"]) {
            console.log(
                "\nPERINGATAN: --allow-unverified aktif — pastikan profil di laporan sudah diperiksa (anti perebutan email RT1). Tercatat di audit metadata."
            );
        }
        return 0;
    } catch (error) {
        if (error instanceof SeedConfigError) {
            // Single source of truth: the core's config validation (incl. the
            // invalid-entries list) — CLI only renders.
            console.error(`\nSEEDER DIBATALKAN (konfigurasi): ${error.message}`);
            if (allowlist.invalid.length > 0) {
                console.error("Entri tidak valid:");
                for (const entry of allowlist.invalid) {
                    console.error(`  - "${entry}"`);
                }
            }
            return 1;
        }
        if (error instanceof SeedAbortError) {
            console.error(`\nSEEDER DIBATALKAN: ${error.message}`);
            // Frozen matrix: the abort REPORT is a stdout deliverable.
            console.log("--- Laporan (nol row diubah) ---");
            console.log(formatSeederReport(error.report));
            return 1;
        }
        console.error("Seeder gagal (tak terduga):", error instanceof Error ? error.message : error);
        return 1;
    } finally {
        // --- Explicit shutdown (elicitation C1/F2): pool keeps the event loop
        // alive; set exitCode and let stdout drain naturally — the hard exit
        // below is only a fallback if something still holds the loop open.
        await prisma.$disconnect();
        await pool.end();
    }
}

let settled = false;
main()
    .then((code) => {
        settled = true;
        process.exitCode = code;
    })
    .catch((error) => {
        settled = true;
        console.error("Seeder gagal (tak tertangani):", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
// Fallback hard-exit ONLY if the loop is still alive past the drain window
// (hang scenario) — never report success for an unfinished run: exit 1.
setTimeout(() => process.exit(settled ? (process.exitCode ?? 1) : 1), HARD_EXIT_FALLBACK_MS).unref();
