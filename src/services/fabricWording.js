// Wording for the unstitched fabric-sufficiency check (spec §11) — same hard rule
// as §5: describe the GARMENT/cloth, never the body. Guidance-framed (never a
// guarantee), and NO numbers in the prose (the numeric estimate lives in separate
// fields; the caveat covers precision).

/**
 * Garment-focused note per component, by whether the included cloth is enough.
 * Keyed only on (component, sufficient). "your size"/"your length" refer to the
 * garment dimension needed, not the wearer.
 */
const COMPONENT_NOTE = {
  shirtFront: {
    true: "The front piece should be enough for a kameez at your size.",
    false: "You may want extra fabric for the front piece at your length.",
  },
  shirtBack: {
    true: "The back piece should be enough for a kameez at your size.",
    false: "You may want extra fabric for the back piece at your length.",
  },
  sleeves: {
    true: "The sleeve fabric should be enough at your length.",
    false: "You may want extra sleeve fabric for your length.",
  },
  trouser: {
    true: "The trouser fabric should be enough at your length.",
    false: "You may want extra trouser fabric for your length.",
  },
  dupatta: {
    true: "The dupatta length should be enough.",
    false: "You may want a longer dupatta piece.",
  },
};

/** One-line caveat for the whole check — never oversell a coarse estimate. */
export const CAVEAT = "Estimated guidance — confirm with your tailor.";

/**
 * Garment-focused note for a component's sufficiency.
 * @param {"shirtFront"|"shirtBack"|"sleeves"|"trouser"|"dupatta"} component
 * @param {boolean} sufficient
 * @returns {string}
 */
export function fabricNote(component, sufficient) {
  const entry = COMPONENT_NOTE[component];
  if (!entry) throw new Error(`No fabric wording for component "${component}"`);
  return entry[sufficient ? "true" : "false"];
}
