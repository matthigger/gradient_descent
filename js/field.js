// Contour view of any f(w0, w1) with its gradient field, for the gradient
// tab.
//
// Unlike the quadratic-only surface view, f is sampled on a grid: filled
// bands come from a canvas image and level lines from marching squares,
// at levels spaced by the quantiles of f over the view so any shape gets
// usable contours. Small arrows on a coarser grid show the field, all at
// one scale so their lengths compare (long arrow, steep f). A draggable
// probe w carries the true gradient arrow, at a larger scale so it stays
// legible. 3D mode draws f as a mesh under the orbit camera
// of surface.js; w moves on the floor, where the arrows lie too, since
// the gradient lives in w-space.

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
    this.cam = { theta: -0.7, phi: 0.62, zoom: 1 };
    this.mode = "contour";
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
    this.zlo = fin[0];
    this.zhi = fin[fin.length - 1];
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
   *   mode (string): "contour" or "3d"
   */
  render(w, mode = this.mode) {
    const svg = this.svg, P = PLOT;
    this.w = w;
    this.mode = mode;
    svg.innerHTML = "";
    svg.classList.toggle("orbit", mode === "3d");
    if (mode === "3d") { this.draw3d(w); return; }
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
    let [dx, dy] = this.offset(this.fn.grad(w), this.pscale);
    const len = Math.hypot(dx, dy);
    if (len > cap) { dx *= cap / len; dy *= cap / len; }
    arrow(g, px, py, px + dx, py + dy, "fgrad", 12);
    node("circle", { cx: px, cy: py, r: 8, class: "handle" }, g);
    const lx = clamp(px + 14, P.x0 + 4, P.x1 - 110);
    text(g, lx, clamp(py - 14, P.y0 + 16, P.y1 - 6),
      `f = ${fmt(this.fn.f(w))}`, { class: "tip-label" });
    this.axes(svg);
  }

  // ---------------------------------------------------------------- 3D

  /** World point: floor in [-1, 1]^2, height 0..0.9 over f's range. */
  world(w) {
    const t = (this.fn.f(w) - this.zlo) / Math.max(this.zhi - this.zlo, 1e-12);
    return [(w[0] - this.mid[0]) / this.hw, (w[1] - this.mid[1]) / this.hw,
      0.9 * clamp(t, 0, 1.5)];
  }

  /**
   * Floor arrow from w for gradient vector g at screen scale k (the
   * contour view's pixels per gradient unit), capped in length.
   */
  floorArrow(parent, w, g, k, cls, head) {
    const unit = this.ppu * this.hw;
    const [X, Y] = this.world(w);
    let [dx, dy] = [g[0] * k / unit, g[1] * k / unit];
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len)) return;
    if (len > 0.9) { dx *= 0.9 / len; dy *= 0.9 / len; }
    const a = orbitProject(this.cam, [X, Y, 0]);
    const b = orbitProject(this.cam, [X + dx, Y + dy, 0]);
    arrow(parent, a.x, a.y, b.x, b.y, cls, head);
  }

  draw3d(w) {
    const svg = this.svg, cam = this.cam, nb = this.levels.length;
    const F = (X, Y) => orbitProject(cam, [X, Y, 0]);
    const floor = node("g", { class: "floor" }, svg);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([X, Y]) =>
      F(X, Y));
    node("polygon", { points: corners.map(p => `${p.x},${p.y}`).join(" ") },
      floor);
    const l0 = F(0, -1.22), l1 = F(-1.22, 0);
    text(floor, l0.x, l0.y, "w₀", { class: "axis-label",
      "text-anchor": "middle" });
    text(floor, l1.x, l1.y, "w₁", { class: "axis-label",
      "text-anchor": "middle" });
    const q = node("g", { class: "quiver" }, svg);
    for (let j = 0; j < FV_QUIVER; j++) {
      for (let i = 0; i < FV_QUIVER; i++) {
        const p = this.at((i + 0.5) / FV_QUIVER, (j + 0.5) / FV_QUIVER);
        this.floorArrow(q, p, this.fn.grad(p), this.gscale, "qarrow", 5);
      }
    }

    const quads = [];
    for (let i = 0; i < MESH; i++) {
      for (let j = 0; j < MESH; j++) {
        const pts = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(
          ([a, b]) => orbitProject(cam, this.world(this.at(a / MESH,
            b / MESH))));
        const v = this.fn.f(this.at((i + 0.5) / MESH, (j + 0.5) / MESH));
        quads.push({ pts, depth: pts.reduce((t, p) => t + p.depth, 0),
          t: Number.isFinite(v) ? this.band(v) / nb : 1 });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    const mesh = node("g", { class: "mesh" }, svg);
    for (const qd of quads) {
      node("polygon", { fill: ramp(qd.t),
        points: qd.pts.map(p => `${p.x},${p.y}`).join(" ") }, mesh);
    }

    const [X, Y] = this.world(w), tip = F(X, Y);
    const top = orbitProject(cam, this.world(w));
    node("line", { x1: top.x, y1: top.y, x2: tip.x, y2: tip.y,
      class: "dropline" }, svg);
    node("circle", { cx: top.x, cy: top.y, r: 6, class: "surf-pt" }, svg);
    // The floor is drawn smaller than the contour plot and foreshortened,
    // so the probe's arrow gets twice its contour scale.
    this.floorArrow(svg, w, this.fn.grad(w), 2 * this.pscale, "fgrad", 12);
    node("circle", { cx: tip.x, cy: tip.y, r: 8, class: "handle" }, svg);
    text(svg, top.x + 12, top.y - 12, `f = ${fmt(this.fn.f(w))}`,
      { class: "tip-label" });
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

  /**
   * Contour: press anywhere in the plot to move the probe. 3D: press the
   * handle to move it on the floor, anywhere else to orbit; scroll zooms.
   */
  listen() {
    const svg = this.svg;
    let drag = null;
    const move = p => {
      if (drag.orbit) {
        this.cam.theta += (p.x - drag.x) * 0.01;
        this.cam.phi = clamp(this.cam.phi + (p.y - drag.y) * 0.01, 0.15, 1.45);
        drag.x = p.x;
        drag.y = p.y;
        this.render(this.w);
        return;
      }
      if (this.mode === "3d") {
        const [X, Y] = orbitUnprojectFloor(this.cam, p.x, p.y);
        this.probeTo([this.mid[0] + X * this.hw, this.mid[1] + Y * this.hw]);
      } else {
        this.probeTo(this.inv(p.x, p.y));
      }
    };
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 || !this.fn) return;
      const p = svgPoint(svg, e), P = PLOT;
      if (this.mode === "3d") {
        drag = e.target.classList.contains("handle")
          ? { probe: true } : { orbit: true, x: p.x, y: p.y };
      } else {
        if (p.x < P.x0 || p.x > P.x1 || p.y < P.y0 || p.y > P.y1) return;
        drag = { probe: true };
      }
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      move(p);
    });
    svg.addEventListener("pointermove", e => {
      if (drag) move(svgPoint(svg, e));
    });
    svg.addEventListener("pointerup", () => { drag = null; });
    svg.addEventListener("pointercancel", () => { drag = null; });
    svg.addEventListener("wheel", e => {
      if (this.mode !== "3d") return;
      e.preventDefault();
      this.cam.zoom = clamp(this.cam.zoom * Math.exp(-e.deltaY * 0.001),
        0.4, 3);
      this.render(this.w);
    }, { passive: false });
  }
}
