import { describe, it, expect } from "vitest";
import { recommendFit } from "../src/services/fitEngine.js";

// Standard regular-fit chart (mirrors the seeded "Default Pret Standard",
// graded ±2in). kameezLength left off unless a test needs length handling.
const regularRows = [
  { sizeLabel: "S", sortOrder: 1, bust: 35, waist: 27, hip: 37 },
  { sizeLabel: "M", sortOrder: 2, bust: 37, waist: 29, hip: 39 },
  { sizeLabel: "L", sortOrder: 3, bust: 39, waist: 31, hip: 41 },
  { sizeLabel: "XL", sortOrder: 4, bust: 41, waist: 33, hip: 43 },
];

const regular = (extra = {}) => ({ fitType: "regular", rows: regularRows, ...extra });

describe("recommendFit (§4 size selection)", () => {
  it("picks the all-good size with high confidence and a clear alternative", () => {
    // body sits dead-center of M's good band on every zone; neighbours are 3.5
    // points away, so the margin is clear.
    const out = recommendFit({ bust: 33, waist: 25, hip: 35 }, regular());

    expect(out.recommended_size).toBe("M");
    expect(out.confidence).toBe("high");
    expect(out.alternative_size).toBe("L"); // S and L tie at 3.5 → larger wins
    expect(out.zones).toEqual({
      bust: { class: "good", note: "Sits comfortably at the bust." },
      waist: { class: "good", note: "Sits comfortably at the waist." },
      hip: { class: "good", note: "Sits comfortably at the hip." },
    });
    expect(out.silhouette).toEqual({ bust: 37, waist: 29, hip: 39 });
    expect(out.length_note).toBeNull();
  });

  it("breaks an exact score tie by sizing up (prefer the larger size)", () => {
    // body is on the M/L boundary: both score 0. Tie-break → L. Two equally
    // good sizes means the margin is not clear → medium, not high.
    const out = recommendFit({ bust: 34, waist: 26.5, hip: 36 }, regular());

    expect(out.recommended_size).toBe("L");
    expect(out.alternative_size).toBe("M");
    expect(out.confidence).toBe("medium");
  });

  it("does NOT size up past a strictly-better smaller size for non-shrink fabric", () => {
    // M scores 0 (all good); L scores 1.0 (hip relaxed). No shrink fabric, so
    // the tie margin is 0 and M wins. Margin to L is exactly 1.0 → high.
    const body = { bust: 34, waist: 26.5, hip: 34 };
    const out = recommendFit(body, regular({ fabric: "formal" }));

    expect(out.recommended_size).toBe("M");
    expect(out.alternative_size).toBe("L");
    expect(out.confidence).toBe("high");
  });

  it("sizes up for shrink-prone fabric (lawn) within the bump margin", () => {
    // Same body as above, but lawn shrinks → widen the margin to 1.0, pulling
    // the recommendation up to L even though M scores slightly better.
    const body = { bust: 34, waist: 26.5, hip: 34 };
    const out = recommendFit(body, regular({ fabric: "lawn" }));

    expect(out.recommended_size).toBe("L");
    expect(out.alternative_size).toBe("M");
    expect(out.confidence).toBe("medium");
  });

  it("returns low confidence when even the best size has a too_tight zone", () => {
    // body exceeds the largest chart everywhere → XL is the least-bad but still
    // too tight. Confidence must be low and the bust note must offer sizing up.
    const out = recommendFit({ bust: 42, waist: 34, hip: 44 }, regular());

    expect(out.recommended_size).toBe("XL");
    expect(out.confidence).toBe("low");
    expect(out.zones.bust.class).toBe("too_tight");
    expect(out.zones.bust.note).toBe(
      "This may feel tight at the bust — consider the larger size."
    );
  });
});

describe("recommendFit (length + garment type)", () => {
  it("handles a one_piece with no trouser fields and no length data", () => {
    const onePieceRows = regularRows.map((r) => ({
      ...r,
      kameezLength: null,
      trouserWaist: null,
      trouserLength: null,
    }));
    const out = recommendFit(
      { bust: 33, waist: 25, hip: 35 },
      { fitType: "regular", garmentType: "one_piece", rows: onePieceRows }
    );

    expect(out.recommended_size).toBe("M");
    expect(out.length_note).toBeNull(); // no kameezLength → nothing to say
    expect(out.zones).not.toHaveProperty("trouserWaist");
    expect(Object.keys(out.zones)).toEqual(["bust", "waist", "hip"]);
  });

  it("emits an advisory hem note from the recommended size's length + height", () => {
    const rowsWithLength = regularRows.map((r) => ({
      ...r,
      kameezLength: r.sortOrder === 2 ? 40 : 38, // M = 40in
    }));
    const out = recommendFit(
      { bust: 33, waist: 25, hip: 35, height: 64 },
      { fitType: "regular", rows: rowsWithLength }
    );

    expect(out.recommended_size).toBe("M");
    expect(out.length_note).toBe("Falls at the knee at your height."); // 40/64
  });

  it("throws on an empty chart rather than guessing", () => {
    expect(() =>
      recommendFit({ bust: 33, waist: 25, hip: 35 }, { fitType: "regular", rows: [] })
    ).toThrow();
  });
});
