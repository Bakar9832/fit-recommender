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
  await seedDemo(prisma);
  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
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
      note: "Sits comfortably at the bust.",
    });
    expect(body.silhouette).toEqual({ bust: 37, waist: 29, hip: 39 });
    expect(body.length_note).toBeNull(); // seeded rows have no kameezLength
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
