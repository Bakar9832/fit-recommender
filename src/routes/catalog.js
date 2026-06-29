import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /v1/catalog?outlet_key=... — public, read-only product list for one outlet
// (powers the demo storefront). Tenant-scoped by outlet_key; no admin token.
// → 200 [{ id, sku, name, fabric, garmentType, imageSlug, model_reference,
//          unstitched, included_fabric }]
// → 422 missing outlet_key | 404 unknown outlet
router.get("/v1/catalog", async (req, res, next) => {
  const outletKey = req.query.outlet_key;
  if (typeof outletKey !== "string" || outletKey.trim() === "") {
    return res.status(422).json({ error: "invalid_request", details: "outlet_key is required" });
  }

  try {
    const outlet = await prisma.outlet.findUnique({ where: { outletKey } });
    if (!outlet) {
      return res.status(404).json({ error: "outlet_not_found" });
    }

    const products = await prisma.product.findMany({
      where: { outletId: outlet.id },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        fabric: true,
        garmentType: true,
        imageSlug: true,
        modelHeight: true,
        modelSizeWorn: true,
        unstitched: true,
        fabricShirtFront: true,
        fabricShirtBack: true,
        fabricSleeves: true,
        fabricTrouser: true,
        fabricDupatta: true,
      },
    });

    const catalog = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      fabric: p.fabric,
      garmentType: p.garmentType,
      imageSlug: p.imageSlug,
      model_reference:
        p.modelHeight || p.modelSizeWorn
          ? { height: p.modelHeight ?? null, size_worn: p.modelSizeWorn ?? null }
          : null,
      unstitched: p.unstitched,
      included_fabric: includedFabric(p),
    }));

    return res.status(200).json(catalog);
  } catch (err) {
    return next(err);
  }
});

/**
 * Per-component included yardage (meters) for an unstitched product, keyed to
 * match the fabric engine's `included` input. `null` for stitched products.
 * @param {object} p product row (with fabric* fields)
 */
export function includedFabric(p) {
  if (!p.unstitched) return null;
  return {
    shirtFront: p.fabricShirtFront ?? null,
    shirtBack: p.fabricShirtBack ?? null,
    sleeves: p.fabricSleeves ?? null,
    trouser: p.fabricTrouser ?? null,
    dupatta: p.fabricDupatta ?? null,
  };
}

export default router;
