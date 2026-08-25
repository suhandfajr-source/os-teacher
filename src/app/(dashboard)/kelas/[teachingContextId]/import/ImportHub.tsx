"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, Calendar, UserCheck, Award } from "lucide-react";
import ImportSiswaFlow from "./ImportSiswaFlow";
import HistoricalSessionImportFlow from "./HistoricalSessionImportFlow";
import HistoricalAttendanceImportFlow from "./HistoricalAttendanceImportFlow";
import HistoricalAssessmentImportFlow from "./HistoricalAssessmentImportFlow";

type TabCategory = "ROSTER" | "SESSIONS" | "ATTENDANCE" | "ASSESSMENTS";

export default function ImportHub({ teachingContextId }: { teachingContextId: string }) {
  const [activeTab, setActiveTab] = useState<TabCategory>("ROSTER");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200">
        <Button
          variant={activeTab === "ROSTER" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ROSTER")}
          className={`flex items-center gap-2 rounded-lg text-sm font-medium ${
            activeTab === "ROSTER" ? "bg-white text-indigo-700 shadow-sm hover:bg-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4" />
          Daftar Siswa (Roster)
        </Button>
        <Button
          variant={activeTab === "SESSIONS" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("SESSIONS")}
          className={`flex items-center gap-2 rounded-lg text-sm font-medium ${
            activeTab === "SESSIONS" ? "bg-white text-indigo-700 shadow-sm hover:bg-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Pertemuan Lampau
        </Button>
        <Button
          variant={activeTab === "ATTENDANCE" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ATTENDANCE")}
          className={`flex items-center gap-2 rounded-lg text-sm font-medium ${
            activeTab === "ATTENDANCE" ? "bg-white text-indigo-700 shadow-sm hover:bg-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Presensi Lampau
        </Button>
        <Button
          variant={activeTab === "ASSESSMENTS" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ASSESSMENTS")}
          className={`flex items-center gap-2 rounded-lg text-sm font-medium ${
            activeTab === "ASSESSMENTS" ? "bg-white text-indigo-700 shadow-sm hover:bg-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Award className="h-4 w-4" />
          Nilai Penilaian Lampau
        </Button>
      </div>

      {/* Tab Panels */}
      {activeTab === "ROSTER" && <ImportSiswaFlow teachingContextId={teachingContextId} />}
      {activeTab === "SESSIONS" && (
        <HistoricalSessionImportFlow teachingContextId={teachingContextId} />
      )}
      {activeTab === "ATTENDANCE" && (
        <HistoricalAttendanceImportFlow teachingContextId={teachingContextId} />
      )}
      {activeTab === "ASSESSMENTS" && (
        <HistoricalAssessmentImportFlow teachingContextId={teachingContextId} />
      )}
    </div>
  );
}
