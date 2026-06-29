# CSV bulk product import

Bulk-create products for one outlet by uploading a CSV. Implements spec §8
("the single most important onboarding feature").

## Endpoint

```
POST /v1/admin/import
  Auth:    Authorization: Bearer <admin_token>   (or  X-Admin-Token: <admin_token>)
  Body:    raw CSV, Content-Type: text/csv
  → 200    { imported, skipped, errors: [{ row, reason }] }
  → 401    missing/invalid admin token
  → 422    empty body, missing required columns, or no data rows
```

Download a blank template (header row) any time:

```
GET /v1/admin/import/template   → text/csv attachment
```

A filled example lives at [`product-import-sample.csv`](./product-import-sample.csv).

## Columns

Header names must match exactly. Required: **sku**, **template**, **garmentType**.

| column            | required | notes                                                                 |
|-------------------|----------|-----------------------------------------------------------------------|
| `sku`             | yes      | unique per outlet; matches `data-product` on the page                 |
| `template`        | yes      | references an existing size-chart template **by id or by name** (this outlet only) |
| `garmentType`     | yes      | `one_piece` or `two_piece`                                            |
| `name`            | no       | product display name                                                  |
| `fabric`          | no       | e.g. `lawn` / `cotton` / `formal` (drives the shrink size-up hint)     |
| `fitTypeOverride` | no       | `fitted` / `regular` / `loose`; overrides the template's fit type      |
| `colorSlot`       | no       | Phase 2 (integer); accepted now, unused in Phase 1 logic               |
| `formality`       | no       | Phase 2 (`casual`/`semi`/`formal`); accepted now, unused               |
| `styleTag`        | no       | Phase 2 (`ethnic`/`fusion`); accepted now, unused                      |
| `unstitched`      | no       | `true`/`false` (also `1`/`0`, `yes`/`no`). Default `false`             |
| `fabricShirtFront`| cond.    | included cloth in **meters**; **required when `unstitched` is true** (spec §11) |
| `fabricShirtBack` | cond.    | meters; required when `unstitched` is true                             |
| `fabricSleeves`   | cond.    | meters; required when `unstitched` is true                             |
| `fabricTrouser`   | cond.    | meters; required when `unstitched` is true                             |
| `fabricDupatta`   | cond.    | meters; required when `unstitched` is true                             |

- Standard CSV quoting is supported (`"Formal Pret, Heavy"`, `""` for a literal quote, quoted newlines).
- Blank optional cells are treated as "not provided". Unknown extra columns are ignored.
- **Unstitched rule (spec §11):** a row with `unstitched=true` must supply **all five** `fabric*` yardages (meters); a missing one is reported per-row (`fabricSleeves: required (in meters) when unstitched is true`) and that row is skipped — the rest of the file still imports.

## Import semantics

- **Validated per row** with the same Zod schema as `POST /v1/admin/products`.
- **Partial success:** a bad row does not fail the whole file. Good rows import; bad
  rows are reported in `errors` with `row` (1-based data-record number, header excluded)
  and a human-readable `reason`.
- **Atomic write:** all valid rows are written in a single transaction, so a mid-file
  write failure imports nothing rather than leaving a half-loaded catalog.
- **Duplicate SKUs are insert-only + reported** (never overwrite in Phase 1):
  - already in the outlet → `sku already exists: "..."`
  - repeated within the file → `duplicate sku within file: "..."` (first occurrence imports)
- **Tenant isolation:** `template` only resolves against the authenticated outlet's
  templates. Referencing another outlet's template id fails that row with
  `template not found` — no cross-tenant read or write.

## Example

```bash
curl -X POST http://localhost:3000/v1/admin/import \
  -H "Authorization: Bearer demo-admin-token" \
  -H "Content-Type: text/csv" \
  --data-binary @docs/product-import-sample.csv
# → {"imported":4,"skipped":0,"errors":[]}  (3 stitched + 1 unstitched 3-piece)
```
