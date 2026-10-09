// Seeded regression data: y = b0 + b1 x + noise, with x set by two knobs.
//
// The MSE Hessian is 2 [[1, mean(x)], [mean(x), mean(x^2)]], so x alone
// sets the bowl's shape. Its spread sd(x) sets the slope's curvature
// against the intercept's: at mean 0 the condition number is sd(x)^2, so
// the kappa knob sets sd(x) = sqrt(kappa). Its offset mean(x) couples the
// two into a diagonal valley and raises kappa further.

const REG_B = [1, 0.5];
const REG_N = 30;
const REG_NOISE = 0.5;

const REG_PRESETS = {
  centered: { label: "Centered", kappa: 1.3, offset: 0 },
  uncentered: { label: "Uncentered", kappa: 8.3, offset: 5 },
  uneven: { label: "Uneven scales", kappa: 33, offset: 0 },
};

/**
 * Draw a data set.
 *
 * The seed fixes the standardized draws, so moving kappa or offset
 * stretches and shifts the same sample rather than drawing a new one.
 *
 * Args:
 *   kappa (number): condition number at offset 0; sd(x) = sqrt(kappa)
 *   offset (number): mean of x
 *   seed (number): random seed
 *
 * Returns:
 *   data (object): { x: (REG_N,) number[], y: (REG_N,) number[] }
 */
function makeRegData(kappa, offset, seed) {
  const r = rng(seed * 7919 + 17), z = [], e = [];
  for (let i = 0; i < REG_N; i++) {
    z.push(-1 + 2 * (i + r()) / REG_N);
    e.push(randn(r));
  }
  // Standardize z exactly, so sd(x) and mean(x) hit their targets.
  const mz = z.reduce((t, v) => t + v, 0) / REG_N;
  const sz = Math.sqrt(z.reduce((t, v) => t + (v - mz) ** 2, 0) / REG_N);
  const sd = Math.sqrt(kappa);
  const x = z.map(v => offset + sd * (v - mz) / sz);
  const y = x.map((xi, i) => REG_B[0] + REG_B[1] * xi + REG_NOISE * e[i]);
  return { x, y };
}
