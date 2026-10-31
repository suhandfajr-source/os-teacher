import crypto from "crypto";

export interface DokuCheckoutRequest {
  invoiceNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  callbackUrl: string;
}

export interface DokuCheckoutResponse {
  paymentUrl: string;
  raw: any;
}

export function getDokuConfig() {
  const clientId = process.env.DOKU_CLIENT_ID || "";
  const secretKey = process.env.DOKU_SECRET_KEY || "";
  const isProduction = process.env.DOKU_ENV === "production";
  const baseUrl = isProduction
    ? "https://api.doku.com"
    : "https://api-sandbox.doku.com";

  return {
    clientId,
    secretKey,
    baseUrl,
    isProduction,
  };
}

/**
 * Generate Digest SHA-256 (Base64) dari JSON Request Body
 */
export function generateDokuDigest(jsonBody: string): string {
  return crypto.createHash("sha256").update(jsonBody, "utf-8").digest("base64");
}

/**
 * Generate Signature HMAC-SHA256 untuk Request Header DOKU
 * Format komponen string to sign:
 * Client-Id + "\n" + Request-Id + "\n" + Request-Timestamp + "\n" + Request-Target + "\n" + Digest
 */
export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  digest: string;
  secretKey: string;
}): string {
  const component =
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${params.requestTarget}\n` +
    `Digest:${params.digest}`;

  const hmac = crypto.createHmac("sha256", params.secretKey);
  hmac.update(component);
  return `HMACSHA256=${hmac.digest("base64")}`;
}

/**
 * Request URL Checkout ke DOKU API
 */
export async function createDokuCheckout(
  params: DokuCheckoutRequest
): Promise<DokuCheckoutResponse> {
  const { clientId, secretKey, baseUrl } = getDokuConfig();

  // Mode mock/sandbox jika credentials belum diatur di .env
  if (!clientId || !secretKey) {
    console.warn("⚠️ [DOKU] DOKU_CLIENT_ID atau DOKU_SECRET_KEY belum diatur di .env. Mengembalikan Mock Payment URL.");
    return {
      paymentUrl: `${params.callbackUrl}?mock_invoice=${params.invoiceNumber}&mock_paid=true`,
      raw: { mock: true },
    };
  }

  const endpoint = "/checkout/v1/payment";
  const requestTimestamp = new Date().toISOString().slice(0, 19) + "Z";
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const bodyPayload = {
    order: {
      invoice_number: params.invoiceNumber,
      amount: params.amount,
      callback_url: params.callbackUrl,
      auto_redirect: true,
    },
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
  };

  const jsonBody = JSON.stringify(bodyPayload);
  const digest = generateDokuDigest(jsonBody);
  const signature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget: endpoint,
    digest,
    secretKey,
  });

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Request-Id": requestId,
      "Request-Timestamp": requestTimestamp,
      "Signature": signature,
    },
    body: jsonBody,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ [DOKU Error Response]:", data);
    throw new Error(data?.error?.message || data?.message || "Gagal membuat sesi pembayaran DOKU");
  }

  const paymentUrl =
    data?.response?.payment?.url ||
    data?.payment?.url ||
    data?.url;

  if (!paymentUrl) {
    throw new Error("URL Pembayaran tidak ditemukan dalam respons DOKU");
  }

  return {
    paymentUrl,
    raw: data,
  };
}

/**
 * Validasi Signature dari Webhook/Notification DOKU
 */
export function verifyDokuNotificationSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  receivedSignature: string;
  jsonBody: string;
  secretKey: string;
}): boolean {
  const digest = generateDokuDigest(params.jsonBody);
  const expectedSignature = generateDokuSignature({
    clientId: params.clientId,
    requestId: params.requestId,
    requestTimestamp: params.requestTimestamp,
    requestTarget: params.requestTarget,
    digest,
    secretKey: params.secretKey,
  });

  return params.receivedSignature === expectedSignature;
}
