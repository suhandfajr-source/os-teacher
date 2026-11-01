import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendOtpEmail } from "@/lib/otp-email";

// Simpan OTP di memory (email -> { code, expiresAt, attempts })
// Untuk multi-instance, fallback toleransi validasi
interface OtpEntry {
  code: string;
  name: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action; // "send" | "verify"
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "Pendidik").trim();

    if (!email || !email.includes("@")) {
      const res = NextResponse.json({ error: "Alamat email tidak valid." }, { status: 400 });
      return setCorsHeaders(res);
    }

    // ACTION 1: SEND OTP
    if (action === "send") {
      // Generate 4 digit angka
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 menit

      otpStore.set(email, {
        code,
        name,
        expiresAt,
        attempts: 0,
      });

      try {
        await sendOtpEmail({ to: email, name, code });
      } catch (err: any) {
        console.error("Gagal kirim OTP via SMTP:", err);
        const res = NextResponse.json(
          { error: "Gagal mengirim email verifikasi ke alamat tersebut. Pastikan alamat email benar." },
          { status: 500 }
        );
        return setCorsHeaders(res);
      }

      const res = NextResponse.json({ success: true, message: "Kode OTP berhasil dikirim." });
      return setCorsHeaders(res);
    }

    // ACTION 2: VERIFY OTP
    if (action === "verify") {
      const inputCode = (body.code || "").trim();
      const entry = otpStore.get(email);

      if (!entry) {
        const res = NextResponse.json(
          { error: "Kode verifikasi tidak ditemukan atau sudah kadaluarsa. Silakan minta kode baru." },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }

      if (Date.now() > entry.expiresAt) {
        otpStore.delete(email);
        const res = NextResponse.json(
          { error: "Kode verifikasi sudah kadaluarsa. Silakan minta kode baru." },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }

      if (entry.attempts >= 5) {
        otpStore.delete(email);
        const res = NextResponse.json(
          { error: "Terlalu banyak percobaan salah. Silakan minta kode baru." },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }

      if (entry.code !== inputCode) {
        entry.attempts += 1;
        const res = NextResponse.json(
          { error: "Kode verifikasi salah. Mohon periksa kembali email Anda." },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }

      // Valid: Hapus OTP dan generate verification token sekali pakai
      otpStore.delete(email);
      const verificationToken = crypto
        .createHash("sha256")
        .update(`${email}:${Date.now()}:${process.env.BETTER_AUTH_SECRET || "klassa"}`)
        .digest("hex");

      const res = NextResponse.json({
        success: true,
        message: "Email berhasil diverifikasi.",
        verificationToken,
      });
      return setCorsHeaders(res);
    }

    const res = NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
    return setCorsHeaders(res);
  } catch (err: any) {
    console.error("OTP API Error:", err);
    const res = NextResponse.json({ error: err.message || "Terjadi kesalahan server." }, { status: 500 });
    return setCorsHeaders(res);
  }
}
