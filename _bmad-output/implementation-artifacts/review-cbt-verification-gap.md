### Missing submittedAt timestamp on lockdown auto-lock attempt completion

- **Changed surface:** `src/modules/quiz/quiz.actions.ts:1725` finalize update in `recordQuizViolationFromSessionAction`.
- **Impacted consumer or site:** Student portal quiz list (`src/modules/quiz/quiz.actions.ts:1537`) and teacher attempt list relying on `attempt.submittedAt`.
- **Existing test evidence:** `src/modules/quiz/__tests__/cbt-integrity.actions.test.ts:108` asserts `status === "SUBMITTED"` and `lockdownLockedAt` is set, but does NOT assert `submittedAt` is set on the locked attempt.
- **Missing verification:** An assertion verifying `finalizeCall.data.submittedAt` is populated with a `Date` instance.
- **Demonstration:** If `submittedAt` is omitted, the locked attempt is never returned under `completedQuizzes` in student portal (which filters by `submittedAt !== null` at line 1537) and student sees it stuck as an ongoing or unfinishable quiz.
- **Consequence:** Student locked out by 3 strikes sees ghost active quiz that can never be reopened or reviewed, and teacher gradebook reports missing submission timestamp.
- **Disposition:** `patch` — add `submittedAt: new Date()` to the Prisma update payload in `recordQuizViolationFromSessionAction` and assert it in `cbt-integrity.actions.test.ts`.

### Missing runtime validation of QuizViolationKind enum in server action

- **Changed surface:** `src/modules/quiz/quiz.actions.ts:1680` signature and body of `recordQuizViolationFromSessionAction`.
- **Impacted consumer or site:** Public API edge where any authenticated student session can call the action directly with arbitrary strings.
- **Existing test evidence:** `src/modules/quiz/__tests__/cbt-integrity.actions.test.ts` only passes typed valid enum strings (`"TAB_EXIT"`, `"FULLSCREEN_EXIT"`). No test passes an invalid or hostile string.
- **Missing verification:** A unit test verifying that `recordQuizViolationFromSessionAction("attempt-1", "HACK_KIND" as any, 1000)` returns `{ success: false, error: ... }` without calling Prisma.
- **Demonstration:** Invert or remove the type guard; passing `"INVALID"` triggers Prisma error code `P2003` or client validation exception, causing 500 error log on production monitoring instead of clean client validation.
- **Consequence:** Security scanner or fuzzing throws unhandled server exceptions into monitoring.
- **Disposition:** `patch` — add an allowlist guard array in `recordQuizViolationFromSessionAction` and add a test case.

## Other findings

- `src/modules/student-portal/components/QuizRunnerClient.tsx:288`: `flushPendingViolations` throws away queued items if the server action returns `{ success: false }` or encounters network drop, losing offline integrity trace data.
