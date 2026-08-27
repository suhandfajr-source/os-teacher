import { describe, it, expect } from "vitest";
import { resolveTrustedOrigins, getAuthSecret } from "../auth";

describe("Better Auth Security - resolveTrustedOrigins", () => {
  it("allows localhost dev ports (3000-3005) in development environment", () => {
    const origins = resolveTrustedOrigins("development", "http://localhost:3000");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://localhost:3001");
    expect(origins).toContain("http://localhost:3002");
    expect(origins).toContain("http://localhost:3003");
    expect(origins).toContain("http://localhost:3004");
    expect(origins).toContain("http://localhost:3005");
  });

  it("allows localhost dev ports (3000-3005) in test environment", () => {
    const origins = resolveTrustedOrigins("test", "http://localhost:3005");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://localhost:3001");
    expect(origins).toContain("http://localhost:3005");
  });

  it("accepts exact production domain and safely normalizes trailing slash", () => {
    const originsExact = resolveTrustedOrigins("production", "https://os-teacher.vercel.app");
    expect(originsExact).toEqual(["https://os-teacher.vercel.app"]);

    const originsWithSlash = resolveTrustedOrigins("production", "https://os-teacher.vercel.app/");
    expect(originsWithSlash).toEqual(["https://os-teacher.vercel.app"]);
  });

  it("rejects broad wildcard and unrelated Vercel project domains in production", () => {
    const origins = resolveTrustedOrigins("production", "https://os-teacher.vercel.app");
    expect(origins).not.toContain("https://*.vercel.app");
    expect(origins).not.toContain("https://evil-site.vercel.app");
    expect(origins).not.toContain("https://another-project.vercel.app");
  });

  it("does NOT include localhost:3000 or localhost:3005 in production environment", () => {
    const origins = resolveTrustedOrigins("production", "https://os-teacher.vercel.app");
    expect(origins).not.toContain("http://localhost:3000");
    expect(origins).not.toContain("http://localhost:3005");
  });

  it("returns empty array in production if appUrl points to localhost to prevent origin leakage", () => {
    const origins = resolveTrustedOrigins("production", "http://localhost:3000");
    expect(origins).toEqual([]);
    expect(origins).not.toContain("http://localhost:3000");
    expect(origins).not.toContain("http://localhost:3005");
  });

  it("returns empty array in production if no explicit appUrl is set", () => {
    const origins = resolveTrustedOrigins("production", undefined);
    expect(origins).toEqual([]);
  });
});

describe("Better Auth Security - getAuthSecret", () => {
  it("fails closed (throws error) in production if BETTER_AUTH_SECRET is unset or empty", () => {
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      delete process.env.BETTER_AUTH_SECRET;
      expect(() => getAuthSecret("production")).toThrow(
        "Missing required BETTER_AUTH_SECRET configuration in production environment."
      );

      process.env.BETTER_AUTH_SECRET = "   ";
      expect(() => getAuthSecret("production")).toThrow(
        "Missing required BETTER_AUTH_SECRET configuration in production environment."
      );
    } finally {
      if (originalSecret !== undefined) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
    }
  });

  it("returns configured BETTER_AUTH_SECRET in production when present", () => {
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      process.env.BETTER_AUTH_SECRET = "prod-secret-random-32-character-key";
      expect(getAuthSecret("production")).toBe("prod-secret-random-32-character-key");
    } finally {
      if (originalSecret !== undefined) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
    }
  });

  it("allows safe development fallback when BETTER_AUTH_SECRET is unset in dev/test", () => {
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      delete process.env.BETTER_AUTH_SECRET;
      const devSecret = getAuthSecret("development");
      expect(typeof devSecret).toBe("string");
      expect(devSecret.length).toBeGreaterThan(0);
    } finally {
      if (originalSecret !== undefined) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
    }
  });
});
