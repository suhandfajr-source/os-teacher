/**
 * QUIZ ONLINE MODULE — Pure Logic (shuffling & scoring)
 * Deterministic, environment-agnostic; covered by unit tests.
 */

export interface ScorableAnswer {
  questionId: string;
  selectedIndex?: number | null;
  essayAnswer?: string | null;
}

export interface ScorableQuestion {
  id: string;
  type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
  correctIndex: number | null;
  points: number | string; // Prisma Decimal serializes to string over JSON
}

/**
 * Fisher–Yates shuffle (non-seeded; the result is persisted per attempt so
 * refreshes keep the same order).
 */
export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Shuffles options while tracking where the correct index lands. */
export function shuffleOptions(
  options: string[],
  correctIndex: number
): { options: string[]; correctIndex: number } {
  const indexed = options.map((opt, idx) => ({ opt, isCorrect: idx === correctIndex }));
  const shuffled = shuffleArray(indexed);
  return {
    options: shuffled.map((x) => x.opt),
    correctIndex: shuffled.findIndex((x) => x.isCorrect),
  };
}

/**
 * Grades answers against questions. Returns per-question results and total
 * score. Unanswered questions count as incorrect.
 */
export function gradeAttempt(
  questions: ScorableQuestion[],
  answers: ScorableAnswer[]
): {
  score: number;
  totalPoints: number;
  hasEssays: boolean;
  perQuestion: Array<{
    questionId: string;
    type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    selectedIndex: number | null;
    essayAnswer: string | null;
    isCorrect: boolean | null;
    pointsEarned: number;
    pointsMax: number;
  }>;
} {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  let score = 0;
  let totalPoints = 0;
  let hasEssays = false;

  const perQuestion = questions.map((q) => {
    const qType: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY" =
      q.type ?? "MULTIPLE_CHOICE";
    const max = Number(q.points) || 0;
    totalPoints += max;

    const ans = answerMap.get(q.id);
    const selected =
      ans?.selectedIndex !== undefined && ans?.selectedIndex !== null
        ? ans.selectedIndex
        : null;
    const essay = ans?.essayAnswer ?? null;

    if (qType === "ESSAY" || qType === "SHORT_ANSWER") {
      hasEssays = true;
      return {
        questionId: q.id,
        type: qType,
        selectedIndex: null,
        essayAnswer: essay,
        isCorrect: null, // Pending teacher manual review
        pointsEarned: 0,
        pointsMax: max,
      };
    }

    const isCorrect = q.correctIndex !== null && selected === q.correctIndex;
    const pointsEarned = isCorrect ? max : 0;
    score += pointsEarned;

    return {
      questionId: q.id,
      type: qType,
      selectedIndex: selected,
      essayAnswer: null,
      isCorrect: q.correctIndex === null ? null : isCorrect,
      pointsEarned,
      pointsMax: max,
    };
  });

  return { score, totalPoints, hasEssays, perQuestion };
}

/** Normalizes score to 0–100 scale (rounded to 1 decimal). */
export function normalizeScore(score: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0;
  return Math.round((score / totalPoints) * 1000) / 10;
}

/** Long, unguessable share token. */
export function generateShareToken(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

/** True when the attempt window (startedAt + durationMinutes or deadline) has elapsed. */
export function isAttemptExpired(
  startedAt: Date,
  durationMinutes?: number | null,
  deadline?: Date | null
): boolean {
  if (deadline && Date.now() > deadline.getTime() + 60_000) {
    return true;
  }
  if (!durationMinutes) return false;
  const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
  // 60s grace for network latency on submit.
  return Date.now() > endsAt.getTime() + 60_000;
}

/**
 * Generates a 6-digit numeric room PIN for whole-class quizzes (e.g. "742198").
 */
export function generateClassroomPin(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

// ----------------------------------------------------------------------------
// Attempt question snapshot
// ----------------------------------------------------------------------------

export interface AttemptQuestionSnapshot {
  id: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  /** Options already in the student's display order. */
  options: string[];
  /** Correct index aligned to the displayed options order. */
  correctIndex: number | null;
  points: number;
  explanation?: string;
}

export interface LegacyAttemptOrder {
  questionIds: string[];
  optionOrders: Record<string, number[]>;
}

/**
 * Rebuilds a snapshot from a legacy attempt's stored order (question ids +
 * option permutations) against the quiz's current questions. Used to display
 * old attempts faithfully — what the student actually saw.
 */
export function reconstructLegacySnapshot(
  order: LegacyAttemptOrder,
  questions: Array<{
    id: string;
    type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    text: string;
    options: string[];
    correctIndex: number | null;
    points: number;
    explanation?: string;
  }>
): AttemptQuestionSnapshot[] {
  const map = new Map(questions.map((q) => [q.id, q]));
  const out: AttemptQuestionSnapshot[] = [];
  for (const qid of order.questionIds) {
    const q = map.get(qid);
    if (!q) continue;
    const qType = q.type ?? "MULTIPLE_CHOICE";
    const perm = order.optionOrders[qid] ?? q.options.map((_, i) => i);
    const options = perm.map((i) => q.options[i]).filter((o) => o !== undefined);
    const correctIndex =
      q.correctIndex === null ? null : perm.indexOf(q.correctIndex);
    out.push({
      id: q.id,
      type: qType,
      text: q.text,
      options,
      correctIndex,
      points: Number(q.points) || 0,
      explanation: q.explanation,
    });
  }
  return out;
}

/**
 * Builds the per-attempt question snapshot: display-ordered questions with
 * options (and their correct index) pre-shuffled per student. This is stored
 * on the attempt so later teacher edits never corrupt past work, and resets
 * naturally pick up the latest questions.
 */
export function buildAttemptSnapshot(
  questions: Array<{
    id: string;
    type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    text: string;
    options: string[];
    correctIndex: number | null;
    points: number;
    explanation?: string;
  }>,
  shuffleQuestions: boolean,
  shuffleOpts: boolean
): AttemptQuestionSnapshot[] {
  const ordered = shuffleQuestions ? shuffleArray(questions) : [...questions];
  return ordered.map((q) => {
    const qType = q.type ?? "MULTIPLE_CHOICE";
    if (qType === "MULTIPLE_CHOICE" && shuffleOpts && q.correctIndex !== null) {
      const res = shuffleOptions(q.options, q.correctIndex);
      return {
        id: q.id,
        type: qType,
        text: q.text,
        options: res.options,
        correctIndex: res.correctIndex,
        points: Number(q.points) || 0,
        explanation: q.explanation,
      };
    }
    return {
      id: q.id,
      type: qType,
      text: q.text,
      options: [...q.options],
      correctIndex: q.correctIndex,
      points: Number(q.points) || 0,
      explanation: q.explanation,
    };
  });
}

/**
 * Generates `count` unique 4-digit numeric PINs, none colliding with
 * `existingPins`.
 */
export function generateUniquePins(
  count: number,
  existingPins: Set<string> = new Set()
): string[] {
  const pins: string[] = [];
  const taken = new Set(existingPins);
  let guard = 0;
  while (pins.length < count && guard < 10_000) {
    guard++;
    const pin = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
    if (taken.has(pin)) continue;
    taken.add(pin);
    pins.push(pin);
  }
  if (pins.length < count) {
    throw new Error("Tidak dapat membuat PIN unik (kuota 4-digit terlampaui)");
  }
  return pins;
}

/** Normalizes PIN input: digits only, so "007" and "7" both work. */
export function normalizePin(pin: string): string {
  const digits = String(pin ?? "").replace(/\D/g, "");
  return digits.length === 0 ? "" : String(Number(digits));
}

// ----------------------------------------------------------------------------
// PIN Rate Limiter (in-memory, per student attempt key)
// ----------------------------------------------------------------------------

interface PinRateLimitEntry {
  count: number;
  resetAt: number;
}

const pinAttemptStore = new Map<string, PinRateLimitEntry>();

export function checkPinRateLimit(
  key: string,
  maxAttempts: number = 5
): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();
  const entry = pinAttemptStore.get(key);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, remainingSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    const remaining = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remainingSeconds: remaining };
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function recordPinFailure(
  key: string,
  windowMs: number = 60_000
): void {
  const now = Date.now();
  const entry = pinAttemptStore.get(key);

  if (!entry || now > entry.resetAt) {
    pinAttemptStore.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count += 1;
  }

  if (pinAttemptStore.size > 500) {
    for (const [k, v] of pinAttemptStore.entries()) {
      if (now > v.resetAt) pinAttemptStore.delete(k);
    }
  }
}

export function resetPinRateLimit(key: string): void {
  pinAttemptStore.delete(key);
}
