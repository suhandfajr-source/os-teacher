import { getDokuConfig } from "./doku";
import { getIpaymuConfig } from "./ipaymu";

export function getPaymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER || "doku";
  if (provider === "ipaymu") {
    const config = getIpaymuConfig();
    return { provider: "IPAYMU" as const, environment: config.environment, live: config.environment === "production", config };
  }
  if (provider !== "doku") throw new Error("Konfigurasi pembayaran tidak tersedia.");
  const config = getDokuConfig();
  return { provider: "DOKU" as const, environment: config.isProduction ? "production" : "sandbox", live: config.isProduction && Boolean(config.clientId && config.secretKey), config };
}
export function paymentAppUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://klassa-edutech.com");
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Konfigurasi URL pembayaran tidak valid.");
  return url.origin;
}
