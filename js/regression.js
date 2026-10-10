// Regression tab: the MSE surface over (c0, c1) on the left, the samples
// and the line yhat = c0 + c1 u on the right, linked both ways.
//
// u is x as the model sees it: raw, centered (x - mean) or standardized
// ((x - mean) / sd). The scatter always shows raw x; changing the scaling
// keeps the same line and re-expresses it in the new c, so the surface
// reshapes under a line that does not move.

const RegTab = (function () {
  const SC = { w: 560, h: 560, x0: 62, x1: 546, y0: 14, y1: 498 };
  const ETA_LO = 1e-4, ETA_HI = 2;

  const S = { kappa: 1.3, offset: 0, seed: 1, scale: "raw",
    view: "contour", log: true };
  // data: raw samples. m, s: the scaling, u = (x - m) / s. q: MSE as a
  // Quadratic in c. dom: scatter domain. hx: x of the two line handles.
  let data, m = 0, s = 1, q, runner, dom, hx, stopRun = null;

  const $ = id => document.getElementById(id);
  const scatter = $("reg-scatter");
  const chart = $("reg-chart");
  const etaInput = $("reg-eta");
  const eta = etaSlider(etaInput, ETA_LO, ETA_HI);
  const view = new ParamView($("reg-surf"), {
    labels: ["c₀ (intercept)", "c₁ (slope)"], fname: "MSE",
    onSet: (c, done) => setC(c, done),
    onHover: () => render(),
  });
  scatter.setAttribute("viewBox", `0 0 ${SC.w} ${SC.h}`);

  // ---------------------------------------------------------- model

  function mean(a) { return a.reduce((t, v) => t + v, 0) / a.length; }
  function u() { return data.x.map(x => (x - m) / s); }
  function setScaling() {
    m = S.scale === "raw" ? 0 : mean(data.x);
    const sd = Math.sqrt(mean(data.x.map(x => (x - mean(data.x)) ** 2)));
    s = S.scale === "std" ? Math.max(sd, 1e-9) : 1;
  }
  /** The line in raw x as intercept A and slope B. */
  function raw(c) { return { A: c[0] - c[1] * m / s, B: c[1] / s }; }
  function fromRaw(A, B) { return [A + B * m, B * s]; }
  function yhat(c, x) { return c[0] + c[1] * (x - m) / s; }
  /** Excess level the surface view frames around the minimum. */
  function frameLevel() {
    const my = mean(data.y);
    return Math.max(mean(data.y.map(y => (y - my) ** 2)), 1e-6);
  }
  function quantile(a, p) {
    const b = a.slice().sort((x, y) => x - y);
    return b[Math.round(p * (b.length - 1))];
  }

  function regen(resetEta) {
    stop();
    data = makeRegData(S.kappa, S.offset, S.seed);
    setScaling();
    q = mseQuadratic(u(), data.y);
    const delta = frameLevel(), start = q.startAt(0.6 * delta);
    view.fit(q, delta, [start]);
    runner = new Runner(q, start, view.scale);
    if (resetEta) eta.set(0.8 / q.L);
    fitScatter();
    render();
  }

  function fitScatter() {
    const pad = (lo, hi, f) => [lo - f * (hi - lo), hi + f * (hi - lo)];
    const xs = data.x, ys = data.y;
    dom = { x: pad(Math.min(...xs), Math.max(...xs), 0.08),
      y: pad(Math.min(...ys), Math.max(...ys), 0.15) };
    hx = [quantile(xs, 0.25), quantile(xs, 0.75)];
  }

  /** Re-express the current line in a new scaling and refit the view. */
  function rescale(mode) {
    stop();
    const { A, B } = raw(runner.c);
    S.scale = mode;
    setScaling();
    q = mseQuadratic(u(), data.y);
    const c = fromRaw(A, B);
    view.fit(q, frameLevel(), [c]);
    runner = new Runner(q, c, view.scale);
    render();
  }

  function setC(c, done) {
    stop();
    runner.reset(c);
    render();
  }

  function stop() {
    if (stopRun) { stopRun(); stopRun = null; }
  }

  function step() {
    stop();
    runner.step(eta.get());
    render();
  }

  function toggleRun() {
    if (stopRun) { stop(); render(); return; }
    if (runner.status) return;
    stopRun = runLoop(runner, eta.get, render, () => {
      stopRun = null;
      render();
    });
    render();
  }

  // --------------------------------------------------------- drawing

  function sx(v) {
    return SC.x0 + (v - dom.x[0]) / (dom.x[1] - dom.x[0]) * (SC.x1 - SC.x0);
  }
  function sy(v) {
    return SC.y1 - (v - dom.y[0]) / (dom.y[1] - dom.y[0]) * (SC.y1 - SC.y0);
  }
  function ix(px) {
    return dom.x[0] + (px - SC.x0) / (SC.x1 - SC.x0) * (dom.x[1] - dom.x[0]);
  }
  function iy(py) {
    return dom.y[0] + (SC.y1 - py) / (SC.y1 - SC.y0) * (dom.y[1] - dom.y[0]);
  }

  /**
   * The iterate the pointer is hovering on the surface, once the walk has
   * taken a step; null otherwise.
   */
  function hovered() {
    const h = view.hover, n = runner.trail.length;
    return h !== null && n > 1 && h < n ? h : null;
  }

  function lineEl(g, c, cls) {
    node("line", { x1: sx(dom.x[0]), y1: sy(yhat(c, dom.x[0])),
      x2: sx(dom.x[1]), y2: sy(yhat(c, dom.x[1])), class: cls }, g);
  }

  function drawScatter() {
    const svg = scatter, h = hovered();
    const c = h === null ? runner.c : runner.trail[h];
    svg.innerHTML = "";
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: "reg-sc-clip" }, defs);
    node("rect", { x: SC.x0, y: SC.y0, width: SC.x1 - SC.x0,
      height: SC.y1 - SC.y0 }, clip);
    for (const t of ticks(...dom.x, 6)) {
      node("line", { x1: sx(t), x2: sx(t), y1: SC.y0, y2: SC.y1,
        class: "grid" }, svg);
      text(svg, sx(t), SC.y1 + 17, fmt(t),
        { class: "tick", "text-anchor": "middle" });
    }
    for (const t of ticks(...dom.y, 6)) {
      node("line", { x1: SC.x0, x2: SC.x1, y1: sy(t), y2: sy(t),
        class: "grid" }, svg);
      text(svg, SC.x0 - 6, sy(t) + 4, fmt(t),
        { class: "tick", "text-anchor": "end" });
    }
    const g = node("g", { "clip-path": "url(#reg-sc-clip)" }, svg);
    node("rect", { x: SC.x0, y: SC.y0, width: SC.x1 - SC.x0,
      height: SC.y1 - SC.y0, class: "sc-bg" }, g);
    for (let i = 0; i < data.x.length; i++) {
      const x = sx(data.x[i]);
      node("line", { x1: x, x2: x, y1: sy(data.y[i]),
        y2: sy(yhat(c, data.x[i])), class: "resid" }, g);
    }
    lineEl(g, q.cstar, "minline");
    lineEl(g, c, "fit");
    data.x.forEach((x, i) => node("circle", { cx: sx(x), cy: sy(data.y[i]),
      r: 6, class: "s", "data-i": i }, g));
    if (h === null) {
      hx.forEach((x, k) => {
        const y = yhat(c, x);
        if (y < dom.y[0] || y > dom.y[1]) return;
        node("rect", { x: sx(x) - 7, y: sy(y) - 7, width: 14, height: 14,
          class: "lh", "data-h": k }, g);
      });
    }
    legend(svg, h);
    node("rect", { x: SC.x0, y: SC.y0, width: SC.x1 - SC.x0,
      height: SC.y1 - SC.y0, class: "frame" }, svg);
    text(svg, (SC.x0 + SC.x1) / 2, SC.y1 + 40, "x",
      { class: "axis-label sym", "text-anchor": "middle" });
    text(svg, 16, (SC.y0 + SC.y1) / 2, "y", { class: "axis-label sym",
      "text-anchor": "middle" });
  }

  /** Key in the empty top-left corner (the data always slope upward). */
  function legend(svg, h) {
    const x = SC.x0 + 10, y = SC.y0 + 10;
    const g = node("g", { class: "legend" }, svg);
    node("rect", { x, y, width: 222, height: 88, rx: 6 }, g);
    const rows = [["fit", h === null ? "current line ŷ" : `line at step ${h}`],
      ["minline", "best line (min MSE)"], ["resid", "error rᵢ = yᵢ − ŷᵢ"]];
    rows.forEach(([cls, label], i) => {
      const ry = y + 19 + 25 * i;
      if (cls === "resid") {
        node("line", { x1: x + 22, x2: x + 22, y1: ry - 8, y2: ry + 8,
          class: cls }, g);
      } else {
        node("line", { x1: x + 10, x2: x + 34, y1: ry, y2: ry, class: cls },
          g);
      }
      text(g, x + 44, ry + 5, label, { class: "legend-label" });
    });
  }

  function equation() {
    const h = hovered(), sign = v => v < 0 ? "−" : "+";
    const c = h === null ? runner.c : runner.trail[h];
    let xs = "<i>x</i>";
    if (S.scale !== "raw") {
      xs = `(<i>x</i> ${sign(-m)} ${fmt(Math.abs(m))})`;
      if (S.scale === "std") xs += ` / ${fmt(s)}`;
    }
    const model = `<i>c</i>₀ + <i>c</i>₁${S.scale === "raw" ? "" : " "}${xs}`;
    $("reg-eq").innerHTML = (h === null ? "" : `step ${h}: `)
      + `<i>ŷ</i> = ${model} = ${fmt(c[0])} `
      + `${sign(c[1])} ${fmt(Math.abs(c[1]))} ${xs}`;
  }

  function readout() {
    const h = hovered(), c = h === null ? runner.c : runner.trail[h];
    const g = q.grad(c);
    const rows = [
      [`<b>c</b> = ${colVec(["<i>c</i>₀", "<i>c</i>₁"])}`, fmtCol(c)],
      ["MSE(<b>c</b>)", fmt(q.f(c))],
      ["∇MSE(<b>c</b>)", fmtCol(g)],
      ["‖∇MSE(<b>c</b>)‖", fmt(Math.hypot(...g))],
    ];
    rows.push(["min MSE", fmt(q.fmin)], ["at <b>c</b>*", fmtCol(q.cstar)]);
    rows.push(["condition number <i>κ</i>", fmt(q.kappa)]);
    $("reg-readout").innerHTML = rows.map(([k, v]) =>
      `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`
    ).join("") + statusLine(runner, h);
  }

  function syncControls() {
    for (const b of document.querySelectorAll("[data-reg-scale]")) {
      b.setAttribute("aria-checked", b.dataset.regScale === S.scale);
    }
    for (const b of document.querySelectorAll("[data-reg-view]")) {
      b.setAttribute("aria-checked", b.dataset.regView === S.view);
    }
    for (const b of document.querySelectorAll("[data-reg-log]")) {
      b.setAttribute("aria-checked", (b.dataset.regLog === "1") === S.log);
    }
    $("reg-kappa").value = Math.log10(S.kappa);
    // Offset raises the raw-x condition number above the slider's value.
    const rawKappa = mseQuadratic(data.x, data.y).kappa;
    $("reg-kappaval").innerHTML = `<i>κ</i> = ${fmt(S.kappa)}`
      + (S.offset > 0 ? ` <span class="muted">→ ${fmt(rawKappa)} with `
        + "offset (raw <i>x</i>)</span>" : "");
    $("reg-offset").value = S.offset;
    $("reg-offsetval").innerHTML = `mean <i>x</i> = ${fmt(S.offset)}`;
    const e = eta.get();
    $("reg-etaval").innerHTML = `<i>η</i> = ${fmt(e)} <span `
      + `class="muted">(<i>η</i>·<i>L</i> = ${fmt(e * q.L)})</span>`;
    drawZones($("reg-zones"), eta, q.L);
    $("reg-run").innerHTML = stopRun ? "❚❚ Pause" : "&#9654; Run";
    $("reg-run").disabled = !stopRun && !!runner.status;
    $("reg-step").disabled = !!runner.status;
    $("reg-surf-hint").textContent = S.view === "3d"
      ? "Drag to orbit, scroll to zoom. Drag the point c on the floor to "
        + "move it (hold Shift to change only one parameter); the "
        + "dropline is its MSE."
      : "Drag the point c, or click anywhere, to choose c. Hold Shift to "
        + "change only one parameter. After a step, hover the trail to see "
        + "that step's line.";
  }

  function render() {
    view.render(q, { c: runner.c, trail: runner.trail, eta: eta.get(),
      mode: S.view });
    drawScatter();
    drawLossChart(chart, runner.losses, q.fmin, S.log, "MSE", hovered());
    equation();
    readout();
    syncControls();
  }

  // -------------------------------------------------------- scatter drag

  let drag = null;
  scatter.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const p = svgPoint(scatter, e), t = e.target;
    if (p.x < SC.x0 || p.x > SC.x1 || p.y < SC.y0 || p.y > SC.y1) return;
    stop();
    if (t.classList.contains("s")) drag = { i: +t.dataset.i };
    else if (t.classList.contains("lh")) drag = { h: +t.dataset.h };
    else drag = { shift: iy(p.y) };
    scatter.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  scatter.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = svgPoint(scatter, e);
    const x = clamp(ix(p.x), ...dom.x), y = clamp(iy(p.y), ...dom.y);
    if (drag.i !== undefined) {
      data.x[drag.i] = x;
      data.y[drag.i] = y;
      q = mseQuadratic(u(), data.y);
      runner.setObjective(q);
    } else if (drag.h !== undefined) {
      // Pivot about the other handle, which stays on the current line.
      const xa = hx[drag.h], xb = hx[1 - drag.h];
      const yb = yhat(runner.c, xb), B = (yb - y) / (xb - xa);
      runner.reset(fromRaw(y - B * xa, B));
    } else {
      const c = runner.c;
      runner.reset([c[0] + y - drag.shift, c[1]]);
      drag.shift = y;
    }
    render();
  });
  function endDrag() {
    if (drag && drag.i !== undefined && S.scale !== "raw") {
      // The mean and sd moved with the sample: re-express, same line.
      const { A, B } = raw(runner.c);
      setScaling();
      q = mseQuadratic(u(), data.y);
      runner.setObjective(q);
      runner.reset(fromRaw(A, B));
    }
    if (drag && drag.i !== undefined) {
      hx = [quantile(data.x, 0.25), quantile(data.x, 0.75)];
    }
    drag = null;
    render();
  }
  scatter.addEventListener("pointerup", endDrag);
  scatter.addEventListener("pointercancel", endDrag);

  // ------------------------------------------------------------ controls

  for (const b of document.querySelectorAll("[data-reg-scale]")) {
    b.onclick = () => {
      if (b.dataset.regScale !== S.scale) rescale(b.dataset.regScale);
    };
  }
  for (const b of document.querySelectorAll("[data-reg-view]")) {
    b.onclick = () => { S.view = b.dataset.regView; render(); };
  }
  for (const b of document.querySelectorAll("[data-reg-log]")) {
    b.onclick = () => { S.log = b.dataset.regLog === "1"; render(); };
  }
  $("reg-kappa").oninput = e => {
    S.kappa = +(10 ** +e.target.value).toPrecision(2);
    regen(false);
  };
  $("reg-offset").oninput = e => { S.offset = +e.target.value; regen(false); };
  etaInput.oninput = render;
  $("reg-step").onclick = step;
  $("reg-run").onclick = toggleRun;
  $("reg-restart").onclick = () => setC(runner.trail[0]);
  $("reg-resample").onclick = () => { S.seed += 1; regen(false); };
  $("reg-reset").onclick = () => regen(false);

  regen(true);

  return { step, toggleRun, stop, render };
})();
