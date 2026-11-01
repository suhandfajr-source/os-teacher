import nodemailer from "nodemailer";

interface SendOtpParams {
  to: string;
  name: string;
  code: string;
}

export async function sendOtpEmail({ to, name, code }: SendOtpParams): Promise<void> {
  const host = process.env.SMTP_HOST || "mx10.mailspace.id";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"KLASSA Edutech" <${user || "admin@klassa-edutech.com"}>`;

  if (!user || !pass) {
    console.log("--------------------------------------------------");
    console.log("🔑 [DEV MOCK OTP EMAIL]");
    console.log(`Kepada: ${name} <${to}>`);
    console.log(`Kode OTP: ${code}`);
    console.log("--------------------------------------------------");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Kode Verifikasi Email KLASSA</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 22px; font-weight: 800; color: #0f766e; margin-bottom: 20px; letter-spacing: -0.5px; }
        h1 { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 12px 0; }
        .otp-box { background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: monospace; }
        .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">KLASSA</div>
        <h1>Verifikasi Email Anda</h1>
        <p>Halo <strong>${name}</strong>,</p>
        <p>Gunakan kode verifikasi berikut untuk mengonfirmasi bahwa alamat email ini aktif sebelum melanjutkan pembayaran:</p>
        
        <div class="otp-box">
          <div class="otp-code">${code}</div>
        </div>

        <p style="font-size: 13px; color: #64748b;">Kode ini hanya berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} KLASSA Edutech &bull; Sistem Asisten Mengajar Cerdas
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Kode Verifikasi KLASSA: ${code}`,
    html,
  });
}
