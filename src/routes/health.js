import { Router } from "express";

const router = Router();

// Liveness check. Intentionally does not touch the DB — it answers "is the
// process up and serving HTTP", nothing more.
router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default router;
