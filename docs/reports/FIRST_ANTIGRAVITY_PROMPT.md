# FIRST ANTIGRAVITY EXECUTION PROMPT

Study the project before writing code.

Read:

- `MASTER_CONTEXT.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `.agents/rules/project-rules.md`
- `docs/development/DEV_STAGE_00_PROJECT_FOUNDATION.md`
- the product specifications under `docs/product/` if they are present

Important:

Do NOT build the entire application.

Your current implementation scope is ONLY:

**Development Stage 00 — Project Foundation**

Before implementation:

1. Inspect the current workspace.
2. Read the specifications listed above.
3. Produce a concise implementation plan for Development Stage 00.
4. Identify any technical dependency or conflict.
5. Keep future business modules as architecture/placeholders only.

Then implement Development Stage 00.

Required technology baseline:

- Next.js 16
- TypeScript
- App Router
- Tailwind CSS
- PostgreSQL
- Prisma
- Better Auth foundation
- Zod
- modular-monolith project structure
- reusable UI components
- Playwright test foundation

Do not implement business features from later stages.

When implementation is complete:

1. Run the application build.
2. Run lint.
3. Run relevant tests / smoke test.
4. Check the application shell in the browser.
5. Check responsive behavior.
6. Report changed files.
7. Report packages added.
8. Report database/migration changes.
9. Report unresolved issues.
10. Evaluate every Stage 00 acceptance criterion.

End with:

`DEVELOPMENT STAGE 00: PASS`

only if every blocking acceptance criterion passes.

Otherwise end with:

`DEVELOPMENT STAGE 00: NOT PASS`

and list the blocking issues.

Do NOT proceed to Development Stage 01.
