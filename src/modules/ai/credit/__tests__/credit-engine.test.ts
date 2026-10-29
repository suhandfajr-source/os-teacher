import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockTeacherProfile = {
  id: "teacher-1",
  user: { platformRole: "TEACHER" },
  aiKey: null as any,
};

let mockCredit = {
  id: "credit-1",
  teacherProfileId: "teacher-1",
  balance: 50000,
  dailyAllowance: 50000,
  lastResetDate: "2026-10-26",
};

const mockLedger: any[] = [];

vi.mock("@/lib/auth", () => ({
  prisma: {
    teacherProfile: {
      findUnique: vi.fn(async () => mockTeacherProfile),
    },
    teacherCredit: {
      findUnique: vi.fn(async () => mockCredit),
      create: vi.fn(async ({ data }) => {
        mockCredit = { ...mockCredit, ...data };
        return mockCredit;
      }),
      update: vi.fn(async ({ data }) => {
        if (data.balance?.decrement) {
          mockCredit.balance -= data.balance.decrement;
        } else if (data.balance !== undefined) {
          mockCredit.balance = data.balance;
        }
        return mockCredit;
      }),
    },
    teacherCreditLedger: {
      create: vi.fn(async ({ data }) => {
        mockLedger.push(data);
        return { id: `ledger-${mockLedger.length}`, ...data };
      }),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encryptSecret: (str: string) => `enc:${str}`,
  decryptSecret: (str: string) => (str ? str.replace("enc:", "") : null),
}));

vi.mock("@/modules/ai/ai-usage.service", () => ({
  getWibDateKey: () => "2026-10-26",
}));

import {
  preCheckAiCredit,
  recordAiTokenUsage,
  getTeacherCreditStatus,
  TOKENS_PER_CREDIT,
} from "../credit.service";

describe("Teacher Token-Credit & BYOK Engine", () => {
  beforeEach(() => {
    mockTeacherProfile.user.platformRole = "TEACHER";
    mockTeacherProfile.aiKey = null;
    mockCredit.balance = 50000;
  });

  it("converts 1000 tokens to 1 credit properly", () => {
    expect(TOKENS_PER_CREDIT).toBe(1000);
  });

  it("allows requests when credit balance is sufficient (> 100 tokens)", async () => {
    const res = await preCheckAiCredit("teacher-1");
    expect(res.allowed).toBe(true);
    expect(res.useByok).toBe(false);
  });

  it("records token usage and deducts balance for regular school credit", async () => {
    const initialBalance = mockCredit.balance;
    await recordAiTokenUsage({
      teacherProfileId: "teacher-1",
      feature: "AGENT",
      promptTokens: 400,
      completionTokens: 600,
      totalTokens: 1000,
      modelUsed: "glm-4-plus",
    });

    expect(mockCredit.balance).toBe(initialBalance - 1000);
    expect(mockLedger.length).toBeGreaterThan(0);
    const lastEntry = mockLedger[mockLedger.length - 1];
    expect(lastEntry.creditCost).toBe(1);
    expect(lastEntry.isByok).toBe(false);
  });

  it("blocks request when balance is exhausted and NO BYOK is set", async () => {
    mockCredit.balance = 0;
    const res = await preCheckAiCredit("teacher-1");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Kredit AI harian sekolah Anda telah habis");
  });

  it("automatically falls back to BYOK when school credit is 0 and teacher has active BYOK", async () => {
    mockCredit.balance = 0;
    mockTeacherProfile.aiKey = {
      provider: "google",
      encryptedApiKey: "enc:AIzaSyTestKey123",
      customModel: "gemini-2.5-flash",
      isActive: true,
    };

    const res = await preCheckAiCredit("teacher-1");
    expect(res.allowed).toBe(true);
    expect(res.useByok).toBe(true);
    expect(res.byokConfig?.apiKey).toBe("AIzaSyTestKey123");
    expect(res.byokConfig?.provider).toBe("google");
  });

  it("does not deduct school credit balance when session is BYOK", async () => {
    mockCredit.balance = 0;
    await recordAiTokenUsage({
      teacherProfileId: "teacher-1",
      feature: "AGENT",
      promptTokens: 500,
      completionTokens: 500,
      totalTokens: 1000,
      isByok: true,
    });

    expect(mockCredit.balance).toBe(0); // tetap 0, tidak minus
    const lastEntry = mockLedger[mockLedger.length - 1];
    expect(lastEntry.isByok).toBe(true);
  });
});
