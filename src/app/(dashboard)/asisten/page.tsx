import { Metadata } from "next";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/auth";
import { listConversationsAction } from "@/modules/agent/agent.actions";
import { getTeacherAgentMemoryAction } from "@/modules/agent/memory/agent-memory.actions";
import AsistenClient from "./AsistenClient";

export const metadata: Metadata = {
  title: "Klassa Agent — Asisten Cerdas Guru | Klassa OS",
  description:
    "Rekan diskusi pedagogis dan asisten operasional guru berbasis AI untuk analisis kelas dan otomatisasi administrasi.",
};

export const dynamic = "force-dynamic";

export default async function AsistenPage() {
  const { activeSchoolId, session } = await verifyActiveSchoolMembership();

  const [school, convsRes, memoryRes] = await Promise.all([
    prisma.school.findUnique({
      where: { id: activeSchoolId },
      select: { name: true },
    }),
    listConversationsAction(),
    getTeacherAgentMemoryAction(),
  ]);

  const teacherName = session.user?.name || "Bapak/Ibu Guru";
  const schoolName = school?.name || "Klassa School";

  return (
    <div className="h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6.5rem)] w-full">
      <AsistenClient
        initialConversations={convsRes.data || []}
        initialMemory={memoryRes.data}
        activeSchoolName={schoolName}
        teacherName={teacherName}
      />
    </div>
  );
}
