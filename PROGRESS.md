# PROGRESS — Phase 1 Backend

Read this at the start of every session. Update the "Session log" at the end of every session.
Work the **Current task** only. Don't start the next item until the current one runs and is verified.

## Current task
> CSV bulk import (spec §8): one upload maps products → template + fabric + garment_type.
> admin_token guarded, scoped to req.outletId. Provide a downloadable CSV template. Highest-value
> onboarding feature — prioritize correctness + clear per-row error reporting.

## Build checklist (Phase 1, in order)
- [x] Project scaffold (Express app, npm scripts, env config, prisma client in `lib/`)
- [x] `prisma/schema.prisma` per spec §3 → `migrate dev` → generate client
- [x] Seed script: default template (bust 36–38 / waist 28–30 / hip 38–40, S–XL)
- [x] Fit engine in `services/` (spec §4): ease bands → per-zone class → size selection → output object
- [x] Wording layer (spec §5): (zone, class) → garment-focused phrase
- [x] Length handling (spec §4.5): height → hem descriptor, advisory only
- [x] `POST /v1/fit/recommend` route: validate input (Zod) → load via Prisma → call engine → return
- [x] Admin CRUD: templates, rows, products
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
- 2026-06-26 — Built admin CRUD (spec §7), all token-guarded + tenant-scoped (hard rule #3).
  `src/lib/adminAuth.js` (reads `Authorization: Bearer` or `X-Admin-Token` → `findFirst` outlet by
  adminToken → pins `req.outletId`; 401 missing/invalid). `src/routes/admin.js` mounted at `/v1/admin`:
  POST `/templates` (201), POST `/templates/:id/rows` (full replace via `$transaction` deleteMany+createMany,
  200 `{templateId,rowCount}`), POST `/products` (201; P2002→409 `sku_already_exists`), GET `/products`
  (200, scoped to outletId). Every `:id`/`templateId` verified via `findFirst({id, outletId})` → 404
  `template_not_found`, never cross-tenant. Zod schemas added to `validation.js` (all `.strict()`;
  rows refine unique sizeLabel; `zodDetails` helper; chartInches positive ≤120). 34 tests pass incl. 10
  admin integration tests: happy create→rows→product→list, 401 missing/invalid, 409 dup, 422 bad body,
  and cross-tenant (A token + B templateId) → 404 with verified no-mutation/no-create. Verified live via
  curl (create 201 / no-token 401 / list 200). Next: CSV bulk import (§8). Notes: Phase 2 cols
  (colorSlot/formality/styleTag) accepted as optional pass-through on product create per task, still unused
  in logic. Left a stray "Curl Demo Template" (no rows) in demo-outlet from the curl demo — harmless.
- 2026-06-26 — Built `POST /v1/fit/recommend` (spec §7). `src/lib/validation.js` (Zod, 20–80in sanity
  band, height optional, `.strict()`); `src/routes/fit.js` (422 on validation fail → outlet lookup by
  outletKey, 404 `outlet_not_found` → product `findUnique` on `outletId_sku` with template+ordered rows
  in ONE query §4.1, 404 `product_not_found` → effective fitType `fitTypeOverride ?? template.fitType` →
  `recommendFit` → §4.6 JSON). Wired into `app.js` + added central 500 error handler. Seed now exports
  idempotent `seedDemo(prisma)` and creates demo product `DEMO-001` (two_piece, fabric null) so the route
  has something to recommend; tests reuse `seedDemo` (no parallel seed logic). 24 tests pass incl. 4
  integration tests (ephemeral `listen(0)` + built-in fetch, no new deps): happy/422/404-sku/404-outlet.
  Verified live via curl. Next: admin CRUD. Gotcha: a stale node server (PID from an earlier session)
  was holding port 3000 → fresh server hit EADDRINUSE and an old route-less server answered curls; killed
  it. Watch for leftover `npm run dev`/server processes between sessions.
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
