import { describe, it, expect } from "vitest";
import { parseSuperadminEmails } from "../superadmin-allowlist";
import { redactMetadata, REDACTED } from "../audit-metadata";

describe("parseSuperadminEmails", () => {
    it("parses a single valid email", () => {
        expect(parseSuperadminEmails("a@b.c")).toEqual({ emails: ["a@b.c"], invalid: [] });
    });

    it("parses multiple emails, trimming whitespace and lowercasing", () => {
        expect(parseSuperadminEmails("  Admin@Sekolah.ID , b@x.io ")).toEqual({
            emails: ["admin@sekolah.id", "b@x.io"],
            invalid: [],
        });
    });

    it("dedupes after normalization (first occurrence order)", () => {
        expect(parseSuperadminEmails("A@b.c,a@B.C,c@d.e,a@b.c")).toEqual({
            emails: ["a@b.c", "c@d.e"],
            invalid: [],
        });
    });

    it.each([
        ["", { emails: [], invalid: [] }],
        ["   ", { emails: [], invalid: [] }],
        [",,,", { emails: [], invalid: [] }],
        [", , ,", { emails: [], invalid: [] }],
        [undefined, { emails: [], invalid: [] }],
    ])("treats env %j as empty allowlist", (env, expected) => {
        expect(parseSuperadminEmails(env as string | undefined)).toEqual(expected);
    });

    it("collects ALL invalid entries at once (no fail-on-first), keeping raw spelling", () => {
        expect(parseSuperadminEmails("a@b.c,not-an-email,x@y@z,b@d.e")).toEqual({
            emails: ["a@b.c", "b@d.e"],
            invalid: ["not-an-email", "x@y@z"],
        });
    });

    it.each(["\"a@b.c\"", "'a@b.c'", "a b@c.d", "a@b", "@b.c", "a@.c"] as const)(
        "rejects quoted/malformed entry %j",
        (entry) => {
            const result = parseSuperadminEmails(`${entry},ok@x.io`);
            expect(result.invalid).toEqual([entry]); // raw entry verbatim (quotes visible in report)
            expect(result.emails).toEqual(["ok@x.io"]);
        }
    );

    it("an all-invalid env yields zero emails and the full invalid list", () => {
        expect(parseSuperadminEmails("nope,also nope")).toEqual({
            emails: [],
            invalid: ["nope", "also nope"],
        });
    });
});

describe("redactMetadata (BH6)", () => {
    it("redacts values under sensitive keys regardless of case or substring position", () => {
        const out = redactMetadata({
            email: "a@b.c",
            studentPin: "1234",
            accessPinHash: "scrypt:1:1:1:aa:bb",
            AUTH_TOKEN: "xyz",
            Authorization: "Bearer x",
            cookie: "session=1",
            pepperValue: "s",
            name: "Guru",
        });
        expect(out.studentPin).toBe(REDACTED);
        expect(out.accessPinHash).toBe(REDACTED);
        expect(out.AUTH_TOKEN).toBe(REDACTED);
        expect(out.Authorization).toBe(REDACTED);
        expect(out.cookie).toBe(REDACTED);
        expect(out.pepperValue).toBe(REDACTED);
        expect(out.email).toBe("a@b.c");
        expect(out.name).toBe("Guru");
    });

    it("review 1c: denylist meliputi kunci masa-depan Stories 3–5 (apiKey, credential, session, otp, bearer, jwt)", () => {
        const out = redactMetadata({
            apiKey: "sk-live-xxx",
            api_key: "sk-2",
            credentials: { user: "u", pass: "p" },
            sessionId: "abc123",
            otp: "998877",
            bearer: "t",
            jwt: "eyJhbGci...",
            privateKey: "-----BEGIN...",
            safe: "kept",
        });
        expect(out.apiKey).toBe(REDACTED);
        expect(out.api_key).toBe(REDACTED);
        expect(out.credentials).toBe(REDACTED);
        expect(out.sessionId).toBe(REDACTED);
        expect(out.otp).toBe(REDACTED);
        expect(out.bearer).toBe(REDACTED);
        expect(out.jwt).toBe(REDACTED);
        expect(out.privateKey).toBe(REDACTED);
        expect(out.safe).toBe("kept");
    });

    it("redacts nested objects and arrays, dropping non-JSON-safe values", () => {
        const fn = (): number => 1;
        const out = redactMetadata({
            actor: { name: "x", password: "hunter2", nested: { token: "t", keep: 1 } },
            items: ["a", { secret: "s", n: 2 }],
            drop: fn,
            alsoDrop: Symbol("s"),
            bigintDrop: BigInt(10),
            undef: undefined,
        });
        expect(out.actor).toEqual({ name: "x", password: REDACTED, nested: { token: REDACTED, keep: 1 } });
        expect(out.items).toEqual(["a", { secret: REDACTED, n: 2 }]);
        expect(out).not.toHaveProperty("drop");
        expect(out).not.toHaveProperty("alsoDrop");
        expect(out).not.toHaveProperty("bigintDrop");
        expect(out).not.toHaveProperty("undef");
    });

    it("truncates long strings to 256 chars", () => {
        const long = "x".repeat(500);
        const out = redactMetadata({ note: long }) as { note: string };
        expect(out.note.length).toBe(256);
    });

    it("keeps JSON-safe primitives (non-finite numbers become null) and converts Date to ISO string", () => {
        const d = new Date("2026-09-20T10:00:00Z");
        const out = redactMetadata({ n: 5, b: true, z: null, d, inf: Infinity });
        expect(out).toEqual({ n: 5, b: true, z: null, d: "2026-09-20T10:00:00.000Z", inf: null });
    });

    it("survives cycles without hanging", () => {
        const a: Record<string, unknown> = { name: "a" };
        a.self = a;
        const out = redactMetadata(a);
        expect(out).toEqual({ name: "a" });
    });

    it("drops content beyond the depth guard (subtree past depth 6 disappears)", () => {
        let deep: Record<string, unknown> = { leaf: "x" };
        for (let i = 0; i < 10; i++) deep = { child: deep };
        const out = redactMetadata({ deep });
        expect(JSON.stringify(out).includes("leaf")).toBe(false); // bounded, leaf unreachable
    });

    it("does not mutate the input", () => {
        const input = { password: "hunter2", inner: { token: "t" } };
        redactMetadata(input);
        expect(input).toEqual({ password: "hunter2", inner: { token: "t" } });
    });
});
