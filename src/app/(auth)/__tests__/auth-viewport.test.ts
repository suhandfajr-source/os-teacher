import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rsc-auth-context", () => ({ getRscAuthContext: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/components/brand", () => ({
  KlassaLogo: () => "KLASSA",
  ModularCockpitArtwork: () => "Artwork",
  AtomicEcosystemHero: () => "Hero",
}));

import AuthLayout from "../layout";
import LoginPage from "../login/page";
import RegisterPage from "../register/page";

describe("Auth viewport regression", () => {
  it.each([
    ["login", LoginPage, "Masuk ke Ruang Kerja"],
    ["register", RegisterPage, "Konfirmasi"],
  ] as const)("%s does not autofocus and scroll past branding", (_name, Page, label) => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).not.toMatch(/autofocus/i);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="submit"');
    expect(html).toContain(label);
  });

  it("clips decorative blobs separately, not the form's vertical overflow", async () => {
    const tree = await AuthLayout({ children: createElement(LoginPage) });
    const html = renderToStaticMarkup(tree);
    const rootTag = html.slice(0, html.indexOf(">") + 1);
    expect(rootTag).toContain("min-h-svh");
    expect(rootTag).toContain("overflow-x-clip");
    expect(rootTag).not.toMatch(/\boverflow-(?:hidden|y-hidden|y-auto)\b|\bh-screen\b/);
    expect(html).toContain('aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden"');
    expect(html.indexOf("animate-mesh-shift")).toBeLessThan(html.indexOf("Beranda KLASSA"));
    expect(html).toContain("Masuk Portal Siswa");
    expect(html).toContain("Masuk ke Ruang Kerja");
  });
});
