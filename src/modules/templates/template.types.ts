import { AiContentType, DocumentTemplateFormat, EntityStatus } from "@prisma/client";

// ============================================================================
// PHASE B SIZE & RESOURCE LIMITS
// ============================================================================
export const MAX_TEMPLATE_FILE_BYTES = 2_097_152; // 2 MB
export const MAX_MULTIPART_REQUEST_BYTES = 3_145_728; // 3 MB
export const MAX_GENERATED_DOCX_BYTES = 4_194_304; // 4 MB

export const MAX_ZIP_ENTRIES = 100;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 5_242_880; // 5 MB
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 10_485_760; // 10 MB

// ============================================================================
// PLACEHOLDER MANIFEST & REGISTRY
// ============================================================================
export interface PlaceholderManifest {
  version: number;
  detectedPlaceholders: string[];
  recognized: string[];
  unsupported: string[];
  contentBearing: string[];
  hasHeaders: boolean;
  hasFooters: boolean;
  hasTables: boolean;
}

export interface DocumentTemplateItem {
  id: string;
  name: string;
  contentType: AiContentType;
  format: DocumentTemplateFormat;
  originalFileName: string;
  fileSize: number;
  checksumSha256: string;
  placeholderManifest: PlaceholderManifest;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface SecurityPreflightResult {
  valid: boolean;
  error?: string;
  hasHeaders?: boolean;
  hasFooters?: boolean;
  hasTables?: boolean;
  xmlContents?: {
    documentXml: string;
    headerXmls: string[];
    footerXmls: string[];
  };
}

export interface TemplateValidationResult {
  valid: boolean;
  error?: string;
  unsupportedTags?: string[];
  manifest?: PlaceholderManifest;
  checksumSha256?: string;
}

export type ExportSourceMode = "SAVED_DRAFT" | "TRANSIENT";

export interface ExportWithTemplateRequest {
  templateId: string;
  sourceMode: ExportSourceMode;
  draftId?: string;
  // Transient fields
  contentType?: AiContentType;
  title?: string;
  content?: string;
  teachingContextId?: string;
}

export interface CanonicalPlaceholderDefinition {
  tag: string;
  description: string;
  supportedContentTypes: AiContentType[];
  isContentBearing: boolean;
  isValueRequiredAtExport: boolean;
  headingAliases?: string[];
}
