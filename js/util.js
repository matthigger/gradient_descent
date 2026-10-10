// Shared helpers: SVG nodes, pointer coordinates, number formatting, seeded
// random numbers, the 2 x 2 symmetric eigen decomposition, arrows, the
// log-scale step-size slider and its zones bar.

const SVGNS = "http://www.w3.org/2000/svg";

function node(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function text(parent, x, y, str, attrs = {}) {
  const t = node("text", { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** Pointer position in the viewBox units of an SVG. */
function svgPoint(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵",
  6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

/** Three significant digits; powers of ten outside 0.001..99999. */
function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    const exp = String(+e).split("").map(ch => SUP[ch]).join("");
    return `${m.replace("-", "−")}×10${exp}`;
  }
  const s = a === 0 ? "0" : String(+v.toPrecision(digits));
  return s.replace("-", "−");
}

/** Column vector (HTML) of already-formatted entries, in brackets. */
function colVec(entries) {
  return `<span class="colvec">${
    entries.map(e => `<span>${e}</span>`).join("")}</span>`;
}

function fmtCol(c) { return colVec(c.map(v => fmt(v))); }

/** Seeded uniform [0, 1) generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw from a uniform generator (Box-Muller). */
function randn(r) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/**
 * Eigen decomposition of the symmetric matrix [[a, b], [b, d]].
 *
 * Returns { l: [l1, l2], v: [v1, v2] } with l1 >= l2 and unit eigenvectors.
 */
function eigSym(a, b, d) {
  const m = (a + d) / 2;
  const r = Math.hypot((a - d) / 2, b);
  const l1 = m + r, l2 = m - r;
  let v1;
  if (Math.abs(b) > 1e-12 * (Math.abs(a) + Math.abs(d))) {
    v1 = [l1 - d, b];
  } else {
    v1 = a >= d ? [1, 0] : [0, 1];
  }
  const n = Math.hypot(...v1);
  v1 = [v1[0] / n, v1[1] / n];
  return { l: [l1, l2], v: [v1, [-v1[1], v1[0]]] };
}

/** Arrow from (x1, y1) to (x2, y2) in screen units; skipped if too short. */
function arrow(parent, x1, y1, x2, y2, cls, head = 9) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const g = node("g", { class: cls }, parent);
  if (len < 1) return g;
  const ux = dx / len, uy = dy / len;
  const h = Math.min(head, len * 0.6);
  node("line", { x1, y1, x2: x2 - ux * h * 0.8, y2: y2 - uy * h * 0.8 }, g);
  const bx = x2 - ux * h, by = y2 - uy * h;
  node("polygon", { points: [
    `${x2},${y2}`,
    `${bx - uy * h * 0.5},${by + ux * h * 0.5}`,
    `${bx + uy * h * 0.5},${by - ux * h * 0.5}`].join(" ") }, g);
  return g;
}

/** Roughly n round tick values covering [lo, hi]. */
function ticks(lo, hi, n = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9;
    v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/**
 * Log-scale slider for the step size eta over [lo, hi].
 *
 * The input runs 0..RES; get/set convert to and from eta.
 */
const ETA_RES = 1000;
function etaSlider(input, lo, hi) {
  input.min = 0;
  input.max = ETA_RES;
  input.step = 1;
  const span = Math.log(hi / lo);
  return {
    lo, hi,
    get: () => lo * Math.exp(span * input.value / ETA_RES),
    set: eta => {
      input.value = Math.round(ETA_RES * Math.log(eta / lo) / span);
    },
    /** Position of eta along the track, 0..1. */
    pos: eta => clamp(Math.log(eta / lo) / span, 0, 1),
  };
}

/**
 * Readout status: which step the readout shows while hovering the trail,
 * else the run's progress.
 */
function statusLine(runner, hover) {
  if (hover !== null) {
    return `<p class="status hovering">Showing step ${hover} of `
      + `${runner.steps} (hovering).</p>`;
  }
  return `<p class="status ${runner.status}">${runner.describe()}</p>`;
}

/**
 * Fill the zones bar under an eta slider for curvature L.
 *
 * Gradient descent on a bowl with largest curvature L converges for
 * eta < 2/L; above 1/L the steep direction overshoots, so it zig-zags.
 */
function drawZones(bar, slider, L) {
  const a = slider.pos(1 / L) * 100, b = slider.pos(2 / L) * 100;
  bar.innerHTML = "";
  const zones = [["steady", 0, a], ["zig-zag", a, b],
    ["diverges", b, 100]];
  for (const [name, from, to] of zones) {
    const z = document.createElement("span");
    z.className = `zone ${name}`;
    z.style.left = `${from}%`;
    z.style.width = `${to - from}%`;
    z.textContent = to - from > 14 ? name : "";
    z.title = name;
    bar.appendChild(z);
  }
}
