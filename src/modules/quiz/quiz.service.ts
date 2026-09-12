/**
 * QUIZ ONLINE MODULE — Pure Logic (shuffling & scoring)
 * Deterministic, environment-agnostic; covered by unit tests.
 */

export interface ScorableAnswer {
  questionId: string;
  selectedIndex: number;
}

export interface ScorableQuestion {
  id: string;
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
  perQuestion: Array<{
    questionId: string;
    selectedIndex: number | null;
    isCorrect: boolean | null;
    pointsEarned: number;
    pointsMax: number;
  }>;
} {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));

  let score = 0;
  let totalPoints = 0;

  const perQuestion = questions.map((q) => {
    const max = Number(q.points) || 0;
    totalPoints += max;

    const selected = answerMap.has(q.id) ? answerMap.get(q.id)! : null;
    const isCorrect = q.correctIndex !== null && selected === q.correctIndex;
    const pointsEarned = isCorrect ? max : 0;
    score += pointsEarned;

    return {
      questionId: q.id,
      selectedIndex: selected,
      isCorrect: q.correctIndex === null ? null : isCorrect,
      pointsEarned,
      pointsMax: max,
    };
  });

  return { score, totalPoints, perQuestion };
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

/** True when the attempt window (startedAt + durationMinutes) has elapsed. */
export function isAttemptExpired(startedAt: Date, durationMinutes?: number | null): boolean {
  if (!durationMinutes) return false;
  const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
  // 60s grace for network latency on submit.
  return Date.now() > endsAt.getTime() + 60_000;
}
