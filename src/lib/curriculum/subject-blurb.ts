// Short, high-level, non-copyrighted overview of each subject — for display in
// the Syllabus. Client-safe (no server imports).
export const SUBJECT_BLURB: Record<string, string> = {
  Mathematics: "Number, algebra, geometry, mensuration, data & probability.",
  Science: "Physics, chemistry and biology foundations through observation and experiment.",
  "Social Science": "History, geography, civics and economics of India and the world.",
  English: "Reading, prose, poetry and writing skills.",
  Hindi: "Gadya, padya, vyakaran and lekhan.",
  Sanskrit: "Shabdroop, dhaturoop, vyakaran and simple prose.",
};

export const subjectBlurb = (name: string): string | null => SUBJECT_BLURB[name] ?? null;
