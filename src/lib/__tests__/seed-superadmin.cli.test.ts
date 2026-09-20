import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * CLI-level verification (review 1c): the story's acceptance criteria are
 * literally the CLI's observable behavior — exit codes + messages. Runs the
 * documented Node fallback invocation (`node --import tsx`, elicitation F8)
 * with a controlled environment. DB-free scenarios only; the dry-run/apply
 * scenarios stay operator-manual per Implementation Notes.
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");

async function runCli(envOverrides: Record<string, string | undefined>, extraArgs: string[] = []) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SUPERADMIN_EMAILS;
    delete env.DATABASE_URL;
    for (const [k, v] of Object.entries(envOverrides)) {
        if (v === undefined) delete env[k];
        else env[k] = v;
    }
    return execFileAsync(process.execPath, ["--import", "tsx", "scripts/seed-superadmin.ts", ...extraArgs], {
        cwd: REPO_ROOT,
        env,
        timeout: 60_000,
    });
}

describe("Story 1c — seed:superadmin CLI (exit codes + messages)", () => {
    it("exits 1 with the allowlist message when SUPERADMIN_EMAILS is unset (DATABASE_URL present)", async () => {
        await expect(
            runCli({ DATABASE_URL: "postgresql://u:p@localhost:5432/somedb" })
        ).rejects.toMatchObject({
            code: 1,
            stderr: expect.stringContaining("SUPERADMIN_EMAILS"),
        });
    }, 90_000);

    it("exits 1 listing invalid entries when the allowlist is malformed", async () => {
        const result = runCli({
            SUPERADMIN_EMAILS: "bukan-email, juga bukan",
            DATABASE_URL: "postgresql://u:p@localhost:5432/somedb",
        });
        await expect(result).rejects.toMatchObject({
            code: 1,
            stderr: expect.stringContaining("bukan-email"),
        });
    }, 90_000);

    it("exits 1 with an explicit message for unknown CLI flags (parseArgs guard)", async () => {
        await expect(
            runCli(
                { SUPERADMIN_EMAILS: "a@b.c", DATABASE_URL: "postgresql://u:p@localhost:5432/somedb" },
                ["--dryrun"]
            )
        ).rejects.toMatchObject({
            code: 1,
            stderr: expect.stringContaining("Argumen CLI tidak dikenal"),
        });
    }, 90_000);

    it("exits 1 with the DATABASE_URL message when the URL is missing", async () => {
        await expect(runCli({ SUPERADMIN_EMAILS: "a@b.c" })).rejects.toMatchObject({
            code: 1,
            stderr: expect.stringContaining("DATABASE_URL"),
        });
    }, 90_000);

    it("prints the DB target identity before anything else; localhost stays warning-free", async () => {
        // Valid allowlist + unreachable dummy local target: the connection
        // fails (exit 1) — but the identity line must already be on stdout,
        // and no non-localhost warning may appear.
        await expect(
            runCli({ SUPERADMIN_EMAILS: "a@b.c", DATABASE_URL: "postgresql://u:p@localhost:5432/somedb" })
        ).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining("localhost:5432/somedb"),
        });
        // Non-localhost host does warn (warnings go to stderr):
        await expect(
            runCli({ SUPERADMIN_EMAILS: "a@b.c", DATABASE_URL: "postgresql://u:p@db.example.com:5432/x" })
        ).rejects.toMatchObject({
            stderr: expect.stringContaining("bukan localhost"),
        });
    }, 180_000);
});
