import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { getPricingPlan } from "@/lib/pricing-plans";
import { paymentTransaction } from "@/lib/payment-fulfillment";

class InvalidActivation extends Error {}
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Token atau kata sandi tidak valid (8–128 karakter)." }, { status: 400 });
    }
    const hashedPassword = await hashPassword(password);
    const result = await paymentTransaction(async tx => {
      const order = await tx.paymentOrder.findUnique({ where: { activationToken: token } });
      const now = new Date();
      if (!order || order.status !== "PAID" || order.paymentEnvironment !== "production" || order.activatedAt || !order.tokenExpiresAt || order.tokenExpiresAt <= now) throw new InvalidActivation();
      const plan = getPricingPlan(order.planId);
      if (!plan) throw new InvalidActivation();
      // Claim the entitlement and all account writes together. Serializable retries handle races.
      const claimed = await tx.paymentOrder.updateMany({ where: { id: order.id, activatedAt: null, status: "PAID", paymentEnvironment: "production" }, data: { activatedAt: now } });
      if (claimed.count !== 1) throw new InvalidActivation();
      let user = await tx.user.findUnique({ where: { email: order.customerEmail } });
      const existing = Boolean(user);
      if (user) {
        const base = Math.max(now.getTime(), user.subscriptionExpiresAt?.getTime() || 0);
        user = await tx.user.update({ where: { id: user.id }, data: { subscriptionPlan: order.planId, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date(base + plan.durationDays * 86400000) } });
        // A purchase token must not reset an existing account's password.
      } else {
        user = await tx.user.create({ data: {
          id: `usr_${randomUUID()}`, name: order.customerName, email: order.customerEmail, emailVerified: true,
          platformRole: "USER", role: "USER", registrationOrigin: "PUBLIC_REGISTER",
          subscriptionPlan: order.planId, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date(now.getTime() + plan.durationDays * 86400000),
          createdAt: now, updatedAt: now,
        } });
        await tx.account.create({ data: { id: `acc_${randomUUID()}`, accountId: order.customerEmail, providerId: "credential", userId: user.id, password: hashedPassword, createdAt: now, updatedAt: now } });
      }
      await tx.paymentOrder.update({ where: { id: order.id }, data: { userId: user.id, activationToken: null, tokenExpiresAt: null } });
      return { email: user.email, existing };
    });
    return NextResponse.json({ success: true, email: result.email, message: result.existing ? "Paket aktif. Masuk menggunakan kata sandi akun Anda yang sebelumnya." : "Akun berhasil diaktifkan." });
  } catch (error) {
    return NextResponse.json({ error: "Aktivasi belum dapat diproses. Tautan mungkin tidak valid, sudah digunakan, atau kedaluwarsa." }, { status: error instanceof InvalidActivation || error instanceof SyntaxError ? 400 : 503 });
  }
}
