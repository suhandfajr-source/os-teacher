import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPricingPlan } from "@/lib/pricing-plans";
import { createDokuCheckout, getDokuConfig } from "@/lib/doku";
import { createPaymentReceipt, conversionData } from "@/lib/payment-tracking-token";

// CORS Headers helper agar Landing Page di domain lain bisa fetch
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, name, email, phone } = body;

    // 1. Validasi Input
    if (!planId || !name || !email || !phone) {
      const errorRes = NextResponse.json(
        { error: "Mohon lengkapi seluruh formulir data diri Anda." },
        { status: 400 }
      );
      return setCorsHeaders(errorRes);
    }

    const plan = getPricingPlan(planId);
    if (!plan) {
      const errorRes = NextResponse.json(
        { error: "Paket langganan tidak valid." },
        { status: 400 }
      );
      return setCorsHeaders(errorRes);
    }

    // 2. Buat Nomor Invoice Unik
    const timestamp = Date.now().toString().slice(-6);
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invoiceNumber = `INV-KLASSA-${timestamp}-${randomHex}`;

    // Cek apakah email sudah punya akun terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klassa-edutech.com";
    const config = getDokuConfig();
    const live = config.isProduction && Boolean(config.clientId && config.secretKey);
    const receipt = createPaymentReceipt(invoiceNumber, live);
    const callback = new URL("/api/payment/return", appUrl);
    if (receipt) callback.searchParams.set("receipt", receipt);
    const callbackUrl = callback.toString();

    // 3. Request ke DOKU Checkout API
    const dokuRes = await createDokuCheckout({
      invoiceNumber,
      amount: plan.price,
      customerName: name.trim(),
      customerEmail: email.trim().toLowerCase(),
      customerPhone: phone.trim(),
      callbackUrl,
    });

    // 4. Simpan Order Status PENDING di Database
    const order = await prisma.paymentOrder.create({
      data: {
        invoiceNumber,
        userId: existingUser?.id || null,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        customerPhone: phone.trim(),
        planId: plan.id,
        amount: plan.price,
        status: "PENDING",
        dokuPaymentUrl: dokuRes.paymentUrl,
      },
    });

    const successRes = NextResponse.json({
      success: true,
      invoiceNumber,
      paymentUrl: dokuRes.paymentUrl,
      tracking: live && !dokuRes.raw?.mock
        ? conversionData(order, plan.name, "Lead")
        : null,
    });

    return setCorsHeaders(successRes);
  } catch (error: unknown) {
    console.error("❌ [Checkout API Error]:", error);
    const errorRes = NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses pembayaran" },
      { status: 500 }
    );
    return setCorsHeaders(errorRes);
  }
}
