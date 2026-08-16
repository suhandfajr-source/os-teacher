# DEVELOPMENT STAGE 01 — AUTHENTICATION & BASIC SETUP
## AI Teacher Assistant — PRD

Status: READY FOR IMPLEMENTATION

---

# 1. Objective

Build the first real user workflow of AI Teacher Assistant:

```text
REGISTER
   ↓
LOGIN
   ↓
TEACHER PROFILE
   ↓
ACADEMIC PERIOD
   ↓
SUBJECT
   ↓
CLASS
   ↓
DASHBOARD
```

At the end of this stage, a teacher must be able to create an account, sign in securely, complete minimum onboarding, create basic teaching context, leave the application, sign back in, and still find the data intact.

This stage must remain focused on **Authentication & Basic Setup**.

---

# 2. Product Principles to Preserve

The implementation must follow:

> Input Once, Use Everywhere.

> Ask Only When Needed.

> Academic Context is Optional.

> Start Anytime, Grow the Context.

> AI Assists, Teacher Decides.

Do not require curriculum administration during onboarding.

Minimum usable context after Stage 01:

```text
Teacher
+
Academic Period
+
Subject
+
Class
```

Students will be added in Development Stage 02.

---

# 3. Required Context Before Implementation

Read:

```text
MASTER_CONTEXT.md
docs/architecture/TECHNICAL_ARCHITECTURE.md
.agents/rules/project-rules.md
docs/development/DEV_STAGE_01_AUTH_BASIC_SETUP.md
docs/product/
```

Also inspect all existing Stage 00 code before making changes.

Development Stage 00 is PASS and LOCKED.

Do not break its application shell, responsive behavior, reusable components, test foundation, or architecture.

---

# 4. In Scope

## 4.1 Authentication

Implement functional teacher authentication:

- Register
- Login
- Logout
- Session persistence
- Protected teacher routes
- Redirect unauthenticated users to Login
- Redirect authenticated users appropriately
- Basic authentication error handling

Use the Better Auth foundation already installed in Stage 00.

Follow the official integration approach supported by the installed Better Auth version and Prisma setup.

Do not create a second authentication system.

---

# 4.2 Account Registration

Minimum registration fields:

```text
Nama
Email
Password
Konfirmasi Password
```

Requirements:

- validate email;
- validate password requirements;
- prevent duplicate email registration;
- show useful user-facing errors;
- never expose raw authentication/server errors;
- password must never be stored manually outside the authentication provider's intended schema.

After successful registration:

```text
Register
 ↓
Authenticated Session
 ↓
Teacher Onboarding
```

If the authentication integration requires verification behavior not yet configured, do not invent a complex email infrastructure in this stage. Keep the flow consistent with V1 scope and document the decision.

---

# 4.3 Login

Login fields:

```text
Email
Password
```

Required states:

- submitting;
- success;
- invalid credentials;
- server failure.

After successful login:

```text
Incomplete Setup
    ↓
Onboarding

Completed Setup
    ↓
Beranda
```

---

# 4.4 Logout

Teacher can logout from the profile/user menu.

After logout:

```text
Session Ended
 ↓
Login
```

Protected pages must not remain accessible after logout.

---

# 4.5 Teacher Profile

Create the initial teacher profile.

Minimum fields:

```text
Nama Lengkap
Nama Sekolah
```

Optional fields may include only if clearly useful and low-friction:

```text
Nama Panggilan
```

Do NOT add a large teacher biodata form.

Do NOT ask for:

- NIK;
- address;
- phone;
- employee ID;
- education history;
- photo;
- curriculum data;

unless later explicitly required.

Principle:

> Minimum Input = Immediate Value.

---

# 4.6 Academic Period

Teacher can create/select the active academic period.

Minimum conceptual fields:

```text
Academic Year
Semester
Status
```

Example:

```text
2026/2027
Semester Ganjil
ACTIVE
```

Rules:

- a teacher should have a clear active academic context;
- avoid duplicate active periods for the same logical period;
- historical periods must remain preservable later;
- do not build advanced school calendar features yet.

---

# 4.7 Subject

Teacher can create/manage basic subjects they teach.

Minimum fields:

```text
Subject Name
```

Optional:

```text
Short Name
```

Examples:

```text
Ilmu Pengetahuan Alam
IPA
```

Required actions:

- create;
- edit;
- archive/delete safely when no dependent business data exists;
- view list.

Do not build curriculum mapping in this stage.

---

# 4.8 Class

Teacher can create/manage basic classes.

Minimum fields:

```text
Class Name
```

Optional simple metadata if needed:

```text
Grade Level
```

Examples:

```text
VIII A
VIII B
IX A
```

The class must be associated with the teacher context.

No student membership is implemented yet.

Required actions:

- create;
- edit;
- archive/delete safely;
- view list.

---

# 4.9 Teacher → Subject → Class Context

The system must establish a usable relationship between teacher, subject, academic period, and class.

Conceptually:

```text
TEACHER
   ↓
ACADEMIC PERIOD
   ↓
SUBJECT
   ↓
CLASS
```

A teacher may eventually teach:

```text
IPA — VIII A
IPA — VIII B
IPA — VIII C
```

The data design should not assume one teacher has only one subject or one class.

Use the Stage 05 product data model as the long-term reference, but implement only the minimum relations required for Stage 01.

Do NOT introduce student records yet.

---

# 4.10 Onboarding Flow

First-time teacher flow:

```text
Register
 ↓
Welcome
 ↓
Teacher Profile
 ↓
Academic Period
 ↓
Subject
 ↓
Class
 ↓
Setup Complete
 ↓
Beranda
```

Important:

- onboarding should feel short;
- show progress;
- do not ask for Academic Context such as CP/TP/ATP;
- do not ask for students yet;
- do not show fake success statistics.

Suggested steps:

```text
1. Profil
2. Periode Akademik
3. Mata Pelajaran
4. Kelas
```

At completion:

```text
Setup Complete
```

Store onboarding completion state in a reliable way.

---

# 4.11 Existing User Flow

Returning teacher:

```text
Login
 ↓
Session Restored
 ↓
Beranda
```

The user should not repeat onboarding after it has been completed.

If setup is partially complete:

```text
Login
 ↓
Resume Onboarding
```

Do not lose completed steps.

---

# 4.12 Beranda After Setup

Stage 01 Beranda remains intentionally minimal.

It may show:

```text
Greeting
Teacher Name
Active Academic Period
Subjects
Classes
```

And lightweight next-step messaging such as:

```text
Setup dasar selesai.
Data siswa akan ditambahkan pada tahap berikutnya.
```

Do NOT implement:

- attendance statistics;
- student alerts;
- assessment statistics;
- real teaching schedule;
- AI insights;
- fake charts;
- mock student data.

---

# 5. Data Model — Stage 01 Minimum

Implement only the schema needed for this stage, while remaining compatible with the long-term product data model.

Conceptual application entities:

```text
User / Auth Account
TeacherProfile
AcademicPeriod
Subject
Class
TeacherClass / Teaching Context as needed
```

Authentication-related tables/models should follow the official Better Auth integration for the installed version.

Do not manually duplicate authentication identity data into unrelated tables.

Suggested conceptual relationships:

```text
User
 ↓
TeacherProfile

TeacherProfile
 ├── AcademicPeriod
 ├── Subject
 └── Teaching/Class Context
```

Exact relational implementation may use junction tables where appropriate.

---

# 6. Database Requirements

This is the first stage expected to create real application migrations.

Requirements:

- update Prisma schema;
- create migration(s);
- migration must apply successfully;
- no destructive schema shortcuts;
- seed data is NOT required;
- do not add fake academic data.

After migration:

```text
Register
 ↓
Database
 ↓
Profile / Setup Data
 ↓
Logout
 ↓
Login
 ↓
Data Still Exists
```

This persistence flow must be verified.

---

# 7. Validation

Use Zod for application input validation.

At minimum validate:

- registration;
- login input where applicable;
- teacher profile;
- academic period;
- subject;
- class.

Validation rules must exist server-side.

Do not rely only on HTML/browser validation.

---

# 8. Authorization / Route Protection

Teacher workspace routes must require authentication.

Public routes:

```text
/login
/register
```

Authenticated users should not be unnecessarily sent back through registration/login.

Do not implement parent authorization yet.

---

# 9. UX Requirements

Preserve Stage 08 direction:

```text
Clean
Calm
Productive
Simple
Spacious
```

Authentication screen:

- focused layout;
- clear labels;
- useful validation;
- no unnecessary marketing-heavy landing page.

Onboarding:

- one clear primary action per step;
- progress indicator;
- back navigation where safe;
- loading state;
- error state;
- autosave or explicit save that prevents accidental data loss.

Desktop and mobile must both work.

---

# 10. Stage 00 Regression Rules

Do not break:

- Desktop Sidebar;
- Mobile Bottom Navigation;
- Topbar;
- Error boundary;
- Loading pattern;
- Empty state;
- reusable component system;
- Playwright foundation;
- modular-monolith structure.

If layout changes are required for public auth pages, separate public/auth layout cleanly from authenticated app layout.

Do not hack around the Stage 00 shell.

---

# 11. Out of Scope

Do NOT implement:

```text
Students
Student Import
Attendance
Teaching Session
Teaching Journal
Assignments
Assessment
Question Bank
Scores
Remedial
Student Monitoring
AI Studio
Gemini calls
Reports
Excel import/export workflows
Academic Context CP/TP/ATP
Prota
Prosem
Parent Portal
CBT
AI grading
OCR
```

Do not create placeholder business logic for these modules.

Existing navigation placeholders may remain.

---

# 12. Required User Flows

## Flow A — New Teacher

```text
Register
 ↓
Authenticated
 ↓
Teacher Profile
 ↓
Academic Period
 ↓
Subject
 ↓
Class
 ↓
Complete Setup
 ↓
Beranda
```

## Flow B — Returning Teacher

```text
Logout
 ↓
Login
 ↓
Beranda
```

Previously created setup data must remain.

## Flow C — Partial Onboarding

```text
Register
 ↓
Complete Profile
 ↓
Leave App
 ↓
Login
 ↓
Resume at Remaining Setup
```

Already saved data must not be lost.

## Flow D — Unauthenticated Access

```text
Open Protected Route
 ↓
Redirect Login
```

## Flow E — Duplicate Registration

```text
Register Existing Email
 ↓
Useful Error
 ↓
No Duplicate User
```

---

# 13. Testing Requirements

Run:

```text
npm run build
npm run lint
npx playwright test
```

At minimum cover:

- public login page opens;
- public register page opens;
- unauthenticated protected route behavior;
- teacher registration;
- onboarding completion;
- login after logout;
- data persistence after re-login.

If test-environment database setup is required, implement it cleanly and document it.

---

# 14. Manual Browser Verification

Verify on desktop and mobile:

- register;
- onboarding;
- login;
- logout;
- protected routes;
- create subject;
- create class;
- navigation behavior;
- no blocking console errors.

---

# 15. Error & Edge Cases

Verify:

- duplicate email;
- invalid email;
- password mismatch;
- wrong login credentials;
- missing required onboarding field;
- duplicate subject where relevant;
- duplicate class where relevant;
- refresh during onboarding;
- logout;
- direct access to protected route;
- database/server failure produces user-readable feedback.

---

# 16. Acceptance Criteria

Development Stage 01 is PASS only if:

## Authentication
- Register works.
- Login works.
- Logout works.
- Session persists appropriately.
- Protected routes are protected.
- Duplicate account is prevented.

## Teacher Setup
- Teacher profile can be saved.
- Academic period can be created/selected.
- Subject can be created.
- Class can be created.
- Onboarding completion is persisted.

## Returning User
- Teacher can logout and login again.
- Existing setup data remains.
- Completed onboarding is not repeated.

## Partial Setup
- Partial onboarding can resume without losing saved data.

## Database
- Prisma migration exists and applies successfully.
- Core Stage 01 data persists correctly.

## UX
- Desktop works.
- Mobile works.
- Loading/error/validation states are usable.
- Stage 00 shell remains intact.

## Quality
- Build PASS.
- Lint PASS.
- Tests PASS.
- No blocking console/runtime errors.
- No future-stage business feature implemented.

---

# 17. Completion Report Format

Return:

```text
STAGE 01 COMPLETION REPORT

Implemented Scope:
- ...

Changed / Created Files:
- ...

Packages Added / Changed:
- ...

Database Models:
- ...

Migrations:
- ...

Authentication:
PASS / FAIL

Registration:
PASS / FAIL

Login / Logout:
PASS / FAIL

Protected Routes:
PASS / FAIL

Onboarding:
PASS / FAIL

Teacher Profile:
PASS / FAIL

Academic Period:
PASS / FAIL

Subject:
PASS / FAIL

Class:
PASS / FAIL

Persistence Test:
PASS / FAIL

Build:
PASS / FAIL

Lint:
PASS / FAIL

Tests:
PASS / FAIL

Responsive Check:
PASS / FAIL

Stage 00 Regression Check:
PASS / FAIL

Known Issues:
- ...

Acceptance Criteria:
PASS / NOT PASS
```

End with:

```text
DEVELOPMENT STAGE 01: PASS
```

only if all blocking acceptance criteria pass.

Otherwise:

```text
DEVELOPMENT STAGE 01: NOT PASS
```

Do NOT proceed to Development Stage 02.

---

# 18. Definition of Done

```text
AUTH
 ↓
TEACHER SETUP
 ↓
PERSISTENCE
 ↓
ROUTE PROTECTION
 ↓
BUILD
 ↓
LINT
 ↓
TEST
 ↓
RESPONSIVE CHECK
 ↓
STAGE 00 REGRESSION CHECK
 ↓
PASS
 ↓
LOCK
```

**DEVELOPMENT STAGE 01 — READY**
