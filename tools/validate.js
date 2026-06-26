// Accuracy harness for tuning the fit engine (spec §9). DEV TOOLING — not a
// product endpoint. Runs labelled measurement cases through the REAL engine
// (recommendFit) and reports accuracy + per-miss detail so you can see which
// ease bands / weights to nudge. It only MEASURES — it never changes engine
// logic. No DB, no new deps.
//
// Usage:
//   npm run validate tools/validation-example.json
//   npm run validate -- cases.csv --templates charts.json [--min 80]
//   (the `--` is required by npm only when passing flags through to the script)
//
// JSON input: { templates: { "<name>": { fitType, fabric?, rows:[...] } }, cases:[ ... ] }
// CSV input:  rows with columns label,bust,waist,hip,height,template,expected_size,fabric,fitType
//             (templates supplied via --templates <json>)
// Each case: { bust, waist, hip, height?, template (or inline `chart`), expected_size, fabric?, fitType?, label? }

import { readFileSync } from "node:fs";
import { recommendFit } from "../src/services/fitEngine.js";
import { csvToObjects } from "../src/lib/csv.js";
// Same published primitives the engine uses — imported (not re-derived) purely
// to EXPLAIN each result. The recommendation itself always comes from recommendFit.
import {
  CIRC_ZONES,
  ZONE_PENALTY,
  ZONE_WEIGHT,
  classifyZone,
  bandsFor,
} from "../src/services/easeBands.js";

function main() {
  const { file, templatesFile, minAccuracy } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error("usage: npm run validate <cases.json|cases.csv> [--templates charts.json] [--min 80]");
    process.exit(2);
  }

  const { templates, cases } = loadInput(file, templatesFile);
  if (cases.length === 0) {
    console.error(`No cases found in ${file}.`);
    process.exit(2);
  }

  const results = cases.map((c, i) => evaluateCase(c, i + 1, templates));
  report(file, results);

  const evaluated = results.filter((r) => !r.error);
  const hits = evaluated.filter((r) => r.hit).length;
  const accuracy = evaluated.length ? (hits / evaluated.length) * 100 : 0;

  if (minAccuracy != null && accuracy < minAccuracy) {
    console.error(`\nFAIL: accuracy ${accuracy.toFixed(1)}% is below --min ${minAccuracy}%.`);
    process.exit(1);
  }
}

// --- input loading -----------------------------------------------------------

function parseArgs(argv) {
  let file = null;
  let templatesFile = null;
  let minAccuracy = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--templates") templatesFile = argv[++i];
    else if (a.startsWith("--templates=")) templatesFile = a.slice("--templates=".length);
    else if (a === "--min") minAccuracy = Number(argv[++i]);
    else if (a.startsWith("--min=")) minAccuracy = Number(a.slice("--min=".length));
    else if (!a.startsWith("--")) file ??= a;
  }
  return { file, templatesFile, minAccuracy };
}

function loadInput(file, templatesFile) {
  if (file.toLowerCase().endsWith(".csv")) {
    const templates = templatesFile
      ? JSON.parse(readFileSync(templatesFile, "utf8")).templates ?? {}
      : {};
    const { records } = csvToObjects(readFileSync(file, "utf8"));
    const cases = records.map((r) => ({
      label: r.label || undefined,
      template: r.template || undefined,
      expected_size: r.expected_size,
      fabric: r.fabric || undefined,
      fitType: r.fitType || undefined,
      bust: num(r.bust),
      waist: num(r.waist),
      hip: num(r.hip),
      height: r.height ? num(r.height) : undefined,
    }));
    return { templates, cases };
  }

  const data = JSON.parse(readFileSync(file, "utf8"));
  return { templates: data.templates ?? {}, cases: data.cases ?? [] };
}

const num = (v) => (v === undefined || v === "" ? undefined : Number(v));

// --- evaluation --------------------------------------------------------------

function evaluateCase(c, n, templates) {
  const label = c.label || `case ${n}`;
  const body = { bust: c.bust, waist: c.waist, hip: c.hip, height: c.height };

  // Resolve the chart: inline `chart` wins, else look up the named template.
  const chart = c.chart ?? templates[c.template];
  if (!chart) {
    return { n, label, error: `template not found: "${c.template}"` };
  }

  const fitType = c.fitType ?? chart.fitType;
  const fabric = c.fabric ?? chart.fabric ?? null;
  const product = { fitType, fabric, rows: chart.rows };

  let out;
  try {
    out = recommendFit(body, product); // the REAL engine
  } catch (err) {
    return { n, label, error: err.message };
  }

  const orderOf = Object.fromEntries(chart.rows.map((r) => [r.sizeLabel, r.sortOrder]));
  const predicted = out.recommended_size;
  const expected = c.expected_size;
  const hit = predicted === expected;
  const delta =
    orderOf[predicted] != null && orderOf[expected] != null
      ? orderOf[predicted] - orderOf[expected]
      : null;

  return {
    n,
    label,
    body,
    templateName: c.template ?? "(inline)",
    fitType,
    fabric,
    expected,
    predicted,
    confidence: out.confidence,
    hit,
    delta,
    breakdown: explainSizes(body, product), // for the miss detail only
  };
}

/**
 * Per-size score / ease / class breakdown, recomputed from the SAME published
 * bands the engine uses (easeBands.js). Descriptive only — the actual pick comes
 * from recommendFit. Mirrors the engine's scoreSize so the report matches it.
 */
function explainSizes(body, product) {
  const bands = bandsFor(product.fitType);
  return [...product.rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => {
      let score = 0;
      const zones = {};
      for (const zone of CIRC_ZONES) {
        const chart = row[zone];
        const bodyVal = body[zone];
        if (typeof chart !== "number" || typeof bodyVal !== "number") continue;
        const ease = round2(chart - bodyVal);
        const cls = classifyZone(ease, bands[zone]);
        const penalty = round2(ZONE_PENALTY[cls] * ZONE_WEIGHT[zone]);
        score += penalty;
        zones[zone] = { ease, class: cls, penalty };
      }
      return { sizeLabel: row.sizeLabel, score: round2(score), zones };
    });
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- reporting ---------------------------------------------------------------

const DELTA_LABEL = {
  0: "correct (+/-0)",
  1: "one size too large (+1)",
  "-1": "one size too small (-1)",
};

function report(file, results) {
  const evaluated = results.filter((r) => !r.error);
  const errors = results.filter((r) => r.error);
  const hits = evaluated.filter((r) => r.hit).length;
  const accuracy = evaluated.length ? (hits / evaluated.length) * 100 : 0;

  line();
  console.log("Fit engine accuracy report");
  line();
  console.log(`File:     ${file}`);
  console.log(`Cases:    ${results.length} (${evaluated.length} evaluated, ${errors.length} errored)`);
  console.log(`Accuracy: ${hits}/${evaluated.length} = ${accuracy.toFixed(1)}%`);

  // Confusion summary.
  const buckets = { 0: 0, 1: 0, "-1": 0, other: 0 };
  for (const r of evaluated) {
    if (r.delta === 0) buckets[0]++;
    else if (r.delta === 1) buckets[1]++;
    else if (r.delta === -1) buckets["-1"]++;
    else buckets.other++;
  }
  console.log("\nConfusion (predicted vs expected):");
  console.log(`  ${DELTA_LABEL[0]}:        ${buckets[0]}`);
  console.log(`  ${DELTA_LABEL[1]}:   ${buckets[1]}`);
  console.log(`  ${DELTA_LABEL["-1"]}:   ${buckets["-1"]}`);
  console.log(`  two+ sizes off / other:   ${buckets.other}`);

  // Miss detail — the point of the tool.
  const misses = evaluated.filter((r) => !r.hit);
  if (misses.length) {
    console.log(`\nMisses (${misses.length}):`);
    for (const m of misses) printMiss(m);
  } else {
    console.log("\nNo misses.");
  }

  if (errors.length) {
    console.log(`\nErrored cases (${errors.length}):`);
    for (const e of errors) console.log(`  #${e.n} ${e.label}: ${e.error}`);
  }
  line();
}

function printMiss(m) {
  const deltaTxt =
    m.delta == null
      ? "size off (unmappable)"
      : m.delta === 0
      ? ""
      : `${m.delta > 0 ? "+" : ""}${m.delta}, ${
          m.delta > 0 ? "one+ size too large" : "one+ size too small"
        }`;

  console.log("");
  console.log(`  #${m.n}  ${m.label}`);
  console.log(
    `     body: bust ${m.body.bust}, waist ${m.body.waist}, hip ${m.body.hip}` +
      (m.body.height != null ? `, height ${m.body.height}` : "") +
      `   | template "${m.templateName}" (${m.fitType}, fabric ${m.fabric ?? "none"})`
  );
  console.log(
    `     expected ${m.expected}  ->  predicted ${m.predicted}   (${deltaTxt})   confidence: ${m.confidence}`
  );
  console.log("     size scores (weighted, lower = better):");
  for (const s of m.breakdown) {
    const zoneTxt = CIRC_ZONES.filter((z) => s.zones[z])
      .map((z) => `${z} ${s.zones[z].class}(${fmtEase(s.zones[z].ease)})`)
      .join("  ");
    const tag =
      s.sizeLabel === m.predicted && s.sizeLabel === m.expected
        ? " <- predicted & expected"
        : s.sizeLabel === m.predicted
        ? " <- predicted"
        : s.sizeLabel === m.expected
        ? " <- expected"
        : "";
    console.log(`       ${s.sizeLabel.padEnd(3)} ${s.score.toFixed(2).padStart(6)}  ${zoneTxt}${tag}`);
  }

  // Helpful nudge: a 0-vs-0 (or near) tie that the size-up rule resolved.
  const exp = m.breakdown.find((s) => s.sizeLabel === m.expected);
  const pred = m.breakdown.find((s) => s.sizeLabel === m.predicted);
  if (exp && pred && Math.abs(exp.score - pred.score) < 1e-9) {
    console.log(`     note: expected and predicted tied at ${pred.score.toFixed(2)} — engine sized up (prefer larger).`);
  }
}

const fmtEase = (e) => `${e >= 0 ? "+" : ""}${e.toFixed(1)}`;
const line = () => console.log("=".repeat(72));

main();
