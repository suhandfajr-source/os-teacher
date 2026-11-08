import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyDokuNotificationSignature, getDokuConfig } from "@/lib/doku";
import { isRecord, money } from "@/lib/ipaymu";
import { fulfillPayment } from "@/lib/payment-fulfillment";

export async function POST(req: NextRequest) {
  const reply = (status: number) => NextResponse.json({ received: status === 200 }, { status });
  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody) > 32768) return reply(400);
    const clientId = req.headers.get("client-id") || "";
    const requestId = req.headers.get("request-id") || "";
    const requestTimestamp = req.headers.get("request-timestamp") || "";
    const signature = req.headers.get("signature") || "";
    const config = getDokuConfig();
    if (!config.secretKey || !config.clientId) return reply(503);
    if (clientId !== config.clientId || !requestId || !requestTimestamp || !signature) return reply(400);
    if (!verifyDokuNotificationSignature({ clientId, requestId, requestTimestamp, requestTarget: "/api/payment/webhook", receivedSignature: signature, jsonBody: rawBody, secretKey: config.secretKey })) return reply(400);
    let payload;
    try { payload = JSON.parse(rawBody); } catch { return reply(400); }
    if (!isRecord(payload) || !isRecord(payload.order) || !isRecord(payload.transaction) || typeof payload.order.invoice_number !== "string") return reply(400);
    const order = await prisma.paymentOrder.findUnique({ where: { invoiceNumber: payload.order.invoice_number } });
    if (!order) return reply(404);
    if (order.paymentProvider !== "DOKU") return reply(400);
    // Legacy unknown-mode paid orders remain terminal. Pending ones need explicit reconciliation.
    if (order.paymentEnvironment === "unknown") return reply(order.status === "PAID" ? 200 : 503);
    const environment = config.isProduction ? "production" : "sandbox";
    if (order.paymentEnvironment !== environment) return reply(400);
    const status = payload.transaction.status || payload.status;
    if (status === "SUCCESS" && money(payload.order.amount) !== order.amount) return reply(400);
    if (!["SUCCESS", "FAILED", "EXPIRED", "PENDING"].includes(String(status))) return reply(200);
    await fulfillPayment({ orderId: order.id, provider: "DOKU", environment,
      status: status === "SUCCESS" ? "PAID" : status as "FAILED" | "EXPIRED" | "PENDING",
      method: typeof payload.transaction.payment_channel === "string" ? payload.transaction.payment_channel.slice(0, 100) : "DOKU" });
    return reply(200);
  } catch { return reply(503); }
}
