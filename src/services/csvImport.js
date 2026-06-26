// CSV product-import planner (spec §8). PURE: no DB/I-O. The route gathers this
// outlet's templates + existing SKUs, calls planImport, then writes the result.
// Keeping it pure means the whole import policy is unit-testable in isolation.

import { createProductSchema, zodDetails } from "../lib/validation.js";

/**
 * Recognized CSV columns, in canonical order. `sku`, `template`, `garmentType`
 * are required; the rest optional. `template` references an existing template by
 * its id OR its name (scoped to the outlet). Phase 2 cols are accepted but unused.
 */
export const IMPORT_COLUMNS = [
  "sku",
  "template",
  "garmentType",
  "name",
  "fabric",
  "fitTypeOverride",
  "colorSlot",
  "formality",
  "styleTag",
];

export const REQUIRED_COLUMNS = ["sku", "template", "garmentType"];

/**
 * Plan an import from parsed CSV records.
 *
 * @param {Record<string,string>[]} records  trimmed row objects (csvToObjects)
 * @param {object} ctx
 * @param {{ id:string, name:string }[]} ctx.templates  this outlet's templates only
 * @param {Set<string>} ctx.existingSkus  SKUs already in this outlet
 * @returns {{ toInsert: object[], errors: { row:number, reason:string }[] }}
 *          toInsert holds validated product data (no outletId — caller adds it).
 *          `row` is the 1-based data-record number (header excluded).
 */
export function planImport(records, { templates, existingSkus }) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const byName = new Map();
  for (const t of templates) {
    if (!byName.has(t.name)) byName.set(t.name, []);
    byName.get(t.name).push(t);
  }

  const toInsert = [];
  const errors = [];
  const seenSkus = new Set(); // within-file dedupe

  records.forEach((rec, idx) => {
    const row = idx + 1;
    const fail = (reason) => errors.push({ row, reason });

    // Resolve the template reference within this tenant (id wins, then name).
    const templateRef = rec.template ?? "";
    if (!templateRef) return fail("missing template");

    let templateId;
    if (byId.has(templateRef)) {
      templateId = templateRef;
    } else {
      const matches = byName.get(templateRef) ?? [];
      if (matches.length === 0) return fail(`template not found: "${templateRef}"`);
      if (matches.length > 1) return fail(`ambiguous template name: "${templateRef}"`);
      templateId = matches[0].id;
    }

    // Build the candidate product, coercing numerics and dropping blanks so
    // optional fields don't trip the schema, then validate with the same Zod
    // schema the single-create route uses.
    const candidate = pruneEmpty({
      sku: rec.sku,
      templateId,
      garmentType: rec.garmentType,
      name: rec.name,
      fabric: rec.fabric,
      fitTypeOverride: rec.fitTypeOverride,
      colorSlot: numericOrUndefined(rec.colorSlot),
      formality: rec.formality,
      styleTag: rec.styleTag,
    });

    const parsed = createProductSchema.safeParse(candidate);
    if (!parsed.success) {
      const detail = zodDetails(parsed.error)
        .map((d) => `${d.path}: ${d.message}`)
        .join("; ");
      return fail(detail);
    }

    const { sku } = parsed.data;
    if (seenSkus.has(sku)) return fail(`duplicate sku within file: "${sku}"`);
    if (existingSkus.has(sku)) return fail(`sku already exists: "${sku}"`);

    seenSkus.add(sku);
    toInsert.push(parsed.data);
  });

  return { toInsert, errors };
}

/** Drop keys whose value is undefined or an empty string. */
function pruneEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** "" → undefined; otherwise Number() (NaN is kept so the schema rejects it). */
function numericOrUndefined(v) {
  if (v === undefined || v === "") return undefined;
  return Number(v);
}
