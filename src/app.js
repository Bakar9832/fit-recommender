import express from "express";
import healthRouter from "./routes/health.js";

// Builds the Express app without binding a port, so it can be imported in tests
// and mounted by the server entry point. Fit/admin routes are later PROGRESS.md
// items and are not mounted yet.
export function createApp() {
  const app = express();
  app.use(express.json());

  app.use(healthRouter);

  return app;
}

export default createApp;
