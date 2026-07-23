export type CategoryAppliesTo = 'habit' | 'task' | 'both';

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  applies_to: CategoryAppliesTo;
  created_at: string;
};

export const CATEGORY_ICON_OPTIONS = [
  'star',
  'heart',
  'flame',
  'briefcase',
  'cash',
  'school',
  'medkit',
  'bicycle',
  'game-controller',
  'paw',
  'home',
  'restaurant',
  'color-palette',
  'chatbubble',
  'trail-sign',
  'body',
] as const;

export const CATEGORY_COLOR_OPTIONS = [
  '#FF3B30',
  '#FF9500',
  '#F5A623',
  '#34C759',
  '#00BFA5',
  '#3D8BFF',
  '#7C4DFF',
  '#AF52DE',
  '#FF2D55',
];
