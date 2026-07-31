/*
 * BMW Live Cockpit-style cluster renderer.
 * Plain JS (no Angular) — builds the whole cluster SVG into #clusterHost and
 * exposes window.bmwCluster for the data plumbing in gauges_screen_digi.js.
 *
 * Both gauges are generated from data ({labels, redFrom}) so Lua can reshape
 * them at runtime (engine type, RPM limit, estimated top speed).
 * Design/geometry iterated in the standalone preview (bmw-cluster-preview.html).
 */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var W = 1280, H = 512;

  // Outer rim contour, bottom tip -> top tip (value min -> max). Hand-shaped.
  // Hub far inboard = shallow, BMW-like needle sweep instead of a wide fan.
  var OUTER_L = [
    [325, 450], [179, 444], [96, 385], [39, 307], [23, 237],
    [90, 159], [191, 102], [280, 70], [409, 53],
  ];
  var HUB_L = [815, 254];

  // blade band width profile: near-triangular (crisp inner corner),
  // widest toward the lower-middle of the scale
  var W_TIP = 10, W_MID = 118, W_PEAK_AT = 0.45;
  function bandW(f) {
    var tri = f < W_PEAK_AT ? f / W_PEAK_AT : (1 - f) / (1 - W_PEAK_AT);
    return W_TIP + (W_MID - W_TIP) * Math.pow(Math.max(0, tri), 1.1);
  }

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function unitVec(x, y) {
    var m = Math.hypot(x, y) || 1;
    return [x / m, y / m];
  }
  function mirror(pts) {
    return pts.map(function (p) { return [W - p[0], p[1]]; });
  }

  // Catmull-Rom -> cubic bezier through anchor points
  function smoothPath(p) {
    var d = "M " + p[0][0] + " " + p[0][1] + " ";
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C " + c1x.toFixed(2) + " " + c1y.toFixed(2) + ", " + c2x.toFixed(2) + " " + c2y.toFixed(2) + ", " + p2[0] + " " + p2[1] + " ";
    }
    return d.trim();
  }

  // very light 1-6-1 anchor smoothing (tips preserved)
  function smoothAnchors(a) {
    return a.map(function (p, i) {
      if (i === 0 || i === a.length - 1) return p;
      return [
        (a[i - 1][0] + 6 * p[0] + a[i + 1][0]) / 8,
        (a[i - 1][1] + 6 * p[1] + a[i + 1][1]) / 8,
      ];
    });
  }
  function smoothPolyline(pts, passes) {
    var out = pts;
    for (var k = 0; k < passes; k++) {
      out = out.map(function (p, i, arr) {
        if (i === 0 || i === arr.length - 1) return p;
        return [
          (arr[i - 1][0] + 2 * p[0] + arr[i + 1][0]) / 4,
          (arr[i - 1][1] + 2 * p[1] + arr[i + 1][1]) / 4,
        ];
      });
    }
    return out;
  }

  function valueFrac(g, v) {
    var L = g.labels, n = L.length;
    v = Math.max(L[0], Math.min(L[n - 1], v));
    for (var i = 0; i < n - 1; i++) {
      if (v <= L[i + 1]) return (i + (v - L[i]) / (L[i + 1] - L[i])) / (n - 1);
    }
    return 1;
  }

  function ptStr(p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }
  function polyD(pts) { return "M " + pts.map(ptStr).join(" L "); }

  function build(g) {
    var dOuter = smoothPath(g.outer);

    var rimSampler = el("path", { d: dOuter, fill: "none", stroke: "none" });
    g.node.appendChild(rimSampler);
    g.rimLen = rimSampler.getTotalLength();
    g.rimAt = function (f) {
      var p = rimSampler.getPointAtLength(f * g.rimLen);
      var inw = unitVec(g.hub[0] - p.x, g.hub[1] - p.y);
      return { p: [p.x, p.y], inw: inw };
    };

    var N = 72, i, f, r;
    var outerPts = [], innerPts = [];
    for (i = 0; i <= N; i++) {
      f = i / N;
      r = g.rimAt(f);
      var w = bandW(f);
      outerPts.push(r.p);
      innerPts.push([r.p[0] + r.inw[0] * w, r.p[1] + r.inw[1] * w]);
    }
    innerPts = smoothPolyline(innerPts, 1);

    // blade body
    var d = polyD(outerPts) + " L " + innerPts.slice().reverse().map(ptStr).join(" L ") + " Z";
    g.node.appendChild(el("path", { d: d, fill: "url(#bladeGrad)", filter: "url(#bladeShadow)" }));

    // value fill: blade section from 0 to current value (updated live) —
    // bold BMW-style glowing band; the fill itself is the indicator (no needle)
    g.valueFill = el("path", { fill: "url(#fillGrad)", opacity: 0.55 });
    g.node.appendChild(g.valueFill);
    g.valueFillHot = el("path", { fill: "#ffb066", opacity: 0.7 });
    g.node.appendChild(g.valueFillHot);

    // lit rim segment 0..value
    g.rimLit = el("path", {
      d: dOuter, fill: "none", stroke: "#ff8a1e", "stroke-width": 4.5,
      "stroke-linecap": "round", filter: "url(#softGlow)", "stroke-dasharray": "0 " + g.rimLen,
    });
    g.node.appendChild(g.rimLit);

    // inner edge (faint)
    g.node.appendChild(el("path", {
      d: polyD(innerPts), fill: "none", stroke: "#454c58", "stroke-width": 1.2,
    }));

    // redline: segmented red bar hugging the outer edge (BMW-style dashes)
    if (g.redFrom != null) {
      var f0 = valueFrac(g, g.redFrom);
      var zone = [];
      for (i = 0; i <= 24; i++) {
        f = f0 + (1 - f0) * (i / 24);
        r = g.rimAt(f);
        zone.push([r.p[0] + r.inw[0] * 4, r.p[1] + r.inw[1] * 4]);
      }
      g.node.appendChild(el("path", {
        d: polyD(zone), fill: "none", stroke: "#e5352f", "stroke-width": 7,
        "stroke-dasharray": "10 7", "stroke-linecap": "butt", opacity: 0.98,
      }));
    }

    // ticks: majors at label slots, 3 minors per slot
    var n = g.labels.length;
    function tick(f, len, color, w) {
      var r = g.rimAt(f);
      var a = [r.p[0] + r.inw[0] * 7, r.p[1] + r.inw[1] * 7];
      var b = [r.p[0] + r.inw[0] * (7 + len), r.p[1] + r.inw[1] * (7 + len)];
      g.node.appendChild(el("line", {
        x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1),
        stroke: color, "stroke-width": w, "stroke-linecap": "round",
      }));
    }
    for (var s = 0; s < n - 1; s++) {
      for (var k = 1; k < 4; k++) {
        f = (s + k / 4) / (n - 1);
        var v = g.labels[s] + (g.labels[s + 1] - g.labels[s]) * (k / 4);
        var red = g.redFrom != null && v >= g.redFrom;
        tick(f, 9, red ? "#e03131" : "#59626e", 1.5);
      }
    }
    for (i = 0; i < n; i++) tick(i / (n - 1), 15, "#9aa3ad", 2.4);

    // labels inside the band
    for (i = 0; i < n; i++) {
      f = i / (n - 1);
      r = g.rimAt(f);
      var off = 18 + 0.5 * bandW(f);
      var t = el("text", {
        x: (r.p[0] + r.inw[0] * off).toFixed(1),
        y: (r.p[1] + r.inw[1] * off + 7).toFixed(1),
        "text-anchor": "middle", "class": "lbl",
      });
      t.textContent = (i === 0 && g.startLabel) ? g.startLabel : g.labels[i];
      g.node.appendChild(t);
      if (i === 0 && g.unitNote) {
        var u = el("text", {
          x: (r.p[0] + r.inw[0] * off + 36).toFixed(1),
          y: (r.p[1] + r.inw[1] * off + 8).toFixed(1),
          "class": "lbl-u",
        });
        u.textContent = g.unitNote;
        g.node.appendChild(u);
      }
    }

    // chrome rim (on top)
    g.node.appendChild(el("path", {
      d: dOuter, fill: "none", stroke: "#ffffff", opacity: 0.08, "stroke-width": 7,
    }));
    g.node.appendChild(el("path", {
      d: dOuter, fill: "none", stroke: "url(#chrome)", "stroke-width": 2.6, "stroke-linecap": "round",
    }));

    // needle: short blade against the rim, rotating around the hub (on top of
    // the bold fill — the fill shows the value band, the needle points to it)
    g.needleGlow = el("path", { fill: "#ff8a1e", opacity: 0.45, filter: "url(#glow)" });
    g.needle = el("path", { fill: "#ff8a1e", filter: "url(#softGlow)" });
    g.needleTip = el("path", { fill: "#ffc06a" });
    g.node.appendChild(g.needleGlow);
    g.node.appendChild(g.needle);
    g.node.appendChild(g.needleTip);
  }

  // section of the blade between fractions f0..f1 (value fill)
  function sectionPath(g, f0, f1) {
    var N = Math.max(2, Math.round((f1 - f0) * 60));
    var out = [], inn = [];
    for (var i = 0; i <= N; i++) {
      var f = f0 + (f1 - f0) * (i / N);
      var r = g.rimAt(f);
      out.push(r.p);
      inn.push([r.p[0] + r.inw[0] * bandW(f), r.p[1] + r.inw[1] * bandW(f)]);
    }
    return polyD(out) + " L " + inn.reverse().map(ptStr).join(" L ") + " Z";
  }

  function setValue(g, v) {
    if (!g.rimAt) return;
    var f = valueFrac(g, v);
    g.valueFill.setAttribute("d", f > 0.005 ? sectionPath(g, 0, f) : "M 0 0");
    g.valueFillHot.setAttribute("d", f > 0.05 ? sectionPath(g, Math.max(0, f - 0.055), f) : "M 0 0");
    g.rimLit.setAttribute("stroke-dasharray", (f * g.rimLen) + " " + g.rimLen);

    var r = g.rimAt(f);
    var dir = unitVec(r.p[0] - g.hub[0], r.p[1] - g.hub[1]);
    var perp = [-dir[1], dir[0]];
    var rOut = Math.hypot(r.p[0] - g.hub[0], r.p[1] - g.hub[1]) - 3;
    var rIn = rOut - (bandW(f) + 42);
    function P(rr, ww) {
      return [
        [g.hub[0] + dir[0] * rr + perp[0] * ww, g.hub[1] + dir[1] * rr + perp[1] * ww],
        [g.hub[0] + dir[0] * rr - perp[0] * ww, g.hub[1] + dir[1] * rr - perp[1] * ww],
      ];
    }
    function poly(wo, wi, r0, r1) {
      var o = P(r1, wo), ii = P(r0, wi);
      return "M " + ptStr(o[0]) + " L " + ptStr(o[1]) + " L " + ptStr(ii[1]) + " L " + ptStr(ii[0]) + " Z";
    }
    g.needleGlow.setAttribute("d", poly(8, 4, rIn, rOut));
    g.needle.setAttribute("d", poly(3.6, 1.6, rIn, rOut));
    g.needleTip.setAttribute("d", poly(3.6, 2.8, rOut - 26, rOut));
  }

  // ======== static frame (defs, readouts, minis, bottom strip) ========
  var host = document.getElementById("clusterHost");
  host.innerHTML =
    '<svg id="clusterSvg" viewBox="0 0 1280 512" preserveAspectRatio="none">' +
      '<defs>' +
        '<linearGradient id="bladeGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#171b23"/>' +
          '<stop offset="50%" stop-color="#10131a"/>' +
          '<stop offset="100%" stop-color="#0b0d13"/>' +
        '</linearGradient>' +
        '<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#eef2f7"/>' +
          '<stop offset="45%" stop-color="#9aa5b1"/>' +
          '<stop offset="100%" stop-color="#525a64"/>' +
        '</linearGradient>' +
        // value-fill gradient: brighter toward the top (high revs/speed)
        '<linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ff9a2e"/>' +
          '<stop offset="100%" stop-color="#ff5400"/>' +
        '</linearGradient>' +
        '<filter id="glow" x="-80%" y="-80%" width="260%" height="260%">' +
          '<feGaussianBlur stdDeviation="5" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
        '<filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">' +
          '<feGaussianBlur stdDeviation="2.5" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
        '<filter id="bladeShadow" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.65"/>' +
        '</filter>' +
      '</defs>' +

      '<g id="leftGauge"></g>' +
      '<g id="rightGauge"></g>' +

      // number right-aligned to a fixed edge; km/h pinned just after it so the
      // unit never moves as digits are added on the left
      '<text id="speedVal" class="digits" x="300" y="276" text-anchor="end">0</text>' +
      '<text id="speedUnit" class="digits-unit" x="308" y="276" text-anchor="start">km/h</text>' +
      '<text id="gearVal" class="gear" x="980" y="276" text-anchor="middle">N</text>' +
      '<text id="rpmUnit1" class="micro" x="1006" y="428" text-anchor="middle">1/min</text>' +
      '<text id="rpmUnit2" class="micro" x="1006" y="444" text-anchor="middle">x1000</text>' +

      // "widget" baselines: speed (left) and gear (right) sit on a line
      '<line id="speedWidgetLine" x1="238" y1="298" x2="362" y2="298" stroke="#3a414d" stroke-width="2" stroke-linecap="round"/>' +
      '<line id="gearWidgetLine" x1="946" y1="298" x2="1014" y2="298" stroke="#3a414d" stroke-width="2" stroke-linecap="round"/>' +

      '<g id="fuelMini">' +
        '<path id="fuelMiniBase" d="M 46 494 Q 38 452 64 432 Q 76 424 92 422" fill="none" stroke="#2b303a" stroke-width="6" stroke-linecap="round"/>' +
        '<path id="fuelMiniFill" d="M 46 494 Q 38 452 64 432 Q 76 424 92 422" fill="none" stroke="#ff8a1e" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>' +
        '<text class="micro" x="34" y="446" text-anchor="middle">1/2</text>' +
      '</g>' +
      '<g id="tempMini">' +
        '<path id="tempMiniBase" d="M 1234 494 Q 1242 452 1216 432 Q 1204 424 1188 422" fill="none" stroke="#2b303a" stroke-width="6" stroke-linecap="round"/>' +
        '<path id="tempMiniFill" d="M 1234 494 Q 1242 452 1216 432 Q 1204 424 1188 422" fill="none" stroke="#3d7dd8" stroke-width="6" stroke-linecap="round"/>' +
        '<path id="tempMiniRed" d="M 1234 494 Q 1242 452 1216 432 Q 1204 424 1188 422" fill="none" stroke="#e03131" stroke-width="6" stroke-linecap="round"/>' +
      '</g>' +

      '<rect x="0" y="474" width="1280" height="38" fill="#030409"/>' +
      '<g transform="translate(0 500)">' +
        '<g transform="translate(128 -14)" stroke="#79828e" stroke-width="1.8" fill="none">' +
          '<path d="M0 2 h13 v14 h-13 z M15 6 v9 a3.4 3.4 0 0 0 6.8 0 v-6 l-3 -3 M3.5 5.5 h6"/>' +
        '</g>' +
        '<text id="rangeVal" class="info" x="158" y="0">---</text>' +
        '<text id="timeVal" class="info" x="316" y="0"></text>' +
        '<text id="odoVal" class="info" x="640" y="0" text-anchor="middle"></text>' +
        '<text id="tempVal" class="info" x="1150" y="0" text-anchor="end">---</text>' +
      '</g>' +
    '</svg>';

  var $id = function (id) { return document.getElementById(id); };

  var LEFT = {
    node: $id("leftGauge"),
    labels: [0, 20, 40, 60, 100, 140, 200, 260],
    redFrom: null,
    unitNote: "km/h",
  };
  var RIGHT = {
    node: $id("rightGauge"),
    labels: [0, 1, 2, 3, 4, 5, 6, 7],
    redFrom: 5.5,
    unitNote: null,
    startLabel: "OFF", // tach bottom reads OFF (engine off / auto start-stop)
  };
  function applyShape() {
    var smoothed = smoothAnchors(OUTER_L);
    LEFT.outer = smoothed;
    LEFT.hub = HUB_L;
    RIGHT.outer = mirror(smoothed);
    RIGHT.hub = [W - HUB_L[0], HUB_L[1]];
  }
  applyShape();
  build(LEFT);
  build(RIGHT);

  function rebuild(g) {
    while (g.node.firstChild) g.node.removeChild(g.node.firstChild);
    build(g);
  }

  // mini gauge dash lengths
  var fuelFill = $id("fuelMiniFill");
  var fuelLen = fuelFill.getTotalLength();
  var tempFill = $id("tempMiniFill");
  var tempRed = $id("tempMiniRed");
  var tempLen = tempFill.getTotalLength();
  tempRed.setAttribute("stroke-dasharray", (0.10 * tempLen) + " " + tempLen);
  tempRed.setAttribute("stroke-dashoffset", -(0.90 * tempLen));

  // ======== telltale / indicator lights ========
  // Standard dashboard lights in a top-centre row; green turn arrows anchor the
  // outer ends. Each is a <g> toggled by opacity from update({tell:{...}}).
  // electrics values are consumed as-is (signal_L/R, abs, tcs self-pulse), so
  // there is no page-side blink timer. All inside #telltales -> movable as one.
  var TT_GREEN = "#39d353", TT_BLUE = "#2f8fe6", TT_AMBER = "#f0a52a", TT_RED = "#e5484d";
  var TT_Y = 22;   // row centre (design y); tune with the reposition pass
  var TT_S = 1.7;  // glyph scale (icons are authored in a ~±13px box)

  var ttRoot = el("g", { id: "telltales" });
  $id("clusterSvg").appendChild(ttRoot);
  var tells = {};

  function ttFrame(name, x, opacity) {
    return el("g", { id: "tt_" + name, transform: "translate(" + x + " " + TT_Y + ") scale(" + TT_S + ")", opacity: opacity });
  }
  function ttGroup(name, x, draw) {
    var g = ttFrame(name, x, "0");
    draw(g);
    ttRoot.appendChild(g);
    tells[name] = g;
  }
  function ttPath(g, d, attrs) {
    var a = { d: d }; for (var k in attrs) a[k] = attrs[k];
    g.appendChild(el("path", a));
  }
  function ttLine(g, x1, y1, x2, y2, color, w) {
    g.appendChild(el("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, "stroke-width": w, "stroke-linecap": "round" }));
  }
  function ttText(g, s, color, size) {
    var t = el("text", { x: 0, y: size * 0.35, "text-anchor": "middle", fill: color,
      "font-size": size, "font-weight": "700", "font-family": "Arial, sans-serif" });
    t.textContent = s; g.appendChild(t);
  }
  // headlamp body (filled semicircle, flat edge facing the rays) + rays
  function ttLamp(g, color) { ttPath(g, "M 2 -9 A 9 9 0 0 1 2 9 Z", { fill: color }); }
  function ttRays(g, color, dy) { for (var i = -1; i <= 1; i++) ttLine(g, -1, i * 5, -12, i * 5 + dy, color, 2); }

  // --- turn arrows (green), at the row ends ---
  // turn indicators (green): a plain, simple arrow with rounded corners for a
  // smooth modern feel — flat, no heavy glow. The group's opacity is CSS-eased,
  // so each blink fades in/out subtly instead of hard snapping.
  // s: -1 left, +1 right.
  function ttArrow(g, s) {
    g.style.transition = "opacity 0.08s ease";
    ttPath(g, "M " + (13 * s) + " 0 L " + (3 * s) + " -10 L " + (3 * s) + " -4 L " +
      (-12 * s) + " -4 L " + (-12 * s) + " 4 L " + (3 * s) + " 4 L " + (3 * s) + " 10 Z",
      { fill: TT_GREEN, stroke: TT_GREEN, "stroke-width": 3, "stroke-linejoin": "round" });
  }
  ttGroup("turnL", 385, function (g) { ttArrow(g, -1); });
  ttGroup("turnR", 895, function (g) { ttArrow(g, 1); });

  // --- centre warning cluster (left -> right) ---
  ttGroup("park", 436, function (g) { // red circle (P) flanked by ( )
    g.appendChild(el("circle", { cx: 0, cy: 0, r: 8, fill: "none", stroke: TT_RED, "stroke-width": 2 }));
    ttPath(g, "M -11 -6 A 13 13 0 0 0 -11 6", { fill: "none", stroke: TT_RED, "stroke-width": 2, "stroke-linecap": "round" });
    ttPath(g, "M 11 -6 A 13 13 0 0 1 11 6", { fill: "none", stroke: TT_RED, "stroke-width": 2, "stroke-linecap": "round" });
    ttText(g, "P", TT_RED, 11);
  });
  ttGroup("tpms", 504, function (g) { // tire cross-section with !
    ttPath(g, "M -10 -4 C -10 -10 -6 -10 -6 -5 L -6 6 L 6 6 L 6 -5 C 6 -10 10 -10 10 -4",
      { fill: "none", stroke: TT_AMBER, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
    ttPath(g, "M -8 9 L -5 6 L -2 9 L 1 6 L 4 9 L 7 6",
      { fill: "none", stroke: TT_AMBER, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
    ttText(g, "!", TT_AMBER, 11);
  });
  ttGroup("abs", 572, function (g) { // circle ABS flanked by ( )
    g.appendChild(el("circle", { cx: 0, cy: 0, r: 9, fill: "none", stroke: TT_AMBER, "stroke-width": 2 }));
    ttPath(g, "M -12 -6 A 14 14 0 0 0 -12 6", { fill: "none", stroke: TT_AMBER, "stroke-width": 2, "stroke-linecap": "round" });
    ttPath(g, "M 12 -6 A 14 14 0 0 1 12 6", { fill: "none", stroke: TT_AMBER, "stroke-width": 2, "stroke-linecap": "round" });
    ttText(g, "ABS", TT_AMBER, 7);
  });
  ttGroup("esc", 708, function (g) { // slipping car (ESC/TCS combined)
    ttPath(g, "M -10 1 L -8 -3 Q -7 -5 -4 -5 L 4 -5 Q 7 -5 8 -3 L 10 1 L 10 4 L -10 4 Z", { fill: TT_AMBER });
    g.appendChild(el("circle", { cx: -6, cy: 5, r: 2, fill: TT_AMBER }));
    g.appendChild(el("circle", { cx: 6, cy: 5, r: 2, fill: TT_AMBER }));
    ttPath(g, "M -9 10 q 3 -3 6 0 t 6 0 t 6 0", { fill: "none", stroke: TT_AMBER, "stroke-width": 1.6, "stroke-linecap": "round" });
  });
  ttGroup("cel", 776, function (g) { // check engine block
    ttPath(g, "M -10 -2 L -10 4 L -7 4 L -7 7 L 6 7 L 6 4 L 9 1 L 9 -2 L 6 -2 L 6 -5 L 1 -5 L 1 -2 Z", { fill: TT_AMBER });
    ttLine(g, -10, 0, -13, 0, TT_AMBER, 1.6);
    ttLine(g, -10, 2, -13, 2, TT_AMBER, 1.6);
  });
  ttGroup("fog", 844, function (g) { // front fog: lamp + down rays + wavy line
    ttLamp(g, TT_GREEN); ttRays(g, TT_GREEN, 4);
    ttPath(g, "M -6 -9 q 4 4 0 8 q -4 4 0 8", { fill: "none", stroke: TT_GREEN, "stroke-width": 2, "stroke-linecap": "round" });
  });

  // --- low / high beam share one slot, crossfading between them ---
  // high wins when both are on; a straight off->high still fades in cleanly.
  var beamLow, beamHigh;
  (function () {
    var g = ttFrame("beam", 640, "1"); // centre slot; always mounted, children carry the state
    beamLow = el("g", {}); beamLow.style.opacity = "0"; beamLow.style.transition = "opacity 0.28s ease";
    ttLamp(beamLow, TT_GREEN); ttRays(beamLow, TT_GREEN, 4);   // low beam: down-angled rays
    beamHigh = el("g", {}); beamHigh.style.opacity = "0"; beamHigh.style.transition = "opacity 0.28s ease";
    ttLamp(beamHigh, TT_BLUE); ttRays(beamHigh, TT_BLUE, 0);   // high beam: straight rays
    g.appendChild(beamLow); g.appendChild(beamHigh);
    ttRoot.appendChild(g);
  })();

  // cached values so scale rebuilds can re-apply them
  var cur = { speed: 0, rpmK: 0 };

  window.bmwCluster = {
    configureSpeed: function (labels, unitNote) {
      LEFT.labels = labels;
      LEFT.unitNote = unitNote || "km/h";
      rebuild(LEFT);
      setValue(LEFT, cur.speed);
      $id("speedUnit").textContent = LEFT.unitNote;
    },
    configureRpm: function (labels, redFrom) {
      RIGHT.labels = labels;
      RIGHT.redFrom = redFrom;
      rebuild(RIGHT);
      setValue(RIGHT, cur.rpmK);
    },
    update: function (d) {
      if (!d) return;
      if (d.speed != null) {
        cur.speed = d.speed;
        setValue(LEFT, d.speed);
        $id("speedVal").textContent = Math.round(d.speed);
      }
      if (d.rpmK != null) {
        cur.rpmK = d.rpmK;
        setValue(RIGHT, d.rpmK);
      }
      if (d.gear != null) $id("gearVal").textContent = d.gear;
      if (d.time != null) $id("timeVal").textContent = d.time;
      if (d.temp != null) $id("tempVal").textContent = d.temp;
      if (d.odo != null) $id("odoVal").textContent = d.odo;
      if (d.range != null) $id("rangeVal").textContent = d.range;
      if (d.fuelFrac != null) {
        fuelFill.setAttribute("stroke-dasharray", (Math.max(0, Math.min(1, d.fuelFrac)) * fuelLen) + " " + fuelLen);
      }
      if (d.waterFrac != null) {
        tempFill.setAttribute("stroke-dasharray", (Math.max(0, Math.min(0.88, d.waterFrac)) * tempLen) + " " + tempLen);
      }
      if (d.tell) {
        var tt = d.tell;
        // style.opacity (not the attribute) so groups with a CSS transition —
        // the turn signals — ease in/out; the rest snap like real telltales.
        for (var tn in tells) tells[tn].style.opacity = tt[tn] ? "1" : "0";
        // low/high share one slot: high wins, crossfading low <-> high
        beamHigh.style.opacity = tt.high ? "1" : "0";
        beamLow.style.opacity = (tt.low && !tt.high) ? "1" : "0";
      }
    },
  };
})();
