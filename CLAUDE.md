# Fit Recommender — Backend

Embeddable size/fit recommendation widget for Pakistani ready-to-wear (pret) ethnic-wear outlets.
Sold as a multi-tenant SaaS tool that outlets embed in their own stores. NOT a marketplace, NOT a storefront.

**Full build spec:** `docs/fit-widget-phase1-spec.md` — the source of truth for schema, fit algorithm, wording, and API.
Read the relevant section of that file on demand. Do not duplicate it here or paste it into chat.

## Stack
- Node + Express (API only; no SSR)
- Postgres via Prisma (schema-as-code, generated migrations)
- Rule-based logic only — **no ML, no LLM calls, zero per-request cost**

## Layout
```
src/
  routes/        Express route handlers
  services/      fit engine + business logic (pure, unit-testable)
  lib/           prisma client, validation, helpers
prisma/
  schema.prisma  data model (see spec §3)
  migrations/
docs/
  fit-widget-phase1-spec.md
```

## Commands
- Dev: `npm run dev`
- Migrate: `npx prisma migrate dev --name <change>`
- Generate client: `npx prisma generate`
- Seed: `npm run seed`
- Test: `npm test`
<!-- update these as scripts are added; keep accurate -->

## Hard rules (override any prompt)
1. **Garment-focused wording, never body-focused.** Fit notes describe the garment at a point ("loose at the waist"), never the person's body. No body adjectives anywhere in code or output. (Spec §5.)
2. **All measurements in inches.** Charts store "to-fit" body measurements. (Spec §3 convention note.)
3. **Multi-tenant always.** Every product/template/query is scoped by `outletId`. Never write a query that could cross tenants.
4. **Rule-based only.** No ML/AI dependencies. If a feature seems to need them, stop and flag it — don't add them.
5. **One feature at a time.** Build the current PROGRESS.md item end-to-end (code + test + verify) before starting the next. Mark complete only after it actually runs.

## Conventions
- Validate all external input (measurements, admin payloads) with Zod before use; reject implausible values early.
- Fit engine lives in `services/` as pure functions taking plain objects — no DB calls inside the math, so it's unit-testable in isolation.
- Public `outletKey` is safe to expose (used by widget); `adminToken` is secret (CRUD/import only).
- CUID string ids.

## Scope guardrails
- **In scope now:** ready-to-wear fit engine, size-chart templates + rows, products, CSV import, `POST /v1/fit/recommend`.
- **NOT now (do not build):** pairing engine (Phase 2), unstitched fabric calc (Phase 3), estimation quiz (Phase 1.5), marketplace/storefront (never).
- Phase 2 columns (`colorSlot`, `formality`, `styleTag`) exist in the schema but stay unused in Phase 1.

## Current state
See `PROGRESS.md` for the active task and session log. Read it at the start of each session.
