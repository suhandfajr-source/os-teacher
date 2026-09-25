/**
 * Superadmin allowlist parser (Story 1c) — pure util, zero dependencies.
 *
 * Contract (spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md,
 * Design Notes "Parser" + elicitation F6):
 * - trim + lowercase each entry, dedupe (first occurrence order preserved);
 * - collect ALL invalid entries at once (no fail-on-first) into `invalid`
 *   (raw, pre-normalization, for the report);
 * - empty segments after trim (from ",,," or trailing commas) are list-syntax
 *   noise — silently dropped, NOT invalid;
 * - unset / empty / whitespace-only / ",,," env ⇒ { emails: [], invalid: [] }
 *   — the seeder fail-fasts on that (empty allowlist never touches the DB);
 * - quoted values (e.g. `"a@b.c"` leaking from CI YAML) fail validation —
 *   the quote characters are not valid email syntax.
 */

export interface ParsedAllowlist {
    /** Normalized (trim+lowercase), deduped, syntactically valid emails. */
    emails: string[];
    /** Raw entries that failed syntax validation (reported, then abort). */
    invalid: string[];
}

/** Pinned syntax validator — deliberately simple (contract, not RFC 5322).
 * Quote characters are rejected so CI-YAML-quoted values fail fast (F6). */
const EMAIL_PATTERN = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;

export function parseSuperadminEmails(env: string | undefined): ParsedAllowlist {
    if (env === undefined || env.trim() === "") {
        return { emails: [], invalid: [] };
    }
    const emails: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    for (const rawEntry of env.split(",")) {
        const normalized = rawEntry.trim().toLowerCase();
        if (normalized === "") {
            continue; // ",,," / trailing commas — syntax noise, not an entry
        }
        if (!EMAIL_PATTERN.test(normalized)) {
            invalid.push(rawEntry.trim());
            continue;
        }
        if (!seen.has(normalized)) {
            seen.add(normalized);
            emails.push(normalized);
        }
    }
    return { emails, invalid };
}

/** Single-Admin Lane I3 — apakah email ini terreserved untuk akun platform
 * (ada di allowlist)? Dipakai hook user.create.before Better Auth agar pintu
 * publik (server action register & API signup) menolaknya — anti-squatting. */
export function isReservedSuperadminEmail(email: string | undefined, env: string | undefined): boolean {
    if (!email) return false;
    return parseSuperadminEmails(env).emails.includes(email.trim().toLowerCase());
}
