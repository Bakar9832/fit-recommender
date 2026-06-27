// Fit engine (spec §4) — the core. PURE functions only: takes plain objects,
// does no DB / network / I/O. The route layer (later PROGRESS item) loads the
// product + template rows via Prisma and passes them in here.

import {
  CIRC_ZONES,
  ZONE_PENALTY,
  ZONE_WEIGHT,
  classifyZone,
  bandsFor,
} from "./easeBands.js";
import { noteFor, summaryFor, noFitMessage } from "./wording.js";
import { lengthNote } from "./length.js";

// --- Selection tuning (spec §4.4, starting guesses; tune in validation pass) ---
const EPS = 1e-9;
/** Score within this of the best counts as a near-tie; resolved by sizing up. */
const BASE_TIE_MARGIN = 0; // exact ties only → prefer larger
/** Lawn/cotton shrink, so lean harder toward the larger size (§4.4). */
const SHRINK_TIE_MARGIN = 1.0;
const SHRINK_FABRICS = new Set(["lawn", "cotton"]);
/** Second-best must beat the winner by at least this for "high" confidence. */
const CLEAR_MARGIN = 1.0;
/** Inches past the too_tight/too_loose threshold before a zone reads "severe". */
const SEVERE_MARGIN = 4;

/**
 * Score one size row against the body (spec §4.2–§4.4).
 * Only zones present on BOTH body and row are scored; a missing zone simply
 * doesn't contribute (robust to partial charts).
 *
 * @returns {{ score: number, zones: Record<string, { class: string, ease: number }> }}
 */
function scoreSize(body, row, bands) {
  let score = 0;
  const zones = {};
  for (const zone of CIRC_ZONES) {
    const chart = row[zone];
    const bodyVal = body[zone];
    if (typeof chart !== "number" || typeof bodyVal !== "number") continue;
    const [lo, hi] = bands[zone];
    const ease = round2(chart - bodyVal);
    const cls = classifyZone(ease, [lo, hi]);
    score += ZONE_PENALTY[cls] * ZONE_WEIGHT[zone];
    zones[zone] = { class: cls, ease, severity: severityFor(cls, ease, lo, hi) };
  }
  return { score: round2(score), zones };
}

/**
 * Degree for an extreme zone: how far past the comfortable range the ease sits.
 * "severe" once it's SEVERE_MARGIN inches past the threshold, else "mild".
 * @returns {"severe"|"mild"|null}
 */
function severityFor(cls, ease, lo, hi) {
  if (cls === "too_tight") return (lo - 1) - ease >= SEVERE_MARGIN ? "severe" : "mild";
  if (cls === "too_loose") return ease - (hi + 2) >= SEVERE_MARGIN ? "severe" : "mild";
  return null;
}

/**
 * Recommend a size for a body against a product's chart (spec §4, output §4.6).
 *
 * @param {{ bust:number, waist:number, hip:number, height?:number }} body  inches
 * @param {object} product
 * @param {"fitted"|"regular"|"loose"} product.fitType   effective fit type
 *        (caller resolves product.fitTypeOverride ?? template.fitType)
 * @param {string|null} [product.fabric]                 drives shrink size-up hint
 * @param {Array<{ sizeLabel:string, sortOrder:number, bust?:number, waist?:number,
 *        hip?:number, kameezLength?:number }>} product.rows  one per size
 * @returns {object} spec §4.6 output object (snake_case keys for the API)
 */
export function recommendFit(body, product) {
  const { fitType, fabric = null, rows } = product;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("recommendFit: product.rows must be a non-empty array");
  }
  const bands = bandsFor(fitType);

  // Score every size, smallest → largest, so tie-breaks naturally prefer larger.
  const scored = [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ row, ...scoreSize(body, row, bands) }));

  const minScore = Math.min(...scored.map((s) => s.score));

  // Tie-break: among sizes within the margin of the best, take the LARGEST.
  // Shrink-prone fabric widens the margin so we size up more readily (§4.4).
  const tieMargin = SHRINK_FABRICS.has(fabric) ? SHRINK_TIE_MARGIN : BASE_TIE_MARGIN;
  const candidates = scored.filter((s) => s.score <= minScore + tieMargin + EPS);
  const winner = candidates.reduce((a, b) =>
    b.row.sortOrder > a.row.sortOrder ? b : a
  );

  // Alternative = next-best by score, excluding the winner (tie → larger).
  const alternative = scored
    .filter((s) => s !== winner)
    .sort((a, b) => a.score - b.score || b.row.sortOrder - a.row.sortOrder)[0] ?? null;

  const confidence = scoreConfidence(winner, alternative);

  // No genuine fit: even the best-scoring size still runs tight somewhere, so we
  // frame it honestly as the closest available rather than a comfortable "best".
  const n = scored.length;
  const winnerIdx = scored.indexOf(winner);
  const winnerHasTooTight = hasTooTight(winner.zones);
  const fits_comfortably = !winnerHasTooTight;

  // Build the per-zone notes for the recommended size (garment-focused, §5).
  // Neighbour flags gate the "size up/down" suggestions to sizes that exist.
  const zones = zonesWithNotes(winner.zones, winnerIdx > 0, winnerIdx < n - 1);

  // Multi-size view: every size in the chart, in order, each with its own
  // per-zone notes and a garment-focused overall summary. The recommended size
  // is flagged here too. (Keeps the single-size fields above for compatibility.)
  const sizes = scored.map((entry, i) => ({
    size: entry.row.sizeLabel,
    recommended: entry === winner,
    zones: zonesWithNotes(entry.zones, i > 0, i < n - 1),
    summary: summaryFor(sizeRole(entry, winner, fits_comfortably)),
  }));

  const fit_message = fits_comfortably
    ? null
    : noFitMessage(primaryTightZone(winner.zones), winnerIdx === n - 1);

  return {
    recommended_size: winner.row.sizeLabel,
    confidence,
    fits_comfortably,
    fit_message,
    alternative_size: alternative ? alternative.row.sizeLabel : null,
    zones,
    sizes,
    length_note: lengthNote(winner.row.kameezLength, body.height),
    silhouette: {
      bust: winner.row.bust ?? null,
      waist: winner.row.waist ?? null,
      hip: winner.row.hip ?? null,
    },
  };
}

/**
 * Attach garment-focused notes (§5) to a scored size's per-zone classes.
 * @param {Record<string,{class:string,severity:?string}>} scoredZones
 * @param {boolean} hasSmaller a smaller size exists (gate "smaller size" hint)
 * @param {boolean} hasLarger  a larger size exists (gate "larger size" hint)
 */
function zonesWithNotes(scoredZones, hasSmaller, hasLarger) {
  const out = {};
  for (const zone of Object.keys(scoredZones)) {
    const z = scoredZones[zone];
    out[zone] = {
      class: z.class,
      note: noteFor(zone, z.class, {
        severity: z.severity,
        hasSmaller,
        hasLarger,
      }),
    };
  }
  return out;
}

function hasTooTight(zones) {
  return Object.values(zones).some((z) => z.class === "too_tight");
}

/** Highest-weight zone (bust > waist > hip) that is too_tight, or null. */
function primaryTightZone(zones) {
  for (const zone of CIRC_ZONES) {
    if (zones[zone] && zones[zone].class === "too_tight") return zone;
  }
  return null;
}

/**
 * Garment-focused role for a size in the multi-size view:
 *   best    — the recommended size, and it fits comfortably
 *   closest — the recommended size, but no size fits comfortably (still tight)
 *   tight   — has any too_tight zone
 *   loose   — has any too_loose zone
 *   fitted  — otherwise, smaller than the recommended size (sits closer)
 *   roomier — otherwise, larger than the recommended size (more room)
 */
function sizeRole(entry, winner, fitsComfortably) {
  if (entry === winner) return fitsComfortably ? "best" : "closest";
  const classes = Object.values(entry.zones).map((z) => z.class);
  if (classes.includes("too_tight")) return "tight";
  if (classes.includes("too_loose")) return "loose";
  return entry.row.sortOrder < winner.row.sortOrder ? "fitted" : "roomier";
}

/**
 * Confidence (spec §4.4):
 *   low    if the winning size still has any too_tight zone
 *   high   if the winning score ≈ 0 AND the margin to the next size is clear
 *   medium otherwise
 */
function scoreConfidence(winner, alternative) {
  const hasTooTight = Object.values(winner.zones).some(
    (z) => z.class === "too_tight"
  );
  if (hasTooTight) return "low";

  const secondScore = alternative ? alternative.score : Infinity;
  const marginClear = secondScore - winner.score >= CLEAR_MARGIN;
  if (winner.score <= EPS && marginClear) return "high";

  return "medium";
}

/** Round to 2dp to keep float ease/score comparisons and output stable. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
