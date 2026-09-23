# Review Findings — Story 6 (Blind Hunter, Content Review)

**Subject:** unified diff Story 6 — Pengerasan, Rollover TA & Dokumentasi (spec-student-portal-auth)
**Tanggal review:** 2026-09-23

**Arithmetic:** 111.08 kB → N = min(floor(√111.08 + 1), 10) = min(floor(11.54), 10) = **10** → 14 findings ditemukan (≥ N ✓).

---

## Findings

- **Claimed artifacts missing from the diff entirely.** `docs/PLAYBOOK-ROLLOVER-TA.md` (task marked [x], referenced by the new MASTER_CONTEXT.md pointer) and `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` (task marked [x], cited throughout the security review as the CAP-8 proof) have no hunks in this diff — two of the three DoD items are unverifiable from the content under review.

- **`student-portal.actions.ts` fix claimed but not delivered.** The task "[x] fallback portal diberi `orderBy: { createdAt: "desc" }`" and security-review §6 both list this file as touched, yet the diff contains no change to it — elicitation finding A5 is documented as fixed but absent.

- **Contradictory test counts across the new documents.** Security review: 740/740 and "14 test real-db"; story Implementation Notes: "vitest penuh 742/742"; story task list: "16 test (A1–A5, B1–B11)" (= 16 ≠ 14). At least two of these numbers are wrong.

- **Name canonicalization violates the frozen Always.** Spec requires "trim/collapse/case-insensitive" exact match; the code does `existingStudent.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()` — no internal-whitespace collapse on either side, so "Ahmad   Sapii" vs "Ahmad Sapii" falls to PENDING instead of matching.

- **Nondeterministic period gate in `registerStudent`.** `teachingContexts` is fetched with `take: 1` and no `orderBy`; when a class carries contexts for both an old INACTIVE and the new ACTIVE period, whichever row the DB returns decides both `academicPeriodId` and `targetPeriodIsActive` — the RC-3 gate can spuriously reject valid claims or target the wrong period.

- **Orphaned JSDoc in `student-session.ts`.** The new `resolveStudentSessionMembership` was inserted between `clearStudentSessionCookie`'s doc comment ("Menghapus cookie sesi siswa (Logout)…") and the function itself — the logout comment now documents the membership resolver, and `clearStudentSessionCookie` is left undocumented.

- **No database-level enforcement of the §9.4 invariant.** "At most one ACTIVE period per school" rests solely on the application-level `updateMany` inside the transaction; without a partial unique index or row lock, two concurrent `createClassAction` transactions (READ COMMITTED) can each create/activate a period and resurrect `MULTIPLE_ACTIVE_PERIODS`.

- **Hardcoded "2024/2025" now laundered into the audit trail.** The fallback default-period path copies the constants into both the created row and the `ACADEMIC_PERIOD_SWITCHED` metadata (`year: "2024/2025", semester: "Ganjil"`) instead of the actual values — a pre-existing hardcode is now perpetuated as audit "evidence."

- **Lockout ladder copy-pasted instead of extracted.** The 5→15m / 6→1h / 10→24h escalation is duplicated from `loginStudent` into the reclaim branch (drift risk), and the `failedAttempts` increment there is a non-conditional `update`, so concurrent attempts can race the counter.

- **Reclaim branch re-hashes the PIN it just verified, including on the unverified path.** `claimPinHash = hashPin(data.pin)` is a salt-only refresh of the same value (intent undocumented given "NIS & PIN tetap"), and on the name-mismatch PENDING path it replaces the old verified PIN hash *before* teacher approval — mutating the credential of an identity that hasn't been confirmed.

- **Comment contradicts code layout on branch order.** The comment asserts "G-1 → EC-11 → KLAIM ULANG → F1", but the reclaim branch is inserted *before* the G-1/EC-11/F1 block — mutually exclusive today, misleading for future maintainers who add an overlapping condition.

- **The two new docs contradict each other on RC status.** The elicitation summary ends with "Langkah Berikutnya: review & setujui RC-1..3" (3 frozen proposals pending), while the story's Spec Change Log records a human already approved all RCs and deleted the Renegotiation Candidates section — the summary was never updated after approval.

- **Self-attested security review.** `final-security-review-story-6.md` names "Reviewer: Build agent Story 6" — the implementer graded its own work, so the DoD item "review keamanan lolos" has no independent reviewer behind the LOLOS verdict.

- **Story status contradicts its own content.** Frontmatter still says `status: 'in-review'` and `review_loop_iteration: 0` while every task is checked, RCs are human-approved, and a passing final review exists.

- **Post-rollover sessions can still carry an inactive period.** `resolveStudentSessionMembership` only *prioritizes* the ACTIVE period; its fallback returns the newest row from an INACTIVE period when the student isn't yet enrolled in the new one, so `loginStudent` still issues a session whose `academicPeriodId` is inactive — the Intent's problem (2) is mitigated, not eliminated, and no portal behavior for such sessions is specified.
