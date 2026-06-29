import { Router } from "express";
import prisma from "../lib/prisma.js";
import { recommendRequestSchema } from "../lib/validation.js";
import { recommendFit } from "../services/fitEngine.js";
import { includedFabric } from "./catalog.js";

const router = Router();

// POST /v1/fit/recommend (spec §7 / §4)
// body: { outlet_key, sku, measurements: { bust, waist, hip, height? } }
// → 200 §4.6 object | 422 invalid measurements | 404 unknown outlet/sku
router.post("/v1/fit/recommend", async (req, res, next) => {
  // 1. Validate input. Any schema failure (missing/implausible measurements,
  //    missing keys) → 422 with field-level details.
  const parsed = recommendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: "invalid_request",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const { outlet_key: outletKey, sku, measurements } = parsed.data;

  try {
    // 2. Resolve the outlet (public outletKey → outletId). Multi-tenant scope
    //    starts here; every downstream query is bound to this outletId.
    const outlet = await prisma.outlet.findUnique({ where: { outletKey } });
    if (!outlet) {
      return res.status(404).json({ error: "outlet_not_found" });
    }

    // 3. Load the product + its template + ordered rows in ONE query (§4.1),
    //    scoped to this outlet via the composite (outletId, sku) key.
    const product = await prisma.product.findUnique({
      where: { outletId_sku: { outletId: outlet.id, sku } },
      include: {
        template: { include: { rows: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!product) {
      return res.status(404).json({ error: "product_not_found" });
    }

    // 4. Resolve effective fit type, run the pure engine, return the §4.6 object.
    const fitType = product.fitTypeOverride ?? product.template.fitType;
    const result = recommendFit(measurements, {
      fitType,
      fabric: product.fabric,
      garmentType: product.garmentType,
      rows: product.template.rows,
    });

    // 5. Supporting context for the frontend (no extra query — already loaded):
    //    the chart's garment measurements per size, and the product's optional
    //    fit-model reference (null when the outlet hasn't set one).
    const size_guide = product.template.rows.map((r) => ({
      size: r.sizeLabel,
      bust: r.bust,
      waist: r.waist,
      hip: r.hip,
      kameezLength: r.kameezLength,
      trouserWaist: r.trouserWaist,
      trouserLength: r.trouserLength,
    }));
    const model_reference =
      product.modelHeight || product.modelSizeWorn
        ? { height: product.modelHeight ?? null, size_worn: product.modelSizeWorn ?? null }
        : null;

    // Let the widget detect an unstitched item (it'll branch to the garment
    // picker next session). Stitched products → unstitched:false, included_fabric:null.
    return res.status(200).json({
      ...result,
      size_guide,
      model_reference,
      unstitched: product.unstitched,
      included_fabric: includedFabric(product),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
