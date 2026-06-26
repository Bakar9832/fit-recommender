# PROGRESS — Phase 1 Backend

Read this at the start of every session. Update the "Session log" at the end of every session.
Work the **Current task** only. Don't start the next item until the current one runs and is verified.

## Current task
> `POST /v1/fit/recommend` route: validate input (Zod, spec §7 sanity range 20–80in) →
> load product + template rows via Prisma (scoped by outletKey→outletId, §4.1 query) →
> call `recommendFit` → return the §4.6 object. Route/validation/DB-loading only; engine is done.

## Build checklist (Phase 1, in order)
- [x] Project scaffold (Express app, npm scripts, env config, prisma client in `lib/`)
- [x] `prisma/schema.prisma` per spec §3 → `migrate dev` → generate client
- [x] Seed script: default template (bust 36–38 / waist 28–30 / hip 38–40, S–XL)
- [x] Fit engine in `services/` (spec §4): ease bands → per-zone class → size selection → output object
- [x] Wording layer (spec §5): (zone, class) → garment-focused phrase
- [x] Length handling (spec §4.5): height → hem descriptor, advisory only
- [ ] `POST /v1/fit/recommend` route: validate input (Zod) → load via Prisma → call engine → return
- [ ] Admin CRUD: templates, rows, products
- [ ] CSV bulk import (spec §8)
- [x] Unit tests for the fit engine (pure functions, several body/size cases)
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
- 2026-06-26 — Built fit engine as pure functions in `src/services/` (no DB): `easeBands.js`
  (EASE_BANDS/ZONE_PENALTY/ZONE_WEIGHT + `classifyZone` §4.3 + `bandsFor`), `wording.js` (`noteFor`,
  §5 garment-focused, keyed only on zone+class), `length.js` (`lengthNote`, advisory §4.5), `fitEngine.js`
  (`recommendFit(body, product)` → §4.6 object). 20 vitest tests pass (`npm test`): boundary checks,
  high/medium/low confidence, exact-tie size-up, shrink-fabric (lawn) bump, too_tight→low, one_piece w/o
  trouser+length, hem descriptor. Next: `POST /v1/fit/recommend` route (Zod validation + Prisma load).
  Two spec calls (flagged): (1) shrink "bump strength" = near-tie band, tieMargin 0 normally / 1.0 for
  lawn|cotton, pick largest within `minScore+margin`. (2) §4.6's sample shows relaxed-waist + high
  confidence, which contradicts §4.4's "high iff score≈0"; followed §4.4 (the stated algorithm). Bands,
  weights, margins, and hem ratios are starting guesses — flagged for the §9 validation pass.
- 2026-06-26 — Scaffolded Express API (ESM): `src/app.js`, `src/server.js`, `GET /health → {ok:true}`,
  `src/lib/prisma.js` singleton. npm scripts: dev/start/seed/migrate/generate/test. Deps: express,
  @prisma/client, zod, dotenv (+ prisma, nodemon, vitest dev). `prisma/schema.prisma` per spec §3 verbatim
  (incl. unused Phase 2 cols). Local Postgres 18: created role `admin` + DB `fit_recommender`; `migrate dev
  --name init` applied; client generated. Seed creates demo outlet + "Default Pret Standard" template
  (S/M/L/XL, M-anchored bust37/waist29/hip39, ±2in steps; lengths null). Verified: server boots, /health 200,
  Prisma query returns the template + 4 rows. Next: fit engine (§4) as pure functions in `services/`.
  Gotchas: psql not on PATH (use `C:\Program Files\PostgreSQL\18\bin`); removed deprecated `prisma.seed`
  block from package.json (seed runs via `npm run seed`).
