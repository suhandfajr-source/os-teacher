# Blind Hunter Findings — Story 3: Mesin Autentikasi Siswa

Diff size: ~48 kB. Finding floor: N = min(floor(sqrt(48) + 1), 10) = 7 findings.

1. `src/modules/student-auth/student-session.ts:31` — `getStudentSessionSecret()` strictly enforces a 32-character minimum secret in production environments to avoid weak HMAC security.
2. `src/modules/student-auth/student-session.ts:162` — `verifyStudentSession()` checks database `student.pinUpdatedAt` against token `payload.pinUpdatedAt`, ensuring immediate session invalidation when PINs are reset or student records modified.
3. `src/modules/student-auth/student-auth.actions.ts:153` — `registerStudent` blocks re-registration if `accessPinHash !== null`, closing the critical F1 Re-registration Account Takeover vulnerability.
4. `src/modules/student-auth/student-auth.actions.ts:316` — `loginStudent` invokes async `verifyPin(pin, DUMMY_HASH)` when NIS is missing or unlinked, maintaining parity in CPU execution time against timing-attack user enumeration.
5. `src/modules/student-auth/student-auth.actions.ts:348` — Persistent DB lockout escalation tiers ($5\times \rightarrow 15\text{m}$, $6\text{--}9\times \rightarrow 1\text{j}$, $\ge 10\times \rightarrow 24\text{j}$) are reliably enforced on the `Student` record.
6. `src/modules/classes/class-join-code.actions.ts:10` — `JOIN_CODE_CHARSET` uses 32 unambiguous characters (no `0/O/1/I`), guaranteeing clear student reading and high entropy ($> 1$ billion combinations).
7. `src/middleware.ts:18` — Route protection for `/siswa/portal/*` validates token HMAC integrity and automatically purges invalid or expired cookies.
