import { z } from "zod";

export const CommunicationToneEnum = z.enum([
  "RAMAH_SOPAN",
  "LUGAS_RINGKAS",
  "FORMAL",
]);
export type CommunicationTone = z.infer<typeof CommunicationToneEnum>;

export const PedagogyDefaultsSchema = z.object({
  curriculumFocus: z.string().optional().default("Kurikulum Merdeka"),
  preferredStrategy: z.string().optional(), // misal: "Diferensiasi Konten", "PBL", "Inquiry-based"
  assessmentStyle: z.string().optional(), // misal: "Formatif Reflektif", "Rubrik Holistik"
  targetGradeLevels: z.array(z.string()).optional(),
});
export type PedagogyDefaults = z.infer<typeof PedagogyDefaultsSchema>;

export const ALLOWED_AGENT_MODEL_IDS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "hermes-local",
] as const;
export type AllowedAgentModelId = (typeof ALLOWED_AGENT_MODEL_IDS)[number];

export const UpdateTeacherMemorySchema = z.object({
  communicationTone: CommunicationToneEnum.optional(),
  preferredModel: z.enum(ALLOWED_AGENT_MODEL_IDS).optional(),
  pedagogyDefaults: PedagogyDefaultsSchema.optional(),
  customContext: z
    .string()
    .max(2000, "Catatan kustom tidak boleh melebihi 2000 karakter")
    .optional()
    .nullable(),
});
export type UpdateTeacherMemoryInput = z.infer<typeof UpdateTeacherMemorySchema>;

export interface TeacherMemoryDTO {
  id?: string;
  teacherProfileId: string;
  communicationTone: CommunicationTone;
  preferredModel: string;
  pedagogyDefaults: PedagogyDefaults;
  customContext: string | null;
  updatedAt?: Date;
}
