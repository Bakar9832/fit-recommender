// Unstitched fabric requirements (spec §11) — coarse, per-COMPONENT estimates of
// the cloth a garment needs, keyed to a height-derived length band, plus a safety
// margin. Pure lookup tables + helpers. No DB, no I/O.
//
// Units: body measurements are INCHES; fabric is METERS (matches how Pakistani
// unstitched suits are sold, e.g. "Shirt Front 1.25m").
//
// ⚠️ STARTING ESTIMATES — TAILOR-VALIDATION-PENDING. These bands are a first cut
// for a sufficiency CHECK (enough cloth or not), never a cutting plan. Tune with
// a real tailor before claiming accuracy. Keep this file the single place to edit.

/** Components a garment consumes (each checked independently for sufficiency). */
export const GARMENT_COMPONENTS = {
  kameez_kurti: ["shirtFront", "shirtBack", "sleeves"],
  trousers: ["trouser"],
  dupatta: ["dupatta"],
};

/** All fabric components an unstitched product can include (DB fields drop the prefix). */
export const FABRIC_COMPONENTS = ["shirtFront", "shirtBack", "sleeves", "trouser", "dupatta"];

/** Extra cloth beyond the raw estimate (seams/hems/cutting waste). Tunable. */
export const SAFETY_MARGIN = 0.1; // +10%

/**
 * Length band from height in inches (coarse). Height drives garment length, which
 * drives meters. Absent height → "regular" (documented fallback).
 * @param {number|undefined|null} height
 * @returns {"short"|"regular"|"tall"}
 */
export function lengthBand(height) {
  if (typeof height !== "number" || !isFinite(height)) return "regular";
  if (height < 62) return "short";
  if (height < 67) return "regular";
  return "tall";
}

/**
 * Base meters needed per garment + component + band, BEFORE the safety margin.
 * (kameez = front + back + sleeves; trousers = trouser; dupatta ≈ fixed length.)
 */
export const FABRIC_REQUIREMENTS = {
  kameez_kurti: {
    shirtFront: { short: 1.1, regular: 1.3, tall: 1.5 },
    shirtBack: { short: 1.1, regular: 1.3, tall: 1.5 },
    sleeves: { short: 0.55, regular: 0.65, tall: 0.8 },
  },
  trousers: {
    trouser: { short: 2.2, regular: 2.5, tall: 2.75 },
  },
  dupatta: {
    dupatta: { short: 2.4, regular: 2.5, tall: 2.5 },
  },
};

/**
 * Meters needed for one (garment, component) at a length band, margin included.
 * Throws on an unknown garment/component so bad input fails loudly.
 * @returns {number} meters, rounded to 2dp
 */
export function neededFor(garment, component, band) {
  const byComponent = FABRIC_REQUIREMENTS[garment];
  if (!byComponent || !byComponent[component]) {
    throw new Error(`No fabric requirement for garment "${garment}" component "${component}"`);
  }
  const base = byComponent[component][band];
  if (typeof base !== "number") {
    throw new Error(`No fabric requirement for band "${band}" (${garment}/${component})`);
  }
  return round2(base * (1 + SAFETY_MARGIN));
}

/** Round to 2dp, stable across float noise. */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
