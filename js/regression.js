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

  const S = { set: "centered", n: 30, noise: 0.6, seed: 1, scale: "raw",
    showGrad: false, showErr: true, showMin: false, zones: false,
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
    labels: ["c₀ (intercept)", "c₁ (slope)"], fname: "MSE", vector: true,
    onSet: (c, done) => setC(c, done),
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
    data = makeRegData(S.set, S.n, S.noise, S.seed);
    setScaling();
    q = mseQuadratic(u(), data.y);
    const delta = frameLevel(), start = q.startAt(0.6 * delta);
    view.fit(q, delta, [start, [0, 0]]);
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
    view.fit(q, frameLevel(), [c, [0, 0]]);
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

  function lineEl(g, c, cls) {
    node("line", { x1: sx(dom.x[0]), y1: sy(yhat(c, dom.x[0])),
      x2: sx(dom.x[1]), y2: sy(yhat(c, dom.x[1])), class: cls }, g);
  }

  function drawScatter() {
    const svg = scatter, c = runner.c;
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
    if (S.showErr) {
      for (let i = 0; i < data.x.length; i++) {
        const x = sx(data.x[i]);
        node("line", { x1: x, x2: x, y1: sy(data.y[i]),
          y2: sy(yhat(c, data.x[i])), class: "resid" }, g);
      }
    }
    if (S.showMin) lineEl(g, q.cstar, "minline");
    lineEl(g, c, "fit");
    data.x.forEach((x, i) => node("circle", { cx: sx(x), cy: sy(data.y[i]),
      r: 6, class: "s", "data-i": i }, g));
    hx.forEach((x, h) => {
      const y = yhat(c, x);
      if (y < dom.y[0] || y > dom.y[1]) return;
      node("rect", { x: sx(x) - 7, y: sy(y) - 7, width: 14, height: 14,
        class: "lh", "data-h": h }, g);
    });
    node("rect", { x: SC.x0, y: SC.y0, width: SC.x1 - SC.x0,
      height: SC.y1 - SC.y0, class: "frame" }, svg);
    text(svg, (SC.x0 + SC.x1) / 2, SC.y1 + 40, "x",
      { class: "axis-label sym", "text-anchor": "middle" });
    text(svg, 16, (SC.y0 + SC.y1) / 2, "y", { class: "axis-label sym",
      "text-anchor": "middle" });
  }

  function equation() {
    const c = runner.c, sign = v => v < 0 ? "−" : "+";
    let xs = "<i>x</i>";
    if (S.scale !== "raw") {
      xs = `(<i>x</i> ${sign(-m)} ${fmt(Math.abs(m))})`;
      if (S.scale === "std") xs += ` / ${fmt(s)}`;
    }
    $("reg-eq").innerHTML = `<i>ŷ</i> = ${fmt(c[0])} ${sign(c[1])} `
      + `${fmt(Math.abs(c[1]))} ${xs}`;
  }

  function readout() {
    const c = runner.c, g = q.grad(c);
    const rows = [
      ["<b>c</b> = (<i>c</i>₀, <i>c</i>₁)", fmtVec(c)],
      ["MSE(<b>c</b>)", fmt(q.f(c))],
      ["∇MSE(<b>c</b>)", fmtVec(g)],
    ];
    if (S.showMin) {
      rows.push(["min MSE, at", `${fmt(q.fmin)}, ${fmtVec(q.cstar)}`]);
    }
    rows.push(["condition number <i>κ</i>", fmt(q.kappa)]);
    $("reg-readout").innerHTML = rows.map(([k, v]) =>
      `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`
    ).join("") + `<p class="status ${runner.status}">${runner.describe()}</p>`;
  }

  function syncControls() {
    for (const b of document.querySelectorAll("[data-set-reg]")) {
      b.setAttribute("aria-checked", b.dataset.setReg === S.set);
    }
    for (const b of document.querySelectorAll("[data-reg-scale]")) {
      b.setAttribute("aria-checked", b.dataset.regScale === S.scale);
    }
    for (const b of document.querySelectorAll("[data-reg-view]")) {
      b.setAttribute("aria-checked", b.dataset.regView === S.view);
    }
    for (const b of document.querySelectorAll("[data-reg-log]")) {
      b.setAttribute("aria-checked", (b.dataset.regLog === "1") === S.log);
    }
    $("reg-n").value = S.n;
    $("reg-nval").textContent = String(data.x.length);
    $("reg-noise").value = S.noise;
    $("reg-noiseval").textContent = S.noise.toFixed(2);
    const e = eta.get();
    $("reg-etaval").innerHTML = `<i>η</i> = ${fmt(e)}`
      + (S.zones ? ` <span class="muted">(<i>η</i>·<i>L</i> = `
        + `${fmt(e * q.L)})</span>` : "");
    $("reg-zones").hidden = !S.zones;
    if (S.zones) drawZones($("reg-zones"), eta, q.L);
    $("reg-grad").checked = S.showGrad;
    $("reg-err").checked = S.showErr;
    $("reg-min").checked = S.showMin;
    $("reg-zon").checked = S.zones;
    $("reg-run").innerHTML = stopRun ? "❚❚ Pause" : "&#9654; Run";
    $("reg-run").disabled = !stopRun && !!runner.status;
    $("reg-step").disabled = !!runner.status;
    $("reg-surf-hint").textContent = S.view === "3d"
      ? "Drag to orbit, scroll to zoom. Drag the c tip on the floor to "
        + "move it; the dropline is its MSE."
      : "Drag the c tip, or click anywhere, to choose c. Bold: the "
        + "contour through c.";
  }

  function render() {
    view.render(q, { c: runner.c, trail: runner.trail, eta: eta.get(),
      showGrad: S.showGrad, showMin: S.showMin, mode: S.view });
    drawScatter();
    drawLossChart(chart, runner.losses, q.fmin, S.log, "MSE");
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

  const sets = $("reg-sets");
  for (const [key, set] of Object.entries(REG_SETS)) {
    const b = document.createElement("button");
    b.dataset.setReg = key;
    b.setAttribute("role", "radio");
    b.textContent = set.label;
    b.onclick = () => { S.set = key; S.scale = "raw"; regen(true); };
    sets.appendChild(b);
  }
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
  $("reg-n").oninput = e => { S.n = +e.target.value; regen(false); };
  $("reg-noise").oninput = e => { S.noise = +e.target.value; regen(false); };
  etaInput.oninput = render;
  $("reg-step").onclick = step;
  $("reg-run").onclick = toggleRun;
  $("reg-restart").onclick = () => setC(runner.trail[0]);
  $("reg-grad").onchange = e => { S.showGrad = e.target.checked; render(); };
  $("reg-err").onchange = e => { S.showErr = e.target.checked; render(); };
  $("reg-min").onchange = e => { S.showMin = e.target.checked; render(); };
  $("reg-zon").onchange = e => { S.zones = e.target.checked; render(); };
  $("reg-resample").onclick = () => { S.seed += 1; regen(false); };
  $("reg-reset").onclick = () => regen(false);

  regen(true);

  return { step, toggleRun, stop, render };
})();
