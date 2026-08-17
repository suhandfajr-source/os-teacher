---
trigger: always_on
---

# AI Teacher Assistant — Project Rules

These rules are NON-NEGOTIABLE unless the user explicitly changes the product specification.

## Scope Control

1. Implement ONLY the current development stage.
2. Never silently implement features from later stages.
3. Do not rewrite or remove previously PASSed functionality unless required by a new explicit requirement.
4. If a new change conflicts with a passed stage, report the conflict before broad refactoring.

## Product Principles

5. Input Once, Use Everywhere.
6. Ask Only When Needed.
7. Optional academic context must never block core daily workflows.
8. Start Anytime, Grow the Context.
9. AI Assists, Teacher Decides.
10. Activity Generates Data.
11. Reports are generated from core data.
12. Planned Teaching and Actual Teaching are separate concepts.

## Assessment V1

13. Teachers manually correct student answers in V1.
14. Teachers determine student scores in V1.
15. The system may calculate, validate, aggregate, analyze, recommend remedial candidates, monitor, and report.
16. AI must NOT determine final student grades in V1.
17. Do NOT build OCR grading, AI essay correction, automatic answer-sheet correction, or CBT unless a later stage explicitly adds them.

## Data

18. PostgreSQL is the application source of truth.
19. Do not create duplicate sources of truth.
20. Store raw/source activity data before derived summaries.
21. Preserve important history.
22. Use migrations for all database schema changes.
23. Reports and exports are outputs, not primary data stores.
24. Teacher notes default to PRIVATE.
25. Parent users may access only their linked child/children and permitted fields.

## Excel / Import / Export

26. Excel is a first-class editable output format.
27. Downloaded Excel files do not automatically mutate the database.
28. Spreadsheet imports must follow: Upload → Preview → Mapping → Validation → Confirm → Import.
29. Never write imported spreadsheet rows directly into core data without validation and explicit confirmation.

## Architecture

30. Keep the application a modular monolith in V1.
31. Keep business logic out of presentational UI components.
32. Reuse components and services instead of duplicating logic.
33. Use the AI Service abstraction; do not call AI providers randomly from UI components.
34. Deterministic calculations must use code/database logic, not an LLM.
35. Do not introduce microservices, queues, vector databases, Redis, Docker, Kubernetes, or other infrastructure without an explicit requirement.
36. School Workspace is the primary tenant. Students, Classes, Subjects, and AcademicPeriods belong to the School Workspace, NOT the individual teacher.
37. Shared School data (AcademicPeriod, Subject, Class, Student) must not be hard-deleted if referenced. Server-side authorization is required to modify.
38. Do not auto-merge Schools or Classes based solely on names. Class identity = School + Name.
39. Parent access requires ParentTeachingAccess approval per TeachingContext by the specific Teacher.
40. Shared Student Identity, Context-Owned Learning Data. Teachers share student rosters but own their learning data (scores, attendance).

## UX

42. Daily teacher work has priority over advanced configuration.
43. Minimum click and context-aware workflows are required.
44. Missing optional data should warn, not block.
45. UI must remain responsive.
46. Fast score input is a critical workflow.
47. Provide useful empty, loading, validation, and error states.

## Quality Gate

48. Before declaring a development stage complete:
    - run build;
    - run lint;
    - run relevant tests;
    - test core user flow;
    - verify data persistence;
    - verify no regression to previous PASSed stages;
    - verify responsive behavior for relevant screens.

49. At the end of work, report:
    - implemented scope;
    - changed files;
    - migrations;
    - test/build status;
    - known issues;
    - PASS criteria status.

50. Never automatically proceed to the next development stage.
