import { describe, it, expect } from "vitest";
import { resolveTrustedOrigins } from "../auth";

describe("Better Auth Security - resolveTrustedOrigins", () => {
  it("allows localhost:3000 and localhost:3005 in development environment", () => {
    const origins = resolveTrustedOrigins("development", "http://localhost:3000");
    expect(origins).toEqual(["http://localhost:3000", "http://localhost:3005"]);
  });

  it("allows localhost:3000 and localhost:3005 in test environment", () => {
    const origins = resolveTrustedOrigins("test", "http://localhost:3005");
    expect(origins).toEqual(["http://localhost:3000", "http://localhost:3005"]);
  });

  it("does NOT include localhost:3000 or localhost:3005 in production environment", () => {
    const origins = resolveTrustedOrigins("production", "https://school.example.com");
    expect(origins).not.toContain("http://localhost:3000");
    expect(origins).not.toContain("http://localhost:3005");
    expect(origins).toContain("https://school.example.com");
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
