/**
 * BH-9 (defer Story 6, diterapkan 2026-10-02): sumber tunggal formula eskalasi
 * lockout (B3/F6): percobaan gagal ke-5 → 15 menit, 6–9 → 1 jam, ≥10 → 24 jam.
 * Dipakai loginStudent (ACTIVE/PENDING/REJECTED) & cabang klaim ulang registerStudent.
 *
 * File murni TANPA "use server" — file actions wajib async export,
 * helper sinkron tidak boleh tinggal di sana (build error 2026-10-02).
 */
export function lockoutAfter(failedAttempts: number, now: Date): Date | null {
  if (failedAttempts >= 10) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (failedAttempts >= 6) return new Date(now.getTime() + 60 * 60 * 1000);
  if (failedAttempts === 5) return new Date(now.getTime() + 15 * 60 * 1000);
  return null;
}
