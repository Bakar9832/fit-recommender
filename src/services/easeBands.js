// Ease bands + per-zone classification (spec §4.2, §4.3) + scoring weights (§4.4).
// Pure lookup tables and pure functions. No DB, no I/O.
//
// These numbers are STARTING GUESSES per the spec — tune them against a real
// outlet's chart + a tailor during the validation pass (spec §9, PROGRESS open
// questions). Keep them here as the single place to adjust.

/** Circumference zones scored by ease. Length is handled separately (§4.5). */
export const CIRC_ZONES = ["bust", "waist", "hip"];

/**
 * Ideal ease range [lo, hi] in inches, per fit type and zone (spec §4.2).
 * ease = chart_value - body. Higher ease = more room.
 */
export const EASE_BANDS = {
  fitted: { bust: [1.5, 3], waist: [1, 2.5], hip: [2, 3.5] },
  regular: { bust: [3, 5], waist: [2.5, 4.5], hip: [3, 5] },
  loose: { bust: [5, 8], waist: [4, 7], hip: [5, 8] },
};

/** Penalty per zone classification (spec §4.4). Lower is better. */
export const ZONE_PENALTY = {
  good: 0,
  snug: 1,
  relaxed: 1,
  too_tight: 4,
  too_loose: 3,
};

/** Bust/waist matter more than hip for pret fit (spec §4.4). */
export const ZONE_WEIGHT = { bust: 1.3, waist: 1.2, hip: 1.0 };

/**
 * Classify how a garment sits at one zone given its ease and the ideal [lo, hi].
 * Exact boundaries per spec §4.3:
 *   ease < lo - 1        → too_tight
 *   lo - 1 ≤ ease < lo   → snug
 *   lo ≤ ease ≤ hi       → good
 *   hi < ease ≤ hi + 2   → relaxed
 *   ease > hi + 2        → too_loose
 * The −1 / +2 margins encode the ±1in tolerance plus asymmetry (too-loose is
 * more forgiving than too-tight).
 *
 * @param {number} ease  chart_value - body, in inches
 * @param {[number, number]} band  [lo, hi] ideal ease for this zone/fit
 * @returns {"too_tight"|"snug"|"good"|"relaxed"|"too_loose"}
 */
export function classifyZone(ease, [lo, hi]) {
  if (ease < lo - 1) return "too_tight";
  if (ease < lo) return "snug"; // lo - 1 ≤ ease < lo
  if (ease <= hi) return "good"; // lo ≤ ease ≤ hi
  if (ease <= hi + 2) return "relaxed"; // hi < ease ≤ hi + 2
  return "too_loose"; // ease > hi + 2
}

/**
 * Resolve the ideal ease band for a fit type, throwing on an unknown type so
 * bad data fails loudly rather than silently mis-scoring.
 * @param {"fitted"|"regular"|"loose"} fitType
 */
export function bandsFor(fitType) {
  const bands = EASE_BANDS[fitType];
  if (!bands) {
    throw new Error(`Unknown fitType "${fitType}" (expected fitted|regular|loose)`);
  }
  return bands;
}
