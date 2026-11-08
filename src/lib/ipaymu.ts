import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PaymentEnvironment = "sandbox" | "production";
export class IpaymuError extends Error {
  constructor() { super("Layanan pembayaran iPaymu belum tersedia. Silakan coba lagi nanti."); }
}
export function getIpaymuConfig() {
  const environment = process.env.IPAYMU_ENV;
  const va = process.env.IPAYMU_VA?.trim();
  const apiKey = process.env.IPAYMU_API_KEY?.trim();
  if ((environment !== "sandbox" && environment !== "production") || !va || !/^\d+$/.test(va) || !apiKey) throw new IpaymuError();
  return { environment, va, apiKey, baseUrl: environment === "production" ? "https://my.ipaymu.com" : "https://sandbox.ipaymu.com" };
}
export type IpaymuConfig = ReturnType<typeof getIpaymuConfig>;
export function signIpaymuRequest(json: string, config: IpaymuConfig) {
  const hash = createHash("sha256").update(json).digest("hex");
  return createHmac("sha256", config.apiKey).update(`POST:${config.va}:${hash}:${config.apiKey}`).digest("hex");
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
async function request(path: "/api/v2/payment" | "/api/v2/transaction", body: object, config: IpaymuConfig) {
  try {
    const json = JSON.stringify(body);
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", va: config.va, signature: signIpaymuRequest(json, config), timestamp: new Date().toISOString().replace(/\D/g, "").slice(0, 14) },
      body: json,
    });
    const data: unknown = await response.json();
    if (!response.ok || !isRecord(data) || data.Status !== 200 || data.Success === false || !isRecord(data.Data)) throw new IpaymuError();
    return data.Data;
  } catch { throw new IpaymuError(); }
}
export async function createIpaymuCheckout(input: {
  invoiceNumber: string; amount: number; productName: string; customerName: string;
  customerEmail: string; customerPhone: string; callbackUrl: string; notifyUrl: string;
}, config = getIpaymuConfig()) {
  const data = await request("/api/v2/payment", {
    product: [input.productName], qty: ["1"], price: [String(input.amount)], description: ["Langganan aplikasi KLASSA"],
    returnUrl: input.callbackUrl, cancelUrl: input.callbackUrl, notifyUrl: input.notifyUrl,
    referenceId: input.invoiceNumber, buyerName: input.customerName, buyerEmail: input.customerEmail, buyerPhone: input.customerPhone,
  }, config);
  try {
    if (typeof data.Url !== "string" || typeof data.SessionID !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(data.SessionID)) throw new IpaymuError();
    const url = new URL(data.Url);
    if (url.origin !== config.baseUrl || url.username || url.password || !url.pathname.startsWith("/payment/")) throw new IpaymuError();
    return { paymentUrl: url.toString(), sessionId: data.SessionID };
  } catch { throw new IpaymuError(); }
}
export async function checkIpaymuTransaction(transactionId: string, config: IpaymuConfig) {
  return request("/api/v2/transaction", { transactionId }, config);
}

export function integer(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
export function money(value: unknown): number | null {
  if (typeof value === "string" && /^\d+(\.0+)?$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
// Canonical form from the documented URL-encoded callback recipe. Reject ambiguous values.
export function canonicalCallback(raw: Record<string, unknown>): string {
  const data: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(raw).sort()) {
    if (key === "signature") continue;
    const value = raw[key];
    if (["trx_id", "status_code", "transaction_status_code", "paid_off"].includes(key)) {
      const parsed = integer(value);
      if (parsed === null) throw new IpaymuError();
      data[key] = parsed;
    } else if (key === "is_escrow") {
      if (![true, false, "true", "false", "0", "1", 0, 1].includes(value as never)) throw new IpaymuError();
      data[key] = value === true || value === "true" || value === "1" || value === 1;
    } else if (key === "additional_info") {
      if (value === "[]") data[key] = [];
      else if (Array.isArray(value) && value.length === 0) data[key] = [];
      else throw new IpaymuError(); // not used by our checkout; fail closed on unsupported nested metadata
    } else {
      if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") throw new IpaymuError();
      data[key] = value === null ? "" : String(value);
    }
  }
  if (!("additional_info" in data)) data.additional_info = [];
  const sorted = Object.fromEntries(Object.keys(data).sort().map(key => [key, data[key]]));
  return JSON.stringify(sorted).replace(/\//g, "\\/");
}
export function verifyIpaymuCallback(raw: Record<string, unknown>, signature: string, va: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  try {
    const expected = createHmac("sha256", va).update(canonicalCallback(raw)).digest();
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  } catch { return false; }
}
export async function readIpaymuCallback(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > 32768) throw new IpaymuError();
  const text = await req.text();
  if (Buffer.byteLength(text) > 32768) throw new IpaymuError();
  const type = req.headers.get("content-type")?.split(";")[0].trim();
  if (type === "application/json") {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data)) throw new IpaymuError();
    return data;
  }
  if (type !== "application/x-www-form-urlencoded") throw new IpaymuError();
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, value] of new URLSearchParams(text)) {
    if (Object.hasOwn(result, key)) throw new IpaymuError();
    result[key] = value;
  }
  return result;
}
