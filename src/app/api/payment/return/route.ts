import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_PRIVATE_HEADERS, PAYMENT_RECEIPT_COOKIE, PAYMENT_RECEIPT_TTL, verifyPaymentReceipt } from "@/lib/payment-tracking-token";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("receipt") || undefined;
  const receipt = verifyPaymentReceipt(token);
  const response = NextResponse.redirect(new URL("/payment/success", req.url), 303);
  for (const [key, value] of Object.entries(PAYMENT_PRIVATE_HEADERS)) response.headers.set(key, value);
  // Strip the capability from the address bar before any marketing code is loaded.
  // Invalid returns also clear a previous receipt rather than showing an older payment.
  response.cookies.set(PAYMENT_RECEIPT_COOKIE, receipt ? token! : "", {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/payment",
    maxAge: receipt ? Math.min(PAYMENT_RECEIPT_TTL, receipt.exp - Math.floor(Date.now() / 1000)) : 0,
  });
  return response;
}
