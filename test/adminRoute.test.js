import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { seedDemo } from "../prisma/seed.js";

// Integration tests for /v1/admin (real app + Prisma/Postgres over HTTP).
// Outlet A = the seeded demo-outlet (token "demo-admin-token").
// Outlet B = a second outlet created here, used for the cross-tenant check.
const A_TOKEN = "demo-admin-token";
const B_TOKEN = "test-token-b";

let server;
let baseUrl;
let outletB;
let bTemplateId; // belongs to outlet B
let aTemplateId; // created by outlet A during the happy flow

// Test artifacts use these prefixes so cleanup never touches real/demo data.
async function cleanupTestData() {
  await prisma.product.deleteMany({ where: { sku: { startsWith: "ADM-TEST" } } });
  await prisma.sizeChartTemplate.deleteMany({ where: { name: { startsWith: "ZZTEST" } } });
}

beforeAll(async () => {
  await seedDemo(prisma); // outlet A
  outletB = await prisma.outlet.upsert({
    where: { outletKey: "test-outlet-b" },
    update: { adminToken: B_TOKEN },
    create: { name: "Test Outlet B", outletKey: "test-outlet-b", adminToken: B_TOKEN },
  });

  await cleanupTestData();

  const bTemplate = await prisma.sizeChartTemplate.create({
    data: {
      outletId: outletB.id,
      name: "ZZTEST B Template",
      fitType: "regular",
      rows: {
        create: [
          { sizeLabel: "S", sortOrder: 1, bust: 34, waist: 26, hip: 36 },
          { sizeLabel: "M", sortOrder: 2, bust: 36, waist: 28, hip: 38 },
        ],
      },
    },
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

function api(path, { token, method = "POST", body } = {}) {
  return fetch(`${baseUrl}/v1/admin${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("admin CRUD happy flow (outlet A)", () => {
  it("creates a template", async () => {
    const res = await api("/templates", {
      token: A_TOKEN,
      body: { name: "ZZTEST A Lawn", fitType: "regular" },
    });
    expect(res.status).toBe(201);
    const tpl = await res.json();
    expect(tpl.id).toBeTruthy();
    expect(tpl.fitType).toBe("regular");
    aTemplateId = tpl.id;
  });

  it("replaces the template's size rows", async () => {
    const res = await api(`/templates/${aTemplateId}/rows`, {
      token: A_TOKEN,
      body: {
        rows: [
          { sizeLabel: "S", sortOrder: 1, bust: 35, waist: 27, hip: 37 },
          { sizeLabel: "M", sortOrder: 2, bust: 37, waist: 29, hip: 39 },
          { sizeLabel: "L", sortOrder: 3, bust: 39, waist: 31, hip: 41 },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ templateId: aTemplateId, rowCount: 3 });
  });

  it("creates a product referencing the template", async () => {
    const res = await api("/products", {
      token: A_TOKEN,
      body: {
        sku: "ADM-TEST-1",
        templateId: aTemplateId,
        garmentType: "two_piece",
        fabric: "lawn",
      },
    });
    expect(res.status).toBe(201);
    const product = await res.json();
    expect(product.sku).toBe("ADM-TEST-1");
    expect(product.outletId).toBeTruthy();
  });

  it("lists this outlet's products including the new one", async () => {
    const res = await api("/products", { token: A_TOKEN, method: "GET" });
    expect(res.status).toBe(200);
    const products = await res.json();
    const skus = products.map((p) => p.sku);
    expect(skus).toContain("ADM-TEST-1");
    // Every listed product belongs to outlet A — no cross-tenant leakage.
    const outletIds = new Set(products.map((p) => p.outletId));
    expect(outletIds.size).toBe(1);
  });

  it("rejects a duplicate sku with 409", async () => {
    const res = await api("/products", {
      token: A_TOKEN,
      body: { sku: "ADM-TEST-1", templateId: aTemplateId, garmentType: "two_piece" },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("sku_already_exists");
  });

  it("rejects an invalid body with 422", async () => {
    const res = await api("/templates", {
      token: A_TOKEN,
      body: { name: "ZZTEST bad", fitType: "snug-ish" },
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_request");
  });
});

describe("admin auth", () => {
  it("401s when the admin token is missing", async () => {
    const res = await api("/products", { method: "GET" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("missing_admin_token");
  });

  it("401s when the admin token is invalid", async () => {
    const res = await api("/products", { token: "not-a-real-token", method: "GET" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_admin_token");
  });
});

describe("cross-tenant isolation (hard rule #3)", () => {
  it("404s and does NOT mutate when A targets B's template rows", async () => {
    const before = await prisma.sizeChartRow.count({ where: { templateId: bTemplateId } });

    const res = await api(`/templates/${bTemplateId}/rows`, {
      token: A_TOKEN,
      body: { rows: [{ sizeLabel: "XXL", sortOrder: 9, bust: 99 }] },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("template_not_found");

    // B's rows must be untouched (no delete, no insert leaked across tenants).
    const after = await prisma.sizeChartRow.count({ where: { templateId: bTemplateId } });
    expect(after).toBe(before);
  });

  it("404s and does NOT create when A references B's template for a product", async () => {
    const res = await api("/products", {
      token: A_TOKEN,
      body: { sku: "ADM-TEST-XT", templateId: bTemplateId, garmentType: "two_piece" },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("template_not_found");

    const leaked = await prisma.product.findFirst({ where: { sku: "ADM-TEST-XT" } });
    expect(leaked).toBeNull();
  });
});
