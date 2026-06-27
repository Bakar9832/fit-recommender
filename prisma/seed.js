import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Default starting template (spec §3 "Seed defaults" + §8 onboarding):
// Pakistani "Medium" centers at bust 37 / waist 29 / hip 39 in. The spec's
// stated ranges (bust 36–38, waist 28–30, hip 38–40) are the ±1in industry
// tolerance around that center. Sizes step ±2in. Outlets edit, not author.
// NOTE: this template keeps kameezLength null on purpose — DEMO-001 relies on a
// null length_note in tests.
const DEFAULT_SIZE_ROWS = [
  { sizeLabel: "S", sortOrder: 1, bust: 35, waist: 27, hip: 37 },
  { sizeLabel: "M", sortOrder: 2, bust: 37, waist: 29, hip: 39 },
  { sizeLabel: "L", sortOrder: 3, bust: 39, waist: 31, hip: 41 },
  { sizeLabel: "XL", sortOrder: 4, bust: 41, waist: 33, hip: 43 },
];

// Demo storefront templates. Charts are deliberately varied (different grids +
// fit types) so the same body gets different best-fits across the catalog.
const TEMPLATES = [
  { name: "Default Pret Standard", fitType: "regular", rows: DEFAULT_SIZE_ROWS },
  {
    name: "Petite Pret",
    fitType: "regular", // grid shifted ~2in smaller → runs a size up vs Standard
    rows: [
      { sizeLabel: "S", sortOrder: 1, bust: 33, waist: 25, hip: 35, kameezLength: 38 },
      { sizeLabel: "M", sortOrder: 2, bust: 35, waist: 27, hip: 37, kameezLength: 39 },
      { sizeLabel: "L", sortOrder: 3, bust: 37, waist: 29, hip: 39, kameezLength: 40 },
      { sizeLabel: "XL", sortOrder: 4, bust: 39, waist: 31, hip: 41, kameezLength: 41 },
    ],
  },
  {
    name: "Formal Tailored",
    fitType: "fitted", // closer cut → less ease, frock-length
    rows: [
      { sizeLabel: "S", sortOrder: 1, bust: 34, waist: 26, hip: 36, kameezLength: 44 },
      { sizeLabel: "M", sortOrder: 2, bust: 36, waist: 28, hip: 38, kameezLength: 45 },
      { sizeLabel: "L", sortOrder: 3, bust: 38, waist: 30, hip: 40, kameezLength: 46 },
      { sizeLabel: "XL", sortOrder: 4, bust: 40, waist: 32, hip: 42, kameezLength: 47 },
    ],
  },
  {
    name: "Flowy Anarkali",
    fitType: "loose", // generous grid + long hem
    rows: [
      { sizeLabel: "S", sortOrder: 1, bust: 36, waist: 28, hip: 38, kameezLength: 50 },
      { sizeLabel: "M", sortOrder: 2, bust: 38, waist: 30, hip: 40, kameezLength: 51 },
      { sizeLabel: "L", sortOrder: 3, bust: 40, waist: 32, hip: 42, kameezLength: 52 },
      { sizeLabel: "XL", sortOrder: 4, bust: 42, waist: 34, hip: 44, kameezLength: 53 },
    ],
  },
];

// Demo catalog (idempotent on (outletId, sku)). DEMO-001 keeps its exact
// chart/model/fabric so the engine + route tests stay deterministic.
const PRODUCTS = [
  {
    sku: "DEMO-001",
    name: "Everyday Lawn Two-Piece",
    fabric: null, // kept null — tests rely on deterministic recommendations
    garmentType: "two_piece",
    template: "Default Pret Standard",
    modelHeight: "5'6\"",
    modelSizeWorn: "M",
    imageSlug: "lawn-two-piece-01",
  },
  {
    sku: "LAWN-KURTI-02",
    name: "Embroidered Lawn Kurti",
    fabric: "lawn",
    garmentType: "one_piece",
    template: "Petite Pret",
    modelHeight: "5'4\"",
    modelSizeWorn: "S",
    imageSlug: "lawn-kurti-02",
  },
  {
    sku: "LAWN-2PC-03",
    name: "Printed Lawn Two-Piece",
    fabric: "lawn",
    garmentType: "two_piece",
    template: "Default Pret Standard",
    modelHeight: "5'7\"",
    modelSizeWorn: "M",
    imageSlug: "lawn-2pc-03",
  },
  {
    sku: "COTTON-KURTI-04",
    name: "Cotton Daily Kurti",
    fabric: "cotton",
    garmentType: "one_piece",
    template: "Petite Pret",
    modelHeight: "5'5\"",
    modelSizeWorn: "M",
    imageSlug: "cotton-kurti-04",
  },
  {
    sku: "FORMAL-FROCK-05",
    name: "Formal Chiffon Frock",
    fabric: "formal",
    garmentType: "one_piece",
    template: "Formal Tailored",
    modelHeight: "5'8\"",
    modelSizeWorn: "M",
    imageSlug: "formal-frock-05",
  },
  {
    sku: "FORMAL-2PC-06",
    name: "Formal Embellished Two-Piece",
    fabric: "formal",
    garmentType: "two_piece",
    template: "Formal Tailored",
    modelHeight: "5'6\"",
    modelSizeWorn: "L",
    imageSlug: "formal-2pc-06",
  },
  {
    sku: "ANARKALI-07",
    name: "Festive Anarkali",
    fabric: "formal",
    garmentType: "one_piece",
    template: "Flowy Anarkali",
    modelHeight: "5'7\"",
    modelSizeWorn: "M",
    imageSlug: "anarkali-07",
  },
  {
    sku: "LAWN-ANGRAKHA-08",
    name: "Lawn Angrakha Kurti",
    fabric: "cotton",
    garmentType: "one_piece",
    template: "Flowy Anarkali",
    modelHeight: "5'5\"",
    modelSizeWorn: "S",
    imageSlug: "lawn-angrakha-08",
  },
];

/**
 * Idempotent demo seed: one outlet → shared size-chart templates → a small
 * catalog of products referencing them. Safe to run repeatedly (all upserts).
 * Exported so tests can guarantee this baseline without duplicating seed logic.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @returns {Promise<{ outlet: object, template: object, product: object }>}
 *          template = "Default Pret Standard", product = DEMO-001 (back-compat).
 */
export async function seedDemo(prisma) {
  const outlet = await prisma.outlet.upsert({
    where: { outletKey: "demo-outlet" },
    update: {},
    create: {
      name: "Demo Outlet",
      outletKey: "demo-outlet",
      adminToken: "demo-admin-token",
    },
  });

  // Upsert each template (templates have no unique natural key, so match on name
  // within the outlet) and its rows; build a name → id map.
  const templateIdByName = {};
  for (const t of TEMPLATES) {
    const existing = await prisma.sizeChartTemplate.findFirst({
      where: { outletId: outlet.id, name: t.name },
    });
    const template =
      existing ??
      (await prisma.sizeChartTemplate.create({
        data: { outletId: outlet.id, name: t.name, fitType: t.fitType },
      }));
    if (existing) {
      await prisma.sizeChartTemplate.update({
        where: { id: template.id },
        data: { fitType: t.fitType },
      });
    }
    templateIdByName[t.name] = template.id;

    for (const row of t.rows) {
      await prisma.sizeChartRow.upsert({
        where: {
          templateId_sizeLabel: { templateId: template.id, sizeLabel: row.sizeLabel },
        },
        update: row,
        create: { ...row, templateId: template.id },
      });
    }
  }

  // Upsert each product on the (outletId, sku) unique key.
  let demoProduct = null;
  for (const p of PRODUCTS) {
    const { template: templateName, ...fields } = p;
    const data = { ...fields, templateId: templateIdByName[templateName] };
    const product = await prisma.product.upsert({
      where: { outletId_sku: { outletId: outlet.id, sku: p.sku } },
      update: data,
      create: { ...data, outletId: outlet.id },
    });
    if (p.sku === "DEMO-001") demoProduct = product;
  }

  const defaultTemplate = await prisma.sizeChartTemplate.findFirst({
    where: { outletId: outlet.id, name: "Default Pret Standard" },
  });

  return { outlet, template: defaultTemplate, product: demoProduct };
}

// Run as a script (`npm run seed`).
async function main() {
  const prisma = new PrismaClient();
  try {
    const { outlet } = await seedDemo(prisma);
    console.log(
      `Seeded outlet "${outlet.name}" (${outlet.outletKey}) with ${TEMPLATES.length} ` +
        `templates and ${PRODUCTS.length} catalog products.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only execute when run directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.js")) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
