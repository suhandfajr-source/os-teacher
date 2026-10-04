# BMAD Code Review: Blind Hunter (Adversarial Review)

Jalankan prompt ini di context window / sesi LLM terpisah (tanpa membaca spec perencanaan, hanya menginspeksi diff kode secara objektif dan kritis).

---

## Peran Anda
Anda adalah **Senior Principal Security & Systems Architect** yang bertindak sebagai **Blind Adversarial Reviewer**.
Anda **TIDAK** diberikan dokumen perencanaan atau klaim fitur. Tugas Anda adalah menginspeksi **unified git diff** di bawah ini secara teliti dan mencari kelemahan kode nyata:
1. **Celah Keamanan & Autentikasi/Otorisasi:** Apakah ada bypass kepemilikan tenant/guru, kebocoran data antar rombel/guru, atau input injection?
2. **Kerapuhan Runtime & Error Handling:** Apakah ada unhandled rejection, missing null/undefined check, atau asumsi env var yang crash tanpa pesan jelas?
3. **Data Integrity & Invariants:** Apakah ada celah di mana data tidak konsisten tersimpan di PostgreSQL?

---

## Target Git Diff (Story 1: Klassa Agent Core Runtime & Schema)

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -387,6 +387,8 @@ model TeacherProfile {
   importSessions                ImportSession[]
   assignmentSubmissions         AssignmentSubmission[]
   revocationRequests            TeacherRevocationRequest[] @relation("RevocationRequester")
+  agentConversations            AgentConversation[]
+  agentMemory                   TeacherAgentMemory?

   @@map("teacher_profile")
 }
@@ -1000,3 +1002,56 @@ model QuizStudentAccess {
   @@map("quiz_student_access")
 }
+
+// ==========================================
+// STAGE 12: KLASSA AGENT MODELS
+// ==========================================
+
+model AgentConversation {
+  id               String         @id @default(cuid())
+  teacherProfileId String
+  teacherProfile   TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
+  classContextId   String?
+  title            String         @default("Percakapan Baru")
+  modelUsed        String         @default("gemini-1.5-flash")
+  createdAt        DateTime       @default(now())
+  updatedAt        DateTime       @updatedAt
+  messages         AgentMessage[]
+
+  @@index([teacherProfileId])
+  @@index([classContextId])
+  @@map("agent_conversation")
+}
+
+model AgentMessage {
+  id             String            @id @default(cuid())
+  conversationId String
+  conversation   AgentConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
+  role           String // "user" | "assistant" | "system" | "tool"
+  content        String            @db.Text
+  toolCalls      Json?
+  toolResults    Json?
+  pendingAction  Json?
+  actionStatus   String            @default("NONE") // "NONE" | "PENDING" | "CONFIRMED" | "REJECTED"
+  createdAt      DateTime          @default(now())
+
+  @@index([conversationId])
+  @@map("agent_message")
+}
+
+model TeacherAgentMemory {
+  id                String         @id @default(cuid())
+  teacherProfileId  String         @unique
+  teacherProfile    TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
+  communicationTone String         @default("RAMAH_SOPAN") // "LUGAS_RINGKAS" | "RAMAH_SOPAN" | "FORMAL"
+  preferredModel    String         @default("gemini-1.5-flash")
+  pedagogyDefaults  Json?
+  customContext     String?        @db.Text
+  createdAt         DateTime       @default(now())
+  updatedAt         DateTime       @updatedAt
+
+  @@map("teacher_agent_memory")
+}
+
+model AgentInsightAggregate {
+  id           String   @id @default(cuid())
+  schoolId     String?
+  period       String // e.g. "2026-W40", "2026-10"
+  category     String // "CURRICULUM_BOTTLENECK" | "BURNOUT_RISK" | "STUDENT_STRUGGLE" | "OPERATIONAL_HOURS"
+  metricKey    String
+  metricValue  Float
+  sampleCount  Int      @default(1)
+  tags         String[]
+  metadata     Json?
+  anonymizedAt DateTime @default(now())
+
+  @@index([schoolId])
+  @@index([category, period])
+  @@map("agent_insight_aggregate")
+}

diff --git a/src/modules/agent/agent.config.ts b/src/modules/agent/agent.config.ts
new file mode 100644
--- /dev/null
+++ b/src/modules/agent/agent.config.ts
@@ -0,0 +1,48 @@
+import { ModelProviderOption } from "./agent.types";
+
+export const DEFAULT_AGENT_MODEL = "gemini-1.5-flash";
+
+export const AVAILABLE_AGENT_MODELS: ModelProviderOption[] = [
+  {
+    id: "gemini-1.5-flash",
+    name: "Gemini 1.5 Flash (Default)",
+    provider: "google",
+    description: "Cepat, hemat kuota token, dan ideal untuk administrasi & query data kelas harian.",
+    isDefault: true,
+  },
+  {
+    id: "gemini-1.5-pro",
+    name: "Gemini 1.5 Pro (Penalaran)",
+    provider: "google",
+    description: "Penalaran pedagogis mendalam untuk analisis masalah belajar dan perancangan materi.",
+  },
+  {
+    id: "hermes-local",
+    name: "Hermes Open-Weights (vLLM / Ollama)",
+    provider: "openai-compatible",
+    description: "Model mandiri privat untuk pemrosesan lokal (on-premise) tanpa keluar ke cloud.",
+  },
+];
+
+export const BASE_SYSTEM_PROMPT = `
+Kamu adalah KLASSA AGENT, asisten cerdas berdedikasi untuk guru sekolah di Indonesia dalam ekosistem Klassa OS.
+Tugas utamamu adalah menjadi kepanjangan tangan guru dalam mengelola kelas, menganalisis data siswa, membantu tugas administratif, serta menjadi rekan diskusi pedagogis yang solutif.
+
+PRINSIP & ATURAN KERJA:
+1. RUANG LINGKUP & KEBIJAKAN TOPIK:
+   - Prioritas Utama: Urusan ruang kelas di Klassa (profil murid, absensi, nilai asesmen, kuis, materi ajar).
+   - Topik Pendidikan Umum (DILAYANI 100%): Kurikulum Merdeka, Platform Merdeka Mengajar (PMM), sertifikasi guru, metode pembelajaran aktif, rapat komite, administrasi sekolah. Jawab dengan komprehensif, santun, dan solutif.
+   - Topik Non-Pendidikan / Di Luar Konteks (TOLAK SECARA HALUS): Jika pengguna menanyakan hal yang sama sekali di luar dunia pendidikan (resep masakan, olahraga/sepak bola, politik praktis, gosip, otomotif, dsb.), tolak dengan santun dan ramah (polite deflection), lalu alihkan kembali fokus guru ke persiapan ajar atau kebutuhan kelas.
+
+2. INTEGRITAS DATA & PERHITUNGAN:
+   - DILARANG menghitung rata-rata nilai, persentase kehadiran, ranking, atau angka statistik kelas sendiri. Gunakan hasil dari alat (tools) yang disediakan sistem. Angka dari sistem adalah 100% akurat.
+   - Jangan pernah mengasumsikan data siswa yang tidak ada di konteks atau hasil pemanggilan tools.
+
+3. HUMAN-IN-THE-LOOP (AKSI SENSITIF):
+   - Jika guru meminta melakukan tindakan yang memutasi data permanen (misal: simpan presensi resmi, buat tugas resmi, kirim pengumuman), ajukan usulan aksi secara terstruktur agar sistem dapat menampilkan kartu konfirmasi ke guru.
+   - Jangan pernah mengklaim bahwa data permanen sudah disimpan sebelum guru menyetujuinya.
+
+4. BATASAN PEDAGOGIS & PSIKOLOGIS:
+   - Kamu adalah konsultan pendidikan, BUKAN praktisi medis atau psikiater anak.
+   - Tolak keras memberikan diagnosis medis/klinis spesifik (seperti ADHD, autisme, depresi klinis, bipolar).
+   - Untuk siswa dengan kendala perilaku berat, selalu sarankan observasi lanjutan, pelibatan orang tua, dan rujukan ke Guru Bimbingan Konseling (BK) atau psikolog profesional.
+
+5. NADA & GAYA BAHASA:
+   - Gunakan Bahasa Indonesia yang baik, santun, suportif, dan profesional layaknya rekan sejawat sesama pendidik.
+`;

diff --git a/src/modules/agent/agent.router.ts b/src/modules/agent/agent.router.ts
new file mode 100644
--- /dev/null
+++ b/src/modules/agent/agent.router.ts
@@ -0,0 +1,48 @@
+import { createGoogleGenerativeAI } from "@ai-sdk/google";
+import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
+import { LanguageModel } from "ai";
+import { DEFAULT_AGENT_MODEL } from "./agent.config";
+
+export function getAgentLanguageModel(modelId?: string): LanguageModel {
+  const targetModel = modelId || DEFAULT_AGENT_MODEL;
+
+  if (targetModel.startsWith("gemini")) {
+    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
+    if (!apiKey) {
+      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
+    }
+    const google = createGoogleGenerativeAI({ apiKey });
+    return google(targetModel);
+  }
+
+  if (
+    targetModel.includes("hermes") ||
+    targetModel.includes("ollama") ||
+    targetModel.includes("vllm") ||
+    targetModel.includes("local")
+  ) {
+    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
+    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
+    const openaiCompatible = createOpenAICompatible({
+      name: "local-hermes",
+      baseURL,
+      apiKey,
+    });
+    return openaiCompatible(targetModel);
+  }
+
+  const fallbackKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
+  if (!fallbackKey) {
+    throw new Error("API Key untuk model agen belum dikonfigurasi.");
+  }
+  const google = createGoogleGenerativeAI({ apiKey: fallbackKey });
+  return google(DEFAULT_AGENT_MODEL);
+}

diff --git a/src/modules/agent/agent.actions.ts b/src/modules/agent/agent.actions.ts
new file mode 100644
--- /dev/null
+++ b/src/modules/agent/agent.actions.ts
@@ -0,0 +1,220 @@
+"use server";
+
+import { prisma } from "@/lib/auth";
+import { verifyActiveSchoolMembership } from "@/lib/authorization";
+import { revalidatePath } from "next/cache";
+import { AgentConversationDTO, AgentMessageDTO, TeacherMemoryDTO } from "./agent.types";
+import { DEFAULT_AGENT_MODEL } from "./agent.config";
+
+export async function getOrCreateConversationAction(
+  classContextId?: string | null
+): Promise<{ success: boolean; data?: AgentConversationDTO; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    let conversation = await prisma.agentConversation.findFirst({
+      where: {
+        teacherProfileId: profile.id,
+        classContextId: classContextId || null,
+      },
+      orderBy: { updatedAt: "desc" },
+    });
+
+    if (!conversation) {
+      conversation = await prisma.agentConversation.create({
+        data: {
+          teacherProfileId: profile.id,
+          classContextId: classContextId || null,
+          title: "Percakapan Baru",
+          modelUsed: DEFAULT_AGENT_MODEL,
+        },
+      });
+    }
+
+    return {
+      success: true,
+      data: {
+        id: conversation.id,
+        title: conversation.title,
+        modelUsed: conversation.modelUsed,
+        classContextId: conversation.classContextId,
+        createdAt: conversation.createdAt,
+        updatedAt: conversation.updatedAt,
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal memuat percakapan.",
+    };
+  }
+}
+
+export async function listConversationsAction(): Promise<{
+  success: boolean;
+  data?: AgentConversationDTO[];
+  error?: string;
+}> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const conversations = await prisma.agentConversation.findMany({
+      where: { teacherProfileId: profile.id },
+      orderBy: { updatedAt: "desc" },
+      take: 20,
+      include: {
+        _count: {
+          select: { messages: true },
+        },
+      },
+    });
+
+    return {
+      success: true,
+      data: conversations.map((c) => ({
+        id: c.id,
+        title: c.title,
+        modelUsed: c.modelUsed,
+        classContextId: c.classContextId,
+        createdAt: c.createdAt,
+        updatedAt: c.updatedAt,
+        messagesCount: c._count.messages,
+      })),
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal mengambil daftar percakapan.",
+    };
+  }
+}
+
+export async function getConversationMessagesAction(
+  conversationId: string
+): Promise<{ success: boolean; data?: AgentMessageDTO[]; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const conversation = await prisma.agentConversation.findUnique({
+      where: { id: conversationId },
+    });
+
+    if (!conversation || conversation.teacherProfileId !== profile.id) {
+      return { success: false, error: "Percakapan tidak ditemukan atau akses ditolak." };
+    }
+
+    const messages = await prisma.agentMessage.findMany({
+      where: { conversationId },
+      orderBy: { createdAt: "asc" },
+      take: 100,
+    });
+
+    return {
+      success: true,
+      data: messages.map((m) => ({
+        id: m.id,
+        conversationId: m.conversationId,
+        role: m.role as AgentMessageDTO["role"],
+        content: m.content,
+        toolCalls: m.toolCalls,
+        toolResults: m.toolResults,
+        pendingAction: m.pendingAction as AgentMessageDTO["pendingAction"],
+        actionStatus: m.actionStatus as AgentMessageDTO["actionStatus"],
+        createdAt: m.createdAt,
+      })),
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal memuat pesan percakapan.",
+    };
+  }
+}
+
+export async function saveUserMessageAction(
+  conversationId: string,
+  content: string
+): Promise<{ success: boolean; data?: AgentMessageDTO; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const conversation = await prisma.agentConversation.findUnique({
+      where: { id: conversationId },
+    });
+
+    if (!conversation || conversation.teacherProfileId !== profile.id) {
+      return { success: false, error: "Akses percakapan ditolak." };
+    }
+
+    const message = await prisma.agentMessage.create({
+      data: {
+        conversationId,
+        role: "user",
+        content,
+      },
+    });
+
+    const msgCount = await prisma.agentMessage.count({ where: { conversationId } });
+    if (msgCount <= 2) {
+      const generatedTitle = content.trim().slice(0, 40) + (content.length > 40 ? "..." : "");
+      await prisma.agentConversation.update({
+        where: { id: conversationId },
+        data: { title: generatedTitle, updatedAt: new Date() },
+      });
+    } else {
+      await prisma.agentConversation.update({
+        where: { id: conversationId },
+        data: { updatedAt: new Date() },
+      });
+    }
+
+    return {
+      success: true,
+      data: {
+        id: message.id,
+        conversationId: message.conversationId,
+        role: message.role as AgentMessageDTO["role"],
+        content: message.content,
+        createdAt: message.createdAt,
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal menyimpan pesan pengguna.",
+    };
+  }
+}
+
+export async function saveAssistantMessageAction(
+  conversationId: string,
+  content: string,
+  toolCalls?: unknown,
+  toolResults?: unknown,
+  pendingAction?: unknown
+): Promise<{ success: boolean; data?: AgentMessageDTO; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const conversation = await prisma.agentConversation.findUnique({
+      where: { id: conversationId },
+    });
+
+    if (!conversation || conversation.teacherProfileId !== profile.id) {
+      return { success: false, error: "Akses percakapan ditolak." };
+    }
+
+    const message = await prisma.agentMessage.create({
+      data: {
+        conversationId,
+        role: "assistant",
+        content,
+        toolCalls: toolCalls ? (toolCalls as object) : undefined,
+        toolResults: toolResults ? (toolResults as object) : undefined,
+        pendingAction: pendingAction ? (pendingAction as object) : undefined,
+        actionStatus: pendingAction ? "PENDING" : "NONE",
+      },
+    });
+
+    await prisma.agentConversation.update({
+      where: { id: conversationId },
+      data: { updatedAt: new Date() },
+    });
+
+    return {
+      success: true,
+      data: {
+        id: message.id,
+        conversationId: message.conversationId,
+        role: message.role as AgentMessageDTO["role"],
+        content: message.content,
+        toolCalls: message.toolCalls,
+        toolResults: message.toolResults,
+        pendingAction: message.pendingAction as AgentMessageDTO["pendingAction"],
+        actionStatus: message.actionStatus as AgentMessageDTO["actionStatus"],
+        createdAt: message.createdAt,
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal menyimpan respon agen.",
+    };
+  }
+}
+
+export async function deleteConversationAction(
+  conversationId: string
+): Promise<{ success: boolean; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const conversation = await prisma.agentConversation.findUnique({
+      where: { id: conversationId },
+    });
+
+    if (!conversation || conversation.teacherProfileId !== profile.id) {
+      return { success: false, error: "Percakapan tidak ditemukan atau akses ditolak." };
+    }
+
+    await prisma.agentConversation.delete({ where: { id: conversationId } });
+
+    revalidatePath("/asisten");
+    return { success: true };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal menghapus percakapan.",
+    };
+  }
+}
+
+export async function getTeacherMemoryAction(): Promise<{
+  success: boolean;
+  data?: TeacherMemoryDTO | null;
+  error?: string;
+}> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const memory = await prisma.teacherAgentMemory.findUnique({
+      where: { teacherProfileId: profile.id },
+    });
+
+    if (!memory) {
+      return { success: true, data: null };
+    }
+
+    return {
+      success: true,
+      data: {
+        id: memory.id,
+        teacherProfileId: memory.teacherProfileId,
+        communicationTone: memory.communicationTone as TeacherMemoryDTO["communicationTone"],
+        preferredModel: memory.preferredModel,
+        pedagogyDefaults: memory.pedagogyDefaults as Record<string, unknown> | null,
+        customContext: memory.customContext,
+        updatedAt: memory.updatedAt,
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal memuat memori guru.",
+    };
+  }
+}
+
+export async function updateTeacherMemoryAction(input: {
+  communicationTone?: "LUGAS_RINGKAS" | "RAMAH_SOPAN" | "FORMAL";
+  preferredModel?: string;
+  customContext?: string;
+}): Promise<{ success: boolean; data?: TeacherMemoryDTO; error?: string }> {
+  try {
+    const { profile } = await verifyActiveSchoolMembership();
+
+    const memory = await prisma.teacherAgentMemory.upsert({
+      where: { teacherProfileId: profile.id },
+      create: {
+        teacherProfileId: profile.id,
+        communicationTone: input.communicationTone || "RAMAH_SOPAN",
+        preferredModel: input.preferredModel || DEFAULT_AGENT_MODEL,
+        customContext: input.customContext || null,
+      },
+      update: {
+        ...(input.communicationTone ? { communicationTone: input.communicationTone } : {}),
+        ...(input.preferredModel ? { preferredModel: input.preferredModel } : {}),
+        ...(input.customContext !== undefined ? { customContext: input.customContext } : {}),
+      },
+    });
+
+    return {
+      success: true,
+      data: {
+        id: memory.id,
+        teacherProfileId: memory.teacherProfileId,
+        communicationTone: memory.communicationTone as TeacherMemoryDTO["communicationTone"],
+        preferredModel: memory.preferredModel,
+        pedagogyDefaults: memory.pedagogyDefaults as Record<string, unknown> | null,
+        customContext: memory.customContext,
+        updatedAt: memory.updatedAt,
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Gagal memperbarui memori guru.",
+    };
+  }
+}
+```

---

## Format Laporan yang Diharapkan
Keluarkan temuan Anda dalam format terstruktur:
1. **Critical Vulnerabilities (High Severity)**: Celah yang bisa dieksploitasi untuk mencuri data atau bypass otorisasi.
2. **Logic Bugs & Resource Leaks (Medium Severity)**: Masalah konsistensi query, concurrency, atau error handling.
3. **Nitpicks / Polish (Low Severity)**: Kebersihan kode atau tipe data.
4. **Verdict**: `APPROVE` atau `CHANGES_REQUESTED`.
