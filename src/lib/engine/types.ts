// Shared engine types. Pure — no DB imports here so the math modules stay
// unit-testable in isolation.

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export type TrapType =
  | "Calculation_Error"
  | "Concept_Error"
  | "Sign_Error"
  | "Reading_Error"
  | "Procedural_Error"
  | "Careless_Slip";

export type RemedialAction =
  | "serve_same_level"
  | "go_down_grade"
  | "go_prereq_skill"
  | "flag_review";

export const GRADE_FLOOR = 5;
export const GRADE_CEILING = 10;

export function clampGrade(grade: number): number {
  return Math.min(GRADE_CEILING, Math.max(GRADE_FLOOR, grade));
}

/** BKT parameters (spec Algorithm 3). Global defaults, tunable per deployment. */
export interface BktParams {
  pL0: number; // initial mastery prior
  pT: number; // learn/transition probability
  pG: number; // lucky-guess probability
  pS: number; // careless-slip probability
}

export const DEFAULT_BKT_PARAMS: BktParams = {
  pL0: 0.1,
  pT: 0.3,
  pG: 0.2,
  pS: 0.1,
};

export const MASTERY_THRESHOLD = 0.95;
export const FOUNDATIONAL_GAP_THRESHOLD = 0.3;
export const LUCKY_GUESS_PRIOR = 0.2;
export const CARELESS_SLIP_MASTERY = 0.7;
export const DKT_PROPAGATION_COEFFICIENT = 0.15;

/** IRT item parameters for the 3PL model. */
export interface IrtItem {
  a: number; // discrimination
  b: number; // difficulty
  c: number; // guessing
}

/** A single scored response used for the θ MLE update. */
export interface IrtObservation {
  item: IrtItem;
  correct: boolean;
}
