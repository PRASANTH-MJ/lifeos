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

// User-provided images with their own captions baked in — each shown only for
// the one affirmation whose text matches exactly, never in the generic rotation.
const PINNED_BACKGROUNDS: Record<string, number> = {
  'Be Good to Yourself': require('../../assets/images/affirmation-custom-1.png'),
  'Dream. Believe. Achieve.': require('../../assets/images/affirmation-custom-2.jpeg'),
  'I am a magnet for success & happiness!': require('../../assets/images/affirmation-custom-3.jpeg'),
  'My dream life is already mine.': require('../../assets/images/affirmation-custom-4.jpeg'),
  'Believe in your dreams.': require('../../assets/images/affirmation-custom-5.jpeg'),
  'In a world full of roses, be a sunflower.': require('../../assets/images/affirmation-custom-6.jpeg'),
  'Be kind to yourself.': require('../../assets/images/affirmation-custom-7.jpeg'),
  'Reset, restart, refocus.': require('../../assets/images/affirmation-custom-8.jpeg'),
  'Not yesterday, not tomorrow — now.': require('../../assets/images/affirmation-custom-9.jpeg'),
  'What if it all works out?': require('../../assets/images/affirmation-custom-10.jpeg'),
  'Discipline.': require('../../assets/images/affirmation-custom-11.jpeg'),
  'Dream the impossible dream.': require('../../assets/images/affirmation-custom-12.jpeg'),
  "It's always been you vs. you.": require('../../assets/images/affirmation-custom-13.jpeg'),
  'I attract everything I want.': require('../../assets/images/affirmation-custom-14.jpeg'),
};

export function backgroundFor(id: number, text?: string): number {
  if (text && PINNED_BACKGROUNDS[text]) {
    return PINNED_BACKGROUNDS[text];
  }
  return AFFIRMATION_BACKGROUNDS[((id % AFFIRMATION_BACKGROUNDS.length) + AFFIRMATION_BACKGROUNDS.length) % AFFIRMATION_BACKGROUNDS.length];
}
