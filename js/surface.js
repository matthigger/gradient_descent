// Surface view of a 2D quadratic objective over c = (c0, c1), shared by the
// regression tab (MSE) and the step-size tab's 2D bowl.
//
// Contour mode: filled level sets, which are exact ellipses (see gd.js),
// spaced geometrically so the valley floor stays visible however stretched
// the bowl. Both axes share one scale, so the gradient is perpendicular to
// the level lines on screen as it is in the math. 3D mode: the same
// surface as a mesh under an orthographic orbit camera; the handle for c
// slides on the floor plane and a dropline shows its height. In both modes
// dragging that handle (or clicking in contour mode) sets c through
// opts.onSet. Holding Shift locks the drag to one parameter: whichever of
// c0, c1 the pointer has moved further along since the drag began.

const PLOT = { w: 560, h: 560, x0: 62, x1: 546, y0: 14, y1: 498 };
// Level sets: K levels, each RHO times the excess of the one outside it.
const LEVELS = 16;
const RHO = 0.55;
const MESH = 26;
// Surface ramp, low (light) to high (dark), one hue.
const RAMP_LO = [246, 248, 252];
const RAMP_HI = [156, 178, 218];

function ramp(t) {
  const c = RAMP_LO.map((lo, i) => Math.round(lo + t * (RAMP_HI[i] - lo)));
  return `rgb(${c.join(",")})`;
}

class ParamView {
  /**
   * Args:
   *   svg (SVGElement): the view's SVG
   *   opts (object): { labels: [x, y] axis names, fname: objective name
   *     for the tip label, onSet(c, done): called while dragging (done
   *     false) and on release }
   */
  constructor(svg, opts) {
    this.svg = svg;
    this.opts = opts;
    this.cam = { theta: -0.7, phi: 0.62, zoom: 1 };
    this.drag = null;
    svg.setAttribute("viewBox", `0 0 ${PLOT.w} ${PLOT.h}`);
    this.listen();
  }

  /**
   * Fit a square domain around the minimum: the level set at excess delta,
   * plus any extra points (the start, the origin) that should be in view.
   */
  fit(q, delta, points = []) {
    const [h00, h01, h11] = q.H, det = h00 * h11 - h01 * h01;
    const r0 = Math.sqrt(2 * delta * h11 / det);
    const r1 = Math.sqrt(2 * delta * h00 / det);
    let lo = [q.cstar[0] - r0, q.cstar[1] - r1];
    let hi = [q.cstar[0] + r0, q.cstar[1] + r1];
    for (const p of points) {
      lo = lo.map((v, i) => Math.min(v, p[i]));
      hi = hi.map((v, i) => Math.max(v, p[i]));
    }
    this.mid = [0, 1].map(i => (lo[i] + hi[i]) / 2);
    this.hw = 1.08 * Math.max((hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2);
    this.ppu = (PLOT.x1 - PLOT.x0) / (2 * this.hw);
  }

  /** Size of the view in parameter units. */
  get scale() { return 2 * this.hw; }

  sx(v) { return PLOT.x0 + (v - this.mid[0] + this.hw) * this.ppu; }
  sy(v) { return PLOT.y1 - (v - this.mid[1] + this.hw) * this.ppu; }
  inv(px, py) {
    return [this.mid[0] - this.hw + (px - PLOT.x0) / this.ppu,
      this.mid[1] - this.hw + (PLOT.y1 - py) / this.ppu];
  }
  inside(c) {
    return [0, 1].every(i => Math.abs(c[i] - this.mid[i]) <= this.hw);
  }

  /** Largest excess over the domain (a corner, since f is convex). */
  topLevel(q) {
    let top = 0;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        top = Math.max(top, q.excess(
          [this.mid[0] + a * this.hw, this.mid[1] + b * this.hw]));
      }
    }
    return top;
  }

  /** Level band of an excess value: 0 outermost (high) .. LEVELS-1. */
  band(e, top) {
    if (!(e > 0)) return LEVELS - 1;
    return clamp(Math.floor(Math.log(e / top) / Math.log(RHO)), 0,
      LEVELS - 1);
  }

  /**
   * Draw the view.
   *
   * Args:
   *   q (Quadratic): objective
   *   st (object): { c, trail, eta, mode: "contour" | "3d" }
   */
  render(q, st) {
    this.q = q;
    this.st = st;
    this.svg.innerHTML = "";
    this.svg.classList.toggle("orbit", st.mode === "3d");
    if (st.mode === "3d") this.draw3d(q, st);
    else this.drawContour(q, st);
  }

  drawContour(q, st) {
    const svg = this.svg, P = PLOT, { l, v } = q.eig;
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: `${svg.id}-clip` }, defs);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0 }, clip);
    const g = node("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
    const top = this.topLevel(q);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, fill: ramp(1), class: "plotbg" }, g);

    const cx = this.sx(q.cstar[0]), cy = this.sy(q.cstar[1]);
    const rot = -Math.atan2(v[0][1], v[0][0]) * 180 / Math.PI;
    const ellipse = (ell, attrs) => node("ellipse", {
      cx, cy, rx: Math.sqrt(2 * ell / l[0]) * this.ppu,
      ry: Math.sqrt(2 * ell / Math.max(l[1], 1e-300)) * this.ppu,
      transform: `rotate(${rot} ${cx} ${cy})`, ...attrs }, g);
    for (let k = 0; k < LEVELS; k++) {
      ellipse(top * RHO ** k, { fill: ramp(1 - (k + 1) / LEVELS),
        class: "level" });
    }

    if (Math.abs(this.mid[0]) <= this.hw) {
      const x = this.sx(0);
      node("line", { x1: x, x2: x, y1: P.y0, y2: P.y1, class: "axis0" }, g);
    }
    if (Math.abs(this.mid[1]) <= this.hw) {
      const y = this.sy(0);
      node("line", { x1: P.x0, x2: P.x1, y1: y, y2: y, class: "axis0" }, g);
    }

    const c = st.c, ec = q.excess(c);
    if (ec > 0) ellipse(ec, { class: "here-level" });
    const lock = this.lockLine();
    if (lock) {
      const [[a0, a1], [b0, b1]] = lock;
      node("line", { x1: this.sx(a0), y1: this.sy(a1), x2: this.sx(b0),
        y2: this.sy(b1), class: "lockline" }, g);
    }
    this.star(g, cx, cy);
    this.trail(g, st.trail.map(p => [this.sx(p[0]), this.sy(p[1])]));

    const px = this.sx(c[0]), py = this.sy(c[1]);
    this.gradArrows(g, q, st, px, py);
    node("circle", { cx: px, cy: py, r: 8, class: "handle" }, g);
    this.tipLabel(g, q, c, px, py);

    this.axes(svg);
    if (!this.inside(c)) this.edgeMarker(svg, c);
  }

  /**
   * Ends of the line c may move along during a Shift drag, in parameter
   * units, spanning the domain; null when no axis is locked.
   */
  lockLine() {
    const d = this.drag;
    if (!d || d.lock === undefined) return null;
    const a = d.anchor, ends = [-1, 1].map(s => {
      const p = a.slice();
      p[d.lock] = this.mid[d.lock] + s * this.hw;
      return p;
    });
    return ends;
  }

  star(g, x, y) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push(`${x + r * Math.cos(a)},${y + r * Math.sin(a)}`);
    }
    node("polygon", { points: pts.join(" "), class: "star" }, g);
  }

  /** Iterates as a polyline, with dots while there are few enough. */
  trail(g, pts) {
    if (pts.length < 2) return;
    node("polyline", { points: pts.map(p => p.join(",")).join(" "),
      class: "trail" }, g);
    if (pts.length <= 300) {
      for (const [x, y] of pts.slice(0, -1)) {
        node("circle", { cx: x, cy: y, r: 3, class: "trail-dot" }, g);
      }
    }
  }

  /**
   * The step -eta grad at true length, and the gradient itself drawn
   * uphill at a fixed screen length (its true length is often off-plot).
   */
  gradArrows(g, q, st, px, py) {
    const gr = q.grad(st.c), n = Math.hypot(...gr);
    if (!(n > 0)) return;
    const ux = gr[0] / n, uy = -gr[1] / n;
    arrow(g, px, py, px + 70 * ux, py + 70 * uy, "grad", 10);
    const sx = this.sx(st.c[0] - st.eta * gr[0]);
    const sy = this.sy(st.c[1] - st.eta * gr[1]);
    arrow(g, px, py, sx, sy, "step", 11);
  }

  tipLabel(g, q, c, px, py) {
    const x = clamp(px + 14, PLOT.x0 + 4, PLOT.x1 - 130);
    const y = clamp(py - 14, PLOT.y0 + 16, PLOT.y1 - 6);
    text(g, x, y, `${this.opts.fname} = ${fmt(q.f(c))}`,
      { class: "tip-label" });
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
    const [lx, ly] = this.opts.labels;
    text(svg, (P.x0 + P.x1) / 2, P.y1 + 40, lx,
      { class: "axis-label", "text-anchor": "middle" });
    text(svg, 16, (P.y0 + P.y1) / 2, ly, { class: "axis-label",
      "text-anchor": "middle",
      transform: `rotate(-90 16 ${(P.y0 + P.y1) / 2})` });
  }

  /** Arrowhead on the frame pointing toward an off-plot c. */
  edgeMarker(svg, c) {
    const d = [c[0] - this.mid[0], c[1] - this.mid[1]];
    const t = this.hw / Math.max(Math.abs(d[0]), Math.abs(d[1]));
    const ex = this.sx(this.mid[0] + d[0] * t);
    const ey = this.sy(this.mid[1] + d[1] * t);
    const n = Math.hypot(d[0], d[1]), ux = d[0] / n, uy = -d[1] / n;
    arrow(svg, ex - 26 * ux, ey - 26 * uy, ex, ey, "offplot", 13);
  }

  // ------------------------------------------------------------------ 3D

  /** World coordinates: floor in [-1, 1]^2, height 0..0.9 over the box. */
  world(c, top) {
    const z = Math.min(this.q.excess(c) / top, 4);
    return [(c[0] - this.mid[0]) / this.hw, (c[1] - this.mid[1]) / this.hw,
      0.9 * z];
  }

  project([X, Y, Z]) {
    const { theta, phi, zoom } = this.cam, s = 175 * zoom;
    const xr = X * Math.cos(theta) - Y * Math.sin(theta);
    const yr = X * Math.sin(theta) + Y * Math.cos(theta);
    return {
      x: PLOT.w / 2 + s * xr,
      y: PLOT.h * 0.6 - s * (Z * Math.cos(phi) + yr * Math.sin(phi)),
      depth: yr * Math.cos(phi) - Z * Math.sin(phi),
    };
  }

  /** Inverse of project() on the floor plane Z = 0. */
  unprojectFloor(px, py) {
    const { theta, phi, zoom } = this.cam, s = 175 * zoom;
    const xr = (px - PLOT.w / 2) / s;
    const yr = (PLOT.h * 0.6 - py) / (s * Math.sin(phi));
    const X = xr * Math.cos(theta) + yr * Math.sin(theta);
    const Y = -xr * Math.sin(theta) + yr * Math.cos(theta);
    return [this.mid[0] + X * this.hw, this.mid[1] + Y * this.hw];
  }

  draw3d(q, st) {
    const svg = this.svg, top = this.topLevel(q);
    const P = c => this.project(this.world(c, top));
    const F = (X, Y) => this.project([X, Y, 0]);
    const at = (i, j) => [this.mid[0] + this.hw * (2 * i / MESH - 1),
      this.mid[1] + this.hw * (2 * j / MESH - 1)];

    const floor = node("g", { class: "floor" }, svg);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(
      ([X, Y]) => F(X, Y));
    node("polygon", { points: corners.map(p => `${p.x},${p.y}`).join(" ") },
      floor);
    const [lx, ly] = this.opts.labels;
    const l0 = F(0, -1.22), l1 = F(-1.22, 0);
    text(floor, l0.x, l0.y, lx, { class: "axis-label",
      "text-anchor": "middle" });
    text(floor, l1.x, l1.y, ly, { class: "axis-label",
      "text-anchor": "middle" });
    const lock = this.lockLine();
    if (lock) {
      const [a, b] = lock.map(p => {
        const w = this.world(p, top);
        return F(w[0], w[1]);
      });
      node("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "lockline" },
        floor);
    }
    const c = st.c, w = this.world(c, top);
    const tip = F(w[0], w[1]);

    const quads = [];
    for (let i = 0; i < MESH; i++) {
      for (let j = 0; j < MESH; j++) {
        const pts = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const proj = pts.map(P);
        const mid = at(i + 0.5, j + 0.5);
        quads.push({ proj, depth: proj.reduce((s, p) => s + p.depth, 0),
          k: this.band(q.excess(mid), top) });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    const mesh = node("g", { class: "mesh" }, svg);
    for (const qd of quads) {
      node("polygon", { fill: ramp(1 - (qd.k + 1) / LEVELS),
        points: qd.proj.map(p => `${p.x},${p.y}`).join(" ") }, mesh);
    }

    const sm = P(q.cstar);
    this.star(svg, sm.x, sm.y);
    const tp = st.trail.map(p => { const r = P(p); return [r.x, r.y]; });
    this.trail(svg, tp);
    const pc = P(c);
    node("line", { x1: pc.x, y1: pc.y, x2: tip.x, y2: tip.y,
      class: "dropline" }, svg);
    node("circle", { cx: pc.x, cy: pc.y, r: 6, class: "surf-pt" }, svg);
    node("circle", { cx: tip.x, cy: tip.y, r: 8, class: "handle" }, svg);
    text(svg, pc.x + 12, pc.y - 12, `${this.opts.fname} = ${fmt(q.f(c))}`,
      { class: "tip-label" });
  }

  // ---------------------------------------------------------- pointer

  listen() {
    const svg = this.svg;
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 || !this.q) return;
      const p = svgPoint(svg, e);
      if (this.st.mode === "3d") {
        this.drag = e.target.classList.contains("handle")
          ? { tip: true, anchor: this.st.c.slice() }
          : { orbit: true, x: p.x, y: p.y };
      } else {
        const P = PLOT;
        if (p.x < P.x0 || p.x > P.x1 || p.y < P.y0 || p.y > P.y1) return;
        this.drag = { tip: true, anchor: this.st.c.slice() };
      }
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.move(p, e.shiftKey);
    });
    svg.addEventListener("pointermove", e => {
      if (this.drag) this.move(svgPoint(svg, e), e.shiftKey);
    });
    const end = () => {
      // Clear the drag first so the final redraw drops the Shift guide.
      const d = this.drag;
      this.drag = null;
      if (d && d.tip) this.opts.onSet(this.st.c, true);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("wheel", e => {
      if (!this.st || this.st.mode !== "3d") return;
      e.preventDefault();
      this.cam.zoom = clamp(this.cam.zoom * Math.exp(-e.deltaY * 0.001),
        0.4, 3);
      this.render(this.q, this.st);
    }, { passive: false });
  }

  /** Follow the pointer; shift locks c to one axis through the anchor. */
  move(p, shift) {
    const d = this.drag;
    if (d.orbit) {
      this.cam.theta += (p.x - d.x) * 0.01;
      this.cam.phi = clamp(this.cam.phi + (p.y - d.y) * 0.01, 0.15, 1.45);
      d.x = p.x;
      d.y = p.y;
      this.render(this.q, this.st);
      return;
    }
    const c = this.st.mode === "3d" ? this.unprojectFloor(p.x, p.y)
      : this.inv(clamp(p.x, PLOT.x0, PLOT.x1), clamp(p.y, PLOT.y0, PLOT.y1));
    d.lock = undefined;
    if (shift) {
      // Both axes share one scale, so parameter units compare fairly.
      const a = d.anchor;
      d.lock = Math.abs(c[0] - a[0]) >= Math.abs(c[1] - a[1]) ? 0 : 1;
      c[1 - d.lock] = a[1 - d.lock];
    }
    this.opts.onSet(c, false);
  }
}
