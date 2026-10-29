export type ToolCluster = "diagnostic" | "roster" | "draft" | "memory" | "none";

interface ToolRoutingResult {
  cluster: ToolCluster;
  toolNames: string[];
  systemHint?: string;
}

export function routeAgentTools(
  message: string,
  classContextId?: string | null
): ToolRoutingResult {
  const text = message.trim().toLowerCase();

  // 1. Sapaan ringan / apresiasi / respons pendek -> 0 Tools (Sangat Hemat Token)
  const isSmalltalk =
    text.length <= 60 &&
    /^((hal+o+|ha+i+|hi+|hey|hello|hallo|test|tes|ping|permisi|siapa kamu|siapa anda|apa kabar|pagi|siang|sore|malam|assalamu['a-z\s]*|salam[\s!.,]*)[\s!.,?*)]*|terima kasih+|makasih+|thanks?|thank you|ok(e|ey)?|sip|siap)[\s!.,?]*$/i.test(
      text
    );

  if (isSmalltalk) {
    return {
      cluster: "none",
      toolNames: [],
    };
  }

  // 2. Pertanyaan Umum/Teoretis/Pedagogi Tanpa Konteks Database -> 0 Tools
  const isPurePedagogy =
    /(apa itu|pengertian|definisi|contoh modul|buatkan rpp|jelaskan|ide ice breaking|ice breaking|tips mengajar|kurikulum merdeka|p5|profil pelajar pancasila|diferensiasi)/i.test(
      text
    ) &&
    !/(siswa|murid|anak|kelas saya|nilai|absen|presensi|rekap|tugas)/i.test(text);

  if (isPurePedagogy) {
    return {
      cluster: "none",
      toolNames: [],
    };
  }

  // 3. Klaster Diagnostik & Analisis Siswa (Perhatian, Masalah, Nilai, Kehadiran)
  const isDiagnostic =
    /(perhatian|butuh bantuan|bermasalah|terendah|tertinggi|ranking|nilai|rekap nilai|analisis|evaluasi|kemampuan|kemajuan|kurang|rendah|jelek|sering bolos|kehadiran|absensi)/i.test(
      text
    );

  if (isDiagnostic) {
    let hint = "";
    // Jika tidak ada kelas spesifik yang dipilih dan guru belum sebut kelas di chat
    const mentionsClass = /(kelas|rombel|7[a-z]|8[a-z]|9[a-z]|10[a-z]|11[a-z]|12[a-z])/i.test(text);
    if (!classContextId && !mentionsClass) {
      hint = `\n[PANDUAN FEEDBACK KLARIFIKASI GURU]:
Pertanyaan guru menyangkut analisis murid/performa tetapi kelas atau indikator belum spesifik.
Sebelum mengambil kesimpulan atau memanggil tools acak:
1. Sambut pertanyaan guru dengan ramah.
2. Ajukan 2 pertanyaan klarifikasi singkat:
   - Kelas mana yang ingin dianalisis?
   - Indikator apa yang menjadi fokus utama (misal: rendahnya ketuntasan nilai asesmen, atau masalah absensi/kehadiran)?
3. Tawarkan bahwa kamu siap menganalisis data kelas begitu guru memilih kelasnya atau menyebutkannya.`;
    }

    return {
      cluster: "diagnostic",
      toolNames: [
        "analyzeClassPerformance",
        "getStudentAcademicSummary",
        "getStudentAttendanceSummary",
        "getClassDigest",
      ],
      systemHint: hint,
    };
  }

  // 4. Klaster Aksi / Pembuatan Draft (Tugas, Pengumuman, Catat Presensi)
  const isDraftAction =
    /(buatkan tugas|beri tugas|kirim tugas|buatkan pengumuman|kirim pengumuman|umumkan|catat absen|input presensi|rekap absen hari ini)/i.test(
      text
    );

  if (isDraftAction) {
    return {
      cluster: "draft",
      toolNames: [
        "proposeAssignmentDraft",
        "proposeClassAnnouncement",
        "proposeAttendanceLog",
        "getClassStudents",
      ],
    };
  }

  // 5. Klaster Data Rombel & Daftar Siswa Dasar
  const isRosterQuery =
    /(daftar siswa|siapa saja siswa|anggota kelas|list murid|daftar murid|berapa siswa|jumlah murid|daftar kelas saya)/i.test(
      text
    );

  if (isRosterQuery) {
    return {
      cluster: "roster",
      toolNames: ["getTeacherClasses", "getClassStudents", "getClassDigest"],
    };
  }

  // 6. Preferensi Memori Guru
  const isMemoryUpdate = /(ingat bahwa saya|catat preferensi saya|gaya mengajar saya|selalu panggil saya)/i.test(
    text
  );

  if (isMemoryUpdate) {
    return {
      cluster: "memory",
      toolNames: ["updateTeacherMemoryPreference"],
    };
  }

  // 7. Fallback Cerdas: Hanya aktifkan tools penunjang dasar (bukan 10 sekaligus)
  return {
    cluster: "roster",
    toolNames: ["getTeacherClasses", "getClassDigest", "getClassStudents"],
  };
}
