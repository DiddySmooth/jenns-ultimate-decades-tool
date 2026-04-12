import { THEME_OPTIONS, type ThemeId } from '../theme/themeRegistry';

interface Props {
  current: ThemeId;
  onChange: (id: ThemeId) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  return (
    <div className="theme-picker">
      <span className="theme-picker-label">Theme</span>
      <div className="theme-picker-options">
        {THEME_OPTIONS.map((theme) => (
          <button
            key={theme.id}
            className={`theme-chip${current === theme.id ? ' active' : ''}`}
            onClick={() => onChange(theme.id)}
            title={theme.description}
            data-theme-preview={theme.id}
          >
            <span className="theme-chip-swatch" />
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
}
