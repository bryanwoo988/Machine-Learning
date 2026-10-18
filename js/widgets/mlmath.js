/* The arithmetic behind the interactive figures. Pure and unit-tested
   (tests/mlmath.test.js); every figure computes from these, so what a figure
   shows is what the formulas in the lessons give. */

/* ---------- Linear regression (Crash Course: Linear regression) ---------- */

// The seven cars in the lesson's table: weight in thousands of pounds,
// fuel efficiency in miles per gallon.
export const CARS = [[3.5, 18], [3.69, 15], [3.44, 18], [3.43, 16], [4.34, 15], [4.42, 14], [2.37, 24]];

export const predict = (w, b, x) => b + w * x;

export function mse(data, w, b) {
  return data.reduce((s, [x, y]) => s + (predict(w, b, x) - y) ** 2, 0) / data.length;
}

export function mae(data, w, b) {
  return data.reduce((s, [x, y]) => s + Math.abs(predict(w, b, x) - y), 0) / data.length;
}

// d(MSE)/dw and d(MSE)/db, as derived in the Gradient descent lesson.
export function gradient(data, w, b) {
  let gw = 0, gb = 0;
  for (const [x, y] of data) {
    const e = predict(w, b, x) - y;
    gw += 2 * e * x;
    gb += 2 * e;
  }
  return [gw / data.length, gb / data.length];
}

// Ordinary least squares: the weight and bias with the lowest MSE.
export function leastSquares(data) {
  const n = data.length;
  const mx = data.reduce((s, [x]) => s + x, 0) / n;
  const my = data.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of data) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const w = sxy / sxx;
  return [w, my - w * mx];
}

// The largest learning rate for which gradient descent on MSE still
// converges: 2 / (largest eigenvalue of the Hessian of MSE).
export function maxStableRate(data) {
  const n = data.length;
  const a = 2 * data.reduce((s, [x]) => s + x * x, 0) / n;
  const c = 2 * data.reduce((s, [x]) => s + x, 0) / n;
  const d = 2;
  const lmax = (a + d) / 2 + Math.sqrt(((a - d) / 2) ** 2 + c * c);
  return 2 / lmax;
}

export function descend(data, { w = 0, b = 0, rate, steps }) {
  const path = [[w, b, mse(data, w, b)]];
  for (let i = 0; i < steps; i++) {
    const [gw, gb] = gradient(data, w, b);
    w -= rate * gw;
    b -= rate * gb;
    const l = mse(data, w, b);
    path.push([w, b, l]);
    if (!Number.isFinite(l) || l > 1e12) break;
  }
  return path;
}

/* ---------- Logistic regression and classification ---------- */

export const sigmoid = z => 1 / (1 + Math.exp(-z));
export const logit = p => Math.log(p / (1 - p));

export function logLoss(y, p) {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export function softmax(zs) {
  const m = Math.max(...zs);
  const e = zs.map(z => Math.exp(z - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

// examples: [{score, label: 0|1}]. A score at or above the threshold is
// predicted positive (the lesson notes libraries differ on ties; Keras
// predicts negative when equal — here ≥ is positive, said in the figure).
export function confusion(examples, threshold) {
  const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const { score, label } of examples) {
    const pos = score >= threshold;
    if (pos && label) c.tp++; else if (pos) c.fp++; else if (label) c.fn++; else c.tn++;
  }
  return c;
}

const div = (a, b) => (b ? a / b : NaN);
export function metrics({ tp, fp, tn, fn }) {
  const precision = div(tp, tp + fp), recall = div(tp, tp + fn);
  return {
    accuracy: div(tp + tn, tp + fp + tn + fn),
    precision,
    recall,
    fpr: div(fp, fp + tn),
    f1: div(2 * precision * recall, precision + recall),
  };
}

// ROC points from the highest threshold to the lowest, and the area under
// them by the trapezoid rule.
export function roc(examples) {
  const ts = [Infinity, ...[...new Set(examples.map(e => e.score))].sort((a, b) => b - a)];
  return ts.map(t => {
    const m = metrics(confusion(examples, t));
    return { t, fpr: m.fpr || 0, tpr: m.recall || 0 };
  });
}

export function auc(points) {
  let a = 0;
  for (let i = 1; i < points.length; i++) a += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2;
  return a;
}

/* ---------- Data for schematic figures ---------- */

// Small deterministic random numbers, so a figure looks the same on every
// phone and in the tests.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function gauss(rand) {
  const u = Math.max(1e-12, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Scores of a classifier for `nPos` positives and `nNeg` negatives; larger
// `separation` means the two classes overlap less.
export function scoredExamples({ nPos = 20, nNeg = 20, separation = 1.6, seed = 7 } = {}) {
  const r = rng(seed);
  const out = [];
  const add = (label, centre) => {
    const z = centre + gauss(r);
    out.push({ score: Math.round(sigmoid(z) * 1000) / 1000, label });
  };
  for (let i = 0; i < nPos; i++) add(1, separation / 2);
  for (let i = 0; i < nNeg; i++) add(0, -separation / 2);
  return out;
}

/* ---------- Normalisation (Working with numerical data) ---------- */

export const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const sd = xs => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))); };

export function normalise(xs, method, { clipAt = 3 } = {}) {
  const lo = Math.min(...xs), hi = Math.max(...xs), m = mean(xs), s = sd(xs);
  switch (method) {
    case 'linear': return xs.map(x => (x - lo) / (hi - lo));
    case 'z': return xs.map(x => (x - m) / s);
    case 'log': return xs.map(x => Math.log(x));
    case 'clip': return xs.map(x => Math.min(x, clipAt));
    default: return xs.slice();
  }
}

/* ---------- Model complexity (Datasets, generalization, overfitting) ---------- */

// Least squares polynomial of `degree`, with an L2 penalty `lambda` on every
// weight except the bias, solved by Gaussian elimination on the normal
// equations (x is kept in [-1, 1] so this stays well-conditioned).
export function polyfit(points, degree, lambda = 0) {
  const n = degree + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const v = new Array(n).fill(0);
  for (const [x, y] of points) {
    const pw = Array.from({ length: n }, (_, k) => x ** k);
    for (let i = 0; i < n; i++) {
      v[i] += pw[i] * y;
      for (let j = 0; j < n; j++) A[i][j] += pw[i] * pw[j];
    }
  }
  for (let i = 1; i < n; i++) A[i][i] += lambda * points.length;
  return solve(A, v);
}

export const polyval = (c, x) => c.reduce((s, ck, k) => s + ck * x ** k, 0);

export function solve(A, v) {
  const n = v.length;
  const M = A.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/* ---------- Clustering (Intro to ML: unsupervised learning) ---------- */

export function kmeansStep(points, centres) {
  const groups = centres.map(() => []);
  const assign = points.map(p => {
    let best = 0, bd = Infinity;
    centres.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; best = i; } });
    groups[best].push(p);
    return best;
  });
  const next = centres.map((c, i) => groups[i].length ? [mean(groups[i].map(p => p[0])), mean(groups[i].map(p => p[1]))] : c);
  return { assign, centres: next };
}

/* ---------- Neural networks ---------- */

export const ACTIVATIONS = {
  linear: z => z,
  relu: z => Math.max(0, z),
  sigmoid,
  tanh: z => Math.tanh(z),
};

export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
