import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../js/widgets/mlmath.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('MSE and MAE of the lesson model on the lesson cars', () => {
  // y' = 34 − 4.6x; the lesson computes 23.1 mpg for the 2.37 car (L2 loss 0.81 vs 24).
  near(m.predict(-4.6, 34, 2.37), 23.098);
  near((m.predict(-4.6, 34, 2.37) - 24) ** 2, 0.8136, 1e-3);
  near(m.mse(m.CARS, -4.6, 34), 1.5623, 1e-4);
  near(m.mae([[1, 2], [2, 2]], 0, 3), 1);
});

test('least squares is where the gradient is zero', () => {
  const [w, b] = m.leastSquares(m.CARS);
  const [gw, gb] = m.gradient(m.CARS, w, b);
  near(gw, 0, 1e-9); near(gb, 0, 1e-9);
  assert.ok(m.mse(m.CARS, w, b) <= m.mse(m.CARS, -4.6, 34));
});

test('gradient descent converges below the stable rate and diverges above it', () => {
  const r = m.maxStableRate(m.CARS);
  const [w, b] = m.leastSquares(m.CARS);
  const good = m.descend(m.CARS, { rate: 0.9 * r, steps: 3000 }).at(-1);
  near(good[0], w, 1e-3); near(good[1], b, 1e-3);
  const bad = m.descend(m.CARS, { rate: 1.05 * r, steps: 3000 }).at(-1);
  assert.ok(!(bad[2] < 1e6));
});

test('sigmoid, logit and softmax', () => {
  near(m.sigmoid(0), 0.5);
  near(m.logit(m.sigmoid(1.7)), 1.7);
  const p = m.softmax([1, 2, 3]);
  near(p.reduce((a, b) => a + b, 0), 1);
  assert.ok(p[2] > p[1] && p[1] > p[0]);
  near(m.softmax([1000, 1000])[0], 0.5);
  near(m.logLoss(1, 0.5), Math.log(2));
});

test('confusion matrix and metrics follow the lesson definitions', () => {
  const ex = [{ score: 0.9, label: 1 }, { score: 0.6, label: 0 }, { score: 0.4, label: 1 }, { score: 0.1, label: 0 }, { score: 0.5, label: 1 }];
  const c = m.confusion(ex, 0.5);
  assert.deepEqual(c, { tp: 2, fp: 1, tn: 1, fn: 1 });
  const k = m.metrics(c);
  near(k.accuracy, 3 / 5); near(k.precision, 2 / 3); near(k.recall, 2 / 3); near(k.fpr, 1 / 2);
  assert.ok(Number.isNaN(m.metrics({ tp: 0, fp: 0, tn: 3, fn: 1 }).precision));
});

test('ROC: perfect ranking has AUC 1, reversed 0, and it always runs (0,0) → (1,1)', () => {
  const perfect = [{ score: 0.9, label: 1 }, { score: 0.8, label: 1 }, { score: 0.2, label: 0 }, { score: 0.1, label: 0 }];
  near(m.auc(m.roc(perfect)), 1);
  near(m.auc(m.roc(perfect.map(e => ({ ...e, label: 1 - e.label })))), 0);
  const pts = m.roc(m.scoredExamples({ separation: 1 }));
  assert.deepEqual([pts[0].fpr, pts[0].tpr, pts.at(-1).fpr, pts.at(-1).tpr], [0, 0, 1, 1]);
  const weak = m.auc(m.roc(m.scoredExamples({ nPos: 200, nNeg: 200, separation: 0.5 })));
  const strong = m.auc(m.roc(m.scoredExamples({ nPos: 200, nNeg: 200, separation: 3 })));
  assert.ok(strong > weak && weak > 0.5);
});

test('normalisation', () => {
  const xs = [1, 2, 3, 10];
  assert.deepEqual(m.normalise(xs, 'linear').map(v => +v.toFixed(3)), [0, 0.111, 0.222, 1]);
  const z = m.normalise(xs, 'z');
  near(m.mean(z), 0); near(m.sd(z), 1);
  assert.deepEqual(m.normalise(xs, 'clip', { clipAt: 4 }), [1, 2, 3, 4]);
  near(m.normalise([Math.E], 'log')[0], 1);
});

test('polyfit recovers a polynomial; L2 shrinks the weights', () => {
  const pts = [-1, -0.5, 0, 0.5, 1].map(x => [x, 1 - 2 * x + 3 * x * x]);
  const c = m.polyfit(pts, 2);
  near(c[0], 1); near(c[1], -2); near(c[2], 3);
  const r = m.polyfit(pts, 2, 0.5);
  assert.ok(Math.abs(r[2]) < 3 && Math.abs(r[1]) < 2);
});

test('k-means moves centres to the middle of their points', () => {
  const pts = [[0, 0], [0, 1], [10, 10], [10, 11]];
  const { assign, centres } = m.kmeansStep(pts, [[0, 0], [9, 9]]);
  assert.deepEqual(assign, [0, 0, 1, 1]);
  assert.deepEqual(centres, [[0, 0.5], [10, 10.5]]);
});

test('seeded random numbers repeat', () => {
  const a = m.rng(5), b = m.rng(5);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
