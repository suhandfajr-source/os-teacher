"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TeacherProfile, AcademicPeriod, Subject, Class as PrismaClass, TeachingContext, School } from "@prisma/client";

type ProfileWithContext = TeacherProfile & {
  teachingContexts: (TeachingContext & { academicPeriod: AcademicPeriod, subject: Subject, class: PrismaClass })[];
};

type SchoolWithMaster = School & {
  academicPeriods: AcademicPeriod[];
  subjects: Subject[];
  classes: PrismaClass[];
};

// A minimal UI for Stage 01. In real app, we would have forms for each tab.
export default function SetupManager({ initialProfile, activeSchool }: { initialProfile: ProfileWithContext, activeSchool: SchoolWithMaster }) {
  const [activeTab, setActiveTab] = useState("context");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <div className="flex space-x-2">
          <Button variant={activeTab === "context" ? "default" : "ghost"} onClick={() => setActiveTab("context")}>
            Konteks Mengajar
          </Button>
          <Button variant={activeTab === "period" ? "default" : "ghost"} onClick={() => setActiveTab("period")}>
            Periode Akademik
          </Button>
          <Button variant={activeTab === "subject" ? "default" : "ghost"} onClick={() => setActiveTab("subject")}>
            Mata Pelajaran
          </Button>
          <Button variant={activeTab === "class" ? "default" : "ghost"} onClick={() => setActiveTab("class")}>
            Kelas
          </Button>
        </div>
        <a
          href="/onboarding/mid-semester"
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Mulai di Tengah Semester
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "context" && "Konteks Mengajar Aktif"}
            {activeTab === "period" && `Daftar Periode Akademik (${activeSchool.name})`}
            {activeTab === "subject" && `Daftar Mata Pelajaran (${activeSchool.name})`}
            {activeTab === "class" && `Daftar Kelas (${activeSchool.name})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === "context" && (
            <div className="space-y-4">
              {initialProfile.teachingContexts.map((ctx) => (
                <div key={ctx.id} className="p-4 border rounded-md">
                  <div className="font-semibold">{ctx.subject.name} — {ctx.class.name}</div>
                  <div className="text-sm text-muted-foreground">{ctx.academicPeriod.year} {ctx.academicPeriod.semester}</div>
                </div>
              ))}
              {initialProfile.teachingContexts.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada konteks mengajar.</p>
              )}
            </div>
          )}
          {activeTab === "period" && (
            <div className="space-y-4">
              {activeSchool.academicPeriods.map((p) => (
                <div key={p.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{p.year}</div>
                    <div className="text-sm text-muted-foreground">{p.semester}</div>
                  </div>
                  <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{p.status}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "subject" && (
            <div className="space-y-4">
              {activeSchool.subjects.map((s) => (
                <div key={s.id} className="p-4 border rounded-md">
                  <div className="font-semibold">{s.name}</div>
                  {s.shortName && <div className="text-sm text-muted-foreground">{s.shortName}</div>}
                </div>
              ))}
            </div>
          )}
          {activeTab === "class" && (
            <div className="space-y-4">
              {activeSchool.classes.map((c) => (
                <div key={c.id} className="p-4 border rounded-md">
                  <div className="font-semibold">{c.name}</div>
                  {c.gradeLevel && <div className="text-sm text-muted-foreground">Grade: {c.gradeLevel}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
