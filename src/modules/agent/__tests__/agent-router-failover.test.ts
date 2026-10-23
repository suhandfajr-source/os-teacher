import { describe, it, expect } from "vitest";
import { createFallbackModelChain, type ChainEntry } from "../agent.router";

/**
 * Unit test failover cross-provider (Story #5a).
 * Wrapper diekspos sebagai LanguageModel — kita panggil doGenerate langsung
 * via cast untuk menguji logika rantai tanpa network.
 */

function fakeEntry(
  id: string,
  provider: ChainEntry["provider"],
  impl: (opts: unknown) => Promise<unknown>
): ChainEntry {
  const fake = {
    specificationVersion: "v2",
    provider,
    modelId: id,
    doGenerate: impl,
    doStream: impl,
  };
  return { modelId: id, provider, model: fake as unknown as ChainEntry["model"] };
}

describe("Agent Router — cross-provider failover chain (Story #5a)", () => {
  it("exposes the first entry modelId and succeeds immediately when healthy", async () => {
    const wrapper = createFallbackModelChain([
      fakeEntry("glm-a", "glm", async () => "ok-glm"),
    ]);
    expect((wrapper as unknown as { modelId: string }).modelId).toBe("glm-a");
    const result = await (wrapper as unknown as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({});
    expect(result).toBe("ok-glm");
  });

  it("advances to the next entry (incl. cross-provider) on retryable 503", async () => {
    const calls: string[] = [];
    const wrapper = createFallbackModelChain([
      fakeEntry("glm-a", "glm", async () => {
        calls.push("glm-a");
        throw new Error("503 Service Unavailable: high demand");
      }),
      fakeEntry("glm-b", "glm", async () => {
        calls.push("glm-b");
        throw new Error("429 rate limit");
      }),
      fakeEntry("gemini-a", "google", async () => {
        calls.push("gemini-a");
        return "ok-gemini";
      }),
    ]);

    const result = await (wrapper as unknown as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({});
    expect(result).toBe("ok-gemini");
    expect(calls).toEqual(["glm-a", "glm-b", "gemini-a"]);
  });

  it("jumps cross-provider on auth-like errors (invalid GLM key → Gemini works)", async () => {
    const calls: string[] = [];
    const wrapper = createFallbackModelChain([
      fakeEntry("glm-a", "glm", async () => {
        calls.push("glm-a");
        throw new Error("Invalid API key provided");
      }),
      fakeEntry("glm-b", "glm", async () => {
        calls.push("glm-b");
        return "ok-glm";
      }),
      fakeEntry("gemini-a", "google", async () => {
        calls.push("gemini-a");
        return "ok-gemini";
      }),
    ]);

    const result = await (wrapper as unknown as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({});
    // Auth-like error TIDAK dicoba ke model lain di provider yang sama (glm-b dilewati),
    // tapi lompat ke provider berbeda.
    expect(result).toBe("ok-gemini");
    expect(calls).toEqual(["glm-a", "gemini-a"]);
  });

  it("fails fast on non-retryable, non-auth errors (invalid request)", async () => {
    const calls: string[] = [];
    const wrapper = createFallbackModelChain([
      fakeEntry("glm-a", "glm", async () => {
        calls.push("glm-a");
        throw new Error("Invalid request payload");
      }),
      fakeEntry("gemini-a", "google", async () => {
        calls.push("gemini-a");
        return "ok-gemini";
      }),
    ]);

    await expect(
      (wrapper as unknown as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({})
    ).rejects.toThrow(/Invalid request payload/);
    expect(calls).toEqual(["glm-a"]);
  });

  it("throws the last error when every entry fails", async () => {
    const wrapper = createFallbackModelChain([
      fakeEntry("glm-a", "glm", async () => {
        throw new Error("503 a");
      }),
      fakeEntry("gemini-a", "google", async () => {
        throw new Error("503 b");
      }),
    ]);

    await expect(
      (wrapper as unknown as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({})
    ).rejects.toThrow(/503 b/);
  });
});
