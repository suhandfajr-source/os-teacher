import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi, afterEach } from "vitest";
import { trackPaidResult } from "../meta-pixel";

const script = readFileSync(resolve("public/meta-pixel.js"), "utf8");
const landingScript = readFileSync(resolve("../Landing Page Klassa/js/meta-pixel.js"), "utf8");
const main = readFileSync(resolve("../Landing Page Klassa/js/main.js"), "utf8");
const proceed = main.slice(main.indexOf("async function proceedToCheckout("), main.indexOf("// Expose to window for global access"));
const data = (event = "purchase", invoice = "ONE") => ({ eventId: `klassa-${event}-INV-KLASSA-123456-${invoice}`, params: { content_ids: ["bulanan"], content_name: "Paket Bulanan", value: 10000, currency: "IDR" } });

type SdkScript = { src: string; onload: () => void; onerror: () => void };
function browser(options: { host?: string; dnt?: string; gpc?: boolean; optOut?: boolean; storageFails?: boolean; sdkFails?: boolean; auto?: boolean; store?: Map<string, string> } = {}) {
  const calls: unknown[][] = [];
  const requested: string[] = [];
  const store = options.store || new Map<string, string>();
  if (options.optOut) store.set("klassa_marketing_opt_out", "1");
  const window = {
    location: { hostname: options.host || "klassa-edutech.com", protocol: "https:", href: "" },
    fbq: undefined as undefined | { (...args: unknown[]): void; queue: IArguments[]; callMethod?: (...args: unknown[]) => void },
    klassaMeta: undefined as undefined | { pageView(): Promise<boolean>; track(event: string, value: unknown): Promise<boolean>; optOut(): void },
  };
  const localStorage = {
    getItem: (key: string) => { if (options.storageFails) throw new Error("storage blocked"); return store.get(key) || null; },
    setItem: (key: string, value: string) => { if (options.storageFails) throw new Error("storage blocked"); store.set(key, value); },
  };
  const document = {
    currentScript: { hasAttribute: () => Boolean(options.auto) },
    createElement: () => ({}),
    head: { appendChild: (element: SdkScript) => {
      requested.push(element.src);
      queueMicrotask(() => {
        if (options.sdkFails) { element.onerror(); return; }
        const fbq = window.fbq!;
        fbq.callMethod = (...args: unknown[]) => calls.push(args);
        fbq.queue.forEach(args => calls.push(Array.from(args)));
        element.onload();
      });
    } },
  };
  const context = { window, document, localStorage, navigator: { doNotTrack: options.dnt, globalPrivacyControl: options.gpc }, setTimeout, clearTimeout, console };
  runInNewContext(script, context);
  return { window, context, calls, requested, store, api: window.klassaMeta! };
}
afterEach(() => vi.unstubAllGlobals());

describe("shared Pixel browser boundary", () => {
  it("ships identical runtime in both repositories", () => expect(landingScript).toBe(script));
  it("loads only on demand, uses the chosen Pixel, disables automatic configuration", async () => {
    const b = browser();
    expect(b.requested).toHaveLength(0);
    await Promise.all([b.api.pageView(), b.api.pageView()]);
    expect(b.requested).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
    expect(b.calls).toContainEqual(["set", "autoConfig", false, "1293603226231313"]);
    expect(b.calls).toContainEqual(["init", "1293603226231313"]);
    expect(b.calls.filter(c => c[2] === "PageView")).toHaveLength(1);
  });
  it("sends only whitelisted conversion fields and deduplicates repeated calls/refresh", async () => {
    const b = browser();
    const value = data();
    Object.assign(value.params, { email: "private@example.test", phone: "123" });
    expect(await b.api.track("Purchase", value)).toBe(true);
    expect(await b.api.track("Purchase", value)).toBe(false);
    const purchase = b.calls.find(c => c[2] === "Purchase")!;
    expect(purchase[4]).toEqual({ eventID: value.eventId });
    expect(JSON.stringify(purchase)).not.toMatch(/email|phone|private/);
    const refreshed = browser({ store: b.store });
    expect(await refreshed.api.track("Purchase", value)).toBe(false);
    expect(await refreshed.api.track("Purchase", data("purchase", "TWO"))).toBe(true);
  });
  it("deduplicates simultaneous calls and survives unavailable storage", async () => {
    const b = browser({ storageFails: true });
    await Promise.all([b.api.track("Purchase", data()), b.api.track("Purchase", data())]);
    expect(b.calls.filter(c => c[2] === "Purchase")).toHaveLength(1);
    b.api.optOut();
    expect(await b.api.track("Purchase", data("purchase", "TWO"))).toBe(false);
  });
  it.each([{ optOut: true }, { dnt: "1" }, { gpc: true }, { host: "localhost" }, { host: "127.0.0.1" }, { host: "192.168.1.5" }, { host: "preview.pages.dev" }])("does not load Meta for blocked browsers: %o", async options => {
    const b = browser(options);
    expect(await b.api.pageView()).toBe(false);
    expect(await b.api.track("Lead", data("lead"))).toBe(false);
    expect(b.requested).toHaveLength(0);
  });
  it("does not persist unsent events if SDK fails", async () => {
    const b = browser({ sdkFails: true });
    expect(await b.api.track("Purchase", data())).toBe(false);
    expect(b.store.size).toBe(0);
  });
  it("rejects invalid event/amount/package before loading SDK", async () => {
    const b = browser();
    expect(await b.api.track("InitiateCheckout", data())).toBe(false);
    expect(await b.api.track("Lead", data())).toBe(false);
    expect(await b.api.track("Purchase", { ...data(), params: { ...data().params, value: -1 } })).toBe(false);
    expect(b.requested).toHaveLength(0);
  });
  it("never enables Purchase for pending, forged or mock status", async () => {
    const b = browser();
    vi.stubGlobal("window", b.window);
    for (const status of ["PENDING", "UNVERIFIED", "FAILED", "EXPIRED"] as const) {
      await trackPaidResult({ status, live: true, tracking: data() });
    }
    await trackPaidResult({ status: "PAID", live: false, tracking: data() });
    expect(b.requested).toHaveLength(0);
    await trackPaidResult({ status: "PAID", live: true, tracking: data() });
    expect(b.calls.filter(c => c[2] === "Purchase")).toHaveLength(1);
  });
});

describe("landing checkout hook", () => {
  async function submit(body: object, ok = true, brokenTracking = false) {
    const b = browser();
    const track = vi.fn().mockImplementation(() => brokenTracking ? Promise.reject(new Error("blocked")) : Promise.resolve(true));
    b.window.klassaMeta!.track = track;
    const context = { ...b.context,
      document: { getElementById: () => ({ disabled: false, textContent: "" }) },
      fetch: vi.fn().mockResolvedValue({ ok, json: async () => body }),
      alert: vi.fn(), console: { error: vi.fn() }, KLASSA_API_BASE: "https://klassa-edutech.com",
    };
    const fn = runInNewContext(`${proceed}\nproceedToCheckout`, context);
    await fn("bulanan", "Teacher", "teacher@example.test", "123");
    return { b, track, context };
  }
  it("tracks Lead with server metadata and then redirects", async () => {
    const value = data("lead");
    const { b, track } = await submit({ success: true, paymentUrl: "https://checkout.doku.com/test", tracking: value });
    expect(track).toHaveBeenCalledWith("Lead", value);
    expect(b.window.location.href).toBe("https://checkout.doku.com/test");
  });
  it("does not track a failed checkout or a sandbox response", async () => {
    expect((await submit({ error: "bad" }, false)).track).not.toHaveBeenCalled();
    const { b, track } = await submit({ success: true, paymentUrl: "https://example.test/mock", tracking: null });
    expect(track).not.toHaveBeenCalled();
    expect(b.window.location.href).toBe("https://example.test/mock");
  });
  it("still redirects when tracking throws", async () => {
    const { b } = await submit({ success: true, paymentUrl: "https://checkout.doku.com/test", tracking: data("lead") }, true, true);
    expect(b.window.location.href).toBe("https://checkout.doku.com/test");
  });
  it("never installs the SDK globally in app layouts", () => {
    const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/meta-pixel|PaymentTracking|connect.facebook.net/);
    expect(readFileSync(resolve("../Landing Page Klassa/index.html"), "utf8")).toContain('src="js/meta-pixel.js?v=1" data-pageview');
  });
});
