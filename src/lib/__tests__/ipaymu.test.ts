import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalCallback, checkIpaymuTransaction, createIpaymuCheckout, getIpaymuConfig, readIpaymuCallback, signIpaymuRequest, verifyIpaymuCallback } from "../ipaymu";

const config = { environment: "sandbox" as const, va: "123456", apiKey: "TEST-ONLY-NOT-A-CREDENTIAL", baseUrl: "https://sandbox.ipaymu.com" };
const input = { invoiceNumber: "INV-KLASSA-TEST", amount: 1000, productName: "Paket Bulanan", customerName: "Test", customerEmail: "test@example.test", customerPhone: "08123456789", callbackUrl: "https://example.test/api/payment/return", notifyUrl: "https://example.test/api/payment/ipaymu/webhook" };
const fetcher = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetcher); fetcher.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("iPaymu official contracts", () => {
  it("requires explicit environment and matching server credentials", () => {
    for (const key of ["IPAYMU_ENV", "IPAYMU_VA", "IPAYMU_API_KEY"]) vi.stubEnv(key, "");
    expect(() => getIpaymuConfig()).toThrow();
    vi.stubEnv("IPAYMU_ENV", "production"); vi.stubEnv("IPAYMU_VA", config.va); vi.stubEnv("IPAYMU_API_KEY", config.apiKey);
    expect(getIpaymuConfig()).toMatchObject({ environment: "production", baseUrl: "https://my.ipaymu.com" });
    vi.stubEnv("IPAYMU_ENV", "typo"); expect(() => getIpaymuConfig()).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("signs the exact POST body using the documented SHA256 + HMAC recipe", () => {
    const json = '{"product":["T-Shirt"],"qty":["1"],"price":["100000"]}';
    const bodyHash = createHash("sha256").update(json).digest("hex");
    const reference = createHmac("sha256", config.apiKey).update(`POST:123456:${bodyHash}:${config.apiKey}`).digest("hex");
    expect(signIpaymuRequest(json, config)).toBe(reference);
    expect(signIpaymuRequest(json + " ", config)).not.toBe(reference);
  });
  it("sends required arrays, invoice, signed headers and binds returned session", async () => {
    fetcher.mockResolvedValue(Response.json({ Status: 200, Data: { SessionID: "SESSION-1", Url: config.baseUrl + "/payment/SESSION-1" } }));
    expect(await createIpaymuCheckout(input, config)).toEqual({ sessionId: "SESSION-1", paymentUrl: config.baseUrl + "/payment/SESSION-1" });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(config.baseUrl + "/api/v2/payment");
    expect(options).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
    expect(options.headers.signature).toBe(signIpaymuRequest(options.body, config));
    expect(options.headers.timestamp).toMatch(/^\d{14}$/);
    expect(JSON.parse(options.body)).toMatchObject({ product: [input.productName], price: ["1000"], qty: ["1"], description: [expect.any(String)], referenceId: input.invoiceNumber, notifyUrl: input.notifyUrl, cancelUrl: input.callbackUrl });
  });
  it.each(["https://evil.test/payment/SESSION-1", "http://sandbox.ipaymu.com/payment/SESSION-1", "https://sandbox.ipaymu.com.evil.test/payment/SESSION-1", "https://user:pass@sandbox.ipaymu.com/payment/SESSION-1", "https://my.ipaymu.com/payment/SESSION-1", "https://sandbox.ipaymu.com/login"])("rejects untrusted checkout URL %s", async Url => {
    fetcher.mockResolvedValue(Response.json({ Status: 200, Data: { SessionID: "SESSION-1", Url } }));
    await expect(createIpaymuCheckout(input, config)).rejects.toThrow("belum tersedia");
  });
  it("queries transaction with signed server credentials, never trusting callback status", async () => {
    fetcher.mockResolvedValue(Response.json({ Status: 200, Success: true, Data: { TransactionId: 4719 } }));
    expect(await checkIpaymuTransaction("4719", config)).toEqual({ TransactionId: 4719 });
    expect(fetcher.mock.calls[0][0]).toBe(config.baseUrl + "/api/v2/transaction");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ transactionId: "4719" });
  });
  it.each([new Response("not json", { status: 502 }), Response.json({ Status: 401, Message: "secret debug" }), Response.json({ Status: 200, Success: false, Data: {} }), Response.json({ Status: 200, Data: null })])("fails closed on malformed/error gateway response", async response => {
    fetcher.mockResolvedValue(response);
    await expect(checkIpaymuTransaction("4719", config)).rejects.toThrow("belum tersedia");
  });
  it("sanitizes timeout and network errors", async () => {
    fetcher.mockRejectedValue(new Error("private upstream details"));
    await expect(checkIpaymuTransaction("4719", config)).rejects.toThrow("belum tersedia");
  });
});

describe("callback canonicalization", () => {
  const payload = { status_code: "1", trx_id: "4719", paid_off: "67500", amount: "69000", is_escrow: "0", url: "https://example.test/callback" };
  // Independently written canonical fixture from documented form normalization/PHP ordering.
  const expected = '{"additional_info":[],"amount":"69000","is_escrow":false,"paid_off":67500,"status_code":1,"trx_id":4719,"url":"https:\\/\\/example.test\\/callback"}';
  it("normalizes form values and adds additional_info before lexical sorting", () => {
    expect(canonicalCallback(payload)).toBe(expected);
    const signature = createHmac("sha256", config.va).update(expected).digest("hex");
    expect(verifyIpaymuCallback(payload, signature, config.va)).toBe(true);
    expect(verifyIpaymuCallback({ ...payload, amount: "1" }, signature, config.va)).toBe(false);
    expect(verifyIpaymuCallback(payload, "bad", config.va)).toBe(false);
    expect(verifyIpaymuCallback({ ...payload, trx_id: "4719oops" }, signature, config.va)).toBe(false);
  });
  it("handles normalized JSON scalars identically and rejects nested/invalid input", () => {
    expect(canonicalCallback({ ...payload, trx_id: 4719, status_code: 1, paid_off: 67500, is_escrow: false, additional_info: [] })).toBe(expected);
    for (const raw of [{ ...payload, is_escrow: "invalid" }, { ...payload, amount: {} }, { ...payload, additional_info: ["unexpected"] }]) expect(() => canonicalCallback(raw)).toThrow();
  });
  it("parses both supported formats and rejects duplicates, oversize or unsupported formats", async () => {
    const request = (body: string, type: string) => new Request("https://example.test", { method: "POST", headers: { "Content-Type": type }, body });
    expect(await readIpaymuCallback(request("status_code=1&trx_id=4719", "application/x-www-form-urlencoded"))).toEqual({ status_code: "1", trx_id: "4719" });
    expect(await readIpaymuCallback(request(JSON.stringify(payload), "application/json"))).toEqual(payload);
    for (const req of [request("trx_id=1&trx_id=2", "application/x-www-form-urlencoded"), request("[]", "application/json"), request("x", "text/plain"), request("x".repeat(32769), "application/json")]) await expect(readIpaymuCallback(req)).rejects.toThrow();
  });
});
