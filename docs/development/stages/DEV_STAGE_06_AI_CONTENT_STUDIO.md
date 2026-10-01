# DEVELOPMENT STAGE 06 — AI CONTENT STUDIO

## Status

**Stage:** DEVELOPMENT STAGE 06 — AI CONTENT STUDIO  
**Baseline:** `main` @ `dev-stage-05-pass`  
**Baseline Commit:** `acdb2e82eefd0b6e666e8cafdd6b54d4e19bccb9`  
**Previous Stages:** Stage 00–05 PASS + TAGGED + LOCKED  
**Coding Status:** NOT STARTED  
**Current Gate:** Product Document → Implementation Plan only

---

## 1. Product Objective

Stage 06 introduces the first real AI-assisted workflow inside Teacher OS.

The goal is **not** to build a generic chatbot and **not** to automate academic judgment. The goal is to help teachers create useful teaching content faster by reusing context that Teacher OS already knows.

Stage 06 should answer a simple teacher need:

> **“I already told the system what class and subject I teach. Help me draft useful teaching content without making me explain everything again.”**

### Golden Rule

> **AI CREATES A DRAFT. THE TEACHER REVIEWS, EDITS, SAVES, AND DECIDES WHETHER TO USE IT.**

AI output is never authoritative academic truth and never directly changes canonical teaching, assessment, score, attendance, monitoring, or student records.

---

## 2. Why Stage 06 Exists

Teacher OS already has useful context from previous stages:

- Teacher identity and active School Workspace;
- AcademicPeriod;
- Subject;
- Class;
- TeachingContext;
- TeachingSession topics and reflections;
- lightweight Assignment records;
- Assessment configuration and results;
- Student Monitoring.

However, most AI products still force teachers to manually retype:

- subject;
- class;
- semester;
- lesson/topic context;
- desired teaching material style.

Stage 06 applies the product principles:

- **Input Once, Use Everywhere**;
- **Ask Only When Needed**;
- **Start Anytime, Grow the Context**;
- **More Context = Better Experience, Not Required Experience**;
- **AI Assists, Teacher Decides**.

A teacher must be able to use AI Studio with minimal input, while optional known context improves the result.

---

## 3. Stage 06 Product Mental Model

```text
Teacher
→ opens AI Studio
→ chooses content purpose
→ optionally chooses one owned TeachingContext
→ system safely prepares allowed context
→ teacher adds topic / instruction
→ Gemini generates a DRAFT
→ teacher reviews / edits / optionally refines
→ teacher explicitly saves the draft
→ saved draft remains teacher-owned
```

Important distinction:

```text
AI suggestion
≠
canonical Teacher OS data mutation
```

Stage 06 must never silently create or update:

- TeachingSession;
- Assignment;
- Assessment;
- AssessmentResult;
- GradePolicy;
- AttendanceRecord;
- StudentMonitoringNote;
- Student identity;
- finalScore;
- any report-card data.

---

## 4. LOCKED Stage 06 Product Decisions

### 4.1 AI Studio is Teacher-Owned

Saved AI content belongs to the teacher who created it.

Same-school membership does **not** allow another teacher to browse or edit another teacher's AI drafts.

Recommended ownership concept:

```text
TeacherProfile
+
School
+
optional TeachingContext
→ AI Content Draft
```

If a draft is linked to a TeachingContext, the context must be owned/authorized by the current teacher in the ACTIVE School.

If no TeachingContext is selected, the teacher may still generate and save a School-scoped personal draft.

This supports:

> More Context = Better Experience, Not Required Experience.

---

### 4.2 TeachingContext is Optional, Never Trusted from Client

The teacher may choose an existing TeachingContext to enrich generation.

Server must verify:

```text
Authenticated User
→ TeacherProfile
→ ACTIVE School membership
→ owned/authorized TeachingContext
→ generation/save action
```

A manipulated `teachingContextId` from the browser must never expose another teacher's context or School data.

---

### 4.3 Context Pack V1 — Safe Educational Context Only

When a TeachingContext is selected, Stage 06 may automatically reuse safe structural context such as:

- Subject name;
- Class name / grade-level information already available in the Class master;
- AcademicPeriod;
- recent teacher-owned TeachingSession topic fields (`plannedTopic`, `actualTopic`) where useful;
- teacher-owned Assignment title/description where explicitly useful to the chosen generation type.

The system should avoid asking the teacher to retype those values.

### STRICT PRIVACY BOUNDARY

Stage 06 V1 must **NOT automatically send student-level data to Gemini**, including:

- `Student.fullName`;
- NIS or other student identifiers;
- individual attendance records;
- individual assessment scores;
- `AssessmentResult` values;
- remedial history;
- `StudentMonitoringNote`;
- follow-up flags;
- student monitoring timelines;
- student labels, diagnoses, or predictions.

Stage 05 monitoring data must NOT become hidden AI prompt material in Stage 06.

Reason:

> AI Content Studio creates teaching content. It is not student analytics or student profiling.

Future student-level AI analysis requires a separate explicit product decision and privacy review.

---

### 4.4 Curriculum Context is Optional

Stage 07 is the roadmap stage for Reporting & Academic Context.

Therefore Stage 06 must work **without** CP / TP / ATP / Prota / Prosem.

Do not create fake curriculum context and do not block AI Studio because curriculum records do not exist yet.

If future Stage 07 introduces approved academic/curriculum context, AI Studio may be enhanced additively later.

---

## 5. AI Content Types — V1

Stage 06 should use a focused teacher workflow rather than a generic unrestricted chatbot.

V1 content purposes:

### A. Rencana Aktivitas Pembelajaran

Generate a practical classroom activity draft, for example:

- learning flow;
- opening activity;
- core activity;
- closing/reflection activity;
- estimated sequence;
- materials needed.

This is a teaching activity suggestion, not an official curriculum document.

### B. Materi / Ringkasan Pembelajaran

Generate teacher-editable explanatory material such as:

- concise explanation;
- key concepts;
- examples;
- summary/handout-style content.

### C. Draft Instruksi Tugas

Generate:

- task title idea;
- objective;
- teacher/student instructions;
- steps;
- expected output;
- optional submission guidance as plain content.

Important:

> This does NOT create an Assignment record automatically.

It also does not introduce LMS submission tracking.

### D. Rubrik / Kriteria Sederhana

Generate a teacher-editable textual rubric or success criteria draft.

Important:

- AI does not grade students;
- AI does not assign scores;
- no automatic connection to `AssessmentResult`;
- no automatic finalScore mutation.

### Content-Type Boundary

Stage 06 V1 does **not** provide a dedicated:

- Question Bank generator;
- exam-item generator;
- CBT question builder;
- answer-key grading engine.

Question Bank / AI question generation remains out of scope unless explicitly opened in a later approved product decision.

---

## 6. Generation Input UX

The interface should ask only what is needed.

Recommended minimal input:

```text
Content Type      required
TeachingContext   optional
Topic / Need      required
Additional Notes  optional
```

Optional teacher-friendly controls may include simple choices such as:

- concise / standard / detailed;
- formal / conversational classroom language;
- desired approximate duration where relevant.

Do not turn V1 into a complex prompt-engineering form.

The teacher should not need to know prompt syntax.

---

## 7. Generation & Review Workflow

Recommended V1 workflow:

```text
Input
→ Generate
→ AI Draft Preview
→ Teacher Edit
→ Save Draft
```

### Teacher Review is Mandatory by Design

AI generation must be visually labeled as a draft, for example:

```text
Draft AI — periksa dan sesuaikan sebelum digunakan.
```

Do not label AI output as:

- approved;
- correct;
- curriculum-compliant;
- final;
- officially assessed.

### Optional One-Shot Refinement

Stage 06 may include a simple refinement action:

```text
Current Draft
+
short teacher instruction
→ AI refined preview
```

Examples:

- “Buat lebih singkat”;
- “Gunakan bahasa yang lebih sederhana”;
- “Buat aktivitas lebih interaktif”.

Refinement must not silently overwrite a saved draft.

Teacher must explicitly apply/save the new content.

Stage 06 does not require a persistent multi-turn chatbot conversation history.

---

## 8. Persistence & Draft Lifecycle

Generation output should not automatically become permanent data merely because an AI request succeeded.

Preferred product behavior:

```text
Generate
→ transient preview
→ teacher reviews/edits
→ explicit Save Draft
→ persisted AI content draft
```

Saved drafts must support:

- list/history in AI Studio;
- open/read;
- edit;
- save changes;
- archive;
- optional filter by content type;
- optional filter by TeachingContext when present.

### Archive Over Delete

Use archive/deactivate rather than hard-delete UI for persisted drafts.

Archived drafts:

- remain historically preserved;
- are excluded from default active list;
- may be viewable in an archived filter if implementation remains simple;
- should not be accidentally mutated through a direct ID.

Exact Prisma model/field naming is a technical implementation choice to be proposed in the Implementation Plan.

---

## 9. AI Provider Architecture — LOCKED Direction

AI integration must use a provider/service abstraction.

Conceptually:

```text
AI Studio UI
→ server action / route
→ AI Content Service
→ AI Provider interface
→ Gemini provider
```

### Required Rules

1. Gemini API credentials are **server-only**.
2. Never expose API keys to client JavaScript.
3. Client must not choose arbitrary provider/model names.
4. Provider/model configuration is controlled server-side.
5. Business/UI code must not be tightly coupled directly to Gemini SDK calls.
6. Deterministic calculations remain normal application code, never AI.
7. Automated tests must be able to use a fake/mock provider; tests must not depend on live external AI calls.

The exact Gemini SDK package, exact model name, streaming vs non-streaming transport, and provider interface method names are **technical decisions for the Implementation Plan**, not product-level locks.

Do not hard-code an obsolete model name into the product contract.

---

## 10. Prompt Construction Rules

The server owns prompt construction.

Client input is data, not trusted authorization or trusted hidden instructions.

Prompt construction should clearly separate:

- system/product instructions;
- verified Teacher OS context;
- teacher-entered request;
- current draft when refining.

### Context Isolation

For Context A generation, the server must never include Context B data.

Example:

```text
Pak Budi — PAI VIII A
Pak Andi — Matematika VIII A
```

Even if the Class roster is shared, Pak Andi's AI generation must not silently include Pak Budi's:

- lesson notes;
- assignments;
- assessments;
- monitoring notes;
- generated AI drafts.

---

## 11. Provider Failure & Cost-Safety UX

AI is an external dependency and may fail.

Stage 06 must handle:

- missing server API key/configuration;
- provider timeout;
- provider error;
- rate/limit error;
- malformed/empty response;
- network failure.

Teacher-facing behavior:

```text
Input remains intact
→ clear error message
→ retry available
→ no fake content saved
```

Do not surface raw provider stack traces or API secrets.

### Server-Side Request Bounds

Implementation Plan must define reasonable server-side limits for:

- input length;
- output length/token budget;
- generation timeout;
- concurrent generate state / duplicate-click protection.

Do not add Redis or a distributed infrastructure layer solely for Stage 06.

---

## 12. Authorization Rules

Minimum authorization chain:

```text
Authenticated User
→ TeacherProfile
→ ACTIVE School
→ teacher-owned AI Draft
→ optional authorized TeachingContext
```

Explicitly prevent:

- cross-School draft access;
- Teacher A reading Teacher B AI draft;
- Teacher A editing/archiving Teacher B AI draft;
- cross-TeachingContext context injection;
- manipulated `teachingContextId`;
- manipulated AI draft/content ID;
- direct URL / IDOR;
- generating with a context outside the ACTIVE School.

School OWNER does not become an AI-content superuser.

UI hiding is not authorization.

---

## 13. Navigation & UI/UX

### Global Route

Stage 06 should activate the existing roadmap concept:

```text
/ai-studio
```

AI Studio must be discoverable from desktop navigation and usable on mobile.

Do not expose fake future routes such as reporting/document libraries unless they are actually implemented.

### Suggested Page Structure

```text
AI Studio
├ New Content
│  ├ content type
│  ├ optional class/context
│  ├ topic/instruction
│  └ Generate
│
├ Draft Preview / Editor
│  ├ AI draft label
│  ├ editable content
│  ├ optional Refine
│  └ Save Draft
│
└ My AI Drafts
   ├ active drafts
   ├ type/context filter
   └ archived state if implemented cleanly
```

### UX Requirements

- clean, calm, teacher-first;
- no “prompt engineering” terminology required from teachers;
- useful empty states;
- explicit generating/loading/error states;
- do not lose teacher input on provider failure;
- disable duplicate submit while generating;
- editor usable on desktop and mobile;
- save feedback: Saving / Saved where appropriate;
- no fake AI output if provider is unavailable.

---

## 14. Data Model Direction

Stage 06 likely needs one minimal persisted draft/document concept.

The Implementation Plan should propose the smallest safe schema that supports:

- teacher ownership;
- School scoping;
- optional TeachingContext relation;
- content type;
- title;
- editable saved content;
- optional source/generation instruction provenance where useful;
- archive state;
- timestamps.

Do not create unnecessary tables for:

- chat messages;
- embeddings;
- vector search;
- token ledgers;
- AI risk scores;
- student AI profiles.

No vector database is required for Stage 06 V1.

---

## 15. Strictly In Scope

Stage 06 V1 includes:

- `/ai-studio` teacher-facing workflow;
- Gemini integration behind AI provider/service abstraction;
- server-only credential handling;
- focused generation types:
  - Rencana Aktivitas Pembelajaran;
  - Materi / Ringkasan Pembelajaran;
  - Draft Instruksi Tugas;
  - Rubrik / Kriteria Sederhana;
- optional TeachingContext selector;
- safe verified context reuse;
- no student PII/monitoring data in automatic AI context;
- generation preview;
- teacher manual editing;
- optional one-shot refinement if kept simple;
- explicit Save Draft;
- teacher-owned saved draft list/detail/edit/archive;
- desktop + mobile experience;
- provider error handling;
- authorization/IDOR protection;
- mockable AI provider tests;
- full Stage 00–05 regression verification.

---

## 16. Strictly Out of Scope

Do NOT implement in Stage 06:

### AI Judgment / Student Analytics

- AI student risk scoring;
- AI diagnosis;
- AI behavior/character classification;
- AI recommendation based automatically on private Student Monitoring data;
- AI grading;
- AI essay grading;
- automatic score assignment;
- OCR grading;
- answer-sheet correction;
- finalScore mutation.

### Assessment Delivery / Question Bank

- Question Bank;
- dedicated AI question generator;
- CBT;
- student exam delivery;
- answer submission;
- anti-cheat;
- automatic answer key scoring.

### Reporting / Academic Context

- official report card;
- report lock/approval;
- promotion;
- leger/transcript;
- CP/TP/ATP/Prota/Prosem engine;
- curriculum compliance certification.

These belong to later product decisions/stages.

### Parent / Cross-Teacher

- Parent Portal;
- parent AI access;
- principal/admin AI surveillance;
- cross-teacher AI draft browsing;
- school-wide AI draft library.

### Infrastructure / Export Expansion

- vector DB;
- embeddings/RAG infrastructure;
- microservice AI backend;
- Python backend;
- Redis/Kafka;
- Kubernetes;
- AI image generation;
- PPTX/DOCX/PDF export engine;
- full “Dokumen Saya” document-management module.

---

## 17. Security & Privacy Acceptance Criteria

Stage 06 must prove:

1. Gemini/API key never reaches client bundle or browser responses.
2. All generation is server-mediated.
3. Context A request cannot read Context B data.
4. Teacher A cannot read/edit/archive Teacher B AI drafts.
5. Cross-School access rejects server-side.
6. Manipulated TeachingContext ID rejects server-side.
7. Manipulated AI draft ID rejects server-side.
8. ACTIVE School switching scopes AI draft list correctly.
9. Automatic AI context contains no Student name/NIS/score/attendance/remedial/monitoring-note data.
10. Provider errors do not persist fake/partial content as a saved draft.

---

## 18. Business Acceptance Criteria

Stage 06 passes only if a teacher can:

1. Open AI Studio from real navigation.
2. Generate content without selecting a TeachingContext.
3. Generate better-context content using one owned TeachingContext.
4. See which context is being used before generation.
5. Receive a clear AI draft, not an authoritative “final” result.
6. Edit the generated content manually.
7. Save explicitly.
8. Reopen saved content later.
9. Edit saved content.
10. Archive saved content without hard deletion.
11. Use the workflow on mobile.
12. Recover cleanly from provider failure without losing input.

---

## 19. AI Integration Verification Requirement

Automated test suites must use a fake/mock provider and must not require a live Gemini network call.

However, before Stage 06 can receive final PASS, the implementation must also demonstrate at least one real provider smoke test in a safe development environment with a valid server-side Gemini credential:

```text
server configuration present
→ generation request succeeds
→ response rendered as draft
→ API key not exposed
```

If a valid provider credential is unavailable, report that honestly. Do not fake a live-provider PASS.

Never print or include the actual API key in reports, screenshots, logs, Git, or test output.

---

## 20. QA / Verification Standard

Minimum final verification:

```text
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test
npm run build
npx playwright test
```

Also required:

- migration review and `prisma migrate deploy` compatibility if schema changes;
- no database reset;
- provider unit tests using mock/fake provider;
- generation business-rule tests;
- authorization/IDOR matrix;
- privacy/context-pack tests;
- provider failure tests;
- desktop manual verification;
- mobile manual verification;
- browser/runtime console check;
- real Gemini smoke verification without exposing secrets;
- Stage 00 regression;
- Stage 01 regression;
- Stage 02 regression;
- Stage 03 regression;
- Stage 04 regression;
- Stage 05 regression;
- Git hygiene before checkpoint.

Build success alone does not equal PASS.

---

## 21. Migration Rules

If Stage 06 introduces persisted AI drafts, migration must be:

- additive;
- non-destructive;
- reproducible;
- production-safe;
- compatible with `prisma migrate deploy`;
- preserve all Stage 00–05 data;
- no database reset;
- no mutation of previous locked migration files.

---

## 22. Implementation Plan Requirements

Before coding, Antigravity must inspect the actual Stage 05 codebase and return an Implementation Plan that explicitly covers:

1. actual current Git baseline verification;
2. existing navigation and route structure;
3. proposed minimal Prisma model and migration;
4. AI provider interface and Gemini adapter boundary;
5. server-only credential configuration;
6. generation/refinement service flow;
7. allowed Context Pack V1 fields;
8. proof that student-level PII/monitoring data is excluded;
9. draft save/edit/archive lifecycle;
10. authorization helper strategy;
11. provider failure handling;
12. input/output limits;
13. desktop/mobile UX;
14. test strategy including mock provider and real-provider smoke;
15. Stage 00–05 regression strategy;
16. explicit files/routes expected to change;
17. scope confirmation and out-of-scope protection.

Antigravity must **STOP after the Implementation Plan**.

No coding, migration, package installation, or Git mutation is authorized until ChatGPT reviews the plan and the user explicitly approves Proceed Coding.

---

## 23. Technical Decisions Intentionally OPEN Until Plan Review

The following are not locked in this product document and must be justified in the Implementation Plan:

- exact Prisma model name / enum names;
- whether title is teacher-entered or safely derived then editable;
- exact Gemini SDK/package;
- exact current Gemini model configuration;
- streaming vs non-streaming response;
- server action vs route-handler transport details;
- exact editor component;
- whether refinement ships in initial V1 or is deferred if it complicates correctness;
- exact indexes;
- exact provider timeout/token limits;
- exact context recency window for recent TeachingSession topics.

Any choice must preserve the locked product/security boundaries above.

---

# FINAL STAGE 06 PRODUCT CONTRACT

```text
AI CONTENT STUDIO
=
Teacher-owned AI draft creation
+
optional verified teaching context
+
server-only Gemini provider abstraction
+
teacher review/edit/save
+
strict privacy and TeachingContext isolation
```

Not:

```text
AI grading
AI student analytics
Question Bank
CBT
Report Card
Curriculum prerequisite
Generic cross-data chatbot
```

Core rule:

> **AI ASSISTS. TEACHER DECIDES. EXISTING CONTEXT HELPS, BUT IS NEVER REQUIRED.**
