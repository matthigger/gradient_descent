// Gradient tab: the three gradient rules of day 10 (linear a'w, quadratic
// w'Aw, chain g(a'w) with g(z) = z^2), each drawn as a contour map (or a
// 3D surface) with its gradient field.
//
// Each rule's card plugs the probe's w into the rule's formula, so the
// arithmetic behind the arrow is on screen. The vector a and matrix A are
// typed into bracketed grids of number fields.

const GradTab = (function () {
  const $ = id => document.getElementById(id);
  const dot = (a, w) => a[0] * w[0] + a[1] * w[1];
  const B = s => `<b>${s}</b>`;
  const W = colVec(["<i>w</i>₀", "<i>w</i>₁"]);

  // Rule parameters: a is shared by the linear and chain rules.
  const P = { a: [1, 0.5], A: [[1, 0.5], [0.5, 2]] };
  const sym = () => P.A[0][1] === P.A[1][0];
  const AAt = () => [[2 * P.A[0][0], P.A[0][1] + P.A[1][0]],
    [P.A[0][1] + P.A[1][0], 2 * P.A[1][1]]];
  const mv = (M, w) => [dot(M[0], w), dot(M[1], w)];
  const eq = (...parts) => `<div class="step">${parts.join(" = ")}</div>`;
  const note = s => `<p class="muted">${s}</p>`;

  /**
   * Rules. Each has f, grad, a domain (mid, hw) and start, the parameter
   * editors it shows, its formula, and explain(w): the rule with w plugged
   * in.
   */
  const RULES = {
    linear: {
      label: "Linear aᵀw", params: ["a"], mid: [0, 0], hw: 3, start: [1, -1],
      fHTML: () => `<i>f</i>(${B("w")}) = ${B("a")}ᵀ${B("w")}`,
      f: w => dot(P.a, w), grad: () => P.a.slice(),
      explain: () => eq(`∇<i>f</i>(${B("w")})`, B("a"), fmtCol(P.a))
        + note("The same at every <b>w</b>: the field is uniform."),
    },
    quadratic: {
      label: "Quadratic wᵀAw", params: ["A"], mid: [0, 0], hw: 3,
      start: [1.5, -1],
      fHTML: () => `<i>f</i>(${B("w")}) = ${B("w")}ᵀ<i>A</i>${B("w")}`,
      f: w => dot(w, mv(P.A, w)), grad: w => mv(AAt(), w),
      explain: w => eq(`∇<i>f</i>(${B("w")})`,
        `(<i>A</i> + <i>A</i>ᵀ)${B("w")}`,
        matHTML(AAt().map(r => r.map(v => fmt(v)))) + fmtCol(w),
        fmtCol(mv(AAt(), w)))
        + note(sym() ? "<i>A</i> is symmetric, so this is 2<i>A</i><b>w</b>."
          : "<i>A</i> is not symmetric: only <i>A</i> + <i>A</i>ᵀ matters, "
            + "so changing <i>A</i>₀₁ and <i>A</i>₁₀ while keeping their sum "
            + "leaves <i>f</i> unchanged."),
    },
    chain: {
      label: "Chain g(aᵀw)", params: ["a"], mid: [0, 0], hw: 3,
      start: [1, -1],
      fHTML: () => `<i>f</i>(${B("w")}) = <i>g</i>(${B("a")}ᵀ${B("w")}) = `
        + `(${B("a")}ᵀ${B("w")})², &nbsp;<i>g</i>(<i>z</i>) = <i>z</i>²`,
      f: w => dot(P.a, w) ** 2,
      grad: w => P.a.map(v => 2 * dot(P.a, w) * v),
      explain: w => {
        const z = dot(P.a, w), d = 2 * z;
        return eq(`<i>z</i> = ${B("a")}ᵀ${B("w")}`, fmt(z))
          + eq(`<i>g</i>′(<i>z</i>)`, "2<i>z</i>", fmt(d))
          + eq(`∇<i>f</i>(${B("w")})`, `<i>g</i>′(${B("a")}ᵀ${B("w")}) ${B("a")}`,
            `${fmt(d)} ${fmtCol(P.a)}`, fmtCol(P.a.map(v => d * v)))
          + note("<i>f</i> depends on <b>w</b> only through <b>a</b>ᵀ<b>w</b>: "
            + "contours are lines across <b>a</b>, and every arrow is "
            + "parallel to <b>a</b>.");
      },
    },
  };

  const S = { rule: "linear", view: "contour", w: RULES.linear.start.slice() };

  const view = new FieldView($("gr-plot"), w => { S.w = w; render(); });

  function load(keepW) {
    const r = RULES[S.rule];
    view.setFunction(r, r.mid, r.hw);
    if (!keepW) S.w = r.start.slice();
    render();
  }

  // -------------------------------------------------------- drawing

  function info() {
    const r = RULES[S.rule];
    $("gr-info").innerHTML = `<h3>${r.label}</h3><div class="fdef">${
      r.fHTML()}</div><div class="steps">${r.explain(S.w)}</div>`;
  }

  function readout() {
    const r = RULES[S.rule], w = S.w, g = r.grad(w), rows = [
      [`${B("w")} = ${W}`, fmtCol(w)],
      [`<i>f</i>(${B("w")})`, fmt(r.f(w))],
      [`∇<i>f</i>(${B("w")})`, fmtCol(g)],
      [`‖∇<i>f</i>(${B("w")})‖`, fmt(Math.hypot(...g))],
    ];
    $("gr-readout").innerHTML = rows.map(([k, v]) =>
      `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`
    ).join("");
  }

  function syncControls() {
    for (const b of document.querySelectorAll("[data-gr-rule]")) {
      b.setAttribute("aria-checked", b.dataset.grRule === S.rule);
    }
    for (const b of document.querySelectorAll("[data-gr-view]")) {
      b.setAttribute("aria-checked", b.dataset.grView === S.view);
    }
    const params = RULES[S.rule].params;
    for (const el of document.querySelectorAll("[data-gr-param]")) {
      el.hidden = !params.includes(el.dataset.grParam);
    }
    for (const tr of document.querySelectorAll("tr[data-rule]")) {
      tr.classList.toggle("on", tr.dataset.rule === S.rule);
    }
    $("gr-title").innerHTML = RULES[S.rule].fHTML();
    $("gr-hint").innerHTML = S.view === "3d"
      ? "Drag to orbit, scroll to zoom. Drag the point <b>w</b> on the "
        + "floor; the dropline is <i>f</i>(<b>w</b>). Arrows lie on the "
        + "floor: &nabla;<i>f</i> lives in <b>w</b>-space."
      : "Drag the point <b>w</b>, or click anywhere. Black arrow: "
        + "&nabla;<i>f</i>(<b>w</b>). Gray arrows: &nabla;<i>f</i> across the "
        + "plot, at one shared (smaller) scale.";
  }

  function render() {
    view.render(S.w, S.view);
    info();
    readout();
    syncControls();
  }

  // ------------------------------------------------------- controls

  const ruleBox = $("gr-rules");
  for (const [key, r] of Object.entries(RULES)) {
    const b = document.createElement("button");
    b.dataset.grRule = key;
    b.setAttribute("role", "radio");
    b.textContent = r.label;
    b.onclick = () => selectRule(key);
    ruleBox.appendChild(b);
  }
  function selectRule(key) {
    S.rule = key;
    load(false);
  }
  for (const tr of document.querySelectorAll("tr[data-rule]")) {
    tr.onclick = () => selectRule(tr.dataset.rule);
  }
  for (const b of document.querySelectorAll("[data-gr-view]")) {
    b.onclick = () => { S.view = b.dataset.grView; render(); };
  }

  /**
   * Fill a bracketed grid (cols columns) with number fields bound to the
   * given entries: type a value, or step it by 0.5 with the arrow keys or
   * spinner.
   *
   * Args:
   *   el (HTMLElement): the grid
   *   cols (number): columns
   *   entries (Array): [get, set] per field, row-major
   */
  function entryGrid(el, cols, entries) {
    el.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    for (const [get, set] of entries) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.5";
      inp.value = get();
      inp.oninput = () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v)) { set(v); load(true); }
      };
      el.appendChild(inp);
    }
  }
  entryGrid($("gr-a"), 1, [0, 1].map(i =>
    [() => P.a[i], v => { P.a[i] = v; }]));
  entryGrid($("gr-A"), 2, [[0, 0], [0, 1], [1, 0], [1, 1]].map(([i, j]) =>
    [() => P.A[i][j], v => { P.A[i][j] = v; }]));

  load(false);

  return { step() {}, toggleRun() {}, stop() {}, render };
})();
