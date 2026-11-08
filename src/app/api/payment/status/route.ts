import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPricingPlan } from "@/lib/pricing-plans";
import { PAYMENT_PRIVATE_HEADERS, PAYMENT_RECEIPT_COOKIE, verifyPaymentReceipt, conversionData } from "@/lib/payment-tracking-token";

export async function GET(req: NextRequest) {
  const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers: PAYMENT_PRIVATE_HEADERS });
  const receipt = verifyPaymentReceipt(req.cookies.get(PAYMENT_RECEIPT_COOKIE)?.value);
  if (!receipt) return respond({ status: "UNVERIFIED" }, 401);
  try {
    const order = await prisma.paymentOrder.findUnique({
      where: { invoiceNumber: receipt.invoice },
      select: { invoiceNumber: true, planId: true, amount: true, status: true, paidAt: true, paymentEnvironment: true },
    });
    if (!order) return respond({ status: "UNVERIFIED" }, 404);
    const paid = order.status === "PAID" && order.paidAt !== null;
    const live = receipt.live && order.paymentEnvironment === "production";
    return respond({
      status: order.status === "PAID" && !paid ? "PENDING" : order.status,
      live,
      environment: order.paymentEnvironment,
      tracking: paid && live ? conversionData(order, getPricingPlan(order.planId)?.name || order.planId, "Purchase") : null,
    });
  } catch {
    return respond({ status: "UNAVAILABLE" }, 503);
  }
}
