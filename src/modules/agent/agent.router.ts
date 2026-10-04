import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModel } from "ai";
import { DEFAULT_AGENT_MODEL } from "./agent.config";

/**
 * Universal Multi-Model Router
 * Mengembalikan instance LanguageModel Vercel AI SDK yang sesuai dengan model yang diminta.
 */
export function getAgentLanguageModel(modelId?: string): LanguageModel {
  let targetModel = modelId || DEFAULT_AGENT_MODEL;

  // Remap deprecated / quota-exhausted Google Gemini models automatically
  if (targetModel === "gemini-1.5-flash" || targetModel === "gemini-3.6-flash") {
    targetModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  } else if (targetModel === "gemini-1.5-pro") {
    targetModel = "gemini-3.7-flash";
  }

  // 1. Google Gemini Family
  if (targetModel.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    return google(targetModel);
  }

  // 2. OpenAI-Compatible Endpoint (Hermes, vLLM, Ollama, Groq, DeepSeek, Local)
  if (
    targetModel.includes("hermes") ||
    targetModel.includes("ollama") ||
    targetModel.includes("vllm") ||
    targetModel.includes("local")
  ) {
    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
    const openaiCompatible = createOpenAICompatible({
      name: "local-hermes",
      baseURL,
      apiKey,
    });
    return openaiCompatible(targetModel);
  }

  // Fallback default to Google Gemini Flash
  const fallbackKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!fallbackKey) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  const google = createGoogleGenerativeAI({ apiKey: fallbackKey });
  return google(DEFAULT_AGENT_MODEL);
}
