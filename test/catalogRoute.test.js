import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { seedDemo } from "../prisma/seed.js";

// Integration tests for GET /v1/catalog (public, tenant-scoped). Real app +
// Prisma/Postgres over HTTP; reuses the shared demo seed.
let server;
let baseUrl;

beforeAll(async () => {
  await seedDemo(prisma);
  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

const catalog = (qs) => fetch(`${baseUrl}/v1/catalog${qs}`);

describe("GET /v1/catalog", () => {
  it("returns the outlet's catalog with the documented fields", async () => {
    const res = await catalog("?outlet_key=demo-outlet");
    expect(res.status).toBe(200);
    const items = await res.json();

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(8); // seeded catalog

    const skus = items.map((i) => i.sku);
    expect(skus).toContain("DEMO-001");
    expect(skus).toContain("ANARKALI-07");

    const demo = items.find((i) => i.sku === "DEMO-001");
    // exactly the public catalog shape (no admin/internal fields leaked)
    expect(Object.keys(demo).sort()).toEqual(
      ["fabric", "garmentType", "id", "imageSlug", "model_reference", "name", "sku"].sort()
    );
    expect(demo.imageSlug).toBe("lawn-two-piece-01");
    expect(demo.model_reference).toEqual({ height: "5'6\"", size_worn: "M" });
  });

  it("404s for an unknown outlet_key", async () => {
    const res = await catalog("?outlet_key=no-such-outlet");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("outlet_not_found");
  });

  it("422s when outlet_key is missing", async () => {
    const res = await catalog("");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_request");
  });
});
