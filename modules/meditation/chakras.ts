export type Chakra = {
  key: string;
  /** English name, e.g. "Root" — shown as the card/screen title. */
  name: string;
  /** Sanskrit name, e.g. "Muladhara" — shown as a subtitle/caption. */
  sanskritName: string;
  /** Bija (seed) mantra chanted while focusing on this chakra. */
  mantra: string;
  /** Hex color matching this chakra's traditional association — used as the accent/background,
   * same convention as theme/tokens.ts's ColorTokens (plain hex, alpha applied via withAlpha). */
  color: string;
  theme: string;
  description: string;
  durationSeconds: number;
  /** Key into MEDITATION_TRACKS (types.ts) — chakras have no dedicated audio, so each borrows
   * one of the 6 bundled ambient tracks by loose mood match (grounding for lower chakras, airier
   * for upper ones). */
  audioTrackKey: string;
};

export const CHAKRAS: Chakra[] = [
  {
    key: 'root',
    name: 'Root',
    sanskritName: 'Muladhara',
    mantra: 'LAM',
    color: '#D62828',
    theme: 'Grounding, safety & stability',
    description:
      'Picture a glowing red light at the base of your spine, rooting you to the earth beneath you. With each chant of LAM, feel yourself more supported, safe, and stable — fully present in your body.',
    durationSeconds: 4 * 60,
    audioTrackKey: 'ocean-wave',
  },
  {
    key: 'sacral',
    name: 'Sacral',
    sanskritName: 'Svadhisthana',
    mantra: 'VAM',
    color: '#F77F00',
    theme: 'Creativity, emotion & pleasure',
    description:
      'Bring your attention just below the navel, where a warm orange glow moves freely like water. Let VAM soften anything held tight here, opening you to creativity, feeling, and gentle pleasure.',
    durationSeconds: 4 * 60,
    audioTrackKey: 'li-river',
  },
  {
    key: 'solar-plexus',
    name: 'Solar Plexus',
    sanskritName: 'Manipura',
    mantra: 'RAM',
    color: '#FCBF49',
    theme: 'Confidence & willpower',
    description:
      'Focus on the space above your navel, radiating like a bright yellow sun. Chanting RAM fans this inner fire, building quiet confidence, clarity of purpose, and the will to act.',
    durationSeconds: 4 * 60,
    audioTrackKey: 'flashes',
  },
  {
    key: 'heart',
    name: 'Heart',
    sanskritName: 'Anahata',
    mantra: 'YAM',
    color: '#52B788',
    theme: 'Love & compassion',
    description:
      'Rest your attention on the center of your chest, filling with soft green light. With every YAM, let your breath widen the space around your heart, extending compassion inward and outward.',
    durationSeconds: 5 * 60,
    audioTrackKey: 'moonstone',
  },
  {
    key: 'throat',
    name: 'Throat',
    sanskritName: 'Vishuddha',
    mantra: 'HAM',
    color: '#4895EF',
    theme: 'Truth & expression',
    description:
      'Bring awareness to your throat, glowing a clear sky blue. Let HAM loosen anything unspoken, making room to express your truth honestly, calmly, and without holding back.',
    durationSeconds: 4 * 60,
    audioTrackKey: 'crystal',
  },
  {
    key: 'third-eye',
    name: 'Third Eye',
    sanskritName: 'Ajna',
    mantra: 'OM',
    color: '#3F37C9',
    theme: 'Intuition & insight',
    description:
      'Turn your attention to the space between your eyebrows, deep indigo and still. As you chant OM, let outer noise fade so your own quiet intuition and inner insight can come forward.',
    durationSeconds: 5 * 60,
    audioTrackKey: 'bright-halo',
  },
  {
    key: 'crown',
    name: 'Crown',
    sanskritName: 'Sahasrara',
    mantra: 'OM',
    color: '#B5838D',
    theme: 'Connection & transcendence',
    description:
      'Rest your attention at the crown of your head, bathed in violet-white light. Chakra tradition holds this center as beyond sound — chant OM softly, then let it dissolve into silence and simply rest in that stillness.',
    durationSeconds: 5 * 60,
    audioTrackKey: 'moonstone',
  },
];

export function findChakra(key: string): Chakra | undefined {
  return CHAKRAS.find((chakra) => chakra.key === key);
}
