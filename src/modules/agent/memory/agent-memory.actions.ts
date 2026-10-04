"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { DEFAULT_AGENT_MODEL } from "../agent.config";
import {
  UpdateTeacherMemorySchema,
  UpdateTeacherMemoryInput,
  TeacherMemoryDTO,
} from "./agent-memory.types";

const DEFAULT_MEMORY: Omit<TeacherMemoryDTO, "teacherProfileId"> = {
  communicationTone: "RAMAH_SOPAN",
  preferredModel: DEFAULT_AGENT_MODEL,
  pedagogyDefaults: {
    curriculumFocus: "Kurikulum Merdeka",
  },
  customContext: null,
};

/**
 * Mengambil preferensi memori personal guru yang sedang login
 */
export async function getTeacherAgentMemoryAction(): Promise<{
  success: boolean;
  data: TeacherMemoryDTO;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const memory = await prisma.teacherAgentMemory.findUnique({
      where: {
        teacherProfileId: profile.id,
      },
    });

    if (!memory) {
      return {
        success: true,
        data: {
          teacherProfileId: profile.id,
          ...DEFAULT_MEMORY,
        },
      };
    }

    return {
      success: true,
      data: {
        id: memory.id,
        teacherProfileId: memory.teacherProfileId,
        communicationTone: memory.communicationTone as any,
        preferredModel: memory.preferredModel,
        pedagogyDefaults: (memory.pedagogyDefaults as any) || DEFAULT_MEMORY.pedagogyDefaults,
        customContext: memory.customContext,
        updatedAt: memory.updatedAt,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: {
        teacherProfileId: "",
        ...DEFAULT_MEMORY,
      },
      error:
        error instanceof Error
          ? error.message
          : "Gagal memuat preferensi memori guru.",
    };
  }
}

/**
 * Memperbarui preferensi memori personal guru
 */
export async function updateTeacherAgentMemoryAction(
  input: UpdateTeacherMemoryInput
): Promise<{
  success: boolean;
  message: string;
  data?: TeacherMemoryDTO;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const parsed = UpdateTeacherMemorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: "Data preferensi tidak valid",
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { communicationTone, preferredModel, pedagogyDefaults, customContext } =
      parsed.data;

    let finalPedagogy = pedagogyDefaults;
    if (pedagogyDefaults) {
      const existing = await prisma.teacherAgentMemory.findUnique({
        where: { teacherProfileId: profile.id },
        select: { pedagogyDefaults: true },
      });
      if (existing?.pedagogyDefaults && typeof existing.pedagogyDefaults === "object") {
        finalPedagogy = {
          ...(existing.pedagogyDefaults as Record<string, unknown>),
          ...pedagogyDefaults,
        };
      }
    }

    const upserted = await prisma.teacherAgentMemory.upsert({
      where: {
        teacherProfileId: profile.id,
      },
      create: {
        teacherProfileId: profile.id,
        communicationTone: communicationTone || DEFAULT_MEMORY.communicationTone,
        preferredModel: preferredModel || DEFAULT_MEMORY.preferredModel,
        pedagogyDefaults: finalPedagogy || (DEFAULT_MEMORY.pedagogyDefaults as any),
        customContext: customContext || null,
      },
      update: {
        ...(communicationTone ? { communicationTone } : {}),
        ...(preferredModel ? { preferredModel } : {}),
        ...(finalPedagogy ? { pedagogyDefaults: finalPedagogy as any } : {}),
        ...(customContext !== undefined ? { customContext } : {}),
      },
    });

    return {
      success: true,
      message: "Preferensi memori Klassa Agent berhasil diperbarui.",
      data: {
        id: upserted.id,
        teacherProfileId: upserted.teacherProfileId,
        communicationTone: upserted.communicationTone as any,
        preferredModel: upserted.preferredModel,
        pedagogyDefaults: (upserted.pedagogyDefaults as any) || DEFAULT_MEMORY.pedagogyDefaults,
        customContext: upserted.customContext,
        updatedAt: upserted.updatedAt,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "Gagal menyimpan preferensi memori guru.",
      error: error instanceof Error ? error.message : "Kesalahan server internal.",
    };
  }
}

/**
 * Mereset memori personal guru kembali ke konfigurasi default sistem
 */
export async function resetTeacherAgentMemoryAction(): Promise<{
  success: boolean;
  message: string;
  data?: TeacherMemoryDTO;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const resetMemory = await prisma.teacherAgentMemory.upsert({
      where: {
        teacherProfileId: profile.id,
      },
      create: {
        teacherProfileId: profile.id,
        ...DEFAULT_MEMORY,
        pedagogyDefaults: DEFAULT_MEMORY.pedagogyDefaults as any,
      },
      update: {
        communicationTone: DEFAULT_MEMORY.communicationTone,
        preferredModel: DEFAULT_MEMORY.preferredModel,
        pedagogyDefaults: DEFAULT_MEMORY.pedagogyDefaults as any,
        customContext: null,
      },
    });

    return {
      success: true,
      message: "Memori dan preferensi Klassa Agent berhasil direset ke setelan awal.",
      data: {
        id: resetMemory.id,
        teacherProfileId: resetMemory.teacherProfileId,
        communicationTone: resetMemory.communicationTone as any,
        preferredModel: resetMemory.preferredModel,
        pedagogyDefaults: resetMemory.pedagogyDefaults as any,
        customContext: resetMemory.customContext,
        updatedAt: resetMemory.updatedAt,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "Gagal mereset memori guru.",
      error: error instanceof Error ? error.message : "Kesalahan server internal.",
    };
  }
}
