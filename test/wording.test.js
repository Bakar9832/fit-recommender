import { describe, it, expect } from "vitest";
import { noteFor } from "../src/services/wording.js";

// Hard rule (CLAUDE.md #1 / spec §5): phrases describe the GARMENT, keyed only
// on (zone, class). These assert the exact approved strings, and that no body
// adjective leaks in.
describe("noteFor (§5 garment-focused wording)", () => {
  it("produces the approved phrase per class, interpolating the zone", () => {
    expect(noteFor("bust", "too_tight")).toBe(
      "This may feel tight at the bust — consider the larger size."
    );
    expect(noteFor("waist", "snug")).toBe("Fitted at the waist.");
    expect(noteFor("hip", "good")).toBe("Sits comfortably at the hip.");
    expect(noteFor("waist", "relaxed")).toBe("A little loose at the waist.");
    expect(noteFor("bust", "too_loose")).toBe(
      "Quite loose at the bust — the smaller size may sit better."
    );
  });

  it("never emits body adjectives for any zone/class combination", () => {
    const banned = /\b(big|small|large body|fat|thin|slim|curvy|plus|wide|narrow)\b/i;
    const zones = ["bust", "waist", "hip"];
    const classes = ["too_tight", "snug", "good", "relaxed", "too_loose"];
    for (const zone of zones) {
      for (const cls of classes) {
        expect(noteFor(zone, cls)).not.toMatch(banned);
      }
    }
  });

  it("throws on an unknown class rather than emitting nothing", () => {
    expect(() => noteFor("bust", "nonsense")).toThrow();
  });
});
