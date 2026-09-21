/**
 * Utility modul untuk normalisasi nama sekolah v2,
 * ekstraksi token nomor, kalkulasi kemiripan (Number-Aware Levenshtein),
 * dan evaluasi gerbang dedup 4 skenario.
 */

// Peta ekspansi alias jenjang dan jenis sekolah di Indonesia
const SCHOOL_ALIASES: Record<string, string> = {
  smpn: "smp negeri",
  sdn: "sd negeri",
  sman: "sma negeri",
  smkn: "smk negeri",
  mtsn: "mts negeri",
  min: "mi negeri",
  slb: "sekolah luar biasa",
};

// Angka Romawi umum (I sampai X)
const ROMAN_NUMERALS: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

/**
 * Normalisasi nama sekolah v2:
 * 1. Trim & lowercase
 * 2. Ganti tanda hubung/titik/koma dengan spasi
 * 3. Ekspansi "smp n" / "sd n" / "sma n" dsb. ke "smp negeri"
 * 4. Ekspansi "smpn" / "sdn" / "sman" dsb. ke "smp negeri"
 * 5. Normalisasi angka romawi I-X menjadi digit Arab
 * 6. Buang leading zeroes pada angka ("01" -> "1")
 * 7. Kolaps multi-spasi menjadi spasi tunggal
 */
export function normalizeSchoolName(name: string): string {
  if (!name) return "";

  let cleaned = name.trim().toLowerCase();

  // Ganti tanda baca umum dengan spasi
  cleaned = cleaned.replace(/[-_.,/\\()[\]{}|]/g, " ");

  // Normalisasi bentuk singkatan berpemisah spasi: "smp n 1" -> "smp negeri 1"
  cleaned = cleaned.replace(/\b(smp|sd|sma|smk|mts|ma|mi)\s+n\b/g, "$1 negeri");

  // Tokenize untuk ekspansi alias kata dan angka romawi
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const normalizedTokens = tokens.map((token, idx) => {
    // Cek alias kata penuh (e.g. smpn -> smp negeri)
    if (SCHOOL_ALIASES[token]) {
      return SCHOOL_ALIASES[token];
    }

    // Kasus khusus "man" (Madrasah Aliyah Negeri) jika di awal atau diikuti angka
    if (token === "man" && (idx === 0 || idx === 1)) {
      return "ma negeri";
    }

    // Normalisasi angka romawi
    if (ROMAN_NUMERALS[token]) {
      return ROMAN_NUMERALS[token];
    }

    // Normalisasi leading zeroes pada angka murni (e.g. "01" -> "1", "002" -> "2")
    if (/^0+[0-9]+$/.test(token)) {
      return String(parseInt(token, 10));
    }

    // Normalisasi token gabungan angka (misal "smpn1" -> "smp negeri 1")
    const matchPrefixNum = token.match(/^([a-z]+)(\d+)$/);
    if (matchPrefixNum) {
      const prefix = matchPrefixNum[1];
      const num = parseInt(matchPrefixNum[2], 10);
      const expandedPrefix = SCHOOL_ALIASES[prefix] || prefix;
      return `${expandedPrefix} ${num}`;
    }

    return token;
  });

  return normalizedTokens.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Ekstraksi seluruh token angka dari nama sekolah (termasuk romawi yang sudah dinormalisasi).
 */
export function extractSchoolNumbers(name: string): number[] {
  const norm = normalizeSchoolName(name);
  const matches = norm.match(/\b\d+\b/g);
  if (!matches) return [];
  return matches.map((m) => parseInt(m, 10));
}

/**
 * Algoritma jarak Levenshtein standar.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Menghitung rasio kemiripan (0.0 - 1.0) dengan aturan Number-Aware Veto (F3):
 * Jika kedua nama sekolah memiliki nomor dan nomornya berbeda (misal SMPN 1 vs SMPN 2),
 * kemiripan langsung di-veto menjadi 0.0.
 */
export function calculateSchoolSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeSchoolName(nameA);
  const normB = normalizeSchoolName(nameB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // Number-Aware Veto: Ekstrak nomor dari kedua nama
  const numsA = extractSchoolNumbers(normA);
  const numsB = extractSchoolNumbers(normB);

  // Jika kedua sekolah memiliki nomor dan set nomornya berbeda -> Veto ke 0%
  if (numsA.length > 0 && numsB.length > 0) {
    const isNumbersIdentical =
      numsA.length === numsB.length && numsA.every((val, idx) => val === numsB[idx]);
    if (!isNumbersIdentical) {
      return 0.0;
    }
  }

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(normA, normB);
  const ratio = 1 - distance / maxLen;
  return Math.max(0, Math.min(1, Math.round(ratio * 1000) / 1000));
}

export interface ExistingSchoolCandidate {
  id: string;
  name: string;
  normalizedName: string;
  npsn?: string | null;
  city?: string | null;
}

export type DedupEvaluationResult =
  | { match: "NPSN_EXISTS"; school: ExistingSchoolCandidate }
  | { match: "EXACT_NAME_EXISTS"; school: ExistingSchoolCandidate }
  | { match: "SIMILAR_NAME_FOUND"; school: ExistingSchoolCandidate; similarity: number }
  | { match: "UNIQUE" };

/**
 * Evaluasi gerbang dedup 4 skenario secara berurutan:
 * (a) NPSN match exact
 * (b) normalizedName exact match v2
 * (c) kemiripan >= 85% (dengan nomor identik)
 * (d) lolos / unik
 */
export function evaluateSchoolDedup(
  input: { name: string; npsn?: string | null; forceCreate?: boolean },
  candidates: ExistingSchoolCandidate[]
): DedupEvaluationResult {
  const cleanNpsn = input.npsn ? input.npsn.trim() : null;
  const normalizedInputName = normalizeSchoolName(input.name);

  // Skenario A: Cek NPSN exact match (jika diisi)
  if (cleanNpsn) {
    const npsnMatch = candidates.find(
      (c) => c.npsn && c.npsn.trim().toLowerCase() === cleanNpsn.toLowerCase()
    );
    if (npsnMatch) {
      return { match: "NPSN_EXISTS", school: npsnMatch };
    }
  }

  // Skenario B: Cek normalizedName exact match v2
  const exactNameMatch = candidates.find(
    (c) => normalizeSchoolName(c.name) === normalizedInputName || c.normalizedName === normalizedInputName
  );
  if (exactNameMatch) {
    return { match: "EXACT_NAME_EXISTS", school: exactNameMatch };
  }

  // Jika forceCreate diset, lewati skenario C
  if (input.forceCreate) {
    return { match: "UNIQUE" };
  }

  // Skenario C: Cek kemiripan >= 85% (0.85)
  let highestSimilarity = 0;
  let mostSimilarSchool: ExistingSchoolCandidate | null = null;

  for (const candidate of candidates) {
    const sim = calculateSchoolSimilarity(input.name, candidate.name);
    if (sim >= 0.85 && sim > highestSimilarity) {
      highestSimilarity = sim;
      mostSimilarSchool = candidate;
    }
  }

  if (mostSimilarSchool && highestSimilarity >= 0.85) {
    return {
      match: "SIMILAR_NAME_FOUND",
      school: mostSimilarSchool,
      similarity: highestSimilarity,
    };
  }

  // Skenario D: Lolos semua seleksi
  return { match: "UNIQUE" };
}
