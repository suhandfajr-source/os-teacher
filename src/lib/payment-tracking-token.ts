import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYMENT_RECEIPT_COOKIE = "klassa_payment_receipt";
export const PAYMENT_RECEIPT_TTL = 7 * 24 * 60 * 60;
export const PAYMENT_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

type PaymentReceipt = { invoice: string; live: boolean; exp: number };

function secret() {
  return process.env.BETTER_AUTH_SECRET || process.env.DOKU_SECRET_KEY;
}

function signature(payload: string, key: string) {
  return createHmac("sha256", key).update(`klassa-payment-receipt-v1:${payload}`).digest();
}

// Missing tracking configuration must not stop checkout. Never use a public fallback key.
export function createPaymentReceipt(invoice: string, live: boolean, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ invoice, live, exp: Math.floor(now / 1000) + PAYMENT_RECEIPT_TTL })).toString("base64url");
  return `${payload}.${signature(payload, key).toString("base64url")}`;
}

export function verifyPaymentReceipt(token: string | undefined, now = Date.now()): PaymentReceipt | null {
  const key = secret();
  if (!key || !token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const received = Buffer.from(parts[1], "base64url");
  const expected = signature(parts[0], key);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (typeof payload.invoice !== "string" || !/^INV-KLASSA-[A-Z0-9-]{1,100}$/i.test(payload.invoice)
      || typeof payload.live !== "boolean" || !Number.isSafeInteger(payload.exp)
      || payload.exp <= Math.floor(now / 1000) || payload.exp > Math.floor(now / 1000) + PAYMENT_RECEIPT_TTL) return null;
    return payload;
  } catch {
    return null;
  }
}

export function conversionData(order: { invoiceNumber: string; planId: string; amount: number }, name: string, event: "Lead" | "Purchase") {
  return {
    eventId: `klassa-${event.toLowerCase()}-${order.invoiceNumber}`,
    params: { content_ids: [order.planId], content_name: name, value: order.amount, currency: "IDR" },
  };
}
