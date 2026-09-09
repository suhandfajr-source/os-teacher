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
  private primaryModel: string;
  private candidateModels: string[];
  private ai: GoogleGenAI;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "Konfigurasi Gemini API Key belum diatur di server (GEMINI_API_KEY)."
      );
    }
    this.apiKey = key;
    this.primaryModel = model || process.env.GEMINI_MODEL || "gemini-3.6-flash";

    // Deduplicated fallback list with verified active Gemini 3.x models
    this.candidateModels = Array.from(
      new Set([
        this.primaryModel,
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
      ])
    );

    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generate(request: AiProviderGenerateRequest): Promise<AiProviderResult> {
    const prompt = constructGenerationPrompt(request);
    const systemInstruction =
      "Anda adalah asisten AI guru profesional untuk Teacher OS di Indonesia. " +
      "Tugas Anda adalah membuat draf materi/rencana/instruksi/rubrik pembelajaran yang praktis, aplikatif, dan terstruktur. " +
      "Gunakan Bahasa Indonesia yang baik dan ramah guru. " +
      "Draf Anda harus memiliki judul yang jelas di baris pertama (contoh: # Judul) dan isi terstruktur dengan format Markdown. " +
      "WAJIB: Tuntaskan seluruh instruksi dan butir soal/konten dari awal hingga akhir (termasuk kisi-kisi, seluruh nomor soal, kunci jawaban, dan rubrik) tanpa terpotong.";

    return this.callGeminiWithFallback(prompt, systemInstruction);
  }

  async refine(request: AiProviderRefineRequest): Promise<AiProviderResult> {
    const prompt = constructRefinementPrompt(request);
    const systemInstruction =
      "Anda adalah asisten AI guru profesional untuk Teacher OS. " +
      "Tugas Anda adalah memperbarui draf pembelajaran yang sudah ada berdasarkan instruksi penyesuaian dari guru. " +
      "Pertahankan format terstruktur dalam Markdown dengan judul di baris pertama. " +
      "WAJIB: Tuntaskan seluruh isi draf hasil penyesuaian secara lengkap.";

    return this.callGeminiWithFallback(prompt, systemInstruction);
  }

  private async callGeminiWithFallback(
    prompt: string,
    systemInstruction: string,
    timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 120000
  ): Promise<AiProviderResult> {
    let lastError: unknown;

    for (let mIdx = 0; mIdx < this.candidateModels.length; mIdx++) {
      const currentModel = this.candidateModels[mIdx];
      const maxRetriesForModel = 1;

      for (let attempt = 0; attempt <= maxRetriesForModel; attempt++) {
        if (attempt > 0) {
          const delay = 2000 * attempt;
          console.log(
            `[Gemini Provider] Retrying model '${currentModel}' (attempt ${attempt}/${maxRetriesForModel}) after ${delay}ms...`
          );
          await new Promise((res) => setTimeout(res, delay));
        }

        let timeoutHandle: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  "Permintaan ke Google Gemini melebihi batas waktu (timeout). Silakan coba lagi."
                )
              ),
            timeoutMs
          );
        });

        const startTime = Date.now();

        try {
          console.log(
            `[Gemini Provider] Calling Gemini API (model: ${currentModel}, attempt: ${attempt + 1}/${maxRetriesForModel + 1})...`
          );
          const generatePromise = this.ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.7,
              maxOutputTokens: 16384,
            },
          });

          const response = await Promise.race([generatePromise, timeoutPromise]);
          const elapsed = Date.now() - startTime;
          console.log(
            `[Gemini Provider] Response received from model '${currentModel}' in ${elapsed}ms`
          );

          const rawText = response.text || "";

          if (!rawText.trim()) {
            throw new Error("Penyedia AI memberikan respons kosong.");
          }

          const validated = validateAiOutput(rawText);

          return {
            title: validated.title,
            content: validated.content,
            modelUsed: currentModel,
          };
        } catch (error: unknown) {
          lastError = error;
          const elapsed = Date.now() - startTime;
          console.error(
            `[Gemini Provider] Error on model '${currentModel}' after ${elapsed}ms:`,
            error instanceof Error ? error.message : error
          );

          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            const isAuthError =
              msg.includes("api_key") ||
              msg.includes("unauthenticated") ||
              msg.includes("403") ||
              msg.includes("invalid api key");

            if (isAuthError) {
              throw new Error(
                "Kunci API Google Gemini tidak valid atau tidak diizinkan. Periksa konfigurasi server."
              );
            }

            const isNotFound =
              msg.includes("404") ||
              msg.includes("not_found") ||
              msg.includes("is not found for api version") ||
              msg.includes("no longer available");

            if (isNotFound) {
              console.warn(
                `[Gemini Provider] Model '${currentModel}' is not supported or deprecated (404). Falling back to next candidate model.`
              );
              break; // Skip further retries of this model and try next model
            }

            const isTransient =
              msg.includes("503") ||
              msg.includes("high demand") ||
              msg.includes("unavailable") ||
              msg.includes("overloaded") ||
              msg.includes("429") ||
              msg.includes("quota") ||
              msg.includes("rate limit") ||
              msg.includes("resource_exhausted") ||
              msg.includes("econnreset") ||
              msg.includes("etimedout") ||
              msg.includes("timeout");

            if (isTransient) {
              if (attempt < maxRetriesForModel) {
                continue; // Retry current model
              } else if (mIdx < this.candidateModels.length - 1) {
                console.warn(
                  `[Gemini Provider] Model '${currentModel}' exhausted retries with transient error. Falling back to next candidate model '${this.candidateModels[mIdx + 1]}'!`
                );
                break; // Break inner loop to try next model
              }
            }
          }
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      }
    }

    if (lastError instanceof Error) {
      const msg = lastError.message.toLowerCase();
      if (
        msg.includes("503") ||
        msg.includes("high demand") ||
        msg.includes("unavailable") ||
        msg.includes("overloaded")
      ) {
        throw new Error(
          "Layanan AI Google Gemini sedang mengalami lonjakan trafik tinggi (High Demand / 503). Silakan coba beberapa detik lagi."
        );
      }
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
      if (msg.includes("timeout") || msg.includes("melebihi batas waktu")) {
        throw lastError;
      }
      throw new Error(`Gagal memproses permintaan AI: ${lastError.message}`);
    }

    throw new Error("Terjadi kesalahan tidak terduga saat menghubungi penyedia AI.");
  }
}
