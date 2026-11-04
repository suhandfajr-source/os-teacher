import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPaymentReceipt, verifyPaymentReceipt, PAYMENT_RECEIPT_COOKIE, PAYMENT_RECEIPT_TTL } from "../payment-tracking-token";
import { getPricingPlan } from "../pricing-plans";
import * as doku from "../doku";
import { GET as paymentReturn } from "@/app/api/payment/return/route";
import { GET as paymentStatus } from "@/app/api/payment/status/route";
import { POST as checkout } from "@/app/api/payment/checkout/route";
import { POST as webhook } from "@/app/api/payment/webhook/route";

const db = vi.hoisted(() => ({
  paymentOrder: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/activation-email", () => ({ sendActivationEmail: vi.fn() }));

const invoice = "INV-KLASSA-123456-TEST";
const order = { id: "order-1", invoiceNumber: invoice, planId: "semester", amount: 199000, status: "PAID", paidAt: new Date(), customerEmail: "private@example.test", customerName: "Private" };
const request = (token?: string) => new NextRequest("https://klassa-edutech.com/api/payment/status?invoice=forged", {
  headers: token ? { cookie: `${PAYMENT_RECEIPT_COOKIE}=${token}` } : {},
});
function notification(status = "SUCCESS", amount: unknown = order.amount, signed = true) {
  const body = JSON.stringify({ order: { invoice_number: invoice, amount }, transaction: { status } });
  const headers = { "Client-Id": "test-client", "Request-Id": "req-1", "Request-Timestamp": "2026-11-01T00:00:00Z", Signature: "invalid" };
  if (signed) headers.Signature = doku.generateDokuSignature({
    clientId: headers["Client-Id"], requestId: headers["Request-Id"], requestTimestamp: headers["Request-Timestamp"],
    requestTarget: "/api/payment/webhook", digest: doku.generateDokuDigest(body), secretKey: "doku-test-secret",
  });
  return new NextRequest("https://klassa-edutech.com/api/payment/webhook", { method: "POST", headers, body });
}

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "receipt-test-secret");
  vi.stubEnv("DOKU_SECRET_KEY", "doku-test-secret");
  vi.stubEnv("DOKU_CLIENT_ID", "test-client");
  vi.stubEnv("DOKU_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://klassa-edutech.com");
  db.paymentOrder.findUnique.mockResolvedValue({ ...order });
  db.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "new-order", ...data }));
  db.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
  db.user.findUnique.mockResolvedValue(null);
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("payment capability and return", () => {
  it("binds invoice/live flag and rejects tampering, expiry, malformed and oversized proofs", () => {
    const now = Date.now();
    const token = createPaymentReceipt(invoice, true, now)!;
    expect(verifyPaymentReceipt(token, now)?.invoice).toBe(invoice);
    expect(verifyPaymentReceipt(token, now)?.live).toBe(true);
    expect(verifyPaymentReceipt(token.replace(token[0], "z"), now)).toBeNull();
    expect(verifyPaymentReceipt(token, now + PAYMENT_RECEIPT_TTL * 1000)).toBeNull();
    for (const invalid of [undefined, "bad", "a.b.c", "x".repeat(1025)]) expect(verifyPaymentReceipt(invalid)).toBeNull();
  });
  it("never uses a public fallback secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", ""); vi.stubEnv("DOKU_SECRET_KEY", "");
    expect(createPaymentReceipt(invoice, true)).toBeNull();
    expect(verifyPaymentReceipt("any.token")).toBeNull();
  });
  it("exchanges proof for an HttpOnly cookie and a clean redirect", async () => {
    const token = createPaymentReceipt(invoice, true)!;
    const res = await paymentReturn(new NextRequest(`https://klassa-edutech.com/api/payment/return?receipt=${token}&mock_paid=true`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://klassa-edutech.com/payment/success");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.cookies.get(PAYMENT_RECEIPT_COOKIE)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/api/payment", value: token });
  });
  it("clears a stale receipt on invalid return", async () => {
    const res = await paymentReturn(new NextRequest("https://klassa-edutech.com/api/payment/return?receipt=bad&mock_paid=true"));
    expect(res.cookies.get(PAYMENT_RECEIPT_COOKIE)?.maxAge).toBe(0);
  });
});

describe("verified status", () => {
  it("does not trust invoices or mock query parameters without proof", async () => {
    expect((await paymentStatus(request())).status).toBe(401);
    expect(db.paymentOrder.findUnique).not.toHaveBeenCalled();
  });
  it("returns only order-authoritative conversion metadata, stable on replay", async () => {
    const token = createPaymentReceipt(invoice, true)!;
    const res = await paymentStatus(request(token));
    const result = await res.json();
    expect(result.tracking.params).toEqual({ content_ids: ["semester"], content_name: "Paket Semester", value: 199000, currency: "IDR" });
    expect(result.tracking.eventId).toBe(`klassa-purchase-${invoice}`);
    expect(JSON.stringify(result)).not.toMatch(/private@example|Private|activationToken/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect((await (await paymentStatus(request(token))).json()).tracking).toEqual(result.tracking);
  });
  it.each(["PENDING", "FAILED", "EXPIRED"])("never emits Purchase for %s", async status => {
    db.paymentOrder.findUnique.mockResolvedValue({ ...order, status, paidAt: null });
    expect((await (await paymentStatus(request(createPaymentReceipt(invoice, true)!))).json()).tracking).toBeNull();
  });
  it("waits for a paidAt value and handles a delayed webhook", async () => {
    const req = request(createPaymentReceipt(invoice, true)!);
    db.paymentOrder.findUnique.mockResolvedValueOnce({ ...order, paidAt: null });
    expect((await (await paymentStatus(req)).json()).status).toBe("PENDING");
    expect((await (await paymentStatus(req)).json()).status).toBe("PAID");
  });
  it("suppresses tracking for sandbox proofs even if server later switches to production", async () => {
    const result = await (await paymentStatus(request(createPaymentReceipt(invoice, false)!))).json();
    expect(result).toMatchObject({ live: false, tracking: null });
  });
  it("returns safe errors for missing orders and DB failures", async () => {
    const req = request(createPaymentReceipt(invoice, true)!);
    db.paymentOrder.findUnique.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("database details"));
    expect((await paymentStatus(req)).status).toBe(404);
    const res = await paymentStatus(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "UNAVAILABLE" });
  });
});

describe("checkout Lead metadata", () => {
  const buy = (planId = "bulanan") => checkout(new NextRequest("https://klassa-edutech.com/api/payment/checkout", {
    method: "POST", body: JSON.stringify({ planId, name: "Teacher", email: "teacher@example.test", phone: "123", amount: 1 }),
  }));
  it.each(["bulanan", "semester", "tahunan"])("uses persisted %s amount and binds the callback", async planId => {
    const gateway = vi.spyOn(doku, "createDokuCheckout").mockResolvedValue({ paymentUrl: "https://checkout.doku.com/test", raw: {} });
    const res = await buy(planId);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tracking.params.value).toBe(getPricingPlan(planId)!.price);
    expect(body.tracking.params.content_ids).toEqual([planId]);
    expect(body.tracking.eventId).toBe(`klassa-lead-${body.invoiceNumber}`);
    const url = new URL(gateway.mock.calls[0][0].callbackUrl);
    expect(verifyPaymentReceipt(url.searchParams.get("receipt")!)?.invoice).toBe(body.invoiceNumber);
  });
  it("omits metadata for mock/sandbox", async () => {
    vi.spyOn(doku, "createDokuCheckout").mockResolvedValue({ paymentUrl: "https://example.test/mock", raw: { mock: true } });
    expect((await (await buy()).json()).tracking).toBeNull();
    vi.stubEnv("DOKU_ENV", "sandbox");
    expect((await (await buy()).json()).tracking).toBeNull();
  });
  it("does not return successful Lead metadata after gateway/order failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const gateway = vi.spyOn(doku, "createDokuCheckout").mockRejectedValueOnce(new Error("gateway down"));
    expect((await buy()).status).toBe(500);
    gateway.mockResolvedValue({ paymentUrl: "https://checkout.doku.com/test", raw: {} });
    db.paymentOrder.create.mockRejectedValueOnce(new Error("save failed"));
    expect((await (await buy()).json()).tracking).toBeUndefined();
  });
  it("rejects invalid packages before gateway creation", async () => {
    const gateway = vi.spyOn(doku, "createDokuCheckout");
    expect((await buy("invalid")).status).toBe(400);
    expect(gateway).not.toHaveBeenCalled();
  });
  it("preserves mock callback query without network access", async () => {
    vi.stubEnv("DOKU_CLIENT_ID", "");
    const result = await doku.createDokuCheckout({ invoiceNumber: invoice, amount: 10000, customerName: "Test", customerEmail: "test@example.test", customerPhone: "123", callbackUrl: "https://example.test/api/payment/return?receipt=proof" });
    const url = new URL(result.paymentUrl);
    expect(url.searchParams.get("receipt")).toBe("proof");
    expect(url.searchParams.get("mock_invoice")).toBe(invoice);
  });
});

describe("webhook authority", () => {
  beforeEach(() => db.paymentOrder.findUnique.mockResolvedValue({ ...order, status: "PENDING", paidAt: null }));
  it("rejects unsigned notifications and missing server credentials", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await webhook(notification("SUCCESS", order.amount, false))).status).toBe(400);
    vi.stubEnv("DOKU_SECRET_KEY", "");
    expect((await webhook(notification())).status).toBe(503);
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
  });
  it.each([1, undefined, "", "wrong"])("rejects wrong or absent amounts: %s", async amount => {
    const req = amount === undefined ? notification("SUCCESS", null) : notification("SUCCESS", amount);
    expect((await webhook(req)).status).toBe(400);
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
  });
  it("marks correctly signed matching payments paid atomically", async () => {
    expect((await webhook(notification())).status).toBe(200);
    expect(db.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: order.id, status: { not: "PAID" } }, data: expect.objectContaining({ status: "PAID", paidAt: expect.any(Date) }),
    }));
  });
  it.each(["SUCCESS", "FAILED", "EXPIRED", "PENDING"])("does not mutate already PAID on %s replay", async status => {
    db.paymentOrder.findUnique.mockResolvedValue(order);
    await webhook(notification(status));
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it("does not turn pending into failed and avoids concurrent activation", async () => {
    await webhook(notification("PENDING"));
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
    db.paymentOrder.updateMany.mockResolvedValue({ count: 0 });
    await webhook(notification());
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
