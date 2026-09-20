import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/**
 * Student PIN primitives (Story 1b) — pure util, zero DB dependencies.
 *
 * Hash format (self-describing so parameters can be escalated without mass
 * rehashing): `scrypt:{N}:{r}:{p}:{saltHex}:{hashHex}`
 *
 * SECURITY CONTRACT (spec-student-portal-auth/stories/1b-primitif-pin.md):
 * - `hashPin` THROWS `PinFormatError` for invalid input (validate first).
 * - `verifyPin` RETURNS `false` for invalid input (boolean login hot-path —
 *   never throws, including corrupt/over-budget hashes).
 * - The PIN is HMAC'd with `PIN_PEPPER` before scrypt, so a DB dump alone is
 *   not enough for offline brute-force of 4-digit PINs.
 * - Async `crypto.scrypt` (promisified) — N=16384 blocks the event loop
 *   ~50ms per call with `scryptSync`; Story 3's login path must stay
 *   non-blocking.
 */

// Explicit promise wrapper (typing `promisify(scrypt)` loses the options overload).
function scryptAsync(
    password: Buffer,
    salt: Buffer,
    keylen: number,
    options: ScryptOptions
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}

/** Deterministic dev/test fallback pepper (deferred-work BH9): a per-process
 * random fallback would make hashes unverifiable across restarts. Mirrors the
 * dev fallback constant of `getAuthSecret()` in `src/lib/auth.ts`. */
export const DEV_ONLY_PIN_PEPPER = "dev-only-pin-pepper-do-not-use-in-production";

// scrypt parameters encoded into every hash string.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes

// Single memory rule: scrypt needs roughly 128*N*r bytes. Anything demanding
// more than 64 MB is rejected (at parse time in verify, and Node enforces the
// same limit inside scrypt).
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const PIN_PATTERN = /^\d{4}$/; // exactly 4 ASCII digits — Unicode digits rejected

export class PinFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PinFormatError";
    }
}

export function validatePinFormat(pin: string): true {
    if (!PIN_PATTERN.test(pin)) {
        throw new PinFormatError(
            "PIN harus tepat 4 digit angka ASCII (contoh: 1234)."
        );
    }
    return true;
}

/**
 * Resolve `PIN_PEPPER` the way `getAuthSecret()` resolves `BETTER_AUTH_SECRET`:
 * fail-fast at module load in production, deterministic-constant fallback ONLY
 * when `NODE_ENV` is development/test (vitest sets test). Any other NODE_ENV
 * value (unset, "staging", typo) fails closed — a public, committed constant
 * must never silently become the HMAC key of a real deployment.
 */
export function resolvePinPepper(nodeEnv: string | undefined = process.env.NODE_ENV): string {
    const pepper = process.env.PIN_PEPPER;
    if (nodeEnv === "production") {
        if (!pepper || pepper.trim() === "") {
            throw new Error("Missing required PIN_PEPPER configuration in production environment.");
        }
        return pepper;
    }
    if (nodeEnv === "development" || nodeEnv === "test") {
        return pepper || DEV_ONLY_PIN_PEPPER;
    }
    throw new Error(
        `PIN_PEPPER cannot be resolved: unsupported NODE_ENV value "${String(nodeEnv)}" — expected "production", "development", or "test" (fail closed).`
    );
}

const pinPepper = resolvePinPepper();

function pepperPin(pin: string): Buffer {
    return createHmac("sha256", pinPepper).update(pin, "utf8").digest();
}

interface ScryptParams {
    N: number;
    r: number;
    p: number;
    salt: Buffer;
    hash: Buffer;
}

/** Parse + validate a stored hash string. Returns null for anything malformed
 * (wrong scheme, non-numeric params, non-hex segments, empty buffers, or
 * parameters demanding more memory than the single memory rule allows). */
function parseStoredHash(storedHash: string): ScryptParams | null {
    const parts = storedHash.split(":");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
        return null;
    }
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
        return null;
    }
    if (N <= 0 || r <= 0 || p <= 0) {
        return null;
    }
    // Single memory rule — reject before touching scrypt.
    if (128 * N * r > SCRYPT_MAXMEM) {
        return null;
    }
    if (!/^(?:[0-9a-f]{2})+$/i.test(parts[4]) || !/^(?:[0-9a-f]{2})+$/i.test(parts[5])) {
        return null;
    }
    const salt = Buffer.from(parts[4], "hex");
    const hash = Buffer.from(parts[5], "hex");
    // Length caps: keylen drives scrypt allocation which Node does NOT bound
    // via maxmem (verified: a 70 MB keylen completes). Reject oversized
    // segments at parse. Generous headroom over the canonical 16B salt /
    // 32B hash so parameters can still escalate without rehashing.
    if (salt.length === 0 || salt.length > 64 || hash.length === 0 || hash.length > 128) {
        return null;
    }
    return { N, r, p, salt, hash };
}

export async function hashPin(pin: string): Promise<string> {
    validatePinFormat(pin);
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(pepperPin(pin), salt, KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAXMEM,
    });
    return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
    // Boolean contract: invalid candidate format → false, never a throw.
    if (!PIN_PATTERN.test(pin)) {
        return false;
    }
    // Null/undefined storedHash (e.g. Student.accessPinHash before claim) must
    // not crash the login hot-path — parseStoredHash would call .split on it
    // outside the try below.
    if (typeof storedHash !== "string") {
        return false;
    }
    const parsed = parseStoredHash(storedHash);
    if (parsed === null) {
        return false;
    }
    try {
        const derived = await scryptAsync(pepperPin(pin), parsed.salt, parsed.hash.length, {
            N: parsed.N,
            r: parsed.r,
            p: parsed.p,
            maxmem: SCRYPT_MAXMEM,
        });
        // timingSafeEqual throws on length mismatch — pre-check by construction
        // is guaranteed (keylen = parsed.hash.length), but guard anyway.
        if (derived.length !== parsed.hash.length) {
            return false;
        }
        return timingSafeEqual(derived, parsed.hash);
    } catch {
        // Any scrypt failure during verify (including over-budget params that
        // slipped past parse) degrades to false — no throw, no OOM crash.
        return false;
    }
}
