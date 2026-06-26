import express from "express";
import healthRouter from "./routes/health.js";
import fitRouter from "./routes/fit.js";
import adminRouter from "./routes/admin.js";

// Builds the Express app without binding a port, so it can be imported in tests
// and mounted by the server entry point.
export function createApp() {
  const app = express();
  app.use(express.json());

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
