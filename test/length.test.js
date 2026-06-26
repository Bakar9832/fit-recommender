import { describe, it, expect } from "vitest";
import { lengthNote } from "../src/services/length.js";

describe("lengthNote (§4.5 advisory length)", () => {
  it("returns null when there is no garment length", () => {
    expect(lengthNote(null, 64)).toBeNull();
    expect(lengthNote(undefined, undefined)).toBeNull();
  });

  it("reports raw length only when height is missing (no hem claim)", () => {
    expect(lengthNote(40, null)).toBe("Garment length: 40in.");
    expect(lengthNote(40.5, undefined)).toBe("Garment length: 40.5in.");
  });

  it("maps length/height ratio to a hem descriptor when height is given", () => {
    // 36/64 = 0.5625 → above knee
    expect(lengthNote(36, 64)).toBe("Falls above the knee at your height.");
    // 40/64 = 0.625 → at knee
    expect(lengthNote(40, 64)).toBe("Falls at the knee at your height.");
    // 42/64 = 0.656 → below knee
    expect(lengthNote(42, 64)).toBe("Falls just below the knee at your height.");
    // 46/64 = 0.719 → mid-calf
    expect(lengthNote(46, 64)).toBe("Falls around mid-calf at your height.");
  });
});
