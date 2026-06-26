// Throwaway realism harness: prints SB jam% and BB call% across stack depths at
// production-ish sample counts. Run with: npx vite-node scripts/realism.ts
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { solvePushFold } from '../src/domain/pushfold';

const SAMPLES = 600;
const SEED = 1337;
const ITERS = 600;

console.log(`Building 169x169 equity matrix (samples=${SAMPLES}, seed=${SEED})…`);
const t0 = Date.now();
const equity = buildEquityMatrix(SAMPLES, SEED);
console.log(`Matrix built in ${Date.now() - t0} ms`);

for (const S of [1, 2, 5, 8, 10, 12, 15, 20, 25]) {
  const r = solvePushFold(S, equity, ITERS);
  console.log(
    `${String(S).padStart(2)}bb  SB jam ${(r.sbJamFraction * 100).toFixed(1).padStart(5)}%  ` +
      `BB call ${(r.bbCallFraction * 100).toFixed(1).padStart(5)}%  ` +
      `expl ${r.exploitabilityBbPerGame.toFixed(5)} bb/g`,
  );
}
