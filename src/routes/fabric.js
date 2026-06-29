import { Router } from "express";
import prisma from "../lib/prisma.js";
import { fabricCheckSchema } from "../lib/validation.js";
import { checkFabric } from "../services/fabricEngine.js";
import { includedFabric } from "./catalog.js";

const router = Router();

// POST /v1/fabric/check (spec §11) — public, tenant-scoped unstitched
// fabric-sufficiency. Loads the product's included yardage and runs checkFabric.
// body: { outlet_key, sku, measurements:{bust,waist,hip,height?}, garments:[...] }
// → 200 checkFabric output | 422 invalid | 404 unknown outlet/sku | 409 not unstitched
router.post("/v1/fabric/check", async (req, res, next) => {
  const parsed = fabricCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: "invalid_request",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const { outlet_key: outletKey, sku, measurements, garments } = parsed.data;

  try {
    const outlet = await prisma.outlet.findUnique({ where: { outletKey } });
    if (!outlet) return res.status(404).json({ error: "outlet_not_found" });

    const product = await prisma.product.findUnique({
      where: { outletId_sku: { outletId: outlet.id, sku } },
    });
    if (!product) return res.status(404).json({ error: "product_not_found" });

    // The size chart is meaningless for cloth — this endpoint is unstitched-only.
    if (!product.unstitched) return res.status(409).json({ error: "not_unstitched" });

    // includedFabric() returns the component-keyed meters the engine expects.
    const result = checkFabric({
      measurements,
      garments: Array.from(new Set(garments)), // de-dupe repeated picks
      included: includedFabric(product),
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
