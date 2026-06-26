import { z } from "zod";

// Sanity range for body measurements in inches (spec §7): reject negatives and
// anything outside a plausible human range early, with a 422. Height shares the
// same band — 80in covers tall shoppers, 20in floors out nonsense.
export const MIN_INCHES = 20;
export const MAX_INCHES = 80;

const measurement = z
  .number({ invalid_type_error: "must be a number" })
  .finite()
  .min(MIN_INCHES, `must be ≥ ${MIN_INCHES}in`)
  .max(MAX_INCHES, `must be ≤ ${MAX_INCHES}in`);

/** Body for POST /v1/fit/recommend (spec §7). `height` is optional (used for length). */
export const recommendRequestSchema = z
  .object({
    outlet_key: z.string().min(1, "outlet_key is required"),
    sku: z.string().min(1, "sku is required"),
    measurements: z
      .object({
        bust: measurement,
        waist: measurement,
        hip: measurement,
        height: measurement.optional(),
      })
      .strict(),
  })
  .strict();

// --- Admin schemas (spec §7) -------------------------------------------------

const fitType = z.enum(["fitted", "regular", "loose"]);
const garmentType = z.enum(["one_piece", "two_piece"]);

// Chart "to-fit" body measurement in inches (spec §3). Generous upper bound to
// catch nonsense (incl. long kameez/trouser lengths) without over-constraining.
// `.nullish()` = optional + nullable (e.g. trouser fields are null for one_piece).
const chartInches = z.number().finite().positive().max(120);

/** POST /v1/admin/templates */
export const createTemplateSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    fitType,
  })
  .strict();

const sizeRowSchema = z
  .object({
    sizeLabel: z.string().min(1, "sizeLabel is required"),
    sortOrder: z.number().int(),
    bust: chartInches.nullish(),
    waist: chartInches.nullish(),
    hip: chartInches.nullish(),
    kameezLength: chartInches.nullish(),
    trouserWaist: chartInches.nullish(),
    trouserLength: chartInches.nullish(),
  })
  .strict();

/**
 * POST /v1/admin/templates/:id/rows — full replace of a template's size rows.
 * sizeLabel must be unique within the set (mirrors the DB @@unique constraint,
 * so a clean 422 beats a Prisma P2002 500).
 */
export const replaceRowsSchema = z
  .object({
    rows: z.array(sizeRowSchema).min(1, "at least one row is required"),
  })
  .strict()
  .refine(
    (d) => new Set(d.rows.map((r) => r.sizeLabel)).size === d.rows.length,
    { message: "sizeLabel values must be unique within a template", path: ["rows"] }
  );

/** POST /v1/admin/products. Phase 2 cols accepted but unused in Phase 1 logic. */
export const createProductSchema = z
  .object({
    sku: z.string().min(1, "sku is required"),
    templateId: z.string().min(1, "templateId is required"),
    garmentType,
    name: z.string().min(1).nullish(),
    fabric: z.string().min(1).nullish(),
    fitTypeOverride: fitType.nullish(),
    // Phase 2 foresight columns (schema §3) — optional pass-through.
    colorSlot: z.number().int().nullish(),
    formality: z.string().min(1).nullish(),
    styleTag: z.string().min(1).nullish(),
  })
  .strict();

/** Flatten a ZodError into the API's { path, message }[] detail shape. */
export function zodDetails(error) {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
