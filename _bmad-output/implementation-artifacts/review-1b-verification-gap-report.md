# Verification Gap Review — Story 1b (PIN Primitives)

- **Date:** 2026-09-20
- **Content under review:** unified diff of Story 1b — `src/lib/student-pin.ts` (new), `src/lib/__tests__/student-pin.test.ts` (new), `.env.example`, story doc `1b-primitif-pin.md`, `deferred-work.md` (BH9 removal)
- **Prompt:** `_bmad-output/implementation-artifacts/review-1b-verification-gap-prompt.md`
- **Repo state at review:** post-change working tree (`src/lib/student-pin.ts` present, matches diff)

## Screening (Step 1)

| Part | Verdict |
|---|---|
| `.env.example` (+`PIN_PEPPER=`) | Non-behavioral — docs template; skipped |
| `_bmad-output/implementation-artifacts/deferred-work.md` (BH9 removed) | Non-behavioral — docs; skipped |
| `_bmad-output/specs/.../1b-primitif-pin.md` | Non-behavioral — docs; skipped |
| `src/lib/__tests__/student-pin.test.ts` | Verification, not behavior |
| `src/lib/student-pin.ts` | **Behavioral** — new exported functions + import-time side effect (module-load pepper resolution; throws in production without `PIN_PEPPER`) |

## Tracing (Steps 2–4)

- **Consumers:** repo-wide search (`rg "student-pin|hashPin|verifyPin|PinFormatError|PIN_PEPPER"` over `src/`, excluding `node_modules`/`.next`) shows the module's **only** importer is its own test file. No route, action, or service consumes it — matches the story's "Story 1b tidak diimpor app mana pun" claim. No in-repo consumer path can regress.
- **Normal verification path:** `npm test` → `vitest run`; `vitest.config.ts` includes `src/**/*.test.ts`, which matches the new test file — the tests run normally, not skipped.
- **Module-load fail-fast, dev-determinism (BH9), pepper-contribution:** genuinely exercised via `vi.resetModules()` + dynamic import with `vi.stubEnv`. No broken-verification finding.
- **Missing-adoption check:** quiz plaintext-PIN sites (`quiz.actions.ts:1137` `normalizePin` comparison, `classroomPin` plaintext) share no supersession signal with this change — the story's Never block explicitly scopes them out and records them as separate amendment debt ("utang amendum"). Per methodology this is a refactor suggestion, not a verification-gap finding.
- **Ambient env:** no `PIN_PEPPER` in `.env`/`.env.local`; `vitest.config.ts` loads `dotenv/config`, but tests that need the fallback delete the variable first — no interference.

## Findings

### Regression gap: PIN-hash derivation construction (HMAC argument order + scrypt operands) is unpinned — a consistent derivation change ships fully green while invalidating every previously stored hash

- **Changed surface:** the KDF construction in `pepperPin()` — `src/lib/student-pin.ts:89-91` (`createHmac("sha256", pinPepper).update(pin)`) — feeding `scryptAsync(pepperPin(pin), salt, …)` at `src/lib/student-pin.ts:136` and `:155`. The persisted hash string (`scrypt:{N}:{r}:{p}:{salt}:{hash}`) is this module's external contract.
- **Impacted consumer or site:** the future stored-hash reader — Story 3's login path and the `accessPinHash` column the spec routes exclusively through `verifyPin` (story Design Notes: "`accessPinHash` hanya via `hashPin`/`verifyPin`"). Today the only in-repo caller is `src/lib/__tests__/student-pin.test.ts` (verified by the repo-wide symbol/import search above).
- **Existing test evidence:** read all 195 lines of `student-pin.test.ts`. Every derivation-touching assertion is a roundtrip (`hashPin` → `verifyPin` through the same module code), the format regex `HASH_PATTERN` (pins N/r/p, 32-hex salt, 64-hex key — but not the derivation), the cross-restart determinism test (two instances of the *same* code), or the pepper-contribution test (different peppers still diverge under any consistent construction). None of the tests read observe the derivation against a fixed expected output; the symbol search shows no other test file anywhere in the repo references these functions.
- **Missing verification:** a golden-vector assertion — `verifyPin("1234", "<literal precomputed hash string>")` resolves `true`, where the literal is computed once from the documented construction (HMAC-SHA256(`DEV_ONLY_PIN_PEPPER`, `"1234"`) → scrypt N=16384, r=8, p=1, fixed salt, 32-byte key).
- **Demonstration:** swap the HMAC arguments to `createHmac("sha256", pin).update(pinPepper)`, or swap the scrypt password/salt operands in both `hashPin` and `verifyPin`. Every existing test still passes: roundtrips run the same swapped code on both sides, `HASH_PATTERN` matches the identical string shape, the restart-determinism test compares two instances of the same swapped code, and pepper-alpha vs pepper-beta still fails to cross-verify. Yet every hash string produced by the current build stops verifying — the exact "hashes from a previous run become unverifiable" failure mode deferred-work BH9 was filed against, at code-drift timescale instead of process-restart.
- **Consequence:** once Story 3 persists real `accessPinHash` values, any later refactor of the derivation merges green and silently bricks every existing student PIN login at verify time, with zero test signal; before that, it already invalidates dev DB hashes across branch/toolchain switches that BH9's deterministic fallback was meant to protect.
- **Disposition:** `patch` — add one golden-vector test to `src/lib/__tests__/student-pin.test.ts` with a literal hash string; it is deterministic under the pinned `DEV_ONLY_PIN_PEPPER` fallback (vitest sets `NODE_ENV=test`) and matches the repo's existing literal-assertion style (`HASH_PATTERN`).

## Other findings

- The "single memory rule" comment (`src/lib/student-pin.ts:47-49`) claims anything demanding more than 64 MB is rejected at parse, but the check at `:119` covers only `128*N*r` — keylen is taken unbounded from the stored hash segment (`parsed.hash.length` at `:155`). Verified experimentally: scrypt with in-budget params and a 32 MB keylen completes without error (~1.4 s, no throw), so a corrupt stored hash with a multi-megabyte hash segment is fully derived instead of rejected fast, and a sufficiently large segment could exhaust memory uncatchably, violating the never-throw verify contract. Only reachable via data the app's own database stores, so a hardening note (bound the hash-segment length in `parseStoredHash`), not a gap.

## Evidence log

| Check | Command / source | Result |
|---|---|---|
| Module consumers | `rg "student-pin\|hashPin\|verifyPin\|PinFormatError\|PIN_PEPPER\|DEV_ONLY_PIN_PEPPER\|resolvePinPepper"` over repo (excl. `node_modules`, `.next`, `_bmad-output`) | Only `src/lib/student-pin.ts` + its test file |
| Test runs in normal path | `vitest.config.ts` include + `package.json` `"test": "vitest run"` | `src/**/*.test.ts` matches new file |
| `getAuthSecret` mirror | `src/lib/auth.ts:52-61` | Same fail-fast/`\|\|`-fallback pattern; no divergence |
| Quiz plaintext PIN sites | `rg "classroomPin\|\.pin\b"` over `src/` | `quiz.actions.ts:1137` etc. — out of scope per story Never block |
| Ambient env interference | `grep PIN_PEPPER .env .env.local` | No match |
| Keylen behavior | node experiment: `scrypt('pw','salt', 32MB, {N:16384,r:8,p:1,maxmem:64MB})` | Completes, no error, ~1.4 s → parse check does not bound keylen |
