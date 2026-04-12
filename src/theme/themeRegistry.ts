export interface ThemeOption {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_THEME_ID = 'default';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Earthy greens and neutral tones',
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Clean white with warm neutrals',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Dark surfaces, easy on the eyes',
  },
  {
    id: 'klein-blue',
    label: 'Klein Blue',
    description: 'International Klein Blue, Majorelle, soft periwinkle, powder blush, rose kiss',
  },
  {
    id: 'berry-jungle',
    label: 'Berry Jungle',
    description: 'Princeton orange, berry lipstick, royal plum, midnight violet, jungle green',
  },
  {
    id: 'petal-pop',
    label: 'Petal Pop',
    description: 'Beige, powder blush, petal rouge, vibrant coral, neon pink',
  },
  {
    id: 'sims',
    label: 'Sims',
    description: 'Rich cerulean, fresh sky, sky surge, emerald, yellow-green',
  },
  {
    id: 'grape-willow',
    label: 'Grape Willow',
    description: 'Dusty grape, lavender purple, celadon, willow green, dusty olive',
  },
  {
    id: 'amaranth-sun',
    label: 'Amaranth Sun',
    description: 'Onyx, amaranth, tomato, tuscan sun, pacific blue',
  },
  {
    id: 'tropical-mauve',
    label: 'Tropical Mauve',
    description: 'Tropical teal, mauve shadow, golden apricot, golden sand, lime cream',
  },
  {
    id: 'evergreen-fawn',
    label: 'Evergreen Fawn',
    description: 'Evergreen, hunter green, olive bark, soft fawn',
  },
  {
    id: 'twilight-rose',
    label: 'Twilight Rose',
    description: 'Blush rose, raspberry plum, deep twilight',
  },
  {
    id: 'coffee-teal',
    label: 'Coffee & Teal',
    description: 'Coffee bean, dark teal, canary yellow',
  },
];

export type ThemeId = string;
