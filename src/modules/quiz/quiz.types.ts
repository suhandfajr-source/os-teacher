/**
 * QUIZ ONLINE MODULE — Types & Validation Schemas (MVP: MCQ, self-paced)
 */
import { z } from "zod";

// ----------------------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------------------

export const quizQuestionSchema = z.object({
  type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "ESSAY"]).default("MULTIPLE_CHOICE"),
  text: z.string().min(3, "Teks soal terlalu pendek").max(2000),
  options: z.array(z.string().max(500)).max(6).default([]),
  correctIndex: z.number().int().min(0).optional().nullable(),
  points: z.number().positive().max(100).default(1),
  explanation: z.string().max(2000).optional(),
});

export const createQuizSchema = z.object({
  teachingContextId: z.string().min(1),
  title: z.string().min(3, "Judul quiz terlalu pendek").max(200),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(240).optional(),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  standardScore: z.number().min(0).max(100).optional(),
  validFrom: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  accessMode: z.enum(["CLASSROOM_PIN", "INDIVIDUAL_PIN"]).default("CLASSROOM_PIN"),
  questions: z.array(quizQuestionSchema).min(1, "Quiz minimal memiliki 1 soal").max(100),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const quizSettingsSchema = z.object({
  quizId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(240).optional(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  standardScore: z.number().min(0).max(100).optional(),
  validFrom: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  accessMode: z.enum(["CLASSROOM_PIN", "INDIVIDUAL_PIN"]),
});

export const submitAttemptSchema = z.object({
  token: z.string().min(10),
  studentId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedIndex: z.number().int().min(0).max(5).optional().nullable(),
        essayAnswer: z.string().max(10_000).optional().nullable(),
      })
    )
    .max(100),
});

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------

export interface StudentQuizQuestionView {
  id: string;
  order: number;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  /** Options in attempt-specific shuffled order; index maps to selectedIndex. */
  options: string[];
  points: number;
}

export interface PublicQuizView {
  title: string;
  description?: string;
  durationMinutes?: number;
  status: string;
  isUpcoming: boolean;
  validFrom?: string;
  deadline?: string;
  isDeadlinePassed: boolean;
  standardScore?: number;
  questionCount: number;
  totalPoints: number;
  roster: Array<{ id: string; fullName: string }>;
  pinRequired: boolean;
  accessMode: "CLASSROOM_PIN" | "INDIVIDUAL_PIN";
}

export interface AttemptResultView {
  score: number;
  totalPoints: number;
  passed: boolean;
  isRemedial: boolean;
  needsGrading: boolean;
  submittedAt: string;
  perQuestion: Array<{
    questionText: string;
    type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    selectedIndex: number | null;
    essayAnswer?: string | null;
    isCorrect: boolean | null;
    pointsEarned: number;
    pointsMax: number;
    feedback?: string | null;
  }>;
}
