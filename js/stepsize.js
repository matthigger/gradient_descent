// Step-size tab: gradient descent on a 1D function (a parabola or two
// valleys) or a 2D bowl whose stretch (condition number kappa) and
// rotation theta are set by presets or sliders.
//
// In 1D, Gradient step can play out in phases (tangent, gradient pointing
// uphill, step against it, move) so the direction logic is explicit; Run
// skips the phases. The 2D bowl reuses the regression tab's surface view.

const StepTab = (function () {
  const P1 = { w: 560, h: 560, x0: 62, x1: 546, y0: 14, y1: 498 };
  const ETA_LO = 0.003, ETA_HI = 5;
  // Screen length of the gradient arrow per unit of f'(c), in c units.
  const GSCALE = 0.15;
  const PHASE_MS = 420;
  const DOM1 = {
    parabola: { x: [-3, 3], y: [-0.8, 9.5], start: 2.5 },
    valleys: { x: [-2.6, 2.6], y: [-2.1, 5], start: 2.2 },
  };
  const PRESETS = {
    round: { label: "Round", kappa: 1, theta: 0 },
    stretched: { label: "Stretched", kappa: 10, theta: 0 },
    rotated: { label: "Rotated", kappa: 10, theta: 30 },
    very: { label: "Very stretched", kappa: 50, theta: 30 },
  };
  const START2 = [-2.5, 1.5];

  const S = { dim: 1, fn: "parabola", a: 1, kappa: 10, theta: 0,
    view: "contour", anim: true, log: true, eta: { 1: 0.1, 2: 0.5 } };
  let obj1, run1, q2, run2, stopRun = null, anim = null;

  const $ = id => document.getElementById(id);
  const svg1 = $("st-1d");
  const chart = $("st-chart");
  const etaInput = $("st-eta");
  const eta = etaSlider(etaInput, ETA_LO, ETA_HI);
  const view = new ParamView($("st-2d"), {
    labels: ["c₀", "c₁"], fname: "f",
    onSet: c => { stop(); run2.reset(c); render(); },
  });
  view.fit(bowlQuadratic(1, 0), 4.5);
  svg1.setAttribute("viewBox", `0 0 ${P1.w} ${P1.h}`);

  /** 1D objective wrapped for the Runner, which works on arrays. */
  function wrap(o) {
    return { f: c => o.f(c[0]), grad: c => [o.df(c[0])],
      converged: (c, st) => o.converged(c[0], st[0]) };
  }
  function make1() {
    obj1 = S.fn === "parabola" ? parabola(S.a) : twoValleys();
    return wrap(obj1);
  }
  function make2() {
    q2 = bowlQuadratic(S.kappa, S.theta * Math.PI / 180);
    return q2;
  }
  function runner() { return S.dim === 1 ? run1 : run2; }
  /** Largest curvature, or null where it varies (two valleys). */
  function curvature() { return S.dim === 1 ? obj1.L : q2.L; }

  function stop() {
    if (stopRun) { stopRun(); stopRun = null; }
    if (anim) finishAnim();
  }

  /** Change the objective, restarting the walk from its start. */
  function reshape() {
    stop();
    const r = runner(), start = r.trail[0];
    if (S.dim === 1) r.obj = make1();
    else r.obj = make2();
    r.reset(start);
    render();
  }

  function step() {
    if (anim) finishAnim();
    stop();
    const r = runner();
    if (r.status) return;
    if (S.dim === 1 && S.anim) {
      const c = r.c[0], to = c - eta.get() * obj1.df(c);
      anim = { t0: performance.now(), from: c, to };
      requestAnimationFrame(tick);
      return;
    }
    r.step(eta.get());
    render();
  }

  function tick() {
    if (!anim) return;
    if (performance.now() - anim.t0 >= 4 * PHASE_MS) { finishAnim(); return; }
    render();
    requestAnimationFrame(tick);
  }

  function finishAnim() {
    anim = null;
    run1.step(eta.get());
    render();
  }

  function toggleRun() {
    if (stopRun) { stop(); render(); return; }
    if (anim) finishAnim();
    const r = runner();
    if (r.status) return;
    stopRun = runLoop(r, eta.get, render, () => {
      stopRun = null;
      render();
    });
    render();
  }

  // ------------------------------------------------------------- 1D

  function d1() { return DOM1[S.fn]; }
  function sx(v) {
    const d = d1().x;
    return P1.x0 + (v - d[0]) / (d[1] - d[0]) * (P1.x1 - P1.x0);
  }
  function sy(v) {
    const d = d1().y;
    return P1.y1 - (v - d[0]) / (d[1] - d[0]) * (P1.y1 - P1.y0);
  }
  function ix(px) {
    const d = d1().x;
    return d[0] + (px - P1.x0) / (P1.x1 - P1.x0) * (d[1] - d[0]);
  }
  // Cap far-off values so huge numbers stay inside SVG's coordinate range.
  function cy(v) { return clamp(sy(v), -1e4, 1e4); }
  function cx(v) { return clamp(sx(v), -1e4, 1e4); }

  function draw1d() {
    const svg = svg1, d = d1(), o = obj1;
    svg.innerHTML = "";
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: "st-1d-clip" }, defs);
    node("rect", { x: P1.x0, y: P1.y0, width: P1.x1 - P1.x0,
      height: P1.y1 - P1.y0 }, clip);
    for (const t of ticks(...d.x, 6)) {
      node("line", { x1: sx(t), x2: sx(t), y1: P1.y0, y2: P1.y1,
        class: "grid" }, svg);
      text(svg, sx(t), P1.y1 + 17, fmt(t),
        { class: "tick", "text-anchor": "middle" });
    }
    for (const t of ticks(...d.y, 6)) {
      node("line", { x1: P1.x0, x2: P1.x1, y1: sy(t), y2: sy(t),
        class: "grid" }, svg);
      text(svg, P1.x0 - 6, sy(t) + 4, fmt(t),
        { class: "tick", "text-anchor": "end" });
    }
    const g = node("g", { "clip-path": "url(#st-1d-clip)" }, svg);
    const pts = [];
    for (let i = 0; i <= 300; i++) {
      const c = d.x[0] + i / 300 * (d.x[1] - d.x[0]);
      pts.push(`${sx(c)},${cy(o.f(c))}`);
    }
    node("polyline", { points: pts.join(" "), class: "curve" }, g);
    const lane = P1.y1 - 28;
    node("line", { x1: P1.x0, x2: P1.x1, y1: lane, y2: lane,
      class: "lane" }, g);
    const sm = { x: sx(o.cstar), y: sy(o.fmin) };
    view.star(g, sm.x, sm.y);

    const tr = run1.trail.map(p => [cx(p[0]), cy(o.f(p[0]))]);
    view.trail(g, tr);

    // Animation phases: 0 tangent, 1 gradient, 2 step, 3 move.
    const c = run1.c[0], f = o.f(c), df = o.df(c);
    const ph = anim ? (performance.now() - anim.t0) / PHASE_MS : 4;
    const show = k => !anim || ph > k;
    const grow = k => anim ? clamp(ph - k, 0, 1) : 1;
    const px = sx(c), py = cy(f);
    if (show(0)) {
      const w = 0.9 * grow(0);
      node("line", { x1: cx(c - w), y1: cy(f - w * df), x2: cx(c + w),
        y2: cy(f + w * df), class: "tangent" }, g);
    }
    node("line", { x1: px, x2: px, y1: py, y2: lane, class: "guide" }, g);
    const label = (x0, x1, y, str) => {
      if (Math.abs(x1 - x0) < 6) return;
      const x = clamp((x0 + x1) / 2, P1.x0 + 70, P1.x1 - 70);
      text(g, x, y, str, { class: "arrow-label", "text-anchor": "middle" });
    };
    if (show(1)) {
      const gx = cx(c + GSCALE * df * grow(1));
      arrow(g, px, lane - 9, gx, lane - 9, "grad", 10);
      label(px, gx, lane - 18, `f′(c) = ${fmt(df)} (uphill)`);
    }
    if (show(2)) {
      const stx = cx(c - eta.get() * df * grow(2));
      arrow(g, px, lane + 9, stx, lane + 9, "step", 11);
      label(px, stx, lane + 25, `step −η f′(c) = ${fmt(-eta.get() * df)}`);
    }
    let hx = px, hy = py;
    if (anim && ph > 3) {
      const t = clamp(ph - 3, 0, 1);
      hx = cx(anim.from + t * (anim.to - anim.from));
      hy = (1 - t) * py + t * cy(o.f(anim.to));
    }
    node("circle", { cx: hx, cy: hy, r: 8, class: "handle" }, g);
    const lx = clamp(hx + 14, P1.x0 + 4, P1.x1 - 120);
    text(g, lx, clamp(hy - 14, P1.y0 + 16, P1.y1 - 50),
      `f = ${fmt(f)}`, { class: "tip-label" });

    node("rect", { x: P1.x0, y: P1.y0, width: P1.x1 - P1.x0,
      height: P1.y1 - P1.y0, class: "frame" }, svg);
    text(svg, (P1.x0 + P1.x1) / 2, P1.y1 + 40, "c",
      { class: "axis-label sym", "text-anchor": "middle" });
    text(svg, 18, (P1.y0 + P1.y1) / 2, "f(c)", { class: "axis-label sym",
      "text-anchor": "middle",
      transform: `rotate(-90 18 ${(P1.y0 + P1.y1) / 2})` });
    edgeMarker1(svg, c, f);
  }

  /** Arrowhead on the frame pointing toward an off-plot iterate. */
  function edgeMarker1(svg, c, f) {
    const d = d1();
    const out = c < d.x[0] || c > d.x[1] || f > d.y[1];
    if (!out || !Number.isFinite(c)) return;
    const x = clamp(sx(c), P1.x0 + 14, P1.x1 - 14);
    if (c < d.x[0] || c > d.x[1]) {
      const dir = c < d.x[0] ? -1 : 1, ex = dir < 0 ? P1.x0 : P1.x1;
      const y = clamp(sy(f), P1.y0 + 14, P1.y1 - 14);
      arrow(svg, ex - dir * 26, y, ex, y, "offplot", 13);
    } else {
      arrow(svg, x, P1.y0 + 26, x, P1.y0, "offplot", 13);
    }
  }

  // ------------------------------------------------------- render

  function readout() {
    const r = runner(), c = r.c, rows = [];
    if (S.dim === 1) {
      rows.push(["<i>c</i>", fmt(c[0])],
        ["<i>f</i>(<i>c</i>)", fmt(obj1.f(c[0]))],
        ["<i>f</i>′(<i>c</i>)", fmt(obj1.df(c[0]))]);
      if (S.fn === "parabola") {
        rows.push(["one-step <i>η</i> = 1/(2<i>a</i>)", fmt(1 / (2 * S.a))]);
      }
    } else {
      const g = q2.grad(c);
      rows.push([`<b>c</b> = ${colVec(["<i>c</i>₀", "<i>c</i>₁"])}`,
        fmtCol(c)],
        ["<i>f</i>(<b>c</b>)", fmt(q2.f(c))],
        ["∇<i>f</i>(<b>c</b>)", fmtCol(g)],
        ["‖∇<i>f</i>(<b>c</b>)‖", fmt(Math.hypot(...g))],
        ["condition number <i>κ</i>", fmt(S.kappa)]);
    }
    $("st-readout").innerHTML = rows.map(([k, v]) =>
      `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`
    ).join("") + `<p class="status ${r.status}">${r.describe()}</p>`;
  }

  function syncControls() {
    const pick = (sel, ok) => {
      for (const b of document.querySelectorAll(sel)) {
        b.setAttribute("aria-checked", ok(b));
      }
    };
    pick("[data-st-dim]", b => +b.dataset.stDim === S.dim);
    pick("[data-st-fn]", b => b.dataset.stFn === S.fn);
    pick("[data-st-view]", b => b.dataset.stView === S.view);
    pick("[data-st-log]", b => (b.dataset.stLog === "1") === S.log);
    pick("[data-preset]", b => {
      const p = PRESETS[b.dataset.preset];
      return p.kappa === S.kappa && p.theta === S.theta;
    });
    for (const el of document.querySelectorAll("[data-dim]")) {
      el.hidden = +el.dataset.dim !== S.dim;
    }
    $("st-a-row").hidden = S.dim !== 1 || S.fn !== "parabola";
    $("st-viewseg").hidden = S.dim !== 2;
    // SVG elements have no hidden property; set the attribute.
    svg1.toggleAttribute("hidden", S.dim !== 1);
    $("st-2d").toggleAttribute("hidden", S.dim !== 2);
    $("st-title").innerHTML = S.dim === 1 ? "<i>f</i>(<i>c</i>)"
      : "<i>f</i>(<i>c</i>₀, <i>c</i>₁)";
    $("st-a").value = Math.log2(S.a);
    $("st-aval").innerHTML = `<i>a</i> = ${fmt(S.a)}`;
    $("st-kappa").value = Math.log10(S.kappa);
    $("st-kappaval").innerHTML = `<i>κ</i> = ${fmt(S.kappa)}`;
    $("st-theta").value = S.theta;
    $("st-thetaval").textContent = `${S.theta}°`;
    const L = curvature(), e = eta.get();
    // Two valleys: the curvature varies along the curve, so no zones.
    $("st-etaval").innerHTML = `<i>η</i> = ${fmt(e)} <span class="muted">`
      + (L === null ? "(curvature varies: no single safe <i>η</i>)"
        : `(<i>η</i>·<i>L</i> = ${fmt(e * L)})`) + "</span>";
    $("st-zones").hidden = L === null;
    if (L !== null) drawZones($("st-zones"), eta, L);
    $("st-anim").checked = S.anim;
    const r = runner();
    $("st-run").innerHTML = stopRun ? "❚❚ Pause" : "&#9654; Run";
    $("st-run").disabled = !stopRun && !!r.status;
    $("st-step").disabled = !!r.status;
    $("st-hint").textContent = S.dim === 1
      ? "Click or drag to choose the start c."
      : S.view === "3d"
        ? "Drag to orbit, scroll to zoom. Drag the point c on the floor to "
          + "move it; hold Shift to change only one parameter."
        : "Drag the point c, or click anywhere, to choose c. Hold Shift "
          + "to change only one parameter.";
  }

  function render() {
    const r = runner();
    if (S.dim === 1) draw1d();
    else {
      view.render(q2, { c: r.c, trail: r.trail, eta: eta.get(),
        mode: S.view });
    }
    const fmin = S.dim === 1 ? obj1.fmin : 0;
    drawLossChart(chart, r.losses, fmin, S.log, "f");
    readout();
    syncControls();
  }

  // -------------------------------------------------------- pointer

  let drag = false;
  function drag1(e) {
    const p = svgPoint(svg1, e), d = d1().x;
    run1.reset([clamp(ix(p.x), d[0], d[1])]);
    render();
  }
  svg1.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    stop();
    drag = true;
    svg1.setPointerCapture(e.pointerId);
    e.preventDefault();
    drag1(e);
  });
  svg1.addEventListener("pointermove", e => { if (drag) drag1(e); });
  svg1.addEventListener("pointerup", () => { drag = false; });
  svg1.addEventListener("pointercancel", () => { drag = false; });

  // ------------------------------------------------------- controls

  const presets = $("st-presets");
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.dataset.preset = key;
    b.setAttribute("role", "radio");
    b.textContent = p.label;
    b.onclick = () => { S.kappa = p.kappa; S.theta = p.theta; reshape(); };
    presets.appendChild(b);
  }
  for (const b of document.querySelectorAll("[data-st-dim]")) {
    b.onclick = () => {
      stop();
      S.eta[S.dim] = eta.get();
      S.dim = +b.dataset.stDim;
      eta.set(S.eta[S.dim]);
      render();
    };
  }
  for (const b of document.querySelectorAll("[data-st-fn]")) {
    b.onclick = () => {
      stop();
      S.fn = b.dataset.stFn;
      run1 = new Runner(make1(), [d1().start], 6);
      render();
    };
  }
  for (const b of document.querySelectorAll("[data-st-view]")) {
    b.onclick = () => { S.view = b.dataset.stView; render(); };
  }
  for (const b of document.querySelectorAll("[data-st-log]")) {
    b.onclick = () => { S.log = b.dataset.stLog === "1"; render(); };
  }
  $("st-a").oninput = e => { S.a = +(2 ** +e.target.value).toFixed(3);
    reshape(); };
  $("st-kappa").oninput = e => {
    S.kappa = +(10 ** +e.target.value).toPrecision(3);
    reshape();
  };
  $("st-theta").oninput = e => { S.theta = +e.target.value; reshape(); };
  etaInput.oninput = render;
  $("st-step").onclick = step;
  $("st-run").onclick = toggleRun;
  $("st-restart").onclick = () => {
    stop();
    const r = runner();
    r.reset(r.trail[0]);
    render();
  };
  $("st-anim").onchange = e => { S.anim = e.target.checked; render(); };

  run1 = new Runner(make1(), [d1().start], 6);
  run2 = new Runner(make2(), START2, view.scale);
  eta.set(S.eta[1]);

  return { step, toggleRun, stop, render };
})();
