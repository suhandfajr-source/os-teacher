import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { PersetujuanClient } from "./PersetujuanClient";
import { getPendingStudentsForSchoolAction, getSchoolClassesForMoveAction } from "@/modules/approvals/approvals.actions";

/**
 * Story 5 — Panel L2 sekolah-wide (CAP-7): seluruh siswa PENDING lintas rombel
 * TANPA filter periode (G-7), highlight eskalasi >7 hari (F2), aksi batch (N6/OQ-2/G-8),
 * pindah rombel (N5/F12), dan reset PIN (B2/OQ-4/F8).
 */
export default async function PersetujuanPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }
  if (!authContext?.activeSchoolId) redirect("/onboarding");

  const [pendingRes, classesRes] = await Promise.all([
    getPendingStudentsForSchoolAction(),
    getSchoolClassesForMoveAction(),
  ]);

  return (
    <PersetujuanClient
      initialPending={pendingRes.pending ?? []}
      escalatedThresholdHours={pendingRes.escalatedThresholdHours ?? 168}
      classes={classesRes.classes ?? []}
    />
  );
}
