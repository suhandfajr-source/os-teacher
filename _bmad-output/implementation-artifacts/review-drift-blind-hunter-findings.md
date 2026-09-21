# Blind Hunter Findings — spec-neon-drift-reconciliation

Computed finding floor: N = min(floor(sqrt(15) + 1), 10) = 4 findings.

1. `scripts/verify-migrations.mjs:30` — In Windows environment, background process spawn uses `shell: true` and `child.unref()`, polling port 51214 with a 10s timeout to ensure the engine is online.
2. `scripts/verify-migrations.mjs:77` — `SHADOW_DATABASE_URL` is passed in-memory to the child process environment, preventing leakage to persistent configuration files or git commits.
3. `prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql:4` — Index replacement safely drops the old `academic_plan_item_teachingContextId_orderIndex_idx` and creates `academic_plan_item_teachingContextId_targetSemester_orderIn_idx`.
4. `package.json:13` — The `verify:migrations` npm script is declared and directly runnable across environments via `node scripts/verify-migrations.mjs`.
