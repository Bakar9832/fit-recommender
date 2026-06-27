import { describe, it, expect } from "vitest";
import { noteFor, summaryFor, noFitMessage } from "../src/services/wording.js";

// Hard rule (CLAUDE.md #1 / spec §5): phrases describe the GARMENT, keyed only
// on (zone, class, degree, neighbours) and (size role). No body adjectives, no numbers.
const ZONES = ["bust", "waist", "hip"];
const CLASSES = ["too_tight", "snug", "good", "relaxed", "too_loose"];
const ROLES = ["best", "closest", "fitted", "roomier", "tight", "loose"];

// "smaller"/"larger" (about the SIZE option) are allowed; true body words are not.
const BANNED_WORDS = /\b(big|small|large body|fat|thin|slim|slender|curvy|plus|wide|narrow|chubby)\b/i;
const HAS_DIGIT = /\d/;

describe("noteFor (§5 garment-focused wording)", () => {
  it("produces degree-aware tight phrasing, suggesting a larger size only when one exists", () => {
    expect(noteFor("bust", "too_tight", { severity: "severe", hasLarger: true })).toBe(
      "Likely to feel far too tight at the bust — the larger size will sit more easily."
    );
    expect(noteFor("bust", "too_tight", { severity: "mild", hasLarger: true })).toBe(
      "Runs a touch tight at the bust — the larger size will sit more easily."
    );
    // No larger size → no suggestion.
    expect(noteFor("bust", "too_tight", { severity: "mild", hasLarger: false })).toBe(
      "Runs a touch tight at the bust."
    );
    expect(noteFor("bust", "too_tight", { severity: "severe", hasLarger: false })).toBe(
      "Likely to feel far too tight at the bust."
    );
  });

  it("produces degree-aware loose phrasing, suggesting a smaller size only when one exists", () => {
    expect(noteFor("hip", "too_loose", { severity: "severe", hasSmaller: true })).toBe(
      "Sits very loose at the hip — the smaller size will sit closer."
    );
    expect(noteFor("hip", "too_loose", { severity: "mild", hasSmaller: false })).toBe(
      "Runs loose at the hip."
    );
  });

  it("produces the simple (non-directional) phrases", () => {
    expect(noteFor("waist", "snug")).toBe("Sits close and fitted at the waist.");
    expect(noteFor("hip", "good")).toBe("Sits comfortably at the hip, with easy room to move.");
    expect(noteFor("waist", "relaxed")).toBe("Falls a little loose at the waist, with room to spare.");
  });

  it("throws on an unknown class rather than emitting nothing", () => {
    expect(() => noteFor("bust", "nonsense")).toThrow();
  });
});

describe("summaryFor (§5 per-size summary labels)", () => {
  it("maps each size role to its garment-focused label", () => {
    expect(summaryFor("best")).toBe("Your best fit");
    expect(summaryFor("closest")).toBe("Closest available — not a comfortable fit");
    expect(summaryFor("fitted")).toBe("A more fitted look");
    expect(summaryFor("roomier")).toBe("A roomier look");
    expect(summaryFor("tight")).toBe("May feel tight");
    expect(summaryFor("loose")).toBe("Quite loose");
  });

  it("throws on an unknown role", () => {
    expect(() => summaryFor("nonsense")).toThrow();
  });
});

describe("noFitMessage (honest no-comfortable-fit headline)", () => {
  it("names the largest size when the closest IS the largest", () => {
    expect(noFitMessage("bust", true)).toBe(
      "This piece may not fit comfortably — the largest size still runs tight at the bust."
    );
  });
  it("says 'the closest size' otherwise", () => {
    expect(noFitMessage("waist", false)).toBe(
      "This piece may not fit comfortably — the closest size still runs tight at the waist."
    );
  });
});

describe("no body adjectives / no numbers across ALL wording", () => {
  it("holds for every zone × class note, across degrees and neighbour combos", () => {
    const combos = [
      { severity: "severe", hasLarger: true, hasSmaller: true },
      { severity: "mild", hasLarger: false, hasSmaller: false },
    ];
    for (const zone of ZONES) {
      for (const cls of CLASSES) {
        for (const opts of combos) {
          const note = noteFor(zone, cls, opts);
          expect(note).not.toMatch(BANNED_WORDS);
          expect(note).not.toMatch(HAS_DIGIT);
        }
      }
    }
  });

  it("holds for every size summary and the no-fit message", () => {
    for (const role of ROLES) {
      const s = summaryFor(role);
      expect(s).not.toMatch(BANNED_WORDS);
      expect(s).not.toMatch(HAS_DIGIT);
    }
    for (const zone of ZONES) {
      for (const isLargest of [true, false]) {
        const m = noFitMessage(zone, isLargest);
        expect(m).not.toMatch(BANNED_WORDS);
        expect(m).not.toMatch(HAS_DIGIT);
      }
    }
  });
});
