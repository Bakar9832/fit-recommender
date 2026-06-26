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
