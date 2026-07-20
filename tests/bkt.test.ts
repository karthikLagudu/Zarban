import { describe, expect, it } from "vitest";
import { bktUpdate } from "@/lib/engine/bkt";
import { DEFAULT_BKT_PARAMS } from "@/lib/engine/types";

const P = DEFAULT_BKT_PARAMS; // pL0 .1, pT .3, pG .2, pS .1

describe("BKT update (spec Algorithm 3)", () => {
  it("computes the exact posterior on a correct answer", () => {
    // P(L|c) = .1*.9 / (.1*.9 + .9*.2) = .09/.27 = 1/3
    const { posterior, pNew } = bktUpdate(0.1, true, P);
    expect(posterior).toBeCloseTo(1 / 3, 6);
    // P(L_new) = 1/3 + (2/3)*.3 = .53333
    expect(pNew).toBeCloseTo(1 / 3 + (2 / 3) * 0.3, 6);
  });

  it("computes the exact posterior on an incorrect answer", () => {
    // P(L|i) = .5*.1 / (.5*.1 + .5*.8) = .05/.45 = 1/9
    const { posterior, pNew } = bktUpdate(0.5, false, P);
    expect(posterior).toBeCloseTo(1 / 9, 6);
    expect(pNew).toBeCloseTo(1 / 9 + (8 / 9) * 0.3, 6);
  });

  it("mastery rises monotonically with consecutive correct answers", () => {
    let p = 0.1;
    const seen: number[] = [p];
    for (let i = 0; i < 6; i++) {
      p = bktUpdate(p, true, P).pNew;
      seen.push(p);
    }
    // Non-decreasing (the 0.99 clamp can plateau at the top of the scale).
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(p).toBeGreaterThan(0.95); // reaches mastery threshold
  });

  it("mastery falls with consecutive wrong answers but learning keeps it above zero", () => {
    let p = 0.9;
    for (let i = 0; i < 5; i++) p = bktUpdate(p, false, P).pNew;
    expect(p).toBeLessThan(0.55);
    expect(p).toBeGreaterThan(0.2); // P(T) floor effect
  });

  it("clamps degenerate priors into the open interval", () => {
    expect(bktUpdate(1.5, true, P).pNew).toBeLessThanOrEqual(0.99);
    expect(bktUpdate(-2, false, P).pNew).toBeGreaterThanOrEqual(0.01);
  });
});
