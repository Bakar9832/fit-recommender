import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { adminAuth } from "../lib/adminAuth.js";
import {
  createTemplateSchema,
  replaceRowsSchema,
  createProductSchema,
  zodDetails,
} from "../lib/validation.js";

const router = Router();

// Every admin route is token-guarded and pinned to req.outletId (hard rule #3).
router.use(adminAuth);

/** Parse with Zod or send a 422; returns parsed data, or null if it responded. */
function parseOr422(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(422).json({ error: "invalid_request", details: zodDetails(result.error) });
    return null;
  }
  return result.data;
}

// POST /v1/admin/templates — create a chart template for this outlet.
router.post("/templates", async (req, res, next) => {
  const data = parseOr422(createTemplateSchema, req.body, res);
  if (!data) return;
  try {
    const template = await prisma.sizeChartTemplate.create({
      data: { outletId: req.outletId, name: data.name, fitType: data.fitType },
    });
    return res.status(201).json(template);
  } catch (err) {
    return next(err);
  }
});

// POST /v1/admin/templates/:id/rows — full replace of a template's size rows.
router.post("/templates/:id/rows", async (req, res, next) => {
  const data = parseOr422(replaceRowsSchema, req.body, res);
  if (!data) return;
  try {
    // Tenant guard: the template must belong to THIS outlet, else 404 (never
    // act cross-tenant, never leak existence).
    const template = await prisma.sizeChartTemplate.findFirst({
      where: { id: req.params.id, outletId: req.outletId },
      select: { id: true },
    });
    if (!template) return res.status(404).json({ error: "template_not_found" });

    // Replace atomically: drop existing rows, insert the new set.
    const rows = data.rows.map((r) => ({ ...r, templateId: template.id }));
    const [, created] = await prisma.$transaction([
      prisma.sizeChartRow.deleteMany({ where: { templateId: template.id } }),
      prisma.sizeChartRow.createMany({ data: rows }),
    ]);

    return res.status(200).json({ templateId: template.id, rowCount: created.count });
  } catch (err) {
    return next(err);
  }
});

// POST /v1/admin/products — create a product referencing one of this outlet's templates.
router.post("/products", async (req, res, next) => {
  const data = parseOr422(createProductSchema, req.body, res);
  if (!data) return;
  try {
    // Tenant guard: the referenced template must belong to THIS outlet.
    const template = await prisma.sizeChartTemplate.findFirst({
      where: { id: data.templateId, outletId: req.outletId },
      select: { id: true },
    });
    if (!template) return res.status(404).json({ error: "template_not_found" });

    const product = await prisma.product.create({
      data: { ...data, outletId: req.outletId },
    });
    return res.status(201).json(product);
  } catch (err) {
    // Duplicate (outletId, sku) → conflict, not a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "sku_already_exists" });
    }
    return next(err);
  }
});

// GET /v1/admin/products — list this outlet's products (for the admin UI).
router.get("/products", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { outletId: req.outletId },
      orderBy: { sku: "asc" },
      include: { template: { select: { id: true, name: true, fitType: true } } },
    });
    return res.status(200).json(products);
  } catch (err) {
    return next(err);
  }
});

export default router;
