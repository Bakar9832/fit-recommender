// Length-to-hem descriptor (spec §4.5). Advisory ONLY — never changes the
// recommended size. kameezLength is a garment length, not a circumference, so
// it does NOT go through the ease bands.
//
// The ratio bands below are STARTING GUESSES — calibrate on a few real garments
// (PROGRESS open questions). They map garment-length / height to a hem position.

/**
 * Ratio (kameezLength / height) → hem descriptor. Ascending, first match wins.
 * @type {{ maxRatio: number, hem: string }[]}
 */
const HEM_BANDS = [
  { maxRatio: 0.58, hem: "above knee" },
  { maxRatio: 0.63, hem: "at knee" },
  { maxRatio: 0.68, hem: "below knee" },
  { maxRatio: Infinity, hem: "mid-calf" },
];

/** Hem descriptor → shopper-facing sentence (garment-focused, like §5). */
const HEM_PHRASE = {
  "above knee": "Falls above the knee at your height.",
  "at knee": "Falls at the knee at your height.",
  "below knee": "Falls just below the knee at your height.",
  "mid-calf": "Falls around mid-calf at your height.",
};

/**
 * Build the advisory length note (spec §4.5).
 * - height + length present → hem position relative to height.
 * - length present, no height → raw length only, no hem claim.
 * - no length data → null (nothing to say).
 *
 * @param {number|null|undefined} kameezLength  garment length in inches
 * @param {number|null|undefined} height        shopper height in inches
 * @returns {string|null}
 */
export function lengthNote(kameezLength, height) {
  if (kameezLength == null) return null;

  if (height == null) {
    // No height → cannot claim a hem position; report the raw length only.
    // String() already drops trailing ".0" (40, 40.5), so no formatting needed.
    return `Garment length: ${kameezLength}in.`;
  }

  const ratio = kameezLength / height;
  const { hem } = HEM_BANDS.find((b) => ratio < b.maxRatio) ?? HEM_BANDS.at(-1);
  return HEM_PHRASE[hem];
}
