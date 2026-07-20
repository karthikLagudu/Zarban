import { describe, expect, it } from "vitest";
import {
  escalateDifficulty,
  reduceDifficulty,
  nearestBands,
} from "@/lib/engine/difficulty";
import { gradeMatches, skillBaseGrade } from "@/lib/engine/topics";
import { clampGrade } from "@/lib/engine/types";

describe("difficulty ladder", () => {
  it("escalates easy → medium → hard and caps at hard", () => {
    expect(escalateDifficulty("easy")).toBe("medium");
    expect(escalateDifficulty("medium")).toBe("hard");
    expect(escalateDifficulty("hard")).toBe("hard");
  });

  it("reduces hard → medium → easy and floors at easy", () => {
    expect(reduceDifficulty("hard")).toBe("medium");
    expect(reduceDifficulty("medium")).toBe("easy");
    expect(reduceDifficulty("easy")).toBe("easy");
  });

  it("defaults to medium for unknown values", () => {
    expect(escalateDifficulty(null)).toBe("hard"); // medium -> hard
    expect(reduceDifficulty(undefined)).toBe("easy");
    expect(escalateDifficulty("bogus")).toBe("medium");
  });

  it("nearest-band fallback order starts at the preferred band (Part 7.1)", () => {
    expect(nearestBands("easy")).toEqual(["easy", "medium", "hard"]);
    expect(nearestBands("hard")[0]).toBe("hard");
  });
});

describe("grade parsing (skill grade_level strings)", () => {
  it("matches single grades, ranges and lists", () => {
    expect(gradeMatches("5", 5)).toBe(true);
    expect(gradeMatches("9-10", 9)).toBe(true);
    expect(gradeMatches("9-10", 10)).toBe(true);
    expect(gradeMatches("9-10", 8)).toBe(false);
    expect(gradeMatches("6,8", 8)).toBe(true);
    expect(gradeMatches(null, 7)).toBe(false);
  });

  it("skillBaseGrade returns the lowest grade in the label", () => {
    expect(skillBaseGrade("9-10")).toBe(9);
    expect(skillBaseGrade("7")).toBe(7);
    expect(skillBaseGrade(null, 6)).toBe(6);
  });

  it("clampGrade enforces the 5–10 floor/ceiling (Part 7.5)", () => {
    expect(clampGrade(4)).toBe(5);
    expect(clampGrade(11)).toBe(10);
    expect(clampGrade(8)).toBe(8);
  });
});
