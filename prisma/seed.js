import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  // A template must belong to an outlet (outletId is required). Create a demo
  // outlet to own the default template. Upserts keep the seed idempotent.
  const outlet = await prisma.outlet.upsert({
    where: { outletKey: "demo-outlet" },
    update: {},
    create: {
      name: "Demo Outlet",
      outletKey: "demo-outlet",
      adminToken: "demo-admin-token",
    },
  });

  // Find an existing default template for this outlet (templates have no unique
  // natural key, so we match on name within the outlet) to stay idempotent.
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
        templateId_sizeLabel: {
          templateId: template.id,
          sizeLabel: row.sizeLabel,
        },
      },
      update: row,
      create: { ...row, templateId: template.id },
    });
  }

  console.log(
    `Seeded outlet "${outlet.name}" (${outlet.outletKey}) with template ` +
      `"${template.name}" [${DEFAULT_SIZE_ROWS.map((r) => r.sizeLabel).join("/")}].`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
