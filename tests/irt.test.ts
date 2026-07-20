import { describe, expect, it } from "vitest";
import {
  probability3PL,
  estimateThetaMLE,
  defaultItemParams,
  clampTheta,
} from "@/lib/engine/irt";

describe("3PL model (spec Algorithm 1)", () => {
  it("P(θ) = c + (1-c)/(1+exp(-a(θ-b)))", () => {
    const item = { a: 1, b: 0, c: 0.25 };
    expect(probability3PL(0, item)).toBeCloseTo(0.25 + 0.75 / 2, 6); // 0.625
    expect(probability3PL(4, item)).toBeGreaterThan(0.95);
    expect(probability3PL(-4, item)).toBeLessThan(0.3);
    expect(probability3PL(-99, item)).toBeGreaterThanOrEqual(0.25); // guessing floor
  });

  it("harder items (higher b) have lower success probability", () => {
    const easy = { a: 1.1, b: -0.8, c: 0.25 };
    const hard = { a: 1.1, b: 0.8, c: 0.25 };
    expect(probability3PL(0, easy)).toBeGreaterThan(probability3PL(0, hard));
  });
});

describe("θ estimation via MLE", () => {
  const item = (b: number) => ({ a: 1.2, b, c: 0.2 });

  it("increases θ after a correct answer, decreases after wrong", () => {
    const up = estimateThetaMLE([{ item: item(0), correct: true }], 0);
    const down = estimateThetaMLE([{ item: item(0), correct: false }], 0);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(0);
  });

  it("converges near the true ability for a mixed response pattern", () => {
    // Simulated student with θ = 1: passes items below ability, fails above.
    const obs = [
      { item: item(-1), correct: true },
      { item: item(-0.5), correct: true },
      { item: item(0), correct: true },
      { item: item(0.5), correct: true },
      { item: item(1.5), correct: false },
      { item: item(2), correct: false },
    ];
    const theta = estimateThetaMLE(obs, 0);
    expect(theta).toBeGreaterThan(0.2);
    expect(theta).toBeLessThan(2.2);
  });

  it("stays within [-4, 4] even on degenerate all-correct histories", () => {
    const obs = Array.from({ length: 20 }, () => ({
      item: item(0),
      correct: true,
    }));
    const theta = estimateThetaMLE(obs, 3.9);
    expect(theta).toBeLessThanOrEqual(4);
    expect(theta).toBeGreaterThan(3);
  });

  it("clampTheta handles NaN/Infinity", () => {
    expect(clampTheta(NaN)).toBe(0);
    expect(clampTheta(Infinity)).toBe(4);
    expect(clampTheta(-Infinity)).toBe(-4);
  });
});

describe("default item parameters", () => {
  it("scales b with grade and band", () => {
    const g5easy = defaultItemParams(5, "easy");
    const g10hard = defaultItemParams(10, "hard");
    expect(g5easy.b).toBeLessThan(g10hard.b);
    expect(g5easy.c).toBe(0.25);
  });
});
