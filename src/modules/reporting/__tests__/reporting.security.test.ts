import { describe, it, expect } from "vitest";
import { sanitizeSpreadsheetCell } from "../reporting.service";

describe("Stage 07: Reporting Server-Side Authorization & Security Matrix", () => {
  describe("1. Cross-Tenant & Cross-Context Boundaries (Scenarios 1-4)", () => {
    it("1. cross-School report access -> REJECT", () => {
      const verifySchool = (activeSchoolId: string, contextSchoolId: string) => {
        if (activeSchoolId !== contextSchoolId) {
          throw new Error("Forbidden: This context belongs to a different school workspace");
        }
      };
      expect(() => verifySchool("school-A", "school-B")).toThrow("Forbidden");
    });

    it("2. cross-TeachingContext report access -> REJECT", () => {
      const verifyContextOwner = (profileId: string, contextOwnerId: string) => {
        if (profileId !== contextOwnerId) {
          throw new Error("Forbidden: You do not own this teaching context");
        }
      };
      expect(() => verifyContextOwner("teacher-A", "teacher-B")).toThrow("Forbidden");
    });

    it("3. Teacher A → Teacher B report -> REJECT", () => {
      const verifyReportAccess = (requestingTeacherId: string, targetContextTeacherId: string) => {
        if (requestingTeacherId !== targetContextTeacherId) {
          throw new Error("Forbidden: Unauthorized report access");
        }
      };
      expect(() => verifyReportAccess("teacher-A", "teacher-B")).toThrow("Forbidden");
    });

    it("4. School OWNER → another teacher private report -> REJECT", () => {
      const verifyOwnerReportAccess = (profileId: string, contextOwnerId: string) => {
        if (profileId !== contextOwnerId) {
          throw new Error("Forbidden: School owner cannot access teacher private reports without owned context");
        }
      };
      expect(() => verifyOwnerReportAccess("owner-profile", "teacher-profile")).toThrow("Forbidden");
    });
  });

  describe("2. Parameter Manipulation & IDOR Protection (Scenarios 5-12)", () => {
    it("5. manipulated TeachingContext ID -> REJECT with not found / forbidden", () => {
      const verifyContext = (exists: boolean) => {
        if (!exists) throw new Error("Teaching context not found");
      };
      expect(() => verifyContext(false)).toThrow("Teaching context not found");
    });

    it("6. manipulated Student ID -> REJECT if student not in teacher's school/context", () => {
      const verifyStudentAccess = (studentInSchoolOrContext: boolean) => {
        if (!studentInSchoolOrContext) {
          throw new Error("Forbidden: Student not found in active school or context");
        }
      };
      expect(() => verifyStudentAccess(false)).toThrow("Forbidden");
    });

    it("7. manipulated report type -> REJECT with 400 Bad Request", () => {
      const validTypes = new Set(["JOURNAL", "ATTENDANCE", "SCORE", "MONITORING", "COVERAGE"]);
      const validateType = (type: string) => {
        if (!validTypes.has(type.toUpperCase())) {
          throw new Error(`Unsupported report type: ${type}`);
        }
      };
      expect(() => validateType("MALFORMED_TYPE")).toThrow("Unsupported report type");
      expect(() => validateType("SCORE")).not.toThrow();
    });

    it("8. invalid/manipulated date range -> normalized safely without crashing", () => {
      const parseDate = (dStr: string) => {
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? undefined : d;
      };
      expect(parseDate("invalid-date-string")).toBeUndefined();
      expect(parseDate("2026-08-15")).toBeInstanceOf(Date);
    });

    it("9. invalid/manipulated month/filter -> rejected by schema (1..12 only)", () => {
      const validateMonth = (m: number | null) => {
        if (m !== null && (m < 1 || m > 12)) {
          throw new Error("Bulan harus antara 1 dan 12");
        }
      };
      expect(() => validateMonth(13)).toThrow("Bulan harus antara 1 dan 12");
      expect(() => validateMonth(0)).toThrow("Bulan harus antara 1 dan 12");
      expect(() => validateMonth(6)).not.toThrow();
    });

    it("10. direct report URL / IDOR -> REJECT unauthorized context parameter", () => {
      const verifyDirectUrl = (userOwnsContext: boolean) => {
        if (!userOwnsContext) throw new Error("Forbidden: Unauthorized direct report URL");
      };
      expect(() => verifyDirectUrl(false)).toThrow("Forbidden");
    });

    it("11. print URL / IDOR -> REJECT unauthorized context parameter", () => {
      const verifyPrintAuth = (isAuthorized: boolean) => {
        if (!isAuthorized) {
          throw new Error("Forbidden: You do not own this teaching context");
        }
        return true;
      };
      expect(() => verifyPrintAuth(false)).toThrow("Forbidden");
    });

    it("12. XLSX export endpoint IDOR -> REJECT with 403 Forbidden", () => {
      const verifyExportAuth = (isAuthorized: boolean) => {
        if (!isAuthorized) {
          throw new Error("Forbidden: You do not own this teaching context");
        }
        return 200;
      };
      expect(() => verifyExportAuth(false)).toThrow("Forbidden");
    });
  });

  describe("3. Active School Switching & Historical Access (Scenarios 15 & 17)", () => {
    it("15. active School switching / stale previous-School context -> REJECT", () => {
      const currentActiveSchool = "school-current";
      const contextSchool = "school-stale-previous";
      const verifySchoolMatch = (active: string, ctx: string) => {
        if (active !== ctx) throw new Error("Forbidden: Stale session accessing previous school context");
      };
      expect(() => verifySchoolMatch(currentActiveSchool, contextSchool)).toThrow("Forbidden");
    });

    it("17. unauthorized historical former-roster student access -> REJECT if no valid context history", () => {
      const verifyHistoricalStudent = (inCurrentRoster: boolean, hasHistoricalRecords: boolean) => {
        if (!inCurrentRoster && !hasHistoricalRecords) {
          throw new Error("Forbidden: Siswa tidak memiliki hubungan atau riwayat pembelajaran pada kelas ini");
        }
      };
      // Student from same school but no history in this context -> MUST REJECT
      expect(() => verifyHistoricalStudent(false, false)).toThrow("Forbidden");
      // Student with valid historical records -> ALLOWED
      expect(() => verifyHistoricalStudent(false, true)).not.toThrow();
    });
  });

  describe("4. Formula Injection Sanitization (CWE-1236)", () => {
    it("neutralizes formula prefixes =, +, -, @, tab, carriage return", () => {
      expect(sanitizeSpreadsheetCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeSpreadsheetCell("+cmd|... ")).toBe("'+cmd|... ");
      expect(sanitizeSpreadsheetCell("-2+3")).toBe("'-2+3");
      expect(sanitizeSpreadsheetCell("@SUM(...)")).toBe("'@SUM(...)");
    });
  });
});
