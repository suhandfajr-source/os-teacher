# Rencana Implementasi Payment Gateway Midtrans (KLASSA)

Dokumen ini berisi spesifikasi arsitektur, skema data, API backend, dan integrasi frontend untuk penjualan lisensi KLASSA menggunakan Midtrans Snap API.

---

## 1. Paket Harga & Produk
1. **Paket Bulanan (MONTHLY)**: 1 Bulan (Rp49.000)
2. **Paket Semester (SEMESTER)**: 6 Bulan (Rp199.000)
3. **Paket 1 Tahun Ajaran (ANNUAL)**: 12 Bulan (Rp349.000)

*Catatan Bisnis*: Tidak ada free trial. Akses langsung melalui pembelian langganan untuk menjaga cost AI token (Gemini / OpenAI).

---

## 2. 5 Lapisan Keamanan (Production-Grade)
1. **Server-Side Authority**: Nominal harga dihitung di server berdasarkan `planType`, client dilarang mengirim harga (`amount`).
2. **Cryptographic Signature Verification**: Validasi hash SHA-512 Midtrans (`order_id + status_code + gross_amount + ServerKey`) sebelum membaca payload webhook.
3. **Active Status Re-Verification**: Saat webhook diterima, server melakukan panggilan balik mandiri ke `GET /v2/{order_id}/status` untuk memastikan status asli.
4. **Idempotency & Database Transaction**: Pengecekan status `order.status === "PAID"` di dalam Prisma `$transaction` untuk mencegah perpanjangan ganda dari webhook retries.
5. **Rate Limiting & User Isolation**: Batasi pembuatan draft order per akun guru aktif.

---

## 3. Skema Database (Prisma)

```prisma
enum PaymentStatus {
  PENDING
  PAID
  EXPIRED
  FAILED
}

enum PlanType {
  MONTHLY
  SEMESTER
  ANNUAL
}

model Order {
  id              String        @id @default(cuid())
  userId          String
  planType        PlanType
  amount          Int
  status          PaymentStatus @default(PENDING)
  snapToken       String?
  midtransOrderId String        @unique
  paymentType     String?
  paidAt          DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  planType  PlanType
  startDate DateTime @default(now())
  endDate   DateTime
  isActive  Boolean  @default(true)
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 4. Endpoints yang Perlu Dibuat
1. `POST /api/payments/create-order`
   * Memvalidasi sesi user (Better Auth).
   * Membuat record `Order` (status `PENDING`).
   * Menghubungi endpoint Midtrans Snap v1 untuk generate Snap Token.
2. `POST /api/payments/midtrans/webhook`
   * Memvalidasi signature SHA-512 & verifikasi active fetch.
   * Update order -> `PAID`.
   * Upsert `Subscription` dengan penambahan tanggal aktif (+30, +180, atau +365 hari).

---

## 5. Integrasi Frontend
* Muat Midtrans Snap script (`snap.js`) di landing page atau checkout layout.
* Handler checkout: cek sesi login -> request Snap Token -> `window.snap.pay(token, callbacks)`.
* Redirection sukses ke dashboard dengan notifikasi lisensi aktif.

---

## 6. Access Guard Utility
* Helper `requireActiveSubscription(userId)` untuk membatasi akses modul AI (RPP generator, AI studio, koreksi otomatis) bagi akun yang lisensinya belum aktif/kadaluarsa.
