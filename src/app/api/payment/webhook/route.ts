import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getPricingPlan } from "@/lib/pricing-plans";
import { verifyDokuNotificationSignature, getDokuConfig } from "@/lib/doku";
import { sendActivationEmail } from "@/lib/activation-email";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;

    const clientId = headers.get("client-id") || "";
    const requestId = headers.get("request-id") || "";
    const requestTimestamp = headers.get("request-timestamp") || "";
    const signature = headers.get("signature") || "";

    const { secretKey, clientId: expectedClientId } = getDokuConfig();

    // Fail closed in every environment: unsigned notifications must never mark an order paid.
    if (!secretKey || !expectedClientId) {
      return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 });
    }
    if (clientId !== expectedClientId || !requestId || !requestTimestamp || !signature) {
      return NextResponse.json({ error: "Invalid notification headers" }, { status: 400 });
    }
    {
      const isValid = verifyDokuNotificationSignature({
        clientId,
        requestId,
        requestTimestamp,
        requestTarget: "/api/payment/webhook",
        receivedSignature: signature,
        jsonBody: rawBody,
        secretKey,
      });

      if (!isValid) {
        console.error("❌ [DOKU Webhook] Signature TIDAK VALID");
        return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    }

    // Ambil data transaksi dari DOKU
    const orderData = payload.order || {};
    const transactionData = payload.transaction || {};
    const invoiceNumber = orderData.invoice_number;
    const paymentStatus = transactionData.status || payload.status; // SUCCESS / FAILED

    if (typeof invoiceNumber !== "string" || !invoiceNumber) {
      return NextResponse.json({ error: "Invoice number missing" }, { status: 400 });
    }

    // Cari Order di DB
    const order = await prisma.paymentOrder.findUnique({
      where: { invoiceNumber },
    });

    if (!order) {
      console.warn(`⚠️ [DOKU Webhook] Order ${invoiceNumber} tidak ditemukan di database.`);
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Paid orders are terminal; delayed failure/pending notifications cannot downgrade them.
    if (order.status === "PAID") {
      return NextResponse.json({ message: "Order already processed" });
    }
    if (paymentStatus !== "SUCCESS") {
      if (paymentStatus === "FAILED" || paymentStatus === "EXPIRED") {
        await prisma.paymentOrder.updateMany({
          where: { id: order.id, status: { not: "PAID" } },
          data: { status: paymentStatus },
        });
      }
      return NextResponse.json({ message: "Non-success notification recorded" });
    }
    const amount = typeof orderData.amount === "number" ? orderData.amount
      : typeof orderData.amount === "string" && /^\d+(\.0+)?$/.test(orderData.amount) ? Number(orderData.amount) : NaN;
    if (!Number.isSafeInteger(amount) || amount !== order.amount) {
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
    }

    // 1. Update Order jadi PAID
    const activationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Hari
    const paidAt = new Date();

    const plan = getPricingPlan(order.planId);
    const durationDays = plan?.durationDays || 30;

    const claimed = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        paymentMethod: transactionData.payment_channel || "DOKU",
        paidAt,
        activationToken,
        tokenExpiresAt,
      },
    });

    if (claimed.count !== 1) {
      return NextResponse.json({ message: "Order already processed" });
    }

    // 2. Cek apakah User sudah ada di database
    const existingUser = await prisma.user.findUnique({
      where: { email: order.customerEmail },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klassa-edutech.com";
    const activationUrl = `${appUrl}/auth/setup-password?token=${activationToken}`;

    if (existingUser) {
      // Perpanjang atau aktifkan subscription user yang sudah terdaftar
      const currentExpiry = existingUser.subscriptionExpiresAt && existingUser.subscriptionExpiresAt > new Date()
        ? existingUser.subscriptionExpiresAt
        : new Date();
      const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          subscriptionPlan: order.planId,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: newExpiry,
        },
      });

      console.log(`✅ [Subscription Updated] User ${existingUser.email} aktif s.d. ${newExpiry.toISOString()}`);
    }

    // 3. Kirim Email Aktivasi
    try {
      await sendActivationEmail({
        to: order.customerEmail,
        name: order.customerName,
        planName: plan?.name || order.planId,
        activationUrl,
      });
    } catch (mailErr) {
      console.error("⚠️ [Email Send Error]:", mailErr);
    }

    return NextResponse.json({
      status: "SUCCESS",
      message: "Order updated, activation sent.",
    });
  } catch (error: unknown) {
    console.error("❌ [DOKU Webhook Error]:", error);
    return NextResponse.json({ error: "Payment processing failed" }, { status: 500 });
  }
}
