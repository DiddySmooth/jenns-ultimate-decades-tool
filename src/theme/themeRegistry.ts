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
];

export type ThemeId = string;
