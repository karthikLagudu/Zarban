// Content health & coverage analysis for the Content Management Portal.
// Pure functions over plain records so they are unit-testable without a DB.

export interface SkillRec {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
  topicArea: string | null;
  prerequisiteSkillIds: string | null;
}

export interface QuestionRec {
  questionId: string;
  primarySkillId: string | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
  wordProblemFlag: boolean;
  equationTwinId: string | null;
  correctOption: string | null;
  trapCount: number; // number of answer traps attached
  hasDimensions: boolean;
}

export type IssueSeverity = "error" | "warning";

export interface ContentIssue {
  severity: IssueSeverity;
  kind: string;
  message: string;
  ref: string; // skillId or questionId the issue is about
}

export interface CoverageCell {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
  easy: number;
  medium: number;
  hard: number;
  total: number;
}

export interface ContentHealth {
  totals: {
    skills: number;
    questions: number;
    wordProblems: number;
    answerTraps: number;
    rootSkills: number; // skills with no prerequisites
    orphanSkills: number; // skills with no questions
  };
  issues: ContentIssue[];
  issueCounts: { errors: number; warnings: number };
  coverage: CoverageCell[];
  byGrade: { grade: number; questions: number }[];
  byTopic: { topic: string; questions: number }[];
}

function parseList(csv: string | null): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function analyzeContent(
  skills: SkillRec[],
  questions: QuestionRec[]
): ContentHealth {
  const skillIds = new Set(skills.map((s) => s.skillId));
  const questionIds = new Set(questions.map((q) => q.questionId));
  const questionsBySkill = new Map<string, QuestionRec[]>();
  for (const q of questions) {
    if (!q.primarySkillId) continue;
    const arr = questionsBySkill.get(q.primarySkillId) ?? [];
    arr.push(q);
    questionsBySkill.set(q.primarySkillId, arr);
  }

  const issues: ContentIssue[] = [];

  // ── Skill-level checks ──────────────────────────────────────────────────────
  let rootSkills = 0;
  let orphanSkills = 0;
  for (const s of skills) {
    const prereqs = parseList(s.prerequisiteSkillIds);
    if (prereqs.length === 0) rootSkills += 1;
    for (const p of prereqs) {
      if (!skillIds.has(p)) {
        issues.push({
          severity: "error",
          kind: "orphan-prerequisite",
          message: `${s.skillId} lists prerequisite "${p}" which does not exist`,
          ref: s.skillId,
        });
      }
    }
    const qs = questionsBySkill.get(s.skillId) ?? [];
    if (qs.length === 0) {
      orphanSkills += 1;
      issues.push({
        severity: "warning",
        kind: "skill-no-questions",
        message: `${s.skillName} (${s.skillId}) has no questions — it can never be assessed`,
        ref: s.skillId,
      });
    } else {
      // Each skill should offer all three difficulty bands for CAT to work.
      const bands = new Set(qs.map((q) => q.difficultyBand));
      for (const band of ["easy", "medium", "hard"]) {
        if (!bands.has(band)) {
          issues.push({
            severity: "warning",
            kind: "missing-band",
            message: `${s.skillName} (${s.skillId}) has no "${band}" questions — difficulty adaptation is limited`,
            ref: s.skillId,
          });
        }
      }
    }
  }

  // ── Question-level checks ───────────────────────────────────────────────────
  for (const q of questions) {
    if (!q.primarySkillId || !skillIds.has(q.primarySkillId)) {
      issues.push({
        severity: "error",
        kind: "question-bad-skill",
        message: `${q.questionId} has a missing or unknown primary skill`,
        ref: q.questionId,
      });
    }
    if (!q.correctOption) {
      issues.push({
        severity: "error",
        kind: "question-no-answer",
        message: `${q.questionId} has no correct option set`,
        ref: q.questionId,
      });
    }
    if (q.trapCount === 0) {
      issues.push({
        severity: "warning",
        kind: "question-no-traps",
        message: `${q.questionId} has no answer traps — wrong answers can't be diagnosed`,
        ref: q.questionId,
      });
    }
    if (!q.hasDimensions) {
      issues.push({
        severity: "warning",
        kind: "question-no-dimensions",
        message: `${q.questionId} has no learning-dimension tags`,
        ref: q.questionId,
      });
    }
    if (q.wordProblemFlag) {
      if (!q.equationTwinId) {
        issues.push({
          severity: "warning",
          kind: "word-problem-no-twin",
          message: `${q.questionId} is a word problem with no equation twin — the Twin diagnostic is skipped`,
          ref: q.questionId,
        });
      } else if (!questionIds.has(q.equationTwinId)) {
        issues.push({
          severity: "error",
          kind: "twin-missing",
          message: `${q.questionId} points to equation twin "${q.equationTwinId}" which does not exist`,
          ref: q.questionId,
        });
      }
    }
  }

  // ── Coverage grid (per skill × difficulty band) ─────────────────────────────
  const coverage: CoverageCell[] = skills
    .map((s) => {
      const qs = questionsBySkill.get(s.skillId) ?? [];
      const easy = qs.filter((q) => q.difficultyBand === "easy").length;
      const medium = qs.filter((q) => q.difficultyBand === "medium").length;
      const hard = qs.filter((q) => q.difficultyBand === "hard").length;
      return {
        skillId: s.skillId,
        skillName: s.skillName,
        gradeLevel: s.gradeLevel,
        easy,
        medium,
        hard,
        total: qs.length,
      };
    })
    .sort((a, b) => a.total - b.total);

  // ── Distributions ───────────────────────────────────────────────────────────
  const gradeMap = new Map<number, number>();
  for (const q of questions) {
    if (q.gradeLevel == null) continue;
    gradeMap.set(q.gradeLevel, (gradeMap.get(q.gradeLevel) ?? 0) + 1);
  }
  const byGrade = [...gradeMap.entries()]
    .map(([grade, questions]) => ({ grade, questions }))
    .sort((a, b) => a.grade - b.grade);

  const topicMap = new Map<string, number>();
  const skillTopic = new Map(skills.map((s) => [s.skillId, s.topicArea ?? "General"]));
  for (const q of questions) {
    const topic = q.primarySkillId ? (skillTopic.get(q.primarySkillId) ?? "General") : "General";
    topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
  }
  const byTopic = [...topicMap.entries()]
    .map(([topic, questions]) => ({ topic, questions }))
    .sort((a, b) => b.questions - a.questions);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;

  return {
    totals: {
      skills: skills.length,
      questions: questions.length,
      wordProblems: questions.filter((q) => q.wordProblemFlag).length,
      answerTraps: questions.reduce((n, q) => n + q.trapCount, 0),
      rootSkills,
      orphanSkills,
    },
    issues: issues.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1
    ),
    issueCounts: { errors, warnings },
    coverage,
    byGrade,
    byTopic,
  };
}
