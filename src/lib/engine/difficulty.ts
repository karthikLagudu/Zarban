// Difficulty band ladder helpers (CAT progression, spec Algorithm 1).

import { Difficulty, DIFFICULTIES } from "./types";

export function escalateDifficulty(current: string | null | undefined): Difficulty {
  const idx = DIFFICULTIES.indexOf((current ?? "medium") as Difficulty);
  if (idx < 0) return "medium";
  return DIFFICULTIES[Math.min(idx + 1, DIFFICULTIES.length - 1)];
}

export function reduceDifficulty(current: string | null | undefined): Difficulty {
  const idx = DIFFICULTIES.indexOf((current ?? "medium") as Difficulty);
  if (idx < 0) return "medium";
  return DIFFICULTIES[Math.max(idx - 1, 0)];
}

export function isDifficulty(value: string | null | undefined): value is Difficulty {
  return DIFFICULTIES.includes((value ?? "") as Difficulty);
}

/** Ordered fallback bands, nearest first (spec Part 7.1). */
export function nearestBands(preferred: string): Difficulty[] {
  const order: Record<string, Difficulty[]> = {
    easy: ["easy", "medium", "hard"],
    medium: ["medium", "easy", "hard"],
    hard: ["hard", "medium", "easy"],
  };
  return order[preferred] ?? ["medium", "easy", "hard"];
}
