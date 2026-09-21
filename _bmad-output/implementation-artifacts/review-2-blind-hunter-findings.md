# Blind Hunter Findings — Story 2: Gerbang Dedup Sekolah & Penguatan Alur Guru

Diff size: ~105 kB. Finding floor: N = min(floor(sqrt(105) + 1), 10) = 10 findings.

1. `src/lib/school-dedup.ts:47` — Expanded Indonesian educational prefixes (`smpn`, `sdn`, `sman`, `smkn`, `mtsn`, `min`, `man`, `slb`) and word-level aliases (`smp n`, etc.) are converted into canonical representations.
2. `src/lib/school-dedup.ts:135` — The Number-Aware Veto rule returns `0.0` similarity if both school names contain school numbers and those numbers differ, eliminating false positive duplicates between neighboring institutions like "SMPN 1" and "SMPN 2".
3. `src/lib/school-dedup.ts:182` — Dedup evaluation sequentially executes scenarios A (NPSN), B (Exact v2), C (Similarity >= 85% unless forceCreate), and D (Unique).
4. `src/modules/schools/schools.actions.ts:77` — `joinSchool` explicitly rejects re-activation of `REVOKED` memberships, closing vulnerability F1 from live code.
5. `src/modules/schools/schools.actions.ts:252` — `revokeTeacherMembership` enforces role hierarchy: `MEMBER` is strictly forbidden from revoking `OWNER`, preventing hostile takeovers.
6. `src/modules/schools/schools.actions.ts:276` — `revokeTeacherMembership` writes an immutable `AuditLog` entry detailing the action and actor.
7. `src/modules/students/students.actions.ts:10` — `SAFE_STUDENT_SELECT` is enforced on all student queries and mutations, ensuring `accessPinHash` is never exposed over the network.
8. `src/modules/students/students.actions.ts:175` — `updateStudent` sanitizes NIS to uppercase and converts whitespace-only strings to `null` to avoid unique constraint collisions on empty strings.
9. `src/app/(onboarding)/onboarding/page.tsx:109` — Step 1 validates new school creations against the dedup gate, presenting either an existing school redirect or the "Maksud Anda?" dialog.
10. `src/app/(dashboard)/pengaturan/setup/SetupManager.tsx:288` — The "Guru Sekolah" panel displays role and status badges, provides a school switcher for multi-school teachers, and disables the revoke button for self-revocation and member-on-owner revocation.
