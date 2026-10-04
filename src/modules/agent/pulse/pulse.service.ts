import { prisma } from "@/lib/auth";
import {
  RecordAnonymizedInsightInput,
  PulseSummaryMetrics,
  ClassroomStruggleItem,
  CurriculumBottleneckItem,
  ActivityHeatmapSlot,
  KlassaPulseAnalyticsResponse,
} from "./pulse.types";

/**
 * Format string periode default saat ini (misal "2026-W40" atau "2026-10")
 */
export function getCurrentPeriodKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Sanitasi string untuk memastikan bebas dari format email atau pola PII kasar
 */
export function sanitizeInsightString(str: string): string {
  return str
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[TERANONIM]")
    .replace(/\b\d{10,16}\b/g, "[ID_TERANONIM]")
    .trim();
}

const BLOCKED_METADATA_KEYS = new Set([
  "studentname",
  "student_name",
  "namasiswa",
  "nama_siswa",
  "teachername",
  "teacher_name",
  "namaguru",
  "nama_guru",
  "nisn",
  "nik",
  "email",
  "phone",
  "telepon",
  "handphone",
  "rawsnippet",
  "chatlog",
  "message",
]);

/**
 * Sanitasi rekursif pada objek metadata untuk mencegah kebocoran PII (M-01)
 */
export function sanitizeMetadata(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (BLOCKED_METADATA_KEYS.has(normalizedKey)) {
      continue; // Blokir kunci identitas personal secara preventif
    }

    if (typeof value === "string") {
      result[key] = sanitizeInsightString(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeInsightString(item) : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Mencatat agregat wawasan teranonimkan (Zero-PII UU PDP)
 */
export async function recordAnonymizedInsight(
  input: RecordAnonymizedInsightInput
): Promise<void> {
  const sanitizedMetricKey = sanitizeInsightString(input.metricKey);
  const sanitizedTags = input.tags ? input.tags.map(sanitizeInsightString) : [];
  const sanitizedMetadata = sanitizeMetadata(input.metadata);

  await prisma.agentInsightAggregate.create({
    data: {
      schoolId: input.schoolId || null,
      period: input.period,
      category: input.category,
      metricKey: sanitizedMetricKey,
      metricValue: input.metricValue,
      sampleCount: input.sampleCount || 1,
      tags: sanitizedTags,
      metadata: sanitizedMetadata ? (sanitizedMetadata as object) : undefined,
    },
  });
}

/**
 * Menghitung metrik ringkasan eksekutif Klassa Pulse
 */
export async function getPulseSummaryMetrics(
  period?: string,
  schoolId?: string
): Promise<PulseSummaryMetrics> {
  const activePeriod = period || getCurrentPeriodKey();
  const whereClause: any = { period: activePeriod };
  if (schoolId) {
    whereClause.schoolId = schoolId;
  }

  const aggregates = await prisma.agentInsightAggregate.findMany({
    where: whereClause,
  });

  if (aggregates.length === 0) {
    return {
      totalInsights: 0,
      burnoutIndex: 25,
      burnoutLevel: "AMAN",
      peakActiveHours: "14:00 - 16:00 WIB",
      topStruggleTopic: "Belum ada data periode ini",
    };
  }

  let totalInsights = 0;
  let burnoutScoreSum = 0;
  let burnoutCount = 0;

  // Analisis jam operasional
  const hourFrequency: Record<number, number> = {};

  // Analisis isu tertinggi
  const struggleFrequency: Record<string, number> = {};

  for (const row of aggregates) {
    totalInsights += row.sampleCount;

    if (row.category === "BURNOUT_RISK") {
      burnoutScoreSum += row.metricValue * row.sampleCount;
      burnoutCount += row.sampleCount;
    }

    if (row.category === "OPERATIONAL_HOURS") {
      const hour = parseInt(row.metricKey, 10);
      if (!isNaN(hour)) {
        hourFrequency[hour] = (hourFrequency[hour] || 0) + row.sampleCount;
      }
    }

    if (row.category === "STUDENT_STRUGGLE") {
      struggleFrequency[row.metricKey] =
        (struggleFrequency[row.metricKey] || 0) + row.sampleCount;
    }
  }

  const avgBurnout = burnoutCount > 0 ? Math.round(burnoutScoreSum / burnoutCount) : 32;
  const burnoutLevel: "AMAN" | "WASPADA" | "TINGGI" =
    avgBurnout > 65 ? "TINGGI" : avgBurnout > 40 ? "WASPADA" : "AMAN";

  // Temukan jam puncak
  let peakHour = 20;
  let maxHourFreq = -1;
  for (const [hStr, freq] of Object.entries(hourFrequency)) {
    if (freq > maxHourFreq) {
      maxHourFreq = freq;
      peakHour = parseInt(hStr, 10);
    }
  }

  const peakEndHour = (peakHour + 2) % 24;
  const peakActiveHours = `${String(peakHour).padStart(2, "0")}:00 - ${String(
    peakEndHour
  ).padStart(2, "0")}:00 WIB`;

  // Temukan struggle tertinggi
  let topTopic = "Literasi & Pemahaman Bacaan";
  let maxStruggle = -1;
  for (const [topic, freq] of Object.entries(struggleFrequency)) {
    if (freq > maxStruggle) {
      maxStruggle = freq;
      topTopic = topic;
    }
  }

  return {
    totalInsights,
    burnoutIndex: avgBurnout,
    burnoutLevel,
    peakActiveHours,
    topStruggleTopic: topTopic,
  };
}

/**
 * Top 10 Isu Ruang Kelas Indonesia
 */
export async function getTopClassroomStruggles(
  limit: number = 6,
  period?: string,
  schoolId?: string
): Promise<ClassroomStruggleItem[]> {
  const activePeriod = period || getCurrentPeriodKey();
  const whereClause: any = {
    period: activePeriod,
    category: "STUDENT_STRUGGLE",
  };
  if (schoolId) whereClause.schoolId = schoolId;

  const rows = await prisma.agentInsightAggregate.findMany({
    where: whereClause,
  });

  if (rows.length === 0) {
    return [
      { topic: "Literasi Bacaan & Kosakata Rendah", frequency: 48, percentage: 32, category: "Pedagogi" },
      { topic: "Siswa Pasif / Sulit Terlibat Diskusi", frequency: 36, percentage: 24, category: "Manajemen Kelas" },
      { topic: "Konsentrasi Belajar Singkat (Gawai)", frequency: 28, percentage: 19, category: "Fokus & Disiplin" },
      { topic: "Kesulitan Berhitung Dasar (Numerasi)", frequency: 22, percentage: 15, category: "Kognitif" },
      { topic: "Keterlambatan Pengumpulan Tugas", frequency: 16, percentage: 10, category: "Administrasi" },
    ];
  }

  const freqMap: Record<string, { count: number; category: string }> = {};
  let totalCount = 0;

  for (const r of rows) {
    totalCount += r.sampleCount;
    const cat = r.tags && r.tags.length > 0 ? r.tags[0] : "Umum";
    if (!freqMap[r.metricKey]) {
      freqMap[r.metricKey] = { count: 0, category: cat };
    }
    freqMap[r.metricKey].count += r.sampleCount;
  }

  const sorted = Object.entries(freqMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit);

  return sorted.map(([topic, data]) => ({
    topic,
    frequency: data.count,
    percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
    category: data.category,
  }));
}

/**
 * Titik Rawan Materi Ajar (Curriculum Bottlenecks)
 */
export async function getCurriculumBottlenecks(
  limit: number = 6,
  period?: string,
  schoolId?: string
): Promise<CurriculumBottleneckItem[]> {
  const activePeriod = period || getCurrentPeriodKey();
  const whereClause: any = {
    period: activePeriod,
    category: "CURRICULUM_BOTTLENECK",
  };
  if (schoolId) whereClause.schoolId = schoolId;

  const rows = await prisma.agentInsightAggregate.findMany({
    where: whereClause,
  });

  if (rows.length === 0) {
    return [
      { subject: "Matematika", topic: "Pecahan Aljabar & Persamaan Linear", gradeLevel: "SMP", frequency: 54, struggleRate: 78 },
      { subject: "Fisika / IPA", topic: "Hukum Newton & Dinamika Gerak", gradeLevel: "SMP", frequency: 42, struggleRate: 72 },
      { subject: "Bahasa Inggris", topic: "Passive Voice & Tenses Kompleks", gradeLevel: "SMA", frequency: 38, struggleRate: 65 },
      { subject: "Kimia", topic: "Stoikiometri & Konsep Mol", gradeLevel: "SMA", frequency: 31, struggleRate: 84 },
      { subject: "Informatika", topic: "Logika Percabangan & Algoritma Dasar", gradeLevel: "SMK", frequency: 27, struggleRate: 59 },
    ];
  }

  const map: Record<string, CurriculumBottleneckItem> = {};

  for (const r of rows) {
    const meta = (r.metadata as any) || {};
    const subject = meta.subject || (r.tags && r.tags[0]) || "Umum";
    const gradeLevel = meta.gradeLevel || (r.tags && r.tags[1]) || "SMP";
    const key = `${subject}-${r.metricKey}`;

    if (!map[key]) {
      map[key] = {
        subject,
        topic: r.metricKey,
        gradeLevel,
        frequency: 0,
        struggleRate: Math.min(100, Math.round(r.metricValue)),
      };
    }
    map[key].frequency += r.sampleCount;
  }

  return Object.values(map)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}

/**
 * Matriks Jam Aktivitas Guru 7 Hari x 24 Jam (Heatmap)
 */
export async function getActivityHeatmapData(
  period?: string,
  schoolId?: string
): Promise<ActivityHeatmapSlot[]> {
  const activePeriod = period || getCurrentPeriodKey();
  const whereClause: any = {
    period: activePeriod,
    category: "OPERATIONAL_HOURS",
  };
  if (schoolId) whereClause.schoolId = schoolId;

  const rows = await prisma.agentInsightAggregate.findMany({
    where: whereClause,
  });

  // Inisialisasi slot 7 hari x 24 jam (0 = Minggu s/d 6 = Sabtu)
  const grid: Record<string, number> = {};
  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < 24; h++) {
      grid[`${day}-${h}`] = 0;
    }
  }

  if (rows.length === 0) {
    // Pola jam realistis default guru Indonesia jika DB kosong:
    // Puncak 1: Siang di sekolah (10-14 WIB)
    // Puncak 2: Malam lembur koreksi/RPP (19-22 WIB)
    for (let day = 1; day <= 5; day++) {
      grid[`${day}-10`] = 12;
      grid[`${day}-11`] = 18;
      grid[`${day}-13`] = 15;
      grid[`${day}-19`] = 14;
      grid[`${day}-20`] = 24;
      grid[`${day}-21`] = 20;
      grid[`${day}-22`] = 9;
    }
  } else {
    for (const r of rows) {
      const meta = (r.metadata as any) || {};
      const day = meta.dayOfWeek !== undefined ? Number(meta.dayOfWeek) : 1;
      const hour = parseInt(r.metricKey, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23 && day >= 0 && day <= 6) {
        grid[`${day}-${hour}`] = (grid[`${day}-${hour}`] || 0) + r.sampleCount;
      }
    }
  }

  // Hitung nilai maksimum untuk normalisasi intensitas (0-4)
  const maxVal = Math.max(1, ...Object.values(grid));

  const slots: ActivityHeatmapSlot[] = [];
  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < 24; h++) {
      const count = grid[`${day}-${h}`] || 0;
      let intensity = 0;
      if (count > 0) {
        const ratio = count / maxVal;
        intensity = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      }
      slots.push({ dayOfWeek: day, hour: h, intensity, count });
    }
  }

  return slots;
}

/**
 * Mengambil paket lengkap analitik Klassa Pulse
 */
export async function getKlassaPulseAnalytics(
  period?: string,
  schoolId?: string
): Promise<KlassaPulseAnalyticsResponse> {
  const activePeriod = period || getCurrentPeriodKey();

  const [summary, topStruggles, curriculumBottlenecks, heatmap] =
    await Promise.all([
      getPulseSummaryMetrics(activePeriod, schoolId),
      getTopClassroomStruggles(6, activePeriod, schoolId),
      getCurriculumBottlenecks(6, activePeriod, schoolId),
      getActivityHeatmapData(activePeriod, schoolId),
    ]);

  return {
    summary,
    topStruggles,
    curriculumBottlenecks,
    heatmap,
    period: activePeriod,
  };
}

/**
 * Seeding data sampel agregat realistis untuk inisialisasi awal / evaluasi demo
 */
export async function seedPulseDemoData(schoolId?: string): Promise<{ count: number }> {
  const period = getCurrentPeriodKey();

  const sampleData: RecordAnonymizedInsightInput[] = [
    // 1. Isu Kelas
    { category: "STUDENT_STRUGGLE", metricKey: "Literasi Bacaan & Kosakata Rendah", metricValue: 85, sampleCount: 48, tags: ["Pedagogi", "SMP"], period, schoolId },
    { category: "STUDENT_STRUGGLE", metricKey: "Siswa Pasif / Sulit Terlibat Diskusi", metricValue: 70, sampleCount: 36, tags: ["Manajemen Kelas", "SMA"], period, schoolId },
    { category: "STUDENT_STRUGGLE", metricKey: "Konsentrasi Belajar Singkat (Gawai)", metricValue: 65, sampleCount: 28, tags: ["Disiplin", "SD"], period, schoolId },
    { category: "STUDENT_STRUGGLE", metricKey: "Kesulitan Berhitung Dasar (Numerasi)", metricValue: 60, sampleCount: 22, tags: ["Kognitif", "SD"], period, schoolId },
    { category: "STUDENT_STRUGGLE", metricKey: "Keterlambatan Pengumpulan Tugas", metricValue: 40, sampleCount: 16, tags: ["Administrasi", "SMP"], period, schoolId },

    // 2. Hambatan Kurikulum
    { category: "CURRICULUM_BOTTLENECK", metricKey: "Pecahan Aljabar & Persamaan Linear", metricValue: 78, sampleCount: 54, tags: ["Matematika", "SMP"], metadata: { subject: "Matematika", gradeLevel: "SMP" }, period, schoolId },
    { category: "CURRICULUM_BOTTLENECK", metricKey: "Hukum Newton & Dinamika Gerak", metricValue: 72, sampleCount: 42, tags: ["Fisika / IPA", "SMP"], metadata: { subject: "Fisika / IPA", gradeLevel: "SMP" }, period, schoolId },
    { category: "CURRICULUM_BOTTLENECK", metricKey: "Passive Voice & Tenses Kompleks", metricValue: 65, sampleCount: 38, tags: ["Bahasa Inggris", "SMA"], metadata: { subject: "Bahasa Inggris", gradeLevel: "SMA" }, period, schoolId },
    { category: "CURRICULUM_BOTTLENECK", metricKey: "Stoikiometri & Konsep Mol", metricValue: 84, sampleCount: 31, tags: ["Kimia", "SMA"], metadata: { subject: "Kimia", gradeLevel: "SMA" }, period, schoolId },
    { category: "CURRICULUM_BOTTLENECK", metricKey: "Logika Percabangan & Algoritma Dasar", metricValue: 59, sampleCount: 27, tags: ["Informatika", "SMK"], metadata: { subject: "Informatika", gradeLevel: "SMK" }, period, schoolId },

    // 3. Burnout Risk
    { category: "BURNOUT_RISK", metricKey: "Koreksi Tugas Menumpuk", metricValue: 55, sampleCount: 30, tags: ["Administrasi"], period, schoolId },
    { category: "BURNOUT_RISK", metricKey: "Persiapan Format Modul Ajar", metricValue: 42, sampleCount: 25, tags: ["Kurikulum"], period, schoolId },

    // 4. Jam Operasional (Heatmap peak hours 20 & 21)
    { category: "OPERATIONAL_HOURS", metricKey: "10", metricValue: 1, sampleCount: 15, metadata: { dayOfWeek: 1 }, period, schoolId },
    { category: "OPERATIONAL_HOURS", metricKey: "13", metricValue: 1, sampleCount: 20, metadata: { dayOfWeek: 2 }, period, schoolId },
    { category: "OPERATIONAL_HOURS", metricKey: "20", metricValue: 1, sampleCount: 35, metadata: { dayOfWeek: 3 }, period, schoolId },
    { category: "OPERATIONAL_HOURS", metricKey: "21", metricValue: 1, sampleCount: 28, metadata: { dayOfWeek: 4 }, period, schoolId },
  ];

  for (const item of sampleData) {
    await recordAnonymizedInsight(item);
  }

  return { count: sampleData.length };
}
