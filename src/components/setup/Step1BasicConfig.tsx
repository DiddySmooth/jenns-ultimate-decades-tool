import { DAYS_OF_WEEK } from '../../types/tracker';
import type { WizardState } from '../../types/tracker';

interface Props {
  config: WizardState['basicConfig'];
  onChange: (patch: Partial<WizardState['basicConfig']>) => void;
  onNext: () => void;
}

export default function Step1BasicConfig({ config, onChange, onNext }: Props) {
  const isValid = config.startYear !== '' && Number(config.startYear) > 0 && config.daysPerYear > 0;

  return (
    <div className="wizard-step">
      <h2>Basic Configuration</h2>
      <p className="step-description">
        Set up the core time settings for your challenge.
      </p>

      <div className="field-group">
        <label htmlFor="startYear">Start Year</label>
        <input
          id="startYear"
          type="number"
          placeholder="e.g. 1890"
          value={config.startYear}
          onChange={(e) => onChange({ startYear: e.target.value === '' ? '' : Number(e.target.value) })}
        />
      </div>

      <div className="field-group">
        <label htmlFor="daysPerYear">Sim Days per Year</label>
        <input
          id="daysPerYear"
          type="number"
          min={1}
          value={config.daysPerYear}
          onChange={(e) => onChange({ daysPerYear: Number(e.target.value) })}
        />
        <span className="field-hint">Default: 4 sim days = 1 year</span>
      </div>

      <div className="field-group">
        <label htmlFor="startDay">Starting Day of Week</label>
        <select
          id="startDay"
          value={config.startDayOfWeek}
          onChange={(e) => onChange({ startDayOfWeek: e.target.value })}
        >
          {DAYS_OF_WEEK.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="wizard-nav">
        <button className="btn-primary" disabled={!isValid} onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  );
}
