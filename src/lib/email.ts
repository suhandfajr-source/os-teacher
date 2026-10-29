import nodemailer from "nodemailer";

interface SendResetEmailParams {
  to: string;
  url: string;
}

export async function sendPasswordResetEmail({ to, url }: SendResetEmailParams): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Klassa OS" <${user || "admin@klassa-edutech.com"}>`;

  // Fallback Dev Mode: jika SMTP belum diatur di .env lokal, cetak link langsung di console server.
  if (!host || !user || !pass) {
    console.log("--------------------------------------------------");
    console.log("🔔 [DEV/FALLBACK RESET PASSWORD EMAIL]");
    console.log(`Kepada: ${to}`);
    console.log(`Tautan Reset: ${url}`);
    console.log("Catatan: Atur SMTP_HOST, SMTP_USER, dan SMTP_PASS di .env untuk kirim email nyata.");
    console.log("--------------------------------------------------");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true untuk port 465, false untuk 587/25
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
      <title>Atur Ulang Kata Sandi - Klassa OS</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 20px; font-weight: 800; color: #0f766e; margin-bottom: 24px; display: inline-block; letter-spacing: -0.5px; }
        h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 12px 0; }
        .btn-wrapper { margin: 28px 0; text-align: center; }
        .btn { display: inline-block; background-color: #0f766e; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 10px; }
        .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 32px; text-align: center; }
        .break-word { word-break: break-all; color: #0f766e; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">KLASSA OS</div>
        <h1>Atur Ulang Kata Sandi Akun Guru</h1>
        <p>Halo,</p>
        <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Klassa Anda (<strong>${to}</strong>).</p>
        <p>Klik tombol di bawah ini untuk membuat kata sandi baru:</p>
        <div class="btn-wrapper">
          <a href="${url}" class="btn" target="_blank" rel="noopener noreferrer">Atur Ulang Kata Sandi</a>
        </div>
        <p>Jika tombol di atas tidak dapat diklik, salin dan tempel tautan berikut ke peramban Anda:</p>
        <p class="break-word">${url}</p>
        <p>Tautan ini hanya berlaku selama 1 jam. Jika Anda tidak pernah meminta pengaturan ulang kata sandi, abaikan email ini dan akun Anda tetap aman.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Klassa Edutech. Ekosistem Kerja Digital Guru Indonesia.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: "Atur Ulang Kata Sandi Akun Klassa Anda",
    text: `Halo, klik tautan berikut untuk mengatur ulang kata sandi akun Anda: ${url}\n\nTautan ini kedaluwarsa dalam 1 jam.`,
    html,
  });
}
