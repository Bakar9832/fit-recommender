# PROGRESS — Phase 1 Backend

Read this at the start of every session. Update the "Session log" at the end of every session.
Work the **Current task** only. Don't start the next item until the current one runs and is verified.

## Current task
> Fit engine in `services/` (spec §4): ease bands → per-zone class → size selection → output object.
> Pure functions taking plain objects (no DB calls in the math). Wording layer (§5) comes right after.

## Build checklist (Phase 1, in order)
- [x] Project scaffold (Express app, npm scripts, env config, prisma client in `lib/`)
- [x] `prisma/schema.prisma` per spec §3 → `migrate dev` → generate client
- [x] Seed script: default template (bust 36–38 / waist 28–30 / hip 38–40, S–XL)
- [ ] Fit engine in `services/` (spec §4): ease bands → per-zone class → size selection → output object
- [ ] Wording layer (spec §5): (zone, class) → garment-focused phrase
- [ ] Length handling (spec §4.5): height → hem descriptor, advisory only
- [ ] `POST /v1/fit/recommend` route: validate input (Zod) → load via Prisma → call engine → return
- [ ] Admin CRUD: templates, rows, products
- [ ] CSV bulk import (spec §8)
- [ ] Unit tests for the fit engine (pure functions, several body/size cases)
- [ ] Validation pass (spec §9): run real measurements, tune ease bands + weights

## Decisions made (don't relitigate)
- DB: Postgres + Prisma (chosen for "pick once, never swap"; migration friction solved by Prisma).
- Storage: size rows are a relation on the template, not JSON. Products reference a shared template.
- Engine is pure functions, no DB calls inside the math.

## Open questions / to confirm
- Ease bands and selection weights are starting guesses (spec §4.2/§4.4) — confirm against a real outlet's chart + tailor during the validation pass.
- Length-to-hem ratio bands need calibration on real garments.

## Session log
<!-- newest first. one short entry per session: what got done, what's next, any gotcha. -->
- 2026-06-26 — Scaffolded Express API (ESM): `src/app.js`, `src/server.js`, `GET /health → {ok:true}`,
  `src/lib/prisma.js` singleton. npm scripts: dev/start/seed/migrate/generate/test. Deps: express,
  @prisma/client, zod, dotenv (+ prisma, nodemon, vitest dev). `prisma/schema.prisma` per spec §3 verbatim
  (incl. unused Phase 2 cols). Local Postgres 18: created role `admin` + DB `fit_recommender`; `migrate dev
  --name init` applied; client generated. Seed creates demo outlet + "Default Pret Standard" template
  (S/M/L/XL, M-anchored bust37/waist29/hip39, ±2in steps; lengths null). Verified: server boots, /health 200,
  Prisma query returns the template + 4 rows. Next: fit engine (§4) as pure functions in `services/`.
  Gotchas: psql not on PATH (use `C:\Program Files\PostgreSQL\18\bin`); removed deprecated `prisma.seed`
  block from package.json (seed runs via `npm run seed`).
