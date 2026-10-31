import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token aktivasi tidak diberikan." }, { status: 400 });
    }

    const order = await prisma.paymentOrder.findUnique({
      where: { activationToken: token },
      select: {
        customerEmail: true,
        customerName: true,
        planId: true,
        status: true,
        tokenExpiresAt: true,
        activatedAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Tautan aktivasi tidak ditemukan." }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Pesanan ini belum diselesaikan pembayarannya." }, { status: 400 });
    }

    if (order.activatedAt) {
      return NextResponse.json(
        { error: "Akun ini sudah pernah diaktifkan sebelumnya. Silakan masuk menggunakan kata sandi Anda." },
        { status: 400 }
      );
    }

    if (order.tokenExpiresAt && order.tokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Tautan aktivasi telah kedaluwarsa. Silakan hubungi layanan bantuan." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: order.customerEmail,
      name: order.customerName,
      planId: order.planId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memverifikasi token" }, { status: 500 });
  }
}
