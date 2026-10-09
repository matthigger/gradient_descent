# Gradient descent, visually: spec (draft)

Sibling of `knn`, `cross_validation`, `binary_metrics`, `projection_2d_3d`:
plain HTML/CSS/JS with SVG, no build step, no dependencies. Same page shell
(header + tabs, intro card with formula and "Try this" list with
`<details>` answers, stage card + controls sidebar, footer with build stamp),
same palette variables, same `pages.yml`. Tabs deep-link by hash:
`#regression`, `#stepsize`.

Subtitle (draft): "To find the bottom of a valley in the fog, feel which way
is uphill and step the other way."

---

## Tab 1: Regression

### Model and math (intro card)

- Model: ŷ = c₀ + c₁x.
- Objective: MSE(c₀, c₁) = (1/n) Σ (yᵢ − c₀ − c₁xᵢ)².
- Gradient, with residual rᵢ = yᵢ − ŷᵢ:
  ∂MSE/∂c₀ = −(2/n) Σ rᵢ,  ∂MSE/∂c₁ = −(2/n) Σ rᵢxᵢ.
- Update: c ← c − η ∇MSE(c).
- Readout shows these live: c₀, c₁, MSE, ∇ = (g₀, g₁), step count,
  min MSE.

### Layout

- **Left: error surface** over (c₀, c₁).
  - Contour view (default): log-spaced filled levels plus level lines, so
    the valley floor stays visible in ill-conditioned cases. Marks: trail of
    previous iterates (dots joined by segments).
  - **The point c**: current parameters c = (c₀, c₁) as a draggable
    point. Dragging it is the main way to explore: the scatter line,
    residuals, readout (c, MSE, ∇) and arrows all update live, and an MSE
    label rides next to it. The level line through c is drawn bold, showing
    every other c with the same MSE. Clicking empty surface jumps c there.
    Moving c by hand clears the trail and step count (it becomes the new
    start). Holding Shift locks the drag to one parameter (the axis the
    pointer has moved further along), with a dashed guide along it.
  - 3D toggle: orbitable surface (scroll to zoom, as in
    `projection_2d_3d`): drag empty space to orbit, drag the c handle to
    move it. The handle slides along the (c₀, c₁) floor plane, the point rides the
    surface above it, and a dropline from point to floor shows its height
    (= MSE). Trail drawn on the surface.
  - Arrows at the current point: the step −η∇ at true length, and ∇
    itself, drawn uphill at a fixed screen length (its true length is often
    off-plot).
  - Iterates that leave the plot clip to the edge with an arrowhead
    (as `cross_validation` does for error bars).
- **Right: scatter** of (xᵢ, yᵢ) with the current line ŷ = c₀ + c₁x,
  vertical residual segments (errors), and the min-MSE (least-squares)
  line, dashed; a legend in the top-left corner names all three. The
  header shows the model, ŷ = c₀ + c₁x = <fitted numbers>.
  - Drag a data point to move it: the surface, its minimum, and the min
    line update live.
  - Drag either of two square handles on the line (at the 25th/75th
    x-percentiles) to pivot it about the other; drag empty space to shift
    it up or down. The surface point follows, so the two panels are linked
    both ways.
- **Below/side: loss chart**: MSE against step number (see open question 1).

### Data sets

Seeded, with Samples, Noise, Resample, Reset (undo drags), as in `knn`.

| set | x | what it teaches |
|-----|---|-----------------|
| Centered | spread around 0 | round-ish bowl, descent heads straight in |
| Uncentered | far from 0 (e.g. 40–60) | c₀, c₁ strongly coupled: long thin diagonal valley; zig-zag/crawl |
| Outlier | centered + one far point | one squared error drags the minimum; pairs with dragging |
| Uneven scales | 0–1000 | slope curvature ≫ intercept curvature: max safe η is tiny and c₀ barely moves |

**x-scaling control** (segmented): Raw | Centered | Standardized. The model
becomes ŷ = c₀ + c₁(x − x̄) or ŷ = c₀ + c₁(x − x̄)/s; surface axis labels
change accordingly ("c₀ = ŷ at x̄"). The scatter always shows raw x, so the
same best line is visibly reached faster. This one control serves both
Uncentered (centering fixes it) and Uneven scales (standardizing fixes it).

### Controls (sidebar)

Data set · Samples · Noise · x scaling · Step size η (log slider, zones
bar beneath) · Contour / 3D · buttons: **Gradient step**, **Run / Pause**, Reset start,
Resample, Reset. Keys: space or → = one step.

Run steps on a timer until converged (|∇| below tolerance or MSE change
negligible) or diverged (non-finite or MSE > 10⁶ × start), then shows
"converged in k steps" / "diverged".

### Step-size zones (always shown)

Hessian H = 2 [[1, x̄], [x̄, mean(x²)]] (in the scaled coordinates); L =
λmax(H). The slider track is colored: η < 1/L "slow / steady",
1/L–2/L "overshoots (zig-zag)", > 2/L "diverges". Readout adds κ = λmax/λmin.

---

## Tab 2: Step size

Switch: **1D | 2D**. Same Gradient step / Run / η slider / zones bar /
loss chart as Tab 1.

### 1D

- Function (segmented): **Parabola** f(x) = a(x − x*)², with a curvature
  slider for a; **Two valleys**, an asymmetric quartic with a local and a
  global minimum (e.g. f(x) = x⁴/4 − x² + 0.3x).
- Click the curve or axis to set the start x.
- **Gradient step** animates in phases, so the "gradient points uphill"
  idea is explicit:
  1. tangent line at x,
  2. gradient arrow on the x-axis, f′(x), pointing uphill,
  3. step arrow −η f′(x) pointing the other way,
  4. the point moves; previous iterates stay as a trail (dots on the curve,
     joined so overshoot reads as a zig-zag across the bowl).
  An "Animate steps" toggle (on) lets Run skip the phases.
- Zones for the parabola: f″ = 2a, so η < 1/(2a) slow, = 1/(2a) one step,
  up to 1/a overshoots, > 1/a diverges. For Two valleys see open question 2.

### 2D bowl

- f(x) = ½ (x − x*)ᵀ A (x − x*), with A = Rθ diag(λmax, λmax/κ) Rθᵀ.
  λmax stays fixed while κ varies, so the largest safe step stays put and
  only the shallow direction slows down: the conditioning lesson is just
  "the steep direction caps η, the shallow one then crawls".
- Presets: Round (κ = 1), Stretched (κ = 10, θ = 0°), Rotated (κ = 10,
  θ = 30°), Very stretched (κ = 50, θ = 30°). Sliders: κ (1–100, log),
  θ (0–90°).
- Same contour / 3D renderer, point, trail, arrows, click-to-set as Tab 1.

---

## "Try this" (draft)

Regression
- Set a start far from the minimum and step. Which way does the step arrow point,
  relative to the contour lines? (Answer: perpendicular, straight downhill
  locally, not at the minimum.)
- Raise η until it diverges. Turn on zones: where did it break?
- Uncentered, Raw: Run. Why the long thin valley? (Answer: raising c₁ while
  lowering c₀ pivots the line around the data's center, which barely
  changes MSE; that pair of moves is the valley floor.) Switch to Centered.
- Uneven scales: find the largest η that converges; how far has c₀ moved
  after 100 steps? Standardize and repeat.
- Outlier: drag the outlier and watch the best line move. Why does one point matter so
  much? (Answer: errors are squared.)
- Drag the line by hand toward the dashed min line; watch your point on the
  surface walk to the bottom.
- Drag c along the bold level line. MSE stays put, but the line on
  the scatter changes. Find two very different lines with the same MSE.
- Drag c in a small circle around the bottom. Which direction raises MSE fastest?
  Check against the gradient arrow. (Answer: ∇, perpendicular to the
  level line.)

Step size
- Parabola: is f′(x) positive or negative to the right of the minimum?
  Which way does the step go?
- Find η that lands at the bottom in one step. What is it in terms of a?
  (Answer: 1/(2a).)
- Pick an η that zig-zags, then one that blows up. Now raise a: the safe η
  shrinks.
- Two valleys: from one start, find two η that end in different valleys.
- 2D Stretched: find the largest η that converges; count steps. Raise κ at
  that η. Rotate the bowl: does the step count change? (Answer: no, gradient
  descent only depends on the bowl's shape, not its orientation; the path
  just rotates with it.)

---

## Files

| file | role |
|------|------|
| `index.html` | page, intro text, controls |
| `style.css` | layout, palette, plot styles |
| `js/data.js` | seeded regression data sets |
| `js/gd.js` | objectives, gradients, Hessians, 2×2 eigen, step/run loop |
| `js/surface.js` | contour (marching squares) + 3D renderer, shared by both tabs |
| `js/regression.js` | Tab 1: scatter, dragging, linking |
| `js/stepsize.js` | Tab 2: 1D curve + phased step animation, 2D bowl |
| `js/app.js` | tabs, hash routing, footer build stamp |
| `js/version.js` | build stamp, overwritten at deploy |
| `.github/workflows/pages.yml` | Pages deploy (copied from `knn`) |

Own git repo at `teach/tools/gradient_descent`; no GitHub repo or Pages
until the demo is approved.

---

## Decisions (formerly open questions)

1. Loss chart y-axis: log(MSE − min MSE) by default, linear/log switch.
2. No zones bar on Two valleys (curvature varies).
3. 3D toggle in the 2D-bowl view too (same renderer).
4. Line dragging on the scatter: two handles at the 25th/75th x-percentiles;
   drag either and the line pivots about the other.
5. Per-tab settings (η slider not shared).
