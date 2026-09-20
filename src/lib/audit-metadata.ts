/**
 * AuditLog metadata redaction (Story 1c, deferred-work BH6).
 *
 * The schema comment on `AuditLog.metadata` forbids PIN/hash/secrets, but
 * nothing enforces it mechanically. Every AuditLog writer (this story's
 * seeder first, Stories 3–5 after) passes its metadata through
 * `redactMetadata()` so the invariant holds by construction:
 *
 *   output is ALWAYS safe to store in `AuditLog.metadata` —
 *   sensitive keys redacted, non-JSON-safe values dropped, strings
 *   truncated, depth/cycles guarded.
 */

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 256;
const MAX_DEPTH = 6;

/** Substring, case-insensitive — "studentPin", "AUTH_TOKEN", "accessPinHash", "apiKey",
 * "credential", "sessionId" all match. Errs towards over-redaction (safe direction). */
const SENSITIVE_KEY_PATTERN = /pin|password|secret|token|hash|pepper|authorization|cookie|key|credential|session|otp|bearer|jwt/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown, keyHint: string | undefined, depth: number, seen: WeakSet<object>): unknown {
    if (keyHint !== undefined && SENSITIVE_KEY_PATTERN.test(keyHint)) {
        return REDACTED; // any value type under a sensitive key
    }
    if (value === null) return null;
    const type = typeof value;
    if (type === "string") {
        const str = value as string;
        return str.length > MAX_STRING_LENGTH ? str.slice(0, MAX_STRING_LENGTH) : str;
    }
    if (type === "number") return Number.isFinite(value as number) ? value : null;
    if (type === "boolean") return value;
    if (type === "bigint" || type === "function" || type === "symbol" || type === "undefined") {
        return undefined; // dropped by the caller
    }
    if (value instanceof Date) {
        return value.toISOString(); // Json-safe
    }
    if (Array.isArray(value)) {
        if (depth >= MAX_DEPTH) return undefined;
        if (seen.has(value)) return undefined; // cycle guard
        seen.add(value);
        const out = value
            .map((item) => redactValue(item, undefined, depth + 1, seen))
            .filter((item) => item !== undefined);
        seen.delete(value);
        return out;
    }
    if (isPlainObject(value)) {
        if (depth >= MAX_DEPTH) return undefined;
        if (seen.has(value)) return undefined; // cycle guard
        seen.add(value);
        const out = redactRecord(value, depth + 1, seen);
        seen.delete(value);
        return out;
    }
    return undefined; // Map/Set/class instances etc. — dropped
}

function redactRecord(record: Record<string, unknown>, depth: number, seen: WeakSet<object>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        const redacted = redactValue(value, key, depth, seen);
        if (redacted !== undefined) {
            out[key] = redacted;
        }
    }
    return out;
}

export function redactMetadata(input: Record<string, unknown>): Record<string, unknown> {
    const seen = new WeakSet<object>();
    seen.add(input); // direct self/back references from the top level drop immediately
    return redactRecord(input, 0, seen);
}

export { REDACTED, SENSITIVE_KEY_PATTERN };
