import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
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

export class OpenAiCompatibleAiContentProvider implements AiContentProvider {
  readonly name = "openai-compatible";
  private apiKey: string;
  private model: string;
  private baseURL: string;

  private options: { fetch?: typeof fetch; temperature?: number };

  constructor(
    apiKey: string,
    model: string,
    baseURL?: string,
    options: { fetch?: typeof fetch; temperature?: number } = {}
  ) {
    this.apiKey = apiKey;
    this.model = model || "glm-4-plus";
    this.baseURL = baseURL || process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";
    this.options = options;
  }

  private getClient() {
    return createOpenAICompatible({
      name: "custom-openai-compatible",
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      fetch: this.options.fetch,
    });
  }

  async generate(request: AiProviderGenerateRequest): Promise<AiProviderResult> {
    const prompt = constructGenerationPrompt(request);
    const system =
      "Anda adalah asisten AI guru profesional untuk KLASSA (Naikkan Kelasmu!) di Indonesia. " +
      "Tugas Anda adalah membuat draf materi/rencana/instruksi/rubrik pembelajaran yang praktis, aplikatif, dan terstruktur. " +
      "Gunakan Bahasa Indonesia yang baik dan ramah guru. Format draf dalam Markdown rapi dengan judul di baris pertama (# Judul).";

    const client = this.getClient();
    const result = await generateText({
      model: client(this.model),
      temperature: this.options.temperature,
      system,
      prompt,
    });

    const validated = validateAiOutput(result.text);
    return {
      title: validated.title,
      content: validated.content,
      modelUsed: this.model,
    };
  }

  async refine(request: AiProviderRefineRequest): Promise<AiProviderResult> {
    const prompt = constructRefinementPrompt(request);
    const system =
      "Anda adalah asisten AI guru profesional untuk KLASSA (Naikkan Kelasmu!) di Indonesia. " +
      "Lakukan revisi draf pembelajaran berdasarkan instruksi guru. Pertahankan struktur utama dan format Markdown dengan judul di baris pertama.";

    const client = this.getClient();
    const result = await generateText({
      model: client(this.model),
      temperature: this.options.temperature,
      system,
      prompt,
    });

    const validated = validateAiOutput(result.text);
    return {
      title: validated.title,
      content: validated.content,
      modelUsed: this.model,
    };
  }

  async generateStructured?(
    prompt: string,
    systemInstruction?: string,
    _timeoutMs?: number
  ): Promise<string> {
    const client = this.getClient();
    const result = await generateText({
      model: client(this.model),
      system: systemInstruction,
      prompt,
    });
    return result.text;
  }
}
