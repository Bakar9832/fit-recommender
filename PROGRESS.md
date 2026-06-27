# PROGRESS — Phase 1 Backend

Read this at the start of every session. Update the "Session log" at the end of every session.
Work the **Current task** only. Don't start the next item until the current one runs and is verified.

## Current task
> Deployment: hosted Postgres + API + static frontend. Stand up the API against hosted Postgres
> (`prisma migrate deploy` + seed), host the static widget/demo, lock CORS to the real outlet
> origin(s) instead of `*`, config via env (DATABASE_URL etc.). Backend + enriched widget are built +
> verified locally. (Field-work §9 validation pass still open in parallel — not a deploy blocker.)

## Build checklist (Phase 1, in order)
- [x] Project scaffold (Express app, npm scripts, env config, prisma client in `lib/`)
- [x] `prisma/schema.prisma` per spec §3 → `migrate dev` → generate client
- [x] Seed script: default template (bust 36–38 / waist 28–30 / hip 38–40, S–XL)
- [x] Fit engine in `services/` (spec §4): ease bands → per-zone class → size selection → output object
- [x] Wording layer (spec §5): (zone, class) → garment-focused phrase
- [x] Length handling (spec §4.5): height → hem descriptor, advisory only
- [x] `POST /v1/fit/recommend` route: validate input (Zod) → load via Prisma → call engine → return
- [x] Admin CRUD: templates, rows, products
- [x] CSV bulk import (spec §8)
- [x] Unit tests for the fit engine (pure functions, several body/size cases)
- [x] §9 accuracy harness (dev tooling): `npm run validate <file>` — measures, doesn't tune
- [x] Embeddable widget (`widget/fitw.js`, vanilla JS) + demo page (`widget/demo.html`) + CORS on API
- [x] Widget restyle — "Ink & Blush" palette + human-figure silhouette (visual-only)
- [x] Recommendation enrichment (backend): multi-size output + richer wording + model-ref + size-guide
- [x] Widget render of enrichment: multi-size ladder + model_reference + size_guide (figure parked)
- [x] Backend fix: conditional/degree fit wording + no-genuine-fit (`fits_comfortably`/`fit_message`)
- [ ] Widget render: surface `fits_comfortably` honestly (when false, swap the "Closest fit" chip
      wording to read "Not a comfortable fit" / show `fit_message`; recommended is the closest, not "best")
- [ ] Deployment: hosted Postgres + API + static frontend (lock CORS to real origins)
- [ ] Validation pass (spec §9): run real measurements, tune ease bands + weights  (field work, parallel)

## Decisions made (don't relitigate)
- DB: Postgres + Prisma (chosen for "pick once, never swap"; migration friction solved by Prisma).
- Storage: size rows are a relation on the template, not JSON. Products reference a shared template.
- Engine is pure functions, no DB calls inside the math.
- Demo widget is **vanilla JS, no framework, no build step** (`widget/fitw.js`) — a deliberate
  demo-stage choice over spec §2's React, for fast iteration + data collection. Revisit React for the
  production bundle. Note added to spec §2. The file uses no import/export so it loads as a classic
  browser script AND can be imported in Node (pure helpers on `globalThis.__FITW__`) for verification.
- CORS: manual header middleware in `app.js` (no `cors` dep); currently `*` for the demo — lock to
  the outlet origin(s) at deploy.
- Widget visual style = **"Ink & Blush"** (light): navy #2E4A63 / blush #C99AA4 on white surface,
  page #F6F7F9, fonts Libre Caslon Display / Hanken Grotesk / IBM Plex Mono. Page structure + field
  layout from `widget/page-reference.html`; the silhouette is the neutral human figure reproduced
  EXACTLY from `widget/figure-reference.html` (driven by the §4.6 silhouette block + entered height).
  Restyle was VISUAL-ONLY — no change to fit logic, API call, §4.6 contract, wording, dual-mode, CORS.

## Open questions / to confirm
- Ease bands and selection weights are starting guesses (spec §4.2/§4.4) — confirm against a real outlet's chart + tailor during the validation pass.
- Length-to-hem ratio bands need calibration on real garments.

## Session log
<!-- newest first. one short entry per session: what got done, what's next, any gotcha. -->
- 2026-06-27 — BACKEND fix to fit wording + no-genuine-fit case (engine + wording + §4/§5 spec). (1)
  Directional "consider the larger/smaller size" suggestions now gated on whether that neighbour size
  actually EXISTS — the largest size never says "larger size", the smallest never says "smaller size"
  (engine passes hasSmaller/hasLarger from each row's position into `noteFor`). (2) Tight/loose phrasing
  now degree-aware (`severity` from ease magnitude, threshold SEVERE_MARGIN=4in): severe "Likely to feel
  far too tight…" vs mild "Runs a touch tight…" (and "Sits very loose…" vs "Runs loose…"), so smallest vs
  borderline never read the same. (3) NO-GENUINE-FIT: new top-level `fits_comfortably` (bool) + `fit_message`
  (string|null); when the closest size still has a too_tight zone → false, confidence stays low, honest
  message "This piece may not fit comfortably — the largest size still runs tight at the {zone}.", and the
  recommended size's `sizes[]` summary becomes "Closest available — not a comfortable fit" (role `closest`)
  instead of "Your best fit". Verified with 42/30/36 → XL, fits_comfortably false, XL bust note has NO
  larger-size suggestion. Tests 55→63 (wording exact strings updated for new phrasing; no-fit + degree +
  neighbour-gating + smallest≠largest tight strings; banned-word/number guard extended over all variants +
  noFitMessage). All green. Next render pass should surface `fits_comfortably` honestly (see checklist).
  Gotcha: enriching wording changed exact note strings → updated the old assertions in wording/fitEngine tests.
- 2026-06-27 — Widget render of the enriched recommendation (VISUAL only, `widget/fitw.js`). Body figure
  REMOVED/parked (dropped silhouette/figureFor/clamp + figure CSS + the `silhouette` export). Result panel
  now: prominent recommended size + confidence chip → between/aside nudge (kept, garment-only) → length
  note → **size ladder** of ALL `sizes[]` (label + `summary`; recommended row highlighted `fitw-srow--rec`
  + expanded showing per-zone notes; others collapsed `<button aria-expanded>` bodies, tap to expand —
  delegated click handler, keyboard-accessible, caret rotates, reduced-motion respected) → **model line**
  ("Model is {height}, wearing size {size_worn}." graceful variants; omitted when null) → collapsible
  **size guide** table (size+bust/waist/hip/length, mono numbers, inches, "—" for null). All API wording
  rendered verbatim. Per-instance id prefix so multiple widgets don't collide. Ink & Blush + scoped styles
  + dual-mode `globalThis.__FITW__` kept; fit logic / API call / response contract / CORS untouched. 55
  tests + Node render-check pass (clean pick M + between-sizes L both render ladder/model/guide correctly).
  Next: deployment.
- 2026-06-27 — Enriched the recommendation (BACKEND only). Migration `product_model_reference` added
  Product.modelHeight (String?) + modelSizeWorn (String?) (display-only, NOT engine inputs); seed demo
  product now "5'6\"" / "M". `recommendFit()` now also returns `sizes[]` covering EVERY chart size
  (size, recommended flag, per-zone {class,note}, garment-focused `summary` via new `summaryFor(role)`:
  best/fitted/roomier/tight/loose) — all existing §4.6 fields kept. Wording §5 enriched to fuller,
  natural per-zone phrasing (still garment-only, no body adjectives, no numbers). Route adds `size_guide`
  (chart rows) + `model_reference` ({height,size_worn} or null) — no extra query (already loaded). Spec
  updated: §3 schema+note, §4.6 output (sizes[]) + API-envelope note. Tests 46→55: sizes-array coverage
  + recommended flag + no-body-adjective/no-number guard across ALL sizes' notes & summaries; route
  asserts sizes[]/size_guide/model_reference and a no-model product → model_reference null. Verified full
  enriched JSON via curl. Next: widget render of the enrichment. Gotcha: enriching wording changed the
  exact note strings → updated the old exact-string assertions in fitEngine/fitRoute/wording tests.
- 2026-06-27 — VISUAL-ONLY restyle of widget + demo to "Ink & Blush" (light: navy #2E4A63 / blush
  #C99AA4 / white / #F6F7F9; fonts Libre Caslon Display + Hanken Grotesk + IBM Plex Mono for all
  numbers/size letter). `widget/fitw.js` now renders a 2-panel card (form | result) matching
  `page-reference.html` layout (bust full-width, waist+hip row, optional height, mono inputs w/ "in"
  suffix), scoped under `.fitw` (injects fonts + style once), navy button w/ navy focus ring, dots
  good=navy / snug+relaxed=blush / too_tight+too_loose=#BC5B4C. Silhouette swapped to the neutral human
  figure reproduced EXACTLY from `figure-reference.html` (`silhouette(m,stroke,soft)`), driven by the
  §4.6 silhouette block + entered height (defaults to 64 when absent). `demo.html` = page chrome
  (eyebrow + Caslon h1 + lede, measuring-tape tick-rule divider, widget card, 3-item value strip,
  footer). UNCHANGED: fit logic, API call, §4.6 render contract, garment-only wording (between-sizes
  paragraph + aside verbatim), dual-mode `globalThis.__FITW__`, CORS. Verified: 46 tests + Node
  render-check pass; clean pick (M/"Confident fit") and between-sizes (L/"Between sizes") render with
  navy figure + blush measure-lines. Quality floor: responsive (<=720 single-col), focus-visible ring,
  prefers-reduced-motion honored, styles scoped. Next: deployment. Note: the reference figure clamps
  circumference half-widths, so adjacent sizes look similar unless height differs — reproduced as-is
  (told not to redesign the figure).
- 2026-06-27 — Built Phase 1 frontend (rough demo). `widget/fitw.js`: single self-contained vanilla-JS
  widget (no framework/build) — mounts into `[data-outlet][data-product]` (+ optional `data-api`),
  renders bust/waist/hip (required) + height (optional) form with 20–80in client sanity, POSTs
  `/v1/fit/recommend`, renders §4.6. Garment-only wording (rule #1): recommended size prominent, per-zone
  notes w/ class dot, length_note, abstract 3-width symmetric silhouette SVG (§6). Between-sizes: medium
  confidence → co-equal neutral paragraph ("You're between M and L… comes down to the look you prefer");
  else if alt → light neutral aside. No body adjectives, no percentages. `widget/demo.html` hosts it vs
  demo-outlet/DEMO-001. CORS: manual middleware in `app.js` (no dep), `*` for now, OPTIONS→204. Verified:
  CORS preflight + POST headers via curl; Node render-check (imports widget pure fns via
  `globalThis.__FITW__`, hits real API) rendered clear-pick (M/high) and between-sizes (L/medium) HTML
  correctly. 46 tests still pass. Decisions logged + spec §2 note added. Next: deployment (hosted PG +
  API + static frontend, lock CORS). Gotcha: fitw.js intentionally uses no import/export so it's valid
  as BOTH a classic browser <script> and a Node ESM import (DOM access guarded by `typeof document`).
- 2026-06-27 — Built §9 accuracy harness (DEV TOOLING, not a product endpoint). `tools/validate.js`
  + `tools/validation-example.json`; `npm run validate <file>`. Loads JSON `{templates,cases}` or CSV
  cases (`--templates <json>`, reuses `src/lib/csv.js`); each case runs through the REAL `recommendFit`
  (no reimplementation). Reports overall accuracy %, a confusion summary (+1/-1/correct/other), and
  per-miss detail: body + template + expected-vs-predicted + a per-size weighted-score table with
  per-zone class+ease, flagging the predicted/expected rows and 0-0 size-up ties. The score breakdown
  is recomputed ONLY from the same exported primitives (easeBands.js) for explanation — engine logic
  untouched (bands/weights/selection unchanged, per task). Sample run on the example: 7/10 = 70%, 3
  misses (2×+1, 1×-1). 46 tests still pass. Optional `--min <pct>` exits 1 below threshold (tuning loop).
  Gotcha: `npm run validate` needs `--` before script flags (e.g. `npm run validate -- cases.csv
  --templates charts.json`) or npm swallows them; bare `npm run validate file.json` is fine. Next:
  field work — encode real outlet chart + real people's measurements/best-fit as cases, run, tune bands.
- 2026-06-27 — Built CSV bulk import (spec §8) — **completes all Phase 1 build items**. Intake: raw
  `text/csv` body (`express.text()` for text/csv|text/plain, 2mb). `src/lib/csv.js`: hand-rolled, zero-dep
  RFC-4180 `parseCsv`/`csvToObjects` (quotes, "" escapes, embedded commas/newlines, CRLF) — unit-tested
  instead of adding a parser lib (flagged, OK to swap for csv-parse later). `src/services/csvImport.js`:
  pure `planImport(records,{templates,existingSkus})` → {toInsert,errors}; resolves `template` col by
  id-then-name within the outlet (cross-tenant ref → "template not found"), reuses `createProductSchema`,
  insert-only dup handling (in-file + existing). Route `POST /v1/admin/import` (adminAuth, tenant-scoped):
  validate-all-then-atomic `createMany` in a $transaction (no half-import) → 200 {imported,skipped,errors};
  422 empty/missing-columns/no-rows. `GET /v1/admin/import/template` streams the header row; docs in
  `docs/csv-import.md` + `docs/product-import-sample.csv`. 46 tests pass (12 new: 6 parser, 6 route incl.
  clean import / bad-row-partial / dup-sku / 401 / 422 / cross-tenant no-leak). Verified live via curl
  (import 3 → re-import all-skipped → template download). Next: §9 validation pass (field work — tune
  ease bands + weights on real data). Gotcha: parallel test FILES share one DB — two files both deleting
  `ZZTEST*` templates hit a FK RESTRICT (one file's product referenced another's template). Fix: per-file
  unique fixture prefixes + own outlet (import uses `ZZCSV*` / `test-outlet-csv`). Demo data left in
  demo-outlet: products LAWN-001/KURTI-002/FORMAL-003 + the earlier stray "Curl Demo Template".
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
