// Seeded regression data sets: y = b0 + b1 x + noise on an even spread of x.
//
// The x range is the point of each set. Centered x gives a round-ish MSE
// bowl; x far from 0 couples intercept and slope into a long thin valley;
// x with a wide spread makes the slope's curvature dwarf the intercept's.

const REG_SETS = {
  centered: { label: "Centered", x: [-2, 2], b: [1, 0.8], ylab: "y" },
  uncentered: { label: "Uncentered", x: [0, 10], b: [2, 0.5],
    ylab: "y" },
  outlier: { label: "Outlier", x: [-2, 2], b: [1, 0.8], ylab: "y",
    outlier: [1.7, 7] },
  uneven: { label: "Uneven scales", x: [-10, 10], b: [1, 0.3],
    ylab: "y" },
};

/**
 * Draw a data set.
 *
 * Args:
 *   key (string): REG_SETS key
 *   n (number): samples
 *   noise (number): noise standard deviation, in y units
 *   seed (number): random seed
 *
 * Returns:
 *   data (object): { x: (n,) number[], y: (n,) number[] }; Outlier adds
 *     one more sample far above the line
 */
function makeRegData(key, n, noise, seed) {
  const set = REG_SETS[key], r = rng(seed * 7919 + n);
  const [lo, hi] = set.x, x = [], y = [];
  for (let i = 0; i < n; i++) {
    const xi = lo + (i + r()) / n * (hi - lo);
    x.push(xi);
    y.push(set.b[0] + set.b[1] * xi + noise * randn(r));
  }
  if (set.outlier) {
    x.push(set.outlier[0]);
    y.push(set.outlier[1]);
  }
  return { x, y };
}
