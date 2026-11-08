import { createHmac } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as checkout } from "@/app/api/payment/checkout/route";
import { POST as webhook } from "@/app/api/payment/ipaymu/webhook/route";
import { POST as dokuWebhook } from "@/app/api/payment/webhook/route";
import { POST as activate } from "@/app/api/payment/setup-password/route";
import { GET as status } from "@/app/api/payment/status/route";
import { canonicalCallback } from "../ipaymu";
import { createPaymentReceipt, PAYMENT_RECEIPT_COOKIE } from "../payment-tracking-token";
import { sendActivationEmail } from "../activation-email";
import { generateDokuDigest, generateDokuSignature } from "../doku";
import type { PaymentOrder, User } from "@prisma/client";

const db = vi.hoisted(() => ({
  paymentOrder: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() }, account: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("../activation-email", () => ({ sendActivationEmail: vi.fn() }));
vi.mock("better-auth/crypto", () => ({ hashPassword: vi.fn().mockResolvedValue("hashed-test-password") }));
let order: PaymentOrder;
let user: User | null;
const fetcher = vi.fn();
const invoice = "INV-KLASSA-TEST";
const va = "123456";
function notification(overrides: Record<string, unknown> = {}, signature = true) {
  const data = { merchant: va, trx_id: "4719", sid: "SESSION-1", reference_id: invoice, amount: "1000", status_code: "1", is_sandbox: "false", ...overrides };
  return new NextRequest("https://klassa-edutech.com/api/payment/ipaymu/webhook", { method: "POST", headers: {
    "Content-Type": "application/x-www-form-urlencoded", "X-Signature": signature ? createHmac("sha256", va).update(canonicalCallback(data)).digest("hex") : "bad",
  }, body: new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)])).toString() });
}
function inquiry(overrides: Record<string, unknown> = {}) {
  return Response.json({ Status: 200, Success: true, Data: { TransactionId: 4719, SessionId: "SESSION-1", ReferenceId: invoice, Amount: 1000, Status: 1, PaidStatus: "paid", ...overrides } });
}
function buy(body: object = {}) {
  return checkout(new NextRequest("https://klassa-edutech.com/api/payment/checkout", { method: "POST", body: JSON.stringify({ planId: "bulanan", name: "Teacher", email: "teacher@example.test", phone: "08123456789", ...body }) }));
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PAYMENT_PROVIDER", "ipaymu"); vi.stubEnv("IPAYMU_ENV", "production"); vi.stubEnv("IPAYMU_VA", va); vi.stubEnv("IPAYMU_API_KEY", "test-only-key");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-receipt-secret"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://klassa-edutech.com");
  vi.stubGlobal("fetch", fetcher);
  order = { id: "order-1", invoiceNumber: invoice, paymentProvider: "IPAYMU", paymentEnvironment: "production", amount: 1000, planId: "bulanan", status: "PENDING", customerEmail: "teacher@example.test", customerName: "Teacher", customerPhone: "08123456789", gatewaySessionId: "SESSION-1", gatewayTransactionId: null, paidAt: null, activationToken: null, activatedAt: null, tokenExpiresAt: null, activationEmailSentAt: null, activationEmailLeaseAt: null } as PaymentOrder;
  user = null;
  fetcher.mockImplementation(async () => inquiry());
  vi.mocked(sendActivationEmail).mockResolvedValue();
  db.paymentOrder.findUnique.mockImplementation(async () => structuredClone(order));
  db.paymentOrder.findUniqueOrThrow.mockImplementation(async () => structuredClone(order));
  db.paymentOrder.create.mockImplementation(async ({ data }) => {
    order = { ...order, ...data } as PaymentOrder;
    return structuredClone(order);
  });
  db.paymentOrder.update.mockImplementation(async ({ data }) => { Object.assign(order, data); return structuredClone(order); });
  db.paymentOrder.updateMany.mockImplementation(async ({ where, data }) => {
    if ((where.status?.not === "PAID" && order.status === "PAID") || (where.activatedAt === null && order.activatedAt)
      || (where.activationEmailSentAt === null && order.activationEmailSentAt)) return { count: 0 };
    Object.assign(order, data); return { count: 1 };
  });
  db.user.findUnique.mockImplementation(async () => user && structuredClone(user));
  db.user.update.mockImplementation(async ({ data }) => { Object.assign(user!, data); return structuredClone(user); });
  db.user.create.mockImplementation(async ({ data }) => { user = data; return structuredClone(user); });
  // Serialize fake transactions, including rollback, to exercise claims/replay without any DB connection.
  let queue: Promise<unknown> = Promise.resolve();
  db.$transaction.mockImplementation(work => {
    const run = queue.then(async () => {
      const savedOrder = structuredClone(order), savedUser = structuredClone(user);
      try { return await work(db); } catch (error) { order = savedOrder; user = savedUser; throw error; }
    });
    queue = run.catch(() => {}); return run;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("iPaymu checkout", () => {
  it("persists before gateway, ignores client amount, and binds session/receipt", async () => {
    fetcher.mockImplementation(async () => {
      expect(db.paymentOrder.create).toHaveBeenCalledOnce();
      expect(order.status).toBe("PENDING");
      return Response.json({ Status: 200, Data: { SessionID: "SESSION-2", Url: "https://my.ipaymu.com/payment/SESSION-2" } });
    });
    const res = await buy({ amount: 1 });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.tracking.params.value).toBe(1000);
    expect(order).toMatchObject({ gatewaySessionId: "SESSION-2", paymentProvider: "IPAYMU", paymentEnvironment: "production", amount: 1000 });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.price).toEqual(["1000"]);
    expect(body.referenceId).toBe(result.invoiceNumber);
    expect(body.returnUrl).toContain("/api/payment/return?receipt=");
  });
  it("suppresses sandbox Lead and uses separate endpoint", async () => {
    vi.stubEnv("IPAYMU_ENV", "sandbox");
    fetcher.mockResolvedValue(Response.json({ Status: 200, Data: { SessionID: "SESSION-1", Url: "https://sandbox.ipaymu.com/payment/SESSION-1" } }));
    expect(await (await buy()).json()).toMatchObject({ tracking: null, environment: "sandbox" });
    expect(fetcher.mock.calls[0][0]).toBe("https://sandbox.ipaymu.com/api/v2/payment");
  });
  it.each(["IPAYMU_API_KEY", "IPAYMU_VA", "IPAYMU_ENV"])("fails before persistence/network when %s missing", async key => {
    vi.stubEnv(key, ""); expect((await buy()).status).toBe(500);
    expect(fetcher).not.toHaveBeenCalled(); expect(db.paymentOrder.create).not.toHaveBeenCalled();
  });
  it("rejects malformed input, invalid plans, and missing receipt configuration", async () => {
    expect((await buy({ name: 1 })).status).toBe(400);
    expect((await buy({ planId: "fake" })).status).toBe(400);
    vi.stubEnv("BETTER_AUTH_SECRET", ""); vi.stubEnv("DOKU_SECRET_KEY", "");
    expect((await buy()).status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
  });
  it("handles gateway and session-write failure without exposing a URL or error details", async () => {
    fetcher.mockRejectedValueOnce(new Error("private key"));
    const response = await buy();
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private key");
    expect(order.status).toBe("PENDING");
    fetcher.mockResolvedValueOnce(Response.json({ Status: 200, Data: { SessionID: "SESSION-1", Url: "https://my.ipaymu.com/payment/SESSION-1" } }));
    db.paymentOrder.update.mockRejectedValueOnce(new Error("DB unavailable"));
    expect((await buy()).status).toBe(500);
  });
});

describe("verified notifications and fulfillment", () => {
  it("verifies callback and signed inquiry before paid/new-customer email", async () => {
    expect((await webhook(notification())).status).toBe(200);
    expect(order).toMatchObject({ status: "PAID", gatewayTransactionId: "4719", activationToken: expect.any(String), activationEmailSentAt: expect.any(Date) });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", timeout: 10000 });
    expect(sendActivationEmail).toHaveBeenCalledOnce();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it("extends existing users once without reset tokens or shortening expiry", async () => {
    user = { id: "user-1", subscriptionExpiresAt: new Date(Date.now() + 60 * 86400000) } as User;
    const original = user.subscriptionExpiresAt!.getTime();
    expect((await webhook(notification())).status).toBe(200);
    expect(user.subscriptionExpiresAt!.getTime()).toBe(original + 30 * 86400000);
    expect(order).toMatchObject({ activatedAt: expect.any(Date), activationToken: null });
    expect(sendActivationEmail).toHaveBeenCalledWith(expect.objectContaining({ renewal: true, activationUrl: "https://klassa-edutech.com/login" }));
    expect((await webhook(notification())).status).toBe(200);
    expect(db.user.update).toHaveBeenCalledOnce(); expect(sendActivationEmail).toHaveBeenCalledOnce();
  });
  it("does not duplicate entitlement under concurrent callbacks", async () => {
    user = { id: "user-1", subscriptionExpiresAt: null } as User;
    await Promise.all([webhook(notification()), webhook(notification())]);
    expect(db.user.update).toHaveBeenCalledOnce();
    expect(order.status).toBe("PAID");
  });
  it("rejects unsigned, foreign merchant/mode/provider/session/amount/reference callbacks", async () => {
    expect((await webhook(notification({}, false))).status).toBe(400);
    for (const change of [{ merchant: "999999" }, { is_sandbox: "true" }, { is_sandbox: "maybe" }, { sid: "OTHER" }, { amount: "1" }, { referenceId: "OTHER" }]) expect((await webhook(notification(change))).status).toBe(400);
    order.paymentProvider = "DOKU"; expect((await webhook(notification())).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([{ TransactionId: 9999 }, { SessionId: "OTHER" }, { ReferenceId: "OTHER" }, { ReferenceId: null }, { Amount: 1 }, { Status: 1, PaidStatus: "unpaid" }, { Status: 7 }, { Status: 3 }, { Status: 999 }])("rejects inquiry mismatch/unsafe status %j", async change => {
    fetcher.mockResolvedValueOnce(inquiry(change));
    expect((await webhook(notification())).status).toBe(400);
    expect(order.status).toBe("PENDING"); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("does not trust a forged successful callback when inquiry still pending", async () => {
    fetcher.mockResolvedValueOnce(inquiry({ Status: 0, PaidStatus: "unpaid" }));
    expect((await webhook(notification())).status).toBe(200);
    expect(order.status).toBe("PENDING"); expect(sendActivationEmail).not.toHaveBeenCalled();
  });
  it.each([[2, "FAILED"], [5, "FAILED"], [-2, "EXPIRED"], [6, "PAID"]])("maps authoritative code %s to %s", async (code, expected) => {
    fetcher.mockResolvedValueOnce(inquiry({ Status: code, PaidStatus: code === 6 ? "paid" : "unpaid" }));
    expect((await webhook(notification())).status).toBe(200); expect(order.status).toBe(expected);
  });
  it("never downgrades a paid order on late failure", async () => {
    await webhook(notification());
    fetcher.mockResolvedValueOnce(inquiry({ Status: 5, PaidStatus: "unpaid" }));
    expect((await webhook(notification())).status).toBe(200); expect(order.status).toBe("PAID");
  });
  it("retries safely after inquiry or DB failure; no partial paid entitlement", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));
    expect((await webhook(notification())).status).toBe(503); expect(order.status).toBe("PENDING");
    user = { id: "user-1", subscriptionExpiresAt: null } as User;
    db.user.update.mockRejectedValueOnce(new Error("DB failure"));
    expect((await webhook(notification())).status).toBe(503);
    expect(order.status).toBe("PENDING"); expect(sendActivationEmail).not.toHaveBeenCalled();
    expect((await webhook(notification())).status).toBe(200); expect(order.status).toBe("PAID");
  });
  it("retries email without regenerating token or granting again", async () => {
    vi.mocked(sendActivationEmail).mockRejectedValueOnce(new Error("SMTP unavailable"));
    expect((await webhook(notification())).status).toBe(503);
    const token = order.activationToken;
    expect(order.status).toBe("PAID"); expect(order.activationEmailSentAt).toBeNull();
    expect((await webhook(notification())).status).toBe(200);
    expect(order.activationToken).toBe(token); expect(order.activationEmailSentAt).toBeInstanceOf(Date);
  });
  it("cannot replay a different gateway transaction onto a paid order", async () => {
    await webhook(notification());
    expect((await webhook(notification({ trx_id: "9999" }))).status).toBe(400);
  });
  it("keeps sandbox paid but never grants or emits production Purchase after config switch", async () => {
    vi.stubEnv("IPAYMU_ENV", "sandbox"); order.paymentEnvironment = "sandbox";
    expect((await webhook(notification({ is_sandbox: "true" }))).status).toBe(200);
    expect(order).toMatchObject({ status: "PAID", activationToken: null });
    expect(sendActivationEmail).not.toHaveBeenCalled(); expect(db.user.findUnique).not.toHaveBeenCalled();
    vi.stubEnv("IPAYMU_ENV", "production");
    const receipt = createPaymentReceipt(invoice, true)!;
    const result = await status(new NextRequest("https://klassa-edutech.com/api/payment/status", { headers: { cookie: `${PAYMENT_RECEIPT_COOKIE}=${receipt}` } }));
    expect(await result.json()).toMatchObject({ status: "PAID", environment: "sandbox", live: false, tracking: null });
  });
  it("fails closed on absent config or callback arriving before session persistence", async () => {
    order.gatewaySessionId = null; expect((await webhook(notification())).status).toBe(503);
    vi.stubEnv("IPAYMU_API_KEY", ""); expect((await webhook(notification())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects valid DOKU signature against an iPaymu order", async () => {
    vi.stubEnv("DOKU_SECRET_KEY", "doku-test"); vi.stubEnv("DOKU_CLIENT_ID", "doku-client"); vi.stubEnv("DOKU_ENV", "production");
    const body = JSON.stringify({ order: { invoice_number: invoice, amount: 1000 }, transaction: { status: "SUCCESS" } });
    const signature = generateDokuSignature({ clientId: "doku-client", requestId: "req-1", requestTimestamp: "20261108000000", requestTarget: "/api/payment/webhook", jsonBody: body, digest: generateDokuDigest(body), secretKey: "doku-test" } as Parameters<typeof generateDokuSignature>[0]);
    const result = await dokuWebhook(new NextRequest("https://klassa-edutech.com/api/payment/webhook", { method: "POST", headers: { "Client-Id": "doku-client", "Request-Id": "req-1", "Request-Timestamp": "20261108000000", Signature: signature }, body }));
    expect(result.status).toBe(400); expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("account activation", () => {
  const run = () => activate(new NextRequest("https://klassa-edutech.com/api/payment/setup-password", { method: "POST", body: JSON.stringify({ token: "a".repeat(64), password: "safe-test-password" }) }));
  function ready() { order.status = "PAID"; order.activationToken = "a".repeat(64); order.tokenExpiresAt = new Date(Date.now() + 86400000); }
  it("rejects sandbox, expired and already consumed tokens", async () => {
    ready(); order.paymentEnvironment = "sandbox"; expect((await run()).status).toBe(400);
    order.paymentEnvironment = "production"; order.tokenExpiresAt = new Date(0); expect((await run()).status).toBe(400);
    ready(); order.activatedAt = new Date(); expect((await run()).status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it("atomically creates account and consumes token, preventing duplicate activation", async () => {
    ready(); const results = await Promise.all([run(), run()]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(db.user.create).toHaveBeenCalledOnce(); expect(db.account.create).toHaveBeenCalledOnce();
    expect(order.activationToken).toBeNull();
  });
  it("extends a newly-existing user without resetting credentials", async () => {
    ready(); user = { id: "user-1", email: order.customerEmail, subscriptionExpiresAt: new Date(Date.now() + 86400000) } as User;
    const expires = user.subscriptionExpiresAt!.getTime();
    expect((await run()).status).toBe(200);
    expect(user.subscriptionExpiresAt!.getTime()).toBe(expires + 30 * 86400000);
    expect(db.account.create).not.toHaveBeenCalled(); expect(db.user.create).not.toHaveBeenCalled();
  });
});
