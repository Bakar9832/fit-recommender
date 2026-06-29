import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { seedDemo } from "../prisma/seed.js";

// Integration tests: real Express app + real Prisma/Postgres, hit over HTTP on
// an ephemeral port. Requires the local DB to be up (DATABASE_URL). Reuses the
// shared seed (seedDemo) so the demo-outlet / DEMO-001 baseline is guaranteed.
let server;
let baseUrl;

beforeAll(async () => {
  const { outlet, template } = await seedDemo(prisma);
  // A product with NO model-reference fields, to assert model_reference: null.
  await prisma.product.upsert({
    where: { outletId_sku: { outletId: outlet.id, sku: "DEMO-NOMODEL" } },
    update: { templateId: template.id, modelHeight: null, modelSizeWorn: null },
    create: {
      outletId: outlet.id,
      templateId: template.id,
      sku: "DEMO-NOMODEL",
      garmentType: "two_piece",
    },
  });
  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { sku: "DEMO-NOMODEL" } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

function recommend(body) {
  return fetch(`${baseUrl}/v1/fit/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/fit/recommend", () => {
  it("happy path: recommends a size against the seeded demo product", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "DEMO-001",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.recommended_size).toBe("M");
    expect(body.confidence).toBe("high");
    expect(body.alternative_size).toBe("L");
    expect(body.zones.bust).toEqual({
      class: "good",
      note: "Sits comfortably at the bust, with easy room to move.",
    });
    expect(body.silhouette).toEqual({ bust: 37, waist: 29, hip: 39 });
    expect(body.length_note).toBeNull(); // seeded rows have no kameezLength
    // stitched product → unstitched flags present and empty (spec §11 read path)
    expect(body.unstitched).toBe(false);
    expect(body.included_fabric).toBeNull();
  });

  it("exposes unstitched + included_fabric for an unstitched product", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "UNSTITCHED-3PC-09",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unstitched).toBe(true);
    expect(body.included_fabric).toEqual({
      shirtFront: 1.15,
      shirtBack: 1.15,
      sleeves: 0.66,
      trouser: 2.5,
      dupatta: 2.5,
    });
  });

  it("includes the multi-size view, size_guide, and model_reference", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "DEMO-001",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    // sizes[] covers all chart sizes, recommended flagged.
    expect(body.sizes.map((s) => s.size)).toEqual(["S", "M", "L", "XL"]);
    expect(body.sizes.filter((s) => s.recommended).map((s) => s.size)).toEqual(["M"]);
    expect(body.sizes.find((s) => s.size === "M").summary).toBe("Your best fit");

    // size_guide = garment measurements per size (the seeded chart).
    expect(body.size_guide).toEqual([
      { size: "S", bust: 35, waist: 27, hip: 37, kameezLength: null, trouserWaist: null, trouserLength: null },
      { size: "M", bust: 37, waist: 29, hip: 39, kameezLength: null, trouserWaist: null, trouserLength: null },
      { size: "L", bust: 39, waist: 31, hip: 41, kameezLength: null, trouserWaist: null, trouserLength: null },
      { size: "XL", bust: 41, waist: 33, hip: 43, kameezLength: null, trouserWaist: null, trouserLength: null },
    ]);

    // model_reference from the seeded demo product.
    expect(body.model_reference).toEqual({ height: "5'6\"", size_worn: "M" });
  });

  it("returns model_reference: null for a product with no model fields", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "DEMO-NOMODEL",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model_reference).toBeNull();
    expect(body.sizes).toHaveLength(4); // multi-size still present
  });

  it("returns 422 for an implausible measurement (out of 20–80in)", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "DEMO-001",
      measurements: { bust: 200, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.details.some((d) => d.path === "measurements.bust")).toBe(true);
  });

  it("returns 404 for an unknown sku under a valid outlet", async () => {
    const res = await recommend({
      outlet_key: "demo-outlet",
      sku: "NOPE-999",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("product_not_found");
  });

  it("returns 404 for an unknown outlet_key", async () => {
    const res = await recommend({
      outlet_key: "no-such-outlet",
      sku: "DEMO-001",
      measurements: { bust: 33, waist: 25, hip: 35 },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("outlet_not_found");
  });
});
