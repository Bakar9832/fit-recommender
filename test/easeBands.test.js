import { describe, it, expect } from "vitest";
import { classifyZone } from "../src/services/easeBands.js";

// Exercise the exact §4.3 boundaries on the bust band [3, 5]:
//   < 2 too_tight | [2,3) snug | [3,5] good | (5,7] relaxed | > 7 too_loose
describe("classifyZone (§4.3 boundaries)", () => {
  const band = [3, 5];

  it("classifies below lo-1 as too_tight", () => {
    expect(classifyZone(1.99, band)).toBe("too_tight");
  });

  it("treats ease exactly lo-1 as snug (inclusive lower edge)", () => {
    expect(classifyZone(2, band)).toBe("snug");
  });

  it("classifies the [lo-1, lo) window as snug", () => {
    expect(classifyZone(2.5, band)).toBe("snug");
  });

  it("classifies ease within [lo, hi] as good (both edges inclusive)", () => {
    expect(classifyZone(3, band)).toBe("good");
    expect(classifyZone(4, band)).toBe("good");
    expect(classifyZone(5, band)).toBe("good");
  });

  it("classifies the (hi, hi+2] window as relaxed", () => {
    expect(classifyZone(5.01, band)).toBe("relaxed");
    expect(classifyZone(7, band)).toBe("relaxed");
  });

  it("classifies beyond hi+2 as too_loose", () => {
    expect(classifyZone(7.01, band)).toBe("too_loose");
  });
});
