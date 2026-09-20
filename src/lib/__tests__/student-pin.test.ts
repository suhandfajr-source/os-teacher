import { describe, it, expect, vi } from "vitest";
import {
    PinFormatError,
    DEV_ONLY_PIN_PEPPER,
    resolvePinPepper,
    validatePinFormat,
    hashPin,
    verifyPin,
} from "../student-pin";

const HASH_PATTERN = /^scrypt:16384:8:1:[0-9a-f]{32}:[0-9a-f]{64}$/;

describe("Student PIN primitives - validatePinFormat / hashPin contract", () => {
    it("accepts exactly 4 ASCII digits", () => {
        expect(validatePinFormat("1234")).toBe(true);
        expect(validatePinFormat("0000")).toBe(true);
        expect(validatePinFormat("9999")).toBe(true);
    });

    it.each(["123", "12", "12345", "123456", "12a4", "", " 1234", "1234 "])(
        "rejects %j with PinFormatError before hashing",
        async (pin) => {
            expect(() => validatePinFormat(pin)).toThrow(PinFormatError);
            expect(() => validatePinFormat(pin)).toThrow(/tepat 4 digit/);
            await expect(hashPin(pin)).rejects.toBeInstanceOf(PinFormatError);
        }
    );

    it.each(["١٢٣٤", "１２３４"])("rejects Unicode digit PIN %j", async (pin) => {
        expect(() => validatePinFormat(pin)).toThrow(PinFormatError);
        await expect(hashPin(pin)).rejects.toBeInstanceOf(PinFormatError);
        await expect(verifyPin(pin, "scrypt:16384:8:1:00:00")).resolves.toBe(false);
    });

    it("hashes a valid 4-digit PIN into a self-describing format (params + salt encoded)", async () => {
        const hash = await hashPin("1234");
        expect(hash).toMatch(HASH_PATTERN);
    });

    it("generates a fresh random salt per hash (two hashes of one PIN differ)", async () => {
        const [a, b] = await Promise.all([hashPin("1234"), hashPin("1234")]);
        expect(a).not.toEqual(b);
    });
});

describe("Student PIN primitives - verifyPin contract", () => {
    it("returns true for the correct PIN", async () => {
        const hash = await hashPin("1234");
        await expect(verifyPin("1234", hash)).resolves.toBe(true);
    });

    it("accepts uppercase hex in stored hash (round-trips case-insensitively)", async () => {
        const hash = await hashPin("1234");
        const [scheme, N, r, p, saltHex, hashHex] = hash.split(":");
        const upper = [scheme, N, r, p, saltHex.toUpperCase(), hashHex.toUpperCase()].join(":");
        await expect(verifyPin("1234", upper)).resolves.toBe(true);
    });

    it("golden vector pins the exact derivation (HMAC(pepper, pin) → scrypt N=16384 r=8 p=1) — a consistent construction swap must fail here", async () => {
        const GOLDEN_1234 =
            "scrypt:16384:8:1:00112233445566778899aabbccddeeff:bd3bcad64ce4588aba0f7fde7d79cc9fb82a01d77702ed600aae007b6027f51b";
        await expect(verifyPin("1234", GOLDEN_1234)).resolves.toBe(true);
        await expect(verifyPin("5678", GOLDEN_1234)).resolves.toBe(false);
    });

    it("returns false for a wrong PIN", async () => {
        const hash = await hashPin("1234");
        await expect(verifyPin("5678", hash)).resolves.toBe(false);
    });

    it.each(["56a8", "", "123", "12345"])(
        "returns false (does NOT throw) for invalid candidate format %j",
        async (pin) => {
            const hash = await hashPin("1234");
            await expect(verifyPin(pin, hash)).resolves.toBe(false);
        }
    );

    it.each([
        "not-a-hash",
        "",
        "argon2:16384:8:1:00:00",
        "scrypt:16384:8:1",
        "scrypt:x:8:1:00:00",
        "scrypt:0:8:1:00:00",
        "scrypt:16384:8:1:zz:00",
        "scrypt:16384:8:1::00",
        "scrypt:16384:8:1:00:",
        // Odd-length hex silently truncates under Buffer.from(..., "hex") —
        // rejected at parse.
        "scrypt:16384:8:1:abc:00",
        "scrypt:16384:8:1:00:abc",
        // Params must be plain decimal digits — Number() alone accepts these.
        "scrypt:0x10:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32),
        "scrypt:1e2:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32),
    ])("returns false (does NOT throw) for corrupt stored hash %j", async (bad) => {
        await expect(verifyPin("1234", bad)).resolves.toBe(false);
    });

    it("rejects memory-legal but CPU-hostile parameter products at parse (N*r*p work bound)", async () => {
        // Extreme point of the work vector (walkthrough deep-dive): passes the
        // 128*N*r memory rule (33.5 MB), passes Node's 128*r*(N+p) check, has
        // well-formed 16B salt / 32B hash — only the total-work bound rejects
        // it. Before this bound, one verifyPin call cost ≈7 CPU-hours
        // (measured linear scaling: N=2048,p=2048 → 3.5 s).
        const extreme = "scrypt:262144:1:262143:" + "ab".repeat(16) + ":" + "cd".repeat(32);
        await expect(verifyPin("1234", extreme)).resolves.toBe(false);

        // Comfortably over the 2^22 limit (32768*8*32 = 2^23) — rejected too.
        const overWork = "scrypt:32768:8:32:" + "ab".repeat(16) + ":" + "cd".repeat(32);
        await expect(verifyPin("1234", overWork)).resolves.toBe(false);

        // Sanity: the default parameters sit far below the bound — round-trips.
        const hash = await hashPin("1234");
        await expect(verifyPin("1234", hash)).resolves.toBe(true);
    });

    it("returns false (does NOT throw) for null/undefined storedHash (nullable accessPinHash)", async () => {
        await expect(verifyPin("1234", null as unknown as string)).resolves.toBe(false);
        await expect(verifyPin("1234", undefined as unknown as string)).resolves.toBe(false);
    });

    it("rejects oversized salt/hash segments at parse before any scrypt allocation (keylen is unbounded in Node)", async () => {
        // 60 KB hash segment (>> 128 B cap): Node would happily derive it
        // (verified: a 70 MB keylen completes under 64 MB maxmem).
        const oversizedHash = "scrypt:16:1:1:" + "ab".repeat(16) + ":" + "cd".repeat(30000);
        await expect(verifyPin("1234", oversizedHash)).resolves.toBe(false);
    });

    it("returns false without throw/OOM when hash params demand memory above the single memory rule", async () => {
        // 128 * 2^24 * 8 bytes ≈ 16 GiB >> 64 MB maxmem.
        const overBudget = "scrypt:16777216:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32);
        await expect(verifyPin("1234", overBudget)).resolves.toBe(false);

        // Just over the boundary (128*N*8 > 64MB ⇒ N > 65536) — also rejected.
        const barelyOver = "scrypt:65537:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32);
        await expect(verifyPin("1234", barelyOver)).resolves.toBe(false);
    });
});

describe("Student PIN primitives - PIN_PEPPER resolution (deferred-work BH9)", () => {
    // NOTE: the vi.resetModules() + dynamic-import tests below create a SECOND
    // student-pin module instance. Its PinFormatError class is distinct from the
    // statically-imported one — assert `instanceof` only within a single instance.
    const originalPepper = process.env.PIN_PEPPER;

    function restorePepper() {
        if (originalPepper === undefined) {
            delete process.env.PIN_PEPPER;
        } else {
            process.env.PIN_PEPPER = originalPepper;
        }
    }

    it("falls back to the deterministic DEV_ONLY_PIN_PEPPER constant in development/test", () => {
        try {
            delete process.env.PIN_PEPPER;
            expect(resolvePinPepper("development")).toBe(DEV_ONLY_PIN_PEPPER);
            expect(resolvePinPepper("test")).toBe(DEV_ONLY_PIN_PEPPER);
            // Deterministic, not random per process: two resolutions agree.
            expect(resolvePinPepper("test")).toBe(resolvePinPepper("development"));
        } finally {
            restorePepper();
        }
    });

    it("fails closed (throws) in production if PIN_PEPPER is unset, empty, or whitespace", () => {
        try {
            delete process.env.PIN_PEPPER;
            expect(() => resolvePinPepper("production")).toThrow(
                "Missing required PIN_PEPPER configuration in production environment."
            );

            process.env.PIN_PEPPER = "   ";
            expect(() => resolvePinPepper("production")).toThrow(
                "Missing required PIN_PEPPER configuration in production environment."
            );
        } finally {
            restorePepper();
        }
    });

    it("returns the configured PIN_PEPPER in production when present", () => {
        try {
            process.env.PIN_PEPPER = "prod-pepper-random-32-byte-secret";
            expect(resolvePinPepper("production")).toBe("prod-pepper-random-32-byte-secret");
        } finally {
            restorePepper();
        }
    });

    it("fails closed for NODE_ENV outside {production, development, test} (no silent public-constant pepper)", async () => {
        try {
            delete process.env.PIN_PEPPER;
            expect(() => resolvePinPepper("staging")).toThrow(/unsupported NODE_ENV/);
            expect(() => resolvePinPepper("produciton")).toThrow(/unsupported NODE_ENV/);

            // Even with a real pepper set, an unrecognized NODE_ENV still fails
            // closed — configuration must be explicit, not inferred.
            process.env.PIN_PEPPER = "some-real-pepper";
            expect(() => resolvePinPepper("staging")).toThrow(/unsupported NODE_ENV/);

            // NODE_ENV unset at module load also fails closed. (An explicit
            // resolvePinPepper(undefined) is indistinguishable from the process
            // NODE_ENV because of the default parameter — so prove the unset
            // case at the module boundary.)
            delete process.env.PIN_PEPPER;
            const originalNodeEnv = process.env.NODE_ENV;
            Object.assign(process.env, { NODE_ENV: undefined });
            vi.resetModules();
            await expect(import("../student-pin")).rejects.toThrow(/unsupported NODE_ENV/);
            Object.assign(process.env, { NODE_ENV: originalNodeEnv });
            vi.resetModules();
        } finally {
            restorePepper();
        }
    });

    it("fails fast at module load in production without PIN_PEPPER (boot, not first login)", async () => {
        try {
            delete process.env.PIN_PEPPER;
            vi.stubEnv("NODE_ENV", "production");
            vi.resetModules();
            await expect(import("../student-pin")).rejects.toThrow(
                "Missing required PIN_PEPPER configuration in production environment."
            );
        } finally {
            vi.unstubAllEnvs();
            restorePepper();
            vi.resetModules();
        }
    });

    it("hashes remain verifiable across process restarts in dev (fallback is stable, not per-process random)", async () => {
        try {
            delete process.env.PIN_PEPPER;
            vi.stubEnv("NODE_ENV", "development");

            vi.resetModules();
            const firstBoot = await import("../student-pin");
            const hash = await firstBoot.hashPin("1234");
            expect(hash).toMatch(HASH_PATTERN);

            // Simulate a restart: fresh module instance under the same fallback.
            vi.resetModules();
            const secondBoot = await import("../student-pin");
            await expect(secondBoot.verifyPin("1234", hash)).resolves.toBe(true);
        } finally {
            vi.unstubAllEnvs();
            restorePepper();
            vi.resetModules();
        }
    });

    it("hashes bound to one pepper value do not verify under another (pepper actually contributes)", async () => {
        const originalPepperLocal = process.env.PIN_PEPPER;
        try {
            process.env.PIN_PEPPER = "pepper-alpha";
            vi.resetModules();
            const alphaModule = await import("../student-pin");
            const hash = await alphaModule.hashPin("1234");

            process.env.PIN_PEPPER = "pepper-beta";
            vi.resetModules();
            const betaModule = await import("../student-pin");
            await expect(betaModule.verifyPin("1234", hash)).resolves.toBe(false);
        } finally {
            if (originalPepperLocal === undefined) {
                delete process.env.PIN_PEPPER;
            } else {
                process.env.PIN_PEPPER = originalPepperLocal;
            }
            vi.resetModules();
        }
    });
});
