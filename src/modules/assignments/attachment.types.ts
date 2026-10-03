import { isPreviewable, type FileMetaInput } from "@/modules/storage/file-validation";

/** Metadata lampiran guru yang diklaim — sudah terunggah via presign. */
export interface AssignmentAttachmentInput extends FileMetaInput {
  storageKey: string;
}

/** Bentuk tampilan lampiran untuk guru & portal siswa. */
export interface AssignmentAttachmentView {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isPreviewable: boolean;
}

/** Mapper publik untuk page server-component & actions yang memetakan row Prisma → view. */
export function toAssignmentAttachmentView(row: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): AssignmentAttachmentView {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isPreviewable: isPreviewable(row.mimeType),
  };
}
