// The 33-skill NCERT-aligned knowledge graph (Grades 5–10), spec Sheet 1.
// prerequisite_skill_ids defines the Knowledge Graph edges: traversal walks
// from Grade 10 topics down to Grade 5 root nodes.

export interface SkillDef {
  skill_id: string;
  skill_name: string;
  grade_level: string;
  topic_area: "Arithmetic" | "Algebra" | "Geometry" | "Statistics";
  difficulty_band: "easy" | "medium" | "hard";
  prerequisite_skill_ids: string;
  notes: string;
  /** short slug used inside question ids: ncrt_{grade}_{slug}_{nnnn} */
  slug: string;
}

export const SKILLS: SkillDef[] = [
  // ── Grade 5 (root nodes) ──
  { skill_id: "S_001", skill_name: "Whole Numbers & Place Value", grade_level: "5", topic_area: "Arithmetic", difficulty_band: "easy", prerequisite_skill_ids: "", notes: "NCERT topic: large_numbers_place_value (Class 5 Ch 1)", slug: "numbers" },
  { skill_id: "S_002", skill_name: "Basic Operations", grade_level: "5", topic_area: "Arithmetic", difficulty_band: "easy", prerequisite_skill_ids: "", notes: "NCERT topic: four_operations (Class 5 Ch 2)", slug: "operations" },
  { skill_id: "S_003", skill_name: "Factors & Multiples", grade_level: "5", topic_area: "Arithmetic", difficulty_band: "easy", prerequisite_skill_ids: "S_002", notes: "NCERT topic: factors_multiples (Class 5 Ch 6)", slug: "factors" },
  { skill_id: "S_004", skill_name: "Basic Fractions", grade_level: "5", topic_area: "Arithmetic", difficulty_band: "easy", prerequisite_skill_ids: "S_002", notes: "NCERT topic: parts_and_wholes (Class 5 Ch 4)", slug: "fractions" },
  { skill_id: "S_005", skill_name: "Shapes & Angles", grade_level: "5", topic_area: "Geometry", difficulty_band: "easy", prerequisite_skill_ids: "", notes: "NCERT topic: shapes_angles (Class 5 Ch 2)", slug: "shapes" },
  { skill_id: "S_006", skill_name: "Decimals", grade_level: "5", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_004", notes: "NCERT topic: tenths_hundredths (Class 5 Ch 10)", slug: "decimals" },

  // ── Grade 6 ──
  { skill_id: "S_007", skill_name: "Integers", grade_level: "6", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_002", notes: "NCERT topic: integers (Class 6 Ch 6)", slug: "integers" },
  { skill_id: "S_008", skill_name: "HCF & LCM", grade_level: "6", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_003", notes: "NCERT topic: playing_with_numbers (Class 6 Ch 3)", slug: "hcflcm" },
  { skill_id: "S_009", skill_name: "Fraction Operations", grade_level: "6", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_004", notes: "NCERT topic: fractions (Class 6 Ch 7)", slug: "fracops" },
  { skill_id: "S_010", skill_name: "Ratio & Proportion", grade_level: "6", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_009", notes: "NCERT topic: ratio_proportion (Class 6 Ch 12)", slug: "ratio" },
  { skill_id: "S_011", skill_name: "Introduction to Algebra", grade_level: "6", topic_area: "Algebra", difficulty_band: "medium", prerequisite_skill_ids: "S_007", notes: "NCERT topic: algebra_intro (Class 6 Ch 11)", slug: "algebra" },
  { skill_id: "S_012", skill_name: "Perimeter & Area", grade_level: "6", topic_area: "Geometry", difficulty_band: "medium", prerequisite_skill_ids: "S_005", notes: "NCERT topic: mensuration (Class 6 Ch 10)", slug: "perimarea" },

  // ── Grade 7 ──
  { skill_id: "S_013", skill_name: "Integer Operations", grade_level: "7", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_007", notes: "NCERT topic: integers (Class 7 Ch 1)", slug: "intops" },
  { skill_id: "S_014", skill_name: "Rational Numbers", grade_level: "7", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_009, S_007", notes: "NCERT topic: rational_numbers (Class 7 Ch 9)", slug: "rationals" },
  { skill_id: "S_015", skill_name: "Simple Equations", grade_level: "7", topic_area: "Algebra", difficulty_band: "medium", prerequisite_skill_ids: "S_011, S_013", notes: "NCERT topic: simple_equations (Class 7 Ch 4)", slug: "simpleeq" },
  { skill_id: "S_016", skill_name: "Exponents & Powers", grade_level: "7", topic_area: "Algebra", difficulty_band: "medium", prerequisite_skill_ids: "S_013", notes: "NCERT topic: exponents_powers (Class 7 Ch 13)", slug: "exponents" },
  { skill_id: "S_017", skill_name: "Percentage & Simple Interest", grade_level: "7", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_010", notes: "NCERT topic: comparing_quantities (Class 7 Ch 8)", slug: "percent" },
  { skill_id: "S_018", skill_name: "Triangles & Properties", grade_level: "7", topic_area: "Geometry", difficulty_band: "medium", prerequisite_skill_ids: "S_012", notes: "NCERT topic: triangle_properties (Class 7 Ch 6)", slug: "triangles" },

  // ── Grade 8 ──
  { skill_id: "S_019", skill_name: "Linear Equations (1 Var)", grade_level: "8", topic_area: "Algebra", difficulty_band: "medium", prerequisite_skill_ids: "S_015, S_014", notes: "NCERT topic: linear_equations_one_variable (Class 8 Ch 2)", slug: "lineq1" },
  { skill_id: "S_020", skill_name: "Algebraic Expressions & Identities", grade_level: "8", topic_area: "Algebra", difficulty_band: "medium", prerequisite_skill_ids: "S_015, S_016", notes: "NCERT topic: algebraic_expressions_identities (Class 8 Ch 9)", slug: "identities" },
  { skill_id: "S_021", skill_name: "Squares & Square Roots", grade_level: "8", topic_area: "Arithmetic", difficulty_band: "medium", prerequisite_skill_ids: "S_016", notes: "NCERT topic: squares_square_roots (Class 8 Ch 6)", slug: "squares" },
  { skill_id: "S_022", skill_name: "Mensuration", grade_level: "8", topic_area: "Geometry", difficulty_band: "medium", prerequisite_skill_ids: "S_012", notes: "NCERT topic: mensuration (Class 8 Ch 11)", slug: "mensuration" },
  { skill_id: "S_023", skill_name: "Data Handling", grade_level: "8", topic_area: "Statistics", difficulty_band: "easy", prerequisite_skill_ids: "S_002", notes: "NCERT topic: data_handling (Class 8 Ch 5)", slug: "data" },
  { skill_id: "S_024", skill_name: "Comparing Quantities (CI)", grade_level: "8", topic_area: "Arithmetic", difficulty_band: "hard", prerequisite_skill_ids: "S_017", notes: "NCERT topic: comparing_quantities (Class 8 Ch 8)", slug: "compint" },

  // ── Grade 9 ──
  { skill_id: "S_025", skill_name: "Polynomials", grade_level: "9", topic_area: "Algebra", difficulty_band: "hard", prerequisite_skill_ids: "S_020", notes: "NCERT topic: polynomials (Class 9 Ch 2)", slug: "polynomials" },
  { skill_id: "S_026", skill_name: "Coordinate Geometry", grade_level: "9", topic_area: "Geometry", difficulty_band: "medium", prerequisite_skill_ids: "S_019", notes: "NCERT topic: coordinate_geometry (Class 9 Ch 3)", slug: "coordgeo" },
  { skill_id: "S_027", skill_name: "Linear Equations (2 Var)", grade_level: "9", topic_area: "Algebra", difficulty_band: "hard", prerequisite_skill_ids: "S_019", notes: "NCERT topic: linear_equations_two_variables (Class 9 Ch 4)", slug: "lineq2" },
  { skill_id: "S_028", skill_name: "Number Systems (Real Numbers)", grade_level: "9", topic_area: "Arithmetic", difficulty_band: "hard", prerequisite_skill_ids: "S_014, S_021", notes: "NCERT topic: number_systems (Class 9 Ch 1)", slug: "realnums" },
  { skill_id: "S_029", skill_name: "Statistics (Mean/Median/Mode)", grade_level: "9", topic_area: "Statistics", difficulty_band: "medium", prerequisite_skill_ids: "S_023", notes: "NCERT topic: statistics (Class 9 Ch 14)", slug: "statistics" },

  // ── Grade 10 ──
  { skill_id: "S_030", skill_name: "Quadratic Equations", grade_level: "10", topic_area: "Algebra", difficulty_band: "hard", prerequisite_skill_ids: "S_025", notes: "NCERT topic: quadratic_equations (Class 10 Ch 4)", slug: "quadratic" },
  { skill_id: "S_031", skill_name: "Arithmetic Progression", grade_level: "10", topic_area: "Algebra", difficulty_band: "hard", prerequisite_skill_ids: "S_019", notes: "NCERT topic: arithmetic_progression (Class 10 Ch 5)", slug: "ap" },
  { skill_id: "S_032", skill_name: "Introduction to Trigonometry", grade_level: "10", topic_area: "Geometry", difficulty_band: "hard", prerequisite_skill_ids: "S_018, S_021", notes: "NCERT topic: trigonometry_intro (Class 10 Ch 8)", slug: "trig" },
  { skill_id: "S_033", skill_name: "Probability", grade_level: "10", topic_area: "Statistics", difficulty_band: "medium", prerequisite_skill_ids: "S_029", notes: "NCERT topic: probability (Class 10 Ch 15)", slug: "probability" },
];

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.skill_id, s]));

export function baseGrade(s: SkillDef): number {
  return parseInt(s.grade_level, 10);
}

export function firstPrereq(s: SkillDef): string | null {
  const list = s.prerequisite_skill_ids
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return list[0] ?? null;
}
