import { describe, it, expect } from "vitest";
import { checkFabric } from "../src/services/fabricEngine.js";
import { neededFor, lengthBand } from "../src/services/fabricRequirements.js";
import { fabricNote, CAVEAT } from "../src/services/fabricWording.js";
import { createProductSchema } from "../src/lib/validation.js";

const COMPONENTS = ["shirtFront", "shirtBack", "sleeves", "trouser", "dupatta"];
// Same hard rule as §5: garment-focused, no body words, no numbers.
const BANNED = /\b(big|small|large body|fat|thin|slim|slender|curvy|plus|wide|narrow|chubby)\b/i;

describe("checkFabric (per-component sufficiency)", () => {
  it("checks each component independently as sufficient / not", () => {
    // regular band (height 64): front/back need 1.43, sleeves need 0.72
    const out = checkFabric({
      measurements: { height: 64 },
      garments: ["kameez_kurti"],
      included: { shirtFront: 1.5, shirtBack: 1.5, sleeves: 0.5 },
    });
    const by = Object.fromEntries(out.components.map((c) => [c.component, c]));

    expect(by.shirtFront.sufficient).toBe(true);
    expect(by.shirtBack.sufficient).toBe(true);
    expect(by.sleeves.sufficient).toBe(false); // 0.5 < 0.72
    expect(out.all_sufficient).toBe(false);
    expect(out.caveat).toBe(CAVEAT);
  });

  it("flags a too-short FRONT even when the other pieces are ample", () => {
    // tall band (height 70): front needs 1.65; front 1.6 falls short, others fine.
    const out = checkFabric({
      measurements: { height: 70 },
      garments: ["kameez_kurti"],
      included: { shirtFront: 1.6, shirtBack: 1.8, sleeves: 1.0 },
    });
    const by = Object.fromEntries(out.components.map((c) => [c.component, c]));

    expect(by.shirtFront.sufficient).toBe(false);
    expect(by.shirtBack.sufficient).toBe(true);
    expect(by.sleeves.sufficient).toBe(true);
    expect(out.all_sufficient).toBe(false);
    expect(by.shirtFront.note).toBe(
      "You may want extra fabric for the front piece at your length."
    );
  });

  it("handles a full kameez + trousers + dupatta from one fabric set", () => {
    const out = checkFabric({
      measurements: { height: 64 },
      garments: ["kameez_kurti", "trousers", "dupatta"],
      included: { shirtFront: 1.5, shirtBack: 1.5, sleeves: 0.8, trouser: 3.0, dupatta: 3.0 },
    });
    expect(out.components.map((c) => c.component)).toEqual([
      "shirtFront", "shirtBack", "sleeves", "trouser", "dupatta",
    ]);
    expect(out.all_sufficient).toBe(true);
  });

  it("treats a missing included component as not sufficient (included: null)", () => {
    const out = checkFabric({
      measurements: { height: 64 },
      garments: ["kameez_kurti"],
      included: { shirtFront: 1.5, shirtBack: 1.5 }, // sleeves omitted
    });
    const sleeves = out.components.find((c) => c.component === "sleeves");
    expect(sleeves.included).toBeNull();
    expect(sleeves.sufficient).toBe(false);
  });

  it("gives different needs for clearly different sizes (coarse bands)", () => {
    const incl = { shirtFront: 5, shirtBack: 5, sleeves: 5 };
    const short = checkFabric({ measurements: { height: 60 }, garments: ["kameez_kurti"], included: incl });
    const tall = checkFabric({ measurements: { height: 72 }, garments: ["kameez_kurti"], included: incl });
    const sf = (o) => o.components.find((c) => c.component === "shirtFront").needed_estimate;
    expect(sf(short)).toBeLessThan(sf(tall)); // 1.21 < 1.65
    expect(lengthBand(60)).toBe("short");
    expect(lengthBand(72)).toBe("tall");
  });

  it("throws on an empty garment list or unknown garment", () => {
    expect(() => checkFabric({ measurements: {}, garments: [], included: {} })).toThrow();
    expect(() =>
      checkFabric({ measurements: {}, garments: ["lehenga"], included: {} })
    ).toThrow();
  });
});

describe("fabric wording (guidance, garment-focused)", () => {
  it("emits no body words and no numbers across every component note", () => {
    for (const component of COMPONENTS) {
      for (const sufficient of [true, false]) {
        const note = fabricNote(component, sufficient);
        expect(note).not.toMatch(BANNED);
        expect(note).not.toMatch(/\d/);
      }
    }
    expect(CAVEAT).not.toMatch(BANNED);
  });
});

describe("neededFor includes the safety margin", () => {
  it("applies +10% to the base band value", () => {
    expect(neededFor("kameez_kurti", "shirtFront", "tall")).toBe(1.65); // 1.5 * 1.1
    expect(neededFor("kameez_kurti", "sleeves", "regular")).toBe(0.72); // 0.65 * 1.1
  });
});

describe("createProductSchema — unstitched yardage rule (spec §11)", () => {
  const base = { sku: "U-1", templateId: "tpl_1", garmentType: "two_piece" };

  it("rejects an unstitched product missing any component yardage", () => {
    const res = createProductSchema.safeParse({
      ...base,
      unstitched: true,
      fabricShirtFront: 1.3,
      fabricShirtBack: 1.3,
      fabricSleeves: 0.7,
      // trouser + dupatta missing
    });
    expect(res.success).toBe(false);
    const paths = res.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("fabricTrouser");
    expect(paths).toContain("fabricDupatta");
  });

  it("accepts an unstitched product with all five yardages", () => {
    const res = createProductSchema.safeParse({
      ...base,
      unstitched: true,
      fabricShirtFront: 1.3,
      fabricShirtBack: 1.3,
      fabricSleeves: 0.7,
      fabricTrouser: 2.6,
      fabricDupatta: 2.5,
    });
    expect(res.success).toBe(true);
    expect(res.data.unstitched).toBe(true);
  });

  it("leaves stitched products unaffected (unstitched defaults false, no yardage needed)", () => {
    const res = createProductSchema.safeParse(base);
    expect(res.success).toBe(true);
    expect(res.data.unstitched).toBe(false);
  });
});
