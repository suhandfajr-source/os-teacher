/**
 * Story 5 — konstanta terpusat (EC-15/BH-18): threshold eskalasi & cap batch
 * dipakai bersama oleh server actions dan panel UI agar tidak pernah desync.
 * File terpisah dari approvals.actions.ts karena modul "use server" hanya
 * boleh mengekspor async functions.
 */
export const ESCALATION_L1_HOURS = 48; // highlight panel pengampu (L1)
export const ESCALATION_L2_HOURS = 24 * 7; // highlight panel semua guru (L2)
export const BATCH_APPROVE_MAX = 100; // G-8
