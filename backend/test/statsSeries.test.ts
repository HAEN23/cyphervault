import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countByBucket, secretDailySeries, STEP } from '../src/utils/statsSeries.js';

const now = new Date('2026-11-18T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

test('countByBucket agrupa por hora y descarta lo que queda fuera', () => {
  const s = countByBucket([ago(0), ago(30 * 60 * 1000), ago(23.5 * STEP.HOUR), ago(25 * STEP.HOUR)], now, 24, STEP.HOUR);
  assert.equal(s.length, 24);
  assert.equal(s[0].v, 1);
  assert.equal(s[23].v, 2); // `now` exacto y hace 30 min
  assert.equal(s.reduce((a, p) => a + p.v, 0), 3);
  assert.equal(s[23].t, now.toISOString());
});

test('secretDailySeries respeta altas, bajas y rotación', () => {
  const secrets = [
    { createdAt: ago(200 * STEP.DAY), deletedAt: null, passwordChangedAt: ago(95 * STEP.DAY) }, // entra en riesgo hace 5 días
    { createdAt: ago(3 * STEP.DAY), deletedAt: null, passwordChangedAt: ago(3 * STEP.DAY) }, // nuevo
    { createdAt: ago(50 * STEP.DAY), deletedAt: ago(5 * STEP.DAY), passwordChangedAt: ago(50 * STEP.DAY) }, // borrado
  ];
  const { protectedSeries, atRiskSeries } = secretDailySeries(secrets, now, 14, 90);
  assert.deepEqual(protectedSeries.map((p) => p.v), [2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual(atRiskSeries.map((p) => p.v), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
});
