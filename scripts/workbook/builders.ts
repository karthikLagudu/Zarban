// Parametric question builders. Every question's correct answer is computed,
// and every distractor encodes a real, classified misconception (trap_type)
// so the CDM has meaningful diagnostics to work with.

import { firstPrereq, SKILL_BY_ID, type SkillDef } from "./skills";

export type Band = "easy" | "medium" | "hard";

export interface DistractorSpec {
  text: string;
  trap_type:
    | "Calculation_Error"
    | "Concept_Error"
    | "Sign_Error"
    | "Reading_Error"
    | "Procedural_Error"
    | "Careless_Slip";
  misconception: string;
  detail: string;
}

export interface QuestionSpec {
  stem: string;
  correct: string;
  distractors: DistractorSpec[];
  isWordProblem?: boolean;
  twin?: { stem: string; correct: string; distractors: DistractorSpec[] };
  secondarySkills?: string[];
  primaryDimension: "Reading" | "Understanding" | "Application" | "Calculation" | "Retention";
  dims: {
    reading?: boolean;
    understanding?: boolean;
    application?: boolean;
    calculation?: boolean;
    retention?: boolean;
  };
}

// Deterministic PRNG so the workbook is reproducible run-to-run.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

const int = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, arr: T[]) => arr[Math.floor(rng() * arr.length)];

// Distractor factories -------------------------------------------------------

const slip = (v: string | number): DistractorSpec => ({
  text: String(v),
  trap_type: "Careless_Slip",
  misconception: "Arithmetic Slip",
  detail: "Off-by-a-step slip — the method is right but one small step was rushed.",
});
const calc = (v: string | number, detail = "Mechanical execution error while computing the result."): DistractorSpec => ({
  text: String(v),
  trap_type: "Calculation_Error",
  misconception: "Calculation Mistake",
  detail,
});
const concept = (v: string | number, label: string, detail: string): DistractorSpec => ({
  text: String(v),
  trap_type: "Concept_Error",
  misconception: label,
  detail,
});
const sign = (v: string | number, detail = "Dropped or flipped a negative sign — positive/negative confusion."): DistractorSpec => ({
  text: String(v),
  trap_type: "Sign_Error",
  misconception: "Sign Confusion",
  detail,
});
const proc = (v: string | number, label: string, detail: string): DistractorSpec => ({
  text: String(v),
  trap_type: "Procedural_Error",
  misconception: label,
  detail,
});
const reading = (v: string | number, detail: string): DistractorSpec => ({
  text: String(v),
  trap_type: "Reading_Error",
  misconception: "Misread the Problem",
  detail,
});

/** De-duplicate distractor values against the correct answer and each other. */
function dedupe(correct: string, ds: DistractorSpec[]): DistractorSpec[] {
  const seen = new Set([correct]);
  return ds.map((d) => {
    let text = d.text;
    let bump = 1;
    while (seen.has(text)) {
      const n = Number(text);
      text = Number.isFinite(n) ? String(n + bump) : `${text} `;
      bump += 1;
    }
    seen.add(text);
    return { ...d, text };
  });
}

function q(
  stem: string,
  correct: string | number,
  distractors: DistractorSpec[],
  primaryDimension: QuestionSpec["primaryDimension"],
  dims: QuestionSpec["dims"],
  extra?: Partial<QuestionSpec>
): QuestionSpec {
  return {
    stem,
    correct: String(correct),
    distractors: dedupe(String(correct), distractors.slice(0, 3)),
    primaryDimension,
    dims,
    ...extra,
  };
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
const frac = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  const nn = n / g;
  const dd = d / g;
  return dd === 1 ? `${nn}` : `${nn}/${dd}`;
};

// ── Per-skill builders ───────────────────────────────────────────────────────
// Each returns a QuestionSpec for (band, variant index, rng).

type Builder = (band: Band, i: number, rng: Rng) => QuestionSpec;

const BUILDERS: Record<string, Builder> = {
  // S_001 Whole Numbers & Place Value
  S_001: (band, i, rng) => {
    if (band === "easy") {
      const d = int(rng, 2, 9);
      const tens = int(rng, 1, 9);
      const ones = int(rng, 0, 9);
      const n = d * 100 + tens * 10 + ones;
      return q(
        `What is the place value of ${d} in the number ${n}?`,
        d * 100,
        [
          concept(d, "Face Value vs Place Value", "Gave the face value of the digit instead of its place value."),
          proc(d * 10, "Place Position Confusion", "Treated the hundreds digit as if it were in the tens place."),
          slip(d * 1000),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const h = int(rng, 3, 9) * 100 + int(rng, 1, 4) * 10 + int(rng, 6, 9);
      const rounded = Math.round(h / 100) * 100;
      return q(
        `Round ${h} to the nearest hundred.`,
        rounded,
        [
          proc(Math.round(h / 10) * 10, "Rounded to Wrong Place", "Rounded to the nearest ten instead of the nearest hundred."),
          concept(Math.floor(h / 100) * 100, "Always Rounds Down", "Truncated instead of rounding — ignored the tens digit rule."),
          slip(rounded + 100),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const lakh = int(rng, 2, 8);
    const th = int(rng, 10, 99);
    const n = lakh * 100000 + th * 1000;
    const stem = `A city library has ${n.toLocaleString("en-IN")} books. How many complete thousands of books is that?`;
    const correctVal = n / 1000;
    return q(
      stem,
      correctVal,
      [
        reading(lakh, "Answered with the lakhs digit only — misread which unit the question asks for."),
        proc(n / 100, "Division Place Error", "Divided by 100 instead of 1000."),
        slip(correctVal + 10),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${n.toLocaleString("en-IN")} ÷ 1000 = ?`,
          correct: String(correctVal),
          distractors: [
            proc(n / 100, "Division Place Error", "Divided by 100 instead of 1000."),
            slip(correctVal + 10),
            calc(correctVal * 10),
          ],
        },
      }
    );
  },

  // S_002 Basic Operations
  S_002: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 24, 89);
      const b = int(rng, 13, 78);
      return q(
        `${a} + ${b} = ?`,
        a + b,
        [
          slip(a + b + 10),
          calc(a + b - 1, "Miscounted while carrying over."),
          concept(Math.abs(a - b), "Operation Confusion", "Subtracted instead of adding."),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 12, 29);
      const b = int(rng, 3, 9);
      return q(
        `${a} × ${b} = ?`,
        a * b,
        [
          calc(a * b + b, "Multiplied one row too many in repeated addition."),
          proc(a * (b - 1) + a - 1, "Carry Error in Multiplication", "Lost a carry while multiplying the tens."),
          concept(a + b, "Operation Confusion", "Added the numbers instead of multiplying."),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const b = int(rng, 4, 9);
    const quotient = int(rng, 12, 24);
    const a = b * quotient;
    const pens = `A shop packs ${a} pens equally into ${b} boxes. How many pens go in each box?`;
    return q(
      pens,
      quotient,
      [
        reading(a - b, `Subtracted ${b} from ${a} — misread "equally into" as "gave away".`),
        concept(a * b, "Operation Confusion", "Multiplied instead of dividing."),
        slip(quotient + 1),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${a} ÷ ${b} = ?`,
          correct: String(quotient),
          distractors: [
            concept(a * b, "Operation Confusion", "Multiplied instead of dividing."),
            slip(quotient + 1),
            calc(quotient - 2),
          ],
        },
      }
    );
  },

  // S_003 Factors & Multiples
  S_003: (band, i, rng) => {
    if (band === "easy") {
      const n = pick(rng, [12, 18, 20, 24, 28, 36]);
      const factors = Array.from({ length: n }, (_, k) => k + 1).filter((k) => n % k === 0);
      const notFactor = factors.includes(5) ? 7 : 5;
      return q(
        `Which of these is NOT a factor of ${n}?`,
        notFactor,
        [
          concept(factors[1], "Factor vs Multiple Confusion", `Chose a genuine factor of ${n} — mixed up factors with non-factors.`),
          concept(factors[2] ?? factors[0], "Factor vs Multiple Confusion", "Chose a genuine factor."),
          slip(factors[factors.length - 2]),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const n = pick(rng, [6, 7, 8, 9, 12]);
      const k = int(rng, 4, 7);
      return q(
        `What is the ${k}th multiple of ${n}?`,
        n * k,
        [
          proc(n * (k - 1), "Off-by-One in Multiples", `Counted ${n} itself as the 0th multiple.`),
          concept(n + k, "Factor vs Multiple Confusion", "Added instead of multiplying — confused multiples with sums."),
          slip(n * k + n),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const p = pick(rng, [2, 3, 5]);
    const composite = pick(rng, [45, 51, 57, 63, 91]);
    return q(
      `Which of the following is a prime number?`,
      pick(rng, [23, 29, 31, 37, 41, 43]),
      [
        concept(composite, "Prime Recognition Gap", `${composite} is composite — has factors besides 1 and itself.`),
        concept(1, "Definition of Prime", "1 is neither prime nor composite by definition."),
        slip(p * 17),
      ],
      "Understanding",
      { understanding: true, retention: true }
    );
  },

  // S_004 Basic Fractions
  S_004: (band, i, rng) => {
    if (band === "easy") {
      const d = pick(rng, [8, 10, 12]);
      const n = int(rng, 1, d - 1);
      return q(
        `A pizza is cut into ${d} equal slices. If you eat ${n} slices, what fraction of the pizza did you eat?`,
        frac(n, d),
        [
          concept(frac(d - n, d), "Complement Confusion", "Answered the fraction remaining, not the fraction eaten."),
          proc(`${n}/${d - n}`, "Part-to-Part Ratio", "Compared part to remaining part instead of part to whole."),
          slip(`${n + 1}/${d}`),
        ],
        "Understanding",
        { understanding: true, reading: true }
      );
    }
    if (band === "medium") {
      const d = pick(rng, [6, 8, 12]);
      const n1 = int(rng, 1, 3);
      const n2 = int(rng, 1, d - n1 - 1);
      return q(
        `${frac(n1, d)} + ${frac(n2, d)} = ?`,
        frac(n1 + n2, d),
        [
          concept(`${n1 + n2}/${d + d}`, "Adds Denominators", "Added denominators as well as numerators — fractions with the same denominator keep it."),
          slip(frac(n1 + n2 + 1, d)),
          calc(frac(Math.abs(n1 - n2) || 1, d)),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const pairs: [number, number, number, number][] = [
      [1, 2, 3, 8],
      [2, 3, 1, 2],
      [3, 4, 2, 3],
      [5, 6, 3, 4],
    ];
    const [a, b, c, d2] = pick(rng, pairs);
    const bigger = a / b > c / d2 ? frac(a, b) : frac(c, d2);
    const smaller = a / b > c / d2 ? frac(c, d2) : frac(a, b);
    return q(
      `Which fraction is greater: ${frac(a, b)} or ${frac(c, d2)}?`,
      bigger,
      [
        concept(smaller, "Compares Numerators Only", "Compared numerators (or denominators) directly without a common denominator."),
        proc("They are equal", "Cross-Multiplication Error", "Cross-multiplied incorrectly and concluded they are equal."),
        slip("Cannot be compared"),
      ],
      "Understanding",
      { understanding: true }
    );
  },

  // S_005 Shapes & Angles
  S_005: (band, i, rng) => {
    if (band === "easy") {
      const known = pick(rng, [30, 45, 60, 70]);
      return q(
        `Two angles on a straight line measure ${known}° and x°. What is x?`,
        180 - known,
        [
          concept(90 - known, "Straight Line vs Right Angle", "Used 90° (right angle) instead of 180° for a straight line."),
          concept(360 - known, "Full Turn Confusion", "Used 360° (full rotation) instead of 180°."),
          slip(180 - known + 10),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const sides = pick(rng, [
        ["triangle", 3],
        ["quadrilateral", 4],
        ["pentagon", 5],
        ["hexagon", 6],
      ] as [string, number][]);
      return q(
        `How many sides does a ${sides[0]} have?`,
        sides[1],
        [
          slip(sides[1] + 1),
          slip(sides[1] - 1),
          concept(sides[1] + 2, "Shape Name Confusion", "Mixed up the shape with another polygon."),
        ],
        "Retention",
        { retention: true, understanding: true }
      );
    }
    const a = pick(rng, [50, 60, 70, 80]);
    const b = pick(rng, [40, 45, 55, 65]);
    return q(
      `A triangle has angles ${a}° and ${b}°. What is the third angle?`,
      180 - a - b,
      [
        concept(360 - a - b, "Angle Sum Confusion", "Used 360° as the angle sum of a triangle instead of 180°."),
        slip(180 - a - b + 10),
        calc(180 - a + b, "Added one angle instead of subtracting both."),
      ],
      "Application",
      { application: true, calculation: true }
    );
  },

  // S_006 Decimals
  S_006: (band, i, rng) => {
    if (band === "easy") {
      const w = int(rng, 1, 9);
      const t = int(rng, 1, 9);
      return q(
        `Write ${w} + ${t}/10 as a decimal.`,
        `${w}.${t}`,
        [
          concept(`${w}${t}`, "Ignores Decimal Point", "Wrote the digits side by side without a decimal point."),
          proc(`${w}.0${t}`, "Place Value Shift", `Treated ${t}/10 as ${t}/100.`),
          slip(`${t}.${w}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 11, 89) / 10;
      const b = int(rng, 11, 89) / 10;
      const sum = Math.round((a + b) * 10) / 10;
      return q(
        `${a.toFixed(1)} + ${b.toFixed(1)} = ?`,
        sum.toFixed(1),
        [
          proc(((a * 10 + b * 10) / 100).toFixed(2), "Decimal Alignment Error", "Misaligned decimal points before adding."),
          slip((sum + 1).toFixed(1)),
          calc((sum - 0.1).toFixed(1)),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const price = int(rng, 25, 95) / 10;
    const qty = int(rng, 3, 6);
    const total = Math.round(price * qty * 10) / 10;
    return q(
      `One notebook costs ₹${price.toFixed(1)}. What do ${qty} notebooks cost?`,
      `₹${total.toFixed(1)}`,
      [
        reading(`₹${(price + qty).toFixed(1)}`, "Added price and quantity instead of multiplying — misread the structure of the problem."),
        proc(`₹${(total * 10).toFixed(1)}`, "Decimal Point Misplacement", "Multiplied correctly but placed the decimal point wrong."),
        slip(`₹${(total + 1).toFixed(1)}`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${price.toFixed(1)} × ${qty} = ?`,
          correct: total.toFixed(1),
          distractors: [
            proc((total * 10).toFixed(1), "Decimal Point Misplacement", "Placed the decimal point one position off."),
            slip((total + 1).toFixed(1)),
            calc((total - qty / 10).toFixed(1)),
          ],
        },
      }
    );
  },

  // S_007 Integers
  S_007: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 3, 9);
      const b = int(rng, 10, 18);
      return q(
        `${a} - ${b} = ?`,
        a - b,
        [
          sign(b - a),
          concept(a + b, "Negative Numbers Not Understood", "Treated subtraction of a larger number as addition."),
          slip(a - b - 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const a = -int(rng, 4, 12);
      const b = int(rng, 5, 14);
      return q(
        `(${a}) + ${b} = ?`,
        a + b,
        [
          sign(-(a + b) || 1),
          calc(a - b, "Subtracted instead of adding."),
          slip(a + b + 2),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const temps = int(rng, 4, 9);
    const drop = int(rng, 10, 16);
    return q(
      `The temperature in Shimla was ${temps}°C in the evening. Overnight it fell by ${drop}°C. What was the temperature in the morning?`,
      `${temps - drop}°C`,
      [
        sign(`${drop - temps}°C`),
        reading(`${temps + drop}°C`, `Added the drop instead of subtracting — misread "fell by".`),
        slip(`${temps - drop - 1}°C`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${temps} - ${drop} = ?`,
          correct: `${temps - drop}`,
          distractors: [
            sign(`${drop - temps}`),
            slip(`${temps - drop - 1}`),
            calc(`${temps - drop + 2}`),
          ],
        },
      }
    );
  },

  // S_008 HCF & LCM
  S_008: (band, i, rng) => {
    const pairs: [number, number][] = [[12, 18], [16, 24], [15, 20], [14, 21], [18, 27]];
    const [a, b] = pick(rng, pairs);
    if (band === "easy") {
      return q(
        `What is the HCF of ${a} and ${b}?`,
        gcd(a, b),
        [
          concept(lcm(a, b), "HCF vs LCM Confusion", "Found the LCM instead of the HCF."),
          slip(gcd(a, b) * 2),
          calc(gcd(a, b) - 1),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    if (band === "medium") {
      return q(
        `What is the LCM of ${a} and ${b}?`,
        lcm(a, b),
        [
          concept(gcd(a, b), "HCF vs LCM Confusion", "Found the HCF instead of the LCM."),
          proc(a * b, "LCM Formula Error", "Multiplied the numbers without dividing by the HCF."),
          slip(lcm(a, b) + a),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const step1 = pick(rng, [4, 6]);
    const step2 = step1 === 4 ? 6 : 9;
    const meet = lcm(step1, step2);
    return q(
      `Two bells ring every ${step1} minutes and every ${step2} minutes. If they ring together now, after how many minutes will they ring together again?`,
      meet,
      [
        concept(gcd(step1, step2), "HCF vs LCM Confusion", "Used HCF, but 'together again' needs the least common multiple."),
        reading(step1 + step2, "Added the intervals — misread the periodic structure of the problem."),
        slip(meet * 2),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `LCM(${step1}, ${step2}) = ?`,
          correct: String(meet),
          distractors: [
            concept(gcd(step1, step2), "HCF vs LCM Confusion", "Computed HCF instead of LCM."),
            proc(step1 * step2, "LCM Formula Error", "Multiplied without dividing by the HCF."),
            slip(meet + step1),
          ],
        },
      }
    );
  },

  // S_009 Fraction Operations
  S_009: (band, i, rng) => {
    if (band === "easy") {
      const d1 = pick(rng, [2, 3, 4]);
      const d2 = d1 + 1;
      return q(
        `1/${d1} + 1/${d2} = ?`,
        frac(d1 + d2, d1 * d2),
        [
          concept(`2/${d1 + d2}`, "Adds Straight Across", "Added numerators and denominators directly — fractions need a common denominator."),
          slip(frac(d1 + d2 + 1, d1 * d2)),
          calc(frac(d2 - d1, d1 * d2)),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    if (band === "medium") {
      const n = int(rng, 2, 5);
      const d = pick(rng, [3, 4, 5]);
      const m = int(rng, 2, 4);
      return q(
        `${frac(n, d)} × ${frac(m, n)} = ?`,
        frac(m, d),
        [
          proc(frac(n * n, d * m), "Inverted the Wrong Fraction", "Flipped a fraction as if dividing."),
          concept(frac(n + m, d + n), "Adds Instead of Multiplying", "Added numerators and denominators."),
          slip(frac(m + 1, d)),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const d = pick(rng, [2, 4]);
    const total = pick(rng, [16, 20, 24]);
    const part = total * (d === 2 ? 0.5 : 0.75);
    const fr = d === 2 ? "half" : "three-quarters";
    return q(
      `Riya read ${fr} of a ${total}-page comic. How many pages did she read?`,
      part,
      [
        reading(total - part, "Found the pages remaining instead of pages read."),
        concept(total * d, "Fraction as Multiplier Confusion", "Multiplied by the denominator instead of taking the fraction."),
        slip(part + 2),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${d === 2 ? "1/2" : "3/4"} × ${total} = ?`,
          correct: String(part),
          distractors: [
            concept(total * d, "Fraction as Multiplier Confusion", "Multiplied by the denominator."),
            slip(part + 2),
            calc(part - 2),
          ],
        },
      }
    );
  },

  // S_010 Ratio & Proportion
  S_010: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 2, 5);
      const k = int(rng, 2, 4);
      return q(
        `Simplify the ratio ${a * k} : ${a * k * 2}.`,
        "1 : 2",
        [
          concept("2 : 1", "Ratio Order Ignored", "Reversed the order of the ratio terms."),
          proc(`${a * k} : ${a * k * 2}`, "Cannot Simplify Ratios", "Left the ratio unsimplified — treated it as already in lowest terms."),
          slip("1 : 3"),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 2, 4);
      const b = a + int(rng, 1, 3);
      const k = int(rng, 3, 6);
      return q(
        `If x : ${b} = ${a * k} : ${b * k}, what is x?`,
        a,
        [
          proc(a * k, "Proportion Scaling Error", "Forgot to scale back down by the common factor."),
          concept(b, "Corresponding Terms Confusion", "Matched x with the wrong term of the proportion."),
          slip(a + 1),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const boys = int(rng, 2, 4);
    const girls = boys + 1;
    const total = (boys + girls) * int(rng, 3, 6);
    const boysCount = (total / (boys + girls)) * boys;
    return q(
      `A class of ${total} students has boys and girls in the ratio ${boys} : ${girls}. How many boys are there?`,
      boysCount,
      [
        reading(total - boysCount, "Found the number of girls — misread which group the question asks about."),
        concept(Math.round(total / boys), "Ratio Share Misunderstood", `Divided the total by ${boys} instead of by ${boys + girls} parts.`),
        slip(boysCount + boys),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${total} × ${boys}/${boys + girls} = ?`,
          correct: String(boysCount),
          distractors: [
            concept(Math.round(total / boys), "Ratio Share Misunderstood", `Divided by ${boys} instead of ${boys + girls}.`),
            slip(boysCount + boys),
            calc(boysCount - boys),
          ],
        },
      }
    );
  },

  // S_011 Introduction to Algebra
  S_011: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 3, 9);
      const b = int(rng, 10, 25);
      return q(
        `If x + ${a} = ${b}, what is x?`,
        b - a,
        [
          concept(b + a, "Inverse Operation Not Applied", "Added instead of subtracting when isolating x."),
          slip(b - a - 1),
          calc(b - a + 2),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    if (band === "medium") {
      const n = int(rng, 2, 6);
      return q(
        `Write "5 more than ${n} times a number y" as an expression.`,
        `${n}y + 5`,
        [
          concept(`${n}(y + 5)`, "Expression Structure Error", `Multiplied the whole sum by ${n} — "5 more than" applies after multiplying.`),
          proc(`${n} + 5y`, "Coefficient Swap", "Attached the coefficient to the wrong term."),
          slip(`${n}y - 5`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    const perim = int(rng, 3, 7);
    return q(
      `A matchstick pattern uses ${perim} sticks for the first square-chain unit and ${perim - 1} more for each extra unit. How many sticks for n units?`,
      `${perim - 1}n + 1`,
      [
        concept(`${perim}n`, "Pattern Rule Error", `Multiplied ${perim} by n — ignores that adjacent units share a stick.`),
        proc(`${perim - 1}n`, "Constant Term Dropped", "Dropped the +1 for the first stick."),
        slip(`${perim}n + 1`),
      ],
      "Application",
      { application: true, understanding: true }
    );
  },

  // S_012 Perimeter & Area
  S_012: (band, i, rng) => {
    const L = int(rng, 6, 14);
    const W = int(rng, 3, L - 1);
    if (band === "easy") {
      return q(
        `A rectangle is ${L} cm long and ${W} cm wide. What is its perimeter?`,
        `${2 * (L + W)} cm`,
        [
          concept(`${L * W} cm`, "Perimeter vs Area Confusion", "Computed the area instead of the perimeter."),
          proc(`${L + W} cm`, "Half-Perimeter Error", "Added length and width but forgot to double."),
          slip(`${2 * (L + W) + 2} cm`),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    if (band === "medium") {
      return q(
        `A rectangle is ${L} m long and ${W} m wide. What is its area?`,
        `${L * W} m²`,
        [
          concept(`${2 * (L + W)} m²`, "Perimeter vs Area Confusion", "Computed the perimeter instead of the area."),
          slip(`${L * W + L} m²`),
          calc(`${L * W - W} m²`),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const side = int(rng, 5, 12);
    const cost = int(rng, 3, 8) * 5;
    const total = 4 * side * cost;
    return q(
      `Fencing costs ₹${cost} per metre. How much does it cost to fence a square garden of side ${side} m?`,
      `₹${total}`,
      [
        concept(`₹${side * side * cost}`, "Perimeter vs Area Confusion", "Used the area (side²) instead of the perimeter (4 × side)."),
        reading(`₹${side * cost}`, "Fenced only one side — misread the requirement to enclose the garden."),
        slip(`₹${total + cost}`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `4 × ${side} × ${cost} = ?`,
          correct: `${total}`,
          distractors: [
            proc(`${side * side * cost}`, "Squared Instead of ×4", "Used side² instead of 4 × side."),
            slip(`${total + cost}`),
            calc(`${total - cost}`),
          ],
        },
      }
    );
  },

  // S_013 Integer Operations
  S_013: (band, i, rng) => {
    if (band === "easy") {
      const a = -int(rng, 3, 9);
      const b = -int(rng, 2, 8);
      return q(
        `(${a}) + (${b}) = ?`,
        a + b,
        [
          sign(-(a + b)),
          concept(Math.abs(a) + Math.abs(b), "Negatives Dropped", "Ignored both negative signs."),
          slip(a + b - 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const a = -int(rng, 3, 8);
      const b = int(rng, 3, 9);
      return q(
        `(${a}) × ${b} = ?`,
        a * b,
        [
          sign(Math.abs(a * b)),
          calc(a * b + b, "Multiplication table slip."),
          concept(a + b, "Operation Confusion", "Added instead of multiplying."),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const a = -int(rng, 4, 9);
    const b = -int(rng, 2, 7);
    return q(
      `(${a}) × (${b}) - ${Math.abs(b)} = ?`,
      a * b - Math.abs(b),
      [
        sign(-(a * b) - Math.abs(b)),
        proc(a * b + Math.abs(b), "Order of Operations Error", "Added instead of subtracting after multiplying."),
        slip(a * b - Math.abs(b) + 1),
      ],
      "Calculation",
      { calculation: true, application: true }
    );
  },

  // S_014 Rational Numbers
  S_014: (band, i, rng) => {
    if (band === "easy") {
      const n = int(rng, 1, 4);
      const d = pick(rng, [5, 8, 10]);
      return q(
        `Which of these equals -${n}/${d}?`,
        `${-n}/${d}`,
        [
          sign(`${n}/${d}`),
          concept(`${d}/${-n}`, "Reciprocal Confusion", "Flipped numerator and denominator."),
          slip(`${-n - 1}/${d}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 1, 3);
      const b = pick(rng, [4, 5, 6]);
      return q(
        `(-${a}/${b}) + (${a * 2}/${b}) = ?`,
        frac(a, b),
        [
          sign(frac(-a, b)),
          concept(`${a}/${b * 2}`, "Adds Denominators", "Added the denominators too."),
          slip(frac(a + 1, b)),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const vals: [string, string, string, string][] = [
      ["-3/4", "-2/3", "-3/4", "Between -1 and 0, -3/4 lies further left"],
      ["-5/6", "-1/2", "-5/6", "Denominators must be compared via common form"],
    ];
    const [x, y, smaller] = pick(rng, vals);
    return q(
      `Which is smaller: ${x} or ${y}?`,
      smaller,
      [
        concept(smaller === x ? y : x, "Negative Magnitude Confusion", "For negatives, the larger absolute value is the smaller number."),
        proc("They are equal", "Common Denominator Skipped", "Compared without converting to a common denominator."),
        slip("Cannot be compared"),
      ],
      "Understanding",
      { understanding: true, retention: true }
    );
  },

  // S_015 Simple Equations
  S_015: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 2, 5);
      const x = int(rng, 3, 9);
      return q(
        `Solve: ${a}x = ${a * x}`,
        x,
        [
          concept(a * x - a, "Inverse Operation Not Applied", "Subtracted the coefficient instead of dividing by it."),
          slip(x + 1),
          calc(x - 1),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 2, 4);
      const b = int(rng, 3, 11);
      const x = int(rng, 2, 8);
      return q(
        `Solve: ${a}x + ${b} = ${a * x + b}`,
        x,
        [
          proc((a * x + b + b) / a % 1 === 0 ? (a * x + 2 * b) / a : x + b, "Moved Constant with Wrong Sign", `Added ${b} to both sides instead of subtracting.`),
          sign(-x),
          slip(x + 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const x = int(rng, 4, 12);
    const b = int(rng, 2, 9);
    return q(
      `Ravi thinks of a number, doubles it, and adds ${b}. The result is ${2 * x + b}. What was the number?`,
      x,
      [
        reading(2 * x + b - b, `Only undid the +${b} — forgot the number was doubled.`),
        proc((2 * x + b + b) / 2, "Moved Constant with Wrong Sign", `Added ${b} instead of subtracting before halving.`),
        slip(x + 1),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `Solve for x: 2x + ${b} = ${2 * x + b}`,
          correct: String(x),
          distractors: [
            proc((2 * x + 2 * b) / 2, "Moved Constant with Wrong Sign", `Added ${b} to both sides instead of subtracting.`),
            sign(-x),
            slip(x + 1),
          ],
        },
      }
    );
  },

  // S_016 Exponents & Powers
  S_016: (band, i, rng) => {
    if (band === "easy") {
      const b = pick(rng, [2, 3, 4, 5]);
      const e = b === 2 ? int(rng, 3, 5) : int(rng, 2, 3);
      return q(
        `${b}^${e} = ?`,
        Math.pow(b, e),
        [
          concept(b * e, "Exponent Rule Misconception", `Multiplied base × exponent (${b} × ${e}) instead of repeated multiplication.`),
          slip(Math.pow(b, e) + b),
          calc(Math.pow(b, e - 1)),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    if (band === "medium") {
      const b = pick(rng, [2, 3, 5]);
      const m = int(rng, 2, 4);
      const n = int(rng, 2, 3);
      return q(
        `${b}^${m} × ${b}^${n} = ?`,
        `${b}^${m + n}`,
        [
          concept(`${b}^${m * n}`, "Exponent Rule Misconception", "Multiplied the exponents — the product rule adds them."),
          proc(`${b * b}^${m + n}`, "Base Multiplied", "Multiplied the bases as well as adding exponents."),
          slip(`${b}^${m + n + 1}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    const b = pick(rng, [2, 3, 10]);
    return q(
      `${b}^0 × ${b}^2 = ?`,
      Math.pow(b, 2),
      [
        concept(0, "Zero Exponent Misconception", `Treated ${b}^0 as 0 — any non-zero number to the power 0 is 1.`),
        proc(Math.pow(b, 3), "Zero Exponent as One Exponent", `Treated ${b}^0 as ${b}^1.`),
        slip(Math.pow(b, 2) + b),
      ],
      "Understanding",
      { understanding: true, retention: true }
    );
  },

  // S_017 Percentage & Simple Interest
  S_017: (band, i, rng) => {
    if (band === "easy") {
      const pct = pick(rng, [10, 20, 25, 50]);
      const n = pick(rng, [40, 60, 80, 120, 200]);
      return q(
        `What is ${pct}% of ${n}?`,
        (pct * n) / 100,
        [
          proc(pct * n / 10, "Percent Decimal Shift", "Moved the decimal one place instead of two."),
          concept(n / pct, "Percent as Division", "Divided by the percentage instead of taking the fraction."),
          slip((pct * n) / 100 + 5),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const marks = pick(rng, [30, 36, 45]);
      const total = pick(rng, [50, 60]);
      const pct = Math.round((marks / total) * 100);
      return q(
        `A student scored ${marks} out of ${total}. What percentage is that?`,
        `${pct}%`,
        [
          concept(`${marks}%`, "Raw Score as Percent", "Reported the raw marks as a percentage without dividing by the total."),
          proc(`${Math.round((total / marks) * 100)}%`, "Inverted the Fraction", "Divided total by marks instead of marks by total."),
          slip(`${pct + 5}%`),
        ],
        "Application",
        { application: true, calculation: true }
      );
    }
    const P = pick(rng, [2000, 4000, 5000]);
    const R = pick(rng, [5, 8, 10]);
    const T = int(rng, 2, 4);
    const SI = (P * R * T) / 100;
    return q(
      `Anita deposits ₹${P} at ${R}% simple interest per year. How much interest does she earn in ${T} years?`,
      `₹${SI}`,
      [
        reading(`₹${(P * R) / 100}`, `Computed interest for 1 year only — missed "in ${T} years".`),
        concept(`₹${P + SI}`, "Interest vs Amount Confusion", "Reported the total amount (principal + interest) instead of the interest."),
        slip(`₹${SI + 100}`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `(${P} × ${R} × ${T}) / 100 = ?`,
          correct: String(SI),
          distractors: [
            proc(String((P * R) / 100), "Time Factor Dropped", `Forgot to multiply by ${T}.`),
            slip(String(SI + 100)),
            calc(String(SI * 10)),
          ],
        },
      }
    );
  },

  // S_018 Triangles & Properties
  S_018: (band, i, rng) => {
    if (band === "easy") {
      const a = pick(rng, [55, 65, 75]);
      const b = pick(rng, [35, 45, 60]);
      return q(
        `Two angles of a triangle are ${a}° and ${b}°. The third angle is:`,
        `${180 - a - b}°`,
        [
          concept(`${360 - a - b}°`, "Angle Sum Confusion", "Used 360° instead of 180° for a triangle."),
          slip(`${180 - a - b + 10}°`),
          calc(`${180 - a + b}°`),
        ],
        "Calculation",
        { calculation: true, retention: true }
      );
    }
    if (band === "medium") {
      const legs: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13]];
      const [p, b2, h] = pick(rng, legs);
      return q(
        `A right triangle has legs ${p} cm and ${b2} cm. What is the length of the hypotenuse?`,
        `${h} cm`,
        [
          concept(`${p + b2} cm`, "Pythagoras Not Applied", "Added the legs directly instead of using a² + b² = c²."),
          proc(`${p * p + b2 * b2} cm`, "Square Root Skipped", "Computed a² + b² but forgot the square root."),
          slip(`${h + 1} cm`),
        ],
        "Application",
        { application: true, calculation: true }
      );
    }
    const eq = pick(rng, [50, 65, 70]);
    return q(
      `In an isosceles triangle, each base angle is ${eq}°. What is the vertex angle?`,
      `${180 - 2 * eq}°`,
      [
        proc(`${180 - eq}°`, "One Base Angle Used", "Subtracted only one base angle from 180°."),
        concept(`${eq}°`, "Isosceles Property Misunderstood", "Assumed all three angles are equal."),
        slip(`${180 - 2 * eq + 10}°`),
      ],
      "Understanding",
      { understanding: true, application: true }
    );
  },

  // S_019 Linear Equations (1 Var)
  S_019: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 2, 5);
      const b = int(rng, 4, 15);
      const x = int(rng, 2, 9);
      return q(
        `Solve: ${a}x - ${b} = ${a * x - b}`,
        x,
        [
          proc((a * x - 2 * b) / a % 1 === 0 ? (a * x - 2 * b) / a : x - 1, "Moved Constant with Wrong Sign", `Subtracted ${b} again instead of adding it back.`),
          sign(-x),
          slip(x + 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const x = int(rng, 2, 8);
      const a = int(rng, 2, 4);
      const c = int(rng, 1, 5);
      // a(x + c) = a*x + a*c
      return q(
        `Solve: ${a}(x + ${c}) = ${a * (x + c)}`,
        x,
        [
          concept(a * (x + c) - c, "Distribution Not Applied", `Subtracted ${c} before dividing — must distribute ${a} first or divide both sides.`),
          sign(-x),
          slip(x + 1),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const x = int(rng, 8, 20);
    const diff = int(rng, 2, 6);
    const total = 2 * x + diff;
    return q(
      `Two friends collected ${total} shells. Meera collected ${diff} more than Sara. How many shells did Sara collect?`,
      x,
      [
        reading(x + diff, "Found Meera's count — the question asks for Sara's."),
        concept(Math.round(total / 2), "Difference Ignored", "Halved the total, ignoring the difference between the two."),
        slip(x - 1),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `Solve for x: x + (x + ${diff}) = ${total}`,
          correct: String(x),
          distractors: [
            proc(String((total + diff) / 2), "Difference Added Instead of Subtracted", `Computed (total + ${diff})/2 for the smaller share.`),
            sign(String(-x)),
            slip(String(x - 1)),
          ],
        },
      }
    );
  },

  // S_020 Algebraic Expressions & Identities
  S_020: (band, i, rng) => {
    if (band === "easy") {
      const a = int(rng, 2, 6);
      const b = int(rng, 2, 6);
      return q(
        `Expand: (x + ${a})(x + ${b})`,
        `x² + ${a + b}x + ${a * b}`,
        [
          concept(`x² + ${a * b}`, "FOIL Middle Term Dropped", "Multiplied first and last terms only — missed the middle (cross) terms."),
          proc(`x² + ${a + b}x + ${a + b}`, "Constant Term Error", "Added the constants instead of multiplying them."),
          slip(`x² + ${a + b + 1}x + ${a * b}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 2, 7);
      return q(
        `(x + ${a})² = ?`,
        `x² + ${2 * a}x + ${a * a}`,
        [
          concept(`x² + ${a * a}`, "Square of Sum Misconception", "(a+b)² ≠ a² + b² — the 2ab middle term is missing."),
          proc(`x² + ${a}x + ${a * a}`, "Middle Term Halved", "Forgot to double the middle term."),
          slip(`x² + ${2 * a}x + ${2 * a}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    const a = pick(rng, [51, 61, 71, 99]);
    const base = a === 99 ? 100 : a - 1;
    const off = a - base;
    const sq = a * a;
    return q(
      `Using an identity, evaluate ${a}².`,
      sq,
      [
        proc(base * base + off * off, "Middle Term Dropped in Identity", `(${base}${off >= 0 ? "+" : ""}${off})² needs the 2ab term, not just a² + b².`),
        slip(sq + 2 * base * off > sq ? sq - 100 : sq + 100),
        calc(sq - 10),
      ],
      "Application",
      { application: true, calculation: true, retention: true }
    );
  },

  // S_021 Squares & Square Roots
  S_021: (band, i, rng) => {
    if (band === "easy") {
      const n = int(rng, 6, 15);
      return q(
        `√${n * n} = ?`,
        n,
        [
          concept(n * n / 2, "Square Root as Halving", "Halved the number instead of finding its square root."),
          slip(n + 1),
          calc(n - 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const n = int(rng, 12, 25);
      return q(
        `${n}² = ?`,
        n * n,
        [
          concept(n * 2, "Square as Doubling", "Doubled the number instead of multiplying it by itself."),
          slip(n * n + n),
          calc(n * n - 2 * n + 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    const area = pick(rng, [144, 196, 225, 256, 324]);
    const side = Math.sqrt(area);
    return q(
      `A square courtyard has an area of ${area} m². What is the length of one side?`,
      `${side} m`,
      [
        concept(`${area / 4} m`, "Area vs Perimeter Confusion", "Divided the area by 4 as if it were a perimeter."),
        reading(`${area / 2} m`, "Halved the area — misread 'area' as double the side."),
        slip(`${side + 1} m`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `√${area} = ?`,
          correct: String(side),
          distractors: [
            concept(String(area / 2), "Square Root as Halving", "Halved instead of taking the square root."),
            slip(String(side + 1)),
            calc(String(side - 1)),
          ],
        },
      }
    );
  },

  // S_022 Mensuration
  S_022: (band, i, rng) => {
    if (band === "easy") {
      const r = pick(rng, [7, 14, 21]);
      const circ = Math.round(2 * (22 / 7) * r);
      return q(
        `The radius of a circle is ${r} cm. Its circumference is (use π = 22/7):`,
        `${circ} cm`,
        [
          concept(`${Math.round((22 / 7) * r * r)} cm`, "Circumference vs Area Confusion", "Used πr² (area) instead of 2πr."),
          proc(`${Math.round((22 / 7) * r)} cm`, "Diameter Factor Dropped", "Used πr instead of 2πr."),
          slip(`${circ + 2} cm`),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const l = int(rng, 4, 8);
      const b = int(rng, 3, l);
      const h = int(rng, 2, 5);
      return q(
        `A cuboid measures ${l} cm × ${b} cm × ${h} cm. What is its volume?`,
        `${l * b * h} cm³`,
        [
          concept(`${2 * (l * b + b * h + l * h)} cm³`, "Volume vs Surface Area Confusion", "Computed the total surface area instead of the volume."),
          proc(`${l + b + h} cm³`, "Dimensions Added", "Added the dimensions instead of multiplying."),
          slip(`${l * b * h + l} cm³`),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const side = pick(rng, [3, 4, 5]);
    const cube = side ** 3;
    const tank = `A cubical water tank has an edge of ${side} m. How many cubic metres of water can it hold when full?`;
    return q(
      tank,
      `${cube} m³`,
      [
        concept(`${6 * side * side} m³`, "Volume vs Surface Area Confusion", "Computed surface area (6a²) instead of volume (a³)."),
        reading(`${side * side} m³`, "Found the area of one face — misread volume as face area."),
        slip(`${cube + side} m³`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${side}³ = ?`,
          correct: String(cube),
          distractors: [
            concept(String(side * 3), "Cube as Tripling", "Multiplied by 3 instead of cubing."),
            proc(String(side * side), "Squared Instead of Cubed", "Stopped at the square."),
            slip(String(cube + side)),
          ],
        },
      }
    );
  },

  // S_023 Data Handling
  S_023: (band, i, rng) => {
    if (band === "easy") {
      const vals = [int(rng, 2, 6), int(rng, 5, 9), int(rng, 8, 14), int(rng, 3, 8)];
      const max = Math.max(...vals);
      return q(
        `A bar graph shows books read: Amit ${vals[0]}, Bina ${vals[1]}, Chetan ${vals[2]}, Dia ${vals[3]}. Who read the most?`,
        ["Amit", "Bina", "Chetan", "Dia"][vals.indexOf(max)],
        [
          reading(["Amit", "Bina", "Chetan", "Dia"][vals.indexOf(Math.min(...vals))], "Picked the least instead of the most — misread the question."),
          slip(["Amit", "Bina", "Chetan", "Dia"][(vals.indexOf(max) + 1) % 4]),
          calc(["Amit", "Bina", "Chetan", "Dia"][(vals.indexOf(max) + 2) % 4]),
        ],
        "Reading",
        { reading: true, understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 4, 9) * 2;
      const b = a + int(rng, 2, 6);
      const c = a + int(rng, 4, 10);
      const mean = Math.round((a + b + c) / 3);
      const exact = (a + b + c) / 3;
      return q(
        `The mean of ${a}, ${b} and ${c} is:`,
        Number.isInteger(exact) ? exact : exact.toFixed(1),
        [
          concept(b, "Mean vs Median Confusion", "Gave the middle value (median) instead of the mean."),
          proc(a + b + c, "Division Step Skipped", "Added the values but forgot to divide by 3."),
          slip(Number.isInteger(exact) ? exact + 1 : (exact + 1).toFixed(1)),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const total = pick(rng, [40, 60]);
    const pct = pick(rng, [25, 50]);
    const count = (total * pct) / 100;
    return q(
      `In a pie chart of ${total} students' favourite sports, the cricket sector is ${pct}% of the circle. How many students chose cricket?`,
      count,
      [
        reading(total - count, "Found students who did NOT choose cricket."),
        concept(pct, "Percent as Count", "Reported the percentage itself as the number of students."),
        slip(count + 5),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${pct}% × ${total} = ?`,
          correct: String(count),
          distractors: [
            concept(String(pct), "Percent as Count", "Gave the percent itself."),
            slip(String(count + 5)),
            calc(String(count - 5)),
          ],
        },
      }
    );
  },

  // S_024 Comparing Quantities (CI)
  S_024: (band, i, rng) => {
    if (band === "easy") {
      const P = pick(rng, [1000, 2000]);
      const R = 10;
      const A1 = P + (P * R) / 100;
      return q(
        `₹${P} grows at ${R}% per year. What is the amount after 1 year?`,
        `₹${A1}`,
        [
          concept(`₹${(P * R) / 100}`, "Interest vs Amount Confusion", "Gave the interest, not the full amount."),
          slip(`₹${A1 + 10}`),
          calc(`₹${A1 - 10}`),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const P = pick(rng, [1000, 5000]);
      const R = 10;
      const CI2 = P * Math.pow(1 + R / 100, 2) - P;
      const SI2 = (P * R * 2) / 100;
      return q(
        `What is the compound interest on ₹${P} at ${R}% per annum for 2 years?`,
        `₹${CI2}`,
        [
          concept(`₹${SI2}`, "CI vs SI Confusion", "Computed simple interest — compound interest earns interest on interest."),
          proc(`₹${P * Math.pow(1 + R / 100, 2)}`, "Principal Not Subtracted", "Gave the amount instead of subtracting the principal."),
          slip(`₹${CI2 + 10}`),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const price = pick(rng, [800, 1200, 1500]);
    const disc = pick(rng, [10, 20, 25]);
    const sale = price - (price * disc) / 100;
    return q(
      `A jacket marked ₹${price} is sold at ${disc}% discount. What is the sale price?`,
      `₹${sale}`,
      [
        reading(`₹${(price * disc) / 100}`, "Gave the discount amount, not the sale price."),
        concept(`₹${price + (price * disc) / 100}`, "Discount Added", "Added the discount instead of subtracting."),
        slip(`₹${sale - 10}`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${price} - ${disc}% of ${price} = ?`,
          correct: String(sale),
          distractors: [
            proc(String((price * disc) / 100), "Stopped at the Discount", "Computed the discount but did not subtract it."),
            concept(String(price + (price * disc) / 100), "Discount Added", "Added instead of subtracting."),
            slip(String(sale - 10)),
          ],
        },
      }
    );
  },

  // S_025 Polynomials
  S_025: (band, i, rng) => {
    if (band === "easy") {
      const powers = [3, 2, 1];
      const deg = pick(rng, powers);
      const poly = deg === 3 ? "4x³ - x + 7" : deg === 2 ? "5x² + 3x - 1" : "9x + 2";
      return q(
        `What is the degree of the polynomial ${poly}?`,
        deg,
        [
          concept(deg === 1 ? 9 : deg === 2 ? 5 : 4, "Degree vs Coefficient Confusion", "Gave the leading coefficient instead of the degree."),
          slip(deg + 1),
          calc(Math.max(deg - 1, 0)),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 2, 4);
      const r = int(rng, 2, 3);
      const value = a * r * r - a * r; // p(x)=a x² - a x at x=r → a r(r-1)
      return q(
        `If p(x) = ${a}x² - ${a}x, what is p(${r})?`,
        value,
        [
          sign(-value || a),
          proc(a * r * 2 - a, "Exponent Evaluated as Product", `Treated x² as 2x when substituting.`),
          slip(value + a),
        ],
        "Calculation",
        { calculation: true, application: true }
      );
    }
    const root = int(rng, 2, 6);
    return q(
      `Which value of x is a zero of the polynomial p(x) = x² - ${root * root}?`,
      root,
      [
        concept(root * root, "Zero vs Constant Confusion", "Gave the constant term instead of solving p(x) = 0."),
        sign(`-${root * 2}`),
        slip(root + 1),
      ],
      "Understanding",
      { understanding: true, application: true }
    );
  },

  // S_026 Coordinate Geometry
  S_026: (band, i, rng) => {
    if (band === "easy") {
      const x = int(rng, 2, 6);
      const y = int(rng, 2, 6);
      return q(
        `In which quadrant does the point (${x}, -${y}) lie?`,
        "Quadrant IV",
        [
          concept("Quadrant II", "Quadrant Order Confusion", "Mixed up the anticlockwise numbering of quadrants."),
          proc("Quadrant I", "Sign of y Ignored", "Ignored the negative y-coordinate."),
          slip("Quadrant III"),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const x = int(rng, 1, 5);
      const y = int(rng, 1, 5);
      return q(
        `What is the distance of the point (${x}, ${y}) from the x-axis?`,
        y,
        [
          concept(x, "Axis Distance Confusion", "Distance from the x-axis is the |y|-coordinate, not x."),
          proc(Math.round(Math.sqrt(x * x + y * y) * 10) / 10, "Distance from Origin", "Computed distance from the origin instead."),
          slip(y + 1),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    const x1 = int(rng, 1, 4);
    const y1 = int(rng, 1, 4);
    const dx = pick(rng, [3, 6]);
    const dy = dx === 3 ? 4 : 8;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return q(
      `What is the distance between the points (${x1}, ${y1}) and (${x1 + dx}, ${y1 + dy})?`,
      dist,
      [
        concept(dx + dy, "Distance Formula Not Applied", "Added the coordinate differences instead of using √(Δx² + Δy²)."),
        proc(dx * dx + dy * dy, "Square Root Skipped", "Forgot the final square root."),
        slip(dist + 1),
      ],
      "Application",
      { application: true, calculation: true }
    );
  },

  // S_027 Linear Equations (2 Var)
  S_027: (band, i, rng) => {
    if (band === "easy") {
      const x = int(rng, 1, 5);
      const y = int(rng, 1, 5);
      return q(
        `If x + y = ${x + y} and x = ${x}, what is y?`,
        y,
        [
          slip(y + 1),
          sign(-y),
          concept(x + y, "Substitution Not Applied", "Repeated the total instead of substituting x."),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const x = int(rng, 1, 4);
      const y = int(rng, 1, 4);
      // x + y = s ; x - y = d
      const s = x + y;
      const d = x - y;
      return q(
        `Solve the pair: x + y = ${s} and x - y = ${d}. What is x?`,
        x,
        [
          concept(y, "Variable Mix-up", "Solved correctly but reported y instead of x."),
          proc(s + d, "Elimination Step Skipped", "Added the equations but forgot to divide by 2."),
          slip(x + 1),
        ],
        "Calculation",
        { calculation: true, understanding: true }
      );
    }
    const pen = int(rng, 5, 9);
    const pencil = int(rng, 2, 4);
    const eqTotal = 2 * pen + 3 * pencil;
    return q(
      `2 pens and 3 pencils cost ₹${eqTotal}. If one pen costs ₹${pen}, what does one pencil cost?`,
      `₹${pencil}`,
      [
        reading(`₹${pen}`, "Reported the pen's price — the question asks for the pencil."),
        proc(`₹${eqTotal - 2 * pen}`, "Final Division Skipped", "Found the cost of 3 pencils but did not divide by 3."),
        slip(`₹${pencil + 1}`),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `Solve for y: 2(${pen}) + 3y = ${eqTotal}`,
          correct: String(pencil),
          distractors: [
            proc(String(eqTotal - 2 * pen), "Final Division Skipped", "Did not divide by the coefficient 3."),
            sign(String(-pencil)),
            slip(String(pencil + 1)),
          ],
        },
      }
    );
  },

  // S_028 Number Systems (Real Numbers)
  S_028: (band, i, rng) => {
    if (band === "easy") {
      return q(
        `Which of the following is an irrational number?`,
        "√2",
        [
          concept("22/7", "Rational vs Irrational Confusion", "22/7 is a ratio of integers — rational (it only approximates π)."),
          concept("0.5", "Terminating Decimal Misclassified", "Terminating decimals are rational."),
          slip("4/9"),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const a = pick(rng, [2, 3, 5]);
      return q(
        `√${a} × √${a} = ?`,
        a,
        [
          concept(`√${a * a}`, "Radical Multiplication Misunderstood", `√a × √a = a exactly, which here is ${a} — not left as a radical.`),
          proc(a * 2, "Root as Doubling", "Doubled instead of squaring the root away."),
          slip(a + 1),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const d = pick(rng, [3, 7, 11]);
    return q(
      `The decimal expansion of 1/${d} is:`,
      "Non-terminating repeating",
      [
        concept("Non-terminating non-repeating", "Rational Decimal Misclassified", "A rational number's expansion always terminates or repeats."),
        concept("Terminating", "Denominator Rule Not Applied", `1/${d} terminates only if the denominator has just 2s and 5s as prime factors.`),
        slip("Cannot be determined"),
      ],
      "Understanding",
      { understanding: true, retention: true }
    );
  },

  // S_029 Statistics
  S_029: (band, i, rng) => {
    if (band === "easy") {
      const base = int(rng, 3, 7);
      const vals = [base, base + 2, base + 4, base + 6, base + 8];
      const mean = base + 4;
      return q(
        `Find the mean of ${vals.join(", ")}.`,
        mean,
        [
          proc(vals.reduce((a, b) => a + b, 0), "Division Step Skipped", "Summed the values but forgot to divide by 5."),
          concept(vals[2], "Median Given", "Gave the median — here it equals the middle value by position, not computation."),
          slip(mean + 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const a = int(rng, 2, 5);
      const sorted = [a, a + 1, a + 3, a + 5, a + 9];
      return q(
        `Find the median of ${sorted[3]}, ${sorted[0]}, ${sorted[4]}, ${sorted[1]}, ${sorted[2]}.`,
        sorted[2],
        [
          proc(sorted[4], "Data Not Sorted", "Picked the middle of the unsorted list."),
          concept(Math.round(sorted.reduce((x, y) => x + y, 0) / 5), "Mean vs Median Confusion", "Computed the mean instead of the median."),
          slip(sorted[1]),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const m = int(rng, 4, 8);
    const data = [m, m, m + 1, m + 3, m, m + 2];
    return q(
      `The number of goals scored in ${data.length} matches were ${data.join(", ")}. What is the mode?`,
      m,
      [
        concept(m + 3, "Mode as Maximum", "Gave the highest value — the mode is the most frequent value."),
        proc(Math.round(data.reduce((a, b) => a + b, 0) / data.length), "Mean vs Mode Confusion", "Computed the mean."),
        slip(m + 1),
      ],
      "Understanding",
      { understanding: true, application: true }
    );
  },

  // S_030 Quadratic Equations
  S_030: (band, i, rng) => {
    if (band === "easy") {
      const r = int(rng, 2, 6);
      return q(
        `Solve: x² = ${r * r}. The positive root is:`,
        r,
        [
          concept(r * r / 2, "Square Root as Halving", "Halved instead of taking the square root."),
          slip(r + 1),
          calc(r - 1),
        ],
        "Calculation",
        { calculation: true }
      );
    }
    if (band === "medium") {
      const r1 = int(rng, 1, 4);
      const r2 = r1 + int(rng, 1, 3);
      const b = r1 + r2;
      const c = r1 * r2;
      return q(
        `The roots of x² - ${b}x + ${c} = 0 are:`,
        `${r1} and ${r2}`,
        [
          sign(`-${r1} and -${r2}`),
          concept(`${b} and ${c}`, "Coefficients as Roots", "Read the coefficients as the roots without factorising."),
          slip(`${r1} and ${r2 + 1}`),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const w = int(rng, 3, 6);
    const l = w + int(rng, 2, 4);
    const area = w * l;
    return q(
      `A rectangular plot's length is ${l - w} m more than its width, and its area is ${area} m². What is the width?`,
      `${w} m`,
      [
        reading(`${l} m`, "Found the length — the question asks for the width."),
        concept(`${area / (l - w)} m`, "Linear Setup for Quadratic", "Divided area by the difference — the relationship is quadratic, not linear."),
        slip(`${w + 1} m`),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `Solve for x (x > 0): x(x + ${l - w}) = ${area}`,
          correct: `${w}`,
          distractors: [
            sign(`${-w}`),
            proc(`${area / (l - w)}`, "Division Shortcut", "Divided by the coefficient instead of solving the quadratic."),
            slip(`${w + 1}`),
          ],
        },
      }
    );
  },

  // S_031 Arithmetic Progression
  S_031: (band, i, rng) => {
    const a = int(rng, 2, 8);
    const d = int(rng, 2, 6);
    if (band === "easy") {
      return q(
        `What is the common difference of the AP: ${a}, ${a + d}, ${a + 2 * d}, ${a + 3 * d}, …?`,
        d,
        [
          concept(a, "First Term as Difference", "Gave the first term instead of the difference between terms."),
          sign(-d),
          slip(d + 1),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const n = int(rng, 8, 15);
      const nth = a + (n - 1) * d;
      return q(
        `Find the ${n}th term of the AP ${a}, ${a + d}, ${a + 2 * d}, …`,
        nth,
        [
          proc(a + n * d, "Off-by-One in AP Formula", "Used a + nd instead of a + (n-1)d."),
          concept(a * n, "AP as Multiplication", "Multiplied first term by n — ignores the common difference structure."),
          slip(nth + d),
        ],
        "Calculation",
        { calculation: true, application: true }
      );
    }
    const n = pick(rng, [10, 12]);
    const sum = (n / 2) * (2 * a + (n - 1) * d);
    return q(
      `A theatre has ${a} seats in the first row and each row has ${d} more seats than the previous. How many seats are there in the first ${n} rows altogether?`,
      sum,
      [
        reading(a + (n - 1) * d, `Found the seats in the ${n}th row only — the question asks for the total.`),
        proc(n * a + n * d, "Sum Formula Misapplied", "Used n(a + d) instead of n/2 × (2a + (n-1)d)."),
        slip(sum + n),
      ],
      "Application",
      { reading: true, application: true, calculation: true },
      {
        isWordProblem: true,
        twin: {
          stem: `S = ${n}/2 × (2×${a} + (${n}-1)×${d}) = ?`,
          correct: String(sum),
          distractors: [
            proc(String(n * a + n * d), "Sum Formula Misapplied", "Used n(a+d)."),
            slip(String(sum + n)),
            calc(String(sum - n)),
          ],
        },
      }
    );
  },

  // S_032 Trigonometry
  S_032: (band, i, rng) => {
    if (band === "easy") {
      const pairs: [string, string][] = [
        ["sin 30°", "1/2"],
        ["cos 60°", "1/2"],
        ["tan 45°", "1"],
        ["sin 90°", "1"],
      ];
      const [expr, val] = pick(rng, pairs);
      return q(
        `${expr} = ?`,
        val,
        [
          concept(val === "1/2" ? "√3/2" : "1/2", "Standard Value Mix-up", "Swapped the standard values of complementary angles."),
          slip(val === "1" ? "0" : "1"),
          calc("√2/2"),
        ],
        "Retention",
        { retention: true, understanding: true }
      );
    }
    if (band === "medium") {
      const t: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17]];
      const [opp, adj, hyp] = pick(rng, t);
      return q(
        `In a right triangle, the side opposite angle θ is ${opp} and the hypotenuse is ${hyp}. What is sin θ?`,
        `${opp}/${hyp}`,
        [
          concept(`${adj}/${hyp}`, "sin vs cos Confusion", "Used the adjacent side — that ratio is cos θ."),
          proc(`${opp}/${adj}`, "sin vs tan Confusion", "Used opposite/adjacent — that ratio is tan θ."),
          slip(`${hyp}/${opp}`),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    const h = pick(rng, [10, 15, 20]);
    return q(
      `A ladder leans against a wall making a 30° angle with the ground. If the ladder is ${2 * h} m long, how high up the wall does it reach? (sin 30° = 1/2)`,
      `${h} m`,
      [
        concept(`${Math.round(2 * h * 0.866)} m`, "sin vs cos Confusion", "Used cos 30° — the height is opposite the angle, so use sine."),
        reading(`${2 * h} m`, "Gave the ladder's length — misread what the question asks."),
        slip(`${h + 2} m`),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${2 * h} × sin 30° = ?`,
          correct: `${h}`,
          distractors: [
            concept(`${Math.round(2 * h * 0.866)}`, "sin vs cos Confusion", "Used cos 30° ≈ 0.866."),
            slip(`${h + 2}`),
            calc(`${h - 2}`),
          ],
        },
      }
    );
  },

  // S_033 Probability
  S_033: (band, i, rng) => {
    if (band === "easy") {
      return q(
        `A fair coin is tossed once. What is the probability of getting heads?`,
        "1/2",
        [
          concept("1", "Certainty Confusion", "Probability 1 means certain — a coin toss is not certain."),
          proc("1/4", "Sample Space Error", "Used 4 outcomes — a single coin toss has only 2."),
          slip("2/1"),
        ],
        "Understanding",
        { understanding: true }
      );
    }
    if (band === "medium") {
      const face = int(rng, 1, 3);
      return q(
        `A die is rolled once. What is the probability of getting a number greater than ${face}?`,
        frac(6 - face, 6),
        [
          concept(frac(face, 6), "Complement Confusion", `Found P(number ≤ ${face}) — the complement of what was asked.`),
          proc(`${6 - face}/5`, "Sample Space Error", "Used 5 outcomes instead of 6."),
          slip(frac(6 - face - 1, 6)),
        ],
        "Understanding",
        { understanding: true, calculation: true }
      );
    }
    const red = int(rng, 3, 6);
    const blue = int(rng, 4, 8);
    const total = red + blue;
    return q(
      `A bag has ${red} red and ${blue} blue marbles. One marble is drawn at random. What is the probability it is red?`,
      frac(red, total),
      [
        reading(frac(blue, total), "Found P(blue) — misread which colour was asked."),
        concept(`${red}/${blue}`, "Odds vs Probability Confusion", "Compared red to blue (odds) instead of red to total."),
        slip(frac(red + 1, total)),
      ],
      "Application",
      { reading: true, application: true, understanding: true },
      {
        isWordProblem: true,
        twin: {
          stem: `${red} ÷ ${total} = ? (as a fraction)`,
          correct: frac(red, total),
          distractors: [
            concept(`${red}/${blue}`, "Odds vs Probability Confusion", "Divided by the other group instead of the total."),
            slip(frac(red + 1, total)),
            calc(frac(Math.max(red - 1, 1), total)),
          ],
        },
      }
    );
  },
};

export function buildQuestion(
  skill: SkillDef,
  band: Band,
  variant: number,
  rng: Rng
): QuestionSpec {
  const builder = BUILDERS[skill.skill_id];
  if (!builder) throw new Error(`No builder for ${skill.skill_id}`);
  const spec = builder(band, variant, rng);
  // Secondary skills: prerequisite chain heads double as secondary tested skills
  // for medium/hard questions (drives multi-skill rows in the Q-Matrix).
  if (!spec.secondarySkills && band !== "easy") {
    const prereq = firstPrereq(skill);
    if (prereq && SKILL_BY_ID.has(prereq)) spec.secondarySkills = [prereq];
  }
  return spec;
}
