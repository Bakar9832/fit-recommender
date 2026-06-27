/*
 * Fit Recommender — embeddable widget (Phase 1 demo).
 *
 * DELIBERATE DEMO CHOICE: single self-contained vanilla-JS file, no framework,
 * no build step — chosen over spec §2's React bundle for fast iteration + data
 * collection. See PROGRESS.md "Decisions made".
 *
 * Embed (spec §2 shape):
 *   <div data-outlet="OUTLET_KEY" data-product="SKU" data-api="https://api..."></div>
 *   <script src="fitw.js" async></script>
 *
 * Visual style: "Ink & Blush" (light) — navy #2E4A63 / blush #C99AA4 on a white
 * surface. Wording is garment-focused only (hard rule #1 / §5): never describes
 * the body, no percentages. Styles are scoped under the `.fitw` root so nothing
 * leaks into the host page. The file uses no import/export so it loads as a
 * classic browser script AND can be imported in Node (pure helpers on
 * globalThis.__FITW__) for verification.
 */
(function () {
  "use strict";

  var SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL"];
  var ZONES = ["bust", "waist", "hip"];
  var MIN_IN = 20;
  var MAX_IN = 80;

  // Ink & Blush figure colors (figure-reference "02 · Ink & blush").
  var FIG_STROKE = "#2E4A63"; // navy linework
  var FIG_SOFT = "#C99AA4"; // blush measure-lines

  // ---- pure helpers (rendering + wording; no DOM) ---------------------------

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function orderIndex(size) {
    var i = SIZE_ORDER.indexOf(String(size).toUpperCase());
    return i === -1 ? null : i;
  }

  // Order two size labels small→large (falls back to given order if unknown).
  function smallerLarger(a, b) {
    var ia = orderIndex(a);
    var ib = orderIndex(b);
    if (ia != null && ib != null && ib < ia) return [b, a];
    return [a, b];
  }

  // Neutral "between sizes" choice — describes the GARMENT silhouette (fitted vs
  // relaxed), never the body, and never implies one size is the better outcome.
  function betweenSizesParagraph(recommended, alternative) {
    var pair = smallerLarger(recommended, alternative);
    var small = esc(pair[0]);
    var large = esc(pair[1]);
    return (
      "You're between " + small + " and " + large + ". " +
      small + " gives a closer, more fitted shape. " +
      large + " sits relaxed with more room. " +
      "Both will fit — it comes down to the look you prefer."
    );
  }

  // Lighter neutral line for a clear pick that still has an alternative.
  function alsoConsiderLine(recommended, alternative) {
    var pair = smallerLarger(recommended, alternative);
    if (esc(pair[1]) === esc(alternative)) {
      return "Prefer more room? " + esc(alternative) + " sits more relaxed.";
    }
    return "Prefer a closer shape? " + esc(alternative) + " sits more fitted.";
  }

  // Display label for the confidence chip (visual only; not a fit judgment).
  function chipLabel(confidence) {
    if (confidence === "high") return "Confident fit";
    if (confidence === "medium") return "Between sizes";
    return "Closest fit";
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /* Neutral human figure — rounded sloping shoulders, proportions from
   * measurements. Reproduced exactly from widget/figure-reference.html. */
  function silhouette(m, stroke, soft) {
    var cx = 60;
    var bustHW = clamp((m.bust - 24) * 0.85, 13, 28);
    var waistHW = clamp((m.waist - 22) * 0.8, 10, 24);
    var hipHW = clamp((m.hip - 26) * 0.85, 14, 30);
    var shoulderHW = bustHW + 3.5;
    var ankleHW = hipHW * 0.32;
    var neckHW = 3.6;
    var hf = clamp((m.height - 64) * 1.3, -8, 12);

    var headCy = 11, headR = 8.5;
    var neckBaseY = 24, shoulderY = 31, bustY = 50;
    var waistY = 76 + hf * 0.4, hipY = 102 + hf * 0.8, hemY = 168 + hf * 1.6;

    function L(x, y) {
      return x.toFixed(1) + " " + y.toFixed(1);
    }

    var body =
      "M " + L(cx - neckHW, neckBaseY) +
      " C " + L(cx - neckHW - 3, neckBaseY + 2) + " " + L(cx - shoulderHW + 5, shoulderY - 3) + " " + L(cx - shoulderHW, shoulderY) +
      " C " + L(cx - shoulderHW - 1, shoulderY + 8) + " " + L(cx - bustHW - 1, bustY - 10) + " " + L(cx - bustHW, bustY) +
      " C " + L(cx - bustHW, bustY + 9) + " " + L(cx - waistHW, waistY - 11) + " " + L(cx - waistHW, waistY) +
      " C " + L(cx - waistHW, waistY + 11) + " " + L(cx - hipHW, hipY - 13) + " " + L(cx - hipHW, hipY) +
      " C " + L(cx - hipHW, hipY + 10) + " " + L(cx - ankleHW - 7, hemY - 32) + " " + L(cx - ankleHW - 6, hemY) +
      " L " + L(cx - 1.6, hemY) + " L " + L(cx - 1.6, hipY + 12) + " L " + L(cx + 1.6, hipY + 12) + " L " + L(cx + 1.6, hemY) +
      " L " + L(cx + ankleHW + 6, hemY) +
      " C " + L(cx + ankleHW + 7, hemY - 32) + " " + L(cx + hipHW, hipY + 10) + " " + L(cx + hipHW, hipY) +
      " C " + L(cx + hipHW, hipY - 13) + " " + L(cx + waistHW, waistY + 11) + " " + L(cx + waistHW, waistY) +
      " C " + L(cx + waistHW, waistY - 11) + " " + L(cx + bustHW, bustY + 9) + " " + L(cx + bustHW, bustY) +
      " C " + L(cx + bustHW + 1, bustY - 10) + " " + L(cx + shoulderHW + 1, shoulderY + 8) + " " + L(cx + shoulderHW, shoulderY) +
      " C " + L(cx + shoulderHW - 5, shoulderY - 3) + " " + L(cx + neckHW + 3, neckBaseY + 2) + " " + L(cx + neckHW, neckBaseY) +
      " Z";

    var armL = "M " + L(cx - shoulderHW + 0.5, shoulderY + 1) + " C " + L(cx - shoulderHW - 6, bustY) + " " + L(cx - waistHW - 8, waistY) + " " + L(cx - waistHW - 5, hipY - 10);
    var armR = "M " + L(cx + shoulderHW - 0.5, shoulderY + 1) + " C " + L(cx + shoulderHW + 6, bustY) + " " + L(cx + waistHW + 8, waistY) + " " + L(cx + waistHW + 5, hipY - 10);

    function ml(y, hw) {
      return '<line x1="' + (cx - hw) + '" y1="' + y + '" x2="' + (cx + hw) + '" y2="' + y + '" stroke="' + soft + '" stroke-width="0.8" stroke-dasharray="1.5 3" opacity="0.75"/>';
    }

    return (
      '<svg viewBox="0 0 120 ' + (hemY + 12).toFixed(0) + '" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="' + cx + '" cy="' + headCy + '" r="' + headR + '" stroke="' + stroke + '" stroke-width="1.6"/>' +
      '<path d="M ' + L(cx - neckHW, neckBaseY) + " L " + L(cx - neckHW + 0.4, headCy + headR - 1.5) + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
      '<path d="M ' + L(cx + neckHW, neckBaseY) + " L " + L(cx + neckHW - 0.4, headCy + headR - 1.5) + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
      '<path d="' + body + '" stroke="' + stroke + '" stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="' + armL + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
      '<path d="' + armR + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
      ml(bustY, bustHW) + ml(waistY, waistHW) + ml(hipY, hipHW) +
      "</svg>"
    );
  }

  // Build the abstract figure from a §4.6 silhouette block + the entered height.
  function figureFor(silhouetteBlock, height) {
    if (!silhouetteBlock) return "";
    var b = silhouetteBlock.bust, w = silhouetteBlock.waist, h = silhouetteBlock.hip;
    if (typeof b !== "number" || typeof w !== "number" || typeof h !== "number") return "";
    var m = { bust: b, waist: w, hip: h, height: typeof height === "number" ? height : 64 };
    return silhouette(m, FIG_STROKE, FIG_SOFT);
  }

  // Assemble the result panel from a §4.6 response object. Returns HTML string.
  // opts.height (optional) drives the figure's vertical proportions.
  function renderResultHTML(data, opts) {
    opts = opts || {};
    var rec = data.recommended_size;
    var alt = data.alternative_size;
    var html = "";

    html +=
      '<div class="fitw-size-head"><span class="fitw-size-big">' +
      esc(rec) +
      '</span><span class="fitw-size-cap">Recommended<br>size</span></div>';
    html += '<span class="fitw-chip">' + esc(chipLabel(data.confidence)) + "</span>";

    html += '<div class="fitw-figure">' + figureFor(data.silhouette, opts.height) + "</div>";

    // Per-zone garment notes (already garment-focused from the API).
    html += '<ul class="fitw-zones">';
    ZONES.forEach(function (z) {
      var zone = data.zones && data.zones[z];
      if (!zone) return;
      html +=
        '<li><span class="fitw-dot fitw-' + esc(zone.class) + '"></span>' +
        '<span class="fitw-zname">' + esc(z) + "</span>" +
        "<span>" + esc(zone.note) + "</span></li>";
    });
    html += "</ul>";

    if (data.length_note) {
      html += '<p class="fitw-length">' + esc(data.length_note) + "</p>";
    }

    // Between-sizes: medium confidence is the genuine "between" signal → present
    // both as a real, equal choice. Otherwise, if an alternative exists, offer
    // it as a lighter neutral aside.
    if (data.confidence === "medium" && alt) {
      html += '<div class="fitw-between">' + betweenSizesParagraph(rec, alt) + "</div>";
    } else if (alt) {
      html += '<p class="fitw-also">' + alsoConsiderLine(rec, alt) + "</p>";
    }

    return html;
  }

  // Expose pure helpers for Node-side verification (no-op in the browser).
  if (typeof globalThis !== "undefined") {
    globalThis.__FITW__ = {
      betweenSizesParagraph: betweenSizesParagraph,
      alsoConsiderLine: alsoConsiderLine,
      silhouette: silhouette,
      renderResultHTML: renderResultHTML,
    };
  }

  // ---- browser-only: fonts, styles, mounting, form, fetch -------------------

  if (typeof document === "undefined") return;

  var FONTS_HREF =
    "https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

  // Ink & Blush, scoped entirely under `.fitw`.
  var STYLE = [
    '.fitw{--fitw-paper:#F6F7F9;--fitw-surface:#FFFFFF;--fitw-navy:#2E4A63;--fitw-blush:#C99AA4;--fitw-ink:#1C2A3A;--fitw-muted:#8893A1;--fitw-line:#E7EAEF;--fitw-clay:#BC5B4C;--fitw-display:"Libre Caslon Display",Georgia,serif;--fitw-body:"Hanken Grotesk",system-ui,sans-serif;--fitw-mono:"IBM Plex Mono",ui-monospace,monospace;font-family:var(--fitw-body);color:var(--fitw-ink);line-height:1.5;-webkit-font-smoothing:antialiased}',
    ".fitw *{box-sizing:border-box}",
    ".fitw-card{position:relative;display:grid;grid-template-columns:1fr 1fr;background:var(--fitw-surface);border:1px solid var(--fitw-line);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -34px rgba(46,74,99,.35)}",
    ".fitw-card::before{content:'';position:absolute;top:0;left:0;right:0;height:8px;background:repeating-linear-gradient(90deg,rgba(201,154,164,.6) 0 1px,transparent 1px 13px)}",
    ".fitw-panel{padding:clamp(22px,3.2vw,34px)}",
    ".fitw-panel--form{border-right:1px solid var(--fitw-line)}",
    ".fitw-panel--result{background:var(--fitw-paper);display:flex;flex-direction:column}",
    ".fitw-panel-label{font-family:var(--fitw-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fitw-muted);margin:2px 0 18px}",
    ".fitw-field{margin-bottom:14px}",
    ".fitw-field label{display:block;font-size:13px;color:var(--fitw-ink);margin-bottom:6px}",
    ".fitw-opt{color:var(--fitw-muted)}",
    ".fitw-input{display:flex;align-items:center;background:var(--fitw-surface);border:1px solid var(--fitw-line);border-radius:10px;transition:border-color .18s,box-shadow .18s}",
    ".fitw-input:focus-within{border-color:var(--fitw-navy);box-shadow:0 0 0 3px rgba(46,74,99,.18)}",
    ".fitw-input input{flex:1;width:100%;min-width:0;background:transparent;border:0;outline:none;color:var(--fitw-navy);font-family:var(--fitw-mono);font-size:16px;font-weight:500;padding:11px 0 11px 13px}",
    ".fitw-input input::placeholder{color:var(--fitw-muted);opacity:.55}",
    ".fitw-unit{font-family:var(--fitw-mono);font-size:12px;color:var(--fitw-muted);padding:0 13px}",
    ".fitw-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    ".fitw-hint{font-size:12px;color:var(--fitw-muted);margin:2px 0 0}",
    ".fitw-btn{margin-top:18px;width:100%;background:var(--fitw-navy);color:#fff;font-family:var(--fitw-body);font-weight:700;font-size:15px;border:0;border-radius:10px;padding:13px;cursor:pointer;transition:transform .12s,background .18s}",
    ".fitw-btn:hover{background:#274056}",
    ".fitw-btn:active{transform:translateY(1px)}",
    ".fitw-btn:focus-visible{outline:3px solid var(--fitw-navy);outline-offset:2px}",
    ".fitw-btn[disabled]{opacity:.6;cursor:default}",
    ".fitw-err{color:var(--fitw-clay);font-size:13px;margin-top:10px}",
    ".fitw-empty{margin:auto;text-align:center;color:var(--fitw-muted);max-width:24ch;font-size:14px}",
    ".fitw-glyph{font-family:var(--fitw-display);font-size:40px;color:#cfd6df;display:block;margin-bottom:8px}",
    ".fitw-result{display:none}",
    ".fitw-result.fitw-show{display:block;animation:fitw-fade .5s ease both}",
    ".fitw-size-head{display:flex;align-items:flex-end;gap:14px;margin-bottom:2px}",
    ".fitw-size-big{font-family:var(--fitw-mono);font-weight:600;font-size:60px;line-height:.9;color:var(--fitw-navy)}",
    ".fitw-size-cap{font-family:var(--fitw-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fitw-muted);padding-bottom:8px}",
    ".fitw-chip{display:inline-block;margin:10px 0 16px;font-size:12.5px;font-weight:600;color:#fff;background:var(--fitw-navy);padding:5px 12px;border-radius:999px}",
    ".fitw-figure{display:flex;justify-content:center;margin:4px 0 16px}",
    ".fitw-figure svg{width:96px;height:auto}",
    ".fitw-zones{list-style:none;margin:0 0 12px;padding:0;border-top:1px solid var(--fitw-line)}",
    ".fitw-zones li{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--fitw-line);font-size:14px;color:var(--fitw-ink)}",
    ".fitw-dot{width:8px;height:8px;border-radius:50%;flex:none}",
    ".fitw-dot.fitw-good{background:var(--fitw-navy)}",
    ".fitw-dot.fitw-snug,.fitw-dot.fitw-relaxed{background:var(--fitw-blush)}",
    ".fitw-dot.fitw-too_tight,.fitw-dot.fitw-too_loose{background:var(--fitw-clay)}",
    ".fitw-zname{font-family:var(--fitw-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fitw-muted);width:50px;flex:none}",
    ".fitw-length{font-size:13px;color:var(--fitw-muted);margin:0 0 12px}",
    ".fitw-between{background:rgba(201,154,164,.12);border:1px solid var(--fitw-line);border-radius:12px;padding:13px 15px;font-size:13.5px;color:var(--fitw-ink)}",
    ".fitw-also{font-size:13px;color:var(--fitw-muted);margin-top:8px}",
    "@keyframes fitw-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    "@media (max-width:720px){.fitw-card{grid-template-columns:1fr}.fitw-panel--form{border-right:0;border-bottom:1px solid var(--fitw-line)}}",
    "@media (prefers-reduced-motion:reduce){.fitw *{animation:none!important;transition:none!important}}",
  ].join("");

  function injectOnce(id, make) {
    if (document.getElementById(id)) return;
    document.head.appendChild(make());
  }

  function injectAssets() {
    injectOnce("fitw-fonts", function () {
      var l = document.createElement("link");
      l.id = "fitw-fonts";
      l.rel = "stylesheet";
      l.href = FONTS_HREF;
      return l;
    });
    injectOnce("fitw-style", function () {
      var s = document.createElement("style");
      s.id = "fitw-style";
      s.textContent = STYLE;
      return s;
    });
  }

  function field(label, name, required) {
    return (
      '<div class="fitw-field"><label for="fitw-' + name + '">' + label +
      (required ? "" : ' <span class="fitw-opt">· optional</span>') + "</label>" +
      '<div class="fitw-input"><input id="fitw-' + name + '" name="' + name +
      '" inputmode="decimal"' + (required ? " required" : "") +
      ' /><span class="fitw-unit">in</span></div></div>'
    );
  }

  function mount(el) {
    var outletKey = el.getAttribute("data-outlet");
    var sku = el.getAttribute("data-product");
    var apiBase = el.getAttribute("data-api") || window.location.origin;

    el.className = (el.className ? el.className + " " : "") + "fitw";
    el.innerHTML =
      '<div class="fitw-card">' +
      '<div class="fitw-panel fitw-panel--form">' +
      '<p class="fitw-panel-label">Your measurements</p>' +
      '<form class="fitw-form" novalidate>' +
      field("Bust", "bust", true) +
      '<div class="fitw-row2">' + field("Waist", "waist", true) + field("Hip", "hip", true) + "</div>" +
      field("Height", "height", false) +
      '<p class="fitw-hint">Try 34 / 28 / 38 for a clear fit, or 34 / 26.5 / 36 for a between-sizes result.</p>' +
      '<button type="submit" class="fitw-btn">Find my size</button>' +
      '<div class="fitw-err" hidden></div>' +
      "</form></div>" +
      '<div class="fitw-panel fitw-panel--result">' +
      '<div class="fitw-empty"><span class="fitw-glyph">&#8966;</span>Your recommended size will appear here.</div>' +
      '<div class="fitw-result"></div>' +
      "</div></div>";

    var form = el.querySelector(".fitw-form");
    var errBox = el.querySelector(".fitw-err");
    var emptyBox = el.querySelector(".fitw-empty");
    var resultBox = el.querySelector(".fitw-result");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.hidden = true;

      var m = {
        bust: parseFloat(form.bust.value),
        waist: parseFloat(form.waist.value),
        hip: parseFloat(form.hip.value),
      };
      if (form.height.value !== "") m.height = parseFloat(form.height.value);

      var bad = ["bust", "waist", "hip"].filter(function (k) {
        return !(m[k] >= MIN_IN && m[k] <= MAX_IN);
      });
      if (m.height != null && !(m.height >= MIN_IN && m.height <= MAX_IN)) bad.push("height");
      if (bad.length) {
        return showError(
          errBox,
          "Please enter " + bad.join(", ") + " in inches (" + MIN_IN + "–" + MAX_IN + ")."
        );
      }

      var btn = form.querySelector(".fitw-btn");
      btn.disabled = true;
      btn.textContent = "Checking…";

      fetch(apiBase + "/v1/fit/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_key: outletKey, sku: sku, measurements: m }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (r) {
          if (!r.ok) {
            showError(errBox, friendlyError(r.body));
            return;
          }
          emptyBox.style.display = "none";
          resultBox.innerHTML = renderResultHTML(r.body, { height: m.height });
          resultBox.classList.remove("fitw-show");
          void resultBox.offsetWidth; // restart the entrance animation
          resultBox.classList.add("fitw-show");
        })
        .catch(function () {
          showError(errBox, "Couldn't reach the size service. Please try again.");
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Find my size";
        });
    });
  }

  function showError(box, msg) {
    box.textContent = msg;
    box.hidden = false;
  }

  function friendlyError(body) {
    if (body && body.error === "product_not_found") return "This product isn't set up yet.";
    if (body && body.error === "outlet_not_found") return "This store isn't set up yet.";
    if (body && body.error === "invalid_request") return "Please check your measurements and try again.";
    return "Something went wrong. Please try again.";
  }

  function init() {
    injectAssets();
    var nodes = document.querySelectorAll("[data-outlet][data-product]");
    Array.prototype.forEach.call(nodes, mount);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
