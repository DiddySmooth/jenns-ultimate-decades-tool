import { useEffect, useState } from 'react';
import { DEFAULT_THEME_ID, type ThemeId } from '../theme/themeRegistry';

const THEME_KEY = 'judt_theme';

export function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    return localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME_ID;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(THEME_KEY, themeId);
  }, [themeId]);

  return { themeId, setThemeId };
}
