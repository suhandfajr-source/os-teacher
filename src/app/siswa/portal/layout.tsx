import React from "react";
import { redirect } from "next/navigation";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { prisma } from "@/lib/auth";
import { StudentHeader } from "@/modules/student-portal/components/StudentHeader";
import { StudentBottomNav } from "@/modules/student-portal/components/StudentBottomNav";
import { StudentInactivityGuard } from "@/modules/student-portal/components/StudentInactivityGuard";

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

      {/* Main Content Area: Responsive Mobile to PC Desktop */}
      <main className="flex-1 w-full max-w-md md:max-w-6xl mx-auto p-4 pb-24 md:p-6 md:pb-12 transition-all">
        {children}
      </main>

      {/* Navigasi Bawah Khusus Mobile (< md) */}
      <StudentBottomNav />

      {/* Footer Khusus PC / Desktop (>= md) */}
      <footer className="hidden md:block w-full border-t border-slate-200/80 bg-white/70 py-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="font-medium text-slate-600">
            KLASSA Student Workspace · <span className="text-slate-400">{schoolName}</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Mode Komputer Lab & Belajar Mandiri
          </p>
        </div>
      </footer>
    </div>
  );
}
