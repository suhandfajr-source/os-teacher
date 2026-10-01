# ADDENDUM — Adaptive PPT Generation Engine V1

## Status Dokumen
Dokumen ini adalah addendum untuk fitur **PPT / Slide Pembelajaran Generator** pada aplikasi guru yang sudah berjalan.

Dokumen ini **tidak menggantikan PRD utama aplikasi** dan tidak meminta perubahan terhadap flow input existing, kecuali perubahan tersebut memang dibutuhkan untuk meningkatkan kualitas presentation layer.

---

# 1. Tujuan

Meningkatkan kualitas output PPT agar tidak lagi terasa seperti dokumen teks yang dipindahkan ke PowerPoint, tetapi menjadi **presentasi pembelajaran yang visual, natural, kontekstual, modern, dan siap digunakan guru di kelas**.

Fokus utama V1:

- meningkatkan kualitas UI/UX slide;
- menambah variasi layout;
- menambahkan gambar atau ilustrasi kontekstual;
- mengurangi ketergantungan terhadap bullet;
- menghindari penggunaan icon generik sebagai elemen visual utama;
- menjaga konsistensi desain satu deck;
- mempertahankan input dan workflow existing sebisa mungkin.

---

# 2. Existing Input

Input utama yang saat ini digunakan:

- Mata Pelajaran
- Kelas
- Judul Materi

Input lain dapat tetap bersifat opsional.

Jumlah slide dapat tetap dikustomisasi seperti existing behavior.

Jangan mengubah format input existing tanpa alasan implementasi yang kuat.

---

# 3. Masalah Existing

Output PPT saat ini memiliki beberapa masalah utama:

1. layout terlalu monoton;
2. mayoritas slide berupa judul + bullet;
3. hampir tidak ada gambar kontekstual;
4. tampilan terlalu polos;
5. visual hierarchy masih lemah;
6. judul slide terasa seperti output mesin;
7. slide lanjutan menggunakan pola `(1/2)`, `(2/2)`, `(1/3)`, dst.;
8. beberapa slide terasa seperti pagination dokumen;
9. belum ada ritme visual antar-slide;
10. belum terasa seperti bahan tayang profesional.

---

# 4. Target Output

Output PPT harus memiliki karakter:

- natural;
- visual;
- kontekstual;
- modern;
- tidak template-ish;
- tidak bergantung pada icon generik;
- cukup lengkap untuk menjadi bahan ajar guru;
- mudah dipahami siswa;
- siap ditampilkan tanpa redesign manual besar.

Prinsip utama:

> Deck harus konsisten, tetapi tidak seragam.

---

# 5. High-Level Generation Pipeline

Gunakan pipeline konseptual berikut:

```text
USER INPUT
    ↓
CONTENT GENERATION
    ↓
CONTENT ANALYSIS
    ↓
SLIDE ROLE CLASSIFICATION
    ↓
VISUAL STRATEGY
    ↓
LAYOUT SELECTION
    ↓
VISUAL ASSET GENERATION / SELECTION
    ↓
SLIDE COMPOSITION
    ↓
QUALITY CONTROL
    ↓
PPTX EXPORT
```

Tidak harus menjadi banyak request AI terpisah apabila arsitektur existing belum mendukungnya.

Yang penting, output internal generator mengikuti pembagian tanggung jawab tersebut.

---

# 6. Slide Role System

Setiap slide harus mempunyai `slide_role`.

Role minimal yang direkomendasikan:

```text
cover
hook
learning_objective
concept
story
process
timeline
comparison
visual_explanation
case_study
activity
discussion
quiz
reflection
summary
closing
```

Tidak semua role wajib digunakan dalam setiap deck.

AI memilih role berdasarkan materi.

---

# 7. Slide Role Rules

## 7.1 Cover

Gunakan:

- hero visual;
- contextual background;
- judul besar;
- informasi sekunder minimal.

Hindari bullet.

---

## 7.2 Hook

Gunakan untuk membuka rasa ingin tahu siswa.

Bentuk dapat berupa:

- pertanyaan;
- fakta;
- problem;
- visual;
- situasi.

---

## 7.3 Concept

Untuk menjelaskan konsep utama.

Dapat menggunakan:

- diagram;
- card;
- visual mapping;
- illustration;
- supporting image.

---

## 7.4 Story

Untuk:

- kisah;
- sejarah;
- biografi;
- peristiwa.

Gunakan visual yang lebih dominan daripada teks apabila memungkinkan.

---

## 7.5 Process

Untuk:

- tahapan;
- sequence;
- sebab-akibat;
- alur berpikir;
- prosedur.

Jangan otomatis menggunakan bullet.

---

## 7.6 Timeline

Untuk urutan peristiwa atau perkembangan.

---

## 7.7 Comparison

Untuk membandingkan dua atau lebih konsep.

---

## 7.8 Activity

Untuk aktivitas siswa.

Tampilan harus berbeda dari slide materi biasa.

---

## 7.9 Quiz

Fokus pada pertanyaan.

Jangan membuat quiz menjadi paragraf panjang.

---

## 7.10 Reflection

Gunakan desain lebih tenang dan minimal.

---

## 7.11 Summary

Maksimal sekitar 3–5 key takeaway.

Jangan mengulang seluruh isi materi.

---

# 8. Visual Strategy

Setelah menentukan slide role, tentukan `visual_strategy`.

Strategi minimal:

```text
cinematic_storytelling
editorial
scientific
diagrammatic
data_driven
minimal_reflection
natural_contextual
historical
geometric
academic_clean
```

---

# 9. Adaptasi Berdasarkan Mapel

## PAI / Kisah / Sejarah

Prioritaskan:

- cinematic storytelling;
- historical;
- editorial;
- natural contextual.

Hindari ornamen generik berlebihan.

---

## IPA / Biologi

Prioritaskan:

- scientific;
- diagrammatic;
- natural contextual.

---

## Fisika

Prioritaskan:

- scientific;
- diagrammatic;
- geometric.

---

## Matematika

Prioritaskan:

- geometric;
- diagrammatic;
- academic clean.

---

## Geografi

Prioritaskan:

- natural contextual;
- diagrammatic;
- data driven.

---

## Bahasa

Prioritaskan:

- editorial;
- natural contextual;
- storytelling.

---

# 10. Layout Library

Jangan membuat setiap slide dengan layout bebas tanpa kontrol.

Gunakan reusable layout library.

Minimum layout V1:

```text
L01 Hero Center
L02 Hero Left Text
L03 Full Image Overlay
L04 Split 50/50
L05 Split 40/60
L06 Three Cards
L07 Four Cards
L08 Horizontal Timeline
L09 Vertical Timeline
L10 Process Flow
L11 Comparison
L12 Big Statement
L13 Quote
L14 Image + Caption
L15 Diagram Focus
L16 Question Focus
L17 Activity
L18 Quiz
L19 Summary
L20 Reflection
```

Jumlah layout boleh disesuaikan dengan kemampuan implementation existing.

---

# 11. Layout Selection Rules

Contoh:

```text
IF slide_role = story
AND visual_importance = high
THEN pilih hero / split / full-image layout
```

```text
IF slide_role = comparison
THEN gunakan comparison / split layout
```

```text
IF slide_role = reflection
THEN gunakan minimal / big-statement layout
```

```text
IF slide_role = timeline
THEN gunakan timeline layout
```

---

# 12. Repetition Rule

Hindari layout yang sama lebih dari **2 slide berturut-turut**, kecuali memang merupakan sequence yang sengaja dibuat konsisten.

Generator harus mengecek variasi deck secara keseluruhan.

---

# 13. Text Density

Jangan menyelesaikan overflow dengan mengecilkan font secara agresif.

Rekomendasi:

### Headline
3–10 kata.

### Supporting content
Ideal sekitar 20–60 kata.

### Slide materi lebih kompleks
Maksimal sekitar 80–100 kata apabila benar-benar dibutuhkan.

Jika terlalu panjang:

```text
shorten
OR
split
OR
visualize
OR
change layout
```

---

# 14. Image Requirement

Setiap slide memiliki salah satu nilai:

```text
required
recommended
optional
none
```

---

# 15. Kapan Gambar Required

Prioritaskan `required` apabila materi berisi:

- objek nyata;
- tempat;
- organisme;
- tokoh;
- peristiwa;
- fenomena;
- cerita;
- historical setting;
- situasi;
- visual comparison.

---

# 16. Natural Visual Rule

Hindari ketergantungan pada:

- icon buku;
- icon lampu;
- icon centang;
- icon laptop;
- clipart;
- emoji dekoratif;
- stock visual random.

Visual utama lebih baik berupa:

- foto;
- ilustrasi;
- scientific visualization;
- landscape;
- environment;
- contextual scene;
- diagram;
- tipografi;
- shape composition.

Icon boleh digunakan apabila memiliki fungsi informasi nyata.

---

# 17. Image Prompt Generation

Jika slide membutuhkan image generation, sistem membuat prompt berdasarkan:

- subject;
- topic;
- slide role;
- context;
- time period;
- audience age;
- composition;
- visual strategy;
- intended text placement.

Contoh:

```json
{
  "image_prompt": "Wide cinematic illustration of an ancient Middle Eastern city at night, stars visible above, contemplative atmosphere, historical setting, educational illustration, no text, no depiction of prophets, widescreen composition, negative space on left for title"
}
```

---

# 18. Composition-Aware Visual

Prompt visual harus mempertimbangkan posisi teks.

Contoh:

```text
subject on right side
negative space on left
```

atau:

```text
main subject centered
dark gradient area at bottom for caption
```

Tujuannya agar gambar memang usable sebagai slide asset.

---

# 19. Religious / Sensitive Visual Rule

Untuk topik yang tidak tepat divisualisasikan secara langsung, jangan menggambar figur utama.

Gunakan:

- landscape;
- architecture;
- environment;
- symbolic object;
- silhouette apabila sesuai;
- contextual scene.

---

# 20. Design System Per Deck

Setiap deck harus mempunyai satu `design_system`.

Contoh:

```json
{
  "theme": "modern_islamic_cinematic",
  "primary_color": "#17324D",
  "secondary_color": "#C8A96B",
  "background": "#F5F1E8",
  "text_dark": "#1E252B",
  "heading_font": "Aptos Display",
  "body_font": "Aptos"
}
```

Warna tidak dipilih ulang secara random setiap slide.

---

# 21. Typography Hierarchy

Minimal:

```text
H1 = deck title
H2 = slide title
Body = supporting content
Highlight = keyword / number / important statement
```

---

# 22. Visual Hierarchy

Setiap slide wajib mempunyai:

```text
Primary Message
Supporting Content
Visual Support
```

Primary message harus terbaca dalam beberapa detik pertama.

---

# 23. Natural Slide Title

Jangan gunakan headline seperti:

```text
Slide 3: Keberanian Nabi Ibrahim (1/3)
```

Gunakan judul natural seperti:

```text
Berani Mempertahankan Kebenaran
```

Slide lanjutan harus memiliki judul yang relevan dengan isi slide tersebut.

Metadata nomor slide tetap boleh ada secara internal.

---

# 24. Section Transition

Untuk deck panjang, section divider boleh digunakan.

Contoh:

```text
BAGIAN 02

Keberanian Ibrahim
Mempertahankan Kebenaran
```

Section divider digunakan sebagai visual breathing room.

---

# 25. Engagement Layer

Jika jumlah slide memungkinkan, generator dapat menyisipkan:

```text
hook
question
activity
quiz
reflection
```

Namun jangan dipaksa apabila jumlah slide terlalu sedikit.

Prioritas tetap materi inti.

---

# 26. Suggested Internal Slide Schema

Contoh schema konseptual:

```json
{
  "slide_number": 4,
  "slide_role": "story",
  "title": "Ketika Ibrahim Menantang Keyakinan Kaumnya",
  "primary_message": "Keberanian Nabi Ibrahim lahir dari keyakinan terhadap kebenaran.",
  "content": [
    "Nabi Ibrahim menolak penyembahan berhala.",
    "Ia menggunakan argumentasi untuk mengajak kaumnya berpikir."
  ],
  "visual_strategy": "cinematic_storytelling",
  "layout": "L04_SPLIT_50_50",
  "image_requirement": "required",
  "image_prompt": "Ancient Babylonian temple environment with stone idols, dramatic warm lighting, historical educational illustration, no depiction of prophet, negative space for text",
  "visual_density": "high",
  "text_density": "low"
}
```

Schema ini adalah rekomendasi.

Sesuaikan dengan model data existing apabila aplikasi sudah memiliki format internal sendiri.

Jangan merombak seluruh existing data structure apabila bisa dilakukan mapping.

---

# 27. Deck-Level Schema

Contoh:

```json
{
  "deck": {
    "subject": "Pendidikan Agama Islam",
    "grade": "XI",
    "topic": "Meneladani Ketauhidan dan Keberanian Nabi Ibrahim",
    "slide_count": 12,
    "visual_direction": "modern_islamic_cinematic",
    "design_system": {
      "primary": "#17324D",
      "secondary": "#C5A25D",
      "background": "#F7F4ED",
      "text": "#1F2933"
    }
  }
}
```

---

# 28. Quality Control

Sebelum export PPTX, lakukan validasi.

## Content Check

- materi relevan;
- tidak ada pengulangan berlebihan;
- tidak ada slide kosong;
- tidak ada judul seperti metadata internal;
- tidak ada text overflow.

## Layout Check

- layout tidak terlalu repetitif;
- alignment rapi;
- spacing konsisten;
- tidak ada elemen terpotong.

## Visual Check

- image relevan;
- image tidak random;
- image crop baik;
- image quality memadai.

## Readability Check

- contrast baik;
- teks cukup besar;
- slide tidak terlalu padat.

---

# 29. Automatic Revision Rule

Jika:

```text
text_overflow = true
```

Jangan langsung:

```text
reduce font size drastically
```

Prioritas:

```text
1. shorten content
2. change layout
3. split content jika jumlah slide memungkinkan
4. simplify supporting text
```

---

# 30. Acceptance Criteria V1

V1 dianggap berhasil apabila:

1. output tidak lagi didominasi bullet layout;
2. terdapat variasi layout dalam satu deck;
3. visual kontekstual digunakan apabila relevan;
4. icon generik bukan visual utama;
5. judul slide natural;
6. `(1/3)` dan sejenisnya tidak tampil sebagai headline;
7. tidak ada slide kosong tanpa fungsi;
8. tiap slide memiliki visual hierarchy;
9. warna dan typography konsisten;
10. deck siap digunakan guru tanpa redesign manual besar;
11. deck tetap terasa satu kesatuan meskipun layout bervariasi;
12. gambar tidak hanya berfungsi sebagai filler.

---

# 31. Scope V1

Jangan over-engineer versi pertama.

Cukup implementasikan:

### Visual Strategies

```text
cinematic
clean_academic
scientific
editorial
```

### Slide Roles

Sekitar 10–15 role utama.

### Layouts

Sekitar 12–20 reusable layouts.

### Images

Generate / retrieve hanya jika `required` atau `recommended`.

---

# 32. Important Implementation Constraint

Dokumen ini adalah improvement terhadap **presentation layer**.

Prioritas implementasi:

```text
REUSE EXISTING FLOW
REUSE EXISTING INPUT
REUSE EXISTING CONTENT GENERATION IF POSSIBLE
ADD VISUAL PLANNING LAYER
ADD LAYOUT SELECTION
ADD VISUAL ASSET STRATEGY
ADD QUALITY CONTROL
```

Jangan melakukan rewrite besar terhadap fitur existing apabila improvement ini dapat ditambahkan secara incremental.

---

# 33. Expected Result

Sebelum:

```text
materi
↓
masukkan ke template
↓
export PPT
```

Sesudah:

```text
materi
↓
pahami pesan
↓
tentukan fungsi slide
↓
tentukan treatment visual
↓
pilih layout
↓
buat / pilih visual asset
↓
compose
↓
review
↓
export PPT
```

Target akhirnya:

> PPT terasa seperti dibuat oleh instructional designer, bukan seperti dokumen materi yang otomatis dipindahkan ke slide.
