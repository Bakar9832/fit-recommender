import express from "express";
import healthRouter from "./routes/health.js";
import fitRouter from "./routes/fit.js";
import adminRouter from "./routes/admin.js";

// Builds the Express app without binding a port, so it can be imported in tests
// and mounted by the server entry point.
export function createApp() {
  const app = express();

  // CORS — the embeddable widget calls this API cross-origin from the outlet's
  // page. Phase 1 demo: allow any origin (the public recommend endpoint carries
  // no cookies; admin auth is a header token, not credentials). Tighten to an
  // allow-list before production. No `cors` dep — this is all we need.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
    res.header("Access-Control-Max-Age", "600");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.json());
  // Raw CSV body for the bulk-import endpoint (spec §8).
  app.use(express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }));

  app.use(healthRouter);
  app.use(fitRouter);
  app.use("/v1/admin", adminRouter);

  // Centralized error handler: anything thrown in an async route lands here as
  // a clean 500 instead of a hung request.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

export default createApp;
