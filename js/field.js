// Contour view of any f(w0, w1) with its gradient field, for the gradient
// tab.
//
// Unlike the quadratic-only surface view, f is sampled on a grid: filled
// bands come from a canvas image and level lines from marching squares,
// at levels spaced by the quantiles of f over the view so any shape gets
// usable contours. Small arrows on a coarser grid show the field, all at
// one scale so their lengths compare (long arrow, steep f). A draggable
// probe w carries the true gradient arrow, plus any extra arrows the
// caller passes (a student's answer, the parts of a sum), at a larger
// scale shared among them so they stay legible.

const FV_GRID = 160;
const FV_LEVELS = 12;
const FV_QUIVER = 11;

class FieldView {
  /**
   * Args:
   *   svg (SVGElement): the view's SVG
   *   onProbe (function): (w) => void, called as the probe is dragged
   */
  constructor(svg, onProbe) {
    this.svg = svg;
    this.onProbe = onProbe;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = FV_GRID;
    svg.setAttribute("viewBox", `0 0 ${PLOT.w} ${PLOT.h}`);
    this.listen();
  }

  /**
   * Sample a new function over a square domain and cache its picture.
   *
   * Args:
   *   fn (object): { f(w), grad(w) } on w = [w0, w1]
   *   mid (number[]): (2,) domain center
   *   hw (number): domain half-width (both axes share one scale)
   */
  setFunction(fn, mid, hw) {
    this.fn = fn;
    this.mid = mid;
    this.hw = hw;
    this.ppu = (PLOT.x1 - PLOT.x0) / (2 * hw);
    const N = FV_GRID, z = new Float64Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        z[j * (N + 1) + i] = fn.f(this.at(i / N, j / N));
      }
    }
    this.z = z;
    const fin = Array.from(z).filter(Number.isFinite).sort((a, b) => a - b);
    const levels = [];
    for (let k = 0; k < FV_LEVELS; k++) {
      const v = +fin[Math.floor((k + 0.5) / FV_LEVELS * fin.length)]
        .toPrecision(2);
      if (!levels.includes(v)) levels.push(v);
    }
    this.levels = levels;
    this.paintBands();
    this.lines = levels.map(L => this.march(L));
    this.quiverScale();
  }

  /** Domain point at fractions (u, v) across, from the bottom-left. */
  at(u, v) {
    return [this.mid[0] - this.hw + 2 * this.hw * u,
      this.mid[1] - this.hw + 2 * this.hw * v];
  }
  sx(v) { return PLOT.x0 + (v - this.mid[0] + this.hw) * this.ppu; }
  sy(v) { return PLOT.y1 - (v - this.mid[1] + this.hw) * this.ppu; }
  inv(px, py) {
    return [this.mid[0] - this.hw + (px - PLOT.x0) / this.ppu,
      this.mid[1] - this.hw + (PLOT.y1 - py) / this.ppu];
  }

  /** Band of a value: how many levels lie below it, 0..levels. */
  band(v) {
    let k = 0;
    while (k < this.levels.length && v > this.levels[k]) k++;
    return k;
  }

  paintBands() {
    const N = FV_GRID, ctx = this.canvas.getContext("2d");
    const img = ctx.createImageData(N, N), nb = this.levels.length;
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        // Canvas rows run top-down; the grid runs bottom-up.
        const v = this.z[(N - py) * (N + 1) + px];
        const t = Number.isFinite(v) ? this.band(v) / nb : 1;
        const c = RAMP_LO.map((lo, i) => lo + t * (RAMP_HI[i] - lo));
        const o = 4 * (py * N + px);
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.image = this.canvas.toDataURL();
  }

  /** Level-L segments by marching squares, in screen units. */
  march(L) {
    const N = FV_GRID, z = this.z, segs = [];
    const X = i => PLOT.x0 + i / N * (PLOT.x1 - PLOT.x0);
    const Y = j => PLOT.y1 - j / N * (PLOT.y1 - PLOT.y0);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = z[j * (N + 1) + i], b = z[j * (N + 1) + i + 1];
        const c = z[(j + 1) * (N + 1) + i + 1], d = z[(j + 1) * (N + 1) + i];
        // Corners a (i, j), b (i+1, j), c (i+1, j+1), d (i, j+1).
        const pts = [];
        const edge = (v0, v1, x0, y0, x1, y1) => {
          if ((v0 > L) !== (v1 > L)) {
            const t = (L - v0) / (v1 - v0);
            pts.push([X(x0 + t * (x1 - x0)), Y(y0 + t * (y1 - y0))]);
          }
        };
        edge(a, b, i, j, i + 1, j);
        edge(b, c, i + 1, j, i + 1, j + 1);
        edge(c, d, i + 1, j + 1, i, j + 1);
        edge(d, a, i, j + 1, i, j);
        if (pts.length === 2) segs.push(pts);
        else if (pts.length === 4) segs.push(pts.slice(0, 2), pts.slice(2));
      }
    }
    return segs;
  }

  /**
   * Arrow scales from the 90th-percentile gradient length over the view
   * (robust to flat regions, as in sigma): it fills most of a quiver cell
   * for the field (longer ones are capped) and three cells for the
   * probe's arrows.
   */
  quiverScale() {
    const n = [];
    for (let j = 0; j < FV_QUIVER; j++) {
      for (let i = 0; i < FV_QUIVER; i++) {
        const g = this.fn.grad(this.at((i + 0.5) / FV_QUIVER,
          (j + 0.5) / FV_QUIVER));
        const len = Math.hypot(...g);
        if (Number.isFinite(len)) n.push(len);
      }
    }
    n.sort((a, b) => a - b);
    const q90 = n[Math.floor(0.9 * (n.length - 1))] || 1;
    const cell = (PLOT.x1 - PLOT.x0) / FV_QUIVER;
    this.gscale = 0.85 * cell / Math.max(q90, 1e-12);
    this.pscale = 3 * cell / Math.max(q90, 1e-12);
  }

  /** Screen offset of gradient vector g at arrow scale k. */
  offset(g, k = this.gscale) { return [g[0] * k, -g[1] * k]; }

  /**
   * Draw the view.
   *
   * Args:
   *   w (number[]): (2,) probe position
   *   extras (object[]): more arrows from the probe, each { vec, cls, from?
   *     } with vec a gradient-space vector and from an optional
   *     gradient-space offset where it starts (to chain arrows tip to tail)
   */
  render(w, extras = []) {
    const svg = this.svg, P = PLOT;
    this.w = w;
    svg.innerHTML = "";
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: `${svg.id}-clip` }, defs);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0 }, clip);
    const g = node("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
    node("image", { href: this.image, x: P.x0, y: P.y0,
      width: P.x1 - P.x0, height: P.y1 - P.y0, preserveAspectRatio: "none",
      class: "bands" }, g);
    for (const segs of this.lines) {
      const d = segs.map(([[x0, y0], [x1, y1]]) =>
        `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`)
        .join("");
      node("path", { d, class: "flevel" }, g);
    }
    if (Math.abs(this.mid[0]) <= this.hw) {
      const x = this.sx(0);
      node("line", { x1: x, x2: x, y1: P.y0, y2: P.y1, class: "axis0" }, g);
    }
    if (Math.abs(this.mid[1]) <= this.hw) {
      const y = this.sy(0);
      node("line", { x1: P.x0, x2: P.x1, y1: y, y2: y, class: "axis0" }, g);
    }
    this.labels(g);
    this.quiver(g);

    const px = this.sx(w[0]), py = this.sy(w[1]);
    const cap = (P.x1 - P.x0) * 0.45;
    const draw = (vec, from, cls) => {
      const [fx, fy] = from ? this.offset(from, this.pscale) : [0, 0];
      let [dx, dy] = this.offset(vec, this.pscale);
      const len = Math.hypot(dx, dy);
      if (len > cap) { dx *= cap / len; dy *= cap / len; }
      arrow(g, px + fx, py + fy, px + fx + dx, py + fy + dy, cls, 12);
    };
    // The student's arrow goes over the true one, so a match shows both.
    for (const e of extras) if (e.cls !== "yours") draw(e.vec, e.from, e.cls);
    draw(this.fn.grad(w), null, "fgrad");
    for (const e of extras) if (e.cls === "yours") draw(e.vec, e.from, e.cls);
    node("circle", { cx: px, cy: py, r: 8, class: "handle" }, g);
    const lx = clamp(px + 14, P.x0 + 4, P.x1 - 110);
    text(g, lx, clamp(py - 14, P.y0 + 16, P.y1 - 6),
      `f = ${fmt(this.fn.f(w))}`, { class: "tip-label" });
    this.axes(svg);
  }

  /** One value label per level, greedily kept apart from the others. */
  labels(g) {
    const P = PLOT, placed = [];
    const ok = (x, y) => x > P.x0 + 22 && x < P.x1 - 22 && y > P.y0 + 12
      && y < P.y1 - 10;
    this.levels.forEach((L, k) => {
      let best = null, bd = 0;
      const segs = this.lines[k];
      const step = Math.max(1, Math.floor(segs.length / 60));
      for (let s = 0; s < segs.length; s += step) {
        const [[x0, y0], [x1, y1]] = segs[s];
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        if (!ok(x, y)) continue;
        const d = placed.reduce((m, [px, py]) =>
          Math.min(m, Math.hypot(x - px, y - py)), 1e9);
        if (d > bd) { bd = d; best = [x, y]; }
      }
      if (best && bd > 46) {
        placed.push(best);
        text(g, best[0], best[1] + 4, fmt(L), { class: "clabel",
          "text-anchor": "middle" });
      }
    });
  }

  quiver(g) {
    const q = node("g", { class: "quiver" }, g);
    const cell = (PLOT.x1 - PLOT.x0) / FV_QUIVER;
    for (let j = 0; j < FV_QUIVER; j++) {
      for (let i = 0; i < FV_QUIVER; i++) {
        const w = this.at((i + 0.5) / FV_QUIVER, (j + 0.5) / FV_QUIVER);
        let [dx, dy] = this.offset(this.fn.grad(w));
        const len = Math.hypot(dx, dy);
        if (!Number.isFinite(len)) continue;
        // Cap at most of a cell so neighbors never overlap.
        if (len > 0.9 * cell) { dx *= 0.9 * cell / len; dy *= 0.9 * cell / len; }
        const x = this.sx(w[0]) - dx / 2, y = this.sy(w[1]) - dy / 2;
        if (len < 1.5) node("circle", { cx: x, cy: y, r: 1.4 }, q);
        else arrow(q, x, y, x + dx, y + dy, "qarrow", 6);
      }
    }
  }

  axes(svg) {
    const P = PLOT, lo0 = this.mid[0] - this.hw, hi0 = this.mid[0] + this.hw;
    const lo1 = this.mid[1] - this.hw, hi1 = this.mid[1] + this.hw;
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, class: "frame" }, svg);
    for (const t of ticks(lo0, hi0, 6)) {
      text(svg, this.sx(t), P.y1 + 17, fmt(t),
        { class: "tick", "text-anchor": "middle" });
    }
    for (const t of ticks(lo1, hi1, 6)) {
      text(svg, P.x0 - 6, this.sy(t) + 4, fmt(t),
        { class: "tick", "text-anchor": "end" });
    }
    text(svg, (P.x0 + P.x1) / 2, P.y1 + 40, "w₀",
      { class: "axis-label", "text-anchor": "middle" });
    text(svg, 16, (P.y0 + P.y1) / 2, "w₁", { class: "axis-label",
      "text-anchor": "middle",
      transform: `rotate(-90 16 ${(P.y0 + P.y1) / 2})` });
  }

  /**
   * Move the probe to w, snapped to 0.1 so round points are easy to hit,
   * clamped to the view, and tell the caller.
   */
  probeTo(w) {
    this.onProbe([0, 1].map(i => clamp(Math.round(w[i] * 10) / 10,
      this.mid[i] - this.hw, this.mid[i] + this.hw)));
  }

  listen() {
    const svg = this.svg;
    let drag = false;
    const move = e => {
      const p = svgPoint(svg, e);
      this.probeTo(this.inv(p.x, p.y));
    };
    svg.addEventListener("pointerdown", e => {
      const p = svgPoint(svg, e), P = PLOT;
      if (e.button !== 0 || p.x < P.x0 || p.x > P.x1 || p.y < P.y0
        || p.y > P.y1) return;
      drag = true;
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      move(e);
    });
    svg.addEventListener("pointermove", e => { if (drag) move(e); });
    svg.addEventListener("pointerup", () => { drag = false; });
    svg.addEventListener("pointercancel", () => { drag = false; });
  }
}
