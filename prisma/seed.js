import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Default starting template (spec §3 "Seed defaults" + §8 onboarding):
// Pakistani "Medium" centers at bust 37 / waist 29 / hip 39 in. The spec's
// stated ranges (bust 36–38, waist 28–30, hip 38–40) are the ±1in industry
// tolerance around that center. Sizes step ±2in. Outlets edit, not author.
const DEFAULT_SIZE_ROWS = [
  { sizeLabel: "S", sortOrder: 1, bust: 35, waist: 27, hip: 37 },
  { sizeLabel: "M", sortOrder: 2, bust: 37, waist: 29, hip: 39 },
  { sizeLabel: "L", sortOrder: 3, bust: 39, waist: 31, hip: 41 },
  { sizeLabel: "XL", sortOrder: 4, bust: 41, waist: 33, hip: 43 },
];

// One demo product so the widget / fit route has something to recommend against.
// fabric:null keeps the recommendation deterministic (no shrink size-up bump).
const DEMO_PRODUCT = {
  sku: "DEMO-001",
  name: "Demo Lawn Two-Piece",
  garmentType: "two_piece",
  fabric: null,
};

/**
 * Idempotent demo seed: one outlet → one default template (+ rows) → one product
 * referencing that template. Safe to run repeatedly (all upserts). Exported so
 * tests can guarantee this baseline without duplicating seed logic.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @returns {Promise<{ outlet: object, template: object, product: object }>}
 */
export async function seedDemo(prisma) {
  // A template must belong to an outlet (outletId is required). Create a demo
  // outlet to own the default template.
  const outlet = await prisma.outlet.upsert({
    where: { outletKey: "demo-outlet" },
    update: {},
    create: {
      name: "Demo Outlet",
      outletKey: "demo-outlet",
      adminToken: "demo-admin-token",
    },
  });

  // Templates have no unique natural key, so match on name within the outlet to
  // stay idempotent.
  const existing = await prisma.sizeChartTemplate.findFirst({
    where: { outletId: outlet.id, name: "Default Pret Standard" },
  });

  const template =
    existing ??
    (await prisma.sizeChartTemplate.create({
      data: {
        outletId: outlet.id,
        name: "Default Pret Standard",
        fitType: "regular",
      },
    }));

  // Upsert each size row on the (templateId, sizeLabel) unique key.
  for (const row of DEFAULT_SIZE_ROWS) {
    await prisma.sizeChartRow.upsert({
      where: {
        templateId_sizeLabel: { templateId: template.id, sizeLabel: row.sizeLabel },
      },
      update: row,
      create: { ...row, templateId: template.id },
    });
  }

  // Demo product on the (outletId, sku) unique key.
  const product = await prisma.product.upsert({
    where: { outletId_sku: { outletId: outlet.id, sku: DEMO_PRODUCT.sku } },
    update: { ...DEMO_PRODUCT, templateId: template.id },
    create: { ...DEMO_PRODUCT, outletId: outlet.id, templateId: template.id },
  });

  return { outlet, template, product };
}

// Run as a script (`npm run seed`).
async function main() {
  const prisma = new PrismaClient();
  try {
    const { outlet, template, product } = await seedDemo(prisma);
    console.log(
      `Seeded outlet "${outlet.name}" (${outlet.outletKey}) with template ` +
        `"${template.name}" [${DEFAULT_SIZE_ROWS.map((r) => r.sizeLabel).join("/")}] ` +
        `and product "${product.sku}".`
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
