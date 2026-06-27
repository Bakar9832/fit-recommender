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
 * surface. Renders the enriched §4.6 response: recommended size + a size ladder
 * (all sizes, recommended expanded, others tap-to-expand), an optional model
 * reference line, and a collapsible size guide. The body figure is parked (not
 * rendered this phase). Wording is garment-focused only (hard rule #1 / §5):
 * never describes the body, no percentages, and all phrasing comes VERBATIM from
 * the API (never reworded client-side). Styles are scoped under the `.fitw` root
 * so nothing leaks into the host page. The file uses no import/export so it loads
 * as a classic browser script AND can be imported in Node (pure helpers on
 * globalThis.__FITW__) for verification.
 */
(function () {
  "use strict";

  var SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL"];
  var ZONES = ["bust", "waist", "hip"];
  var MIN_IN = 20;
  var MAX_IN = 80;

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

  // Per-zone notes list for one size entry (notes come verbatim from the API).
  function zonesList(zones) {
    var html = '<ul class="fitw-zones">';
    ZONES.forEach(function (z) {
      var zone = zones && zones[z];
      if (!zone) return;
      html +=
        '<li><span class="fitw-dot fitw-' + esc(zone.class) + '"></span>' +
        '<span class="fitw-zname">' + esc(z) + "</span>" +
        "<span>" + esc(zone.note) + "</span></li>";
    });
    return html + "</ul>";
  }

  // The size ladder: every size, label + summary. Recommended is highlighted and
  // expanded (its zone notes shown); others collapse behind a tap. When the
  // recommendation isn't a comfortable fit, the recommended row uses a cautious
  // highlight instead of the confident "best fit" one.
  function ladder(sizes, idPrefix, notComfortable) {
    if (!sizes || !sizes.length) return "";
    var rows = sizes
      .map(function (s) {
        var open = !!s.recommended;
        var recClass = open ? (notComfortable ? " fitw-srow--caution" : " fitw-srow--rec") : "";
        var bodyId = idPrefix + "-z-" + String(s.size);
        return (
          '<div class="fitw-srow' + recClass + '">' +
          '<button type="button" class="fitw-srow-head" aria-expanded="' +
          (open ? "true" : "false") + '" aria-controls="' + esc(bodyId) + '">' +
          '<span class="fitw-srow-size">' + esc(s.size) + "</span>" +
          '<span class="fitw-srow-summary">' + esc(s.summary) + "</span>" +
          '<span class="fitw-srow-caret" aria-hidden="true"></span>' +
          "</button>" +
          '<div class="fitw-srow-body" id="' + esc(bodyId) + '"' + (open ? "" : " hidden") + ">" +
          zonesList(s.zones) +
          "</div></div>"
        );
      })
      .join("");
    return '<div class="fitw-ladder" role="group" aria-label="All sizes">' + rows + "</div>";
  }

  // Optional model reference line (display-only; omitted entirely when null).
  function modelLine(mr) {
    if (!mr) return "";
    var h = mr.height, s = mr.size_worn;
    var text;
    if (h && s) text = "Model is " + esc(h) + ", wearing size " + esc(s) + ".";
    else if (h) text = "Model is " + esc(h) + ".";
    else if (s) text = "Model wears size " + esc(s) + ".";
    else return "";
    return '<p class="fitw-model">' + text + "</p>";
  }

  // Collapsible size-guide table (garment measurements per size, inches).
  function sizeGuide(guide, idPrefix) {
    if (!guide || !guide.length) return "";
    var bodyId = idPrefix + "-guide";
    var cell = function (v) {
      return typeof v === "number" ? esc(v) : "—";
    };
    var rows = guide
      .map(function (g) {
        return (
          "<tr><td>" + esc(g.size) + "</td><td>" + cell(g.bust) + "</td><td>" +
          cell(g.waist) + "</td><td>" + cell(g.hip) + "</td><td>" +
          cell(g.kameezLength) + "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="fitw-guide">' +
      '<button type="button" class="fitw-guide-toggle" aria-expanded="false" aria-controls="' +
      esc(bodyId) + '">Size guide</button>' +
      '<div class="fitw-guide-body" id="' + esc(bodyId) + '" hidden>' +
      '<table class="fitw-guide-table"><thead><tr><th>Size</th><th>Bust</th>' +
      "<th>Waist</th><th>Hip</th><th>Length</th></tr></thead><tbody>" + rows +
      "</tbody></table>" +
      '<p class="fitw-guide-note">Garment measurements, in inches.</p>' +
      "</div></div>"
    );
  }

  // Assemble the result panel from a §4.6 response object. Returns HTML string.
  // opts.idPrefix scopes element ids so multiple widgets don't collide.
  function renderResultHTML(data, opts) {
    opts = opts || {};
    var idPrefix = opts.idPrefix || "fitw";
    var rec = data.recommended_size;
    var alt = data.alternative_size;
    var notComfortable = data.fits_comfortably === false;
    var html = "";

    // 1. Prominent recommended size + chip. When nothing fits comfortably, the
    //    chip reads "Closest available" in a cautious (not error) style so it
    //    never looks like a confident recommendation.
    html +=
      '<div class="fitw-size-head"><span class="fitw-size-big">' + esc(rec) +
      '</span><span class="fitw-size-cap">Recommended<br>size</span></div>';
    if (notComfortable) {
      html += '<span class="fitw-chip fitw-chip--caution">Closest available</span>';
    } else {
      html += '<span class="fitw-chip">' + esc(chipLabel(data.confidence)) + "</span>";
    }

    // 2. No-fit banner — fit_message verbatim from the API, above the ladder.
    if (notComfortable && data.fit_message) {
      html += '<div class="fitw-banner" role="status">' + esc(data.fit_message) + "</div>";
    }

    // 3. Between-sizes nudge (garment-only) — only when the pick is a real,
    //    comfortable fit. Suppressed in the no-fit case so it can't read as a
    //    confident "prefer more room?" suggestion under the caution banner.
    if (!notComfortable) {
      if (data.confidence === "medium" && alt) {
        html += '<div class="fitw-between">' + betweenSizesParagraph(rec, alt) + "</div>";
      } else if (alt) {
        html += '<p class="fitw-also">' + alsoConsiderLine(rec, alt) + "</p>";
      }
    }

    // 4. Advisory length note (only when present).
    if (data.length_note) {
      html += '<p class="fitw-length">' + esc(data.length_note) + "</p>";
    }

    // 5. Size ladder (all sizes; recommended expanded; cautious if no-fit).
    html += ladder(data.sizes, idPrefix, notComfortable);

    // 6. Model reference (omitted when null).
    html += modelLine(data.model_reference);

    // 7. Size guide (collapsed).
    html += sizeGuide(data.size_guide, idPrefix);

    return html;
  }

  // Expose pure helpers for Node-side verification (no-op in the browser).
  if (typeof globalThis !== "undefined") {
    globalThis.__FITW__ = {
      betweenSizesParagraph: betweenSizesParagraph,
      alsoConsiderLine: alsoConsiderLine,
      renderResultHTML: renderResultHTML,
    };
  }

  // ---- browser-only: fonts, styles, mounting, form, fetch -------------------

  if (typeof document === "undefined") return;

  var seq = 0; // per-instance id scope

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
    ".fitw-chip{display:inline-block;margin:10px 0 14px;font-size:12.5px;font-weight:600;color:#fff;background:var(--fitw-navy);padding:5px 12px;border-radius:999px}",
    // cautious chip for the no-comfortable-fit case (soft blush, NOT error-red)
    ".fitw-chip.fitw-chip--caution{background:var(--fitw-blush);color:var(--fitw-ink)}",
    // honest, non-alarming banner above the ladder when nothing fits comfortably
    ".fitw-banner{background:rgba(201,154,164,.16);border:1px solid var(--fitw-blush);border-left-width:3px;border-radius:10px;padding:11px 14px;font-size:13.5px;color:var(--fitw-ink);margin:0 0 14px}",
    ".fitw-between{background:rgba(201,154,164,.12);border:1px solid var(--fitw-line);border-radius:12px;padding:13px 15px;font-size:13.5px;color:var(--fitw-ink);margin-bottom:6px}",
    ".fitw-also{font-size:13px;color:var(--fitw-muted);margin:0 0 6px}",
    ".fitw-length{font-size:13px;color:var(--fitw-muted);margin:6px 0 0}",
    // ladder
    ".fitw-ladder{margin:14px 0 12px;border-top:1px solid var(--fitw-line)}",
    ".fitw-srow{border-bottom:1px solid var(--fitw-line)}",
    ".fitw-srow--rec{background:rgba(46,74,99,.05)}",
    // cautious highlight for the recommended row when it isn't a comfortable fit
    ".fitw-srow--caution{background:rgba(201,154,164,.14);box-shadow:inset 3px 0 0 var(--fitw-blush)}",
    ".fitw-srow-head{display:flex;align-items:center;gap:11px;width:100%;background:none;border:0;padding:11px 6px;cursor:pointer;text-align:left;font-family:var(--fitw-body);color:var(--fitw-ink)}",
    ".fitw-srow-head:focus-visible{outline:3px solid var(--fitw-navy);outline-offset:-3px;border-radius:8px}",
    ".fitw-srow-size{font-family:var(--fitw-mono);font-weight:600;font-size:15px;color:var(--fitw-navy);min-width:34px}",
    ".fitw-srow-summary{flex:1;font-size:13.5px;color:var(--fitw-ink)}",
    ".fitw-srow--rec .fitw-srow-summary{font-weight:600;color:var(--fitw-navy)}",
    ".fitw-srow--caution .fitw-srow-summary{font-weight:600;color:var(--fitw-ink)}",
    ".fitw-srow-caret{flex:none;width:0;height:0;border-left:5px solid var(--fitw-muted);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s}",
    '.fitw-srow-head[aria-expanded="true"] .fitw-srow-caret{transform:rotate(90deg)}',
    ".fitw-srow-body{padding:0 6px 12px}",
    ".fitw-zones{list-style:none;margin:0;padding:0}",
    ".fitw-zones li{display:flex;align-items:flex-start;gap:10px;padding:6px 0;font-size:13px;color:var(--fitw-ink)}",
    ".fitw-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:5px}",
    ".fitw-dot.fitw-good{background:var(--fitw-navy)}",
    ".fitw-dot.fitw-snug,.fitw-dot.fitw-relaxed{background:var(--fitw-blush)}",
    ".fitw-dot.fitw-too_tight,.fitw-dot.fitw-too_loose{background:var(--fitw-clay)}",
    ".fitw-zname{font-family:var(--fitw-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fitw-muted);width:46px;flex:none;margin-top:1px}",
    // model line
    ".fitw-model{font-size:12.5px;color:var(--fitw-muted);margin:0 0 14px}",
    // size guide
    ".fitw-guide{border-top:1px solid var(--fitw-line);padding-top:6px}",
    ".fitw-guide-toggle{display:flex;align-items:center;gap:9px;width:100%;background:none;border:0;padding:8px 6px;cursor:pointer;font-family:var(--fitw-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--fitw-muted)}",
    ".fitw-guide-toggle:focus-visible{outline:3px solid var(--fitw-navy);outline-offset:-3px;border-radius:8px}",
    '.fitw-guide-toggle::before{content:"";flex:none;width:0;height:0;border-left:5px solid var(--fitw-muted);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s}',
    '.fitw-guide-toggle[aria-expanded="true"]::before{transform:rotate(90deg)}',
    ".fitw-guide-body{padding:4px 0 2px}",
    ".fitw-guide-table{width:100%;border-collapse:collapse;font-family:var(--fitw-mono);font-size:12.5px}",
    ".fitw-guide-table th{text-align:right;font-weight:500;color:var(--fitw-muted);font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 6px;border-bottom:1px solid var(--fitw-line)}",
    ".fitw-guide-table td{text-align:right;padding:5px 6px;border-bottom:1px solid var(--fitw-line);color:var(--fitw-ink)}",
    ".fitw-guide-table th:first-child,.fitw-guide-table td:first-child{text-align:left}",
    ".fitw-guide-table td:first-child{color:var(--fitw-navy);font-weight:600}",
    ".fitw-guide-note{font-size:11px;color:var(--fitw-muted);margin:8px 0 0}",
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
    var idPrefix = "fitw" + ++seq;

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

    // Delegated expand/collapse for the ladder rows and the size-guide toggle.
    // Buttons fire click on Enter/Space, so this is keyboard-accessible.
    resultBox.addEventListener("click", function (e) {
      var head = e.target.closest(".fitw-srow-head, .fitw-guide-toggle");
      if (!head || !resultBox.contains(head)) return;
      var expanded = head.getAttribute("aria-expanded") === "true";
      head.setAttribute("aria-expanded", expanded ? "false" : "true");
      var body = document.getElementById(head.getAttribute("aria-controls"));
      if (body) body.hidden = expanded;
    });

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
          resultBox.innerHTML = renderResultHTML(r.body, { idPrefix: idPrefix });
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
