/** ~30ml per kg of body weight is the common general-hydration guideline — rounded to the
 * nearest 50ml so the suggested goal reads as a sensible round number. */
export function suggestedWaterGoalMl(weightKg: number): number {
  return Math.round((weightKg * 30) / 50) * 50;
}
