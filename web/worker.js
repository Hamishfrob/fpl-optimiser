// Runs the solver off the page's main thread so the page stays responsive on a slow device.
import Highs from './vendor/highs.mjs';
import { createSolver } from '../src/solver.js';
import { computeAdvice } from '../src/advice.js';

let solver;
self.onmessage = async (e) => {
  try {
    solver ??= createSolver(await Highs());
    const advice = computeAdvice({ ...e.data, solver });
    self.postMessage({ ok: true, advice });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err.message ?? err) });
  }
};
