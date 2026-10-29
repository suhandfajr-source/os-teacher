import { describe, it, expect } from "vitest";
import { routeAgentTools } from "../agent-tool-router";

describe("Agent Tool Router & Dynamic Gating", () => {
  it("routes simple greetings to 0 tools (ultra low token)", () => {
    const res = routeAgentTools("halo");
    expect(res.cluster).toBe("none");
    expect(res.toolNames).toHaveLength(0);
  });

  it("routes pure pedagogy/theory questions to 0 tools", () => {
    const res = routeAgentTools("jelaskan apa itu pembelajaran berdiferensiasi di kurikulum merdeka");
    expect(res.cluster).toBe("none");
    expect(res.toolNames).toHaveLength(0);
  });

  it("routes diagnostic student attention query with clarification hint when class is unselected", () => {
    const res = routeAgentTools("siapa murid yang paling butuh perhatian?");
    expect(res.cluster).toBe("diagnostic");
    expect(res.toolNames).toContain("analyzeClassPerformance");
    expect(res.toolNames).toContain("getStudentAcademicSummary");
    expect(res.systemHint).toContain("PANDUAN FEEDBACK KLARIFIKASI GURU");
    expect(res.systemHint).toContain("Indikator apa yang menjadi fokus utama");
  });

  it("routes diagnostic query without clarification hint when class is already in context", () => {
    const res = routeAgentTools("siapa murid yang nilainya paling rendah?", "class-id-7a");
    expect(res.cluster).toBe("diagnostic");
    expect(res.systemHint).toBe("");
  });

  it("routes draft actions only to draft tools", () => {
    const res = routeAgentTools("buatkan tugas essay matematika tentang aljabar");
    expect(res.cluster).toBe("draft");
    expect(res.toolNames).toContain("proposeAssignmentDraft");
    expect(res.toolNames).not.toContain("analyzeClassPerformance");
  });
});
