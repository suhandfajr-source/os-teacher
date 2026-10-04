import { tool } from "ai";
import { z } from "zod";
import { updateTeacherAgentMemoryAction } from "./agent-memory.actions";
import {
  CommunicationToneEnum,
  ALLOWED_AGENT_MODEL_IDS,
} from "./agent-memory.types";

export const updateTeacherMemoryPreferenceSchema = z.object({
  communicationTone: CommunicationToneEnum.optional().describe(
    "Gaya komunikasi: RAMAH_SOPAN (hangat & empatik), LUGAS_RINGKAS (padat & to the point), atau FORMAL (kedinasan)."
  ),
  preferredModel: z
    .enum(ALLOWED_AGENT_MODEL_IDS)
    .optional()
    .describe("Model AI yang disukai guru (gemini-1.5-flash, gemini-1.5-pro, hermes-local)."),
  curriculumFocus: z
    .string()
    .optional()
    .describe("Fokus kurikulum mengajar, misal: Kurikulum Merdeka atau KTSP."),
  customNoteToRemember: z
    .string()
    .max(2000)
    .optional()
    .describe(
      "Catatan gaya ajar atau kebiasaan guru yang diminta secara eksplisit untuk diingat oleh asisten."
    ),
});

export type UpdateTeacherMemoryPreferenceInput = z.infer<
  typeof updateTeacherMemoryPreferenceSchema
>;

/**
 * Tool AI SDK v7: Memperbarui memori preferensi personal guru atas permintaan eksplisit guru
 */
export const updateTeacherMemoryPreferenceTool = tool({
  description:
    "Memperbarui setelan preferensi memori personal guru (gaya bahasa, model AI, kurikulum, atau catatan khusus ajar) jika guru memintanya secara eksplisit dalam percakapan.",
  inputSchema: updateTeacherMemoryPreferenceSchema,
  execute: async ({
    communicationTone,
    preferredModel,
    curriculumFocus,
    customNoteToRemember,
  }: UpdateTeacherMemoryPreferenceInput) => {
    try {
      const result = await updateTeacherAgentMemoryAction({
        communicationTone,
        preferredModel,
        ...(curriculumFocus
          ? {
              pedagogyDefaults: {
                curriculumFocus,
              },
            }
          : {}),
        ...(customNoteToRemember ? { customContext: customNoteToRemember } : {}),
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || result.message,
        };
      }

      return {
        success: true,
        message:
          "Preferensi memori Anda telah berhasil disimpan. Saya akan menyesuaikan tanggapan saya ke depannya.",
        updatedPreferences: {
          tone: result.data?.communicationTone,
          model: result.data?.preferredModel,
          customNote: result.data?.customContext,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui preferensi memori.",
      };
    }
  },
});
