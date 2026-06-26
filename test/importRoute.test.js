import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { seedDemo } from "../prisma/seed.js";

// Integration tests for POST /v1/admin/import (real app + Prisma over HTTP).
// Outlet A = seeded demo-outlet (token "demo-admin-token"), which owns the
// "Default Pret Standard" template the imports reference by name.
const A_TOKEN = "demo-admin-token";
const TEMPLATE_NAME = "Default Pret Standard";

let server;
let baseUrl;
let bTemplateId; // a template owned by a DIFFERENT outlet (for cross-tenant test)

// Unique prefixes scoped to THIS file so parallel test files don't delete each
// other's fixtures (templates use RESTRICT-on-delete via referencing products).
async function cleanupTestData() {
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CSV-TEST" } } });
  await prisma.sizeChartTemplate.deleteMany({ where: { name: { startsWith: "ZZCSV" } } });
}

beforeAll(async () => {
  await seedDemo(prisma); // outlet A + Default Pret Standard
  const outletB = await prisma.outlet.upsert({
    where: { outletKey: "test-outlet-csv" },
    update: {},
    create: { name: "CSV Test Outlet", outletKey: "test-outlet-csv", adminToken: "csv-token-b" },
  });
  await cleanupTestData();
  const bTemplate = await prisma.sizeChartTemplate.create({
    data: { outletId: outletB.id, name: "ZZCSV B Template", fitType: "regular" },
  });
  bTemplateId = bTemplate.id;

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await cleanupTestData();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

function importCsv(csv, token = A_TOKEN) {
  return fetch(`${baseUrl}/v1/admin/import`, {
    method: "POST",
    headers: {
      "content-type": "text/csv",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: csv,
  });
}

const HEADER = "sku,template,garmentType,fabric";

describe("POST /v1/admin/import", () => {
  it("imports a clean multi-row file", async () => {
    const csv = [
      HEADER,
      `CSV-TEST-1,${TEMPLATE_NAME},two_piece,lawn`,
      `CSV-TEST-2,${TEMPLATE_NAME},one_piece,cotton`,
      `CSV-TEST-3,${TEMPLATE_NAME},two_piece,formal`,
    ].join("\n");

    const res = await importCsv(csv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imported: 3, skipped: 0, errors: [] });

    const count = await prisma.product.count({
      where: { sku: { in: ["CSV-TEST-1", "CSV-TEST-2", "CSV-TEST-3"] } },
    });
    expect(count).toBe(3);
  });

  it("imports good rows and reports a bad row without failing the file", async () => {
    const csv = [
      HEADER,
      `CSV-TEST-4,${TEMPLATE_NAME},two_piece,lawn`,
      `CSV-TEST-5,${TEMPLATE_NAME},triple_piece,lawn`, // invalid garmentType
      `CSV-TEST-6,${TEMPLATE_NAME},one_piece,cotton`,
    ].join("\n");

    const res = await importCsv(csv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(2); // 1-based data row (the 2nd record)
    expect(body.errors[0].reason).toContain("garmentType");

    // good rows landed, bad row did not
    expect(await prisma.product.findUnique({ where: { outletId_sku: { outletId: (await outletAId()), sku: "CSV-TEST-5" } } })).toBeNull();
    const good = await prisma.product.count({
      where: { sku: { in: ["CSV-TEST-4", "CSV-TEST-6"] } },
    });
    expect(good).toBe(2);
  });

  it("reports duplicate SKUs (existing + within-file), insert-only", async () => {
    // CSV-TEST-1 already exists (test 1). DUP appears twice in this file.
    const csv = [
      HEADER,
      `CSV-TEST-1,${TEMPLATE_NAME},two_piece,lawn`, // already exists
      `CSV-TEST-DUP,${TEMPLATE_NAME},two_piece,lawn`, // imports
      `CSV-TEST-DUP,${TEMPLATE_NAME},one_piece,cotton`, // dup within file
    ].join("\n");

    const res = await importCsv(csv);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.skipped).toBe(2);
    const reasons = body.errors.map((e) => e.reason).join(" | ");
    expect(reasons).toContain("sku already exists");
    expect(reasons).toContain("duplicate sku within file");
  });

  it("401s without an admin token", async () => {
    const res = await importCsv(`${HEADER}\nCSV-TEST-X,${TEMPLATE_NAME},two_piece,lawn`, null);
    expect(res.status).toBe(401);
  });

  it("422s when a required column is missing", async () => {
    const res = await importCsv("sku,garmentType\nCSV-TEST-Y,two_piece");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("missing_columns");
    expect(body.missing).toContain("template");
  });

  it("fails a row referencing another outlet's template (no cross-tenant leak)", async () => {
    const csv = [HEADER, `CSV-TEST-XT,${bTemplateId},two_piece,lawn`].join("\n");

    const res = await importCsv(csv); // outlet A's token, outlet B's template id
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.errors[0].reason).toContain("template not found");

    // nothing created anywhere for that sku
    const leaked = await prisma.product.findFirst({ where: { sku: "CSV-TEST-XT" } });
    expect(leaked).toBeNull();
  });
});

// Helper: resolve outlet A's id once (demo-outlet) for precise lookups.
let _aId;
async function outletAId() {
  if (!_aId) {
    _aId = (await prisma.outlet.findUnique({ where: { outletKey: "demo-outlet" } })).id;
  }
  return _aId;
}
