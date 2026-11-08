import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { getPricingPlan } from "./pricing-plans";
import { sendActivationEmail } from "./activation-email";
import { paymentAppUrl } from "./payment-provider";

export async function paymentTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 10000 }); }
    catch (error) {
      if (attempt < 2 && typeof error === "object" && error !== null && "code" in error && (error.code === "P2034" || error.code === "P2002")) continue;
      throw error;
    }
  }
}
export async function fulfillPayment(input: {
  orderId: string; provider: "IPAYMU" | "DOKU"; environment: string;
  status: "PAID" | "PENDING" | "FAILED" | "EXPIRED"; method: string; transactionId?: string;
}) {
  if (!["production", "sandbox"].includes(input.environment)) throw new Error("Payment environment requires reconciliation");
  await paymentTransaction(async tx => {
    const order = await tx.paymentOrder.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.paymentProvider !== input.provider || order.paymentEnvironment !== input.environment) throw new Error("Payment identity mismatch");
    if (order.gatewayTransactionId && input.transactionId && order.gatewayTransactionId !== input.transactionId) throw new Error("Payment transaction mismatch");
    if (order.status === "PAID" || input.status === "PENDING") return;
    if (input.status !== "PAID") {
      await tx.paymentOrder.updateMany({ where: { id: order.id, status: { not: "PAID" } }, data: { status: input.status } });
      return;
    }
    const plan = getPricingPlan(order.planId);
    if (!plan) throw new Error("Unknown payment plan");
    const now = new Date();
    const live = order.paymentEnvironment === "production";
    const claimed = await tx.paymentOrder.updateMany({ where: { id: order.id, status: { not: "PAID" } }, data: {
      status: "PAID", paidAt: now, paymentMethod: input.method, gatewayTransactionId: input.transactionId,
      activationToken: live ? randomBytes(32).toString("hex") : null,
      tokenExpiresAt: live ? new Date(now.getTime() + 7 * 86400000) : null,
    } });
    if (claimed.count !== 1 || !live) return;
    const user = await tx.user.findUnique({ where: { email: order.customerEmail } });
    if (user) {
      const base = Math.max(now.getTime(), user.subscriptionExpiresAt?.getTime() || 0);
      await tx.user.update({ where: { id: user.id }, data: { subscriptionPlan: order.planId, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date(base + plan.durationDays * 86400000) } });
      await tx.paymentOrder.update({ where: { id: order.id }, data: { userId: user.id, activatedAt: now, activationToken: null, tokenExpiresAt: null } });
    }
  });
  // A retry of an already-paid notification can retry email without granting entitlement again.
  if (input.status === "PAID" && input.environment === "production") await deliverPaymentEmail(input.orderId);
}
export async function deliverPaymentEmail(orderId: string) {
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PAID" || order.paymentEnvironment !== "production" || order.activationEmailSentAt) return;
  if (!order.activatedAt && (!order.activationToken || !order.tokenExpiresAt || order.tokenExpiresAt <= new Date())) throw new Error("Activation requires support");
  const lease = new Date();
  const claimed = await prisma.paymentOrder.updateMany({ where: { id: order.id, activationEmailSentAt: null, OR: [
    { activationEmailLeaseAt: null }, { activationEmailLeaseAt: { lt: new Date(lease.getTime() - 300000) } },
  ] }, data: { activationEmailLeaseAt: lease } });
  if (!claimed.count) throw new Error("Email delivery in progress");
  try {
    const url = new URL(order.activatedAt ? "/login" : "/auth/setup-password", paymentAppUrl());
    if (!order.activatedAt) url.searchParams.set("token", order.activationToken!);
    await sendActivationEmail({ to: order.customerEmail, name: order.customerName, planName: getPricingPlan(order.planId)?.name || order.planId, activationUrl: url.toString(), renewal: Boolean(order.activatedAt) });
    await prisma.paymentOrder.updateMany({ where: { id: order.id, activationEmailLeaseAt: lease }, data: { activationEmailSentAt: new Date(), activationEmailLeaseAt: null } });
  } catch {
    await prisma.paymentOrder.updateMany({ where: { id: order.id, activationEmailLeaseAt: lease }, data: { activationEmailLeaseAt: null } });
    throw new Error("Payment email delivery unavailable");
  }
}
