// Objectives and the gradient-descent runner shared by both tabs.
//
// Every 2D objective here is a quadratic bowl: the regression MSE is
// quadratic in (c0, c1), and the step-size tab's bowl is one by
// construction. So level sets are exact ellipses, min, curvature and
// condition number are closed form, and the surface view draws them
// without a grid.

/**
 * Quadratic bowl f(c) = fmin + 1/2 (c - cstar)' H (c - cstar).
 *
 * H = [[h00, h01], [h01, h11]] is the (constant) Hessian; eig holds its
 * eigenvalues l (largest first) and unit eigenvectors v (the bowl's axes).
 */
class Quadratic {
  constructor(h00, h01, h11, cstar, fmin) {
    this.H = [h00, h01, h11];
    this.cstar = cstar;
    this.fmin = fmin;
    this.eig = eigSym(h00, h01, h11);
    // Largest curvature: the step-size limit.
    this.L = this.eig.l[0];
    this.kappa = this.eig.l[0] / Math.max(this.eig.l[1], 1e-300);
  }
  /** f(c) - fmin. */
  excess(c) {
    const [h00, h01, h11] = this.H;
    const d0 = c[0] - this.cstar[0], d1 = c[1] - this.cstar[1];
    return 0.5 * (h00 * d0 * d0 + 2 * h01 * d0 * d1 + h11 * d1 * d1);
  }
  f(c) { return this.fmin + this.excess(c); }
  grad(c) {
    const [h00, h01, h11] = this.H;
    const d0 = c[0] - this.cstar[0], d1 = c[1] - this.cstar[1];
    return [h00 * d0 + h01 * d1, h01 * d0 + h11 * d1];
  }
  /**
   * Point at excess level ell, equally far along both axes in curvature
   * units, so a descent from it has to work in both directions.
   */
  startAt(ell, sign = [-1, -1]) {
    const { l, v } = this.eig;
    const a = Math.sqrt(ell / l[0]), b = Math.sqrt(ell / l[1]);
    const c = [0, 1].map(i =>
      this.cstar[i] + sign[0] * a * v[0][i] + sign[1] * b * v[1][i]);
    return c;
  }
  converged(c, start) {
    const e0 = this.excess(start);
    return this.excess(c) <= Math.max(1e-4 * e0, 1e-14);
  }
}

/**
 * MSE of the line yhat = c0 + c1 u as a Quadratic in c = (c0, c1).
 *
 * MSE(c) = (1/n) sum (y_i - c0 - c1 u_i)^2 has Hessian
 * 2 [[1, mean(u)], [mean(u), mean(u^2)]] and its minimum at the least-
 * squares line.
 *
 * Args:
 *   u (number[]): (n,) feature, already centered/scaled as the model uses
 *   y (number[]): (n,) labels
 */
function mseQuadratic(u, y) {
  const n = y.length;
  let su = 0, sy = 0;
  for (let i = 0; i < n; i++) { su += u[i]; sy += y[i]; }
  const mu = su / n, my = sy / n;
  let vuu = 0, vuy = 0, vyy = 0;
  for (let i = 0; i < n; i++) {
    const du = u[i] - mu, dy = y[i] - my;
    vuu += du * du; vuy += du * dy; vyy += dy * dy;
  }
  vuu /= n; vuy /= n; vyy /= n;
  // Guard a degenerate drag (every x equal), where the slope is undefined.
  const vu = Math.max(vuu, 1e-9);
  const c1 = vuy / vu, c0 = my - c1 * mu;
  const fmin = Math.max(vyy - vuy * vuy / vu, 0);
  return new Quadratic(2, 2 * mu, 2 * (vuu + mu * mu), [c0, c1], fmin);
}

/**
 * Bowl with axes rotated theta (radians) and curvatures lmax, lmax/kappa,
 * centered on cstar with minimum 0.
 */
function bowlQuadratic(kappa, theta, lmax = 1, cstar = [0, 0]) {
  const l2 = lmax / kappa, c = Math.cos(theta), s = Math.sin(theta);
  return new Quadratic(lmax * c * c + l2 * s * s, (lmax - l2) * c * s,
    lmax * s * s + l2 * c * c, cstar, 0);
}

/**
 * One-dimensional objectives for the step-size tab: f, its derivative df,
 * second derivative d2, and the global minimum (cstar, fmin).
 */
function parabola(a, cstar = 0) {
  return {
    name: "parabola", a, cstar, fmin: 0,
    f: c => a * (c - cstar) ** 2,
    df: c => 2 * a * (c - cstar),
    d2: () => 2 * a,
    L: 2 * a,
    converged(c, start) {
      return this.f(c) <= Math.max(1e-4 * this.f(start), 1e-14);
    },
  };
}

/**
 * Asymmetric double well f(c) = c^4/4 - c^2 + 0.3 c: a global minimum near
 * c = -1.48 and a shallower local one near c = 1.33.
 */
function twoValleys() {
  const f = c => c ** 4 / 4 - c * c + 0.3 * c;
  const df = c => c ** 3 - 2 * c + 0.3;
  const d2 = c => 3 * c * c - 2;
  let cs = -1.5;
  for (let i = 0; i < 50; i++) cs -= df(cs) / d2(cs);
  return {
    name: "valleys", cstar: cs, fmin: f(cs), f, df, d2, L: null,
    converged: c => Math.abs(df(c)) < 1e-5,
  };
}

const MAX_STEPS = 5000;

/**
 * Gradient-descent iterates from a start point.
 *
 * obj supplies f(c), grad(c) and converged(c, start) on arrays c; scale is
 * the size of the view, used to call a run diverged once it is far off.
 *
 * Attributes:
 *   trail (number[][]): (k+1, dim) iterates, trail[0] the start
 *   losses (number[]): (k+1,) f at each iterate
 *   status (string): "", "converged", "diverged" or "capped"
 */
class Runner {
  constructor(obj, c, scale) {
    this.obj = obj;
    this.scale = scale;
    this.reset(c);
  }
  get c() { return this.trail[this.trail.length - 1]; }
  get steps() { return this.trail.length - 1; }
  reset(c) {
    this.trail = [c.slice()];
    this.losses = [this.obj.f(c)];
    this.status = this.obj.converged(c, c) ? "converged" : "";
  }
  /** New objective (e.g. data dragged): restart from the current point. */
  setObjective(obj, scale = this.scale) {
    this.obj = obj;
    this.scale = scale;
    this.reset(this.c);
  }
  step(eta) {
    if (this.status) return false;
    const c = this.c, g = this.obj.grad(c);
    const next = c.map((v, i) => v - eta * g[i]);
    this.trail.push(next);
    this.losses.push(this.obj.f(next));
    const start = this.trail[0];
    const far = Math.hypot(...next.map((v, i) => v - start[i]));
    if (!next.every(Number.isFinite) || far > 1e4 * this.scale) {
      this.status = "diverged";
    } else if (this.obj.converged(next, start)) {
      this.status = "converged";
    } else if (this.steps >= MAX_STEPS) {
      this.status = "capped";
    }
    return true;
  }
  /** Sentence describing the run so far. */
  describe() {
    const k = this.steps, s = k === 1 ? "" : "s";
    return {
      converged: k ? `Converged in ${k} step${s}.` : "At the minimum.",
      diverged: `Diverged after ${k} step${s}.`,
      capped: `Stopped after ${k} steps, not yet converged.`,
    }[this.status] || `${k} step${s}.`;
  }
}

/**
 * Step a runner on a timer until it stops, speeding up as it goes so a
 * slow crawl of thousands of steps still finishes in seconds.
 *
 * Returns a function that stops the loop.
 */
function runLoop(runner, getEta, onTick, onDone) {
  let ticks = 0;
  const id = setInterval(() => {
    ticks += 1;
    const n = ticks < 20 ? 1 : Math.ceil(1.06 ** (ticks - 20));
    for (let i = 0; i < n && runner.step(getEta()); i++);
    onTick();
    if (runner.status) { clearInterval(id); onDone(); }
  }, 50);
  return () => clearInterval(id);
}
