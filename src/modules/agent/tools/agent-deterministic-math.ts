/**
 * Helper modul kalkulasi deterministik Klassa Agent.
 * LLM dilarang berhitung matematika mandiri; seluruh angka dan statistik wajib melalui fungsi ini.
 */

export interface AttendanceStats {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  totalPertemuan: number;
  persentaseKehadiran: number; // 0 - 100
  kategori: "SANGAT_BAIK" | "BAIK" | "PERLU_PERHATIAN" | "BELUM_ADA_DATA";
}

export function calculateAttendanceStats(counts: {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
}): AttendanceStats {
  const total = counts.hadir + counts.sakit + counts.izin + counts.alpa;
  if (total === 0) {
    return {
      ...counts,
      totalPertemuan: 0,
      persentaseKehadiran: 0,
      kategori: "BELUM_ADA_DATA",
    };
  }

  const persentase = Math.round((counts.hadir / total) * 100);

  let kategori: AttendanceStats["kategori"] = "BAIK";
  if (persentase >= 90) {
    kategori = "SANGAT_BAIK";
  } else if (persentase < 75) {
    kategori = "PERLU_PERHATIAN";
  }

  return {
    ...counts,
    totalPertemuan: total,
    persentaseKehadiran: persentase,
    kategori,
  };
}

export interface AcademicGradeStats {
  totalItem: number;
  rataRata: number;
  nilaiTertinggi: number;
  nilaiTerendah: number;
  tuntasCount: number;
  remedialCount: number;
  kkm: number;
  statusKetercapaian: "TUNTAS_KLASIKAL" | "PERLU_REMEDIAL" | "BELUM_ADA_NILAI";
}

export function calculateAcademicGradeStats(scores: number[], kkm = 75): AcademicGradeStats {
  if (scores.length === 0) {
    return {
      totalItem: 0,
      rataRata: 0,
      nilaiTertinggi: 0,
      nilaiTerendah: 0,
      tuntasCount: 0,
      remedialCount: 0,
      kkm,
      statusKetercapaian: "BELUM_ADA_NILAI",
    };
  }

  const totalItem = scores.length;
  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  const rataRata = Math.round((sum / totalItem) * 10) / 10;
  const nilaiTertinggi = Math.max(...scores);
  const nilaiTerendah = Math.min(...scores);

  const tuntasCount = scores.filter((s) => s >= kkm).length;
  const remedialCount = totalItem - tuntasCount;

  // Standar ketuntasan klasikal umum: >= 75% siswa tuntas
  const persentaseTuntas = (tuntasCount / totalItem) * 100;
  const statusKetercapaian = persentaseTuntas >= 75 ? "TUNTAS_KLASIKAL" : "PERLU_REMEDIAL";

  return {
    totalItem,
    rataRata,
    nilaiTertinggi,
    nilaiTerendah,
    tuntasCount,
    remedialCount,
    kkm,
    statusKetercapaian,
  };
}
