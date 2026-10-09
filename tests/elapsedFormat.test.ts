/**
 * Stage 6 unit tests — elapsed formatting (seconds to days).
 * Run: npx tsx tests/elapsedFormat.test.ts
 */

import { formatElapsed, elapsedFromStart } from '../src/background/elapsedFormat';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

console.log('=== elapsedFormat tests ===');

assert(formatElapsed(0) === '0s', '0 ms → 0s');
assert(formatElapsed(1000) === '1s', '1s');
assert(formatElapsed(42000) === '42s', '42s');
assert(formatElapsed(3 * 60 * 1000 + 5 * 1000) === '3m 05s', '3m 05s');
assert(
  formatElapsed(1 * 3600 * 1000 + 4 * 60 * 1000 + 12 * 1000) === '1h 04m 12s',
  '1h 04m 12s'
);
assert(
  formatElapsed(2 * 86400 * 1000 + 3 * 3600 * 1000 + 10 * 60 * 1000) ===
    '2d 3h 10m',
  '2d 3h 10m'
);
assert(formatElapsed(-5) === '0s', 'negative clamped to 0s');
assert(elapsedFromStart(null) === 0, 'null start → 0');
assert(elapsedFromStart(1000, 6000) === 5000, 'elapsedFromStart delta');

console.log('=== all elapsedFormat tests passed ===');
