// PART 3 — Adaptive Flow Orchestration (Master Algorithm Loop).
//
// Implements get_next_question / processResponse per the spec pseudocode, with
// one deliberate structural fix: the spec text says the BKT + IRT updates run
// "on every response", but its pseudocode returns early on wrong answers
// before reaching them. Here the updates always run first, then routing
// (twin probe → CDM remediation → CAT progression) decides the next question.

import { prisma } from "@/lib/db";
import type { AssessmentSession, Question } from "@/generated/prisma/client";
import { allEdges, seenInEarlierSessions, settingInt, skillById } from "./cache";
import { bktUpdate, clamp01 } from "./bkt";
import { escalateDifficulty, reduceDifficulty } from "./difficulty";
import { fetchQuestion } from "./fetch-question";
import { irtUpdateTheta, defaultItemParams } from "./irt";
import {
  getFirstTopic,
  getNextTopic,
  getPrerequisite,
  getTopicsForGrade,
  skillBaseGrade,
} from "./topics";
import {
  CARELESS_SLIP_MASTERY,
  clampGrade,
  DEFAULT_BKT_PARAMS,
  DKT_PROPAGATION_COEFFICIENT,
  FOUNDATIONAL_GAP_THRESHOLD,
  LUCKY_GUESS_PRIOR,
  MASTERY_THRESHOLD,
  type IrtObservation,
} from "./types";

export interface ServedQuestion {
  questionId: string;
  questionText: string;
  options: { label: string; text: string }[];
  skillId: string | null;
  skillName: string | null;
  topicArea: string | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
  isTwinProbe: boolean;
  questionNumber: number; // model questions answered so far + 1
  maxQuestions: number;
}

export interface StepResult {
  done: boolean;
  reason?: string; // termination reason
  decision: string; // engine routing decision (for replay/debug)
  question?: ServedQuestion;
  bkt?: { skillId: string; pMastery: number };
  theta?: number;
}

interface RouteSpec {
  decision: string;
  skillId?: string;
  grade?: number;
  difficulty?: string;
  questionId?: string; // direct (twin)
  isTwinProbe?: boolean;
  advanceTopic?: boolean; // route to next unvisited topic
}

function csvToList(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
function listToCsv(list: string[]): string {
  return list.join(",");
}

// ── Session start ────────────────────────────────────────────────────────────

export async function startSession(
  studentId: string,
  selectedGrade: number
): Promise<{ sessionId: string; step: StepResult }> {
  const grade = clampGrade(selectedGrade);
  const firstTopic = await getFirstTopic(grade);
  if (!firstTopic) {
    throw new Error(
      `No skills configured for grade ${grade}. Import the SME workbook first.`
    );
  }
  const maxQuestions = await getMaxQuestions();

  const session = await prisma.assessmentSession.create({
    data: {
      studentId,
      selectedGrade: grade,
      currentGrade: grade,
      currentSkillId: firstTopic.skillId,
      currentDifficulty: "medium",
      maxQuestions,
    },
  });

  const fetched = await fetchQuestion({
    skillId: firstTopic.skillId,
    grade,
    difficulty: "medium",
    excludeIds: [],
    theta: 0,
    seenBeforeIds: await seenInEarlierSessions(studentId, session.sessionId),
  });
  if (!fetched) {
    // No questions at all for the first topic — try any topic before failing.
    const step = await serveNextTopic(session, [], "init_fallback_topic");
    return { sessionId: session.sessionId, step };
  }

  await syncSessionToServe(session, {
    skillId: firstTopic.skillId,
    grade,
    difficulty: fetched.question.difficultyBand ?? "medium",
  });

  return {
    sessionId: session.sessionId,
    step: {
      done: false,
      decision: "init",
      question: await toServed(fetched.question, false, session, 1),
      theta: session.currentTheta,
    },
  };
}

async function getMaxQuestions(): Promise<number> {
  const n = await settingInt("max_questions", 30);
  return n > 0 ? n : 30;
}

/** Total test time limit in seconds (0 = no limit). */
export async function getTestTimeLimitSeconds(): Promise<number> {
  const n = await settingInt("test_timer_minutes", 0);
  return n > 0 ? n * 60 : 0;
}

/** End a session explicitly (used when the total test timer expires). */
export async function finishSession(
  sessionId: string,
  reason = "time_up"
): Promise<StepResult> {
  const session = await prisma.assessmentSession.findUnique({
    where: { sessionId },
  });
  if (!session) throw new Error("Session not found");
  if (session.status !== "in_progress") {
    return { done: true, decision: "already_completed", reason: session.status };
  }
  return endSession(session, reason);
}

// ── Response processing (the master loop) ───────────────────────────────────

export async function processResponse(
  sessionId: string,
  questionId: string,
  selectedOption: string,
  responseTimeMs?: number
): Promise<StepResult> {
  // The session and the just-answered question are independent reads — fetch
  // both in one round trip instead of two.
  const [session, question] = await Promise.all([
    prisma.assessmentSession.findUnique({ where: { sessionId } }),
    prisma.question.findUnique({
      where: { questionId },
      include: { primarySkill: true },
    }),
  ]);
  if (!session) throw new Error("Session not found");
  if (session.status !== "in_progress") {
    return { done: true, decision: "already_completed", reason: session.status };
  }
  if (!question) throw new Error("Question not found");

  const option = selectedOption.trim().toUpperCase().slice(0, 1);
  const isCorrect = option === (question.correctOption ?? "").trim().toUpperCase();
  const wasTwinProbe = session.twinProbePending;
  const skillId = question.primarySkillId ?? session.currentSkillId;

  // The three inputs to the update — the answer trap (CDM), the current BKT
  // state, and the session history (IRT) — are all independent reads. Batch
  // them so their latency overlaps rather than adding up. History is trimmed to
  // only the fields the engine consumes.
  const [trap, bktStateRow, priorResponses] = await Promise.all([
    !isCorrect
      ? prisma.answerTrap.findUnique({
          where: { questionId_optionLabel: { questionId, optionLabel: option } },
        })
      : Promise.resolve(null),
    skillId
      ? prisma.bktState.findUnique({
          where: { studentId_skillId: { studentId: session.studentId, skillId } },
        })
      : Promise.resolve(null),
    prisma.response.findMany({
      where: { sessionId },
      select: {
        questionId: true,
        isCorrect: true,
        twinProbe: true,
        question: {
          select: { irtA: true, irtB: true, irtC: true, gradeLevel: true, difficultyBand: true },
        },
      },
      orderBy: { responseId: "asc" },
    }),
  ]);

  // Step 4 — BKT update (every response).
  let prior = DEFAULT_BKT_PARAMS.pL0;
  let pNew = prior;
  let attempts = 1;
  if (skillId) {
    prior = bktStateRow?.pMastery ?? DEFAULT_BKT_PARAMS.pL0;
    const res = bktUpdate(prior, isCorrect);
    pNew = res.pNew;
    attempts = (bktStateRow?.attempts ?? 0) + 1;
    await prisma.bktState.upsert({
      where: {
        studentId_skillId: { studentId: session.studentId, skillId },
      },
      create: {
        studentId: session.studentId,
        skillId,
        pMastery: pNew,
        attempts: 1,
        lastUpdated: new Date(),
      },
      update: { pMastery: pNew, attempts, lastUpdated: new Date() },
    });
    // Algorithm 4 — DKT-lite propagation to dependent skills.
    await propagateDkt(session.studentId, skillId, pNew - prior);
  }

  // Step 5 — IRT θ update over the full session history.
  const observations: IrtObservation[] = [
    ...priorResponses.map((r) => ({
      item: itemParamsOf(r.question),
      correct: r.isCorrect === true,
    })),
    { item: itemParamsOf(question), correct: isCorrect },
  ];
  const theta = irtUpdateTheta(session.currentTheta, observations);

  // Consecutive counters.
  const consecutiveFailures = isCorrect ? 0 : session.consecutiveFailures + 1;
  const consecutiveCorrect = isCorrect ? session.consecutiveCorrect + 1 : 0;

  const servedIds = [...priorResponses.map((r) => r.questionId), questionId];
  const modelQuestionsAnswered =
    priorResponses.filter((r) => !r.twinProbe).length + (wasTwinProbe ? 0 : 1);

  // ── Routing ────────────────────────────────────────────────────────────────
  let route: RouteSpec;

  if (wasTwinProbe) {
    // This response answers the equation twin (Algorithm 5).
    if (isCorrect) {
      // Word wrong + equation right → Reading/Comprehension gap. No regression.
      route = {
        decision: "reading_error_flag_continue",
        skillId: session.currentSkillId ?? undefined,
        grade: session.currentGrade ?? session.selectedGrade ?? 7,
        difficulty: session.currentDifficulty ?? "medium",
      };
      if (session.twinOriginQuestion) {
        await prisma.response.updateMany({
          where: { sessionId, questionId: session.twinOriginQuestion },
          data: { trapType: "Reading_Error", misconception: "Reading Comprehension Gap" },
        });
      }
    } else {
      // Both wrong → Math Concept Error → CDM remediation. The outcome is
      // logged on the original word problem; the twin keeps its own trap.
      if (session.twinOriginQuestion) {
        await prisma.response.updateMany({
          where: { sessionId, questionId: session.twinOriginQuestion },
          data: { trapType: "Concept_Error" },
        });
      }
      route = await routeWrongAnswer(
        session, trap, prior, pNew, attempts, consecutiveFailures
      );
    }
  } else if (
    !isCorrect &&
    question.wordProblemFlag &&
    question.equationTwinId &&
    !servedIds.includes(question.equationTwinId)
  ) {
    // Step 2 — Twin Question probe for word problems (Algorithm 5).
    route = {
      decision: "twin_probe",
      questionId: question.equationTwinId,
      isTwinProbe: true,
    };
  } else if (!isCorrect) {
    route = await routeWrongAnswer(
      session, trap, prior, pNew, attempts, consecutiveFailures
    );
  } else {
    route = await routeCorrectAnswer(session, prior, pNew, consecutiveCorrect);
  }

  // Record the response and persist session counters together — two
  // independent writes to different tables, so run them concurrently. The
  // update returns the fresh row, avoiding a third round trip to re-read it.
  const [, fresh] = await Promise.all([
    prisma.response.create({
      data: {
        sessionId,
        questionId,
        selectedOption: option,
        isCorrect,
        trapType: trap?.trapType ?? null,
        skillGapId: trap?.skillGapId ?? null,
        misconception: trap?.misconception ?? null,
        twinProbe: wasTwinProbe,
        servedSkillId: session.currentSkillId,
        servedGrade: session.currentGrade,
        servedDifficulty: session.currentDifficulty,
        engineDecision: route.decision,
        thetaAfter: theta,
        pMasteryAfter: skillId ? pNew : null,
        responseTimeMs: responseTimeMs ?? null,
      },
    }),
    prisma.assessmentSession.update({
      where: { sessionId },
      data: {
        currentTheta: theta,
        consecutiveFailures,
        consecutiveCorrect,
        twinProbePending: route.isTwinProbe === true,
        twinOriginQuestion: route.isTwinProbe ? questionId : session.twinOriginQuestion,
        pendingConfirmation: route.decision === "lucky_guess_confirmation",
      },
    }),
  ]);

  // ── Termination checks (Part 7.2 + total test timer) ──────────────────────
  const timeLimit = await getTestTimeLimitSeconds();
  if (
    timeLimit > 0 &&
    Date.now() > fresh.startedAt.getTime() + (timeLimit + 5) * 1000 // 5s grace
  ) {
    return endSession(fresh, "time_up", skillId ?? undefined, pNew, theta);
  }
  if (modelQuestionsAnswered >= fresh.maxQuestions) {
    return endSession(fresh, "max_questions_reached", skillId ?? undefined, pNew, theta);
  }
  // A wrong answer can only lower mastery (BKT + DKT), so the "all skills
  // mastered" set can't newly complete on one — skip the probe unless correct.
  if (isCorrect && (await allGradeSkillsMastered(fresh))) {
    return endSession(fresh, "all_skills_mastered", skillId ?? undefined, pNew, theta);
  }

  // ── Serve the routed question ─────────────────────────────────────────────
  const step = await serveRoute(fresh, route, servedIds, modelQuestionsAnswered);
  if (skillId) step.bkt = { skillId, pMastery: pNew };
  step.theta = theta;
  return step;
}

// ── Wrong-answer routing (CDM remediation + CAT traversal rules) ────────────

async function routeWrongAnswer(
  session: AssessmentSession,
  trap: {
    trapType: string | null;
    remedialAction: string | null;
    remedialSkillId: string | null;
    remedialGrade: number | null;
  } | null,
  prior: number,
  pNew: number,
  attempts: number,
  consecutiveFailures: number
): Promise<RouteSpec> {
  const curSkill = session.currentSkillId ?? undefined;
  const curGrade = session.currentGrade ?? session.selectedGrade ?? 7;
  const curDifficulty = session.currentDifficulty ?? "medium";

  // Careless-slip guard (Algorithm 3): slip with high mastery → retry, never regress.
  if (trap?.trapType === "Careless_Slip" && prior >= CARELESS_SLIP_MASTERY) {
    return {
      decision: "careless_slip_retry",
      skillId: curSkill,
      grade: curGrade,
      difficulty: curDifficulty,
    };
  }

  // Cross-grade traversal: 2 consecutive failures at easy in the same topic.
  if (curDifficulty === "easy" && consecutiveFailures >= 2) {
    return traversalRoute(session, "easy_fail_streak");
  }

  // BKT foundational gap: P(L) ≤ 0.30 after 3 attempts, or with a fail streak.
  if (
    pNew <= FOUNDATIONAL_GAP_THRESHOLD &&
    (attempts >= 3 || consecutiveFailures >= 2)
  ) {
    return traversalRoute(session, "foundational_gap");
  }

  // Step 3 — CDM remedial action from the answer trap.
  if (trap?.remedialAction) {
    switch (trap.remedialAction) {
      case "serve_same_level":
        return {
          decision: "cdm_serve_same_level",
          skillId: curSkill,
          grade: curGrade,
          difficulty: curDifficulty,
        };
      case "go_down_grade": {
        const grade = clampGrade(trap.remedialGrade ?? curGrade - 1);
        const skillId = trap.remedialSkillId ?? curSkill;
        await logTraversal(session, skillId, grade, "concept_error");
        return {
          decision: "cdm_go_down_grade",
          skillId,
          grade,
          difficulty: "easy",
        };
      }
      case "go_prereq_skill": {
        return traversalRoute(session, trapReason(trap.trapType), trap.remedialSkillId);
      }
      case "flag_review": {
        if (curSkill) {
          await prisma.reviewFlag.create({
            data: {
              sessionId: session.sessionId,
              skillId: curSkill,
              note: trap.trapType ?? "flag_review",
            },
          });
        }
        return { decision: "cdm_flag_review_next_topic", advanceTopic: true };
      }
    }
  }

  // Step 8 (else branch) — standard reduction.
  return {
    decision: "reduce_difficulty",
    skillId: curSkill,
    grade: curGrade,
    difficulty: reduceDifficulty(curDifficulty),
  };
}

function trapReason(trapType: string | null): string {
  if (trapType === "Sign_Error") return "sign_error";
  if (trapType === "Concept_Error") return "concept_error";
  return "deep_misconception";
}

/** Knowledge-graph traversal to a prerequisite (cross-grade, spec Alg. 1 + 2). */
async function traversalRoute(
  session: AssessmentSession,
  reason: string,
  preferredSkillId?: string | null
): Promise<RouteSpec> {
  const curSkill = session.currentSkillId;
  const curGrade = session.currentGrade ?? session.selectedGrade ?? 7;

  let target = preferredSkillId ? await skillById(preferredSkillId) : null;
  if (!target && curSkill) target = await getPrerequisite(curSkill);

  if (!target || target.skillId === curSkill) {
    // Root node — gap confirmed at the floor. Return to the original grade.
    return { decision: "gap_confirmed_return_next_topic", advanceTopic: true };
  }

  const grade = clampGrade(
    Math.min(curGrade - 1, skillBaseGrade(target.gradeLevel, curGrade - 1))
  );
  await logTraversal(session, target.skillId, grade, reason);
  return {
    decision: `prereq_traversal_${reason}`,
    skillId: target.skillId,
    grade,
    difficulty: "easy",
  };
}

async function logTraversal(
  session: AssessmentSession,
  toSkillId: string | undefined,
  toGrade: number,
  reason: string
) {
  if (!session.currentSkillId || !toSkillId) return;
  await prisma.traversalEvent.create({
    data: {
      sessionId: session.sessionId,
      fromSkillId: session.currentSkillId,
      toSkillId,
      fromGrade: session.currentGrade,
      toGrade,
      reason,
    },
  });
  // Remember where to come back to (original-grade topic) once cleared.
  if (!session.returnSkillId) {
    await prisma.assessmentSession.update({
      where: { sessionId: session.sessionId },
      data: {
        returnSkillId: session.currentSkillId,
        returnGrade: session.currentGrade ?? session.selectedGrade,
      },
    });
  }
}

// ── Correct-answer routing (CAT progression) ────────────────────────────────

async function routeCorrectAnswer(
  session: AssessmentSession,
  prior: number,
  pNew: number,
  consecutiveCorrect: number
): Promise<RouteSpec> {
  const curSkill = session.currentSkillId ?? undefined;
  const curGrade = session.currentGrade ?? session.selectedGrade ?? 7;
  const curDifficulty = session.currentDifficulty ?? "medium";

  // Remediation cleared: correct on a prerequisite question → return to the
  // next topic at the student's original grade (spec Cross-Grade Traversal).
  if (session.returnSkillId && curGrade < (session.selectedGrade ?? curGrade)) {
    return { decision: "remediation_cleared_return", advanceTopic: true };
  }

  // Step 6 — Mastery: stop testing this skill, advance topic.
  if (pNew >= MASTERY_THRESHOLD) {
    return { decision: "mastered_next_topic", advanceTopic: true };
  }

  // Step 7 — Lucky-guess guard: confirm before escalating.
  if (prior < LUCKY_GUESS_PRIOR && !session.pendingConfirmation) {
    return {
      decision: "lucky_guess_confirmation",
      skillId: curSkill,
      grade: curGrade,
      difficulty: curDifficulty,
    };
  }

  // Correct streak ≥ 2 → escalate band, or advance topic once all bands served.
  if (consecutiveCorrect >= 2) {
    const bands = csvToList(session.bandsServed);
    const allBandsServed = ["easy", "medium", "hard"].every((b) =>
      bands.includes(b)
    );
    if (curDifficulty === "hard" || allBandsServed) {
      return { decision: "streak_advance_topic", advanceTopic: true };
    }
    return {
      decision: "streak_escalate_difficulty",
      skillId: curSkill,
      grade: curGrade,
      difficulty: escalateDifficulty(curDifficulty),
    };
  }

  // Step 8 — standard progression.
  return {
    decision: "escalate_difficulty",
    skillId: curSkill,
    grade: curGrade,
    difficulty: escalateDifficulty(curDifficulty),
  };
}

// ── Serving + session bookkeeping ────────────────────────────────────────────

async function serveRoute(
  session: AssessmentSession,
  route: RouteSpec,
  servedIds: string[],
  modelQuestionsAnswered: number
): Promise<StepResult> {
  const seenBeforeIds = await seenInEarlierSessions(
    session.studentId,
    session.sessionId
  );
  // Twin probe: direct question fetch, session topic state unchanged.
  if (route.questionId) {
    const fetched = await fetchQuestion({
      questionId: route.questionId,
      excludeIds: servedIds,
    });
    if (fetched) {
      return {
        done: false,
        decision: route.decision,
        question: await toServed(
          fetched.question, true, session, modelQuestionsAnswered
        ),
      };
    }
    // Twin missing (Part 7.4): skip the probe, continue with CDM at same level.
    await prisma.assessmentSession.update({
      where: { sessionId: session.sessionId },
      data: { twinProbePending: false },
    });
    route = {
      decision: "twin_missing_continue",
      skillId: session.currentSkillId ?? undefined,
      grade: session.currentGrade ?? session.selectedGrade ?? 7,
      difficulty: session.currentDifficulty ?? "medium",
    };
  }

  if (route.advanceTopic) {
    return serveNextTopic(session, servedIds, route.decision, modelQuestionsAnswered);
  }

  const grade = clampGrade(route.grade ?? session.selectedGrade ?? 7);
  const difficulty = route.difficulty ?? "medium";
  const fetched = await fetchQuestion({
    skillId: route.skillId,
    grade,
    difficulty,
    excludeIds: servedIds,
    theta: session.currentTheta,
    seenBeforeIds,
  });

  if (!fetched) {
    // Skill exhausted at every band/grade → move to the next topic (Part 7.1).
    return serveNextTopic(
      session, servedIds, `${route.decision}_exhausted_next_topic`, modelQuestionsAnswered
    );
  }

  await syncSessionToServe(session, {
    skillId: route.skillId ?? fetched.question.primarySkillId ?? null,
    grade: fetched.question.gradeLevel ?? grade,
    difficulty: fetched.question.difficultyBand ?? difficulty,
  });

  return {
    done: false,
    decision: route.decision,
    question: await toServed(
      fetched.question, false, session, modelQuestionsAnswered + 1
    ),
  };
}

/** Advance to the next unvisited topic at the student's selected grade. */
async function serveNextTopic(
  session: AssessmentSession,
  servedIds: string[],
  decision: string,
  modelQuestionsAnswered = 0
): Promise<StepResult> {
  const grade = clampGrade(session.selectedGrade ?? 7);
  const visited = csvToList(session.visitedSkills);
  if (session.currentSkillId && !visited.includes(session.currentSkillId)) {
    visited.push(session.currentSkillId);
  }
  // Returning from remediation also retires the original topic.
  if (session.returnSkillId && !visited.includes(session.returnSkillId)) {
    visited.push(session.returnSkillId);
  }

  const seenBeforeIds = await seenInEarlierSessions(
    session.studentId,
    session.sessionId
  );
  let topic = await getNextTopic(grade, visited);
  while (topic) {
    const fetched = await fetchQuestion({
      skillId: topic.skillId,
      grade,
      difficulty: "medium",
      excludeIds: servedIds,
      theta: session.currentTheta,
      seenBeforeIds,
    });
    if (fetched) {
      await prisma.assessmentSession.update({
        where: { sessionId: session.sessionId },
        data: {
          visitedSkills: listToCsv(visited),
          currentSkillId: topic.skillId,
          currentGrade: grade,
          currentDifficulty: fetched.question.difficultyBand ?? "medium",
          bandsServed: fetched.question.difficultyBand ?? "medium",
          consecutiveCorrect: 0,
          consecutiveFailures: 0,
          returnSkillId: null,
          returnGrade: null,
          pendingConfirmation: false,
        },
      });
      return {
        done: false,
        decision,
        question: await toServed(
          fetched.question, false, session, modelQuestionsAnswered + 1
        ),
      };
    }
    visited.push(topic.skillId);
    topic = await getNextTopic(grade, visited);
  }

  // No topics remain → session complete (Part 7.2a).
  const fresh = (await prisma.assessmentSession.findUnique({
    where: { sessionId: session.sessionId },
  }))!;
  return endSession(fresh, "all_topics_visited");
}

/** Update current skill/grade/difficulty + band coverage when serving. */
async function syncSessionToServe(
  session: AssessmentSession,
  serve: { skillId: string | null; grade: number; difficulty: string }
) {
  const skillChanged = serve.skillId !== session.currentSkillId;
  const bands = skillChanged ? [] : csvToList(session.bandsServed);
  if (!bands.includes(serve.difficulty)) bands.push(serve.difficulty);

  await prisma.assessmentSession.update({
    where: { sessionId: session.sessionId },
    data: {
      currentSkillId: serve.skillId,
      currentGrade: serve.grade,
      currentDifficulty: serve.difficulty,
      bandsServed: listToCsv(bands),
      ...(skillChanged ? { consecutiveCorrect: 0 } : {}),
    },
  });
}

async function endSession(
  session: AssessmentSession,
  reason: string,
  skillId?: string,
  pMastery?: number,
  theta?: number
): Promise<StepResult> {
  await prisma.assessmentSession.update({
    where: { sessionId: session.sessionId },
    data: { status: "completed", terminationReason: reason, endedAt: new Date() },
  });
  await computeDimensionScores(session.sessionId);
  return {
    done: true,
    reason,
    decision: `session_end_${reason}`,
    ...(skillId && pMastery !== undefined
      ? { bkt: { skillId, pMastery } }
      : {}),
    ...(theta !== undefined ? { theta } : {}),
  };
}

/** Part 7.2c — every skill at the selected grade mastered (P(L) ≥ 0.95). */
async function allGradeSkillsMastered(
  session: AssessmentSession
): Promise<boolean> {
  const grade = session.selectedGrade ?? 7;
  const topics = await getTopicsForGrade(grade);
  if (topics.length === 0) return false;
  const states = await prisma.bktState.findMany({
    where: {
      studentId: session.studentId,
      skillId: { in: topics.map((t) => t.skillId) },
    },
  });
  if (states.length < topics.length) return false;
  return states.every((s) => s.pMastery >= MASTERY_THRESHOLD);
}

// ── Dimension scores (spec Part 8.3) ─────────────────────────────────────────

export async function computeDimensionScores(sessionId: string) {
  const responses = await prisma.response.findMany({
    where: { sessionId },
    include: { question: { include: { dimensions: true } } },
  });

  const dims = [
    "dimReading",
    "dimUnderstanding",
    "dimApplication",
    "dimCalculation",
    "dimRetention",
  ] as const;

  const scores: Record<string, number | null> = {};
  for (const dim of dims) {
    const relevant = responses.filter((r) => r.question.dimensions?.[dim]);
    if (relevant.length === 0) {
      scores[dim] = null;
      continue;
    }
    const correct = relevant.filter((r) => r.isCorrect).length;
    scores[dim] = Math.round((correct / relevant.length) * 1000) / 10;
  }

  await prisma.dimensionScore.upsert({
    where: { sessionId },
    create: {
      sessionId,
      dimReading: scores.dimReading,
      dimUnderstanding: scores.dimUnderstanding,
      dimApplication: scores.dimApplication,
      dimCalculation: scores.dimCalculation,
      dimRetention: scores.dimRetention,
    },
    update: {
      dimReading: scores.dimReading,
      dimUnderstanding: scores.dimUnderstanding,
      dimApplication: scores.dimApplication,
      dimCalculation: scores.dimCalculation,
      dimRetention: scores.dimRetention,
    },
  });
}

// ── DKT-lite propagation (Algorithm 4) ───────────────────────────────────────

async function propagateDkt(
  studentId: string,
  skillId: string,
  delta: number
) {
  if (Math.abs(delta) < 1e-6) return;
  // Children come from the cached knowledge graph (no query). Read all their
  // current states in one findMany, then fire the upserts concurrently instead
  // of a serial read+write per child.
  const childIds = (await allEdges())
    .filter((e) => e.parentSkillId === skillId)
    .map((e) => e.childSkillId);
  if (childIds.length === 0) return;

  const existing = await prisma.bktState.findMany({
    where: { studentId, skillId: { in: childIds } },
  });
  const byId = new Map(existing.map((s) => [s.skillId, s]));

  await Promise.all(
    childIds.map((childSkillId) => {
      const current = byId.get(childSkillId)?.pMastery ?? DEFAULT_BKT_PARAMS.pL0;
      const updated = clamp01(current + DKT_PROPAGATION_COEFFICIENT * delta);
      return prisma.bktState.upsert({
        where: { studentId_skillId: { studentId, skillId: childSkillId } },
        create: {
          studentId,
          skillId: childSkillId,
          pMastery: updated,
          attempts: 0,
          lastUpdated: new Date(),
        },
        update: { pMastery: updated, lastUpdated: new Date() },
      });
    })
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** IRT item params from whatever question fields are loaded (full row or the
 *  trimmed history projection). */
function itemParamsOf(q: {
  irtA: number | null;
  irtB: number | null;
  irtC: number | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
}) {
  if (q.irtA && q.irtB !== null && q.irtC !== null) {
    return { a: q.irtA, b: q.irtB, c: q.irtC };
  }
  return defaultItemParams(q.gradeLevel ?? 7, q.difficultyBand ?? "medium");
}

async function toServed(
  q: Question,
  isTwinProbe: boolean,
  session: AssessmentSession,
  questionNumber: number
): Promise<ServedQuestion> {
  const skill = q.primarySkillId ? await skillById(q.primarySkillId) : null;
  return {
    questionId: q.questionId,
    questionText: q.questionText,
    options: [
      { label: "A", text: q.optionA ?? "" },
      { label: "B", text: q.optionB ?? "" },
      { label: "C", text: q.optionC ?? "" },
      { label: "D", text: q.optionD ?? "" },
    ].filter((o) => o.text !== ""),
    skillId: q.primarySkillId,
    skillName: skill?.skillName ?? null,
    topicArea: skill?.topicArea ?? null,
    gradeLevel: q.gradeLevel,
    difficultyBand: q.difficultyBand,
    isTwinProbe,
    questionNumber,
    maxQuestions: session.maxQuestions,
  };
}
