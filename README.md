# gradient_descent

Interactive teaching demo of gradients and gradient descent. Three tabs:

- **Gradient** (`#gradient`). The day 10 gradient rules (sum, linear
  aᵀw, quadratic wᵀAw, chain g(aᵀw), and the special cases ‖w‖² and
  ‖Xw − y‖²), each as a contour map with value labels and the gradient
  field. Drag the point w: its ∇f(w) arrow is drawn and the rule is
  worked with w plugged in. The rule's a, A, g (eᶻ, σ, log(1 + e⁻ᶻ), z²),
  c and λ are adjustable. Exercises (the first is the in-class activity,
  with jump buttons to its points) let students type each partial; their
  arrow is drawn over the true one and the answer is checked on a grid.
- **Regression.** Fit ŷ = w₀ + w₁x by walking downhill on the MSE surface
  over (w₀, w₁). The surface (contour map, or an orbitable 3D mesh) and the
  scatter are linked both ways: drag the point w on the surface, or
  drag the line's handles on the scatter, and the other follows. Drag a
  sample to move it and the surface moves with it. Hover the trail to see
  any step's line. The data's x is set by two sliders, each with a hover
  explanation naming its fix: offset (its mean, which couples intercept
  and slope into a diagonal valley; fixed by Centered) and condition
  number κ (its spread; κ exactly, at offset 0; fixed by Standardized).
  The x control (Raw / Centered / Standardized) keeps the same line but
  reshapes the surface.
- **Step size.** 1D: a parabola f(w) = a(w − w*)² with a curvature slider,
  or a two-valley function; Gradient step can play out in phases (tangent,
  gradient pointing uphill, step against it, move). 2D: a quadratic bowl
  with presets (Round, Stretched, Rotated, Very stretched) and sliders for
  the condition number κ and rotation θ.

Both tabs have Gradient step / Run / Reset start, a log-scale step-size
slider with a zones bar (steady below 1/L, zig-zag to 2/L, diverges
above, for largest curvature L), a loss-by-step chart (log excess or
linear), and "Try this" prompts with hidden answers. Space or → takes a
step.

Plain HTML/CSS/JS with SVG: no build step and no dependencies. Every 2D
objective is a quadratic, so level sets are drawn as exact ellipses.

## Run locally

Open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Link straight to a tab with `index.html#gradient`, `index.html#stepsize`
or `index.html#regression`; with no hash the page opens on Gradient.

## Publish on GitHub Pages

Pages is built by `.github/workflows/pages.yml` on every push to `main`. It
stamps `js/version.js` with the commit and build time, which the footer
shows ("local copy" when run locally). The site lives at
<https://matthigger.github.io/gradient_descent/>.

## Layout

| file | role |
|------|------|
| `index.html` | page, explanation text, controls |
| `style.css` | layout, palette, plot styles |
| `js/util.js` | SVG helpers, formatting, seeded RNG, 2×2 eigen, eta slider and zones |
| `js/gd.js` | quadratic and 1D objectives, the gradient-descent runner and run loop |
| `js/surface.js` | contour + 3D surface view with the draggable c (both tabs) |
| `js/chart.js` | loss-by-step chart |
| `js/data.js` | seeded regression data sets |
| `js/expr.js` | parser for students' typed partial derivatives |
| `js/field.js` | contour + gradient-field view of any f(w₀, w₁) |
| `js/gradtab.js` | Gradient tab: rules and exercises |
| `js/regression.js` | Regression tab |
| `js/stepsize.js` | Step size tab |
| `js/app.js` | tabs, hash routing, keyboard, footer build stamp |
| `js/version.js` | build stamp, overwritten at deploy |
| `design/spec.md` | the design spec |
| `.github/workflows/pages.yml` | Pages deploy |
