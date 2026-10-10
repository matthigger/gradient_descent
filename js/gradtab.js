// Gradient tab: the gradient rules of day 10, each drawn as a contour map
// with its gradient field, and exercises where students type the gradient
// they computed and see it checked against the true one.
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
  const esc = s => s.replace(/[&<>"]/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

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

  /**
   * Exercises: students type each partial; checked on a grid of points.
   * points: quick-jump positions (the in-class activity's).
   */
  const EX = [
    { label: "1. Activity", fHTML: "<i>f</i>(<b>w</b>) = (<i>w</i>₀ − 2)² + 3(<i>w</i>₁ − 1)²",
      f: w => (w[0] - 2) ** 2 + 3 * (w[1] - 1) ** 2,
      grad: w => [2 * (w[0] - 2), 6 * (w[1] - 1)],
      mid: [1.5, 0.5], hw: 3, start: [0, 0], points: [[0, 0], [2, 0], [3, 1]],
      hint: "Each term depends on one input: take each partial with the 1-D "
        + "power and chain rules, treating the other input as a constant.",
      answer: "∇<i>f</i>(<b>w</b>) = [2(<i>w</i>₀ − 2), 6(<i>w</i>₁ − 1)]ᵀ. At the "
        + "three points: [−4, −6]ᵀ, [0, −6]ᵀ, [2, 0]ᵀ. It vanishes at "
        + "<b>w</b> = [2, 1]ᵀ, the minimum." },
    { label: "2", fHTML: "<i>f</i>(<b>w</b>) = 3<i>w</i>₀ − 2<i>w</i>₁ + 5",
      f: w => 3 * w[0] - 2 * w[1] + 5, grad: () => [3, -2],
      mid: [0, 0], hw: 3, start: [1, 1],
      hint: "Rule 1 (linear) with <b>a</b> = [3, −2]ᵀ; a constant has zero "
        + "gradient.",
      answer: "∇<i>f</i>(<b>w</b>) = [3, −2]ᵀ, the same everywhere." },
    { label: "3", fHTML: "<i>f</i>(<b>w</b>) = <i>w</i>₀² + 4<i>w</i>₀<i>w</i>₁ + <i>w</i>₁²",
      f: w => w[0] ** 2 + 4 * w[0] * w[1] + w[1] ** 2,
      grad: w => [2 * w[0] + 4 * w[1], 4 * w[0] + 2 * w[1]],
      mid: [0, 0], hw: 3, start: [1.5, 0.5],
      hint: "Write it as <b>w</b>ᵀ<i>A</i><b>w</b> with a symmetric <i>A</i> "
        + "(split 4<i>w</i>₀<i>w</i>₁ evenly between <i>A</i>₀₁ and "
        + "<i>A</i>₁₀), then use rule 2. Or take the partials directly.",
      answer: "<i>A</i> = [[1, 2], [2, 1]], so ∇<i>f</i>(<b>w</b>) = 2<i>A</i><b>w</b> "
        + "= [2<i>w</i>₀ + 4<i>w</i>₁, 4<i>w</i>₀ + 2<i>w</i>₁]ᵀ. It is zero only at "
        + "<b>w</b> = 0, which is a saddle, not a minimum: <i>f</i> rises along "
        + "<i>w</i>₀ = <i>w</i>₁ and falls along <i>w</i>₀ = −<i>w</i>₁." },
    { label: "4", fHTML: "<i>f</i>(<b>w</b>) = <i>e</i><sup><i>w</i>₀ + 2<i>w</i>₁</sup>",
      f: w => Math.exp(w[0] + 2 * w[1]),
      grad: w => { const e = Math.exp(w[0] + 2 * w[1]); return [e, 2 * e]; },
      mid: [-1, -0.5], hw: 1.5, start: [-1, 0],
      hint: "Rule 3 (chain) with <i>g</i>(<i>z</i>) = <i>e<sup>z</sup></i> and "
        + "<b>a</b> = [1, 2]ᵀ.",
      answer: "∇<i>f</i>(<b>w</b>) = <i>e</i><sup><i>w</i>₀ + 2<i>w</i>₁</sup> "
        + "[1, 2]ᵀ: always parallel to <b>a</b>, growing with <i>f</i>." },
    { label: "5", fHTML: "<i>f</i>(<b>w</b>) = σ(2<i>w</i>₀ − <i>w</i>₁)",
      f: w => sig(2 * w[0] - w[1]),
      grad: w => { const s = sig(2 * w[0] - w[1]), d = s * (1 - s); return [2 * d, -d]; },
      mid: [0, 0], hw: 3, start: [0.5, 0.5],
      hint: "Rule 3 with <i>g</i> = σ and <b>a</b> = [2, −1]ᵀ; use "
        + "σ′ = σ(1 − σ) from the 1-D activity. Type σ as sigma(...).",
      answer: "With <i>z</i> = 2<i>w</i>₀ − <i>w</i>₁: ∇<i>f</i>(<b>w</b>) = "
        + "σ(<i>z</i>)(1 − σ(<i>z</i>)) [2, −1]ᵀ. It is largest where "
        + "<i>z</i> = 0 and fades to 0 where σ flattens out." },
    { label: "6", fHTML: "<i>f</i>(<b>w</b>) = (<i>w</i>₀ + <i>w</i>₁ − 3)² + 2‖<b>w</b>‖²",
      f: w => (w[0] + w[1] - 3) ** 2 + 2 * (w[0] ** 2 + w[1] ** 2),
      grad: w => [6 * w[0] + 2 * w[1] - 6, 2 * w[0] + 6 * w[1] - 6],
      mid: [0.5, 0.5], hw: 2.5, start: [2, -1],
      hint: "Sum rule. The first term is rule 3 with <b>a</b> = [1, 1]ᵀ and "
        + "<i>g</i>(<i>z</i>) = (<i>z</i> − 3)²; the second is 2 times "
        + "‖<b>w</b>‖².",
      answer: "∇<i>f</i>(<b>w</b>) = 2(<i>w</i>₀ + <i>w</i>₁ − 3)[1, 1]ᵀ + 4<b>w</b> "
        + "= [6<i>w</i>₀ + 2<i>w</i>₁ − 6, 2<i>w</i>₀ + 6<i>w</i>₁ − 6]ᵀ, zero at "
        + "<b>w</b> = [0.75, 0.75]ᵀ." },
  ];

  const S = { mode: "ex", rule: "linear", ex: 0, w: EX[0].start.slice(),
    answers: EX.map(() => ["", ""]), reveal: EX.map(() => false) };

  const view = new FieldView($("gr-plot"), w => { S.w = w; render(); });

  /** Current function: a rule or an exercise. */
  function cur() { return S.mode === "rules" ? RULES[S.rule] : EX[S.ex]; }

  function load(keepW) {
    const fn = cur();
    view.setFunction(fn, fn.mid, fn.hw);
    if (!keepW) S.w = fn.start.slice();
    render();
  }

  // ------------------------------------------------------- checking

  /** Compile the student's two partials; null entries where unparsed. */
  function student() {
    return S.answers[S.ex].map(src => {
      if (!src.trim()) return { fn: null, err: null };
      try {
        return { fn: compileExpr(src), err: null };
      } catch (e) {
        return { fn: null, err: e.message };
      }
    });
  }

  /**
   * Compare each typed partial with the true one on a 6 x 6 grid over the
   * view; report the first point where they differ.
   */
  function check(parts) {
    const ex = EX[S.ex], out = [];
    for (let k = 0; k < 2; k++) {
      const p = parts[k], name = `∂<i>f</i>/∂<i>w</i>${k ? "₁" : "₀"}`;
      if (p.err) {
        out.push(`<span class="bad">${name}: ${esc(p.err)}.</span>`);
        continue;
      }
      if (!p.fn) {
        out.push(`<span class="muted">${name}: not entered.</span>`);
        continue;
      }
      let bad = null;
      for (let j = 0; j < 6 && !bad; j++) {
        for (let i = 0; i < 6 && !bad; i++) {
          const w = [ex.mid[0] - ex.hw + 2 * ex.hw * (i + 0.5) / 6,
            ex.mid[1] - ex.hw + 2 * ex.hw * (j + 0.5) / 6];
          const t = ex.grad(w)[k], s = p.fn(w);
          if (!(Math.abs(s - t) <= 1e-6 + 1e-3 * Math.max(1, Math.abs(t)))) {
            bad = { w, s, t };
          }
        }
      }
      out.push(bad
        ? `<span class="bad">${name} is off: at <b>w</b> = [${bad.w.map(v => fmt(v)).join(", ")}]ᵀ
          yours gives ${fmt(bad.s)}, the true value is ${fmt(bad.t)}.</span>`
        : `<span class="good">${name} matches ✓</span>`);
    }
    return out.join("<br>");
  }

  // -------------------------------------------------------- drawing

  function info() {
    const el = $("gr-info"), w = S.w;
    if (S.mode === "rules") {
      const r = RULES[S.rule];
      el.innerHTML = `<h3>${r.label}</h3><div class="fdef">${r.fHTML()}</div>`
        + `<div class="steps">${r.explain(w)}</div>`;
      return;
    }
    const ex = EX[S.ex], parts = student();
    // Keep focus and caret in the inputs: build them once per exercise.
    if (el.dataset.ex !== String(S.ex) || el.dataset.mode !== "ex") {
      el.dataset.ex = S.ex;
      el.dataset.mode = "ex";
      el.innerHTML = `<h3>Exercise ${ex.label}</h3>
        <div class="fdef">${ex.fHTML}</div>
        <p class="muted">Compute ∇<i>f</i> by hand, then type each partial
          in <i>w0</i>, <i>w1</i> (e.g. <code>2*(w0 - 2)</code>, <code>exp(w0)</code>,
          <code>sigma(w1)</code>).</p>
        <label class="ans"><span>∂<i>f</i>/∂<i>w</i>₀ =</span>
          <input type="text" id="gr-ans0" spellcheck="false" autocomplete="off"></label>
        <label class="ans"><span>∂<i>f</i>/∂<i>w</i>₁ =</span>
          <input type="text" id="gr-ans1" spellcheck="false" autocomplete="off"></label>
        <p class="check" id="gr-check"></p>
        <details class="answer"><summary>Hint</summary>${ex.hint}</details>
        <details class="answer" id="gr-reveal"><summary>Reveal the
          answer</summary>${ex.answer}</details>`;
      [0, 1].forEach(k => {
        const inp = $(`gr-ans${k}`);
        inp.value = S.answers[S.ex][k];
        inp.oninput = () => { S.answers[S.ex][k] = inp.value; render(); };
      });
    }
    $("gr-check").innerHTML = check(parts);
  }

  function readout() {
    const fn = cur(), w = S.w, g = fn.grad(w), rows = [
      [`${B("w")} = ${W}`, fmtCol(w)],
      [`<i>f</i>(${B("w")})`, fmt(fn.f(w))],
      [`∇<i>f</i>(${B("w")})`, fmtCol(g)],
      [`‖∇<i>f</i>(${B("w")})‖`, fmt(Math.hypot(...g))],
    ];
    if (S.mode === "ex") {
      const parts = student();
      if (parts.every(p => p.fn)) {
        rows.push(["yours", fmtCol(parts.map(p => p.fn(w)))]);
      }
    }
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
    pick("[data-gr-mode]", b => b.dataset.grMode === S.mode);
    pick("[data-gr-rule]", b => S.mode === "rules" && b.dataset.grRule === S.rule);
    pick("[data-gr-ex]", b => S.mode === "ex" && +b.dataset.grEx === S.ex);
    pick("[data-gr-g]", b => b.dataset.grG === P.g);
    for (const el of document.querySelectorAll("[data-gr-show]")) {
      el.hidden = el.dataset.grShow !== S.mode;
    }
    const params = S.mode === "rules" ? RULES[S.rule].params : [];
    for (const el of document.querySelectorAll("[data-gr-param]")) {
      el.hidden = !params.includes(el.dataset.grParam);
    }
    for (const tr of document.querySelectorAll("tr[data-rule]")) {
      tr.classList.toggle("on", S.mode === "rules" && tr.dataset.rule === S.rule);
    }
    $("gr-points").hidden = S.mode !== "ex" || !EX[S.ex].points;
    $("gr-title").innerHTML = cur().fHTML instanceof Function
      ? cur().fHTML() : cur().fHTML;
  }

  function render() {
    const fn = cur(), parts = S.mode === "ex" ? student() : [];
    const extras = fn.extras ? fn.extras(S.w) : [];
    if (parts.length && parts.every(p => p.fn)) {
      extras.push({ vec: parts.map(p => p.fn(S.w)), cls: "yours" });
    }
    view.render(S.w, extras);
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
    S.mode = "rules";
    S.rule = key;
    load(false);
  }
  const exBox = $("gr-exs");
  EX.forEach((ex, i) => {
    const b = document.createElement("button");
    b.dataset.grEx = i;
    b.setAttribute("role", "radio");
    b.textContent = ex.label;
    b.onclick = () => { S.mode = "ex"; S.ex = i; load(false); };
    exBox.appendChild(b);
  });
  for (const b of document.querySelectorAll("[data-gr-mode]")) {
    b.onclick = () => {
      if (b.dataset.grMode !== S.mode) { S.mode = b.dataset.grMode; load(false); }
    };
  }
  for (const tr of document.querySelectorAll("tr[data-rule]")) {
    tr.onclick = () => selectRule(tr.dataset.rule);
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
  const pts = $("gr-points");
  EX[0].points.forEach(p => {
    const b = document.createElement("button");
    b.innerHTML = `<b>w</b> = [${p.join(", ")}]ᵀ`;
    b.onclick = () => { S.w = p.slice(); render(); };
    pts.querySelector(".buttons").appendChild(b);
  });

  load(false);

  return { step() {}, toggleRun() {}, stop() {}, render };
})();
