# Verification Gap Review — Story 5 (Panel Persetujuan Guru & Superadmin)

**Scope:** unified diff Story 5 (migrasi, schema, modul approvals/admin/notifications/student-auth/quiz/parent, auth.ts, proxy.ts, UI panel, test baru).
**Metode:** setiap bagian behavioral dari diff ditelusuri ke konsumennya, lalu test yang relevan dibaca langsung dari repo untuk memastikan apakah regresi yang realistis akan membuat asersi gagal.

---

### Parent portal read fail-closed (`getParentAuthorizedContexts`) has no test exercising the new `deactivatedAt` filter

- **Changed surface:** `src/modules/parent/parent.service.ts:495` adds `student: { school: { deactivatedAt: null } }` to the query in `getParentAuthorizedContexts` (Story 5 F7 — parent read services fail-closed for deactivated schools).
- **Impacted consumer or site:** the parent portal pages — `src/app/parent/page.tsx:26` and `getParentAuthorizedContextsAction` at `src/modules/parent/parent.actions.ts:97-102` — which feed the parent dashboard's attendance/grade reads.
- **Existing test evidence:**
  - `Regression gap`: repo-wide search for `getParentAuthorizedContexts` matches only three source files (`src/app/parent/page.tsx`, `src/modules/parent/parent.actions.ts`, `src/modules/parent/parent.service.ts`) and zero test files. The existing `src/modules/parent/__tests__/parent.service.test.ts` covers token hashing, email masking, redirect validation, and attendance math — it never calls `getParentAuthorizedContexts`. The Story 5 session-guards int test covers the *sibling* gate `verifyParentStudentRelation` (`src/lib/__tests__/story5-session-guards.int.test.ts:141-148`), not this query.
- **Missing verification:** an assertion that `getParentAuthorizedContexts` returns an empty list (or omits the school) for a parent whose student's school has `deactivatedAt` set.
- **Demonstration:** deleting the `student: { school: { deactivatedAt: null } }` line (or typoing the relation path) restores full parent read access for deactivated schools; no test I found would fail, because none of them executes this function.
- **Consequence:** after a school is deactivated, its parents keep reading attendance and assessment data through `/parent/*` — the exact F7 leak the change is meant to close — and the checked test suite stays green.
- **Disposition:** `patch` — add a real-DB case alongside the existing `verifyParentStudentRelation` deactivation test in `story5-session-guards.int.test.ts` (or a small int test in `src/modules/parent/__tests__/`) asserting empty contexts after `deactivatedAt` is set and restored after reactivation.

---

### Seeder's `role: "ADMIN"` sync write is unasserted by every seeder test

- **Changed surface:** `src/lib/superadmin-seeder.ts:238` now writes `data: { platformRole: "ADMIN", role: "ADMIN" }` (Story 5 F6 — plugin-admin channel kept in sync with the canonical role).
- **Impacted consumer or site:** the Better Auth admin plugin configured at `src/lib/auth.ts:105-111` with `adminRoles: ["ADMIN"]`, which authorizes the `auth.api.banUser` / `setUserPassword` / `revokeUserSessions` calls made by `banTeacherAction` and `resetTeacherPasswordAction` in `src/modules/admin/admin.actions.ts:126,206-209`.
- **Existing test evidence:**
  - `Regression gap`: `src/lib/__tests__/superadmin-seeder.int.test.ts` asserts only `platformRole` after promotion (lines 188, 209, 227: `expect(...?.platformRole).toBe("ADMIN")`); it contains no assertion on the `role` column anywhere (`rg "role"` over that file matches only unrelated identifiers). The format test (`superadmin-seeder.format.test.ts`) never touches the DB. The story note itself records "test seeder existing lulus tanpa perubahan asersi" — no assertion was added.
- **Missing verification:** `expect((await prisma.user.findUnique(...))?.role).toBe("ADMIN")` after a successful promotion.
- **Demonstration:** reverting line 238 to the old `data: { platformRole: "ADMIN" }` passes every seeder test. The drifted user would then fail the plugin's `adminRoles: ["ADMIN"]` check, so superadmin backstop actions (ban/reset password) would start failing generically — or, if the plugin's role semantics change, authorization decisions silently diverge from `platformRole`.
- **Consequence:** the F6 invariant "seeder writes both channels in sync" can regress undetected; superadmin recovery via seeder produces a user the admin plugin does not recognize.
- **Disposition:** `patch` — extend the promotion assertions in `superadmin-seeder.int.test.ts` (lines ~188/209) to also check `role`.

---

### `databaseHooks.session.create.before` wiring in `auth.ts` is never executed by any test

- **Changed surface:** `src/lib/auth.ts:113-120` registers the Better Auth `databaseHooks.session.create.before` hook that returns `assertSessionCreationAllowed(session?.userId)` — the OQ-6/G-5 deny at session creation for teachers/parents of deactivated schools.
- **Impacted consumer or site:** every new Better Auth session created for guru/parent logins through the `auth` instance exported from `src/lib/auth.ts` (consumed by `auth.api.getSession` in `requireSuperAdmin`, `verifyActiveSchoolMembership`, and all teacher actions).
- **Existing test evidence:**
  - `Regression gap`: the only coverage of the deny logic is at the extracted-helper level — `story-5-full-audit.int.test.ts:696-697` calls `assertSessionCreationAllowed` directly, and `story5-session-guards.int.test.ts` mocks `auth.api.getSession` entirely. A repo-wide search for `signIn`, `signUp`, or any `auth.api.*` call other than mocked `getSession` in test files (`rg "auth\.api\.|signIn|signUp" src --glob "*.test.ts"`) returns only `getSession` mocks — no test creates a real Better Auth session, so the hook body registered in `auth.ts` never runs under test.
- **Missing verification:** an execution of the real session-creation path (e.g., `auth.api.signInEmail` against the real DB) asserting no `session` row is created for a user whose active school is deactivated.
- **Demonstration:** deleting the entire `databaseHooks` block from `auth.ts` (or having the hook `return true`) leaves both helper-level tests green — they test the function, not the registration. A teacher of a deactivated school would then get a fresh session on login.
- **Consequence:** caller-path gap: the deny branch is pinned, but the caller that makes it load-bearing is not; a wiring regression ships with `npm test` fully green.
- **Disposition:** `patch` — one integration test that calls the real `auth.api.signInEmail` (or `auth.api.signInCredentials`) for a deactivated-school teacher and asserts `prisma.session.count` stays 0, mirroring the repo's real-DB int-test style.

---

### B5 "ban/reset password revokes ALL sessions" is asserted only against a hand-written stub, not the real admin plugin

- **Changed surface:** `src/modules/admin/admin.actions.ts:126` (`auth.api.banUser`) and `:206-209` (`auth.api.setUserPassword` + `auth.api.revokeUserSessions`) rely on the newly added Better Auth admin plugin (`src/lib/auth.ts:105-111`) for both permission (actor role) and session revocation.
- **Impacted consumer or site:** the superadmin console actions `banTeacherAction` / `resetTeacherPasswordAction` in `src/modules/admin/admin.actions.ts`, whose B5 invariant ("ban tanpa revoke-sesi mustahil", G-11) is the security contract of the change.
- **Existing test evidence:**
  - `Broken-verification gap`: `story-5-full-audit.int.test.ts:49-75` replaces `auth.api` with mocks that themselves implement the expected behavior — the `banUser` stub sets `banned` and does `session.deleteMany` (lines 55-61), `revokeUserSessions` does `session.deleteMany` (lines 71-73). The assertions that "revoke SEMUA sesi" hold (`sessions).toBe(0)` at lines 582, 607, 671-672) are therefore produced by the mock, not by Better Auth. No test exercises the real plugin: no playwright spec exists for this flow (search for `approve|banned|deactivat|admin` in `tests/` returns nothing, and `vitest.config.ts` excludes `tests/**`), and the story notes record that playwright could not run locally.
- **Missing verification:** an execution of the real `auth.api.banUser` / `setUserPassword` / `revokeUserSessions` (real plugin + real DB) asserting the session rows are actually gone and that a superadmin actor is permitted by the plugin's `adminRoles` check.
- **Demonstration:** if the installed better-auth version's `banUser` did not revoke sessions, or the plugin denied the actor because `role`/`adminRoles` mismatch (see the seeder finding above), every assertion in the int test would still pass — the stub does the revocation the assertions check for.
- **Consequence:** the core B5 security invariant is verified only tautologically; a real plugin-level regression (no revocation, or actor denied → generic failure of all admin actions) ships undetected.
- **Disposition:** `patch` — add one int test that drives the real `auth.api.banUser`/`setUserPassword` against the real DB (the repo's int-test harness already supports real DB + seeded users); if the plugin cannot run in the vitest harness, this is the concrete item the deferred E2E must cover.

---

### Public quiz result action in the `/q/[token]` flow does not adopt the G-4 deactivated-school fail-closed

- **Changed surface:** `src/modules/quiz/quiz.actions.ts:1002-1007` adds the deactivated-school check to `getPublishedQuizByToken` (G-4: "sekolah nonaktif → kuis publik /q/[token] fail-closed").
- **Impacted consumer or site:** `getPublicAttemptResultAction` at `src/modules/quiz/quiz.actions.ts:1262-1281` — a public, token-keyed action (no session, no membership check) that looks the quiz up by `shareToken` with its own `prisma.quiz.findUnique` and no `deactivatedAt` check; it is the result/pembahasan view called by the public quiz client `src/app/q/[token]/QuizStudentClient.tsx:35,153`.
- **Existing test evidence:**
  - `Missing-adoption gap`: the supersession signal is explicit — the same change fail-closes the sibling public path of the same `/q/[token]` flow (`getPublishedQuizByToken`), and the story checklist claims the whole "alur kuis publik `/q/[token]` (G-4)" is fail-closed. The only test of the deactivated-quiz path (`story-5-full-audit.int.test.ts:660-664`) exercises `startQuizAttemptAction` only; `getPublicAttemptResultAction` appears in no test's imports or assertions (repo search matches only the client component and the actions file).
- **Missing verification:** an assertion that `getPublicAttemptResultAction(token, studentId)` returns the generic "Quiz tidak ditemukan" failure once the quiz's school is deactivated.
- **Demonstration:** deactivate a school after a student has submitted → the attempt-start gate (`startQuizAttemptAction`) correctly refuses, but reopening the public result view still returns the full score, per-question correctness, and pembahasan — while every test in `story-5-full-audit.int.test.ts` stays green, because none of them calls this action after deactivation.
- **Consequence:** the `/q/[token]` public flow remains half-open for deactivated schools: results and answer keys stay retrievable by token after deactivation, contradicting the G-4 claim the checklist marks as done.
- **Disposition:** `patch` — route `getPublicAttemptResultAction` through `getPublishedQuizByToken` (or add the same `deactivatedAt` check) and extend the existing deactivation int test to assert the result action also fails closed.

---

### Notification feed and unread-badge actions have no test running them

- **Changed surface:** the new read side of the notification feature — `getMyNotificationsAction` / `markMyNotificationsReadAction` (`src/modules/approvals/approvals.actions.ts`, bottom section) over `listNotifications`, `countUnreadNotifications`, `markNotificationsRead` (`src/modules/notifications/notifications.service.ts`), consumed by the header `NotificationBell` (`src/components/layout/NotificationBell.tsx`).
- **Impacted consumer or site:** the dashboard header badge/feed rendered by `src/components/layout/NotificationBell.tsx:30-44,48-56`.
- **Existing test evidence:**
  - `Regression gap`: repo search for `getMyNotificationsAction|markMyNotificationsReadAction|listNotifications|markNotificationsRead` matches only the three source files — no test file. The Story 5 int test asserts notification *creation* counts (lines 418-449) but never the read/mark-read path.
- **Missing verification:** any assertion that `getMyNotificationsAction` returns only the caller's items plus a correct `unreadCount`, and that `markMyNotificationsReadAction` sets `readAt` and drives the count to 0.
- **Demonstration:** `countUnreadNotifications` dropping its `readAt: null` filter (badge never clears), or `listNotifications` losing the `where: { userId }` scope (notifications leak across users) — none of the tests would fail.
- **Consequence:** the only user-facing notification behavior — the badge and feed — can regress or leak cross-user with a fully green suite.
- **Disposition:** `patch` — extend the existing int test with one case: batch approve → `getMyNotificationsAction` for teacher B returns 1 item / unreadCount 1 → `markMyNotificationsReadAction` → unreadCount 0 and teacher A sees none.

---

## Other findings

- The story checklist marks Fase 4 items `[x]` that its own notes contradict: "Test E2E F1 …" is checked while the note records `npx playwright test` was never run and no Story 5 spec exists anywhere under `tests/` (searches for `persetujuan|approve|deactivat|banned|REJECTED` in `tests/` return nothing); likewise "npm run build … hijau penuh" is checked while the note records the build fails locally even on baseline. The F1 REJECTED behavior itself is protected by `story-5-full-audit.int.test.ts`, so this is a documentation/claim problem rather than a missing test — but triage and release gating reading the checklist will believe an E2E layer and a green build that do not exist.
- `beforeAll` in both new int tests (`story5-session-guards.int.test.ts`, `story-5-full-audit.int.test.ts`) swallow DB connection errors into a `dbAvailable` flag and only `beforeEach`/`afterAll` consult it — the `it` bodies run unconditionally, so a lost DB connection surfaces as a burst of assertion failures rather than a clean skip. Loud, not silent, so not a verification gap; but the `dbAvailable` guards suggest the intent was to skip, which they do not achieve.
