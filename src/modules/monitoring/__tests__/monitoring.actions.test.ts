import { describe, it, expect } from "vitest";
import {
  createMonitoringNoteSchema,
  updateMonitoringNoteSchema,
  resolveMonitoringFollowUpSchema,
  archiveMonitoringNoteSchema,
} from "../monitoring.types";

describe("Stage 05 Monitoring Actions & Schema Validation Tests", () => {
  describe("Zod Validation Schemas", () => {
    it("validates createMonitoringNoteSchema correctly", () => {
      const valid = {
        teachingContextId: "ctx-1",
        studentId: "s-1",
        content: "Ananda aktif dalam diskusi kelompok.",
        requiresFollowUp: false,
      };
      const parsed = createMonitoringNoteSchema.parse(valid);
      expect(parsed.content).toBe("Ananda aktif dalam diskusi kelompok.");
      expect(parsed.requiresFollowUp).toBe(false);
    });

    it("rejects empty content in createMonitoringNoteSchema", () => {
      const invalid = {
        teachingContextId: "ctx-1",
        studentId: "s-1",
        content: "   ",
        requiresFollowUp: false,
      };
      expect(() => createMonitoringNoteSchema.parse(invalid)).toThrow();
    });

    it("rejects content exceeding 2000 characters", () => {
      const invalid = {
        teachingContextId: "ctx-1",
        studentId: "s-1",
        content: "a".repeat(2001),
        requiresFollowUp: false,
      };
      expect(() => createMonitoringNoteSchema.parse(invalid)).toThrow();
    });

    it("validates updateMonitoringNoteSchema correctly", () => {
      const valid = {
        noteId: "note-1",
        content: "Perlu bimbingan ulang konsep pecahan senilai.",
        requiresFollowUp: true,
      };
      const parsed = updateMonitoringNoteSchema.parse(valid);
      expect(parsed.requiresFollowUp).toBe(true);
    });

    it("validates resolveMonitoringFollowUpSchema correctly", () => {
      const validTrue = { noteId: "note-1", resolved: true };
      const parsedTrue = resolveMonitoringFollowUpSchema.parse(validTrue);
      expect(parsedTrue.resolved).toBe(true);

      const validFalse = { noteId: "note-1", resolved: false };
      const parsedFalse = resolveMonitoringFollowUpSchema.parse(validFalse);
      expect(parsedFalse.resolved).toBe(false);
    });

    it("validates archiveMonitoringNoteSchema correctly", () => {
      const valid = { noteId: "note-1" };
      const parsed = archiveMonitoringNoteSchema.parse(valid);
      expect(parsed.noteId).toBe("note-1");
    });
  });
});
