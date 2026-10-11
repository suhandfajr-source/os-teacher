import { Metadata } from "next";
import { CbtLobbyClient } from "@/modules/student-portal/components/CbtLobbyClient";

export const metadata: Metadata = {
  title: "Sesi Ujian CBT | Portal Siswa Klassa",
};

export default function StudentCbtPage() {
  return <CbtLobbyClient />;
}
