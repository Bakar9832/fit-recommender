// Wording layer (spec §5) — NON-NEGOTIABLE hard rule (CLAUDE.md #1):
// Describe the GARMENT at a point, never the body. No body adjectives anywhere.
// The phrase is keyed ONLY on (zone, class) — nothing about the person.

/**
 * Phrase templates per class. `{zone}` is the only interpolation, and it is a
 * garment location ("bust"/"waist"/"hip"), not a body descriptor.
 * @type {Record<string, string>}
 */
const CLASS_PHRASE = {
  too_tight: "This may feel tight at the {zone} — consider the larger size.",
  snug: "Fitted at the {zone}.",
  good: "Sits comfortably at the {zone}.",
  relaxed: "A little loose at the {zone}.",
  too_loose: "Quite loose at the {zone} — the smaller size may sit better.",
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
