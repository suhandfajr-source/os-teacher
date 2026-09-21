import { resolvePinPepper } from "@/lib/student-pin";
import { getStudentSessionSecret } from "@/modules/student-auth/student-session";

/**
 * Next.js Instrumentation Hook (Next.js 14+)
 * 
 * Dijalankan sekali saat server runtime booting.
 * Memastikan fail-fast check untuk secret produksi (PIN_PEPPER dan STUDENT_SESSION_SECRET)
 * melunasi utang deferred-work Story 1b & F4 Story 3.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail-fast checks in production
    try {
      resolvePinPepper();
      getStudentSessionSecret();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "production") {
        console.error("❌ CRITICAL SERVER BOOT ERROR:", err instanceof Error ? err.message : err);
        throw err;
      }
    }
  }
}
