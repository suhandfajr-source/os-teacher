import { GoogleGenAI } from "@google/genai";
import { AiContentProvider } from "./ai-provider.interface";
import {
  AiProviderGenerateRequest,
  AiProviderRefineRequest,
  AiProviderResult,
} from "../ai.types";
import {
  constructGenerationPrompt,
  constructRefinementPrompt,
  validateAiOutput,
} from "../ai.service";

export class GeminiAiContentProvider implements AiContentProvider {
  readonly name = "gemini";
  private apiKey: string;
  private model: string;
  private ai: GoogleGenAI;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "Konfigurasi Gemini API Key belum diatur di server (GEMINI_API_KEY)."
      );
    }
    this.apiKey = key;
    this.model = model || process.env.GEMINI_MODEL || "gemini-3.6-flash";
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generate(request: AiProviderGenerateRequest): Promise<AiProviderResult> {
    const prompt = constructGenerationPrompt(request);
    const systemInstruction =
      "Anda adalah asisten AI guru profesional untuk Teacher OS di Indonesia. " +
      "Tugas Anda adalah membuat draf materi/rencana/instruksi/rubrik pembelajaran yang praktis, aplikatif, dan terstruktur. " +
      "Gunakan Bahasa Indonesia yang baik dan ramah guru. " +
      "Draf Anda harus memiliki judul yang jelas di baris pertama (contoh: # Judul) dan isi terstruktur dengan format Markdown.";

    return this.callGeminiWithTimeout(prompt, systemInstruction);
  }

  async refine(request: AiProviderRefineRequest): Promise<AiProviderResult> {
    const prompt = constructRefinementPrompt(request);
    const systemInstruction =
      "Anda adalah asisten AI guru profesional untuk Teacher OS. " +
      "Tugas Anda adalah memperbarui draf pembelajaran yang sudah ada berdasarkan instruksi penyesuaian dari guru. " +
      "Pertahankan format terstruktur dalam Markdown dengan judul di baris pertama.";

    return this.callGeminiWithTimeout(prompt, systemInstruction);
  }

  private async callGeminiWithTimeout(
    prompt: string,
    systemInstruction: string,
    timeoutMs = 30000
  ): Promise<AiProviderResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Permintaan ke Google Gemini melebihi batas waktu (timeout). Silakan coba lagi."
            )
          ),
        timeoutMs
      )
    );

    try {
      const generatePromise = this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = response.text || "";

      if (!rawText.trim()) {
        throw new Error("Penyedia AI memberikan respons kosong.");
      }

      const validated = validateAiOutput(rawText);

      return {
        title: validated.title,
        content: validated.content,
        modelUsed: this.model,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("rate limit") ||
          msg.includes("resource_exhausted")
        ) {
          throw new Error(
            "Batas kuota Gemini API tercapai (Rate Limit / Quota Exceeded). Silakan coba beberapa saat lagi."
          );
        }
        if (msg.includes("api_key") || msg.includes("unauthenticated") || msg.includes("403") || msg.includes("invalid api key")) {
          throw new Error(
            "Kunci API Google Gemini tidak valid atau tidak diizinkan. Periksa konfigurasi server."
          );
        }
        if (msg.includes("timeout") || msg.includes("melebihi batas waktu")) {
          throw error;
        }
        throw new Error(`Gagal memproses permintaan AI: ${error.message}`);
      }
      throw new Error("Terjadi kesalahan tidak terduga saat menghubungi penyedia AI.");
    }
  }
}
