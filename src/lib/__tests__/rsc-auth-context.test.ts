import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

import { getRscAuthContext } from "../rsc-auth-context";
import { verifyActiveSchoolMembership } from "@/lib/authorization";

describe("RSC Request Auth Context Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates directly to verifyActiveSchoolMembership", async () => {
    const mockAuthResult = {
      session: { user: { id: "u-1" } },
      profile: { id: "tp-1", activeSchoolId: "s-1" },
      activeSchoolId: "s-1",
      activeSchool: { id: "s-1", name: "School 1" },
    };

    vi.mocked(verifyActiveSchoolMembership).mockResolvedValueOnce(mockAuthResult as unknown as never);

    const result = await getRscAuthContext();
    expect(verifyActiveSchoolMembership).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockAuthResult);
  });

  it("bubbles up fail-closed errors directly without masking", async () => {
    vi.mocked(verifyActiveSchoolMembership).mockRejectedValueOnce(
      new Error("Not an active member of the school workspace")
    );

    await expect(getRscAuthContext()).rejects.toThrow("Not an active member");
  });
});
