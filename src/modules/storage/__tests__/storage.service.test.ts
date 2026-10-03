import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 1 — unit test storage.service dengan SDK di-mock:
 * policy presigned POST (content-length-range + Content-Type), format
 * Content-Disposition RFC 5987, batching deleteObjects, dan guard env.
 */

const { mockSend, mockGetSignedUrl, mockCreatePresignedPost } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSignedUrl: vi.fn(),
  mockCreatePresignedPost: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = mockSend;
  }
  class FakeCmd {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return { S3Client: FakeS3Client, GetObjectCommand: FakeCmd, HeadObjectCommand: FakeCmd, DeleteObjectsCommand: FakeCmd };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mockGetSignedUrl }));
vi.mock("@aws-sdk/s3-presigned-post", () => ({ createPresignedPost: mockCreatePresignedPost }));

import {
  StorageNotConfiguredError,
  buildTmpStorageKey,
  deleteObjects,
  isClaimableSubmissionKey,
  isClaimableKey,
  isStorageConfigured,
  presignDownload,
  presignSubmissionUpload,
} from "../storage.service";

describe("Story 1 — env guard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
    mockCreatePresignedPost.mockReset();
  });

  it("tanpa S3_* → isStorageConfigured false & presign melempar error jelas", async () => {
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("S3_ACCESS_KEY_ID", "");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    expect(isStorageConfigured()).toBe(false);
    await expect(presignSubmissionUpload("k", "image/jpeg")).rejects.toBeInstanceOf(
      StorageNotConfiguredError
    );
    await expect(presignDownload("k")).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });
});

describe("Story 1 — presignSubmissionUpload policy", () => {
  beforeEach(() => {
    vi.stubEnv("S3_BUCKET", "klassa-dev");
    vi.stubEnv("S3_ACCESS_KEY_ID", "ak");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "sk");
    mockCreatePresignedPost.mockResolvedValue({
      url: "https://r2.example/upload",
      fields: { "Content-Type": "image/jpeg" },
    });
  });

  it("policy memaksa content-length-range 1..25MB + eq Content-Type", async () => {
    const res = await presignSubmissionUpload("submissions/tmp/x.jpg", "image/jpeg");
    expect(mockCreatePresignedPost).toHaveBeenCalledTimes(1);
    const arg = mockCreatePresignedPost.mock.calls[0][1];
    expect(arg.Conditions).toContainEqual(["content-length-range", 1, 25 * 1024 * 1024]);
    expect(arg.Conditions).toContainEqual(["eq", "$Content-Type", "image/jpeg"]);
    expect(res.uploadUrl).toContain("r2.example");
    expect(res.fields["Content-Type"]).toBe("image/jpeg");
  });
});

describe("Story 1 — presignDownload Content-Disposition (RFC 5987)", () => {
  beforeEach(() => {
    vi.stubEnv("S3_BUCKET", "klassa-dev");
    vi.stubEnv("S3_ACCESS_KEY_ID", "ak");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "sk");
    mockGetSignedUrl.mockReset().mockResolvedValue("https://r2.example/signed");
  });

  it("attachment + nama ASCII → filename quoted", async () => {
    await presignDownload("k", { filename: "tugas budi.pdf", disposition: "attachment" });
    const cmd = mockGetSignedUrl.mock.calls[0][1];
    expect(cmd.input.ResponseContentDisposition).toBe(
      `attachment; filename="tugas budi.pdf"; filename*=UTF-8''tugas%20budi.pdf`
    );
  });

  it("attachment + nama non-ASCII → fallback underscore + filename* UTF-8", async () => {
    await presignDownload("k", { filename: "jawaban müslih.pdf", disposition: "attachment" });
    const cd = mockGetSignedUrl.mock.calls[0][1].input.ResponseContentDisposition as string;
    expect(cd).toContain(`filename="jawaban m_slih.pdf"`);
    expect(cd).toContain(`filename*=UTF-8''jawaban%20m%C3%BCslih.pdf`);
  });

  it("inline → disposition polos tanpa filename", async () => {
    await presignDownload("k", { filename: "x.jpg", disposition: "inline" });
    expect(mockGetSignedUrl.mock.calls[0][1].input.ResponseContentDisposition).toBe("inline");
  });
});

describe("Story 1 — deleteObjects batching", () => {
  beforeEach(() => {
    vi.stubEnv("S3_BUCKET", "klassa-dev");
    vi.stubEnv("S3_ACCESS_KEY_ID", "ak");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "sk");
    mockSend.mockReset().mockResolvedValue({});
  });

  it("≤1000 kunci → satu panggilan; >1000 → di-chunk per 1000", async () => {
    await deleteObjects(["a", "b"]);
    expect(mockSend).toHaveBeenCalledTimes(1);

    mockSend.mockClear();
    const many = Array.from({ length: 2501 }, (_, i) => `k${i}`);
    await deleteObjects(many);
    expect(mockSend).toHaveBeenCalledTimes(3);
    const lastBatch = mockSend.mock.calls[2][0].input.Delete.Objects;
    expect(lastBatch).toHaveLength(501);
  });

  it("array kosong → tidak menyentuh storage", async () => {
    await deleteObjects([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("Story 1 — key builder & claim guard (E12 sinkron)", () => {
  it("key keluaran builder selalu claimable", () => {
    for (const name of ["a.jpg", "b.HEIC", "c.applicationmanifestlongext", "tanpaext", "weird.!@#png"]) {
      const key = buildTmpStorageKey(name);
      expect(isClaimableSubmissionKey(key)).toBe(true);
    }
  });

  it("ekstensi di-clamp & dibersihkan ≤20 karakter alfanumerik", () => {
    const key = buildTmpStorageKey("x.aaaaaaaaaaaaaaaaaaaaaaaaa"); // 25 char
    const ext = key.split(".").pop()!;
    expect(ext.length).toBeLessThanOrEqual(20);
    expect(ext).toMatch(/^[a-z0-9]+$/);
  });

  it("key liar tetap ditolak", () => {
    expect(isClaimableSubmissionKey("assignments/tmp/curi.jpg")).toBe(false);
    expect(isClaimableSubmissionKey("submissions/tmp/bukan-uuid.jpg")).toBe(false);
    expect(isClaimableSubmissionKey("")).toBe(false);
  });
});

describe("Story 2 — key builder kind=attachment", () => {
  it("prefix attachments/tmp & claimable untuk kind yang benar saja", () => {
    const key = buildTmpStorageKey("soal.pdf", "attachment");
    expect(key).toMatch(/^attachments\/tmp\/[0-9a-f-]{36}\.pdf$/);
    expect(isClaimableKey(key, "attachment")).toBe(true);
    // Key attachment TIDAK boleh diklaim sebagai submission (sekat kind)
    expect(isClaimableKey(key, "submission")).toBe(false);
    const subKey = buildTmpStorageKey("jawaban.jpg", "submission");
    expect(isClaimableKey(subKey, "attachment")).toBe(false);
  });

  it("default kind tetap submission (back-compat Story 1)", () => {
    expect(buildTmpStorageKey("a.jpg")).toMatch(/^submissions\/tmp\//);
  });
});
