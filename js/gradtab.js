// Gradient tab: the gradient rules of day 10, each drawn as a contour map
// (or a 3D surface) with its gradient field.
//
// Rules follow the lecture's reference table: sum, linear (a'w), quadratic
// (w'Aw), chain (g(a'w)), and the special cases ||w||^2 and ||Xw - y||^2.
// Each rule's card plugs the probe's w into the rule's formula, so the
// arithmetic behind the arrow is on screen.

const GradTab = (function () {
  const $ = id => document.getElementById(id);
  const dot = (a, w) => a[0] * w[0] + a[1] * w[1];
  const sig = z => 1 / (1 + Math.exp(-z));
  const B = s => `<b>${s}</b>`;
  const W = colVec(["<i>w</i>₀", "<i>w</i>₁"]);

  // Small regression data for ||Xw - y||^2: rows [1, x_i], so w0 is the
  // intercept and w1 the slope, as on the regression tab.
  const XS = [0, 1, 2, 3], YS = [1, 1.5, 3, 3.5];
  const X = XS.map(x => [1, x]);
  function resid(w) { return X.map((r, i) => dot(r, w) - YS[i]); }
  function lsq(w) { return resid(w).reduce((t, r) => t + r * r, 0); }
  function lsqGrad(w) {
    const r = resid(w);
    return [0, 1].map(k => 2 * X.reduce((t, row, i) => t + row[k] * r[i], 0));
  }

  const G = {
    exp: { label: "eᶻ", g: Math.exp, dg: Math.exp, dgHTML: "<i>e<sup>z</sup></i>" },
    sigma: { label: "σ(z)", g: sig, dg: z => sig(z) * (1 - sig(z)),
      dgHTML: "σ(<i>z</i>)(1 − σ(<i>z</i>))" },
    logistic: { label: "log(1 + e⁻ᶻ)", g: z => Math.log1p(Math.exp(-z)),
      dg: z => sig(z) - 1,
      dgHTML: "−<i>e</i><sup>−<i>z</i></sup> / (1 + <i>e</i><sup>−<i>z</i></sup>)" },
    square: { label: "z²", g: z => z * z, dg: z => 2 * z,
      dgHTML: "2<i>z</i>" },
  };

  // Rule parameters, shared across rules where they mean the same thing.
  const P = { a: [1, 0.5], A: [[1, 0.5], [0.5, 2]], g: "sigma", c: 1,
    lam: 2 };
  const sym = () => P.A[0][1] === P.A[1][0];
  const AAt = () => [[2 * P.A[0][0], P.A[0][1] + P.A[1][0]],
    [P.A[0][1] + P.A[1][0], 2 * P.A[1][1]]];
  const mv = (M, w) => [dot(M[0], w), dot(M[1], w)];
  const eq = (...parts) => `<div class="step">${parts.join(" = ")}</div>`;
  const note = s => `<p class="muted">${s}</p>`;

  /**
   * Rules. Each has f, grad, a domain (mid, hw) and start, the parameter
   * controls it shows, its formula, and explain(w): the rule with w
   * plugged in. extras(w) adds arrows (the parts of a sum).
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
      label: "Chain g(aᵀw)", params: ["g", "a"], mid: [0, 0], hw: 3,
      start: [1, -1],
      fHTML: () => `<i>f</i>(${B("w")}) = <i>g</i>(${B("a")}ᵀ${B("w")}),
        <i>g</i>(<i>z</i>) = ${G[P.g].label.replace(/z/g, "<i>z</i>")}`,
      f: w => G[P.g].g(dot(P.a, w)),
      grad: w => P.a.map(v => G[P.g].dg(dot(P.a, w)) * v),
      explain: w => {
        const z = dot(P.a, w), d = G[P.g].dg(z);
        return eq(`<i>z</i> = ${B("a")}ᵀ${B("w")}`, fmt(z))
          + eq(`<i>g</i>′(<i>z</i>)`, G[P.g].dgHTML, fmt(d))
          + eq(`∇<i>f</i>(${B("w")})`, `<i>g</i>′(${B("a")}ᵀ${B("w")}) ${B("a")}`,
            `${fmt(d)} ${fmtCol(P.a)}`, fmtCol(P.a.map(v => d * v)))
          + note("<i>f</i> depends on <b>w</b> only through <b>a</b>ᵀ<b>w</b>: "
            + "contours are lines across <b>a</b>, and every arrow is "
            + "parallel to <b>a</b>.");
      },
    },
    norm: {
      label: "‖w‖²", params: [], mid: [0, 0], hw: 3, start: [1.5, 1],
      fHTML: () => `<i>f</i>(${B("w")}) = ‖${B("w")}‖² = ${B("w")}ᵀ<i>I</i>${B("w")}`,
      f: w => dot(w, w), grad: w => w.map(v => 2 * v),
      explain: w => eq(`∇<i>f</i>(${B("w")})`, `2${B("w")}`,
        `2 ${fmtCol(w)}`, fmtCol(w.map(v => 2 * v)))
        + note("Rule 2 with <i>A</i> = <i>I</i>."),
    },
    lsq: {
      label: "‖Xw − y‖²", params: [], mid: [0.9, 0.9], hw: 2.5,
      start: [2, -0.5],
      fHTML: () => `<i>f</i>(${B("w")}) = ‖<i>X</i>${B("w")} − ${B("y")}‖²`,
      f: lsq, grad: lsqGrad,
      explain: w => `<div class="step"><i>X</i> = ${
        matHTML(X.map(r => r.map(v => fmt(v))))}, ${B("y")} = ${
        colVec(YS.map(v => fmt(v)))}</div>`
        + eq(`<i>X</i>${B("w")} − ${B("y")}`, colVec(resid(w).map(v => fmt(v))))
        + eq(`∇<i>f</i>(${B("w")})`, `2<i>X</i>ᵀ(<i>X</i>${B("w")} − ${B("y")})`,
          fmtCol(lsqGrad(w)))
        + note("Rules 1 and 2 on ‖<i>X</i><b>w</b> − <b>y</b>‖² = "
          + "<b>w</b>ᵀ<i>X</i>ᵀ<i>X</i><b>w</b> − 2<b>y</b>ᵀ<i>X</i><b>w</b> + "
          + "<b>y</b>ᵀ<b>y</b>. Rows of <i>X</i> are [1, <i>x</i>ᵢ], so "
          + "<i>w</i>₀ is the intercept and <i>w</i>₁ the slope."),
    },
    sum: {
      label: "Sum c·f + h", params: ["c", "lam"], mid: [0.6, 0.6], hw: 2.5,
      start: [-1, 2],
      fHTML: () => `<i>c</i>‖<i>X</i>${B("w")} − ${B("y")}‖² + `
        + `<i>λ</i>‖${B("w")}‖²`,
      f: w => P.c * lsq(w) + P.lam * dot(w, w),
      grad: w => lsqGrad(w).map((v, k) => P.c * v + 2 * P.lam * w[k]),
      extras: w => {
        const a = lsqGrad(w).map(v => P.c * v), b = w.map(v => 2 * P.lam * v);
        return [{ vec: a, cls: "part1" }, { vec: b, from: a, cls: "part2" }];
      },
      explain: w => {
        const a = lsqGrad(w).map(v => P.c * v), b = w.map(v => 2 * P.lam * v);
        return eq(`∇<i>f</i>(${B("w")})`,
          `<i>c</i> · 2<i>X</i>ᵀ(<i>X</i>${B("w")} − ${B("y")}) + <i>λ</i> · 2${B("w")}`)
          + `<div class="step">= <span class="k1">${fmtCol(a)}</span> + `
            + `<span class="k2">${fmtCol(b)}</span> = `
            + `${fmtCol(a.map((v, k) => v + b[k]))}</div>`
          + note("Sum rule: the gradients of the parts add, tip to tail "
            + "(<span class=\"k1\">blue</span> + <span class=\"k2\">purple</span> "
            + "= black). This is ridge regression; raising <i>λ</i> pulls the "
            + "minimum toward <b>w</b> = 0.");
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
    const pick = (sel, ok) => {
      for (const b of document.querySelectorAll(sel)) {
        b.setAttribute("aria-checked", ok(b));
      }
    };
    pick("[data-gr-rule]", b => b.dataset.grRule === S.rule);
    pick("[data-gr-g]", b => b.dataset.grG === P.g);
    pick("[data-gr-view]", b => b.dataset.grView === S.view);
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
    const r = RULES[S.rule];
    view.render(S.w, r.extras ? r.extras(S.w) : [], S.view);
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
  const gBox = $("gr-g");
  for (const [key, g] of Object.entries(G)) {
    const b = document.createElement("button");
    b.dataset.grG = key;
    b.setAttribute("role", "radio");
    b.textContent = g.label;
    b.onclick = () => { P.g = key; load(true); };
    gBox.appendChild(b);
  }
  // Parameter sliders: a (2), A (2 x 2), c, lambda. Values sit in labels.
  function slider(id, get, set, digits = 1) {
    const inp = $(id), out = $(`${id}-v`);
    const show = () => { out.textContent = get().toFixed(digits); };
    inp.value = get();
    show();
    inp.oninput = () => { set(+inp.value); show(); load(true); };
  }
  slider("gr-a0", () => P.a[0], v => { P.a[0] = v; });
  slider("gr-a1", () => P.a[1], v => { P.a[1] = v; });
  [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([i, j]) => slider(`gr-A${i}${j}`,
    () => P.A[i][j], v => { P.A[i][j] = v; }));
  slider("gr-c", () => P.c, v => { P.c = v; });
  slider("gr-lam", () => P.lam, v => { P.lam = v; });

  load(false);

  return { step() {}, toggleRun() {}, stop() {}, render };
})();
