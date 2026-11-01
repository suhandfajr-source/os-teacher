import dns from "dns";
import net from "net";

// Daftar domain populer untuk deteksi typo cerdas
const COMMON_DOMAINS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.co.id": "yahoo.co.id",
  "hotmial.com": "hotmail.com",
  "otlook.com": "outlook.com",
};

// Domain disposable / email sementara yang dilarang
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "throwawaymail.com", "guerrillamail.com", "mailinator.com",
  "sharklasers.com", "10minutemail.com", "yopmail.com", "trashmail.com"
]);

export interface EmailVerificationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

/**
 * Validasi mendalam alamat email:
 * 1. Syntax & regex check
 * 2. Typo domain check
 * 3. Disposable email check
 * 4. DNS MX record check (apakah domain punya server email penerima)
 * 5. SMTP handshake ping (apakah mailbox tujuan merespon)
 */
export async function verifyEmailAddress(email: string): Promise<EmailVerificationResult> {
  const cleanEmail = (email || "").trim().toLowerCase();

  // 1. Format Regex Dasar
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleanEmail)) {
    return {
      valid: false,
      reason: "Format email tidak valid. Pastikan penulisan email sudah benar.",
    };
  }

  const [username, domain] = cleanEmail.split("@");

  if (!username || !domain) {
    return { valid: false, reason: "Format email tidak lengkap." };
  }

  // 2. Cek Typo Domain Populer
  if (COMMON_DOMAINS[domain]) {
    const suggestedEmail = `${username}@${COMMON_DOMAINS[domain]}`;
    return {
      valid: false,
      reason: `Domain @${domain} mungkin salah ketik. Apakah maksud Anda @${COMMON_DOMAINS[domain]}?`,
      suggestion: suggestedEmail,
    };
  }

  // 3. Cek Email Sementara (Disposable)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Alamat email sementara (disposable) tidak diizinkan.",
    };
  }

  // 4. DNS MX Record Check
  let mxRecords: dns.MxRecord[] = [];
  try {
    mxRecords = await dns.promises.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        reason: `Domain @${domain} tidak memiliki server email aktif. Email ini tidak dapat menerima pesan.`,
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      reason: `Domain @${domain} tidak ditemukan di internet atau tidak dapat menerima email.`,
    };
  }

  // Urutkan MX record berdasarkan prioritas terkecil
  mxRecords.sort((a, b) => a.priority - b.priority);
  const targetMxHost = mxRecords[0].exchange;

  // 5. SMTP Handshake Check (Simulasi Cek Mailbox)
  try {
    const isMailboxActive = await pingSmtpMailbox(targetMxHost, cleanEmail);
    if (!isMailboxActive.valid) {
      return isMailboxActive;
    }
  } catch {
    // Jika server penerima memblokir port 25 lokal, fallback loloskan jika MX record valid
  }

  return { valid: true };
}

/**
 * Menghubungi server email penerima via socket TCP untuk cek apakah mailbox tersedia
 */
function pingSmtpMailbox(mxHost: string, recipientEmail: string): Promise<EmailVerificationResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let timer: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
    };

    timer = setTimeout(() => {
      cleanup();
      // Timeout aman (banyak provider seperti Gmail membatasi koneksi port 25 residensial)
      resolve({ valid: true });
    }, 4000);

    socket.connect(25, mxHost, () => {});

    socket.on("data", (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3), 10);

      // 550 / 551 / 553 / 554 = User tidak ditemukan atau mailbox ditolak
      if (code >= 550 && code <= 554) {
        cleanup();
        resolve({
          valid: false,
          reason: "Alamat email ini tidak ditemukan di server penyedia email tersebut.",
        });
        return;
      }

      if (step === 0 && (code === 220 || code === 250)) {
        step++;
        socket.write(`HELO klassa-edutech.com\r\n`);
      } else if (step === 1 && code === 250) {
        step++;
        socket.write(`MAIL FROM:<verify@klassa-edutech.com>\r\n`);
      } else if (step === 2 && code === 250) {
        step++;
        socket.write(`RCPT TO:<${recipientEmail}>\r\n`);
      } else if (step === 3) {
        cleanup();
        if (code === 250) {
          resolve({ valid: true });
        } else if (code === 550 || code === 551 || code === 553) {
          resolve({
            valid: false,
            reason: "Alamat email tidak terdaftar atau tidak dapat menerima email.",
          });
        } else {
          resolve({ valid: true });
        }
      }
    });

    socket.on("error", () => {
      cleanup();
      // Jika port 25 terblokir ISP lokal, anggap valid selama MX record lolos
      resolve({ valid: true });
    });
  });
}
