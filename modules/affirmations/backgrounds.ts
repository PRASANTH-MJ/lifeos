// Generated gradient backgrounds (static content, not user data) — deterministically
// assigned per affirmation by id, so the same affirmation always shows the same look.
export const AFFIRMATION_BACKGROUNDS: number[] = [
  require('../../assets/images/affirmation-bg-1.png'),
  require('../../assets/images/affirmation-bg-2.png'),
  require('../../assets/images/affirmation-bg-3.png'),
  require('../../assets/images/affirmation-bg-4.png'),
  require('../../assets/images/affirmation-bg-5.png'),
  require('../../assets/images/affirmation-bg-6.png'),
];

export function backgroundFor(id: number): number {
  return AFFIRMATION_BACKGROUNDS[((id % AFFIRMATION_BACKGROUNDS.length) + AFFIRMATION_BACKGROUNDS.length) % AFFIRMATION_BACKGROUNDS.length];
}
