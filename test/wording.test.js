import { describe, it, expect } from "vitest";
import { noteFor, summaryFor } from "../src/services/wording.js";

// Hard rule (CLAUDE.md #1 / spec §5): phrases describe the GARMENT, keyed only
// on (zone, class) and (size role). No body adjectives, no numbers.
const ZONES = ["bust", "waist", "hip"];
const CLASSES = ["too_tight", "snug", "good", "relaxed", "too_loose"];
const ROLES = ["best", "fitted", "roomier", "tight", "loose"];

// "smaller"/"larger" (about the SIZE option) are allowed; true body words are not.
const BANNED_WORDS = /\b(big|small|large body|fat|thin|slim|slender|curvy|plus|wide|narrow|chubby)\b/i;
const HAS_DIGIT = /\d/;

describe("noteFor (§5 garment-focused wording)", () => {
  it("produces the approved per-zone phrase, interpolating the zone", () => {
    expect(noteFor("bust", "too_tight")).toBe(
      "Likely to feel tight at the bust — the larger size will sit more easily."
    );
    expect(noteFor("waist", "snug")).toBe("Sits close and fitted at the waist.");
    expect(noteFor("hip", "good")).toBe(
      "Sits comfortably at the hip, with easy room to move."
    );
    expect(noteFor("waist", "relaxed")).toBe(
      "Falls a little loose at the waist, with room to spare."
    );
    expect(noteFor("bust", "too_loose")).toBe(
      "Sits quite loose at the bust — the smaller size will sit closer."
    );
  });

  it("throws on an unknown class rather than emitting nothing", () => {
    expect(() => noteFor("bust", "nonsense")).toThrow();
  });
});

describe("summaryFor (§5 per-size summary labels)", () => {
  it("maps each size role to its garment-focused label", () => {
    expect(summaryFor("best")).toBe("Your best fit");
    expect(summaryFor("fitted")).toBe("A more fitted look");
    expect(summaryFor("roomier")).toBe("A roomier look");
    expect(summaryFor("tight")).toBe("May feel tight");
    expect(summaryFor("loose")).toBe("Quite loose");
  });

  it("throws on an unknown role", () => {
    expect(() => summaryFor("nonsense")).toThrow();
  });
});

describe("no body adjectives / no numbers across ALL wording", () => {
  it("holds for every zone × class note", () => {
    for (const zone of ZONES) {
      for (const cls of CLASSES) {
        const note = noteFor(zone, cls);
        expect(note).not.toMatch(BANNED_WORDS);
        expect(note).not.toMatch(HAS_DIGIT);
      }
    }
  });

  it("holds for every size summary", () => {
    for (const role of ROLES) {
      const s = summaryFor(role);
      expect(s).not.toMatch(BANNED_WORDS);
      expect(s).not.toMatch(HAS_DIGIT);
    }
  });
});
