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
import { csvToObjects } from "../lib/csv.js";
import {
  planImport,
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
} from "../services/csvImport.js";

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

// GET /v1/admin/import/template — downloadable CSV header row (the blank template).
router.get("/import/template", (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="product-import-template.csv"'
  );
  res.send(IMPORT_COLUMNS.join(",") + "\n");
});

// POST /v1/admin/import — CSV bulk product import (spec §8). Raw text/csv body.
// Validates every row, imports the good ones, and reports per-row failures.
// Insert-only: duplicate SKUs (in-file or pre-existing) are skipped + reported.
router.post("/import", async (req, res, next) => {
  try {
    const text = typeof req.body === "string" ? req.body : "";
    if (!text.trim()) return res.status(422).json({ error: "empty_csv" });

    const { header, records } = csvToObjects(text);
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length) {
      return res.status(422).json({ error: "missing_columns", missing });
    }
    if (records.length === 0) {
      return res.status(422).json({ error: "no_data_rows" });
    }

    // Gather tenant-scoped context for the pure planner.
    const [templates, existing] = await Promise.all([
      prisma.sizeChartTemplate.findMany({
        where: { outletId: req.outletId },
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { outletId: req.outletId },
        select: { sku: true },
      }),
    ]);
    const existingSkus = new Set(existing.map((p) => p.sku));

    const { toInsert, errors } = planImport(records, { templates, existingSkus });

    // Write the valid rows atomically — a failure here imports nothing (no
    // half-written file), while the response still details which rows were good.
    if (toInsert.length > 0) {
      const data = toInsert.map((p) => ({ ...p, outletId: req.outletId }));
      await prisma.$transaction([prisma.product.createMany({ data })]);
    }

    return res.status(200).json({
      imported: toInsert.length,
      skipped: errors.length,
      errors,
    });
  } catch (err) {
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
