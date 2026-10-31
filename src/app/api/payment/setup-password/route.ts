import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { getPricingPlan } from "@/lib/pricing-plans";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token aktivasi dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi minimal 8 karakter." },
        { status: 400 }
      );
    }

    // 1. Cari Order by Token
    const order = await prisma.paymentOrder.findUnique({
      where: { activationToken: token },
    });

    if (!order) {
      return NextResponse.json({ error: "Tautan aktivasi tidak valid." }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Pesanan belum lunas." }, { status: 400 });
    }

    if (order.activatedAt) {
      return NextResponse.json(
        { error: "Akun ini sudah pernah diaktifkan. Silakan langsung login." },
        { status: 400 }
      );
    }

    if (order.tokenExpiresAt && order.tokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Tautan aktivasi telah kedaluwarsa." },
        { status: 400 }
      );
    }

    const plan = getPricingPlan(order.planId);
    const durationDays = plan?.durationDays || 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const hashedPassword = await hashPassword(password);
    const now = new Date();

    // 2. Cek apakah User sudah ada di database
    let user = await prisma.user.findUnique({
      where: { email: order.customerEmail },
    });

    if (!user) {
      // User baru: create User + Account kredensial Better Auth
      const userId = `usr_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      user = await prisma.user.create({
        data: {
          id: userId,
          name: order.customerName,
          email: order.customerEmail,
          emailVerified: true,
          platformRole: "USER",
          role: "USER",
          registrationOrigin: "PUBLIC_REGISTER",
          subscriptionPlan: order.planId,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      });

      await prisma.account.create({
        data: {
          id: `acc_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
          accountId: order.customerEmail,
          providerId: "credential",
          userId: user.id,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      });
    } else {
      // User lama: update subscription + update password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionPlan: order.planId,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: expiresAt,
          emailVerified: true,
        },
      });

      // Update atau buat credential account
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });

      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            password: hashedPassword,
            updatedAt: now,
          },
        });
      } else {
        await prisma.account.create({
          data: {
            id: `acc_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
            accountId: user.email,
            providerId: "credential",
            userId: user.id,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }

    // 3. Update Order jadi Activated
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        activatedAt: now,
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Akun berhasil diaktifkan.",
      email: user.email,
    });
  } catch (error: any) {
    console.error("❌ [Setup Password Error]:", error);
    return NextResponse.json({ error: error.message || "Gagal mengaktifkan akun" }, { status: 500 });
  }
}
