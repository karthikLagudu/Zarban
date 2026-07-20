// Algorithm 3 — Bayesian Knowledge Tracing (spec Part 2, Algorithm 3).
// Closed-form posterior update + learning transition.

import { BktParams, DEFAULT_BKT_PARAMS } from "./types";

export interface BktUpdateResult {
  posterior: number; // P(L | evidence)
  pNew: number; // P(L_new) after the learning transition
}

/**
 * Update mastery probability after one response.
 *
 * Correct:   P(L|c) = P(L)(1-P(S)) / [P(L)(1-P(S)) + (1-P(L))P(G)]
 * Incorrect: P(L|i) = P(L)P(S)     / [P(L)P(S)     + (1-P(L))(1-P(G))]
 * Then:      P(L_new) = P(L|e) + (1 - P(L|e)) * P(T)
 */
export function bktUpdate(
  prior: number,
  isCorrect: boolean,
  params: BktParams = DEFAULT_BKT_PARAMS
): BktUpdateResult {
  const p = clamp01(prior);
  const { pT, pG, pS } = params;

  let posterior: number;
  if (isCorrect) {
    const num = p * (1 - pS);
    const den = num + (1 - p) * pG;
    posterior = den > 0 ? num / den : p;
  } else {
    const num = p * pS;
    const den = num + (1 - p) * (1 - pG);
    posterior = den > 0 ? num / den : p;
  }

  const pNew = posterior + (1 - posterior) * pT;
  return { posterior: clamp01(posterior), pNew: clamp01(pNew) };
}

/** Keep probabilities in an open interval so updates never saturate to 0/1. */
export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0.5;
  return Math.min(0.99, Math.max(0.01, x));
}
