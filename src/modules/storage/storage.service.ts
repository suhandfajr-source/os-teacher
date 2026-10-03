/**
 * Story 1 — adapter storage S3-compatible tunggal (K4–K5 blueprint).
 * Cloudflare R2 sekarang, MinIO di server sendiri nanti: pindah cukup
 * ganti env, tanpa ubah kode. Byte file TIDAK pernah lewat server Next.js:
 * browser siswa mengunggah langsung via presigned POST, batas ukuran
 * dipaksa oleh policy storage (content-length-range).
 *
 * Tanpa env S3_* modul ini mati anggun: isStorageConfigured() false,
 * presign melempar StorageNotConfiguredError — submit teks/link tetap jalan.
 */
import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_FILE_BYTES, getExtension, sanitizeOriginalName } from "./file-validation";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Penyimpanan file belum dikonfigurasi (S3_* kosong).");
    this.name = "StorageNotConfiguredError";
  }
}


export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

let cachedClient: S3Client | null = null;

function requireEnv(): { bucket: string; client: S3Client } {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "auto",
      forcePathStyle: Boolean(process.env.S3_ENDPOINT), // MinIO & SeaweedFS path-style
      // Env kustom S3_* — SDK default hanya baca AWS_*, jadi wajib eksplisit
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return { bucket: process.env.S3_BUCKET as string, client: cachedClient };
}

const TMP_PREFIXES = {
  submission: "submissions/tmp",
  attachment: "attachments/tmp",
} as const;

export type StorageKind = keyof typeof TMP_PREFIXES;

/** Key sementara untuk upload (siswa/guru); dipin sebagai storageKey final saat claim. */
export function buildTmpStorageKey(
  originalName: string,
  kind: StorageKind = "submission"
): string {
  // Ekstensi di-clamp 20 karakter — sinkron dengan regex isClaimableKey
  const rawExt = getExtension(originalName).slice(0, 20);
  const ext = rawExt.replace(/[^a-z0-9]/g, "");
  const id = randomUUID();
  const prefix = TMP_PREFIXES[kind];
  return ext ? `${prefix}/${id}.${ext}` : `${prefix}/${id}`;
}

/** Hanya key keluaran buildTmpStorageKey kind tsb yang boleh di-claim. */
export function isClaimableKey(storageKey: string, kind: StorageKind = "submission"): boolean {
  return (
    typeof storageKey === "string" &&
    new RegExp(`^${TMP_PREFIXES[kind]}/[0-9a-f-]{36}(\\.[a-z0-9]{1,20})?$`).test(storageKey)
  );
}

/** Back-compat Story 1 — call-site eksplisit tetap jelas maknanya. */
export const isClaimableSubmissionKey = (k: string) => isClaimableKey(k, "submission");

export interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  fields: Record<string, string>;
}

/**
 * Presigned POST dengan Content-Type terkunci + content-length-range —
 * storage sendiri yang menolak file kebesaran/beda tipe.
 */
export async function presignSubmissionUpload(
  storageKey: string,
  mimeType: string
): Promise<PresignedUpload> {
  const { bucket, client } = requireEnv();
  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: storageKey,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_BYTES],
      ["eq", "$Content-Type", mimeType],
    ],
    Fields: { "Content-Type": mimeType },
    Expires: 600, // 10 menit cukup untuk HP lemot
  });
  return { storageKey, uploadUrl: url, fields };
}

export interface PresignedDownload {
  url: string;
}

/** Presigned GET umur pendek (default 5 menit) untuk pratinjau/unduh. */
export async function presignDownload(
  storageKey: string,
  opts: { filename?: string; disposition?: "inline" | "attachment"; expiresIn?: number } = {}
): Promise<PresignedDownload> {
  const { bucket, client } = requireEnv();
  const disposition = opts.disposition ?? "attachment";
  let contentDisposition: string = disposition;
  if (disposition === "attachment" && opts.filename) {
    const safe = sanitizeOriginalName(opts.filename).replace(/["\\\r\n]/g, "");
    // ASCII fallback + UTF-8 extended (RFC 5987) untuk nama non-ASCII
    const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
    contentDisposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
  }
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ResponseContentDisposition: contentDisposition,
    }),
    { expiresIn: opts.expiresIn ?? 300 }
  );
  return { url };
}

/** Ukuran objek di storage; null bila objek tidak ada (belum/ gagal upload). */
export async function headObjectSize(storageKey: string): Promise<number | null> {
  const { bucket, client } = requireEnv();
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
    );
    const size = res.ContentLength;
    return typeof size === "number" ? size : null;
  } catch {
    return null;
  }
}

/** Hapus objek (maks 1000/batch — cukup untuk resubmit). Kegagalan di-log pemanggil. */
export async function deleteObjects(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return;
  const { bucket, client } = requireEnv();
  const chunks: string[][] = [];
  for (let i = 0; i < storageKeys.length; i += 1000) {
    chunks.push(storageKeys.slice(i, i + 1000));
  }
  for (const chunk of chunks) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
  }
}
