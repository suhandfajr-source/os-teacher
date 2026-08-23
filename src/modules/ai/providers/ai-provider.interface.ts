import {
  AiProviderGenerateRequest,
  AiProviderRefineRequest,
  AiProviderResult,
} from "../ai.types";

/**
 * Provider-agnostic interface for AI Content Studio generation and refinement.
 * Decouples product logic from specific AI provider SDKs (e.g. Gemini, local models).
 */
export interface AiContentProvider {
  /**
   * Name of the provider implementation (e.g. 'gemini', 'mock')
   */
  readonly name: string;

  /**
   * Generates a new teaching content draft based on teacher inputs and safe context.
   */
  generate(request: AiProviderGenerateRequest): Promise<AiProviderResult>;

  /**
   * Refines an existing transient content draft based on teacher's follow-up instruction.
   */
  refine(request: AiProviderRefineRequest): Promise<AiProviderResult>;
}
