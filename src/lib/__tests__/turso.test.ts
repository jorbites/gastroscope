import { describe, expect, it } from 'vitest';
import {
  calcDeltaPct,
  computeRangeBounds,
  parseDateRange,
} from '../turso';

describe('Gastroscope Turso date & delta helpers', () => {
  it('parses valid ranges and defaults invalid values to 30d', () => {
    expect(parseDateRange('7d')).toBe('7d');
    expect(parseDateRange('90d')).toBe('90d');
    expect(parseDateRange('all')).toBe('all');
    expect(parseDateRange('invalid')).toBe('30d');
    expect(parseDateRange(null)).toBe('30d');
  });

  it('computes non-overlapping current and previous period bounds', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    const bounds = computeRangeBounds('7d', now);
    expect(bounds.startDay).toBe('2026-11-18');
    expect(bounds.prevEndDay).toBe('2026-11-17');
    expect(bounds.prevStartDay).toBe('2026-11-11');
  });

  it('computes period-over-period percentage deltas cleanly', () => {
    expect(calcDeltaPct(150, 100)).toBe(50);
    expect(calcDeltaPct(50, 100)).toBe(-50);
    expect(calcDeltaPct(10, 0)).toBe(100);
    expect(calcDeltaPct(0, 0)).toBeNull();
  });
});
