import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkIpaymuTransaction, getIpaymuConfig, integer, money, readIpaymuCallback, verifyIpaymuCallback } from "@/lib/ipaymu";
import { fulfillPayment } from "@/lib/payment-fulfillment";

const reply = (status: number) => NextResponse.json({ received: status === 200 }, { status });
export async function POST(req: NextRequest) {
  let config;
  try { config = getIpaymuConfig(); } catch { return reply(503); }
  let payload;
  try { payload = await readIpaymuCallback(req); } catch { return reply(400); }
  if (!verifyIpaymuCallback(payload, req.headers.get("x-signature") || "", config.va)) return reply(400);
  const invoice = payload.reference_id ?? payload.referenceId;
  const id = integer(payload.trx_id);
  if (typeof invoice !== "string" || !invoice || id === null || id <= 0
    || (payload.referenceId !== undefined && payload.referenceId !== invoice)
    || String(payload.merchant) !== config.va || typeof payload.sid !== "string") return reply(400);
  const sandbox = payload.is_sandbox;
  if (!["true", "false", true, false, "1", "0", 1, 0].includes(sandbox as never)) return reply(400);
  const environment = ["true", true, "1", 1].includes(sandbox as never) ? "sandbox" : "production";
  if (environment !== config.environment) return reply(400);
  try {
    const order = await prisma.paymentOrder.findUnique({ where: { invoiceNumber: invoice } });
    if (!order) return reply(404);
    if (order.paymentProvider !== "IPAYMU" || order.paymentEnvironment !== environment) return reply(400);
    if (!order.gatewaySessionId) return reply(503); // callback may race session persistence
    if (order.gatewaySessionId !== payload.sid || money(payload.amount) !== order.amount) return reply(400);
    if (order.gatewayTransactionId && order.gatewayTransactionId !== String(id)) return reply(400);
    // VA is not a sufficient secret. Always re-query with the API key, even on paid replays.
    const detail = await checkIpaymuTransaction(String(id), config);
    if (integer(detail.TransactionId) !== id || detail.SessionId !== order.gatewaySessionId
      || detail.ReferenceId !== order.invoiceNumber || money(detail.Amount) !== order.amount) return reply(400);
    const status = integer(detail.Status);
    let localStatus: "PAID" | "PENDING" | "FAILED" | "EXPIRED";
    if ((status === 1 || status === 6) && detail.PaidStatus === "paid") localStatus = "PAID";
    else if (status === 0 && detail.PaidStatus !== "paid") localStatus = "PENDING";
    else if (status === -2 && detail.PaidStatus !== "paid") localStatus = "EXPIRED";
    else if ([2, 4, 5].includes(status ?? NaN) && detail.PaidStatus !== "paid") localStatus = "FAILED";
    else return reply(400); // refund, escrow, unknown or contradictory state: reconcile manually
    await fulfillPayment({ orderId: order.id, provider: "IPAYMU", environment, status: localStatus, method: "IPAYMU", transactionId: String(id) });
    return reply(200);
  } catch { return reply(503); }
}
