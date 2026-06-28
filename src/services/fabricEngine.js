// Unstitched fabric-sufficiency engine (spec §11). PURE functions — plain objects
// in, plain object out, no DB / I/O. SEPARATE from the size-chart fit engine
// (recommendFit); stitched items never touch this path.
//
// It answers ONE question per component: is the included cloth enough to make the
// intended garment at the customer's size? It does NOT say what to make or how it
// will look. Body = INCHES, fabric = METERS.

import {
  GARMENT_COMPONENTS,
  lengthBand,
  neededFor,
  round2,
} from "./fabricRequirements.js";
import { fabricNote, CAVEAT } from "./fabricWording.js";

/**
 * Check, per component, whether included yardage suffices for the intended garments.
 *
 * @param {object} input
 * @param {{ bust?:number, waist?:number, hip?:number, height?:number }} input.measurements
 *        body measurements in inches; `height` drives the length band.
 * @param {Array<"kameez_kurti"|"trousers"|"dupatta">} input.garments  intended garment(s)
 * @param {{ shirtFront?:number, shirtBack?:number, sleeves?:number, trouser?:number, dupatta?:number }} input.included
 *        included cloth per component, in meters (from the product).
 * @returns {{ all_sufficient:boolean, caveat:string,
 *   components: Array<{ garment:string, component:string, needed_estimate:number,
 *     included:(number|null), sufficient:boolean, note:string }> }}
 */
export function checkFabric({ measurements, garments, included } = {}) {
  if (!Array.isArray(garments) || garments.length === 0) {
    throw new Error("checkFabric: garments must be a non-empty array");
  }
  if (!included || typeof included !== "object") {
    throw new Error("checkFabric: included must be an object of component meters");
  }

  const band = lengthBand(measurements ? measurements.height : undefined);
  const components = [];

  for (const garment of garments) {
    const comps = GARMENT_COMPONENTS[garment];
    if (!comps) throw new Error(`checkFabric: unknown garment "${garment}"`);

    // Each component is checked INDEPENDENTLY, so a too-short front is caught
    // even when other pieces (or the total cloth) would be ample.
    for (const component of comps) {
      const needed_estimate = neededFor(garment, component, band);
      const inc = included[component];
      const hasInc = typeof inc === "number" && isFinite(inc);
      const sufficient = hasInc && inc >= needed_estimate;
      components.push({
        garment,
        component,
        needed_estimate,
        included: hasInc ? round2(inc) : null,
        sufficient,
        note: fabricNote(component, sufficient),
      });
    }
  }

  return {
    all_sufficient: components.every((c) => c.sufficient),
    caveat: CAVEAT,
    components,
  };
}
