// PART 8 — Report Generation Logic.
// Aggregates a completed (or in-progress) session into the full diagnostic
// report object consumed by both the student report page and the admin view.

import { prisma } from "@/lib/db";
import { MASTERY_THRESHOLD } from "./types";
import { skillBaseGrade } from "./topics";
import { computeGradeEquivalent } from "./grade-equivalent";

export interface SkillMasteryRow {
  skillId: string;
  skillName: string;
  topicArea: string | null;
  gradeLevel: string | null;
  pMastery: number;
  attempts: number;
  status: "Mastered" | "Developing" | "Gap";
}

export interface QuestionAnalysisRow {
  order: number;
  questionId: string;
  questionText: string;
  options: { label: string; text: string }[];
  selected: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  twinProbe: boolean;
  skillName: string | null;
  topicArea: string | null;
  grade: number | null;
  difficulty: string | null;
  primaryDimension: string | null;
  timeMs: number | null;
  /** how this answer's time compares with the student's own average */
  pace: "quick" | "steady" | "slow" | null;
  /** engine state after this answer — powers the detailed-analysis charts */
  thetaAfter: number | null;
  pMasteryAfter: number | null;
  trapType: string | null;
  misconception: string | null;
  misconceptionDetail: string | null;
  /** what to practise next, from the CDM trap's remedial routing */
  practiceNext: { skillName: string; grade: number | null } | null;
}

export interface SkillBreakdownRow {
  skillId: string;
  skillName: string;
  topicArea: string | null;
  gradeLevel: string | null;
  attempts: number;
  correct: number;
  accuracy: number; // %
  avgMs: number | null;
  finalMastery: number | null; // final P(L), 0..1
}

export interface DiagnosticReport {
  sessionId: string;
  student: { studentId: string; name: string | null; school: string | null };
  selectedGrade: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  terminationReason: string | null;
  durationSeconds: number | null;
  timing: {
    avgMs: number | null;
    fastestMs: number | null;
    slowestMs: number | null;
  };
  performanceByBand: {
    band: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  questionAnalysis: QuestionAnalysisRow[];
  /** Per-skill aggregates for the detailed-analysis page. */
  skillBreakdown: SkillBreakdownRow[];
  /** Per-topic-area accuracy for the detailed-analysis page. */
  topicBreakdown: {
    topic: string;
    attempts: number;
    correct: number;
    accuracy: number;
  }[];
  /** Always-present grade equivalent. "demonstrated" = met the ≥70% over ≥3
   *  questions rule; otherwise estimated from the IRT ability θ. */
  gradeEquivalent: {
    label: string; // "Grade 8" | "≈ Grade 6" | "Below Grade 5" | "Grade 10+"
    short: string; // "G8" | "≈G6" | "<G5" | "G10+"
    grade: number | null;
    basis: "demonstrated" | "estimated" | "below_floor" | "above_ceiling";
  };
  totals: {
    questions: number;
    modelQuestions: number;
    twinProbes: number;
    correct: number;
    accuracy: number; // %
  };
  theta: number;
  gradeEquivalentLevel: number | null;
  gradeEquivalentByTopic: { topicArea: string; grade: number }[];
  skillMastery: SkillMasteryRow[];
  errorTaxonomy: { trapType: string; count: number; percentage: number }[];
  dimensionScores: {
    dimension: string;
    score: number | null;
  }[];
  readingVsMath: {
    readingErrors: number;
    conceptErrors: number;
    wordProblemFailures: number;
    readingGapDetected: boolean;
  };
  foundationalGapChains: string[][]; // each chain: ["Grade 9 Linear Equations", ...]
  reviewFlags: { skillId: string; skillName: string }[];
  narrative: string[];
  focusAreas: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    pMastery: number;
    ncertReference: string | null;
  }[];
}

const DIMENSION_LABELS: Record<string, string> = {
  dimReading: "Reading",
  dimUnderstanding: "Understanding",
  dimApplication: "Application",
  dimCalculation: "Calculation",
  dimRetention: "Retention",
};

export async function generateReport(sessionId: string): Promise<DiagnosticReport> {
  const session = await prisma.assessmentSession.findUnique({
    where: { sessionId },
    include: {
      student: true,
      responses: {
        include: { question: { include: { dimensions: true } } },
        orderBy: { responseId: "asc" },
      },
      dimensionScore: true,
      traversals: { orderBy: { id: "asc" } },
      reviewFlags: true,
    },
  });
  if (!session) throw new Error("Session not found");

  const skills = await prisma.skill.findMany();
  const skillMap = new Map(skills.map((s) => [s.skillId, s]));

  const responses = session.responses;
  const modelResponses = responses.filter((r) => !r.twinProbe);
  // Score over model questions only — twin probes are diagnostic, not scored
  // (spec Part 2.5: "the twin question should not count as a separate model
  // question — it is a diagnostic probe only").
  const correct = modelResponses.filter((r) => r.isCorrect).length;

  // 1. Skill Mastery Map — every skill touched this session.
  const touchedSkillIds = new Set<string>();
  for (const r of responses) {
    if (r.question.primarySkillId) touchedSkillIds.add(r.question.primarySkillId);
    if (r.servedSkillId) touchedSkillIds.add(r.servedSkillId);
  }
  const bktRows = await prisma.bktState.findMany({
    where: {
      studentId: session.studentId,
      skillId: { in: [...touchedSkillIds] },
    },
  });
  const skillMastery: SkillMasteryRow[] = bktRows
    .map((b) => {
      const s = skillMap.get(b.skillId);
      return {
        skillId: b.skillId,
        skillName: s?.skillName ?? b.skillId,
        topicArea: s?.topicArea ?? null,
        gradeLevel: s?.gradeLevel ?? null,
        pMastery: Math.round(b.pMastery * 1000) / 1000,
        attempts: b.attempts,
        status:
          b.pMastery >= MASTERY_THRESHOLD
            ? ("Mastered" as const)
            : b.pMastery >= 0.5
              ? ("Developing" as const)
              : ("Gap" as const),
      };
    })
    .sort((a, b) => a.pMastery - b.pMastery);

  // 2. Error Taxonomy Summary.
  const trapCounts = new Map<string, number>();
  for (const r of responses) {
    if (r.trapType) trapCounts.set(r.trapType, (trapCounts.get(r.trapType) ?? 0) + 1);
  }
  const totalTraps = [...trapCounts.values()].reduce((a, b) => a + b, 0);
  const errorTaxonomy = [...trapCounts.entries()]
    .map(([trapType, count]) => ({
      trapType,
      count,
      percentage: totalTraps ? Math.round((count / totalTraps) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 3. Dimension Scores (recompute if the session is still live).
  const ds = session.dimensionScore;
  const dimensionScores = (
    [
      ["dimReading", ds?.dimReading],
      ["dimUnderstanding", ds?.dimUnderstanding],
      ["dimApplication", ds?.dimApplication],
      ["dimCalculation", ds?.dimCalculation],
      ["dimRetention", ds?.dimRetention],
    ] as [string, number | null | undefined][]
  ).map(([key, val]) => {
    if (val === undefined || val === null) {
      // live computation fallback
      const dimKey = key as
        | "dimReading"
        | "dimUnderstanding"
        | "dimApplication"
        | "dimCalculation"
        | "dimRetention";
      const relevant = responses.filter((r) => r.question.dimensions?.[dimKey]);
      const c = relevant.filter((r) => r.isCorrect).length;
      return {
        dimension: DIMENSION_LABELS[key],
        score: relevant.length
          ? Math.round((c / relevant.length) * 1000) / 10
          : null,
      };
    }
    return { dimension: DIMENSION_LABELS[key], score: val };
  });

  // 4. Grade-Equivalent Level: highest grade with ≥70% correct over ≥3 questions.
  const byGrade = new Map<number, { total: number; correct: number }>();
  for (const r of modelResponses) {
    const g = r.servedGrade ?? r.question.gradeLevel;
    if (!g) continue;
    const agg = byGrade.get(g) ?? { total: 0, correct: 0 };
    agg.total += 1;
    if (r.isCorrect) agg.correct += 1;
    byGrade.set(g, agg);
  }
  let gradeEquivalentLevel: number | null = null;
  for (const [g, agg] of byGrade) {
    if (agg.total >= 3 && agg.correct / agg.total >= 0.7) {
      gradeEquivalentLevel = Math.max(gradeEquivalentLevel ?? 0, g);
    }
  }
  // Per-topic grade equivalence (used by the hero line "Grade 7 level in Algebra").
  const byTopicGrade = new Map<string, Map<number, { total: number; correct: number }>>();
  for (const r of modelResponses) {
    const skill = r.question.primarySkillId
      ? skillMap.get(r.question.primarySkillId)
      : null;
    const topic = skill?.topicArea ?? "General";
    const g = r.servedGrade ?? r.question.gradeLevel;
    if (!g) continue;
    if (!byTopicGrade.has(topic)) byTopicGrade.set(topic, new Map());
    const m = byTopicGrade.get(topic)!;
    const agg = m.get(g) ?? { total: 0, correct: 0 };
    agg.total += 1;
    if (r.isCorrect) agg.correct += 1;
    m.set(g, agg);
  }
  const gradeEquivalentByTopic: { topicArea: string; grade: number }[] = [];
  for (const [topic, m] of byTopicGrade) {
    let best: number | null = null;
    for (const [g, agg] of m) {
      if (agg.total >= 2 && agg.correct / agg.total >= 0.7) {
        best = Math.max(best ?? 0, g);
      }
    }
    if (best !== null) gradeEquivalentByTopic.push({ topicArea: topic, grade: best });
  }

  // 5. Reading vs Math gap diagnosis.
  const wordProblemFailures = responses.filter(
    (r) => r.question.wordProblemFlag && !r.twinProbe && r.isCorrect === false
  ).length;
  const readingErrors = responses.filter((r) => r.trapType === "Reading_Error").length;
  const conceptErrors = responses.filter((r) => r.trapType === "Concept_Error").length;
  const readingGapDetected =
    wordProblemFailures > 0 && readingErrors / wordProblemFailures > 0.3;

  // 6. Foundational Gap Chains from traversal events.
  const chains: string[][] = [];
  let currentChain: string[] = [];
  let lastTo: string | null = null;
  for (const t of session.traversals) {
    const fromLabel = `Grade ${t.fromGrade ?? "?"} ${skillMap.get(t.fromSkillId)?.skillName ?? t.fromSkillId}`;
    const toLabel = `Grade ${t.toGrade ?? "?"} ${skillMap.get(t.toSkillId)?.skillName ?? t.toSkillId}`;
    if (lastTo === t.fromSkillId && currentChain.length > 0) {
      currentChain.push(toLabel); // continuation of the same descent
    } else {
      if (currentChain.length > 0) chains.push(currentChain);
      currentChain = [fromLabel, toLabel];
    }
    lastTo = t.toSkillId;
  }
  if (currentChain.length > 0) chains.push(currentChain);

  // Grade equivalent grounded in the student's observed per-grade accuracy
  // (not an abstract θ, which saturates to ±4 regardless of item difficulty
  // and can contradict the scores shown elsewhere in the report).
  const gradeEquivalent = computeGradeEquivalent(
    byGrade,
    gradeEquivalentLevel,
    session.selectedGrade ?? 7
  );
  const narrativeGradeLabel =
    gradeEquivalent.basis === "demonstrated"
      ? null
      : gradeEquivalent.basis === "below_floor"
        ? "below Grade 5"
        : gradeEquivalent.basis === "above_ceiling"
          ? "at Grade 10 and beyond"
          : `at about Grade ${gradeEquivalent.grade}`;

  // 7. Personalised narrative (templated).
  const narrative = buildNarrative({
    fallbackGradeLabel: narrativeGradeLabel,
    accuracy: modelResponses.length
      ? (modelResponses.filter((r) => r.isCorrect).length / modelResponses.length) * 100
      : 0,
    dimensionScores,
    errorTaxonomy,
    readingGapDetected,
    readingErrors,
    wordProblemFailures,
    chains,
    skillMastery,
    gradeEquivalentLevel,
    selectedGrade: session.selectedGrade ?? 7,
  });

  // Focus areas: 3 weakest non-mastered skills, NCERT reference from notes.
  const focusAreas = skillMastery
    .filter((s) => s.status !== "Mastered")
    .slice(0, 3)
    .map((s) => {
      const skill = skillMap.get(s.skillId);
      const note = skill?.notes ?? null;
      return {
        skillId: s.skillId,
        skillName: s.skillName,
        gradeLevel: s.gradeLevel,
        pMastery: s.pMastery,
        ncertReference: note,
      };
    });

  // Question-by-question analysis with misconception explanations.
  const trapRows = await prisma.answerTrap.findMany({
    where: { questionId: { in: responses.map((r) => r.questionId) } },
  });
  const trapFor = (questionId: string, option: string | null) =>
    option
      ? (trapRows.find(
          (t) => t.questionId === questionId && t.optionLabel === option
        ) ?? null)
      : null;
  const validTimes = responses
    .map((r) => r.responseTimeMs)
    .filter((t): t is number => t !== null && t > 0);
  const avgTime = validTimes.length
    ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
    : null;

  const questionAnalysis: QuestionAnalysisRow[] = responses.map((r, i) => {
    const q = r.question;
    const trap = r.isCorrect ? null : trapFor(r.questionId, r.selectedOption);
    const skill = q.primarySkillId ? skillMap.get(q.primarySkillId) : null;
    // "Practice next" from the trap's remedial routing (mistakes only).
    const remedialSkill =
      trap?.remedialSkillId && trap.remedialSkillId !== q.primarySkillId
        ? skillMap.get(trap.remedialSkillId)
        : null;
    const practiceNext = !r.isCorrect
      ? remedialSkill
        ? { skillName: remedialSkill.skillName, grade: trap?.remedialGrade ?? null }
        : skill
          ? { skillName: skill.skillName, grade: r.servedGrade ?? q.gradeLevel }
          : null
      : null;
    const t = r.responseTimeMs;
    const pace: QuestionAnalysisRow["pace"] =
      t === null || t <= 0 || avgTime === null
        ? null
        : t < avgTime * 0.6
          ? "quick"
          : t > avgTime * 1.6
            ? "slow"
            : "steady";
    return {
      order: i + 1,
      questionId: r.questionId,
      questionText: q.questionText,
      options: [
        { label: "A", text: q.optionA ?? "" },
        { label: "B", text: q.optionB ?? "" },
        { label: "C", text: q.optionC ?? "" },
        { label: "D", text: q.optionD ?? "" },
      ].filter((o) => o.text !== ""),
      selected: r.selectedOption,
      correctOption: q.correctOption,
      isCorrect: r.isCorrect === true,
      twinProbe: r.twinProbe,
      skillName: skill?.skillName ?? null,
      topicArea: skill?.topicArea ?? null,
      grade: r.servedGrade ?? q.gradeLevel,
      difficulty: r.servedDifficulty ?? q.difficultyBand,
      primaryDimension: q.dimensions?.primaryDimension ?? null,
      timeMs: t,
      pace,
      thetaAfter: r.thetaAfter,
      pMasteryAfter: r.pMasteryAfter,
      trapType: r.trapType ?? trap?.trapType ?? null,
      misconception: r.misconception ?? trap?.misconception ?? null,
      misconceptionDetail: trap?.misconceptionDetail ?? null,
      practiceNext,
    };
  });

  // Per-skill and per-topic aggregates (detailed-analysis page).
  const finalPL = new Map(bktRows.map((b) => [b.skillId, b.pMastery]));
  const skillAgg = new Map<
    string,
    { attempts: number; correct: number; timeSum: number; timeCount: number }
  >();
  for (const r of modelResponses) {
    const sid = r.question.primarySkillId ?? r.servedSkillId;
    if (!sid) continue;
    const agg =
      skillAgg.get(sid) ?? { attempts: 0, correct: 0, timeSum: 0, timeCount: 0 };
    agg.attempts += 1;
    if (r.isCorrect) agg.correct += 1;
    if (r.responseTimeMs && r.responseTimeMs > 0) {
      agg.timeSum += r.responseTimeMs;
      agg.timeCount += 1;
    }
    skillAgg.set(sid, agg);
  }
  const skillBreakdown: SkillBreakdownRow[] = [...skillAgg.entries()]
    .map(([sid, agg]) => {
      const sk = skillMap.get(sid);
      return {
        skillId: sid,
        skillName: sk?.skillName ?? sid,
        topicArea: sk?.topicArea ?? null,
        gradeLevel: sk?.gradeLevel ?? null,
        attempts: agg.attempts,
        correct: agg.correct,
        accuracy: Math.round((agg.correct / agg.attempts) * 1000) / 10,
        avgMs: agg.timeCount ? Math.round(agg.timeSum / agg.timeCount) : null,
        finalMastery: finalPL.get(sid) ?? null,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  const topicAgg = new Map<string, { attempts: number; correct: number }>();
  for (const r of modelResponses) {
    const sk = r.question.primarySkillId
      ? skillMap.get(r.question.primarySkillId)
      : null;
    const topic = sk?.topicArea ?? "General";
    const agg = topicAgg.get(topic) ?? { attempts: 0, correct: 0 };
    agg.attempts += 1;
    if (r.isCorrect) agg.correct += 1;
    topicAgg.set(topic, agg);
  }
  const topicBreakdown = [...topicAgg.entries()]
    .map(([topic, agg]) => ({
      topic,
      attempts: agg.attempts,
      correct: agg.correct,
      accuracy: Math.round((agg.correct / agg.attempts) * 1000) / 10,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Accuracy by difficulty band.
  const bandAgg = new Map<string, { total: number; correct: number }>();
  for (const r of modelResponses) {
    const band = r.servedDifficulty ?? r.question.difficultyBand ?? "medium";
    const agg = bandAgg.get(band) ?? { total: 0, correct: 0 };
    agg.total += 1;
    if (r.isCorrect) agg.correct += 1;
    bandAgg.set(band, agg);
  }
  const performanceByBand = ["easy", "medium", "hard"]
    .filter((b) => bandAgg.has(b))
    .map((band) => {
      const agg = bandAgg.get(band)!;
      return {
        band,
        total: agg.total,
        correct: agg.correct,
        accuracy: Math.round((agg.correct / agg.total) * 1000) / 10,
      };
    });

  // Timing.
  const times = responses
    .map((r) => r.responseTimeMs)
    .filter((t): t is number => t !== null && t > 0);
  const timing = {
    avgMs: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null,
    fastestMs: times.length ? Math.min(...times) : null,
    slowestMs: times.length ? Math.max(...times) : null,
  };
  const durationSeconds = session.endedAt
    ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
    : null;

  const lastDecision = responses.at(-1)?.engineDecision ?? null;
  return {
    durationSeconds,
    timing,
    performanceByBand,
    questionAnalysis,
    skillBreakdown,
    topicBreakdown,
    gradeEquivalent,
    sessionId,
    student: {
      studentId: session.student.studentId,
      name: session.student.name,
      school: session.student.school,
    },
    selectedGrade: session.selectedGrade ?? 7,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    status: session.status,
    terminationReason:
      session.terminationReason ??
      (session.status === "completed" && lastDecision?.startsWith("session_end_")
        ? lastDecision.replace("session_end_", "")
        : null),
    totals: {
      questions: responses.length,
      modelQuestions: modelResponses.length,
      twinProbes: responses.length - modelResponses.length,
      correct,
      accuracy: modelResponses.length
        ? Math.round((correct / modelResponses.length) * 1000) / 10
        : 0,
    },
    theta: Math.round(session.currentTheta * 100) / 100,
    gradeEquivalentLevel,
    gradeEquivalentByTopic,
    skillMastery,
    errorTaxonomy,
    dimensionScores,
    readingVsMath: {
      readingErrors,
      conceptErrors,
      wordProblemFailures,
      readingGapDetected,
    },
    foundationalGapChains: chains,
    reviewFlags: session.reviewFlags.map((f) => ({
      skillId: f.skillId,
      skillName: skillMap.get(f.skillId)?.skillName ?? f.skillId,
    })),
    narrative,
    focusAreas,
  };
}

// ── Narrative templating (Part 8.7) ─────────────────────────────────────────

function buildNarrative(input: {
  fallbackGradeLabel: string | null;
  accuracy: number;
  dimensionScores: { dimension: string; score: number | null }[];
  errorTaxonomy: { trapType: string; count: number; percentage: number }[];
  readingGapDetected: boolean;
  readingErrors: number;
  wordProblemFailures: number;
  chains: string[][];
  skillMastery: SkillMasteryRow[];
  gradeEquivalentLevel: number | null;
  selectedGrade: number;
}): string[] {
  const out: string[] = [];
  const dims = new Map(
    input.dimensionScores.filter((d) => d.score !== null).map((d) => [d.dimension, d.score as number])
  );

  // Performance profile sentence.
  const acc = Math.round(input.accuracy);
  if (input.gradeEquivalentLevel !== null) {
    if (input.gradeEquivalentLevel >= input.selectedGrade) {
      out.push(
        `You answered ${acc}% of questions correctly and are performing at your grade level (Grade ${input.gradeEquivalentLevel}).`
      );
    } else {
      out.push(
        `You answered ${acc}% of questions correctly and are currently performing at a Grade ${input.gradeEquivalentLevel} level against a Grade ${input.selectedGrade} syllabus.`
      );
    }
  } else if (input.fallbackGradeLabel) {
    out.push(
      `You answered ${acc}% of questions correctly, which places you ${input.fallbackGradeLabel} against a Grade ${input.selectedGrade} syllabus.`
    );
  } else {
    out.push(
      `You answered ${acc}% of questions correctly in this diagnostic session.`
    );
  }

  // Near-chance caveat: a 4-option MCQ scores ~25% by pure guessing, so a very
  // low score gives no reliable grade signal — say so rather than over-claim.
  if (acc > 0 && acc <= 35) {
    out.push(
      `This score is close to what random guessing would produce, so the grade estimate is low-confidence — a calmer retake will give a clearer picture.`
    );
  }

  // Strong vs weak dimension.
  const calc = dims.get("Calculation");
  const reading = dims.get("Reading");
  if (calc !== undefined && reading !== undefined && calc - reading >= 25) {
    out.push(
      `You have strong calculation skills (${Math.round(calc)}%) but struggle to decode word problems (${Math.round(reading)}%). This is a reading comprehension gap, not a math gap.`
    );
  } else {
    const sorted = [...dims.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const [bestDim, bestScore] = sorted[0];
      const [worstDim, worstScore] = sorted[sorted.length - 1];
      if (bestScore - worstScore >= 15) {
        out.push(
          `Your strongest area is ${bestDim} (${Math.round(bestScore)}%), while ${worstDim} (${Math.round(worstScore)}%) needs the most attention.`
        );
      }
    }
  }

  // Primary error type.
  const topError = input.errorTaxonomy.filter((e) => e.trapType !== "Reading_Error")[0];
  if (topError && topError.count > 1) {
    const label = topError.trapType.replace(/_/g, " ");
    out.push(
      `Your most common error type was ${label} (${topError.percentage}% of all errors), which tells us where to focus practice.`
    );
  }

  // Root foundational gap from the deepest chain.
  const deepest = input.chains.sort((a, b) => b.length - a.length)[0];
  if (deepest && deepest.length >= 2) {
    const root = deepest[deepest.length - 1];
    const origin = deepest[0];
    out.push(
      `Your errors in ${origin.replace(/^Grade \d+ /, "")} trace back to ${root}. Strengthening that foundation will unlock the higher-grade topics.`
    );
  } else {
    const weakest = input.skillMastery[0];
    if (weakest && weakest.status === "Gap") {
      out.push(
        `The skill needing the most work is ${weakest.skillName} (mastery ${Math.round(weakest.pMastery * 100)}%).`
      );
    }
  }

  // Reading gap notice.
  if (input.readingGapDetected) {
    out.push(
      `You solved the equation versions of word problems you missed — strong in Math, but English word problems are slowing you down. Practise translating words into equations.`
    );
  }

  return out.slice(0, 5);
}
