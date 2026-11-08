import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPricingPlan } from "@/lib/pricing-plans";
import { createDokuCheckout } from "@/lib/doku";
import { createIpaymuCheckout, isRecord } from "@/lib/ipaymu";
import { getPaymentProvider, paymentAppUrl } from "@/lib/payment-provider";
import { createPaymentReceipt, conversionData } from "@/lib/payment-tracking-token";

function respond(body: object, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export async function OPTIONS() { return respond({}); }

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return respond({ error: "Data pembayaran tidak valid." }, 400); }
  if (!isRecord(body) || ["planId", "name", "email", "phone"].some(key => typeof body[key] !== "string" || !body[key].trim() || body[key].length > 254)) {
    return respond({ error: "Mohon lengkapi seluruh formulir data diri Anda." }, 400);
  }
  const { planId, name, email, phone } = body as Record<string, string>;
  const plan = getPricingPlan(planId);
  if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return respond({ error: "Paket atau email tidak valid." }, 400);
  try {
    const provider = getPaymentProvider(); // Fail before persistence/network if iPaymu is unconfigured.
    const appUrl = paymentAppUrl();
    const invoiceNumber = `INV-KLASSA-${randomUUID().toUpperCase()}`;
    const receipt = createPaymentReceipt(invoiceNumber, provider.live);
    if (provider.provider === "IPAYMU" && !receipt) return respond({ error: "Konfigurasi pembayaran belum lengkap." }, 503);
    const callback = new URL("/api/payment/return", appUrl);
    if (receipt) callback.searchParams.set("receipt", receipt);
    const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    const order = await prisma.paymentOrder.create({ data: {
      invoiceNumber, userId: existingUser?.id || null, customerName: name.trim(), customerEmail: email.trim().toLowerCase(), customerPhone: phone.trim(),
      planId: plan.id, amount: plan.price, status: "PENDING", paymentProvider: provider.provider, paymentEnvironment: provider.environment,
    } });
    const input = { invoiceNumber, amount: plan.price, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, callbackUrl: callback.toString() };
    let paymentUrl: string;
    let mock = false;
    if (provider.provider === "IPAYMU") {
      const result = await createIpaymuCheckout({ ...input, productName: plan.name, notifyUrl: new URL("/api/payment/ipaymu/webhook", appUrl).toString() }, provider.config);
      paymentUrl = result.paymentUrl;
      // No browser can pay until session identity is durably attached to this order.
      await prisma.paymentOrder.update({ where: { id: order.id }, data: { paymentUrl, gatewaySessionId: result.sessionId } });
    } else {
      const result = await createDokuCheckout(input);
      paymentUrl = result.paymentUrl;
      mock = Boolean(result.raw?.mock);
      await prisma.paymentOrder.update({ where: { id: order.id }, data: { dokuPaymentUrl: paymentUrl, paymentUrl, ...(mock ? { paymentEnvironment: "sandbox" } : {}) } });
    }
    return respond({ success: true, invoiceNumber, paymentUrl, environment: mock ? "sandbox" : provider.environment,
      tracking: provider.live && !mock ? conversionData(order, plan.name, "Lead") : null });
  } catch {
    // Unknown gateway outcomes stay PENDING for reconciliation; never retry creation automatically.
    return respond({ error: "Pembayaran belum dapat diproses. Jika sudah membayar, hubungi bantuan sebelum mencoba kembali." }, 500);
  }
}
