import { THEME_OPTIONS, type ThemeId } from '../theme/themeRegistry';

interface Props {
  current: ThemeId;
  onChange: (id: ThemeId) => void;
  compact?: boolean; // top-bar dropdown mode
}

export default function ThemePicker({ current, onChange, compact }: Props) {
  if (compact) {
    return (
      <div className="theme-picker-compact">
        <span className="theme-swatch-dot" data-theme-preview={current} />
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="theme-select"
          title="Change theme"
        >
          {THEME_OPTIONS.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Full chip grid (used in settings if needed later)
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
