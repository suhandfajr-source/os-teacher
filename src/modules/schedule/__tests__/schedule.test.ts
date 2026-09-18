import { describe, it, expect } from "vitest";
import {
  getNormalizedDayOfWeek,
  getCurrentTimeString,
  getDayNameIndonesia,
} from "@/lib/schedule-date-utils";
import {
  CreateScheduleSlotSchema,
  normalizeTime,
} from "../schedule.schema";

describe("Teaching Schedule Engine - Unit Tests", () => {
  describe("Schedule Date Utils", () => {
    it("should correctly map days to Indonesian 1-7 dayOfWeek", () => {
      // 2025-09-15 is Monday
      const monday = new Date("2025-09-15T09:00:00Z");
      expect(getNormalizedDayOfWeek(monday)).toBe(1);

      // 2025-09-20 is Saturday
      const saturday = new Date("2025-09-20T09:00:00Z");
      expect(getNormalizedDayOfWeek(saturday)).toBe(6);

      // 2025-09-21 is Sunday
      const sunday = new Date("2025-09-21T09:00:00Z");
      expect(getNormalizedDayOfWeek(sunday)).toBe(7);
    });

    it("should return correct Indonesian day names", () => {
      expect(getDayNameIndonesia(1)).toBe("Senin");
      expect(getDayNameIndonesia(2)).toBe("Selasa");
      expect(getDayNameIndonesia(3)).toBe("Rabu");
      expect(getDayNameIndonesia(4)).toBe("Kamis");
      expect(getDayNameIndonesia(5)).toBe("Jumat");
      expect(getDayNameIndonesia(6)).toBe("Sabtu");
      expect(getDayNameIndonesia(7)).toBe("Minggu");
      expect(getDayNameIndonesia(99)).toBe("Senin"); // fallback
    });

    it("should format current time string correctly", () => {
      const fixedTime = new Date("2025-09-15T07:30:00Z");
      const timeStr = getCurrentTimeString(fixedTime, "UTC");
      expect(timeStr).toBe("07:30");
    });
  });

  describe("Schedule Schema Validation", () => {
    it("should normalize single-digit hour to zero-padded HH:mm", () => {
      expect(normalizeTime("7:30")).toBe("07:30");
      expect(normalizeTime("08:15")).toBe("08:15");
      expect(normalizeTime(" 9:00 ")).toBe("09:00");
    });

    it("should validate correct schedule slot inputs", () => {
      const validPayload = {
        teachingContextId: "tc_12345",
        dayOfWeek: 1,
        startTime: "07:30",
        endTime: "09:00",
        room: "Ruang 8A",
      };

      const result = CreateScheduleSlotSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe("07:30");
        expect(result.data.endTime).toBe("09:00");
      }
    });

    it("should auto-pad single digit hours in schema parsing", () => {
      const payload = {
        teachingContextId: "tc_12345",
        dayOfWeek: 2,
        startTime: "7:00",
        endTime: "8:30",
      };

      const result = CreateScheduleSlotSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe("07:00");
        expect(result.data.endTime).toBe("08:30");
      }
    });

    it("should reject when endTime <= startTime", () => {
      const invalidPayload = {
        teachingContextId: "tc_12345",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "07:30",
      };

      const result = CreateScheduleSlotSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorIssues = result.error.issues;
        expect(
          errorIssues.some((i) =>
            i.message.includes("Jam selesai harus lebih akhir")
          )
        ).toBe(true);
      }
    });

    it("should reject invalid day of week", () => {
      const invalidPayload = {
        teachingContextId: "tc_12345",
        dayOfWeek: 0,
        startTime: "07:30",
        endTime: "09:00",
      };

      const result = CreateScheduleSlotSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid time format", () => {
      const invalidPayload = {
        teachingContextId: "tc_12345",
        dayOfWeek: 1,
        startTime: "25:00",
        endTime: "09:00",
      };

      const result = CreateScheduleSlotSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Anti-Collision Overlap Logic", () => {
    const isColliding = (
      newStart: string,
      newEnd: string,
      existingStart: string,
      existingEnd: string
    ) => {
      return newStart < existingEnd && newEnd > existingStart;
    };

    it("should detect exact overlap", () => {
      expect(isColliding("07:30", "09:00", "07:30", "09:00")).toBe(true);
    });

    it("should detect partial overlap (new starts inside existing)", () => {
      expect(isColliding("08:00", "09:30", "07:30", "09:00")).toBe(true);
    });

    it("should detect partial overlap (new ends inside existing)", () => {
      expect(isColliding("07:00", "08:00", "07:30", "09:00")).toBe(true);
    });

    it("should detect containment (new is completely inside existing)", () => {
      expect(isColliding("08:00", "08:30", "07:30", "09:00")).toBe(true);
    });

    it("should allow non-overlapping back-to-back schedules", () => {
      // Slot 1: 07.30 - 09.00, Slot 2: 09.00 - 10.30 (Back to back, not colliding)
      expect(isColliding("09:00", "10:30", "07:30", "09:00")).toBe(false);
      expect(isColliding("06:00", "07:30", "07:30", "09:00")).toBe(false);
    });

    it("should allow completely disjoint schedules", () => {
      expect(isColliding("13:00", "14:30", "07:30", "09:00")).toBe(false);
    });
  });
});
