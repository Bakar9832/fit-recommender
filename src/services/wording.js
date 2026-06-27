// Wording layer (spec §5) — NON-NEGOTIABLE hard rule (CLAUDE.md #1):
// Describe the GARMENT at a point, never the body. No body adjectives anywhere,
// and no numbers (no false precision). Per-zone phrases are keyed on
// (zone, class, severity, which neighbouring sizes exist); per-size summaries
// are keyed on a size "role".

/**
 * Phrases for classes that carry no directional "size up/down" suggestion.
 * `{zone}` is a garment location, never a body descriptor.
 * @type {Record<string, string>}
 */
const SIMPLE_PHRASE = {
  snug: "Sits close and fitted at the {zone}.",
  good: "Sits comfortably at the {zone}, with easy room to move.",
  relaxed: "Falls a little loose at the {zone}, with room to spare.",
};

// Degree-aware lead-ins for the extreme classes, so a borderline size and an
// extreme one never read the same. ("severe" vs "mild".)
const TIGHT_LEAD = {
  severe: "Likely to feel far too tight at the {zone}",
  mild: "Runs a touch tight at the {zone}",
};
const LOOSE_LEAD = {
  severe: "Sits very loose at the {zone}",
  mild: "Runs loose at the {zone}",
};

// Directional suggestions — appended ONLY when that size actually exists.
// "larger"/"smaller" describe the SIZE option, never the wearer.
const LARGER_SUGGESTION = " — the larger size will sit more easily.";
const SMALLER_SUGGESTION = " — the smaller size will sit closer.";

/**
 * Per-size overall summary, keyed on the size's "role" relative to the
 * recommendation. Garment-focused, no body words, no numbers.
 * @type {Record<string, string>}
 */
const SIZE_SUMMARY = {
  best: "Your best fit",
  closest: "Closest available — not a comfortable fit",
  fitted: "A more fitted look",
  roomier: "A roomier look",
  tight: "May feel tight",
  loose: "Quite loose",
};

/**
 * Garment-focused note for a zone + class (spec §5).
 * @param {"bust"|"waist"|"hip"} zone
 * @param {"too_tight"|"snug"|"good"|"relaxed"|"too_loose"} cls
 * @param {object} [opts]
 * @param {"severe"|"mild"} [opts.severity]  degree for the extreme classes
 * @param {boolean} [opts.hasLarger]  a larger size exists → may suggest sizing up
 * @param {boolean} [opts.hasSmaller] a smaller size exists → may suggest sizing down
 * @returns {string}
 */
export function noteFor(zone, cls, opts = {}) {
  if (SIMPLE_PHRASE[cls]) return SIMPLE_PHRASE[cls].replace("{zone}", zone);

  const severity = opts.severity === "mild" ? "mild" : "severe";

  if (cls === "too_tight") {
    const lead = TIGHT_LEAD[severity].replace("{zone}", zone);
    return lead + (opts.hasLarger ? LARGER_SUGGESTION : ".");
  }
  if (cls === "too_loose") {
    const lead = LOOSE_LEAD[severity].replace("{zone}", zone);
    return lead + (opts.hasSmaller ? SMALLER_SUGGESTION : ".");
  }
  throw new Error(`No phrasing for class "${cls}"`);
}

/**
 * Garment-focused overall summary label for a size, by role.
 * @param {keyof typeof SIZE_SUMMARY} role  best|closest|fitted|roomier|tight|loose
 * @returns {string}
 */
export function summaryFor(role) {
  const label = SIZE_SUMMARY[role];
  if (!label) throw new Error(`No summary for size role "${role}"`);
  return label;
}

/**
 * Honest headline when even the closest size still runs tight (no comfortable
 * fit). Garment-focused, no numbers.
 * @param {"bust"|"waist"|"hip"} zone  the tight zone to name
 * @param {boolean} isLargest  whether the closest size is the largest in the chart
 * @returns {string}
 */
export function noFitMessage(zone, isLargest) {
  const sizeRef = isLargest ? "the largest size" : "the closest size";
  return `This piece may not fit comfortably — ${sizeRef} still runs tight at the ${zone}.`;
}
