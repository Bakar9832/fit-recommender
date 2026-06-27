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
      bust: { class: "good", note: "Sits comfortably at the bust, with easy room to move." },
      waist: { class: "good", note: "Sits comfortably at the waist, with easy room to move." },
      hip: { class: "good", note: "Sits comfortably at the hip, with easy room to move." },
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
    // too tight. Confidence low, not comfortable, and — XL being the largest —
    // the note must NOT suggest a larger size.
    const out = recommendFit({ bust: 42, waist: 34, hip: 44 }, regular());

    expect(out.recommended_size).toBe("XL");
    expect(out.confidence).toBe("low");
    expect(out.fits_comfortably).toBe(false);
    expect(out.zones.bust.class).toBe("too_tight");
    expect(out.zones.bust.note).toBe("Runs a touch tight at the bust.");
    expect(out.zones.bust.note).not.toMatch(/larger size/);
  });
});

describe("recommendFit (no genuine fit + conditional/degree wording)", () => {
  it("flags fits_comfortably false with an honest message when nothing fits", () => {
    // bust 42 exceeds even XL (41) → the closest size still runs tight.
    const out = recommendFit({ bust: 42, waist: 30, hip: 36 }, regular());

    expect(out.recommended_size).toBe("XL");
    expect(out.confidence).toBe("low");
    expect(out.fits_comfortably).toBe(false);
    expect(out.fit_message).toBe(
      "This piece may not fit comfortably — the largest size still runs tight at the bust."
    );

    const xl = out.sizes.find((s) => s.size === "XL");
    expect(xl.recommended).toBe(true);
    // Closest available — framed honestly, NOT "your best fit".
    expect(xl.summary).toBe("Closest available — not a comfortable fit");
    // Largest size → no "larger size" suggestion.
    expect(xl.zones.bust.note).not.toMatch(/larger size/);
  });

  it("gives the smallest and largest tight zones DIFFERENT strings (degree + suggestion)", () => {
    const out = recommendFit({ bust: 42, waist: 30, hip: 36 }, regular());
    const s = out.sizes.find((x) => x.size === "S");
    const xl = out.sizes.find((x) => x.size === "XL");

    expect(s.zones.bust.class).toBe("too_tight");
    expect(xl.zones.bust.class).toBe("too_tight");
    expect(s.zones.bust.note).not.toBe(xl.zones.bust.note);

    // smallest: extreme read + suggests the larger size (one exists)
    expect(s.zones.bust.note).toBe(
      "Likely to feel far too tight at the bust — the larger size will sit more easily."
    );
    // largest: milder read + no suggestion (no larger size)
    expect(xl.zones.bust.note).toBe("Runs a touch tight at the bust.");
  });

  it("is comfortable (true / null message) for a clean pick", () => {
    const out = recommendFit({ bust: 33, waist: 25, hip: 35 }, regular());
    expect(out.fits_comfortably).toBe(true);
    expect(out.fit_message).toBeNull();
  });

  it("does not suggest a smaller size on the smallest size when too loose", () => {
    // body far below the chart → S is the least-loose, but it's the smallest,
    // so its too_loose note must not point to a (non-existent) smaller size.
    const out = recommendFit({ bust: 22, waist: 22, hip: 24 }, regular());
    const s = out.sizes.find((x) => x.size === "S");
    expect(s.zones.bust.class).toBe("too_loose");
    expect(s.zones.bust.note).not.toMatch(/smaller size/);
  });
});

describe("recommendFit (multi-size output)", () => {
  const banned = /\b(big|small|large body|fat|thin|slim|slender|curvy|plus|wide|narrow|chubby)\b/i;

  it("returns a sizes[] entry for EVERY chart size, with the recommended one flagged", () => {
    const out = recommendFit({ bust: 33, waist: 25, hip: 35 }, regular());

    expect(out.sizes.map((s) => s.size)).toEqual(["S", "M", "L", "XL"]);
    const flagged = out.sizes.filter((s) => s.recommended);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].size).toBe(out.recommended_size); // M
  });

  it("gives each size per-zone {class, note} and a garment-focused summary", () => {
    const out = recommendFit({ bust: 33, waist: 25, hip: 35 }, regular());
    const bySize = Object.fromEntries(out.sizes.map((s) => [s.size, s]));

    expect(bySize.M.summary).toBe("Your best fit");
    expect(bySize.S.summary).toBe("A more fitted look");
    expect(bySize.L.summary).toBe("A roomier look");
    expect(bySize.XL.summary).toBe("Quite loose"); // XL bust ease 8 → too_loose

    for (const s of out.sizes) {
      for (const z of ["bust", "waist", "hip"]) {
        expect(s.zones[z]).toHaveProperty("class");
        expect(typeof s.zones[z].note).toBe("string");
      }
    }
  });

  it("flags a too_tight size with the 'may feel tight' summary", () => {
    // body large → S/M will be too tight somewhere.
    const out = recommendFit({ bust: 40, waist: 32, hip: 42 }, regular());
    const s = out.sizes.find((x) => x.size === "S");
    expect(s.summary).toBe("May feel tight");
  });

  it("emits no body adjectives or numbers across ALL sizes' notes and summaries", () => {
    const out = recommendFit({ bust: 33, waist: 25, hip: 35 }, regular());
    for (const s of out.sizes) {
      expect(s.summary).not.toMatch(banned);
      expect(s.summary).not.toMatch(/\d/);
      for (const z of Object.values(s.zones)) {
        expect(z.note).not.toMatch(banned);
        expect(z.note).not.toMatch(/\d/);
      }
    }
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
