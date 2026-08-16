# Stage 05 — Data Model
## AI Teacher Assistant — Final Revised

## 1. Tujuan Stage

Menentukan data apa saja yang harus disimpan, hubungan antar-data, data mana yang menjadi sumber utama, serta bagaimana sistem tetap fleksibel pada penggunaan minimal maupun maksimal.

Prinsip utama:

> **Simpan data inti sekali, lalu gunakan kembali untuk teaching, assessment, monitoring, AI, dan reporting.**

## 2. Struktur Data Besar

```text
01. USER & PROFILE
02. CLASS & STUDENT
03. ACADEMIC CONTEXT
04. TEACHING ACTIVITY
05. ASSESSMENT
06. STUDENT PROGRESS
07. AI CONTENT & DOCUMENT
08. REPORTING & IMPORT
```

## 3. User & Profile

Entity:

```text
users
teacher_profiles
parent_profiles
parent_student_relations
```

Role:

```text
teacher
parent
```

Parent dapat terhubung ke satu atau beberapa siswa melalui parent-student relation.

## 4. Class & Student

Entity:

```text
schools
academic_periods
subjects
classes
students
class_students
teacher_classes
```

Struktur:

```text
TEACHER
   ↓
TEACHER CLASS
   ↓
CLASS
   ↓
STUDENTS
```

Satu siswa disimpan satu kali.

## 5. Academic Context

Bersifat optional enrichment.

Entity dapat mencakup:

```text
curriculums
learning_outcomes
learning_objectives
learning_sequences
academic_plans
mastery_criteria
```

Secara konsep:

```text
CURRICULUM
 ↓
CP
 ↓
TP
 ↓
ATP
```

Data tersebut tidak wajib agar Teaching dan Assessment dapat digunakan.

## 6. Planning Data

Entity:

```text
teaching_plans
annual_plans
semester_plans
```

Planning dipisahkan dari actual teaching.

```text
PLANNED
Apa yang direncanakan
```

berbeda dengan:

```text
ACTUAL
Apa yang benar-benar dilakukan
```

## 7. Teaching Activity

Entity inti:

```text
teaching_sessions
attendance_records
assignments
assignment_submissions
teacher_notes
```

Teaching Session menjadi salah satu entity penting.

```text
Teaching Session
│
├── Attendance
├── Materi
├── Aktivitas
├── Assignment
├── Teacher Notes
└── Journal
```

Jurnal sebaiknya dihasilkan dari Teaching Session, bukan input data berulang.

## 8. Attendance

```text
TEACHING SESSION
       ↓
ATTENDANCE
       ↓
STUDENT
```

Status:

- Hadir
- Sakit
- Izin
- Alpha
- Terlambat

Rekap dihitung dari raw attendance records.

## 9. Assignment

Entity:

```text
assignments
assignment_submissions
```

Assignment menyimpan:

- kelas,
- mapel,
- materi,
- tanggal,
- deadline,
- instruksi.

Submission menyimpan:

- siswa,
- tugas,
- status,
- tanggal pengumpulan,
- nilai opsional,
- feedback.

## 10. Assessment — V1 Final

Entity utama:

```text
assessments
assessment_blueprints
questions
assessment_questions
scores
```

Tidak menjadi core V1:

```text
student_responses
ai_grading_results
ocr_results
```

Entity tersebut dapat ditambahkan pada versi pengembangan assessment berikutnya.

## 11. Question Bank

```text
QUESTION BANK
      ↓
ASSESSMENT QUESTIONS
      ↓
ASSESSMENT
```

Question metadata dapat menyimpan:

- mapel,
- kelas,
- materi,
- TP opsional,
- tipe soal,
- kesulitan,
- level kognitif,
- AI generated / manual.

## 12. Scores — V1

Guru menginput nilai hasil koreksi manual.

```text
ASSESSMENT
    ↓
STUDENT
    ↓
SCORE
```

Score dapat menyimpan:

- raw/input score,
- manual adjustment jika ada,
- final score,
- status,
- catatan.

V1 tidak wajib menyimpan setiap jawaban siswa.

## 13. Remedial

Entity:

```text
remedials
remedial_participants
remedial_results
```

Flow:

```text
ASSESSMENT
    ↓
BELUM TUNTAS
    ↓
REMEDIAL
    ↓
GURU KOREKSI MANUAL
    ↓
INPUT HASIL
```

Simpan:

- nilai awal,
- nilai remedial,
- nilai final,
- histori.

Nilai awal tidak dihapus.

## 14. Student Progress

Student 360° bukan satu tabel besar.

Merupakan agregasi:

```text
STUDENT
│
├── Attendance
├── Assessment
├── Scores
├── Assignments
├── Remedial
└── Teacher Notes
```

Menghasilkan:

- attendance rate,
- average score,
- academic trend,
- missing assignment,
- remedial count,
- learning gap.

## 15. Teacher Notes

Entity:

```text
teacher_notes
```

Kategori:

- Academic
- Behaviour
- Attendance
- Assignment
- Parent Communication
- General

Visibility:

```text
PRIVATE
PARENT_VISIBLE
```

Default:

```text
PRIVATE
```

## 16. AI Content

Entity:

```text
ai_generations
learning_contents
```

AI Generation dapat menyimpan:

- jenis output,
- mode generate,
- input context,
- prompt,
- hasil,
- status,
- tanggal,
- versi.

Mode:

```text
AUTO
MANUAL
```

## 17. Automatic AI Context

Dapat mengambil:

- teacher,
- class,
- subject,
- material,
- teaching history,
- Academic Context,
- previous content,
- optional RPP.

Sumber context yang dipakai sebaiknya dapat dilacak.

## 18. Manual AI Context

Dapat berisi:

- kelas,
- mapel,
- materi,
- kurikulum,
- CP / TP / ATP,
- jumlah soal,
- jenis soal,
- durasi,
- instruksi tambahan.

Data manual tidak wajib masuk master Academic Context.

## 19. Learning Content

Jenis:

- RPP
- Modul Ajar
- PPT
- LKPD
- Worksheet
- Materi
- Kisi-kisi
- Soal
- Kunci Jawaban
- Quiz
- Aktivitas
- Rencana Pembelajaran

Flow:

```text
Generate
↓
Review
↓
Edit
↓
Save
↓
Reuse
```

## 20. Document & Template

Entity:

```text
document_templates
generated_documents
```

Template dapat berasal dari:

- System Template
- School Template
- Teacher Custom Template
- Uploaded Template

```text
CORE DATA
   ↓
DOCUMENT TEMPLATE
   ↓
GENERATED DOCUMENT
```

## 21. Reporting

Report tidak menjadi source of truth.

```text
CORE DATA
   ↓
REPORT ENGINE
   ↓
GENERATED REPORT
```

Snapshot report dapat disimpan jika report sudah finalized.

## 22. Historical Import

Entity pendukung:

```text
data_imports
import_mappings
```

Flow:

```text
UPLOAD
 ↓
READ DATA
 ↓
MAPPING
 ↓
VALIDATION
 ↓
IMPORT
```

Dapat digunakan untuk:

- siswa,
- nilai,
- absensi,
- materi,
- Prosem,
- assessment,
- teaching history.

## 23. Data Coverage

Coverage dihitung dari sumber data, bukan diinput guru.

Contoh:

```text
Attendance        100%
Grades             90%
Teaching History   65%
TP Mapping         40%
```

## 24. Parent Data Access

```text
PARENT
   ↓
PARENT-STUDENT RELATION
   ↓
STUDENT CORE DATA
```

Tidak dibuat copy data siswa khusus parent.

## 25. Minimum Data Model

```text
Teacher
Subject
Class
Student
Teaching Session
Attendance
Assessment
Score
Assignment
Teacher Note
```

Dengan data tersebut sistem sudah dapat menjalankan banyak fungsi harian.

## 26. Extended Data Model

Untuk penggunaan maksimum:

```text
Curriculum
CP
TP
ATP
Prota
Prosem
KKTP
Historical Data
AI Generations
Document Templates
Remedial History
```

## 27. Prinsip Data Model

1. **Single Source of Truth**  
   Satu data memiliki satu sumber utama.

2. **Raw Data Before Summary**  
   Simpan aktivitas dasar; statistik dihitung dari data sumber.

3. **Preserve History**  
   Nilai, remedial, dan aktivitas lama tidak langsung ditimpa.

4. **Optional Academic Relations**  
   Assessment atau materi boleh terhubung ke TP, tetapi tidak wajib.

5. **Planned ≠ Actual**  
   Planning dan aktivitas nyata disimpan terpisah.

6. **Report is Output**  
   Report bukan sumber utama data.

7. **AI Content Must Be Traceable**  
   Sistem tahu apa yang digenerate, kapan, dan menggunakan context apa.

8. **Parent Uses Same Student Data**  
   Tidak ada duplikasi data siswa.

9. **Student Response Detail Deferred for V1**  
   Detail jawaban siswa belum menjadi kebutuhan core V1.

## 28. Arsitektur Data Final

```text
                 USER
                  │
       ┌──────────┴──────────┐
       ↓                     ↓
    TEACHER                PARENT
       │                     │
       ↓                     │
   CLASS / SUBJECT            │
       │                     │
       ↓                     │
     STUDENT ←───────────────┘
       │
       ├──────────────┐
       ↓              ↓
   TEACHING       ASSESSMENT
       │              │
 ┌─────┼─────┐    ┌───┼────────┐
 ↓     ↓     ↓    ↓   ↓        ↓
Absensi Tugas Note Soal Nilai Remedial
       │              │
       └──────┬───────┘
              ↓
        STUDENT DATA
              ↓
       ANALYSIS ENGINE
              ↓
        MONITORING
              ↓
          REPORTING

OPTIONAL:
Academic Context
       ↓
Memperkaya Teaching,
Assessment, Analysis,
AI, dan Reporting
```

## 29. Keputusan Stage 05

Data model dibangun berdasarkan:

```text
ACTIVITY FIRST
+
CONNECTED DATA
+
OPTIONAL CONTEXT
```

Fondasinya adalah aktivitas nyata guru dan siswa.

Prota, Prosem, RPP, laporan, dan rekap lebih banyak menjadi hasil olahan dari core data.

**STAGE 05 — DATA MODEL: FINAL REVISED**
