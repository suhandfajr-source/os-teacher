import { z } from "zod";

export const PulseCategoryEnum = z.enum([
  "CURRICULUM_BOTTLENECK",
  "BURNOUT_RISK",
  "STUDENT_STRUGGLE",
  "OPERATIONAL_HOURS",
]);

export type PulseCategory = z.infer<typeof PulseCategoryEnum>;

export interface RecordAnonymizedInsightInput {
  schoolId?: string;
  period: string; // e.g., "2026-W40" or "2026-10"
  category: PulseCategory;
  metricKey: string;
  metricValue: number;
  sampleCount?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface PulseSummaryMetrics {
  totalInsights: number;
  burnoutIndex: number; // 0 - 100
  burnoutLevel: "AMAN" | "WASPADA" | "TINGGI";
  peakActiveHours: string; // e.g. "20:00 - 22:00 WIB"
  topStruggleTopic: string;
}

export interface ClassroomStruggleItem {
  topic: string;
  frequency: number;
  percentage: number;
  category: string;
}

export interface CurriculumBottleneckItem {
  subject: string;
  topic: string;
  gradeLevel: string; // "SD" | "SMP" | "SMA" | "SMK"
  frequency: number;
  struggleRate: number; // persentase kesulitan
}

export interface ActivityHeatmapSlot {
  dayOfWeek: number; // 0 (Minggu) - 6 (Sabtu)
  hour: number; // 0 - 23
  intensity: number; // 0 - 4 (intensitas visual)
  count: number;
}

export interface KlassaPulseAnalyticsResponse {
  summary: PulseSummaryMetrics;
  topStruggles: ClassroomStruggleItem[];
  curriculumBottlenecks: CurriculumBottleneckItem[];
  heatmap: ActivityHeatmapSlot[];
  period: string;
}
