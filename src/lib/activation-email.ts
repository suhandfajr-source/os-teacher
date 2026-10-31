import nodemailer from "nodemailer";

interface SendActivationEmailParams {
  to: string;
  name: string;
  planName: string;
  activationUrl: string;
}

export async function sendActivationEmail({
  to,
  name,
  planName,
  activationUrl,
}: SendActivationEmailParams): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"KLASSA Edutech" <${user || "support@klassa-edutech.com"}>`;

  // Fallback Dev Mode: jika SMTP belum diatur di .env
  if (!host || !user || !pass) {
    console.log("--------------------------------------------------");
    console.log("🎉 [DEV/FALLBACK EMAIL AKTIVASI AKUN KLASSA]");
    console.log(`Kepada: ${name} <${to}>`);
    console.log(`Paket: ${planName}`);
    console.log(`Tautan Aktivasi: ${activationUrl}`);
    console.log("--------------------------------------------------");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Aktivasi Akun KLASSA Anda</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 22px; font-weight: 800; color: #0f766e; margin-bottom: 20px; letter-spacing: -0.5px; }
        .badge { display: inline-block; background-color: #ccfbf1; color: #0f766e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 12px 0; }
        .box { background-color: #f1f5f9; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .btn-wrapper { margin: 28px 0; text-align: center; }
        .btn { display: inline-block; background-color: #0f766e; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25); }
        .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 32px; text-align: center; }
        .break-word { word-break: break-all; color: #0f766e; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">KLASSA</div>
        <div class="badge">PEMBAYARAN BERHASIL</div>
        <h1>Selamat Datang, Bapak/Ibu ${name}!</h1>
        <p>Pembayaran untuk <strong>${planName}</strong> telah berhasil kami terima. Satu langkah lagi untuk mengaktifkan ruang kerja Anda.</p>
        
        <p>Klik tombol di bawah ini untuk membuat kata sandi dan memulai pengisian data mengajar:</p>
        <div class="btn-wrapper">
          <a href="${activationUrl}" class="btn" target="_blank" rel="noopener noreferrer">Aktifkan Akun & Buat Password</a>
        </div>

        <p>Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut:</p>
        <p class="break-word">${activationUrl}</p>

        <p style="font-size: 13px; color: #64748b;">Tautan ini berlaku selama 7 hari. Setelah membuat kata sandi, Anda akan dipandu melalui onboarding singkat untuk menyesuaikan mata pelajaran dan kelas Anda.</p>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} KLASSA Edutech. Ekosistem Kerja Digital Guru Indonesia.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `[KLASSA] Pembayaran Berhasil — Aktivasi Akun ${planName} Anda`,
    html,
  });
}
