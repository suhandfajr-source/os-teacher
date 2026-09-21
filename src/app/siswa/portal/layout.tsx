import React from "react";
import { redirect } from "next/navigation";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { prisma } from "@/lib/auth";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentBottomNav } from "@/components/student/StudentBottomNav";
import { StudentInactivityGuard } from "@/components/student/StudentInactivityGuard";

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyStudentSession();

  if (!session) {
    redirect("/portal-siswa");
  }

  // Ambil data profil, sekolah, dan rombel aktif siswa
  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
    select: {
      fullName: true,
      school: { select: { name: true } },
      classMemberships: {
        include: {
          class: { select: { name: true, gradeLevel: true } },
          academicPeriod: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!student) {
    redirect("/portal-siswa");
  }

  const primaryClass = student.classMemberships[0];
  const className = primaryClass 
    ? `${primaryClass.class.name} (${primaryClass.class.gradeLevel || "Kelas"})`
    : "Rombel Belum Terdaftar";
  const schoolName = student.school.name;

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 flex flex-col selection:bg-teal-500 selection:text-white">
      <StudentInactivityGuard />
      
      {/* Header Siswa Mobile-First */}
      <StudentHeader
        studentName={student.fullName}
        className={className}
        schoolName={schoolName}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24">
        {children}
      </main>

      {/* Navigasi Bawah 5 Item */}
      <StudentBottomNav />
    </div>
  );
}
