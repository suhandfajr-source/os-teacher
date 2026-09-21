import { describe, it, expect } from "vitest";
import {
  normalizeSchoolName,
  extractSchoolNumbers,
  calculateSchoolSimilarity,
  evaluateSchoolDedup,
  type ExistingSchoolCandidate,
} from "../school-dedup";

describe("School Deduplication & Normalization v2", () => {
  describe("normalizeSchoolName", () => {
    it("normalizes basic casing and whitespace", () => {
      expect(normalizeSchoolName("   SMP   Merdeka   Belajar  ")).toBe(
        "smp merdeka belajar"
      );
    });

    it("handles common punctuation and dashes", () => {
      expect(normalizeSchoolName("SMPN-1 Surabaya (Jawa Timur)")).toBe(
        "smp negeri 1 surabaya jawa timur"
      );
      expect(normalizeSchoolName("SDN 01 Pagi, Menteng")).toBe(
        "sd negeri 1 pagi menteng"
      );
    });

    it("expands school aliases into canonical forms", () => {
      expect(normalizeSchoolName("SMPN 1 Jakarta")).toBe("smp negeri 1 jakarta");
      expect(normalizeSchoolName("SMP N 1 Jakarta")).toBe("smp negeri 1 jakarta");
      expect(normalizeSchoolName("SMP Negeri 1 Jakarta")).toBe("smp negeri 1 jakarta");
      expect(normalizeSchoolName("smpn1 jakarta")).toBe("smp negeri 1 jakarta");

      expect(normalizeSchoolName("SDN 5 Bandung")).toBe("sd negeri 5 bandung");
      expect(normalizeSchoolName("SMAN 3 Yogyakarta")).toBe("sma negeri 3 yogyakarta");
      expect(normalizeSchoolName("SMKN 2 Malang")).toBe("smk negeri 2 malang");
      expect(normalizeSchoolName("MTSN 1 Surabaya")).toBe("mts negeri 1 surabaya");
      expect(normalizeSchoolName("MIN 2 Medan")).toBe("mi negeri 2 medan");
      expect(normalizeSchoolName("MAN 1 Palembang")).toBe("ma negeri 1 palembang");
    });

    it("normalizes Roman numerals to Arabic digits", () => {
      expect(normalizeSchoolName("SMPN I Surabaya")).toBe("smp negeri 1 surabaya");
      expect(normalizeSchoolName("SMP Negeri II Surabaya")).toBe("smp negeri 2 surabaya");
      expect(normalizeSchoolName("SMAN III Semarang")).toBe("sma negeri 3 semarang");
      expect(normalizeSchoolName("SDN IV Malang")).toBe("sd negeri 4 malang");
      expect(normalizeSchoolName("SMK Negeri X Jakarta")).toBe("smk negeri 10 jakarta");
    });

    it("removes leading zeroes from numbers", () => {
      expect(normalizeSchoolName("SMP Negeri 01 Surabaya")).toBe(
        "smp negeri 1 surabaya"
      );
      expect(normalizeSchoolName("SDN 005 Medan")).toBe("sd negeri 5 medan");
    });
  });

  describe("extractSchoolNumbers", () => {
    it("extracts integers correctly", () => {
      expect(extractSchoolNumbers("SMPN 1 Surabaya")).toEqual([1]);
      expect(extractSchoolNumbers("SMP Negeri 20")).toEqual([20]);
      expect(extractSchoolNumbers("Sekolah Al-Azhar")).toEqual([]);
      expect(extractSchoolNumbers("SMPN 1 Kampus 2")).toEqual([1, 2]);
    });
  });

  describe("calculateSchoolSimilarity (Number-Aware)", () => {
    it("returns 1.0 for identical normalized names", () => {
      expect(
        calculateSchoolSimilarity("SMPN 1 Surabaya", "SMP Negeri 1 Surabaya")
      ).toBe(1.0);
      expect(
        calculateSchoolSimilarity("SMPN 01 Surabaya", "SMPN I Surabaya")
      ).toBe(1.0);
    });

    it("VETOES (returns 0.0) when school numbers differ (F3 Critical Protection)", () => {
      // Despite high Levenshtein ratio (95.4%), different numbers must be 0.0
      expect(
        calculateSchoolSimilarity("SMP Negeri 1 Surabaya", "SMP Negeri 2 Surabaya")
      ).toBe(0.0);
      expect(
        calculateSchoolSimilarity("SMPN 1 Jakarta", "SMPN 3 Jakarta")
      ).toBe(0.0);
      expect(
        calculateSchoolSimilarity("SDN 01 Menteng", "SDN 02 Menteng")
      ).toBe(0.0);
    });

    it("detects high similarity (>= 85%) for small typos with matching numbers", () => {
      // Typo "Sby" vs "Surabaya" or small typo in city name
      const sim = calculateSchoolSimilarity(
        "SMP Negeri 1 Surabayya",
        "SMP Negeri 1 Surabaya"
      );
      expect(sim).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe("evaluateSchoolDedup (4 Scenarios)", () => {
    const candidates: ExistingSchoolCandidate[] = [
      {
        id: "sch_1",
        name: "SMP Negeri 1 Surabaya",
        normalizedName: "smp negeri 1 surabaya",
        npsn: "20532210",
        city: "Surabaya",
      },
      {
        id: "sch_2",
        name: "SMP Negeri 2 Surabaya",
        normalizedName: "smp negeri 2 surabaya",
        npsn: "20532220",
        city: "Surabaya",
      },
    ];

    it("Scenario A: blocks creation when NPSN matches existing school", () => {
      const res = evaluateSchoolDedup(
        { name: "SMP Baru Bebas", npsn: "20532210" },
        candidates
      );
      expect(res.match).toBe("NPSN_EXISTS");
      if (res.match === "NPSN_EXISTS") {
        expect(res.school.id).toBe("sch_1");
      }
    });

    it("Scenario B: blocks creation when normalizedName v2 exact match", () => {
      // SMPN 1 Surabaya normalizes to "smp negeri 1 surabaya"
      const res = evaluateSchoolDedup(
        { name: "SMPN 1 Surabaya", npsn: null },
        candidates
      );
      expect(res.match).toBe("EXACT_NAME_EXISTS");
      if (res.match === "EXACT_NAME_EXISTS") {
        expect(res.school.id).toBe("sch_1");
      }
    });

    it("Scenario C: triggers SIMILAR_NAME_FOUND when similarity >= 85%", () => {
      const res = evaluateSchoolDedup(
        { name: "SMP Negeri 1 Surabayya", npsn: null },
        candidates
      );
      expect(res.match).toBe("SIMILAR_NAME_FOUND");
      if (res.match === "SIMILAR_NAME_FOUND") {
        expect(res.school.id).toBe("sch_1");
        expect(res.similarity).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("Scenario C Bypass: allows creation if forceCreate is true", () => {
      const res = evaluateSchoolDedup(
        { name: "SMP Negeri 1 Surabayya", npsn: null, forceCreate: true },
        candidates
      );
      expect(res.match).toBe("UNIQUE");
    });

    it("Scenario D: treats different school numbers as UNIQUE (passes to create)", () => {
      const res = evaluateSchoolDedup(
        { name: "SMP Negeri 3 Surabaya", npsn: "20532230" },
        candidates
      );
      expect(res.match).toBe("UNIQUE");
    });

    it("Scenario D: treats entirely unique school as UNIQUE", () => {
      const res = evaluateSchoolDedup(
        { name: "SMA Nusantara Mandiri", npsn: "99887766" },
        candidates
      );
      expect(res.match).toBe("UNIQUE");
    });
  });
});
