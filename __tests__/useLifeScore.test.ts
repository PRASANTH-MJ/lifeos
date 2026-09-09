import { budgetAdherenceScore, clampScore, ratioScore } from '@/modules/scoreboard/scoring';

describe('clampScore', () => {
  test('rounds and clamps into 0-100', () => {
    expect(clampScore(42.4)).toBe(42);
    expect(clampScore(42.6)).toBe(43);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
  });
});

describe('ratioScore', () => {
  test('maps hitting the target exactly to 100', () => {
    expect(ratioScore(7, 7)).toBe(100);
  });

  test('scales linearly below the target', () => {
    expect(ratioScore(3, 6)).toBe(50);
    expect(ratioScore(0, 6)).toBe(0);
  });

  test('caps at 100 for doing more than the target — 2x a target is not "200% healthy"', () => {
    expect(ratioScore(14, 7)).toBe(100);
    expect(ratioScore(1000, 7)).toBe(100);
  });

  test('a non-positive target scores 0 rather than dividing by zero/negative', () => {
    expect(ratioScore(5, 0)).toBe(0);
    expect(ratioScore(5, -3)).toBe(0);
  });
});

describe('budgetAdherenceScore', () => {
  test('scores 100 at zero spend', () => {
    expect(budgetAdherenceScore(0)).toBe(100);
  });

  test('still scores well (not a failure) at exactly 100% of budget used', () => {
    expect(budgetAdherenceScore(100)).toBe(70);
  });

  test('decays gently while still under budget', () => {
    expect(budgetAdherenceScore(50)).toBe(85);
  });

  test('decays faster once over budget, reaching 0 well before an extreme overage', () => {
    expect(budgetAdherenceScore(150)).toBe(0);
    expect(budgetAdherenceScore(128)).toBe(0);
  });

  test('never goes negative even far over budget', () => {
    expect(budgetAdherenceScore(1000)).toBe(0);
  });
});
