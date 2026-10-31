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

    const { secretKey, isProduction } = getDokuConfig();

    // Verifikasi Signature DOKU di mode Production
    if (isProduction && secretKey) {
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

    const payload = JSON.parse(rawBody);
    console.log("📥 [DOKU Webhook Notification Received]:", payload);

    // Ambil data transaksi dari DOKU
    const orderData = payload.order || {};
    const transactionData = payload.transaction || {};
    const invoiceNumber = orderData.invoice_number;
    const paymentStatus = transactionData.status || payload.status; // SUCCESS / FAILED

    if (!invoiceNumber) {
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

    // Jika status bukan SUCCESS, catat statusnya
    if (paymentStatus !== "SUCCESS") {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ message: "Recorded as failed" });
    }

    // Hindari double processing jika sudah PAID
    if (order.status === "PAID") {
      return NextResponse.json({ message: "Order already processed" });
    }

    // 1. Update Order jadi PAID
    const activationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Hari
    const paidAt = new Date();

    const plan = getPricingPlan(order.planId);
    const durationDays = plan?.durationDays || 30;

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentMethod: transactionData.payment_channel || "DOKU",
        paidAt,
        activationToken,
        tokenExpiresAt,
      },
    });

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
  } catch (error: any) {
    console.error("❌ [DOKU Webhook Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
