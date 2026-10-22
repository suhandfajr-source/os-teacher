---
title: 'Cloudflare bundle: isolate student token verification'
type: 'refactor'
created: '2026-10-22'
status: 'done'
route: 'full'
review_loop_iteration: 0
baseline_commit: '82763a3e44df3852b5086f4db105328737fc3916'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cloudflare upload is 10229.47 KiB gzip; minification alone gives 9365.97 KiB, exceeding the intended Workers Free limit of 3 MiB. The proxy imports token verification from a module that initializes auth/database dependencies. Generated middleware contains Prisma and Better Auth code also present in the main handler.

**Approach:** Extract existing pure token operations, import them directly in the proxy, and preserve session exports and authoritative server checks. Measure the reduction before considering broader optimizations. This pass removes identified duplication; it does not promise the entire application will fit Free.

## Boundaries & Constraints

**Always:**
- Work on `fix/cloudflare-bundle-size`; preserve pending Worker/self-reference rename to `klassa`.
- Preserve token format, HMAC and timing-safe comparison, expiry boundaries, secret requirements, cookie options, and public exports.
- Keep server checks for student/account/school status, PIN-reset invalidation and membership unchanged.
- Compare identical build/minification settings; raw module sizes and individually gzipped components are not additive upload estimates.
- Keep generated diagnostics ignored and secrets out of reports.

**Never:**
- Deploy, push/merge production, upgrade billing, change hosting/accounts, or mutate Neon data.
- Remove features or validation, replace Prisma, or patch generated bundles/dependency source.
- Claim runtime readiness from size/build success; the existing Promise runtime error remains a separate unresolved gate.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Failure handling |
|---|---|---|---|
| Compatibility | Existing signed token, same secret/time | Old/new import paths give identical results | Preserve exact boundary behavior |
| Invalid token | Tampering, wrong secret, expiry, lifespan over 30 days | Same rejection as baseline | No DB initialization for verification |
| Production secret | Missing or under 32 characters | Existing fail-fast behavior | No development fallback |
| Revocation | Valid token, inactive student/school or reset PIN | Server verification still rejects | Do not weaken checks |
| Free target | Rebuilt upload remains over 3 MiB | Report reduction and remaining gap | Stop before deployment |

</frozen-after-approval>

## Code Map

- `src/proxy.ts`: optimistic teacher/admin cookies plus student signature check. Preserve matcher/redirects; replace session-module import.
- `src/modules/student-auth/student-session.ts`: HMAC functions mixed with `next/headers` and `prisma` from `@/lib/auth`. Retain DB/cookie/membership functions and compatibility exports.
- `src/modules/student-auth/student-session-token.ts` (new): token constants, payload type, secret resolution, signing/verification; `node:crypto` only, no auth/DB/Next imports.
- `src/lib/auth.ts`: module-scope Prisma, pg and Better Auth initialization; no edits required.
- `src/modules/student-auth/__tests__/student-session.test.ts`: existing token/cookie/DB tests. `src/lib/__tests__/story5-session-guards.int.test.ts`: school/account revocation checks.
- `wrangler.jsonc`: optional minification setting, preserve bindings.
- `.wrangler/bundle-analysis/`: ignored baseline/minified logs and metadata. OpenNext metadata shows Prisma compiler ~4789 KiB raw in main handler; middleware standalone gzip is 2930955 bytes. Export/AI Studio chunks are additional contributors, outside this first change.
- Local Next docs consulted: package bundling, lazy loading, proxy introduction/runtime.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/student-auth/student-session-token.ts` — move token operations without semantic changes; export lifetime constant needed by cookies.
- [x] `src/modules/student-auth/student-session.ts` — import/re-export moved symbols; retain `DUMMY_HASH`, cookies, DB checks and membership logic.
- [x] `src/proxy.ts` — import pure token module directly; correct obsolete edge-runtime comment, no behavior change.
- [x] `src/modules/student-auth/__tests__/student-session-token.test.ts` (new) — test auth/Prisma/headers are not initialized, token round-trip, tampering, expiry/lifespan, secret failures and compatibility exports.
- [x] Existing session/security/guard tests — run unchanged; verify revocation and cookie behavior.
- [x] `wrangler.jsonc` — enable minification only after measurement and validation; compare equivalent variants.
- [x] `docs/reports/cloudflare-bundle-size.md` (new) — commands, before/after metrics, Free/runtime gates and remaining blockers; no secrets.

**Acceptance Criteria:**
- Given the pure proxy import, when middleware is built, then its dependency graph excludes Prisma/Better Auth/database initialization.
- Given existing callers, when session/security tests execute, then token compatibility, cookies and revocation checks remain unchanged.
- Given identical minification settings, when dry-run measures the rebuilt worker, then gzip is smaller than baseline; otherwise investigate rather than claim success.
- Given upload exceeds 3 MiB or runtime fails, when reporting results, then explicitly mark deploy blocked without switching provider/billing.

## Implementation Notes

- Extracted pure token logic into `src/modules/student-auth/student-session-token.ts`.
- Decoupled `src/proxy.ts` and `src/instrumentation.ts` from importing database modules.
- Middleware handler size dropped from 8.5 MB to 2.2 MB unminified.
- Minified upload dropped from 9,365.97 KiB gzip to 6,774.08 KiB gzip (-2,591 KiB / -27.7%).
- Free Tier threshold (3,072 KiB) cannot be reached because Prisma WASM query engine alone is 1,685 KiB gzip (> 54% of quota) plus Next.js runtime (254 KiB gzip). Full report documented in `docs/reports/cloudflare-bundle-size.md`. Deploy to Free tier remains BLOCKED as planned.

## Spec Change Log

## Review Triage Log

## Verification

- `npx vitest run src/modules/student-auth/__tests__ src/lib/__tests__/story5-session-guards.int.test.ts` — pass with mocks, no live DB mutation.
- Targeted ESLint — no new errors; separate existing failures.
- `npm run build` then `npx opennextjs-cloudflare build --skipNextBuild --noMinify` — same artifact pipeline as baseline.
- `npx wrangler deploy --dry-run --minify --outdir .wrangler/bundle-analysis/after --metafile .wrangler/bundle-analysis/after-meta.json` — no upload; compare against 9365.97 KiB minified baseline.
- Inspect middleware graph for auth/Prisma exclusion. If runtime-tested: isolated explicit port, no remote bindings, unauthenticated GETs only. Record responses; do not attribute errors to the emulator without evidence.
