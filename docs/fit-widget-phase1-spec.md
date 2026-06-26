# Fit Recommender — Phase 1 Build Spec

**Product:** An embeddable size/fit recommendation widget for Pakistani ready-to-wear (pret) ethnic-wear outlets.
**Phase 1 goal:** A single real outlet can load their catalog + size charts, and a shopper on a product page can enter measurements and get an accurate recommended size with garment-focused fit notes and an abstract silhouette.
**Build target:** Solo dev, Node/Postgres/React, rule-based (no ML, zero per-request cost).

---

## 1. Scope

**In scope (Phase 1):**
- Multi-tenant data model (one `outlet_id` per customer) — built in from day 1 so it scales, even though only one outlet onboards now.
- Outlet onboarding: add products, attach size charts (reusable templates + per-product override), CSV bulk import.
- Shopper flow: enter measurements (inches) → recommended size + per-zone fit labels + abstract silhouette.
- Embeddable widget (one `<script>` snippet drops onto a product page).

**Explicitly OUT of scope (later phases — architecture leaves room, code does not build):**
- Phase 1.5 — measurement-estimation quiz (for shoppers who skip measurements).
- Phase 2 — pairing / "what goes with this" engine.
- Phase 3 — unstitched fabric-sufficiency calculator.
- Marketplace / storefront / payments — not this product, ever (per our discussion).

**Target garment:** ready-to-wear two-piece and one-piece (kameez + trouser, kurti, frock). NOT unstitched.

---

## 2. Architecture

```
Shopper browser (outlet's product page)
        │  loads <script> snippet
        ▼
  React widget (embeddable bundle)
        │  POST /v1/fit/recommend
        ▼
  Node/Express API  ──────►  Postgres
        ▲                     (outlets, products, size_chart_templates,
        │                      size_chart_rows, products↔templates)
  Outlet admin (CRUD + CSV import)
```

- **API:** Node + Express. Stateless. All fit math server-side (keeps logic private, lets you fix bugs without re-shipping the widget).
- **DB:** Postgres, accessed through **Prisma** (schema-as-code + generated migrations + typed client — kills the migration friction while keeping relational structure).
- **Widget:** React, built to a single self-contained JS bundle. Embed pattern like analytics scripts:
  ```html
  <div id="fitw" data-outlet="OUTLET_KEY" data-product="PRODUCT_SKU"></div>
  <script src="https://cdn.yourdomain.com/fitw.js" async></script>
  ```
  The script reads the data attributes, mounts the widget, calls the API.
- **Auth:** outlet gets a public `outlet_key` (used by the widget, safe to expose) and a secret admin token (for CRUD/import). Phase 1 can keep admin auth simple (single token per outlet).

---

## 3. Data model

Measurement convention — **decide once, document on every chart input** (this is the #1 source of bugs):
> Store the garment's **finished "to-fit" body measurement** per size — i.e. the body measurement the size is *designed to fit*, as published in the brand's size chart. All values in **inches**. Pakistani charts are conventionally measured this way and in inches.

Zones tracked in Phase 1: `bust`, `waist`, `hip`, `kameezLength`, and for two-piece: `trouserWaist`, `trouserLength`. Keep it to these six; add shoulder/sleeve later only if outlets ask.

The model stays relational (the structural reason we chose Postgres): an outlet owns templates, a template owns its size rows, and many products *reference* one template — that shared reference is the onboarding-friction fix, so it must be a relation, not a copy.

`schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum FitType {
  fitted
  regular
  loose
}

enum GarmentType {
  one_piece
  two_piece
}

model Outlet {
  id         String              @id @default(cuid())
  name       String
  outletKey  String              @unique          // public, used by widget
  adminToken String                               // secret, used for CRUD/import
  createdAt  DateTime            @default(now())
  templates  SizeChartTemplate[]
  products   Product[]
}

// Reusable chart (e.g. "Lawn Standard") so an outlet enters S/M/L/XL ONCE
// and reuses it across many products. This is the key onboarding-friction fix.
model SizeChartTemplate {
  id        String          @id @default(cuid())
  outletId  String
  outlet    Outlet          @relation(fields: [outletId], references: [id], onDelete: Cascade)
  name      String                                 // "Lawn Standard", "Formal Pret"
  fitType   FitType
  createdAt DateTime        @default(now())
  rows      SizeChartRow[]
  products  Product[]
}

// One row per size within a template. All measurements in inches, "to-fit" body.
model SizeChartRow {
  id            String            @id @default(cuid())
  templateId    String
  template      SizeChartTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  sizeLabel     String                              // 'S' | 'M' | 'L' | 'XL' | 'XXL'
  sortOrder     Int                                 // explicit S<M<L<XL ordering
  bust          Float?
  waist         Float?
  hip           Float?
  kameezLength  Float?                              // garment length, shoulder to hem
  trouserWaist  Float?                              // null for one-piece
  trouserLength Float?                              // null for one-piece

  @@unique([templateId, sizeLabel])
}

model Product {
  id              String             @id @default(cuid())
  outletId        String
  outlet          Outlet             @relation(fields: [outletId], references: [id], onDelete: Cascade)
  sku             String                             // matches data-product on the page
  name            String?
  templateId      String
  template        SizeChartTemplate  @relation(fields: [templateId], references: [id])
  fitTypeOverride FitType?                           // overrides template fitType if set
  garmentType     GarmentType
  fabric          String?                            // 'lawn'|'cotton'|'formal' (drives size-up hint)

  // --- Phase 2 foresight: add now, leave unused, so no migration later ---
  colorSlot       Int?                               // index into fixed 12–16 palette
  formality       String?                            // 'casual'|'semi'|'formal'
  styleTag        String?                            // 'ethnic'|'fusion'

  @@unique([outletId, sku])
  @@index([outletId, colorSlot, formality])          // for Phase 2 pairing queries
}
```

Notes on the schema choices:
- **`rows` is a relation, not a JSON column.** Keeps each size a real typed record you can query/validate, and Prisma fetches them in one nested read (no join pain in your code).
- **CUID string ids** — friendlier than auto-int for ids that travel in URLs/embeds.
- **Phase 2 columns are already here** (`colorSlot`, `formality`, `styleTag`) but unused in Phase 1. This is the cheap insurance we discussed — you avoid a migration when the pairing engine lands. Leaving them nullable means Phase 1 writes ignore them safely.
- **Migrations:** `npx prisma migrate dev --name <change>` generates and applies each change. Early schema edits are seconds, and every change is versioned in `prisma/migrations/` — this is the "no migration hell" you wanted, with the DB still enforcing shape.

Seed defaults to lower onboarding friction — offer these as a starting template the outlet then tweaks. Pakistani "Medium" commonly sits around **bust 36–38, waist 28–30, hip 38–40 inches**; S/M/L/XL are the standard labels; industry tolerance is **±1 inch**. Pre-fill a template with these and let them adjust.

---

## 4. Fit calculation logic (the core)

Pure arithmetic. Given a shopper's body measurements and a product's chart, score each size and pick the best.

### 4.1 Inputs
```
body = { bust, waist, hip, height }          // inches; height optional but used for length
product → template rows (one per size) + effective fit_type
```

The engine loads everything it needs in one Prisma read (product + its template + the template's rows):
```js
const product = await prisma.product.findUnique({
  where: { outletId_sku: { outletId, sku } },
  include: { template: { include: { rows: { orderBy: { sortOrder: "asc" } } } } },
});
const fitType = product.fitTypeOverride ?? product.template.fitType;
const rows = product.template.rows;   // [{ sizeLabel, bust, waist, hip, ... }]
```

### 4.2 Ease and ideal-ease bands
For each size and each circumference zone (bust, waist, hip):
```
ease = chart_value(size, zone) - body(zone)
```
`ease` is how much room the garment gives. The *ideal* ease depends on `fit_type` and zone. Use a lookup table of target ranges (inches). Starting values (tune with a real tailor):

| fit_type | bust ideal | waist ideal | hip ideal |
|----------|-----------|-------------|-----------|
| fitted   | 1.5 – 3   | 1 – 2.5     | 2 – 3.5   |
| regular  | 3 – 5     | 2.5 – 4.5   | 3 – 5     |
| loose    | 5 – 8     | 4 – 7       | 5 – 8     |

### 4.3 Per-zone classification
Compare `ease` to that zone's ideal `[lo, hi]`:
```
ease < lo - 1            → "too_tight"
lo - 1 ≤ ease < lo       → "snug"
lo ≤ ease ≤ hi           → "good"
hi < ease ≤ hi + 2       → "relaxed"
ease > hi + 2            → "too_loose"
```
(The −1 / +2 margins reflect the ±1in tolerance plus a little asymmetry — too-loose is more forgiving than too-tight.)

### 4.4 Size selection
```
for each size:
    score = sum over {bust, waist, hip} of zone_penalty(class)
        zone_penalty: good=0, snug=1, relaxed=1, too_tight=4, too_loose=3
    weight bust and waist higher than hip (bust ×1.3, waist ×1.2, hip ×1.0)
recommended = size with LOWEST weighted score
tie-break:  prefer the LARGER size  (matches "if between sizes, size up",
            and bump strength if product.fabric ∈ {lawn, cotton} which shrink)
confidence = high if winning score ≈ 0 and margin to next size is clear;
             medium otherwise; low if even the best size has any too_tight zone
alternative = second-lowest score (offer as "also consider")
```

### 4.5 Length (handled separately, needs height)
`kameez_length` is a garment length, not a circumference — don't run it through ease bands. Map against height to a descriptive hem position:
```
if height given:
    ratio = kameez_length / height
    classify ratio into: "above knee" / "at knee" / "below knee" / "mid-calf"
    (calibrate these bands on a few real garments)
else:
    report raw length only ("garment length: 40in"), no hem claim
```
Length never changes the recommended size; it's advisory.

### 4.6 Output object
```json
{
  "recommended_size": "M",
  "confidence": "high",
  "alternative_size": "L",
  "zones": {
    "bust":  { "class": "good",    "note": "Sits comfortably at the bust." },
    "waist": { "class": "relaxed", "note": "A little loose at the waist." },
    "hip":   { "class": "good",    "note": "Comfortable through the hip." }
  },
  "length_note": "Falls just below the knee at your height.",
  "silhouette": { "bust": 37, "waist": 30, "hip": 40 }  // for the SVG
}
```

---

## 5. Wording rules (non-negotiable)

**Describe the garment at a point. Never describe the body.** This is what keeps the tool inclusive and non-judgmental — and it's a feature you can point to when selling.

| class | allowed phrasing (about the garment) | never say |
|-------|--------------------------------------|-----------|
| too_tight | "This may feel tight at the {zone} — consider the larger size." | anything about the body being big |
| snug | "Fitted at the {zone}." | — |
| good | "Sits comfortably at the {zone}." | — |
| relaxed | "A little loose at the {zone}." | — |
| too_loose | "Quite loose at the {zone} — the smaller size may sit better." | — |

Keep the phrase keyed only on `{zone}` + `class`. No body adjectives anywhere in the codebase.

---

## 6. The silhouette (abstract, not anatomical)

- A single neutral SVG outline whose proportions scale by the **ratios** of the shopper's bust/waist/hip (normalized), NOT a realistic figure.
- Schematic: think a simple symmetric shape with three control widths. Goal is "shows the garment's relative fit zones," not "looks like a person."
- Drive it from the `silhouette` block in the output. Keep it flat-colored and abstract so it never invites body comparison.
- Optional later: overlay green/amber zones matching the per-zone `class`. Phase 1 can ship without the overlay.

---

## 7. API surface (Phase 1)

```
POST /v1/fit/recommend
  body: { outlet_key, sku, measurements: { bust, waist, hip, height? } }
  → 200 { recommended_size, confidence, alternative_size, zones, length_note, silhouette }
  → 422 if measurements missing/implausible (negative, out of 20–80in sanity range)

# Admin (admin_token in header)
POST   /v1/admin/templates                 create chart template
POST   /v1/admin/templates/:id/rows        add/replace size rows
POST   /v1/admin/products                  create product
POST   /v1/admin/import                     CSV bulk import (products + chart)
GET    /v1/admin/products                   list (for the admin UI)
```

Validate every measurement against a sanity range; reject nonsense early.

---

## 8. Onboarding flow (where the real effort goes)

The bottleneck is data, not code. Make it painless:

1. Outlet signs up → gets `outlet_key` + `admin_token`.
2. Start them on a **pre-filled default template** (the bust 36–38 / waist 28–30 / hip 38–40 M-anchored S–XL set) so they edit, not author.
3. **CSV bulk import:** one upload maps products → template + fabric + garment_type. Provide a downloadable CSV template. This is the single most important onboarding feature — prioritize it.
4. They paste the embed snippet onto product pages (give copy-paste instructions per platform: Shopify, WooCommerce, custom).
5. A "test this product" preview so they see the widget before going live.

---

## 9. Validation plan (do this before claiming accuracy)

1. Take one real outlet's published chart + 8–10 real products.
2. Recruit 5–10 people with known measurements who own those items and know their true best size.
3. Run their measurements through the engine; check recommended size matches their real best fit.
4. Tune the ease bands (§4.2) and selection weights (§4.4) against the misses — ideally with a tailor sanity-checking the bands.
5. Only after this passes do you pitch "reduces sizing returns" to outlets — accuracy is the entire value prop, so don't oversell it before it's measured.

---

## 10. Build order (checklist)

- [ ] Prisma init + `schema.prisma` (§3) → `migrate dev`, generate client
- [ ] Seed script: default template (bust 36–38 / waist 28–30 / hip 38–40, S–XL)
- [ ] `POST /v1/fit/recommend` with the §4 algorithm + §5 wording
- [ ] Sanity validation on measurements
- [ ] Admin CRUD + CSV import (§7, §8)
- [ ] React widget: measurement form (inches) → calls API → renders size + zone notes
- [ ] Abstract silhouette SVG (§6), no overlay yet
- [ ] Embed snippet + one-outlet onboarding
- [ ] Validation pass (§9), tune bands
- [ ] Ship to ONE real outlet, watch it work, then iterate

---

## Roadmap after Phase 1 (noted so the architecture leaves room — do NOT build yet)

- **1.5 — Estimation quiz:** for shoppers who skip measurements. Height + weight + a body-shape pick + usual size → *estimate* bust/waist/hip, then feed the same engine. (Weight is an input to estimating measurements, never an addition to them.)
- **2 — Pairing engine:** customer-chosen intent (Contrast / Tonal / Complementary / Neutral) as lookups on a 12–16 slot color palette + category + formality filter. The `colorSlot` / `formality` / `styleTag` columns are already in the Phase 1 schema (unused), and the `@@index` for filtered queries is too — so this phase is logic-only, no migration.
- **3 — Unstitched fabric-sufficiency:** needed = kameez piece (length × flare factor) + sleeve piece + trouser piece − fabric-width adjustment, compared to the seller's stated yardage. Requires the shopper to pick the intended cut. Ship a coarse band version first; precise yardage needs tailor validation.
