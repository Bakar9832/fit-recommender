/*
 * Fit Recommender — embeddable widget (Phase 1 demo).
 *
 * DELIBERATE DEMO CHOICE: this is a single self-contained vanilla-JS file with
 * no framework and no build step — chosen over spec §2's React bundle so we can
 * iterate and collect data fast. See PROGRESS.md "Decisions made".
 *
 * Embed (spec §2 shape):
 *   <div data-outlet="OUTLET_KEY" data-product="SKU" data-api="https://api..."></div>
 *   <script src="fitw.js" async></script>
 * The script finds the mount div(s), reads the attributes, renders a measurement
 * form, POSTs to /v1/fit/recommend, and renders the §4.6 response.
 *
 * Wording is garment-focused only (hard rule #1 / §5): never describes the body,
 * no percentages. The file uses no import/export so it loads as a classic script
 * in the browser AND can be imported in Node (pure helpers on globalThis.__FITW__)
 * for verification.
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

  // Abstract, neutral silhouette (§6): a symmetric shape with three control
  // widths scaled by the bust/waist/hip ratios. Schematic — not anatomical.
  function silhouetteSVG(sil) {
    if (!sil) return "";
    var vals = [sil.bust, sil.waist, sil.hip].map(function (v) {
      return typeof v === "number" ? v : 0;
    });
    var max = Math.max.apply(null, vals) || 1;
    var cx = 60;
    var maxHalf = 34; // px at the widest zone
    function half(v) {
      return (v / max) * maxHalf;
    }
    var b = half(sil.bust), w = half(sil.waist), h = half(sil.hip);
    // right side top→bottom, then mirror up the left side
    var pts = [
      [cx, 8],
      [cx + b, 28], [cx + b, 40],
      [cx + w, 78],
      [cx + h, 116], [cx + h, 140],
      [cx - h, 140], [cx - h, 116],
      [cx - w, 78],
      [cx - b, 40], [cx - b, 28],
      [cx, 8],
    ]
      .map(function (p) {
        return p[0].toFixed(1) + "," + p[1].toFixed(1);
      })
      .join(" ");
    return (
      '<svg class="fitw-silhouette" viewBox="0 0 120 150" width="120" height="150" ' +
      'role="img" aria-label="Abstract fit silhouette">' +
      '<polygon points="' + pts + '" fill="#cdd3da" stroke="#9aa3ad" stroke-width="1"/>' +
      "</svg>"
    );
  }

  // Assemble the result panel from a §4.6 response object. Returns HTML string.
  function renderResultHTML(data) {
    var rec = data.recommended_size;
    var alt = data.alternative_size;
    var html = "";

    html +=
      '<div class="fitw-pick">Recommended size: <strong>' +
      esc(rec) +
      "</strong></div>";

    // Per-zone garment notes (already garment-focused from the API).
    html += '<ul class="fitw-zones">';
    ZONES.forEach(function (z) {
      var zone = data.zones && data.zones[z];
      if (!zone) return;
      html +=
        '<li><span class="fitw-dot fitw-' +
        esc(zone.class) +
        '"></span>' +
        esc(zone.note) +
        "</li>";
    });
    html += "</ul>";

    if (data.length_note) {
      html += '<p class="fitw-length">' + esc(data.length_note) + "</p>";
    }

    // Between-sizes choice (§ task): medium confidence is the genuine "between"
    // signal → present both as a real, equal choice. Otherwise, if there's still
    // an alternative, offer it as a lighter neutral aside.
    if (data.confidence === "medium" && alt) {
      html +=
        '<div class="fitw-choice">' + betweenSizesParagraph(rec, alt) + "</div>";
    } else if (alt) {
      html += '<p class="fitw-also">' + alsoConsiderLine(rec, alt) + "</p>";
    }

    html += '<div class="fitw-figure">' + silhouetteSVG(data.silhouette) + "</div>";
    return html;
  }

  // Expose pure helpers for Node-side verification (no-op in the browser).
  if (typeof globalThis !== "undefined") {
    globalThis.__FITW__ = {
      betweenSizesParagraph: betweenSizesParagraph,
      alsoConsiderLine: alsoConsiderLine,
      silhouetteSVG: silhouetteSVG,
      renderResultHTML: renderResultHTML,
    };
  }

  // ---- browser-only: styles, mounting, form, fetch -------------------------

  if (typeof document === "undefined") return;

  var STYLE = [
    ".fitw{font-family:system-ui,Arial,sans-serif;max-width:340px;border:1px solid #e2e5e9;border-radius:8px;padding:16px;color:#1c2127}",
    ".fitw h3{margin:0 0 10px;font-size:15px}",
    ".fitw label{display:block;font-size:13px;margin:8px 0 2px}",
    ".fitw input{width:100%;box-sizing:border-box;padding:6px;border:1px solid #c7ccd3;border-radius:5px;font-size:14px}",
    ".fitw button{margin-top:12px;width:100%;padding:8px;border:0;border-radius:5px;background:#1c2127;color:#fff;font-size:14px;cursor:pointer}",
    ".fitw .fitw-err{color:#b00020;font-size:13px;margin-top:8px}",
    ".fitw-pick{font-size:16px;margin:4px 0 10px}",
    ".fitw-zones{list-style:none;padding:0;margin:0 0 8px;font-size:13px}",
    ".fitw-zones li{margin:4px 0}",
    ".fitw-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}",
    ".fitw-good{background:#3a9d4e}.fitw-snug,.fitw-relaxed{background:#d9a300}.fitw-too_tight,.fitw-too_loose{background:#c0392b}",
    ".fitw-length{font-size:13px;color:#444;margin:6px 0}",
    ".fitw-choice{font-size:13px;background:#f4f6f8;border-radius:6px;padding:8px;margin:8px 0}",
    ".fitw-also{font-size:13px;color:#444;margin:8px 0}",
    ".fitw-figure{text-align:center;margin-top:10px}",
  ].join("");

  function injectStyleOnce() {
    if (document.getElementById("fitw-style")) return;
    var s = document.createElement("style");
    s.id = "fitw-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function numField(label, name, required) {
    return (
      "<label>" + label + (required ? "" : " (optional)") + "</label>" +
      '<input name="' + name + '" type="number" step="0.1" inputmode="decimal"' +
      (required ? " required" : "") + ' />'
    );
  }

  function mount(el) {
    var outletKey = el.getAttribute("data-outlet");
    var sku = el.getAttribute("data-product");
    var apiBase = el.getAttribute("data-api") || window.location.origin;

    el.className = (el.className ? el.className + " " : "") + "fitw";
    el.innerHTML =
      "<h3>Find your size</h3>" +
      '<form class="fitw-form">' +
      numField("Bust (in)", "bust", true) +
      numField("Waist (in)", "waist", true) +
      numField("Hip (in)", "hip", true) +
      numField("Height (in)", "height", false) +
      '<button type="submit">Recommend my size</button>' +
      '<div class="fitw-err" hidden></div>' +
      "</form>" +
      '<div class="fitw-result"></div>';

    var form = el.querySelector(".fitw-form");
    var errBox = el.querySelector(".fitw-err");
    var resultBox = el.querySelector(".fitw-result");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.hidden = true;
      resultBox.innerHTML = "";

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

      var btn = form.querySelector("button");
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
          resultBox.innerHTML = renderResultHTML(r.body);
        })
        .catch(function () {
          showError(errBox, "Couldn't reach the size service. Please try again.");
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Recommend my size";
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
    injectStyleOnce();
    var nodes = document.querySelectorAll("[data-outlet][data-product]");
    Array.prototype.forEach.call(nodes, mount);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
