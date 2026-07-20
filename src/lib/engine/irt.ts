// Algorithm 1 — CAT + IRT (3-Parameter Logistic model with MLE θ update).
// Spec Part 2, Algorithm 1.

import { IrtItem, IrtObservation } from "./types";

export const THETA_MIN = -4;
export const THETA_MAX = 4;

/** P(correct | θ) under the 3PL model: P(θ) = c + (1 - c) / (1 + exp(-a(θ - b))) */
export function probability3PL(theta: number, item: IrtItem): number {
  const { a, b, c } = item;
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

/**
 * Maximum Likelihood Estimation of θ over the full response history using
 * Newton–Raphson on the log-likelihood, warm-started from the current θ.
 * Falls back to a small fixed step in the correct direction when the history
 * is degenerate (all correct / all incorrect), where the MLE diverges.
 */
export function estimateThetaMLE(
  observations: IrtObservation[],
  startTheta = 0
): number {
  if (observations.length === 0) return startTheta;

  const allCorrect = observations.every((o) => o.correct);
  const allWrong = observations.every((o) => !o.correct);
  if (allCorrect || allWrong) {
    // MLE is unbounded; nudge θ stepwise instead (0.5 per response, capped).
    const step = 0.5 * observations.length * (allCorrect ? 1 : -1);
    return clampTheta(startTheta + Math.sign(step) * Math.min(Math.abs(step), 2));
  }

  let theta = startTheta;
  for (let iter = 0; iter < 20; iter++) {
    let d1 = 0; // first derivative of log-likelihood
    let d2 = 0; // second derivative (approx., Fisher scoring)
    for (const { item, correct } of observations) {
      const { a, c } = item;
      const p = probability3PL(theta, item);
      const pStar = (p - c) / (1 - c); // probability without guessing
      const u = correct ? 1 : 0;
      d1 += a * ((u - p) / (p * (1 - p))) * pStar * (1 - p);
      d2 -= a * a * pStar * pStar * ((1 - p) / p);
    }
    if (Math.abs(d2) < 1e-9) break;
    const delta = d1 / d2;
    theta -= delta;
    theta = clampTheta(theta);
    if (Math.abs(delta) < 1e-4) break;
  }
  return clampTheta(theta);
}

/**
 * Incremental θ update after a single response (spec: "Correct → increase θ,
 * Incorrect → decrease θ"). Uses the full-history MLE when history is
 * available; the API layer passes all session responses.
 */
export function irtUpdateTheta(
  currentTheta: number,
  observations: IrtObservation[]
): number {
  return estimateThetaMLE(observations, currentTheta);
}

export function clampTheta(theta: number): number {
  if (Number.isNaN(theta)) return 0;
  return Math.min(THETA_MAX, Math.max(THETA_MIN, theta));
}

/**
 * Derive default 3PL item parameters from grade + difficulty band, used when
 * the SME workbook does not supply calibrated values.
 * b centres the scale on Grade 7/8 (mid of 5–10); bands shift ±0.8.
 *
 * When a seed (question id) is given, a small deterministic jitter is applied
 * so items within the same {grade, band} cell span a range of difficulties —
 * this is what lets maximum-information selection pick the item closest to
 * the student's current θ instead of an arbitrary one.
 */
export function defaultItemParams(
  gradeLevel: number,
  difficultyBand: string,
  seed?: string
): IrtItem {
  const bandOffset =
    difficultyBand === "easy" ? -0.8 : difficultyBand === "hard" ? 0.8 : 0;
  let b = (gradeLevel - 7.5) * 0.45 + bandOffset;
  let a = 1.1;
  if (seed) {
    const h = hashString(seed);
    b += ((h % 1000) / 1000 - 0.5) * 0.7; // ±0.35 within the band
    a += ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 0.3; // 0.95–1.25
  }
  return {
    a: Math.round(a * 100) / 100,
    b: Math.round(b * 100) / 100,
    c: 0.25,
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
