// Wording layer (spec §5) — NON-NEGOTIABLE hard rule (CLAUDE.md #1):
// Describe the GARMENT at a point, never the body. No body adjectives anywhere,
// and no numbers (no false precision). Per-zone phrases are keyed ONLY on
// (zone, class); per-size summaries are keyed ONLY on a size "role".

/**
 * Per-zone phrase templates per class. `{zone}` is the only interpolation, and
 * it is a garment location ("bust"/"waist"/"hip"), not a body descriptor.
 * "smaller"/"larger" refer to the SIZE option, never the wearer.
 * @type {Record<string, string>}
 */
const CLASS_PHRASE = {
  too_tight: "Likely to feel tight at the {zone} — the larger size will sit more easily.",
  snug: "Sits close and fitted at the {zone}.",
  good: "Sits comfortably at the {zone}, with easy room to move.",
  relaxed: "Falls a little loose at the {zone}, with room to spare.",
  too_loose: "Sits quite loose at the {zone} — the smaller size will sit closer.",
};

/**
 * Per-size overall summary, keyed on the size's "role" relative to the
 * recommendation. Garment-focused, no body words, no numbers.
 * @type {Record<string, string>}
 */
const SIZE_SUMMARY = {
  best: "Your best fit",
  fitted: "A more fitted look",
  roomier: "A roomier look",
  tight: "May feel tight",
  loose: "Quite loose",
};

/**
 * Garment-focused note for a zone + class (spec §5 table).
 * @param {"bust"|"waist"|"hip"} zone
 * @param {keyof typeof CLASS_PHRASE} cls
 * @returns {string}
 */
export function noteFor(zone, cls) {
  const template = CLASS_PHRASE[cls];
  if (!template) throw new Error(`No phrasing for class "${cls}"`);
  return template.replace("{zone}", zone);
}

/**
 * Garment-focused overall summary label for a size, by role.
 * @param {keyof typeof SIZE_SUMMARY} role  best|fitted|roomier|tight|loose
 * @returns {string}
 */
export function summaryFor(role) {
  const label = SIZE_SUMMARY[role];
  if (!label) throw new Error(`No summary for size role "${role}"`);
  return label;
}
