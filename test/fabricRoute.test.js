import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { seedDemo } from "../prisma/seed.js";

// Integration tests for POST /v1/fabric/check (public, tenant-scoped; spec §11).
// Uses the seeded demo outlet: DEMO-001 (stitched) and UNSTITCHED-3PC-09
// (unstitched). Adds one ample-yardage fixture for the all-sufficient case.
let server;
let baseUrl;

async function cleanupTestData() {
  await prisma.product.deleteMany({ where: { sku: { startsWith: "FAB-TEST" } } });
}

beforeAll(async () => {
  await seedDemo(prisma);
  const outlet = await prisma.outlet.findUnique({ where: { outletKey: "demo-outlet" } });
  const template = await prisma.sizeChartTemplate.findFirst({
    where: { outletId: outlet.id, name: "Default Pret Standard" },
  });
  await cleanupTestData();
  // Ample yardage → sufficient at any band (happy path).
  await prisma.product.upsert({
    where: { outletId_sku: { outletId: outlet.id, sku: "FAB-TEST-AMPLE" } },
    update: {},
    create: {
      outletId: outlet.id,
      templateId: template.id,
      sku: "FAB-TEST-AMPLE",
      garmentType: "two_piece",
      unstitched: true,
      fabricShirtFront: 3.5,
      fabricShirtBack: 3.5,
      fabricSleeves: 3.5,
      fabricTrouser: 3.5,
      fabricDupatta: 3.5,
    },
  });

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await cleanupTestData();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

function check(body) {
  return fetch(`${baseUrl}/v1/fabric/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/fabric/check", () => {
  it("happy path: ample yardage → all_sufficient with per-component results", async () => {
    const res = await check({
      outlet_key: "demo-outlet",
      sku: "FAB-TEST-AMPLE",
      measurements: { bust: 34, waist: 28, hip: 38, height: 64 },
      garments: ["kameez_kurti", "trousers", "dupatta"],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.all_sufficient).toBe(true);
    expect(body.caveat).toBe("Estimated guidance — confirm with your tailor.");
    expect(body.components.map((c) => c.component)).toEqual([
      "shirtFront", "shirtBack", "sleeves", "trouser", "dupatta",
    ]);
    expect(body.components.every((c) => c.sufficient)).toBe(true);
  });

  it("borderline: a tall customer flags the seeded item's front as insufficient", async () => {
    const res = await check({
      outlet_key: "demo-outlet",
      sku: "UNSTITCHED-3PC-09", // shirtFront 1.15m
      measurements: { bust: 38, waist: 32, hip: 40, height: 70 }, // tall → front needs 1.65
      garments: ["kameez_kurti"],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.all_sufficient).toBe(false);
    const front = body.components.find((c) => c.component === "shirtFront");
    expect(front.sufficient).toBe(false);
    expect(front.note).toBe(
      "You may want extra fabric for the front piece at your length."
    );
  });

  it("409s for a stitched product (not unstitched)", async () => {
    const res = await check({
      outlet_key: "demo-outlet",
      sku: "DEMO-001",
      measurements: { bust: 34, waist: 28, hip: 38 },
      garments: ["kameez_kurti"],
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("not_unstitched");
  });

  it("404s for an unknown sku", async () => {
    const res = await check({
      outlet_key: "demo-outlet",
      sku: "NOPE-999",
      measurements: { bust: 34, waist: 28, hip: 38 },
      garments: ["kameez_kurti"],
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("product_not_found");
  });

  it("422s when no garment is selected", async () => {
    const res = await check({
      outlet_key: "demo-outlet",
      sku: "FAB-TEST-AMPLE",
      measurements: { bust: 34, waist: 28, hip: 38 },
      garments: [],
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_request");
  });
});
