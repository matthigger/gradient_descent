# gradient_descent

Interactive teaching demo of gradient descent. Two tabs:

- **Regression.** Fit ŷ = c₀ + c₁x by walking downhill on the MSE surface
  over (c₀, c₁). The surface (contour map, or an orbitable 3D mesh) and the
  scatter are linked both ways: drag the c vector's tip on the surface, or
  drag the line's handles on the scatter, and the other follows. Drag a
  sample to move it and the surface moves with it. Data sets: Centered,
  Uncentered (long thin valley), Outlier, Uneven scales. The x control
  (Raw / Centered / Standardized) keeps the same line but reshapes the
  surface, which is the cure for the two badly conditioned sets.
- **Step size.** 1D: a parabola f(c) = a(c − c*)² with a curvature slider,
  or a two-valley function; Gradient step can play out in phases (tangent,
  gradient pointing uphill, step against it, move). 2D: a quadratic bowl
  with presets (Round, Stretched, Rotated, Very stretched) and sliders for
  the condition number κ and rotation θ.

Both tabs have Gradient step / Run / Reset start, a log-scale step-size
slider with optional zones (steady below 1/L, zig-zag to 2/L, diverges
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

Link straight to a tab with `index.html#regression` or
`index.html#stepsize`.

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
| `js/regression.js` | Regression tab |
| `js/stepsize.js` | Step size tab |
| `js/app.js` | tabs, hash routing, keyboard, footer build stamp |
| `js/version.js` | build stamp, overwritten at deploy |
| `design/spec.md` | the design spec |
| `.github/workflows/pages.yml` | Pages deploy |
