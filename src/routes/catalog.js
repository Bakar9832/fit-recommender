import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /v1/catalog?outlet_key=... — public, read-only product list for one outlet
// (powers the demo storefront). Tenant-scoped by outlet_key; no admin token.
// → 200 [{ id, sku, name, fabric, garmentType, imageSlug, model_reference }]
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
    }));

    return res.status(200).json(catalog);
  } catch (err) {
    return next(err);
  }
});

export default router;
